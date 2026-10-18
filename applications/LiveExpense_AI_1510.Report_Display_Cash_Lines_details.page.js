function DisplayCashLine(rowId) {
    Storage.set("index", rowId);
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
    var attchmentColumnIndex = 7;
    
    for (i = 0; i < Table.countRows(); i++) {
        if (Storage.get("AttachmentText_" + i) === "View") {
            Storage.set("AttachmentText_" + i, "Yes");
        } else {
            Storage.set("AttachmentText_" + i, "No");
        }
    }
    Table.populate();
}

function generateActions() {
    if (Table.countRows() > 0) {
        table = $('#tableOutput').DataTable();
    
        ['Actions'].forEach(function(colId){
            table.column('#\\*th\\*'+colId).nodes().each(function(cell, index){
               var displayElementIcon = generateTableActionFontIcon('displayReport', index);
               $(cell).css({'vertical-align': 'middle', "text-align": "center", "padding": "0"});
               cell.innerHTML = displayElementIcon;
            });
        });
    
        addTableActionListener("displayReport", DisplayCashLine);
    }
}

function formatValueForVoilationField(){
    var table = $('#tableOutput').DataTable();
    var violationsArr = [];
    
    $(".fa-warning").hide();

    Storage.set("reviewTableId", "OIERevCashTable");

    for (i = 0; i < Table.countRows(); i++) {
        Storage.set("ViolationIndex", i);
        Services.callSync('iExpense_GetReviewLineViolation');
        if (Storage.get("violationExist").indexOf("true") > -1)  {
            violationsArr.push(true);
            $("#tablerow_" + i + " .fa-warning").show();
            Storage.set("PolicyViolation_" + i, Storage.get("PolicyViolation"));
        } else {
            violationsArr.push(false);
        }
    }
    
    for (var i =0; i< violationsArr.length; i++) {
        if (violationsArr[i]) {
            $("#tablerow_" + i + " .fa-warning").show();
        }
    }
    
    generateActions();
}

function iExpense_getReportDetailsCashLines_onSuccess() {
    $(".fa-warning").hide();
    var lastTableRowIndex = Table.countRows() - 1 ;
    if (Table.countRows() > 1) {
        // The last line in the cash rows table is a total line. So we remove it
        Table.deleteRow(lastTableRowIndex);
    }
    formatValueForAttachmentsField();
    formatValueForVoilationField();

    var table;
    var ReimbursementAmountHeader = Storage.get("ReimbursementAmountHeader");
    if ($('#tableOutputHead').is(":visible") && ReimbursementAmountHeader) {
        table = $('#tableOutput').DataTable();
        $(table.column(4).header()).text(ReimbursementAmountHeader);
    }
    
}

function Violation(rowIndex) {
    Storage.set("reviewTableId", "OIERevCashTable");
    Storage.set("ViolationIndex", rowIndex);
    Popup.ok("", Storage.get("PolicyViolation_" + rowIndex));
    // Services.call('iExpense_GetReviewLineViolation', function() {
    //     Popup.ok("", Storage.get("PolicyViolation"));
    // } );
}
