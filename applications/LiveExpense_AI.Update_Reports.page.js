var rowIdToDelete;
var rpaReports = [];
cleanExpenseStorageVariables();
var previousRange;

var updateReportsPageActive = false;
var reportProgressGeneration = typeof reportProgressGeneration === 'number' ? reportProgressGeneration : 0;
var REPORT_PROGRESS_BUTTON_LABEL = 'Report is being processed. View progress';

function removeReport (rowIdToDelete) {
        if (isProcessingReportAction(rowIdToDelete)) {
            return;
        }
        Storage.set("indexLineToRemove", rowIdToDelete);
        Services.call("iExpense_removeUpdateReport", function() {onLoad();});
}

function updateReport (rowId) {
        if (isProcessingReportAction(rowId)) {
            return;
        }
        Storage.set("indexLineToUpdate", rowId)
        Services.call("iExpense_gotoUpdateReport", function() {
            Storage.set("updateMode", "true");
            Page.navigate("Report_General.html");
        }, displayReportServiceError("Failed to get report details"))
}

function onGetUpdReportsSuccess(){

    // set prev/next button
    var paginationExists = Storage.get("paginationExists") === 'true';

    if (paginationExists) {
        var nextButtonExists = Storage.get('nextButtonExist') == 'true';
        $('#Next').prop( "disabled", (!nextButtonExists || previousRange == Storage.get("currentListRange")));
        $("#Next").text(getPaginationButtonLabel("Next", Storage.get("nextButtonLabel") !== ""?Storage.get("nextButtonLabel"):"Next"));
    
        var prevButtonExists = Storage.get('prevButtonExist') == 'true';
        $('#Previous').prop( "disabled", !prevButtonExists);
        $("#Previous").text(getPaginationButtonLabel("Previous", Storage.get("prevButtonLabel") !== ""?Storage.get("prevButtonLabel"):"Previous"));
    
        $("#listRange").text(Storage.get("currentListRange"));
    } else {
        $('#Previous').hide();
        $("#Next").hide();
        $("#listRange").hide();
    }

    var table = $('#tableOutput').DataTable();
    var rowCount = table.rows().count();

    if (rowCount === 0) {
        handleEmptyTableState();
    } else {
        $('#tableOutput_wrapper').show();
    }

    bindReportProgressDrawHandler();
    applyReportProgressActions();
    reportStatus();
}

function handleEmptyTableState() {

    $('#Next').prop("disabled", true);
    $('#Previous').prop("disabled", true);
    $("#listRange").text("No reports");

    $('#tableOutput_filter').hide();
    $('#tableOutput_length').hide();
    $('#tableOutput_info').hide();
    $('#tableOutput_paginate').hide();
}

function loadUpdateReportsTable() {
    Services.call("iExpense_getUpdReports", onGetUpdReportsSuccess, displayReportServiceError("Failed to load data, please try again or contact your administrator"));
}

function normalizeReportNumber(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value).trim().toUpperCase();
}

function parseDraftReportSummaries(response, tableRows) {
    var canonicalTable = response && response.Response && response.Response.ReceiptBatch_get_draft_reportsTableArray;
    var canonicalItems = canonicalTable && canonicalTable.ReceiptBatch_get_draft_reportsArrayItem;
    var rows;

    if (canonicalItems) {
        rows = Array.isArray(canonicalItems) ? canonicalItems : [canonicalItems];
    } else if (Array.isArray(tableRows)) {
        rows = tableRows;
    } else {
        rows = [];
    }

    var reports = [];

    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];

        if (!row || row.REPORT_NUMBER === null || row.REPORT_NUMBER === undefined) {
            continue;
        }

        var reportNumber = normalizeReportNumber(row.REPORT_NUMBER);

        if (reportNumber === '') {
            continue;
        }

        reports.push({
            REPORT_NUMBER: reportNumber,
            PENDING_LINES: Number(row.PENDING_LINES) || 0,
            CREATED_LINES: Number(row.CREATED_LINES) || 0,
            FAILED_LINES: Number(row.FAILED_LINES) || 0,
            TOTAL_LINES: Number(row.TOTAL_LINES) || 0,
        });
    }

    return reports;
}

function onGetDraftReportsSuccess(response, serviceName, tableRows) {
    rpaReports = parseDraftReportSummaries(response, tableRows);
    loadUpdateReportsTable();
}

