
//'NEW,PROCESSING,PROCESSED,READY,ANALYZED_FAILED,AI_FAILED,LINE_CREATED,LINE_FAILED,SUBMITTED'
var statuses = 'NEW,PROCESSING,PROCESSED,READY,ANALYZED_FAILED,AI_FAILED,SUBMITTED';

var SUPPORTED_FILE_EXTENSIONS = '.pdf,.png,.jpg,.jpeg,.heic';
var COMPRESSION_FILE_EXTENSIONS = ['jpg', 'jpeg', 'heic'];
var COMPRESSION_SIZE_THRESHOLD = 350000;



// ----------------------------------------------------------------------------
// Page initialization
// ----------------------------------------------------------------------------

function onLoad() {
  Table.clear();
  
  Storage.deleteByPrefix('Select_');
  Storage.set("NEW_AI_REPORT", "false");
  
  configureReceiptViewer({
    allowApprove: false,
    showData: true,
    allowEdit: true
  });
  createReceiptToolbar();

  if (receiptsAttachmentsPageInitialized !== true) {
    receiptsAttachmentsPageInitialized = true;
    resetSelectedReceiptIdsForDatasetLoad();
  }

  beginReceiptSelectionReload();
  receiptTableDrawnForCurrentLoad = false;

  loadReceiptBatchesByUserAndStatuses(
    statuses,
    onReceiptListFetchSucceeded,
    onReceiptListFetchFailed
  );

  bindReceiptTableDrawHandler();

  bindReceiptTableSelectionHandlers();
}

function bindReceiptTableDrawHandler() {
  waitForReceiptTable(function (table) {
    table
      .off('draw.receipts')
      .on('draw.receipts', function () {
        markReceiptTableDrawn();
        renderReceiptTableDecorations();
      });

    renderReceiptTableDecorations();
  });
}

function waitForReceiptTable(callback, attemptsLeft) {
  var maxAttempts = attemptsLeft === undefined ? 20 : attemptsLeft;
  var tableElement = $('#tableOutput');

  if (
    tableElement.length &&
    $.fn.DataTable &&
    $.fn.DataTable.isDataTable('#tableOutput')
  ) {
    callback(tableElement.DataTable());
    return;
  }

  if (maxAttempts <= 0) {
    console.log('Receipt table was not initialized in time');
    return;
  }

  setTimeout(function () {
    waitForReceiptTable(callback, maxAttempts - 1);
  }, 100);
}

function returnToReceiptsAfterSave() {
  if (removeAttachmentViewer() === false) {
    return false;
  }

  onLoad();
  return true;
}

// ----------------------------------------------------------------------------
// Table rendering
// ----------------------------------------------------------------------------

function renderReceiptTableDecorations() {
  reconcileSelectedReceiptIdsWithLoadedReceipts(
    receiptTableDrawnForCurrentLoad === true &&
    receiptSelectionReloadPending !== true
  );
  colorCreditRows();
  applyRowStatusClasses();
  applyReceiptRowGate();
  renderExtractionPendingMessage();
  syncSelectedReceiptIdsFromSelection();
}

function hasCreditReceipt(rowIndex) {
  var creditValue = Storage.get(
    'RECEIPTBATCH_CREDIT_' + rowIndex
  );

  return (
    creditValue !== null &&
    creditValue !== undefined &&
    String(creditValue).trim() !== ''
  );
}


function createReceiptToolbar() {
  var $originalAdd = $('#Add_Attachment');
  var $originalRefresh = $('#refresh');
  var $newReport = $('#New_Report');
  var $tableContainer = $(
    '.field-container.table-field-container'
  ).first();

  var $toolbar;
  var $newReportWrapper;
  var $addBtn;
  var $refreshBtn;

  if (
    !$originalAdd.length ||
    !$originalRefresh.length ||
    !$newReport.length ||
    !$tableContainer.length
  ) {
    console.log(
      'Receipt toolbar cannot be created. '
      + 'Required controls were not found.'
    );
    return null;
  }

  $toolbar = $tableContainer.find('.receipt-table-toolbar');

  if ($toolbar.length) {
    return $toolbar.show();
  }

  $originalAdd.hide();
  $originalRefresh.hide();

  $addBtn = $(
    '<button type="button" '
    + 'class="TableAddLineBtn receiptToolbarButton" '
    + 'aria-label="Add attachment" '
    + 'title="Add attachment">'
    + '<i class="fa fa-plus" aria-hidden="true"></i>'
    + '</button>'
  );

  $refreshBtn = $(
    '<button type="button" '
    + 'class="TableAddLineBtn receiptToolbarButton" '
    + 'aria-label="Refresh" '
    + 'title="Refresh">'
    + '<i class="fa fa-refresh" aria-hidden="true"></i>'
    + '</button>'
  );

  $addBtn.on('click.receiptsToolbar', function () {
    onAddAttachment();
  });

  $refreshBtn.on('click.receiptsToolbar', function () {
    Refresh();
  });

  $toolbar = $('<div class="receipt-table-toolbar"></div>').css({
    display: 'flex',
    'justify-content': 'flex-start',
    'align-items': 'center',
    'flex-wrap': 'wrap',
    gap: '10px',
    'margin-bottom': '10px'
  });

  $newReportWrapper = $newReport.closest(
    '.outer-field-container'
  );

  if (!$newReportWrapper.length) {
    $newReportWrapper = $newReport.parent();
  }

  $newReportWrapper.css({
    margin: '0',
    display: 'flex',
    'align-items': 'center',
    width: 'auto',
    'min-width': '0'
  });

  $newReport.css({
    margin: '0',
    height: '36px',
    'line-height': '36px',
    padding: '0 12px',
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    'white-space': 'nowrap'
  });

  $toolbar.append(
    $addBtn,
    $refreshBtn,
    $newReportWrapper
  );

  $tableContainer.prepend($toolbar);

  return $toolbar;
}

// ----------------------------------------------------------------------------
// Receipt actions
// ----------------------------------------------------------------------------

function onAddAttachment() {
  var attachmentInput;

  if (hasSelectedReadyReceipt()) {
    Popup.ok(
      'Add Attachment',
      'Ready receipts are still selected. Deselect every selected '
      + 'receipt before adding attachments.',
      function () { }
    );

    return;
  }

  attachmentInput = document.createElement('input');

  attachmentInput.type = 'file';
  attachmentInput.multiple = true;
  attachmentInput.accept = SUPPORTED_FILE_EXTENSIONS;

  addAttachmentUsingInput(attachmentInput);
}

function Refresh() {
  Storage.set('P_STATUSES', 'NEW');

  beginIndependentReceiptSelectionReload();

  Spinner.start('Refreshing receipts', 'REFRESH_RECEIPTS');

  Services.call(
    'ReceiptBatch_AnalyzeRPA',

    function () {
      matchAndLoad();
    },

    function () {
      Spinner.stop('REFRESH_RECEIPTS');

      onReceiptListFetchFailed();

      Popup.ok(
        'Refresh',
        'Failed to analyze receipt attachments'
      );
    }
  );
}

