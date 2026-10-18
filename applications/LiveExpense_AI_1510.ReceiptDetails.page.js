

var receiptCore = {};
var receiptLine = {};
var receiptMetadata = null;
var receiptFields = {};
var renderedProperties = [];
var renderedFieldValues = {};
var expenseTypeBusy = false;
var renderedExpenseType = '';
var renderedExpenseTypeControl = '';
var receiptLoading = false;
var loadedReceiptId = '';
var loadedPStatus = '';
var saveBusy = false;
var SAVE_ACTION_FIELDS = ['SaveLineBtn', 'SaveBtn', 'Save'];
var CORE_REQUIRED_FIELDS = {
  expenseType: 'expenseType',
  startDate: 'StartDate',
  receiptAmount: 'DetailReceiptAmount',
  expenseLocation: 'LocationName'
};
var REQUIRED_MARKER_CLASS = 'receipt-required';

var requiredMarkedLabels = [];

var requiredMarkedFields = [];

var REQUIRED_CONTROL_CLASS = 'receipt-required-control';
var requiredMarkedContainers = [];
var requiredControlFields = {};
var requiredListeningFields = [];

// ---------- required-field indicators ----------

function labelOfField(field) {
  var name = propertyOf(field);
  if (name === '') { return null; }
  var labelled = $('#mainForm label[for="' + name + '"]:not(.ui-btn)');
  if (labelled.length) { return labelled.get(0); }
  var container = elementOf(name + '_container');
  if (!container) { return null; }
  var inside = $(container).find('label:not(.ui-btn)');
  return inside.length ? inside.get(0) : null;
}

function isEditableFieldDefinition(meta) {
  if (!isObject(meta)) { return false; }
  if (meta.visible === false || meta.readOnly === true) { return false; }
  if (textOf(meta.control) === 'display') { return false; }
  return true;
}

function clearRequiredMarks() {
  requiredMarkedLabels.forEach(function (label) {
    try { $(label).removeClass(REQUIRED_MARKER_CLASS); } catch (ignored) { }
  });
  requiredMarkedFields.forEach(function (field) {
    try {
      var element = elementOf(field);
      if (element && element.removeAttribute) { element.removeAttribute('aria-required'); }
    } catch (ignoredElement) { }
  });
  requiredMarkedContainers.forEach(function (container) {
    try { $(container).removeClass(REQUIRED_CONTROL_CLASS); } catch (ignoredContainer) { }
  });
  requiredMarkedLabels = [];
  requiredMarkedFields = [];
  requiredMarkedContainers = [];
  requiredControlFields = {};
  detachRequiredControlListeners();
}

function markRequiredProperty(property) {
  var name = propertyOf(property);
  if (name === '') { return; }

  var meta = own(receiptFields, name) ? receiptFields[name] : null;
  if (CORE_REQUIRED_FIELDS[name] !== undefined) {
    markRequiredControl(propertyOf(CORE_REQUIRED_FIELDS[name]), true);
    return;
  }
  if (meta === null || !isEditableFieldDefinition(meta)) { return; }
  if (name === '') { return; }
  markRequiredControl(propertyOf(meta.fieldId), true);
}


function markRequiredControl(field, announce) {
  if (field === '') { return; }
  var element = elementOf(field);
  if (element) {
    var label = labelOfField(field);
    if (label) {
      try {
        $(label).addClass(REQUIRED_MARKER_CLASS);
        requiredMarkedLabels.push(label);
      } catch (ignoredLabel) { }
    }
  }
  if (announce !== true) { return; }
  if (!element || !element.setAttribute) { return; }
  requiredMarkedFields.push(field);
  try {
    element.setAttribute('aria-required', 'true');
  } catch (ignoredAttribute) { }

  rememberRequiredControl(field);
  setRequiredControlMissing(field, isRequiredControlEmpty(field));
}

function rememberRequiredControl(field) {
  var name = propertyOf(field);
  if (name === '') { return; }
  var element = elementOf(name);
  if (!element) { return; }
  if (!own(requiredControlFields, name)) { requiredControlFields[name] = name; }
  attachRequiredControlListener(name);
}

function requiredPropertyOfElement(element) {
  if (!element) { return null; }
  var names = Object.keys(requiredControlFields);
  for (var i = 0; i < names.length; i += 1) {
    if (elementOf(names[i]) === element) { return names[i]; }
  }
  return null;
}

function requiredFieldValue(property) {
  var name = propertyOf(property);
  if (name === '') { return ''; }
  var element = elementOf(name);
  if (!element) { return ''; }
  if (element.type === 'checkbox') { return element.checked === true ? 'true' : ''; }
  if (element.nodeName === 'DIV' || element.nodeName === 'LABEL') { return Storage.get(name); }
  return Fields.get(name);
}

function isRequiredControlEmpty(property) {
  var value = requiredFieldValue(property);
  if (value === null || value === undefined) { return true; }
  if (typeof value === 'number') { return isNaN(value); }
  if (typeof value === 'boolean') { return value !== true; }
  return isBlank(value);
}

function setRequiredControlMissing(property, missing) {
  var name = propertyOf(property);
  if (name === '' || !own(requiredControlFields, name)) { return; }
  var container = elementOf(name + '_container');
  if (!container) { return; }
  if (missing) {
    try {
      $(container).addClass(REQUIRED_CONTROL_CLASS);
      if (requiredMarkedContainers.indexOf(container) === -1) { requiredMarkedContainers.push(container); }
    } catch (ignoredContainerColour) { }
    return;
  }
  unsubscribeRequiredContainer(container);
}

