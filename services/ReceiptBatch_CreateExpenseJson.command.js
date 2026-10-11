// Creates a new expense document from the configured empty template.
// Keep these templates synchronized with:
// config/Oracle_EBS_iExpense_JSON_Templates.json -> expenseTypes.*.emptyTemplate

var expenseType = ServiceManager.getInput('EXPENSE_TYPE');

var emptyTemplates = {
    'Airfare': {
        //expenseType: 'Airfare',
        //startDate: null,
        //receiptAmount: null,
        receiptCurrency: null,
        exchangeRate: null,
        reimbursableAmount: null,
        justification: null,
        //expenseLocation: null,
        //merchantName: null,
        //tachments: [],
        //corporateChargeCard: null,
        travelType: null,
        ticketClass: null,
        locationFrom: null,
        locationTo: null
    },
    'Car Rental': {
        //expenseType: 'Car Rental',
        //startDate: null,
        //receiptAmount: null,
        receiptCurrency: null,
        exchangeRate: null,
        reimbursableAmount: null,
        justification: null,
        //expenseLocation: null,
        //merchantName: null,
        //attachments: [],
        dailyRate: null,
        numberOfDays: 1,
        //corporateChargeCard: null
    },
    'Entertainment': {
        //expenseType: 'Entertainment',
        //startDate: null,
        //receiptAmount: null,
        receiptCurrency: null,
        exchangeRate: null,
        reimbursableAmount: null,
        justification: null,
        //expenseLocation: null,
        //merchantName: null,
        //attachments: [],
        dailyRate: null,
        numberOfDays: 1,
        //corporateChargeCard: null,
        companyAttendees: null
    },
    'Hotel': {
        //expenseType: 'Hotel',
        //startDate: null,
        //receiptAmount: null,
        receiptCurrency: null,
        exchangeRate: null,
        reimbursableAmount: null,
        justification: null,
        //expenseLocation: null,
        //merchantName: null,
        //attachments: [],
        dailyRate: null,
        numberOfDays: 1,
        //corporateChargeCard: null,
        endDate: null
    },
    'Meals': {
        //expenseType: 'Meals',
        //startDate: null,
        //receiptAmount: null,
        receiptCurrency: null,
        exchangeRate: null,
        reimbursableAmount: null,
        justification: null,
        //expenseLocation: null,
        //merchantName: null, 
        //attachments: [],
        //corporateChargeCard: null,
        numberOfAttendeesOrRecipients: null,
        employees: [],
        nonEmployees: []
    },
    'Miscellaneous': {
        //expenseType: 'Miscellaneous',
        //startDate: null,
        //receiptAmount: null,
        receiptCurrency: null,
        exchangeRate: null,
        reimbursableAmount: null,
        justification: null,
        //expenseLocation: null,
        //merchantName: null,    
        //attachments: [],
        dailyRate: null,
        numberOfDays: 1,
        //corporateChargeCard: null
    },
    'Taxis': {
        //expenseType: 'Taxis',
        //startDate: null,
        //receiptAmount: null,
        receiptCurrency: null,
        exchangeRate: null,
        reimbursableAmount: null,
        justification: null,
        //expenseLocation: null,
        //merchantName: null,
        //attachments: [],
        dailyRate: null,
        numberOfDays: 1,
        //corporateChargeCard: null
    },
    'Telephone Calls': {
        //expenseType: 'Telephone Calls',
        //startDate: null,
        //receiptAmount: null,
        receiptCurrency: null,
        exchangeRate: null,
        reimbursableAmount: null,
        justification: null,
        //expenseLocation: null,
        //merchantName: null,
        //attachments: [],
        dailyRate: null,
        numberOfDays: 1,
        //corporateChargeCard: null
    }
};

var expenseCategories = {
    'Airfare': 'receiptBased',
    'Car Rental': 'receiptBased',
    'Entertainment': 'receiptBased',
    'Hotel': 'receiptBased',
    'Meals': 'receiptBased',
    'Miscellaneous': 'receiptBased',
    'Taxis': 'receiptBased',
    'Telephone Calls': 'receiptBased'
};

var requiredFields = {
    'Airfare': [
        'expenseType', 'startDate', 'receiptAmount', 'receiptCurrency',
        'travelType', 'ticketClass'
    ],
    'Car Rental': [
        'expenseType', 'startDate', 'receiptAmount', 'receiptCurrency',
        'expenseLocation'
    ],
    'Entertainment': [
        'expenseType', 'startDate', 'receiptAmount', 'receiptCurrency',
        'justification', 'companyAttendees'
    ],
    'Hotel': [
        'expenseType', 'startDate', 'receiptAmount', 'receiptCurrency',
        'expenseLocation'
    ],
    'Meals': [
        'expenseType', 'startDate', 'receiptAmount', 'receiptCurrency'
    ],
    'Miscellaneous': [
        'expenseType', 'startDate', 'receiptAmount', 'receiptCurrency',
        'justification'
    ],
    'Taxis': [
        'expenseType', 'startDate', 'receiptAmount', 'receiptCurrency'
    ],
    'Telephone Calls': [
        'expenseType', 'startDate', 'receiptAmount', 'receiptCurrency'
    ]
};

