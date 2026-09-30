// ReceiptBatch_AnalyzeFile: one AI call, then one typed write-back. The five core
// values live only in the SQL columns; the expense JSON carries extras only.
//
// Flow: required receipt-id guard -> mandatory PROCESSING write -> AI analysis ->
// optional typed expense JSON -> mandatory final update. An AI failure writes the
// best-effort AI_FAILED status and rethrows. The template call is best effort: any
// template problem only leaves EXPENSE_DATA_JSON blank and the flow still reaches
// the final update. A failure of the final update writes the best-effort FAILED
// status and rethrows.

var receiptId = ServiceManager.getInput('receipt_id');
var blobFile = ServiceManager.getInput('blob_file');
var MONTH_NUMBERS = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
};
// The AI extras merged into the single expense line. Core values never appear here.
var AI_MAPPED_KEYS = [
    'receiptCurrency', 'justification', 'travelType', 'ticketClass', 'locationFrom',
    'locationTo', 'dailyRate', 'numberOfDays', 'companyAttendees', 'endDate',
    'numberOfAttendeesOrRecipients', 'employees', 'nonEmployees'
];
// The only two list extras: each must arrive as a JSON array string.
var JSON_ARRAY_KEYS = ['employees', 'nonEmployees'];
// The single log prefix every diagnostic line carries.
var LOG_PREFIX = '[ReceiptBatch_AnalyzeFile] ';

function isBlankOrNullText(value) {
    var text;

    if (value === undefined || value === null) {
        return true;
    }
    if (typeof value !== 'string') {
        return false;
    }
    text = value.replace(/^\s+|\s+$/g, '');
    // The AI reports "no value" as the literal text null in any casing and as
    // the sentinel '.null' (leading dot), so both count as absent.
    return text === '' || text.toLowerCase() === 'null'
        || text.toLowerCase() === '.null';
}

// Diagnostics are always best effort: a host without console must never fail the
// receipt, and no receipt content or binary is ever logged.
function log(message) {
    try {
        if (typeof console !== 'undefined' && console && console.log) {
            console.log(LOG_PREFIX + message);
        }
    } catch (logError) {
        return;
    }
}

// The label of one AI answer for logging: the same absent test the flow applies,
// so a logged core value always matches what is actually written back.
function describeValue(value) {
    return isBlankOrNullText(value) ? '(absent)' : String(value);
}

function failureText(error) {
    if (error === undefined || error === null) {
        return 'unknown error';
    }
    if (typeof error === 'string') {
        return error;
    }
    return String(error.message || error);
}

function getServiceError(response) {
    return ServiceManager.getResponseValue(response, 'Error') || '';
}

// Returns the stored analysis value for one property name.
function aiValue(name) {
    return ServiceManager.getResponseValue(analysisResponse, name);
}

// Text for a SQL VARCHAR bind; an absent value travels as an empty string.
function bindText(value) {
    return isBlankOrNullText(value) ? '' : String(value).replace(/^\s+|\s+$/g, '');
}

// Best effort: a status write never replaces the original exception.
function updateStatus(status) {
    try {
        Services.call('ReceiptBatch_update_status',
            {"RECEIPT_ID": receiptIdNumber, "STATUS": status});
    } catch (statusError) {
        return;
    }
}

// The receipt id only has to be present and usable as an unquoted numeric bind.
function requiredReceiptId(value) {
    var text;

    if (value === undefined || value === null) {
        return null;
    }
    text = String(value).replace(/^\s+|\s+$/g, '');
    return text === '' ? null : text;
}

var receiptIdNumber = requiredReceiptId(receiptId);

if (receiptIdNumber === null) {
    throw 'ReceiptBatch_AnalyzeFile requires a receipt_id';
}

log('start receipt_id=' + receiptIdNumber);

// ---- initial status --------------------------------------------------------
// The first workflow step after the guard: mark the receipt PROCESSING before any
// AI work. This write is mandatory: an exception OR a non-empty service Error
// fails the workflow, so the AI service is never called and the error propagates
// unchanged. No AI_FAILED or FAILED status is written here, so this write can
// never mask the failure it reports.
var initialStatusResponse;

