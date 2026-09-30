//var filePath = ServiceManager.getInput("AttachFilePath");
var filePath = ServiceManager.getInput("ScanReceipt");
var fileAbsPath = Utils.getServerPath() + filePath;

var response = Services.call("IExpense_AnalyzeReceipt_NEW", {
	"ReceiptContent": Files.readFileBase64(filePath),
	"keepAlive":false
});
var error = ServiceManager.getResponseValue(response, 'Error');
if (error.length !== 0) {
	throw(error);
}
//console.log(JSON.stringify(response));
var Amount = ServiceManager.getResponseValue(response, 'Amount');


return {
    filePath: fileAbsPath,
    Amount: ServiceManager.getResponseValue(response, 'Amount'),
    Tax: ServiceManager.getResponseValue(response, 'Tax'),
    MerchantName: ServiceManager.getResponseValue(response, 'MerchantName'),
    AnalyzeReceiptType: ServiceManager.getResponseValue(response, 'AnalyzeReceiptType'),
    Location: ServiceManager.getResponseValue(response, 'Location'),
    ReceiptDate: ServiceManager.getResponseValue(response, 'ReceiptDate')
};