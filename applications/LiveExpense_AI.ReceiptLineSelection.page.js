// The shared loader reads its status input as a comma-separated value. Keep the
// legacy default in place for callers that do not publish a selection.
var statuses = 'READY,LINE_FAILED';
var RECEIPT_LINE_DEFAULT_STATUSES = statuses.split(',');
var RECEIPT_LINE_STATUSES_STORAGE_KEY = 'ReceiptLineSelectionStatuses';
var RECEIPT_LINE_PAGE_NAME = 'receiptlineselection.html';

// Resolve optional table columns by their headers, not fixed positions.

var RECEIPT_LINE_OUTPUT_INDEX_FIELDS = [
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

// Bounded wait for AuraPlayer/DataTables to finish initializing after a service
// response. This avoids a fixed-delay race without polling forever.
var RECEIPT_LINE_TABLE_WAIT_INTERVAL = 25;
var RECEIPT_LINE_TABLE_WAIT_ATTEMPTS = 80;

// Inline iframe sizing. The frame follows the content through the first four
// rendered receipt rows, bounded only by the parent viewport allowed by
// AuraPlayer's popup sizing (innerHeight - 75 - 65). Additional rows stay in the
// table and scroll vertically inside the frame.
var RECEIPT_LINE_INLINE_FRAME_PARENT_ALLOWANCE = 140;
var RECEIPT_LINE_INLINE_HOST_ID = 'cashFailedLinesHost';

var receiptLineSelectionActive = false;
var receiptLineSelectionGeneration = 0;
var receiptLineSelectionWaitTimer = null;
var receiptLineSelectionMode = '';
var receiptLineSelectionStatuses = RECEIPT_LINE_DEFAULT_STATUSES.slice();
var receiptLineSelectionPageChangedWrapper = null;
var receiptLineSelectionPreviousPageChanged = null;

// ---------------------------------------------------------------------------
// Text and context helpers
// ---------------------------------------------------------------------------

function receiptLineText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

// Normalize the one-shot status selection. Missing/blank keeps the legacy
// READY,LINE_FAILED behavior. Otherwise case and whitespace are ignored,
// duplicates are removed, unsupported values are dropped, and an explicit
// value with no supported status fails closed instead of broadening the query.
function normalizeReceiptLineStatuses(value) {
  var raw = value === null || value === undefined ? '' : String(value).trim();
  var normalized = [];

  if (raw === '') {
    return {
      valid: true,
      statuses: RECEIPT_LINE_DEFAULT_STATUSES.slice()
    };
  }

  raw.split(',').forEach(function (entry) {
    var candidate = receiptLineText(entry).toUpperCase();

    if (RECEIPT_LINE_DEFAULT_STATUSES.indexOf(candidate) >= 0 &&
      normalized.indexOf(candidate) < 0) {
      normalized.push(candidate);
    }
  });

  if (normalized.length === 0) {
    return {
      valid: false,
      statuses: [],
      error: 'Receipt selection could not determine which receipt statuses ' +
        'to show. Only READY and LINE_FAILED receipts are supported. ' +
        'Return to the previous page and open it again.'
    };
  }

  return {
    valid: true,
    statuses: normalized
  };
}

function receiptLineSelectionHasStatus(status) {
  return receiptLineSelectionStatuses.indexOf(status) >= 0;
}

function getReceiptLineEmptyMessage() {
  var hasReady = receiptLineSelectionHasStatus('READY');
  var hasFailed = receiptLineSelectionHasStatus('LINE_FAILED');

  if (hasReady && !hasFailed) {
    return 'No ready receipts are available for this report.';
  }
  if (hasFailed && !hasReady) {
    return 'No failed receipts are available for this report.';
  }

  return 'No ready or failed receipts are available for this report.';
}

// Standard project SQL quoting helper. The shared loader reads its user and
// status inputs from Storage, so this is retained only for page-local callers.
function escapeSqlText(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/'/g, "''");
}

// Native SPA/MPA hook: Page.getCurrentPage() can return the loaded page name,
// a hash route (#ReceiptLineSelection), or index.html#receiptlineselection.
// Normalize all three, with optional queries, to the same canonical name.
function getReceiptLineCurrentPageName() {
  if (typeof Page === 'undefined' || !Page ||
      typeof Page.getCurrentPage !== 'function') {
    return '';
  }

  var currentPage = receiptLineText(Page.getCurrentPage());
  if (currentPage === '') {
    return '';
  }

  // A route after '#' is the page in the SPA popup. Otherwise the page name is
  // the path before any query string. Queries are optional in both forms.
  var hashIndex = currentPage.indexOf('#');
  var pathPart = hashIndex >= 0
    ? currentPage.slice(0, hashIndex)
    : currentPage;
  var hashPart = hashIndex >= 0 ? currentPage.slice(hashIndex + 1) : '';
  var route = receiptLineText(
    (hashPart !== '' ? hashPart : pathPart).split('?')[0]
  ).toLowerCase();

  if (route === RECEIPT_LINE_PAGE_NAME || route === 'receiptlineselection') {
    return RECEIPT_LINE_PAGE_NAME;
  }

  return route;
}

function isReceiptLineSelectionPageCurrent() {
  return getReceiptLineCurrentPageName() === RECEIPT_LINE_PAGE_NAME;
}

function readReceiptLineSelectionContext() {
  var mode = receiptLineText(Storage.get('ReceiptLineSelectionMode'));
  var user = receiptLineText(Storage.get('LoggedInUsername'));
  var reportNumber = receiptLineText(Storage.get('ReportNumber'));
  // The status selection is one-shot: read and remove it only on the normal
  // picker path, after the inline handoff branch has already returned. Inline
  // mode must never consume or apply this normal key.
  var rawStatuses = Storage.get(RECEIPT_LINE_STATUSES_STORAGE_KEY);
  Storage.remove(RECEIPT_LINE_STATUSES_STORAGE_KEY);
  var normalizedStatuses = normalizeReceiptLineStatuses(rawStatuses);

  if (mode !== 'CASH' && mode !== 'CREDIT') {
    return {
      valid: false,
      error: 'Receipt selection could not determine whether to show cash or ' +
        'credit receipts. Return to the previous page and open it again.'
    };
  }

  if (user === '') {
    return {
      valid: false,
      error: 'Receipt selection could not determine the signed-in user. ' +
        'Please sign in again and retry.'
    };
  }

  if (!normalizedStatuses.valid) {
    return {
      valid: false,
      error: normalizedStatuses.error
    };
  }

  return {
    valid: true,
    mode: mode,
    user: user,
    reportNumber: reportNumber,
    statuses: normalizedStatuses.statuses
  };
}

// ---------------------------------------------------------------------------
// Selection state
// ---------------------------------------------------------------------------

function getReceiptLineTable() {
  var $table = $('#tableOutput');

  if (!$table.length || !$.fn || !$.fn.DataTable ||
      !$.fn.DataTable.isDataTable($table[0])) {
    return null;
  }

  return $table.DataTable();
}

// Keeps the existing StepInfo label directly above the receipt table. The label
// text remains owned by the page parameter; this only moves its container.
function placeReceiptLineStepInfo() {
  var $label = $('#StepInfo');
  if (!$label.length) { $label = $('label[for="StepInfo"]'); }
  var $table = $('#tableOutput');
  var $labelContainer;
  var $tableContainer;

  if (!$label.length || !$table.length) {
    return;
  }

  $labelContainer = $('#StepInfo_container');
  if (!$labelContainer.length) {
    $labelContainer = $label.closest('.field-container').first();
  }
  if (!$labelContainer.length) {
    $labelContainer = $label;
  }

  $tableContainer = $table
    .closest('.field-container.table-field-container')
    .first();
  if (!$tableContainer.length) {
    $tableContainer = $('#tableOutput_wrapper');
  }
  if (!$tableContainer.length) {
    $tableContainer = $table;
  }

  // Never move a container that also contains the table.
  if (
    $labelContainer.get(0) === $table.get(0) ||
    $labelContainer.get(0) === $tableContainer.get(0) ||
    $.contains($labelContainer.get(0), $table.get(0))
  ) {
    return;
  }

  // Moving an existing node keeps this idempotent across repeated calls.
  if ($tableContainer.prev().get(0) !== $labelContainer.get(0)) {
    $tableContainer.before($labelContainer);
  }
}

// AuraPlayer's Fields.set only updates an element whose id is StepInfo. The
// generated receipt-line label can omit that id, leaving the loading text in
// place. Keep Fields.set for the native/ID case and, for that generated label,
// update its existing nobr/text node in place.
function setReceiptLineStepInfo(message, readyOnly) {
  var text = message === null || message === undefined ? '' : String(message);
  var hasDocument = typeof document !== 'undefined' && document &&
    typeof document.getElementById === 'function';
  var canUseFields = typeof Fields !== 'undefined' && Fields &&
    typeof Fields.set === 'function';
  var stepInfoContainer = hasDocument
    ? document.getElementById('StepInfo_container')
    : null;

  // The ready-only check is additive: every call replaces the class, so loading,
  // error and empty messages fall back to the warning icon. Older VM fixtures
  // have no classList, so leave their text-only behavior untouched.
  if (stepInfoContainer && stepInfoContainer.classList &&
      typeof stepInfoContainer.classList.toggle === 'function') {
    stepInfoContainer.classList.toggle(
      'receipt-line-step-info-ready',
      readyOnly === true
    );
  }

  // Preserve the existing native write when the ID exists or there is no DOM
  // fallback to inspect.
  if (!hasDocument || document.getElementById('StepInfo')) {
    if (canUseFields) {
      Fields.set('StepInfo', text);
    }
    return;
  }

  var container = document.getElementById('StepInfo_container');
  var label = container && typeof container.querySelector === 'function'
    ? container.querySelector('label[for="StepInfo"]')
    : null;

  if (!label && typeof document.querySelector === 'function') {
    label = document.querySelector('label[for="StepInfo"]');
  }

  if (!label) {
    if (canUseFields) {
      Fields.set('StepInfo', text);
    }
    return;
  }

  var target = typeof label.querySelector === 'function'
    ? label.querySelector('nobr')
    : null;
  (target || label).textContent = text;
}

function clearReceiptLineSelection() {
  Storage.remove('ReceiptLineSelectionReceiptId');
  Storage.remove('ReceiptLineSelectionSelectedMode');

  var table = getReceiptLineTable();
  if (table) {
    refreshReceiptLineVisuals(table);
  }
}

function clearReceiptLineOutputIndexes() {
  if (typeof Storage === 'undefined' || !Storage ||
      typeof Storage.deleteByPrefix !== 'function') {
    return;
  }

  // Native deleteByPrefix uses an anchored regular expression. The trailing
  // underscore restricts each deletion to the indexed alias list and keeps
  // singular/shared values with the same base name intact.
  RECEIPT_LINE_OUTPUT_INDEX_FIELDS.forEach(function (name) {
    Storage.deleteByPrefix(name + '_');
  });
}

function clearReceiptLineRows() {
  // Clear the indexed native output aliases before Table.clear can return.
  // Table.clear only removes DataTables markup; it leaves the indexed
  // sessionStorage rows that the native table rebuilds from.
  clearReceiptLineOutputIndexes();

  // Native Table.clear is the project standard: it destroys the bound
  // DataTable and removes its markup, including when no DataTable was created.
  if (typeof Table !== 'undefined' && Table &&
      typeof Table.clear === 'function') {
    Table.clear();
    return;
  }

  var table = getReceiptLineTable();
  if (table && typeof table.clear === 'function') {
    table.clear();
    if (typeof table.draw === 'function') {
      table.draw(false);
    }
  }

  var $body = $('#tableOutput tbody');
  if ($body.length) {
    $body.empty();
  }
}

function getReceiptLineTableBody() {
  if (typeof document !== 'undefined' && document.getElementById) {
    return document.getElementById('tableOutputBody');
  }

  return null;
}

// AuraPlayer skips DataTables initialization when the service returns no rows.
// At the success callback the body is already populated, so an empty body with
// no DataTable is the empty result, not a still-initializing table.
function hasRenderedReceiptLineRows() {
  var body = getReceiptLineTableBody();

  if (!body || !body.rows || typeof body.rows.length !== 'number') {
    return true;
  }

  return body.rows.length > 0;
}

function getReceiptLineColumnIndex(headerId) {
  if (typeof document !== 'undefined' && document.getElementById) {
    var header = document.getElementById(headerId);
    if (header) {
      var index = $(header).index();
      if (typeof index === 'number' && index >= 0) {
        return index;
      }
    }
  }

  return -1;
}

function getReceiptLineActionsColumnIndex() {
  return getReceiptLineColumnIndex(
    '*th*Actions'
  );
}

function getReceiptLineStatusColumnIndex() {
  return getReceiptLineColumnIndex(
    '*th*RECEIPTBATCH_STATUS'
  );
}

function isPreviewActionColumn(col) {
  var parsedColumn = parseInt(col, 10);

  if (isNaN(parsedColumn)) {
    return false;
  }

  return parsedColumn === getReceiptLineActionsColumnIndex();
}

function resolveReceiptLineDataIndex(row, table) {
  var parsedRow = parseInt(row, 10);

  if (isNaN(parsedRow) || !table || typeof table.row !== 'function') {
    return null;
  }

  // AuraPlayer passes the original Storage row index even after sorting. Ask the
  // native DataTables row API for the same original index so the mapping never
  // depends on DOM order or the current page of results. An absent row (for
  // example the "No data" row after an empty/error response) must fail closed
  // instead of selecting a stale RECEIPTBATCH_RECEIPT_ID_* value.
  try {
    var rowApi = table.row(parsedRow);
    if (!rowApi || typeof rowApi.index !== 'function') {
      return null;
    }

    var dataIndex = rowApi.index();
    if (typeof dataIndex !== 'number' || isNaN(dataIndex)) {
      return null;
    }

    return dataIndex;
  } catch (ignored) {
    return null;
  }
}

function isReceiptLineRowSelectable(dataIndex, mode) {
  var status = receiptLineText(
    Storage.get('RECEIPTBATCH_STATUS_' + dataIndex)
  ).toUpperCase();

  if (status !== 'READY' && status !== 'LINE_FAILED') {
    return false;
  }
  if (!receiptLineSelectionHasStatus(status)) {
    return false;
  }

  var credit = receiptLineText(
    Storage.get('RECEIPTBATCH_CREDIT_' + dataIndex)
  );

  if (mode === 'CASH') {
    return credit === '';
  }

  if (mode === 'CREDIT') {
    return credit !== '';
  }

  return false;
}

function refreshReceiptLineVisuals(table) {
  table = table || getReceiptLineTable();

  if (!table || typeof table.rows !== 'function') {
    return;
  }

  placeReceiptLineStepInfo();

  var selectedReceiptId = receiptLineText(
    Storage.get('ReceiptLineSelectionReceiptId')
  );
  var statusColumn = getReceiptLineStatusColumnIndex();

  table.rows().every(function () {
    var dataIndex = typeof this.index === 'function' ? this.index() : null;

    if (dataIndex === null || dataIndex === undefined) {
      return;
    }

    var $row = $(this.node());
    var eligible = isReceiptLineRowSelectable(
      dataIndex,
      receiptLineSelectionMode
    );
    var receiptId = receiptLineText(
      Storage.get('RECEIPTBATCH_RECEIPT_ID_' + dataIndex)
    );
    var status = receiptLineText(
      Storage.get('RECEIPTBATCH_STATUS_' + dataIndex)
    ).toUpperCase();
    var inSelectedStatus = receiptLineSelectionHasStatus(status);
    var isReady = inSelectedStatus && status === 'READY';
    var isFailed = inSelectedStatus &&
      (status === 'LINE_FAILED' || status === 'FAILED');
    var isSelected = selectedReceiptId !== '' && receiptId === selectedReceiptId;

    // Hide ineligible rows in place. Keeping the native DataTables row and its
    // original index intact preserves Storage aliases and selection mapping.
    $row.toggle(eligible);

    // READY and FAILED are mutually exclusive row states. Toggle both classes
    // on every redraw so sorting, filtering or a changed status cannot leave a
    // stale fill behind. Selection remains an inset outline.
    $row.toggleClass('receipt-line-ready', isReady);
    $row.toggleClass('receipt-line-failed', isFailed);
    $row.toggleClass('receipt-line-selected', isSelected);

    if (statusColumn >= 0) {
      var $statusCell = $row.find('td').eq(statusColumn);
      $statusCell.toggleClass('receipt-line-status-failed', isFailed);
      $statusCell.attr('title', isFailed ? 'Line Failed' : status);
    }
  });
  updateReceiptLineStepInfo(table);
}

function countReceiptLineEligibleRows(table, mode) {
  var count = 0;

  if (!table || typeof table.rows !== 'function') {
    return count;
  }

  table.rows().every(function () {
    var dataIndex = typeof this.index === 'function' ? this.index() : null;

    if (dataIndex !== null && dataIndex !== undefined &&
        isReceiptLineRowSelectable(dataIndex, mode)) {
      count += 1;
    }
  });

  return count;
}

function updateReceiptLineStepInfo(table) {
  var ready = 0;
  var failed = 0;
  table.rows({ search: 'applied' }).every(function () {
    var rowIndex = this.index();
    if (!isReceiptLineRowSelectable(rowIndex, receiptLineSelectionMode)) { return; }
    var status = receiptLineText(
      Storage.get('RECEIPTBATCH_STATUS_' + rowIndex)
    ).toUpperCase();
    if (status === 'READY') { ready += 1; }
    if (status === 'LINE_FAILED') { failed += 1; }
  });

  var message = getReceiptLineEmptyMessage();
  if (ready && failed) {
    message = 'Ready receipts can be added to this report. Failed receipts need review. Click a receipt row to open a receipt.';
  } else if (failed) {
    message = 'These receipts failed during line creation. Click a receipt row to review the receipt details and try again.';
  } else if (ready) {
    message = 'These receipts are ready. Click a receipt row to add a receipt to this report.';
  }
  setReceiptLineStepInfo(message, ready > 0 && failed === 0);
}

function showReceiptLineEmptyState(context) {
  clearReceiptLineSelection();
  setReceiptLineStepInfo(getReceiptLineEmptyMessage());
}

function showReceiptLineResultState(table, context) {
  var rowCount = countReceiptLineEligibleRows(table, context.mode);

  if (rowCount === 0) {
    showReceiptLineEmptyState(context);
  }
}

// ---------------------------------------------------------------------------
// Table lifecycle and service loading
// ---------------------------------------------------------------------------

function clearReceiptLineWaitTimer() {
  if (receiptLineSelectionWaitTimer !== null) {
    clearTimeout(receiptLineSelectionWaitTimer);
    receiptLineSelectionWaitTimer = null;
  }
}

function isReceiptLineSelectionCurrent(generation) {
  return receiptLineSelectionActive === true &&
    generation === receiptLineSelectionGeneration &&
    isReceiptLineSelectionPageCurrent();
}

function waitForReceiptLineTable(callback, generation) {
  var attempts = 0;

  clearReceiptLineWaitTimer();

  function pollForTable() {
    if (!isReceiptLineSelectionCurrent(generation)) {
      return;
    }

    var table = getReceiptLineTable();

    if (table) {
      callback(table, false);
      return;
    }

    if (!hasRenderedReceiptLineRows()) {
      callback(null, true);
      return;
    }

    attempts += 1;

    if (attempts >= RECEIPT_LINE_TABLE_WAIT_ATTEMPTS) {
      callback(null, false);
      return;
    }

    receiptLineSelectionWaitTimer = setTimeout(
      pollForTable,
      RECEIPT_LINE_TABLE_WAIT_INTERVAL
    );
  }

  pollForTable();
}

function bindReceiptLineTable(table) {
  var $table = $('#tableOutput');

  if (!$table.length) {
    return;
  }

  placeReceiptLineStepInfo();

  $table
    .off('draw.dt.receiptLineSelection')
    .on('draw.dt.receiptLineSelection', function () {
      if (isReceiptLineSelectionCurrent(receiptLineSelectionGeneration)) {
        refreshReceiptLineVisuals(table);
      }
    });
}

function bindReceiptLinePageChanged() {
  if (typeof Events === 'undefined' || !Events) {
    return;
  }

  // Repeated entry keeps the original chained handler and this wrapper.
  if (receiptLineSelectionPageChangedWrapper !== null &&
      Events.pageChanged === receiptLineSelectionPageChangedWrapper) {
    return;
  }

  receiptLineSelectionPreviousPageChanged =
    typeof Events.pageChanged === 'function' ? Events.pageChanged : null;

  receiptLineSelectionPageChangedWrapper = function () {
    var previous = receiptLineSelectionPreviousPageChanged;
    var result = previous ? previous.apply(this, arguments) : undefined;

    if (!isReceiptLineSelectionPageCurrent()) {
      cleanupReceiptLineSelection();
    }

    return result;
  };

  Events.pageChanged = receiptLineSelectionPageChangedWrapper;
}

function bindReceiptLineLifecycle() {
  $(window)
    .off('pagehide.receiptLineSelection')
    .on('pagehide.receiptLineSelection', function (event) {
      var originalEvent = event && (event.originalEvent || event);
      if (originalEvent && originalEvent.persisted) {
        return;
      }
      cleanupReceiptLineSelection();
    });

  bindReceiptLinePageChanged();
}

function cleanupReceiptLineSelection() {
  receiptLineSelectionActive = false;
  receiptLineSelectionGeneration += 1;
  Create_Line.receiptLineSelectionCreateInFlight = false;

  cleanupReceiptLineInlineMode();
  $('body')
    .removeClass('receipt-line-selection-no-download')
    .removeClass('receipt-line-selection-inline');
  clearReceiptLineWaitTimer();
  $('#tableOutput').off('.receiptLineSelection');
  $(window).off('.receiptLineSelection');

  // Never overwrite a handler another page installed after this wrapper.
  if (receiptLineSelectionPageChangedWrapper !== null &&
      typeof Events !== 'undefined' && Events &&
      Events.pageChanged === receiptLineSelectionPageChangedWrapper) {
    Events.pageChanged = receiptLineSelectionPreviousPageChanged;
  }

  receiptLineSelectionPageChangedWrapper = null;
  receiptLineSelectionPreviousPageChanged = null;
}

function loadReceiptLineSelectionReceipts(context) {
  var generation = receiptLineSelectionGeneration;
  var selectedStatuses = context && Array.isArray(context.statuses) &&
    context.statuses.length > 0
    ? context.statuses
    : receiptLineSelectionStatuses;

  // Keep this load's normalized selection in page-local state. The same
  // membership drives the loader, row rendering, eligibility and row clicks.
  receiptLineSelectionStatuses = selectedStatuses.slice();
  if (receiptLineSelectionStatuses.length === 0) {
    receiptLineSelectionStatuses = RECEIPT_LINE_DEFAULT_STATUSES.slice();
  }
  statuses = receiptLineSelectionStatuses.join(',');

  setReceiptLineStepInfo('Loading receipts...');

  clearReceiptLineRows();

  // The shared helper writes EBS_USER from LoggedInUsername and
  // ReceiptBatch_statuses, then loads the signed-in user's selected receipts
  // from the unassigned queue. The shared query does not filter on credit
  // transaction or report number; CASH/CREDIT eligibility is applied to each
  // row when it is selected.
  loadReceiptBatchesByUserAndStatuses(
    statuses,
    function () {
      if (!isReceiptLineSelectionCurrent(generation)) {
        return;
      }

      waitForReceiptLineTable(function (table, isEmptyResult) {
        if (!isReceiptLineSelectionCurrent(generation)) {
          return;
        }

        if (isEmptyResult === true) {
          clearReceiptLineRows();
          showReceiptLineEmptyState(context);
          return;
        }

        if (!table) {
          clearReceiptLineRows();
          setReceiptLineStepInfo('The receipt table could not be loaded. Close this window and try again.');
          return;
        }

        bindReceiptLineTable(table);
        refreshReceiptLineVisuals(table);
        showReceiptLineResultState(table, context);
      }, generation);
    },
    function () {
      if (!isReceiptLineSelectionCurrent(generation)) {
        return;
      }

      clearReceiptLineSelection();
      clearReceiptLineRows();
      setReceiptLineStepInfo('Receipts could not be loaded. Close this window and try again.');
    }
  );
}

// ---------------------------------------------------------------------------
// AuraPlayer page actions
// ---------------------------------------------------------------------------

function onLoad() {
  receiptLineSelectionActive = true;
  receiptLineSelectionGeneration += 1;
  receiptLineSelectionMode = '';
  receiptLineSelectionStatuses = RECEIPT_LINE_DEFAULT_STATUSES.slice();
  statuses = receiptLineSelectionStatuses.join(',');
  Create_Line.receiptLineSelectionCreateInFlight = false;
  Table.clear();
  $('body').addClass('receipt-line-selection-no-download');
  clearReceiptLineWaitTimer();
  bindReceiptLineLifecycle();
  placeReceiptLineStepInfo();

  configureReceiptViewer({
    readOnly: true,
    allowApprove: false,
    allowEdit: false,
    showData: true
  });

  // The inline handoff is consumed before the normal chooser logic. If the
  // host rejects a stale handoff, render the inline error instead of falling
  // back to the full picker inside the compact panel.
  var inlineHandoff = readReceiptLineInlineHandoff();

  if (inlineHandoff) {
    if (inlineHandoff.valid === false) {
      renderReceiptLineInlineError(inlineHandoff.error);
      return;
    }

    renderReceiptLineInlineMode(inlineHandoff);
    return;
  }

  clearReceiptLineSelection();

  var context = readReceiptLineSelectionContext();

  if (!context.valid) {
    clearReceiptLineRows();
    setReceiptLineStepInfo(context.error);
    return;
  }

  receiptLineSelectionMode = context.mode;
  receiptLineSelectionStatuses = context.statuses.slice();
  statuses = receiptLineSelectionStatuses.join(',');
  loadReceiptLineSelectionReceipts(context);
}

function onTableClick(row, col) {
  if (!isReceiptLineSelectionCurrent(receiptLineSelectionGeneration) ||
      (receiptLineSelectionMode !== 'CASH' &&
       receiptLineSelectionMode !== 'CREDIT')) {
    return;
  }

  // The Preview action must not start a line. AuraPlayer normally intercepts
  // the action cell, but guard on the column as well in both modes.
  if (isPreviewActionColumn(col)) {
    return;
  }

  // The embedded failed-only iframe has no indexed picker Storage. Route the
  // native row index through Create_Line's in-memory validation instead.
  if (isReceiptLineInlineModeActive()) {
    Create_Line(row);
    return;
  }

  var table = getReceiptLineTable();
  var dataIndex = resolveReceiptLineDataIndex(row, table);

  if (dataIndex === null) {
    return;
  }

  // Fail closed if the indexed row does not match the active mode. This keeps
  // a stale CASH row from being opened in CREDIT mode (and vice versa) when
  // framework storage is older or inconsistent.
  if (!isReceiptLineRowSelectable(dataIndex, receiptLineSelectionMode)) {
    clearReceiptLineSelection();
    return;
  }

  var receiptId = receiptLineText(
    Storage.get('RECEIPTBATCH_RECEIPT_ID_' + dataIndex)
  );

  if (receiptId === '') {
    clearReceiptLineSelection();
    return;
  }

  // Only these dedicated keys are written. Existing index/EBS context and the
  // common receipt_ID preview key are left untouched.
  Storage.set('ReceiptLineSelectionReceiptId', receiptId);
  Storage.set('ReceiptLineSelectionSelectedMode', receiptLineSelectionMode);

  // Row click now opens the unsaved line, matching the retired Create Line
  // action. Create_Line owns the in-flight guard and all service calls.
  Create_Line(dataIndex);
}

function onBack() {
  // Close any shared preview overlay before navigating away.
  if (typeof removeAttachmentViewer === 'function') {
    removeAttachmentViewer();
  }

  var returnPage = receiptLineText(
    Storage.get('ReceiptLineSelectionReturnPage')
  ) || 'Cash_Lines.html';

  cleanupReceiptLineSelection();
  clearReceiptLineSelection();

  Storage.remove('ReceiptLineSelectionMode');
  Storage.remove('ReceiptLineSelectionReturnPage');

  Page.navigate(returnPage);
}


function Create_Line(rowIndex) {
  var button = arguments.length > 1 ? arguments[1] : null;

  // Native action cells call Create_Line with their original table row index.
  // In the inline failed-only iframe, resolve that index against the validated
  // in-memory report rows and never fall back to the normal picker aliases.
  if (typeof getReceiptLineInlineState === 'function') {
    var inline = getReceiptLineInlineState();
    if (inline && inline.active === true) {
      var inlineRow = getReceiptLineInlineRowByIndex(rowIndex);
      if (!inlineRow || !isReceiptLineInlineContextCurrent(inlineRow)) {
        showReceiptLineInlineMessage(
          'This failed receipt is no longer current. Refresh Cash Lines and try again.'
        );
        return;
      }
      createReceiptLineFromInline(inlineRow, button);
      return;
    }
  }

  // A row click now starts this flow, so one in-flight open blocks the rapid
  // repeated clicks that previously only highlighted the row. The inline path
  // above already has its own per-receipt guard.
  if (Create_Line.receiptLineSelectionCreateInFlight === true) {
    return;
  }
  Create_Line.receiptLineSelectionCreateInFlight = true;
  installReceiptLinePopulateGuard();

  function releaseNormalCreate() {
    restoreReceiptLinePopulateGuard();
    Create_Line.receiptLineSelectionCreateInFlight = false;
  }

  function normalCreateFailure(message) {
    var reportFailure = displayReportServiceError(message);
    return function () {
      releaseNormalCreate();
      reportFailure.apply(this, arguments);
    };
  }

  Storage.set('ApproveScannedReceipt_ID', Storage.getFromIndex('RECEIPTBATCH_RECEIPT_ID', rowIndex));
  prepareReceiptLineFields(rowIndex, function (values, receipt) {
    Storage.set('index', Storage.count('CashLines_ExpenseType_0'));
    Storage.set('isCreditLine', false);
    Storage.remove('LineDetailsUpdate');
    Services.call(resolveServiceName('iExpense_cash_openLineDetails'), function () {
      Storage.set('ExpTypeInput', receipt.expenseType);
      Services.call(resolveServiceName('iExpense_lineDetailsGet'), function () {
        storeReceiptLineFields(values, receipt);
        Storage.set('ApproveScannedReceipt', true);
        releaseNormalCreate();
        Page.navigate('LineDetails.html');
      }, normalCreateFailure('Failed to load expense line details'));
    }, normalCreateFailure('Failed to open detailed expense line'));
  }, releaseNormalCreate);
}

/********************************************************************************************
// Frontend helpers for ReceiptLineSelection.html.
********************************************************************************************/
var RECEIPT_LINE_FIELDS = ['expenseType', 'DetailReceiptAmount', 'StartDate', 'DetailMerchantName',
  'LocationName', 'ReceiptCurrencyChoice', 'ExchRate', 'DetailReimbursAmt', 'Justification',
  'DetailReceiptMissing', 'DetailDailyRate', 'NumberOfDays', 'AirTravelType', 'AirTicketClass',
  'AirFromLocation', 'AirToLocation', 'CompanyAttendees', 'AccEndDate', 'MealNumberAttendees',
  'AttendeeNames', 'GuestNames'];

function receiptLineDate(value, shortYear) {
  if (!value) { return ''; }
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var text = String(value).trim();
  var iso = /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[T ].*)?$/.exec(text);
  var display = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/.exec(text);
  var year = iso ? Number(iso[1]) : display ? Number(display[3]) : NaN;
  var month = iso ? Number(iso[2]) - 1 : display ? months.map(function (m) { return m.toLowerCase(); }).indexOf(display[2].toLowerCase()) : -1;
  var day = iso ? Number(iso[3]) : display ? Number(display[1]) : NaN;
  if (year < 100) { year += 2000; }
  var date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    throw new Error('Invalid receipt date: ' + text);
  }
  return ('0' + day).slice(-2) + '-' + months[month] + '-' + (shortYear ? String(year).slice(-2) : year);
}

