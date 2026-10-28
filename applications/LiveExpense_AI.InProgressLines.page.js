// ============================================================================
// InProgressLines.html
// Status column as icons. JavaScript only: no colours, no sizes, no glyphs.
// The icon itself is drawn by the page CSS ::before of the status span.
// ============================================================================

var IN_PROGRESS_LINE_STATUS_HEADER_ID = '*th*RECEIPTBATCH_STATUS';
var IN_PROGRESS_LINE_STATUS_MAX_ATTEMPTS = 20;
var IN_PROGRESS_LINE_STATUS_RETRY_MS = 100;

var IN_PROGRESS_LINE_STATUS_SPAN_CLASS = 'in-progress-line-status';
var IN_PROGRESS_LINE_STATUS_CELL_CLASS = 'in-progress-line-status-cell';

var IN_PROGRESS_LINE_STATUS_STATE_CLASSES = [
  'in-progress-line-status-pending',
  'in-progress-line-status-created',
  'in-progress-line-status-failed'
];

var IN_PROGRESS_LINE_STATUS_CREATED = 'LINE_CREATED';
var IN_PROGRESS_LINE_STATUS_FAILED = 'LINE_FAILED';
var IN_PROGRESS_LINE_ALL_SUCCESS_CLASS = 'in-progress-line-all-success';
var IN_PROGRESS_LINE_FAILURES_ONLY_CLASS = 'in-progress-line-failures-only';
var IN_PROGRESS_LINE_NOT_FAILED_CLASS = 'in-progress-line-not-failed';
var IN_PROGRESS_LINE_FAILED_FILTER = '^LINE_FAILED$';

// Automatic refresh of the in-progress report header and lines.
// Set enabled to false to disable the automatic repeats; the initial data load
// still runs once so the page keeps working normally without polling.
var IN_PROGRESS_LINE_REFRESH = {
    enabled: true,
    intervalMs: 5000,
    timeoutMs: 10 * 60 * 1000
};

// Current polling run; null when there is no active run for this page.
var inProgressLineRefreshCurrentRun = null;
var inProgressLineRefreshWarningLogged = false;

function onLoad() {
    Table.clear();

    $('#EditReport').closest('.button-field-container').addClass('in-progress-edit-report-control');

    configureReceiptViewer({
        allowApprove: false,
        showData: true,
        allowEdit: false,
        previewLayout: 'split',
        readOnly: true
    });

    inProgressLineAttachLoadingBanner();
    inProgressLineUpdateLoadingBanner(false);

    inProgressLineRefreshStart();
}

// Automatic refresh helpers ------------------------------------------------

function inProgressLineAttachLoadingBanner() {
    var $tableContainer = $('#tableOutput').closest('.table-field-container');
    var $loading = $('#Loading_container');
    if ($tableContainer.length && $loading.length) {
        $tableContainer.addClass('in-progress-line-table-container');
        $loading.prependTo($tableContainer);
    }
}

function inProgressLineUpdateLoadingBanner(complete, failedCount, totalCount) {
    var $loading = $('#Loading_container');
    var failures = complete && Number(failedCount) > 0 ? Number(failedCount) : 0;
    var total = Number(totalCount);
    var failed = failures > 0;
    var label = 'Adding receipt lines to EBS…';

    total = isFinite(total) && total > 0 ? Math.floor(total) : 0;

    if (complete) {
        if (failed) {
            if (total > 0) {
                label = total === 1
                    ? '1 of 1 receipt could not be added to EBS.'
                    : failures + ' of ' + total + ' receipts could not be added to EBS.';
            } else {
                label = failures === 1
                    ? '1 receipt could not be added to EBS.'
                    : failures + ' receipts could not be added to EBS.';
            }
            label += failures === 1
                ? ' Review the failed receipt below. You can add it manually when approving the report.'
                : ' Review the failed receipts below. You can add them manually when approving the report.';
        } else if (total > 0) {
            label = total === 1
                ? '1 receipt was added to EBS successfully.'
                : 'All ' + total + ' receipts were added to EBS successfully.';
        } else {
            label = 'All receipt lines were added to EBS successfully.';
        }
    } else if (total > 0) {
        label = total === 1
            ? 'Adding 1 receipt to EBS…'
            : 'Adding ' + total + ' receipts to EBS…';
    }

    $('#EditReport')
        .prop('disabled', !complete)
        .attr('aria-disabled', String(!complete));
    $loading.toggleClass('in-progress-lines-complete', complete);
    $loading.toggleClass('in-progress-lines-failed', failed);
    $loading.toggleClass('in-progress-lines-success', Boolean(complete) && !failed);
    $loading.find('label > nobr').text(label);
}

