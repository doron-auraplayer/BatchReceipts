store("isCreditLine", false);   // so LineDetails.html page will know where we came from
var addButtonSelector = '#table_add_button';
var removeButtonSelector = '[id*=ap_remove_]';
Storage.deleteByPrefix("updReportCashLineError_");
var rowIdToDelete;

// $("#Cash").addClass("ExpenseCategoryButton");
// $("#Mileage").addClass("ExpenseCategoryButton");
// $("#Per_Diem").addClass("ExpenseCategoryButton");

var CashCategory;

Events.tablePopulated = function(){
    $("[id^=CashLineSelect_]").click(onSelect);
};


function markCategorySelectedButton() {
    $("#Cash").removeClass("Selected");
    $("#Mileage").removeClass("Selected");
    $("#Per_Diem").removeClass("Selected");
    if (Storage.get("ExpensesTableCashCategory") === "Mileage") {
        $("#Mileage").addClass("Selected");
    } else if (Storage.get("ExpensesTableCashCategory") === "PerDiem") {
        $("#Per_Diem").addClass("Selected");
    }
    else {
        $("#Cash").addClass("Selected");
    }
}

function updateScanReceiptVisibility() {
    var category = Storage.get("ExpensesTableCashCategory") || "Receipt-Based";
    var aiEnabled = Storage.get("EnableAIToScanReceipt") === "true";

    if (aiEnabled && category === "Receipt-Based") {
        $("#ScanReceipt").show().removeAttr("disabled");
    } else {
        $("#ScanReceipt").hide().attr("disabled", "true");
    }
}

function updateScannedReceiptsSelectionVisibility() {
    var category = Storage.get("ExpensesTableCashCategory") || "Receipt-Based";
    var aiEnabled = Storage.get("EnableAIToScanReceipt") === "true";

    if (aiEnabled && category === "Receipt-Based") {
        $("#Scanned_Receipts_Selection").show().removeAttr("disabled");
    } else {
        $("#Scanned_Receipts_Selection").hide().attr("disabled", "true");
    }
}

// /****new***/
// function updateReceiptAmountColumnVisibility() {
//     var table = $('#tableOutput').DataTable();
//     var isPerDiem = Storage.get("ExpensesTableCashCategory") === "PerDiem";

//     // Receipt Amount column = index 6
//     table.column(6).visible(!isPerDiem, false);
//     table.columns.adjust().draw(false);
// }


function gotoExpenseCategory(item) {
	store("ExpenseCategory", item);
    Table.clear();
	Storage.set("ExpensesTableCashCategory", item);
	updateScanReceiptVisibility();
    loadCashLinesTable(item);
    markCategorySelectedButton();
}

function gotoReceiptBaseExpenses() {
    gotoExpenseCategory("Receipt-Based");
}

function gotoMileagexpenses() {
    gotoExpenseCategory("Mileage");
}

function gotoPerDiemExpenses() {
    gotoExpenseCategory("PerDiem");
}

function isCashEmptyLine (index) {
    if (Storage.get("ExpensesTableCashCategory") === "Mileage" || Storage.get("ExpensesTableCashCategory") === "PerDiem") {
        return Storage.get("CashLines_Justification_" + index) === "" && Storage.get("CashLines_Date_" + index) === "";    
    } else {
    return Storage.get("CashLines_ExpenseType_" + index) === "" &&  (Storage.get("CashLines_Justification_" + index) === "" && Storage.get("CashLines_Date_" + index) === "");
   }
}

function removeEmptyCashLines() {
    var emptyLinesRemoved = false;
    var numRows = Storage.count('CashLines_ExpenseType_0');
    for (var i=numRows-1; i>=0; i--) {
        if (isCashEmptyLine(i)) {
            if (Storage.get("CashLines_Index_" + i) !== "") {
                // in ebs12.1.3 we sometimes get non visible empty lines so we remove it 
                // but do not want to get them into the logic of if there are empty lines displayed
                emptyLinesRemoved = true;
            }
            removeStorageByPRefixAndIndex("CashLines", i);
            Table.deleteRow(i);
        }
    }

    var table = $('#tableOutput').DataTable();
    
    return emptyLinesRemoved;
    // table.column('#\\*th\\*CashLines_Num').nodes().each(function(cell, index){
    //   cell.innerHTML = index;
    // });
    
}

