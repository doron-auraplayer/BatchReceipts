/*
 * LiveExpense_AI.Credit_Matching.Main.js
 *
 * Credit card selection and credit transaction loading for Credit_Matching.html.
 * Uses the AuraPlayer Lov/Fields/Storage/Services/Table/Popup conventions.
 */

var CREDIT_CARD_LOV_ELEMENT_ID = "CreditCardPoplist";
var CREDIT_MATCHING_DEFAULT_ORG_ID = "204"; // Deployment default: 204 = Vision Operations.
var CREDIT_MATCHING_DEFAULT_CURRENCY = "USD";
var CREDIT_MATCHING_DEFAULT_LANGUAGE = "US";
var CREDIT_MATCHING_DEFAULT_SECURITY_GROUP = "0";

var CREDIT_TRANSACTION_STORAGE_PREFIXES = [
    "Select_",
    "Matched_",
    "MatchReciptId_",
    "Match_",
    "TRANSACTION_ID_",
    "TRANSACTION_AMOUNT_",
    "TRANSACTION_DATE_ISO_",
    "TransactionDate_",
    "TransactionAmount_",
    "MerchantName_",
    "Location_",
    "AgeDays_",
    "CARD_ID_",
    "CARD_PROGRAM_ID_",
    "PAYMENT_DUE_FROM_CODE_",
    "POSTED_CURRENCY_CODE_",
    "BILLED_AMOUNT_",
    "BILLED_CURRENCY_CODE_",
    "REPORT_HEADER_ID_"
];

var creditTransactionsPending = false;
var creditApprovalPending = false;
var creditUsedPending = false;
var creditUsedReady = false;
var creditUsedFailed = false;
var creditUsedByTransaction = {};

function creditMatchingText(value) {
    return value === null || value === undefined ? "" : String(value).trim();
}

function creditMatchingStorageValue(key) {
    var value = creditMatchingText(Storage.get(key));
    return value !== "" ? value : creditMatchingText(Fields.get(key));
}

function isCreditMatchingDigits(value) {
    return /^\d+$/.test(value);
}

function getCreditMatchingActiveReceiptId() {
    var receiptId = "";

    try {
        if (window.parent && window.parent !== window) {
            receiptId = creditMatchingText(window.parent.activePreviewReceiptId);
        }
    } catch (ignoredParentProblem) {
        receiptId = "";
    }

    if (receiptId !== "") {
        return receiptId;
    }

    receiptId = creditMatchingText(Storage.get("receipt_ID"));
    return receiptId !== "" ? receiptId : creditMatchingText(Storage.get("RECEIPTBATCH_RECEIPT_ID"));
}

function normalizeCreditUsedTransactionKey(value) {
    var key = creditMatchingText(value).replace(/^0+/, "");
    return /^\d+$/.test(key) ? key : "";
}

function creditMatchingCurrentEbsUser() {
    return creditMatchingText(
        creditMatchingStorageValue("LoggedInUsername") ||
        creditMatchingStorageValue("EBS_USER")
    );
}

function creditUsedSnapshot() {
    return {
        ebsUser: creditMatchingCurrentEbsUser(),
        receiptId: getCreditMatchingActiveReceiptId(),
        cardId: creditMatchingText(Storage.get("CARD_ID"))
    };
}

function creditUsedSnapshotIsCurrent(snapshot) {
    return snapshot &&
        creditMatchingCurrentEbsUser() === snapshot.ebsUser &&
        getCreditMatchingActiveReceiptId() === snapshot.receiptId &&
        creditMatchingText(Storage.get("CARD_ID")) === snapshot.cardId;
}

function resetCreditUsedState() {
    creditUsedPending = false;
    creditUsedReady = false;
    creditUsedFailed = false;
    creditUsedByTransaction = {};
}

function creditUsedMapFromStorage() {
    var transactions = Storage.getArray("CREDIT_TRANSACTION");
    var receipts = Storage.getArray("RECEIPT_ID");
    var map = {};
    var key;
    var index;

    for (index = 0; index < transactions.length; index += 1) {
        key = normalizeCreditUsedTransactionKey(transactions[index]);
        if (key !== "") {
            map[key] = creditMatchingText(receipts[index]);
        }
    }

    return map;
}

function setCreditUsedFailure() {
    creditUsedByTransaction = {};
    creditUsedPending = false;
    creditUsedReady = false;
    creditUsedFailed = true;
    applyCreditUsedRows();
}

function isCreditTransactionUsed(transactionId) {
    var key = normalizeCreditUsedTransactionKey(transactionId);
    return creditUsedReady &&
        key !== "" &&
        Object.prototype.hasOwnProperty.call(creditUsedByTransaction, key);
}

function loadCreditUsedTransactions(snapshot, done) {
    creditUsedByTransaction = {};
    creditUsedPending = true;
    creditUsedReady = false;
    creditUsedFailed = false;
    applyCreditUsedRows();

    // AuraPlayer only replaces these arrays when the service returns rows, so
    // clear them first to keep an empty response from reusing the previous list.
    Storage.deleteByPrefix("CREDIT_TRANSACTION_");
    Storage.deleteByPrefix("RECEIPT_ID_");

    try {
        Services.call(
            "ReceiptBatch_getUsedCreditTransactions",
            function () {
                if (!creditUsedSnapshotIsCurrent(snapshot)) {
                    setCreditUsedFailure();
                    done("stale");
                    return;
                }

                creditUsedByTransaction = creditUsedMapFromStorage();
                creditUsedPending = false;
                creditUsedReady = true;
                creditUsedFailed = false;
                applyCreditUsedRows();
                done(null);
            },
            function (response) {
                setCreditUsedFailure();
                done(
                    getCreditMatchingErrorMessage(
                        response,
                        "ReceiptBatch_getUsedCreditTransactions",
                        "Failed to load already matched credit transactions."
                    )
                );
            },
            {
                EBS_USER: snapshot.ebsUser,
                numOfRowsInTable: 10000
            }
        );
    } catch (error) {
        setCreditUsedFailure();
        done(
            creditMatchingFailureText(
                error,
                "Failed to load already matched credit transactions."
            )
        );
    }
}

