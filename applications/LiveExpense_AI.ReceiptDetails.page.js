

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

// ---------- native expense location control ----------
// All state and cached rows belong to the ONE LocationName field. The
// fingerprint below scopes them to the current receipt/type/date/context so
// a response for a previous context can never be presented or selected.
var locationFieldName = 'LocationName';
var locationTriggerName = 'LocationName_lov_trigger';
var locationTextInputEvent = 'input.receiptLocationText change.receiptLocationText';
var locationDateEvent = 'input.receiptLocationDate change.receiptLocationDate';
var locationFieldState = {
  element: null,
  trigger: null,
  mode: 'text',
  context: null,
  service: '',
  fingerprint: '',
  source: [],
  sourceFingerprint: '',
  sourceGeneration: 0,
  loadedFingerprint: '',
  generation: 0,
  pending: false,
  pendingFingerprint: '',
  pendingOpen: false
};
var locationDateElement = null;

// ---------- native employee attendee control ----------
// Metadata is the only source of the employee attendee editor. Only the
// LiveExpense_AI Meals metadata exposes the employee-lov-list control; every
// other type and app has no such field, so nothing below is rendered or called.
var employeeAttendeeControlName = 'employee-lov-list';
var employeeAttendeeFallbackFieldId = 'AttendeeName';
var employeeAttendeeFallbackSummaryFieldId = 'AttendeeNames';
var employeeAttendeeTextEvent = 'input.receiptAttendeeText change.receiptAttendeeText';
var employeeAttendeeSearchDelay = 250;
var employeeAttendeeState = {
  active: false,
  property: '',
  fieldId: '',
  summaryFieldId: '',
  service: '',
  language: '',
  minSearchLength: 2,
  maxResults: 50,
  control: null,
  element: null,
  trigger: null,
  fingerprint: '',
  generation: 0,
  pending: false,
  pendingKey: '',
  pendingQuery: '',
  pendingOpen: false,
  source: [],
  sourceFingerprint: '',
  sourceQuery: '',
  sourceGeneration: 0,
  items: [],
  ids: [],
  timer: null,
  editorId: '',
  status: null,
  list: null
};

// ---------- guest editor ----------
// Metadata is the only source of the structured guest editor. Only the
// LiveExpense_AI Meals metadata exposes the guest-list control; every other
// type and app has no such field, so nothing below is rendered or called.
// The designer owns the label and the Name/Employer/Add_Guest controls. This
// page binds those native controls and generates only the roster, status and
// Cancel button, so no duplicate form controls are ever created.
var guestControlName = 'guest-list';
var guestFallbackFieldId = 'GuestAttendees';
var guestNameFallbackFieldId = 'GuestName';
var guestEmployerFallbackFieldId = 'Employer';
var guestAddFallbackFieldId = 'Add_Guest';
var guestTextEvent = 'input.receiptGuestText change.receiptGuestText';
var guestState = {
  active: false,
  property: '',
  fieldId: '',
  nameFieldId: '',
  employerFieldId: '',
  addButtonId: '',
  fingerprint: '',
  control: null,
  items: [],
  editIndex: -1,
  editorId: '',
  nameInput: null,
  employerInput: null,
  addButton: null,
  cancelButton: null,
  status: null,
  list: null
};

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
  resetLocationControl();
  resetEmployeeAttendeeEditor();
  resetGuestEditor();
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

// ---------- native expense location control ----------
//
// The designer renders LocationName as a native combobox INPUT with the
// generated LocationName_lov_trigger reload button. In lov mode this page
// owns the data flow: it fetches through Services.call and only then hands
// the current rows to Lov.setAutocomplete for native presentation. The
// generated threshold/focus handlers are neutralized but native keyboard
// navigation and closed-selection behaviour stay intact. In text mode the
// same INPUT remains an ordinary editable text box and all native
// autocomplete/network/carat behaviour is suspended.

function locationElement() { return elementOf(locationFieldName); }

function locationTriggerElement() { return elementOf(locationTriggerName); }

function currentExpenseTypeEntry() {
  if (!isObject(receiptMetadata) || !isObject(receiptMetadata.expenseTypes)) { return null; }
  var type = textOf(receiptCore.expenseType);
  if (isBlank(type) || !own(receiptMetadata.expenseTypes, type)) { return null; }
  var entry = receiptMetadata.expenseTypes[type];
  return isObject(entry) ? entry : null;
}

function positiveIntegerValue(value) {
  var number = Number(value);
  return isFinite(number) && number > 0 && Math.floor(number) === number;
}

function validLocationContext(context) {
  if (!isObject(context)) { return false; }
  if (!positiveIntegerValue(context.orgId) || !positiveIntegerValue(context.expenseTypeId)) { return false; }
  if (isBlank(context.language)) { return false; }
  if (isBlank(context.allSchedules) || isBlank(context.merchantLocations)) { return false; }
  return isFinite(Number(context.endDateOffset));
}

// The service metadata is the only source of the mode/service/context. The
// page contains no expense-type names and no EBS IDs of its own.
function currentLocationControl() {
  var entry = currentExpenseTypeEntry();
  if (isObject(entry) && textOf(entry.locationMode).toLowerCase() === 'lov') {
    // A configured lov type stays in lov mode even when its service or
    // context is missing or invalid. Downgrading it to text mode would let a
    // broken setup silently accept arbitrary free text.
    return {
      mode: 'lov',
      context: entry.locationContext === undefined ? null : entry.locationContext,
      service: textOf(entry.locationService)
    };
  }
  return { mode: 'text', context: null, service: '' };
}

function locationControlConfigured(control) {
  if (!isObject(control) || control.mode !== 'lov') { return false; }
  if (textOf(control.service) === '') { return false; }
  return validLocationContext(control.context);
}

function locationFingerprintFor(control) {
  var context = isObject(control.context) ? control.context : {};
  return [
    textOf(currentReceiptId()),
    textOf(receiptCore.expenseType),
    textOf(Fields.get('StartDate')),
    textOf(control.mode),
    textOf(control.service),
    textOf(context.orgId),
    textOf(context.language),
    textOf(context.expenseTypeId),
    textOf(context.allSchedules),
    textOf(context.merchantLocations),
    textOf(context.endDateOffset)
  ].join('\u0001');
}

