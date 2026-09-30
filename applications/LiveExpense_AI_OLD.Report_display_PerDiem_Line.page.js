function onLoad() {
    $("#Attachments").attr("style","height: 35px; padding: 5px; margin-bottom: 15px; width: 180px !important;");
    $("#Back").parent().parent().prepend($("#Attachments").parent());

	Services.call("iExpense_getReportDetailsLinePerDiem", function() {
	    Fields.set("LineNumber", parseInt(Storage.get("index")) + 1);
	    showFieldsByExpenseType();
	    getAttchments();
	}, displayReportServiceError('Failed to get Per Diem line details'));
}

function onBack() {
    Services.call("iExpense_getReportDetailsLineReturn", function() {
    	Page.navigate("Report_Display_PerDiem_Lines_details.html");
    }, displayReportServiceError('Failed to return to report'));
}

function onAttachments() {
    handleAttachments("Report_display_PerDiem_line.html");
}
	    