function inProgressLineRefreshStart() {
    var run;
    inProgressLineRefreshStop();
    inProgressLineResetCompletedView();
    inProgressLineRefreshWarningLogged = false;
    run = {
        reportNumber: inProgressLineRefreshCanonicalReportNumber(),
        startedAt: new Date().getTime(),
        timer: null,
        inFlight: false,
        headerLoaded: false
    };
    inProgressLineRefreshCurrentRun = run;
    // Bind the cleanup handlers once per page entry; Stop detaches them again.
    $(window).on('hashchange.inProgressLineRefresh', function () {
        if (!inProgressLineRefreshIsPageCurrent()) {
            inProgressLineRefreshStop();
        }
    });
    $(window).on('pagehide.inProgressLineRefresh', inProgressLineRefreshStop);
    if (run.reportNumber === '') {
        return; // Never request with a blank report number.
    }
    inProgressLineRefreshLoadRound(run);
}

function inProgressLineRefreshStop() {
    var run = inProgressLineRefreshCurrentRun;
    if (run !== null && run.timer !== null) {
        clearTimeout(run.timer);
        run.timer = null;
    }
    inProgressLineRefreshCurrentRun = null;
    $(window).off('.inProgressLineRefresh');
}

function inProgressLineRefreshCanonicalReportNumber() {
    var reportNumber = Storage.get('ReportNumber');
    if (reportNumber === null || reportNumber === undefined) {
        return '';
    }
    return String(reportNumber).trim();
}

function inProgressLineRefreshIsPageCurrent() {
    var currentPage = Page.getCurrentPage();
    var page = String(currentPage === null || currentPage === undefined ? '' : currentPage)
        .trim()
        .toLowerCase();
    var fragmentIndex = page.indexOf('#');
    var queryIndex;

    // Popup.openPage keeps the old URL and only changes the hash, so the real
    // page is the fragment after '#', not the index.html before it.
    if (fragmentIndex !== -1) {
        page = page.substring(fragmentIndex + 1);
    }

    // A fragment or URL may still carry query parameters; keep only the page.
    queryIndex = page.search(/[?&]/);
    if (queryIndex !== -1) {
        page = page.substring(0, queryIndex);
    }

    page = page.substring(page.lastIndexOf('/') + 1).replace(/\.html$/, '');
    if (page === 'inprogresslines') {
        return true;
    }
    // Opening the side menu keeps the InProgressLines page behind it.
    return page === 'leftpanel'
        && $('#mainPage').hasClass('ap-page-inprogresslines');
}

function inProgressLineRefreshIsActive(run) {
    return run !== null
        && run === inProgressLineRefreshCurrentRun
        && inProgressLineRefreshIsPageCurrent()
        && inProgressLineRefreshCanonicalReportNumber() === run.reportNumber;
}

function inProgressLineRefreshLoadRound(run) {
    if (!inProgressLineRefreshIsActive(run) || run.inFlight) {
        return;
    }
    run.inFlight = true;
    if (run.headerLoaded) {
        inProgressLineRefreshLoadLines(run);
    } else {
        inProgressLineRefreshLoadHeader(run);
    }
}