function matchAndLoad() {
  Services.call(
    'ReceiptBatch_TransactionMatching',

    function () {
      Spinner.stop('REFRESH_RECEIPTS');
      reloadReceiptTable(true);
    },

    function () {
      Spinner.stop('REFRESH_RECEIPTS');

      onReceiptListFetchFailed();

      Popup.ok(
        'Refresh',
        'Failed to match receipts to transactions'
      );
    }
  );
}

function reloadReceiptTable(preserveCapturedSelection) {
  receiptTableDrawnForCurrentLoad = false;

  if (preserveCapturedSelection === true) {
    beginReceiptSelectionReload();
  } else {
    beginIndependentReceiptSelectionReload();
  }

  loadReceiptBatchesByUserAndStatuses(
    statuses,
    onReceiptListFetchSucceeded,
    onReceiptListFetchFailed
  );

  setTimeout(function () {
    bindReceiptTableDrawHandler();
  }, 100);
}

function Remove(rowIndex) {
  showConfirmPopup(
    'Remove Attachment',
    'Are you sure you want to remove this attachment?',

    function () {
      Storage.set(
        'receipt_ID',
        Storage.get('RECEIPTBATCH_RECEIPT_ID_' + rowIndex)
      );

      Spinner.start('Removing attachment', 'DELETE_RECEIPT');

      beginIndependentReceiptSelectionReload();

      Services.call(
        'ReceiptBatch_delete_receipt',

        function () {
          $('#tableOutput').off('draw.receipts');
          Table.clear();
          Storage.deleteByPrefix('Select_');

          Spinner.stop('DELETE_RECEIPT');
          onLoad();
        },

        function () {
          Spinner.stop('DELETE_RECEIPT');
          onReceiptListFetchFailed();

          Popup.ok(
            'Remove Attachment',
            'Failed to remove attachment'
          );
        }
      );
    }
  );
}

function Preview(rowIndex) {
  setPreviewDataFromReceiptRow(rowIndex);

  Services.call(
    'js_ReceiptBatch_get_receipt_by_id',

    function () {
      var documentUrl = Storage.get(
        'RECEIPTBATCH_DOCUMENT_URL'
      );

      var fileType = Storage.get(
        'RECEIPTBATCH_FILE_TYPE'
      );

      if (!documentUrl) {
        documentUrl = Storage.get('DOCUMENT_URL');
      }

      if (!fileType) {
        fileType = Storage.get('FILE_TYPE');
      }

      if (!documentUrl) {
        Popup.ok(
          'Preview',
          'No document URL was returned'
        );
        return;
      }

      showAttachmentPreview(documentUrl, fileType);
    },

    function () {
      Popup.ok(
        'Preview',
        'Failed to load receipt preview'
      );
    }
  );
}

function setPreviewDataFromReceiptRow(rowIndex) {
  Storage.set(
    'receipt_ID',
    Storage.get('RECEIPTBATCH_RECEIPT_ID_' + rowIndex)
  );

  Storage.set(
    'RECEIPTBATCH_RECEIPT_ID',
    Storage.get('RECEIPTBATCH_RECEIPT_ID_' + rowIndex)
  );

  Storage.set(
    'RECEIPTBATCH_FILE_TYPE',
    Storage.get('RECEIPTBATCH_FILE_TYPE_' + rowIndex)
  );

  Storage.set(
    'RECEIPTBATCH_STATUS',
    getReceiptRowStatus(rowIndex)
  );

  Storage.set(
    'PreviewExpenseType',
    Storage.get('RECEIPTBATCH_EXPENSE_TYPE_' + rowIndex)
  );

  Storage.set(
    'PreviewAmount',
    Storage.get('RECEIPTBATCH_TOTAL_AMOUNT_' + rowIndex)
  );

  Storage.set(
    'PreviewReceiptDate',
    Storage.get('RECEIPTBATCH_RECEIPT_DATE_' + rowIndex)
  );

  Storage.set(
    'PreviewMerchant',
    Storage.get('RECEIPTBATCH_MERCHANT_' + rowIndex)
  );

  Storage.set(
    'PreviewLocation',
    Storage.get('RECEIPTBATCH_LOCATION_' + rowIndex)
  );

  Storage.set(
    'PreviewDepartment',
    Storage.get('RECEIPTBATCH_DEPARTMENT_' + rowIndex)
  );
}

// ----------------------------------------------------------------------------
// Multiple attachment upload
// ----------------------------------------------------------------------------

function addAttachmentUsingInput(attachmentInput) {
  document.body.appendChild(attachmentInput);
  attachmentInput.style.display = 'none';

  attachmentInput.addEventListener(
    'change',
    function (event) {
      var selectedFiles = event.target.files;
      var uploadState;

      if (!selectedFiles || selectedFiles.length === 0) {
        removeAttachmentInput(attachmentInput);
        return;
      }

      uploadState = {
        files: Array.prototype.slice.call(selectedFiles),
        currentIndex: 0,
        failedFiles: []
      };

      Spinner.start(
        'Uploading ' + uploadState.files.length + ' files',
        'UPLOADING_FILES'
      );

      uploadNextFile(uploadState, attachmentInput);
    }
  );

  attachmentInput.click();
}

function uploadNextFile(uploadState, attachmentInput) {
  console.log("uploadNextFile");
  var file;

  if (uploadState.currentIndex >= uploadState.files.length) {
    finishUploadProcess(uploadState, attachmentInput);
    return;
  }

  file = uploadState.files[uploadState.currentIndex];
  uploadState.currentIndex++;

  readAndUploadFile(
    file,

    function () {
      uploadNextFile(uploadState, attachmentInput);
    },

    function () {
      uploadState.failedFiles.push(file.name);
      uploadNextFile(uploadState, attachmentInput);
    }
  );
}

function finishUploadProcess(uploadState, attachmentInput) {
  console.log("finishUploadProcess");
  Spinner.stop('UPLOADING_FILES');
  removeAttachmentInput(attachmentInput);

  removeExtractionPendingMessages();

  if (uploadState.failedFiles.length > 0) {
    Popup.ok(
      'Failed uploading files',
      'The following files failed to upload: '
      + uploadState.failedFiles.join(', ')
    );
  }

  reloadReceiptTable();
}

function removeAttachmentInput(attachmentInput) {
  attachmentInput.value = '';

  if (attachmentInput.parentNode) {
    attachmentInput.parentNode.removeChild(attachmentInput);
  }
}

function readAndUploadFile(file, successCallback, failureCallback) {
  var fileReader = new FileReader();

  fileReader.onload = function (loadEvent) {
    var fileExtension = getFileExtension(file.name);
    var fileData = loadEvent.target.result;

    if (
      file.size > COMPRESSION_SIZE_THRESHOLD &&
      COMPRESSION_FILE_EXTENSIONS.indexOf(fileExtension) !== -1
    ) {
      compressFileForUpload(
        file,
        fileData,
        fileExtension,
        successCallback,
        failureCallback
      );

      return;
    }

    uploadAttachment(
      fileData,
      file.name,
      successCallback,
      failureCallback
    );
  };

  fileReader.onerror = function () {
    console.log('Failed to read file:', file.name);

    failureCallback();
  };

  fileReader.readAsDataURL(file);
}

