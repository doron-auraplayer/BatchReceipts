function DisplayMileageLine(rowId) {
    Storage.set("index", rowId);
    Page.navigate("Report_display_Mileage_line.html");
}

function GoBack() {
    if (Storage.get("ApplicationFlow") == "inReview") {
        Page.navigate("Review.html");
    } else {
        Page.navigate("Report_Display_General_Details.html");
    }
}

function iExpense_getReportDetailsMileageLines_onSuccess() {
    
    var lastTableRowIndex = Table.countRows() - 1 ;
    if (Table.countRows() > 1) {
        // The last line in the cash rows table is a total line. So we remove it
        Table.deleteRow(lastTableRowIndex);
    }

    var table;
    var ReimbursementAmountHeader = Storage.get("MileageLineReimbAmtHeader");
    if ($('#tableOutputHead').is(":visible") && ReimbursementAmountHeader) {
        table = $('#tableOutput').DataTable();
        $(table.column(1).header()).text(ReimbursementAmountHeader);
    }


}
function onLoad() {
	Services.call("iExpense_getReportDetailsMileageLines", iExpense_getReportDetailsMileageLines_onSuccess,
        function() {
        	displayReportServiceError('Failed to load mileage lines')();
        })
}

