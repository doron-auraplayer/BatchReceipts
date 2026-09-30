var rowIdToDelete;
cleanExpenseStorageVariables();
var previousRange;

function removeReport (rowIdToDelete) {
        Storage.set("indexLineToRemove", rowIdToDelete);
        Services.call("iExpense_removeUpdateReport", function() {onLoad();});
}

function updateReport (rowId) {
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
    
}

function handleEmptyTableState() {

    $('#Next').prop("disabled", true);
    $('#Previous').prop("disabled", true);
    $('#listRange').text("No reports");

    $('#tableOutput_filter').hide();
    $('#tableOutput_length').hide();
    $('#tableOutput_info').hide();
    $('#tableOutput_paginate').hide();
}

function onLoad() {

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

	Services.call("iExpense_getUpdReports", onGetUpdReportsSuccess, displayReportServiceError("Failed to load data, please try again or contact your administrator"));
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
    Storage.set("duplicateUpdateRepostIndex", rowIndex);
	Services.call('iExpense_duplicate_update_report', function() {
	    Storage.set("DuplicateReport", "true");
	    Page.navigate("Report_General");
	}, displayReportServiceError("Failed to withdraw report"));
    
}