function compressFileForUpload(
  file,
  fileData,
  fileExtension,
  successCallback,
  failureCallback
) {
  Spinner.start(
    'Compressing: ' + file.name,
    'COMPRESSING_FILE'
  );

  if (fileExtension === 'heic') {
    compressHeicFile(
      file,
      successCallback,
      failureCallback
    );

    return;
  }

  compressImage(
    fileData,
    file.name,

    function (compressedData, compressedFileName) {
      Spinner.stop('COMPRESSING_FILE');

      uploadAttachment(
        compressedData,
        compressedFileName || file.name,
        successCallback,
        failureCallback
      );
    },

    function () {
      Spinner.stop('COMPRESSING_FILE');

      failureCallback();
    }
  );
}

function compressHeicFile(
  file,
  successCallback,
  failureCallback
) {
  if (typeof heic2any !== 'function') {
    console.log('heic2any is not available');

    Spinner.stop('COMPRESSING_FILE');
    failureCallback();

    return;
  }

  heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.1
  })
    .then(function (conversionResult) {
      var convertedFileName = file.name.replace(
        /\.heic$/i,
        '.jpeg'
      );

      compressImage(
        URL.createObjectURL(conversionResult),
        convertedFileName,

        function (compressedData, compressedFileName) {
          Spinner.stop('COMPRESSING_FILE');

          uploadAttachment(
            compressedData,
            compressedFileName || convertedFileName,
            successCallback,
            failureCallback
          );
        },

        function () {
          Spinner.stop('COMPRESSING_FILE');
          failureCallback();
        }
      );
    })

    .catch(function (error) {
      console.log(
        'HEIC conversion failed for:',
        file.name,
        error
      );

      Spinner.stop('COMPRESSING_FILE');
      failureCallback();
    });
}

function compressImage(
  imageSource,
  fileName,
  successCallback,
  failureCallback
) {
  var image = new Image();

  image.onload = function () {
    var canvas = document.createElement('canvas');
    var context;
    var maxDimension = 2200;
    var width = image.width;
    var height = image.height;
    var scale;

    if (width > maxDimension || height > maxDimension) {
      scale = Math.min(
        maxDimension / width,
        maxDimension / height
      );

      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    canvas.width = width;
    canvas.height = height;

    context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);

    try {
      canvas.toBlob(
        function (blob) {
          var readerBase64;

          if (!blob) {
            failureCallback();
            return;
          }

          readerBase64 = new FileReader();

          readerBase64.onload = function () {
            successCallback(
              readerBase64.result,
              changeFileExtension(fileName, 'jpeg')
            );
          };

          readerBase64.onerror = function () {
            failureCallback();
          };

          readerBase64.readAsDataURL(blob);
        },

        'image/jpeg',
        0.7
      );
    } catch (error) {
      console.log('Image compression failed:', error);
      failureCallback();
    }
  };

  image.onerror = function () {
    failureCallback();
  };

  image.src = imageSource;
}

function changeFileExtension(fileName, extension) {
  var dotIndex = fileName.lastIndexOf('.');

  if (dotIndex === -1) {
    return fileName + '.' + extension;
  }

  return fileName.substring(0, dotIndex) + '.' + extension;
}

function uploadAttachment(
  base64,
  fileName,
  successCallback,
  failureCallback
) {
  var rawBase64 = getRawBase64(base64);
  var safeFileName = makeFilenameSafe(fileName);
  var fileExtension = getFileExtension(safeFileName);
  var fileType = fileExtension.toUpperCase();

  Storage.set('blob', rawBase64);
  Storage.set('fileName', safeFileName);
  Storage.set('fileType', fileType);

  Services.call(
    'js_ReceiptBatch_add_receipt',

    function () {
      successCallback();
    },

    function (error) {
      console.log(
        'Failed to upload attachment:',
        safeFileName,
        error
      );

      failureCallback(error);
    }
  );
}

function getRawBase64(base64Value) {
  var marker = 'base64,';
  var markerIndex;

  if (!base64Value) {
    return '';
  }

  markerIndex = base64Value.indexOf(marker);

  if (markerIndex === -1) {
    return base64Value;
  }

  return base64Value.substring(
    markerIndex + marker.length
  );
}

// ----------------------------------------------------------------------------
// Filename cleanup
// ----------------------------------------------------------------------------

var unsafeChars = /[()<>:"\/\\|?*\x00-\x1F]/g;
var spaceReplacement = / /g;

function makeFilenameSafe(value) {
  return String(value || 'attachment')
    .replace(unsafeChars, '_')
    .replace(spaceReplacement, '_')
    .trim();
}

var RECEIPT_STATUS_ROW_SELECTOR = '#tableOutput tbody tr';
var RECEIPT_STATUS_SELECT_PREFIX = 'Select_';
var RECEIPT_STATUS_STORAGE_PREFIX = 'RECEIPTBATCH_STATUS_';
Storage.set("RECEIPT_STATUS_STORAGE_PREFIX", "RECEIPTBATCH_STATUS_")
var RECEIPT_STATUS_CLASS_BY_STATUS = {
  NEW: 'receipt-status-new',
  PROCESSING: 'receipt-status-processing',
  PROCESSED: 'receipt-status-processed',
  FAILED: 'receipt-status-failed',
  AI_FAILED: 'receipt-status-ai-failed',
  READY: 'receipt-status-ready'
};

var RECEIPT_STATUS_CLASSES = [
  'receipt-status-new',
  'receipt-status-processing',
  'receipt-status-processed',
  'receipt-status-failed',
  'receipt-status-ai-failed',
  'receipt-status-ready'
];

function applyRowStatusClasses() {
  $(RECEIPT_STATUS_ROW_SELECTOR).each(function () {
    styleReceiptRowStatus(this);
  });
}

function styleReceiptRowStatus(rowElement) {
  var $row = $(rowElement);
  var rowIndex = getRenderedRowDatasetIndex(rowElement);
  var statusClass;

  RECEIPT_STATUS_CLASSES.forEach(function (className) {
    $row.removeClass(className);
  });

  if (rowIndex === null) {
    return;
  }

  statusClass = getReceiptRowStatusClass(
    getReceiptRowStatus(rowIndex)
  );

  if (statusClass === null) {
    return;
  }

  $row.addClass(statusClass);
}

function getRenderedRowDatasetIndex(rowElement) {
  var index = null;

  $(rowElement)
    .find('input')
    .each(function () {
      var candidate = getSelectControlIndex(this);

      if (index === null && candidate !== null) {
        index = candidate;
      }
    });

  return index;
}

function getSelectControlIndex(element) {
  var controlId = getSelectControlId(element);
  var match;

  if (controlId === null) {
    return null;
  }

  match = new RegExp(
    '^' + RECEIPT_STATUS_SELECT_PREFIX + '(\\d+)$'
  ).exec(controlId);

  if (!match) {
    return null;
  }

  return parseInt(match[1], 10);
}

function getSelectControlId(element) {
  var attributeId;
  var propertyId;

  if (!element) {
    return null;
  }

  attributeId = element.getAttribute
    ? element.getAttribute('id')
    : null;

  if (hasSelectControlPrefix(attributeId)) {
    return String(attributeId);
  }

  propertyId = element.id;

  if (hasSelectControlPrefix(propertyId)) {
    return String(propertyId);
  }

  return null;
}

function hasSelectControlPrefix(value) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).indexOf(RECEIPT_STATUS_SELECT_PREFIX) === 0
  );
}

