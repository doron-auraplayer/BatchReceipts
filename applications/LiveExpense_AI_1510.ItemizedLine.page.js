function clearFields() {
    Fields.clear("ItemizedAttedeeNames");
    Fields.clear("ItemizedGuestNames");
    return;
}

function saveCalculatedFields() {
    Storage.set("ItemizedAmountSave", Fields.get("ItemizedAmount"));
}

function restoreCalculatedFields() {
    Fields.set("ItemizedAmount", Storage.get("ItemizedAmountSave"));
}


function calcAmountscOther(source) {
    var amount = getFloatValue(Fields.get("ItemizedAmount"));
    var dailyRate = getFloatValue(Fields.get("ItemizedDailyRate"));
    var numDays = parseInt(Fields.get("ItemizedNumDays"));
    var ItemTotalReceiptAmount = getFloatValue(Storage.get("ItemizedOrigAmount"));
    var origBussinessExpenses = getFloatValue(Storage.get("OrigItemizedBussinessExpenses"));
    var origAmount = getFloatValue(Storage.get("OrigItemizedAmount"));

    var dailyRateExist = $("#ItemizedDailyRate").is(":visible");

    // I reduce the amount as it is already included in the bussinessExpenses and I want is out of the calculation 
    // as I am going to recalculate
    var currBussinessExpenses = origBussinessExpenses - origAmount;
    
    // Rules: 
    // Initial state all fields are empty. 
    //      - If setting dailyRate and numDays then amount will be rate*days
    //      - If setting amount and numDays then rate will be amount/days
    // Update mode:
    //       Update amount -> update daily rate if exist (rate = amount/days)
    //       Update num days -> update daily rate if exist (amount/Days)
    //       Update daily rate -> update daily rate if exist (rate = amount/days)
    if (source === "ItemizedAmount") {
        if (dailyRateExist && Fields.get("ItemizedNumDays").length > 0) {
           dailyRate = amount/numDays; 
        }
    } else if (source === "ItemizedNumDays" ) {
        // if (Fields.get("ItemizedAmount").length > 0 && Fields.get("ItemizedDailyRate").length === 0) {
            dailyRate = amount/numDays; 
        // } else if (Fields.get("ItemizedDailyRate").length > 0) {
            // amount = numDays*dailyRate; 
        // }
    } else if (source === "ItemizedDailyRate" && Fields.get("ItemizedNumDays").length > 0) {
        amount = numDays*dailyRate; 
    } 
    
    Fields.set("ItemizedAmount",amount.toFixed(2));
    if (dailyRateExist) {
        Fields.set("ItemizedDailyRate",dailyRate.toFixed(2));
    }

    var newBussinessExpenses = currBussinessExpenses+amount;
    var personalExpenses = ItemTotalReceiptAmount-newBussinessExpenses;
    Fields.set("ItemizedBussinessExpenses", newBussinessExpenses.toFixed(2));
    Fields.set("ItemizedPersonalExpenses",personalExpenses.toFixed(2) );
    if (personalExpenses < 0 ) {
        Popup.ok("Error", "Item amount exceeds total receipt amount");
    }

    // formatNumricFields();

}

function calcAmount(source) {
    calcAmountscOther(source);
}


function validateAmounts()  {
    var status = true;
    if (getFloatValue(Fields.get("ItemizedAmount")) <= 0) {
        Popup.ok("Error", "Itemized itam amount must be more than 0");
        return false;
    }
    
    if (getFloatValue(Fields.get("ItemizedPersonalExpenses")) < 0) {
        Popup.ok("Error", "Item amount exceeds total receipt amount");
        return false;
    }
    
    return status;
}

function onChangeAmount(evt) {
    calcAmount(evt.target.id);
}

function showHideFields() {
    
    showFieldsByExpenseType();

    $('#Attendees').hide();
    $('#Guests').hide();
    Fields.hide('ItemizedAttendeeNames','ItemizedGuestNames');

    if (Storage.get("ItemizedEmpTableExist") === "true") {
        Fields.show('ItemizedAttendeeNames','ItemizedGuestNames');
        $('#Attendees').insertAfter("#ItemizedAttendeeNames_container");
        $('#Attendees').show();

        $('#Guests').insertAfter("#ItemizedGuestNames_container");
        $('#Guests').show();
    }

    
    calcAmount();
}


