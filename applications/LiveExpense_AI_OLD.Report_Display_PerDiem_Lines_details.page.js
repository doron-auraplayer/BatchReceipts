function DisplayPerDiemLine(rowId) {
    Storage.set("index", rowId);
    Page.navigate("Report_display_PerDiem_Line.html");
}

function formatValueForVoilationField(){
    var table = $('#tableOutput').DataTable();
    $(".fa-warning").hide();

    Storage.set("reviewTableId", "ReviewPerDiemTable");

    for (i = 0; i < Table.countRows(); i++) {
        Storage.set("ViolationIndex", i);
        Services.callSync('iExpense_GetReviewLineViolation');
        if (Storage.get("violationExist").indexOf("true") > -1)  {
            $("#tablerow_" + i + " .fa-warning").show();
            Storage.set("PolicyViolation_" + i, Storage.get("PolicyViolation"))
        }
    }
}

function generateAction() {
    if (Table.countRows() > 0) {
        table = $('#tableOutput').DataTable();
    
        ['Actions'].forEach(function(colId){
            table.column('#\\*th\\*'+colId).nodes().each(function(cell, index){
               var displayElementIcon = generateTableActionFontIcon('displayReport', index);
               $(cell).css({'vertical-align': 'middle', "text-align": "center", "padding": "0"});
               cell.innerHTML = displayElementIcon;
            });
        });

        addTableActionListener("displayReport", DisplayPerDiemLine);
    }
    
}

function iExpense_getReportDetailsPerDiemLines_onSuccess() {

    var lastTableRowIndex = Table.countRows() - 1 ;
    if (Table.countRows() > 1) {
        // The last line in the cash rows table is a total line. So we remove it
        Table.deleteRow(lastTableRowIndex);
    }
    
    formatValueForVoilationField();

    var ReimbursementAmountHeader = Storage.get("PerDiemLineReimbAmtHeader");
    var table;
    if ($('#tableOutputHead').is(":visible") && ReimbursementAmountHeader) {
        table = $('#tableOutput').DataTable();
        $(table.column(2).header()).text(ReimbursementAmountHeader);
    }
    generateAction();
}

function GoBack() {
    if (Storage.get("ApplicationFlow") == "inReview") {
        Page.navigate("Review.html");
    } else {
        Page.navigate("Report_Display_General_Details.html");
    }
}

function onLoad() {
	Services.call("iExpense_getReportDetailsPerDiemLines", iExpense_getReportDetailsPerDiemLines_onSuccess,
        function() {
        	displayReportServiceError('Failed to load per-diem lines')();
        })
}

function Violation(rowIndex) {
    Storage.set("reviewTableId", "ReviewPerDiemTable");
    Storage.set("ViolationIndex", rowIndex);
    Popup.ok("", Storage.get("PolicyViolation_" + rowIndex));
    // Services.call('iExpense_GetReviewLineViolation', function() {
    //     Popup.ok("", Storage.get("PolicyViolation"));
    // } );
}
