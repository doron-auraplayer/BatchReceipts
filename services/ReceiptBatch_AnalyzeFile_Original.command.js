var receiptId = ServiceManager.getInput('receipt_id');
var blobFile = ServiceManager.getInput('blob_file');

function getServiceError(serviceResponse) {
    var serviceError = ServiceManager.getResponseValue(
        serviceResponse,
        'Error'
    );

    return serviceError || '';
}

function updateStatus(status) {
    Services.call('ReceiptBatch_update_status', {
        "RECEIPT_ID": receiptId,
        "STATUS": status
    });
}

function emptyToNull(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        console.log(
            '[ReceiptBatch_AnalyzeFile] receiptId=' + receiptId
            + ', empty field=' + fieldName
        );
        return null;
    }

    return value;
}

function amountToNumber(value) {
    var normalizedValue;
    var numberValue;

    if (value === null) {
        return null;
    }

    normalizedValue = String(value).replace(/,/g, '').trim();
    numberValue = Number(normalizedValue);

    if (!isFinite(numberValue)) {
        console.log(
            '[ReceiptBatch_AnalyzeFile] receiptId=' + receiptId
            + ', invalid amount=' + value
        );
        return null;
    }

    return numberValue;
}

function receiptDateToIso(value) {
    var normalizedValue;
    var match;
    var monthNames = {
        JAN: '01',
        FEB: '02',
        MAR: '03',
        APR: '04',
        MAY: '05',
        JUN: '06',
        JUL: '07',
        AUG: '08',
        SEP: '09',
        OCT: '10',
        NOV: '11',
        DEC: '12'
    };

    if (value === null) {
        return null;
    }

    normalizedValue = String(value).trim();

    match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalizedValue);
    if (match) {
        return match[1] + '-' + match[2] + '-' + match[3];
    }

    match = /^(\d{2})-(\d{2})-(\d{4})/.exec(normalizedValue);
    if (match) {
        return match[3] + '-' + match[2] + '-' + match[1];
    }

    match = /^(\d{2})-([A-Za-z]{3})-(\d{4})/.exec(normalizedValue);
    if (match && monthNames[match[2].toUpperCase()]) {
        return match[3]
            + '-' + monthNames[match[2].toUpperCase()]
            + '-' + match[1];
    }

    console.log(
        '[ReceiptBatch_AnalyzeFile] receiptId=' + receiptId
        + ', invalid receipt date=' + value
    );
    return null;
}

var analysisResponse = Services.call('IExpense_AnalyzeReceipt_NEW', {
    "ReceiptContent": blobFile,
    "keepAlive": false
});

var error = getServiceError(analysisResponse);
if (error.length !== 0) {
    updateStatus('AI_FAILED');
    throw error;
}

var totalAmount = emptyToNull(
    ServiceManager.getResponseValue(analysisResponse, 'Amount'),
    'Amount'
);
var merchant = emptyToNull(
    ServiceManager.getResponseValue(analysisResponse, 'MerchantName'),
    'MerchantName'
);
var expenseType = emptyToNull(
    ServiceManager.getResponseValue(analysisResponse, 'AnalyzeReceiptType'),
    'AnalyzeReceiptType'
);
var location = emptyToNull(
    ServiceManager.getResponseValue(analysisResponse, 'Location'),
    'Location'
);
var receiptDate = emptyToNull(
    ServiceManager.getResponseValue(analysisResponse, 'ReceiptDate'),
    'ReceiptDate'
);

var templateResponse = Services.call('ReceiptBatch_CreateExpenseJson', {
    "EXPENSE_TYPE": expenseType
});

error = getServiceError(templateResponse);
if (error.length !== 0) {
    updateStatus('FAILED');
    throw error;
}

var expenseDataValue = ServiceManager.getResponseValue(
    templateResponse,
    'EXPENSE_DATA_JSON'
);
var expenseDocument;

if (typeof expenseDataValue === 'string') {
    try {
        expenseDocument = JSON.parse(expenseDataValue);
    } catch (parseError) {
        updateStatus('FAILED');
        throw 'ReceiptBatch_CreateExpenseJson returned invalid JSON: '
            + parseError;
    }
} else {
    expenseDocument = expenseDataValue;
}

if (
    !expenseDocument
    || !expenseDocument.lines
    || expenseDocument.lines.length !== 1
) {
    updateStatus('FAILED');
    throw 'ReceiptBatch_CreateExpenseJson must return exactly one expense line';
}

expenseDocument.lines[0].receiptAmount = amountToNumber(totalAmount);
expenseDocument.lines[0].startDate = receiptDateToIso(receiptDate);
expenseDocument.lines[0].merchantName = merchant;
expenseDocument.lines[0].expenseLocation = location;

var expenseDataJson = JSON.stringify(expenseDocument);

var updateResponse = Services.call(
    'ReceiptBatch_update_AnalyzedReceipt',
    {
        "RECEIPT_ID": receiptId,
        "STATUS": 'PROCESSED',
        "TOTAL_AMOUNT": totalAmount,
        "MERCHANT": merchant,
        "EXPENSE_TYPE": expenseType,
        "LOCATION": location,
        "RECEIPT_DATE": receiptDate,
        "EXPENSE_DATA_JSON": expenseDataJson
    }
);

error = getServiceError(updateResponse);
if (error.length !== 0) {
    updateStatus('FAILED');
    throw error;
}

return {};