function applyCreditUsedRows() {
    $("#tableOutput tbody tr").each(function () {
        var match = /^tablerow_(\d+)$/.exec(this.id || "");
        if (match) {
            markCreditUsedRow($(this), match[1]);
        }
    });
}

function markCreditUsedRow($row, rowIndex) {
    var key = normalizeCreditUsedTransactionKey(Storage.get("TRANSACTION_ID_" + rowIndex));
    var used = creditUsedReady &&
        key !== "" &&
        Object.prototype.hasOwnProperty.call(creditUsedByTransaction, key);
    var wasDisabled = $row.attr("data-credit-used") === "true";
    var status = "";
    var title = "";

    $row.removeClass("cc-credit-used cc-credit-used-pending cc-credit-used-failed");
    $row.removeAttr("aria-disabled data-credit-used title");
    $row.find("td").removeAttr("title");
    $row.find(".cc-used-status").remove();

    if (used) {
        $row.addClass("cc-credit-used");
        status = "Already matched";
        title = "Already matched to another receipt";
    } else if (creditUsedFailed) {
        $row.addClass("cc-credit-used-failed");
        status = "Matching unavailable - retry";
        title = "Could not verify already matched credit transactions. Retry loading the transactions.";
    } else if (!creditUsedReady) {
        $row.addClass("cc-credit-used-pending");
        status = "Checking matches...";
        title = "Checking already matched credit transactions...";
    }

    if (used || creditUsedFailed || !creditUsedReady) {
        $row.attr("aria-disabled", "true");
        $row.attr("data-credit-used", "true");
        $row.attr("title", title);
        $row.find("td").attr("title", title);
        $row.find("input[type=checkbox]").each(function () {
            this.disabled = true;
            this.checked = false;
        });
        Storage.set("Select_" + rowIndex, "false");
    } else if (wasDisabled) {
        $row.find("input[type=checkbox]").prop("disabled", false);
    }

    if (status !== "") {
        $row.find("td").first().append(
            '<span class="cc-used-status">' + status + "</span>"
        );
    }
}

function normalizeCreditMatchingRowIndex(row) {
    var text = creditMatchingText(row);
    return isCreditMatchingDigits(text) ? Number(text) : null;
}

function creditMatchingHtml(value) {
    return creditMatchingText(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function isCreditMatchingIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    var date;

    if (!match) {
        return false;
    }

    date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) &&
        date.getUTCMonth() === Number(match[2]) - 1 &&
        date.getUTCDate() === Number(match[3]);
}

function readCreditMatchingMatch(rowIndex, receiptId) {
    var transactionId = creditMatchingText(Storage.get("TRANSACTION_ID_" + rowIndex));
    var amountText = creditMatchingText(Storage.get("TRANSACTION_AMOUNT_" + rowIndex));
    var date = creditMatchingText(Storage.get("TRANSACTION_DATE_ISO_" + rowIndex));
    var currency = creditMatchingText(Storage.get("POSTED_CURRENCY_CODE_" + rowIndex)).toUpperCase();
    var cardId = creditMatchingText(Storage.get("CARD_ID_" + rowIndex));

    if (!isCreditMatchingDigits(transactionId)) {
        return {
            error: "The selected credit transaction is missing a valid transaction ID. " +
                "Refresh the transactions and try again."
        };
    }
    if (!/^-?\d+(\.\d+)?$/.test(amountText) || !isFinite(Number(amountText))) {
        return {
            error: "The selected credit transaction is missing a valid amount. " +
                "Refresh the transactions and try again."
        };
    }
    if (!isCreditMatchingIsoDate(date)) {
        return {
            error: "The selected credit transaction is missing a valid date. " +
                "Refresh the transactions and try again."
        };
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
        return {
            error: "The selected credit transaction is missing a valid posted currency. " +
                "Refresh the transactions and try again."
        };
    }
    if (!isCreditMatchingDigits(cardId)) {
        return {
            error: "The selected credit transaction is missing a valid card ID. " +
                "Refresh the transactions and try again."
        };
    }

    return {
        match: {
            receiptId: receiptId,
            rowIndex: rowIndex,
            transactionId: transactionId,
            amount: Number(amountText),
            date: date,
            currency: currency,
            merchant: creditMatchingText(Storage.get("MerchantName_" + rowIndex)),
            location: creditMatchingText(Storage.get("Location_" + rowIndex)),
            cardId: cardId
        }
    };
}

function formatCreditMatchingDate(value) {
    var months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(creditMatchingText(value));
    var month;

    if (!parts) {
        return creditMatchingText(value);
    }

    month = Number(parts[2]);
    if (month < 1 || month > 12) {
        return creditMatchingText(value);
    }

    return parts[3] + "-" + months[month - 1] + "-" + parts[1];
}

function creditMatchingSummary(match) {
    return "<div class='cc-match-summary'>" +
        "<p>Match this credit transaction to the open receipt?</p>" +
        "<dl>" +
        "<dt>Date:</dt>" +
        "<dd>" + creditMatchingHtml(formatCreditMatchingDate(match.date)) + "</dd>" +
        "<dt>Amount:</dt>" +
        "<dd class='cc-match-amount'>" + creditMatchingHtml(match.amount) + "</dd>" +
        "<dt>Receipt Currency:</dt>" +
        "<dd>" + creditMatchingHtml(match.currency) + "</dd>" +
        "<dt>Merchant:</dt>" +
        "<dd>" + creditMatchingHtml(match.merchant) + "</dd>" +
        "<dt>Transaction location (reference):</dt>" +
        "<dd class='cc-match-location'>" + creditMatchingHtml(match.location) + "</dd>" +
        "</dl>" +
        "</div>";
}

