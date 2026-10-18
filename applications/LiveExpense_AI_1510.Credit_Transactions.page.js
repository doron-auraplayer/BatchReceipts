function setNextPrevButtons() {
    // set prev/next button
    var paginationExists = Storage.get("paginationExists") === 'true';

    if (paginationExists) {
        $('#Previous').show();
        $("#Next").show();
        $("#listRange").show();
        var nextButtonExists = Storage.get('nextButtonExist') == 'true';
        $('#Next').prop( "disabled", !nextButtonExists);
        $("#Next").text(getPaginationButtonLabel("Next", Storage.get("nextButtonLabel") !== ""?Storage.get("nextButtonLabel"):"Next"));
    
        var prevButtonExists = Storage.get('prevButtonExist') == 'true';
        $('#Previous').prop( "disabled", !prevButtonExists);
        $("#Previous").text(getPaginationButtonLabel("Previous", Storage.get("prevButtonLabel") !== ""?Storage.get("prevButtonLabel"):"Previous"));
    
        $("#listRange").text(Storage.get("currentListRange"));
    } else {
        $('#Previous').hide();
        $("#Next").hide();
        $("#listRange").hide();
    }
}

function onGetTransactionSuccess() {
  if (Table.countRows() > 0) {
    transactionsMatching(function () {
      renderMatchedColumn();
      bindMatchedClick();

      var table = $('#tableOutput').DataTable();
      table.off('draw.matched').on('draw.matched', function () {
        renderMatchedColumn();
      });

      addActionListeners();
      setNextPrevButtons();
    });
  }
}

function onLoad() {
  configureReceiptViewer({
    allowApprove: false,
    showData: false,
    allowEdit: false
  });
    
    Storage.set("hasCreditLinesStep", true); //so in Cash_Lines we will know where to get back

    Table.setColumn('Select_0', false);
    Storage.deleteByPrefix('Select_');  // otherwise array size of 'Select_*' might be different than returned data
    Storage.deleteByPrefix('MatchReciptId_');
    Storage.deleteByPrefix('Match_');
    
    $("#Next_").text(getTranslationForId("Next"));

    // set prev/next button
    $('#Next').prop( "disabled",  true);
    $('#Next').parent().prop( "style",  'flex: 1 1 50px !important');
    $('#Previous').prop( "disabled", true);
    $('#Previous').parent().prop( "style",  'flex: 1 1 50px !important');
    $("<span id='listRange' style='flex: 1 1 50px !important; text-align: center; align-self: center'></span>").insertAfter($("#Previous").parent());
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
    Storage.remove("currentListRange");

	Services.call('iExpense_credit_getTransactions', function() {
	    var hasTransactions = Storage.get("hasTransactions").toLowerCase() === 'true';

	    if (!hasTransactions) {
            Table.clear();
	        Popup.custom(getTranslationForId("@popup_title_no_transactions"), getTranslationForId("@popup_message_no_transactions"), getTranslationForId("@popup_message_no_transactions_button_cancel"), getTranslationForId("@popup_message_no_transactions_button_next"), function() {
	            OnCancel();
	        }, function() {
            	Services.call('iExpense_credit_next', function() {
    	            store("hasCreditLines", false); //so in Cash_Lines we will know we can skip immediatly to next
                    Page.navigate('Cash_Lines.html');
            	});
	        })
	    }
	    onGetTransactionSuccess();
	    
	}, displayReportServiceError("Failed to get credit transactions"));
}

function onNextTrans() {
    var updateMode = Storage.get("updateMode").toLowerCase() === 'true';
    var selection = Table.getColumn('Select_0');
    if (!updateMode && selection.indexOf(true) === -1) {
            // if we are not in new report and no selection made goto directly to cash lines
            store("hasCreditLines", false);     
            Services.call('iExpense_credit_next', function() {Page.navigate("Cash_Lines.html");});
            return;
    }
    // if some selections where made or we are in udpate mode and even no selection made we need to mark the transaction 
    // as one could have unchecked a selection

    // var input = [];
    // for (var i = 0; i < selection.length; i++) {
    //     input.push({"select": String(selection[i])});
    // }
    // Storage.set('selection', JSON.stringify(input));

    Storage.set('selection', selection);
	Services.call('iExpense_credit_markTransactions', onMarkSuccessNext, displayReportServiceError("Failed to mark transactions"));
}

