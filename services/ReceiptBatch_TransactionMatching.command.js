// Automatic card matching for receipt batches. The expense category belongs
// to the receipt and is independent of the transaction match.
var LOOKUP_LIMIT = 500;
var user = text(ServiceManager.getInput('EBS_USER')).toUpperCase();

function text(value) {
  var result = value === undefined || value === null ? '' : String(value).trim();
  return /^(?:\.?null|undefined)$/i.test(result) ? '' : result;
}

function normalizedText(value) {
  return text(value).replace(/\s+/g, ' ').toLowerCase();
}

function normalizedLocation(value) {
  return normalizedText(value).replace(/\s*,\s*/g, ',');
}

function normalizeDate(value) {
  var dateText = text(value);
  var display = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(dateText);
  if (display) {
    var month = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ')
      .indexOf(display[2].toLowerCase()) + 1;
    if (!month) {
      return '';
    }
    dateText = display[3] + '-' + ('0' + month).slice(-2) + '-' + ('0' + display[1]).slice(-2);
  }
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return '';
  }
  var date = new Date(dateText + 'T00:00:00Z');
  return isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateText ? dateText : '';
}

// Compare signed decimals exactly, without converting them to floating point.
function normalizeAmount(value) {
  var match = /^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(text(value));
  if (!match) {
    return '';
  }
  var whole = match[2].replace(/,/g, '').replace(/^0+(?=\d)/, '');
  var fraction = (match[3] || '').replace(/0+$/, '');
  var sign = match[1] === '-' && (whole !== '0' || fraction) ? '-' : '';
  return sign + whole + (fraction ? '.' + fraction : '');
}

function receiptKey(date, amount) {
  var day = normalizeDate(date);
  var total = normalizeAmount(amount);
  return day && total ? day + '|' + total : '';
}

// Code Assist table outputs are column arrays, with the same index per row.
function readColumns(response, fields) {
  var columns = {};
  var count;
  for (var field = 0; field < fields.length; field++) {
    var name = fields[field];
    var values = ServiceManager.getResponseArray(response, name) || [];
    if (field === 0) {
      count = values.length;
    } else if (values.length !== count) {
      throw new Error('Matching response columns are not aligned: ' + name);
    }
    columns[name] = values;
  }
  return columns;
}

function resolveCandidate(candidates, merchant, location) {
  if (candidates.length > 1) {
    candidates = candidates.filter(function (transaction) {
      return merchant !== '' && transaction.merchant === merchant;
    });
  }
  if (candidates.length > 1) {
    candidates = candidates.filter(function (transaction) {
      return location !== '' && transaction.location === location;
    });
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function matchReceipts() {
  if (user === '') {
    throw new Error('EBS_USER is required for receipt matching');
  }

  var receiptResponse = Services.call('ReceiptBatch_get_by_userAndStatuses', {
    'EBS_USER': user,
    'ReceiptBatch_statuses': 'PROCESSED,READY',
    'numOfRowsInTable': String(LOOKUP_LIMIT + 1)
  });
  var error = text(ServiceManager.getResponseValue(receiptResponse, 'Error'));
  if (error && error !== '[]') {
    throw new Error('ReceiptBatch_get_by_userAndStatuses: ' + error);
  }
  var receipts = readColumns(receiptResponse, [
    'RECEIPTBATCH_RECEIPT_ID', 'RECEIPTBATCH_RECEIPT_DATE', 'RECEIPTBATCH_TOTAL_AMOUNT',
    'RECEIPTBATCH_MERCHANT', 'RECEIPTBATCH_LOCATION', 'RECEIPTBATCH_CREDIT'
  ]);
  var pending = [];
  var receiptIds = receipts.RECEIPTBATCH_RECEIPT_ID;
  for (var r = 0; r < receiptIds.length; r++) {
    var receiptId = text(receiptIds[r]);
    var key = receiptKey(receipts.RECEIPTBATCH_RECEIPT_DATE[r], receipts.RECEIPTBATCH_TOTAL_AMOUNT[r]);
    if (/^[1-9]\d*$/.test(receiptId) && key && !text(receipts.RECEIPTBATCH_CREDIT[r])) {
      pending.push({
        id: receiptId,
        key: key,
        merchant: normalizedText(receipts.RECEIPTBATCH_MERCHANT[r]),
        location: normalizedLocation(receipts.RECEIPTBATCH_LOCATION[r])
      });
    }
  }
  if (pending.length === 0) {
    return;
  }
  if (receiptIds.length > LOOKUP_LIMIT) {
    console.log('ReceiptBatch_TransactionMatching skipped: receipt list exceeds the lookup limit');
    return;
  }

  var transactionResponse = Services.call('ReceiptBatch_TransactionByUser', {
    'EBS_USER': user,
    'numOfRowsInTable': String(LOOKUP_LIMIT)
  });
  error = text(ServiceManager.getResponseValue(transactionResponse, 'Error'));
  if (error && error !== '[]') {
    throw new Error('ReceiptBatch_TransactionByUser: ' + error);
  }
  var transactions = readColumns(transactionResponse, [
    'TRANSACTION_ID', 'TRANSACTION_RECEIPT_DATE', 'TRANSACTION_AMOUNT',
    'TRANSACTION_MERCHANT', 'TRANSACTION_LOCATION', 'TRANSACTION_LINKED', 'TRANSACTION_TOTAL_COUNT'
  ]);
  var transactionIds = transactions.TRANSACTION_ID;
  if (transactionIds.length > 0 && Number(transactions.TRANSACTION_TOTAL_COUNT[0]) !== transactionIds.length) {
    console.log('ReceiptBatch_TransactionMatching skipped: transaction list was truncated');
    return;
  }

  var byDateAmount = {};
  for (var t = 0; t < transactionIds.length; t++) {
    var transactionId = text(transactionIds[t]);
    var transactionKey = receiptKey(transactions.TRANSACTION_RECEIPT_DATE[t], transactions.TRANSACTION_AMOUNT[t]);
    if (!/^[1-9]\d*$/.test(transactionId) || !transactionKey) {
      continue;
    }
    if (!byDateAmount[transactionKey]) {
      byDateAmount[transactionKey] = [];
    }
    byDateAmount[transactionKey].push({
      id: transactionId,
      merchant: normalizedText(transactions.TRANSACTION_MERCHANT[t]),
      location: normalizedLocation(transactions.TRANSACTION_LOCATION[t]),
      available: text(transactions.TRANSACTION_LINKED[t]) === 'N'
    });
  }

  // Resolve against all candidates before checking availability. A repeat
  // upload must not be redirected to a less suitable, unused transaction.
  var proposals = [];
  var claims = {};
  for (var i = 0; i < pending.length; i++) {
    var receipt = pending[i];
    var candidate = resolveCandidate(byDateAmount[receipt.key] || [], receipt.merchant, receipt.location);
    if (candidate && candidate.available) {
      proposals.push({ receiptId: receipt.id, transactionId: candidate.id });
      claims[candidate.id] = (claims[candidate.id] || 0) + 1;
    }
  }

  for (var p = 0; p < proposals.length; p++) {
    var proposal = proposals[p];
    if (claims[proposal.transactionId] === 1) {
      var updateResponse = Services.call('updateMatchingCreditTransaction', {
        'RECEIPT_ID': proposal.receiptId,
        'TRANSACTION_ID': proposal.transactionId
      });
      error = text(ServiceManager.getResponseValue(updateResponse, 'Error'));
      if (error && error !== '[]') {
        throw new Error('updateMatchingCreditTransaction: ' + error);
      }
    }
  }
}

matchReceipts();

return {};