function onGetDraftReportsFailure() {
    rpaReports = [];
    console.warn('Failed to load receipt report summaries.');
    loadUpdateReportsTable();
}

function onLoad() {

    updateReportsPageActive = true;
    reportProgressGeneration += 1;
    bindReportProgressPageLeaveHandlers();
    $('#tableOutput').off('draw.rpaReportProgress');

    // set prev/next button
    $('#Next').prop( "disabled",  true);
    $('#Next').parent().prop( "style",  'flex: 1 1 50px !important');
    $('#Previous').prop( "disabled", true);
    $('#Previous').parent().prop( "style",  'flex: 1 1 50px !important');
    if ($("#listRange").length === 0)  {
        $("<span id='listRange' style='flex: 1 1 50px !important; text-align: center; align-self: center'></span>").insertAfter($("#Previous").parent());
    }

    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
    Storage.remove("prevButtonExist");

    Storage.set("EBS_USER", Storage.get("LoggedInUsername"));
    rpaReports = [];
    var summaryGeneration = reportProgressGeneration;
    Services.call('ReceiptBatch_get_draft_reports', function(response, serviceName, tableRows) {
        if (summaryGeneration === reportProgressGeneration && isUpdateReportsPageCurrent()) {
            onGetDraftReportsSuccess(response, serviceName, tableRows);
        }
    }, function() {
        if (summaryGeneration === reportProgressGeneration && isUpdateReportsPageCurrent()) {
            onGetDraftReportsFailure();
        }
    });
}

function onNext() {
	Storage.set('moveNext', 'true');
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
    previousRange = Storage.get("currentListRange");
	Services.call('iExpense_getUpdReportsPrevNext', onGetUpdReportsSuccess, displayReportServiceError("Failed to fetch next reports"));
}

function onPrev() {
	Storage.set('moveNext', 'false');
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
	Services.call('iExpense_getUpdReportsPrevNext', onGetUpdReportsSuccess, displayReportServiceError("Failed to fetch previous reports"));
}

function Edit(rowIndex) {
    updateReport(rowIndex)
}
function Delete(rowIndex) {
    Popup.okCancel(getTranslationForId("@popup_report_remove_title"), getTranslationForId("@popup_report_remove_message"), function() {
        removeReport(rowIndex)} );
}
function Duplicate(rowIndex) {
    if (isProcessingReportAction(rowIndex)) {
        return;
    }
    Storage.set("duplicateUpdateRepostIndex", rowIndex);
	Services.call('iExpense_duplicate_update_report', function() {
	    Storage.set("DuplicateReport", "true");
	    Page.navigate("Report_General");
	}, displayReportServiceError("Failed to withdraw report"));
    
}

function getUpdateReportsTable() {
    var $table = $('#tableOutput');

    if (!$table.length) {
        return null;
    }

    if ($.fn.DataTable && $.fn.DataTable.isDataTable && !$.fn.DataTable.isDataTable($table)) {
        return null;
    }

    return $table.DataTable();
}

function findUpdateReportsColumnIndex(table, headerId) {
    var columnCount = table.columns().count();

    for (var i = 0; i < columnCount; i++) {
        var header = table.column(i).header();

        if (header && header.id === headerId) {
            return i;
        }
    }

    return -1;
}

function getReportNumberFromRow(table, $row) {
    var reportColumnIndex = findUpdateReportsColumnIndex(table, '*th*UpdateReportNumber');

    if (reportColumnIndex < 0) {
        return '';
    }

    var $reportCell = $row.children('td').eq(reportColumnIndex);

    if (!$reportCell.length) {
        return '';
    }

    return normalizeReportNumber($reportCell.text());
}

function getRowNodeByActionId(table, rowId) {
    var rowIndex = null;

    if (typeof rowId === 'number') {
        rowIndex = rowId;
    } else if (typeof rowId === 'string' && /^\d+$/.test($.trim(rowId))) {
        rowIndex = parseInt($.trim(rowId), 10);
    }

    if (rowIndex === null || !isFinite(rowIndex) || rowIndex < 0) {
        return null;
    }

    var row = table.row(rowIndex);

    return row && row.node ? row.node() : null;
}

