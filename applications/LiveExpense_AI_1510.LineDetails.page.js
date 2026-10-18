var isInitializingLineDetails = false;

var ReimbCurrency = Storage.get("ReimbCurrency");
if (ReimbCurrency === "") {
  ReimbCurrency = Storage.get("TxtCurrency");
}
var isCreditLine = Storage.get("isCreditLine") === "true";
var ExpensesFilteredExpenseTypes = Storage.get("ExpensesFilteredExpenseTypes");

function loadItemizationTableCount() {
  //console.log("loadItemizationTableCount");
  if (Storage.get("ItemizationTableExist") === "true") {
    Services.callSync('iExpense_lineDetailsGetItemizationTable', displayReportServiceError('Failed to get itemization table'));
  }
}

function onLocationChange() {
  //console.log("onLocationChange");
  Storage.clear("LocationResolvedValue");
  storeDateFormatted("StartDate", true);
  Services.call("iExpense_locationEnterName", function () {
    if (Storage.get("searchWindowOpen") === "true") {
      Storage.set("LocationSearchFrom", "ReceiptBasedExpense");
      Page.navigate("LocationSearch.html");
      Storage.set("LocationOnlyGet", "true");
      Storage.set("LocationSearchAlreadyOpened", "true");
      return;
    }
    var resolvedName = Storage.get("LocationResolvedValue");
    if (resolvedName.length > 0) {
      Fields.set("LocationName", resolvedName);
    } else {
      Fields.set("LocationName", "");
      Popup.ok("Error", "Location name was not resolved");
    }
  }, displayReportServiceError('Failed to select location'));
}

function loadFieldsByExpenseType(expenseType, CB) {
  console.log("loadFieldsByExpenseType");
  if (expenseType !== undefined) {
    store("ExpTypeInput", expenseType);
  }

  showHideAnalyzeBtn();
  Spinner.start();
  console.log("loadFieldsByExpenseType - iExpense_lineDetailsGet");
    
    
  var isInitializingLineDetails = true;//for syncing with iExpense_GetExchangeRate
  Services.call("iExpense_lineDetailsGet", function () {
    isInitializingLineDetails = false;  
    Storage.set("origExpenseType", expenseType);
    setAndStoreDateField("StartDate", true);
    setAndStoreDateField("AccEndDate", true);

    loadItemizationTableCount();
    LDshowFieldsByExpenseType();
    // if (isCreditLine) {
    //     setCreditLineFields();
    // }
    if (Storage.get("AttendeesTableExist") == "true") {
      Storage.clear("ItemizedItem");
      Services.callSync("iExpense_attendeesEmpTableGetJS", displayReportServiceError('Failed to get attendees list'));
      populateField("AttendeeNames", Storage.getArray("AttendiesEmpTableEmpName").join(","));

      Services.callSync("iExpense_attendeesGuestTableGetJS", displayReportServiceError('Failed to get guests list'));
      populateField("GuestNames", Storage.getArray("AttendiesGuestTableName").join(","));
    }

    // if (Storage.get("doMatch")) {
    //     trasactionReciptsMatching();
    // }

    Spinner.stop();
    if (typeof CB === "function") {
      CB();
    }
  }, function (response) {
    Spinner.stop();
    isInitializingLineDetails = false;
    displayReportServiceError("Failed to get expense line details");
  });
}

function expenseType_lov_item_handler(arrayItem) {
  //console.log("expenseType_lov_item_handler");
  var prevVal = Storage.get("origExpenseType");
  var newVal = arrayItem["ExpenseType"];

  // Block when line is itemized
  if ($('#ToggleItemization').is(':visible') && $('#ToggleItemization').text() === "Remove Itemization" && Storage.get("ExpenseType") !== newVal) {
    Fields.set("expenseType", Storage.get("ExpenseType"));
    Popup.ok("Itemized Line", "Please remove itemization before changing expense type.");
    return;
  }

  Fields.setAndStore("ExpenseType", arrayItem["ExpenseType"]);
  try {
    populateField("expenseType", arrayItem[Object.keys(arrayItem)[0]].split(",")[0]);
  } catch (err) { }

  if (prevVal !== newVal) {
    console.log("loadFieldsByExpenseType - loadFieldsByExpenseType");
    loadFieldsByExpenseType(arrayItem.ExpenseType);
  }
}

function showFieldIfExist(fieldName) {
  //console.log("showFieldIfExist");
  if (Storage.get(fieldName + 'Exist') == 'true') {
    showField(fieldName);
  } else {
    hideField(fieldName);
  }
}

function showField(field) {
  //console.log("showField");
  var elm = document.getElementById(field + '_container');
  if (elm) {
    elm.style.display = 'block';
  }
}
function hideField(field) {
  //console.log("hideField");
  var elm = document.getElementById(field + '_container');
  if (elm) {
    elm.style.display = 'none';
  }
}

function enableItemization() {
  //console.log("enableItemization");
  var itemizationExists = Storage.get("ItemizationExists") === "true";
  if (app.itemizedExpenseTypes === "") {
    return itemizationExists;
  } else {
    return itemizationExists && app.itemizedExpenseTypes.toLowerCase().indexOf(Fields.get("expenseType").toLowerCase()) > -1;
  }
}