function getCreditMatchingEditorWindow() {
    var parentWindow;
    var parentDocument;
    var panel;
    var panelFrame;
    var exactFrame;
    var receiptFrame;

    try {
        parentWindow = window.parent;
    } catch (ignoredParentProblem) {
        return null;
    }

    if (!parentWindow || parentWindow === window) {
        return null;
    }

    try {
        if (typeof parentWindow.getEmbeddedEditorWindow === "function") {
            panel = parentWindow.getEmbeddedEditorWindow();
            if (panel) {
                return panel;
            }
        }

        parentDocument = parentWindow.document;
        if (!parentDocument) {
            return null;
        }

        panel = parentDocument.getElementById("receiptEditPanel");
        panelFrame = panel
            ? (panel.tagName === "IFRAME" ? panel : panel.querySelector && panel.querySelector("iframe"))
            : null;
        if (panelFrame && panelFrame.contentWindow) {
            return panelFrame.contentWindow;
        }

        exactFrame = parentDocument.getElementById("page-as-child-iframe-ReceiptDetails.html");
        if (exactFrame && exactFrame.contentWindow) {
            return exactFrame.contentWindow;
        }

        receiptFrame = parentDocument.querySelector
            ? parentDocument.querySelector('iframe[src*="ReceiptDetails"]')
            : null;
        return receiptFrame ? receiptFrame.contentWindow || null : null;
    } catch (ignoredFrameProblem) {
        return null;
    }
}

function closeCreditMatchingPanel() {
    var parentWindow;
    var $parent;
    var $panel;
    var $stage;

    try {
        parentWindow = window.parent;
    } catch (ignoredParentProblem) {
        return;
    }

    if (!parentWindow || parentWindow === window) {
        return;
    }

    try {
        $parent = parentWindow.jQuery || parentWindow.$;
        if (typeof $parent !== "function") {
            return;
        }

        $panel = $parent("#receiptCreditMatchingPanel");
        if (!$panel || !$panel.length) {
            return;
        }

        $stage = $panel.closest(".attachmentViewerStage");
        if ($stage && $stage.length) {
            $stage.removeClass("receipt-credit-matching-open");
        }
        $panel.remove();
    } catch (ignoredCloseProblem) {
        // The match is already staged; a missing parent panel is not a failure.
    }
}

function approveCreditMatching(match) {
    var editor;

    if (getCreditMatchingActiveReceiptId() !== match.receiptId) {
        creditApprovalPending = false;
        Popup.ok("Error", "The open receipt changed. Select the credit transaction again.");
        return;
    }

    if (creditMatchingText(Storage.get("CARD_ID")) !== match.cardId ||
        creditMatchingText(Storage.get("CARD_ID_" + match.rowIndex)) !== match.cardId ||
        creditMatchingText(Storage.get("TRANSACTION_ID_" + match.rowIndex)) !== match.transactionId) {
        creditApprovalPending = false;
        Popup.ok(
            "Error",
            "The loaded card or credit transaction changed. Select the transaction again."
        );
        return;
    }

    editor = getCreditMatchingEditorWindow();
    if (!editor || typeof editor.applyCreditTransactionMatch !== "function") {
        creditApprovalPending = false;
        Popup.ok(
            "Error",
            "The receipt editor is not available. Open the receipt details and try again."
        );
        return;
    }

    try {
        editor.applyCreditTransactionMatch(
            match,
            function () {
                creditApprovalPending = false;
                closeCreditMatchingPanel();
            },
            function (problem) {
                creditApprovalPending = false;
                Popup.ok(
                    "Error",
                    creditMatchingFailureText(problem, "Failed to save the credit transaction match.")
                );
            }
        );
    } catch (error) {
        creditApprovalPending = false;
        Popup.ok(
            "Error",
            creditMatchingFailureText(error, "Failed to save the credit transaction match.")
        );
    }
}

function showCreditMatchingApproval(match) {
    creditApprovalPending = true;

    try {
        Popup.custom(
            "Approve credit matching",
            creditMatchingSummary(match),
            "Approve",
            "Cancel",
            function () {
                approveCreditMatching(match);
            },
            function () {
                creditApprovalPending = false;
            }
        );
    } catch (error) {
        creditApprovalPending = false;
        Popup.ok("Error", "Failed to show the credit matching confirmation.");
    }
}

function refreshCreditUsageBeforeApproval(match) {
    var snapshot = creditUsedSnapshot();

    if (!isCreditMatchingDigits(snapshot.receiptId) || snapshot.ebsUser === "") {
        Popup.ok(
            "Credit matching",
            "Open a receipt for the current EBS user before matching a credit transaction."
        );
        return;
    }

    loadCreditUsedTransactions(snapshot, function (error) {
        if (!creditUsedSnapshotIsCurrent(snapshot) ||
            getCreditMatchingActiveReceiptId() !== match.receiptId) {
            setCreditUsedFailure();
            Popup.ok(
                "Credit matching",
                "The open receipt, user or card changed. Select the credit transaction again."
            );
            return;
        }

        if (error) {
            Popup.ok(
                "Credit matching",
                "Could not verify already matched credit transactions. Check your connection and retry."
            );
            return;
        }

        if (isCreditTransactionUsed(match.transactionId)) {
            Popup.ok(
                "Credit matching",
                "This credit transaction is already matched to another receipt."
            );
            return;
        }

        showCreditMatchingApproval(match);
    });
}