function unsubscribeRequiredContainer(container) {
  try {
    $(container).removeClass(REQUIRED_CONTROL_CLASS);
  } catch (ignoredContainerClear) { }
  var at = requiredMarkedContainers.indexOf(container);
  if (at !== -1) { requiredMarkedContainers.splice(at, 1); }
}

function refreshRequiredMissingState() {
  requiredMarkedContainers = [];
  Object.keys(requiredControlFields).forEach(function (field) {
    var container = elementOf(field + '_container');
    if (!container) { return; }
    if (!isRequiredControlEmpty(field)) { return; }
    try {
      $(container).addClass(REQUIRED_CONTROL_CLASS);
      requiredMarkedContainers.push(container);
    } catch (ignoredContainerColour) { }
  });
}

function attachRequiredControlListener(property) {
  var element = elementOf(property);
  if (!element || typeof element.addEventListener !== 'function') { return; }
  if (requiredListeningFields.indexOf(element) !== -1) { return; }
  requiredListeningFields.push(element);
  var listener = function () {
    var changed = requiredPropertyOfElement(element);
    if (changed === null) { return; }
    setRequiredControlMissing(changed, isRequiredControlEmpty(changed));
  };
  element.addEventListener('input', listener);
  element.addEventListener('change', listener);
}

function detachRequiredControlListeners() {
}

function updateRequiredMissingState(field) {
  var name = propertyOf(field);
  if (name === '' || !own(requiredControlFields, name)) { return; }
  setRequiredControlMissing(name, isRequiredControlEmpty(name));
}

function applyRequiredMarkers() {
  clearRequiredMarks();
  if (receiptMetadata === null) { return; }
  var type = textOf(receiptCore.expenseType);
  if (isBlank(type)) { return; }
  var types = receiptMetadata.expenseTypes;
  if (!isObject(types) || !own(types, type)) { return; }
  var entry = types[type];
  if (!isObject(entry)) { return; }
  var required = Array.isArray(entry.required) ? entry.required : [];
  required.forEach(function (property) { markRequiredProperty(property); });
  refreshRequiredMissingState();
}

function renderRequiredMarkers() {
  try {
    applyRequiredMarkers();
  } catch (ignoredMarkerProblem) {
    clearRequiredMarks();
  }
}

function onLoad() {
  if (saveBusy) {
    Popup.ok('Receipt Details', 'Please wait for the save to finish.');
    return;
  }
  clearReceiptFields();
  receiptCore = {};
  receiptLine = {};
  receiptMetadata = null;
  receiptFields = {};
  renderedProperties = [];
  renderedFieldValues = {};
  expenseTypeBusy = false;
  renderedExpenseType = '';
  renderedExpenseTypeControl = '';
  receiptLoading = false;
  loadedReceiptId = '';
  loadedPStatus = '';
  saveBusy = false;

  clearRequiredMarks();
  clearReceiptCoreFields();
  Storage.set('origExpenseType', '');
  Storage.set('ExpenseType', '');

  $('#expenseType, #ReceiptCurrencyChoice, #AirTravelType, #AirTicketClass')
    .parent().addClass('lov-arrow ui-icon-carat-d ui-btn-icon-right');
  loadReceiptData();
}

function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }

function elementOf(field) { return document.getElementById(field); }

function textOf(value) { return value === null || value === undefined ? '' : String(value); }

function isBlank(value) { return textOf(value).replace(/\s/g, '') === ''; }

function own(object, property) {
  return Object.prototype.hasOwnProperty.call(object || {}, property);
}

function propertyOf(value) { return value === null || value === undefined ? '' : textOf(value).trim(); }