function LDshowFieldsByExpenseType() {
  console.log("LDshowFieldsByExpenseType");
  showHideAnalyzeBtn();
  $("#ItemizationTable").parent().hide();
  $("#ToggleItemization").hide();
  if (Fields.get("expenseType").length > 0 && enableItemization()) {
    $("#ToggleItemization").show();
    if (Storage.get("ItemizedItem") === "true") {
      //$("label[for='ScanReceipt'].ui-btn").hide();
      $("#ToggleItemization").text("Remove Itemization");

      $("#mainForm").append($("#ItemizationTable").parent());
      $("#ItemizationTable").parent().attr("style", "max-width: 50%;");
      $("#ItemizationTable").attr("style", "min-width:150px; max-height: 50px");
      var numItemizedLines = Storage.count("ItemizationTableLineNumber") - 1;
      numItemizedLines = numItemizedLines === 0 ? 1 : numItemizedLines;
      $("#ItemizationTable").text("Itemization Table (" + numItemizedLines + ")");
      $("#ItemizationTable").show();
    } else {
      $("#ToggleItemization").text("Itemize");
    }
  }

  iExpenseLineFields.forEach(function (fieldName) {
    showFieldIfExist(fieldName);
  });

  // handle search location button
  $('#Location_Search').hide();
  if (Storage.get("LocationFieldEditable") === "false") {
    $('#LocationName').prop("disabled", false);
  }
  if (Storage.get("SearchLocationButtonExist") == "true") {
    $('#Location_Search').show();
    $('#Location_Search').insertAfter("#LocationName_container");
    $('#LocationName').off();
    $('#LocationName').change(onLocationChange);
    if (Storage.get("LocationFieldEditable") === "false") {
      $('#LocationName').prop("disabled", true);
    }
  }

  // handle attendees and guest Table.setColumn(fieldName, value)
  $('#Attendees').hide();
  hideField('AttendeeNames');
  if (Storage.get("AttendeesTableExist") == "true") {
    showField('AttendeeNames');
    $('#Attendees').insertAfter("#AttendeeNames_container");
    $('#Attendees').show();
  }
  $('#Guests').hide();
  hideField('GuestNames');
  if (Storage.get("GuestTableExist") == "true") {
    $('#Guests').insertAfter("#GuestNames_container");
    showField('GuestNames');
    $('#Guests').show();
  }

  configureAttachmentFields();

}

function ReceiptCurrencyChoice_lov_item_handler(arrayItem) {
  //console.log("ReceiptCurrencyChoice_lov_item_handler");

  if (Storage.get("expenseType").length > 0 && Fields.get("StartDate").length === 0) {
    Popup.ok("Error", "Fill Start Date before changing currency");
    setTimeout(function () { Fields.set("ReceiptCurrencyChoice", Storage.get("ReceiptCurrencyChoice")) }, 0);
    return;
  }
  Fields.setAndStore("Currency", arrayItem["Currency"]);
  try {
    populateField("ReceiptCurrencyChoice", arrayItem[Object.keys(arrayItem)[0]].split(",")[0]);
  } catch (err) { }
  if (Fields.get("ReceiptCurrencyChoice").length > 0) {
    if (isInitializingLineDetails) {
        console.log("waiting before iExpense_GetExchangeRate")
      setTimeout(function () {
        storeDateFormatted("StartDate", true);
        Services.call("iExpense_GetExchangeRate", function () {
          calculateReimbursValue(true);
        }, displayReportServiceError('Failed to get expense line details'));
      }, 10);
    }
  }
}

function AirTravelType_lov_item_handler(item, label) {
  //console.log("AirTravelType_lov_item_handler");
  populateFieldHTML("AirTravelType", label !== undefined ? label : item);
  store("AirTravelType", item);
}
function AirTicketClass_lov_item_handler(item, label) {
  //console.log("AirTicketClass_lov_item_handler");
  populateFieldHTML("AirTicketClass", label !== undefined ? label : item);
  store("AirTicketClass", item);
}

function validateLine() {
  //console.log("validateLine");
  if (Storage.get("expenseType") === '') {
    Popup.ok(getTranslationForId("@popup_title_error"), getTranslationForId("@popup_no_expense_type"));
    return false;
  }

  if (Storage.get("AttendeesTableExist") == "true" && Storage.count("AttendiesGuestTableName") === 0 && Storage.count("AttendiesEmpTableEmpName") === 0) {
    Popup.ok(getTranslationForId("@popup_title_error"), getTranslationForId("@popup_no_attendies_or_guests"));
    return false;
  }

  // Temp fix until issue resolved, required is not working for date field (SM-1523)
  if (Fields.get("StartDate") === "") {
    Popup.ok(getTranslationForId("@popup_title_error"), getTranslationForId("@popup_no_start_date"));
    return false;
  }

  // // validate non empty attachment
  // if ($("#attachmentPath")[0].files && $("#attachmentPath")[0].files.length > 0) {
  //     var fileDet = $("#attachmentPath")[0].files[0];
  //     if (fileDet.size === 0) {
  //         Popup.ok(getTranslationForId("@popup_title_error"), getTranslationForId("@popup_empty_attachment_file"));
  //         return false
  //     }
  // }

  return true;
}

function openDetailedLine() {
  //console.log("openDetailedLine");
  //count all lines with prefix 'AllLines_ExpenseType_' (the function ignores the index)
  var index = parseInt(Storage.get('index'));
  var maxLines = parseInt(Storage.get("MaxCashLines"));
  if ((index + 1) === maxLines) {
    if (Storage.get("ExpensesLongScroll") === "true") {
      var endRow = 10;
      if (Storage.get("paginationLabel").length > 0) {
        endRow = parseInt(Storage.get("paginationLabel").split(" ")[3]);
      }
      Storage.set("paginationStartIndex", endRow + 1);
      Services.callSync("iExpense_CashLinesNextPrev", displayReportServiceError('Failed to add more cash lines'));
    } else {
      Services.callSync("iExpense_CashLinesAddMoreLines", displayReportServiceError('Failed to add more cash lines'));
    }
    Storage.set('index', 0);
  } else {
    Storage.set('index', parseInt(index) + 1);
    Storage.set('index', index + 1);
  }
  Storage.remove("LineDetailsUpdate");

  if (Storage.get("ExpensesTableCashCategory") === "Mileage") {
    Services.call("iExpense_cash_openMileageLineDetails", function () {
      save_onSuccess();
    }, displayReportServiceError('Failed to open detailed mileage expense line'));
  } else if (Storage.get("ExpensesTableCashCategory") === "PerDiem") {
    Services.call("iExpense_cash_openPerDiemLineDetails", function () {
      save_onSuccess();
    }, displayReportServiceError('Failed to open detailed PerDiem expense line'));
  } else {
    Services.call("iExpense_cash_openLineDetails", function () {
      save_onSuccess();
    }, displayReportServiceError('Failed to open detailed expense line'));
  }
}