function buildReceiptLineFields(receipt, metadata) {
  var entry = metadata.expenseTypes[receipt.expenseType];
  
  if (!entry) {
      throw new Error('Unsupported expense type: ' + receipt.expenseType); 
  }
  var document = receipt.expenseData ? JSON.parse(receipt.expenseData) : { lines: [{}] };
  
  if (!document.lines || document.lines.length !== 1) {
    throw new Error('The receipt must contain one expense line.');
  }
  var line = document.lines[0];
  
  var values = {
    expenseType: receipt.expenseType,
    DetailReceiptAmount: receipt.amount,
    StartDate: receiptLineDate(receipt.date, false),
    DetailMerchantName: receipt.merchant,
    LocationName: receipt.location
  };
  // Only scalar fields that exist on LineDetails are copied from the template.
  Object.keys(entry.fields).forEach(function (property) {
    var meta = entry.fields[property];
    if (RECEIPT_LINE_FIELDS.indexOf(meta.fieldId) < 0) { return; }
    var value = Object.prototype.hasOwnProperty.call(line, property) ? line[property] : meta.defaultValue;
    if (value !== null && typeof value === 'object') { return; }
    values[meta.fieldId] = meta.control === 'date' ? receiptLineDate(value, meta.fieldId === 'AccEndDate') : value;
  });
  // These are display summaries. Oracle attendee creation is a separate step.
  if (receipt.expenseType === 'Meals') {
    var employees = line.employees || [];
    var guests = line.guest || line.nonEmployees || [];
    values.AttendeeNames = employees.map(function (item) { return item.employeeName || ''; }).join(', ');
    values.GuestNames = guests.map(function (item) { return item.name || ''; }).join(', ');
  }
  return values;
}