function copyOf(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

// ---------- service metadata ----------

function parseServiceMetadata(raw) {
  var document_ = raw;
  if (typeof document_ === 'string') {
    if (isBlank(document_)) {
      throw new Error('The expense metadata was not returned by ReceiptBatch_CreateExpenseJson.');
    }
    document_ = JSON.parse(document_);
  }
  if (!isObject(document_) || !isObject(document_.expenseTypes)) {
    throw new Error('The expense metadata is missing its expenseTypes section.');
  }
  return document_;
}

function expenseTypeEntry(document_, type) {
  var types = document_.expenseTypes;
  var entry = own(types, type) ? types[type] : null;
  if (!isObject(entry)) {
    throw new Error('The expense metadata has no entry for ' + type + '.');
  }
  if (!isObject(entry.fields)) {
    throw new Error('The expense metadata for ' + type + ' has no fields.');
  }
  return entry;
}

function setRuntimeMetadata(document_, entry) {
  receiptMetadata = document_;
  receiptFields = entry.fields;
}

function lineFromMetadata(fields, savedLine, templateLine) {
  var line = {};
  var saved = isObject(savedLine) ? savedLine : {};
  var template = isObject(templateLine) ? templateLine : {};
  Object.keys(fields).forEach(function (property) {
    if (own(saved, property)) { line[property] = copyOf(saved[property]); return; }
    if (own(template, property)) { line[property] = copyOf(template[property]); return; }
    line[property] = copyOf((fields[property] || {}).defaultValue);
  });
  return line;
}

function applyPageMetadata(document_) {
  var page = own(document_, 'page') && isObject(document_.page) ? document_.page : {};
  var selectors = Array.isArray(page.hiddenSelectors) ? page.hiddenSelectors : [];
  selectors.forEach(function (selector) {
    if (textOf(selector) !== '') { $(selector).hide(); }
  });
}

function clearField(field) {
  var container = elementOf(field + '_container');
  var element = elementOf(field);
  var isButton = isArrayButton(field);
  Storage.remove(field);
  Storage.remove(field + 'Exist');
  if (!element) { return; }
  if (element.type === 'checkbox') { Fields.set(field, false); }
  else if (!isButton) { Fields.set(field, ''); }
  if (container) { Fields.hide(field); } else { $('#' + field).hide(); }
}

function isArrayButton(field) {
  var name = propertyOf(field);
  if (name === '') { return false; }
  return Object.keys(receiptFields).some(function (property) {
    var meta = receiptFields[property] || {};
    return meta.control === 'editable-table' && propertyOf(meta.fieldId) === name;
  });
}

function cleanupFieldNames() {
  var names = [];
  function add(field) {
    var name = propertyOf(field);
    if (name !== '' && names.indexOf(name) === -1) { names.push(name); }
  }
  if (typeof iExpenseLineFields !== 'undefined' && iExpenseLineFields) {
    iExpenseLineFields.forEach(function (field) { add(field); });
  }
  renderedProperties.forEach(function (property) { add(property); });
  Object.keys(receiptFields).forEach(function (property) {
    add(receiptFields[property].fieldId);
    add(receiptFields[property].summaryFieldId);
  });
  return names;
}

function clearReceiptFields() {
  cleanupFieldNames().forEach(function (field) { clearField(field); });
}

function hideMetadataFields(document_) {
  var types = document_.expenseTypes;
  function hideDefinitionField(id) {
    var field = propertyOf(id);
    if (field === '' || !elementOf(field)) { return; }
    if (elementOf(field + '_container')) { Fields.hide(field); } else { $('#' + field).hide(); }
  }
  Object.keys(types).forEach(function (name) {
    if (!isObject(types[name]) || !isObject(types[name].fields)) { return; }
    Object.keys(types[name].fields).forEach(function (property) {
      var definition = types[name].fields[property] || {};
      hideDefinitionField(definition.fieldId);
      hideDefinitionField(definition.summaryFieldId);
    });
  });
}

function clearReceiptResponseKeys() {
  Storage.remove('P_ERROR');
  Storage.remove('Error');
}

function readReceiptCore() {
  return {
    expenseType: textOf(Storage.get('P_EXPENSE_TYPE')),
    receiptAmount: Storage.get('P_TOTAL_AMOUNT'),
    startDate: Storage.get('P_RECEIPT_DATE'),
    merchantName: Storage.get('P_MERCHANT'),
    expenseLocation: textOf(Storage.get('P_LOCATION')).trim() || 'All Other Locations',
    department: Storage.get('P_DEPARTMENT'),
    creditTransaction: Storage.get('P_CREDIT_TRANSACTION')
  };
}

function readLoadedStatus() {
  return textOf(Storage.get('P_STATUS'));
}

function formatReceiptStartDate(value) {
  var text = textOf(value);
  var date = moment(text, 'YYYY-MM-DD', true);

  if (date.isValid()) {
    return date.locale('en').format('DD-MMM-YYYY');
  }

  return text;
}

function renderReceiptCore() {
  Storage.set('expenseType', textOf(receiptCore.expenseType));
  setReceiptField('StartDate', formatReceiptStartDate(receiptCore.startDate), true, true);
  setReceiptField('DetailReceiptAmount', receiptCore.receiptAmount, false, true);
  setReceiptField('DetailMerchantName', receiptCore.merchantName, false, true);
  setReceiptField('LocationName', receiptCore.expenseLocation, false, true);
  showField('expenseType');
  Fields.enable('expenseType');
  Fields.enable('StartDate');
  Fields.enable('DetailReceiptAmount');
  Fields.enable('DetailMerchantName');
  Fields.enable('LocationName');
}

function clearReceiptCoreFields() {
  clearField('expenseType');
  clearField('StartDate');
  clearField('DetailReceiptAmount');
  clearField('DetailMerchantName');
  clearField('LocationName');
}

function collectCoreField(property, field, isNumber) {
  var name = propertyOf(field);
  if (name === '' || !elementOf(name)) { return true; }
  var value = textOf(Fields.get(name));
  if (value === textOf(renderedFieldValues[name])) { return true; }
  delete renderedFieldValues[name];
  if (isNumber === true) {
    var number = numericValue(value);
    if (!number.valid) {
      Popup.ok('Receipt Details', 'Enter a valid number for ' + receiptFieldTitle(property) + '.');
      return false;
    }
    receiptCore[property] = number.value;
    return true;
  }
  receiptCore[property] = value;
  return true;
}

function receiptFieldTitle(property) {
  if (property === 'receiptAmount') { return 'Receipt Amount'; }
  if (property === 'startDate') { return 'Start Date'; }
  if (property === 'merchantName') { return 'Merchant Name'; }
  if (property === 'expenseLocation') { return 'Expense Location'; }
  return property;
}

function collectReceiptCoreValues() {
  var valid = true;
  if (collectCoreField('startDate', 'StartDate', false) === false) { valid = false; }
  if (collectCoreField('receiptAmount', 'DetailReceiptAmount', true) === false) { valid = false; }
  if (collectCoreField('merchantName', 'DetailMerchantName', false) === false) { valid = false; }
  if (collectCoreField('expenseLocation', 'LocationName', false) === false) { valid = false; }
  return valid;
}

// ---------- extras JSON ----------
function readExtrasDocument(raw) {
  var parsed = raw;
  if (parsed === null || parsed === undefined || parsed === '') { return {}; }
  if (typeof parsed === 'string') {
    if (isBlank(parsed)) { return {}; }
    parsed = JSON.parse(parsed);
  }
  if (!isObject(parsed)) {
    throw new Error('The expense data is not a valid expense document.');
  }
  if (!Array.isArray(parsed.lines) || parsed.lines.length !== 1 || !isObject(parsed.lines[0])) {
    throw new Error('The expense data must contain exactly one expense line.');
  }
  return copyOf(parsed.lines[0]);
}

function templateLine(raw) {
  if (raw === null || raw === undefined || isBlank(raw)) {
    throw new Error('The expense template was not returned by ReceiptBatch_CreateExpenseJson.');
  }
  return readExtrasDocument(raw);
}

function extrasFromTemplate(line) {
  return copyOf(isObject(line) ? line : {});
}

// ---------- loading ----------

function currentReceiptId() {
  return textOf(Storage.get('RECEIPTBATCH_RECEIPT_ID') || Storage.get('receipt_ID'));
}

function loadReceiptData() {
  var receiptId = currentReceiptId();
  if (isBlank(receiptId)) {
    Popup.ok('Receipt Details', 'No receipt was selected.');
    return;
  }
  clearReceiptResponseKeys();
  loadedReceiptId = '';
  loadedPStatus = '';
  receiptLoading = true;
  updateSaveAction();
  try {
    Services.call('ReceiptBatch_get_expense_data', function () {
      receiptLoading = false;
      var error = Storage.get('P_ERROR') || Storage.get('Error');
      if (textOf(error) !== '') {
        updateSaveAction();
        Popup.ok('Receipt Details', textOf(error));
        return;
      }
      var line;
      try {
        line = readExtrasDocument(Storage.get('P_EXPENSE_DATA_JSON'));
      } catch (malformed) {
        updateSaveAction();
        Popup.ok('Receipt Details', malformed.message || String(malformed));
        return;
      }

      loadedReceiptId = receiptId;
      loadedPStatus = readLoadedStatus();
      receiptCore = readReceiptCore();
      loadExpenseMetadata(textOf(receiptCore.expenseType), line);
    }, function () {
      receiptLoading = false;
      updateSaveAction();
      Popup.ok('Receipt Details', 'Failed to load the expense data.');
    }, { P_RECEIPT_ID: receiptId });
  } catch (thrown) {
    receiptLoading = false;
    updateSaveAction();
    Popup.ok('Receipt Details', 'Failed to load the expense data.');
  }
}

function loadExpenseMetadata(type, previousExtras) {
  var requestedType = textOf(type);
  Storage.remove('EXPENSE_DATA_JSON');
  Storage.remove('EXPENSE_METADATA_JSON');
  Storage.remove('P_ERROR');
  Storage.remove('Error');
  setExpenseTypeBusy(true);
  try {
    Services.call('ReceiptBatch_CreateExpenseJson', function () {
      handleTemplateResponse(requestedType, previousExtras);
    }, function () {
      reportReceiptProblem('Failed to retrieve the expense template.', previousExtras);
    }, { EXPENSE_TYPE: requestedType });
  } catch (thrown) {
    reportReceiptProblem(thrown, previousExtras);
  }
}

function handleTemplateResponse(requestedType, previousExtras) {
  var error = Storage.get('Error') || Storage.get('P_ERROR');
  var document_;
  var entry;
  var template;
  if (textOf(error) !== '') {
    reportReceiptProblem(error, previousExtras);
    return;
  }
  try {
    document_ = parseServiceMetadata(Storage.get('EXPENSE_METADATA_JSON'));
    if (isBlank(requestedType)) {

      setRuntimeMetadata(document_, { fields: {} });
      hideMetadataFields(document_);
      clearReceiptFields();
      applyPageMetadata(document_);
      receiptLine = lineFromMetadata(receiptFields, previousExtras, null);
      storeReceiptLine(receiptLine);
      Storage.set('expenseType', '');
      Storage.remove('origExpenseType');
      Storage.set('ExpenseType', '');
      renderReceiptCore();

      clearRequiredMarks();
      setExpenseTypeBusy(false);
      updateSaveAction();
      Popup.ok('Receipt Details', 'Select an expense type for this receipt.');
      return;
    }
    entry = expenseTypeEntry(document_, requestedType);

    template = templateLine(Storage.get('EXPENSE_DATA_JSON'));
  } catch (problem) {
    reportReceiptProblem(problem, previousExtras);
    return;
  }
  clearReceiptFields();
  setRuntimeMetadata(document_, entry);
  hideMetadataFields(document_);
  applyPageMetadata(document_);
  receiptLine = lineFromMetadata(entry.fields, previousExtras, template);

  receiptCore.expenseType = requestedType;
  renderReceiptLine();
  setExpenseTypeBusy(false);
  updateSaveAction();
}

function reportReceiptProblem(problem, previousExtras) {
  var message = typeof problem === 'string' ? problem : (problem && problem.message) || String(problem);
  setExpenseTypeBusy(false);
  if (textOf(message) === '') { message = 'Could not load the expense template.'; }
  receiptLine = extrasFromTemplate(previousExtras);
  storeReceiptLine(receiptLine);
  restoreRenderedType();
  showField('expenseType');
  Fields.enable('expenseType');
  updateSaveAction();
  Popup.ok('Receipt Details', message);
}


function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showField(field) {
  if (elementOf(field + '_container')) { Fields.show(field); } else { $('#' + field).show(); }
}

function saveActionField() {
  for (var i = 0; i < SAVE_ACTION_FIELDS.length; i += 1) {
    if (elementOf(SAVE_ACTION_FIELDS[i])) { return SAVE_ACTION_FIELDS[i]; }
  }
  return '';
}

function updateSaveAction() {
    console.log("updateSaveAction");
  var field = saveActionField();
  if (field === '') { return; }
  showField(field);
  if (saveBlockedReason() !== '') {
    Fields.disable(field);
    return;
  }
  Fields.enable(field);
}

function setReceiptField(field, value, isDate, readBack) {
  var element = elementOf(field);
  var text = textOf(value);
  Storage.set(field, text);
  Storage.set(field + 'Exist', 'true');
  if (!element) { return; }
  showField(field);
  if (element.type === 'checkbox') {
    Fields.set(field, value === true || value === 'true');
    if (readBack === true) { rememberRenderedField(field); }
    return;
  }
  if (!isDate && (element.nodeName === 'DIV' || element.nodeName === 'LABEL')) {
    Fields.set(field, escapeHtml(text));
    if (readBack === true) { rememberRenderedField(field); }
    return;
  }
  Fields.set(field, text);
  if (element.nodeName === 'INPUT' && element.type !== 'checkbox' && element.type !== 'date' && !isDate) {
    $('#' + field).val(text);
  }
  if (readBack === true) { rememberRenderedField(field); }
}

function rememberRenderedField(field) {
  if (propertyOf(field) === '') { return; }
  renderedFieldValues[field] = textOf(Fields.get(field));
}

function storeReceiptLine(line) {
  var names = [];
  Object.keys(line).forEach(function (property) {
    var value = line[property];
    names.push(property);
    Storage.set(property, value === null || value === undefined ? ''
      : (isObject(value) || Array.isArray(value) ? JSON.stringify(value) : value));
  });
  renderedProperties = names;
}

function storeExpenseType(type) {
  Storage.set('expenseType', type);
  Storage.set('ExpenseType', type);
  Storage.set('origExpenseType', type);
  Fields.set('expenseType', type);
  renderedExpenseType = type;
  renderedExpenseTypeControl = textOf(Fields.get('expenseType'));
}

function restoreRenderedType() {
  Storage.set('expenseType', renderedExpenseType);
  Storage.set('ExpenseType', renderedExpenseType);
  Storage.set('origExpenseType', renderedExpenseType);
  Fields.set('expenseType', renderedExpenseTypeControl);
}

function arrayItemName(item, summaryProperty) {
  if (isObject(item)) { return textOf(item[summaryProperty]); }
  if (item === null || item === undefined) { return ''; }
  return textOf(item);
}

function renderReceiptArray(meta, value) {
  var fieldId = propertyOf(meta.fieldId);
  var summaryFieldId = propertyOf(meta.summaryFieldId);
  var summaryProperty = propertyOf(meta.summaryProperty);
  var summary = [];
  if (fieldId !== '') { showField(fieldId); }
  if (summaryFieldId === '') { return; }
  (Array.isArray(value) ? value : []).forEach(function (item) {
    summary.push(arrayItemName(item, summaryProperty));
  });
  setReceiptField(summaryFieldId, summary.join(','), false, true);
}

function receiptArrayFromSummary(value) {
  return textOf(value).split(',').map(function (name) {
    return name.replace(/^\s+|\s+$/g, '');
  }).filter(function (name) { return name !== ''; });
}

function renderMetadataFields() {
  Object.keys(receiptFields).forEach(function (property) {
    var meta = receiptFields[property] || {};
    var field = propertyOf(meta.fieldId);
    var value = receiptLine[property];
    if (meta.visible === false) { return; }
    if (isObject(value) || Array.isArray(value)) {
      if (own(receiptLine, property)) { renderReceiptArray(meta, value); }
      return;
    }
    if (field === '') { return; }
    setReceiptField(field, value === null || value === undefined ? '' : value,
      meta.control === 'date', true);
  });
}

function applyReadOnlyMetadata() {
  Object.keys(receiptFields).forEach(function (property) {
    var field = propertyOf((receiptFields[property] || {}).fieldId);
    if (field === '' || !elementOf(field)) { return; }
    if (receiptFields[property].readOnly === true) { Fields.disable(field); return; }
    Fields.enable(field);
  });
}

function renderReceiptLine() {
  if (isBlank(receiptLine.receiptCurrency)) {
      receiptLine.receiptCurrency = 'USD - US dollar';
  }
  renderedFieldValues = {};
  storeReceiptLine(receiptLine);
  renderMetadataFields();
  applyReadOnlyMetadata();
  renderReceiptCore();
  storeExpenseType(textOf(receiptCore.expenseType));
  
  refreshRequiredControls();
  renderRequiredMarkers();
}

function refreshRequiredControls() {
  if (receiptMetadata === null) { return; }
  var type = textOf(receiptCore.expenseType);
  if (isBlank(type)) { return; }
  var types = receiptMetadata.expenseTypes;
  if (!isObject(types) || !own(types, type)) { return; }
  var entry = types[type];
  if (!isObject(entry)) { return; }
  var required = Array.isArray(entry.required) ? entry.required : [];
  required.forEach(function (property) { registerRequiredProperty(property); });
}

function registerRequiredProperty(property) {
  var name = propertyOf(property);
  if (name === '') { return; }
  if (CORE_REQUIRED_FIELDS[name] !== undefined) {
    rememberRequiredControl(propertyOf(CORE_REQUIRED_FIELDS[name]));
    return;
  }
  var meta = own(receiptFields, name) ? receiptFields[name] : null;
  if (meta === null || !isEditableFieldDefinition(meta)) { return; }
  rememberRequiredControl(propertyOf(meta.fieldId));
}

// ---------- collecting the form (extras) ----------

function numericProperty(meta) { return meta.type === 'number' || meta.type === 'integer'; }

function numericValue(value) {
  if (isBlank(value)) { return { valid: true, value: '' }; }
  var number = Number(String(value).trim());
  if (!isFinite(number)) { return { valid: false, value: textOf(value) }; }
  return { valid: true, value: number };
}

function staticLovProperty(property, element) {
  if (property !== 'travelType' && property !== 'ticketClass') { return null; }
  if (element.nodeName !== 'DIV' && element.nodeName !== 'LABEL') { return null; }
  var stored = Storage.get(propertyOf((receiptFields[property] || {}).fieldId));
  return textOf(stored) === '' ? null : textOf(stored);
}

function collectCurrentReceiptLine() {
  var line = extrasFromTemplate(receiptLine);
  var invalid = false;
  Object.keys(receiptFields).forEach(function (property) {
    var meta = receiptFields[property] || {};
    if (meta.visible === false || meta.readOnly === true) { return; }

    if (meta.control === 'editable-table') {
      var summaryField = propertyOf(meta.summaryFieldId);
      if (summaryField === '' || !elementOf(summaryField)) { return; }
      line[property] = receiptArrayFromSummary(Fields.get(summaryField));
      return;
    }
    if (meta.control === 'display') { return; }
    var field = propertyOf(meta.fieldId);
    if (field === '' || !elementOf(field)) { return; }
    var element = elementOf(field);
    if (element.type === 'checkbox') {
      line[property] = element.checked === true;
      return;
    }
    var fromStorage = staticLovProperty(property, element);
    var value = fromStorage === null ? Fields.get(field) : fromStorage;
    if (textOf(value) === textOf(renderedFieldValues[field])) { return; }
    delete renderedFieldValues[field];
    if (own(line, property) && (isObject(line[property]) || Array.isArray(line[property]))) { return; }
    if (numericProperty(meta)) {
      var number = numericValue(value);
      if (!number.valid) {
        Popup.ok('Receipt Details', 'Enter a valid number for ' + (meta.title || property) + '.');
        invalid = true;
        return;
      }
      line[property] = number.value;
      return;
    }
    line[property] = textOf(value);
  });
  return invalid ? null : line;
}

function collectCurrentReceiptValues() {
  var extras = collectCurrentReceiptLine();
  if (extras === null) { return null; }

  if (collectReceiptCoreValues() === false) { return null; }
  return { core: receiptCore, extras: extras };
}

// ---------- expense type ----------

function setExpenseTypeBusy(busy) {
  expenseTypeBusy = busy === true;
  if (expenseTypeBusy) { Fields.disable('expenseType'); updateSaveAction(); return; }
  Fields.enable('expenseType');
  updateSaveAction();
}

function expenseType_lov_item_handler(arrayItem) {

  var newVal = propertyOf(arrayItem ? arrayItem.ExpenseType : '');
  if (newVal === '') {
    restoreRenderedType();
    return;
  }

  if (saveBusy) {
    restoreRenderedType();
    Popup.ok('Receipt Details', 'Please wait for the save to finish.');
    return;
  }
  if ($('#ToggleItemization').is(':visible') && $('#ToggleItemization').text() === 'Remove Itemization'
    && Storage.get('ExpenseType') !== newVal) {
    Fields.set('expenseType', Storage.get('ExpenseType'));
    Popup.ok('Itemized Line', 'Please remove itemization before changing expense type.');
    return;
  }

  if (newVal === textOf(receiptCore.expenseType) && receiptMetadata !== null) {
    Fields.set('expenseType', newVal);
    updateRequiredMissingState('expenseType');
    return;
  }

  if (expenseTypeBusy) {
    restoreRenderedType();
    Popup.ok('Receipt Details', 'Please wait for the expense type to finish loading.');
    return;
  }

  var snapshot = collectCurrentReceiptValues();
  if (snapshot === null) {
    restoreRenderedType();
    return;
  }

  Fields.setAndStore('ExpenseType', newVal);
  try {
    populateField('expenseType', arrayItem[Object.keys(arrayItem)[0]].split(',')[0]);
  } catch (err) { }

  updateRequiredMissingState('expenseType');
  setExpenseTypeBusy(true);
  loadExpenseMetadata(newVal, snapshot.extras);
}

// ---------- LOV handlers ----------

function ReceiptCurrencyChoice_lov_item_handler(arrayItem) {
  if (saveBusy) { return; }
  receiptLine.receiptCurrency = textOf(arrayItem.Currency);
  Fields.setAndStore('Currency', arrayItem['Currency']);
  try {
    populateField('ReceiptCurrencyChoice', arrayItem[Object.keys(arrayItem)[0]].split(',')[0]);
  } catch (err) { }
  updateRequiredMissingState('ReceiptCurrencyChoice');
}

// The two static LOVs keep the RAW item and show the display label.
function AirTravelType_lov_item_handler(item, label) {
  if (saveBusy) { return; }
  setReceiptField('AirTravelType', label !== undefined ? label : item, false);
  Storage.set('AirTravelType', item);
  updateRequiredMissingState('AirTravelType');
}

function AirTicketClass_lov_item_handler(item, label) {
  if (saveBusy) { return; }
  setReceiptField('AirTicketClass', label !== undefined ? label : item, false);
  Storage.set('AirTicketClass', item);
  updateRequiredMissingState('AirTicketClass');
}

function prepare_iExpense_CurrencyList_lov_request() { return app.iExpenseConfig; }

function prepare_iExpense_getExpenseTypes_lov_request() {
  var inputParams = {};
  return inputParams;
}

function prepare_iExpense_getReportCurrencies_lov_request() {
  var inputParams = {};
  inputParams['usernameField'] = Fields.get('usernameField');
  inputParams['passwordField'] = Fields.get('passwordField');
  return inputParams;
}

function prepare_ReceiptBatch_CreateExpenseJson_lov_request() {
  var inputParams = {};
  inputParams['EXPENSE_TYPE'] = Fields.get('EXPENSE_TYPE');
  return inputParams;
}

function ReceiptCurrencyChoice_lov_item_presenter(arrayItem) {
  var lovItems = [];
  lovItems.push(arrayItem['Currency']);
  return lovItems.join(',');
}

function expenseType_lov_item_presenter(arrayItem) {
  var lovItems = [];
  lovItems.push(arrayItem['ExpenseType']);
  return lovItems.join(',');
}

// ---------- saving ----------

function saveBlockedReason() {
  if (isBlank(loadedReceiptId)) { return 'This receipt has not finished loading.'; }
  if (receiptLoading) { return 'Please wait for the receipt to finish loading.'; }
  if (expenseTypeBusy) { return 'Please wait for the expense type to finish loading.'; }

  if (saveBusy) { return 'Please wait for the save to finish.'; }
  if (receiptMetadata === null) { return 'The expense template for this receipt was not loaded.'; }
  return '';
}


function saveExtrasDocument(extras) {
  var sent = { lines: [extrasFromTemplate(extras)] };
  return JSON.stringify(sent);
}

function receiptDateSaveValue(value) {
  var text = textOf(value).trim();
  var match;
  var months = {
    jan: '01', feb: '02', mar: '03', apr: '04',
    may: '05', jun: '06', jul: '07', aug: '08',
    sep: '09', oct: '10', nov: '11', dec: '12'
  };

  if (text === '') {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(text);
  if (match && months[match[2].toLowerCase()]) {
    return match[3] + '-' +
      months[match[2].toLowerCase()] + '-' +
      ('0' + match[1]).slice(-2);
  }

  throw new Error('Receipt date must be YYYY-MM-DD or DD-Mon-YYYY.');
}

function saveInput(receiptId, core, extras) {
  return {
    P_RECEIPT_ID: receiptId,
    P_STATUS: saveStatus(core, extras),
    P_EXPENSE_TYPE: optionalSaveValue(core.expenseType),
    P_TOTAL_AMOUNT: numericSaveAmount(core.receiptAmount),
    P_RECEIPT_DATE: receiptDateSaveValue(core.startDate),
    P_MERCHANT: optionalRawSaveValue(core.merchantName),
    P_LOCATION: optionalRawSaveValue(core.expenseLocation),
    P_DEPARTMENT: optionalRawSaveValue(core.department),
    P_EXPENSE_DATA_JSON: saveExtrasDocument(extras),
    P_CREDIT_TRANSACTION: optionalRawSaveValue(core.creditTransaction)
  };
}

// ---------- save status: READY, or the status the receipt already had ----------

function saveStatus(core, extras) {
  if (requiredFieldsComplete(core, extras)) { return 'READY'; }
  return preservedStatus();
}

function preservedStatus() {
  var status = textOf(loadedPStatus).trim();
  if (status === '') { return 'DRAFT'; }
  return status;
}

function requiredFieldsComplete(core, extras) {
  var required = requiredPropertiesOfSelectedType(core);
  if (required === null) { return false; }
  var at;
  for (at = 0; at < required.length; at += 1) {
    if (own(core, required[at])) {
      if (!isFilledSaveValue(core[required[at]])) { return false; }
      continue;
    }
    if (own(extras, required[at])) {
      if (!isFilledSaveValue(extras[required[at]])) { return false; }
      continue;
    }

    return false;
  }
  return true;
}

function requiredPropertiesOfSelectedType(core) {
  if (!isObject(receiptMetadata)) { return null; }
  if (!isObject(core)) { return null; }
  var types = receiptMetadata.expenseTypes;
  if (!isObject(types)) { return null; }
  var type = textOf(core.expenseType);
  if (isBlank(type) || !own(types, type)) { return null; }
  var entry = types[type];
  if (!isObject(entry)) { return null; }
  if (!Array.isArray(entry.required)) { return null; }
  return entry.required;
}

function isFilledSaveValue(value) {
  if (value === null || value === undefined) { return false; }
  if (typeof value === 'number') { return !isNaN(value); }
  if (typeof value === 'boolean') { return true; }
  if (Array.isArray(value)) { return value.length > 0; }
  if (isObject(value)) { return Object.keys(value).length > 0; }
  return !isBlank(value);
}

function optionalSaveValue(value) {
  if (value === undefined) { return null; }
  return value;
}

function optionalRawSaveValue(value) {
  if (value === null || value === undefined) { return null; }
  if (value === '') { return null; }
  return value;
}

function oracleDateLiteral(value) {
  var date = textOf(value).trim();
  var match;
  var months = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04',
    MAY: '05', JUN: '06', JUL: '07', AUG: '08',
    SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };

  if (date === '') {
    return 'NULL';
  }

  // Already ISO: 2025-08-18
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "DATE '" + date + "'";
  }

  // Aura/Oracle display format: 18-Aug-2025
  match = date.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (match && months[match[2].toUpperCase()]) {
    return "DATE '" + match[3] + '-' +
      months[match[2].toUpperCase()] + '-' +
      ('0' + match[1]).slice(-2) + "'";
  }

  throw new Error('Receipt date must be YYYY-MM-DD or DD-Mon-YYYY.');
}

