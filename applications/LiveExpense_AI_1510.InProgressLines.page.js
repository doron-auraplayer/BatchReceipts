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

function inProgressLineUpdateLoadingBanner(complete) {
    var $loading = $('#Loading_container');
    $loading.toggleClass('in-progress-lines-complete', complete);
    $loading.find('label > nobr').text(complete
        ? 'Receipt lines added to EBS.'
        : 'Adding receipt lines to EBS…');
}

function inProgressLineRefreshStart() {
    var run;
    inProgressLineRefreshStop();
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
    var page = String(Page.getCurrentPage()).toLowerCase();
    if (page === 'inprogresslines.html') {
        return true;
    }
    // Opening the side menu keeps the InProgressLines page behind it.
    return page === 'leftpanel.html'
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
            if (!inProgressLineRefreshIsActive(run)) {
                return;
            }
            inProgressLineUpdateLoadingBanner(Boolean(
                tableRows && tableRows.length > 0
                && inProgressLineRefreshHasTerminalStatuses()
            ));
            Fields.set(
                'REPORT_CREATE_DATE',
                formatReceiptDate(Storage.get('REPORT_CREATE_DATE'), 'DD-Mon-YYYY')
            );
            // Services.call already repopulated the table, so the docked
            // preview is untouched; only the status icons are redrawn.
            inProgressLineWaitForStatusTable(function (table) {
                if (inProgressLineRefreshIsActive(run)) {
                    inProgressLineDecorateStatusColumn(table);
                }
            });
            inProgressLineRefreshContinue(run, false, tableRows);
        },
        function () {
            inProgressLineRefreshContinue(run, true);
        },
        { REPORT_NUMBER: run.reportNumber }
    );
}

function inProgressLineRefreshContinue(run, failed, tableRows) {
    if (run !== inProgressLineRefreshCurrentRun) {
        return;
    }
    run.inFlight = false;
    if (failed && !inProgressLineRefreshWarningLogged) {
        inProgressLineRefreshWarningLogged = true;
        console.warn('In-progress line refresh failed; retrying until the timeout is reached.');
    }
    if (!failed
        && tableRows
        && tableRows.length > 0
        && inProgressLineRefreshHasTerminalStatuses()) {
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

function inProgressLineRefreshHasTerminalStatuses() {
    var statuses = Storage.getArray('RECEIPTBATCH_STATUS') || [];
    if (statuses.length === 0) {
        return false;
    }
    return statuses.every(function (status) {
        var normalized = inProgressLineNormalizeStatus(status);
        return normalized === 'LINE_CREATED' || normalized === 'LINE_FAILED';
    });
}

function inProgressLineWaitForStatusTable(callback, attemptsLeft) {
    var maxAttempts = attemptsLeft === undefined
        ? IN_PROGRESS_LINE_STATUS_MAX_ATTEMPTS
        : attemptsLeft;
    var tableElement = $('#tableOutput');

    if (
        tableElement.length &&
        $.fn.DataTable &&
        $.fn.DataTable.isDataTable('#tableOutput')
    ) {
        callback(tableElement.DataTable());
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

    if (status === 'LINE_CREATED') {
        return {
            stateClass: 'in-progress-line-status-created',
            label: 'Created'
        };
    }

    if (status === 'LINE_FAILED') {
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
