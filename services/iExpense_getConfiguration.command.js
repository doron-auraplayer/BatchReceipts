return {
    "EBS1213_ExpensesEbsUrl": ServiceManager.getEnvVar("EBS_1213_EXPENSES_EBS_URL"),
    "EBS1213_ExpensesMenuPrefix": ServiceManager.getEnvVar("EBS_1213_IEXPENSE_MENU_PREFIX"),
    "EBS1213_ExpensesFunctionId": ServiceManager.getEnvVar("EBS_1213_IEXPENSE_FUNCTION"),
    "EBS122_ExpensesEbsUrl": ServiceManager.getEnvVar("EBS_122_EXPENSES_EBS_URL"),
    "EBS122_ExpensesMenuPrefix": ServiceManager.getEnvVar("EBS_122_IEXPENSE_MENU_PREFIX"),
    "EBS122_ExpensesFunctionId": ServiceManager.getEnvVar("EBS_122_IEXPENSE_FUNCTION")
}

// var extend = function ( defaults, options ) {
//     var extended = {};
//     var prop;
//     for (prop in defaults) {
//         if (Object.prototype.hasOwnProperty.call(defaults, prop)) {
//             extended[prop] = defaults[prop];
//         }
//     }
//     for (prop in options) {
//         if (Object.prototype.hasOwnProperty.call(options, prop)) {
//             extended[prop] = options[prop];
//         }
//     }
//     return extended;
// };

// // specific env configuration
// var ebs1213 = {
//     loginSubmitButtonSelector: "button[@id='SubmitButton']",
//     ExpensesSearchLocRBSelector: 'Search for Expense Location',
//     ExpensesSearchLocPDSelector: 'Search for Destination',
//     ExpensesTextDepartmentSelector: 'KffSEGMENT3ReadOnly',
//     ExpensesFilteredExpenseTypes: '',
//     FormsUrl: 'http://auravm01.us-west-2.compute.internal:8000',
//     ExpensesTableReportTotalColumnName: 'ReportTotalCurrency',
//     ExpenseTypeCategories: "Receipt-Based;PerDiem;Mileage;",
//     ExpenseConfirmationDialogExists: "false",
//     ExpenseCreditTableSelectAllSelector: "a[contains(text(),'Select All')]",
//     ExpensesLongScroll: "false",
//     ExpenseReviewReceiptRequiredSelector: "ReceiptRequired",
//     ExpenseShowMultiLanguage: false,
// }
// var ebs1227 = {
//     loginSubmitButtonSelector: "button[@onclick='submitCredentials()']",
//     ExpensesSearchLocRBSelector: 'Search: Expense Location',
//     ExpensesSearchLocPDSelector: 'Search: Destination',
//     ExpensesTextDepartmentSelector: 'KffSEGMENT3ReadOnly',
//     FormsUrl: 'http://apps.example.com:8000',
//     ExpensesFilteredExpenseTypes: '',
//     ExpensesTableReportTotalColumnName: 'ReportTotal',
//     ExpenseTypeCategories: "Receipt-Based;PerDiem;Mileage;",
//     ExpenseAttendiesSelectAllSelector: "input[@id='EmployeeTableRN:triState']",
//     ExpenseConfirmationDialogExists: "true",
//     ExpenseTableHasHeaderServices: "iExpense_getReportDetailsPerDiemLines,iExpense_getReportDetailsMileageLines", 
//     ExpenseCreditTableSelectAllSelector: "input[@id='AvailableTrxnList:triState']",
//     ExpensesLongScroll: "true",
//     ExpenseReviewReceiptRequiredSelector: "ReceiptRequired",
//     ExpenseShowMultiLanguage: false,
//     ExpensesAttachmentsDialog: true
// }
// var ebs12211 = extend(ebs1227, {
//         EbsVersion: "12.2.11",
//         SpecificServices: [
//             "iExpense_OpenApproverSearchWindow_ebs12211",
//             "iExpense_LocationSearchOpen_ebs12211",
//             "iExpense_openAllocationSearchWindow_ebs12211",
//             "iExpense_lineDetailsSet_ebs12211",
//             "iExpense_removeUpdateReport_ebs12211",
//             "iExpense_lineDetailsGet_ebs12211",
//             "iExpense_removeFirstAttachment_ebs12211",
//             "iExpense_downloadAttachment_ebs12211",
//             "iExpense_employeeSearchOpen_ebs12211",
//             "iExpense_employeeSearchGet_ebs12211",
//             "iExpense_GetAttachments_ebs12211",
//             "iExpense_RemoveAttachment_ebs12211",
//             "iExpense_AddUpdateAttachment_ebs12211",
//             "iExpense_GetReviewLineViolation_ebs12211",
//             "iExpense_lineDetailsCancel_ebs12211",
//             "iExpense_saveReportReview_ebs12211",
//             "iExpense_ReviewGetDetails_ebs12211",
//             "iExpense_reviewAndFinish_ebs12211",
//             "iExpense_withdraw_report_ebs12211",
//             "iExpense_getUpdReports_ebs12211",
//             "iExpense_getUpdReportsPrevNext_ebs12211"]
//     });

// return {
//      "configurations": {
//         "ebs1213": ebs1213,
//         "ebs12211": ebs12211
//      },
//      "DefaultConfiguration": "ebs1213"
// }
