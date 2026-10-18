function onLoad() {
    $("#Attachments").attr("style","height: 35px; padding: 5px; margin-bottom: 15px; width: 33% !important;");
    $("#mainForm").append($("#Attachments").parent());
    $("#DetailReceiptMissing").attr("disabled", "true");
	Services.call("iExpense_getReportDetailsLineMileage", function() {
	    Fields.set("LineNumber", parseInt(Storage.get("index")) + 1);
	    showFieldsByExpenseType();
	    getAttchments();
	}, displayReportServiceError('Failed to get Mileage line details'));
}

function onBack() {
    Services.call("iExpense_getReportDetailsLineReturn", function() {
    	Page.navigate("Report_Display_Mileage_Lines_details.html");
    }, displayReportServiceError('Failed to return to lines report'));
}

function onAttachments() {
    handleAttachments("Report_display_Mileage_line.html");
}

