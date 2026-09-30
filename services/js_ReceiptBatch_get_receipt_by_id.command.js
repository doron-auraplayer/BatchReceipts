var receiptId = ServiceManager.getInput("receipt_ID");

var response = Services.call("ReceiptBatch_get_receipt_by_id",{"P_RECEIPT_ID": receiptId});

var error = ServiceManager.getResponseValue(response, "Error");
if (error && error.length !== 0) {
    throw error;
}

var blob = ServiceManager.getResponseValue(response, "P_BLOB_FILE");
var fileName = ServiceManager.getResponseValue(response, "P_FILE_NAME");
var fileType = ServiceManager.getResponseValue(response, "P_FILE_TYPE");

var myFile = receiptId + "." + fileType;
var path = Utils.getServerPath() + "/www/temp/" + myFile;

Files.writeFileBase64(path, blob);
var url = '/ServiceManager/Macro/FileManager?file=' + Files.exportFile(path).split('/ServiceManager/Macro/FileManager?file=')[1];

return {
    "RECEIPTBATCH_RECEIPT_ID": receiptId,
    "RECEIPTBATCH_FILE_NAME": fileName,
    "RECEIPTBATCH_FILE_TYPE": fileType,
    "RECEIPTBATCH_path": path,
    "RECEIPTBATCH_DOCUMENT_URL": url
};