function loadCashLinesTable(CashCategory) {
    var maxCashLines = 10;
    if (CashCategory === "Mileage" || CashCategory === "PerDiem") {
        maxCashLines = 5;
        Storage.set("MaxCashLines", maxCashLines);
    } else {
        Storage.set("MaxCashLines", maxCashLines);
    }
    Storage.set("ExpensesTableCashCategory", CashCategory);
    Storage.set("ExpensesTableCashLinePrefix", Storage.get("ExpensesTableCashLinePrefix_Receipt"));
    // to make sure the services will be in the backup
    // Services.call("iExpense_CashLinesGetReceiptLinesJS")
    // Services.call("iExpense_CashLinesGetMileage")
    // Services.call("iExpense_CashLinesGetPerDiem")
    // Services.call("iExpense_CashLinesGetReceiptLines")
    var serviceName = "iExpense_CashLinesGetReceiptLines";
    if (CashCategory === "Mileage") {
        Storage.set("ExpensesTableCashLinePrefix", Storage.get("ExpensesTableCashLinePrefix_Mileage"));
        serviceName = "iExpense_CashLinesGetMileage";
    } else if (CashCategory === "PerDiem") {
        Storage.set("ExpensesTableCashLinePrefix", Storage.get("ExpensesTableCashLinePrefix_PerDiem"));
        serviceName = "iExpense_CashLinesGetPerDiem";
    }

    Storage.remove("paginationExist");
    Services.call(serviceName, function() {
        // set pagination buttons
        if (Storage.get("paginationExist") === "true") {
            $("#listRange").parent().show();
            $("#listRange").text(Storage.get("paginationLabel"));
            if (Storage.get("nextEnabled") === "true") {
                $("#NextLines").removeAttr("disabled");
            } else {
                $("#NextLines").attr("disabled", "true");
            }
            if (Storage.get("previousEnabled") === "true") {
                $("#PreviousLines").removeAttr("disabled");
            } else {
                $("#PreviousLines").attr("disabled", "true");
            }
        } else {
            $("#listRange").parent().hide();
        }

        var emptyLinesRemoved = removeEmptyCashLines();
        
        var tableLinesCount = Storage.count('CashLines_ExpenseType_0');
    	if (tableLinesCount === 0) {
            document.getElementById('tableOutput').style.display = 'none';
            $("#Add_Line").removeAttr("disabled");
            $("#ScanReceipt").removeAttr("disabled");
            // var hasCreditLines = Storage.get("hasCreditLines").toLowerCase() === 'true';
            // if (!hasCreditLines) {
            //     // if already set credit lines can skip cash lines
            //     $("#Next").prop('disabled', true);
            // }
    	} else {
            $("#Add_Line").removeAttr("disabled");
            $("#ScanReceipt").removeAttr("disabled");
            // if (tableLinesCount === maxCashLines) {
            if (!emptyLinesRemoved) {
                if ((Storage.get("paginationExist") !== "true" || (Storage.get("paginationExist") == "true" && Storage.get("nextEnabled") != "true")) ) {
                    // There is no pagination or we are at the end so need to push add more lines
                    Services.call("iExpense_CashLinesAddMoreLines", function() {
                        loadCashLinesTable(CashCategory);
                    }, displayReportServiceError('Failed to add more cash lines'));
                } else {
                    $("#Add_Line").attr("disabled", "true");
                    $("#ScanReceipt").attr("disabled", "true");
                }
            } else {
                $("#NextLines").prop('disabled', true);
            }
            // $("#Next").prop('disabled', false);
    	}
        var ReimbursementAmountHeader = Storage.get("CashLines_ReimbursableColumnHeader");
        if ($('#tableOutputHead').is(":visible") && ReimbursementAmountHeader && tableLinesCount > 0) {
            var table = $('#tableOutput').DataTable();
            $(table.column(5).header()).text(ReimbursementAmountHeader);
        }
    }, displayReportServiceError('Failed to get cash lines'));   
    
}

