// function checkEmptyFirstRow () {
//     if (Storage.count("ProjectDetails") > 0 || Storage.count("ProjectNumber") > 0) {
//         if (Storage.get("ProjectDetails_0") === "" && Storage.get("ProjectNumber_0") === "") {
//             Table.deleteRow(0);
//         }
//     }
    
// }

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
    Services.call("iExpense_AllocationGetSearchProjects", function() {
        var listRange = Storage.get("lovPaginationInfo");
        if (listRange.length ===0) {
        //     $("#Prev").hide();
        //     $("#Next").hide();
            $("#listRange").hide();
        } else {
            listRange = listRange.split("Rows")[1];   
            $("#listRange").text("Rows " + listRange);
            $("#listRange").show();
        //     $("#Prev").show();
        //     $("#Next").show();
        }
        Storage.set("ProjectOnlyGet","false");

        // // in EBS 12.1.3 the table has 2 columns project number, project Namespace
        // // in EBS 12.2.7 the table has instead one column project details instead
        // if (Storage.get("ProjectDetails_0") !== "") {
        //     $('#tableOutput').DataTable().column(0).visible(false);
        //     $('#tableOutput').DataTable().column(1).visible(false);
        // } else {
        //     $('#tableOutput').DataTable().column(2).visible(false);
        // }
    }, displayReportServiceError('Failed to search projects'));
}

function returnToCallingPage() {
    Storage.set("ReturnFromSearch", "ProjectSearchName");
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
    $("<span id='listRange' style='flex: 1 1 50px !important; text-align: center; align-self: center'></span>").insertAfter($("#Prev").parent());
    $("#Prev").hide();
    $("#Next").hide();
    $("#listRange").hide();

    populateField("ListSearchBy", Storage.get("SearchCategoryChoice"));
    
    if (Storage.get("ProjectOnlyGet") == "true") {
        onSearch();
    }
}

function onTableClick(row, col, rowCells) {
	Storage.copyFromIndex("ProjectNumber", row);
	Storage.copyFromIndex("ProjectName", row);
	Storage.set("SelectSearchIndex", row);
    Services.call("lExpense_SelectValueSearchWindow", function() {
        Storage.set("AllocationProjectDetails_" + Storage.get("AllocationRowIndex"), Storage.get("ProjectNumber")+ " " + Storage.get("ProjectName"));
        returnToCallingPage();
    } ,displayReportServiceError('Failed to close search window'))

}


function onPrev() {
    Storage.set("moveNext", "false");
    Services.call("iExpense_AllocationSearchProjectsNextPrev", function() {
         $("#listRange").text(Storage.get("lovPaginationInfo").split("Rows")[1].trim());
    }, displayReportServiceError('Failed to get next records'));
}

function onNext() {
    Storage.set("moveNext", "true");
    Services.call("iExpense_AllocationSearchProjectsNextPrev", function() {
         $("#listRange").text(Storage.get("lovPaginationInfo").split("Rows")[1].trim());
    }, displayReportServiceError('Failed to get next records'));
}