function getActionReportNumber(rowId) {
    if (rowId && typeof rowId === 'object' && rowId.REPORT_NUMBER !== undefined) {
        return normalizeReportNumber(rowId.REPORT_NUMBER);
    }

    var table = getUpdateReportsTable();

    if (table) {
        var rowNode = getRowNodeByActionId(table, rowId);

        if (rowNode) {
            var rowReportNumber = getReportNumberFromRow(table, $(rowNode));

            if (rowReportNumber !== '') {
                return rowReportNumber;
            }
        }
    }

    return normalizeReportNumber(rowId);
}

function isProcessingReportNumber(reportNumber) {
    var normalizedReportNumber = normalizeReportNumber(reportNumber);

    if (normalizedReportNumber === '') {
        return false;
    }

    for (var i = 0; i < rpaReports.length; i++) {
        var report = rpaReports[i];

        if (report && normalizeReportNumber(report.REPORT_NUMBER) === normalizedReportNumber) {
            return (Number(report.PENDING_LINES) || 0) > 0;
        }
    }

    return false;
}

function isProcessingReportAction(rowId) {
    return isProcessingReportNumber(getActionReportNumber(rowId));
}

function createReportProgressButton() {
    var $button = $('<button/>', {
        type: 'button',
        'class': 'rpa-report-progress',
        'aria-label': REPORT_PROGRESS_BUTTON_LABEL,
        title: REPORT_PROGRESS_BUTTON_LABEL
    });

    $button.append($('<i/>', {
        'class': 'fa fa-cogs',
        'aria-hidden': 'true'
    }));

    return $button;
}

function bindReportProgressButton($button, reportNumber) {
    $button.on('click.rpaReportProgress', function(event) {
        event.preventDefault();
        event.stopImmediatePropagation();

        var clickedReportNumber = reportNumber;
        var table = getUpdateReportsTable();

        if (table) {
            var currentReportNumber = getReportNumberFromRow(table, $(this).closest('tr'));

            if (currentReportNumber !== '') {
                clickedReportNumber = currentReportNumber;
            }
        }

        // Storage.set('ReportNumber', clickedReportNumber);
        // Popup.openPage('InProgressLines.html', function(){}, '90%', '100%');
        // Page.navigate('InProgressLines.html');
    });
}

function decorateReportActionsCell($cell, reportNumber) {
    var $originalActions = $cell.data('rpaReportProgressOriginal');

    if ($originalActions === undefined || $originalActions === null) {
        $originalActions = $cell.contents().detach();
        $cell.data('rpaReportProgressOriginal', $originalActions);
    }

    if ($cell.find('.rpa-report-progress').length > 0) {
        return;
    }

    var $button = createReportProgressButton();
    bindReportProgressButton($button, reportNumber);
    $cell.append($button);
}

function restoreReportActionsCell($cell) {
    var $originalActions = $cell.data('rpaReportProgressOriginal');

    if ($originalActions === undefined || $originalActions === null) {
        return;
    }

    $cell.empty().append($originalActions);
    $cell.removeData('rpaReportProgressOriginal');
}

function applyReportProgressActions() {
    var table = getUpdateReportsTable();

    if (!table) {
        return;
    }

    var actionsColumnIndex = findUpdateReportsColumnIndex(table, '*th*Actions');
    var reportColumnIndex = findUpdateReportsColumnIndex(table, '*th*UpdateReportNumber');

    if (actionsColumnIndex < 0 || reportColumnIndex < 0) {
        return;
    }

    table.rows().every(function() {
        var rowNode = this.node ? this.node() : null;

        if (!rowNode) {
            return;
        }

        var $row = $(rowNode);
        var $actionCell = $row.children('td').eq(actionsColumnIndex);
        var $reportCell = $row.children('td').eq(reportColumnIndex);

        if (!$actionCell.length) {
            return;
        }

        var reportNumber = $reportCell.length ? normalizeReportNumber($reportCell.text()) : '';

        if (reportNumber !== '' && isProcessingReportNumber(reportNumber)) {
            decorateReportActionsCell($actionCell, reportNumber);
        } else {
            restoreReportActionsCell($actionCell);
        }
    });
}

function bindReportProgressDrawHandler() {
    var $table = $('#tableOutput');

    if (!$table.length) {
        return;
    }

    $table.off('draw.rpaReportProgress');
    $table.on('draw.rpaReportProgress', function() {
        applyReportProgressActions();
        reportStatus();
    });
}

