var updateMode = Storage.get("updateMode").toLowerCase() === 'true';

function isCreditLinesFlow() {
	var wizardTitle = Storage.get("wizardTitle");
    return wizardTitle.indexOf("Credit Card Transactions") !== -1
}

function ReimbCurrency_lov_item_handler(arrayItem) {
    Fields.setAndStore("Currency", arrayItem["Currency"]);
    try {
    	populateField("ReimbCurrency", arrayItem[Object.keys(arrayItem)[0]].split(",")[0]);
    } catch (err) {}
}            

function iExpense_create_onSuccess() {
    nextButtonWasPressed = true;
	var wizardTitle = Storage.get("wizardTitle");
    if (wizardTitle.indexOf("List of Values") > -1) {
        // There was an error and we stayed on the same page
        Popup.ok(getTranslationForId("@popup_title_error"), "Failed to create report, invalid department value");
    } else {
    	Page.navigate(isCreditLinesFlow() ? "Credit_Transactions.html" : "Cash_Lines.html");
    }    
}

function ReimbCurrency_lov_item_presenter(arrayItem) {
    var lovItems = [];
    lovItems.push(arrayItem["Currency"]);

    return lovItems.join(",");
}

function showHideFields() {
    if (Storage.get("TemplateListExist") == "true") {
        $("#TemplateList_container").parent().show();
    } else {
        $("#Template_container").parent().show();
    }
    if (Storage.get("CurrencyListExist") == "true") {
        $("#ReimbCurrency_container").parent().show();
    } else {
        $("#TxtCurrency_container").parent().show();
    }
    if (Storage.get("ApproverExist") == "true") {
        $("#OverridingApprover_container").parent().show();
    } else {
        $("#OverridingApprover_container").parent().hide();
    }
    setTimeout(function() {Fields.setFromStorage();},500);

}


function OnPageLoad() {
    Storage.set("itemizedExpenseTypes", app.itemizedExpenseTypes);
    
    // config search button
    $('#Approver_Search').insertAfter("#OverridingApprover_container");
    $('#Approver_Search').text('');
    $("#Approver_Search").append('<i class="fa fa-search" aria-hidden="true"></i>');
    $("#OverridingApprover").parent().click(onSearchApprover);

    $("#Template_container").parent().hide();
    $("#TemplateList_container").parent().hide();
    $("#ReimbCurrency_container").parent().hide();
    $("#TxtCurrency_container").parent().hide();
    $("#OverridingApprover_container").parent().hide();

    if (Storage.get("ReturnFromSearch") !== "") {
        Storage.remove("ReturnFromSearch");
        showHideFields();
        return;
    }

    Storage.remove("reportErrorMessage");
    Storage.remove("ReimbursableColumnHeader");
    
    if (!updateMode) {
        clearForm();
        Fields.clear("OverridingApprover");
        Storage.deleteByPrefix('AllLines_');
        Storage.remove('Purpose');
        Storage.remove('ReimbCurrency');
        Storage.remove('Department');
        Storage.remove('Template');
        Storage.remove('OverridingApprover');
        Storage.remove('attachmentPath_filename');
        Storage.remove('attachmentPath');
        Storage.remove('origReportTemplate');
        // Clean previous completed credit lines
        Storage.deleteByPrefix("CashLines_Completed");
    } 
    
    invokeI18n();

    var duplicateMode = Storage.get("DuplicateReport").toLowerCase() === 'true';
    if (updateMode) {
            response = Services.call("iExpense_getGeneralReportDetails", function() {
                Fields.setAndStore("ExpTemplate", Storage.get("TemplateList"));
                Storage.set("origReportTemplate", Storage.get("TemplateList"));
                Spinner.stop();
                var title = getTranslationForId("@header-update-title");
                document.title = title;
                setTimeout(function() {
                    $("#header-title").text(title);
                    showHideFields();
                }, 100);
            }, displayReportServiceError('Failed to load report detailes'));
    } else {
        // New report or duplicate
        // setTimeout(function(){Spinner.start()},0);
        if (duplicateMode) {
    	    Storage.remove("DuplicateReport");
            response = Services.call("iExpense_getGeneralReportDetails", function() {
                showHideFields();
            }, displayReportServiceError('Failed to load report detailes after duplicate'));
        } else {
            // New report
            response = Services.call("iExpense_CreateReport", function() {
                response = Services.call("iExpense_getGeneralReportDetails", function() {
                    // Spinner.stop();
                    showHideFields();
                }, displayReportServiceError('Failed to load report detailes'));
            }, displayReportServiceError('Failed to Create report'));
        }
    }

}