function openDetailedLine(rowId) {
    //count all lines with prefix 'AllLines_ExpenseType_' (the function ignores the index)
    if (rowId == -1) {
        Storage.set('index', Storage.count('CashLines_ExpenseType_0'));
        Storage.remove("LineDetailsUpdate");
    } else {
        Storage.set('index', rowId);
        Storage.set("LineDetailsUpdate", "true");
    }

    if (Storage.get("ExpensesTableCashCategory") === "Mileage") {
        Services.call("iExpense_cash_openMileageLineDetails", function() {
    	    Page.navigate('LineDetailsMileage.html');
        }, displayReportServiceError('Failed to open detailed mileage expense line'));
    } else if (Storage.get("ExpensesTableCashCategory") === "PerDiem") {
        Services.call("iExpense_cash_openPerDiemLineDetails", function() {
        	Page.navigate('LineDetailsPerDiem.html');
        }, displayReportServiceError('Failed to open detailed PerDiem expense line'));
    } else {
        Services.call("iExpense_cash_openLineDetails", function() {
        	Page.navigate('LineDetails.html');
        }, displayReportServiceError('Failed to open detailed expense line'));
    }
}

function setCategoryButtons() {
        if ($("#cashIconsContainer").length > 0) {
            return;
        }
        
        var iconsContainer = $('<div id="cashIconsContainer" style="display:flex;justify-content:space-evenly"></div>');
        iconsContainer.insertBefore($("#mainForm"));

        iconsContainer.append($("#Cash").parent());
        $("#Cash").addClass("ReviewBtn");
        $("#Cash").text("");
        $('<div class="ReviewBtnLabel">Cash</div>').insertAfter("#Cash");
        $("#Cash").css({'cssText': 'background-color:#4caf50!important; font-size:22px!important;'});
        $("#Cash").append('<i class="fa fa-dollar" aria-hidden="true"></i>');
        $("#Cash").parent().addClass("ReviewBtnContainer");

        iconsContainer.append($("#Per_Diem").parent());
        $("#Per_Diem").addClass("ReviewBtn");
        $("#Per_Diem").text("");
        $('<div class="ReviewBtnLabel">Per Diem</div>').insertAfter("#Per_Diem");
        $("#Per_Diem").append('<i class="fa fa-calendar" aria-hidden="true"></i>');
        $("#Per_Diem").css({'cssText': 'background-color:#ff9800!important; font-size:22px!important;'});
        $("#Per_Diem").parent().addClass("ReviewBtnContainer");

        iconsContainer.append($("#Mileage").parent());
        $("#Mileage").addClass("ReviewBtn");
        $("#Mileage").text("");
        $("#Mileage").append('<i class="fa fa-car" aria-hidden="true"></i>');
        $('<div class="ReviewBtnLabel">Mileage</div>').insertAfter("#Mileage");
        $("#Mileage").css({'cssText': 'background-color:#dc5a56!important; font-size:22px!important;'});
        $("#Mileage").parent().addClass("ReviewBtnContainer");
}

