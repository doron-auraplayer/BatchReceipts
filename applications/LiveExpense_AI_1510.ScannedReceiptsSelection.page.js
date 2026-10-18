var statuses = "PROCESSED";

function hideCreditRows() {
  $('#tableOutput tbody tr').each(function (index) {
    var creditValue = Storage.get('RECEIPTBATCH_CREDIT_' + index);

    var hasCredit =
      creditValue !== null &&
      creditValue !== undefined &&
      String(creditValue).trim() !== '';

    $(this).toggle(!hasCredit);
  });
}

function onLoad() {
//   Storage.set("AllowApprove","allowApprove");//allowing viewer approval from this screen  
  configureReceiptViewer({
    allowApprove: true,
    showData: true,
    allowEdit: false
  });
  
  loadReceiptBatchesByUserAndStatuses(statuses);      
  
    setTimeout(function () {
    var table = $('#tableOutput').DataTable();

    table.off('draw.creditRows').on('draw.creditRows', function () {
      hideCreditRows();
    });

    hideCreditRows();
  }, 100);
}
    

function approveReceipt() {
  /* based on cashlines.function openDetailedLine(rowId) */  
  Storage.set("ApproveScannedReceipt","true");  
  Storage.set('index', Storage.count('CashLines_ExpenseType_0'));
  Storage.remove("LineDetailsUpdate");
  
  Services.call(
    "iExpense_cash_openLineDetails",
    function () {
      Page.navigate('LineDetails.html');
    },
    displayReportServiceError("Failed to open detailed expense line")
  );
}

function onTableClick(row, col, rowCells) {
    Storage.set("receipt_ID", Storage.get("RECEIPTBATCH_RECEIPT_ID_" + row));
    Storage.set("PreviewExpenseType", Storage.get("RECEIPTBATCH_EXPENSE_TYPE_" + row));
    Storage.set("PreviewAmount", Storage.get("RECEIPTBATCH_TOTAL_AMOUNT_" + row));
    Storage.set("PreviewReceiptDate", Storage.get("RECEIPTBATCH_RECEIPT_DATE_" + row));
    Storage.set("PreviewMerchant", Storage.get("RECEIPTBATCH_MERCHANT_" + row));
    Storage.set("PreviewLocation", Storage.get("RECEIPTBATCH_LOCATION_" + row));
    Storage.set("PreviewStatus", Storage.get("RECEIPTBATCH_STATUS_" + row));	
    
    Preview(row);
}

/***** TAB: 1 *****/
// var statuses = "PROCESSED";

// function hideCreditRows() {
//   $('#tableOutput tbody tr').each(function (index) {
//     var creditValue = Storage.get('RECEIPTBATCH_CREDIT_' + index);

//     var hasCredit =
//       creditValue !== null &&
//       creditValue !== undefined &&
//       String(creditValue).trim() !== '';

//     $(this).toggle(!hasCredit);
//   });
// }

// function onLoad() {
// //   Storage.set("AllowApprove","allowApprove");//allowing viewer approval from this screen  
//   configureReceiptViewer({
//     allowApprove: true,
//     showData: true,
//     allowEdit: false
//   });
  
//   loadReceiptBatchesByUserAndStatuses(statuses);      
  
//     setTimeout(function () {
//     var table = $('#tableOutput').DataTable();

//     table.off('draw.creditRows').on('draw.creditRows', function () {
//       hideCreditRows();
//     });

//     hideCreditRows();
//   }, 100);
// }
    

// function approveReceipt() {
//   /* based on cashlines.function openDetailedLine(rowId) */  
//   Storage.set("ApproveScannedReceipt","true");  
//   Storage.set('index', Storage.count('CashLines_ExpenseType_0'));
//   Storage.remove("LineDetailsUpdate");
  
//   Services.call(
//     "iExpense_cash_openLineDetails",
//     function () {
//       Page.navigate('LineDetails.html');
//     },
//     displayReportServiceError("Failed to open detailed expense line")
//   );
// }

// function onTableClick(row, col, rowCells) {
//     Storage.set("receipt_ID", Storage.get("RECEIPTBATCH_RECEIPT_ID_" + row));
//     Storage.set("PreviewExpenseType", Storage.get("RECEIPTBATCH_EXPENSE_TYPE_" + row));
//     Storage.set("PreviewAmount", Storage.get("RECEIPTBATCH_TOTAL_AMOUNT_" + row));
//     Storage.set("PreviewReceiptDate", Storage.get("RECEIPTBATCH_RECEIPT_DATE_" + row));
//     Storage.set("PreviewMerchant", Storage.get("RECEIPTBATCH_MERCHANT_" + row));
//     Storage.set("PreviewLocation", Storage.get("RECEIPTBATCH_LOCATION_" + row));
//     Storage.set("PreviewStatus", Storage.get("RECEIPTBATCH_DEPARTMENT_" + row));	
    
//     Preview(row);
// }
