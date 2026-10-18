// Promote PROCESSED receipts to READY when their required core columns and
// required receipt JSON fields are present. Required fields come from
// ReceiptBatch_CreateExpenseJson metadata, not this service.
function textValue(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function responseArray(response, field) {
    return ServiceManager.getResponseArray(response, field) || [];
}

function hasValue(value) {
    if (value === null || value === undefined) {
        return false;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return textValue(value) !== '';
}

// Return the single line of a saved receipt expense document, or null when the
// value is missing, malformed, or not the one-line document shape saved by the app.
function readReceiptExpenseLine(raw) {
    if (raw === null || raw === undefined) {
        return null;
    }
    var document = raw;
    if (typeof document === 'string') {
        if (textValue(document) === '') {
            return null;
        }
        try {
            document = JSON.parse(document);
        } catch (parseError) {
            return null;
        }
    }
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
        return null;
    }
    if (!Array.isArray(document.lines) || document.lines.length !== 1) {
        return null;
    }
    var line = document.lines[0];
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
        return null;
    }
    return line;
}

var ebsUser = textValue(ServiceManager.getInput('EBS_USER'));

var fetchInputs = {
    EBS_USER: ebsUser,
    ReceiptBatch_statuses: 'PROCESSED'
};
var receiptResponse = Services.call('ReceiptBatch_get_by_userAndStatuses', fetchInputs);
var error = textValue(ServiceManager.getResponseValue(receiptResponse, 'Error'));
if (error !== '' && error !== '[]') {
    throw new Error('ReceiptBatch_get_by_userAndStatuses: ' + error);
}
var ids = responseArray(receiptResponse, 'RECEIPTBATCH_RECEIPT_ID');
var receiptStatuses = responseArray(receiptResponse, 'RECEIPTBATCH_STATUS');
var hasProcessed = false;
for (var index = 0; index < ids.length; index++) {
    if (textValue(receiptStatuses[index]).toUpperCase() === 'PROCESSED') {
        hasProcessed = true;
        break;
    }
}

if (hasProcessed) {
    // Empty EXPENSE_TYPE returns metadata for every configured expense type.
    var metadataResponse = Services.call('ReceiptBatch_CreateExpenseJson', { EXPENSE_TYPE: '' });
    error = textValue(ServiceManager.getResponseValue(metadataResponse, 'Error'));
    if (error !== '' && error !== '[]') {
        throw new Error('ReceiptBatch_CreateExpenseJson: ' + error);
    }
    var metadata = ServiceManager.getResponseValue(metadataResponse, 'EXPENSE_METADATA_JSON');
    // AuraPlayer can return JSON fields as already decoded objects.
    if (!metadata || !metadata.expenseTypes) {
        metadata = JSON.parse(textValue(metadata));
    }
    if (!metadata || !metadata.expenseTypes) {
        throw new Error('Expense metadata is missing expenseTypes');
    }

    var coreColumns = {
        expenseType: 'RECEIPTBATCH_EXPENSE_TYPE',
        startDate: 'RECEIPTBATCH_RECEIPT_DATE',
        receiptAmount: 'RECEIPTBATCH_TOTAL_AMOUNT',
        expenseLocation: 'RECEIPTBATCH_LOCATION',
        merchantName: 'RECEIPTBATCH_MERCHANT',
        department: 'RECEIPTBATCH_DEPARTMENT',
        corporateChargeCard: 'RECEIPTBATCH_CREDIT'
    };
    var coreValues = {};
    for (var property in coreColumns) {
        if (Object.prototype.hasOwnProperty.call(coreColumns, property)) {
            coreValues[property] = responseArray(receiptResponse, coreColumns[property]);
        }
    }
    var receiptExpenseData = responseArray(receiptResponse, 'RECEIPTBATCH_EXPENSE_DATA_JSON');
    var readyIds = [];

    for (var row = 0; row < ids.length; row++) {
        if (textValue(receiptStatuses[row]).toUpperCase() !== 'PROCESSED') {
            continue;
        }
        var expenseType = textValue(coreValues.expenseType[row]);
        if (!Object.prototype.hasOwnProperty.call(metadata.expenseTypes, expenseType)) {
            continue;
        }
        var required = metadata.expenseTypes[expenseType].required;
        if (!Array.isArray(required) || required.length === 0) {
            continue;
        }
        var expenseLine = readReceiptExpenseLine(receiptExpenseData[row]);
        var complete = true;
        for (var fieldIndex = 0; fieldIndex < required.length; fieldIndex++) {
            var field = required[fieldIndex];
            var value;
            if (Object.prototype.hasOwnProperty.call(coreColumns, field)) {
                value = coreValues[field][row];
            } else {
                // Required receipt JSON fields must exist on the actual saved line.
                if (!expenseLine || !Object.prototype.hasOwnProperty.call(expenseLine, field)) {
                    complete = false;
                    break;
                }
                value = expenseLine[field];
            }
            if (!hasValue(value)) {
                complete = false;
                break;
            }
        }
        var receiptId = textValue(ids[row]);
        if (complete && /^\d+$/.test(receiptId)) {
            // Keep ID strings exact; JSON_TABLE converts them to Oracle NUMBER.
            readyIds.push(receiptId);
        }
    }

    if (readyIds.length > 0) {
        var updateResponse = Services.call('ReceiptBatch_update_receipts_status', {
            EBS_USER: ebsUser,
            RECEIPT_IDS_JSON: JSON.stringify(readyIds),
            STATUS: 'READY',
            EXPECTED_STATUS: 'PROCESSED'
        });
        error = textValue(ServiceManager.getResponseValue(updateResponse, 'Error'));
        if (error !== '' && error !== '[]') {
            throw new Error('ReceiptBatch_update_receipts_status: ' + error);
        }
        // Reload PROCESSED receipts; rows promoted to READY leave this filtered list.
        receiptResponse = Services.call('ReceiptBatch_get_by_userAndStatuses', fetchInputs);
        error = textValue(ServiceManager.getResponseValue(receiptResponse, 'Error'));
        if (error !== '' && error !== '[]') {
            throw new Error('ReceiptBatch_get_by_userAndStatuses: ' + error);
        }
    }
}