/**************************************************************************
 * Page policy. Owned by the service so the ReceiptDetails page carries no
 * hidden-action list of its own. hiddenSelectors is applied verbatim by the
 * client through $(selector).hide().
 **************************************************************************/
var pagePolicy = {
    hiddenSelectors: [
        '#ScanReceipt', '#ScanReceipt_container', "label[for='ScanReceipt'].ui-btn",
        '#ToggleItemization', '#ItemizationTable', '#Attachments', '#Add_Line',
        '#Add_Line_Line', '#Save', '#SaveBtn', '#SaveLineBtn', '#AddLine', '#Next',
        '#Itemization', '#Location_Search', '#Attendees', '#Guests'
    ]
};

/**************************************************************************
 * Receipt currency LOV labels, in the exact order EBS presents them.
 * The label is the whole LOV item, so legacy and pseudo codes are
 * preserved verbatim and never converted or normalized.
 **************************************************************************/
var currencyNames = ["USD - US dollar","AED - UAE Dirham","ANY - ANY Currency","ARS - Argentine Peso","AUD - Australian Dollar","BEF - Belgian Franc","BHT - Thailand Baht (=old code used on SoB's)","BRL - Brazilian Real","CAD - Canadian Dollar","CHF - Swiss Franc","CLP - Chilean Peso","CNY - Yuan Renminbi","COP - Colombian Peso","CZK - Czech Koruna","DKK - Danish Krone","EUR - Euro","GBP - Pound Sterling","HEADCOUNT - Headcount","HKD - Hong Kong Dollar","HUF - Forint","INR - Indian Rupee","JPY - Yen","KRW - Won","KWD - Kuwaiti Dinar","MXN - Mexican Nuevo Peso","MXP - Mexican Peso","NOK - Norwegian Krone","NTD - New Taiwan Dollar (old code used on SoB's)","NZD - New Zealand Dollar","PLN - Polish Zloty","ROL - Leu","RON - New Leu","RUR - Russian Ruble","SAR - Saudi Riyal","SEK - Swedish Krona","SGD - Singapore Dollar","SQF - Square Footage","THB - Thailand Baht (corrected)","TRL - Turkish Lira","TWD - New Taiwan Dollar","UAH - Hryvnia","VEB - Bolivar","ZAR - Rand"];

/**************************************************************************
 * Designer control metadata per expense property.
 * fieldId                 - the designer control the property is rendered on.
 * summaryFieldId          - control that receives the joined array summary.
 * summaryProperty         - property read from every array item for that summary.
 * control 'editable-table' arrays also render an edit button next to the summary.
 * No fieldId means the property is stored but never rendered.
 * visible: false keeps an unfinished control out of the rendered metadata.
 **************************************************************************/
var fieldMetadata = {
    expenseType: {title: 'Expense Type', type: 'string', control: 'select', fieldId: 'expenseType'},
    startDate: {title: 'Start Date', type: 'string', control: 'date', fieldId: 'StartDate'},
    endDate: {title: 'End Date', type: 'string', control: 'date', fieldId: 'AccEndDate'},
    receiptAmount: {title: 'Receipt Amount', type: 'number', control: 'number', fieldId: 'DetailReceiptAmount'},
    receiptCurrency: {title: 'Receipt Currency', type: 'string', control: 'lov', fieldId: 'ReceiptCurrencyChoice'},
    exchangeRate: {title: 'Exchange Rate', type: 'number', control: 'display', fieldId: 'ExchRate', readOnly: true},
    reimbursableAmount: {title: 'Reimbursable Amount', type: 'number', control: 'display', fieldId: 'DetailReimbursAmt', readOnly: true},
    justification: {title: 'Justification', type: 'string', control: 'textarea', fieldId: 'Justification'},
    expenseLocation: {title: 'Expense Location', type: 'string', control: 'text', fieldId: 'LocationName'},
    merchantName: {title: 'Merchant Name', type: 'string', control: 'text', fieldId: 'DetailMerchantName'},
    originalReceiptMissing: {title: 'Original Receipt Missing', type: 'boolean', control: 'checkbox', fieldId: 'DetailReceiptMissing'},
    // The attachment editor is not part of this phase, so it must not be rendered.
    attachments: {title: 'Attachments', type: 'array', control: 'file-list', visible: false, fieldId: 'LineAttachments_addButton'},
    corporateChargeCard: {title: 'Corporate Charge Card', type: 'string', control: 'lov'},
    dailyRate: {title: 'Daily Rate', type: 'number', control: 'number', fieldId: 'DetailDailyRate'},
    numberOfDays: {title: 'Number Of Days', type: 'number', control: 'number', fieldId: 'NumberOfDays'},
    travelType: {title: 'Type of Travel', type: 'string', control: 'select', fieldId: 'AirTravelType', values: ['Domestic', 'International']},
    ticketClass: {title: 'Class of Ticket', type: 'string', control: 'select', fieldId: 'AirTicketClass', values: ['Business', 'Coach', 'First']},
    locationFrom: {title: 'Location From', type: 'string', control: 'text', fieldId: 'AirFromLocation'},
    locationTo: {title: 'Location To', type: 'string', control: 'text', fieldId: 'AirToLocation'},
    companyAttendees: {title: 'Company/Attendees', type: 'string', control: 'text', fieldId: 'CompanyAttendees'},
    numberOfAttendeesOrRecipients: {title: 'Number of Attendees or Recipients', type: 'integer', control: 'display', fieldId: 'MealNumberAttendees', readOnly: true},
    employees: {title: 'Employee Information', type: 'array', control: 'editable-table', fieldId: 'Attendees', summaryFieldId: 'AttendeeNames', summaryProperty: 'employeeName'},
    nonEmployees: {title: 'Non-Employee Information', type: 'array', control: 'editable-table', fieldId: 'Guests', summaryFieldId: 'GuestNames', summaryProperty: 'name'}
};