function inProgressLineRefreshLoadHeader(run) {
    Services.call(
        'ReceiptBatch_get_draft_report_Data',
        function (response) {
            var elements = response && response.Response
                && response.Response.ReceiptBatch_get_draft_report_DataElements;
            var headerReportNumber = elements ? elements.REPORT_NUMBER : null;
            if (!inProgressLineRefreshIsActive(run)) {
                return;
            }
            // Only this report's header counts; an empty header is retried.
            if (String(headerReportNumber).trim() === run.reportNumber) {
                run.headerLoaded = true;
            }
            inProgressLineRefreshLoadLines(run);
        },
        function () {
            inProgressLineRefreshContinue(run, true);
        },
        { ReportNumber: run.reportNumber }
    );
}

function inProgressLineRefreshLoadLines(run) {
    Services.call(
        'ReceiptBatch_get_draft_report_lines',
        function (response, serviceName, tableRows) {
            var completion;
            if (!inProgressLineRefreshIsActive(run)) {
                return;
            }
            // Completion is decided from the full Storage statuses before the
            // display filter changes which rows DataTables shows.
            completion = inProgressLineRefreshCompletion(tableRows);
            inProgressLineUpdateLoadingBanner(
                completion.completed,
                completion.failedCount,
                completion.totalCount
            );
            Fields.set(
                'REPORT_CREATE_DATE',
                formatReceiptDate(Storage.get('REPORT_CREATE_DATE'), 'DD-Mon-YYYY')
            );
            // Services.call already repopulated the table, so the docked
            // preview is untouched; only the status icons are redrawn.
            inProgressLineWaitForStatusTable(function (table) {
                if (inProgressLineRefreshIsActive(run)) {
                    inProgressLineDecorateStatusColumn(table);
                    inProgressLineApplyCompletedView(
                        table,
                        completion.completed,
                        completion.failedCount
                    );
                }
            });
            inProgressLineRefreshContinue(run, false, completion.completed);
        },
        function () {
            inProgressLineRefreshContinue(run, true);
        },
        { REPORT_NUMBER: run.reportNumber }
    );
}

function inProgressLineRefreshContinue(run, failed, completed) {
    if (run !== inProgressLineRefreshCurrentRun) {
        return;
    }
    run.inFlight = false;
    if (failed && !inProgressLineRefreshWarningLogged) {
        inProgressLineRefreshWarningLogged = true;
        console.warn('In-progress line refresh failed; retrying until the timeout is reached.');
    }
    if (!failed && completed) {
        return;
    }
    if (!inProgressLineRefreshIsActive(run)
        || !IN_PROGRESS_LINE_REFRESH.enabled
        || new Date().getTime() - run.startedAt >= IN_PROGRESS_LINE_REFRESH.timeoutMs) {
        return;
    }
    run.timer = setTimeout(function () {
        run.timer = null;
        // Checked again so setting enabled to false stops the next request.
        if (IN_PROGRESS_LINE_REFRESH.enabled
            && new Date().getTime() - run.startedAt < IN_PROGRESS_LINE_REFRESH.timeoutMs) {
            inProgressLineRefreshLoadRound(run);
        }
    }, IN_PROGRESS_LINE_REFRESH.intervalMs);
}

function inProgressLineRefreshCompletion(tableRows) {
    // The total is the full, unfiltered status list, never the rendered rows.
    var statuses = Storage.getArray('RECEIPTBATCH_STATUS') || [];
    var completed = Boolean(
        tableRows
        && tableRows.length > 0
        && inProgressLineRefreshHasTerminalStatuses()
    );

    return {
        completed: completed,
        failedCount: completed ? inProgressLineRefreshFailedStatusCount() : 0,
        totalCount: statuses.length
    };
}