function onMarkSuccessNext() {
	Services.call('iExpense_credit_gotoUpdateTransactions', function() {
        var wizardTitle = Storage.get("WizardTitle");
        // The only way we know if there are marked transactions is from the next step as a transactions
        // might be marked on the next pagination page
        if (wizardTitle.toLowerCase().indexOf("credit card expenses") > -1) {
            Page.navigate('Credit_Lines.html');
        } else if (wizardTitle.toLowerCase().indexOf("cash and other expenses") > -1) {
            store("hasCreditLines", false);     
            Page.navigate("Cash_Lines.html");
        } else {
            Popup.ok(getTranslationForId("@popup_title_error"), "Got to unexpected page: " + Storage.get("WizardTitle"));
        }




        // var selection = Table.getColumn('Select_0');
        // if (selection.indexOf(true) === -1) {
        //     // This could happen if we are in update mode and the user de-selected all lines
        //     store("hasCreditLines", false);     
        //     Page.navigate("Cash_Lines.html");
        // } else {
        //     // This section is relevant if any selection was made
        //     // var selectedRows = Table.toArray('Select');
        //     // Table.setSource('Credit_Lines.html', selectedRows);
        //     Page.navigate('Credit_Lines.html');
        // }
	}, displayReportServiceError("Failed to move to cash lines"));
}

function prepare_iExpense_credit_getCreditCards_lov_request() {
    var inputParams = {};

    return inputParams;
}
function CreditCardList_lov_item_presenter(arrayItem) {
    var lovItems = [];
    lovItems.push(arrayItem["CreditCardList"]);

    return lovItems.join(",");
}
function CreditCardPoplist_lov_item_presenter(arrayItem) {
    var lovItems = [];
    lovItems.push(arrayItem["CreditCardList"]);

    return lovItems.join(",");
}
function CreditCardPoplist_lov_item_handler(arrayItem) {
    Fields.setAndStore("CreditCardList", arrayItem["CreditCardList"]);
	populateField("CreditCardPoplist", arrayItem[Object.keys(arrayItem)[0]]);
    Table.clear();
    Table.setColumn('Select_0', false);
    Storage.deleteByPrefix('Select_');  // otherwise array size of 'Select_*' might be different than returned data
    Storage.deleteByPrefix('MatchReciptId_');
    Storage.deleteByPrefix('Match_');
    
	Services.call("iExpense_credit_selectCreditCard", function() {
	    var hasTransactions = Storage.get("hasTransactions").toLowerCase() === 'true';
	    if (hasTransactions) {
            Services.call('iExpense_credit_getTransactions', function() {
                transactionsMatching(function () {
                    renderMatchedColumn();
                    addActionListeners();
                    setNextPrevButtons();
                });    
            }, displayReportServiceError("Failed to get credit transactions"));	    
	    }
	    else {
	        Popup.ok("Information", "No transactions available.");
	       // Popup.custom(getTranslationForId("@popup_title_no_transaction"), getTranslationForId("@popup_message_no_transactions1"), 
	       //     getTranslationForId("@popup_message_change_card"),getTranslationForId("@popup_message_no_transactions_button_next"), function() {}, function() {
        //     	Services.call('iExpense_credit_next', function() {
    	   //         store("hasCreditLines", false); //so in Cash_Lines we will know we can skip immediatly to next
        //             Page.navigate('Cash_Lines.html');
        //     	});
	       // })
	    }
	},  displayReportServiceError("Failed to get credit cards list"));
}

function OnCancel() {
  OnCancelPopup(function() {
        var updateMode = Storage.get("updateMode").toLowerCase() === 'true';
        updateMode ? Page.navigate("Update_Reports.html") : Page.navigate("Reports.html");
  });
}

function onNext() {
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
	Storage.set('moveNext', 'true');
    var selection = Table.getColumn('Select_0');
    Storage.set('selection', selection);
    /**************************************/
    for (var tIdx = 0; tIdx < selection.length; tIdx++) {
        if (selection[tIdx]) {
            Storage.set("selectedReciptId_" + tIdx, RECEIPTSBATCH_RECEIPT_ID[tIdx]);
        }
    }
    
    /**********************************/
	Services.call('iExpense_credit_markTransactions', function() {
    	Services.call('iExpense_getCreditTransNextPrev', onGetTransactionSuccess, displayReportServiceError("Failed to fetch next transactions"));
	}, displayReportServiceError("Failed to mark transactions"));
}