/**************************************************************************
 * Per-type corrections. expenseLocation is LocationName for every type: the
 * designer has no RBLocation field.
 **************************************************************************/
var expenseTypeFieldOverrides = {};

// Values that resolve to "no override at all" and must not reach the metadata.
var droppedMetadataKeys = ['fieldId', 'summaryFieldId', 'summaryProperty', 'visible'];

// Combines schema/UI metadata only. User-entered expense values are merged by
// the client after it receives the new expense-type template.
function mergeMetadataDefinition(target, source) {
    var propertyName;
    if (!source) {
        return target;
    }
    for (propertyName in source) {
        if (Object.prototype.hasOwnProperty.call(source, propertyName)) {
            target[propertyName] = source[propertyName];
        }
    }
    return target;
}

// Removes the empty placeholders a base definition may carry, so a metadata
// document never names a control or a summary that does not exist.
function dropEmptyMetadataKeys(definition) {
    var index;
    var key;
    for (index = 0; index < droppedMetadataKeys.length; index += 1) {
        key = droppedMetadataKeys[index];
        if (Object.prototype.hasOwnProperty.call(definition, key)
            && (definition[key] === undefined || definition[key] === null || definition[key] === '')) {
            delete definition[key];
        }
    }
    return definition;
}

var expenseTypeNames = [];
var expenseTypesMetadata = {};
var templateName;

for (templateName in emptyTemplates) {
    if (Object.prototype.hasOwnProperty.call(emptyTemplates, templateName)) {
        var templateFields = {};
        var fieldName;

        for (fieldName in emptyTemplates[templateName]) {
            if (Object.prototype.hasOwnProperty.call(emptyTemplates[templateName], fieldName)) {
                var metadata = dropEmptyMetadataKeys(
                    mergeMetadataDefinition({}, fieldMetadata[fieldName])
                );
                var overrides = expenseTypeFieldOverrides[templateName] || {};
                mergeMetadataDefinition(metadata, overrides[fieldName]);
                dropEmptyMetadataKeys(metadata);
                metadata.required = requiredFields[templateName].indexOf(fieldName) !== -1;
                metadata.defaultValue = emptyTemplates[templateName][fieldName];
                templateFields[fieldName] = metadata;
            }
        }

        expenseTypeNames.push(templateName);
        expenseTypesMetadata[templateName] = {
            label: templateName,
            category: expenseCategories[templateName],
            fields: templateFields,
            required: requiredFields[templateName] || [],
            emptyTemplate: emptyTemplates[templateName]
        };
    }
}

var expenseTypesDocument = {
    schemaVersion: '1.0.0',
    page: pagePolicy,
    expenseTypes: expenseTypesMetadata
};

var expenseDataJson = '';

if (expenseType !== undefined && expenseType !== null && expenseType !== '') {
    if (!Object.prototype.hasOwnProperty.call(emptyTemplates, expenseType)) {
        throw 'Unsupported EXPENSE_TYPE: ' + expenseType;
    }

    var expenseLine = JSON.parse(JSON.stringify(emptyTemplates[expenseType]));
    var expenseDocument = {
        lines: [expenseLine]
    };
    expenseDataJson = JSON.stringify(expenseDocument);
}

return {
    ExpenseType: expenseTypeNames,
    Currency: currencyNames,
    EXPENSE_TYPES_JSON: JSON.stringify(expenseTypeNames),
    EXPENSE_METADATA_JSON: JSON.stringify(expenseTypesDocument),
    EXPENSE_DATA_JSON: expenseDataJson
};