function numericSaveAmount(value) {
  if (value === null || value === undefined || value === '' || isBlank(value)) { return null; }
  return value;
}

function storeSaveInput(input) {
  Object.keys(input).forEach(function (key) {
    Storage.set(key, input[key]);
  });
}

function handleSaveResponse(input) {
  var error = textOf(Storage.get('P_ERROR')) || textOf(Storage.get('Error'));

  if (error !== '') {
    finishSave();
    Popup.ok('Receipt Details', error);
    return;
  }

  storeSaveInput(input);
  Storage.remove('P_UPDATED_DATE');

  loadedPStatus = textOf(input.P_STATUS);
  notifyParentReceiptExpenseDataSaved(input);
  finishSave();

  try {
    if (window.parent !== window &&
        typeof window.parent.returnToReceiptsAfterSave === 'function' &&
        window.parent.returnToReceiptsAfterSave() !== false) {
      return;
    }
  } catch (error) {
    // The save succeeded, but the parent page could not be updated.
  }

  Popup.ok('Receipt Details', saveStatusMessage(input.P_STATUS));
}

function saveStatusMessage(status) {
  var sent = textOf(status).trim();
  if (sent === '') { return 'The expense data was saved.'; }
  if (sent === 'READY') { return 'Saved as ready.'; }
  return 'Saved as ' + sent.toLowerCase() + '.';
}


