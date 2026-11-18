// The page renders itself, including styles and Close buttons, from this section.
function reportMessageValue(row, field) {
    var value = row['RECEIPTBATCH_' + field];
    return value === null || value === undefined ? '' : String(value).trim();
}

function reportMessageModel(row) {
    var message = reportMessageValue(row, 'ERROR_MESSAGE');
    var credit = reportMessageValue(row, 'CREDIT');
    var isCredit = Boolean(credit && !/^(null|0|-1)$/i.test(credit)) ||
        /credit/i.test(reportMessageValue(row, 'PAYMENT_TYPE'));
    var status = reportMessageValue(row, 'STATUS');
    var severity = /^Warning\b/i.test(message) ? 'warning' :
        (status === 'LINE_FAILED' || /^Error\b/i.test(message) ? 'error' : 'message');
    return {
        receiptId: reportMessageValue(row, 'RECEIPT_ID'),
        credit: isCredit,
        status: status,
        severity: severity,
        message: message,
        identity: reportMessageValue(row, isCredit ? 'CARD_ACCOUNT' : 'EXPENSE_TYPE') || 'Not available',
        date: reportMessageValue(row, isCredit ? 'TRANSACTION_DATE' : 'RECEIPT_DATE') || 'Not available',
        amount: reportMessageValue(row, isCredit ? 'TRANSACTION_AMOUNT' : 'TOTAL_AMOUNT'),
        currency: reportMessageValue(row, isCredit ? 'TRANSACTION_CURRENCY' : 'CURRENCY').split(' - ')[0]
    };
}

function reportMessageAmount(model) {
    if (!model.amount) { return 'Not available'; }
    var number = Number(model.amount);
    var amount = isFinite(number) ? number.toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    }) : model.amount;
    return amount + (model.currency ? ' ' + model.currency : '');
}

function reportMessagesClose() {
    if (window.parent !== window && typeof window.parent.closeReportMessages === 'function') {
        window.parent.closeReportMessages();
    } else if (window.parent !== window && window.parent.Popup) {
        window.parent.Popup.closePage();
    } else {
        Page.navigate('Update_Reports.html');
    }
}

function reportMessagesField(label, value, fullWidth) {
    var field = $('<div class="rm-field"></div>');
    if (fullWidth) { field.addClass('rm-wide'); }
    $('<dt></dt>').text(label).appendTo(field);
    $('<dd></dd>').text(value).appendTo(field);
    return field;
}

function renderReportMessage(model) {
    var card = $('<article class="rm-card"></article>');
    var heading = $('<div class="rm-card-heading"></div>').appendTo(card);
    $('<span aria-hidden="true"></span>').addClass(model.credit ? 'fa fa-credit-card' : 'fa fa-money').appendTo(heading);
    $('<h2></h2>').text(model.credit ? 'Credit Card' : 'Cash').appendTo(heading);
    var statuses = { LINE_CREATED: 'Created', LINE_FAILED: 'Failed', SUBMITTED: 'Submitted', READY: 'Ready' };
    $('<span class="rm-result"></span>').toggleClass('rm-failed', model.status === 'LINE_FAILED')
        .text(statuses[model.status] || model.status).appendTo(heading);
    var details = $('<dl class="rm-details"></dl>').appendTo(card);
    details.append(reportMessagesField(model.credit ? 'Account' : 'Expense Type', model.identity, true));
    details.append(reportMessagesField('Date', model.date));
    details.append(reportMessagesField('Amount', reportMessageAmount(model)));
    var message = $('<div class="rm-message"></div>').addClass('rm-' + model.severity).appendTo(card);
    var title = $('<strong></strong>').appendTo(message);
    $('<span class="fa fa-exclamation-triangle" aria-hidden="true"></span>').appendTo(title);
    title.append(document.createTextNode(model.severity === 'warning' ? ' EBS warning' :
        (model.severity === 'error' ? ' EBS error' : ' EBS message')));
    $('<p></p>').text(model.message).appendTo(message);
    return card;
}