// Object-taking preparation shared by the normal chooser and the inline failed
// cash line list. The caller supplies the receipt it read, so later selection or
// preview changes cannot replace the receipt while metadata is loading.
function prepareReceiptLineFieldsForReceipt(receipt, onReady, onError, onFailure) {
  function reportPreparationFailure(error, serviceFailure) {
    if (typeof onFailure === 'function') {
      onFailure(error, serviceFailure);
    }
    if (typeof onError === 'function') {
      onError(error);
      return;
    }
    if (serviceFailure === true &&
      typeof displayReportServiceError === 'function') {
      displayReportServiceError('Failed to load the expense field metadata')();
      return;
    }
    Popup.ok('Create Line', error && error.message ? error.message :
      'Failed to load the expense field metadata');
  }

  Storage.remove('EXPENSE_METADATA_JSON');
  Services.call('ReceiptBatch_CreateExpenseJson',
    function () {
        var values;
        try {
          values = buildReceiptLineFields(receipt, JSON.parse(Storage.get('EXPENSE_METADATA_JSON')));
        } catch (error) { reportPreparationFailure(error); return; }

        onReady(values, receipt);
    },
    function () {
        reportPreparationFailure(
          new Error('Failed to load the expense field metadata'),
          true
        );
    },
        {
            EXPENSE_TYPE: receipt.expenseType, APP_NAME: 'LiveExpense_AI'
        }
    );
}

