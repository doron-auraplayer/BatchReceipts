function showHideFields() {
    
    Fields.hide("ItemizedNumDays","ItemizedDailyRate","DisplayEmployees", "DisplayGuests");
    $('#Attendees').hide();
    $('#Guests').hide();
    var expenseType = Fields.get("ItemizedExpenseType");
    if (expenseType.indexOf("Meals") > -1 || expenseType.indexOf("Alcohol") > -1) {
        Fields.show("DisplayEmployees","DisplayGuests");
    } else {
        Fields.show("ItemizedNumDays","ItemizedDailyRate");
    }
}

function onLoad() {
    Fields.clear("DisplayEmployees");
    Fields.clear("DisplayGuests");
    showHideFields();

    if (Storage.get("ItemizedEmpTableExist") === "true") {
        Storage.set("ItemizedItem", "true");
        Services.callSync("iExpense_attendeesEmpTableGetJS", displayReportServiceError('Failed to get attendees list'));
        Fields.set("DisplayEmployees", Storage.getArray("AttendiesEmpTableEmpName").join(",") );
        
        Services.callSync("iExpense_attendeesGuestTableGetJS", displayReportServiceError('Failed to get guests list'));
        Fields.set("DisplayGuests", Storage.getArray("AttendiesGuestTableName").join(","));
        Storage.clear("ItemizedItem");
    }

}

