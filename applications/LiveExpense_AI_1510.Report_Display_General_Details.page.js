function onLoad() {
    
    addNewLineAfterButton("Submit");

    Storage.set("ApplicationFlow", "inDisplayReport");

    // Get Report Number
    var reportTitleRes = Storage.get("ExpenseReportTitle").match(/Expense Report(.*)/);
    var num = (reportTitleRes !== null)?reportTitleRes[1]:"";
    $("#header-title").text(getTranslationForId("@Report_title") + " " + num);

    var isCashLinesExist = Storage.get("isCashLinesExist");
    if (!isCashLinesExist || isCashLinesExist !=="true") {
        $("#Cash").parent().hide();
    } 

    var isCreaditCardExpenses = Storage.get("isCreditCardExpensesExist");
    if (!isCreaditCardExpenses || isCreaditCardExpenses !=="true") {
        $("#Credit").parent().hide();
    } 
    
    var isMileageExpenses = Storage.get("isMileageLinesExist");
    if (!isMileageExpenses || isMileageExpenses !=="true") {
        $("#Mileage").parent().hide();
    } 

    var isPerDiemExpenses = Storage.get("isPerDiemLinesExist");
    if (!isPerDiemExpenses || isPerDiemExpenses !=="true") {
        $("#Per_Diem").parent().hide();
    } 

    var isExpenseAllocations = Storage.get("ExpenseAllocationPageExists");
    if (!isExpenseAllocations || isExpenseAllocations !=="true") {
        $("#Allocations").parent().hide();
    } 
 
    //Remove this:
    if (Storage.get("AttachmentsText") ==="" || Storage.get("AttachmentsText").toLowerCase().indexOf("none") !== -1 ) {
        Fields.set("AttachmentsText", "No")
    } else {
        Fields.set("AttachmentsText", "Yes")
    }
    
    configureAttachmentFields()
    
    setExpenseDetailIcons($("#ReimbursementTotal_container").parent());
    
    $("#Attachments").attr("style", "height: 35px; padding: 0px; margin-top: 10px; margin-bottom: 15px;max-width: 150px;margin-left:5px;");
    $('#mainForm > label').before($('#Attachments').parent());


    if (Storage.get("fromAttachmentsPage") === "true") {
        Storage.remove("fromAttachmentsPage");
        var attachCount = Storage.count("ExpenseAttachmentTitle");
        if (attachCount > 0) {
            $("#Attachments").text("Attachments (" + attachCount + ")");
        } else {
            $("#Attachments").text("Add Attachment");
        }
        
    }
}

function GoBack() {
    Page.navigate("Reports.html");
}



function onAttachments() {
    Storage.remove("ExpenseAttachmentTitle");
    Storage.deleteByPrefix("ExpenseAttachment");
    var originPage = "Report_Display_General_Details";
    Storage.set("AttachmentUpdateMode", "false");
    Storage.set("OriginLineDetailsPage", originPage);
    if (Storage.count("AttachmentType") > 0) {
        Page.navigate("ExpenseLineAttachments.html");        
    } else {
        Storage.set("OriginAttachmentsPage", originPage);
        Page.navigate("ExpenseLineAddAttachment.html");
    }
}

function configureAttachmentFields() {
    var attachCount = Storage.count("AttachmentType");
    if (attachCount > 0) {
        $("#Attachments").text("Attachments (" + attachCount + ")");
    } else {
        $("#Attachments").text("Add Attachment");
    }
}