function inProgressLineRefreshHasTerminalStatuses() {
    var statuses = Storage.getArray('RECEIPTBATCH_STATUS') || [];
    if (statuses.length === 0) {
        return false;
    }
    return statuses.every(function (status) {
        var normalized = inProgressLineNormalizeStatus(status);
        return normalized === IN_PROGRESS_LINE_STATUS_CREATED
            || normalized === IN_PROGRESS_LINE_STATUS_FAILED;
    });
}

function inProgressLineRefreshFailedStatusCount() {
    var statuses = Storage.getArray('RECEIPTBATCH_STATUS') || [];
    return statuses.filter(function (status) {
        return inProgressLineNormalizeStatus(status) === IN_PROGRESS_LINE_STATUS_FAILED;
    }).length;
}

function inProgressLineStatusTableIfReady() {
    var tableElement = $('#tableOutput');

    if (
        tableElement.length &&
        $.fn.DataTable &&
        $.fn.DataTable.isDataTable('#tableOutput')
    ) {
        return tableElement.DataTable();
    }

    return null;
}

function inProgressLineWaitForStatusTable(callback, attemptsLeft) {
    var maxAttempts = attemptsLeft === undefined
        ? IN_PROGRESS_LINE_STATUS_MAX_ATTEMPTS
        : attemptsLeft;
    var table = inProgressLineStatusTableIfReady();

    if (table !== null) {
        callback(table);
        return;
    }

    if (maxAttempts <= 0) {
        console.log('Status table was not initialized in time');
        return;
    }

    setTimeout(function () {
        inProgressLineWaitForStatusTable(callback, maxAttempts - 1);
    }, IN_PROGRESS_LINE_STATUS_RETRY_MS);
}

// Completed report display. Completion is detected from the full Storage
// statuses; the DataTables filter only changes which rows are shown, never the
// underlying rows or Storage.
function inProgressLineApplyCompletedView(table, completed, failedCount) {
    var $container = $('#tableOutput').closest('.in-progress-line-table-container');
    var allSucceeded = Boolean(completed && !(failedCount > 0));
    var failuresOnly = Boolean(completed && failedCount > 0);
    var filter = Boolean(completed && failedCount > 0)
        ? IN_PROGRESS_LINE_FAILED_FILTER
        : '';
    var columnIndex = inProgressLineStatusColumnIndex(table);
    var column;
    var currentFilter;

    $container.toggleClass(IN_PROGRESS_LINE_ALL_SUCCESS_CLASS, allSucceeded);
    $container.toggleClass(IN_PROGRESS_LINE_FAILURES_ONLY_CLASS, failuresOnly);

    if (columnIndex === null) {
        return;
    }

    column = table.column(columnIndex);
    currentFilter = column.search();

    if (currentFilter === undefined || currentFilter === null) {
        currentFilter = '';
    }

    if (String(currentFilter) === filter) {
        return;
    }

    column.search(filter, filter !== '', false);
    // One redraw after decoration only. The draw handler never applies the
    // filter, so normal draws and sorts cannot start a draw recursion.
    table.draw(false);
}

function inProgressLineResetCompletedView(table) {
    var $container = $('#tableOutput').closest('.in-progress-line-table-container');
    var columnIndex;
    var column;
    var currentFilter;

    $container.removeClass(IN_PROGRESS_LINE_ALL_SUCCESS_CLASS);
    $container.removeClass(IN_PROGRESS_LINE_FAILURES_ONLY_CLASS);

    table = table || inProgressLineStatusTableIfReady();

    if (!table) {
        return;
    }

    columnIndex = inProgressLineStatusColumnIndex(table);

    if (columnIndex === null) {
        return;
    }

    column = table.column(columnIndex);
    currentFilter = column.search();

    if (currentFilter === undefined
        || currentFilter === null
        || String(currentFilter) === '') {
        return;
    }

    column.search('', false, false);
    table.draw(false);
}

function inProgressLineDecorateStatusColumn(table) {
    table
        .off('draw.inProgressLineStatus')
        .on('draw.inProgressLineStatus', function () {
            inProgressLineApplyStatusIcons(table);
        });

    inProgressLineApplyStatusIcons(table);
}