return {
    RECEIPTBATCH_RECEIPT_ID: responseArray(receiptResponse, 'RECEIPTBATCH_RECEIPT_ID'),
    RECEIPTBATCH_STATUS: responseArray(receiptResponse, 'RECEIPTBATCH_STATUS'),
    RECEIPTBATCH_EBS_USER_NAME: responseArray(receiptResponse, 'RECEIPTBATCH_EBS_USER_NAME'),
    RECEIPTBATCH_FILE_NAME: responseArray(receiptResponse, 'RECEIPTBATCH_FILE_NAME'),
    RECEIPTBATCH_FILE_TYPE: responseArray(receiptResponse, 'RECEIPTBATCH_FILE_TYPE'),
    RECEIPTBATCH_EXPENSE_TYPE: responseArray(receiptResponse, 'RECEIPTBATCH_EXPENSE_TYPE'),
    RECEIPTBATCH_TOTAL_AMOUNT: responseArray(receiptResponse, 'RECEIPTBATCH_TOTAL_AMOUNT'),
    RECEIPTBATCH_RECEIPT_DATE: responseArray(receiptResponse, 'RECEIPTBATCH_RECEIPT_DATE'),
    RECEIPTBATCH_MERCHANT: responseArray(receiptResponse, 'RECEIPTBATCH_MERCHANT'),
    RECEIPTBATCH_LOCATION: responseArray(receiptResponse, 'RECEIPTBATCH_LOCATION'),
    RECEIPTBATCH_REPORT_ID: responseArray(receiptResponse, 'RECEIPTBATCH_REPORT_ID'),
    RECEIPTBATCH_REPORT_NAME: responseArray(receiptResponse, 'RECEIPTBATCH_REPORT_NAME'),
    RECEIPTBATCH_REPORT_CREATE_DATE: responseArray(receiptResponse, 'RECEIPTBATCH_REPORT_CREATE_DATE'),
    RECEIPTBATCH_DEPARTMENT: responseArray(receiptResponse, 'RECEIPTBATCH_DEPARTMENT'),
    RECEIPTBATCH_TEMPLATE_NAME: responseArray(receiptResponse, 'RECEIPTBATCH_TEMPLATE_NAME'),
    RECEIPTBATCH_PAYMENT_TYPE: responseArray(receiptResponse, 'RECEIPTBATCH_PAYMENT_TYPE'),
    RECEIPTBATCH_LINE_NUM: responseArray(receiptResponse, 'RECEIPTBATCH_LINE_NUM'),
    RECEIPTBATCH_CREDIT: responseArray(receiptResponse, 'RECEIPTBATCH_CREDIT'),
    RECEIPTBATCH_EXPENSE_DATA_JSON: responseArray(receiptResponse, 'RECEIPTBATCH_EXPENSE_DATA_JSON')
};