function notifyParentReceiptExpenseDataSaved(input) {
  var parentWindow;
  try {
    parentWindow = window.parent;
    if (!parentWindow || parentWindow === window) { return; }
    if (typeof parentWindow.receiptExpenseDataSaved !== 'function') { return; }
    parentWindow.receiptExpenseDataSaved(input);
  } catch (ignoredParentNotificationError) {
    // The save already succeeded: a missing, unreachable or throwing parent is reported
    // through neither a failure nor a success, it simply changes nothing.
  }
}


function reportSaveFailure(problem) {
  var message = typeof problem === 'string' ? problem : (problem && problem.message) || String(problem);
  if (textOf(message) === '') { message = 'Failed to save the expense data.'; }
  finishSave();
  Popup.ok('Receipt Details', message);
}


function finishSave() {
  saveBusy = false;
  Fields.enable('expenseType');
  updateSaveAction();
}

function saveExpenseData() {
    console.log("saveExpenseData");
  var reason = saveBlockedReason();
  if (reason !== '') {
    updateSaveAction();
    Popup.ok('Receipt Details', reason);
    return;
  }

  var snapshot = collectCurrentReceiptValues();
  if (snapshot === null) {
    updateSaveAction();
    return;
  }

  var core = copyOf(snapshot.core);
  var extras = copyOf(snapshot.extras);
  var input = saveInput(loadedReceiptId, core, extras);

  Storage.remove('P_ERROR');
  Storage.remove('Error');
  saveBusy = true;

  Fields.disable('expenseType');
  updateSaveAction();
  try {
    console.log('[ReceiptDetails] P_RECEIPT_DATE sent:', input.P_RECEIPT_DATE);
    Services.call('ReceiptBatch_save_expense_data', function () {
      handleSaveResponse(input);
    }, function () {
      reportSaveFailure('Failed to save the expense data.');
    }, input);
  } catch (thrown) {
    reportSaveFailure(thrown);
  }
}

// ---------- next-step handlers (no navigation; Save only writes the expense data) ----------

function afterReceiptDetailsSaved() {
  if (removeAttachmentViewer() === false) {
    return;
  }

  reloadReceiptTable();
}


function returnAfterSave() {
  if (window.parent !== window) {
    window.parent.afterReceiptDetailsSaved();
    return;
  }

  Page.navigate('ReceiptsAttachments.html');
}


function onSave() {
    console.log("onSave");
    saveExpenseData();
}
function onSaveLineBtn() { onSave(); }
function onNext() { onSave(); }
function calculateReimbursValue() { }
function calculateDailyRateByAmount() { }
function calculateDailyRateByRate() { }
function onLocationChange() { }
function onLocationSearch() { }
function onToggleItemization() { }
function onItemizationTable() { }
function onAttachments() { }
function isDirty() { return false; }

function onCancel() {

  if (saveBusy) {
    Popup.ok('Receipt Details', 'Please wait for the save to finish.');
    return;
  }
  if (window.parent && window.parent !== window
    && typeof window.parent.closeReceiptDetailsBesidePreview === 'function') {
    window.parent.closeReceiptDetailsBesidePreview();
    return;
  }
  Page.back();
}