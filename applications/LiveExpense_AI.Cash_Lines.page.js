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

    if (aiEnabled && category === "Receipt-Based" && Storage.get('ReportCreationType') === 'RECEIPT' &&
        Storage.get('ReportCreationTypeNumber') &&
        Storage.get('ReportCreationTypeNumber') === Storage.get('ReportNumber')) {
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
    var previousCategory = Storage.get("ExpensesTableCashCategory");
    if (previousCategory !== item) {
        clearCashFailedLinesSection();
    }
	store("ExpenseCategory", item);
    Table.clear();
	Storage.set("ExpensesTableCashCategory", item);
	updateScanReceiptVisibility();
    updateScannedReceiptsSelectionVisibility();
    loadCashLinesTable(item);
    markCategorySelectedButton();
    if (item === "Receipt-Based") {
        refreshCashFailedLinesPanel(false);
    }
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
        ensureCashFailedLinesSectionMounted();
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
    bindCashFailedLinesLifecycle();
    clearCashFailedLinesSection();
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
    updateScannedReceiptsSelectionVisibility();

    
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

    if (cashCategory === "Receipt-Based") {
        refreshCashFailedLinesPanel(true);
    }
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
    invalidateCashFailedLinesHandoff();
    Storage.set('ReceiptLineSelectionMode', 'CASH');
    Storage.set('ReceiptLineSelectionReturnPage', 'Cash_Lines.html');
    // The normal scanned-receipt picker only offers ready receipts. The popup
    // cannot receive parameters, so publish the one-shot status selection for
    // ReceiptLineSelection to read and consume on load.
    Storage.set('ReceiptLineSelectionStatuses', 'READY');
    Storage.remove('ReceiptLineSelectionReceiptId');
    Storage.remove('ReceiptLineSelectionSelectedMode');
    // Page.navigate('ReceiptLineSelection.html');
    Popup.openPage('ReceiptLineSelection.html', function(){}, '80%', '90%')
}

// ---------------------------------------------------------------------------
// Inline Failed Cash Lines panel
//
// The report service is a read-only overview for the current report. Its
// response is requested with populateFields=false so it cannot overwrite the
// native Cash Lines fields or table. The panel is mounted outside DataTables
// and the receipt chooser receives the already-filtered rows through a
// single-use handoff on this host window.
// ---------------------------------------------------------------------------

function getCashFailedLinesHostState() {
    if (typeof window === 'undefined' || !window) {
        return null;
    }
    if (!window.__cashFailedLinesInlineState) {
        window.__cashFailedLinesInlineState = {
            token: 0,
            status: 'idle',
            requestKey: '',
            reportNumber: '',
            user: '',
            rows: [],
            handoff: null,
            inline: null
        };
    }
    return window.__cashFailedLinesInlineState;
}

function isReceiptBasedCashCategory() {
    return Storage.get("ExpensesTableCashCategory") === "Receipt-Based";
}

function isCashLinesPageCurrent() {
    if (typeof Page === 'undefined' || !Page ||
        typeof Page.getCurrentPage !== 'function') {
        return true;
    }
    var currentPage = String(Page.getCurrentPage() || '').toLowerCase();
    if (currentPage === '') {
        return true;
    }
    return currentPage.indexOf('cash_lines') !== -1;
}

function getCashFailedLinesReportContext() {
    var reportNumber = String(Storage.get("ReportNumber") || '').trim();
    var user = String(Storage.get("LoggedInUsername") || '').trim();

    if (reportNumber === '') {
        return {
            valid: false,
            error: 'The current report number is not available.'
        };
    }
    if (/[\u0000-\u001f\u007f]/.test(reportNumber)) {
        return {
            valid: false,
            error: 'The current report number contains unsupported characters.'
        };
    }
    if (user === '') {
        return {
            valid: false,
            error: 'The signed-in user is not available.'
        };
    }

    return {
        valid: true,
        reportNumber: reportNumber,
        user: user
    };
}

