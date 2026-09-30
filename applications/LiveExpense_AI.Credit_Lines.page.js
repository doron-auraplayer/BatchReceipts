store("isCreditLine", true);   // so LineDetails.html page will know where we came from

function onNext() {
    var length = Table.countRows();
    for (var i = 0; i < length; i++) {
        if (Storage.get('CashLines_Completed_' + i) !== 'true') {
            Popup.ok(getTranslationForId("@popup_title_incomplete_line"), getTranslationForId("@popup_message_incomplete_line"));
            return;
        }
    }
	Services.call('iExpense_credit_next', 'onNext_success');
}

function onNext_success() {
    store("hasCreditLines", true); //so in Cash_Lines we will know we can skip immediatly to next
    if (Storage.get("isCreditLinesErrorMessage") == "true") {
        Popup.ok(getTranslationForId("@popup_title_error"), Storage.get("CreditLinesErrorMessage") );
        Storage.deleteByPrefix("CashLines_Completed_");
        replaceSelectorsWithIcons();
    } else {
        Page.navigate('Cash_Lines.html');
    }
}

function OnCancel() {
   OnCancelPopup(function() {
        var updateMode = Storage.get("updateMode").toLowerCase() === 'true';
        updateMode ? Page.navigate("Update_Reports.html") : Page.navigate("Reports.html");
   });
}

function editLineDetails(rowIdToUpdate) {
        var table = $('#tableOutput').DataTable();
        var rowCells = table.rows( rowIdToUpdate ).data()[0];
    	Storage.set('TransactionDate', rowCells[0]);
        Storage.set('TransactionAmount', rowCells[1]);
    	Storage.set('index', rowIdToUpdate);
        // Storage.remove("LineDetailsUpdate");
        Storage.set("LineDetailsUpdate", "true");
    // 	if (Storage.get('CashLines_Completed_' + rowIdToUpdate) == "true") {
    //         Storage.set("LineDetailsUpdate", "true");
    // 	} 
        Storage.remove("expenseType");
        Services.call("iExpense_credit_openLineDetails", function() {
        	Page.navigate('LineDetails');
        },displayReportServiceError('Failed to open detailed expense line'))
}


function replaceSelectorsWithIcons(){
    var table = $('#tableOutput').DataTable();
    
    for (var i=0; i<Storage.count("CashLines_Completed"); i++) {
        var lineApproved = Storage.get('CashLines_Completed_' + i) === 'true';
        if (lineApproved) {
            $("#tablerow_" + i + ">td>div.table-actions-container>i").addClass("fa-check").removeClass("fa-pencil");
        }
    }
    $(".table-actions-container").parent().css("text-align", "center");
}

function processTable() {
    var tableBody = document.getElementById("tableOutputBody");
    Table.populate(tableBody, true);

    if (Storage.get("updateMode").toLowerCase() === 'true') {
        // In updte mode, set completed rows per calculated guess that if it has expense type and justification it is ready
        Storage.deleteByPrefix("CashLines_Completed_");
        var tableArr = Table.toArray();
        tableArr.forEach(function(element,index) {
            var expenseType = element.CreditTransactionExpenseType;
            var justification = element.CreditTransactionJustification;
            if (expenseType !== "" && justification !== "") {
                Storage.set('CashLines_Completed_' + index, "true");
            }
        })
    }


    var length = Table.countRows();
    var completedRows = 0;
    for (var i = 0; i < length; i++) {
        if (Storage.get('CashLines_Completed_' + i) === 'true') {
            // Table.highlightRow(i);
            completedRows++;
        }
    }

    if (completedRows < length) {
        var tip = document.createElement("p");
        tip.setAttribute("id", "tip");
        tip.setAttribute("style", "margin-bottom: 15px;");
        tip.innerHTML = "*" + getTranslationForId("@Help_message_incomplete_line");
        $("#tableOutput_wrapper")[0].before(tip);
    }
    
}

function onLoad() {
    Storage.set("hasCreditLinesStep", true); //so in Cash_Lines we will know where to get back

    $("#Cancel").addClass("CashLinesActionBtn");
    $("#Back").addClass("CashLinesActionBtn");
    $("#Save").addClass("CashLinesActionBtn");
    $("#Next").addClass("CashLinesActionBtn");

    Storage.deleteByPrefix("CreditTransaction");
	Services.call('iExpense_CreditGetLinesJS', function() {
        processTable();
	    replaceSelectorsWithIcons();
	    } , displayReportServiceError("Failed to to get credit lines"));
    // replaceSelectorsWithIcons();
}

function onSave() {

	Services.call('iExpense_Credit_ExpensesSave', function() {} , displayReportServiceError("Failed to to save credit lines"));
}

function onBack() {
	Services.call('iExpense_Back', function() {
            Page.navigate("Credit_Transactions.html");
	    } , displayReportServiceError("Failed to to press back button"));
}