function next_onSuccess() {
  console.log("next_onSuccess");
  var index = Storage.get('index');
  
  if (isCreditLine) {
    Storage.set('CashLines_Completed_' + index, true);
    Page.navigate('Credit_Lines.html');
  } else {
    Page.navigate('Cash_Lines.html');
  }
  
  //ReceiptBatch
  var receiptbatchId = Storage.get("receiptbatch_id");
  console.log("receiptbatchId --- ",receiptbatchId);
    
  if (receiptbatchId != null &&
    receiptbatchId !== "" &&
    receiptbatchId !== "null" &&
    receiptbatchId !== "undefined") {
       addReceiptbatchSubmitted(receiptbatchId);
    }
 
}

function save_onSuccess() {
    console.log("save_onSuccess");    
    onLoad();
}

function addReceiptbatchSubmitted(id) {
    console.log("addReceiptbatchSubmited");
    id = String(id);

    var submittedIds = JSON.parse(Storage.get("receiptbatch_submitted") || "[]");

    if (!submittedIds.includes(id)) {
        submittedIds.push(id);
        Storage.set("receiptbatch_submitted", JSON.stringify(submittedIds));
    }

    console.log("submittedIds --- ", submittedIds);
}

function getCurrenyFromCreditLine(creditLineAmount) {
  //console.log("getCurrenyFromCreditLine");
  var retVal = "USD - US dollar";
  if (creditLineAmount.indexOf("EUR") !== -1) {
    retVal = "EUR - Euro";
  }
  if (creditLineAmount.indexOf("JPY") !== -1) {
    retVal = "JPY - Yen";
  }
  return retVal;
}

function setCreditLineFields() {
  console.log("setCreditLineFields");
  $("#DetailReceiptAmount").prop('disabled', true);
  $("#DetailMerchantName").prop('disabled', true);
  $("#ReceiptCurrencyChoice").parent().prop('disabled', true);
  $("#ReceiptCurrencyChoice").parent().off();
  $("#ReceiptCurrencyChoice_lov_trigger").off();
  $('#ReceiptCurrencyChoice').parent().css('background-color', 'rgba(234, 234, 234, 0.6)');
  $('#ReceiptCurrencyChoice_lov_trigger').css('background-color', 'rgba(234, 234, 234, 0.6)');
  $("#DetailDailyRate").prop('disabled', true);
  populateField('StartDate', Storage.get('TransactionDate'));
  populateField('ExchRate', 1);
  var index = Storage.get("index");
  var transactionAmount = Storage.get('TransactionAmount');
  var receiptCurrency = getCurrenyFromCreditLine(transactionAmount);
  populateField('DetailReceiptAmount', transactionAmount.replace(/[^0-9.]/g, ''));
  Storage.set('Currency', receiptCurrency);
  ReceiptCurrencyChoice_lov_item_handler({ Currency: receiptCurrency });    // hardcoded for demo, TODO interpret actual value
  populateField('DetailMerchantName', Storage.get('DetailMerchantNameText'));
  
  trasactionReciptsMatching();
}

function calculateReimbursValue(forceCalculate) {
  //console.log("calculateReimbursValue");
  var expenseType = Storage.get("expenseType") || Storage.get("EXPENSE_TYPE") || "";

  if (expenseType.length === 0 || isCreditLine) {
    console.log("expenseType empty");
    return;
  }


  // if ((Fields.get("ReceiptCurrencyChoice") === 'USD - US Dollar') && (Storage.get("ExchRateInputExist") !== "true" || Storage.get("ExchRateTextExist") === "true")) {
  if (Fields.get("ExchRate") === '1' && !(forceCalculate === true) && Storage.get("ItemizationExists") !== "true") {
    Fields.set("DetailReimbursAmt", Fields.get("DetailReceiptAmount"));
    $("#ExchRate").prop("disabled", true);
  } else {
    storeDateFormatted("StartDate", true);
    Services.call('iExpense_CalculateReibursAmount', function () {
      LDshowFieldsByExpenseType()
      var ExchField = $("#ExchRate");
      ExchField.prop("disabled", true);
      ExchField.prop("step", "0.01");
      if (Storage.get("ExchRateInputExist") == "true") {
        ExchField.prop("disabled", false);
      }
    }, displayReportServiceError('Failed calculate Reimbursed amount'));
  }

}


function calculateDailyRateByAmount() {
  //console.log("calculateDailyRateByAmount");
  if (Storage.get("DetailDailyRateExist") == "true" && Storage.get("NumberOfDaysExist") == "true"
    && Fields.get("DetailReceiptAmount") !== "" && Fields.get("NumberOfDays") !== "") {
    Fields.set("DetailDailyRate", (parseFloat(Fields.get("DetailReceiptAmount")) / parseFloat(Fields.get("NumberOfDays"))).toFixed(2))
  }
  calculateReimbursValue();
}

function calculateDailyRateByRate() {
  //console.log("calculateDailyRateByRate");
  if (Storage.get("DetailDailyRateExist") == "true" && Storage.get("NumberOfDaysExist") == "true"
    && Fields.get("DetailDailyRate") !== "" && Fields.get("NumberOfDays") !== "") {
    Fields.set("DetailReceiptAmount", (parseFloat(Fields.get("DetailDailyRate")) * parseFloat(Fields.get("NumberOfDays"))).toFixed(2))
  }
  calculateReimbursValue();
}

function configureAnalyzeReceiptBtn() {
  //console.log("configureAnalyzeReceiptBtn");
  $("#ScanReceipt").change(analyzeReceipt);
  $("label[for='ScanReceipt'].ui-btn").insertAfter($($("#expenseType").parent().parent()));
  $("label[for='ScanReceipt'].ui-btn").attr("style", "margin-top: 28px");
  $("#ScanReceipt_container").hide();
  $("#expenseType_container").attr("style", "max-width: 230px;");
  $("label[for='ScanReceipt'].ui-btn").hide();
}

