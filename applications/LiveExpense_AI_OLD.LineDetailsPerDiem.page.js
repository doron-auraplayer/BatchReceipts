function next_onSuccess() {
    Storage.set("BackFromPerDiem", "true");
    Page.navigate('Cash_Lines.html');
}

function save_onSuccess() {
    var index = Storage.get('index');
    Storage.set("index", parseInt(index) + 1);
    Storage.set("BackFromPerDiem", "true");
    Storage.remove("LineDetailsUpdate");
    onLoad();
}

function saveNewLine(onSuccessFunction) {
    storeDateFormatted("StartDate");
	Services.call('iExpense_lineDetailsPerDiemSet', function() {
        if (Storage.get("CashLineErrorMessageExists") === "true") {
            Popup.ok(getTranslationForId("@popup_title_error"), Storage.get("CashLineErrorMessage"));
        } else {
    	    onSuccessFunction(); 
        }
	}, displayReportServiceError("Failed to save expense line", "Update_Reports.html"));
}

function initPage() {
	showFieldsByExpenseType();
	setAndStoreDateField("StartDate");
    $('#Calculate').parent().insertBefore($("#DetailReimbursAmt_container").parent());
    Fields.set("LineNumber", parseInt(Storage.get("index"))+1);
    if (Storage.get("LocationNameExist") === "true") {
        // handle search location button
        $('#Location_Search_Per_Diem').text('');
        $('#Location_Search_Per_Diem').show();
        $("#Location_Search_Per_Diem").append('<i class="fa fa-search" aria-hidden="true"></i>');
        $('#Location_Search_Per_Diem').insertAfter("#LocationName_container");
        if (Storage.get("LocationFieldEditable") === "false") {
            $('#LocationName').prop("disabled", true);
        } else {
            $('#LocationName').prop("disabled", false);
            $('#LocationName').off();
            $('#LocationName').change(onLocationChange);
        }
    } else {
        $('#Location_Search_Per_Diem').hide();
    }
}

function onLocationChange() { /*Page: LineDetails*/
    
	Storage.clear("LocationResolvedValue");
	storeDateFormatted("StartDate");
    Services.call("iExpense_locationEnterName", function() {
        if (Storage.get("searchWindowOpen") === "true") {
            Storage.set("LocationSearchFrom", "PerDeimExpense");
            Storage.set("LocationOnlyGet","true");
            Page.navigate("LocationSearch.html");
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

function onLoad() {
    // $("#LineNumber").prop("style", "display: inline-block; width: 35px; height: 20px; position: relative; left: 12px; margin-top: -18px; line-height: 0.5;");
    // $("#LineNumber_container > label").attr("style", "display: inline-block");
    $("#Calculate").text("");
    // $("#Calculate").append('<i class="fa fa-calculator" aria-hidden="true"></i>');

    if (Storage.get("fromSelectLocation") == "true") {
        // return from search window or from calulate button
        Storage.remove("fromSelectLocation");
        var selectedLocation = Storage.get("PopupLocationName");
        if (selectedLocation !== "") {
            populateField("LocationName", selectedLocation);
        }
        initPage();

    }
    else if (Storage.get("LineDetailsUpdate") == "true") { 
        // Update report
        setTimeout(function() {
            $('#Add_Line').hide();
        }, 0);

    	Services.call('iExpense_lineDetailsPerDiemGet', function() {
            initPage();
    	}, displayReportServiceError("Failed to get per diem expense line"));
    } else {
        
        // Clean old field values
        iExpenseLineFields.forEach(function(fieldName) {
            Storage.remove(fieldName);
            Storage.remove(fieldName+'Exist');
        });

    	Services.call('iExpense_lineDetailsPerDiemGet', function() {
            initPage();

    	}, displayReportServiceError("Failed to get per diem expense line"));

    }


}

function onCalculateClick() {
    Storage.set("onlyCalculate", "true");
    saveNewLine(onLoad);
}

function onSaveLine() {
    Storage.set("nextButtonId", "DetailNewLine");
    Storage.set("onlyCalculate", "false");
    saveNewLine(save_onSuccess);
}

function isDirty() {
    return Fields.get("StartDate") !== ""  || Fields.get("NumDays") !== '' || Fields.get("Justification") !== '';
}


function OnCancel() {
   OnCancelPopup(function() {
        // Page.navigate("Report_General.html");
        Services.call("iExpense_lineDetailsPerDiemCancel", function() {
            Storage.set("BackFromPerDiem", "true");
            Page.navigate("Cash_Lines.html");
        }, displayReportServiceError('Failed to cancel line'));
   });
}

function onReturn() {
    Storage.set("nextButtonId", "DetailApply");
    Storage.set("onlyCalculate", "false");
    saveNewLine(next_onSuccess);
}

function onLocationSearch() {
    Spinner.start();
    Storage.set("LocationSearchFrom", "PerDeimExpense");
    Storage.set("ExpensesSearchLocationSelector", getEnvConfiguration().ExpensesSearchLocPDSelector);
    Services.call("iExpense_LocationSearchOpen", function() {
        Page.navigate("LocationSearch.html");
        Spinner.stop();
    }, displayReportServiceError('Failed to open location search window'));
}


function prepare_iExpense_getPerDiemExpenseTypes_lov_request() {
    var inputParams = {};

    return inputParams;
}
function expenseType_lov_item_presenter(arrayItem) {
    var lovItems = [];
    lovItems.push(arrayItem["PerDiemExpenseTypes"]);

    return lovItems.join(",");
}
function expenseType_lov_item_handler(arrayItem) {
    Fields.setAndStore("PerDiemExpenseTypes", arrayItem["PerDiemExpenseTypes"]);
    try {
    	populateField("expenseType", arrayItem[Object.keys(arrayItem)[0]].split(",")[0]);
    } catch (err) {}
}