function getReceiptRowStatus(rowIndex) {
    console.log("rowIndex:",rowIndex);
    console.log("RECEIPT_STATUS_STORAGE_PREFIX:",RECEIPT_STATUS_STORAGE_PREFIX);
    console.log("Storage.get(RECEIPT_STATUS_STORAGE_PREFIX + rowIndex):",Storage.get(RECEIPT_STATUS_STORAGE_PREFIX + rowIndex));
  return normalizeReceiptRowStatus(
    Storage.get(RECEIPT_STATUS_STORAGE_PREFIX + rowIndex)
  );
}

function normalizeReceiptRowStatus(status) {
  return String(status === null || status === undefined ? '' : status)
    .replace(/\s+/g, '')
    .toUpperCase();
}

function getReceiptRowStatusClass(status) {
  if (
    !Object.prototype.hasOwnProperty.call(
      RECEIPT_STATUS_CLASS_BY_STATUS,
      status
    )
  ) {
    return null;
  }

  return RECEIPT_STATUS_CLASS_BY_STATUS[status];
}

var RECEIPT_ROW_SELECTOR = '#tableOutput tbody tr';
var RECEIPT_ROW_READY_CLASS = 'receipt-row-ready';
var RECEIPT_ROW_OTHER_CLASS = 'receipt-row-other';

var RECEIPT_ROW_SELECT_PREFIX = 'Select_';
var RECEIPT_ROW_STATUS_PREFIX = 'RECEIPTBATCH_STATUS_';

function applyReceiptRowClasses() {
  $(RECEIPT_ROW_SELECTOR).each(function () {
    applyReceiptRowClass(this);
  });
}

function applyReceiptRowClass(rowElement) {
  var $row = $(rowElement);
  var rowIndex = getReceiptRowDatasetIndex(rowElement);
  var status;

  $row.removeClass(RECEIPT_ROW_READY_CLASS);
  $row.removeClass(RECEIPT_ROW_OTHER_CLASS);

  if (rowIndex === null) {
    return;
  }

  status = getReceiptRowStatusForIndex(rowIndex);

  if (status === '') {
    return;
  }

  $row.addClass(
    status === 'READY' ? RECEIPT_ROW_READY_CLASS : RECEIPT_ROW_OTHER_CLASS
  );
}

function getReceiptRowDatasetIndex(rowElement) {
  var index = null;

  $(rowElement)
    .find('input')
    .each(function () {
      var candidate = getReceiptRowSelectIndex(this);

      if (index === null && candidate !== null) {
        index = candidate;
      }
    });

  return index;
}

function getReceiptRowSelectIndex(element) {
  var controlId = getReceiptRowSelectControlId(element);
  var match;

  if (controlId === null) {
    return null;
  }

  match = new RegExp('^' + RECEIPT_ROW_SELECT_PREFIX + '(\\d+)$')
    .exec(controlId);

  if (!match) {
    return null;
  }

  return parseInt(match[1], 10);
}

function getReceiptRowSelectControlId(element) {
  var attributeId;
  var propertyId;

  if (!element) {
    return null;
  }

  attributeId = element.getAttribute
    ? element.getAttribute('id')
    : null;

  if (hasReceiptRowSelectPrefix(attributeId)) {
    return String(attributeId);
  }

  propertyId = element.id;

  if (hasReceiptRowSelectPrefix(propertyId)) {
    return String(propertyId);
  }

  return null;
}

function hasReceiptRowSelectPrefix(value) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).indexOf(RECEIPT_ROW_SELECT_PREFIX) === 0
  );
}

function getReceiptRowStatusForIndex(rowIndex) {
  return normalizeReceiptRowStatus(
    Storage.get(RECEIPT_ROW_STATUS_PREFIX + rowIndex)
  );
}

var SELECTED_RECEIPT_IDS_STORAGE_KEY = 'SELECTED_RECEIPT_IDS';

var SELECTED_RECEIPT_IDS_SNAPSHOT_STORAGE_KEY =
  'SELECTED_RECEIPT_IDS_SNAPSHOT';

var receiptsAttachmentsPageInitialized = false;

var receiptTableDrawnForCurrentLoad = false;

var receiptSelectionReloadPending = false;

var receiptSelectionSnapshotCaptured = false;

function markReceiptTableDrawn() {
  receiptTableDrawnForCurrentLoad = true;
}

function beginReceiptSelectionReload() {
  if (receiptSelectionSnapshotCaptured === true) {
    receiptSelectionReloadPending = true;

    return readSelectedReceiptIdsSnapshot();
  }

  receiptSelectionReloadPending = true;
  receiptSelectionSnapshotCaptured = true;

  return writeSelectedReceiptIdsSnapshot(readSelectedReceiptIds());
}

function beginIndependentReceiptSelectionReload() {
  releaseReceiptSelectionSnapshotCapture();

  return beginReceiptSelectionReload();
}

function releaseReceiptSelectionSnapshotCapture() {
  receiptSelectionSnapshotCaptured = false;
}

function writeSelectedReceiptIdsSnapshot(ids) {
  Storage.set(
    SELECTED_RECEIPT_IDS_SNAPSHOT_STORAGE_KEY,
    JSON.stringify(ids)
  );

  return ids;
}

function readSelectedReceiptIdsSnapshot() {
  return readReceiptIdArray(
    Storage.get(SELECTED_RECEIPT_IDS_SNAPSHOT_STORAGE_KEY)
  );
}

function hasSelectedReceiptIdsSnapshot() {
  var storedSnapshot = Storage.get(
    SELECTED_RECEIPT_IDS_SNAPSHOT_STORAGE_KEY
  );

  return storedSnapshot !== null && storedSnapshot !== undefined;
}

function clearSelectedReceiptIdsSnapshot() {
  receiptSelectionReloadPending = false;
  releaseReceiptSelectionSnapshotCapture();
  Storage.remove(SELECTED_RECEIPT_IDS_SNAPSHOT_STORAGE_KEY);
}

function isReceiptSelectionReloadPending() {
  return receiptSelectionReloadPending === true;
}

function onReceiptListFetchSucceeded() {
  if (
    isReceiptSelectionReloadPending() &&
    hasSelectedReceiptIdsSnapshot()
  ) {
    writeSelectedReceiptIds(readSelectedReceiptIdsSnapshot());
  }

  receiptSelectionReloadPending = false;

  // Remove the old table and checkbox values.
  $('#tableOutput').off('draw.receipts');
  Table.clear();
  Storage.deleteByPrefix('Select_');

  // Set checkbox values for the returned receipts only.
  reconcileSelectedReceiptIdsWithLoadedReceipts(true);

  // Build the table again.
  Table.populate();

  clearSelectedReceiptIdsSnapshot();
  bindReceiptTableDrawHandler();
}

function onReceiptListFetchFailed() {
  var hadPendingSelectionReload = isReceiptSelectionReloadPending();
  var hadReplacementSelection =
    hadPendingSelectionReload && hasSelectedReceiptIdsSnapshot();

  receiptSelectionReloadPending = false;

  if (hadReplacementSelection) {
    writeSelectedReceiptIds(readSelectedReceiptIdsSnapshot());
  }

  clearSelectedReceiptIdsSnapshot();
  applySelectedReceiptIdsToLoadedRows(readSelectedReceiptIds());
}

