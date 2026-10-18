var user = ServiceManager.getInput("EBS_USER");

var transactionsResponse = Services.call("ReceiptBatch_TransactionByUser", {
  "EBS_USER": user
});

var error = ServiceManager.getResponseValue(transactionsResponse, "Error");
if (error && error.length !== 0) {
  throw error;
}

var batchResponse = Services.call("ReceiptBatch_get_by_userAndStatuses", {
  "EBS_USER": user,
  "ReceiptBatch_statuses": "PROCESSED,READY"
});

error = ServiceManager.getResponseValue(batchResponse, "Error");
if (error && error.length !== 0) {
  throw error;
}

var TRANSACTION_IDS = ServiceManager.getResponseArray(transactionsResponse, "TRANSACTION_ID") || [];
var TRANSACTION_AMOUNTS = ServiceManager.getResponseArray(transactionsResponse, "TRANSACTION_AMOUNT") || [];
var TRANSACTION_EXPENSE_TYPES = ServiceManager.getResponseArray(transactionsResponse, "TRANSACTION_EXPENSE_TYPE") || [];
var TRANSACTION_RECEIPT_DATES = ServiceManager.getResponseArray(transactionsResponse, "TRANSACTION_RECEIPT_DATE") || [];
var TRANSACTION_MERCHANTS = ServiceManager.getResponseArray(transactionsResponse, "TRANSACTION_MERCHANT") || [];

var RECEIPTBATCH_RECEIPT_IDS = ServiceManager.getResponseArray(batchResponse, "RECEIPTBATCH_RECEIPT_ID") || [];
var RECEIPTBATCH_TOTAL_AMOUNTS = ServiceManager.getResponseArray(batchResponse, "RECEIPTBATCH_TOTAL_AMOUNT") || [];
var RECEIPTBATCH_EXPENSE_TYPES = ServiceManager.getResponseArray(batchResponse, "RECEIPTBATCH_EXPENSE_TYPE") || [];
var RECEIPTBATCH_RECEIPT_DATES = ServiceManager.getResponseArray(batchResponse, "RECEIPTBATCH_RECEIPT_DATE") || [];
var RECEIPTBATCH_MERCHANTS = ServiceManager.getResponseArray(batchResponse, "RECEIPTBATCH_MERCHANT") || [];

/**********************************************************************/

function normalizeText(txt) {
  if (txt === null || txt === undefined) {
    return "";
  }
  return String(txt).trim().toLowerCase();
}

function normalizeAmount(val) {
  if (val === null || val === undefined || String(val).trim() === "") {
    return null;
  }

  var num = Number(String(val).replace(/,/g, "").trim());
  if (isNaN(num)) {
    return null;
  }

  return num;
}

function normalizeDate(val) {
  if (val === null || val === undefined) {
    return "";
  }
  return String(val).trim();
}

/**********************************************************************/
/* Normalize transaction arrays */

for (var i = 0; i < TRANSACTION_AMOUNTS.length; i++) {
  TRANSACTION_AMOUNTS[i] = normalizeAmount(TRANSACTION_AMOUNTS[i]);
}

for (var i = 0; i < TRANSACTION_EXPENSE_TYPES.length; i++) {
  TRANSACTION_EXPENSE_TYPES[i] = normalizeText(TRANSACTION_EXPENSE_TYPES[i]);
}

for (var i = 0; i < TRANSACTION_RECEIPT_DATES.length; i++) {
  TRANSACTION_RECEIPT_DATES[i] = normalizeDate(TRANSACTION_RECEIPT_DATES[i]);
}

for (var i = 0; i < TRANSACTION_MERCHANTS.length; i++) {
  TRANSACTION_MERCHANTS[i] = normalizeText(TRANSACTION_MERCHANTS[i]);
}

/* Normalize receipt batch arrays */

for (var i = 0; i < RECEIPTBATCH_TOTAL_AMOUNTS.length; i++) {
  RECEIPTBATCH_TOTAL_AMOUNTS[i] = normalizeAmount(RECEIPTBATCH_TOTAL_AMOUNTS[i]);
}

for (var i = 0; i < RECEIPTBATCH_EXPENSE_TYPES.length; i++) {
  RECEIPTBATCH_EXPENSE_TYPES[i] = normalizeText(RECEIPTBATCH_EXPENSE_TYPES[i]);
}

for (var i = 0; i < RECEIPTBATCH_RECEIPT_DATES.length; i++) {
  RECEIPTBATCH_RECEIPT_DATES[i] = normalizeDate(RECEIPTBATCH_RECEIPT_DATES[i]);
}

for (var i = 0; i < RECEIPTBATCH_MERCHANTS.length; i++) {
  RECEIPTBATCH_MERCHANTS[i] = normalizeText(RECEIPTBATCH_MERCHANTS[i]);
}

/**********************************************************************/
/* Optional validation */

if (
  TRANSACTION_IDS.length !== TRANSACTION_AMOUNTS.length ||
  TRANSACTION_IDS.length !== TRANSACTION_EXPENSE_TYPES.length ||
  TRANSACTION_IDS.length !== TRANSACTION_RECEIPT_DATES.length ||
  TRANSACTION_IDS.length !== TRANSACTION_MERCHANTS.length
) {
  throw "Transaction response arrays are not aligned";
}

