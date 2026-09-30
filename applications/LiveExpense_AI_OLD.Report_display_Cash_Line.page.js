function removeEmptyEmployeeLines() {
    var numRows = Storage.count('AttendiesEmpTableEmpName_0');
    for (var i=numRows-1; i>=0; i--) {
        if (Storage.get("AttendiesEmpTableEmpName_" + i) === "") {
            Table.deleteRow(i);
        }
    }

}

function onLoad() {
    $("#Attachments").attr("style","height: 35px; padding: 5px; margin-bottom: 15px; width: 180px !important;");
    $("#Back").parent().parent().prepend($("#Attachments").parent());
    $("#ItemizationTable").attr("style","height: 35px;padding: 0px;margin-bottom: 15px;max-width: 180px;");
    $("#ItemizationTable").hide();
    $("#ItemizationTable").parent().insertAfter($("#Attachments").parent());
    
	Services.call("iExpense_getReportDetailsLineCash", function() {
	    Fields.set("LineNumber", parseInt(Storage.get("index")) + 1);
	    showFieldsByExpenseType();
	    getAttchments();
        if (Fields.get("ExpenseType").length >0 && app.itemizedExpenseTypes.toLowerCase().indexOf(Fields.get("ExpenseType").toLowerCase()) > -1 ) {
            $("#ItemizationTable").text("Itemized Items (" + (Storage.count("ItemizationTableLineNumber")-1) + ")");
            $("#ItemizationTable").show();
        }

	    if (Storage.get("AttendeesTableExist") == "true") {
    	    Services.callSync("iExpense_attendeesEmpTableGetJS", displayReportServiceError('Failed to get attendees list'));
            removeEmptyEmployeeLines();
            populateField("AttendeeNames", Storage.getArray("AttendiesEmpTableEmpName").join(",") );
    	    
    	    Services.callSync("iExpense_attendeesGuestTableGetJS", displayReportServiceError('Failed to get guests list'));
            populateField("GuestNames", Storage.getArray("AttendiesGuestTableName").join(","));
	    } else {
	        $("#AttendeeNames").parent().hide();
	        $("#GuestNames").parent().hide();
	    }
	    
	}, displayReportServiceError('Failed to get cash line line details'));
}

function onBack() {
    Services.call("iExpense_getReportDetailsLineReturn", function() {
        if (Storage.get("CreditLines") === "true") {
            Storage.remove("CreditLines");
            Page.navigate("Report_Display_Credit_Lines_details.html");
        } else {
            Page.navigate("Report_Display_Cash_Lines_details.html");
        }
        
    }, displayReportServiceError('Failed to return to report'));
    
}

function onAttachments() {
    handleAttachments("Report_display_Cash_line.html");
}


function onItemizationTable() {
    Storage.set("ItemizationLinesCommingFrom", "Report_display_Cash_Line");
	Page.navigate("ItemizationLines.html");
}