var RECEIPT_ROW_ID_STORAGE_PREFIX = 'RECEIPTBATCH_RECEIPT_ID_';

var RECEIPT_TABLE_SELECT_SELECTOR = 'input[id^="' + RECEIPT_ROW_SELECT_PREFIX + '"]';

function bindReceiptTableSelectionHandlers() {
  $(document)
    .off('change.receiptsSelection', RECEIPT_TABLE_SELECT_SELECTOR)
    .on(
      'change.receiptsSelection',
      RECEIPT_TABLE_SELECT_SELECTOR,
      onReceiptRowSelectChanged
    );
}

function onReceiptRowSelectChanged(event) {
  var target = event && event.target ? event.target : null;
  var rowIndex = getSelectControlIndex(target);

  if (rowIndex !== null && !isReceiptRowReady(rowIndex)) {
    persistReceiptRowSelection(rowIndex, false);
    clearRenderedReceiptRowSelection(rowIndex);
    syncSelectedReceiptIdsFromSelection();
    return;
  }

  if (rowIndex === null) {
    return;
  }

  persistReceiptRowSelection(rowIndex, !!(target && target.checked));

  if (isReceiptSelectionReloadPending()) {
    applyReceiptRowSelectionDuringPending(rowIndex, !!(target && target.checked));
    return;
  }

  syncSelectedReceiptIdsFromSelection();
}

function clearRenderedReceiptRowSelection(index) {
  $(RECEIPT_STATUS_ROW_SELECTOR).each(function () {
    var rowIndex = getRenderedRowDatasetIndex(this);

    if (rowIndex !== index) {
      return;
    }

    getReceiptRowSelectControls(this, rowIndex).each(function () {
      this.checked = false;
      setSelectCheckboxCheckedAttribute(this, false);
    });
  });

  getReceiptRowSelectControls(null, index).each(function () {
    this.checked = false;
    setSelectCheckboxCheckedAttribute(this, false);
  });
}

function persistReceiptRowSelection(index, isSelected) {
  Storage.set(
    RECEIPT_ROW_SELECT_KEY_PREFIX + index,
    isSelected ? RECEIPT_ROW_TRUE : RECEIPT_ROW_FALSE
  );
}

function resetSelectedReceiptIdsForDatasetLoad() {
  receiptTableDrawnForCurrentLoad = false;
  writeSelectedReceiptIds([]);
  clearPersistedReceiptRowSelections();
}

function clearPersistedReceiptRowSelections() {
  if (deletePersistedReceiptRowSelectionsByPrefix()) {
    clearRenderedReceiptRowSelections();
    return;
  }

  sweepPersistedReceiptRowSelections();
  clearRenderedReceiptRowSelections();
}

function deletePersistedReceiptRowSelectionsByPrefix() {
  if (typeof Storage.deleteByPrefix !== 'function') {
    return false;
  }

  Storage.deleteByPrefix(RECEIPT_ROW_SELECT_KEY_PREFIX);
  return true;
}

function sweepPersistedReceiptRowSelections() {
  var index = 0;
  var purgeLimit = getReceiptRowSelectionPurgeLimit();

  while (index < purgeLimit) {
    Storage.set(RECEIPT_ROW_SELECT_KEY_PREFIX + index, RECEIPT_ROW_FALSE);
    index++;
  }
}

function getReceiptRowSelectionPurgeLimit() {
  var loadedCount = getLoadedReceiptRowCount();
  var renderedCount = $(RECEIPT_STATUS_ROW_SELECTOR).length;

  if (loadedCount > renderedCount) {
    return loadedCount;
  }

  return renderedCount;
}

function clearRenderedReceiptRowSelections() {
  $(RECEIPT_STATUS_ROW_SELECTOR).each(function () {
    getReceiptRowSelectControls(
      this,
      getRenderedRowDatasetIndex(this)
    ).each(function () {
      this.checked = false;
      setSelectCheckboxCheckedAttribute(this, false);
    });
  });
}

function syncSelectedReceiptIdsFromSelection() {
  if (isReceiptSelectionReloadPending()) {
    return applyPendingSelectedReceiptIds();
  }

  if (!isReceiptDatasetResolved()) {
    return readSelectedReceiptIds();
  }

  return writeSelectedReceiptIds(collectSelectedReceiptIds());
}

function applyPendingSelectedReceiptIds() {
  return readSelectedReceiptIds();
}

function runReceiptSelectionPending(action) {
  if (typeof action !== 'function') {
    return false;
  }

  beginIndependentReceiptSelectionReload();

  action();

  return true;
}

function applyReceiptRowSelectionDuringPending(rowIndex, isSelected) {
  var receiptId = getReceiptIdForIndex(rowIndex);
  var ids = readReceiptIdArray(Storage.get(SELECTED_RECEIPT_IDS_STORAGE_KEY));
  var seen = {};
  var nextIds = [];
  var normalizedId = normalizeReceiptId(receiptId);

  if (!isSelectableReceiptId(receiptId)) {
    return ids;
  }

  ids.forEach(function (selectedId) {
    if (normalizeReceiptId(selectedId) === normalizedId) {
      return;
    }

    appendSelectedReceiptId(nextIds, seen, selectedId);
  });

  if (isSelected === true) {
    appendSelectedReceiptId(nextIds, seen, receiptId);
  }

  writeSelectedReceiptIds(nextIds);
  writeSelectedReceiptIdsSnapshot(nextIds);

  return nextIds;
}

function isReceiptDatasetResolved() {
  if (isReceiptSelectionReloadPending()) {
    return false;
  }

  if (receiptTableDrawnForCurrentLoad === true) {
    return true;
  }

  if (getLoadedReceiptRowCount() > 0) {
    return true;
  }

  return hasRenderedReceiptRowIdentity();
}

function hasRenderedReceiptRowIdentity() {
  var found = false;

  $(RECEIPT_STATUS_ROW_SELECTOR).each(function () {
    var rowIndex = getRenderedRowDatasetIndex(this);

    if (
      found ||
      rowIndex === null ||
      !isSelectableReceiptId(getReceiptIdForIndex(rowIndex))
    ) {
      return;
    }

    found = true;
  });

  return found;
}

function reconcileSelectedReceiptIdsWithLoadedReceipts(hasConfirmedDraw) {
  var selectedIds = readSelectedReceiptIds();
  var previousLength = selectedIds.length;
  var loadedCount = getLoadedReceiptRowCount();
  var datasetIsConfirmedEmpty = hasConfirmedDraw === true && loadedCount === 0;
  var reconciledIds;
  var changed;
  var index = 0;

  if (isReceiptSelectionReloadPending()) {
    return applySelectedReceiptIdsToLoadedRows(selectedIds);
  }

  if (hasConfirmedDraw !== true && loadedCount === 0) {
    return applySelectedReceiptIdsToLoadedRows(selectedIds);
  }

  if (datasetIsConfirmedEmpty) {
    clearPersistedReceiptRowSelections();
  }

  reconciledIds = collectReconciledSelectedReceiptIds(
    selectedIds,
    datasetIsConfirmedEmpty
  );
  changed = reconciledIds.length !== previousLength;

  if (!changed) {
    while (index < selectedIds.length) {
      if (String(selectedIds[index]) !== reconciledIds[index]) {
        changed = true;
        break;
      }

      index++;
    }
  }

  if (changed) {
    writeSelectedReceiptIds(reconciledIds);
  }

  return applySelectedReceiptIdsToLoadedRows(reconciledIds);
}