function prepareReceiptLineFields(rowIndex, onReady, onFailure) {
  // Read the clicked row once. A preview or later selection cannot change it.
  var receipt = {
    id: Storage.getFromIndex('RECEIPTBATCH_RECEIPT_ID', rowIndex),
    expenseType: Storage.getFromIndex('RECEIPTBATCH_EXPENSE_TYPE', rowIndex),
    amount: Storage.getFromIndex('RECEIPTBATCH_TOTAL_AMOUNT', rowIndex),
    date: Storage.getFromIndex('RECEIPTBATCH_RECEIPT_DATE', rowIndex),
    merchant: Storage.getFromIndex('RECEIPTBATCH_MERCHANT', rowIndex),
    location: Storage.getFromIndex('RECEIPTBATCH_LOCATION', rowIndex),
    expenseData: Storage.getFromIndex('RECEIPTBATCH_EXPENSE_DATA_JSON', rowIndex)
  };

  prepareReceiptLineFieldsForReceipt(receipt, onReady, undefined, onFailure);
}

function storeReceiptLineFields(values, receipt) {
  // Missing receipt values must not erase the current Oracle line values.
  ['Justification', 'ExchRate', 'DetailReimbursAmt'].forEach(function (field) {
    if (values[field] === null || values[field] === undefined || values[field] === '') {
      values[field] = Storage.get(field);
    }
  });

  if (values.Justification == null || String(values.Justification).trim() === '') {
    values.Justification = Storage.get('Purpose');
  }

  RECEIPT_LINE_FIELDS.forEach(function (field) {
    Storage.set(field, '');
    Storage.set(field + 'Exist', false);
  });
  Object.keys(values).forEach(function (field) {
    Storage.set(field, values[field] === null || values[field] === undefined ? '' : values[field]);
    Storage.set(field + 'Exist', true);
  });
  Storage.set('ExpenseType', receipt.expenseType);
  Storage.set('ExpTypeInput', receipt.expenseType);
  Storage.set('origExpenseType', receipt.expenseType);
  Storage.set('Currency', values.ReceiptCurrencyChoice || '');
  Storage.set('receiptbatch_id', receipt.id);

  // Populate the name arrays before LineDetails reads them with Storage.getArray.
  Storage.deleteAllIndices('AttendiesEmpTableEmpName');
  Storage.deleteAllIndices('AttendiesGuestTableName');
  if (receipt.expenseType === 'Meals') {
    var line = JSON.parse(receipt.expenseData || '{"lines":[{}]}').lines[0];
    (line.employees || []).forEach(function (employee, index) {
      Storage.set('AttendiesEmpTableEmpName_' + index, employee.employeeName || '');
    });
    (line.guest || line.nonEmployees || []).forEach(function (guest, index) {
      Storage.set('AttendiesGuestTableName_' + index, guest.name || '');
    });
  }

  Storage.remove('LineDetailsUpdate');
}