function getEmpGuestData() {
    Storage.set("ItemizedItem", "true");
    Services.callSync("iExpense_attendeesEmpTableGetJS", displayReportServiceError('Failed to get attendees list'));
    populateField("ItemizedAttendeeNames", Storage.getArray("AttendiesEmpTableEmpName").join(",") );
    
    Services.callSync("iExpense_attendeesGuestTableGetJS", displayReportServiceError('Failed to get guests list'));
    populateField("ItemizedGuestNames", Storage.getArray("AttendiesGuestTableName").join(","));
    Storage.clear("ItemizedItem");
}

function onLoad() {
    $("#ItemizedOrigAmount_container").parent().addClass("Itemization-total-container");


    $("#ItemizedAmount").change(onChangeAmount);
    $("#ItemizedDailyRate").change(onChangeAmount);
    $("#ItemizedNumDays").change(onChangeAmount);


    if (Storage.get("fromSelectEmployees") === "true" || Storage.get("fromSelectGuest") === "true") {
        Storage.clear("fromSelectEmployees");
        Storage.clear("fromSelectGuest");
        Storage.clear("CommingFrom");
        getEmpGuestData();

        showHideFields();
        // restoreCalculatedFields();
    } else {
        Storage.set("ItemizedLineIndex", parseInt(Storage.get("ItemizedLineNum"))-1);
        Services.call('iExpense_lineItemizedGet', function() {
            setAndStoreDateField("ItemizedStartDate");
            Storage.set("OrigItemizedAmount", Storage.get("ItemizedAmount"));
            Storage.set("OrigItemizedBussinessExpenses", Storage.get("ItemizedBussinessExpenses"));
            var linesCount = parseInt(Storage.count("ItemizationLineAmount"));
            var currLine = parseInt(Fields.get("ItemizedLineNum"));
            // if(Storage.get("ItemizedMode") === "edit") {
            if(currLine < linesCount) {
                $("#Add_Line").hide();
            } else {
                $("#Add_Line").show();
            }

            if (Storage.get("ItemizedItemAddFlag") == "true") {
                Storage.clear("ItemizedItemAddFlag");
                // Storage.clear("Tax");
                // Fields.clear("Tax");
                Fields.clear("ItemizedExpenseType");
            }
            
            if (getFloatValue(Fields.get("ItemizedAmount")) === 0) {
                Fields.set("ItemizedAmount","");
            }
            // if (getFloatValue(Fields.get("ItemizedDailyRate")) === 0) {
            //     Fields.set("ItemizedDailyRate","");
            // }
            // if (Fields.get("ItemizedDailyRate").length === 0 && Fields.get("ItemizedAmount").length === 0) {
            //     Fields.set("ItemizedNumDays","");
            // }

            showHideFields();
            if (Fields.get("ItemizedAmount").length > 0 && parseInt(Fields.get("ItemizedAmount")) === 0) {
                Fields.clear("ItemizedAmount");
            }
            
    	    if (Storage.get("ItemizedEmpTableExist") == "true") {
    	        getEmpGuestData();
    	    }

            if (Storage.get("ItemizedStartDate").length === 0) {
                Fields.set("ItemizedStartDate", Storage.get("StartDate"));
            }

            Spinner.stop()

            // reloadVATLOV();
        }, displayReportServiceError("Failed to fetch itemized line"));
    }

}


//function ItemizedExpenseType_lov_item_handler(item, label) {
//	populateFieldHTML("ItemizedExpenseType", label !== undefined ? label : item);
//	store("ItemizedExpenseType", item);
//    Storage.set("ItemizedItemAddFlag", "false");
//    // setDefaultEmpName();
//    Services.call('iExpense_lineItemizedOpenLine', function() {
//        Services.call('iExpense_lineItemizedGet', function() {
//            showHideFields();
//            calcAmount();
//        }, displayReportServiceError("Failed to get new itemized line"));
//    }, displayReportServiceError("Failed to add new itemized line"));
//}
function ItemizedExpenseType_lov_item_handler(arrayItem) {
    Fields.setAndStore("ItemizedItemType", arrayItem["ItemizedItemType"]);
    try {
    	populateField("ItemizedExpenseType", arrayItem[Object.keys(arrayItem)[0]].split(",")[0]);
        Storage.set("ItemizedItemAddFlag", "false");
        // setDefaultEmpName();
        storeDateFormatted("StartDate", true);
        Services.call('iExpense_lineItemizedOpenLine', function() {
            Services.call('iExpense_lineItemizedGet', function() {
                clearFields();
                showHideFields();
                calcAmount();
            }, displayReportServiceError("Failed to get new itemized line"));
        }, displayReportServiceError("Failed to add new itemized line"));
    } catch (err) {}
}            