function onPrev() {
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
	Storage.set('moveNext', 'false');
    var selection = Table.getColumn('Select_0');
    Storage.set('selection', selection);
	Services.call('iExpense_credit_markTransactions', function() {
    	Services.call('iExpense_getCreditTransNextPrev', onGetTransactionSuccess, displayReportServiceError("Failed to fetch previous transactions"));
	}, displayReportServiceError("Failed to mark transactions"));
}

function onBack() {
	Services.call('iExpense_Back', function() {
            Storage.set("updateMode", true);
            Page.navigate("Report_General.html");
	    } , displayReportServiceError("Failed to to press back button"));
}



/***** TAB: TransactionsMatching *****/

function transactionsMatching(done) {
  Storage.set("EBS_USER", Storage.get("LoggedInUsername"));
  Storage.set("ReceiptBatch_statuses", "PROCESSED");
  
  Services.call("ReceiptBatch_get_by_userAndStatuses", 
    function () {
      var TRANSACTIONS_AMOUNT = Storage.getArray("TransactionAmount");
      var TRANSACTIONS_RECEIPT_DATE = Storage.getArray("TransactionDate");
      var TRANSACTIONS_MERCHANT = Storage.getArray("MerchantName");
      var TRANSACTIONS_LOCATION = Storage.getArray("Location");
    
      var RECEIPTSBATCH_RECEIPT_ID = Storage.getArray("RECEIPTBATCH_RECEIPT_ID");
      var RECEIPTSBATCH_TOTAL_AMOUNT = Storage.getArray("RECEIPTBATCH_TOTAL_AMOUNT");
      // var RECEIPTSBATCH_EXPENSE_TYPE = Storage.getArray("RECEIPTBATCH_EXPENSE_TYPE");
      var RECEIPTSBATCH_RECEIPT_DATE = Storage.getArray("RECEIPTBATCH_RECEIPT_DATE");
      var RECEIPTSBATCH_MERCHANT = Storage.getArray("RECEIPTBATCH_MERCHANT");
      var RECEIPTSBATCH_LOCATION = Storage.getArray("RECEIPTBATCH_LOCATION");
    
    
      /**************** Normalize transaction arrays *****************/
      for (var i = 0; i < TRANSACTIONS_AMOUNT.length; i++) {
        TRANSACTIONS_AMOUNT[i] = normalizeAmount(TRANSACTIONS_AMOUNT[i]);
      }
    
    
      for (var i = 0; i < TRANSACTIONS_RECEIPT_DATE.length; i++) {
        TRANSACTIONS_RECEIPT_DATE[i] = normalizeDate(TRANSACTIONS_RECEIPT_DATE[i]);
      }
    
      for (var i = 0; i < TRANSACTIONS_MERCHANT.length; i++) {
        // console.log("Before normalize:", { index: i, value:TRANSACTIONS_MERCHANT[i] });
        TRANSACTIONS_MERCHANT[i] = normalizeText(TRANSACTIONS_MERCHANT[i]);
        // console.log("After normalize:", {index: i,value: TRANSACTIONS_MERCHANT[i]});
      }
    
      for (var i = 0; i < TRANSACTIONS_LOCATION.length; i++) {
        TRANSACTIONS_LOCATION[i] = normalizeText(TRANSACTIONS_LOCATION[i]);
      }
    
      /**************** Normalize receipt batch arrays *****************/
      for (var i = 0; i < RECEIPTSBATCH_TOTAL_AMOUNT.length; i++) {
        RECEIPTSBATCH_TOTAL_AMOUNT[i] = normalizeAmount(RECEIPTSBATCH_TOTAL_AMOUNT[i]);
      }
    
      for (var i = 0; i < RECEIPTSBATCH_LOCATION.length; i++) {
        RECEIPTSBATCH_LOCATION[i] = normalizeText(RECEIPTSBATCH_LOCATION[i]);
      }
    
      for (var i = 0; i < RECEIPTSBATCH_RECEIPT_DATE.length; i++) {
        RECEIPTSBATCH_RECEIPT_DATE[i] = normalizeDate(RECEIPTSBATCH_RECEIPT_DATE[i]);
      }
    
      for (var i = 0; i < RECEIPTSBATCH_MERCHANT.length; i++) {
        // console.log("Before normalize:", { index: i, value:RECEIPTSBATCH_MERCHANT[i] });
        RECEIPTSBATCH_MERCHANT[i] = normalizeText(RECEIPTSBATCH_MERCHANT[i]);
        // console.log("After normalize:", {index: i,value: RECEIPTSBATCH_MERCHANT[i]});
      }
    
    
      if (
        RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_TOTAL_AMOUNT.length ||
        RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_LOCATION.length ||
        RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_RECEIPT_DATE.length ||
        RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_MERCHANT.length
      ) {
        throw "Receipt batch response arrays are not aligned";
      }
    
      //   var metchesTransactionIds = [];
      //   var metchesReciptIds = [];
    
      var usedReceiptIndex = [];
      for (var i = 0; i < RECEIPTSBATCH_RECEIPT_ID.length; i++) {
        usedReceiptIndex[i] = false;
      }
    
    
      for (var tIdx = 0; tIdx < TRANSACTIONS_RECEIPT_DATE.length; tIdx++) {
        Storage.set("Match_" + tIdx, "false");
        for (var rIdx = 0; rIdx < RECEIPTSBATCH_RECEIPT_ID.length; rIdx++) {
          if (usedReceiptIndex[rIdx]) {
            continue;
          }
            
          var amountMatch =
            TRANSACTIONS_AMOUNT[tIdx] !== null &&
            RECEIPTSBATCH_TOTAL_AMOUNT[rIdx] !== null &&
            TRANSACTIONS_AMOUNT[tIdx] === RECEIPTSBATCH_TOTAL_AMOUNT[rIdx];
    
          var dateMatch =
            TRANSACTIONS_RECEIPT_DATE[tIdx] !== "" &&
            RECEIPTSBATCH_RECEIPT_DATE[rIdx] !== "" &&
            TRANSACTIONS_RECEIPT_DATE[tIdx] === RECEIPTSBATCH_RECEIPT_DATE[rIdx];
    
          var merchantMatch =
            TRANSACTIONS_MERCHANT[tIdx] !== "" &&
            RECEIPTSBATCH_MERCHANT[rIdx] !== "" &&
            TRANSACTIONS_MERCHANT[tIdx] === RECEIPTSBATCH_MERCHANT[rIdx];
            
          var locatinMatch =
            TRANSACTIONS_LOCATION[tIdx] !== "" &&
            RECEIPTSBATCH_LOCATION[rIdx] !== "" &&
            TRANSACTIONS_LOCATION[tIdx] === RECEIPTSBATCH_LOCATION[rIdx];
        
    
        //   console.log(
        //     " | Receipt ID " + RECEIPTSBATCH_RECEIPT_ID[rIdx] +
        //     " | amountMatch=" + amountMatch +
        //     " | dateMatch=" + dateMatch +
        //     " | merchantMatch=" + merchantMatch + 
        //     " | locatinMatch=" + locatinMatch
        //   );

          if (amountMatch && dateMatch && merchantMatch && locatinMatch) {
            // Services.call("updateMatchingCreditTransaction",{
            //     "TRANSACTION_ID": //we dont have  TRANSACTION_ID
            //     "RECEIPT_ID": RECEIPTSBATCH_RECEIPT_ID
            // });
            // metchesTransactionIds.push(TRANSACTIONS_ID[tIdx]);
            // metchesReciptIds.push(RECEIPTSBATCH_RECEIPT_ID[rIdx]);
            usedReceiptIndex[rIdx] = true;
            Storage.set("MatchReciptId_" + tIdx, RECEIPTSBATCH_RECEIPT_ID[rIdx]);
            break;
          }
        }
      }
      
      if (done) 
        done();
      
  }, displayReportServiceError("Failed to get Receipts"));

}