// Own this action in the popup; do not inherit another page's Preview function.
// Inline failed rows pass their exact in-memory receipt object. Normal rows keep
// using the indexed aliases through setReceiptForPreview.
function Preview(rowIndex, receipt, afterPreview) {
  if (isEmbeddedEditorSaving()) {
    Popup.ok('Receipt Details', 'Please wait for the save to finish.');
    return;
  }

  if (receipt && typeof receipt === 'object') {
    if (!setReceiptForPreviewFromReceipt(receipt)) {
      Popup.ok('Preview', 'The selected receipt is not available.');
      return;
    }
  } else if (isReceiptLineInlineModeActive()) {
    // Native action cells pass only the original table row index. Resolve it
    // against the validated in-memory report rows, never ordinary picker
    // Storage. The object-taking path above is not routed here, so the inline
    // helper's Preview(null, receipt) call cannot recurse.
    var inlineRow = getReceiptLineInlineRowByIndex(rowIndex);
    if (!inlineRow || !isReceiptLineInlineContextCurrent(inlineRow)) {
      showReceiptLineInlineMessage(
        'This failed receipt is no longer current. Refresh Cash Lines and try again.'
      );
      return;
    }
    previewReceiptLineFromInline(inlineRow);
    return;
  } else {
    setReceiptForPreview(rowIndex);
  }

  Services.call(
    'js_ReceiptBatch_get_receipt_by_id',
    function () {
      var documentUrl = Storage.get(
        ATTACHMENT_CONFIG.storageKeys.receiptDocumentUrl
      );
      var fileType = Storage.get(
        ATTACHMENT_CONFIG.storageKeys.receiptFileType
      );

      if (!documentUrl) {
        documentUrl = Storage.get('DOCUMENT_URL');
      }

      if (!fileType) {
        fileType = Storage.get('FILE_TYPE');
      }

      if (!documentUrl) {
        Popup.ok('Preview', 'No document URL was returned');
        return;
      }

      showAttachmentPreview(documentUrl, fileType);

      if (typeof afterPreview === 'function') {
        afterPreview();
      }
    },
    function () {
      Popup.ok('Preview', 'Failed to load receipt preview');
    }
  );
}

// Copy only the preview scalars and the selected receipt identity from an
// in-memory report row. Normal indexed RECEIPTBATCH_* aliases and the common
// picker selection keys are intentionally left untouched.
function setReceiptForPreviewFromReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') {
    return false;
  }

  var receiptId = receiptLineText(receipt.RECEIPT_ID);
  if (receiptId === '') {
    return false;
  }

  Storage.set(ATTACHMENT_CONFIG.storageKeys.receiptId, receiptId);
  Storage.set(ATTACHMENT_CONFIG.storageKeys.receiptStatus, receiptLineText(receipt.STATUS));
  Storage.set(ATTACHMENT_CONFIG.storageKeys.previewReceiptId, receiptId);
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewExpenseType,
    receiptLineText(receipt.EXPENSE_TYPE)
  );
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewAmount,
    receiptLineText(receipt.TOTAL_AMOUNT)
  );
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewReceiptDate,
    receiptLineText(receipt.RECEIPT_DATE)
  );
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewMerchant,
    receiptLineText(receipt.MERCHANT)
  );
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewLocation,
    receiptLineText(receipt.LOCATION)
  );
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewDepartment,
    receiptLineText(receipt.DEPARTMENT)
  );

  return true;
}

// ---------------------------------------------------------------------------
// Inline failed-only mode
//
// The parent Cash Lines host passes already-filtered report rows through a
// single-use handoff. Inline mode populates the original native #tableOutput
// with those rows (using a temporary array tableSource), so the page's own
// columns and Preview/Create_Line action fragments stay in use. The ordinary
// chooser and its indexed Storage aliases are never populated by this mode.
// ---------------------------------------------------------------------------

// Map report response fields onto the native table column IDs. The native table
// reads baseName (the column ID) from tableSource, so the aliases, not the raw
// report names, are what populateRow() resolves.
function receiptLineInlineHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/[&<>"']/g, function (character) {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

function buildReceiptLineInlineDisplayRow(row) {
  // Keep these aliases local: AuraPlayer has dropped mid-file vars before, and
  // the native table reads baseName (the column ID) from tableSource.
  var RECEIPT_LINE_INLINE_COLUMN_ALIASES = [
    ['RECEIPTBATCH_RECEIPT_ID', 'RECEIPT_ID'],
    ['RECEIPTBATCH_STATUS', 'STATUS'],
    ['RECEIPTBATCH_EBS_USER_NAME', 'EBS_USER_NAME'],
    ['RECEIPTBATCH_FILE_NAME', 'FILE_NAME'],
    ['RECEIPTBATCH_FILE_TYPE', 'FILE_TYPE'],
    ['RECEIPTBATCH_EXPENSE_TYPE', 'EXPENSE_TYPE'],
    ['RECEIPTBATCH_TOTAL_AMOUNT', 'TOTAL_AMOUNT'],
    ['RECEIPTBATCH_RECEIPT_DATE', 'RECEIPT_DATE'],
    ['RECEIPTBATCH_RECEIPT_DATE_ISO', 'RECEIPT_DATE_ISO'],
    ['RECEIPTBATCH_MERCHANT', 'MERCHANT'],
    ['RECEIPTBATCH_LOCATION', 'LOCATION'],
    ['RECEIPTBATCH_REPORT_ID', 'REPORT_ID'],
    ['RECEIPTBATCH_REPORT_NAME', 'REPORT_NAME'],
    ['RECEIPTBATCH_REPORT_CREATE_DATE', 'REPORT_CREATE_DATE'],
    ['RECEIPTBATCH_DEPARTMENT', 'DEPARTMENT'],
    ['RECEIPTBATCH_TEMPLATE_NAME', 'TEMPLATE_NAME'],
    ['RECEIPTBATCH_PAYMENT_TYPE', 'PAYMENT_TYPE'],
    ['RECEIPTBATCH_LINE_NUM', 'LINE_NUM'],
    ['RECEIPTBATCH_CREDIT', 'CREDIT_TRANSACTION'],
    ['RECEIPTBATCH_EXPENSE_DATA_JSON', 'EXPENSE_DATA_JSON']
  ];
  var display = {};
  RECEIPT_LINE_INLINE_COLUMN_ALIASES.forEach(function (alias) {
    var value = row ? row[alias[1]] : '';
    if (alias[0] === 'RECEIPTBATCH_EXPENSE_DATA_JSON') {
      value = receiptLineInlineExpenseData(value);
    }
    display[alias[0]] = receiptLineInlineHtml(value);
  });
  return display;
}

function getReceiptLineInlineRowByIndex(rowIndex) {
  var inline = getReceiptLineInlineState();
  var parsedIndex = parseInt(rowIndex, 10);

  if (!inline || inline.active !== true || !Array.isArray(inline.rows) ||
    isNaN(parsedIndex) || String(parsedIndex) !== String(rowIndex).trim() ||
    parsedIndex < 0 || parsedIndex >= inline.rows.length) {
    return null;
  }

  var row = inline.rows[parsedIndex];
  return isReceiptLineInlineRowEligible(
    row,
    inline.reportNumber,
    inline.user
  ) ? row : null;
}

function isReceiptLineInlineModeActive() {
  var inline = getReceiptLineInlineState();
  return !!(inline && inline.active === true);
}

// Populate the native original table from the filtered in-memory rows. The
// global tableSource is swapped only for the synchronous Table.populate() call
// and restored in finally so the normal picker's Storage source is untouched.
function populateReceiptLineInlineTable(rows) {
  var body = typeof document !== 'undefined' && document.getElementById
    ? document.getElementById('tableOutputBody')
    : null;
  var source = {
    type: 'array',
    data: rows.map(buildReceiptLineInlineDisplayRow),
    get: function (indexedName, baseName, i) {
      return this.data[i][baseName] || '';
    }
  };
  var originalTableSource = typeof tableSource === 'undefined'
    ? undefined
    : tableSource;

  if (!body || typeof Table === 'undefined' || !Table ||
    typeof Table.populate !== 'function') {
    return false;
  }

  try {
    tableSource = source;
    Table.populate(body, false);
  } finally {
    tableSource = originalTableSource;
  }
  return true;
}

function getReceiptLineInlineState() {
  if (typeof window === 'undefined' || !window) {
    return null;
  }
  if (!window.__receiptLineSelectionInlineState) {
    window.__receiptLineSelectionInlineState = {
      active: false,
      token: '',
      reportNumber: '',
      user: '',
      rows: [],
      creating: {},
      frameOriginalHeight: undefined,
      frameExpanded: false,
      frameFitHeight: null,
      frameFitInstalled: false,
      frameResizeObserver: null,
      frameMountObserver: null,
      viewerResizeInstalled: false,
      originalRemoveAttachmentViewer: null,
      viewerRemoveWrapper: null,
      originalPopulateTableOrList: null,
      populateTableOrListWrapper: null
    };
  }
  return window.__receiptLineSelectionInlineState;
}

function isReceiptLineInlineRowEligible(row, reportNumber, user) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return false;
  }
  if (String(row.REPORT_NUMBER === null || row.REPORT_NUMBER === undefined
    ? '' : row.REPORT_NUMBER).trim() !== String(reportNumber).trim()) {
    return false;
  }
  if (String(row.EBS_USER_NAME === null || row.EBS_USER_NAME === undefined
    ? '' : row.EBS_USER_NAME).trim().toLowerCase() !==
    String(user).trim().toLowerCase()) {
    return false;
  }
  if (row.STATUS !== 'LINE_FAILED') {
    return false;
  }
  // Only an exact null credit transaction is a failed cash line. Undefined,
  // empty, whitespace and card values are all ineligible.
  if (row.CREDIT_TRANSACTION !== null) {
    return false;
  }
  return receiptLineText(row.RECEIPT_ID) !== '';
}