function readSelectedReceiptIds() {
  return readReceiptIdArray(
    Storage.get(SELECTED_RECEIPT_IDS_STORAGE_KEY)
  );
}

function readReceiptIdArray(storedIds) {
  var parsedIds;

  if (storedIds === null || storedIds === undefined) {
    return [];
  }

  if (Array.isArray(storedIds)) {
    return storedIds.slice();
  }

  try {
    parsedIds = JSON.parse(storedIds);
  } catch (ignoredMalformedSelection) {
    return [];
  }

  return Array.isArray(parsedIds) ? parsedIds.slice() : [];
}

function collectReconciledSelectedReceiptIds(
  selectedIds,
  datasetIsConfirmedEmpty
) {
  var wantedIds = {};
  var ids = [];
  var seen = {};
  var index = 0;
  var loadedCount = getLoadedReceiptRowCount();

  if (datasetIsConfirmedEmpty === true) {
    return ids;
  }

  selectedIds.forEach(function (receiptId) {
    if (isSelectableReceiptId(receiptId)) {
      wantedIds[normalizeReceiptId(receiptId)] = true;
    }
  });

  while (index < loadedCount) {
    if (
      isReceiptRowReady(index) &&
      wantedIds[normalizeReceiptId(getReceiptIdForIndex(index))] === true
    ) {
      appendSelectedReceiptId(ids, seen, getReceiptIdForIndex(index));
    }

    index++;
  }

  return ids;
}

function normalizeReceiptId(receiptId) {
  if (receiptId === null || receiptId === undefined) {
    return '';
  }

  return String(receiptId).trim();
}

function applySelectedReceiptIdsToLoadedRows(selectedIds) {
  var selectedById = {};
  var matchedById = {};
  var index = 0;
  var loadedCount = getLoadedReceiptRowCount();

  selectedIds.forEach(function (receiptId) {
    selectedById[normalizeReceiptId(receiptId)] = true;
  });

  while (index < loadedCount) {
    storeReceiptRowSelection(
      index,
      isReceiptRowReady(index) &&
      selectedById[normalizeReceiptId(getReceiptIdForIndex(index))] === true,
      matchedById,
      selectedById
    );

    index++;
  }

  applySelectedReceiptIdsToRenderedRows(selectedById, matchedById);

  return selectedIds;
}

function storeReceiptRowSelection(index, isSelected, matchedById, selectedById) {
  var receiptId = normalizeReceiptId(getReceiptIdForIndex(index));

  if (
    isSelected &&
    receiptId !== '' &&
    matchedById[receiptId] !== true &&
    selectedById[receiptId] === true
  ) {
    matchedById[receiptId] = true;
  }

  persistReceiptRowSelection(index, isSelected);
}

function applySelectedReceiptIdsToRenderedRows(selectedById, matchedById) {
  $(RECEIPT_STATUS_ROW_SELECTOR).each(function () {
    syncRenderedReceiptRowSelection(
      this,
      getRenderedRowDatasetIndex(this),
      selectedById,
      matchedById
    );
  });
}

function syncRenderedReceiptRowSelection(
  rowElement,
  rowIndex,
  selectedById,
  matchedById
) {
  var $controls;
  var receiptId;
  var isSelected;

  if (rowIndex === null || !isReceiptRowReady(rowIndex)) {
    return;
  }

  $controls = getReceiptRowSelectControls(rowElement, rowIndex);

  if (!$controls.length) {
    return;
  }

  receiptId = normalizeReceiptId(getReceiptIdForIndex(rowIndex));
  isSelected = selectedById[receiptId] === true;

  if (isSelected && matchedById[receiptId] !== true) {
    matchedById[receiptId] = true;
  }

  $controls.each(function () {
    applyReceiptRowSelectControlState(this, true, isSelected);
  });
}

function collectSelectedReceiptIds() {
  var ids = [];
  var seen = {};
  var index = 0;
  var loadedCount = getLoadedReceiptRowCount();
  var selectedIndexes = {};

  while (index < loadedCount) {
    if (isSelectableReceiptRowSelected(index)) {
      selectedIndexes[index] = true;
      appendSelectedReceiptId(ids, seen, getReceiptIdForIndex(index));
    }

    index++;
  }

  $(RECEIPT_STATUS_ROW_SELECTOR).each(function () {
    var rowIndex = getRenderedRowDatasetIndex(this);

    if (
      rowIndex === null ||
      selectedIndexes[rowIndex] ||
      !isReceiptRowReady(rowIndex) ||
      !receiptRowControlIsSelected(this, rowIndex)
    ) {
      return;
    }

    selectedIndexes[rowIndex] = true;

    appendSelectedReceiptId(ids, seen, getReceiptIdForIndex(rowIndex));
  });

  return ids;
}

function isSelectableReceiptRowSelected(index) {
  return isReceiptRowReady(index) && isReceiptRowSelectionStored(index);
}

function appendSelectedReceiptId(ids, seen, receiptId) {
  if (!isSelectableReceiptId(receiptId)) {
    return;
  }

  receiptId = String(receiptId).trim();

  if (seen[receiptId] === true) {
    return;
  }

  seen[receiptId] = true;
  ids.push(receiptId);
}

function isSelectableReceiptId(receiptId) {
  return !(
    receiptId === null ||
    receiptId === undefined ||
    String(receiptId).trim() === '' ||
    String(receiptId).trim().toLowerCase() === RECEIPT_ROW_FALSE
  );
}

function getReceiptIdForIndex(index) {
  return Storage.get(RECEIPT_ROW_ID_STORAGE_PREFIX + index);
}

function writeSelectedReceiptIds(ids) {
  Storage.set(SELECTED_RECEIPT_IDS_STORAGE_KEY, JSON.stringify(ids));

  return ids;
}

function onTableClick(row, col, rowCells) {
  console.log('onTableClick called for row:', row, 'col:', col, 'rowCells:', rowCells);
  Preview(row);
}

var RECEIPT_TABLE_CLICK_WRAPPED_FLAG = 'receiptTableClickWrapped';

function createReceiptTableClickHandler(generatedTableClick) {
  var wrappedTableClick = function (row, col, rowCells) {
    if (typeof generatedTableClick === 'function') {
      generatedTableClick(row, col, rowCells);
    }

    Preview(row);
  };

  wrappedTableClick[RECEIPT_TABLE_CLICK_WRAPPED_FLAG] = true;
  return wrappedTableClick;
}

function installReceiptTableClickWrapper() {
  var currentTableClick = typeof onTableClick === 'function'
    ? onTableClick
    : null;

  if (currentTableClick &&
    currentTableClick[RECEIPT_TABLE_CLICK_WRAPPED_FLAG] === true) {
    return currentTableClick;
  }

  onTableClick = createReceiptTableClickHandler(currentTableClick);
  return onTableClick;
}

installReceiptTableClickWrapper();

