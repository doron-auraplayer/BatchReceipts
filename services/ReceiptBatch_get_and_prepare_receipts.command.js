
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

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function positiveIntegerValue(value) {
    if (typeof value !== 'number' && typeof value !== 'string') {
        return false;
    }
    if (textValue(value) === '') {
        return false;
    }
    var number = Number(value);
    return isFinite(number) && number > 0 && Math.floor(number) === number;
}

function validLocationContext(context) {
    if (!isObject(context)) {
        return false;
    }
    if (!positiveIntegerValue(context.orgId) || !positiveIntegerValue(context.expenseTypeId)) {
        return false;
    }
    if (textValue(context.language) === '') {
        return false;
    }
    if (textValue(context.allSchedules) === '' || textValue(context.merchantLocations) === '') {
        return false;
    }
    if (context.endDateOffset === null || context.endDateOffset === undefined ||
            textValue(context.endDateOffset) === '') {
        return false;
    }
    if (typeof context.endDateOffset !== 'number' && typeof context.endDateOffset !== 'string') {
        return false;
    }
    return isFinite(Number(context.endDateOffset));
}

function validCalendarDate(year, month, day) {
    if (!(year >= 1 && month >= 1 && month <= 12 && day >= 1)) {
        return false;
    }
    var monthLengths = [31,
        (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28,
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= monthLengths[month - 1];
}

function locationServiceDate(value) {
    var text = textValue(value);
    var year;
    var month;
    var day;
    var match;
    if (text === '') {
        return null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        year = Number(text.slice(0, 4));
        month = Number(text.slice(5, 7));
        day = Number(text.slice(8, 10));
    } else {
        match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(text);
        if (!match) {
            return null;
        }
        var months = {
            jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
            jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
        };
        month = months[match[2].toLowerCase()];
        if (!month) {
            return null;
        }
        day = Number(match[1]);
        year = Number(match[3]);
    }
    if (!validCalendarDate(year, month, day)) {
        return null;
    }
    return String(year) + '/' +
        ('0' + month).slice(-2) + '/' +
        ('0' + day).slice(-2) + ' 00:00:00';
}

function isLovEntry(entry) {
    return isObject(entry) && textValue(entry.locationMode).toLowerCase() === 'lov';
}

function locationRequestFor(entry, dateValue) {
    if (!isLovEntry(entry)) {
        return null;
    }
    var service = textValue(entry.locationService);
    if (service === '' || !validLocationContext(entry.locationContext)) {
        return null;
    }
    var date = locationServiceDate(dateValue);
    if (date === null) {
        return null;
    }
    var context = entry.locationContext;
    return {
        service: service,
        params: {
            P_ORG_ID: context.orgId,
            P_LANGUAGE: context.language,
            P_EXPENSE_TYPE_ID: context.expenseTypeId,
            P_EXPENSE_DATE: date,
            P_ALL_SCHEDULES: context.allSchedules,
            P_MERCHANT_LOCATIONS: context.merchantLocations,
            P_END_DATE_OFFSET: context.endDateOffset,
            LocationName: '%'
        }
    };
}

function responseFlagIsFalse(value) {
    return value === false ||
        (typeof value === 'string' && textValue(value).toLowerCase() === 'false');
}

function locationResponseExplicitlyFailed(response) {
    if (!isObject(response)) {
        return true;
    }
    if (responseFlagIsFalse(response.success)) {
        return true;
    }
    var containers = [response.Response, response.Data, response.data, response.Result];
    for (var index = 0; index < containers.length; index++) {
        var container = containers[index];
        if (isObject(container) &&
                responseFlagIsFalse(container.ReceiptBatch_ExpenseLocationSuccess)) {
            return true;
        }
    }
    return false;
}

function locationNamesFromResponse(response) {
    if (locationResponseExplicitlyFailed(response)) {
        throw new Error('Expense location response is missing or reports failure');
    }
    var error = textValue(ServiceManager.getResponseValue(response, 'Error'));
    if (error !== '' && error !== '[]') {
        throw new Error('Expense location lookup failed: ' + error);
    }
    var names = ServiceManager.getResponseArray(response, 'LOCATION_NAME');
    if (!Array.isArray(names)) {
        throw new Error('Expense location response is missing LOCATION_NAME rows');
    }
    var result = [];
    for (var index = 0; index < names.length; index++) {
        if (typeof names[index] !== 'string' || textValue(names[index]) === '') {
            throw new Error('Expense location response contains a malformed row');
        }
        result.push(names[index]);
    }
    return result;
}

function exactLocationMatch(names, savedLocation) {
    if (typeof savedLocation !== 'string' || textValue(savedLocation) === '') {
        return false;
    }
    for (var index = 0; index < names.length; index++) {
        if (names[index] === savedLocation) {
            return true;
        }
    }
    return false;
}


var locationLookupCache = {};

function lookupLocationNames(service, params) {
    var cacheKey = JSON.stringify([
        service,
        params.P_ORG_ID,
        params.P_LANGUAGE,
        params.P_EXPENSE_TYPE_ID,
        params.P_EXPENSE_DATE,
        params.P_ALL_SCHEDULES,
        params.P_MERCHANT_LOCATIONS,
        params.P_END_DATE_OFFSET,
        params.LocationName
    ]);
    if (Object.prototype.hasOwnProperty.call(locationLookupCache, cacheKey)) {
        return locationLookupCache[cacheKey];
    }
    var lookup;
    try {
        lookup = {
            ok: true,
            names: locationNamesFromResponse(Services.call(service, params))
        };
    } catch (lookupError) {
        // A missing, failed, or malformed lookup never proves a match.
        lookup = { ok: false, names: [] };
    }
    locationLookupCache[cacheKey] = lookup;
    return lookup;
}

function lovLocationMatches(entry, savedLocation, dateValue) {
    if (typeof savedLocation !== 'string' || textValue(savedLocation) === '') {
        return false;
    }
    var request = locationRequestFor(entry, dateValue);
    if (request === null) {
        return false;
    }
    var lookup = lookupLocationNames(request.service, request.params);
    return lookup.ok && exactLocationMatch(lookup.names, savedLocation);
}

var ebsUser = textValue(ServiceManager.getInput('EBS_USER'));

var fetchInputs = {
    EBS_USER: ebsUser,
    ReceiptBatch_statuses: 'PROCESSED,READY'
};
var processedFetchInputs = {
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
var hasReady = false;
for (var index = 0; index < ids.length; index++) {
    var status = textValue(receiptStatuses[index]).toUpperCase();
    if (status === 'PROCESSED') {
        hasProcessed = true;
    } else if (status === 'READY') {
        hasReady = true;
    }
}

var readyIds = [];
var demoteIds = [];

if (hasProcessed || hasReady) {
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

    for (var row = 0; row < ids.length; row++) {
        var rowStatus = textValue(receiptStatuses[row]).toUpperCase();
        if (rowStatus !== 'PROCESSED' && rowStatus !== 'READY') {
            continue;
        }
        var expenseType = textValue(coreValues.expenseType[row]);
        if (!Object.prototype.hasOwnProperty.call(metadata.expenseTypes, expenseType)) {
            continue;
        }
        var metadataEntry = metadata.expenseTypes[expenseType];
        if (!isObject(metadataEntry)) {
            continue;
        }
        var receiptId = textValue(ids[row]);
        var lovMode = isLovEntry(metadataEntry);
        var savedLocation = coreValues.expenseLocation[row];

        if (rowStatus === 'READY') {
            // Only LOV rows are rechecked. Text-mode READY rows are untouched.
            if (!lovMode) {
                continue;
            }
            if (/^\d+$/.test(receiptId) &&
                    !lovLocationMatches(metadataEntry, savedLocation, coreValues.startDate[row])) {
                demoteIds.push(receiptId);
            }
            continue;
        }

        var required = metadataEntry.required;
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
        if (!complete) {
            continue;
        }
        if (lovMode &&
                !lovLocationMatches(metadataEntry, savedLocation, coreValues.startDate[row])) {
            continue;
        }
        if (/^\d+$/.test(receiptId)) {
            // Keep ID strings exact; JSON_TABLE converts them to Oracle NUMBER.
            readyIds.push(receiptId);
        }
    }
}

function updateReceiptStatuses(receiptIds, status, expectedStatus) {
    var updateResponse = Services.call('ReceiptBatch_update_receipts_status', {
        EBS_USER: ebsUser,
        RECEIPT_IDS_JSON: JSON.stringify(receiptIds),
        STATUS: status,
        EXPECTED_STATUS: expectedStatus
    });
    var updateError = textValue(ServiceManager.getResponseValue(updateResponse, 'Error'));
    if (updateError !== '' && updateError !== '[]') {
        throw new Error('ReceiptBatch_update_receipts_status: ' + updateError);
    }
}

if (readyIds.length > 0) {
    updateReceiptStatuses(readyIds, 'READY', 'PROCESSED');
}
if (demoteIds.length > 0) {
    updateReceiptStatuses(demoteIds, 'PROCESSED', 'READY');
}

if (readyIds.length > 0 || demoteIds.length > 0) {
    // Reload only remaining PROCESSED rows. Promoted rows leave this filtered
    // list and demoted rows enter it.
    receiptResponse = Services.call('ReceiptBatch_get_by_userAndStatuses', processedFetchInputs);
    error = textValue(ServiceManager.getResponseValue(receiptResponse, 'Error'));
    if (error !== '' && error !== '[]') {
        throw new Error('ReceiptBatch_get_by_userAndStatuses: ' + error);
    }
}

var returnFields = [
    'RECEIPTBATCH_RECEIPT_ID',
    'RECEIPTBATCH_STATUS',
    'RECEIPTBATCH_EBS_USER_NAME',
    'RECEIPTBATCH_FILE_NAME',
    'RECEIPTBATCH_FILE_TYPE',
    'RECEIPTBATCH_EXPENSE_TYPE',
    'RECEIPTBATCH_TOTAL_AMOUNT',
    'RECEIPTBATCH_RECEIPT_DATE',
    'RECEIPTBATCH_MERCHANT',
    'RECEIPTBATCH_LOCATION',
    'RECEIPTBATCH_REPORT_ID',
    'RECEIPTBATCH_REPORT_NAME',
    'RECEIPTBATCH_REPORT_CREATE_DATE',
    'RECEIPTBATCH_DEPARTMENT',
    'RECEIPTBATCH_TEMPLATE_NAME',
    'RECEIPTBATCH_PAYMENT_TYPE',
    'RECEIPTBATCH_LINE_NUM',
    'RECEIPTBATCH_CREDIT',
    'RECEIPTBATCH_EXPENSE_DATA_JSON'
];
var result = {};
var resultStatuses = responseArray(receiptResponse, 'RECEIPTBATCH_STATUS');
for (var fieldIndex = 0; fieldIndex < returnFields.length; fieldIndex++) {
    var returnField = returnFields[fieldIndex];
    var fieldValues = responseArray(receiptResponse, returnField);
    var processedValues = [];
    for (var valueIndex = 0; valueIndex < fieldValues.length; valueIndex++) {
        if (textValue(resultStatuses[valueIndex]).toUpperCase() === 'PROCESSED') {
            processedValues.push(fieldValues[valueIndex]);
        }
    }
    result[returnField] = processedValues;
}

return {
    RECEIPTBATCH_RECEIPT_ID: result.RECEIPTBATCH_RECEIPT_ID,
    RECEIPTBATCH_STATUS: result.RECEIPTBATCH_STATUS,
    RECEIPTBATCH_EBS_USER_NAME: result.RECEIPTBATCH_EBS_USER_NAME,
    RECEIPTBATCH_FILE_NAME: result.RECEIPTBATCH_FILE_NAME,
    RECEIPTBATCH_FILE_TYPE: result.RECEIPTBATCH_FILE_TYPE,
    RECEIPTBATCH_EXPENSE_TYPE: result.RECEIPTBATCH_EXPENSE_TYPE,
    RECEIPTBATCH_TOTAL_AMOUNT: result.RECEIPTBATCH_TOTAL_AMOUNT,
    RECEIPTBATCH_RECEIPT_DATE: result.RECEIPTBATCH_RECEIPT_DATE,
    RECEIPTBATCH_MERCHANT: result.RECEIPTBATCH_MERCHANT,
    RECEIPTBATCH_LOCATION: result.RECEIPTBATCH_LOCATION,
    RECEIPTBATCH_REPORT_ID: result.RECEIPTBATCH_REPORT_ID,
    RECEIPTBATCH_REPORT_NAME: result.RECEIPTBATCH_REPORT_NAME,
    RECEIPTBATCH_REPORT_CREATE_DATE: result.RECEIPTBATCH_REPORT_CREATE_DATE,
    RECEIPTBATCH_DEPARTMENT: result.RECEIPTBATCH_DEPARTMENT,
    RECEIPTBATCH_TEMPLATE_NAME: result.RECEIPTBATCH_TEMPLATE_NAME,
    RECEIPTBATCH_PAYMENT_TYPE: result.RECEIPTBATCH_PAYMENT_TYPE,
    RECEIPTBATCH_LINE_NUM: result.RECEIPTBATCH_LINE_NUM,
    RECEIPTBATCH_CREDIT: result.RECEIPTBATCH_CREDIT,
    RECEIPTBATCH_EXPENSE_DATA_JSON: result.RECEIPTBATCH_EXPENSE_DATA_JSON
};