function showHideAnalyzeBtn() {
  //console.log("showHideAnalyzeBtn");
  if (Storage.get("EnableAIToScanReceipt") !== 'true') return;

  if (Storage.count("AttachmentType") > 0) {
    $("label[for='ScanReceipt'].ui-btn").hide();
  } else {
    $("label[for='ScanReceipt'].ui-btn").show();
  }
}

function analyzeReceipt() {
  //console.log("analyzeReceipt");

  // Block when line is itemized
  if ($('#ToggleItemization').is(':visible') && $('#ToggleItemization').text() === "Remove Itemization") {
    Popup.ok("Itemized Line", "Please remove itemization before scanning a receipt.");
    return;
  }

  Spinner.start("Analyzing Receipt");
  Services.call('IExpense_AnalyzeReceiptFile', function () {
    var expenseType = Storage.get("AnalyzeReceiptType");
    Fields.setAndStore("expenseType", expenseType);
    console.log("analyzeReceipt - loadFieldsByExpenseType");
    loadFieldsByExpenseType(expenseType, function () {
      Fields.set("DetailReceiptAmount", Storage.get("Amount"));
      Fields.set("StartDate", Storage.get("ReceiptDate"));
      Fields.set("DetailMerchantName", Storage.get("MerchantName"));
      if (Storage.get("SearchLocationButtonExist") !== "true") {
        Fields.set("LocationName", Storage.get("Location"));
      }

      Spinner.start("Adding receipt as an attachment");
      Storage.set("AttachType", "file");
      Storage.set("AttachFilePath", Storage.get("ScanReceipt"));
      Services.call("iExpense_AddUpdateAttachment", function () {
        Storage.set("AttachmentType_0", "file");
        configureAttachmentFields();
        showHideAnalyzeBtn();
      }, displayReportServiceError('Failed to add attachment'));
    });
  });
}