/*
*       Transactions
*/
function colorCreditRows() {
  $('#tableOutput tbody tr').each(function (index) {
    $(this).toggleClass(
      'credit-row',
      hasCreditReceipt(index)
    );
  });
}

var RECEIPT_GATE_CHECKBOX_PREFIX = 'Select_';

var RECEIPT_GATE_STATUS_PREFIX = 'RECEIPTBATCH_STATUS_';

var RECEIPT_ROW_READY_STATUS = 'READY';
var RECEIPT_ROW_NEW_STATUS = 'NEW';

var RECEIPT_ROW_SELECT_DISABLED_CLASS = 'receipt-select-disabled';

var RECEIPT_ROW_TRUE = 'true';
var RECEIPT_ROW_FALSE = 'false';

var RECEIPT_ROW_SELECT_KEY_PREFIX = 'Select_';

var RECEIPT_ROW_PENDING_CLASS = 'receipt-pending-value';

var RECEIPT_ROW_PENDING_LABEL = 'New receipt';
var RECEIPT_ROW_PENDING_HINT = 'Click Refresh to analyze';

var RECEIPT_ROW_PENDING_TEXT_STYLE = {
  color: '#8a8f98',
  'font-style': 'italic',
  'font-weight': '400',
  'font-size': '12px',
  'line-height': '1.2',
  'white-space': 'nowrap'
};

var RECEIPT_ROW_PENDING_ROW_STYLE = {
  'background-color': '#fbfcfd'
};

var RECEIPT_ROW_PENDING_ROW_STYLE_KEY = 'background-color';

var RECEIPT_ROW_PENDING_MARKER = 'receipt-pending-row';

var RECEIPT_ROW_PENDING_ATTR = 'data-receipt-pending';
var RECEIPT_ROW_PENDING_ATTR_VALUE = 'true';

var RECEIPT_ROW_CONTENT_SELECTOR = 'input, select, textarea, button, img, a, .status-wrap, .credit-icon';

// ----------------------------------------------------------------------------
// 1. Select_<datasetIndex> is USABLE on a READY row, and visibly refused elsewhere
// ----------------------------------------------------------------------------
function applyReceiptRowGate() {
  $(RECEIPT_STATUS_ROW_SELECTOR).each(function () {
    applyReceiptRowSelectGate(this);
  });
}

function applyReceiptRowSelectGate(rowElement) {
  var index = getRenderedRowDatasetIndex(rowElement);
  var $controls;

  if (index === null) {
    return;
  }

  $controls = getReceiptRowSelectControls(rowElement, index);

  if (!$controls.length) {
    return;
  }

  syncReceiptRowSelectControls($controls, isReceiptRowReady(index), index);
}

function getReceiptRowSelectControls(rowElement, index) {
  var $byId;

  if (index === null || index === undefined) {
    return $();
  }

  $byId = $('#' + RECEIPT_GATE_CHECKBOX_PREFIX + index);

  if ($byId.length) {
    return $byId;
  }

  return $(rowElement)
    .find('input')
    .filter(function () {
      return getSelectControlIndex(this) === index;
    });
}

function syncReceiptRowSelectControls($controls, isReady, index) {
  var isSelected = isReady && isReceiptRowSelectionStored(index);

  if (!isReady) {
    clearPersistedSelectValue(index);
  }

  $controls.each(function () {
    applyReceiptRowSelectControlState(this, isReady, isSelected);
    applyReceiptRowSelectLabelState(this, isReady);
  });
}

function applyReceiptRowSelectLabelState(element, isReady) {
  var controlId = getSelectControlId(element);
  var $label;

  if (controlId === null) {
    return;
  }

  $label = $('#tableOutput label[for="' + controlId + '"]');

  if (!$label.length) {
    return;
  }

  $label.toggleClass(RECEIPT_ROW_SELECT_DISABLED_CLASS, !isReady);
}

function applyReceiptRowSelectControlState(element, isReady, isSelected) {
  element.checked = isSelected;

  if (!isReady) {
    element.disabled = true;
    setSelectCheckboxCheckedAttribute(element, false);
    return;
  }

  element.disabled = false;
  setSelectCheckboxCheckedAttribute(element, isSelected);
}

function isReceiptRowSelectionStored(index) {
  return isSelectCheckboxValueTrue(
    Storage.get(RECEIPT_ROW_SELECT_KEY_PREFIX + index)
  );
}

function clearPersistedSelectValue(index) {
  var storedValue = Storage.get(RECEIPT_ROW_SELECT_KEY_PREFIX + index);

  if (
    storedValue === false ||
    storedValue === null ||
    storedValue === undefined ||
    String(storedValue).trim() === '' ||
    String(storedValue).trim().toLowerCase() === RECEIPT_ROW_FALSE
  ) {
    return;
  }

  Storage.set(RECEIPT_ROW_SELECT_KEY_PREFIX + index, RECEIPT_ROW_FALSE);

  syncSelectedReceiptIdsFromSelection();
}

function isSelectCheckboxValueTrue(value) {
  if (value === true) {
    return true;
  }

  if (value === false || value === null || value === undefined) {
    return false;
  }

  return String(value).trim().toLowerCase() === RECEIPT_ROW_TRUE;
}

function setSelectCheckboxCheckedAttribute(element, isChecked) {
  if (!element.setAttribute) {
    return;
  }

  if (isChecked) {
    element.setAttribute('checked', 'checked');
    return;
  }

  if (element.removeAttribute) {
    element.removeAttribute('checked');
  }
}

function isReceiptRowReady(rowIndex) {
  return getReceiptRowStatusForIndex(rowIndex) === RECEIPT_ROW_READY_STATUS;
}

// ----------------------------------------------------------------------------
// 2. A NEW row says so INSIDE its own empty cells
// ----------------------------------------------------------------------------
function renderExtractionPendingMessage() {
  $(RECEIPT_STATUS_ROW_SELECTOR).each(function () {
    var index = getRenderedRowDatasetIndex(this);

    clearExtractionPendingMessage(this);

    if (index === null) {
      return;
    }

    if (getReceiptRowStatusForIndex(index) !== RECEIPT_ROW_NEW_STATUS) {
      return;
    }

    applyExtractionPendingMessage(this);
  });
}

function removeExtractionPendingMessages() {
  $(RECEIPT_STATUS_ROW_SELECTOR).each(function () {
    clearExtractionPendingMessage(this);
  });
}

function clearExtractionPendingMessage(rowElement) {
  var $row = $(rowElement);

  $row.find('[' + RECEIPT_ROW_PENDING_ATTR + ']').remove();

  if ($row.hasClass(RECEIPT_ROW_PENDING_MARKER)) {
    $row.css(RECEIPT_ROW_PENDING_ROW_STYLE_KEY, '');
    $row.removeClass(RECEIPT_ROW_PENDING_MARKER);
  }
}