function filterReceiptLineInlineRows(rows, reportNumber, user) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.filter(function (row) {
    return isReceiptLineInlineRowEligible(row, reportNumber, user);
  });
}

// The inline panel is a failed-only launch. A handoff without statuses predates
// the explicit field, so it keeps the failed-only default. Anything else must
// normalize to exactly LINE_FAILED; READY, mixed or unknown configuration is
// rejected rather than widening this compact list.
function normalizeReceiptLineInlineHandoffStatuses(value) {
  var raw = value === null || value === undefined ? '' : String(value).trim();
  var tokens;

  if (raw === '') {
    return { valid: true, statuses: ['LINE_FAILED'] };
  }

  tokens = raw.split(',').map(function (entry) {
    return receiptLineText(entry).toUpperCase();
  }).filter(function (entry) {
    return entry !== '';
  });
  if (tokens.length === 0 || tokens.some(function (entry) {
    return entry !== 'LINE_FAILED';
  })) {
    return {
      valid: false,
      error: 'The failed cash line list requested unsupported receipt ' +
        'statuses. Refresh Cash Lines and try again.'
    };
  }

  return { valid: true, statuses: ['LINE_FAILED'] };
}

function readReceiptLineInlineHandoff() {
  if (typeof Page === 'undefined' || !Page ||
    typeof Page.isIframe !== 'function' || Page.isIframe() !== true) {
    return null;
  }
  if (typeof window === 'undefined' || !window || !window.parent ||
    window.parent === window) {
    return null;
  }

  var parentWindow;
  try {
    parentWindow = window.parent;
    if (!parentWindow.document || !parentWindow.location) {
      return null;
    }
    if (parentWindow.location.origin !== window.location.origin) {
      return null;
    }
  } catch (error) {
    return null;
  }

  if (typeof parentWindow.cashFailedLinesTakeHandoff !== 'function') {
    return null;
  }

  var handoff;
  try {
    handoff = parentWindow.cashFailedLinesTakeHandoff();
  } catch (error) {
    return {
      valid: false,
      error: 'The failed cash line list could not be read from Cash Lines.'
    };
  }
  if (!handoff || handoff.pending !== true) {
    return null;
  }
  if (handoff.valid !== true) {
    return {
      valid: false,
      error: handoff.error || 'The failed cash line list is no longer current.'
    };
  }
  if (receiptLineText(handoff.reportNumber) === '' ||
    receiptLineText(handoff.user) === '' || !Array.isArray(handoff.rows)) {
    return {
      valid: false,
      error: 'The failed cash line list is incomplete. Refresh Cash Lines and try again.'
    };
  }

  var handoffStatuses = normalizeReceiptLineInlineHandoffStatuses(
    handoff.statuses
  );
  if (!handoffStatuses.valid) {
    return {
      valid: false,
      error: handoffStatuses.error
    };
  }

  var rows = filterReceiptLineInlineRows(
    handoff.rows,
    handoff.reportNumber,
    handoff.user
  );
  if (rows.length === 0) {
    return {
      valid: false,
      error: 'No failed cash lines are available for this report.'
    };
  }

  return {
    valid: true,
    token: handoff.token,
    reportNumber: handoff.reportNumber,
    user: handoff.user,
    statuses: handoffStatuses.statuses,
    rows: rows
  };
}

function removeReceiptLineInlineContainer() {
  var existing = document.getElementById('receiptLineSelectionInline');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}

function showReceiptLineInlineMessage(message) {
  var element = document.getElementById('receiptLineSelectionInlineMessage');
  if (!element) {
    return;
  }
  element.textContent = message === null || message === undefined
    ? '' : String(message);
  element.style.display = element.textContent === '' ? 'none' : 'block';
}

function isReceiptLineInlineFramePage() {
  return typeof Page !== 'undefined' && Page &&
    typeof Page.isIframe === 'function' && Page.isIframe() === true &&
    typeof window !== 'undefined' && window && window.parent &&
    window.parent !== window;
}

function getReceiptLineInlineFrameElement() {
  if (!isReceiptLineInlineFramePage()) {
    return null;
  }
  try {
    return window.frameElement || null;
  } catch (error) {
    return null;
  }
}

function getReceiptLineInlineFrameHost(frame) {
  if (!frame || !frame.ownerDocument ||
    typeof frame.ownerDocument.getElementById !== 'function') {
    return null;
  }
  try {
    return frame.ownerDocument.getElementById(RECEIPT_LINE_INLINE_HOST_ID);
  } catch (error) {
    return null;
  }
}

// Only the frame AuraPlayer actually moved into the Cash Lines host is sized by
// this page. A standalone/ordinary popup keeps its existing frame dimensions.
function getReceiptLineInlineMountedFrame() {
  var frame = getReceiptLineInlineFrameElement();
  var host = getReceiptLineInlineFrameHost(frame);

  // Host containment is the whole scope: the asIframe callback moves this
  // iframe there after renaming its id, while an ordinary popup stays in the
  // page-as-popup container and is never measured or resized here.
  if (!frame || !host || typeof host.contains !== 'function' ||
    host.contains(frame) !== true) {
    return null;
  }

  return frame;
}

function getReceiptLineInlineTableField() {
  if (typeof document === 'undefined' || !document ||
    typeof document.getElementById !== 'function') {
    return null;
  }

  var table = document.getElementById('tableOutput');
  var field = null;

  if (table && typeof table.closest === 'function') {
    field = table.closest('.field-container.table-field-container');
  }
  if (!field) {
    field = document.getElementById('tableOutput_wrapper');
  }
  if (!field) {
    field = table;
  }

  return field;
}

// The fourth visible native receipt row, but only while a fifth visible row
// remains below it. Counting rows with real layout skips DataTables rows hidden
// with display:none, so only rows the user can see consume a slot.
function getReceiptLineInlineFourthRowBottom() {
  var body = getReceiptLineTableBody();
  var rows = body && body.rows ? body.rows : null;
  var bottoms = [];
  var index;
  var row;
  var rect;

  if (!rows || typeof rows.length !== 'number') {
    return null;
  }

  for (index = 0; index < rows.length; index += 1) {
    row = rows[index];
    if (!row || row.hidden === true ||
      (row.style && row.style.display === 'none') ||
      typeof row.getBoundingClientRect !== 'function') {
      continue;
    }
    rect = row.getBoundingClientRect();
    if (!rect || !isFinite(Number(rect.bottom)) ||
      !(Number(rect.height) > 0)) {
      continue;
    }
    bottoms.push(Number(rect.bottom));
  }

  return bottoms.length >= 5 ? bottoms[3] : null;
}

// Measure content relative to the page top. The feedback message above the form,
// the table header and any wrapped row height are all included because the
// measured rows sit below them. With five or more visible rows only the first
// four determine the fit; otherwise the natural table field bottom is used.
// This stays stable while the frame itself scrolls, unlike body/document
// scrollHeight which still includes the 100vh inline page minimum.
function measureReceiptLineInlineFrameContentHeight() {
  if (typeof document === 'undefined' || !document ||
    typeof document.querySelector !== 'function') {
    return null;
  }

  var page = document.querySelector('div[data-role="page"]') || document.body;
  var field = getReceiptLineInlineTableField();

  if (!page || !field ||
    typeof page.getBoundingClientRect !== 'function' ||
    typeof field.getBoundingClientRect !== 'function') {
    return null;
  }

  var pageRect = page.getBoundingClientRect();
  var fourthRowBottom = getReceiptLineInlineFourthRowBottom();
  var contentBottom = fourthRowBottom === null
    ? Number(field.getBoundingClientRect().bottom)
    : fourthRowBottom;
  var height = contentBottom - Number(pageRect.top);

  if (!isFinite(height) || height <= 0) {
    return null;
  }

  return Math.ceil(height);
}

function getReceiptLineInlineFrameHeightLimit() {
  try {
    var parentHeight = window.parent && window.parent.innerHeight;
    if (typeof parentHeight === 'number' && isFinite(parentHeight) &&
      parentHeight > 0) {
      var limit = parentHeight - RECEIPT_LINE_INLINE_FRAME_PARENT_ALLOWANCE;
      return limit > 0 ? limit : 1;
    }
  } catch (error) {}

  // Without a readable parent viewport there is no fixed compact ceiling; the
  // natural content height is the only limit.
  return 0;
}

function fitReceiptLineInlineFrame() {
  var inline = getReceiptLineInlineState();
  var frame = getReceiptLineInlineMountedFrame();

  if (!inline || !frame || !frame.style ||
    inline.frameExpanded === true) {
    return false;
  }

  var contentHeight = measureReceiptLineInlineFrameContentHeight();
  if (contentHeight === null) {
    return false;
  }

  var limit = getReceiptLineInlineFrameHeightLimit();
  var height = limit > 0 ? Math.min(contentHeight, limit) : contentHeight;
  if (!isFinite(height) || height <= 0) {
    return false;
  }

  // Do not touch the frame when the compact size is already applied. This keeps
  // ResizeObserver callbacks (including the width change from a scrollbar)
  // from turning into an endless height feedback loop.
  if (inline.frameFitHeight === height &&
    frame.style.minHeight === height + 'px' &&
    frame.style.maxHeight === height + 'px') {
    return true;
  }

  // Pinning min/max also stops AuraPlayer's delayed style.height from replacing
  // the measured compact height. Tall content scrolls inside this frame.
  inline.frameFitHeight = height;
  frame.style.minHeight = height + 'px';
  frame.style.maxHeight = height + 'px';
  frame.style.height = height + 'px';
  return true;
}