function onLoad() {
  console.log("onLoad - LineDetails");
  configureAnalyzeReceiptBtn();
  setTimeout(function () { showHideAnalyzeBtn() }, 100);

  $("#Attachments").attr("style", "height: 35px; padding: 0px; margin-top: 10px; margin-bottom: 15px;max-width: 160px;margin-left:5px;");
  $("#mainForm").append($("#Attachments").parent());
  $("#ToggleItemization").attr("style", "height: 35px; padding: 0px; margin-top: 10px; margin-bottom: 15px;max-width: 160px;margin-left:5px;");
  $("#mainForm").append($("#ToggleItemization").parent());
  //$("#expenseType_container").parent().append($("#ToggleItemization").parent());
  $("#expenseType").parent().attr("class", "ui-icon-carat-d ui-btn-icon-right")

  Storage.remove("ContinueWithWarnings");
  Storage.remove("receiptbatch_id");
  // $("#LineNumber").prop("style", "display: inline-block; width: 35px; height: 20px; position: relative; left: 12px; margin-top: -18px; line-height: 0.5;");
  // $("#LineNumber_container > label").attr("style", "display: inline-block");
  setTimeout(function () { $("#Location_Search").append('<i class="fa fa-search" aria-hidden="true"></i>') }, 0);

  $("#ExchRate").change(calculateReimbursValue);
  $("#DetailReceiptAmount").change(calculateDailyRateByAmount);
  $("#NumberOfDays").change(calculateDailyRateByAmount);
  $("#DetailDailyRate").change(calculateDailyRateByRate);

  if (Storage.get("fromSelectLocation") == "true") {
    console.log("fromSelectLocation");
    // return from search window
    Storage.remove("fromSelectLocation");
    var selectedLocation = Storage.get("PopupLocationName");
    if (selectedLocation !== "") {
      populateField("LocationName", selectedLocation);
    }
    LDshowFieldsByExpenseType();
  }
  else if (Storage.get("fromItemization") == "true") {
    console.log("fromItemization");
    // return from itemization window
    Storage.remove("fromItemization");
    Storage.remove("fromAttachmentsPage");
    Fields.set("LineNumber", Storage.get("LineTitle").match(/.(\d+)/)[1]);
    Storage.set("LineDetailsUpdate", "true");
    console.log("onLoad(fromItemization) - loadFieldsByExpenseType");
    loadFieldsByExpenseType();
  }
  else if (Storage.get("fromAttachmentsPage") === "true") {
    console.log("fromAttachmentsPage");
    Storage.remove("fromAttachmentsPage");
    Fields.set("LineNumber", Storage.get("LineTitle").match(/.(\d+)/)[1]);
    Storage.set("LineDetailsUpdate", "true");
    console.log("onLoad(fromAttachmentsPage) - loadFieldsByExpenseType");
    loadFieldsByExpenseType(undefined, function () {
    });
  }
  else if (Storage.get("fromSelectEmployees") == "true" || Storage.get("fromSelectGuest")) {
    console.log("fromSelectEmployees");
    // return from employee search window
    Storage.remove("fromSelectEmployees");
    Storage.remove("fromSelectGuest");
    // populateField("AttendeeNames", Storage.count("AttendiesEmpTableEmpName"));
    populateField("AttendeeNames", Storage.getArray("AttendiesEmpTableEmpName").join(","));
    // populateField("GuestNames", Storage.count("AttendiesGuestTableName"));
    populateField("GuestNames", Storage.getArray("AttendiesGuestTableName").join(","));
  }
  else if (Storage.get("LineDetailsUpdate") == "true") {
    console.log("LineDetailsUpdate");
    // update
    Fields.set("RBLocation", "All Other Locations");
    Fields.set("LocationName", "All Other Locations");
    Fields.set("LineNumber", Storage.get("LineTitle").match(/.(\d+)/)[1]);

    Fields.clear("attachmentPath_filename");
    Storage.remove("attachmentPath_filename");
    Storage.remove("SearchLocationButtonExist");
    Storage.remove("AttendeesTableExist");
    Storage.remove("GuestTableExist");
    Storage.remove("AttachFilePath");
    Storage.deleteByPrefix("AttendiesGuestTableName");
    Storage.deleteByPrefix("AttendiesEmpTableEmpName");
    populateField("AttendeeNames", 0);
    populateField("GuestNames", 0);

    // Clean old field values
    iExpenseLineFields.forEach(function (fieldName) {
      Storage.remove(fieldName);
      Storage.remove(fieldName + 'Exist');
    });

    store("ExpTypeInput", "");

    setTimeout(function () {
      $('#Add_Line').hide();
    }, 0);

    var ExchField = $("#ExchRate");
    ExchField.prop("disabled", true);
    ExchField.prop("step", "0.01");
    if (Storage.get("ExchRateInputExist") == "true") {
      ExchField.prop("disabled", false);
    }

    $("#DetailReceiptAmount").prop("step", "0.01");
    console.log("onLoad(LineDetailsUpdate) - loadFieldsByExpenseType");
    Storage.set("doMatch", false);
    if (Storage.get("isCreditLine")){
       Storage.set("doMatch", true);
    }
    loadFieldsByExpenseType();
    
    // if(Storage.get("isCreditLine")){
    //   console.log("LineDetailsUpdate - loadFieldsByExpenseType");    
    //   trasactionReciptsMatching();
    // }
  }
/*****************************************/  
  else if (Storage.get("ApproveScannedReceipt") == "true") {
    console.log("Approve Scanned Receipt");
    Storage.remove("ApproveScannedReceipt");
    
    Storage.set("receiptbatch_id", Storage.get("RECEIPTBATCH_RECEIPT_ID"));
    console.log("receiptbatch_id: ",Storage.get("receiptbatch_id"));
    
    Fields.set("RBLocation", "All Other Locations");
    Fields.set("LocationName", "All Other Locations");
    Fields.set("LineNumber", Storage.get("LineTitle").match(/.(\d+)/)[1]);

    Storage.deleteByPrefix("AttachmentType");

    clearForm();
    Fields.clear("attachmentPath_filename");
    Storage.remove("attachmentPath_filename");
    Storage.remove("SearchLocationButtonExist");
    Storage.remove("AttendeesTableExist");
    Storage.remove("GuestTableExist");
    Storage.remove("AttachFilePath");
    Storage.deleteByPrefix("AttendiesGuestTableName");
    Storage.deleteByPrefix("AttendiesEmpTableEmpName");
    populateField("AttendeeNames", 0);
    populateField("GuestNames", 0);

    Storage.clear("origExpenseType");

    // Clean old field values
    iExpenseLineFields.forEach(function (fieldName) {
      Storage.remove(fieldName);
      Storage.remove(fieldName + 'Exist');
    });

    store("ExpTypeInput", "");

    $('#Add_Line').show();

    Fields.clear("expenseType");


    $("#DetailReceiptAmount").prop("step", "0.01");
    ScannedReceiptUpload();

  }
  else {
    console.log("new report");
    // new report
    Fields.set("RBLocation", "All Other Locations");
    Fields.set("LocationName", "All Other Locations");
    Fields.set("LineNumber", Storage.get("LineTitle").match(/.(\d+)/)[1]);

    Storage.deleteByPrefix("AttachmentType");


    clearForm();
    Fields.clear("attachmentPath_filename");
    Storage.remove("attachmentPath_filename");
    Storage.remove("SearchLocationButtonExist");
    Storage.remove("AttendeesTableExist");
    Storage.remove("GuestTableExist");
    Storage.remove("AttachFilePath");
    Storage.deleteByPrefix("AttendiesGuestTableName");
    Storage.deleteByPrefix("AttendiesEmpTableEmpName");
    populateField("AttendeeNames", 0);
    populateField("GuestNames", 0);

    Storage.clear("origExpenseType");

    // Clean old field values
    iExpenseLineFields.forEach(function (fieldName) {
      Storage.remove(fieldName);
      Storage.remove(fieldName + 'Exist');
    });

    store("ExpTypeInput", "");

    $('#Add_Line').show();

    if (isCreditLine && Storage.get("expenseType") !== "") {
      // in case of credit line there could be already expense type, so load line
      Spinner.start();
      console.log("onLoad - iExpense_lineDetailsGet");
      Services.call("iExpense_lineDetailsGet", function () {
        LDshowFieldsByExpenseType();
        console.log("setCreditLineFields 1");
        setCreditLineFields();
        Spinner.stop()
      }, displayReportServiceError('Failed to get expense line details'))
    } else {
      ReceiptCurrencyChoice_lov_item_handler({ Currency: ReimbCurrency });
      Fields.clear("expenseType");
    }

    // 	set default values for LOVs - can be removed once the bug on it is Storage.getFromIndex(key, index)
    if (!Fields.get("AirTravelType")) AirTravelType_lov_item_handler("International");
    if (!Fields.get("AirTicketClass")) AirTicketClass_lov_item_handler("Coach");
    populateField("ExchRate", "1");
    var ExchField = $("#ExchRate");
    ExchField.prop("disabled", true);
    ExchField.prop("step", "0.01");

    $("#DetailReceiptAmount").prop("step", "0.01");

    if (Storage.get("PerformAnalyzeReceipt") === "true") {
      Storage.clear("PerformAnalyzeReceipt");
      $("#ScanReceipt").click();
    }

  }

  if (Storage.get("LineDetailsUpdate") == "true" || isCreditLine) {
    setTimeout(function () {
      $('#Add_Line').hide();
      if (isCreditLine) {
          console.log("setCreditLineFields 2");
        setCreditLineFields();
      }
    }, 0);
  }

  $('#Location_Search').text('');
  $('#Location_Search').hide();

  // display some fixed fields (important for credit cards)
  iExpenseLineFixedFields.forEach(function (type) {
    store(type + "Exist", "true");
  });

  LDshowFieldsByExpenseType();
}

function prepare_iExpense_CurrencyList_lov_request() {
  //console.log("prepare_iExpense_CurrencyList_lov_request");
  var inputParams = app.iExpenseConfig;

  return inputParams;
}
function ReceiptCurrencyChoice_lov_item_presenter(arrayItem) {
  //console.log("ReceiptCurrencyChoice_lov_item_presenter");
  var lovItems = [];
  lovItems.push(arrayItem["Currency"]);

  return lovItems.join(",");
}

