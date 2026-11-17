// Starts the ReceiptBatch_CreateLinesRPA process.
// ReportNumber remains the caller-facing input name for existing app
// compatibility; the RPA process receives it as REPORT_NUMBER.

var reportNumber = ServiceManager.getInput("ReportNumber");

if (reportNumber === null || reportNumber === undefined) {
    reportNumber = "";
} else {
    reportNumber = String(reportNumber).trim();
}

if (reportNumber === "") {
    throw new Error("ReportNumber is required to start ReceiptBatch_CreateLinesRPA.");
}

Services.callAsync("ReceiptBatch_CreateLinesRPA", {
    "REPORT_NUMBER": reportNumber,
    "usernameField": ServiceManager.getInput("usernameField"),
    "passwordField": ServiceManager.getInput("passwordField")
});

return {};
