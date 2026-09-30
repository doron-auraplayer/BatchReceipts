function onLoad() {
    // if (Storage.get("AttachmentUpdateMode") === "true") {
    //     var attachmentType = Storage.get("AbsenceAttachType");
    //     $("#AbsenceAttachType").parent().parent().parent().hide()
    // 	$("#header-title").text("Update Attachment");
    // 	$("#Add").text("Update");
    // 	displayAttchmentFieldByType(attachmentType);
    //     Services.call("iExpense_AddUpdateAttachment", function() {
    //         Fields.setAndStore("AbsenceAttachType", attachmentType);
    //     }, displayReportServiceError('Failed to get attachment details'))
    // } else {
        Fields.clearAll();
        Fields.setAndStore("AttachType", "file");
        // Fields.hide("AttachType");
    	displayAttchmentFieldByType('file');
    // }
}

function displayAttchmentFieldByType (type) {
    type ==='file'?$("#AttachFilePath_filename").parent().show():$("#AttachFilePath_filename").parent().hide();
    type ==='url'?$("#AttachUrlValue").parent().parent().show(): $("#AttachUrlValue").parent().parent().hide();
    type ==='text'?$("#AttachText").parent().parent().show():$("#AttachText").parent().parent().hide();
}

function OnCancel() {
    // if (Storage.get("AttachmentUpdateMode") === "true") {
    //     Services.call("lAbs_CancelUpdateAttachment", function() {
    //         Page.navigate("ExpenseLineAttachments.html");
    //     }, displayReportServiceError('Failed to cancel update attachment'));
    // } else {
        Storage.set("fromAttachmentsPage","true");
        var originPage = Storage.get("OriginAttachmentsPage");
        if (originPage !== "") {
            Page.navigate(originPage);
        } else {
            Page.navigate("ExpenseLineAttachments.html");
        }
    // }
}


function OnAdd() {
    if (Fields.get("AttachType") === "file" && Fields.get("AttachFilePath_container").toLowerCase().indexOf("no file") >-1) {
        Popup.ok("Error", "No file was uploaded");
        return;
    }

    // validate non empty attachment
    if (Fields.get("AttachType") === "file" && $("#AttachFilePath")[0].files && $("#AttachFilePath")[0].files.length > 0) {
        var fileDet = $("#AttachFilePath")[0].files[0];
        if (fileDet.size === 0) {
            Popup.ok(getTranslationForId("@popup_title_error"), getTranslationForId("@popup_empty_attachment_file"));
            return false
        }
    }
	    
	Spinner.start("Upload Receipt");    
    Services.call("iExpense_AddUpdateAttachment", function() {
        Storage.set("fromAttachmentsPage","true");
        // Services.callSync('iExpense_DeleteAttachTempFile');
        var originPage = Storage.get("OriginAttachmentsPage");
        if (originPage !== "") {
            Page.navigate(originPage);
        } else {
            Page.navigate("ExpenseLineAttachments.html");
        }
    } , displayReportServiceError('Failed to add attachment'));
}


function AttachType_lov_item_handler(item, label) {
	populateFieldHTML("AttachType", label !== undefined ? label : item);
	store("AttachType", item);
	displayAttchmentFieldByType(item);

}