function isDirty() {
  //console.log("isDirty");
  return Storage.get("expenseType") !== '';
}

//function prepare_iExpense_getReportCurrencies_lov_request() {
//    var inputParams = JSON.parse(Storage.get("iExpenseConfig"));
//    inputParams['usernameField'] = Fields.get("usernameField");
//    inputParams['passwordField'] = Fields.get("passwordField");
//
//    return inputParams;
//}

function prepare_iExpense_getReportCurrencies_lov_request() {
  //console.log("prepare_iExpense_getReportCurrencies_lov_request");
  var inputParams = {};
  inputParams['usernameField'] = Fields.get("usernameField");
  inputParams['passwordField'] = Fields.get("passwordField");

  return inputParams;
}

function prepare_iExpense_getExpenseTypes_lov_request() {
  //console.log("prepare_iExpense_getExpenseTypes_lov_request");
  var inputParams = {};

  return inputParams;
}
//function expenseType_lov_item_presenter(arrayItem) {
//    var lovItems = [];
//    lovItems.push(arrayItem["ExpenseType"]);
//    if (ExpensesFilteredExpenseTypes.indexOf(arrayItem.ExpenseType) < 0 || arrayItem.ExpenseType.trim() == "") {
//        return lovItems.join(",");
//    }
//
//    return "Under Construction - " + lovItems.join(",");
//}
function expenseType_lov_item_presenter(arrayItem) {
  //console.log("expenseType_lov_item_presenter");
  var lovItems = [];
  lovItems.push(arrayItem["ExpenseType"]);

  return lovItems.join(",");
}

function onLocationSearch() {
  //console.log("onLocationSearch");
  Spinner.start();
  Storage.set("LocationSearchFrom", "ReceiptBasedExpense");
  Storage.set("ExpensesSearchLocationSelector", getEnvConfiguration().ExpensesSearchLocRBSelector);
  Services.call("iExpense_LocationSearchOpen", function () {
    Page.navigate("LocationSearch.html");
    Spinner.stop();
  }, displayReportServiceError('Failed to open location search window'));

}

function onClickAttendees() {
  //console.log("onClickAttendees");
  Page.navigate("Attendees.html");
}

function onClickGuests() {
  //console.log("onClickGuests");
  Page.navigate("Guests.html");
}

function onSaveLine(forItemization) {
  console.log("onSaveLine");
  // Storage.set("nextButtonId", "ReturnButton");
  Storage.set("nextButtonId", "NewButton");
  Storage.remove("CashLineErrorMessageExists");
  Storage.remove("CashLineWarningMessageExists");
  if (validateLine()) {
    Storage.remove("paginationLabel");
    if (forItemization) {
      Storage.set("nextButtonId", "");
    } else {
      // Storage.set("nextButtonId", "ReturnButton");
      Storage.set("nextButtonId", "NewButton");
    }
    storeDateFormatted("StartDate", true);
    storeDateFormatted("AccEndDate", true);
    Services.call('iExpense_lineDetailsSet', function () {
      if (!forItemization) {
        Storage.remove("LineDetailsUpdate");
      }
      if (Storage.get("CashLineErrorMessageExists") === "true") {
        Popup.ok(getTranslationForId("@popup_title_error"), Storage.get("CashLineErrorMessage"))
      } else if (Storage.get("CashLineWarningMessageExists") === "true" && Storage.get("ContinueWithWarnings") != "true") {
        Popup.okCancel(getTranslationForId("@popup_title_warning"), Storage.get("CashLineWarningMessage") + "<BR>" + getTranslationForId("@popup_should_continue"),
          function () {
            Storage.set("ContinueWithWarnings", "true");
            onSaveLine(forItemization);
          }, function () { })
      } else {
        Storage.remove("ContinueWithWarnings");
        if (forItemization) {
          Page.navigate("ItemizationLines")
        } else {
          console.log("onSaveLine - iExpense_lineDetailsGet");
          Services.callSync("iExpense_lineDetailsGet", displayReportServiceError("Failed to get expense line details"));
          save_onSuccess();
          //openDetailedLine();
        }
        // save_onSuccess(); 
      }
    }, displayReportServiceError("Failed to save expense line", "Update_Reports.html"));
  }
}

function onNext() {
  console.log("onNext");
  Storage.set("nextButtonId", "ReturnButton");
  if (validateLine()) {
    Storage.remove("CashLineErrorMessageExists");
    Storage.remove("CashLineWarningMessageExists");
    Storage.remove("paginationLabel");
    storeDateFormatted("StartDate", true);
    storeDateFormatted("AccEndDate", true);
    Services.call('iExpense_lineDetailsSet', function () {
      if (Storage.get("CashLineErrorMessageExists") === "true") {
        Popup.ok(getTranslationForId("@popup_title_error"), Storage.get("CashLineErrorMessage"))
      } else if (Storage.get("CashLineWarningMessageExists") === "true" && Storage.get("ContinueWithWarnings") != "true") {
        Popup.okCancel(getTranslationForId("@popup_title_warning"), Storage.get("CashLineWarningMessage") + "<BR>" + getTranslationForId("@popup_should_continue"),
          function () {
            Storage.set("ContinueWithWarnings", "true");
            onNext();
          }, function () { })
      } else {
        Storage.remove("ContinueWithWarnings");
        next_onSuccess();
      }
    }, displayReportServiceError("Failed to save expense line", "Update_Reports.html"));
  }
}

function removeCashLineOnCancel(cb) {
  //console.log("removeCashLineOnCancel");
  Storage.set("indexLineToRemove", Storage.get("index"));

  var CashCategory = Storage.get("ExpensesTableCashCategory");
  if (CashCategory !== "Receipt-Based" || Storage.get("LineDetailsUpdate") === "true") {
    cb();
    return;
  }

  Storage.set("ExpensesTableCashLinePrefix", Storage.get("ExpensesTableCashLinePrefix_Receipt"));

  Services.call("iExpense_cash_removeLine", function () {
    cb();
  }, displayReportServiceError("Failed to remove line cache line"));

}

