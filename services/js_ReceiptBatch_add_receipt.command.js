var ebsUser = ServiceManager.getInput("EBS_USER");
var blob = ServiceManager.getInput("blob");
var fileName = ServiceManager.getInput("fileName");
var fileType = ServiceManager.getInput("fileType");


var payload = {
    "P_EBS_USER": ebsUser,
    "P_BLOB_FILE": blob,
    "P_FILE_NAME": fileName,
    "P_FILE_TYPE": fileType
};

var response = Services.call("ReceiptBatch_add_receipt", payload);


var error = ServiceManager.getResponseValue(response, "Error");
if (error && error.length !== 0) {
    throw error;
}

var receiptId = ServiceManager.getResponseValue(response, "P_RECEIPT_ID");
console.log('RECEIPT_ID:', receiptId);

return {
    "RECEIPT_ID": receiptId
};