function onCancel() {
    Storage.set("BackFromItemizedLine","true");
    if(Storage.get("ItemizedMode") === "add") {
        Storage.set("ItemizedLineNum", Storage.get("ItemizedLineIndex"));
        Services.call('iExpense_lineItemizedDelete', function() {
            Page.navigate("ItemizationLines");
        }, displayReportServiceError("Failed to remove new itemized item"));
    } else {
        Page.navigate("ItemizationLines");
    }
}


function openNewLine(currLine) {
    Fields.setAndStore("ItemizedLineNum", currLine+1);
    Storage.set("ItemizedMode","add");
    Storage.set("ItemizedItemAddFlag", "true");
    storeDateFormatted("StartDate", true);
    Services.callSync('iExpense_lineItemizedOpenLine', displayReportServiceError("Failed to add new itemized line"));
    onLoad();
    Fields.clear("ItemizedExpenseType");
}

function validateSetLineErrorMessage() {
    var status = true;
    
    if (Storage.get("ItemizedLineWarningMessageExists").toLowerCase() === "true") {
        Popup.ok("", Storage.get("ItemizedLineWarningMessage"));
        return false;
    }
    
    return true;
}


function onAddLine() {
    if (!validateAmounts()) {
        return;
    }

    if (getFloatValue(Fields.get("ItemizedPersonalExpenses")) === 0) {
        Popup.ok("Error", "Total receipt is fully used by existing itemized items, cannot add more items");
        return;
    }

    storeDateFormatted("ItemizedStartDate");
    Services.call('iExpense_lineItemizedSet', function() {
        if (validateSetLineErrorMessage()) {
            var currLine = parseInt(Storage.get("ItemizedLineNum"));
            openNewLine(currLine);
        }
    }, displayReportServiceError("Failed to add itemized line"));
}

function onDone() {
    if (!validateAmounts()) {
        return;
    }
    
    storeDateFormatted("ItemizedStartDate");
    Services.call('iExpense_lineItemizedSet', function() {
        if (validateSetLineErrorMessage()) {
            Storage.set("BackFromItemizedLine","true");
            Page.navigate("ItemizationLines");
        }
    }, displayReportServiceError("Failed to add itemized line"));
}

function onAttendees() {
    Storage.set("AttendiesCommingFrom", "ItemizedLine");
    saveCalculatedFields();
    Page.navigate("Attendees.html");
}

function onGuests() {
    Storage.set("GuestsCommingFrom", "ItemizedLine");
    saveCalculatedFields();
    Page.navigate("Guests.html");
}


 function onClickAttendees() {
    Storage.set("AttendiesCommingFrom", "ItemizedLine");
    saveCalculatedFields();
    Page.navigate("Attendees.html");
}

function onClickGuests() {
    Storage.set("GuestsCommingFrom", "ItemizedLine");
    saveCalculatedFields();
    Page.navigate("Guests.html");
}

function prepare_iExpense_getItemizedExpenseTypes_lov_request() {
    var inputParams = {};

    return inputParams;
}
function ItemizedExpenseType_lov_item_presenter(arrayItem) {
    var lovItems = [];
    //if (app.itemizedItemExpenseTypes.toLowerCase().indexOf(arrayItem["ItemizedItemType"].toLowerCase()) > -1 ) {
        lovItems.push(arrayItem["ItemizedItemType"]);
    //}

    return lovItems.join(",");
}
function ItemizedExpenseType_lov_item_presenter(arrayItem) {
    var lovItems = [];
    lovItems.push(arrayItem["ItemizedItemType"]);

    return lovItems.join(",");
}