function onLoad() {
    setCategoryButtons();
    addNewLineAfterButton("Next");
    Table.clear();
    $("#Add_Line").addClass("TableAddLineBtn");
    $("#Add_Line").text("");
    $("#Add_Line").append('<i class="fa fa-plus" aria-hidden="true"></i>');
    $("#Add_Line").parent().parent().css({'margin-top': '-15px'});
    $("#Add_Line").parent().css({'margin-bottom': '20px'});

    $("#Add_Line").parent().append($("#ScanReceipt"))
    $("#ScanReceipt").addClass("TableAddLineBtn");
    $("#ScanReceipt").text("");
    $("#ScanReceipt").append('<i class="fa fa-camera" aria-hidden="true"></i>');
    $("#ScanReceipt").parent().parent().css({'margin-top': '-15px'});
    $("#ScanReceipt").parent().css({'margin-bottom': '20px'});
    updateScanReceiptVisibility();
    
    $( "#ScanReceipt" ).parent().append( $( "#Scanned_Receipts_Selection" ) );
    $( "#Scanned_Receipts_Selection" ).addClass( "TableAddLineBtn" );
    $( "#Scanned_Receipts_Selection" ).text( "" );
    $( "#Scanned_Receipts_Selection" ).append('<i class="fa fa-file-text-o" aria-hidden="true"></i>');
    $( "#Scanned_Receipts_Selection" ).parent().css({ 'margin-bottom': '20px' });
    updateScannedReceiptsSelectionVisibility()

    
    $("#Cancel").addClass("CashLinesActionBtn");
    $("#Back").addClass("CashLinesActionBtn");
    $("#Save").addClass("CashLinesActionBtn");
    $("#Next").addClass("CashLinesActionBtn");

    // set prev/next pagination buttons
    $('#NextLines').prop( "disabled",  true);
    $('#NextLines').parent().prop( "style",  'flex: 0 1 10px !important');
    $('#NextLines').prop( "style",  'width: 30px!important;min-width: 0px;height: 30px;padding: 0;line-height: 0;');
    $('#PreviousLines').prop( "disabled", true);
    $('#PreviousLines').parent().prop( "style",  'flex: 0 1 10px !important');
    $('#PreviousLines').prop( "style",  'width: 30px!important;min-width: 0px;height: 30px;padding: 0;line-height: 0;');
    $("#listRange").remove();
    $("<span id='listRange' style='flex: 1 1 0px !important;text-align: center;margin: 10px;align-self: center'>9-9 of 9</span>").insertAfter($("#PreviousLines").parent());
    $("#listRange").parent().prop( "style",  'max-width: 200px;float: right;margin-top: 10px;');
    $("#mainForm").prop("style","height: 50px")
    $("#listRange").parent().hide();

    var iExpenseConfig = getEnvConfiguration();

    // cashCategory = "Receipt-Based";
    cashCategory = iExpenseConfig.ExpenseTypeCategories.split(';')[0];
    if (Storage.get("BackFromMileage") == "true") {
        populateField("ExpenseCategory", "Mileage");
        cashCategory = "Mileage";
        Storage.remove("BackFromMileage");
    } else if (Storage.get("BackFromPerDiem") == "true") {
        populateField("ExpenseCategory", "PerDiem");
        cashCategory = "PerDiem";
        Storage.remove("BackFromPerDiem");
    } else if (Storage.get("BackFromPerDiem") == "true") {
        populateField("ExpenseCategory", "Receipt-Based");
        cashCategory = "Receipt-Based";
    }

    Storage.deleteByPrefix("CashLines_Num_");
    
    // Handle category buttons
    if (iExpenseConfig.ExpenseTypeCategories.indexOf("Receipt-Based") < 0) {
        $("#Cash").parent().remove();
    }
    if (iExpenseConfig.ExpenseTypeCategories.indexOf("Mileage") < 0) {
        $("#Mileage").parent().remove();
    }
    if (iExpenseConfig.ExpenseTypeCategories.indexOf("PerDiem") < 0) {
        $("#Per_Diem").parent().remove();
    }

    loadCashLinesTable(cashCategory);
    markCategorySelectedButton();
    
    Storage.deleteByPrefix("CashLineSelect_");
    $("<div id='ActionBtnContainer'></div>").insertAfter($("#mainForm"));
    $("#ActionBtnContainer").attr("style","margin-left:6px");
    $("#ActionBtnContainer").append($("#SelectAll"));
    $("#SelectAll").attr("style", "max-width:30px!important;min-width:0px;padding: 0;margin: 0 10px 0 0;");
    $("#ActionBtnContainer").append($("#SelectNone"));
    $("#SelectNone").attr("style", "max-width:30px!important;min-width:0px;padding: 0;margin: 0 10px 0 0;");
    $("#ActionBtnContainer").append($("#DeleteMultiple"));
    $("#DeleteMultiple").attr("style", "max-width:30px!important;min-width:0px;padding: 0;margin: 0 10px 0 0;");
    confugureSelectButtons();

    
    Fields.clear("attachmentPath_filename");
}

