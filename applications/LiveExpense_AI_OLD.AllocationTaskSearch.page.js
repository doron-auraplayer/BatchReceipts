Events.tablePopulated = function(){
    // checkEmptyFirstRow();
    setTimeout(function() {
        $("#tableOutput_filter").hide();
        $("#tableOutput_length").hide();
        $("#tableOutput_info").hide();
        $("#tableOutput_paginate").hide();
    }, 0);
}

function prepare_iExpense_AllocationGetSearchCategorries_lov_request() {
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
    Services.call("iExpense_AllocationGetSearchTasks", function() {
        // // in EBS 12.1.3 the table has 2 columns project number, project Namespace
        // // in EBS 12.2.7 the table has instead one column project details instead
        // if (Storage.get("ProjectDetails_0") !== "") {
        //     $('#tableOutput').DataTable().column(0).visible(false);
        //     $('#tableOutput').DataTable().column(1).visible(false);
        // } else {
        //     $('#tableOutput').DataTable().column(2).visible(false);
        // }
        Storage.clear("TaskOnlyGet");

    }, displayReportServiceError('Failed to search projects'));
}

function returnToCallingPage() {
    Storage.set("ReturnFromSearch", "TaskSearchName");
    Page.navigate(Storage.get("SearchCallingPage"));
}

function OnCancel() {
    Services.call("iExpense_closeAllocationSearchWindow", function() {
        returnToCallingPage();
    } ,displayReportServiceError('Failed to close search window'))
}

function onLoad() {
    Fields.clearAll();
    Table.clear();
    Lov.clearSuggestions("iExpense_AllocationGetSearchCategorries");

    populateField("ListSearchBy", Storage.get("SearchCategoryChoice"));
    
    if (Storage.get("TaskOnlyGet") =="true") {
        onSearch();
    }

}

function onTableClick(row, col, rowCells) {
	Storage.copyFromIndex("TaskNumber", row);
	Storage.copyFromIndex("TaskName", row);
	Storage.set("SelectSearchIndex", row);
    Services.call("lExpense_SelectValueSearchWindow", function() {
        Storage.set("AllocationTaskDetails_" + Storage.get("AllocationRowIndex"), Storage.get("TaskNumber") + " " + Storage.get("TaskName"));
        returnToCallingPage();
    } ,displayReportServiceError('Failed to close search window'))

}


