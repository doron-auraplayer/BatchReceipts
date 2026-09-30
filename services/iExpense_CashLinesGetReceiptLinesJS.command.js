var sessionId = ServiceManager.getInput("sessionId");


var CashLines_Index = [];
var CashLines_Date = [];
var CashLines_ReceiptAmount = [];
var CashLines_ExpenseType = [];
var CashLines_Justification = [];
var CashLines_ReimbAmount = [];
var CashLines_ReimbursableColumnHeader;
var paginationExist;
var paginationLabel;
var nextEnabled;
var previousEnabled;
var response;
var error;
var recieptTabHeader;
var perDiemTabHeader;
var mileageTabHeader;
var cashLinesWindowSize = ServiceManager.getInput("CashLinesWindowSize")

for (var i=0; i<cashLinesWindowSize; i++) {
    response = Services.call("iExpense_CashLinesGetReceiptLine", {
    	"lineIndex": i,
    	"sessionId": sessionId,
    	"keepAlive": true
    });
    error = ServiceManager.getResponseValue(response, 'Error');
    if (error.length !== 0) {
    	throw(error);
    }
    CashLines_Index.push(Services.getResponseValue(response, "CashLines_Index"));
    CashLines_Date.push(Services.getResponseValue(response, "CashLines_Date"));
    CashLines_ReceiptAmount.push(Services.getResponseValue(response, "CashLines_ReceiptAmount"));
    CashLines_ExpenseType.push(Services.getResponseValue(response, "CashLines_ExpenseType"));
    CashLines_Justification.push(Services.getResponseValue(response, "CashLines_Justification"));
    CashLines_ReimbAmount.push(Services.getResponseValue(response, "CashLines_ReimbAmount"));
    CashLines_ReimbursableColumnHeader = Services.getResponseValue(response, "CashLines_ReimbursableColumnHeader");
    paginationExist = Services.getResponseValue(response, "paginationExist");
    paginationLabel = Services.getResponseValue(response, "paginationLabel");
    nextEnabled = Services.getResponseValue(response, "nextEnabled");
    previousEnabled = Services.getResponseValue(response, "previousEnabled");
    if (i===0) {
        recieptTabHeader = Services.getResponseValue(response, "CashLines_Receipt_header");
        perDiemTabHeader = Services.getResponseValue(response, "CashLines_Mileage_header");
        mileageTabHeader = Services.getResponseValue(response, "CashLines_PerDiem_header");
    }
    
}

return {
    "CashLines_Index": CashLines_Index,
    "CashLines_Date": CashLines_Date,
    "CashLines_ReceiptAmount": CashLines_ReceiptAmount,
    "CashLines_ExpenseType": CashLines_ExpenseType,
    "CashLines_Justification": CashLines_Justification,
    "CashLines_ReimbAmount": CashLines_ReimbAmount,
    "CashLines_ReimbursableColumnHeader": CashLines_ReimbursableColumnHeader,
    "paginationExist" : paginationExist,
    "paginationLabel": paginationLabel,
    "nextEnabled": nextEnabled,
    "previousEnabled": previousEnabled,
    "CashLines_Receipt_header": recieptTabHeader,
    "CashLines_Mileage_header": perDiemTabHeader,
    "CashLines_PerDiem_header": mileageTabHeader
    
};