function applyExtractionPendingMessage(rowElement) {
  var $row = $(rowElement);
  var $cells = $row.find('td');
  var dataCellFrom = getReceiptRowDataCellStart(rowElement, $cells);
  var written = 0;

  if (dataCellFrom === null) {
    return;
  }

  if (hasPendingMessage($row)) {
    return;
  }

  $cells.each(function (position) {
    if (written >= 2 || position < dataCellFrom) {
      return;
    }

    if (!isPendingMessageCell($(this))) {
      return;
    }

    writePendingMessage(
      $(this),
      written === 0
        ? RECEIPT_ROW_PENDING_LABEL
        : RECEIPT_ROW_PENDING_HINT
    );

    written++;
  });

  if (written === 0) {
    return;
  }

  $row.addClass(RECEIPT_ROW_PENDING_MARKER);
  $row.css(RECEIPT_ROW_PENDING_ROW_STYLE);
}

function getReceiptRowDataCellStart(rowElement, $cells) {
  var index = getRenderedRowDatasetIndex(rowElement);
  var $controls;
  var position = null;

  if (index === null) {
    return null;
  }

  $controls = getReceiptRowSelectControls(rowElement, index);

  if (!$controls.length) {
    return null;
  }

  $controls.each(function () {
    var cell = getReceiptRowSelectCell($(this));

    if (!cell || position !== null) {
      return;
    }

    $cells.each(function (cellPosition) {
      if (this === cell) {
        position = cellPosition;
      }
    });
  });

  return position === null ? null : position + 1;
}

function getReceiptRowSelectCell($element) {
  var node = $element.parent();

  while (node && node.length) {
    if (node.get(0) === null || node.get(0) === undefined) {
      return null;
    }

    if (String(node.get(0).nodeName).toUpperCase() === 'TD') {
      return node.get(0);
    }

    node = node.parent();
  }

  return null;
}

function writePendingMessage($cell, message) {
  $('<span></span>')
    .addClass(RECEIPT_ROW_PENDING_CLASS)
    .attr(RECEIPT_ROW_PENDING_ATTR, RECEIPT_ROW_PENDING_ATTR_VALUE)
    .attr('title', message)
    .css(RECEIPT_ROW_PENDING_TEXT_STYLE)
    .text(message)
    .appendTo($cell);
}

function isPendingMessageCell($cell) {
  if ($cell.children().length) {
    return false;
  }

  return hasReceiptCellHtml($cell.html()) === false;
}

function hasReceiptCellHtml(html) {
  if (html === null || html === undefined) {
    return false;
  }

  return String(html).replace(/\s+/g, '') !== '';
}

function hasPendingMessage($row) {
  return $row.find('[' + RECEIPT_ROW_PENDING_ATTR + ']').length > 0;
}

// ----------------------------------------------------------------------------
// 3. Adding an attachment is refused while a READY receipt is selected
// ----------------------------------------------------------------------------
function hasSelectedReadyReceipt() {
  if (hasSelectedReadyReceiptInStorage()) {
    return true;
  }

  if (hasSelectedReadyReceiptRow()) {
    return true;
  }

  return hasRenderedSelectedReadyControl();
}

function getLoadedReceiptRowCount() {
  var loadedIds = readLoadedReceiptIdArray();
  var storedCount;

  if (loadedIds.length) {
    return loadedIds.length;
  }

  storedCount = countIndexedReceiptRows();

  if (storedCount > 0) {
    return storedCount;
  }

  return 0;
}

function countIndexedReceiptRows() {
  var nextIndex = 0;
  var contiguousCount = 0;
  var lastIndexedCount = 0;
  var maxIndexScan = getIndexedReceiptRowScanLimit();

  while (nextIndex < maxIndexScan) {
    if (!hasIndexedReceiptRow(nextIndex)) {
      break;
    }

    nextIndex++;
  }

  contiguousCount = nextIndex;

  if (contiguousCount > 0) {
    return contiguousCount;
  }

  while (lastIndexedCount < maxIndexScan) {
    if (!hasIndexedReceiptRow(lastIndexedCount)) {
      return lastIndexedCount;
    }

    lastIndexedCount++;
  }

  return lastIndexedCount;
}

function getIndexedReceiptRowScanLimit() {
  return Math.max(
    $(RECEIPT_STATUS_ROW_SELECTOR).length,
    getHighestRenderedRowIndex() + 1
  );
}

function getHighestRenderedRowIndex() {
  var highestIndex = -1;

  $(RECEIPT_STATUS_ROW_SELECTOR).each(function () {
    var rowIndex = getRenderedRowDatasetIndex(this);

    if (rowIndex !== null && rowIndex > highestIndex) {
      highestIndex = rowIndex;
    }
  });

  return highestIndex;
}

function hasIndexedReceiptRow(index) {
  var receiptId = Storage.get(RECEIPT_ROW_ID_STORAGE_PREFIX + index);

  if (isSelectableReceiptId(receiptId)) {
    return true;
  }

  var status = Storage.get(RECEIPT_GATE_STATUS_PREFIX + index);

  return status !== null && status !== undefined && String(status).trim() !== '';
}

function readLoadedReceiptIdArray() {
  var loadedIds;

  if (typeof Storage.getArray !== 'function') {
    return [];
  }

  loadedIds = Storage.getArray('RECEIPTBATCH_RECEIPT_ID');

  return loadedIds && typeof loadedIds.length === 'number'
    ? loadedIds
    : [];
}

function hasSelectedReadyReceiptInStorage() {
  var loadedCount = getLoadedReceiptRowCount();
  var index = 0;

  while (index < loadedCount) {
    if (
      isReceiptRowReady(index) &&
      isReceiptRowSelectionStored(index)
    ) {
      return true;
    }

    index++;
  }

  return false;
}

function hasSelectedReadyReceiptRow() {
  var found = false;

  $(RECEIPT_STATUS_ROW_SELECTOR).each(function () {
    if (found) {
      return;
    }

    if (receiptRowHasSelectedReadyControl(this)) {
      found = true;
    }
  });

  return found;
}

function receiptRowHasSelectedReadyControl(rowElement) {
  var index = getRenderedRowDatasetIndex(rowElement);

  if (index === null || !isReceiptRowReady(index)) {
    return false;
  }

  return receiptRowControlIsSelected(rowElement, index);
}

function receiptRowControlIsSelected(rowElement, index) {
  var selected = false;

  getReceiptRowSelectControls(rowElement, index).each(function () {
    if (this.checked === true) {
      selected = true;
    }
  });

  return selected;
}


function hasRenderedSelectedReadyControl() {
  var found = false;

  $('#tableOutput input').each(function () {
    var element = this;
    var rowIndex;

    if (found || element.checked !== true) {
      return;
    }

    rowIndex = getSelectControlIndex(element);

    if (rowIndex === null) {
      found = true;
      return;
    }

    if (
      isReceiptRowReady(rowIndex) ||
      getRenderedRowDatasetIndex($(element).closest('tr').get(0)) === null
    ) {
      found = true;
    }
  });

  return found;
}

function hasReceiptCellText(value) {
  return !(
    value === null ||
    value === undefined ||
    String(value).replace(/\s+/g, '') === ''
  );
}



function onButtonClick_New_Report() {
  var selectedIds = readSelectedReceiptIds();

  if (selectedIds.length === 0) {
    Popup.ok('New Report', 'Please select receipts for the new report');
    return;
  }

  Storage.set('NEW_AI_REPORT', 'true');
  Services.killSession();
  Services.startSession();
  Services.call("iExpense_login_with_resps", function(){
      Page.navigate('Report_General');
  });
}