function onTableClick(row, col, rowCells) {
    var rowIndex;
    var receiptId;
    var result;

    if (creditTransactionsPending || creditApprovalPending || creditUsedPending) {
        return;
    }

    if (!creditUsedReady) {
        Popup.ok(
            "Credit matching",
            "Already matched credit transactions could not be verified. Retry loading the transactions."
        );
        return;
    }

    rowIndex = normalizeCreditMatchingRowIndex(row);
    if (rowIndex === null) {
        Popup.ok("Credit matching", "Select a valid credit transaction row first.");
        return;
    }

    if (isCreditTransactionUsed(Storage.get("TRANSACTION_ID_" + rowIndex))) {
        applyCreditUsedRows();
        return;
    }

    receiptId = getCreditMatchingActiveReceiptId();
    if (!isCreditMatchingDigits(receiptId)) {
        Popup.ok(
            "Credit matching",
            "Open a receipt preview before matching a credit transaction."
        );
        return;
    }

    result = readCreditMatchingMatch(rowIndex, receiptId);
    if (result.error) {
        Popup.ok("Credit matching", result.error);
        return;
    }

    refreshCreditUsageBeforeApproval(result.match);
}

function getCreditMatchingContext() {
    var ebsUser = creditMatchingStorageValue("LoggedInUsername") ||
        creditMatchingStorageValue("EBS_USER");
    var orgId = creditMatchingStorageValue("ORG_ID") || CREDIT_MATCHING_DEFAULT_ORG_ID;
    var currency = creditMatchingStorageValue("REIMBURSEMENT_CURRENCY") ||
        CREDIT_MATCHING_DEFAULT_CURRENCY;
    var reportHeaderId = creditMatchingStorageValue("REPORT_HEADER_ID");
    var context = {
        EBS_USER: ebsUser,
        ORG_ID: orgId,
        REIMBURSEMENT_CURRENCY: currency,
        LANGUAGE_CODE: CREDIT_MATCHING_DEFAULT_LANGUAGE,
        SECURITY_GROUP_ID: CREDIT_MATCHING_DEFAULT_SECURITY_GROUP,
        REPORT_HEADER_ID: reportHeaderId
    };

    Storage.set("EBS_USER", context.EBS_USER);
    Storage.set("ORG_ID", context.ORG_ID);
    Storage.set("REIMBURSEMENT_CURRENCY", context.REIMBURSEMENT_CURRENCY);
    Storage.set("LANGUAGE_CODE", context.LANGUAGE_CODE);
    Storage.set("SECURITY_GROUP_ID", context.SECURITY_GROUP_ID);
    Storage.set("REPORT_HEADER_ID", context.REPORT_HEADER_ID);

    return context;
}

function clearSelectedCreditCard() {
    Fields.clear(
        "CARD_ID",
        "CARD_PROGRAM_ID",
        "PAYMENT_DUE_FROM_CODE",
        "CreditCardList",
        CREDIT_CARD_LOV_ELEMENT_ID
    );

    Storage.remove("CARD_ID");
    Storage.remove("CARD_PROGRAM_ID");
    Storage.remove("PAYMENT_DUE_FROM_CODE");
    Storage.remove("CreditCardList");
}

function clearCreditTransactionStorage() {
    for (var i = 0; i < CREDIT_TRANSACTION_STORAGE_PREFIXES.length; i++) {
        Storage.deleteByPrefix(CREDIT_TRANSACTION_STORAGE_PREFIXES[i]);
    }
}

function clearCreditTransactionState() {
    clearCreditTransactionStorage();
    Table.clear();
}

function hideCreditMatchingPagination() {
    Storage.set("paginationExists", "false");
    $("#Previous").hide();
    $("#Next").hide();
    $("#listRange").hide();
}

function CreditCardPoplist_lov_success(response) {
    var body = response && response.Response;
    var tableArray = body && body["ReceiptBatch_getCreditCardsTableArray"];
    var items = tableArray && tableArray["ReceiptBatch_getCreditCardsArrayItem"];
    var cards = [].concat(items || []).filter(function (item) {
        return item && typeof item === "object";
    });

    if (cards.length === 0) {
        clearSelectedCreditCard();
        clearCreditTransactionState();
        resetCreditUsedState();
        Storage.set("hasTransactions", "false");
        Popup.ok("Information", "No credit cards are available for this user.");
        return;
    }

    CreditCardPoplist_lov_item_handler(cards[0]);
}

function CreditCardPoplist_lov_failure(response) {
    clearCreditTransactionState();
    resetCreditUsedState();
    Storage.set("hasTransactions", "false");
    Popup.ok(
        "Error",
        getCreditMatchingErrorMessage(
            response,
            "ReceiptBatch_getCreditCards",
            "Failed to load the credit card list."
        )
    );
}

function CreditCardPoplist_lov_item_presenter(arrayItem) {
    return arrayItem ? creditMatchingText(arrayItem["CreditCardList"]) : "";
}

function CreditCardPoplist_lov_item_handler(card) {
    var creditCardList;

    if (creditTransactionsPending || creditApprovalPending || creditUsedPending) {
        return;
    }

    if (!card) {
        return;
    }

    creditCardList = creditMatchingText(card["CreditCardList"]);

    Fields.setAndStore("CARD_ID", creditMatchingText(card["CARD_ID"]));
    Fields.setAndStore("CARD_PROGRAM_ID", creditMatchingText(card["CARD_PROGRAM_ID"]));
    Fields.setAndStore("PAYMENT_DUE_FROM_CODE", creditMatchingText(card["PAYMENT_DUE_FROM_CODE"]));
    Fields.setAndStore("CreditCardList", creditCardList);

    Fields.set(CREDIT_CARD_LOV_ELEMENT_ID, creditCardList);

    loadCreditTransactions();
}