if (
  RECEIPTBATCH_RECEIPT_IDS.length !== RECEIPTBATCH_TOTAL_AMOUNTS.length ||
  RECEIPTBATCH_RECEIPT_IDS.length !== RECEIPTBATCH_EXPENSE_TYPES.length ||
  RECEIPTBATCH_RECEIPT_IDS.length !== RECEIPTBATCH_RECEIPT_DATES.length ||
  RECEIPTBATCH_RECEIPT_IDS.length !== RECEIPTBATCH_MERCHANTS.length
) {
  throw "Receipt batch response arrays are not aligned";
}

/**********************************************************************/

// var metchesTransactionIds = [];
// var metchesReciptIds = [];

var usedReceiptIndex = [];
for (var i = 0; i < RECEIPTBATCH_RECEIPT_IDS.length; i++) {
  usedReceiptIndex[i] = false;
}
/************************************************************/
// console.log("===== MATCH TEST START =====");
// console.log("TRANSACTION_IDS =", JSON.stringify(TRANSACTION_IDS));
// console.log("RECEIPTBATCH_RECEIPT_IDS =", JSON.stringify(RECEIPTBATCH_RECEIPT_IDS));
// console.log("TRANSACTION_AMOUNTS =", JSON.stringify(TRANSACTION_AMOUNTS));
// console.log("RECEIPTBATCH_TOTAL_AMOUNTS =", JSON.stringify(RECEIPTBATCH_TOTAL_AMOUNTS));
// console.log("TRANSACTION_EXPENSE_TYPES =", JSON.stringify(TRANSACTION_EXPENSE_TYPES));
// console.log("RECEIPTBATCH_EXPENSE_TYPES =", JSON.stringify(RECEIPTBATCH_EXPENSE_TYPES));
// console.log("TRANSACTION_RECEIPT_DATES =", JSON.stringify(TRANSACTION_RECEIPT_DATES));
// console.log("RECEIPTBATCH_RECEIPT_DATES =", JSON.stringify(RECEIPTBATCH_RECEIPT_DATES));
// console.log("TRANSACTION_MERCHANTS =", JSON.stringify(TRANSACTION_MERCHANTS));
// console.log("RECEIPTBATCH_MERCHANTS =", JSON.stringify(RECEIPTBATCH_MERCHANTS));
// console.log("usedReceiptIndex INIT =", JSON.stringify(usedReceiptIndex));

/***********************************************************/
for (var tIdx = 0; tIdx < TRANSACTION_IDS.length; tIdx++) {
  for (var rIdx = 0; rIdx < RECEIPTBATCH_RECEIPT_IDS.length; rIdx++) {
    if (usedReceiptIndex[rIdx]) {
      continue;
    }

    var amountMatch =
      TRANSACTION_AMOUNTS[tIdx] !== null &&
      RECEIPTBATCH_TOTAL_AMOUNTS[rIdx] !== null &&
      TRANSACTION_AMOUNTS[tIdx] === RECEIPTBATCH_TOTAL_AMOUNTS[rIdx];

    var typeMatch =
      TRANSACTION_EXPENSE_TYPES[tIdx] !== "" &&
      RECEIPTBATCH_EXPENSE_TYPES[rIdx] !== "" &&
      TRANSACTION_EXPENSE_TYPES[tIdx] === RECEIPTBATCH_EXPENSE_TYPES[rIdx];

    var dateMatch =
      TRANSACTION_RECEIPT_DATES[tIdx] !== "" &&
      RECEIPTBATCH_RECEIPT_DATES[rIdx] !== "" &&
      TRANSACTION_RECEIPT_DATES[tIdx] === RECEIPTBATCH_RECEIPT_DATES[rIdx];

    var merchantMatch =
      TRANSACTION_MERCHANTS[tIdx] !== "" &&
      RECEIPTBATCH_MERCHANTS[rIdx] !== "" &&
      TRANSACTION_MERCHANTS[tIdx] === RECEIPTBATCH_MERCHANTS[rIdx];

    // console.log(
    //   "Transaction ID " + TRANSACTION_IDS[tIdx] +
    //   " | Receipt ID " + RECEIPTBATCH_RECEIPT_IDS[rIdx] +
    //   " | amountMatch=" + amountMatch +
    //   " | typeMatch=" + typeMatch +
    //   " | dateMatch=" + dateMatch +
    //   " | merchantMatch=" + merchantMatch
    // );
    

    if (amountMatch && typeMatch && dateMatch && merchantMatch) {
      Services.call("updateMatchingCreditTransaction",{
          "TRANSACTION_ID": TRANSACTION_IDS[tIdx],
          "RECEIPT_ID": RECEIPTBATCH_RECEIPT_IDS[rIdx]
      });
    //   metchesTransactionIds.push(TRANSACTION_IDS[tIdx]);
    //   metchesReciptIds.push(RECEIPTBATCH_RECEIPT_IDS[rIdx]);
      usedReceiptIndex[rIdx] = true;
      break;
    }
  }
}

// console.log("FINAL metchesTransactionIds =", JSON.stringify(metchesTransactionIds));
// console.log("FINAL metchesReciptIds =", JSON.stringify(metchesReciptIds));

return {
//   "metchesTransactions": metchesTransactionIds,
//   "metchesRecipts": metchesReciptIds
};