var PAYMENT_METHOD_COL_IND = 3;
var RIEMB_AMOUNT_COL_IND = 7;
var PROJECT_COL_IND = 11;
var TASK_COL_IND = 12;

function configureUpdateButtons() {
    if (Storage.getArray("ResourceSelect").toString().indexOf("true") > -1) {
        $("#Allocations").removeAttr("disabled");
    } else {
        $("#Allocations").attr("disabled", true);
    }
}

function formatFirstTotalRow() {
    $("tr[id='tablerow_0'] td:nth-child(1)").click(function(event) {event.stopPropagation()});
    // $("tr[id='tablerow_0'] td:nth-child(1)").text("All");
    $("tr[id='tablerow_0'] td:nth-child(1)").addClass('no-before');
    $("tr[id='tablerow_0'] td:nth-child(1)").attr('style', "background-color: darkgrey");
    var totalAmount = $("tr[id='tablerow_0'] td:nth-child(" + RIEMB_AMOUNT_COL_IND + ")").text();
    $("tr[id='tablerow_0'] td:nth-child(" + RIEMB_AMOUNT_COL_IND + ")").text("");
    $("tr[id='tablerow_0'] td:nth-child(3)").text(totalAmount);
    $("tr[id='tablerow_0'] td:nth-child(3)").attr('style', "background-color: darkgrey");
}

function onLoad() {
    $($("#Allocations").parent()).insertAfter($("#Back").parent().parent());
    $(".ap-page-expenseallocations button").attr("style","min-width: 60px");
    $("#Allocations").parent().attr("style", "max-width: 50%;");
    $("#Allocations").attr("style", "min-width:150px");
    var returnFromSearch  = Storage.get("ReturnFromSearch");
    if (returnFromSearch && returnFromSearch !== "") {
        Storage.remove("ReturnFromSearch");
        // formatFirstTotalRow();
        Table.populate(document.getElementById("tableOutputBody"));
    } else {
        var CODE_TEXT = "Search and Select: ";
    	Services.call("iExpense_getExpenseAllocations", function() {
            // formatFirstTotalRow();
            
            for (var i=1; i<Storage.count("AllocationReimAmount") ; i++) {
    	        var code = Storage.get("AllocationProjectDetails_" + i).replace("\n", "");
    	        if (code !== "") code = code === CODE_TEXT + "Project Number" ? "-" : "(" + code.replace(CODE_TEXT + "Project Number", ")");
    	        Storage.set("AllocationProjectDetails_" + i, code);
                
    	        code = Storage.get("AllocationTaskDetails_" + i).replace("\n", "");
    	        if (code !== "") code = code === CODE_TEXT + "Task Number" ? "-" : "(" + code.replace(CODE_TEXT + "Task Number", ")");
    	        Storage.set("AllocationTaskDetails_" + i, code);
    	    }
            
            Table.populate();
    	}, displayReportServiceError("Failed to load expense allocaiton"));
    }
    var table =  $("#tableOutput").DataTable();
}

function removeProject(event) {
    row = $(event.target).attr("row");
    Storage.set("AllocationSearchFieldId", "ProjectNumber:" + row);
    Spinner.start();
    Services.call("iExpense_cleanAllocationField", function() {
        Storage.set("AllocationProjectDetails_" + row, "");
        removeTask(event);
        // Table.populate(document.getElementById("tableOutputBody"));
    }, displayReportServiceError('Failed to clean project details'));

}

function removeTask(event) {
    row = $(event.target).attr("row");
    Storage.set("AllocationSearchFieldId", "TaskNumber:" + row);
    Spinner.start();
    Services.call("iExpense_cleanAllocationField", function() {
        Storage.set("AllocationTaskDetails_" + row, "");
        Table.populate(document.getElementById("tableOutputBody"));
    }, displayReportServiceError('Failed to clean task details'));
    
}

function searchProject(event) {
    row = $(event.target).attr("row");
    Storage.set("AllocationRowIndex", row);
    Spinner.start();
    Storage.set("AllocationSearchButtonId", "ProjectNumber:" + row);
    Services.call("iExpense_openAllocationSearchWindow", function() {
        Storage.set("SearchCallingPage", "ExpenseAllocations.html");
        Page.navigate("AllocationProjectSearch.html");
        Spinner.stop();
    }, displayReportServiceError('Failed to open project search window'));

}