function finishCreditTransactionsLoad() {
    creditTransactionsPending = false;
    Fields.enable(CREDIT_CARD_LOV_ELEMENT_ID);
}

function onCreditTransactionsSuccess(response, serviceName, tableRows) {
    var rows = (tableRows || []).filter(function (row) {
        return row;
    });
    var snapshot;

    if (rows.length === 0) {
        clearCreditTransactionState();
        resetCreditUsedState();
        Storage.set("hasTransactions", "false");
        Popup.ok("Information", "No credit card transactions are available for this card.");
        finishCreditTransactionsLoad();
        return;
    }

    Storage.set("hasTransactions", "true");
    Table.populate();

    snapshot = creditUsedSnapshot();
    if (!isCreditMatchingDigits(snapshot.receiptId) || snapshot.ebsUser === "") {
        setCreditUsedFailure();
        Popup.ok(
            "Credit matching",
            "Open a receipt for the current EBS user before matching credit transactions. Retry after the receipt is open."
        );
        onGetTransactionSuccess();
        finishCreditTransactionsLoad();
        return;
    }

    // Keep creditTransactionsPending true through this second request so the
    // rows cannot be selected until the reservation list has been verified.
    loadCreditUsedTransactions(snapshot, function (error) {
        if (error) {
            Popup.ok(
                "Credit matching",
                creditUsedSnapshotIsCurrent(snapshot)
                    ? "Could not verify already matched credit transactions. Check your connection and retry loading the transactions."
                    : "The open receipt, user or card changed. Reload the credit transactions."
            );
        }

        onGetTransactionSuccess();
        finishCreditTransactionsLoad();
    });
}

function onCreditTransactionsFailure(response) {
    clearCreditTransactionState();
    resetCreditUsedState();
    Storage.set("hasTransactions", "false");
    Popup.ok(
        "Error",
        getCreditMatchingErrorMessage(
            response,
            "ReceiptBatch_getCreditTransactions",
            "Failed to get credit card transactions."
        )
    );
    finishCreditTransactionsLoad();
}

function loadCreditTransactions() {
    var cardId;
    var paymentDueFromCode;
    var context;
    var input;

    if (creditTransactionsPending || creditUsedPending) {
        return;
    }

    cardId = creditMatchingText(Storage.get("CARD_ID"));
    paymentDueFromCode = creditMatchingText(Storage.get("PAYMENT_DUE_FROM_CODE"));

    if (cardId === "") {
        Popup.ok("Information", "Select a credit card first.");
        return;
    }

    creditTransactionsPending = true;
    resetCreditUsedState();

    // Remove every stale row before the service response can append new ones.
    clearCreditTransactionState();
    Storage.set("hasTransactions", "false");
    Fields.disable(CREDIT_CARD_LOV_ELEMENT_ID);

    context = getCreditMatchingContext();
    input = {
        EBS_USER: context.EBS_USER,
        ORG_ID: context.ORG_ID,
        CARD_ID: cardId,
        PAYMENT_DUE_FROM_CODE: paymentDueFromCode,
        REPORT_HEADER_ID: context.REPORT_HEADER_ID,
        REIMBURSEMENT_CURRENCY: context.REIMBURSEMENT_CURRENCY,
        numOfRowsInTable: 1000
    };

    try {
        Services.call(
            "ReceiptBatch_getCreditTransactions",
            onCreditTransactionsSuccess,
            onCreditTransactionsFailure,
            input
        );
    } catch (error) {
        finishCreditTransactionsLoad();
        Popup.ok("Error", "Failed to get credit card transactions.");
    }
}

function getCreditMatchingErrorMessage(response, serviceName, fallback) {
    var body = response && response.Response;
    var message = "";

    if (typeof response === "string") {
        message = creditMatchingText(response);
    }
    if (message === "" && body && serviceName && body[serviceName + "Message"]) {
        message = creditMatchingText(body[serviceName + "Message"].Error);
    }
    if (message === "" && body) {
        message = creditMatchingText(body.Error);
    }
    if (message === "" && response && response.Error) {
        message = creditMatchingText(response.Error);
    }

    return message !== "" ? message : fallback;
}

function creditMatchingFailureText(problem, fallback) {
    if (typeof problem === "string") {
        return creditMatchingText(problem) || fallback;
    }
    if (problem && problem.message) {
        return creditMatchingText(problem.message) || fallback;
    }
    return getCreditMatchingErrorMessage(problem, "", fallback);
}

function setNextPrevButtons() {
    // set prev/next button
    var paginationExists = Storage.get("paginationExists") === 'true';

    if (paginationExists) {
        $('#Previous').show();
        $("#Next").show();
        $("#listRange").show();
        var nextButtonExists = Storage.get('nextButtonExist') == 'true';
        $('#Next').prop( "disabled", !nextButtonExists);
        $("#Next").text(getPaginationButtonLabel("Next", Storage.get("nextButtonLabel") !== ""?Storage.get("nextButtonLabel"):"Next"));

        var prevButtonExists = Storage.get('prevButtonExist') == 'true';
        $('#Previous').prop( "disabled", !prevButtonExists);
        $("#Previous").text(getPaginationButtonLabel("Previous", Storage.get("prevButtonLabel") !== ""?Storage.get("prevButtonLabel"):"Previous"));

        $("#listRange").text(Storage.get("currentListRange"));
    } else {
        $('#Previous').hide();
        $("#Next").hide();
        $("#listRange").hide();
    }
}