function getReceiptLineInlineResizeObserver() {
  if (typeof window !== 'undefined' && window &&
    typeof window.ResizeObserver === 'function') {
    return window.ResizeObserver;
  }
  if (typeof ResizeObserver === 'function') {
    return ResizeObserver;
  }
  return null;
}

function getReceiptLineInlineMutationObserver() {
  if (typeof window !== 'undefined' && window &&
    typeof window.MutationObserver === 'function') {
    return window.MutationObserver;
  }
  if (typeof MutationObserver === 'function') {
    return MutationObserver;
  }
  return null;
}

function disconnectReceiptLineInlineMountObserver() {
  var inline = getReceiptLineInlineState();
  if (!inline || !inline.frameMountObserver) {
    return;
  }
  try {
    inline.frameMountObserver.disconnect();
  } catch (error) {}
  inline.frameMountObserver = null;
}

function disconnectReceiptLineInlineFrameObservers() {
  var inline = getReceiptLineInlineState();
  if (!inline) {
    return;
  }
  if (inline.frameResizeObserver) {
    try {
      inline.frameResizeObserver.disconnect();
    } catch (error) {}
    inline.frameResizeObserver = null;
  }
  disconnectReceiptLineInlineMountObserver();
}

function installReceiptLineInlineFrameResizeObserver() {
  var inline = getReceiptLineInlineState();
  var Observer = getReceiptLineInlineResizeObserver();

  if (!inline || inline.frameResizeObserver || !Observer) {
    return;
  }

  var observer;
  try {
    observer = new Observer(function () {
      fitReceiptLineInlineFrame();
    });
  } catch (error) {
    return;
  }

  var observed = [];
  function observe(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function' ||
      observed.indexOf(element) >= 0) {
      return;
    }
    try {
      observer.observe(element);
      observed.push(element);
    } catch (error) {}
  }

  observe(getReceiptLineInlineTableField());
  if (typeof document !== 'undefined' && document &&
    typeof document.getElementById === 'function') {
    observe(document.getElementById('tableOutput_wrapper'));
    observe(document.getElementById('receiptLineSelectionInlineMessage'));
  }

  inline.frameResizeObserver = observer;
}

function installReceiptLineInlineFrameMountObserver(frame) {
  var inline = getReceiptLineInlineState();
  var host = getReceiptLineInlineFrameHost(frame);
  var Observer = getReceiptLineInlineMutationObserver();

  if (!inline || !host || inline.frameMountObserver || !Observer) {
    return;
  }

  var observer;
  try {
    observer = new Observer(function () {
      if (!getReceiptLineInlineMountedFrame()) {
        return;
      }
      // Mount is a one-time event; stop observing before starting the resize
      // observer and applying the first compact fit.
      if (inline.frameMountObserver === observer) {
        inline.frameMountObserver = null;
      }
      try {
        observer.disconnect();
      } catch (error) {}
      installReceiptLineInlineFrameResizeObserver();
      fitReceiptLineInlineFrame();
    });
    observer.observe(host, { childList: true });
    inline.frameMountObserver = observer;
  } catch (error) {
    inline.frameMountObserver = null;
  }
}

function installReceiptLineInlineFrameFit() {
  var inline = getReceiptLineInlineState();
  var frame = getReceiptLineInlineFrameElement();

  if (!inline || !frame || !frame.style) {
    return;
  }

  inline.frameFitInstalled = true;

  // The frame may already be mounted if a caller reaches this later. Otherwise
  // wait for AuraPlayer's asIframe callback to rename the id and move it into
  // #cashFailedLinesHost.
  if (getReceiptLineInlineMountedFrame()) {
    disconnectReceiptLineInlineMountObserver();
    installReceiptLineInlineFrameResizeObserver();
    fitReceiptLineInlineFrame();
    return;
  }

  installReceiptLineInlineFrameMountObserver(frame);
}

function setReceiptLineInlineFrameExpanded(expanded) {
  if (!isReceiptLineInlineFramePage()) {
    return;
  }

  var frame = getReceiptLineInlineFrameElement();
  var inline = getReceiptLineInlineState();
  if (!frame || !frame.style || !inline) {
    return;
  }
  if (inline.frameOriginalHeight === undefined) {
    inline.frameOriginalHeight = frame.style.height || '';
  }

  if (expanded === true) {
    // Preview owns the frame height while open. Remove the compact pins so the
    // shared viewer's expanded height is not clamped, and never refit here.
    inline.frameExpanded = true;
    inline.frameFitHeight = null;
    frame.style.minHeight = '';
    frame.style.maxHeight = '';
    frame.style.height = 'min(80vh, 760px)';
    return;
  }

  inline.frameExpanded = false;
  frame.style.height = inline.frameOriginalHeight || '';
  fitReceiptLineInlineFrame();
}

function installReceiptLineInlineViewerResize() {
  var inline = getReceiptLineInlineState();
  if (!inline || inline.viewerResizeInstalled === true ||
    typeof removeAttachmentViewer !== 'function') {
    return;
  }

  inline.originalRemoveAttachmentViewer = removeAttachmentViewer;
  inline.viewerRemoveWrapper = function () {
    var result = inline.originalRemoveAttachmentViewer.apply(this, arguments);
    if (result !== false) {
      setReceiptLineInlineFrameExpanded(false);
    }
    return result;
  };
  try {
    window.removeAttachmentViewer = inline.viewerRemoveWrapper;
    inline.viewerResizeInstalled = true;
  } catch (error) {
    inline.originalRemoveAttachmentViewer = null;
    inline.viewerRemoveWrapper = null;
  }
}

// AuraPlayer analyzes every array service response by repopulating the page's
// native table from its own Storage-backed source. In inline mode that source is
// the ordinary chooser's indexed rows, not this iframe's validated report rows,
// so the automatic redraw would briefly replace the inline list. The normal
// standalone popup has the same stale-row flash while a create is opening its
// line details. Guard only this page's global entry point while either mode is
// active; the explicit Table.populate of in-memory rows in
// populateReceiptLineInlineTable still runs.
function installReceiptLinePopulateGuard() {
  var inline = getReceiptLineInlineState();
  var original = typeof window !== 'undefined' && window
    ? window.populateTableOrList
    : null;

  if (!inline || inline.populateTableOrListWrapper ||
    typeof original !== 'function') {
    return;
  }

  var wrapper = function () {
    if (isReceiptLineInlineModeActive() ||
      Create_Line.receiptLineSelectionCreateInFlight === true) {
      return;
    }
    return original.apply(this, arguments);
  };

  try {
    window.populateTableOrList = wrapper;
    inline.originalPopulateTableOrList = original;
    inline.populateTableOrListWrapper = wrapper;
  } catch (error) {
    inline.originalPopulateTableOrList = null;
    inline.populateTableOrListWrapper = null;
  }
}

function restoreReceiptLinePopulateGuard() {
  var inline = getReceiptLineInlineState();
  var wrapper = inline && inline.populateTableOrListWrapper;

  if (!wrapper) {
    return;
  }

  // Never overwrite an entry point another script installed after this guard.
  if (typeof window !== 'undefined' && window &&
    window.populateTableOrList === wrapper) {
    try {
      window.populateTableOrList = inline.originalPopulateTableOrList;
    } catch (error) {}
  }

  inline.originalPopulateTableOrList = null;
  inline.populateTableOrListWrapper = null;
}

function cleanupReceiptLineInlineMode() {
  var inline = getReceiptLineInlineState();

  restoreReceiptLinePopulateGuard();
  disconnectReceiptLineInlineFrameObservers();
  removeReceiptLineInlineContainer();
  setReceiptLineInlineFrameExpanded(false);

  if (inline) {
    if (inline.viewerResizeInstalled === true &&
      inline.viewerRemoveWrapper &&
      typeof window !== 'undefined' && window &&
      window.removeAttachmentViewer === inline.viewerRemoveWrapper) {
      try {
        window.removeAttachmentViewer = inline.originalRemoveAttachmentViewer;
      } catch (error) {}
    }
    inline.active = false;
    inline.token = '';
    inline.reportNumber = '';
    inline.user = '';
    inline.rows = [];
    inline.creating = {};
    inline.viewerResizeInstalled = false;
    inline.originalRemoveAttachmentViewer = null;
    inline.viewerRemoveWrapper = null;
    inline.originalPopulateTableOrList = null;
    inline.populateTableOrListWrapper = null;
    inline.frameOriginalHeight = undefined;
    inline.frameExpanded = false;
    inline.frameFitHeight = null;
    inline.frameFitInstalled = false;
    inline.frameResizeObserver = null;
    inline.frameMountObserver = null;
  }

  if (typeof $ === 'function') {
    $('body').removeClass('receipt-line-selection-inline');
  }
}