function initializeReportMessages() {
    if ($('#reportMessagesRoot').length) { return; }
    // Popup.asIframe injects a page fragment, which has no #content wrapper.
    var content = $('#content');
    if (!content.length) {
        var page = $('div[data-role="page"]').first();
        if (!page.length) { page = $('<div id="mainPage" data-role="page"></div>').appendTo('body'); }
        content = $('<div id="content"></div>').appendTo(page);
    }
    var styles = [
        'html,body{margin:0!important;padding:0!important;height:100%;overflow:hidden;background:#fff}',
        '#mainPage,#content,div[data-role="page"]{margin:0!important;padding:0!important;width:100%!important;max-width:none!important;background:#fff}',
        '#header,#header-title,#leftpanel,#mainForm{display:none!important}',
        '#reportMessagesRoot{height:100vh;height:100dvh;display:flex;flex-direction:column;box-sizing:border-box;color:#1e293b;font:15px/1.45 Arial,sans-serif;text-shadow:none}',
        '#reportMessagesRoot *{box-sizing:border-box;text-shadow:none}',
        '.rm-header{display:flex;gap:12px;align-items:flex-start;padding:18px 18px 12px;border-bottom:1px solid #e2e8f0;flex:none}',
        '.rm-header h1{font-size:22px;margin:0;font-weight:700}.rm-header p{margin:3px 0 0;color:#64748b;overflow-wrap:anywhere}',
        '.rm-header>div{min-width:0;flex:1}.rm-x{width:44px;height:44px;margin:0;padding:0;font-size:28px;color:#475569;border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px}',
        '.rm-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:14px 18px;overscroll-behavior:contain}',
        '.rm-summary{margin:0 0 12px;color:#854d0e;font-weight:700}.rm-summary:empty{display:none}',
        '.rm-card{border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin:0 0 12px;background:#fff;min-width:0}',
        '.rm-card-heading{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.rm-card-heading>.fa{color:#1663a6;font-size:22px}',
        '.rm-card h2{font-size:18px;margin:0;flex:1}.rm-result{font-size:12px;color:#166534;background:#f0fdf4;border-radius:20px;padding:3px 8px}.rm-result.rm-failed{color:#991b1b;background:#fef2f2}',
        '.rm-details{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin:12px 0}.rm-wide{grid-column:1/-1}',
        '.rm-field{min-width:0}.rm-field dt{color:#64748b;font-size:13px;font-weight:400}.rm-field dd{margin:2px 0 0;font-size:15px;font-weight:700;overflow-wrap:anywhere}',
        '.rm-message{border:1px solid #cbd5e1;border-radius:8px;padding:11px;background:#f8fafc;overflow-wrap:anywhere;word-break:normal}',
        '.rm-warning{border-color:#f5c36a;background:#fff8e8}.rm-warning strong{color:#925300}.rm-error{border-color:#f4abab;background:#fff2f2}.rm-error strong{color:#a11a1a}',
        '.rm-message p{margin:6px 0 0;white-space:pre-wrap}.rm-footer{flex:none;padding:12px 18px;padding-bottom:max(12px,env(safe-area-inset-bottom));border-top:1px solid #e2e8f0}',
        '.rm-close{width:100%;min-height:44px;border:0;border-radius:8px;background:#0969c8;color:white;font:700 16px Arial,sans-serif;margin:0}',
        '.rm-empty{padding:20px 0;color:#475569}.rm-x:focus-visible,.rm-close:focus-visible{outline:3px solid #78b8f6;outline-offset:2px}',
        '@media(max-width:360px){.rm-header{padding:12px}.rm-scroll{padding:12px}.rm-footer{padding:10px 12px}.rm-card{padding:11px}.rm-header h1{font-size:20px}}'
    ].join('\n');
    $('<style id="reportMessagesStyles"></style>').text(styles).appendTo('head');
    var root = $('<section id="reportMessagesRoot" aria-label="Report messages"></section>').appendTo(content);
    var header = $('<header class="rm-header"><div><h1>Report messages</h1><p id="rmReportNumber"></p></div></header>').appendTo(root);
    $('<button type="button" class="rm-x" aria-label="Close report messages">&times;</button>').on('click', reportMessagesClose).appendTo(header);
    var scroll = $('<main class="rm-scroll" tabindex="0"></main>').appendTo(root);
    $('<p id="rmSummary" class="rm-summary" role="status"></p>').appendTo(scroll);
    var list = $('<div id="rmMessages" aria-live="polite"></div>').appendTo(scroll);
    var footer = $('<footer class="rm-footer"></footer>').appendTo(root);
    $('<button type="button" class="rm-close">Close</button>').on('click', reportMessagesClose).appendTo(footer);
    $(document).on('keydown.reportMessages', function (event) {
        if (event.key === 'Escape') { reportMessagesClose(); }
        if (event.key === 'Tab') {
            var first = root.find('.rm-x')[0], last = root.find('.rm-close')[0];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    var context = window.parent !== window ? window.parent.reportMessagesContext : null;
    var reportNumber = context && context.reportNumber;
    $('#rmReportNumber').text(reportNumber || 'No report selected');
    if (window.frameElement) { window.frameElement.title = 'Report messages'; }
    root.find('.rm-x').focus();
    if (!reportNumber || !/^[A-Za-z0-9_-]+$/.test(reportNumber)) {
        $('<p class="rm-empty"></p>').text('Open messages from an expense report.').appendTo(list);
        return;
    }
    $('<p class="rm-empty"></p>').text('Loading EBS messages…').appendTo(list);
    var request = $.ajax({
        url: getServiceManagerHost() + '/ServiceManager/Macro/ExecMacro/ReceiptBatch_get_draft_report_lines',
        type: 'POST', headers: generateHeaders(), dataType: 'json', timeout: Services.getTimeout(),
        data: { REPORT_NUMBER: reportNumber, json: true, randomSeed: Math.random() * 1000000, 'meta.app': App.getName() }
    }).done(function (response) {
        var data = response && response.Response;
        var info = data && data.ReceiptBatch_get_draft_report_linesMessage;
        if (!data || (info && info.Error)) {
            list.empty().append($('<p class="rm-empty"></p>').text('Could not load EBS messages. Close this window and try again.'));
            return;
        }
        var table = data.ReceiptBatch_get_draft_report_linesTableArray;
        var rows = table && table.ReceiptBatch_get_draft_report_linesArrayItem;
        rows = rows ? (Array.isArray(rows) ? rows : [rows]) : [];
        var models = rows.filter(function (row) { return row && reportMessageValue(row, 'ERROR_MESSAGE'); }).map(reportMessageModel);
        list.empty();
        if (!models.length) {
            $('<p class="rm-empty"></p>').text('No saved EBS messages for this report.').appendTo(list);
            return;
        }
        var counts = { warning: 0, error: 0, message: 0 };
        models.forEach(function (model) { counts[model.severity]++; list.append(renderReportMessage(model)); });
        var summary = [];
        ['warning', 'error', 'message'].forEach(function (kind) {
            if (counts[kind]) { summary.push(counts[kind] + ' ' + kind + (counts[kind] === 1 ? '' : 's')); }
        });
        $('#rmSummary').text(summary.join(' · '));
    }).fail(function (xhr, status) {
        if (status !== 'abort') {
            list.empty().append($('<p class="rm-empty"></p>').text('Could not load EBS messages. Close this window and try again.'));
        }
    });
    $(window).on('pagehide.reportMessages', function () { if (request && request.abort) { request.abort(); } });
}

$(initializeReportMessages);