function isUpdateReportsPageCurrent() {
    if (!updateReportsPageActive) {
        return false;
    }

    var currentPage = Page.getCurrentPage();
    var normalizedPage = currentPage ? String(currentPage).trim().toLowerCase() : '';

    if (normalizedPage === 'update_reports.html' || normalizedPage === 'update_reports') {
        return true;
    }

    if (normalizedPage === 'leftpanel.html' && $('#mainPage').hasClass('ap-page-update_reports')) {
        return true;
    }

    return false;
}

function handleUpdateReportsPageLeave(event) {
    if (event && event.type === 'hashchange' && isUpdateReportsPageCurrent()) {
        return;
    }

    updateReportsPageActive = false;
    reportProgressGeneration += 1;
    $('#tableOutput').off('draw.rpaReportProgress');
}

function bindReportProgressPageLeaveHandlers() {
    $(window)
        .off('hashchange.rpaReportProgress pagehide.rpaReportProgress')
        .on('hashchange.rpaReportProgress pagehide.rpaReportProgress', handleUpdateReportsPageLeave);
}


/************************************************************************************/

function reportStatus() {
    var $table = $('#tableOutput');
    var table = getUpdateReportsTable();
    var statusColumnIndex = -1;
    var reportColumnIndex = -1;

    if (table) {
        statusColumnIndex = findUpdateReportsColumnIndex(table, '*th*REPORT_LINE_STATUS');
        reportColumnIndex = findUpdateReportsColumnIndex(table, '*th*UpdateReportNumber');

        if (statusColumnIndex < 0 || reportColumnIndex < 0) {
            return;
        }
    } else {
        if (!$table.length) {
            return;
        }

        statusColumnIndex = $table
            .find('thead th')
            .filter(function() {
                return this.id === '*th*REPORT_LINE_STATUS';
            })
            .index();
        reportColumnIndex = $table
            .find('thead th')
            .filter(function() {
                return this.id === '*th*UpdateReportNumber';
            })
            .index();

        if (statusColumnIndex < 0 || reportColumnIndex < 0) {
            return;
        }
    }

    function getCount(value) {
        var count = Number(value);

        if (!isFinite(count) || count < 0) {
            return 0;
        }

        return count;
    }

    function findSummary(reportNumber) {
        if (reportNumber === '') {
            return null;
        }

        for (var i = 0; i < rpaReports.length; i++) {
            var summary = rpaReports[i];

            if (summary && normalizeReportNumber(summary.REPORT_NUMBER) === reportNumber) {
                return summary;
            }
        }

        return null;
    }

    function renderRow(row, rowIndex) {
        var $row = $(row);
        var $cell = table ? $(table.cell(rowIndex, statusColumnIndex).node()) : $row.children('td').eq(statusColumnIndex);

        if (!$cell.length) {
            return;
        }

        var reportNumber = table
            ? normalizeReportNumber($(table.cell(rowIndex, reportColumnIndex).node()).text())
            : normalizeReportNumber($row.children('td').eq(reportColumnIndex).text());
        var summary = findSummary(reportNumber);

        $cell.addClass('update-report-line-status-cell');

        if (!summary) {
            $cell.html('<span class="update-report-line-status-manual">Manually created</span>');
        } else if (isProcessingReportNumber(reportNumber)) {
            $cell.html('<span class="update-report-line-status-processing">Report is being processed</span>');
        } else {
            var created = getCount(summary.CREATED_LINES);
            var failed = getCount(summary.FAILED_LINES);
            var summaryHtml =
                '<div class="update-report-line-status-summary">' +
                    '<span class="update-report-line-status-label">Created:</span>' +
                    '<span class="update-report-line-status-value">' + created + '</span>';

            if (failed > 0) {
                summaryHtml +=
                    '<span class="update-report-line-status-label update-report-line-status-failed">Failed:</span>' +
                    '<span class="update-report-line-status-value update-report-line-status-failed">' + failed + '</span>';
            }

            summaryHtml += '</div>';

            $cell.html(summaryHtml);
        }

        if (table) {
            table.cell(rowIndex, statusColumnIndex).invalidate('dom');
        }
    }

    if (table) {
        table.rows().every(function() {
            var rowNode = this.node ? this.node() : null;

            if (!rowNode) {
                return;
            }

            renderRow(rowNode, this.index());
        });

        return;
    }

    $table
        .find('tbody tr')
        .filter(function() {
            return $(this).closest('table')[0] === $table[0] && !$(this).hasClass('child');
        })
        .each(function(rowIndex) {
            renderRow(this, rowIndex);
        });
}
