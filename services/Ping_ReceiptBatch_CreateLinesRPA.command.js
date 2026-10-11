var selectedReceiptIds = ServiceManager.getInput("SELECTED_RECEIPT_IDS");
if (typeof selectedReceiptIds !== "string") {
    selectedReceiptIds = JSON.stringify(selectedReceiptIds);
}

Services.callAsync("ReceiptBatch_CreateLinesRPA", {
    "itemizedExpenseTypes": ServiceManager.getInput("itemizedExpenseTypes"),
    "ExpensesTableCashLinePrefix": ServiceManager.getInput("ExpensesTableCashLinePrefix"),
    "HomePageTitle": ServiceManager.getInput("HomePageTitle"),
    "passwordField": ServiceManager.getInput("passwordField"),
    "usernameField": ServiceManager.getInput("usernameField"),
    "RespName": ServiceManager.getInput("RespName"),
    "FunctionId": ServiceManager.getInput("FunctionId"),
    "REPORT_NUMBER": ServiceManager.getInput("ReportNumber"),
    "REPORT_PURPOSE": ServiceManager.getInput("Purpose"),
    "SELECTED_RECEIPT_IDS": selectedReceiptIds
});
return {};
