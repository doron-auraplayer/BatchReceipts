/*
 * Receipt Cards page script.
 *
 * Every helper lives inside this closure. The only page function exposed to
 * AuraPlayer is receiptCardsPocOnLoad at the bottom of the file. The namespace
 * and root identifiers are kept for the existing page action binding.
 */
var ReceiptCardsPoc = (function () {
  'use strict';

  var SERVICE_NAME = 'ReceiptBatch_get_by_userAndStatuses';

  var STATUSES = 'NEW,PROCESSING,PROCESSED,READY,ANALYZED_FAILED,AI_FAILED';

  var STATUS_FILTERS = [
    'ALL',
    'NEW',
    'PROCESSING',
    'PROCESSED',
    'READY',
    'ANALYZED_FAILED',
    'AI_FAILED',
    'LINE_FAILED'
  ];

  var STATUS_DEFINITIONS = {
    NEW: { label: 'New', tone: 'new', pending: true, failed: false, analyzed: false },
    PROCESSING: { label: 'Processing', tone: 'processing', pending: true, failed: false, analyzed: false },
    PROCESSED: { label: 'Analyzed', tone: 'processed', pending: false, failed: false, analyzed: true },
    READY: { label: 'Ready', tone: 'ready', pending: false, failed: false, analyzed: true },
    ANALYZED_FAILED: { label: 'Analyze failed', tone: 'failed', pending: false, failed: true, analyzed: false },
    AI_FAILED: { label: 'AI failed', tone: 'failed', pending: false, failed: true, analyzed: false },
    LINE_FAILED: { label: 'Line failed', tone: 'failed', pending: false, failed: true, analyzed: true }
  };

  var THUMBNAIL_BATCH_SIZE = 12;

  var MONTH_LABELS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Service success callbacks may return rows as objects with the same
  // RECEIPTBATCH_* names that the shared loader writes to Storage.
  var RETURNED_FIELD_NAMES = {
    RECEIPTBATCH_RECEIPT_ID: 'id',
    RECEIPTBATCH_STATUS: 'status',
    RECEIPTBATCH_FILE_NAME: 'fileName',
    RECEIPTBATCH_FILE_TYPE: 'fileType',
    RECEIPTBATCH_EXPENSE_TYPE: 'expenseType',
    RECEIPTBATCH_TOTAL_AMOUNT: 'totalAmount',
    RECEIPTBATCH_RECEIPT_DATE: 'receiptDate',
    RECEIPTBATCH_MERCHANT: 'merchant',
    RECEIPTBATCH_LOCATION: 'location',
    RECEIPTBATCH_DEPARTMENT: 'department',
    RECEIPTBATCH_PAYMENT_TYPE: 'paymentType',
    RECEIPTBATCH_CREDIT: 'credit',
    RECEIPTBATCH_CREDIT_TRANSACTION: 'creditTransaction',
    RECEIPTBATCH_DOCUMENT_URL: 'documentUrl'
  };

  var IMAGE_EXTENSIONS = {
    jpg: true,
    jpeg: true,
    png: true,
    gif: true,
    webp: true,
    bmp: true,
    svg: true
  };

  var SUPPORTED_UPLOAD_EXTENSIONS = {
    pdf: true,
    png: true,
    jpg: true,
    jpeg: true,
    heic: true,
    heif: true
  };

  var UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.heic,.heif';

  var UPLOAD_SPINNER_KEY = 'RCPOC_UPLOAD_RECEIPTS';
  var ANALYZE_SPINNER_KEY = 'RCPOC_ANALYZE_RECEIPTS';

  var UPLOAD_UNSAFE_CHARS = /[()<>:"\/\\|?*\x00-\x1F]/g;

  var HEIC_DECODER_URL =
    'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
  var HEIC_DECODER_LOAD_TIMEOUT_MS = 15000;
  var HEIC_PREVIEW_PENDING_TEXT = 'Preparing HEIC preview\u2026';
  var HEIC_PREVIEW_FAILURE_TEXT =
    'HEIC preview unavailable. Open or download the original file, or retry the preview.';

  var state = {
    generation: 0,
    mode: 'needlogin',
    records: [],
    visibleCount: THUMBNAIL_BATCH_SIZE,
    search: '',
    statusFilter: 'ALL',
    loading: false,
    error: '',
    hydrating: false,
    hydrateAgain: false,
    activeDialogKey: '',
    lastFocus: null,
    uploading: false,
    uploadToken: 0,
    uploadRestore: null
  };

  var rootNode = null;
  var $rootNode = null;
  var dialogNode = null;
  var documentRequestInFlight = false;
  var localHeicDecoderPromise = null;
  var heicDecodeQueue = Promise.resolve();

  // -------------------------------------------------------------------------
  // Small environment helpers
  // -------------------------------------------------------------------------

  function documentObject() {
    return typeof document !== 'undefined' ? document : null;
  }

  function windowObject() {
    return typeof window !== 'undefined' ? window : null;
  }

  function jqueryObject() {
    if (typeof $ !== 'undefined' && $) {
      return $;
    }

    var browserWindow = windowObject();

    if (browserWindow && browserWindow.jQuery) {
      return browserWindow.jQuery;
    }

    return null;
  }

  function storageObject() {
    var browserWindow = windowObject();

    if (browserWindow && browserWindow.Storage) {
      return browserWindow.Storage;
    }

    if (typeof Storage !== 'undefined' && Storage) {
      return Storage;
    }

    return null;
  }

  function servicesObject() {
    var browserWindow = windowObject();

    if (browserWindow && browserWindow.Services) {
      return browserWindow.Services;
    }

    if (typeof Services !== 'undefined' && Services) {
      return Services;
    }

    return null;
  }

  function urlObject() {
    var browserWindow = windowObject();

    if (browserWindow && browserWindow.URL) {
      return browserWindow.URL;
    }

    if (typeof URL !== 'undefined' && URL) {
      return URL;
    }

    return null;
  }

  function spinnerObject() {
    var browserWindow = windowObject();

    if (browserWindow && browserWindow.Spinner) {
      return browserWindow.Spinner;
    }

    if (typeof Spinner !== 'undefined' && Spinner) {
      return Spinner;
    }

    return null;
  }

  function fileReaderObject() {
    var browserWindow = windowObject();

    if (browserWindow && browserWindow.FileReader) {
      return browserWindow.FileReader;
    }

    if (typeof FileReader !== 'undefined' && FileReader) {
      return FileReader;
    }

    return null;
  }

  function spinnerStart(text, key) {
    var spinner = spinnerObject();

    if (spinner && typeof spinner.start === 'function') {
      try {
        spinner.start(text, key);
      } catch (ignoredSpinnerError) {
        // A display-only spinner must never break an upload.
      }
    }
  }

  function spinnerStop(key) {
    var spinner = spinnerObject();

    if (spinner && typeof spinner.stop === 'function') {
      try {
        spinner.stop(key);
      } catch (ignoredSpinnerError) {
        // A display-only spinner must never break an upload.
      }
    }
  }

  function storageGet(key) {
    var storage = storageObject();

    if (!storage || typeof storage.get !== 'function') {
      return '';
    }

    return storage.get(key);
  }

  function storageSet(key, value) {
    var storage = storageObject();

    if (storage && typeof storage.set === 'function') {
      storage.set(key, value);
    }
  }

  function storageRemove(key) {
    var storage = storageObject();

    if (!storage) {
      return;
    }

    if (typeof storage.remove === 'function') {
      storage.remove(key);
      return;
    }

    if (typeof storage.clear === 'function') {
      storage.clear(key);
    }
  }

  function toText(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).replace(/^\s+|\s+$/g, '');
  }

  function truncate(value, maximum) {
    var text = toText(value);

    if (text.length <= maximum) {
      return text;
    }

    return text.substring(0, maximum - 1) + '\u2026';
  }

  function formatError(error) {
    var text;

    if (error === null || error === undefined) {
      return 'Unknown service error';
    }

    if (typeof error === 'string') {
      return truncate(error, 240);
    }

    if (error.message) {
      return truncate(error.message, 240);
    }

    try {
      text = JSON.stringify(error);
    } catch (ignoredError) {
      text = '';
    }

    return truncate(text, 240) || 'Unknown service error';
  }

  // -------------------------------------------------------------------------
  // DOM helpers. Text always goes through textContent; no data is treated as
  // HTML anywhere in this page.
  // -------------------------------------------------------------------------

  function createElement(tagName, className, text) {
    var doc = documentObject();
    var node;

    if (!doc) {
      return null;
    }

    node = doc.createElement(tagName);

    if (className) {
      node.className = className;
    }

    if (text !== null && text !== undefined) {
      node.textContent = String(text);
    }

    return node;
  }

  function appendChildren(parent) {
    var index;

    if (!parent) {
      return parent;
    }

    for (index = 1; index < arguments.length; index++) {
      if (arguments[index]) {
        parent.appendChild(arguments[index]);
      }
    }

    return parent;
  }

  function clearNode(node) {
    if (!node) {
      return node;
    }

    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }

    return node;
  }

  function setAttribute(node, name, value) {
    if (node && value !== null && value !== undefined) {
      node.setAttribute(name, String(value));
    }

    return node;
  }

  function findDescendant(node, className) {
    var doc = documentObject();
    var matches;

    if (!node || !doc) {
      return null;
    }

    if (node.getElementsByClassName) {
      matches = node.getElementsByClassName(className);
      return matches && matches.length ? matches[0] : null;
    }

    if (node.querySelector) {
      return node.querySelector('.' + className);
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Status and field display helpers
  // -------------------------------------------------------------------------

  function normalizeStatus(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function statusMeta(status) {
    var key = normalizeStatus(status);
    var definition = STATUS_DEFINITIONS[key];

    if (!definition) {
      return {
        key: key || 'UNKNOWN',
        label: key ? key.replace(/_/g, ' ') : 'Unknown',
        tone: 'unknown',
        pending: false,
        failed: false,
        analyzed: false
      };
    }

    return {
      key: key,
      label: definition.label,
      tone: definition.tone,
      pending: definition.pending,
      failed: definition.failed,
      analyzed: definition.analyzed
    };
  }

  function formatDateDisplay(value) {
    var text = toText(value);
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    var monthIndex;
    var monthName;

    if (!match) {
      match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(text);

      if (!match) {
        return text;
      }

      monthName = match[2].toLowerCase();

      for (monthIndex = 0; monthIndex < MONTH_LABELS.length; monthIndex++) {
        if (MONTH_LABELS[monthIndex].toLowerCase() === monthName) {
          return MONTH_LABELS[monthIndex] + ' ' + String(parseInt(match[1], 10)) + ', ' + match[3];
        }
      }

      return text;
    }

    monthIndex = parseInt(match[2], 10) - 1;

    if (monthIndex < 0 || monthIndex > 11) {
      return text;
    }

    return MONTH_LABELS[monthIndex] + ' ' + String(parseInt(match[3], 10)) + ', ' + match[1];
  }

  function displayField(record, field) {
    var meta = statusMeta(record ? record.status : '');
    var raw;

    if (!record) {
      return { text: 'Not available', pending: true };
    }

    if (!meta.analyzed) {
      if (meta.pending) {
        return { text: 'Pending analysis', pending: true };
      }

      if (meta.failed) {
        return { text: 'Not analyzed', pending: true };
      }

      return { text: 'Not available', pending: true };
    }

    if (field === 'receiptDate') {
      raw = toText(record.receiptDate);
      return { text: raw === '' ? 'Not provided' : formatDateDisplay(raw), pending: false };
    }

    raw = toText(record[field]);

    if (raw === '') {
      return { text: 'Not provided', pending: false };
    }

    return { text: raw, pending: false };
  }

  function displayPayment(record) {
    var meta = statusMeta(record ? record.status : '');
    var paymentType;
    var credit;

    if (!record) {
      return { text: 'Not available', pending: true };
    }

    if (!meta.analyzed) {
      if (meta.pending) {
        return { text: 'Payment pending', pending: true };
      }

      if (meta.failed) {
        return { text: 'Payment unavailable', pending: true };
      }

      return { text: 'Not available', pending: true };
    }

    paymentType = toText(record.paymentType);

    if (paymentType !== '') {
      return { text: paymentType, pending: false };
    }

    credit = toText(record.credit);

    if (credit !== '') {
      return { text: 'Credit card', pending: false };
    }

    return { text: 'Not provided', pending: false };
  }

  function recordSearchText(record) {
    return [
      record.merchant,
      record.expenseType,
      record.receiptDate,
      formatDateDisplay(record.receiptDate),
      record.location,
      record.department,
      record.fileName
    ].join(' ').toLowerCase();
  }

  function filterRecords(records, search, statusFilter) {
    var term = toText(search).toLowerCase();
    var wantedStatus = normalizeStatus(statusFilter);
    var list = records || [];

    return list.filter(function (record) {
      if (wantedStatus && wantedStatus !== 'ALL' && normalizeStatus(record.status) !== wantedStatus) {
        return false;
      }

      if (term !== '' && recordSearchText(record).indexOf(term) === -1) {
        return false;
      }

      return true;
    });
  }

  // -------------------------------------------------------------------------
  // URL validation. Real data may only point at an HTTP(S) URL, a path below
  // /ServiceManager, or a blob URL.
  // -------------------------------------------------------------------------

  function sanitizeUrl(value) {
    var raw = toText(value);
    var cleaned;
    var lower;
    var decoded;

    if (raw === '') {
      return { safe: false, url: '', reason: 'No document URL was returned.' };
    }

    if (/[\u0000-\u001f\u007f]/.test(raw)) {
      return { safe: false, url: '', reason: 'The document URL contains control characters.' };
    }

    cleaned = raw.replace(/^\s+|\s+$/g, '');

    if (cleaned === '') {
      return { safe: false, url: '', reason: 'No document URL was returned.' };
    }

    lower = cleaned.toLowerCase();

    if (
      lower.indexOf('javascript:') === 0 ||
      lower.indexOf('vbscript:') === 0 ||
      lower.indexOf('data:text/html') === 0 ||
      lower.indexOf('data:application/xhtml') === 0
    ) {
      return { safe: false, url: '', reason: 'The document URL uses a blocked scheme.' };
    }

    try {
      decoded = decodeURIComponent(cleaned).toLowerCase();
    } catch (ignoredEncodingError) {
      decoded = '';
    }

    if (
      decoded.indexOf('javascript:') === 0 ||
      decoded.indexOf('vbscript:') === 0 ||
      decoded.indexOf('data:text/html') === 0
    ) {
      return { safe: false, url: '', reason: 'The document URL uses a blocked scheme.' };
    }

    if (lower.indexOf('data:') === 0) {
      return { safe: false, url: '', reason: 'Data URLs are not allowed for receipts.' };
    }

    if (lower.indexOf('blob:') === 0) {
      if (/^blob:[a-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+$/i.test(cleaned)) {
        return { safe: true, url: cleaned, reason: '' };
      }

      return { safe: false, url: '', reason: 'The blob URL is not valid.' };
    }

    if (/^https?:\/\//i.test(cleaned)) {
      if (!/^https?:\/\/[^\s\/]+/i.test(cleaned)) {
        return { safe: false, url: '', reason: 'The HTTP URL is not valid.' };
      }

      return { safe: true, url: cleaned, reason: '' };
    }

    if (cleaned.indexOf('//') === 0) {
      return { safe: false, url: '', reason: 'Protocol-relative URLs are not allowed.' };
    }

    if (/^\/ServiceManager(?:\/|$)/i.test(cleaned)) {
      return { safe: true, url: cleaned, reason: '' };
    }

    if (/^\.\/ServiceManager(?:\/|$)/i.test(cleaned)) {
      return { safe: true, url: cleaned, reason: '' };
    }

    if (/^ServiceManager(?:\/|$)/i.test(cleaned)) {
      return { safe: true, url: cleaned, reason: '' };
    }

    return { safe: false, url: '', reason: 'The document URL is not allowed.' };
  }

  // -------------------------------------------------------------------------
  // File type helpers
  // -------------------------------------------------------------------------

  function fileExtension(record) {
    var fileType = toText(record ? record.fileType : '').toLowerCase();
    var fileName = toText(record ? record.fileName : '');
    var url = toText(record ? record.documentUrl : '');
    var match;

    fileType = fileType.replace(/;.*$/, '');

    if (fileType.indexOf('/') !== -1) {
      fileType = fileType.substring(fileType.lastIndexOf('/') + 1);
    }

    fileType = fileType
      .replace(/^\./, '')
      .replace(/\+xml$/, '')
      .replace(/-(?:sequence|multi-image)$/, '');

    if (fileType === 'heic' || fileType === 'heif') {
      return fileType;
    }

    // A server-provided MIME value can be generic (for example image/jpeg)
    // while the original file name still identifies an iPhone HEIC/HEIF file.
    match = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(fileName);

    if (match && (match[1].toLowerCase() === 'heic' || match[1].toLowerCase() === 'heif')) {
      return match[1].toLowerCase();
    }

    if (fileType !== '') {
      return fileType;
    }

    if (match) {
      return match[1].toLowerCase();
    }

    match = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(url);

    if (match) {
      return match[1].toLowerCase();
    }

    return '';
  }

  function documentKind(record) {
    var extension = fileExtension(record);

    if (extension === 'pdf') {
      return 'pdf';
    }

    if (extension === 'heic' || extension === 'heif') {
      return 'heic';
    }

    if (IMAGE_EXTENSIONS[extension] === true) {
      return 'image';
    }

    if (extension === '') {
      return 'image';
    }

    return 'unsupported';
  }

  function documentNote(record) {
    var kind;
    var preview;

    if (!record) {
      return 'Preview unavailable';
    }

    if (record.documentState === 'loading') {
      return 'Loading preview\u2026';
    }

    if (record.documentState === 'error') {
      return 'Preview unavailable';
    }

    kind = documentKind(record);

    if (kind === 'pdf') {
      return 'PDF document';
    }

    if (kind === 'heic') {
      preview = heicPreviewFor(record);

      if (preview.state === 'pending') {
        return HEIC_PREVIEW_PENDING_TEXT;
      }

      if (preview.state === 'failed') {
        return 'HEIC preview unavailable';
      }

      return 'HEIC image';
    }

    if (kind === 'unsupported') {
      return 'Document attachment';
    }

    if (record.documentState === 'ready') {
      return 'Receipt image';
    }

    return 'Preview loads on open';
  }

  // -------------------------------------------------------------------------
  // HEIC/HEIF previews. The original document URL is never replaced; a
  // browser-decoded JPEG object URL is kept separately on the record so the
  // gallery card and the preview dialog share one conversion.
  // -------------------------------------------------------------------------

  function isHeicRecord(record) {
    return documentKind(record) === 'heic';
  }

  function heicPreviewFor(record) {
    if (!record.heicPreview) {
      record.heicPreview = {
        state: 'idle',
        objectUrl: '',
        promise: null,
        error: '',
        requestId: 0
      };
    }

    return record.heicPreview;
  }

  function revokeObjectUrl(objectUrl) {
    var urls = urlObject();

    if (!objectUrl || !urls || typeof urls.revokeObjectURL !== 'function') {
      return;
    }

    try {
      urls.revokeObjectURL(objectUrl);
    } catch (ignoredRevokeError) {
      // Releasing a preview URL must never break closing or refreshing.
    }
  }

  function revokeHeicObjectUrl(preview) {
    var objectUrl = preview && preview.objectUrl;

    if (!objectUrl) {
      return;
    }

    preview.objectUrl = '';
    revokeObjectUrl(objectUrl);
  }

  function revokeAllHeicPreviews() {
    var records = state.records || [];
    var index;

    for (index = 0; index < records.length; index++) {
      if (records[index] && records[index].heicPreview) {
        revokeHeicObjectUrl(records[index].heicPreview);
      }
    }
  }

  function resetHeicPreview(record) {
    var preview = record ? record.heicPreview : null;

    if (!preview) {
      return;
    }

    revokeHeicObjectUrl(preview);
    preview.requestId = (preview.requestId || 0) + 1;
    preview.state = 'idle';
    preview.error = '';
    preview.promise = null;
  }

  function heicFailureMessage(error) {
    var detail = formatError(error);

    if (detail === '' || detail === 'Unknown service error') {
      return HEIC_PREVIEW_FAILURE_TEXT;
    }

    return HEIC_PREVIEW_FAILURE_TEXT + ' ' + detail;
  }

  function refreshHeicPreviewUi(record) {
    if (!record || !isCurrentRoot()) {
      return;
    }

    updateCardForRecord(record);

    if (state.activeDialogKey === record.key) {
      updateDialogMedia(record);
    }

    updateStatusLine();
  }

  function findSharedHeicLoader() {
    var browserWindow = windowObject();

    if (browserWindow && typeof browserWindow.loadHeicDecoder === 'function') {
      return browserWindow.loadHeicDecoder;
    }

    if (typeof loadHeicDecoder === 'function') {
      return loadHeicDecoder;
    }

    return null;
  }

  function localHeicDecoder() {
    var browserWindow = windowObject();

    if (browserWindow && browserWindow.heic2any) {
      return browserWindow.heic2any;
    }

    if (typeof heic2any !== 'undefined' && heic2any) {
      return heic2any;
    }

    return null;
  }

  function loadLocalHeicDecoder() {
    var existing = localHeicDecoder();
    var doc = documentObject();

    if (existing) {
      return Promise.resolve(existing);
    }

    if (localHeicDecoderPromise) {
      return localHeicDecoderPromise;
    }

    if (!doc) {
      return Promise.reject(new Error('The HEIC decoder could not be loaded.'));
    }

    localHeicDecoderPromise = new Promise(function (resolve, reject) {
      var script = doc.createElement('script');
      var settled = false;
      var timeoutId = null;

      function finish(error) {
        var decoder;

        if (settled) {
          return;
        }

        settled = true;

        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }

        if (error) {
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }

          reject(error);
          return;
        }

        decoder = localHeicDecoder();

        if (!decoder) {
          reject(new Error('The HEIC decoder did not initialize.'));
          return;
        }

        resolve(decoder);
      }

      script.onload = function () {
        finish(null);
      };
      script.onerror = function () {
        finish(new Error('The HEIC decoder could not be loaded.'));
      };
      script.src = HEIC_DECODER_URL;
      script.async = true;

      timeoutId = setTimeout(function () {
        finish(new Error('The HEIC decoder timed out.'));
      }, HEIC_DECODER_LOAD_TIMEOUT_MS);

      (doc.head || doc.body).appendChild(script);
    }).then(function (decoder) {
      localHeicDecoderPromise = null;
      return decoder;
    }, function (error) {
      localHeicDecoderPromise = null;
      throw error;
    });

    return localHeicDecoderPromise;
  }

  function requestHeicDecoder() {
    var sharedLoader = findSharedHeicLoader();

    if (sharedLoader) {
      try {
        return Promise.resolve(sharedLoader());
      } catch (sharedLoaderError) {
        return Promise.reject(sharedLoaderError);
      }
    }

    return loadLocalHeicDecoder();
  }

  function fetchHeicPreviewBlob(imageUrl) {
    var browserWindow = windowObject();
    var fetchFunction = browserWindow && typeof browserWindow.fetch === 'function'
      ? browserWindow.fetch
      : null;

    if (!fetchFunction && typeof fetch === 'function') {
      fetchFunction = fetch;
    }

    if (!fetchFunction) {
      return Promise.reject(new Error('The receipt image could not be downloaded.'));
    }

    return fetchFunction(imageUrl, {
      method: 'GET',
      credentials: 'same-origin'
    }).then(function (response) {
      if (!response || response.ok !== true) {
        throw new Error('The receipt image could not be downloaded.');
      }

      return response.blob();
    });
  }

  function getHeicDecodedBlob(result) {
    var index;

    if (Array.isArray(result)) {
      for (index = 0; index < result.length; index++) {
        if (result[index]) {
          return result[index];
        }
      }

      return null;
    }

    return result || null;
  }

  function convertHeicBlobToJpeg(converter, blob) {
    return Promise.resolve(converter({
      blob: blob,
      toType: 'image/jpeg',
      quality: 0.92
    }));
  }

  function enqueueHeicConversion(task) {
    var result = heicDecodeQueue.then(task, task);

    heicDecodeQueue = result.then(function () {
      return null;
    }, function () {
      return null;
    });

    return result;
  }

  function failHeicPreview(record, message) {
    var preview = heicPreviewFor(record);

    revokeHeicObjectUrl(preview);
    preview.requestId = (preview.requestId || 0) + 1;
    preview.state = 'failed';
    preview.error = message || HEIC_PREVIEW_FAILURE_TEXT;
    preview.promise = null;
    refreshHeicPreviewUi(record);
  }

  function startHeicConversion(record) {
    var preview;
    var generation;
    var requestId;
    var checked;
    var urls;

    if (!record) {
      return Promise.resolve(null);
    }

    preview = heicPreviewFor(record);

    if (preview.state === 'ready' || preview.state === 'native') {
      return Promise.resolve(preview);
    }

    if (preview.promise) {
      return preview.promise;
    }

    checked = sanitizeUrl(record.documentUrl);

    if (!checked.safe) {
      preview.state = 'failed';
      preview.error = checked.reason || HEIC_PREVIEW_FAILURE_TEXT;
      refreshHeicPreviewUi(record);
      return Promise.resolve(preview);
    }

    generation = state.generation;
    requestId = (preview.requestId || 0) + 1;
    preview.requestId = requestId;
    preview.state = 'pending';
    preview.error = '';
    refreshHeicPreviewUi(record);

    preview.promise = enqueueHeicConversion(function () {
      return requestHeicDecoder().then(function (converter) {
        if (preview.requestId !== requestId) {
          return null;
        }

        return fetchHeicPreviewBlob(checked.url).then(function (blob) {
          if (preview.requestId !== requestId) {
            return null;
          }

          return convertHeicBlobToJpeg(converter, blob);
        });
      });
    }).then(function (result) {
      var decodedBlob;
      var objectUrl;

      if (preview.requestId !== requestId) {
        return null;
      }

      decodedBlob = getHeicDecodedBlob(result);

      if (!decodedBlob) {
        throw new Error('The HEIC decoder returned no image.');
      }

      if (!isActiveGeneration(generation) || findRecordByKey(record.key) !== record) {
        return null;
      }

      urls = urlObject();

      if (!urls || typeof urls.createObjectURL !== 'function') {
        throw new Error('The HEIC preview could not be created.');
      }

      objectUrl = urls.createObjectURL(decodedBlob);

      if (
        preview.requestId !== requestId ||
        !isActiveGeneration(generation) ||
        findRecordByKey(record.key) !== record
      ) {
        revokeObjectUrl(objectUrl);
        return null;
      }

      revokeHeicObjectUrl(preview);
      preview.objectUrl = objectUrl;
      preview.state = 'ready';
      preview.error = '';
      preview.promise = null;
      refreshHeicPreviewUi(record);
      return preview;
    }).then(null, function (error) {
      if (preview.requestId !== requestId) {
        return null;
      }

      preview.promise = null;

      if (!isActiveGeneration(generation) || findRecordByKey(record.key) !== record) {
        return null;
      }

      preview.state = 'failed';
      preview.error = heicFailureMessage(error);
      refreshHeicPreviewUi(record);
      return null;
    });

    return preview.promise;
  }

  function retryHeicPreview(record) {
    if (!record) {
      return Promise.resolve(null);
    }

    resetHeicPreview(record);
    refreshHeicPreviewUi(record);
    return startHeicConversion(record);
  }

  function handleHeicPreviewImageError(record, derivedImage) {
    var preview = heicPreviewFor(record);

    if (preview.state === 'pending') {
      return;
    }

    if (derivedImage || preview.state === 'ready') {
      failHeicPreview(record, 'The converted HEIC preview could not be displayed.');
      return;
    }

    startHeicConversion(record);
  }

  function buildHeicImage(record, sourceUrl, derivedImage, className) {
    var image = createElement('img', className || 'rcpoc-receipt-image');

    setAttribute(image, 'alt', buildImageAlt(record));
    setAttribute(image, 'loading', 'lazy');
    setAttribute(image, 'decoding', 'async');
    image.onload = function () {
      var preview;

      if (derivedImage) {
        return;
      }

      preview = heicPreviewFor(record);

      if (preview.state === 'idle') {
        preview.state = 'native';
      }
    };
    image.onerror = function () {
      handleHeicPreviewImageError(record, derivedImage);
    };
    image.src = sourceUrl;
    return image;
  }

  function buildHeicMedia(record) {
    var media = createElement('span', 'rcpoc-media');
    var preview = heicPreviewFor(record);

    if (preview.state === 'pending') {
      appendChildren(
        media,
        createElement('span', 'rcpoc-media-loading', HEIC_PREVIEW_PENDING_TEXT)
      );
      return media;
    }

    if (preview.state === 'failed') {
      appendChildren(
        media,
        buildDocumentTile(
          record,
          'HEIC',
          preview.error || HEIC_PREVIEW_FAILURE_TEXT
        )
      );
      return media;
    }

    if (preview.state === 'ready' && preview.objectUrl !== '') {
      media.appendChild(buildHeicImage(record, preview.objectUrl, true));
      return media;
    }

    media.appendChild(buildHeicImage(record, record.documentUrl, false));
    return media;
  }

  // -------------------------------------------------------------------------
  // Page-local upload helpers. They use the same Storage payload contract as
  // the existing attachments page, but never call that page's globals.
  // -------------------------------------------------------------------------

  function uploadFileExtension(file) {
    var fileName = file && file.name ? String(file.name) : '';
    var matches = /\.([a-z0-9]+)$/i.exec(fileName);
    var mimeType = file && file.type ? String(file.type).toLowerCase() : '';

    if (matches) {
      return matches[1].toLowerCase();
    }

    mimeType = mimeType.replace(/;.*$/, '');

    if (mimeType === 'image/heic' || mimeType === 'image/heic-sequence') {
      return 'heic';
    }

    if (mimeType === 'image/heif' || mimeType === 'image/heif-sequence') {
      return 'heif';
    }

    if (mimeType === 'application/pdf') {
      return 'pdf';
    }

    if (mimeType === 'image/jpeg') {
      return 'jpg';
    }

    if (mimeType === 'image/png') {
      return 'png';
    }

    return '';
  }

  function isSupportedUploadFile(file) {
    return SUPPORTED_UPLOAD_EXTENSIONS[uploadFileExtension(file)] === true;
  }

  function makeUploadFilenameSafe(value) {
    return String(value || 'attachment')
      .replace(UPLOAD_UNSAFE_CHARS, '_')
      .replace(/ /g, '_')
      .trim();
  }

  function rawBase64(base64Value) {
    var marker = 'base64,';
    var markerIndex;

    if (!base64Value) {
      return '';
    }

    markerIndex = String(base64Value).indexOf(marker);

    if (markerIndex === -1) {
      return String(base64Value);
    }

    return String(base64Value).substring(markerIndex + marker.length);
  }

  function readFileAsDataUrl(file) {
    var Reader = fileReaderObject();

    return new Promise(function (resolve, reject) {
      var reader;

      if (!Reader) {
        reject(new Error('File reading is not available.'));
        return;
      }

      reader = new Reader();
      reader.onload = function (event) {
        var result = event && event.target ? event.target.result : reader.result;

        if (typeof result !== 'string' || result === '') {
          reject(new Error('The file could not be read.'));
          return;
        }

        resolve(result);
      };
      reader.onerror = function () {
        reject(new Error('The file could not be read.'));
      };

      try {
        reader.readAsDataURL(file);
      } catch (readError) {
        reject(readError);
      }
    });
  }

  function captureUploadStorage(storage) {
    return {
      blob: captureStorageValue(storage, 'blob'),
      fileName: captureStorageValue(storage, 'fileName'),
      fileType: captureStorageValue(storage, 'fileType'),
      EBS_USER: captureStorageValue(storage, 'EBS_USER'),
      P_STATUSES: captureStorageValue(storage, 'P_STATUSES')
    };
  }

  function restoreUploadStorage(storage, captured) {
    if (!captured) {
      return;
    }

    restoreStorageValue(storage, 'blob', captured.blob);
    restoreStorageValue(storage, 'fileName', captured.fileName);
    restoreStorageValue(storage, 'fileType', captured.fileType);
    restoreStorageValue(storage, 'EBS_USER', captured.EBS_USER);
    restoreStorageValue(storage, 'P_STATUSES', captured.P_STATUSES);
  }

  function restoreActiveUploadStorage() {
    var restore = state.uploadRestore;

    if (!restore) {
      return;
    }

    state.uploadRestore = null;
    restoreUploadStorage(restore.storage, restore.captured);
  }

  function setUploadStatus(text) {
    var wrapper = findDescendant(rootNode, 'rcpoc-upload-state');
    var status = findDescendant(rootNode, 'rcpoc-upload-status');
    var value = toText(text);

    if (status) {
      status.textContent = value;
    }

    if (wrapper && value !== '') {
      wrapper.hidden = false;
    }
  }

  function showUploadErrors(failures) {
    var wrapper = findDescendant(rootNode, 'rcpoc-upload-state');
    var container = findDescendant(rootNode, 'rcpoc-upload-errors');
    var list;
    var item;
    var index;

    if (!container) {
      return;
    }

    clearNode(container);

    if (!failures || failures.length === 0) {
      return;
    }

    list = createElement('ul', 'rcpoc-upload-error-list');

    for (index = 0; index < failures.length; index++) {
      item = createElement(
        'li',
        'rcpoc-upload-error-item',
        (failures[index].name || 'File') + ': ' + failures[index].message
      );
      list.appendChild(item);
    }

    container.appendChild(list);

    if (wrapper) {
      wrapper.hidden = false;
    }
  }

  function updateUploadProgress(current, total) {
    var progress = findDescendant(rootNode, 'rcpoc-upload-progress');

    if (!progress) {
      return;
    }

    progress.max = total;
    progress.value = current;
    progress.hidden = !(state.uploading && total > 0);
  }

  function setUploadBusy(busy) {
    var uploadButton = findDescendant(rootNode, 'rcpoc-upload');
    var refreshButton = findDescendant(rootNode, 'rcpoc-refresh');

    state.uploading = busy === true;

    if (uploadButton) {
      uploadButton.disabled = state.uploading;
      setAttribute(uploadButton, 'aria-disabled', state.uploading ? 'true' : 'false');
    }

    if (refreshButton) {
      refreshButton.disabled = state.uploading;
      setAttribute(refreshButton, 'aria-disabled', state.uploading ? 'true' : 'false');
    }

    renderHeaderState();
  }

  function clearUploadInput(input) {
    if (!input) {
      return;
    }

    try {
      input.value = '';
    } catch (ignoredInputError) {
      // A detached input is already clean.
    }
  }

  function uploadCountText(count) {
    return String(count) + (count === 1 ? ' receipt' : ' receipts');
  }

  function uploadSummary(uploaded, failures) {
    var text = 'Receipts saved (' + uploadCountText(uploaded) + ')';

    if (failures && failures.length > 0) {
      text += '; ' + String(failures.length) + ' file(s) failed';
    }

    return text;
  }

  function uploadOneFile(storage, services, user, file) {
    return readFileAsDataUrl(file).then(function (dataUrl) {
      var raw = rawBase64(dataUrl);
      var safeName = makeUploadFilenameSafe(file.name);
      var extension = uploadFileExtension(file);

      if (raw === '') {
        throw new Error('The file could not be read.');
      }

      if (!SUPPORTED_UPLOAD_EXTENSIONS[extension]) {
        throw new Error('Unsupported file type.');
      }

      storage.set('blob', raw);
      storage.set('fileName', safeName);
      storage.set('fileType', extension.toUpperCase());
      storage.set('EBS_USER', user);

      return new Promise(function (resolve, reject) {
        try {
          services.call(
            'js_ReceiptBatch_add_receipt',
            function () {
              resolve();
            },
            function (error) {
              reject(error || new Error('The receipt upload service reported a failure.'));
            }
          );
        } catch (serviceError) {
          reject(serviceError);
        }
      });
    });
  }

  function runUploadBatch(files, input, options) {
    var list = [];
    var valid = [];
    var failures = [];
    var storage = storageObject();
    var services = servicesObject();
    var user = readLoggedInUser();
    var generation = state.generation;
    var token;
    var captured;
    var uploaded = 0;
    var index = 0;
    var refresh = options && typeof options.refresh === 'function'
      ? options.refresh
      : refreshLive;
    var finished = false;
    var resolvePromise = null;
    var result = { uploaded: 0, failures: failures };
    var promise;

    try {
      list = files ? Array.prototype.slice.call(files) : [];
    } catch (ignoredFilesError) {
      list = [];
    }

    if (list.length === 0) {
      clearUploadInput(input);
      return Promise.resolve(result);
    }

    if (state.uploading) {
      clearUploadInput(input);
      return Promise.resolve(result);
    }

    for (index = 0; index < list.length; index++) {
      if (isSupportedUploadFile(list[index])) {
        valid.push(list[index]);
      } else {
        failures.push({
          name: list[index] && list[index].name ? list[index].name : 'Unnamed file',
          message: 'Unsupported file type. Use PDF, PNG, JPG, JPEG, HEIC, or HEIF.'
        });
      }
    }

    if (user === '') {
      setUploadStatus('Sign in before uploading receipts.');
      showUploadErrors(failures);
      clearUploadInput(input);
      return Promise.resolve(result);
    }

    if (!storage) {
      setUploadStatus('Receipt storage is not available.');
      showUploadErrors(failures);
      clearUploadInput(input);
      return Promise.resolve(result);
    }

    if (!services || typeof services.call !== 'function') {
      setUploadStatus('Receipt upload service is not available.');
      showUploadErrors(failures);
      clearUploadInput(input);
      return Promise.resolve(result);
    }

    if (valid.length === 0) {
      setUploadStatus('No supported files were selected.');
      showUploadErrors(failures);
      clearUploadInput(input);
      return Promise.resolve(result);
    }

    state.uploadToken++;
    token = state.uploadToken;
    generation = state.generation;
    captured = captureUploadStorage(storage);
    state.uploadRestore = {
      storage: storage,
      captured: captured,
      token: token
    };
    storage.set('EBS_USER', user);

    setUploadBusy(true);
    setUploadStatus('Uploading ' + String(valid.length) + ' receipt file(s)\u2026');
    showUploadErrors([]);
    updateUploadProgress(0, valid.length);
    spinnerStart('Uploading ' + String(valid.length) + ' receipt files', UPLOAD_SPINNER_KEY);

    promise = new Promise(function (resolve) {
      resolvePromise = resolve;
    });

    function isStale() {
      return token !== state.uploadToken || !isActiveGeneration(generation);
    }

    function finish(message, doRefresh) {
      var active;

      if (finished) {
        return;
      }

      finished = true;
      active = !isStale();

      if (active) {
        setUploadStatus(message);
        showUploadErrors(failures);
        setUploadBusy(false);
        updateUploadProgress(valid.length, valid.length);
      }

      if (state.uploadRestore && state.uploadRestore.token === token) {
        state.uploadRestore = null;
        restoreUploadStorage(storage, captured);
      }

      clearUploadInput(input);
      spinnerStop(UPLOAD_SPINNER_KEY);
      spinnerStop(ANALYZE_SPINNER_KEY);

      result.uploaded = uploaded;
      result.failures = failures;
      resolvePromise(result);

      if (active && doRefresh) {
        refresh();
      }
    }

    function uploadNext() {
      var file;

      if (finished) {
        return;
      }

      if (isStale()) {
        finish('Upload stopped because the page changed.', false);
        return;
      }

      if (index >= valid.length) {
        if (uploaded === 0) {
          finish(
            'No receipts were uploaded. '
              + String(failures.length)
              + ' file(s) failed.',
            false
          );
          return;
        }

        setUploadStatus(uploadSummary(uploaded, failures) + '. Starting analysis\u2026');
        storage.set('P_STATUSES', 'NEW');
        storage.set('EBS_USER', user);
        spinnerStart('Starting receipt analysis', ANALYZE_SPINNER_KEY);

        try {
          services.call(
            'Ping_ReceiptBatch_AnalyzeRPA',
            function () {
              if (finished) {
                return;
              }

              if (isStale()) {
                finish(uploadSummary(uploaded, failures) + '.', false);
                return;
              }

              finish(
                uploadSummary(uploaded, failures) + '. Analysis started. Refreshing\u2026',
                true
              );
            },
            function (analysisError) {
              var detail;

              if (finished) {
                return;
              }

              detail = formatError(analysisError);

              if (isStale()) {
                finish(uploadSummary(uploaded, failures) + '.', false);
                return;
              }

              finish(
                uploadSummary(uploaded, failures)
                  + ', but receipt analysis could not start.'
                  + (detail ? ' ' + detail : '')
                  + ' Refreshing\u2026',
                true
              );
            }
          );
        } catch (analysisCallError) {
          finish(
            uploadSummary(uploaded, failures)
              + ', but receipt analysis could not start.'
              + ' Refreshing\u2026',
            !isStale()
          );
        }

        return;
      }

      file = valid[index];
      index++;

      setUploadStatus(
        'Uploading ' + String(index) + ' of ' + String(valid.length)
          + ': ' + (file.name || 'receipt file')
      );
      updateUploadProgress(index - 1, valid.length);
      spinnerStart(
        'Uploading ' + String(index) + ' of ' + String(valid.length)
          + ': ' + (file.name || 'receipt file'),
        UPLOAD_SPINNER_KEY
      );

      uploadOneFile(storage, services, user, file).then(function () {
        if (finished) {
          return;
        }

        if (isStale()) {
          finish('Upload stopped because the page changed.', false);
          return;
        }

        uploaded++;
        updateUploadProgress(index, valid.length);
        uploadNext();
      }, function (uploadError) {
        if (finished) {
          return;
        }

        failures.push({
          name: file.name || 'Unnamed file',
          message: formatError(uploadError)
        });

        if (isStale()) {
          finish('Upload stopped because the page changed.', false);
          return;
        }

        uploadNext();
      });
    }

    // The validation loop above leaves index at list.length. Reset it so the
    // upload walk starts at the first valid file instead of treating the batch
    // as already complete.
    index = 0;
    uploadNext();

    return promise;
  }

  function handleUploadSelection(files, input) {
    var list;

    if (state.uploading) {
      clearUploadInput(input);
      return;
    }

    try {
      list = files ? Array.prototype.slice.call(files) : [];
    } catch (ignoredFilesError) {
      list = [];
    }

    if (list.length === 0) {
      clearUploadInput(input);
      return;
    }

    runUploadBatch(list, input, { refresh: refreshLive });
  }

  // -------------------------------------------------------------------------
  // Real service response normalization. The shared loader normally writes the
  // returned rows into indexed Storage keys, but the success callback can also
  // provide the same rows as tableRows or as a Response TableArray. Both forms
  // are accepted so an explicitly empty answer is never replaced by stale
  // Storage data.
  // -------------------------------------------------------------------------

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function parseJsonValue(value) {
    var parsed = value;
    var attempts = 0;
    var text;

    while (typeof parsed === 'string' && attempts < 2) {
      text = toText(parsed);

      if (text === '' || (text.charAt(0) !== '{' && text.charAt(0) !== '[')) {
        break;
      }

      try {
        parsed = JSON.parse(text);
      } catch (ignoredParseError) {
        break;
      }

      attempts++;
    }

    return parsed;
  }

  function normalizeReturnedRow(row) {
    var values = {};
    var key;
    var upper;
    var target;

    if (!isObject(row)) {
      return null;
    }

    for (key in row) {
      if (!hasOwn(row, key)) {
        continue;
      }

      upper = toText(key).toUpperCase();

      if (upper.indexOf('RECEIPTBATCH_') !== 0) {
        upper = 'RECEIPTBATCH_' + upper;
      }

      if (!hasOwn(RETURNED_FIELD_NAMES, upper)) {
        continue;
      }

      target = RETURNED_FIELD_NAMES[upper];

      if (values[target] === undefined || values[target] === '') {
        values[target] = row[key];
      }
    }

    return target ? values : null;
  }

  function tableRowsFromValue(value, explicitEmpty) {
    var parsed = parseJsonValue(value);
    var keys;
    var index;
    var nested;
    var parsedNested;

    if (parsed === null || parsed === undefined) {
      return { recognized: false, rows: [] };
    }

    if (Array.isArray(parsed)) {
      return { recognized: true, rows: parsed };
    }

    if (!isObject(parsed)) {
      return { recognized: false, rows: [] };
    }

    if (normalizeReturnedRow(parsed)) {
      return { recognized: true, rows: [parsed] };
    }

    keys = Object.keys(parsed);

    for (index = 0; index < keys.length; index++) {
      if (/(?:ArrayItem|ArrayItems|Rows|Items|Row)$/i.test(keys[index])) {
        nested = tableRowsFromValue(parsed[keys[index]], true);

        if (nested.recognized) {
          return nested;
        }
      }
    }

    if (explicitEmpty === true) {
      for (index = 0; index < keys.length; index++) {
        parsedNested = parseJsonValue(parsed[keys[index]]);

        if (Array.isArray(parsedNested)) {
          return { recognized: true, rows: parsedNested };
        }

        if (isObject(parsedNested) && normalizeReturnedRow(parsedNested)) {
          return { recognized: true, rows: [parsedNested] };
        }
      }

      return { recognized: true, rows: [] };
    }

    return { recognized: false, rows: [] };
  }

  function rowsFromContainer(container, requestedService) {
    var names = [
      requestedService + 'TableArray',
      'TableArray',
      requestedService + 'ArrayItem',
      'ArrayItem'
    ];
    var index;
    var parsed;

    if (!isObject(container)) {
      return { recognized: false, rows: [] };
    }

    for (index = 0; index < names.length; index++) {
      if (!hasOwn(container, names[index])) {
        continue;
      }

      if (container[names[index]] === null || container[names[index]] === undefined) {
        return { recognized: true, rows: [] };
      }

      parsed = tableRowsFromValue(container[names[index]], true);

      if (parsed.recognized) {
        return parsed;
      }
    }

    if (normalizeReturnedRow(container)) {
      return { recognized: true, rows: [container] };
    }

    return { recognized: false, rows: [] };
  }

  function readLoadResponseRows(response, serviceName, tableRows) {
    var requestedService = toText(serviceName) || SERVICE_NAME;
    var parsedTableRows;
    var parsedResponse;
    var container;
    var containerRows;

    if (tableRows !== undefined && tableRows !== null) {
      parsedTableRows = tableRowsFromValue(tableRows, true);

      if (parsedTableRows.recognized) {
        return parsedTableRows;
      }
    }

    parsedResponse = parseJsonValue(response);

    if (parsedResponse === null || parsedResponse === undefined) {
      return { recognized: false, rows: [] };
    }

    if (Array.isArray(parsedResponse)) {
      return tableRowsFromValue(parsedResponse, true);
    }

    if (!isObject(parsedResponse)) {
      return { recognized: false, rows: [] };
    }

    container = isObject(parsedResponse.Response) ? parsedResponse.Response : parsedResponse;
    containerRows = rowsFromContainer(container, requestedService);

    if (containerRows.recognized) {
      return containerRows;
    }

    return { recognized: false, rows: [] };
  }

  function buildRecordsFromRows(rows) {
    var records = [];
    var index;
    var values;
    var id;
    var documentUrl;
    var checked;

    for (index = 0; index < rows.length; index++) {
      values = normalizeReturnedRow(rows[index]);

      if (!values) {
        continue;
      }

      id = toText(values.id);
      documentUrl = toText(values.documentUrl);
      checked = documentUrl === '' ? null : sanitizeUrl(documentUrl);

      records.push({
        key: 'receipt:' + (id || 'row-' + index) + ':' + index,
        id: id,
        status: toText(values.status),
        fileName: toText(values.fileName),
        fileType: toText(values.fileType),
        expenseType: toText(values.expenseType),
        totalAmount: toText(values.totalAmount),
        receiptDate: toText(values.receiptDate),
        merchant: toText(values.merchant),
        location: toText(values.location),
        department: toText(values.department),
        paymentType: toText(values.paymentType),
        credit: toText(values.credit) || toText(values.creditTransaction),
        documentUrl: checked && checked.safe ? checked.url : '',
        documentState: checked && checked.safe ? 'ready' : 'none',
        documentError: ''
      });
    }

    return records;
  }

  function buildRecordsFromLoadResponse(response, serviceName, tableRows, storage) {
    var parsed = readLoadResponseRows(response, serviceName, tableRows);

    if (parsed.recognized) {
      return buildRecordsFromRows(parsed.rows);
    }

    return snapshotLiveRecords(storage, receiptRecordCount(storage));
  }

  function errorValueText(value) {
    var parsed = parseJsonValue(value);
    var parts = [];
    var index;

    if (Array.isArray(parsed)) {
      for (index = 0; index < parsed.length; index++) {
        if (toText(parsed[index]) !== '') {
          parts.push(toText(parsed[index]));
        }
      }

      return truncate(parts.join(', '), 240);
    }

    if (isObject(parsed)) {
      return hasOwn(parsed, 'Error') ? errorValueText(parsed.Error) : '';
    }

    if (toText(parsed) === '' || toText(parsed) === '[]') {
      return '';
    }

    return truncate(parsed, 240);
  }

  function responseErrorText(response, serviceName) {
    var requestedService = toText(serviceName) || SERVICE_NAME;
    var parsed = parseJsonValue(response);
    var container;
    var error;

    if (Array.isArray(parsed)) {
      return '';
    }

    if (!isObject(parsed)) {
      return errorValueText(parsed);
    }

    if (parsed.success === false) {
      return 'The receipt list service reported a failure.';
    }

    container = isObject(parsed.Response) ? parsed.Response : parsed;

    if (container[requestedService + 'Success'] === false) {
      return 'The receipt list service reported a failure.';
    }

    error = errorValueText(container.Error);

    if (error !== '') {
      return error;
    }

    error = errorValueText(container[requestedService + 'Message']);

    if (error !== '') {
      return error;
    }

    return errorValueText(container.Message);
  }

  function findSharedReceiptLoader() {
    var browserWindow = windowObject();

    if (browserWindow && typeof browserWindow.loadReceiptBatchesByUser === 'function') {
      return browserWindow.loadReceiptBatchesByUser;
    }

    if (typeof loadReceiptBatchesByUser === 'function') {
      return loadReceiptBatchesByUser;
    }

    return null;
  }

  function startReceiptListRequest(user, success, failure) {
    var loader = findSharedReceiptLoader();
    var services = servicesObject();

    if (loader) {
      loader(STATUSES, user, success, failure);
      return;
    }

    if (!services || typeof services.call !== 'function') {
      throw new Error('The receipt service is not available.');
    }

    storageSet('EBS_USER', user);
    storageSet('ReceiptBatch_statuses', STATUSES);
    services.call(SERVICE_NAME, success, failure);
  }

  // -------------------------------------------------------------------------
  // Live data snapshot and serial document loading
  // -------------------------------------------------------------------------

  function readStorageValue(storage, key) {
    if (!storage || typeof storage.get !== 'function') {
      return '';
    }

    return toText(storage.get(key));
  }

  function receiptRecordCount(storage) {
    var ids;

    if (!storage) {
      return 0;
    }

    if (typeof storage.count === 'function') {
      return Math.max(0, parseInt(storage.count('RECEIPTBATCH_RECEIPT_ID'), 10) || 0);
    }

    if (typeof storage.getArray === 'function') {
      ids = storage.getArray('RECEIPTBATCH_RECEIPT_ID');
      return ids && typeof ids.length === 'number' ? ids.length : 0;
    }

    return 0;
  }

  function snapshotLiveRecords(storage, count) {
    var records = [];
    var index;
    var record;

    for (index = 0; index < count; index++) {
      record = {
        key: 'live:' + index,
        id: readStorageValue(storage, 'RECEIPTBATCH_RECEIPT_ID_' + index),
        status: readStorageValue(storage, 'RECEIPTBATCH_STATUS_' + index),
        fileName: readStorageValue(storage, 'RECEIPTBATCH_FILE_NAME_' + index),
        fileType: readStorageValue(storage, 'RECEIPTBATCH_FILE_TYPE_' + index),
        expenseType: readStorageValue(storage, 'RECEIPTBATCH_EXPENSE_TYPE_' + index),
        totalAmount: readStorageValue(storage, 'RECEIPTBATCH_TOTAL_AMOUNT_' + index),
        receiptDate: readStorageValue(storage, 'RECEIPTBATCH_RECEIPT_DATE_' + index),
        merchant: readStorageValue(storage, 'RECEIPTBATCH_MERCHANT_' + index),
        location: readStorageValue(storage, 'RECEIPTBATCH_LOCATION_' + index),
        department: readStorageValue(storage, 'RECEIPTBATCH_DEPARTMENT_' + index),
        paymentType: readStorageValue(storage, 'RECEIPTBATCH_PAYMENT_TYPE_' + index),
        credit: readStorageValue(storage, 'RECEIPTBATCH_CREDIT_' + index) ||
          readStorageValue(storage, 'RECEIPTBATCH_CREDIT_TRANSACTION_' + index),
        documentUrl: '',
        documentState: 'none',
        documentError: ''
      };

      record.key = 'live:' + (record.id || 'index-' + index) + ':' + index;
      records.push(record);
    }

    return records;
  }

  function captureStorageValue(storage, key) {
    var exists = false;
    var value = '';

    if (!storage) {
      return { exists: false, value: '' };
    }

    if (typeof storage.contains === 'function') {
      exists = storage.contains(key);
    } else if (typeof storage.get === 'function') {
      value = storage.get(key);
      exists = value !== null && value !== undefined && value !== '';
    }

    if (exists && typeof storage.get === 'function') {
      value = storage.get(key);
    }

    return { exists: exists, value: value };
  }

  function restoreStorageValue(storage, key, captured) {
    if (!storage) {
      return;
    }

    if (captured && captured.exists) {
      if (typeof storage.set === 'function') {
        storage.set(key, captured.value);
      }
      return;
    }

    if (typeof storage.remove === 'function') {
      storage.remove(key);
    } else if (typeof storage.clear === 'function') {
      storage.clear(key);
    }
  }

  function fetchRecordDocumentWith(record, services, storage, done) {
    var finished = false;
    var previousReceiptId;
    var previousDocumentUrl;
    var previousDocumentUrlLower;
    var previousFileType;
    var previousFileTypeLower;

    function finish() {
      if (finished) {
        return;
      }

      finished = true;

      restoreStorageValue(storage, 'receipt_ID', previousReceiptId);
      restoreStorageValue(storage, 'RECEIPTBATCH_DOCUMENT_URL', previousDocumentUrl);
      restoreStorageValue(storage, 'DOCUMENT_URL', previousDocumentUrlLower);
      restoreStorageValue(storage, 'RECEIPTBATCH_FILE_TYPE', previousFileType);
      restoreStorageValue(storage, 'FILE_TYPE', previousFileTypeLower);

      if (typeof done === 'function') {
        done(record);
      }
    }

    if (!record.id) {
      record.documentState = 'error';
      record.documentError = 'The receipt has no receipt ID.';
      finish();
      return;
    }

    if (!services || typeof services.call !== 'function' || !storage) {
      record.documentState = 'error';
      record.documentError = 'The receipt service is not available.';
      finish();
      return;
    }

    previousReceiptId = captureStorageValue(storage, 'receipt_ID');
    previousDocumentUrl = captureStorageValue(storage, 'RECEIPTBATCH_DOCUMENT_URL');
    previousDocumentUrlLower = captureStorageValue(storage, 'DOCUMENT_URL');
    previousFileType = captureStorageValue(storage, 'RECEIPTBATCH_FILE_TYPE');
    previousFileTypeLower = captureStorageValue(storage, 'FILE_TYPE');

    record.documentState = 'loading';
    record.documentError = '';

    // Match the baseline receipt pages: the service reads receipt_ID from
    // Storage, and its document URL/type outputs are read immediately.
    if (typeof storage.set !== 'function') {
      record.documentState = 'error';
      record.documentError = 'The receipt storage is not available.';
      finish();
      return;
    }

    storage.set('receipt_ID', record.id);

    if (typeof storage.remove === 'function') {
      storage.remove('RECEIPTBATCH_DOCUMENT_URL');
      storage.remove('DOCUMENT_URL');
      storage.remove('RECEIPTBATCH_FILE_TYPE');
      storage.remove('FILE_TYPE');
    }

    try {
      services.call(
        'js_ReceiptBatch_get_receipt_by_id',
        function () {
          var url = readStorageValue(storage, 'RECEIPTBATCH_DOCUMENT_URL');
          var fileType = readStorageValue(storage, 'RECEIPTBATCH_FILE_TYPE');
          var checked;

          if (url === '') {
            url = readStorageValue(storage, 'DOCUMENT_URL');
          }

          if (fileType === '') {
            fileType = readStorageValue(storage, 'FILE_TYPE');
          }

          checked = sanitizeUrl(url);

          if (!checked.safe) {
            record.documentUrl = '';
            record.documentState = 'error';
            record.documentError = checked.reason || 'The document URL is not allowed.';
          } else {
            record.documentUrl = checked.url;
            if (fileType !== '') {
              record.fileType = fileType;
            }
            record.documentState = 'ready';
            record.documentError = '';
          }

          finish();
        },
        function (error) {
          record.documentUrl = '';
          record.documentState = 'error';
          record.documentError = formatError(error);
          finish();
        }
      );
    } catch (serviceError) {
      record.documentUrl = '';
      record.documentState = 'error';
      record.documentError = formatError(serviceError);
      finish();
    }
  }

  function runSerialDocumentFetches(records, services, storage, isActive, onRecordDone, onAllDone, fetchFunction) {
    var index = 0;
    var fetchRecord = typeof fetchFunction === 'function' ? fetchFunction : fetchRecordDocumentWith;

    function next() {
      var record;

      if (typeof isActive === 'function' && !isActive()) {
        if (typeof onAllDone === 'function') {
          onAllDone(true);
        }
        return;
      }

      if (index >= records.length) {
        if (typeof onAllDone === 'function') {
          onAllDone(false);
        }
        return;
      }

      record = records[index];
      index++;

      fetchRecord(record, services, storage, function () {
        if (typeof onRecordDone === 'function') {
          onRecordDone(record);
        }
        next();
      });
    }

    next();
  }

  // The receipt-by-id service writes shared Storage output keys, so only one
  // request may be in flight even across a refresh generation. A new
  // generation's request waits for the old request to finish and then starts.
  function requestRecordDocument(record, services, storage, done) {
    if (!isCurrentRoot()) {
      if (typeof done === 'function') {
        done(record);
      }
      return;
    }

    if (documentRequestInFlight) {
      setTimeout(function () {
        requestRecordDocument(record, services, storage, done);
      }, 100);
      return;
    }

    documentRequestInFlight = true;

    try {
      fetchRecordDocumentWith(record, services, storage, function (finishedRecord) {
        documentRequestInFlight = false;

        if (typeof done === 'function') {
          done(finishedRecord);
        }
      });
    } catch (requestError) {
      documentRequestInFlight = false;
      record.documentState = 'error';
      record.documentError = formatError(requestError);

      if (typeof done === 'function') {
        done(record);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Page state and lifecycle
  // -------------------------------------------------------------------------

  function readLoggedInUser() {
    var user = toText(storageGet('LoggedInUsername'));

    if (user.toLowerCase() === 'undefined' || user.toLowerCase() === 'null') {
      return '';
    }

    return user;
  }

  function nextGeneration() {
    state.generation++;
    state.hydrating = false;
    state.hydrateAgain = false;
    return state.generation;
  }

  function isCurrentRoot() {
    var doc = documentObject();

    return !!(
      rootNode &&
      doc &&
      doc.getElementById('receiptCardsPocRoot') === rootNode &&
      rootNode.parentNode
    );
  }

  function isActiveGeneration(generation) {
    return generation === state.generation && isCurrentRoot();
  }

  function onLoad() {
    var user;

    teardown();
    state.search = '';
    state.statusFilter = 'ALL';
    state.visibleCount = THUMBNAIL_BATCH_SIZE;
    state.records = [];
    state.loading = false;
    state.error = '';
    state.mode = 'needlogin';

    ensureRoot();

    if (!rootNode) {
      return;
    }

    user = readLoggedInUser();

    if (user !== '') {
      refreshLive();
      return;
    }

    renderAll();
  }

  function teardown() {
    nextGeneration();
    restoreActiveUploadStorage();
    state.uploading = false;
    state.uploadToken++;
    spinnerStop(UPLOAD_SPINNER_KEY);
    spinnerStop(ANALYZE_SPINNER_KEY);
    revokeAllHeicPreviews();
    closeDialog();
    state.lastFocus = null;

    if (rootNode && rootNode.parentNode) {
      rootNode.parentNode.removeChild(rootNode);
    }

    rootNode = null;
    $rootNode = null;
  }

  function ensureRoot() {
    var doc = documentObject();
    var host;
    var jq = jqueryObject();
    var previousRoot;
    var header;
    var body;
    var footer;

    if (!doc) {
      return;
    }

    previousRoot = doc.getElementById('receiptCardsPocRoot');

    if (previousRoot && previousRoot.parentNode) {
      previousRoot.parentNode.removeChild(previousRoot);
    }

    host = doc.getElementById('content') || doc.body;

    rootNode = createElement('section', 'rcpoc');
    rootNode.id = 'receiptCardsPocRoot';
    setAttribute(rootNode, 'aria-label', 'Receipt cards');

    header = buildHeader();
    body = createElement('div', 'rcpoc-body');
    setAttribute(body, 'aria-live', 'polite');
    footer = createElement('p', 'rcpoc-footer-note', 'Receipt cards show the receipts already uploaded to your account.');

    appendChildren(rootNode, header, body, footer);
    host.appendChild(rootNode);

    $rootNode = jq ? jq(rootNode) : null;

    bindRootEvents();

    return rootNode;
  }

  function refreshLive() {
    var user = readLoggedInUser();
    var generation = nextGeneration();

    revokeAllHeicPreviews();
    closeDialog();
    state.mode = 'live';
    state.records = [];
    state.loading = false;
    state.error = '';
    state.visibleCount = THUMBNAIL_BATCH_SIZE;

    if (user === '') {
      state.mode = 'needlogin';
      renderAll();
      return;
    }

    state.loading = true;
    renderAll();
    loadLiveData(user, generation);
  }

  function loadLiveData(user, generation) {
    var services = servicesObject();

    if (!services || typeof services.call !== 'function') {
      handleLiveLoadFailure('The receipt service is not available.', generation);
      return;
    }

    try {
      startReceiptListRequest(
        user,
        function (response, serviceName, tableRows) {
          handleLiveLoadSuccess(response, serviceName, tableRows, generation);
        },
        function (error, serviceName) {
          handleLiveLoadFailure(
            responseErrorText(error, serviceName) || error,
            generation
          );
        }
      );
    } catch (loadError) {
      handleLiveLoadFailure(loadError, generation);
    }
  }

  function handleLiveLoadSuccess(response, serviceName, tableRows, generation) {
    var storage;
    var records;
    var responseError;

    if (!isActiveGeneration(generation)) {
      return;
    }

    responseError = responseErrorText(response, serviceName);

    if (responseError !== '') {
      handleLiveLoadFailure(responseError, generation);
      return;
    }

    try {
      storage = storageObject();
      records = buildRecordsFromLoadResponse(response, serviceName, tableRows, storage);
    } catch (recordError) {
      handleLiveLoadFailure(recordError, generation);
      return;
    }

    state.mode = 'live';
    state.loading = false;
    state.error = '';
    state.records = records;
    state.visibleCount = THUMBNAIL_BATCH_SIZE;
    renderAll();
    hydrateVisibleRecords(generation);
  }

  function handleLiveLoadFailure(error, generation) {
    if (!isActiveGeneration(generation)) {
      return;
    }

    state.mode = 'live';
    state.loading = false;
    state.error = formatError(error);
    renderAll();
  }

  function currentRecords() {
    return state.records;
  }

  // -------------------------------------------------------------------------
  // Root UI
  // -------------------------------------------------------------------------

  function buildHeader() {
    var header = createElement('header', 'rcpoc-header');
    var titleRow = createElement('div', 'rcpoc-title-row');
    var title = createElement('h1', 'rcpoc-title', 'Receipt Cards');
    var subtitle = createElement(
      'p',
      'rcpoc-subtitle',
      'Your receipts, shown as image-first cards with status, amount, and document preview.'
    );
    var toolbar = createElement('div', 'rcpoc-toolbar');
    var searchField = createElement('label', 'rcpoc-field rcpoc-search-field');
    var searchLabel = createElement('span', 'rcpoc-field-label', 'Search');
    var searchInput = createElement('input', 'rcpoc-search-input');
    var filterField = createElement('label', 'rcpoc-field rcpoc-filter-field');
    var filterLabel = createElement('span', 'rcpoc-field-label', 'Status');
    var filterSelect = createElement('select', 'rcpoc-status-select');
    var actions = createElement('div', 'rcpoc-toolbar-actions');
    var uploadButton = createElement('button', 'rcpoc-btn rcpoc-btn-upload rcpoc-upload', 'Upload Receipts');
    var refreshButton = createElement('button', 'rcpoc-btn rcpoc-btn-primary rcpoc-refresh', 'Refresh');
    var uploadInput = createElement('input', 'rcpoc-upload-input');
    var uploadState = createElement('div', 'rcpoc-upload-state');
    var uploadStatus = createElement('p', 'rcpoc-upload-status', '');
    var uploadProgress = createElement('progress', 'rcpoc-upload-progress');
    var uploadErrors = createElement('div', 'rcpoc-upload-errors');
    var status = createElement('div', 'rcpoc-status');
    var live = createElement('div', 'rcpoc-sr-only');
    var index;

    setAttribute(titleRow, 'role', 'presentation');
    setAttribute(searchInput, 'type', 'search');
    setAttribute(searchInput, 'placeholder', 'Merchant, type or date');
    setAttribute(searchInput, 'aria-label', 'Search receipts by merchant, type or date');
    searchInput.value = state.search;

    setAttribute(filterSelect, 'aria-label', 'Filter receipts by status');

    for (index = 0; index < STATUS_FILTERS.length; index++) {
      appendChildren(
        filterSelect,
        createElement(
          'option',
          '',
          STATUS_FILTERS[index] === 'ALL' ? 'All statuses' : statusMeta(STATUS_FILTERS[index]).label
        )
      );

      filterSelect.options[index].value = STATUS_FILTERS[index];
    }

    filterSelect.value = state.statusFilter;

    setAttribute(uploadButton, 'type', 'button');
    setAttribute(uploadButton, 'title', 'Choose receipt files to upload');
    setAttribute(refreshButton, 'type', 'button');
    setAttribute(refreshButton, 'title', 'Reload receipts');
    setAttribute(uploadInput, 'type', 'file');
    setAttribute(uploadInput, 'accept', UPLOAD_ACCEPT);
    setAttribute(uploadInput, 'multiple', 'multiple');
    setAttribute(uploadInput, 'tabindex', '-1');
    setAttribute(uploadInput, 'aria-hidden', 'true');
    uploadState.hidden = true;
    uploadProgress.hidden = true;
    setAttribute(uploadProgress, 'max', '100');
    setAttribute(uploadProgress, 'value', '0');
    setAttribute(status, 'role', 'status');
    setAttribute(status, 'aria-live', 'polite');
    setAttribute(live, 'aria-live', 'polite');

    appendChildren(uploadState, uploadStatus, uploadProgress, uploadErrors);
    appendChildren(titleRow, title);
    appendChildren(searchField, searchLabel, searchInput);
    appendChildren(filterField, filterLabel, filterSelect);
    appendChildren(actions, uploadButton, refreshButton, uploadInput);
    appendChildren(toolbar, searchField, filterField, actions);
    appendChildren(header, titleRow, subtitle, toolbar, uploadState, status, live);

    return header;
  }

  function bindRootEvents() {
    var jq = jqueryObject();

    if (!jq || !$rootNode) {
      return;
    }

    $rootNode
      .off('.receiptCardsPoc')
      .on('input.receiptCardsPoc', '.rcpoc-search-input', function () {
        state.search = toText(jq(this).val());
        state.visibleCount = THUMBNAIL_BATCH_SIZE;
        renderBody();
        updateStatusLine();
        hydrateVisibleRecords(state.generation);
      })
      .on('change.receiptCardsPoc', '.rcpoc-status-select', function () {
        state.statusFilter = toText(jq(this).val()) || 'ALL';
        state.visibleCount = THUMBNAIL_BATCH_SIZE;
        renderBody();
        updateStatusLine();
        hydrateVisibleRecords(state.generation);
      })
      .on('click.receiptCardsPoc', '.rcpoc-refresh', function () {
        if (state.uploading) {
          return;
        }

        refreshLive();
      })
      .on('click.receiptCardsPoc', '.rcpoc-upload', function (event) {
        var uploadInput = findDescendant(rootNode, 'rcpoc-upload-input');

        if (event) {
          event.preventDefault();
        }

        if (state.uploading || !uploadInput) {
          return;
        }

        clearUploadInput(uploadInput);

        if (typeof uploadInput.click === 'function') {
          uploadInput.click();
        }
      })
      .on('change.receiptCardsPoc', '.rcpoc-upload-input', function () {
        var input = this;
        var selectedFiles;

        try {
          selectedFiles = input && input.files
            ? Array.prototype.slice.call(input.files)
            : [];
        } catch (ignoredSelectionError) {
          selectedFiles = [];
        }

        clearUploadInput(input);
        handleUploadSelection(selectedFiles, input);
      })
      .on('click.receiptCardsPoc', '.rcpoc-action-retry', function () {
        refreshLive();
      })
      .on('click.receiptCardsPoc', '.rcpoc-action-clear', function () {
        state.search = '';
        state.statusFilter = 'ALL';
        state.visibleCount = THUMBNAIL_BATCH_SIZE;

        if (rootNode) {
          jq('.rcpoc-search-input', rootNode).val('');
          jq('.rcpoc-status-select', rootNode).val('ALL');
        }

        renderBody();
        updateStatusLine();
        hydrateVisibleRecords(state.generation);
      })
      .on('click.receiptCardsPoc', '.rcpoc-action-loadmore', function () {
        state.visibleCount += THUMBNAIL_BATCH_SIZE;
        renderBody();
        updateStatusLine();
        hydrateVisibleRecords(state.generation);
      })
      .on('click.receiptCardsPoc', '.rcpoc-card-face', function () {
        openRecordDialog(findRecordByKey(jq(this).attr('data-record-key')));
      })
      .on('click.receiptCardsPoc', '.rcpoc-retry-doc', function (event) {
        var key = jq(this).attr('data-record-key');
        var record = findRecordByKey(key);

        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }

        if (!record) {
          return;
        }

        if (record.documentState === 'error') {
          record.documentState = 'none';
          record.documentError = '';
          updateCardForRecord(record);
          startDocumentLoad(record);
          return;
        }

        if (isHeicRecord(record) && heicPreviewFor(record).state === 'failed') {
          retryHeicPreview(record);
        }
      })
      .on('click.receiptCardsPoc', '.rcpoc-action-retry-docs', function () {
        var records = currentRecords();
        var index;
        var preview;

        for (index = 0; index < records.length; index++) {
          if (records[index].documentState === 'error') {
            records[index].documentState = 'none';
            records[index].documentError = '';
          }

          if (isHeicRecord(records[index])) {
            preview = heicPreviewFor(records[index]);

            if (preview.state === 'failed') {
              resetHeicPreview(records[index]);
            }
          }
        }

        renderBody();
        hydrateVisibleRecords(state.generation);
      });
  }

  function renderAll() {
    if (!rootNode) {
      return;
    }

    renderHeaderState();
    renderBody();
    updateStatusLine();
  }

  function renderHeaderState() {
    if (!rootNode) {
      return;
    }

    setAttribute(
      rootNode,
      'aria-busy',
      state.loading || state.uploading ? 'true' : 'false'
    );
  }

  function updateStatusLine() {
    var status = findDescendant(rootNode, 'rcpoc-status');
    var live = findDescendant(rootNode, 'rcpoc-sr-only');
    var records;
    var filtered;
    var text;

    if (!status) {
      return;
    }

    records = currentRecords();
    filtered = filterRecords(records, state.search, state.statusFilter);

    if (state.uploading) {
      text = 'Uploading receipts\u2026';
    } else if (state.loading) {
      text = 'Loading receipts\u2026';
    } else if (state.error && state.mode === 'live') {
      text = 'Receipts could not be loaded.';
    } else if (state.mode === 'needlogin') {
      text = 'Sign in is required to view receipts.';
    } else if (records.length === 0) {
      text = 'No receipts were returned.';
    } else if (filtered.length !== records.length) {
      text = 'Showing ' + String(filtered.length) + ' of ' + String(records.length) + ' receipts.';
    } else {
      text = 'Showing ' + String(records.length) + ' receipts.';
    }

    status.textContent = text;

    if (live) {
      live.textContent = text;
    }
  }

  function renderBody() {
    var body = findDescendant(rootNode, 'rcpoc-body');
    var records;
    var filtered;
    var visible;
    var grid;
    var index;
    var loadMore;
    var remaining;
    var errorSummary;
    var retryDocs;

    if (!body) {
      return;
    }

    clearNode(body);

    if (state.loading) {
      body.appendChild(buildLoadingState());
      return;
    }

    if (state.error && state.mode === 'live') {
      body.appendChild(buildFailureState());
      return;
    }

    if (state.mode === 'needlogin') {
      body.appendChild(buildNeedLoginState());
      return;
    }

    records = currentRecords();
    filtered = filterRecords(records, state.search, state.statusFilter);

    if (records.length === 0) {
      body.appendChild(buildEmptyState());
      return;
    }

    if (filtered.length === 0) {
      body.appendChild(buildNoResultsState());
      return;
    }

    visible = filtered.slice(0, state.visibleCount);
    grid = createElement('div', 'rcpoc-grid');

    for (index = 0; index < visible.length; index++) {
      grid.appendChild(buildCard(visible[index]));
    }

    body.appendChild(grid);

    if (visible.length < filtered.length) {
      remaining = filtered.length - visible.length;
      loadMore = createElement(
        'button',
        'rcpoc-btn rcpoc-btn-primary rcpoc-action-loadmore',
        'Load more receipts (' + String(remaining) + ' remaining)'
      );
      setAttribute(loadMore, 'type', 'button');
      body.appendChild(loadMore);
    }

    errorSummary = countDocumentErrors(visible);

    if (errorSummary > 0 && state.mode === 'live') {
      retryDocs = createElement(
        'button',
        'rcpoc-btn rcpoc-btn-quiet rcpoc-action-retry-docs',
        'Retry failed previews'
      );
      setAttribute(retryDocs, 'type', 'button');
      body.appendChild(
        appendChildren(
          createElement('div', 'rcpoc-doc-error-summary'),
          createElement(
            'span',
            '',
            String(errorSummary) + (errorSummary === 1 ? ' preview could not be loaded.' : ' previews could not be loaded.')
          ),
          retryDocs
        )
      );
    }
  }

  function recordHasFailedPreview(record) {
    if (!record) {
      return false;
    }

    if (record.documentState === 'error') {
      return true;
    }

    return isHeicRecord(record) && heicPreviewFor(record).state === 'failed';
  }

  function countDocumentErrors(records) {
    var count = 0;
    var index;

    for (index = 0; index < records.length; index++) {
      if (recordHasFailedPreview(records[index])) {
        count++;
      }
    }

    return count;
  }

  function buildLoadingState() {
    var wrapper = createElement('div', 'rcpoc-state rcpoc-state-loading');
    var title = createElement('h2', 'rcpoc-state-title', 'Loading receipts');
    var text = createElement('p', 'rcpoc-state-text', 'Reading your receipt history. This can take a moment.');
    var grid = createElement('div', 'rcpoc-grid rcpoc-skeleton-grid');
    var index;

    setAttribute(wrapper, 'aria-busy', 'true');
    wrapper.appendChild(title);
    wrapper.appendChild(text);

    for (index = 0; index < 6; index++) {
      grid.appendChild(
        appendChildren(
          createElement('div', 'rcpoc-skeleton-card'),
          createElement('span', 'rcpoc-skeleton-image'),
          createElement('span', 'rcpoc-skeleton-line rcpoc-skeleton-line-short'),
          createElement('span', 'rcpoc-skeleton-line')
        )
      );
    }

    wrapper.appendChild(grid);
    return wrapper;
  }

  function buildNeedLoginState() {
    var wrapper = createElement('div', 'rcpoc-state rcpoc-state-locked');
    var mark = createElement('div', 'rcpoc-state-mark', 'Sign in');
    var title = createElement('h2', 'rcpoc-state-title', 'Sign in to view your receipts');
    var text = createElement(
      'p',
      'rcpoc-state-text',
      'Receipt cards use your current AuraPlayer sign-in. Sign in, then check again.'
    );
    var actions = createElement('div', 'rcpoc-state-actions');
    var check = createElement('button', 'rcpoc-btn rcpoc-btn-primary rcpoc-action-retry', 'Check sign-in');

    setAttribute(check, 'type', 'button');
    appendChildren(actions, check);
    appendChildren(wrapper, mark, title, text, actions);
    return wrapper;
  }

  function buildFailureState() {
    var wrapper = createElement('div', 'rcpoc-state rcpoc-state-error');
    var mark = createElement('div', 'rcpoc-state-mark', '!');
    var title = createElement('h2', 'rcpoc-state-title', 'We couldn\u2019t load your receipts');
    var text = createElement(
      'p',
      'rcpoc-state-text',
      'The receipt list service did not respond. Check your connection and try again.'
    );
    var detail = createElement('p', 'rcpoc-error-detail', state.error);
    var actions = createElement('div', 'rcpoc-state-actions');
    var retry = createElement('button', 'rcpoc-btn rcpoc-btn-primary rcpoc-action-retry', 'Retry');

    setAttribute(wrapper, 'role', 'alert');
    setAttribute(retry, 'type', 'button');
    appendChildren(actions, retry);
    appendChildren(wrapper, mark, title, text, detail, actions);
    return wrapper;
  }

  function buildEmptyState() {
    var wrapper = createElement('div', 'rcpoc-state rcpoc-state-empty');
    var mark = createElement('div', 'rcpoc-state-mark', '0');
    var title = createElement('h2', 'rcpoc-state-title', 'No receipts yet');
    var text = createElement(
      'p',
      'rcpoc-state-text',
      'When receipts are uploaded and processed, they will appear here.'
    );
    var actions = createElement('div', 'rcpoc-state-actions');
    var refresh = createElement('button', 'rcpoc-btn rcpoc-btn-primary rcpoc-action-retry', 'Refresh');

    setAttribute(refresh, 'type', 'button');
    appendChildren(actions, refresh);
    appendChildren(wrapper, mark, title, text, actions);
    return wrapper;
  }

  function buildNoResultsState() {
    var wrapper = createElement('div', 'rcpoc-state rcpoc-state-empty');
    var mark = createElement('div', 'rcpoc-state-mark', '?');
    var title = createElement('h2', 'rcpoc-state-title', 'No receipts match your filters');
    var text = createElement(
      'p',
      'rcpoc-state-text',
      'Try a different merchant, type, date, or status. Filters only affect the cards shown here.'
    );
    var actions = createElement('div', 'rcpoc-state-actions');
    var clear = createElement('button', 'rcpoc-btn rcpoc-btn-primary rcpoc-action-clear', 'Clear filters');

    setAttribute(clear, 'type', 'button');
    appendChildren(actions, clear);
    appendChildren(wrapper, mark, title, text, actions);
    return wrapper;
  }

  function buildCard(record) {
    var meta = statusMeta(record.status);
    var card = createElement('article', 'rcpoc-card rcpoc-status-' + meta.tone);
    var face = createElement('button', 'rcpoc-card-face');
    var top = createElement('span', 'rcpoc-card-top');
    var statusPill = createElement('span', 'rcpoc-status-pill rcpoc-status-pill-' + meta.tone, meta.label);
    var overlay = createElement('span', 'rcpoc-overlay');
    var amount = displayField(record, 'totalAmount');
    var amountLine = createElement(
      'span',
      'rcpoc-amount' + (amount.pending ? ' is-pending' : ''),
      amount.text
    );
    var metaLine = createElement('span', 'rcpoc-meta-line');
    var typeValue = displayField(record, 'expenseType');
    var dateValue = displayField(record, 'receiptDate');
    var merchantValue = displayField(record, 'merchant');
    var merchantLine = createElement(
      'span',
      'rcpoc-merchant' + (merchantValue.pending ? ' is-pending' : ''),
      merchantValue.text
    );
    var payment = displayPayment(record);
    var paymentChip = createElement(
      'span',
      'rcpoc-payment-chip' + (payment.pending ? ' is-pending' : ''),
      payment.text
    );
    var foot = buildCardFoot(record);

    card.setAttribute('data-record-key', record.key);
    setAttribute(face, 'type', 'button');
    setAttribute(face, 'data-record-key', record.key);
    setAttribute(face, 'aria-label', buildOpenLabel(record));

    appendChildren(face, buildMedia(record), top, overlay);
    top.appendChild(statusPill);

    appendChildren(
      metaLine,
      createElement('span', 'rcpoc-meta-item', 'Type: ' + typeValue.text),
      createElement('span', 'rcpoc-meta-item', 'Date: ' + dateValue.text)
    );

    appendChildren(overlay, amountLine, metaLine, merchantLine, paymentChip);
    card.appendChild(face);
    card.appendChild(foot);
    return card;
  }

  function buildCardFoot(record) {
    var foot = createElement('div', 'rcpoc-card-foot');
    var note = createElement('span', 'rcpoc-doc-note', documentNote(record));
    var preview = isHeicRecord(record) ? heicPreviewFor(record) : null;
    var retry;
    var original;

    foot.appendChild(note);

    if (record.documentState === 'error') {
      retry = createElement('button', 'rcpoc-retry-doc', 'Retry preview');
      setAttribute(retry, 'type', 'button');
      setAttribute(retry, 'data-record-key', record.key);
      foot.appendChild(retry);
    } else if (preview && preview.state === 'failed') {
      retry = createElement('button', 'rcpoc-retry-doc', 'Retry preview');
      setAttribute(retry, 'type', 'button');
      setAttribute(retry, 'data-record-key', record.key);
      foot.appendChild(retry);

      original = buildOriginalLink(record);

      if (original) {
        original.className = original.className + ' rcpoc-card-download';
        foot.appendChild(original);
      }
    }

    return foot;
  }

  function buildOpenLabel(record) {
    var meta = statusMeta(record.status);
    var merchant;
    var date;

    if (!meta.analyzed) {
      return 'Open receipt. Status ' + meta.label + '.';
    }

    merchant = displayField(record, 'merchant').text;
    date = displayField(record, 'receiptDate').text;

    return 'Open receipt from ' + merchant + ' dated ' + date + '. Status ' + meta.label + '.';
  }

  function buildMedia(record) {
    var media = createElement('span', 'rcpoc-media');
    var kind;
    var image;
    var tile;

    if (record.documentState === 'loading') {
      appendChildren(
        media,
        createElement('span', 'rcpoc-media-loading', 'Loading preview\u2026')
      );
      return media;
    }

    if (record.documentState === 'error') {
      appendChildren(
        media,
        buildDocumentTile(
          record,
          'Preview unavailable',
          'The receipt file could not be loaded. Open the card to retry.'
        )
      );
      return media;
    }

    kind = documentKind(record);

    if (kind === 'image' && record.documentUrl !== '') {
      image = createElement('img', 'rcpoc-receipt-image');
      setAttribute(image, 'alt', buildImageAlt(record));
      setAttribute(image, 'loading', 'lazy');
      setAttribute(image, 'decoding', 'async');
      image.onerror = function () {
        handleImageFailure(record);
      };
      image.src = record.documentUrl;
      media.appendChild(image);
      return media;
    }

    if (kind === 'pdf') {
      appendChildren(
        media,
        buildDocumentTile(record, 'PDF', 'Open this card to view the PDF document.')
      );
      return media;
    }

    if (kind === 'heic') {
      return buildHeicMedia(record);
    }

    tile = buildDocumentTile(
      record,
      kind === 'unsupported' ? 'FILE' : 'PREVIEW',
      record.documentUrl === ''
        ? 'Open this card to load the receipt preview.'
        : 'Open this card to open the original attachment.'
    );

    media.appendChild(tile);
    return media;
  }

  function buildDocumentTile(record, label, note) {
    var tile = createElement('span', 'rcpoc-document-tile');
    var mark = createElement('span', 'rcpoc-document-mark', label);
    var title = createElement(
      'span',
      'rcpoc-document-title',
      record.fileName || record.fileType || 'Receipt attachment'
    );
    var detail = createElement('span', 'rcpoc-document-detail', note);

    appendChildren(tile, mark, title, detail);
    return tile;
  }

  function buildImageAlt(record) {
    var meta = statusMeta(record.status);
    var merchant;
    var date;

    if (!meta.analyzed) {
      return 'Receipt image; analysis is not available.';
    }

    merchant = displayField(record, 'merchant').text;
    date = displayField(record, 'receiptDate').text;

    return 'Receipt image from ' + merchant + ', ' + date;
  }

  function handleImageFailure(record) {
    record.documentState = 'error';
    record.documentError = 'The receipt image could not be displayed.';

    updateCardForRecord(record);

    if (state.activeDialogKey === record.key) {
      updateDialogMedia(record);
    }

    updateStatusLine();
  }

  function findRecordByKey(key) {
    var wanted = toText(key);
    var records = currentRecords();
    var index;

    for (index = 0; index < records.length; index++) {
      if (records[index].key === wanted) {
        return records[index];
      }
    }

    return null;
  }

  function findCardFace(key) {
    var faces;
    var index;

    if (!rootNode || !rootNode.getElementsByClassName) {
      return null;
    }

    faces = rootNode.getElementsByClassName('rcpoc-card-face');

    for (index = 0; index < faces.length; index++) {
      if (faces[index].getAttribute('data-record-key') === key) {
        return faces[index];
      }
    }

    return null;
  }

  function updateCardForRecord(record) {
    var face = findCardFace(record.key);
    var card;
    var media;
    var foot;

    if (!face || !face.parentNode) {
      return;
    }

    card = face.parentNode;
    media = findDescendant(face, 'rcpoc-media');
    foot = findDescendant(card, 'rcpoc-card-foot');

    if (media) {
      clearNode(media);
      appendChildren(media, buildMedia(record));
    }

    if (foot) {
      clearNode(foot);
      appendChildren(foot, buildCardFoot(record));
    }
  }

  // -------------------------------------------------------------------------
  // Thumbnail hydration
  // -------------------------------------------------------------------------

  function hydrateVisibleRecords(generation) {
    var storage;
    var services;
    var visible;
    var filtered;
    var pending;
    var index;

    if (state.mode !== 'live' || state.hydrating) {
      if (state.hydrating) {
        state.hydrateAgain = true;
      }
      return;
    }

    storage = storageObject();
    services = servicesObject();

    if (!storage || !services) {
      return;
    }

    filtered = filterRecords(currentRecords(), state.search, state.statusFilter);
    visible = filtered.slice(0, state.visibleCount);
    pending = [];

    for (index = 0; index < visible.length; index++) {
      if (visible[index].documentState === 'none') {
        visible[index].documentState = 'loading';
        updateCardForRecord(visible[index]);
        pending.push(visible[index]);
      }
    }

    if (pending.length === 0) {
      return;
    }

    state.hydrating = true;
    renderHeaderState();

    runSerialDocumentFetches(
      pending,
      services,
      storage,
      function () {
        return isActiveGeneration(generation);
      },
      function (record) {
        if (!isActiveGeneration(generation)) {
          return;
        }

        updateCardForRecord(record);

        if (state.activeDialogKey === record.key) {
          updateDialogMedia(record);
        }

        renderHeaderState();
        updateStatusLine();
      },
      function () {
        if (!isActiveGeneration(generation)) {
          return;
        }

        state.hydrating = false;

        if (state.hydrateAgain) {
          state.hydrateAgain = false;
          hydrateVisibleRecords(generation);
        }
      },
      requestRecordDocument
    );
  }

  function startDocumentLoad(record) {
    var storage = storageObject();
    var services = servicesObject();
    var generation = state.generation;

    if (!record) {
      return;
    }

    if (record.documentState === 'ready') {
      return;
    }

    record.documentState = 'loading';
    record.documentError = '';
    updateCardForRecord(record);

    if (state.activeDialogKey === record.key) {
      updateDialogMedia(record);
    }

    requestRecordDocument(record, services, storage, function () {
      if (!isActiveGeneration(generation)) {
        return;
      }

      updateCardForRecord(record);

      if (state.activeDialogKey === record.key) {
        updateDialogMedia(record);
      }

      renderHeaderState();
      updateStatusLine();
    });
  }

  // -------------------------------------------------------------------------
  // Preview dialog
  // -------------------------------------------------------------------------

  function openRecordDialog(record) {
    var doc = documentObject();
    var layer;
    var backdrop;
    var panel;
    var header;
    var title;
    var titleText;
    var merchantDisplay;
    var badges;
    var close;
    var body;
    var media;
    var details;
    var footer;
    var footerClose;
    var original;
    var needsLoad;

    if (!record || !rootNode || !doc) {
      return;
    }

    closeDialog();

    state.lastFocus = doc.activeElement;
    state.activeDialogKey = record.key;
    needsLoad = record.documentState === 'none';

    if (needsLoad) {
      record.documentState = 'loading';
    }

    layer = createElement('div', 'rcpoc-dialog-layer');
    backdrop = createElement('div', 'rcpoc-dialog-backdrop');
    panel = createElement('div', 'rcpoc-dialog');
    panel.id = 'receiptCardsPocDialog';
    setAttribute(panel, 'role', 'dialog');
    setAttribute(panel, 'aria-modal', 'true');
    setAttribute(panel, 'aria-labelledby', 'rcpoc-dialog-title');
    setAttribute(panel, 'aria-describedby', 'rcpoc-dialog-details');

    header = createElement('div', 'rcpoc-dialog-header');
    title = createElement('div', 'rcpoc-dialog-heading');
    merchantDisplay = displayField(record, 'merchant');

    if (statusMeta(record.status).analyzed && merchantDisplay.text !== 'Not provided') {
      titleText = createElement('h2', 'rcpoc-dialog-title', merchantDisplay.text);
    } else {
      titleText = createElement('h2', 'rcpoc-dialog-title', 'Receipt');
    }

    titleText.id = 'rcpoc-dialog-title';
    badges = createElement('div', 'rcpoc-dialog-badges');
    close = createElement('button', 'rcpoc-dialog-close', '\u00d7');

    setAttribute(close, 'type', 'button');
    setAttribute(close, 'aria-label', 'Close receipt preview');

    badges.appendChild(
      createElement(
        'span',
        'rcpoc-status-pill rcpoc-status-pill-' + statusMeta(record.status).tone,
        statusMeta(record.status).label
      )
    );

    appendChildren(title, titleText, badges);
    appendChildren(header, title, close);

    body = createElement('div', 'rcpoc-dialog-body');
    media = createElement('div', 'rcpoc-dialog-media');
    media.id = 'rcpoc-dialog-media';
    details = buildDialogDetails(record);
    details.id = 'rcpoc-dialog-details';

    appendChildren(body, media, details);

    footer = createElement('div', 'rcpoc-dialog-footer');
    footerClose = createElement('button', 'rcpoc-btn rcpoc-btn-quiet rcpoc-dialog-footer-close', 'Close');
    setAttribute(footerClose, 'type', 'button');
    footer.appendChild(footerClose);

    original = buildOriginalLink(record);

    if (original) {
      footer.appendChild(original);
    }

    appendChildren(panel, header, body, footer);
    appendChildren(backdrop, panel);
    appendChildren(layer, backdrop);
    rootNode.appendChild(layer);
    dialogNode = layer;

    appendDialogMedia(record);

    close.onclick = function () {
      closeDialog();
    };
    footerClose.onclick = function () {
      closeDialog();
    };
    backdrop.onclick = function (event) {
      if (event.target === backdrop) {
        closeDialog();
      }
    };
    panel.onkeydown = onDialogKeyDown;

    close.focus();

    if (needsLoad) {
      startDocumentLoad(record);
    }
  }

  function buildDialogDetails(record) {
    var details = createElement('section', 'rcpoc-dialog-details');
    var heading = createElement('h3', 'rcpoc-dialog-details-title', 'Receipt details');
    var list = createElement('dl', 'rcpoc-detail-list');
    var meta = statusMeta(record.status);
    var row;
    var note;

    appendChildren(details, heading);

    row = buildDetailRow('Amount', displayField(record, 'totalAmount'));
    list.appendChild(row);
    list.appendChild(buildDetailRow('Expense type', displayField(record, 'expenseType')));
    list.appendChild(buildDetailRow('Date', displayField(record, 'receiptDate')));
    list.appendChild(buildDetailRow('Merchant', displayField(record, 'merchant')));
    list.appendChild(buildDetailRow('Location', displayField(record, 'location')));
    list.appendChild(buildDetailRow('Department', displayField(record, 'department')));
    list.appendChild(buildDetailRow('Status', { text: meta.label, pending: false }));
    list.appendChild(buildDetailRow('Payment', displayPayment(record)));
    list.appendChild(
      buildDetailRow('File', {
        text: toText(record.fileName) || toText(record.fileType) || 'Not provided',
        pending: false
      })
    );
    list.appendChild(
      buildDetailRow('Receipt ID', {
        text: toText(record.id) || 'Not provided',
        pending: false
      })
    );

    details.appendChild(list);

    if (meta.pending) {
      note = createElement(
        'p',
        'rcpoc-dialog-note',
        'Analysis is still in progress. Metadata will appear after processing.'
      );
      details.appendChild(note);
    } else if (meta.key === 'LINE_FAILED') {
      note = createElement(
        'p',
        'rcpoc-dialog-note',
        'Receipt analysis is available. Creating the report line failed.'
      );
      details.appendChild(note);
    } else if (meta.failed) {
      note = createElement(
        'p',
        'rcpoc-dialog-note',
        'Analysis did not complete for this receipt. No analyzed values are shown.'
      );
      details.appendChild(note);
    }

    return details;
  }

  function buildDetailRow(label, display) {
    var row = createElement('div', 'rcpoc-detail-row');
    var term = createElement('dt', 'rcpoc-detail-term', label);
    var value = createElement(
      'dd',
      'rcpoc-detail-value' + (display.pending ? ' is-pending' : ''),
      display.text
    );

    appendChildren(row, term, value);
    return row;
  }

  function buildOriginalLink(record) {
    var checked;
    var link;
    var label;

    if (!record || record.documentState === 'loading' || record.documentUrl === '') {
      return null;
    }

    checked = sanitizeUrl(record.documentUrl);

    if (!checked.safe) {
      return null;
    }

    link = createElement('a', 'rcpoc-btn rcpoc-btn-quiet rcpoc-original-link', 'Open original file');
    setAttribute(link, 'href', checked.url);
    setAttribute(link, 'target', '_blank');
    setAttribute(link, 'rel', 'noopener noreferrer');

    if (documentKind(record) === 'heic') {
      label = 'Open or download HEIC file';
      link.textContent = label;
      setAttribute(link, 'download', record.fileName || 'receipt.heic');
    }

    return link;
  }

  function appendDialogMedia(record) {
    var media = documentObject() ? documentObject().getElementById('rcpoc-dialog-media') : null;
    var kind;
    var image;
    var iframe;
    var preview;

    if (!media) {
      return;
    }

    clearNode(media);

    if (record.documentState === 'loading') {
      appendChildren(
        media,
        createElement('div', 'rcpoc-dialog-loading', 'Loading receipt preview\u2026')
      );
      return;
    }

    if (record.documentState === 'error') {
      appendChildren(
        media,
        buildDialogDocumentFallback(
          record,
          'Preview unavailable',
          record.documentError || 'The receipt file could not be loaded.'
        )
      );
      return;
    }

    if (record.documentUrl === '') {
      appendChildren(
        media,
        buildDialogDocumentFallback(
          record,
          'No preview',
          'No document URL was returned for this receipt.'
        )
      );
      return;
    }

    kind = documentKind(record);

    if (kind === 'image') {
      image = createElement('img', 'rcpoc-dialog-image');
      setAttribute(image, 'alt', buildImageAlt(record));
      image.onerror = function () {
        handleImageFailure(record);
      };
      image.src = record.documentUrl;
      media.appendChild(image);
      return;
    }

    if (kind === 'pdf') {
      iframe = createElement('iframe', 'rcpoc-dialog-pdf');
      setAttribute(iframe, 'title', 'PDF receipt preview');
      setAttribute(iframe, 'src', record.documentUrl);
      setAttribute(iframe, 'referrerpolicy', 'no-referrer');
      media.appendChild(iframe);
      return;
    }

    if (kind === 'heic') {
      preview = heicPreviewFor(record);

      if (preview.state === 'pending') {
        appendChildren(
          media,
          createElement('div', 'rcpoc-dialog-loading', HEIC_PREVIEW_PENDING_TEXT)
        );
        return;
      }

      if (preview.state === 'failed') {
        appendChildren(
          media,
          buildDialogDocumentFallback(
            record,
            'HEIC image',
            preview.error || HEIC_PREVIEW_FAILURE_TEXT,
            {
              retry: true,
              onRetry: function () {
                retryHeicPreview(record);
              }
            }
          )
        );
        return;
      }

      if (preview.state === 'ready' && preview.objectUrl !== '') {
        media.appendChild(
          buildHeicImage(record, preview.objectUrl, true, 'rcpoc-dialog-image')
        );
        return;
      }

      media.appendChild(
        buildHeicImage(record, record.documentUrl, false, 'rcpoc-dialog-image')
      );
      return;
    }

    appendChildren(
      media,
      buildDialogDocumentFallback(
        record,
        'Document attachment',
        'This file type cannot be previewed here. Use the button below to open the original.'
      )
    );
  }

  function buildDialogDocumentFallback(record, label, note, options) {
    var wrapper = createElement('div', 'rcpoc-dialog-fallback');
    var mark = createElement('div', 'rcpoc-dialog-fallback-mark', label);
    var title = createElement(
      'div',
      'rcpoc-dialog-fallback-title',
      record.fileName || record.fileType || 'Receipt attachment'
    );
    var text = createElement('p', 'rcpoc-dialog-fallback-text', note);
    var actions = createElement('div', 'rcpoc-dialog-fallback-actions');
    var link = buildOriginalLink(record);
    var retry;
    var retryRequested = record.documentState === 'error' || (options && options.retry === true);

    appendChildren(wrapper, mark, title, text);

    if (retryRequested) {
      retry = createElement('button', 'rcpoc-btn rcpoc-btn-primary rcpoc-dialog-retry', 'Retry preview');
      setAttribute(retry, 'type', 'button');
      retry.onclick = function () {
        if (options && typeof options.onRetry === 'function') {
          options.onRetry();
          return;
        }

        startDocumentLoad(record);
      };
      actions.appendChild(retry);
    }

    if (link) {
      actions.appendChild(link);
    }

    if (actions.childNodes.length) {
      wrapper.appendChild(actions);
    }

    return wrapper;
  }

  function updateDialogMedia(record) {
    if (!dialogNode || state.activeDialogKey !== record.key) {
      return;
    }

    appendDialogMedia(record);

    var footer = findDescendant(dialogNode, 'rcpoc-dialog-footer');
    var original = buildOriginalLink(record);
    var oldLink = footer ? findDescendant(footer, 'rcpoc-original-link') : null;

    if (footer && oldLink) {
      footer.removeChild(oldLink);
    }

    if (footer && original) {
      footer.appendChild(original);
    }
  }

  function onDialogKeyDown(event) {
    var key = event.key || String(event.keyCode || '');
    var focusable;
    var first;
    var last;
    var active;

    if (key === 'Escape' || key === 'Esc' || key === '27') {
      event.preventDefault();
      closeDialog();
      return;
    }

    if (key !== 'Tab' && key !== '9') {
      return;
    }

    focusable = dialogFocusableElements();

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    first = focusable[0];
    last = focusable[focusable.length - 1];
    active = documentObject().activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function dialogFocusableElements() {
    var panel = dialogNode ? findDescendant(dialogNode, 'rcpoc-dialog') : null;
    var nodes;
    var focusable = [];
    var index;

    if (!panel || !panel.querySelectorAll) {
      return focusable;
    }

    nodes = panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    for (index = 0; index < nodes.length; index++) {
      if (
        !nodes[index].disabled &&
        (
          nodes[index].offsetParent !== null ||
          (nodes[index].getClientRects && nodes[index].getClientRects().length > 0)
        )
      ) {
        focusable.push(nodes[index]);
      }
    }

    return focusable;
  }

  function closeDialog() {
    var focusTarget = state.lastFocus;
    var card;
    var doc = documentObject();

    if (dialogNode && dialogNode.parentNode) {
      dialogNode.parentNode.removeChild(dialogNode);
    }

    dialogNode = null;
    state.activeDialogKey = '';

    if (!doc) {
      state.lastFocus = null;
      return;
    }

    if (focusTarget && focusTarget.focus && doc.documentElement.contains(focusTarget)) {
      state.lastFocus = null;
      focusTarget.focus();
      return;
    }

    card = findCardFace(focusTarget && focusTarget.getAttribute
      ? focusTarget.getAttribute('data-record-key')
      : '');

    if (card && card.focus) {
      card.focus();
    }

    state.lastFocus = null;
  }

  // -------------------------------------------------------------------------
  // Test surface. The page action is still only receiptCardsPocOnLoad.
  // -------------------------------------------------------------------------

  return {
    onLoad: onLoad,
    __test: {
      serviceName: SERVICE_NAME,
      statuses: STATUSES,
      thumbnailBatchSize: THUMBNAIL_BATCH_SIZE,
      normalizeStatus: normalizeStatus,
      statusMeta: statusMeta,
      sanitizeUrl: sanitizeUrl,
      displayField: displayField,
      displayPayment: displayPayment,
      formatDateDisplay: formatDateDisplay,
      filterRecords: filterRecords,
      normalizeReturnedRow: normalizeReturnedRow,
      readLoadResponseRows: readLoadResponseRows,
      buildRecordsFromRows: buildRecordsFromRows,
      buildRecordsFromLoadResponse: buildRecordsFromLoadResponse,
      responseErrorText: responseErrorText,
      findSharedReceiptLoader: findSharedReceiptLoader,
      startReceiptListRequest: startReceiptListRequest,
      snapshotLiveRecords: snapshotLiveRecords,
      receiptRecordCount: receiptRecordCount,
      fetchRecordDocumentWith: fetchRecordDocumentWith,
      runSerialDocumentFetches: runSerialDocumentFetches,
      documentKind: documentKind,
      fileExtension: fileExtension,
      documentNote: documentNote,
      isHeicRecord: isHeicRecord,
      heicPreviewFor: heicPreviewFor,
      startHeicConversion: startHeicConversion,
      retryHeicPreview: retryHeicPreview,
      resetHeicPreview: resetHeicPreview,
      revokeAllHeicPreviews: revokeAllHeicPreviews,
      buildOriginalLink: buildOriginalLink,
      uploadFileExtension: uploadFileExtension,
      isSupportedUploadFile: isSupportedUploadFile,
      makeUploadFilenameSafe: makeUploadFilenameSafe,
      rawBase64: rawBase64,
      runUploadBatch: runUploadBatch,
      handleUploadSelection: handleUploadSelection,
      attachTestRoot: function (node) {
        rootNode = node || null;
        $rootNode = null;
      },
      setTestRecords: function (records) {
        state.records = records || [];
      },
      setTestGeneration: function (generation) {
        state.generation = parseInt(generation, 10) || 0;
      },
      setTestMode: function (mode) {
        state.mode = mode || 'live';
      },
      getState: function () {
        return state;
      }
    }
  };
})();

function receiptCardsPocOnLoad() {
  ReceiptCardsPoc.onLoad();
}