function normalizeText(txt) {
  if (txt === null || txt === undefined) {
    return "";
  }
  return String(txt).trim().toLowerCase();
}

function normalizeAmount(val) {
  if (val === null || val === undefined) {
    return null;
  }

  var s = String(val).trim();
  if (s === "") {
    return null;
  }

  s = s.replace(/,/g, "");
  var match = s.match(/-?\d+(\.\d+)?/);
  if (!match) {
    return null;
  }

  var num = Number(match[0]);
  return isNaN(num) ? null : num;
}

function normalizeDate(val) {
  if (val === null || val === undefined) {
    return "";
  }

  var s = String(val).trim();
  if (s === "") {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  var m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    var day = m[1].padStart(2, "0");
    var mon = m[2].toUpperCase();
    var year = m[3];

    var months = {
      JAN: "01", FEB: "02", MAR: "03", APR: "04",
      MAY: "05", JUN: "06", JUL: "07", AUG: "08",
      SEP: "09", OCT: "10", NOV: "11", DEC: "12"
    };

    if (months[mon]) {
      return year + "-" + months[mon] + "-" + day;
    }
  }

  return s;
}

/*****************************************/

function renderMatchedColumn() {
  var table = $('#tableOutput').DataTable();

  table.column(1).nodes().each(function (cell, rowIdx) {
    var matchValue = Storage.get("MatchReciptId_" + rowIdx);
    var $cell = $(cell);

    $cell.removeAttr('id data-row-id data-receipt-id')
         .removeClass('matched-cell')
         .empty()
         .off('click.matched');

    if (matchValue) {
      $cell.attr('id', 'Matched' + rowIdx)
           .attr('data-row-id', rowIdx)
           .attr('data-receipt-id', matchValue)
           .addClass('matched-cell')
           .html('&#128179;')
           .css({ cursor: 'pointer', textAlign: 'center' })
           .on('click.matched', function () {
             openMatchedReceipt(rowIdx, matchValue);
           });
    }
  });
}