// The service substitutes REPORT_NUMBER inside SQL quotes. Escape the legacy
// text parameter exactly as the shared SQL helpers do, and reject control
// characters above so the value cannot break out of the quoted predicate.
function escapeCashFailedLinesSqlText(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/'/g, "''");
}

function normalizeCashFailedLinesRows(value) {
    var attempts = 0;

    while (typeof value === 'string' && attempts < 2) {
        var text = value.trim();
        if (text === '') {
            return [];
        }
        try {
            value = JSON.parse(text);
        } catch (error) {
            return null;
        }
        attempts += 1;
    }

    if (value === null || value === undefined) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === 'object') {
        return [value];
    }
    return null;
}

function isCashFailedLineRow(row, reportNumber, user) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return false;
    }

    if (String(row.REPORT_NUMBER === null || row.REPORT_NUMBER === undefined
        ? '' : row.REPORT_NUMBER).trim() !== reportNumber) {
        return false;
    }

    if (String(row.EBS_USER_NAME === null || row.EBS_USER_NAME === undefined
        ? '' : row.EBS_USER_NAME).trim().toLowerCase() !==
        user.toLowerCase()) {
        return false;
    }

    if (row.STATUS !== 'LINE_FAILED') {
        return false;
    }

    // Failed cash lines are exactly rows whose credit transaction is null.
    // Undefined, empty, whitespace and card values are all ineligible.
    if (row.CREDIT_TRANSACTION !== null) {
        return false;
    }

    if (String(row.RECEIPT_ID === null || row.RECEIPT_ID === undefined
        ? '' : row.RECEIPT_ID).trim() === '') {
        return false;
    }

    return true;
}

function filterCashFailedLinesRows(value, reportNumber, user) {
    var rows = normalizeCashFailedLinesRows(value);
    if (!rows) {
        return [];
    }

    return rows.map(function (row) {
        var candidate = row;

        // Service Manager omits a database NULL from nested JSON even when the
        // JSON_OBJECT uses NULL ON NULL. The report marks that case explicitly
        // so a missing credit transaction can still reach the exact-null rule
        // without mutating the response row or accepting other missing values.
        if (candidate && typeof candidate === 'object' &&
            !Array.isArray(candidate) &&
            candidate.CREDIT_TRANSACTION === undefined &&
            candidate.CREDIT_TRANSACTION_IS_NULL === 'Y') {
            candidate = {};
            Object.keys(row).forEach(function (key) {
                candidate[key] = row[key];
            });
            candidate.CREDIT_TRANSACTION = null;
        }

        return candidate;
    }).filter(function (row) {
        return isCashFailedLineRow(row, reportNumber, user);
    });
}

function cashFailedLinesGetTableContainer() {
    var table = document.getElementById('tableOutput');
    var container = null;

    if (table && typeof table.closest === 'function') {
        container = table.closest('.field-container.table-field-container') ||
            table.closest('.table-field-container');
    }
    if (container) {
        return container;
    }

    return document.getElementById('tableOutput_wrapper') || table || null;
}

function cashFailedLinesRemoveSection() {
    var section = document.getElementById('cashFailedLinesSection');
    if (section && section.parentNode) {
        section.parentNode.removeChild(section);
    }
}

function invalidateCashFailedLinesHandoff() {
    var state = getCashFailedLinesHostState();
    if (!state) {
        return;
    }
    // The inline context remains valid for an already-open panel; only the
    // pending one-shot handoff is discarded so the normal chooser cannot
    // consume failed-only rows.
    state.handoff = null;
}

function clearCashFailedLinesSection() {
    var state = getCashFailedLinesHostState();

    if (state) {
        state.token += 1;
        state.status = 'idle';
        state.requestKey = '';
        state.reportNumber = '';
        state.user = '';
        state.rows = [];
        state.handoff = null;
        state.inline = null;
    }

    cashFailedLinesRemoveSection();
}

function cashFailedLinesSetInlineContext(rows) {
    var state = getCashFailedLinesHostState();
    if (!state) {
        return;
    }

    state.inline = {
        active: true,
        token: state.token,
        reportNumber: state.reportNumber,
        user: state.user,
        rows: rows.slice()
    };
}