function onGetTransactionSuccess() {
  if (!document.getElementById('*th*Matched')) {
    return;
  }

  if (Table.countRows() > 0) {
    transactionsMatching(function () {
      renderMatchedColumn();
      bindMatchedClick();
      applyCreditUsedRows();

      var table = $('#tableOutput').DataTable();
      // One isolated draw handler owns both the matched icon and reserved-row
      // styling. The row id keeps the styling attached to the source row after
      // sorting, paging and redraws.
      table.off('draw.creditUsage').on('draw.creditUsage', function () {
        renderMatchedColumn();
        applyCreditUsedRows();
      });

      addActionListeners();
      setNextPrevButtons();
    });
  }
}

function onLoad() {
    Table.clear();
    clearCreditTransactionStorage();
    Storage.set("hasTransactions", "false");
    creditApprovalPending = false;
    resetCreditUsedState();
    hideCreditMatchingPagination();
    clearSelectedCreditCard();
    getCreditMatchingContext();

    // Existing generated initDynamic already registers the CreditCardPoplist LOV.
    // Triggering the configured service here avoids a manual card service call.
    Lov.getSuggestions(CREDIT_CARD_LOV_ELEMENT_ID, "ReceiptBatch_getCreditCards", false);
}

function onNextTrans() {
    var updateMode = Storage.get("updateMode").toLowerCase() === 'true';
    var selection = Table.getColumn('Select_0');
    if (!updateMode && selection.indexOf(true) === -1) {
            // if we are not in new report and no selection made goto directly to cash lines
            store("hasCreditLines", false);
            Services.call('iExpense_credit_next', function() {Page.navigate("Cash_Lines.html");});
            return;
    }
    // if some selections where made or we are in udpate mode and even no selection made we need to mark the transaction
    // as one could have unchecked a selection

    // var input = [];
    // for (var i = 0; i < selection.length; i++) {
    //     input.push({"select": String(selection[i])});
    // }
    // Storage.set('selection', JSON.stringify(input));

    Storage.set('selection', selection);
	Services.call('iExpense_credit_markTransactions', onMarkSuccessNext, displayReportServiceError("Failed to mark transactions"));
}

function onMarkSuccessNext() {
	Services.call('iExpense_credit_gotoUpdateTransactions', function() {
        var wizardTitle = Storage.get("WizardTitle");
        // The only way we know if there are marked transactions is from the next step as a transactions
        // might be marked on the next pagination page
        if (wizardTitle.toLowerCase().indexOf("credit card expenses") > -1) {
            Page.navigate('Credit_Lines.html');
        } else if (wizardTitle.toLowerCase().indexOf("cash and other expenses") > -1) {
            store("hasCreditLines", false);
            Page.navigate("Cash_Lines.html");
        } else {
            Popup.ok(getTranslationForId("@popup_title_error"), "Got to unexpected page: " + Storage.get("WizardTitle"));
        }




        // var selection = Table.getColumn('Select_0');
        // if (selection.indexOf(true) === -1) {
        //     // This could happen if we are in update mode and the user de-selected all lines
        //     store("hasCreditLines", false);
        //     Page.navigate("Cash_Lines.html");
        // } else {
        //     // This section is relevant if any selection was made
        //     // var selectedRows = Table.toArray('Select');
        //     // Table.setSource('Credit_Lines.html', selectedRows);
        //     Page.navigate('Credit_Lines.html');
        // }
	}, displayReportServiceError("Failed to move to cash lines"));
}

function prepare_iExpense_credit_getCreditCards_lov_request() {
    var inputParams = {};

    return inputParams;
}
function CreditCardList_lov_item_presenter(arrayItem) {
    var lovItems = [];
    lovItems.push(arrayItem["CreditCardList"]);

    return lovItems.join(",");
}

function OnCancel() {
  OnCancelPopup(function() {
        var updateMode = Storage.get("updateMode").toLowerCase() === 'true';
        updateMode ? Page.navigate("Update_Reports.html") : Page.navigate("Reports.html");
  });
}

function onNext() {
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
	Storage.set('moveNext', 'true');
    var selection = Table.getColumn('Select_0');
    Storage.set('selection', selection);
    /**************************************/
    for (var tIdx = 0; tIdx < selection.length; tIdx++) {
        if (selection[tIdx]) {
            Storage.set("selectedReciptId_" + tIdx, RECEIPTSBATCH_RECEIPT_ID[tIdx]);
        }
    }

    /**********************************/
	Services.call('iExpense_credit_markTransactions', function() {
    	Services.call('iExpense_getCreditTransNextPrev', onGetTransactionSuccess, displayReportServiceError("Failed to fetch next transactions"));
	}, displayReportServiceError("Failed to mark transactions"));
}

function onPrev() {
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
	Storage.set('moveNext', 'false');
    var selection = Table.getColumn('Select_0');
    Storage.set('selection', selection);
	Services.call('iExpense_credit_markTransactions', function() {
    	Services.call('iExpense_getCreditTransNextPrev', onGetTransactionSuccess, displayReportServiceError("Failed to fetch previous transactions"));
	}, displayReportServiceError("Failed to mark transactions"));
}

function onBack() {
	Services.call('iExpense_Back', function() {
            Storage.set("updateMode", true);
            Page.navigate("Report_General.html");
	    } , displayReportServiceError("Failed to to press back button"));
}

/***** TAB: TransactionsMatching *****/
/*
 * LiveExpense_AI.Credit_Matching.TransactionsMatching.js
 *
 * Receipt-batch matching for Credit_Matching.html. Raw credit transaction
 * amount/ISO date arrays are preferred; the legacy display arrays remain as a
 * fallback for older service responses.
 */

function getPreferredTransactionArray(rawKey, legacyKey) {
  var raw = Storage.getArray(rawKey);
  if (raw.length > 0) {
    return raw;
  }
  return Storage.getArray(legacyKey);
}