function doNext() {
  Storage.clear("isErrorMessage");

  if (!updateMode) {
    Storage.set("ExpTemplate", Storage.get("TemplateList"));
    Services.call("iExpense_create", iExpense_create_onSuccess, displayReportServiceError("Failed to create report")
    );
  } else {
    Services.call("iExpense_updReportUpdateDetails", function () {
          var isErrorMessage = Storage.get("isErrorMessage");
    
          if (isErrorMessage == "true" && Storage.get("wizardTitle").indexOf("General Information") > -1) {
            // There was an error and we stayed on the same page
            Popup.ok(getTranslationForId("@popup_title_error"), Storage.get("reportErrorMessage"));
            
          } else if (Storage.get("NEW_AI_REPORT") === "true") {
    
            createAiReceiptBatchLines();
    
          } else {
    
            if (isCreditLinesFlow()) {
              Page.navigate("Credit_Transactions.html");
            } else {
    
              Page.navigate("Cash_Lines.html");
            }
    
          }
    
        }, displayReportServiceError("Failed to update report details")
    );
}

function createAiReceiptBatchLines() {
  // Report number the update service returned for the new AI report
  var storedReportNumber = Storage.get("UpdateReportNumber");

  Services.call("IExpense_ReceiptBatch_CreateLines");
  var reportNumbers = [];
  try {
    var storedReportNumbers = JSON.parse(Storage.get("ReceiptBatch_CreateLines_ReportNumbers"));
    if (Array.isArray(storedReportNumbers)) {
      reportNumbers = storedReportNumbers;
    }
  } catch (ignoredMalformedReportNumbers) {
    reportNumbers = [];
  }
  reportNumbers.push(storedReportNumber);
  Storage.set("ReceiptBatch_CreateLines_ReportNumbers", JSON.stringify(reportNumbers));

  Page.navigate("Update_Reports.html");
}


function OnCancel() {
   OnCancelPopup(function() {
       Storage.set('NEW_AI_REPORT', 'false');
       Page.navigate(updateMode?"Update_Reports.html":"Reports.html");
   });
}

function prepare_iExpense_getReportCurrencies_lov_request() {
    var inputParams = {};
    inputParams['usernameField'] = Fields.get("usernameField");
    inputParams['passwordField'] = Fields.get("passwordField");

    return inputParams;
}

function onSearchApprover() {
    Spinner.start();
    Services.call("iExpense_OpenApproverSearchWindow", function() {
        Page.navigate("ApproverSearch.html");
        Spinner.stop();
    }, displayReportServiceError('Failed to open approver search window'));
}

function prepare_iExpense_GetExpenseTemplates_lov_request() {
    var inputParams = {};

    return inputParams;
}
function TemplateList_lov_item_presenter(arrayItem) {
    var lovItems = [];
    lovItems.push(arrayItem["ExpenseTemplates"]);

    return lovItems.join(",");
}

function ExpTemplate_lov_item_handler(item, label) {
    var selectedItem = item;
    var origTemplate = Storage.get('origReportTemplate');
    var selectedLabel = label;
    if (updateMode && origTemplate.length > 0 && selectedItem.length>0 && origTemplate !== selectedItem) {
        Popup.okCancel("Warning", "You are attempting to change the expense template after entering expenses data. This will clear the expense types entered for all expenses. <br>Do you want to continue?", function() {
        	populateFieldHTML("ExpTemplate", label !== undefined ? label : item);
        	store("ExpTemplate", item);
        }, function() {
        	Fields.set("ExpTemplate", origTemplate)
        	store("ExpTemplate", origTemplate);
        })
    } else {
    	populateFieldHTML("ExpTemplate", label !== undefined ? label : item);
    	store("ExpTemplate", item);
    }
}

function TemplateList_lov_item_handler(arrayItem) {
    var selectedItem = arrayItem["ExpenseTemplates"];
    var origTemplate = Storage.get('origReportTemplate');
    if (updateMode && origTemplate.length > 0 && selectedItem.length>0 && origTemplate !== selectedItem) {
        Popup.okCancel("Warning", "You are attempting to change the expense template after entering expenses data. This will clear the expense types entered for all expenses. <br>Do you want to continue?", function() {
        	populateFieldHTML("ExpTemplate", selectedItem);
        	store("ExpTemplate", selectedItem);
        }, function() {
        	Fields.set("ExpTemplate", origTemplate)
        	store("ExpTemplate", origTemplate);
        })
    } else {
    	populateFieldHTML("ExpTemplate", selectedItem);
    	store("ExpTemplate", selectedItem);
    }
}


