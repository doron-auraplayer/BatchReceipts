function onLoad() {
    $("#SearchProject").attr("style", "min-height: 15px;min-width: 30px!important;max-width: 30px;line-height: 0;padding: 5px; margin-left: 5px");
    $("#ProjectSearchName").attr("style", "display: inline-block;max-width: 80%;");
    $("#ProjectSearchName").parent().append($("#SearchProject"));
    $("#SearchTask").attr("style", "min-height: 15px;min-width: 30px!important;max-width:30px;line-height: 0;padding: 5px; margin-left: 5px");
    $("#TaskSearchName").attr("style", "display: inline-block;max-width: 80%;");
    $("#TaskSearchName").parent().append($("#SearchTask"));
    $("#ProjectSearchName").change(onProjectChange);
    $("#TaskSearchName").change(onTaskChange);
    
    if (Storage.get("ProjectTaskFieldEditable") == "false") {
        $("#ProjectSearchName").attr("disabled", "true");
        $("#TaskSearchName").attr("disabled", "true");
    } else {
        $("#ProjectSearchName").removeAttr("disabled");
        $("#TaskSearchName").removeAttr("disabled");
    }
    
    if (Storage.get("ReturnFromSearch") === "ProjectSearchName") {
        Storage.remove("ReturnFromSearch");
        Fields.setAndStore("ProjectSearchName", Storage.get("AllocationProjectDetails_all"));
        Fields.clear("TaskSearchName");
    } else if (Storage.get("ReturnFromSearch") === "TaskSearchName") {
        Storage.remove("ReturnFromSearch");
        Fields.setAndStore("TaskSearchName", Storage.get("AllocationTaskDetails_all"));
    } else {
        Fields.clear("ProjectSearchName");
        Storage.remove("ProjectSearchName");
        Fields.clear("TaskSearchName");
        Storage.remove("TaskSearchName");
        var selectionArr = Storage.getArray("ResourceSelect");
        var allSelected = (selectionArr[0] === 'true' || selectionArr.toString().indexOf('true') === -1);
        var resourceSelectedLines = [];
        var selectionList = "";
        for (var i=0; i < selectionArr.length; i++) {
            if (allSelected || selectionArr[i] === "true") {
                selectionList += i + ",";
            }
        }
        Storage.set("ResouceIndexList", selectionList.substr(0,selectionList.length-1));
        Services.call("iExpense_updateGroupAllocationsJS", function() {
        }, displayReportServiceError('Failed to open allocation group window'));
    }
}


function onSearchProject() {
    Storage.set("AllocationRowIndex", "all");
    Spinner.start();
    Storage.set("AllocationSearchButtonId", "ProjectNumber");
    Services.call("iExpense_openAllocationSearchWindow", function() {
        Storage.set("SearchCallingPage", "ExpenseGroupAllocations.html");
        Page.navigate("AllocationProjectSearch.html");
        Spinner.stop();
    }, displayReportServiceError('Failed to open project search window'));

}

function onSearchTask() {
    if (Fields.get("ProjectSearchName").length === 0) {
        Popup.ok("Validation Error", "You must select a project before selecting a task");
        return;
    }
    Storage.set("AllocationRowIndex", "all");
    Spinner.start();
    Storage.set("AllocationSearchButtonId", "TaskNumber");
    Services.call("iExpense_openAllocationSearchWindow", function() {
        Storage.set("SearchCallingPage", "ExpenseGroupAllocations.html");
        Page.navigate("AllocationTaskSearch.html");
        Spinner.stop();
    }, displayReportServiceError('Failed to open project search window'));
    
}

function OnCancel() {
    Storage.set("GroupUpdateAllocationCloseButtonId", "Cancel");
    Services.call("iExpense_closeAllocationUpdateWindow", function() {
        Storage.set("ReturnFromSearch", "true");
        Page.navigate("ExpenseAllocations.html");
    }, displayReportServiceError('Failed to close allocation group window'));
}


function onUpdate() {
    if (Fields.get("ProjectSearchName").length === 0 || Fields.get("TaskSearchName").length === 0) {
        Popup.ok("Validation Error", "You must select project and task");
    } else {
        Storage.set("GroupUpdateAllocationCloseButtonId", "Apply");
        Services.call("iExpense_closeAllocationUpdateWindow", function() {
            Page.navigate("ExpenseAllocations.html");
        }, displayReportServiceError('Failed to close allocation group window'));
    }
}

function onProjectChange() {
    
    var index = Storage.get("AllocationRowIndex");
	Storage.set("AllocationNumberField", "SplitCriteriaTblRN:ProjectNumber:0");
	Storage.set("AllocationNameField", "SplitCriteriaTblRN:ProjectName:0");
	Storage.set("AllocationValue", Fields.get("ProjectSearchName"));
	Storage.set("AllocationCategory", "Project Number");
    Services.call('iExpense_AllocationEnterValue', function(){
        if (Storage.get("searchWindowOpen") === "true") {
            Storage.set("SearchCallingPage", "ExpenseGroupAllocations.html");
            Storage.set("ProjectOnlyGet","true");
            Page.navigate("AllocationProjectSearch.html");
        } else {
            Fields.setAndStore("ProjectSearchName", Fields.get("ProjectSearchName") + " " + Fields.get("AllocationResolvedName"));
        }
    }, displayReportServiceError('Failed to resolve project'));


}

function onTaskChange() {
	Storage.set("AllocationNumberField", "SplitCriteriaTblRN:TaskNumber:0");
	Storage.set("AllocationNameField", "SplitCriteriaTblRN:TaskName:0");
	Storage.set("AllocationValue", Fields.get("TaskSearchName"));
	Storage.set("AllocationCategory", "Task Number");
    Services.call('iExpense_AllocationEnterValue', function() {
        if (Storage.get("searchWindowOpen") === "true") {
            Storage.set("SearchCallingPage", "ExpenseGroupAllocations.html");
            Storage.set("TaskOnlyGet","true");
            Page.navigate("AllocationTaskSearch.html");
        } else {
            Fields.setAndStore("TaskSearchName", Fields.get("TaskSearchName") + " " + Fields.get("AllocationResolvedName"));
        }
    }, displayReportServiceError('Failed to resolve task'));
}