function searchTask(event) {
    row = $(event.target).attr("row");
    if (Storage.get("AllocationProjectDetails_" + row) === "") {
        Popup.ok("Validation Error", "You must select a project before selecting a task");
        return;
    }
    Storage.set("AllocationRowIndex", row);
    Spinner.start();
    Storage.set("AllocationSearchButtonId", "TaskNumber:" + row);
    Services.call("iExpense_openAllocationSearchWindow", function() {
        Storage.set("SearchCallingPage", "ExpenseAllocations.html");
        Page.navigate("AllocationTaskSearch.html");
        Spinner.stop();
    }, displayReportServiceError('Failed to open project search window'));
    
}

function onSelect(e) {
    var checked = e.currentTarget.checked;
    var id= e.currentTarget.id;
    if (id === 'ResourceSelect_0') {
        for (var i=0; i< Table.countRows(); i++) {
            Storage.set("ResourceSelect_" + i, checked);
        }
    } else {
        if (!checked) {
            // if 1 is uncheck then uncheck the all option
            Storage.set("ResourceSelect_0", "false");
        }
    }
    Storage.set(id, checked);
    Table.populate();
    Fields.storeAll();
    configureUpdateButtons();
}

function initResourceSelectField() {
    Storage.deleteByPrefix("ResourceSelect_");
    var TableColumnArr = Storage.getArray("AllocationExpenseType");
    for (var i = 0; i < TableColumnArr.length; i++) {
        Storage.set("ResourceSelect_" + i, false);
    }
}

Events.tablePopulated = function(){
    formatFirstTotalRow();

    var methodType;
    var projectSelector;
    var taskSelector;
    for (var i=0; i<Table.countRows(); i++) {
        methodType = $("#tablerow_" + i + " > td:nth-child(" + PAYMENT_METHOD_COL_IND + ")").text();
        if (methodType.toLowerCase().indexOf("all") == -1 && methodType.toLowerCase().indexOf("diem") == -1) {
            projectSelector = $("#tablerow_" + i + " > td:nth-child(" + PROJECT_COL_IND + ")");
            taskSelector = $("#tablerow_" + i + " > td:nth-child(" + TASK_COL_IND + ")");
            $(projectSelector).append('<i class="fa fa-search tableSearchIcon" row="' + i + '"aria-hidden="true" id="projectSearch' + i +'"></i>');
            $(taskSelector).append('<i class="fa fa-search tableSearchIcon" row="' + i + '"aria-hidden="true" id="taskSearch' + i +'"></i>');
            $(projectSelector).append('<i class="fa fa-trash-o tableSearchIcon" row="' + i + '"aria-hidden="true" id="projectRemove' + i +'"></i>');
            $(taskSelector).append('<i class="fa fa-trash-o tableSearchIcon" row="' + i + '"aria-hidden="true" id="taskRemove' + i +'"></i>');
        }
        // Expand all but first line
        if (i>0) {
            $("#tablerow_" + i + " > td:first-child").click();
        }
    }
    $("[id^=projectSearch]").click(searchProject);
    $("[id^=taskSearch]").click(searchTask);
    $("[id^=projectRemove]").click(removeProject);
    $("[id^=taskRemove]").click(removeTask);
    $("[id^=ResourceSelect_]").click(onSelect);

    initResourceSelectField()
};

function OnCancel() {
   OnCancelPopup(function() {
        var updateMode = Storage.get("updateMode").toLowerCase() === 'true';
        updateMode ? Page.navigate("Update_Reports.html") : Page.navigate("Reports.html");
   });

}

function onBack() {
	Services.call('iExpense_Back', function() {
            if (Storage.get("WizardTitle").indexOf("Cash and Other Expenses") === -1) {
                // sometime we get the error on the review page so we need to back twice
                Services.call('iExpense_Back', function() {
                    Page.navigate("Cash_Lines.html");
        	    } , displayReportServiceError("Failed to to press back on cash lines"));
            } else {
                Page.navigate("Cash_Lines.html");
            }
	    } , displayReportServiceError("Failed to to press back on cash lines"));
}

function onNext() {
    Services.call("iExpense_updateExpenseAllocation", function() {
        var error = Storage.get("AllocationError");
        if (error !== "" && Storage.get("currentPageTitle").indexOf("Review") === -1) {
            Popup.ok(getTranslationForId("@popup_title_error"), error, function() {
                // We stayed on the allocation page
                
                // In this case we moved to the the review page and the error is displayed on the review page
                // if (Storage.get("currentPageTitle").indexOf("Review") > -1) {
                //     Page.navigate("Review.html");
                // }
            });
        } else {
            Page.navigate("Review.html");
        }
    }, displayReportServiceError('Failed to go to expense allocations'));
    
}
function onAllocations() {
    if ($('#tableOutputBody input[type=checkbox]:checked').length === 0) {
        Popup.ok("No Lines Selected", "You must select at least one line for allocation");
        return;
    }

    Page.navigate("ExpenseGroupAllocations.html");
    
}