try {
    initialStatusResponse = Services.call('ReceiptBatch_update_status',
        {"RECEIPT_ID": receiptIdNumber, "STATUS": 'PROCESSING'});

    if (getServiceError(initialStatusResponse).length !== 0) {
        throw getServiceError(initialStatusResponse);
    }
} catch (initialStatusError) {
    log('initial PROCESSING status failed for receipt_id=' + receiptIdNumber
        + ': ' + failureText(initialStatusError));
    throw initialStatusError;
}

log('status PROCESSING written');

// ---- AI analysis -----------------------------------------------------------
// The AI call may throw, not merely answer with an Error value; both paths write
// AI_FAILED and rethrow. There is no retry.
try {
    var analysisResponse = Services.call('IExpense_AnalyzeReceipt',
        {"ReceiptContent": blobFile, "keepAlive": false});

    if (getServiceError(analysisResponse).length !== 0) {
        throw getServiceError(analysisResponse);
    }
} catch (aiError) {
    log('AI analysis failed for receipt_id=' + receiptIdNumber
        + ': ' + failureText(aiError));
    updateStatus('AI_FAILED');
    throw aiError;
}

// The five core values are collected on every run, even when the type is unknown.
var totalAmount = aiValue('Amount');
var merchant = aiValue('MerchantName');
var location = aiValue('Location');
var receiptDate = aiValue('ReceiptDate');
var expenseType = bindText(aiValue('AnalyzeReceiptType'));

// The core AI answers exactly as the flow sees them: absent covers undefined,
// blank, 'null' and '.null', and it is those answers that reach the SQL columns.
log('AI core outputs: Amount=' + describeValue(totalAmount)
    + ' MerchantName=' + describeValue(merchant)
    + ' Location=' + describeValue(location)
    + ' ReceiptDate=' + describeValue(receiptDate)
    + ' AnalyzeReceiptType=' + describeValue(expenseType));

// ---- date ------------------------------------------------------------------
// The AI documents dd-MMM-yyyy; anything absent or invalid becomes blank.
function toIsoDate(value) {
    var text;
    var match;
    var month;

    if (isBlankOrNullText(value)) {
        return '';
    }
    text = String(value).replace(/^\s+|\s+$/g, '');
    match = /^([0-9]{2})-([A-Za-z]{3})-([0-9]{4})$/.exec(text);
    if (!match) {
        return '';
    }
    month = MONTH_NUMBERS[match[2].toUpperCase()];
    return month ? match[3] + '-' + month + '-' + match[1] : '';
}

// ---- expense JSON ----------------------------------------------------------
function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

// The template document must carry exactly one real line object.
function parseTemplateDocument(response) {
    var value = ServiceManager.getResponseValue(response, 'EXPENSE_DATA_JSON');
    var document = value;

    if (typeof value === 'string') {
        try {
            document = isBlankOrNullText(value) ? null : JSON.parse(value);
        } catch (parseError) {
            return null;
        }
    }
    if (!isPlainObject(document) || !Array.isArray(document.lines)
        || document.lines.length !== 1 || !isPlainObject(document.lines[0])) {
        return null;
    }
    return document;
}

// A list extra is a JSON-array string and becomes [] when absent or invalid.
function listValue(value) {
    var decoded = value;

    if (typeof value === 'string') {
        try {
            decoded = isBlankOrNullText(value) ? null : JSON.parse(value);
        } catch (parseError) {
            return [];
        }
    }
    return Array.isArray(decoded) ? decoded : [];
}

// Copies only the AI extras that carry a real value onto the single line.
function mergeAiExtras(line) {
    var index;
    var key;
    var value;

    for (index = 0; index < AI_MAPPED_KEYS.length; index += 1) {
        key = AI_MAPPED_KEYS[index];
        value = aiValue(key);
        if (JSON_ARRAY_KEYS.indexOf(key) !== -1) {
            line[key] = listValue(value);
            continue;
        }
        if (!isBlankOrNullText(value)) {
            line[key] = value;
        }
    }
    return line;
}