function onCancel() {
  //console.log("onCancel");
  // Cash line
  if (isDirty()) {
    OnCancelPopup(function () {
      Services.call("iExpense_lineDetailsCancel", function () {
        if (isCreditLine) {
          var index = Storage.get('index');
          Storage.set('CashLines_Completed_' + index, false);
          Page.navigate("Credit_Lines.html");
        } else {
          removeCashLineOnCancel(function () {
            Page.navigate("Cash_Lines.html")
          });
        }
      }, displayReportServiceError('Failed to cancel line'));
    });
  } else {
    Services.call("iExpense_lineDetailsCancel", function () {
      if (isCreditLine) {
        Page.navigate("Credit_Lines.html");
      } else {
        Page.navigate("Cash_Lines.html");
      }
    }, displayReportServiceError('Failed to cancel line'));
  }

}

function onAttachments() {
  //console.log("onAttachments");
  if (validateLine()) {
    Storage.set("nextButtonId", "");
    storeDateFormatted("StartDate", true);
    storeDateFormatted("AccEndDate", true);
    Services.call('iExpense_lineDetailsSet', function () {
      var originPage = "LineDetails";
      Storage.set("AttachmentUpdateMode", "false");
      Storage.set("OriginLineDetailsPage", originPage);
      if (Storage.count("AttachmentType") > 0) {
        Page.navigate("ExpenseLineAttachments.html");
      } else {
        Storage.set("OriginAttachmentsPage", originPage);
        Page.navigate("ExpenseLineAddAttachment.html");
      }
    }, displayReportServiceError('Failed to set line detailes on adding attachment'));
  }
}

function configureAttachmentFields() {
  console.log("configureAttachmentFields");
  var attachCount = Storage.count("AttachmentType");
  if (attachCount > 0) {
    $("#Attachments").text("Attachments (" + attachCount + ")");
  } else {
    $("#Attachments").text("Add Attachment");
  }
}

function onItemizationTable() {
  //console.log("onItemizationTable");
  Storage.set("ItemizationLinesCommingFrom", "LineDetails");
  onSaveLine(true);
}


function onSaveLineBtn() {
  console.log("onSaveLineBtn");
  onSaveLine(false);
}

function toggleItemization() {
  //console.log("toggleItemization");
  if (validateLine()) {
    Storage.set("nextButtonId", "");
    storeDateFormatted("StartDate", true);
    storeDateFormatted("AccEndDate", true);
    Services.call('iExpense_lineDetailsSet', function () {
      Services.call('iExpense_lineDetailsItemizationToggle', function () {
        var expenseType = Storage.get("expenseType");
        console.log("toggleItemization - loadFieldsByExpenseType");
        loadFieldsByExpenseType(expenseType, function () {
          Spinner.stop();
        });
      }, displayReportServiceError('Failed to toggle line itemization'));
    }, displayReportServiceError('Failed to set line detailes on itemization toggle'));
  }
}

function onToggleItemization() {
  //console.log("onToggleItemization");
  if (Storage.get("ItemizedItem") === "true") {
    Popup.okCancel("Remove Itemization?", "Are you sure you want to remove itemization? Itemized data will be erased.", toggleItemization);
  } else {
    toggleItemization();
  }
}

function ScannedReceiptUpload() {
  //console.log("ScannedReceiptUpload");

  if ($('#ToggleItemization').is(':visible') && $('#ToggleItemization').text() === "Remove Itemization") {
    Popup.ok("Itemized Line", "Please remove itemization before scanning a receipt.");
    return;
  }

  var expenseType = Storage.get("RECEIPTBATCH_EXPENSE_TYPE");
  Fields.setAndStore("expenseType", expenseType);

  console.log("ScannedReceipt - loadFieldsByExpenseType");
  loadFieldsByExpenseType(expenseType, function () {
    Fields.set("DetailReceiptAmount", Storage.get("RECEIPTBATCH_TOTAL_AMOUNT"));
    Fields.set("StartDate", Storage.get("RECEIPTBATCH_RECEIPT_DATE"));
    Fields.set("DetailMerchantName", Storage.get("RECEIPTBATCH_MERCHANT"));
    if (Storage.get("SearchLocationButtonExist") !== "true") {
      Fields.set("LocationName", Storage.get("RECEIPTBATCH_LOCATION"));
    }

    Spinner.start("Adding receipt as an attachment");
    Storage.set("AttachType", "file");
    Storage.set("AttachFilePath", Storage.get("RECEIPTBATCH_path"));

    Services.call("iExpense_AddUpdateAttachment", function () {
      Storage.set("AttachmentType_0", "file");
      configureAttachmentFields();
      showHideAnalyzeBtn();
    }, displayReportServiceError('Failed to add attachment'));
  });
}

/***** TAB: ReciptMatching *****/
function trasactionReciptsMatching() {
  console.log("trasactionReciptsMatching");

  Storage.set("EBS_USER", Storage.get("LoggedInUsername"));
  Storage.set("ReceiptBatch_statuses", "PROCESSED");

  Services.call("ReceiptBatch_get_by_userAndStatuses", matching,function(){console.log("fuck you")});
}


/************************/

