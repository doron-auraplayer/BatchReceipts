var rowIdToDelete;
var rpaReports = [];
cleanExpenseStorageVariables();
var previousRange;

var updateReportsPageActive = false;
var reportProgressGeneration = typeof reportProgressGeneration === 'number' ? reportProgressGeneration : 0;
var reportRetryRequests = Object.create(null);
var reportProgressTimer = null;
var REPORT_PROGRESS_BUTTON_LABEL = 'Report is being processed. View progress';

function removeReport (rowIdToDelete) {
    withIdleReportRow(rowIdToDelete, function () {
        Storage.set("indexLineToRemove", rowIdToDelete);
        Services.call("iExpense_removeUpdateReport", function() {onLoad();});
    });
}

function updateReport (rowId) {
    withIdleReportRow(rowId, function (receiptRows) {
        var reportNumber = Storage.getFromIndex('UpdateReportNumber', rowId);
        if (!reportNumber) { return; }
        var number = normalizeReportNumber(reportNumber);
        var summary = findReportSummary(number);
        if (summary && Number(summary.CREATED_LINES) > 0 && !Number(summary.FAILED_LINES) &&
                receiptRows.length > 0 && receiptRows.every(function (row) {
            return row && normalizeReportNumber(row.RECEIPTBATCH_STATUS) === 'LINE_CREATED';
        })) {
            openReceiptReportStep(rowId, number, 'Expense Allocations', 'ExpenseAllocations.html');
            return;
        }
        Storage.set("indexLineToUpdate", rowId)
        Services.call("iExpense_gotoUpdateReport", function() {
            Storage.set('ReportNumber', reportNumber);
            Storage.set('ReportCreationType', summary ? 'RECEIPT' : 'MANUAL');
            Storage.set('ReportCreationTypeNumber', reportNumber);
            Storage.set("updateMode", "true");
            Page.navigate("Report_General.html");
        }, displayReportServiceError("Failed to get report details"));
    });
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
    scheduleReportProgressRefresh();
}

function onGetDraftReportsFailure() {
    rpaReports = [];
    console.warn('Failed to load receipt report summaries.');
    loadUpdateReportsTable();
}

