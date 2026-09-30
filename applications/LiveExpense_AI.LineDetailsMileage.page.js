function next_onSuccess() {
    Storage.set("BackFromMileage", "true");
    Page.navigate('Cash_Lines.html');
}

function save_onSuccess() {
    var index = Storage.get('index');
    Storage.set("index", parseInt(index) + 1);
    Storage.set("BackFromMileage", "true");
    Storage.remove("LineDetailsUpdate");
    onLoad();
}

function onLoad() {
    
    // $("#LineNumber").prop("style", "display: inline-block; width: 35px; height: 20px; position: relative; left: 12px; margin-top: -18px; line-height: 0.5;");
    // $("#LineNumber_container > label").attr("style", "display: inline-block");
    $("#Calculate").text("");
    // $("#Calculate").append('<i class="fa fa-calculator" aria-hidden="true"></i>');

    if (Storage.get("LineDetailsUpdate") !== "true") { 
        // new report
        clearForm();
    
    }

    // Clean old field values
    iExpenseLineFields.forEach(function(fieldName) {
        Storage.remove(fieldName);
        Storage.remove(fieldName+'Exist');
    });

    if (Storage.get("LineDetailsUpdate") == "true") {
        setTimeout(function() {
            $('#Add_Line').hide();
        }, 0);
    }

	Services.call('iExpense_lineDetailsMileageGet', function() {
    	showFieldsByExpenseType();
    	Fields.setFromStorage();
        $('#Calculate').parent().insertBefore($("#DistanceRate_container").parent());
        Fields.set("LineNumber", Storage.get("LineTitle").match(/.(\d+)/)[1] );
        
        setAndStoreDateField("StartDate", true);
	}, displayReportServiceError("Failed to get mileage expense line"));

}

function isDirty() {
    return Fields.get("StartDate") !== ""  || Fields.get("TripDistance") !== "" || Fields.get("Justification") !== "";
}

function OnCancel() {
   OnCancelPopup(function() {
        // Page.navigate("Report_General.html");
        Services.call("iExpense_lineDetailsMileageCancel", function() {
            Storage.set("BackFromMileage", "true");
            Page.navigate("Cash_Lines.html");
        }, displayReportServiceError('Failed to cancel line'));
   });
}


function DistancePopList_lov_item_handler(item, label) {
	populateFieldHTML("DistancePopList", label !== undefined ? label : item);
	store("DistancePopList", item);
}

function onCalculateClick() {
    storeDateFormatted("StartDate", true);
	Services.call("iExpense_CashLinesCalculateMileage", function() {
	    if (Storage.get("MileageErrorExist") === 'true') {
	        Popup.ok("Error", Storage.get("MileageError"));
	    }
	}, displayReportServiceError('Failed to calculate report'));
}


//function VehicleCategory_lov_item_handler(item, label) {
//	populateFieldHTML("VehicleCategory", label !== undefined ? label : item);
//	store("VehicleCategory", item);
//}
function VehicleCategory_lov_item_handler(arrayItem) {
    Fields.setAndStore("VehicleCategory", arrayItem["VehicleCategory"]);
}

function VehicleType_lov_item_handler(arrayItem) {
    Fields.setAndStore("VehicleType", arrayItem["VehicleType"]);
}

function prepare_iExpense_getVehicleTypes_lov_request() {
    var inputParams = JSON.parse(Storage.get("iExpenseConfig"));
    inputParams['usernameField'] = Fields.get("usernameField");
    inputParams['passwordField'] = Fields.get("passwordField");

    return inputParams;
}

function VehicleType_lov_item_presenter(arrayItem) {
    var lovItems = [];
    lovItems.push(arrayItem["VehicleType"]);

    return lovItems.join(",");
}

function onSaveLine() {
    Storage.set("nextButtonId", "DetailNewLine");
    storeDateFormatted("StartDate", true);
	Services.call('iExpense_lineDetailsMileageSet', function() {
        if (Storage.get("MileageLineErrorMessageExists") === "true") {
            Popup.ok(getTranslationForId("@popup_title_error"), Storage.get("MileageLineErrorMessage"));
        } else {
    	    save_onSuccess();
        }
	}, displayReportServiceError("Failed to save expense line", "Update_Reports.html"));
}

function onReturn() {
    Storage.set("nextButtonId", "DetailApply");
    storeDateFormatted("StartDate", true);
	Services.call('iExpense_lineDetailsMileageSet', function() {
        if (Storage.get("MileageLineErrorMessageExists") === "true") {
            Popup.ok(getTranslationForId("@popup_title_error"), Storage.get("MileageLineErrorMessage"));
        } else {
    	    next_onSuccess();
        }
	}, displayReportServiceError("Failed to save Mileage line", "Update_Reports.html"));
}

function prepare_iExpense_getVehicleCategories_lov_request() {
    var inputParams = {};

    return inputParams;
}
function VehicleCategory_lov_item_presenter(arrayItem) {
    var lovItems = [];
    lovItems.push(arrayItem["VehicleCategory"]);

    return lovItems.join(",");
}