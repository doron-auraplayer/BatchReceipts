function iExpense_finish_onFailure() {
	var reportErrorFunc = displayReportServiceError("Failed to submit report");
	reportErrorFunc();
}

function iExpense_reviewAndFinish_onFailure() {
	//Fields.set(fieldName, value);
	//Services.call(serviceName, successFunction, failureFunction);
	//var popupMsg = Storage.get('PopupMessages');
}

function OnCancel() {
    Storage.set('draftAiReport', 'false');
    var updateMode = Storage.get("updateMode").toLowerCase() === 'true';
    updateMode ? Page.navigate("Update_Reports.html") : Page.navigate("Reports.html");
}

function onLoad() {
    if (Storage.get("fromAttachmentsPage") === "true") {
        Storage.remove("fromAttachmentsPage");
    }

    addNewLineAfterButton("Submit");

    //Storage.remove("attachmentPath");
    Storage.remove("AttachmentTitle");
    Storage.remove("AttachmentType");
    
    Services.call("iExpense_ReviewGetDetails", function() {
        var error = Storage.get("ReviewErrorMsg");
        if (error !== "" ) {
            if (error.indexOf("policy violations") > -1) {
                Popup.ok(getTranslationForId("@popup_title_warning"), "This expense report contains policy violations. Drill into your expenses to review the warning icons. If necessary, return to the previous page to update an expense line or to include a reason for violation in the justification.", function() {});
            } else {
                Popup.ok(getTranslationForId("@popup_title_error"), error, function() {});
            }
        }
        
        Storage.set("ApplicationFlow", "inReview");

        if (Storage.get("ApproverFieldExist") == "true") {
            $("#ReviewApprover_container").show();
        }
        else {
            $("#ReviewApprover_container").hide();
        }
        
        configureAttachmentFields()

        Storage.remove("ReceiptJustification");
        Fields.clear("ReceiptJustification");

        $("#ReceiptJustification_container").parent().hide();
        var ReceipJustificationStatus = Storage.get("ImageReceiptStatus");
        if (getEnvConfiguration().ExpensePreviewImageReceiptStatusExist && (ReceipJustificationStatus == "Required" || ReceipJustificationStatus == "Missing")) {
            $("#ReceiptJustification_container").parent().show();
        } 

        setExpenseDetailIcons($("#ImageReceiptStatus_container").parent());

        $("#Cancel").addClass("ReviewActionBtn");
        $("#Back").addClass("ReviewActionBtn");
        $("#Save").addClass("ReviewActionBtn");
        $("#Submit").addClass("ReviewActionBtn");
        
        $("#Attachments").attr("style", "height: 35px; padding: 0px; margin-top: 10px; margin-bottom: 15px;max-width: 150px;margin-left:5px;");
        $('#mainForm > label').before($('#Attachments').parent());


    }, displayReportServiceError('Failed to get review details'));
    
}

function validate() {
    // validate non empty attachment
    /* TODO: Is this needed with multi attachments?
    if ($("#attachmentPath")[0].files && $("#attachmentPath")[0].files.length > 0) {
        var fileDet = $("#attachmentPath")[0].files[0];
        if (fileDet.size === 0) {
            Popup.ok(getTranslationForId("@popup_title_error"), getTranslationForId("@popup_empty_attachment_file"));
            return false;
        }
    }
    */
    return true;	  
}

function singleLine() { return true; }

function onSave() {
    if (!validate()) return;
    Storage.set('draftAiReport', 'false');
    
	Services.call("iExpense_saveReportReview", function() {
    	Popup.ok(getTranslationForId("@popup_report_saved_title"), getTranslationForId("@popup_report_saved_message"), function(){});
        //Yam: old attachments
        // if (Fields.get("attachmentPath") !== "") {
        //     setAttchmentExists();
        // }
	}, displayReportServiceError('Failed to save report'));
}

function onSubmit() {
    if (!validate()) return;

    Services.call("iExpense_reviewAndFinish", function () {
        var reportTitleRes =
            Storage.get("ReviewTitle").match(/Expense Report(.*)/);

        var num = reportTitleRes !== null ? reportTitleRes[1] : "";
        var isConfirmationExist =
            Storage.get("ConfirmationExists") === "true";

        if (!isConfirmationExist) {
            Popup.ok(
                getTranslationForId("@popup_title_error"),
                Storage.get("ReviewMessage")
            );
            return;
        }

        var msg = getTranslationForId(
            "@Report_submitted_message",
            num.trim()
        );

        Popup.ok("", msg, function () {
            var isDraftAiReport =
                String(Storage.get("draftAiReport")).toLowerCase() === "true";

            if (isDraftAiReport) {
                Storage.set("STATUS", "SUBMITTED");
                Services.call(
                    "ReceiptBatch_update_report_status",

                    function () {
                        Storage.set("draftAiReport", "false");
                        Page.navigate("Reports.html");
                    },

                    displayReportServiceError(
                        "Report submitted, but receipt status update failed"
                    )
                );
            } else {
                Page.navigate("Reports.html");
            }
        });
    }, displayReportServiceError("Failed to submit report"));
}

function GoBack() {
	Services.call('iExpense_Back', function() {
            if (Storage.get("WizardTitle").indexOf("Cash and Other Expenses") > -1) {
                // sometime a system is configured with no allocation phase
                Page.navigate("Cash_Lines.html");
            } else {
                Page.navigate("ExpenseAllocations.html");
            }
	    } , displayReportServiceError("Failed to to press back on cash lines"));
}

function onAttachments() {
    var originPage = "Review";
    Storage.set("AttachmentUpdateMode", "false");
    Storage.deleteByPrefix("ExpenseAttachment");
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