function onLoad() {

    clearTimeout(reportProgressTimer);
    reportProgressTimer = null;
    Object.keys(reportRetryRequests).forEach(releaseReportRetry);
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
    if (isProcessingReportAction(rowIndex)) { return; }
    Popup.okCancel(getTranslationForId("@popup_report_remove_title"), getTranslationForId("@popup_report_remove_message"), function() {
        removeReport(rowIndex)} );
}
function Duplicate(rowIndex) {
    withIdleReportRow(rowIndex, function () {
        Storage.set("duplicateUpdateRepostIndex", rowIndex);
        Services.call('iExpense_duplicate_update_report', function() {
            Storage.set("DuplicateReport", "true");
            Page.navigate("Report_General");
        }, displayReportServiceError("Failed to withdraw report"));
    });
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

function findReportSummary(reportNumber) {
    return rpaReports.filter(function (report) {
        return report && normalizeReportNumber(report.REPORT_NUMBER) === reportNumber;
    })[0];
}

function isReportPending(reportNumber, summary) {
    return Boolean(reportRetryRequests[reportNumber] || (summary && Number(summary.PENDING_LINES) > 0));
}

function isProcessingReportNumber(reportNumber) {
    var number = normalizeReportNumber(reportNumber);
    var summary = findReportSummary(number);
    return isReportPending(number, summary) || Boolean(summary &&
        Number(summary.FAILED_LINES) > 0 && Storage.get(reportManualEditKey(number)) !== 'true');
}

function scheduleReportProgressRefresh(delay) {
    if (reportProgressTimer !== null || !isUpdateReportsPageCurrent()) { return; }
    if (!Object.keys(reportRetryRequests).length && !rpaReports.some(function (report) {
        return Number(report.PENDING_LINES) > 0;
    })) {
        return;
    }
    reportProgressTimer = setTimeout(function () {
        reportProgressTimer = null;
        refreshReportProgress();
    }, delay === undefined ? 4000 : delay);
}

function releaseReportRetry(number) {
    var retry = reportRetryRequests[number];
    delete reportRetryRequests[number];
    if (retry.release) { retry.release(); }
}

// Use the same Aura service endpoint and session headers as the SDK without
// its full-page spinner. A retry should block only its own report row.
function requestReportServiceInBackground(serviceName, input, timeout) {
    var transactionId = Metadata.getTransactionId();
    var appContext = App.getName() + (transactionId === undefined ? '' : ',' + transactionId);
    return $.ajax({
        url: getServiceManagerHost() + '/ServiceManager/Macro/ExecMacro/' + serviceName,
        type: 'POST',
        headers: generateHeaders(),
        dataType: 'json',
        timeout: timeout,
        data: $.extend({
            json: true,
            randomSeed: Math.random() * 1000000,
            'meta.app': appContext
        }, input)
    });
}

function refreshReportProgress() {
    var generation = reportProgressGeneration;
    var user = Storage.get('LoggedInUsername');
    var settled = false;

    function complete(response) {
        if (settled) { return; }
        settled = true;
        if (generation !== reportProgressGeneration || !isUpdateReportsPageCurrent() ||
            Storage.get('LoggedInUsername') !== user) { return; }
        var receivedStatus = response && response.Response && !getResponseNodeValueByName('Error', response);
        if (receivedStatus) {
            rpaReports = parseDraftReportSummaries(response);
        }
        var retryStateChanged = false;
        Object.keys(reportRetryRequests).forEach(function (number) {
            var retry = reportRetryRequests[number];
            if (retry.starting) { return; }
            var summary = receivedStatus && findReportSummary(number);
            var changed = receivedStatus && (!summary || summary.PENDING_LINES > 0 ||
                summary.FAILED_LINES !== retry.failedLines || summary.CREATED_LINES !== retry.createdLines);
            if (changed || Date.now() >= retry.waitUntil) {
                releaseReportRetry(number);
                retryStateChanged = true;
            }
        });
        if (receivedStatus || retryStateChanged) {
            applyReportProgressActions();
            reportStatus();
        }
        scheduleReportProgressRefresh();
    }

    try {
        requestReportServiceInBackground('ReceiptBatch_get_draft_reports', { EBS_USER: user }, Services.getTimeout())
            .done(complete)
            .fail(function () { complete(); });
    } catch (error) {
        complete();
    }
}

function startFailedReportRetry(reportNumber) {
    var number = normalizeReportNumber(reportNumber);
    var summary = findReportSummary(number);
    var user = Storage.get('LoggedInUsername');
    if (!number || !user || !summary || !Number(summary.FAILED_LINES) ||
        isReportPending(number, summary) || !isUpdateReportsPageCurrent()) { return; }

    var generation = reportProgressGeneration;
    var state = {
        starting: true,
        failedLines: summary.FAILED_LINES,
        createdLines: summary.CREATED_LINES,
        waitUntil: 0
    };
    reportRetryRequests[number] = state;
    applyReportProgressActions();
    reportStatus();

    var input = { ReportNumber: number, usernameField: user };
    var password = Storage.get('passwordField');
    if (password) { input.passwordField = password; }

    var serviceName = 'Ping_ReceiptBatch_CreateLinesRPA';
    function complete(response, message) {
        if (!state.starting) { return; }
        state.starting = false;
        if (generation !== reportProgressGeneration || !isUpdateReportsPageCurrent() ||
            Storage.get('LoggedInUsername') !== user || reportRetryRequests[number] !== state) { return; }
        if (message) {
            displayReportServiceError(message)(response, serviceName);
        } else if (response) {
            Storage.remove(reportManualEditKey(number));
            // Ping launches the same background RPA for every report. Keep
            // the row locked until the first job status is visible.
            state.waitUntil = Date.now() + 12000;
        }
        scheduleReportProgressRefresh(0);
        if (state.waitUntil) {
            return new Promise(function (resolve) { state.release = resolve; });
        }
    }

    function runRetry() {
        return requestReportServiceInBackground('ReceiptBatch_get_draft_reports', { EBS_USER: user }, Services.getTimeout())
            .then(function (response) {
                if (generation !== reportProgressGeneration || !isUpdateReportsPageCurrent() ||
                    Storage.get('LoggedInUsername') !== user) {
                    complete();
                    return;
                }
                if (!response || !response.Response || getResponseNodeValueByName('Error', response)) {
                    complete(response, 'Could not check the report status.');
                    return;
                }
                var readyToRetry = parseDraftReportSummaries(response).some(function (report) {
                    return report.REPORT_NUMBER === number && !report.PENDING_LINES && report.FAILED_LINES > 0;
                });
                if (!readyToRetry) {
                    complete();
                    return;
                }
                return requestReportServiceInBackground(serviceName, input, Services.getTimeout())
                    .then(function (result) {
                        var succeeded = result && result.Response && !getResponseNodeValueByName('Error', result);
                        return complete(result, succeeded ? '' : 'Automatic retry could not start.');
                    }, function (xhr) {
                        complete(xhr && xhr.responseJSON, 'Automatic retry could not start.');
                    });
            }, function (xhr) {
                complete(xhr && xhr.responseJSON, 'Could not check the report status.');
            });
    }

    try {
        var locks = typeof navigator === 'undefined' ? null : navigator.locks;
        var request = locks ? locks.request('iExpense:retry:' + normalizeReportNumber(user) + ':' + number,
            { ifAvailable: true }, function (lock) {
                if (lock) { return runRetry(); }
                complete();
            }) : runRetry();
        request.then(null, function () { complete(null, 'Automatic retry could not start.'); });
    } catch (error) {
        complete(null, 'Automatic retry could not start.');
    }
}

// Remember the user's manual-edit choice for this report in the current session.
function reportManualEditKey(reportNumber) {
    return 'ReceiptReportManualEdit:' + Storage.get('LoggedInUsername') + ':' + normalizeReportNumber(reportNumber);
}

function openReceiptReportStep(rowId, number, targetStep, page, onReached) {
    var generation = reportProgressGeneration;
    var user = Storage.get('LoggedInUsername');
    var onError = displayReportServiceError('Failed to open ' + targetStep + '.');
    Storage.set('indexLineToUpdate', rowId);
    Storage.set('TARGET_STEP', targetStep);

    Services.call('ReceiptBatch_gotoUpdateReportStep', function (response) {
        if (generation !== reportProgressGeneration || !isUpdateReportsPageCurrent() ||
            Storage.get('LoggedInUsername') !== user ||
            normalizeReportNumber(Storage.getFromIndex('UpdateReportNumber', rowId)) !== number ||
            isReportPending(number, findReportSummary(number))) { return; }
        var elements = response && response.Response &&
            response.Response.ReceiptBatch_gotoUpdateReportStepElements;
        if (!elements || elements.NAVIGATION_STATUS !== 'REACHED' ||
            normalizeReportNumber(elements.WizardTitle) !== normalizeReportNumber('Update Expense Report: ' + targetStep)) {
            onError();
            return;
        }

        Storage.set('ReportNumber', number);
        Storage.set('ReportCreationType', 'RECEIPT');
        Storage.set('ReportCreationTypeNumber', number);
        Storage.set('updateMode', 'true');
        Storage.set('hasCreditLinesStep', String(elements.hasCreditLinesStep) === 'true' ? 'true' : 'false');
        if (onReached) { onReached(); }
        Page.navigate(page);
    }, onError);
}

function allowReportManualEdit(reportNumber) {
    var number = normalizeReportNumber(reportNumber);
    var summary = findReportSummary(number);
    if (!summary || isReportPending(number, summary) || !(Number(summary.FAILED_LINES) > 0)) { return; }

    var storedReports = Storage.getArray('UpdateReportNumber') || [];
    var rowId = storedReports.map(normalizeReportNumber).indexOf(number);
    if (rowId < 0) { return; }

    var onError = displayReportServiceError('Failed to open the report.');
    var requestGeneration = reportProgressGeneration;
    Services.callWebServiceWithAllParams(
        'ReceiptBatch_get_draft_report_lines',
        undefined,
        function (response, serviceName, tableRows) {
            if (requestGeneration !== reportProgressGeneration || !isUpdateReportsPageCurrent()) { return; }
            if (isReportPending(number, findReportSummary(number))) { return; }
            if (normalizeReportNumber(Storage.getFromIndex('UpdateReportNumber', rowId)) !== number) { return; }

            var rows = tableRows || [];
            var hasFailed = false;
            var hasFailedCredit = false;
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                if (!row) { continue; }
                var status = normalizeReportNumber(row.RECEIPTBATCH_STATUS);
                if (status === 'READY') { return; }
                if (status !== 'LINE_FAILED') { continue; }
                hasFailed = true;
                if (normalizeReportNumber(row.RECEIPTBATCH_CREDIT) !== '') {
                    hasFailedCredit = true;
                }
            }
            if (!hasFailed) { return; }

            var page = hasFailedCredit ? 'Credit_Transactions.html' : 'Cash_Lines.html';
            var targetStep = hasFailedCredit ? 'Credit Card Transactions' : 'Cash and Other Expenses';
            Storage.set('Credit', hasFailedCredit ? 'true' : 'false');
            openReceiptReportStep(rowId, number, targetStep, page, function () {
                Storage.set(reportManualEditKey(number), 'true');
            });
        },
        onError,
        true,
        false,
        { REPORT_NUMBER: number.replace(/'/g, "''") }
    );
}

function showFailedReportChoice($cell, reportNumber, failed) {
    var buttonStyle = 'font-size:11px!important;line-height:1.2!important;padding:4px 6px!important;' +
        'min-height:0!important;width:auto!important;margin:4px 3px 0 0!important;';
    $cell.empty().append($('<div/>', {
        style: 'font-size:12px!important;line-height:1.3!important;',
        text: failed + (failed === 1 ? ' receipt failed. ' : ' receipts failed. ') + 'How would you like to continue?'
    }));
    $cell.append($('<button/>', {
        type: 'button', 'class': 'ui-btn ui-mini ui-btn-inline', text: 'Retry',
        style: buttonStyle
    }).on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        startFailedReportRetry(reportNumber);
    }));
    $cell.append($('<button/>', {
        type: 'button', 'class': 'ui-btn ui-mini ui-btn-inline', text: 'Edit manually',
        style: buttonStyle
    }).on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        allowReportManualEdit(reportNumber);
    }));
}