function validCalendarDate(year, month, day) {
  if (!(year >= 1 && month >= 1 && month <= 12 && day >= 1)) { return false; }
  var monthLengths = [31,
    (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthLengths[month - 1];
}

// receiptDateSaveValue already normalizes the displayed DD-Mon-YYYY date (or
// an ISO date) to YYYY-MM-DD. Its format check alone accepts impossible days
// such as 31-Feb-2026, so the calendar is validated again here. The service
// expects the EBS canonical literal.
function locationServiceDate() {
  var saved;
  try {
    saved = receiptDateSaveValue(Fields.get('StartDate'));
  } catch (ignoredDateProblem) {
    return null;
  }
  if (typeof saved !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(saved)) { return null; }
  var year = Number(saved.slice(0, 4));
  var month = Number(saved.slice(5, 7));
  var day = Number(saved.slice(8, 10));
  if (!validCalendarDate(year, month, day)) { return null; }
  return saved.slice(0, 4) + '/' + saved.slice(5, 7) + '/' + saved.slice(8, 10) + ' 00:00:00';
}

function currentLocationRequest() {
  var control = currentLocationControl();
  if (!locationControlConfigured(control)) { return null; }
  var date = locationServiceDate();
  if (date === null) { return null; }
  var context = control.context;
  return {
    fingerprint: locationFingerprintFor(control),
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

function prepare_ReceiptBatch_ExpenseLocation_lov_request() {
  var request = currentLocationRequest();
  return request === null ? {} : request.params;
}

function locationBusy() { return receiptLoading || expenseTypeBusy || saveBusy; }

// The service returns the envelope as the raw success argument. Nothing is
// read from Storage, so a previous response can never leak into this one.
function locationRowsFromResponse(rawResponse) {
  var document_ = rawResponse;
  if (typeof document_ === 'string') {
    if (isBlank(document_)) { throw new Error('Empty location response.'); }
    document_ = JSON.parse(document_);
  }
  if (!isObject(document_)) { throw new Error('Malformed location response.'); }
  if (document_.success !== true) { throw new Error('Location lookup failed.'); }
  var response = document_.Response;
  if (!isObject(response)) { throw new Error('Malformed location response.'); }
  if (response.ReceiptBatch_ExpenseLocationSuccess !== true) {
    throw new Error('Location lookup failed.');
  }
  var message = response.ReceiptBatch_ExpenseLocationMessage;
  var explicitError = isObject(message) ? textOf(message.Error) : (typeof message === 'string' ? message : '');
  if (!isBlank(explicitError)) { throw new Error(explicitError); }
  var table = response.ReceiptBatch_ExpenseLocationTableArray;
  if (!isObject(table)) { throw new Error('Malformed location response.'); }
  var items = table.ReceiptBatch_ExpenseLocationArrayItem;
  if (!Array.isArray(items)) { throw new Error('Malformed location response.'); }
  var rows = [];
  items.forEach(function (item) {
    if (!isObject(item)) { throw new Error('Malformed location row.'); }
    var name = textOf(item.LOCATION_NAME);
    if (isBlank(name)) { throw new Error('Malformed location row.'); }
    rows.push({
      LOCATION_NAME: name,
      LOCATION_ID: item.LOCATION_ID,
      DESCRIPTION: item.DESCRIPTION,
      COUNTRY: item.COUNTRY
    });
  });
  return rows;
}

function neutralizeLocationGeneratedHandlers() {
  var input = locationElement();
  if (!input || typeof $ === 'undefined') { return; }
  // Only the two verified generated threshold namespaces are removed. The
  // native keyboard/navigation handlers are deliberately left alone.
  try { $(input).off('.autocompleteThresholdFocus'); } catch (ignoredFocus) { }
  try { $(input).off('.autocompleteThresholdHandler'); } catch (ignoredHandler) { }
}

function prepareLocationAutocomplete() {
  var input = locationElement();
  if (!input || typeof $ === 'undefined') { return; }
  // Lov.setAutocomplete adds blur.lovClosedSelection when this data exists.
  // Restoring it here re-enables the native closed-selection behaviour.
  try { $(input).data('closed-selection', true); } catch (ignoredData) { }
  try { $(input).autocomplete('enable'); } catch (ignoredEnable) { }
  try { $(input).autocomplete('option', 'disabled', false); } catch (ignoredOption) { }
}

function suspendLocationAutocomplete() {
  var input = locationElement();
  if (!input || typeof $ === 'undefined') { return; }
  neutralizeLocationGeneratedHandlers();
  try { $(input).off('blur.lovClosedSelection'); } catch (ignoredBlur) { }
  try { $(input).autocomplete('close'); } catch (ignoredClose) { }
  try { $(input).autocomplete('disable'); } catch (ignoredDisable) { }
  try { $(input).autocomplete('option', 'disabled', true); } catch (ignoredOption) { }
  try { $(input).autocomplete('option', 'source', []); } catch (ignoredSource) { }
  try { $(input).removeData('closed-selection'); } catch (ignoredRemoveData) { }
  try { $(input).removeAttr('data-closed-selection'); } catch (ignoredRemoveAttr) { }
}

function clearNativeLocationSuggestions() {
  var input = locationElement();
  if (!input || typeof $ === 'undefined') { return; }
  // A native blur.lovClosedSelection bound for an earlier response must not
  // clear the field after the source has been invalidated or is still empty.
  // Lov.setAutocomplete restores this handler with a successful response.
  try { $(input).off('blur.lovClosedSelection'); } catch (ignoredBlur) { }
  try { $(input).autocomplete('close'); } catch (ignoredClose) { }
  try { $(input).autocomplete('option', 'source', []); } catch (ignoredSource) { }
  try { $(input).autocomplete('option', 'disabled', true); } catch (ignoredDisabled) { }
}

function setLocationReadonly(readonly) {
  var input = locationElement();
  if (!input) { return; }
  if (typeof $ !== 'undefined') {
    try {
      if (readonly) { $(input).attr('readonly', 'readonly'); }
      else { $(input).removeAttr('readonly'); }
    } catch (ignoredReadonlyAttribute) { }
  }
  try { input.readOnly = readonly === true; } catch (ignoredReadonly) { }
}

function setLocationTextModeAppearance() {
  var input = locationElement();
  var trigger = locationTriggerElement();
  if (trigger) {
    try { $(trigger).hide(); } catch (ignoredHide) { }
    try { trigger.style.display = 'none'; } catch (ignoredStyle) { }
  }
  if (input && typeof $ !== 'undefined') {
    try { $(input).parent().addClass('receipt-location-text-mode'); } catch (ignoredClass) { }
    try { input.disabled = false; } catch (ignoredDisabled) { }
  }
  setLocationReadonly(false);
  suspendLocationAutocomplete();
}

function setLocationLovModeAppearance(configured) {
  var input = locationElement();
  var trigger = locationTriggerElement();
  if (trigger && typeof $ !== 'undefined') {
    try { $(trigger).show(); } catch (ignoredShow) { }
    try { trigger.style.display = ''; } catch (ignoredStyle) { }
  }
  if (input && typeof $ !== 'undefined') {
    try { $(input).parent().removeClass('receipt-location-text-mode'); } catch (ignoredClass) { }
  }
  neutralizeLocationGeneratedHandlers();
  prepareLocationAutocomplete();
  if (configured === true) {
    setLocationReadonly(false);
    return;
  }
  // Keep the configured lov control visible but not freely editable when its
  // service/context is missing. The lookup itself reports the setup problem.
  setLocationReadonly(true);
  clearNativeLocationSuggestions();
}

function locationSuggestionItem(row) {
  var item = copyOf(row);
  // Selection validates these markers, so an item produced from an older
  // response cannot be accepted after the receipt/type/date has changed.
  item.__receiptLocationFingerprint = locationFieldState.sourceFingerprint;
  item.__receiptLocationGeneration = locationFieldState.generation;
  return item;
}

function locationSuggestionItems() {
  var items = [];
  locationFieldState.source.forEach(function (row) {
    var label = textOf(row.LOCATION_NAME);
    items.push({
      label: label,
      value: label,
      item: locationSuggestionItem(row)
    });
  });
  return items;
}

// Native presentation only. The label is plain text and Lov renders it with
// $('<a>').text(item.label); no DB/user string is interpolated into HTML here.
function showNativeLocationSuggestions() {
  var input = locationElement();
  if (!input || locationFieldState.mode !== 'lov') { return; }
  if (!locationFieldState.source.length) {
    clearNativeLocationSuggestions();
    return;
  }
  if (typeof Lov === 'undefined' || !Lov || typeof Lov.setAutocomplete !== 'function') { return; }
  var items = locationSuggestionItems();
  try { $(input).data('closed-selection', true); } catch (ignoredData) { }
  try {
    Lov.setAutocomplete(locationFieldName, locationFieldState.service, items, true);
  } catch (ignoredPresentation) {
    return;
  }
  // The generated initializer may bind its threshold handlers again; remove
  // only those known namespaces after the native widget has been refreshed.
  // Re-check the trigger too in case setAutocomplete replaced it.
  var refreshedTrigger = locationTriggerElement();
  locationFieldState.trigger = refreshedTrigger || locationFieldState.trigger;
  bindLocationNativeCapture(input, refreshedTrigger);
  neutralizeLocationGeneratedHandlers();
  try { $(input).autocomplete('option', 'disabled', false); } catch (ignoredOption) { }
  try { $(input).autocomplete('search', ''); } catch (ignoredSearch) { }
}

function handleLocationTextChanged() {
  var value = textOf(Fields.get(locationFieldName));
  receiptCore.expenseLocation = value;
  Storage.set(locationFieldName, value);
  updateRequiredMissingState(locationFieldName);
  onLocationChange();
}

function handleLocationDateChanged() {
  invalidateLocationSource();
  locationFieldState.fingerprint = locationFingerprintFor(currentLocationControl());
}

function bindLocationInputSync(input) {
  if (!input || typeof $ === 'undefined') { return; }
  // Namespaced off/on keeps exactly one page-owned sync pair across renders.
  try { $(input).off(locationTextInputEvent); } catch (ignoredOff) { }
  try { $(input).on(locationTextInputEvent, handleLocationTextChanged); } catch (ignoredOn) { }
}

function bindLocationDateListeners() {
  var date = elementOf('StartDate');
  if (!date || typeof $ === 'undefined') { return; }
  if (locationDateElement === date) { return; }
  if (locationDateElement) {
    try { $(locationDateElement).off(locationDateEvent); } catch (ignoredOldDate) { }
  }
  try {
    $(date).off(locationDateEvent);
    $(date).on(locationDateEvent, handleLocationDateChanged);
    locationDateElement = date;
  } catch (ignoredDateBinding) { }
}

// A single capture listener per native request path. Capture runs before the
// generated jQuery handlers, and stopImmediatePropagation prevents those
// handlers from starting their own uncontrolled request. The page then runs
// its controlled lookup. Text mode returns without touching the event.
function locationInputCapture(event) {
  if (!event || event.currentTarget !== locationFieldState.element) { return; }
  if (locationFieldState.mode !== 'lov') { return; }
  if (event.type !== 'focus' && event.type !== 'click') { return; }
  if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
  openLocationSuggestions(false);
}

function locationTriggerCapture(event) {
  if (!event || event.type !== 'click') { return; }
  if (locationFieldState.mode !== 'lov') { return; }
  if (event.preventDefault) { event.preventDefault(); }
  if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
  if (event.stopPropagation) { event.stopPropagation(); }
  openLocationSuggestions(true);
}

function bindLocationNativeCapture(input, trigger) {
  if (!input || typeof input.addEventListener !== 'function') { return; }
  if (input.__receiptLocationCapture !== true) {
    input.addEventListener('focus', locationInputCapture, true);
    input.addEventListener('click', locationInputCapture, true);
    input.__receiptLocationCapture = true;
  }
  if (trigger && typeof trigger.addEventListener === 'function'
    && trigger.__receiptLocationCapture !== true) {
    trigger.addEventListener('click', locationTriggerCapture, true);
    trigger.__receiptLocationCapture = true;
  }
}

function invalidateLocationSource() {
  locationFieldState.generation += 1;
  locationFieldState.pending = false;
  locationFieldState.pendingFingerprint = '';
  locationFieldState.pendingOpen = false;
  locationFieldState.source = [];
  locationFieldState.sourceFingerprint = '';
  locationFieldState.sourceGeneration = 0;
  locationFieldState.loadedFingerprint = '';
  locationFieldState.fingerprint = '';
  clearNativeLocationSuggestions();
}

function resetLocationControl() {
  invalidateLocationSource();
  locationFieldState.mode = 'text';
  locationFieldState.context = null;
  locationFieldState.service = '';
  locationFieldState.fingerprint = '';
  setLocationTextModeAppearance();
}

// Called at the tail of renderReceiptCore, after Fields.enable(LocationName),
// so the metadata-driven mode always wins over the designer default.
function applyLocationMode() {
  var input = locationElement();
  if (!input) { return; }
  var trigger = locationTriggerElement();
  var control = currentLocationControl();
  var fingerprint = locationFingerprintFor(control);

  if (locationFieldState.fingerprint !== '' && locationFieldState.fingerprint !== fingerprint) {
    invalidateLocationSource();
  }
  locationFieldState.element = input;
  locationFieldState.trigger = trigger;
  locationFieldState.mode = control.mode;
  locationFieldState.context = control.context;
  locationFieldState.service = control.service;
  locationFieldState.fingerprint = fingerprint;

  bindLocationNativeCapture(input, trigger);
  bindLocationInputSync(input);
  bindLocationDateListeners();

  if (control.mode === 'lov') {
    setLocationLovModeAppearance(locationControlConfigured(control));
    return;
  }
  setLocationTextModeAppearance();
}

function showLocationLookupMessage(message) {
  if (typeof Popup === 'undefined' || !Popup || typeof Popup.ok !== 'function') { return; }
  Popup.ok('Expense Location', message);
}

function locationRequestProblemMessage() {
  if (!locationControlConfigured(currentLocationControl())) {
    return 'Expense location lookup is not configured for this expense type. Contact your administrator.';
  }
  return 'Enter a valid expense date before searching for an expense location.';
}

function openLocationSuggestions(force) {
  if (locationBusy()) { return; }
  if (locationFieldState.mode !== 'lov') { return; }
  var request = currentLocationRequest();
  if (request === null) {
    clearNativeLocationSuggestions();
    showLocationLookupMessage(locationRequestProblemMessage());
    return;
  }
  if (force !== true && locationFieldState.loadedFingerprint === request.fingerprint) {
    if (locationFieldState.source.length) {
      showNativeLocationSuggestions();
    } else {
      clearNativeLocationSuggestions();
    }
    return;
  }
  requestLocationSuggestions(request, true, force === true);
}

function requestLocationSuggestions(request, openOnSuccess, force) {
  if (locationBusy()) { return; }
  if (locationFieldState.mode !== 'lov') { return; }
  var fingerprint = request.fingerprint;
  if (force !== true && locationFieldState.loadedFingerprint === fingerprint) {
    if (locationFieldState.source.length) { showNativeLocationSuggestions(); }
    return;
  }
  if (locationFieldState.pending && locationFieldState.pendingFingerprint === fingerprint) {
    if (openOnSuccess === true) { locationFieldState.pendingOpen = true; }
    return;
  }

  locationFieldState.generation += 1;
  var generation = locationFieldState.generation;
  locationFieldState.pending = true;
  locationFieldState.pendingFingerprint = fingerprint;
  locationFieldState.pendingOpen = openOnSuccess === true;
  locationFieldState.source = [];
  locationFieldState.sourceFingerprint = '';
  locationFieldState.sourceGeneration = 0;
  clearNativeLocationSuggestions();

  var service = locationFieldState.service;

  function requestIsCurrent() {
    return generation === locationFieldState.generation
      && locationFieldState.mode === 'lov'
      && locationFieldState.fingerprint === fingerprint
      && locationLookupFingerprint() === fingerprint;
  }

  function failLookup(message) {
    if (!requestIsCurrent()) { return; }
    locationFieldState.pending = false;
    locationFieldState.pendingFingerprint = '';
    locationFieldState.pendingOpen = false;
    locationFieldState.source = [];
    locationFieldState.sourceFingerprint = '';
    locationFieldState.sourceGeneration = 0;
    locationFieldState.loadedFingerprint = '';
    clearNativeLocationSuggestions();
    showLocationLookupMessage(message);
  }

  try {
    Services.call(service, function (rawResponse) {
      if (!requestIsCurrent()) { return; }
      var rows;
      try {
        rows = locationRowsFromResponse(rawResponse);
      } catch (ignoredResponseProblem) {
        failLookup('The expense location lookup returned an invalid response. Try again.');
        return;
      }
      locationFieldState.pending = false;
      locationFieldState.pendingFingerprint = '';
      locationFieldState.source = rows;
      locationFieldState.sourceFingerprint = fingerprint;
      locationFieldState.sourceGeneration = generation;
      locationFieldState.loadedFingerprint = fingerprint;
      var shouldOpen = locationFieldState.pendingOpen === true;
      locationFieldState.pendingOpen = false;
      if (!rows.length) {
        clearNativeLocationSuggestions();
        showLocationLookupMessage('No allowed expense locations were found for this expense type and date.');
        return;
      }
      if (shouldOpen) { showNativeLocationSuggestions(); }
    }, function () {
      failLookup('The expense location lookup failed. Check your connection and try again.');
    }, request.params);
  } catch (ignoredCallProblem) {
    failLookup('The expense location lookup failed. Check your connection and try again.');
  }
}

function locationLookupFingerprint() {
  var request = currentLocationRequest();
  return request === null ? '' : request.fingerprint;
}

function locationSourceRow(name) {
  var rows = locationFieldState.source;
  for (var i = 0; i < rows.length; i += 1) {
    if (textOf(rows[i].LOCATION_NAME) === name) { return rows[i]; }
  }
  return null;
}

function locationSelectionIsCurrent(candidate) {
  if (locationFieldState.mode !== 'lov') { return false; }
  if (locationFieldState.sourceFingerprint === '') { return false; }
  if (locationFieldState.sourceGeneration !== locationFieldState.generation) { return false; }
  if (locationFieldState.sourceFingerprint !== locationLookupFingerprint()) { return false; }
  if (isObject(candidate)) {
    if (own(candidate, '__receiptLocationFingerprint')
      && textOf(candidate.__receiptLocationFingerprint) !== locationFieldState.sourceFingerprint) {
      return false;
    }
    if (own(candidate, '__receiptLocationGeneration')
      && Number(candidate.__receiptLocationGeneration) !== locationFieldState.generation) {
      return false;
    }
  }
  return true;
}

// Native Lov calls window.LocationName_lov_item_handler(item) after a click.
// Only a row from the current response/fingerprint may change the field; the
// current location text is preserved for every stale or invalid selection.
function LocationName_lov_item_handler(arrayItem) {
  var candidate = arrayItem;
  if (isObject(candidate) && isObject(candidate.item)) { candidate = candidate.item; }
  if (!isObject(candidate)) { return; }
  var name = textOf(candidate.LOCATION_NAME);
  if (isBlank(name)) { return; }
  if (locationBusy()) { return; }
  if (!locationSelectionIsCurrent(candidate)) { return; }
  var row = locationSourceRow(name);
  if (row === null) { return; }
  var selectedName = textOf(row.LOCATION_NAME);
  receiptCore.expenseLocation = selectedName;
  setReceiptField(locationFieldName, selectedName, false, true);
  Storage.set(locationFieldName, selectedName);
  updateRequiredMissingState(locationFieldName);
  onLocationChange();
}

function LocationName_lov_item_presenter(arrayItem) {
  return isObject(arrayItem) ? textOf(arrayItem.LOCATION_NAME) : '';
}

// ---------- native employee attendee control ----------
//
// The designer renders AttendeeName as a native combobox INPUT with the
// generated AttendeeName_lov_trigger reload button for the employee attendee
// list. The field metadata owns the property, service, language, thresholds
// and summary ids; this page owns the data flow: it debounces the search,
// fetches through Services.call, and only then hands the current rows to
// Lov.setAutocomplete for native presentation. Every selected row is appended
// to the page-owned roster below the field. The native input is search-only:
// the runtime's select option is replaced with a guarded handler that returns
// false, so the runtime cannot write a stale label back after the roster add.

function currentEmployeeAttendee() {
  var properties = Object.keys(receiptFields);
  for (var i = 0; i < properties.length; i += 1) {
    var property = properties[i];
    var meta = receiptFields[property];
    if (!isObject(meta)) { continue; }
    if (meta.visible === false) { continue; }
    if (textOf(meta.control) !== employeeAttendeeControlName) { continue; }
    var fieldId = propertyOf(meta.fieldId);
    if (fieldId === '') { continue; }
    return { property: property, meta: meta };
  }
  return null;
}

function employeeAttendeePositiveInteger(value, fallback) {
  var number = Number(value);
  if (!isFinite(number) || number < 1 || Math.floor(number) !== number) { return fallback; }
  return number;
}

function employeeAttendeeControlFor(property, meta) {
  if (!isObject(meta)) { return null; }
  if (textOf(meta.control) !== employeeAttendeeControlName) { return null; }
  var fieldId = propertyOf(meta.fieldId);
  if (fieldId === '') { return null; }
  return {
    property: propertyOf(property),
    fieldId: fieldId,
    summaryFieldId: propertyOf(meta.summaryFieldId),
    summaryProperty: propertyOf(meta.summaryProperty) || 'employeeName',
    service: propertyOf(meta.service),
    language: textOf(meta.language),
    minSearchLength: employeeAttendeePositiveInteger(meta.minSearchLength, 2),
    maxResults: employeeAttendeePositiveInteger(meta.maxResults, 50)
  };
}

function employeeAttendeeFingerprint(control) {
  return [
    textOf(currentReceiptId()),
    textOf(receiptCore.expenseType),
    textOf(control.property),
    textOf(control.fieldId),
    textOf(control.service),
    textOf(control.language),
    textOf(control.minSearchLength),
    textOf(control.maxResults)
  ].join('\u0001');
}

function employeeAttendeeActive() {
  if (employeeAttendeeState.active !== true) { return false; }
  if (!isObject(employeeAttendeeState.control)) { return false; }
  var current = currentEmployeeAttendee();
  if (current === null) { return false; }
  if (current.property !== employeeAttendeeState.property) { return false; }
  if (employeeAttendeeState.fingerprint === '') { return false; }
  return employeeAttendeeState.fingerprint
    === employeeAttendeeFingerprint(employeeAttendeeState.control);
}

function employeeAttendeeBusy() {
  return receiptLoading || expenseTypeBusy || saveBusy;
}

function employeeAttendeeInput() {
  var fieldId = employeeAttendeeState.fieldId || employeeAttendeeFallbackFieldId;
  return elementOf(fieldId);
}

function employeeAttendeeCurrentQuery(control) {
  if (!isObject(control)) { return ''; }
  var input = elementOf(control.fieldId);
  var raw = input ? input.value : Fields.get(control.fieldId);
  return textOf(raw).replace(/^\s+|\s+$/g, '');
}

function createEmployeeAttendeeNode(tag, className, id) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') { return null; }
  var node = document.createElement(tag);
  if (className) { node.className = className; }
  if (id) { node.id = id; }
  return node;
}

function employeeAttendeeEditorId(fieldId) { return fieldId + '_attendee_editor'; }

function employeeAttendeeStatusId(fieldId) { return fieldId + '_attendee_status'; }

function employeeAttendeeListId(fieldId) { return fieldId + '_attendee_list'; }

function employeeAttendeeAnchor(control) {
  var container = elementOf(control.fieldId + '_container');
  if (container) { return container; }
  var input = elementOf(control.fieldId);
  if (input && input.parentElement) { return input.parentElement; }
  return input;
}

function ensureEmployeeAttendeeDom(control) {
  var editorId = employeeAttendeeEditorId(control.fieldId);
  var editor = elementOf(editorId);
  if (!editor) {
    var anchor = employeeAttendeeAnchor(control);
    if (!anchor || !anchor.parentNode) { return false; }
    editor = createEmployeeAttendeeNode('div', 'receipt-attendee-editor', editorId);
    if (!editor) { return false; }
    var status = createEmployeeAttendeeNode('div', 'receipt-attendee-status',
      employeeAttendeeStatusId(control.fieldId));
    var list = createEmployeeAttendeeNode('div', 'receipt-attendee-list',
      employeeAttendeeListId(control.fieldId));
    if (!status || !list) { return false; }
    if (status.setAttribute) {
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
    }
    editor.appendChild(status);
    editor.appendChild(list);
    anchor.parentNode.insertBefore(editor, anchor.nextSibling || null);
  }
  employeeAttendeeState.editorId = editorId;
  employeeAttendeeState.status = elementOf(employeeAttendeeStatusId(control.fieldId));
  employeeAttendeeState.list = elementOf(employeeAttendeeListId(control.fieldId));
  return !!(employeeAttendeeState.status && employeeAttendeeState.list);
}

function employeeAttendeeStatusNeedsEditor() {
  var status = employeeAttendeeState.status;
  if (!status) { return false; }
  // Prompts and routine success text do not keep an otherwise empty editor
  // visible; real failures, lookup progress and result guidance still do.
  return /(^|\s)receipt-attendee-status-(loading|error|refine|empty)(\s|$)/
    .test(textOf(status.className));
}

function updateEmployeeAttendeeVisibility() {
  var editor = employeeAttendeeState.editorId ? elementOf(employeeAttendeeState.editorId) : null;
  if (!editor || !editor.style) { return; }
  var hasItems = employeeAttendeeState.active === true
    && Array.isArray(employeeAttendeeState.items)
    && employeeAttendeeState.items.length > 0;
  editor.style.display = hasItems || employeeAttendeeStatusNeedsEditor() ? '' : 'none';
}

function hideEmployeeAttendeeDom() {
  var editor = employeeAttendeeState.editorId ? elementOf(employeeAttendeeState.editorId) : null;
  if (editor && editor.style) { editor.style.display = 'none'; }
}

function setEmployeeAttendeeStatus(message, kind) {
  var status = employeeAttendeeState.status;
  if (!status) { return; }
  status.textContent = textOf(message);
  status.className = 'receipt-attendee-status'
    + (kind ? ' receipt-attendee-status-' + kind : '');
  updateEmployeeAttendeeVisibility();
}

function showEmployeeAttendeeField(fieldId) {
  if (fieldId === '') { return; }
  if (elementOf(fieldId + '_container')) { Fields.show(fieldId); return; }
  if (elementOf(fieldId) && typeof $ !== 'undefined') { $('#' + fieldId).show(); }
}

function hideEmployeeAttendeeField(fieldId) {
  if (fieldId === '') { return; }
  if (elementOf(fieldId + '_container')) { Fields.hide(fieldId); return; }
  if (elementOf(fieldId) && typeof $ !== 'undefined') { $('#' + fieldId).hide(); }
}

function cancelEmployeeAttendeeTimer() {
  if (employeeAttendeeState.timer === null) { return; }
  try { clearTimeout(employeeAttendeeState.timer); } catch (ignoredTimer) { }
  employeeAttendeeState.timer = null;
}

function clearNativeEmployeeAttendeeSuggestions() {
  var input = employeeAttendeeInput();
  if (!input || typeof $ === 'undefined') { return; }
  // The search picker is not a closed-selection LOV: a blur must never add or
  // rewrite an attendee. Detach only the runtime namespace, not navigation.
  try { $(input).off('blur.lovClosedSelection'); } catch (ignoredBlur) { }
  try { $(input).autocomplete('close'); } catch (ignoredClose) { }
  try { $(input).autocomplete('option', 'source', []); } catch (ignoredSource) { }
  try { $(input).autocomplete('option', 'disabled', true); } catch (ignoredDisabled) { }
}

function neutralizeEmployeeAttendeeGeneratedHandlers() {
  var input = employeeAttendeeInput();
  if (!input || typeof $ === 'undefined') { return; }
  // Only the verified generated threshold namespaces are removed. Native
  // keyboard/navigation handlers are deliberately left alone.
  try { $(input).off('.autocompleteThresholdFocus'); } catch (ignoredFocus) { }
  try { $(input).off('.autocompleteThresholdHandler'); } catch (ignoredHandler) { }
}

function prepareEmployeeAttendeeAutocomplete() {
  var input = employeeAttendeeInput();
  if (!input || typeof $ === 'undefined') { return; }
  // Do not mark this element with closed-selection data: the runtime would
  // install its implicit blur select and could add a stale attendee.
  try { $(input).removeData('closed-selection'); } catch (ignoredData) { }
  try { $(input).removeAttr('data-closed-selection'); } catch (ignoredAttr) { }
  try { $(input).off('blur.lovClosedSelection'); } catch (ignoredBlur) { }
  try { $(input).autocomplete('enable'); } catch (ignoredEnable) { }
  try { $(input).autocomplete('option', 'disabled', false); } catch (ignoredOption) { }
}

function invalidateEmployeeAttendeeSource() {
  cancelEmployeeAttendeeTimer();
  employeeAttendeeState.generation += 1;
  employeeAttendeeState.pending = false;
  employeeAttendeeState.pendingKey = '';
  employeeAttendeeState.pendingQuery = '';
  employeeAttendeeState.pendingOpen = false;
  employeeAttendeeState.source = [];
  employeeAttendeeState.sourceFingerprint = '';
  employeeAttendeeState.sourceQuery = '';
  employeeAttendeeState.sourceGeneration = 0;
  clearNativeEmployeeAttendeeSuggestions();
}

function hideEmployeeAttendeeTrigger(fieldId) {
  var trigger = fieldId ? elementOf(fieldId + '_lov_trigger') : null;
  if (!trigger) { return; }
  if (typeof $ !== 'undefined') {
    try { $(trigger).hide(); } catch (ignoredHide) { }
  }
  if (trigger.style) { trigger.style.display = 'none'; }
}

function showEmployeeAttendeeTrigger(fieldId) {
  var trigger = fieldId ? elementOf(fieldId + '_lov_trigger') : null;
  if (!trigger) { return; }
  if (typeof $ !== 'undefined') {
    try { $(trigger).show(); } catch (ignoredShow) { }
  }
  if (trigger.style) { trigger.style.display = ''; }
}

function resetEmployeeAttendeeEditor() {
  var fieldId = employeeAttendeeState.fieldId || employeeAttendeeFallbackFieldId;
  var summaryFieldId = employeeAttendeeState.summaryFieldId
    || employeeAttendeeFallbackSummaryFieldId;
  invalidateEmployeeAttendeeSource();
  employeeAttendeeState.active = false;
  employeeAttendeeState.items = [];
  hideEmployeeAttendeeField(fieldId);
  hideEmployeeAttendeeField(summaryFieldId);
  hideEmployeeAttendeeTrigger(fieldId);
  hideEmployeeAttendeeDom();
  if (employeeAttendeeState.status) { setEmployeeAttendeeStatus('', ''); }
  var input = elementOf(fieldId);
  if (input) {
    try { input.value = ''; } catch (ignoredInputValue) { }
  }
  try { Fields.set(fieldId, ''); } catch (ignoredFieldValue) { }
  employeeAttendeeState.property = '';
  employeeAttendeeState.fieldId = '';
  employeeAttendeeState.summaryFieldId = '';
  employeeAttendeeState.service = '';
  employeeAttendeeState.language = '';
  employeeAttendeeState.fingerprint = '';
  employeeAttendeeState.control = null;
  employeeAttendeeState.element = null;
  employeeAttendeeState.trigger = null;
  employeeAttendeeState.ids = [];
}

function employeeAttendeeItemsFromLoaded(value) {
  // Legacy employee values stay verbatim: a comma inside a name is part of
  // that one item. Existing objects keep every property they were loaded with.
  if (Array.isArray(value)) { return copyOf(value); }
  if (value === null || value === undefined) { return []; }
  return [copyOf(value)];
}

function employeeAttendeeIdsForItems(items) {
  return items.map(function (item) {
    if (!isObject(item)) { return ''; }
    if (item.PERSON_ID !== undefined && item.PERSON_ID !== null
      && textOf(item.PERSON_ID) !== '') { return textOf(item.PERSON_ID); }
    if (item.personId !== undefined && item.personId !== null
      && textOf(item.personId) !== '') { return textOf(item.personId); }
    return '';
  });
}

function employeeAttendeeItemDetail(item) {
  if (!isObject(item)) { return ''; }
  var parts = [];
  if (!isBlank(item.employeeTitle)) { parts.push(textOf(item.employeeTitle)); }
  if (!isBlank(item.employeeNumber)) { parts.push(textOf(item.employeeNumber)); }
  if (!isBlank(item.organizationName)) { parts.push(textOf(item.organizationName)); }
  return parts.join(' - ');
}

function employeeAttendeeSuggestionLabel(row) {
  var name = textOf(row.EMPLOYEE_NAME);
  var parts = [];
  if (!isBlank(row.TITLE)) { parts.push(textOf(row.TITLE)); }
  if (!isBlank(row.EMPLOYEE_NUMBER)) { parts.push(textOf(row.EMPLOYEE_NUMBER)); }
  if (!isBlank(row.ORGANIZATION_NAME)) { parts.push(textOf(row.ORGANIZATION_NAME)); }
  if (!parts.length) { return name; }
  return name + ' - ' + parts.join(' - ');
}

function employeeAttendeeSuggestionItem(row) {
  var item = copyOf(row);
  item.__receiptAttendeeFingerprint = employeeAttendeeState.sourceFingerprint;
  item.__receiptAttendeeQuery = employeeAttendeeState.sourceQuery;
  item.__receiptAttendeeGeneration = employeeAttendeeState.generation;
  return item;
}

function employeeAttendeeSuggestionItems() {
  var items = [];
  employeeAttendeeState.source.forEach(function (row) {
    var label = employeeAttendeeSuggestionLabel(row);
    items.push({
      label: label,
      value: label,
      item: employeeAttendeeSuggestionItem(row)
    });
  });
  return items;
}

function overrideEmployeeAttendeeSelect(input) {
  if (!input || typeof $ === 'undefined') { return; }
  // The runtime select invokes populateNonTableLov, which calls the global
  // handler BEFORE writing the selected label back into the input. Replacing
  // the option and returning false prevents that write entirely; clearing the
  // input inside the global handler alone would be overwritten afterwards.
  try {
    $(input).autocomplete('option', 'select', handleEmployeeAttendeeNativeSelect);
  } catch (ignoredSelectOption) { }
}

function showNativeEmployeeAttendeeSuggestions() {
  var input = employeeAttendeeState.element;
  if (!input || !employeeAttendeeActive()) { return; }
  if (!employeeAttendeeState.source.length) {
    clearNativeEmployeeAttendeeSuggestions();
    return;
  }
  if (typeof Lov === 'undefined' || !Lov || typeof Lov.setAutocomplete !== 'function') { return; }
  var items = employeeAttendeeSuggestionItems();
  prepareEmployeeAttendeeAutocomplete();
  try {
    Lov.setAutocomplete(employeeAttendeeState.fieldId, employeeAttendeeState.service, items, true);
  } catch (ignoredPresentation) {
    return;
  }
  var refreshedTrigger = elementOf(employeeAttendeeState.fieldId + '_lov_trigger');
  employeeAttendeeState.trigger = refreshedTrigger || employeeAttendeeState.trigger;
  bindEmployeeAttendeeNativeCapture(input, refreshedTrigger);
  neutralizeEmployeeAttendeeGeneratedHandlers();
  overrideEmployeeAttendeeSelect(input);
  try { $(input).autocomplete('option', 'disabled', false); } catch (ignoredOption) { }
  try { $(input).autocomplete('option', 'minLength', 0); } catch (ignoredMinLength) { }
  try { $(input).autocomplete('search', employeeAttendeeState.sourceQuery); } catch (ignoredSearch) { }
}

function employeeAttendeeInputCapture(event) {
  if (!event || event.currentTarget !== employeeAttendeeState.element) { return; }
  if (event.type !== 'focus' && event.type !== 'click') { return; }
  if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
  if (!employeeAttendeeActive()) { return; }
  openEmployeeAttendeeSuggestions(false);
}

function employeeAttendeeTriggerCapture(event) {
  if (!event || event.type !== 'click') { return; }
  if (event.preventDefault) { event.preventDefault(); }
  if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
  if (event.stopPropagation) { event.stopPropagation(); }
  if (!employeeAttendeeActive()) { return; }
  openEmployeeAttendeeSuggestions(true);
}

function bindEmployeeAttendeeNativeCapture(input, trigger) {
  if (!input || typeof input.addEventListener !== 'function') { return; }
  if (input.__receiptAttendeeCapture !== true) {
    input.addEventListener('focus', employeeAttendeeInputCapture, true);
    input.addEventListener('click', employeeAttendeeInputCapture, true);
    input.__receiptAttendeeCapture = true;
  }
  if (trigger && typeof trigger.addEventListener === 'function'
    && trigger.__receiptAttendeeCapture !== true) {
    trigger.addEventListener('click', employeeAttendeeTriggerCapture, true);
    trigger.__receiptAttendeeCapture = true;
  }
}

function bindEmployeeAttendeeInputSync(input) {
  if (!input || typeof $ === 'undefined') { return; }
  try { $(input).off(employeeAttendeeTextEvent); } catch (ignoredOff) { }
  try { $(input).on(employeeAttendeeTextEvent, handleEmployeeAttendeeInputChanged); } catch (ignoredOn) { }
}

function employeeAttendeeRowsFromResponse(rawResponse) {
  var service = textOf(employeeAttendeeState.service);
  if (service === '') { throw new Error('Employee lookup service is not configured.'); }
  var document_ = rawResponse;
  if (typeof document_ === 'string') {
    if (isBlank(document_)) { throw new Error('Empty employee response.'); }
    document_ = JSON.parse(document_);
  }
  if (!isObject(document_)) { throw new Error('Malformed employee response.'); }
  if (document_.success !== true) { throw new Error('Employee lookup failed.'); }
  var response = document_.Response;
  if (!isObject(response)) { throw new Error('Malformed employee response.'); }
  if (response[service + 'Success'] !== true) {
    throw new Error('Employee lookup failed.');
  }
  var message = response[service + 'Message'];
  var explicitError = isObject(message) ? textOf(message.Error)
    : (typeof message === 'string' ? message : '');
  if (!isBlank(explicitError)) { throw new Error(explicitError); }
  var table = response[service + 'TableArray'];
  if (!isObject(table)) { throw new Error('Malformed employee response.'); }
  var items = table[service + 'ArrayItem'];
  if (!Array.isArray(items)) { throw new Error('Malformed employee response.'); }
  var rows = [];
  items.forEach(function (item) {
    if (!isObject(item)) { throw new Error('Malformed employee row.'); }
    var name = textOf(item.EMPLOYEE_NAME);
    if (isBlank(name)) { throw new Error('Malformed employee row.'); }
    rows.push({
      PERSON_ID: item.PERSON_ID,
      EMPLOYEE_NAME: name,
      EMPLOYEE_NUMBER: item.EMPLOYEE_NUMBER,
      TITLE: item.TITLE,
      ORGANIZATION_NAME: item.ORGANIZATION_NAME
    });
  });
  return rows;
}

function employeeAttendeeSourceRow(candidate) {
  if (!isObject(candidate)) { return null; }
  var rows = employeeAttendeeState.source;
  var candidateId = candidate.PERSON_ID;
  var hasId = candidateId !== undefined && candidateId !== null && textOf(candidateId) !== '';
  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (hasId) {
      if (textOf(row.PERSON_ID) === textOf(candidateId)) { return row; }
      continue;
    }
    if (textOf(row.EMPLOYEE_NAME) === textOf(candidate.EMPLOYEE_NAME)
      && textOf(row.TITLE) === textOf(candidate.TITLE)) { return row; }
  }
  return null;
}

function employeeAttendeeSelectionIsCurrent(candidate) {
  if (!employeeAttendeeActive()) { return false; }
  if (employeeAttendeeState.sourceFingerprint === '') { return false; }
  if (employeeAttendeeState.sourceQuery === '') { return false; }
  if (employeeAttendeeState.sourceGeneration !== employeeAttendeeState.generation) { return false; }
  if (employeeAttendeeState.sourceFingerprint !== employeeAttendeeState.fingerprint) { return false; }
  if (employeeAttendeeState.sourceFingerprint
    !== employeeAttendeeFingerprint(employeeAttendeeState.control)) { return false; }
  if (isObject(candidate)) {
    if (own(candidate, '__receiptAttendeeFingerprint')
      && textOf(candidate.__receiptAttendeeFingerprint) !== employeeAttendeeState.sourceFingerprint) {
      return false;
    }
    if (own(candidate, '__receiptAttendeeGeneration')
      && Number(candidate.__receiptAttendeeGeneration) !== employeeAttendeeState.generation) {
      return false;
    }
    if (own(candidate, '__receiptAttendeeQuery')
      && textOf(candidate.__receiptAttendeeQuery) !== employeeAttendeeState.sourceQuery) {
      return false;
    }
  }
  return true;
}

function employeeAttendeeIsDuplicate(row, name, title) {
  var control = employeeAttendeeState.control;
  if (!control) { return true; }
  var rowId = row.PERSON_ID;
  var hasRowId = rowId !== undefined && rowId !== null && textOf(rowId) !== '';
  for (var i = 0; i < employeeAttendeeState.items.length; i += 1) {
    if (hasRowId && employeeAttendeeState.ids[i] !== ''
      && textOf(employeeAttendeeState.ids[i]) === textOf(rowId)) {
      return true;
    }
    var item = employeeAttendeeState.items[i];
    var itemName = arrayItemName(item, control.summaryProperty);
    if (itemName !== name) { continue; }
    if (isObject(item) && own(item, 'employeeTitle')) {
      if (textOf(item.employeeTitle) === title) { return true; }
      continue;
    }
    // A restored legacy string has no title to compare; its exact name is the
    // whole restored identity.
    return true;
  }
  return false;
}

function addEmployeeAttendeeSelection(row) {
  var control = employeeAttendeeState.control;
  if (!control || !employeeAttendeeActive() || !isObject(row)) { return false; }
  var name = textOf(row.EMPLOYEE_NAME);
  if (isBlank(name)) { return false; }
  var title = textOf(row.TITLE);
  if (employeeAttendeeIsDuplicate(row, name, title)) {
    setEmployeeAttendeeStatus('That employee is already selected.', 'error');
    return false;
  }
  employeeAttendeeState.items.push({
    employeeName: name,
    employeeTitle: title
  });
  employeeAttendeeState.ids.push(
    row.PERSON_ID === undefined || row.PERSON_ID === null ? '' : textOf(row.PERSON_ID));
  syncEmployeeAttendeeLine();
  renderEmployeeAttendeeRoster();
  updateEmployeeAttendeeSummary();
  updateEmployeeAttendeeCount();
  return true;
}

function removeEmployeeAttendeeAt(index) {
  if (!employeeAttendeeActive()) { return; }
  if (!employeeAttendeeState.control) { return; }
  var at = Number(index);
  if (!isFinite(at) || Math.floor(at) !== at || at < 0
    || at >= employeeAttendeeState.items.length) { return; }
  employeeAttendeeState.items.splice(at, 1);
  employeeAttendeeState.ids.splice(at, 1);
  syncEmployeeAttendeeLine();
  renderEmployeeAttendeeRoster();
  updateEmployeeAttendeeSummary();
  updateEmployeeAttendeeCount();
  setEmployeeAttendeeStatus('Employee removed.', 'success');
}

function syncEmployeeAttendeeLine() {
  var control = employeeAttendeeState.control;
  if (!control || !employeeAttendeeActive()) { return; }
  receiptLine[control.property] = copyOf(employeeAttendeeState.items);
  try { Storage.set(control.property, JSON.stringify(receiptLine[control.property])); } catch (ignoredStore) { }
}

function renderEmployeeAttendeeRoster() {
  var list = employeeAttendeeState.list;
  var control = employeeAttendeeState.control;
  if (!list || !control) { return; }
  while (list.firstChild) { list.removeChild(list.firstChild); }
  employeeAttendeeState.items.forEach(function (item, index) {
    var row = createEmployeeAttendeeNode('div', 'receipt-attendee-row', '');
    if (!row) { return; }
    var name = createEmployeeAttendeeNode('span', 'receipt-attendee-name', '');
    if (name) {
      name.textContent = arrayItemName(item, control.summaryProperty);
      row.appendChild(name);
    }
    var detailText = employeeAttendeeItemDetail(item);
    if (detailText !== '') {
      var detail = createEmployeeAttendeeNode('span', 'receipt-attendee-detail', '');
      if (detail) {
        detail.textContent = detailText;
        row.appendChild(detail);
      }
    }
    var remove = createEmployeeAttendeeNode('button', 'receipt-attendee-remove', '');
    if (remove) {
      remove.textContent = 'Remove';
      if (remove.setAttribute) {
        remove.setAttribute('type', 'button');
        remove.setAttribute('aria-label', 'Remove ' + arrayItemName(item, control.summaryProperty));
      }
      remove.addEventListener('click', function (event) {
        if (event && event.preventDefault) { event.preventDefault(); }
        removeEmployeeAttendeeAt(index);
      });
      row.appendChild(remove);
    }
    list.appendChild(row);
  });
  updateEmployeeAttendeeVisibility();
}

function updateEmployeeAttendeeSummary() {
  var control = employeeAttendeeState.control;
  if (!control || !employeeAttendeeActive()) { return; }
  if (control.summaryFieldId === '' || !elementOf(control.summaryFieldId)) { return; }
  var names = [];
  employeeAttendeeState.items.forEach(function (item) {
    var name = arrayItemName(item, control.summaryProperty);
    if (textOf(name) !== '') { names.push(textOf(name)); }
  });
  // Display-only compatibility summary. It is never parsed back into the
  // roster, so a comma inside an employee name cannot become two attendees.
  // The roster is the visible representation, so keep this field hidden.
  setReceiptField(control.summaryFieldId, names.join(', '), false, true);
  hideEmployeeAttendeeField(control.summaryFieldId);
}

function handleEmployeeAttendeeInputChanged() {
  if (!employeeAttendeeActive()) { return; }
  var control = employeeAttendeeState.control;
  var query = employeeAttendeeCurrentQuery(control);
  cancelEmployeeAttendeeTimer();
  invalidateEmployeeAttendeeSource();
  if (query.length < control.minSearchLength) {
    setEmployeeAttendeeStatus('', '');
    return;
  }
  setEmployeeAttendeeStatus('Searching employees...', 'loading');
  employeeAttendeeState.timer = setTimeout(function () {
    employeeAttendeeState.timer = null;
    requestEmployeeAttendeeSearch(query, false, true);
  }, employeeAttendeeSearchDelay);
}

function requestEmployeeAttendeeSearch(query, force, openOnSuccess) {
  if (!employeeAttendeeActive() || employeeAttendeeBusy()) { return; }
  var control = employeeAttendeeState.control;
  if (!control) { return; }
  var term = textOf(query).replace(/^\s+|\s+$/g, '');
  if (term.length < control.minSearchLength) { return; }
  var fingerprint = employeeAttendeeFingerprint(control);
  if (fingerprint !== employeeAttendeeState.fingerprint) { return; }
  var key = fingerprint + '\u0002' + term;
  if (employeeAttendeeState.pending) {
    if (employeeAttendeeState.pendingKey === key) {
      if (openOnSuccess === true) { employeeAttendeeState.pendingOpen = true; }
      return;
    }
    // A new query supersedes the pending one.
    invalidateEmployeeAttendeeSource();
  }
  if (force !== true && employeeAttendeeState.source.length
    && employeeAttendeeState.sourceFingerprint === fingerprint
    && employeeAttendeeState.sourceQuery === term
    && employeeAttendeeState.sourceGeneration === employeeAttendeeState.generation) {
    if (openOnSuccess === true) { showNativeEmployeeAttendeeSuggestions(); }
    return;
  }
  if (textOf(control.service) === '') {
    setEmployeeAttendeeStatus('The employee attendee lookup is not configured. Contact your administrator.', 'error');
    return;
  }
  cancelEmployeeAttendeeTimer();
  employeeAttendeeState.generation += 1;
  var generation = employeeAttendeeState.generation;
  employeeAttendeeState.pending = true;
  employeeAttendeeState.pendingKey = key;
  employeeAttendeeState.pendingQuery = term;
  employeeAttendeeState.pendingOpen = openOnSuccess === true;
  employeeAttendeeState.source = [];
  employeeAttendeeState.sourceFingerprint = '';
  employeeAttendeeState.sourceQuery = '';
  employeeAttendeeState.sourceGeneration = 0;
  clearNativeEmployeeAttendeeSuggestions();
  setEmployeeAttendeeStatus('Searching employees...', 'loading');

  var service = control.service;
  var params = {
    AttendeeName: term,
    P_LANGUAGE: control.language
  };

  function requestIsCurrent() {
    return generation === employeeAttendeeState.generation
      && employeeAttendeeActive()
      && employeeAttendeeState.fingerprint === fingerprint
      && employeeAttendeeFingerprint(control) === fingerprint;
  }

  function failLookup(message) {
    if (!requestIsCurrent()) { return; }
    employeeAttendeeState.pending = false;
    employeeAttendeeState.pendingKey = '';
    employeeAttendeeState.pendingQuery = '';
    employeeAttendeeState.pendingOpen = false;
    employeeAttendeeState.source = [];
    employeeAttendeeState.sourceFingerprint = '';
    employeeAttendeeState.sourceQuery = '';
    employeeAttendeeState.sourceGeneration = 0;
    clearNativeEmployeeAttendeeSuggestions();
    setEmployeeAttendeeStatus(message, 'error');
  }

  try {
    Services.call(service, function (rawResponse) {
      if (!requestIsCurrent()) { return; }
      var rows;
      try {
        rows = employeeAttendeeRowsFromResponse(rawResponse);
      } catch (ignoredResponseProblem) {
        failLookup('The employee lookup returned an invalid response. Try again.');
        return;
      }
      var shouldOpen = employeeAttendeeState.pendingOpen === true;
      employeeAttendeeState.pending = false;
      employeeAttendeeState.pendingKey = '';
      employeeAttendeeState.pendingQuery = '';
      employeeAttendeeState.pendingOpen = false;
      if (rows.length > control.maxResults) {
        employeeAttendeeState.source = [];
        employeeAttendeeState.sourceFingerprint = '';
        employeeAttendeeState.sourceQuery = '';
        employeeAttendeeState.sourceGeneration = 0;
        clearNativeEmployeeAttendeeSuggestions();
        setEmployeeAttendeeStatus('Too many employees match. Refine the search by typing more of the name.', 'refine');
        return;
      }
      if (!rows.length) {
        employeeAttendeeState.source = [];
        employeeAttendeeState.sourceFingerprint = '';
        employeeAttendeeState.sourceQuery = '';
        employeeAttendeeState.sourceGeneration = 0;
        clearNativeEmployeeAttendeeSuggestions();
        setEmployeeAttendeeStatus('No employees matched that search.', 'empty');
        return;
      }
      employeeAttendeeState.source = rows;
      employeeAttendeeState.sourceFingerprint = fingerprint;
      employeeAttendeeState.sourceQuery = term;
      employeeAttendeeState.sourceGeneration = generation;
      if (shouldOpen) { showNativeEmployeeAttendeeSuggestions(); }
      setEmployeeAttendeeStatus(rows.length
        + (rows.length === 1 ? ' employee found.' : ' employees found.'), 'success');
    }, function () {
      failLookup('The employee lookup failed. Check your connection and try again.');
    }, params);
  } catch (ignoredCallProblem) {
    failLookup('The employee lookup failed. Check your connection and try again.');
  }
}

function openEmployeeAttendeeSuggestions(force) {
  if (!employeeAttendeeActive() || employeeAttendeeBusy()) { return; }
  var control = employeeAttendeeState.control;
  if (!control) { return; }
  var query = employeeAttendeeCurrentQuery(control);
  if (query.length < control.minSearchLength) {
    invalidateEmployeeAttendeeSource();
    setEmployeeAttendeeStatus('', '');
    return;
  }
  if (force !== true && employeeAttendeeState.source.length
    && employeeAttendeeState.sourceFingerprint === employeeAttendeeState.fingerprint
    && employeeAttendeeState.sourceQuery === query
    && employeeAttendeeState.sourceGeneration === employeeAttendeeState.generation) {
    showNativeEmployeeAttendeeSuggestions();
    return;
  }
  if (employeeAttendeeState.pending) {
    var key = employeeAttendeeState.fingerprint + '\u0002' + query;
    if (employeeAttendeeState.pendingKey === key) {
      employeeAttendeeState.pendingOpen = true;
      return;
    }
  }
  requestEmployeeAttendeeSearch(query, force === true, true);
}

function clearEmployeeAttendeeSearchAfterSelect() {
  var control = employeeAttendeeState.control;
  if (!control) { return; }
  invalidateEmployeeAttendeeSource();
  var input = elementOf(control.fieldId);
  if (input) {
    try { input.value = ''; } catch (ignoredInput) { }
  }
  try { Fields.set(control.fieldId, ''); } catch (ignoredField) { }
  try { Storage.remove(control.fieldId); } catch (ignoredStorage) { }
}

function handleEmployeeAttendeeNativeSelect(event, ui) {
  var selected = isObject(ui) ? ui.item : null;
  var candidate = selected;
  if (isObject(candidate) && isObject(candidate.item)) { candidate = candidate.item; }
  if (!isObject(candidate)) { return false; }
  if (employeeAttendeeBusy()) { return false; }
  if (!employeeAttendeeSelectionIsCurrent(candidate)) { return false; }
  var row = employeeAttendeeSourceRow(candidate);
  if (row === null) { return false; }
  if (addEmployeeAttendeeSelection(row)) {
    clearEmployeeAttendeeSearchAfterSelect();
    setEmployeeAttendeeStatus('Employee added.', 'success');
  }
  return false;
}

// Native Lov calls window.AttendeeName_lov_item_handler(item) after a click.
// The guarded custom select above is the normal path; this hook exists for
// generated runtime hooks and applies exactly the same current-row checks.
function AttendeeName_lov_item_handler(arrayItem) {
  var candidate = arrayItem;
  if (isObject(candidate) && isObject(candidate.item)) { candidate = candidate.item; }
  if (!isObject(candidate)) { return; }
  if (employeeAttendeeBusy()) { return; }
  if (!employeeAttendeeSelectionIsCurrent(candidate)) { return; }
  var row = employeeAttendeeSourceRow(candidate);
  if (row === null) { return; }
  addEmployeeAttendeeSelection(row);
}

function AttendeeName_lov_item_presenter(arrayItem) {
  return isObject(arrayItem) ? employeeAttendeeSuggestionLabel(arrayItem) : '';
}

// The generated hooks look these up on window. Both are fully guarded; the
// custom autocomplete select remains the normal path that owns the roster and
// search clear.
if (typeof window !== 'undefined' && window) {
  window.AttendeeName_lov_item_handler = AttendeeName_lov_item_handler;
  window.AttendeeName_lov_item_presenter = AttendeeName_lov_item_presenter;
}

function renderEmployeeAttendees(property, meta, value) {
  var control = employeeAttendeeControlFor(property, meta);
  if (control === null) {
    resetEmployeeAttendeeEditor();
    return;
  }
  var input = elementOf(control.fieldId);
  var trigger = elementOf(control.fieldId + '_lov_trigger');
  var fingerprint = employeeAttendeeFingerprint(control);
  if (fingerprint !== employeeAttendeeState.fingerprint
    || employeeAttendeeState.element !== input
    || employeeAttendeeState.property !== control.property) {
    invalidateEmployeeAttendeeSource();
    employeeAttendeeState.fingerprint = fingerprint;
    employeeAttendeeState.control = control;
    employeeAttendeeState.property = control.property;
    employeeAttendeeState.fieldId = control.fieldId;
    employeeAttendeeState.summaryFieldId = control.summaryFieldId;
    employeeAttendeeState.service = control.service;
    employeeAttendeeState.language = control.language;
    employeeAttendeeState.minSearchLength = control.minSearchLength;
    employeeAttendeeState.maxResults = control.maxResults;
    employeeAttendeeState.items = employeeAttendeeItemsFromLoaded(value);
    employeeAttendeeState.ids = employeeAttendeeIdsForItems(employeeAttendeeState.items);
  }
  employeeAttendeeState.active = true;
  employeeAttendeeState.element = input;
  employeeAttendeeState.trigger = trigger;
  ensureEmployeeAttendeeDom(control);
  bindEmployeeAttendeeNativeCapture(input, trigger);
  bindEmployeeAttendeeInputSync(input);
  showEmployeeAttendeeField(control.fieldId);
  // The roster replaces the old comma-separated summary while this editor is
  // active. The summary is still synchronized internally for compatibility.
  if (control.summaryFieldId !== '') { hideEmployeeAttendeeField(control.summaryFieldId); }
  showEmployeeAttendeeTrigger(control.fieldId);
  prepareEmployeeAttendeeAutocomplete();
  neutralizeEmployeeAttendeeGeneratedHandlers();
  renderEmployeeAttendeeRoster();
  updateEmployeeAttendeeSummary();
  updateEmployeeAttendeeCount();
  updateEmployeeAttendeeVisibility();
}

function applyEmployeeAttendeeMode() {
  var current = currentEmployeeAttendee();
  if (current === null) {
    resetEmployeeAttendeeEditor();
    return;
  }
  renderEmployeeAttendees(current.property, current.meta, receiptLine[current.property]);
}

// ---------- structured guest editor ----------
//
// The designer owns #GuestAttendees (label only), #GuestName, #Employer and
// #Add_Guest. Add_Guest starts in a shared designer button row and its native
// action calls click_Add_Guest(). This page relocates only its own wrapper
// beside the Employer input; it never creates or replaces those controls. It
// binds them and generates only the roster, status and Cancel button.

function currentGuestEditor() {
  var properties = Object.keys(receiptFields);
  for (var i = 0; i < properties.length; i += 1) {
    var property = properties[i];
    var meta = receiptFields[property];
    if (!isObject(meta)) { continue; }
    if (meta.visible === false) { continue; }
    if (textOf(meta.control) !== guestControlName) { continue; }
    var fieldId = propertyOf(meta.fieldId);
    if (fieldId === '') { continue; }
    return { property: property, meta: meta };
  }
  return null;
}

function guestControlFor(property, meta) {
  if (!isObject(meta) || textOf(meta.control) !== guestControlName) { return null; }
  var fieldId = propertyOf(meta.fieldId);
  if (fieldId === '') { return null; }
  return {
    property: propertyOf(property),
    fieldId: fieldId,
    nameFieldId: propertyOf(meta.nameFieldId) || guestNameFallbackFieldId,
    employerFieldId: propertyOf(meta.employerFieldId) || guestEmployerFallbackFieldId,
    addButtonId: propertyOf(meta.addButtonId) || guestAddFallbackFieldId
  };
}

function guestFingerprint(control) {
  return [
    textOf(currentReceiptId()),
    textOf(receiptCore.expenseType),
    textOf(control.property),
    textOf(control.fieldId),
    textOf(control.nameFieldId),
    textOf(control.employerFieldId),
    textOf(control.addButtonId)
  ].join('\u0001');
}

function guestActive() {
  if (guestState.active !== true) { return false; }
  if (!isObject(guestState.control)) { return false; }
  var current = currentGuestEditor();
  if (current === null) { return false; }
  if (current.property !== guestState.property) { return false; }
  if (guestState.fingerprint === '') { return false; }
  return guestState.fingerprint === guestFingerprint(guestState.control);
}

function guestBusy() {
  return receiptLoading || expenseTypeBusy || saveBusy;
}

function guestItemsFromLoaded(value) {
  if (!Array.isArray(value)) { return []; }
  return copyOf(value.filter(function (item) { return isObject(item); }));
}

function createGuestNode(tag, className, id) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') { return null; }
  var node = document.createElement(tag);
  if (className) { node.className = className; }
  if (id) { node.id = id; }
  return node;
}

function guestEditorId(fieldId) { return fieldId + '_guest_editor'; }
function guestCancelId(fieldId) { return fieldId + '_guest_cancel'; }
function guestStatusId(fieldId) { return fieldId + '_guest_status'; }
function guestListId(fieldId) { return fieldId + '_guest_list'; }

function guestControlDefaults(control) {
  return {
    fieldId: propertyOf(control && control.fieldId) || guestFallbackFieldId,
    nameFieldId: propertyOf(control && control.nameFieldId) || guestNameFallbackFieldId,
    employerFieldId: propertyOf(control && control.employerFieldId) || guestEmployerFallbackFieldId,
    addButtonId: propertyOf(control && control.addButtonId) || guestAddFallbackFieldId
  };
}

function nodeNameOf(node) { return textOf(node && node.nodeName).toUpperCase(); }

function firstDescendantByNodeName(node, nodeName) {
  if (!node) { return null; }
  if (nodeNameOf(node) === nodeName) { return node; }
  var children = node.childNodes || [];
  for (var i = 0; i < children.length; i += 1) {
    var found = firstDescendantByNodeName(children[i], nodeName);
    if (found) { return found; }
  }
  return null;
}

function hasCssClass(element, name) {
  var classes = textOf(element && element.className).split(/\s+/);
  for (var i = 0; i < classes.length; i += 1) {
    if (classes[i] === name) { return true; }
  }
  return false;
}

function addCssClass(element, name) {
  if (!element || name === '' || hasCssClass(element, name)) { return; }
  element.className = (textOf(element.className) + ' ' + name).replace(/^\s+|\s+$/g, '');
}

function removeCssClass(element, name) {
  if (!element) { return; }
  var classes = textOf(element.className).split(/\s+/);
  var kept = [];
  for (var i = 0; i < classes.length; i += 1) {
    if (classes[i] !== '' && classes[i] !== name) { kept.push(classes[i]); }
  }
  element.className = kept.join(' ');
}

function guestAnchor(control) {
  var employerContainer = elementOf(control.employerFieldId + '_container');
  if (employerContainer && employerContainer.parentElement
    && hasCssClass(employerContainer.parentElement, 'outer-field-container')) {
    return employerContainer.parentElement;
  }
  if (employerContainer) { return employerContainer; }
  var nameContainer = elementOf(control.nameFieldId + '_container');
  if (nameContainer && nameContainer.parentElement
    && hasCssClass(nameContainer.parentElement, 'outer-field-container')) {
    return nameContainer.parentElement;
  }
  if (nameContainer) { return nameContainer; }
  var labelContainer = elementOf(control.fieldId + '_container');
  if (labelContainer) { return labelContainer; }
  return null;
}

function guestAddWrapper(control) {
  var ids = guestControlDefaults(control);
  var button = elementOf(ids.addButtonId);
  var node = button ? button.parentElement : null;
  while (node && nodeNameOf(node) !== 'BODY' && nodeNameOf(node) !== 'HTML') {
    // Add_Guest's native wrapper is its own button-field-container SPAN. The
    // designer initially places it in a shared outer-field-container row with
    // unrelated buttons, so the walk stops before that row. After relocation
    // the same span is found directly, and the shared row is never returned.
    if (hasCssClass(node, 'outer-field-container')) { return null; }
    if (nodeNameOf(node) === 'SPAN' && hasCssClass(node, 'button-field-container')) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function guestEmployerActionId(employerFieldId) {
  return employerFieldId + '_guest_action';
}

function guestEmployerInputHost(employerContainer, employerInput) {
  var node = employerInput;
  while (node && node !== employerContainer) {
    if (hasCssClass(node, 'ui-input-text')) { return node; }
    node = node.parentElement;
  }
  return employerInput;
}

function prepareGuestEmployerAction(control, employerContainer, employerInput, wrapper) {
  if (!employerContainer || !employerInput || !wrapper) { return; }
  var host = guestEmployerInputHost(employerContainer, employerInput);
  if (!host) { return; }
  var actionId = guestEmployerActionId(control.employerFieldId);
  var action = elementOf(actionId);
  if (!action) {
    action = createGuestNode('div', 'receipt-guest-employer-action', actionId);
    if (!action) { return; }
    // Keep the native Employer label first and the action row directly beneath it.
    if (host.parentElement === employerContainer) {
      employerContainer.insertBefore(action, host);
    } else {
      employerContainer.appendChild(action);
    }
  }
  if (action.parentElement !== employerContainer) { employerContainer.appendChild(action); }
  if (host.parentElement !== action) { action.insertBefore(host, action.firstChild || null); }
  if (wrapper.parentElement !== action) { action.appendChild(wrapper); }
  addCssClass(employerContainer, 'receipt-guest-employer-field');
}

function setGuestElementVisible(element, visible) {
  if (!element) { return; }
  if (element.style) { element.style.display = visible ? '' : 'none'; }
  element.hidden = visible !== true;
}

function setGuestFieldVisible(fieldId, visible) {
  if (fieldId === '') { return; }
  var input = elementOf(fieldId);
  if (input) {
    if (typeof Fields !== 'undefined' && Fields) {
      try {
        if (visible) { Fields.show(fieldId); } else { Fields.hide(fieldId); }
      } catch (ignoredGuestField) { }
    }
  }
  setGuestElementVisible(input, visible);
  setGuestElementVisible(elementOf(fieldId + '_container'), visible);
}

function setGuestControlsVisible(control, visible) {
  var ids = guestControlDefaults(control);
  setGuestFieldVisible(ids.fieldId, visible);
  setGuestFieldVisible(ids.nameFieldId, visible);
  setGuestFieldVisible(ids.employerFieldId, visible);
  setGuestFieldVisible(ids.addButtonId, visible);
  var wrapper = guestAddWrapper(control);
  if (wrapper) { setGuestElementVisible(wrapper, visible); }
}

function prepareGuestNativeControls(control) {
  var addButton = elementOf(control.addButtonId);
  if (addButton) {
    addCssClass(addButton, 'receipt-guest-add');
    // Add_Guest is relocated inside #mainForm; an explicit button type keeps
    // the native click action from becoming an implicit form submit.
    addButton.type = 'button';
    if (addButton.setAttribute) { addButton.setAttribute('type', 'button'); }
  }
  var wrapper = guestAddWrapper(control);
  if (wrapper) { addCssClass(wrapper, 'receipt-guest-add-wrapper'); }

  var employerInput = elementOf(control.employerFieldId);
  if (employerInput) {
    employerInput.required = false;
    if (employerInput.removeAttribute) { employerInput.removeAttribute('required'); }
    if (employerInput.setAttribute) { employerInput.setAttribute('aria-required', 'false'); }
    // The optional hint is a placeholder only; it must never become the value.
    employerInput.placeholder = 'optional';
  }
  var employerContainer = elementOf(control.employerFieldId + '_container');
  var employerLabel = firstDescendantByNodeName(employerContainer, 'LABEL');
  if (employerLabel) {
    var employerLabelText = firstDescendantByNodeName(employerLabel, 'NOBR');
    if (!employerLabelText) {
      employerLabelText = document.createElement('NOBR');
      while (employerLabel.firstChild) {
        employerLabel.removeChild(employerLabel.firstChild);
      }
      employerLabel.appendChild(employerLabelText);
    }
    employerLabelText.textContent = 'Employer';
  }
  prepareGuestEmployerAction(control, employerContainer, employerInput, wrapper);
}

function bindGuestKeyInput(input) {
  if (!input || input.__receiptGuestKeyBound === true) { return; }
  input.addEventListener('keydown', guestFormKeyDown);
  input.__receiptGuestKeyBound = true;
}

function ensureGuestDom(control) {
  var editorId = guestEditorId(control.fieldId);
  var editor = elementOf(editorId);
  if (!editor) {
    var anchor = guestAnchor(control);
    if (anchor && anchor.parentNode) {
      editor = createGuestNode('div', 'receipt-guest-editor', editorId);
      var cancelButton = createGuestNode('button', 'receipt-guest-cancel', guestCancelId(control.fieldId));
      var status = createGuestNode('div', 'receipt-guest-status', guestStatusId(control.fieldId));
      var list = createGuestNode('div', 'receipt-guest-list', guestListId(control.fieldId));
      if (!editor || !cancelButton || !status || !list) {
        editor = null;
      } else {
        if (cancelButton.setAttribute) {
          cancelButton.setAttribute('type', 'button');
          cancelButton.setAttribute('aria-label', 'Cancel guest edit');
          status.setAttribute('role', 'status');
          status.setAttribute('aria-live', 'polite');
          status.setAttribute('aria-atomic', 'true');
        }
        cancelButton.textContent = 'Cancel';
        if (cancelButton.style) { cancelButton.style.display = 'none'; }
        editor.appendChild(status);
        editor.appendChild(list);
        editor.appendChild(cancelButton);
        anchor.parentNode.insertBefore(editor, anchor.nextSibling || null);
        if (cancelButton.__receiptGuestBound !== true) {
          cancelButton.addEventListener('click', function (event) {
            if (event && event.preventDefault) { event.preventDefault(); }
            cancelGuestEdit();
          });
          cancelButton.__receiptGuestBound = true;
        }
      }
    }
  }
  guestState.editorId = editor ? editorId : '';
  guestState.nameInput = elementOf(control.nameFieldId);
  guestState.employerInput = elementOf(control.employerFieldId);
  guestState.addButton = elementOf(control.addButtonId);
  guestState.cancelButton = elementOf(guestCancelId(control.fieldId));
  guestState.status = elementOf(guestStatusId(control.fieldId));
  guestState.list = elementOf(guestListId(control.fieldId));
  prepareGuestNativeControls(control);
  bindGuestKeyInput(guestState.nameInput);
  bindGuestKeyInput(guestState.employerInput);
  return !!(guestState.nameInput && guestState.employerInput && guestState.addButton
    && guestState.cancelButton && guestState.status && guestState.list);
}

function guestStatusNeedsEditor() {
  var status = guestState.status;
  if (!status) { return false; }
  // Validation failures must stay visible even when there are no guests;
  // prompts and routine success text only accompany a populated roster.
  return /(^|\s)receipt-guest-status-error(\s|$)/.test(textOf(status.className));
}

function updateGuestEditorVisibility() {
  var editor = guestState.editorId ? elementOf(guestState.editorId) : null;
  if (!editor || !editor.style) { return; }
  var hasItems = guestState.active === true
    && Array.isArray(guestState.items)
    && guestState.items.length > 0;
  var editing = guestState.active === true && guestState.editIndex >= 0;
  editor.style.display = hasItems || editing || guestStatusNeedsEditor() ? '' : 'none';
}

function showGuestDom() {
  setGuestControlsVisible(guestState.control, true);
  updateGuestEditorVisibility();
}

function hideGuestDom() {
  var editor = guestState.editorId ? elementOf(guestState.editorId) : null;
  if (editor && editor.style) { editor.style.display = 'none'; }
  setGuestControlsVisible(guestState.control, false);
}

function setGuestStatus(message, kind) {
  var status = guestState.status;
  if (!status) { return; }
  status.textContent = textOf(message);
  status.className = 'receipt-guest-status'
    + (kind ? ' receipt-guest-status-' + kind : '');
  updateGuestEditorVisibility();
}

function bindGuestInputSync(input) {
  if (!input || typeof $ === 'undefined') { return; }
  try { $(input).off(guestTextEvent); } catch (ignoredOff) { }
  try { $(input).on(guestTextEvent, handleGuestFormInput); } catch (ignoredOn) { }
}

function guestFormKeyDown(event) {
  if (!event) { return; }
  var key = textOf(event.key);
  var code = Number(event.keyCode);
  if (key === 'Enter' || code === 13) {
    if (event.preventDefault) { event.preventDefault(); }
    commitGuestForm();
    return;
  }
  if (key === 'Escape' || code === 27) {
    if (event.preventDefault) { event.preventDefault(); }
    cancelGuestEdit();
  }
}

function guestItemName(item) {
  return isObject(item) ? textOf(item.name) : '';
}

function guestItemEmployer(item) {
  return isObject(item) ? textOf(item.employer) : '';
}

function guestDuplicateName(name, skipIndex) {
  var key = textOf(name).trim().toLowerCase();
  if (key === '') { return false; }
  for (var i = 0; i < guestState.items.length; i += 1) {
    if (i === skipIndex) { continue; }
    if (guestItemName(guestState.items[i]).trim().toLowerCase() === key) { return true; }
  }
  return false;
}

function setGuestFormEditing(editing) {
  var editingNow = editing === true;
  var addButton = guestState.addButton;
  if (addButton) {
    var label = editingNow ? 'Update Guest' : 'Add Guest';
    addButton.title = label;
    if (addButton.setAttribute) {
      addButton.setAttribute('title', label);
      addButton.setAttribute('aria-label', label);
    }
    var icon = firstDescendantByNodeName(addButton, 'I');
    if (icon) {
      removeCssClass(icon, 'fa-plus');
      removeCssClass(icon, 'fa-check');
      addCssClass(icon, editingNow ? 'fa-check' : 'fa-plus');
    }
  }
  if (guestState.cancelButton && guestState.cancelButton.style) {
    guestState.cancelButton.style.display = editingNow ? '' : 'none';
  }
}

function guestFormInput(ref, fieldId, fallbackId) {
  if (ref) { return ref; }
  var id = propertyOf(fieldId);
  return elementOf(id === '' ? fallbackId : id);
}

function clearGuestForm() {
  guestState.editIndex = -1;
  // A reset clears the native refs before the next metadata binding. Resolve
  // the designer field ids too so stale native values never survive that gap.
  var nameInput = guestFormInput(
    guestState.nameInput, guestState.nameFieldId, guestNameFallbackFieldId);
  var employerInput = guestFormInput(
    guestState.employerInput, guestState.employerFieldId, guestEmployerFallbackFieldId);
  if (nameInput) {
    try { nameInput.value = ''; } catch (ignoredGuestName) { }
  }
  if (employerInput) {
    try { employerInput.value = ''; } catch (ignoredGuestEmployer) { }
  }
  setGuestFormEditing(false);
}

function guestHasPendingForm() {
  if (!guestActive()) { return false; }
  if (guestState.editIndex >= 0) { return true; }
  if (guestState.nameInput && textOf(guestState.nameInput.value).trim() !== '') { return true; }
  if (guestState.employerInput && textOf(guestState.employerInput.value).trim() !== '') { return true; }
  return false;
}

function syncGuestLine() {
  var control = guestState.control;
  if (!control || !guestActive()) { return; }
  receiptLine[control.property] = copyOf(guestState.items);
  try {
    Storage.set(control.property, JSON.stringify(receiptLine[control.property]));
  } catch (ignoredGuestStore) { }
}

function renderGuestRoster() {
  var list = guestState.list;
  if (!list) { return; }
  while (list.firstChild) { list.removeChild(list.firstChild); }
  guestState.items.forEach(function (item, index) {
    var row = createGuestNode('div', 'receipt-guest-row', '');
    if (!row) { return; }
    var name = createGuestNode('span', 'receipt-guest-name', '');
    if (name) {
      name.textContent = guestItemName(item);
      row.appendChild(name);
    }
    var employer = createGuestNode('span', 'receipt-guest-employer', '');
    if (employer) {
      employer.textContent = guestItemEmployer(item);
      row.appendChild(employer);
    }
    var edit = createGuestNode('button', 'receipt-guest-edit', '');
    if (edit) {
      edit.textContent = 'Edit';
      if (edit.setAttribute) {
        edit.setAttribute('type', 'button');
        edit.setAttribute('aria-label', 'Edit ' + guestItemName(item));
      }
      edit.addEventListener('click', function (event) {
        if (event && event.preventDefault) { event.preventDefault(); }
        startGuestEdit(index);
      });
      row.appendChild(edit);
    }
    var remove = createGuestNode('button', 'receipt-guest-remove', '');
    if (remove) {
      remove.textContent = 'Remove';
      if (remove.setAttribute) {
        remove.setAttribute('type', 'button');
        remove.setAttribute('aria-label', 'Remove ' + guestItemName(item));
      }
      remove.addEventListener('click', function (event) {
        if (event && event.preventDefault) { event.preventDefault(); }
        removeGuestAt(index);
      });
      row.appendChild(remove);
    }
    list.appendChild(row);
  });
  updateGuestEditorVisibility();
}

function updateEmployeeAttendeeCount() {
  var countMeta = own(receiptFields, 'numberOfAttendeesOrRecipients')
    ? receiptFields.numberOfAttendeesOrRecipients : null;
  if (!isObject(countMeta)) { return; }
  var employees = employeeAttendeeState.active === true
    && employeeAttendeeState.property === 'employees'
    && Array.isArray(employeeAttendeeState.items)
    ? employeeAttendeeState.items.length
    : (Array.isArray(receiptLine.employees) ? receiptLine.employees.length : 0);
  var guests = guestState.active === true
    && guestState.property === 'guest'
    && Array.isArray(guestState.items)
    ? guestState.items.length
    : (Array.isArray(receiptLine.guest) ? receiptLine.guest.length : 0);
  var count = employees + guests;
  receiptLine.numberOfAttendeesOrRecipients = count;
  try { Storage.set('numberOfAttendeesOrRecipients', count); } catch (ignoredCountStore) { }
  // The count is saved even when this designer has no count field. Only the
  // optional DOM update depends on the field being present.
  var fieldId = propertyOf(countMeta.fieldId);
  if (fieldId === '' || !elementOf(fieldId)) { return; }
  setReceiptField(fieldId, count, false, true);
}

function startGuestEdit(index) {
  if (!guestActive()) { return; }
  if (guestBusy()) {
    setGuestStatus('Please wait for the current action to finish.', 'error');
    return;
  }
  var at = Number(index);
  if (!isFinite(at) || Math.floor(at) !== at || at < 0
    || at >= guestState.items.length) { return; }
  var item = guestState.items[at];
  if (guestState.nameInput) { guestState.nameInput.value = guestItemName(item); }
  if (guestState.employerInput) { guestState.employerInput.value = guestItemEmployer(item); }
  guestState.editIndex = at;
  setGuestFormEditing(true);
  setGuestStatus('', '');
  updateSaveAction();
}

function cancelGuestEdit() {
  if (!guestActive()) { return; }
  clearGuestForm();
  setGuestStatus('', '');
  updateSaveAction();
}

function commitGuestForm() {
  if (!guestActive()) { return false; }
  if (guestBusy()) {
    setGuestStatus('Please wait for the current action to finish.', 'error');
    return false;
  }
  var name = textOf(guestState.nameInput ? guestState.nameInput.value : '').trim();
  var employer = textOf(guestState.employerInput ? guestState.employerInput.value : '').trim();
  if (name === '') {
    setGuestStatus('Enter the guest name.', 'error');
    return false;
  }
  var at = guestState.editIndex;
  if (guestDuplicateName(name, at)) {
    setGuestStatus('That guest is already added.', 'error');
    return false;
  }
  var message;
  if (at >= 0) {
    var updated = isObject(guestState.items[at]) ? copyOf(guestState.items[at]) : {};
    updated.name = name;
    updated.employer = employer;
    guestState.items[at] = updated;
    message = 'Guest updated.';
  } else {
    // New guests carry exactly the current contract: name and employer only.
    guestState.items.push({ name: name, employer: employer });
    message = 'Guest added.';
  }
  clearGuestForm();
  syncGuestLine();
  renderGuestRoster();
  updateEmployeeAttendeeCount();
  setGuestStatus(message, 'success');
  updateSaveAction();
  return true;
}

function removeGuestAt(index) {
  if (!guestActive()) { return; }
  if (guestBusy()) {
    setGuestStatus('Please wait for the current action to finish.', 'error');
    return;
  }
  var at = Number(index);
  if (!isFinite(at) || Math.floor(at) !== at || at < 0
    || at >= guestState.items.length) { return; }
  guestState.items.splice(at, 1);
  if (guestState.editIndex === at) {
    clearGuestForm();
  } else if (guestState.editIndex > at) {
    guestState.editIndex -= 1;
  }
  syncGuestLine();
  renderGuestRoster();
  updateEmployeeAttendeeCount();
  setGuestStatus('Guest removed.', 'success');
  updateSaveAction();
}

function handleGuestFormInput() {
  if (!guestActive()) { return; }
  // The save guard still reads the pending native form; no routine guidance
  // needs to stay on screen while the user is filling it.
  setGuestStatus('', '');
  updateSaveAction();
}

function renderGuestEditor(property, meta, value) {
  var control = guestControlFor(property, meta);
  if (control === null) {
    resetGuestEditor();
    return;
  }
  var fingerprint = guestFingerprint(control);
  if (fingerprint !== guestState.fingerprint
    || guestState.control === null
    || guestState.property !== control.property
    || guestState.editorId !== guestEditorId(control.fieldId)) {
    guestState.fingerprint = fingerprint;
    guestState.control = control;
    guestState.property = control.property;
    guestState.fieldId = control.fieldId;
    guestState.nameFieldId = control.nameFieldId;
    guestState.employerFieldId = control.employerFieldId;
    guestState.addButtonId = control.addButtonId;
    guestState.items = guestItemsFromLoaded(value);
    clearGuestForm();
  }
  guestState.active = true;
  ensureGuestDom(control);
  bindGuestInputSync(guestState.nameInput);
  bindGuestInputSync(guestState.employerInput);
  renderGuestRoster();
  syncGuestLine();
  updateEmployeeAttendeeCount();
  setGuestFormEditing(guestState.editIndex >= 0);
  showGuestDom();
  setGuestStatus('', '');
  updateSaveAction();
}

function applyGuestMode() {
  var current = currentGuestEditor();
  if (current === null) {
    resetGuestEditor();
    return;
  }
  renderGuestEditor(current.property, current.meta, receiptLine[current.property]);
}

function resetGuestEditor() {
  guestState.active = false;
  guestState.editIndex = -1;
  guestState.items = [];
  hideGuestDom();
  if (guestState.status) { setGuestStatus('', ''); }
  clearGuestForm();
  guestState.property = '';
  guestState.fieldId = '';
  guestState.nameFieldId = '';
  guestState.employerFieldId = '';
  guestState.addButtonId = '';
  guestState.fingerprint = '';
  guestState.control = null;
  guestState.items = [];
  guestState.editorId = '';
  guestState.nameInput = null;
  guestState.employerInput = null;
  guestState.addButton = null;
  guestState.cancelButton = null;
  guestState.status = null;
  guestState.list = null;
}


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
  resetEmployeeAttendeeEditor();
  resetGuestEditor();
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
  applyLocationMode();
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
  resetLocationControl();
  resetEmployeeAttendeeEditor();
  resetGuestEditor();
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
  resetLocationControl();
  resetEmployeeAttendeeEditor();
  resetGuestEditor();
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
    }, { EXPENSE_TYPE: requestedType, APP_NAME: 'LiveExpense_AI' });
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
  resetEmployeeAttendeeEditor();
  resetGuestEditor();
  receiptLine = extrasFromTemplate(previousExtras);
  storeReceiptLine(receiptLine);
  restoreRenderedType();
  showField('expenseType');
  Fields.enable('expenseType');
  applyLocationMode();
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
    // The employee attendee editor owns its roster below AttendeeName and
    // never renders the legacy editable-table summary control.
    if (textOf(meta.control) === employeeAttendeeControlName) { return; }
    // The guest editor owns the native GuestAttendees label and its roster;
    // no generated summary control is rendered for the guest array.
    if (textOf(meta.control) === guestControlName) { return; }
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
  applyEmployeeAttendeeMode();
  applyGuestMode();

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
    if (textOf(meta.control) === guestControlName) {
      // Guest data is structured. Never run it through the old editable-table
      // comma parser, and never read a display summary. Even when the editor
      // is not currently active, only object items are retained.
      var guestValue = guestState.active && guestState.property === property
        ? guestState.items
        : (Array.isArray(line[property]) ? line[property] : []);
      line[property] = copyOf(guestValue.filter(function (item) { return isObject(item); }));
      return;
    }
    if (meta.visible === false || meta.readOnly === true) { return; }

    if (textOf(meta.control) === employeeAttendeeControlName) {
      if (employeeAttendeeState.active && employeeAttendeeState.property === property) {
        line[property] = copyOf(employeeAttendeeState.items);
      }
      return;
    }
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
  if (guestHasPendingForm()) {
    return 'Add/Update/Cancel the pending guest before saving.';
  }
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

  invalidateEmployeeAttendeeSource();
  if (saveBusy) {
    Popup.ok('Receipt Details', 'Please wait for the save to finish.');
    return;
  }
  resetEmployeeAttendeeEditor();
  resetGuestEditor();
  resetLocationControl();
  if (window.parent && window.parent !== window
    && typeof window.parent.closeReceiptDetailsBesidePreview === 'function') {
    window.parent.closeReceiptDetailsBesidePreview();
    return;
  }
  Page.back();
}

function prepare_ReceiptBatch_ExpenseAttendee_lov_request() {
 var inputParams = {};
 inputParams['username'] = Fields.get("username");
 inputParams['password'] = Fields.get("password");
 inputParams['AttendeeName'] = Fields.get("AttendeeName");
 inputParams['P_LANGUAGE'] = Fields.get("P_LANGUAGE");
 return inputParams;
}

function click_Add_Guest() {
 //Fields.set(fieldName, value);
 //Services.call(serviceName, successFunction, failureFunction);
 //var popupMsg = Storage.get('PopupMessages');
 return commitGuestForm();
}