function inProgressLineApplyStatusIcons(table) {
    var columnIndex = inProgressLineStatusColumnIndex(table);

    if (columnIndex === null) {
        return;
    }

    table.column(columnIndex).nodes().each(function (cell) {
        inProgressLineDecorateStatusCell(table, cell);
    });
}

function inProgressLineStatusColumnIndex(table) {
    var index = null;

    table.columns().header().each(function (header, position) {
        var headerId = inProgressLineElementId(header);

        if (
            index === null &&
            headerId === IN_PROGRESS_LINE_STATUS_HEADER_ID
        ) {
            index = position;
        }
    });

    return index;
}

function inProgressLineElementId(element) {
    var attributeId = element && element.getAttribute
        ? element.getAttribute('id')
        : null;

    if (attributeId !== null && attributeId !== undefined) {
        return String(attributeId);
    }

    return '';
}

function inProgressLineDecorateStatusCell(table, cell) {
    var $cell = $(cell);
    var rawStatus = table.cell(cell).data();
    var status = inProgressLineNormalizeStatus(rawStatus);

    $cell.closest('tr').toggleClass(
        IN_PROGRESS_LINE_NOT_FAILED_CLASS,
        status !== IN_PROGRESS_LINE_STATUS_FAILED
    );

    var definition = inProgressLineStatusDefinition(status);

    inProgressLineClearStatusDecoration($cell);

    if (status === '') {
        $cell.empty();
        return;
    }

    if (definition === null) {
        $cell.text(inProgressLineStatusText(rawStatus));
        return;
    }

    $cell
        .addClass(IN_PROGRESS_LINE_STATUS_CELL_CLASS)
        .empty()
        .append(inProgressLineStatusSpan(definition));
}

function inProgressLineNormalizeStatus(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value).trim().toUpperCase();
}

function inProgressLineStatusDefinition(status) {
    if (status === 'READY') {
        return {
            stateClass: 'in-progress-line-status-pending',
            label: 'Pending'
        };
    }

    if (status === IN_PROGRESS_LINE_STATUS_CREATED) {
        return {
            stateClass: 'in-progress-line-status-created',
            label: 'Created'
        };
    }

    if (status === IN_PROGRESS_LINE_STATUS_FAILED) {
        return {
            stateClass: 'in-progress-line-status-failed',
            label: 'Failed'
        };
    }

    return null;
}

function inProgressLineStatusSpan(definition) {
    return $('<span></span>')
        .addClass(IN_PROGRESS_LINE_STATUS_SPAN_CLASS)
        .addClass(definition.stateClass)
        .attr('role', 'img')
        .attr('aria-label', definition.label)
        .attr('title', definition.label);
}

function inProgressLineStatusText(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value).trim();
}

function inProgressLineClearStatusDecoration($cell) {
    $cell
        .children('.' + IN_PROGRESS_LINE_STATUS_SPAN_CLASS)
        .remove();

    $cell.removeClass(
        IN_PROGRESS_LINE_STATUS_CELL_CLASS + ' '
        + IN_PROGRESS_LINE_STATUS_STATE_CLASSES.join(' ')
    );
}

// Receipt preview is provided by Common JavaScript.
function onTableClick(row, col, rowCells) {
    Preview(row);
}

function editReport() {
    var hasPendingLines = Storage.getArray('RECEIPTBATCH_STATUS').some(function (status) {
        return inProgressLineNormalizeStatus(status) === 'READY';
    });

    if (hasPendingLines) {
        Popup.toast('Some receipts are still pending. Please wait.', 3000);
        return;
    }

    reLoginAndRun(function () {
        Services.call(
            'ReceiptBatch_DraftReport',
            function () {
                Storage.set('updateMode', 'true');
                Storage.set('draftAiReport', 'true');
                Page.navigate('Report_General.html');
            },
            displayReportServiceError('Failed to get report details')
        );
    });
}