function isProcessingReportAction(rowId) {
    return isProcessingReportNumber(getActionReportNumber(rowId));
}

function withIdleReportRow(rowId, action) {
    var number = getActionReportNumber(rowId);
    if (isProcessingReportNumber(number)) { return; }
    var summary = findReportSummary(number);
    if (!summary) {
        action([]);
        return;
    }

    var generation = reportProgressGeneration;
    var user = Storage.get('LoggedInUsername');
    Services.callWebServiceWithAllParams(
        'ReceiptBatch_get_draft_report_lines',
        undefined,
        function (response, serviceName, tableRows) {
            if (generation !== reportProgressGeneration || !isUpdateReportsPageCurrent() ||
                Storage.get('LoggedInUsername') !== user || getActionReportNumber(rowId) !== number ||
                isProcessingReportNumber(number)) { return; }
            var rows = Array.isArray(tableRows) ? tableRows : [];
            var pending = rows.filter(function (row) {
                return row && normalizeReportNumber(row.RECEIPTBATCH_STATUS) === 'READY';
            }).length;
            if (pending) {
                summary.PENDING_LINES = pending;
                applyReportProgressActions();
                reportStatus();
                scheduleReportProgressRefresh();
            } else {
                action(rows);
            }
        },
        displayReportServiceError('Failed to check whether the report is processing.'),
        true,
        false,
        { REPORT_NUMBER: number.replace(/'/g, "''") }
    );
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

    closeReportMessages();

    updateReportsPageActive = false;
    reportProgressGeneration += 1;
    clearTimeout(reportProgressTimer);
    reportProgressTimer = null;
    Object.keys(reportRetryRequests).forEach(releaseReportRetry);
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

    function renderRow(row, rowIndex) {
        var $row = $(row);
        var $cell = table ? $(table.cell(rowIndex, statusColumnIndex).node()) : $row.children('td').eq(statusColumnIndex);

        if (!$cell.length) {
            return;
        }

        var reportNumber = table
            ? normalizeReportNumber($(table.cell(rowIndex, reportColumnIndex).node()).text())
            : normalizeReportNumber($row.children('td').eq(reportColumnIndex).text());
        var summary = findReportSummary(reportNumber);

        $cell.addClass('update-report-line-status-cell');

        if (isReportPending(reportNumber, summary)) {
            $cell.html('<span class="update-report-line-status-processing">Report is being processed</span>');
        } else if (!summary) {
            $cell.html('<span class="update-report-line-status-manual">Manually created</span>');
        } else if (isProcessingReportNumber(reportNumber)) {
            showFailedReportChoice($cell, reportNumber, getCount(summary.FAILED_LINES));
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

        if (summary && !isReportPending(reportNumber, summary)) {
            $('<button type="button" class="report-messages-link"><span class="fa fa-exclamation-triangle" aria-hidden="true"></span><span>Report Errors</span></button>')
                .on('click', function () { openReportMessages(reportNumber, this); })
                .appendTo($cell);
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


function closeReportMessages() {
    var context = window.reportMessagesContext;
    if (!context) { return; }
    window.reportMessagesContext = null;
    $('#reportMessagesOverlay').remove();
    Popup.closePage();
    document.body.style.overflow = context.previousOverflow;
    $(document).off('keydown.reportMessagesHost');
    if (context.opener && document.documentElement.contains(context.opener)) { context.opener.focus(); }
}

function openReportMessages(reportNumber, opener) {
    var number = normalizeReportNumber(reportNumber);
    if (!number || !isUpdateReportsPageCurrent()) { return; }
    closeReportMessages();
    window.reportMessagesContext = {
        reportNumber: number, opener: opener, previousOverflow: document.body.style.overflow
    };
    window.closeReportMessages = closeReportMessages;
    if (!$('#reportMessagesHostStyles').length) {
        $('<style id="reportMessagesHostStyles"></style>').text(
            '#reportMessagesOverlay{position:fixed;inset:0;z-index:11000;background:rgba(15,23,42,.48);display:flex;align-items:center;justify-content:center;padding:12px}' +
            '#reportMessagesFrameHost{width:min(640px,100%);height:min(620px,calc(100vh - 24px));height:min(620px,calc(100dvh - 24px));min-width:0;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 16px 60px #0004}' +
            '#reportMessagesFrameHost iframe{display:block;border:0;width:100%!important;height:100%!important;max-width:100%}'
        ).appendTo('head');
    }
    var overlay = $('<div id="reportMessagesOverlay" role="dialog" aria-modal="true" aria-label="Report messages"></div>').appendTo('body');
    var host = $('<div id="reportMessagesFrameHost"></div>').appendTo(overlay);
    document.body.style.overflow = 'hidden';
    overlay.on('click', function (event) { if (event.target === overlay[0]) { closeReportMessages(); } });
    $(document).on('keydown.reportMessagesHost', function (event) { if (event.key === 'Escape') { closeReportMessages(); } });
    if (typeof host[0].moveBefore === 'function') {
        Popup.asIframe('ReportMessages.html', 'reportMessagesFrameHost', null, '100%', '100%');
    } else {
        // Older mobile browsers cannot move an initialized iframe without reloading it.
        overlay.remove();
        var context = window.reportMessagesContext;
        Popup.openPage('ReportMessages.html', function () {
            if (window.reportMessagesContext === context) { closeReportMessages(); }
        }, '85%', '96%');
    }
}