function transactionsMatching(done) {
  var matchingContext = getCreditMatchingContext();
  Storage.set("EBS_USER", matchingContext.EBS_USER);
  Storage.set("ReceiptBatch_statuses", "PROCESSED");

  Services.call("ReceiptBatch_get_by_userAndStatuses",
    function () {
      var TRANSACTIONS_AMOUNT = getPreferredTransactionArray("TRANSACTION_AMOUNT", "TransactionAmount");
      var TRANSACTIONS_RECEIPT_DATE = getPreferredTransactionArray("TRANSACTION_DATE_ISO", "TransactionDate");
      var TRANSACTIONS_MERCHANT = Storage.getArray("MerchantName");
      var TRANSACTIONS_LOCATION = Storage.getArray("Location");

      var RECEIPTSBATCH_RECEIPT_ID = Storage.getArray("RECEIPTBATCH_RECEIPT_ID");
      var RECEIPTSBATCH_TOTAL_AMOUNT = Storage.getArray("RECEIPTBATCH_TOTAL_AMOUNT");
      // var RECEIPTSBATCH_EXPENSE_TYPE = Storage.getArray("RECEIPTBATCH_EXPENSE_TYPE");
      var RECEIPTSBATCH_RECEIPT_DATE = Storage.getArray("RECEIPTBATCH_RECEIPT_DATE");
      var RECEIPTSBATCH_MERCHANT = Storage.getArray("RECEIPTBATCH_MERCHANT");
      var RECEIPTSBATCH_LOCATION = Storage.getArray("RECEIPTBATCH_LOCATION");


      /**************** Normalize transaction arrays *****************/
      for (var i = 0; i < TRANSACTIONS_AMOUNT.length; i++) {
        TRANSACTIONS_AMOUNT[i] = normalizeAmount(TRANSACTIONS_AMOUNT[i]);
      }


      for (var i = 0; i < TRANSACTIONS_RECEIPT_DATE.length; i++) {
        TRANSACTIONS_RECEIPT_DATE[i] = normalizeDate(TRANSACTIONS_RECEIPT_DATE[i]);
      }

      for (var i = 0; i < TRANSACTIONS_MERCHANT.length; i++) {
        // console.log("Before normalize:", { index: i, value:TRANSACTIONS_MERCHANT[i] });
        TRANSACTIONS_MERCHANT[i] = normalizeText(TRANSACTIONS_MERCHANT[i]);
        // console.log("After normalize:", {index: i,value: TRANSACTIONS_MERCHANT[i]});
      }

      for (var i = 0; i < TRANSACTIONS_LOCATION.length; i++) {
        TRANSACTIONS_LOCATION[i] = normalizeText(TRANSACTIONS_LOCATION[i]);
      }

      /**************** Normalize receipt batch arrays *****************/
      for (var i = 0; i < RECEIPTSBATCH_TOTAL_AMOUNT.length; i++) {
        RECEIPTSBATCH_TOTAL_AMOUNT[i] = normalizeAmount(RECEIPTSBATCH_TOTAL_AMOUNT[i]);
      }

      for (var i = 0; i < RECEIPTSBATCH_LOCATION.length; i++) {
        RECEIPTSBATCH_LOCATION[i] = normalizeText(RECEIPTSBATCH_LOCATION[i]);
      }

      for (var i = 0; i < RECEIPTSBATCH_RECEIPT_DATE.length; i++) {
        RECEIPTSBATCH_RECEIPT_DATE[i] = normalizeDate(RECEIPTSBATCH_RECEIPT_DATE[i]);
      }

      for (var i = 0; i < RECEIPTSBATCH_MERCHANT.length; i++) {
        // console.log("Before normalize:", { index: i, value:RECEIPTSBATCH_MERCHANT[i] });
        RECEIPTSBATCH_MERCHANT[i] = normalizeText(RECEIPTSBATCH_MERCHANT[i]);
        // console.log("After normalize:", {index: i,value: RECEIPTSBATCH_MERCHANT[i]});
      }


      if (
        RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_TOTAL_AMOUNT.length ||
        RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_LOCATION.length ||
        RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_RECEIPT_DATE.length ||
        RECEIPTSBATCH_RECEIPT_ID.length !== RECEIPTSBATCH_MERCHANT.length
      ) {
        throw "Receipt batch response arrays are not aligned";
      }

      //   var metchesTransactionIds = [];
      //   var metchesReciptIds = [];

      var usedReceiptIndex = [];
      for (var i = 0; i < RECEIPTSBATCH_RECEIPT_ID.length; i++) {
        usedReceiptIndex[i] = false;
      }


      for (var tIdx = 0; tIdx < TRANSACTIONS_RECEIPT_DATE.length; tIdx++) {
        Storage.set("Match_" + tIdx, "false");
        for (var rIdx = 0; rIdx < RECEIPTSBATCH_RECEIPT_ID.length; rIdx++) {
          if (usedReceiptIndex[rIdx]) {
            continue;
          }

          var amountMatch =
            TRANSACTIONS_AMOUNT[tIdx] !== null &&
            RECEIPTSBATCH_TOTAL_AMOUNT[rIdx] !== null &&
            TRANSACTIONS_AMOUNT[tIdx] === RECEIPTSBATCH_TOTAL_AMOUNT[rIdx];

          var dateMatch =
            TRANSACTIONS_RECEIPT_DATE[tIdx] !== "" &&
            RECEIPTSBATCH_RECEIPT_DATE[rIdx] !== "" &&
            TRANSACTIONS_RECEIPT_DATE[tIdx] === RECEIPTSBATCH_RECEIPT_DATE[rIdx];

          var merchantMatch =
            TRANSACTIONS_MERCHANT[tIdx] !== "" &&
            RECEIPTSBATCH_MERCHANT[rIdx] !== "" &&
            TRANSACTIONS_MERCHANT[tIdx] === RECEIPTSBATCH_MERCHANT[rIdx];

          var locatinMatch =
            TRANSACTIONS_LOCATION[tIdx] !== "" &&
            RECEIPTSBATCH_LOCATION[rIdx] !== "" &&
            TRANSACTIONS_LOCATION[tIdx] === RECEIPTSBATCH_LOCATION[rIdx];


        //   console.log(
        //     " | Receipt ID " + RECEIPTSBATCH_RECEIPT_ID[rIdx] +
        //     " | amountMatch=" + amountMatch +
        //     " | dateMatch=" + dateMatch +
        //     " | merchantMatch=" + merchantMatch +
        //     " | locatinMatch=" + locatinMatch
        //   );

          if (amountMatch && dateMatch && merchantMatch && locatinMatch) {
            // Services.call("updateMatchingCreditTransaction",{
            //     "TRANSACTION_ID": //we dont have  TRANSACTION_ID
            //     "RECEIPT_ID": RECEIPTSBATCH_RECEIPT_ID
            // });
            // metchesTransactionIds.push(TRANSACTIONS_ID[tIdx]);
            // metchesReciptIds.push(RECEIPTSBATCH_RECEIPT_ID[rIdx]);
            usedReceiptIndex[rIdx] = true;
            Storage.set("MatchReciptId_" + tIdx, RECEIPTSBATCH_RECEIPT_ID[rIdx]);
            break;
          }
        }
      }

      if (done)
        done();

  }, displayReportServiceError("Failed to get Receipts"));

}