// Publish the one-shot handoff only immediately before the picker is actually
// opened. A mounted, fallback-button-only panel keeps the inline context but
// must not leave failed-only rows waiting for a later normal picker.
function cashFailedLinesSetInlineHandoff(rows) {
    var state = getCashFailedLinesHostState();
    if (!state) {
        return;
    }

    state.handoff = {
        pending: true,
        token: state.token,
        reportNumber: state.reportNumber,
        user: state.user,
        statuses: 'LINE_FAILED',
        rows: rows.slice()
    };
}

// Called from the ReceiptLineSelection iframe. A handoff is consumed exactly
// once, so the normal chooser opened later cannot reuse the failed-only data.
function cashFailedLinesTakeHandoff() {
    var state = getCashFailedLinesHostState();
    if (!state || !state.handoff || state.handoff.pending !== true) {
        return null;
    }

    var handoff = state.handoff;
    state.handoff = null;

    if (!isReceiptBasedCashCategory() || !isCashLinesPageCurrent() ||
        handoff.token !== state.token || !state.inline ||
        state.inline.active !== true || state.inline.token !== handoff.token ||
        handoff.reportNumber !== state.reportNumber ||
        String(handoff.user).toLowerCase() !== String(state.user).toLowerCase() ||
        !Array.isArray(handoff.rows) || handoff.rows.length === 0) {
        return {
            pending: true,
            valid: false,
            error: 'The failed cash line list is no longer current. ' +
                'Refresh Cash Lines and try again.'
        };
    }

    return {
        pending: true,
        valid: true,
        token: handoff.token,
        reportNumber: handoff.reportNumber,
        user: handoff.user,
        statuses: handoff.statuses || 'LINE_FAILED',
        rows: handoff.rows.slice()
    };
}

function cashFailedLinesValidateInlineContext(token, reportNumber, user, receiptId) {
    var state = getCashFailedLinesHostState();
    var context = getCashFailedLinesReportContext();

    if (!state || !state.inline || state.inline.active !== true ||
        !context.valid || !isReceiptBasedCashCategory() ||
        !isCashLinesPageCurrent()) {
        return false;
    }
    if (state.inline.token !== token ||
        state.inline.reportNumber !== context.reportNumber ||
        String(state.inline.user).toLowerCase() !==
        context.user.toLowerCase()) {
        return false;
    }
    if (String(reportNumber || '').trim() !== context.reportNumber ||
        String(user || '').trim().toLowerCase() !==
        context.user.toLowerCase()) {
        return false;
    }

    var requestedId = String(receiptId === null || receiptId === undefined
        ? '' : receiptId).trim();
    if (requestedId === '') {
        return false;
    }

    return state.inline.rows.some(function (row) {
        return isCashFailedLineRow(row, context.reportNumber, context.user) &&
            String(row.RECEIPT_ID) === requestedId;
    });
}

function cashFailedLinesBuildSection(rows) {
    var section = document.createElement('div');
    section.id = 'cashFailedLinesSection';
    section.className = 'cash-failed-lines-section';
    section.setAttribute('role', 'region');
    section.setAttribute('aria-label', 'Failed Cash Lines');
    section.style.marginTop = '10px';
    section.style.padding = '10px';
    section.style.boxSizing = 'border-box';
    section.style.border = '1px solid #e0b4b4';
    section.style.borderRadius = '4px';
    section.style.backgroundColor = '#fff7f7';

    var heading = document.createElement('div');
    heading.className = 'cash-failed-lines-heading';
    heading.style.display = 'flex';
    heading.style.alignItems = 'center';
    heading.style.justifyContent = 'space-between';
    heading.style.gap = '8px';
    heading.style.marginBottom = '8px';

    var title = document.createElement('span');
    title.className = 'cash-failed-lines-title';
    title.style.fontWeight = '700';
    title.style.color = '#7f1d1d';
    title.textContent = 'Failed Cash Lines';

    var count = document.createElement('span');
    count.className = 'cash-failed-lines-count';
    count.style.color = '#7f1d1d';
    count.style.fontSize = '13px';
    count.textContent = String(rows.length) +
        (rows.length === 1 ? ' receipt' : ' receipts');

    heading.appendChild(title);
    heading.appendChild(count);
    section.appendChild(heading);

    var host = document.createElement('div');
    host.id = 'cashFailedLinesHost';
    host.className = 'cash-failed-lines-host';
    host.style.width = '100%';
    section.appendChild(host);

    return {
        section: section,
        host: host,
        heading: heading,
        count: count
    };
}

