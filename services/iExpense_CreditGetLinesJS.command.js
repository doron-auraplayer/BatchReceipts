var sessionId = ServiceManager.getInput("sessionId");


var CreditLinesLineNum = [];
var CreditTransactionDate = [];
var CreditTransactionAmount = [];
var CreditTransactionExpenseType = [];
var CreditTransactionMerchantName = [];
var CreditTransactionJustification = [];
var paginationExist;
var paginationLabel;
var nextEnabled;
var previousEnabled;
var response;
var error;
var recieptTabHeader;
var perDiemTabHeader;
var mileageTabHeader;

for (var i=0; i<=10; i++) {
    response = Services.call("iExpense_credit_getCreditLine", {
    	"creditLineIndex": i,
    	"sessionId": sessionId,
    	"keepAlive": true
    });
    error = ServiceManager.getResponseValue(response, 'Error');
    if (error.length !== 0) {
    	throw(error);
    }
    CreditLinesLineNum.push(Services.getResponseValue(response, "CreditLinesLineNum"));
    if (CreditLinesLineNum[i].length ===  0) {
        break;
    }
    CreditTransactionDate.push(Services.getResponseValue(response, "CreditTransactionDate"));
    CreditTransactionAmount.push(Services.getResponseValue(response, "CreditTransactionAmount"));
    CreditTransactionExpenseType.push(Services.getResponseValue(response, "CreditTransactionExpenseType"));
    CreditTransactionMerchantName.push(Services.getResponseValue(response, "CreditTransactionMerchantName"));
    CreditTransactionJustification.push(Services.getResponseValue(response, "CreditTransactionJustification"));
    paginationExist = Services.getResponseValue(response, "paginationExist");
    paginationLabel = Services.getResponseValue(response, "paginationLabel");
    nextEnabled = Services.getResponseValue(response, "nextEnabled");
    previousEnabled = Services.getResponseValue(response, "previousEnabled");
}

return {
    "CreditLinesLineNum": CreditLinesLineNum,
    "CreditTransactionDate": CreditTransactionDate,
    "CreditTransactionAmount": CreditTransactionAmount,
    "CreditTransactionExpenseType": CreditTransactionExpenseType,
    "CreditTransactionMerchantName": CreditTransactionMerchantName,
    "CreditTransactionJustification": CreditTransactionJustification,
    "paginationExist" : paginationExist,
    "paginationLabel": paginationLabel,
    "nextEnabled": nextEnabled,
    "previousEnabled": previousEnabled
};