function matching() {
  console.log("matching");

  var TRANSACTION_AMOUNT = normalizeAmount(Storage.get("DetailReceiptAmount"));
  var TRANSACTION_RECEIPT_DATE = normalizeDate(Storage.get("TransactionDate"));
  var TRANSACTION_MERCHANT = normalizeMerchant(Storage.get("DetailMerchantNameText"));
  //   var TRANSACTION_LOCATION = normalizeText(Storage.get("LocationName"));

  console.log("Transaction normalization debug:", {
    Transaction: {
      amount: TRANSACTION_AMOUNT,
      date: TRANSACTION_RECEIPT_DATE,
      merchant: TRANSACTION_MERCHANT

    }
  });


  var RECEIPTSBATCH_RECEIPT_ID = Storage.getArray("RECEIPTBATCH_RECEIPT_ID");
  var RECEIPTSBATCH_TOTAL_AMOUNT = Storage.getArray("RECEIPTBATCH_TOTAL_AMOUNT");
  // var RECEIPTSBATCH_EXPENSE_TYPE = Storage.getArray("RECEIPTBATCH_EXPENSE_TYPE");
  var RECEIPTSBATCH_RECEIPT_DATE = Storage.getArray("RECEIPTBATCH_RECEIPT_DATE");
  var RECEIPTSBATCH_MERCHANT = Storage.getArray("RECEIPTBATCH_MERCHANT");
  //   var RECEIPTSBATCH_LOCATION = Storage.getArray("RECEIPTBATCH_LOCATION");

  /**************** Normalize receipt batch arrays *****************/
  for (var i = 0; i < RECEIPTSBATCH_TOTAL_AMOUNT.length; i++) {

    RECEIPTSBATCH_TOTAL_AMOUNT[i] = normalizeAmount(RECEIPTSBATCH_TOTAL_AMOUNT[i]);
  }

  for (var i = 0; i < RECEIPTSBATCH_RECEIPT_DATE.length; i++) {
    RECEIPTSBATCH_RECEIPT_DATE[i] = normalizeDate(RECEIPTSBATCH_RECEIPT_DATE[i]);
  }

  for (var i = 0; i < RECEIPTSBATCH_MERCHANT.length; i++) {
    RECEIPTSBATCH_MERCHANT[i] = normalizeMerchant(RECEIPTSBATCH_MERCHANT[i]);
  }

  //   for (var i = 0; i < RECEIPTSBATCH_LOCATION.length; i++) {
  //     RECEIPTSBATCH_LOCATION[i] = normalizeText(RECEIPTSBATCH_LOCATION[i]);
  //   }

  if (
    RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_TOTAL_AMOUNT.length ||
    // RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_LOCATION.length ||
    RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_RECEIPT_DATE.length ||
    RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_MERCHANT.length
  ) {
    throw "Receipt batch response arrays are not aligned";
  }


  /***************************************************************************/
  for (var rIdx = 0; rIdx < RECEIPTSBATCH_RECEIPT_ID.length; rIdx++) {
    console.log("Transaction normalization debug:", {
      rIdx: {
        rIdx: rIdx,
        amount: RECEIPTSBATCH_TOTAL_AMOUNT[rIdx],
        date: RECEIPTSBATCH_RECEIPT_DATE[rIdx],
        merchant: RECEIPTSBATCH_MERCHANT[rIdx]
        // location: RECEIPTSBATCH_LOCATION[rIdx]
      }
    });

    // if (TRANSACTION_AMOUNT !== null && RECEIPTSBATCH_TOTAL_AMOUNT[rIdx] !== null)
    var amountMatch = TRANSACTION_AMOUNT === RECEIPTSBATCH_TOTAL_AMOUNT[rIdx];
    // else 
    //   var amountMatch = true;

    // if (TRANSACTION_RECEIPT_DATE !== "" && RECEIPTSBATCH_RECEIPT_DATE[rIdx] !== "")
    var dateMatch = TRANSACTION_RECEIPT_DATE === RECEIPTSBATCH_RECEIPT_DATE[rIdx];
    // else  
    //   var dateMatch = true;

    // if (TRANSACTION_MERCHANT !== "" && RECEIPTSBATCH_MERCHANT[rIdx] !== "")
    var merchantMatch = TRANSACTION_MERCHANT === RECEIPTSBATCH_MERCHANT[rIdx];
    // else  
    //   var merchantMatch = true;

    // if (TRANSACTION_LOCATION !== "" && RECEIPTSBATCH_LOCATION[rIdx] !== "")
    //   var locatinMatch = TRANSACTION_LOCATION === RECEIPTSBATCH_LOCATION[rIdx];
    // else
    var locatinMatch = true;


    if (amountMatch && dateMatch && merchantMatch && locatinMatch) {

      /****** actual use*****/

      Storage.set("receipt_ID", RECEIPTSBATCH_RECEIPT_ID[rIdx]);
      Services.call("js_ReceiptBatch_get_receipt_by_id",
        function () {
          Spinner.start("Add a matching receipt as an attachment");
          Storage.set("AttachType", "file");
          Storage.set("AttachFilePath", Storage.get("RECEIPTBATCH_path"));
          Services.call("iExpense_AddUpdateAttachment", function () {
            Storage.set("AttachmentType_0", "file");
            configureAttachmentFields();
            showHideAnalyzeBtn();
          });
        });
      /****** actual use*****/
      break;
    }
  }
}

/*************************/

function normalizeText(txt) {
  if (txt === null || txt === undefined) {
    return "";
  }

  if (Array.isArray(txt)) {
    if (txt.length === 0) {
      return "";
    }
    txt = txt.join(" ");
  }

  return String(txt)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeAmount(val) {
  if (val === null || val === undefined) {
    return null;
  }

  var s = String(val).trim();
  if (s === "") {
    return null;
  }

  s = s.replace(/,/g, "");
  var match = s.match(/-?\d+(\.\d+)?/);
  if (!match) {
    return null;
  }

  var num = Number(match[0]);
  return isNaN(num) ? null : num;
}

function normalizeMerchant(txt) {
  return normalizeText(txt).replace(/[^a-z0-9]/g, "");
}

function normalizeDate(val) {
  if (val === null || val === undefined) {
    return "";
  }

  var s = String(val).trim();
  if (s === "") {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  var m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    var day = m[1].padStart(2, "0");
    var mon = m[2].toUpperCase();
    var year = m[3];

    var months = {
      JAN: "01", FEB: "02", MAR: "03", APR: "04",
      MAY: "05", JUN: "06", JUL: "07", AUG: "08",
      SEP: "09", OCT: "10", NOV: "11", DEC: "12"
    };

    if (months[mon]) {
      return year + "-" + months[mon] + "-" + day;
    }
  }

  return s;
}

/*****************************************/