function renderReceiptLineInlineError(message) {
  var inline = getReceiptLineInlineState();
  if (inline) {
    // Keep inline mode active with no rows so ordinary Preview/Create actions
    // cannot fall back to the normal picker's indexed Storage aliases.
    inline.active = true;
    inline.rows = [];
    inline.creating = {};
  }
  receiptLineSelectionStatuses = ['LINE_FAILED'];
  statuses = receiptLineSelectionStatuses.join(',');

  // Clear only this iframe's native table. Table.clear is the project standard,
  // but it is not available on every host, so guard both its presence and call.
  if (typeof Table !== 'undefined' && Table &&
    typeof Table.clear === 'function') {
    try {
      Table.clear();
    } catch (error) {}
  }

  removeReceiptLineInlineContainer();
  if (typeof $ === 'function') {
    $('body').addClass('receipt-line-selection-inline');
  }

  var container = document.createElement('div');
  container.id = 'receiptLineSelectionInline';
  container.className = 'receipt-line-selection-inline';
  var error = document.createElement('div');
  error.id = 'receiptLineSelectionInlineMessage';
  error.className = 'receipt-line-selection-inline-message';
  error.textContent = message || 'The failed cash line list is not available.';
  error.style.display = 'block';
  container.appendChild(error);

  var mount = document.getElementById('mainPage') ||
    (typeof document.querySelector === 'function' &&
      document.querySelector('div[data-role="page"]')) ||
    document.body;
  mount.appendChild(container);
}

function renderReceiptLineInlineMode(handoff) {
  var rows = filterReceiptLineInlineRows(
    handoff.rows,
    handoff.reportNumber,
    handoff.user
  );
  if (rows.length === 0) {
    renderReceiptLineInlineError('No failed cash lines are available for this report.');
    return;
  }

  var inline = getReceiptLineInlineState();
  if (!inline) {
    return;
  }

  inline.active = true;
  inline.token = handoff.token;
  inline.reportNumber = handoff.reportNumber;
  inline.user = handoff.user;
  inline.rows = rows;
  inline.creating = {};
  receiptLineSelectionMode = 'CASH';
  receiptLineSelectionStatuses = handoff.statuses.slice();
  statuses = receiptLineSelectionStatuses.join(',');

  if (typeof $ === 'function') {
    $('body').addClass('receipt-line-selection-inline');
  }
  removeReceiptLineInlineContainer();

  var mount = document.getElementById('mainPage') ||
    (typeof document.querySelector === 'function' &&
      document.querySelector('div[data-role="page"]')) ||
    document.body;
  var container = document.createElement('div');
  container.id = 'receiptLineSelectionInline';
  container.className = 'receipt-line-selection-inline';

  var message = document.createElement('div');
  message.id = 'receiptLineSelectionInlineMessage';
  message.className = 'receipt-line-selection-inline-message';
  message.style.display = 'none';
  container.appendChild(message);

  // Keep action feedback above the native form/table without replacing either.
  var form = document.getElementById('mainForm');
  if (form && form.parentNode === mount) {
    mount.insertBefore(container, form);
  } else {
    mount.appendChild(container);
  }

  var populated = false;
  try {
    populated = populateReceiptLineInlineTable(rows);
  } catch (error) {
    populated = false;
  }
  if (!populated) {
    renderReceiptLineInlineError(
      'The failed cash line table could not be loaded. Refresh Cash Lines and try again.'
    );
    return;
  }

  installReceiptLinePopulateGuard();

  if (typeof window !== 'undefined' && window.frameElement) {
    window.frameElement.style.maxWidth = '100%';
    window.frameElement.style.display = 'block';
    window.frameElement.title = 'Failed Cash Lines';
  }

  installReceiptLineInlineViewerResize();
  installReceiptLineInlineFrameFit();
}

function isReceiptLineInlineContextCurrent(receipt) {
  var inline = getReceiptLineInlineState();
  if (!inline || inline.active !== true ||
    !isReceiptLineSelectionPageCurrent()) {
    return false;
  }

  var receiptId = receiptLineText(receipt && receipt.RECEIPT_ID);
  if (receiptId === '' || !isReceiptLineInlineRowEligible(
    receipt,
    inline.reportNumber,
    inline.user
  )) {
    return false;
  }

  var known = inline.rows.some(function (row) {
    return String(row.RECEIPT_ID) === receiptId;
  });
  if (!known) {
    return false;
  }

  if (typeof window === 'undefined' || !window || !window.parent ||
    window.parent === window) {
    return false;
  }

  var parentWindow;
  try {
    parentWindow = window.parent;
    if (!parentWindow.document || !parentWindow.location ||
      parentWindow.location.origin !== window.location.origin) {
      return false;
    }
    if (typeof parentWindow.cashFailedLinesValidateInlineContext !== 'function') {
      return false;
    }
    return parentWindow.cashFailedLinesValidateInlineContext(
      inline.token,
      inline.reportNumber,
      inline.user,
      receiptId
    ) === true;
  } catch (error) {
    return false;
  }
}

function setReceiptLineInlineActionBusy(button, busy) {
  if (!button) {
    return;
  }
  button.disabled = busy === true;
  button.textContent = busy === true ? 'Creating...' : 'Create Line';
}

function restoreReceiptLineInlineAction(receipt, button) {
  var inline = getReceiptLineInlineState();
  var receiptId = receiptLineText(receipt && receipt.RECEIPT_ID);

  if (inline && receiptId !== '' && inline.creating) {
    delete inline.creating[receiptId];
  }
  setReceiptLineInlineActionBusy(button, false);
}

function receiptLineInlineExpenseData(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return '';
  }
}

// Convert the exact report row to the same small receipt shape produced by
// prepareReceiptLineFields(rowIndex). The raw row and its ID remain the action
// identity; this only normalizes the fields consumed by the existing mapping.
function receiptLineInlineReceiptFromRow(row) {
  return {
    id: row.RECEIPT_ID,
    expenseType: row.EXPENSE_TYPE,
    amount: row.TOTAL_AMOUNT,
    date: row.RECEIPT_DATE,
    merchant: row.MERCHANT,
    location: row.LOCATION,
    expenseData: receiptLineInlineExpenseData(row.EXPENSE_DATA_JSON)
  };
}

function receiptLineInlineFailureHandler(message, receipt, button) {
  return function () {
    restoreReceiptLineInlineAction(receipt, button);
    showReceiptLineInlineMessage(message);

    if (typeof displayReportServiceError === 'function') {
      try {
        var displayError = displayReportServiceError(message);
        if (typeof displayError === 'function') {
          displayError();
          return;
        }
      } catch (error) {}
    }
    if (typeof Popup !== 'undefined' && Popup && typeof Popup.ok === 'function') {
      Popup.ok('Create Line', message);
    }
  };
}

function createReceiptLineFromInline(receipt, button) {
  var inline = getReceiptLineInlineState();
  var receiptId = receiptLineText(receipt && receipt.RECEIPT_ID);

  if (!inline || receiptId === '' ||
    !isReceiptLineInlineContextCurrent(receipt)) {
    showReceiptLineInlineMessage(
      'This failed receipt is no longer current. Refresh Cash Lines and try again.'
    );
    return;
  }
  if (Object.keys(inline.creating).length > 0) {
    return;
  }

  inline.creating[receiptId] = true;
  setReceiptLineInlineActionBusy(button, true);

  var receiptForLine = receiptLineInlineReceiptFromRow(receipt);

  prepareReceiptLineFieldsForReceipt(
    receiptForLine,
    function (values, preparedReceipt) {
      if (!isReceiptLineInlineContextCurrent(receipt)) {
        restoreReceiptLineInlineAction(receipt, button);
        showReceiptLineInlineMessage(
          'This failed receipt is no longer current. Refresh Cash Lines and try again.'
        );
        return;
      }

      Storage.set('index', Storage.count('CashLines_ExpenseType_0'));
      Storage.set('isCreditLine', false);
      Storage.remove('LineDetailsUpdate');

      Services.call(
        resolveServiceName('iExpense_cash_openLineDetails'),
        function () {
          if (!isReceiptLineInlineContextCurrent(receipt)) {
            restoreReceiptLineInlineAction(receipt, button);
            showReceiptLineInlineMessage(
              'This failed receipt is no longer current. Refresh Cash Lines and try again.'
            );
            return;
          }

          Storage.set('ExpTypeInput', preparedReceipt.expenseType);
          Services.call(
            resolveServiceName('iExpense_lineDetailsGet'),
            function () {
              if (!isReceiptLineInlineContextCurrent(receipt)) {
                restoreReceiptLineInlineAction(receipt, button);
                showReceiptLineInlineMessage(
                  'This failed receipt is no longer current. Refresh Cash Lines and try again.'
                );
                return;
              }

              storeReceiptLineFields(values, preparedReceipt);
              if (Storage.get('ApproveScannedReceipt_ID') !==
                String(preparedReceipt.id)) {
                Storage.set('ApproveScannedReceipt_ID', preparedReceipt.id);
              }
              Storage.set('ApproveScannedReceipt', true);
              Page.navigate('LineDetails.html');
            },
            receiptLineInlineFailureHandler(
              'Failed to load expense line details',
              receipt,
              button
            )
          );
        },
        receiptLineInlineFailureHandler(
          'Failed to open detailed expense line',
          receipt,
          button
        )
      );
    },
    function (error) {
      restoreReceiptLineInlineAction(receipt, button);
      showReceiptLineInlineMessage(
        error && error.message ? error.message :
          'Failed to load the expense field metadata'
      );
    }
  );
}

function previewReceiptLineFromInline(receipt) {
  if (!isReceiptLineInlineContextCurrent(receipt)) {
    showReceiptLineInlineMessage(
      'This failed receipt is no longer current. Refresh Cash Lines and try again.'
    );
    return;
  }

  // Expanding before the shared preview opens would be undone by
  // removeAttachmentViewer() inside the first preview step, so wait until the
  // preview has actually been requested.
  Preview(null, receipt, function () {
    if (!isReceiptLineInlineContextCurrent(receipt)) {
      return;
    }
    setReceiptLineInlineFrameExpanded(true);
  });
}