function cashFailedLinesOpenFallbackPopup() {
    var state = getCashFailedLinesHostState();
    if (!state || !state.rows.length || !isReceiptBasedCashCategory() ||
        !isCashLinesPageCurrent()) {
        return;
    }
    if (typeof Popup === 'undefined' || !Popup ||
        typeof Popup.openPage !== 'function') {
        return;
    }

    cashFailedLinesSetInlineContext(state.rows);
    cashFailedLinesSetInlineHandoff(state.rows);
    Popup.openPage('ReceiptLineSelection.html', function(){}, '80%', '90%');
}

function cashFailedLinesAttachFallbackButton(host) {
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'cashFailedLinesOpenPicker';
    button.className = 'cash-failed-lines-open';
    button.textContent = 'Open Failed Cash Lines';
    button.style.padding = '6px 12px';
    button.style.border = '1px solid #b91c1c';
    button.style.borderRadius = '4px';
    button.style.backgroundColor = '#ffffff';
    button.style.color = '#7f1d1d';
    button.style.cursor = 'pointer';
    button.addEventListener('click', cashFailedLinesOpenFallbackPopup);
    host.appendChild(button);
}

function mountCashFailedLinesSection(rows) {
    var state = getCashFailedLinesHostState();
    var container = cashFailedLinesGetTableContainer();

    if (!state || !container || !container.parentNode) {
        return false;
    }

    cashFailedLinesRemoveSection();

    var built = cashFailedLinesBuildSection(rows);
    container.parentNode.insertBefore(built.section, container.nextSibling);
    cashFailedLinesSetInlineContext(rows);

    var supportsInlineFrame = built.host &&
        typeof built.host.moveBefore === 'function' &&
        typeof Popup !== 'undefined' && Popup &&
        typeof Popup.asIframe === 'function' &&
        (typeof App === 'undefined' || !App ||
            typeof App.isSPA !== 'function' || App.isSPA() === true);

    if (supportsInlineFrame) {
        try {
            cashFailedLinesSetInlineHandoff(rows);
            Popup.asIframe(
                'ReceiptLineSelection.html',
                'cashFailedLinesHost',
                null,
                Math.min(300, 84 + rows.length * 54) + 'px',
                '100%'
            );

            var hint = document.createElement('span');
            hint.className = 'cash-failed-lines-hint';
            hint.style.fontSize = '13px';
            hint.style.color = '#7f1d1d';
            hint.style.whiteSpace = 'nowrap';
            hint.style.marginInlineEnd = 'auto';
            hint.textContent = 'Click to add';
            built.heading.insertBefore(hint, built.count);

            return true;
        } catch (error) {
            supportsInlineFrame = false;
            invalidateCashFailedLinesHandoff();
        }
    }

    cashFailedLinesAttachFallbackButton(built.host);
    return true;
}

function ensureCashFailedLinesSectionMounted() {
    var state = getCashFailedLinesHostState();

    if (!state || !state.rows.length || !isReceiptBasedCashCategory() ||
        !isCashLinesPageCurrent()) {
        return false;
    }
    if (document.getElementById('cashFailedLinesSection')) {
        return true;
    }

    return mountCashFailedLinesSection(state.rows);
}

function cashFailedLinesRequestIsCurrent(token) {
    var state = getCashFailedLinesHostState();
    var context = getCashFailedLinesReportContext();

    if (!state || state.token !== token || state.status !== 'loading' ||
        !context.valid || !isReceiptBasedCashCategory() ||
        !isCashLinesPageCurrent()) {
        return false;
    }

    return context.reportNumber === state.reportNumber &&
        context.user.toLowerCase() === state.user.toLowerCase();
}