function onRemoveLineClick(rowIdToDelete) {
    if (rowIdToDelete === undefined) {
        Storage.set("removeSelected", "true");
    } else {
        Storage.set("removeSelected", "false");
        Storage.set("indexLineToRemove", rowIdToDelete);
    }

    var CashCategory = Storage.get("ExpensesTableCashCategory");
    Storage.set("ExpensesTableCashLinePrefix", Storage.get("ExpensesTableCashLinePrefix_Receipt"));
    if (CashCategory === "Mileage") {
        Storage.set("ExpensesTableCashLinePrefix", Storage.get("ExpensesTableCashLinePrefix_Mileage"));
    } else if (CashCategory === "PerDiem") {
        Storage.set("ExpensesTableCashLinePrefix", Storage.get("ExpensesTableCashLinePrefix_PerDiem"));
    }

    Services.call("iExpense_cash_removeLine", function() {
        // loadCashLinesTable(cashCategory);
        gotoExpenseCategory(Storage.get("ExpenseCategory"));
        // Table.deleteRow(id);
        // if (Table.countRows() < 1) {
        //     $("#Next").prop('disabled', true);
        // }
    }, displayReportServiceError("Failed to remove line"));
}

function onAddLineClick() {
    openDetailedLine(-1);
}

function markErrorLines() {
    var numServiceLines = Storage.count("updReportCashLineError_0");
    for ( var index=0; index < numServiceLines; index++) {
        if (Storage.get('updReportCashLineError_' + index).indexOf('OIEErrorExist') !== -1) {
            $('#tablerow_' + index).attr("style", "background-color: #e25c5c!important")
        }
    }
}

function onNext() {
	//Fields.set(fieldName, value);
	//var popupMsg = Storage.get('PopupMessages');
    window.sendRequestHandler = function() {}; // don't hide table when executing service
	Services.call("iExpense_updateCashLines", function() {
	    if (Storage.get("isErrorMessage") == "true") {
            markErrorLines();
            if (Storage.get("title").indexOf("Expense Report: Review") > -1) {
                // We  have skiped to the review page
    	       Popup.ok(getTranslationForId("@popup_title_error"), Storage.get("reportErrorMessage"), function() {
            	    Page.navigate("Review.html");
    	       });
                
            } else {
    	       Popup.ok(getTranslationForId("@popup_title_error"), Storage.get("reportErrorMessage"));
            }
	    } else {
	        if (Storage.get("ExpenseAllocationPageExists").toLowerCase() == "true") {
        	    Page.navigate("ExpenseAllocations.html");
	        } else {
        	    Services.callSync("iExpense_updateExpenseAllocation", displayReportServiceError('Failed to go to expense allocations'));
        	    Page.navigate("Review.html");
	        }
	    }
	}, function() {
	   // if some of the cash lines are not valid will mark them
        markErrorLines();
	    var displayErrorFunc = displayReportServiceError("Failed to save cash lines, remove or update invalid lines");
	    displayErrorFunc();
	});
	
}

function OnCancel() {
   OnCancelPopup(function() {
        var updateMode = Storage.get("updateMode").toLowerCase() === 'true';
        updateMode ? Page.navigate("Update_Reports.html") : Page.navigate("Reports.html");
   });

}


function onBack() {
	Services.call('iExpense_Back', function() {
            if (Storage.get("hasCreditLinesStep") == "true") {
                var wizardTitle = Storage.get("WizardTitle");
                // The only way we know if there are marked transactions is from the next step as a transactions
                // might be marked on the next pagination page
                if (wizardTitle.toLowerCase().indexOf("credit card expenses") > -1) {
                    Page.navigate("Credit_Lines.html");
                } else if (wizardTitle.toLowerCase().indexOf("credit card transactions") > -1) {
                    Page.navigate("Credit_Transactions.html");
                } else {
                    Popup.ok(getTranslationForId("@popup_title_error"), "Got to unexpected page: " + Storage.get("WizardTitle"));
                }
            } else {
                Storage.set("updateMode", true);
                Page.navigate("Report_General.html");
            }
	    } , displayReportServiceError("Failed to to press back on cash lines"));
}

