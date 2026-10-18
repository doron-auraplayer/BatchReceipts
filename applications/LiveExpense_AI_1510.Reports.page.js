Storage.remove("updateMode");
cleanExpenseStorageVariables();
var previousRange;


function onLoad() {
    $("#content").append("<div id='pageReady' style='display:none'>ready</div>");
    Spinner.start();
    
    Table.clear();

    addNewLineAfterButton("Next");

    // set prev/next button
    $('#Next').prop( "disabled",  true);
    $('#Next').parent().prop( "style",  'flex: 1 1 50px !important');
    $('#Previous').prop( "disabled", true);
    $('#Previous').parent().prop( "style",  'flex: 1 1 50px !important');
    $("<span id='listRange' style='flex: 1 1 50px !important; text-align: center; align-self: center'></span>").insertAfter($("#Previous").parent());
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");

	Services.call("iExpense_getReports", onGetReportsSuccess, displayReportServiceError("Failed to fetch reports"));
}

function CreateReport() {
    Storage.remove("updateMode");
    Page.navigate("Report_General")
}

function DisplayReport(row, col, rowCells) {
    Storage.set("lineIndexToDisplay", row);
    Services.call("iExpense_getReportDetailsGeneral", function() {
        Page.navigate("Report_Display_General_Details");
    }, displayReportServiceError("Failed to fetch report details"));

    
}

function addActionListeners() {
    // addTableActionListener("displayReport", DisplayReport);
    addTableActionListener("TotalUSD", DisplayReport);

}

function onGetReportsSuccess(){
    if (!Storage.contains("DateFormat")) {
        Services.call('iExpense_settingsGet', function() {
            Storage.set("DateFormat", Storage.get("DateFormat").split(" ")[0]);
        }, displayReportServiceError("Failed to get user settings"));
    }
    
    $(".table-actions-container").parent().attr("style", "text-align: center;");

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
    
    if (Table.countRows() > 0) {
        var table = $('#tableOutput').DataTable();
    
        ['TotalUSD'].forEach(function(colId){
            table.column('#\\*th\\*'+colId).nodes().each(function(cell, index){
               $(cell).attr('id', 'TotalUSD'+ index);
               $(cell).attr('data-row-id', index);
                // set underline decoration
               $(cell).css({'color':'#3f51b5', 'text-decoration':'underline', 'cursor':'pointer'});
            });
        });
    
        addActionListeners();
    }

    disableBrowserBackButton();
    Spinner.stop();
    
}
function onNext() {
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
	Storage.set('moveNext', 'true');
    previousRange = Storage.get("currentListRange");
	Services.call('iExpense_getReportsNextPrev', onGetReportsSuccess, displayReportServiceError("Failed to fetch next reports"));
}

function onPrev() {
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
	Storage.set('moveNext', 'false')
    previousRange = Storage.get("currentListRange");
	Services.call('iExpense_getReportsNextPrev', onGetReportsSuccess, displayReportServiceError("Failed to fetch previous reports"));
}

function Withdraw(rowIndex) {
    Popup.custom("Confirmation", "Withdraw expense report: This cancels any existing manager and Payables approvals and moves the expense report to the Update Expense Reports listings. You can edit the expense report and resubmit for approval. Do you want to continue?", "Yes", "No", 
    function() {
	    Storage.set("index", rowIndex);
    	Services.call('iExpense_withdraw_report', function() {
    	    Page.navigate("Update_Reports");
    	}, displayReportServiceError("Failed to withdraw report"));
    })
}
function Duplicate(rowIndex) {
    Storage.set("index", rowIndex);
	Services.call('iExpense_duplicate_report', function() {
	    Storage.set("DuplicateReport", "true");
	    Page.navigate("Report_General");
	}, displayReportServiceError("Failed to withdraw report"));
}