function normalizeText(txt) {
  if (txt === null || txt === undefined) {
    return "";
  }
  return String(txt).trim().toLowerCase();
}

function normalizeAmount(val) {
  if (val === null || val === undefined) {
    return null;
  }

  var s = String(val).trim();
  if (s === "") {
    return null;
  }

  var negative = /^-/.test(s) || (s.indexOf("<") !== -1 && s.indexOf(">") !== -1);
  s = s.replace(/[<>]/g, "").replace(/,/g, "").trim();
  var match = s.match(/-?\d+(\.\d+)?/);
  if (!match) {
    return null;
  }

  var num = Number(match[0]);
  if (isNaN(num)) {
    return null;
  }

  return negative ? -Math.abs(num) : num;
}

function normalizeDate(val) {
  if (val === null || val === undefined) {
    return "";
  }

  var s = String(val).trim();
  if (s === "") {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  var m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    var day = m[1].padStart(2, "0");
    var mon = m[2].toUpperCase();
    var year = m[3];

    var months = {
      JAN: "01", FEB: "02", MAR: "03", APR: "04",
      MAY: "05", JUN: "06", JUL: "07", AUG: "08",
      SEP: "09", OCT: "10", NOV: "11", DEC: "12"
    };

    if (months[mon]) {
      return year + "-" + months[mon] + "-" + day;
    }
  }

  return s;
}

/*****************************************/

function renderMatchedColumn() {
  var table = $('#tableOutput').DataTable();

  table.column(1).nodes().each(function (cell, rowIdx) {
    var matchValue = Storage.get("MatchReciptId_" + rowIdx);
    var $cell = $(cell);

    $cell.removeAttr('id data-row-id data-receipt-id')
         .removeClass('matched-cell')
         .empty()
         .off('click.matched');

    if (matchValue) {
      $cell.attr('id', 'Matched' + rowIdx)
           .attr('data-row-id', rowIdx)
           .attr('data-receipt-id', matchValue)
           .addClass('matched-cell')
           .html('&#128179;')
           .css({ cursor: 'pointer', textAlign: 'center' })
           .on('click.matched', function () {
             openMatchedReceipt(rowIdx, matchValue);
           });
    }
  });
}

// function openMatchedReceipt(rowIndex, receiptId) {
//   console.log('openMatchedReceipt rowIndex=', rowIndex, 'receiptId=', receiptId);

//   Storage.set('RECEIPTBATCH_RECEIPT_ID', receiptId);
//   Storage.set('receipt_ID', receiptId);

//   Preview(rowIndex);
// }
function openMatchedReceipt(rowIndex, receiptId) {
  Storage.set('RECEIPTBATCH_RECEIPT_ID', receiptId);
  Storage.set('receipt_ID', receiptId);

  clearPreviewReceiptMetadata();

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

function bindMatchedClick() {
  console.log("bindMatchedClick");

  $(document)
    .off('click.matched', '#tableOutput td.matched-cell')
    .on('click.matched', '#tableOutput td.matched-cell', function (e) {
      var $cell = $(this);

      var rowId = $.trim(String($cell.attr('data-row-id') || ''));
      var receiptId = $.trim(String($cell.attr('data-receipt-id') || ''));

      console.log('clicked rowId =', rowId, 'receiptId =', receiptId);

      if (!rowId) {
        console.log('Missing rowId');
        return;
      }

      if (!receiptId) {
        console.log('Missing receiptId');
        return;
      }

      openMatchedReceipt(parseInt(rowId, 10), receiptId);
    });
}
function addActionListeners() {
//   addTableActionListener("Matched", Preview);
}

function DisplayReport(row, col, rowCells) {
  Storage.set("lineIndexToDisplay", row);
  Services.call("iExpense_getReportDetailsGeneral", function () {
    Page.navigate("Report_Display_General_Details");
  }, displayReportServiceError("Failed to fetch report details"));

}


function prepare_ReceiptBatch_getCreditCards_lov_request() {
    return getCreditMatchingContext();
}