function onNextLines() {
    Storage.set("buttonName", "next");
    if (Storage.get("ExpensesLongScroll") === "true") {
        var startRow = parseInt(Storage.get("paginationLabel").split(" ")[1]);
        var endRow = parseInt(Storage.get("paginationLabel").split(" ")[3]);
        var maxCashLines = parseInt(Storage.get("MaxCashLines"));
        Storage.set("paginationStartIndex", endRow+1);
        // Storage.set("paginationStartIndex", startRow+maxCashLines);
    }
	Services.call("iExpense_CashLinesNextPrev", function() {
        loadCashLinesTable(Storage.get("ExpenseCategory"));
        markCategorySelectedButton();
	}, displayReportServiceError("Failed to to press next/previous on cash lines"));
}

function onPreviousLines() {
    Storage.set("buttonName", "previous");
    if (Storage.get("ExpensesLongScroll") === "true") {
        var maxCashLines = parseInt(Storage.get("MaxCashLines"));
        var startRow = parseInt(Storage.get("paginationLabel").split(" ")[1]);
        var endRow = parseInt(Storage.get("paginationLabel").split(" ")[3]);
        Storage.set("paginationStartIndex", Math.min(1,startRow-1));
        // Storage.set("paginationStartIndex", Math.min(1,startRow-maxCashLines));
    }
	Services.call("iExpense_CashLinesNextPrev", function() {
        loadCashLinesTable(Storage.get("ExpenseCategory"));
        markCategorySelectedButton();
	}, displayReportServiceError("Failed to to press next/previous on cash lines"));
}

function Edit(rowIndex) {
    openDetailedLine(rowIndex)
}
function Delete(rowIndex) {
    Popup.okCancel(getTranslationForId("@popup_title_remove_cach_line"), getTranslationForId("@popup_message_remove_cach_line"), function() {
        onRemoveLineClick(rowIndex)
    })
}

function Duplicate(rowIndex) {
    Storage.set("CashLineDuplicateIndex", rowIndex);
    Services.call('iExpense_CashlineDuplicate', function(){
        // onLoad();
        gotoExpenseCategory(Storage.get("ExpenseCategory"));    
    },displayReportServiceError("Failed to to duplicate cash line"));
}

function confugureSelectButtons() {
    if (Storage.getArray("CashLineSelect").toString().indexOf("true") > -1) {
        $("#DeleteMultiple").removeAttr("disabled");
    } else {
        $("#DeleteMultiple").attr("disabled", true);
    }
}

function onSelect(e) {
    var checked = e.currentTarget.checked;
    var id= e.currentTarget.id;
    Storage.set(id, checked);
    // Table.populate();
    Fields.storeAll();
    confugureSelectButtons();
}

function onDeleteMultiple() {
    Popup.okCancel("Remove Cash Lines", "Are you sure you want to remove the selected lines?", function() {
        var cashLinesSelected = Storage.getArray("CashLineSelect");
        for (var i=0; i < cashLinesSelected.length; i++) {
            if (Storage.get("CashLineSelect_" + i) === "true") {
                Storage.set("indexLineToSelect", i);
                Services.callSync('iExpense_cash_selectLine', displayReportServiceError("Failed to select cash lines"));
            }
        }
        onRemoveLineClick();
    })

}

function onSelectAll() {
    for (var i=0; i< Table.countRows(); i++) {
        Storage.set("CashLineSelect_" + i, "true");
    }
    Table.populate();
    confugureSelectButtons();

}

function onSelectNone() {
    for (var i=0; i< Table.countRows(); i++) {
        Storage.set("CashLineSelect_" + i, "false");
    }
    Table.populate();
    confugureSelectButtons();
}

function onScanReceipt() {
    Storage.set("PerformAnalyzeReceipt", "true");
    openDetailedLine(-1);
}

function onScanned_Receipts_Selection() {
    Popup.openPage("ScannedReceiptsSelection", function(){},'90%','100%');
}


