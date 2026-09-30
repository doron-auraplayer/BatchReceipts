function Remove(rowIndex) {
    // if (Storage.get("ExpenseAttachmentDelete_" + rowIndex) === "") return;
    
    Storage.set('attachmentRowIndex', rowIndex);
    showConfirmPopup('Remove Attachment', 'Are you sure you want to remove this attachment?',  function() {
        Services.call("iExpense_RemoveAttachment", function() {
            removeAttachmentViewer();
            onLoad();
        }, displayReportServiceError('Failed to remove attachment'));
    });
}


function Download(rowIndex) {
    downloadAttachment(rowIndex);
}


function configActions() {
    var originPage = Storage.get("OriginLineDetailsPage");
    if (originPage === "Report_Display_General_Details") {
        $(".fa-trash-o").hide();
    }
}

function onLoad() {
    Storage.set("fromAttachmentsPage","true");
    $("#Add_Attachment").addClass("TableAddLineBtn");
    $("#Add_Attachment").text("");
    $("#Add_Attachment").append('<i class="fa fa-plus" aria-hidden="true"></i>');
    $("#Add_Attachment").parent().parent().css({'margin-top': '-15px'});
    $("#Add_Attachment").parent().css({'margin-bottom': '20px'});
    // Services.call("iExpense_GotoAttachments")
    var attachmentsService = "iExpense_GotoAttachments";
    if (Storage.get("ExpensesAttachmentsDialog") === "true") {
        //calling getAttachments as on ebs12.2 we close the attachments window after getting the lines. 
        // not sense to keep it open as there is no option to add from it
        //In 12.1.3 we keep the attachments window open
        attachmentsService = "iExpense_GetAttachments";
    }
    Storage.deleteByPrefix("ExpenseAttachment");
	Services.call(attachmentsService, configActions,  displayReportServiceError('Failed to load attachments'));
}

function onAddAttachment() {
    Storage.set("AttachmentUpdateMode", "false");
    Storage.set("OriginAttachmentsPage", "ExpenseLineAttachments.html");
    Page.navigate("ExpenseLineAddAttachment.html");
}

function onBack() {
    var attachmentsDialog = (Storage.get("ExpensesAttachmentsDialog") === "true");
    // onEBS 12.2 the dialog is closed after each operation so no need to close
    if (attachmentsDialog) {
		Page.navigate(Storage.get("OriginLineDetailsPage"));
        Storage.remove("OriginLineDetailsPage");
    } else {
    	Services.call("iExpense_ReturnFromAttachments", function(){
    		Page.navigate(Storage.get("OriginLineDetailsPage"));
            Storage.remove("OriginLineDetailsPage");
    	}, function(){
    		Popup.ok("Error", Storage.get("Error"));
    	});
    }

}

