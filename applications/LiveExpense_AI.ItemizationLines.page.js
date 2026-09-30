var commingFrom  ="LineDetails";

function removeEmptyItemizedLines() {
    var numRows = Storage.count('ItemizationTableLineNumber_0');
    for (var i=numRows-1; i>=0; i--) {
        if (Storage.get("ItemizationTableLineNumber_" + i).length === 0) {
            removeStorageByPRefixAndIndex("ItemizationTable", i);
            removeStorageByPRefixAndIndex("ItemizationLineAmount", i);
        }
    }
    Table.populate();

}
	
function configActionButtons(commingFrom) {
    $(".fa-edit").attr("title", "Edit");
    $(".fa-trash-o").attr("title", "Delete");
    $(".fa-clone").attr("title", "Duplicate");
    $(".fa-file-o").attr("title", "Details");
    if (commingFrom === "Report_display_Cash_Line") {
        $("#addLine").hide();
        $(".fa-edit").hide();
        $(".fa-trash-o").hide();
        $(".fa-clone").hide();
        $("#Done").hide();
    } else {
        $(".fa-file-o").hide();
    }

}

function onLoad(internalLoad) {
    $("#ItemizedOrigAmount_container").parent().addClass("Itemization-total-container");
// 	$("#ItemizedOrigAmount_container").parent().attr("style", "background-color: #d1d4e3; margin:0px 5px 5px 5px");
// 	$("#ItemizedOrigAmount,#ItemizedBussinessExpenses,#ItemizedPersonalExpenses").attr("style", "background-color: #d1d4e3!important;padding: 0;");
// 	$("#ItemizedOrigAmount_container,#ItemizedBussinessExpenses_container,#ItemizedPersonalExpenses_container").attr("style", "    max-width: 100px!important;");
    
    Storage.clear("ItemizedItemAddFlag");
    commingFrom = Storage.get("ItemizationLinesCommingFrom");
    var backFromItemizedLine = Storage.get("BackFromItemizedLine") === "true";
    Storage.clear("BackFromItemizedLine");
	Services.call("iExpense_lineDetailsItemizedTableGet", function(){
        $("#tableOutput_wrapper").parent().append($("#addLine").parent());
        $("#addLine").addClass("TableAddLineBtn");
        $("#addLine").text("");
        $("#addLine").append('<i class="fa fa-plus" aria-hidden="true"></i>');
        $("#addLine").parent().parent().css({'margin-top': '-15px'});
        $("#addLine").parent().css({'margin-bottom': '20px'});
	    removeEmptyItemizedLines();
	    configActionButtons(commingFrom);
        if (commingFrom === "LineDetails" && !backFromItemizedLine && !internalLoad && Storage.count("ItemizationLineAmount") === 1) {
            internalLoad = false;
	        Edit(0);
	    } 
	    $("td:nth-child(4)").attr("style", "text-align: right!important");
	}, displayReportServiceError("Failed to Itemization table"));
}

function Edit(rowIndex) {
    Storage.set("ItemizedLineNum", parseInt(rowIndex)+1);
    Storage.set("ItemizedMode", "edit");
    Page.navigate("ItemizedLine");
}
function Delete(rowIndex) {
    if (Table.countRows() === 1) {
        Popup.ok("Error", "Cannot remove this line. <BR>Itemizated expense must have at least one line");
        return;
    }
    Storage.set("ItemizedLineNum", rowIndex);
    Services.call('iExpense_lineItemizedDelete', function() {
        onLoad(true);
    }, displayReportServiceError("Failed to remove itemized item"));
}
function onAdd() {
    if (parseFloat(Fields.get("ItemizedPersonalExpenses")) === 0) {
        Popup.ok("Error", "Total receipt is fully used by existing itemized items");
        return;
    }
    Storage.set("ItemizedLineNum", Table.countRows()+1);
    Storage.set("ItemizedMode", "add")
    Storage.set("ItemizedExpenseType", "Hotel");
    Storage.set("ItemizedItemAddFlag", "true");
    Services.call('iExpense_lineItemizedOpenLine', function() {
        Page.navigate("ItemizedLine");
    }, displayReportServiceError("Failed to add new itemized line"));
}

function onBack() {
    Storage.set("fromItemization","true");
    // if (Storage.getArray("ItemizationLineAmount").filter(function(val) {return parseFloat(val) === 0}).length > 0) {
    //     Popup.ok("Error", "Some of the table lines have '0' amount value");
    // } else {
        Page.navigate(commingFrom);
    // }
}

function Details(rowIndex) {
    Storage.set("ItemizedLineIndex", parseInt(rowIndex));
    Services.call('iExpense_lineItemizedDisplayGet', function() {
        Page.navigate("DisplayItemizedLine");
    }, displayReportServiceError("Failed to getitemized line details"));
}

function Duplicate(rowIndex) {
    Storage.set("ItemizedLineDuplicateIndex", parseInt(rowIndex));
    Services.call('iExpense_ItemizedlineDuplicate', function() {
        onLoad(true);
    }, displayReportServiceError("Failed to duplicate Itemized line"));
}
function onDone() {
    if (Table.countRows() === 1 && Storage.get("ItemizationLineAmount_0") === "0.00") {
        onBack();
        return;
    }        
    Storage.remove("ItemizedError");
    Services.call("iExpense_ItemizationLinesDone", function() {
        if (Storage.get("ItemizedError").length > 0) {
            Popup.ok("Error", Storage.get("ItemizedError"))
            return;
        }
        if (commingFrom === "Report_display_Cash_Line") {
            Page.navigate("Report_Display_Cash_Lines_details");
        } else {
            if (Storage.get("isCreditLine") === "true") {
        	    Page.navigate("Credit_Lines");
            } else {
        	    Page.navigate("Cash_Lines");
            }
        }
    }, displayReportServiceError("Failed to go back to expense lines"));
}

function onPageLoad() {
    onLoad(false);
}