// ---- the expense document --------------------------------------------------
// Only a real AI type produces a template call; an absent or blank type keeps the
// final update with a blank EXPENSE_TYPE and a blank EXPENSE_DATA_JSON.
//
// The template call is best effort. A throw, a non-empty service Error, a missing
// or malformed EXPENSE_DATA_JSON (including a JSON document that is not exactly
// one plain line object) and an unsupported-type rejection all simply leave
// EXPENSE_DATA_JSON blank. None of them writes FAILED and none of them rethrows:
// the core AI values are already in hand, so the receipt still finishes PROCESSED
// with no expense template attached.
var expenseDataJson = '';

if (expenseType === '') {
    log('no expense type from AI; template skipped, EXPENSE_DATA_JSON stays blank');
} else {
    log('expense type "' + expenseType + '" requests a template');
    try {
        var templateResponse = Services.call('ReceiptBatch_CreateExpenseJson',
            {"EXPENSE_TYPE": expenseType});
        var templateProblem = '';

        if (getServiceError(templateResponse).length !== 0) {
            templateProblem = 'service error: ' + getServiceError(templateResponse);
        } else {
            var templateDocument = parseTemplateDocument(templateResponse);
            if (templateDocument === null) {
                templateProblem = 'EXPENSE_DATA_JSON is missing, malformed, or not '
                    + 'exactly one expense line';
            } else {
                templateDocument.lines[0] = mergeAiExtras(templateDocument.lines[0]);
                expenseDataJson = JSON.stringify(templateDocument);
            }
        }
        if (templateProblem === '') {
            log('expense JSON created');
        } else {
            // Best effort: the core AI values are already in hand, so the receipt
            // still finishes PROCESSED with a blank EXPENSE_DATA_JSON.
            log('template problem (' + templateProblem
                + '); EXPENSE_DATA_JSON stays blank');
        }
    } catch (templateError) {
        expenseDataJson = '';
        log('template call failed (' + failureText(templateError)
            + '); EXPENSE_DATA_JSON stays blank');
    }
}

// ---- write back ------------------------------------------------------------
// The final update may throw too, not merely answer with an Error value.
var updateResponse;
var sqlAmount = bindText(totalAmount);
var sqlMerchant = bindText(merchant);
var sqlLocation = bindText(location);
var sqlReceiptDate = toIsoDate(receiptDate);

// The values and the type being saved, never the full expense JSON.
log('saving STATUS=PROCESSED TOTAL_AMOUNT=' + describeValue(sqlAmount)
    + ' MERCHANT=' + describeValue(sqlMerchant)
    + ' EXPENSE_TYPE=' + describeValue(expenseType)
    + ' LOCATION=' + describeValue(sqlLocation)
    + ' RECEIPT_DATE=' + describeValue(sqlReceiptDate)
    + ' EXPENSE_DATA_JSON=' + (expenseDataJson === '' ? '(blank)' : '(set)'));

try {
    updateResponse = Services.call('ReceiptBatch_update_AnalyzedReceipt', {
        "RECEIPT_ID": receiptIdNumber,
        "STATUS": 'PROCESSED',
        "TOTAL_AMOUNT": sqlAmount,
        "MERCHANT": sqlMerchant,
        "EXPENSE_TYPE": expenseType,
        "LOCATION": sqlLocation,
        "RECEIPT_DATE": sqlReceiptDate,
        "EXPENSE_DATA_JSON": expenseDataJson
    });

    if (getServiceError(updateResponse).length !== 0) {
        throw getServiceError(updateResponse);
    }
} catch (updateError) {
    // A failed final update is the only failure left that can reach this point, so
    // it always writes the best-effort FAILED status before rethrowing.
    log('final PROCESSED update failed for receipt_id=' + receiptIdNumber
        + ': ' + failureText(updateError));
    updateStatus('FAILED');
    throw updateError;
}

log('done receipt_id=' + receiptIdNumber + ' saved with STATUS=PROCESSED');

return {};
