function prepare_iExpense_GetApproverCategories_lov_request() {
    var inputParams = {};

    return inputParams;
}
function ListSearchBy_lov_item_presenter(arrayItem) {
    var lovItems = [];
    lovItems.push(arrayItem["SearchCategories"]);

    return lovItems.join(",");
}
function ListSearchBy_lov_item_handler(arrayItem) {
    Fields.setAndStore("SearchCategories", arrayItem["SearchCategories"]);
    try {
    	populateField("ListSearchBy", arrayItem[Object.keys(arrayItem)[0]].split(",")[0]);
    } catch (err) {}
}
function onSearch() {
    Services.call("iExpense_GetSearchApprovers", function() {}, displayReportServiceError('Failed to search approvers'));
}

function returnToCreateExpensePage() {
    Storage.set("ReturnFromSearch", "ApproverSearchName");
    Page.navigate("Report_General.html");
}

function OnCancel() {
    Services.call("iExpense_closeAllocationSearchWindow", function() {
        returnToCreateExpensePage();
    } ,displayReportServiceError('Failed to close search window'))
}

function onLoad() {
    Fields.clearAll();
    Table.clear();

    populateField("ListSearchBy", "Full Name");
}

function onTableClick(row, col, rowCells) {
	Storage.copyFromIndex("ApproverName", row);
    Services.call("iExpense_CloseApproverSearchWindow", function() {
        Storage.set("OverridingApprover", Storage.get("ApproverName"));
        returnToCreateExpensePage();
    } ,displayReportServiceError('Failed to close search window'))

}