// function openMatchedReceipt(rowIndex, receiptId) {
//   console.log('openMatchedReceipt rowIndex=', rowIndex, 'receiptId=', receiptId);

//   Storage.set('RECEIPTBATCH_RECEIPT_ID', receiptId);
//   Storage.set('receipt_ID', receiptId);

//   Preview(rowIndex);
// }
function openMatchedReceipt(rowIndex, receiptId) {
  Storage.set('RECEIPTBATCH_RECEIPT_ID', receiptId);
  Storage.set('receipt_ID', receiptId);

  clearPreviewReceiptMetadata();

  Services.call(
    'js_ReceiptBatch_get_receipt_by_id',

    function () {
      var documentUrl = Storage.get(
        'RECEIPTBATCH_DOCUMENT_URL'
      );

      var fileType = Storage.get(
        'RECEIPTBATCH_FILE_TYPE'
      );

      if (!documentUrl) {
        documentUrl = Storage.get('DOCUMENT_URL');
      }

      if (!fileType) {
        fileType = Storage.get('FILE_TYPE');
      }

      if (!documentUrl) {
        Popup.ok(
          'Preview',
          'No document URL was returned'
        );
        return;
      }

      showAttachmentPreview(documentUrl, fileType);
    },

    function () {
      Popup.ok(
        'Preview',
        'Failed to load receipt preview'
      );
    }
  );
}

function bindMatchedClick() {
  console.log("bindMatchedClick");

  $(document)
    .off('click.matched', '#tableOutput td.matched-cell')
    .on('click.matched', '#tableOutput td.matched-cell', function (e) {
      var $cell = $(this);

      var rowId = $.trim(String($cell.attr('data-row-id') || ''));
      var receiptId = $.trim(String($cell.attr('data-receipt-id') || ''));

      console.log('clicked rowId =', rowId, 'receiptId =', receiptId);

      if (!rowId) {
        console.log('Missing rowId');
        return;
      }

      if (!receiptId) {
        console.log('Missing receiptId');
        return;
      }

      openMatchedReceipt(parseInt(rowId, 10), receiptId);
    });
}
function addActionListeners() {
//   addTableActionListener("Matched", Preview);
}

function DisplayReport(row, col, rowCells) {
  Storage.set("lineIndexToDisplay", row);
  Services.call("iExpense_getReportDetailsGeneral", function () {
    Page.navigate("Report_Display_General_Details");
  }, displayReportServiceError("Failed to fetch report details"));

}

