function LocationSearchBy_lov_item_handler(arrayItem) {
    Fields.setAndStore("LocationCategory", arrayItem["LocationCategory"]);
    try {
    	populateField("LocationSearchBy", arrayItem[Object.keys(arrayItem)[0]].split(",")[0]);
    } catch (err) {}
}            
function onSearch() {
    var openingPage = Storage.get("LocationSearchFrom");
    if (openingPage == "PerDeimExpense") {
        Services.call("iExpense_LocationSearchPerDiemGet", function() {
            Storage.clear("LocationOnlyGet");
        }, displayReportServiceError('Failed to search locations'));
    } else {
        Services.call("iExpense_LocationSearchGet", function() {
            Storage.clear("LocationOnlyGet");
        }, displayReportServiceError('Failed to search locations'));
    }
}

function OnCancel() {
    returnToLineDetails();
}

function OnLoad() {
    Fields.clearAll();
    Table.clear();

    Storage.deleteByPrefix("PopupLocation");
    Storage.remove("PopupLocationName");
    var openingPage = Storage.get("LocationSearchFrom");
    if (openingPage == "PerDeimExpense") { 
        populateField("LocationSearchBy", "Location Name");
    } else {
        populateField("LocationSearchBy", "Location");
    }
    
    if (Storage.get("LocationSearchAlreadyOpened") === "true" ) {
        Storage.clear("LocationSearchAlreadyOpened");
        onSearch();
    }
}

function OnSelectLocation(row, col, rowCells) {
	Storage.copyFromIndex("PopupLocationName", row);
    returnToLineDetails();
}

function returnToLineDetails() {
    Services.callSync("iExpense_LocationSearchClose", displayReportServiceError('Failed to close location search window'))
    Storage.set("fromSelectLocation", "true");
    var openingPage = Storage.get("LocationSearchFrom");
    if (openingPage == "PerDeimExpense") {
        Page.navigate("LineDetailsPerDiem.html");
    } else {
        Page.navigate("LineDetails.html");
    }
}

function prepare_iExpense_LocationSearchCategories_lov_request() {
    var inputParams = {};

    return inputParams;
}
function LocationSearchBy_lov_item_presenter(arrayItem) {
    var lovItems = [];
    lovItems.push(arrayItem["LocationCategory"]);

    return lovItems.join(",");
}