function refreshCashFailedLinesPanel(force) {
    var context = getCashFailedLinesReportContext();
    var state = getCashFailedLinesHostState();

    if (!context.valid || !state || !isReceiptBasedCashCategory() ||
        !isCashLinesPageCurrent()) {
        clearCashFailedLinesSection();
        return;
    }
    if (typeof Services === 'undefined' || !Services ||
        typeof Services.callWebServiceWithAllParams !== 'function') {
        clearCashFailedLinesSection();
        return;
    }

    var requestKey = context.reportNumber + '\n' + context.user.toLowerCase();
    if (force !== true && state.requestKey === requestKey &&
        (state.status === 'loading' || state.status === 'ready' ||
        state.status === 'error')) {
        if (state.status === 'ready') {
            ensureCashFailedLinesSectionMounted();
        }
        return;
    }

    state.token += 1;
    var token = state.token;
    state.status = 'loading';
    state.requestKey = requestKey;
    state.reportNumber = context.reportNumber;
    state.user = context.user;
    state.rows = [];
    state.handoff = null;
    state.inline = null;
    cashFailedLinesRemoveSection();

    Services.callWebServiceWithAllParams(
        'ReceiptBatch_get_report_rpa_data',
        undefined,
        function (response) {
            if (!cashFailedLinesRequestIsCurrent(token)) {
                return;
            }

            var elements = response && response.Response &&
                response.Response.ReceiptBatch_get_report_rpa_dataElements;
            var rawRows = elements ?
                elements.REPORT_CASH_RECEIPTS : undefined;
            var failedRows = filterCashFailedLinesRows(
                rawRows,
                state.reportNumber,
                state.user
            );

            state.status = 'ready';
            state.rows = failedRows;

            if (failedRows.length > 0) {
                mountCashFailedLinesSection(failedRows);
            } else {
                cashFailedLinesRemoveSection();
            }
        },
        function () {
            if (!cashFailedLinesRequestIsCurrent(token)) {
                return;
            }
            state.status = 'error';
            state.rows = [];
            cashFailedLinesRemoveSection();
        },
        true,
        false,
        { REPORT_NUMBER: escapeCashFailedLinesSqlText(context.reportNumber) }
    );
}

function getCashFailedLinesLifecycle() {
    if (typeof window === 'undefined' || !window) {
        return null;
    }
    if (!window.__cashFailedLinesLifecycle) {
        window.__cashFailedLinesLifecycle = {
            pageChangedWrapper: null,
            previousPageChanged: null
        };
    }
    return window.__cashFailedLinesLifecycle;
}

function bindCashFailedLinesPageChanged() {
    if (typeof Events === 'undefined' || !Events) {
        return;
    }

    var lifecycle = getCashFailedLinesLifecycle();
    if (!lifecycle || (lifecycle.pageChangedWrapper &&
        Events.pageChanged === lifecycle.pageChangedWrapper)) {
        return;
    }

    lifecycle.previousPageChanged =
        typeof Events.pageChanged === 'function' ? Events.pageChanged : null;
    lifecycle.pageChangedWrapper = function () {
        var previous = lifecycle.previousPageChanged;
        var result = previous ? previous.apply(this, arguments) : undefined;

        if (!isCashLinesPageCurrent()) {
            clearCashFailedLinesSection();
        }

        return result;
    };
    Events.pageChanged = lifecycle.pageChangedWrapper;
}

function bindCashFailedLinesLifecycle() {
    if (typeof $ === 'function') {
        $(window)
            .off('pagehide.cashFailedLines')
            .on('pagehide.cashFailedLines', function (event) {
                var originalEvent = event && (event.originalEvent || event);
                if (originalEvent && originalEvent.persisted) {
                    return;
                }
                clearCashFailedLinesSection();
            });
    }
    bindCashFailedLinesPageChanged();
}

