function DisplayCreditLine(rowId) {
    Storage.set("index", rowId);
    Storage.set("CreditLines", "true");
    Page.navigate("Report_display_Cash_Line.html");
}

function GoBack() {
    if (Storage.get("ApplicationFlow") == "inReview") {
        Page.navigate("Review.html");
    } else {
        Page.navigate("Report_Display_General_Details.html");
    }
}

function formatValueForAttachmentsField(){
    var table = $('#tableOutput').DataTable();
    var attchmentColumnIndex = 5;
    
    for (i = 0; i < Table.countRows(); i++) {
        table.row(i).data()[attchmentColumnIndex] = table.row(i).data()[attchmentColumnIndex] === "View"? "Yes": "No";
    }
    
}

function iExpense_getReportDetailsCreditLines_onSuccess() {
    
    var lastTableRowIndex = Table.countRows() - 1 ;
    if (Table.countRows() > 1) {
        // The last line in the cash rows table is a total line. So we remove it
        Table.deleteRow(lastTableRowIndex);
    }
    formatValueForAttachmentsField()
    
    var table;
    var ReimbursementAmountHeader = Storage.get("ReimbursementAmountHeader");
    if ($('#tableOutputHead').is(":visible") && ReimbursementAmountHeader) {
        table = $('#tableOutput').DataTable();
        $(table.column(4).header()).text(ReimbursementAmountHeader);
    }


}

