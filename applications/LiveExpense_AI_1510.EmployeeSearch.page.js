function onGetSuccess() {
        // set prev/next button
        var paginationExists = Storage.get("paginationExists") === 'true';
        var paginationText = Storage.get("currentListRange");
    
        if (paginationExists) {
            // var nextButtonExists = Storage.get('nextButtonExist') == 'true';
            // $('#Next').prop( "disabled", !nextButtonExists);
            // $("#Next").text(getPaginationButtonLabel("Next", Storage.get("nextButtonLabel") !== ""?Storage.get("nextButtonLabel"):"Next"));

            // var prevButtonExists = Storage.get('prevButtonExist') == 'true';
            $('#Previous').prop( "disabled", (paginationText.split(" ")[1].trim() === "1"));
            // $("#Previous").text(getPaginationButtonLabel("Previous", Storage.get("prevButtonLabel") !== ""?Storage.get("prevButtonLabel"):"Previous"));
        // } else {
        //     $('#Previous').hide();
        //     $("#Next").hide();
        }
        $("#listRange").text(paginationText);
}

function onSearch() {
    Storage.clear("paginationExists");
    Services.call("iExpense_employeeSearchGet", onGetSuccess, displayReportServiceError('Failed to search locations'));
}

function returnToEmployeesTable() {
    Storage.set("fromEmployeeSearch", "true");
    Page.navigate("Attendees.html");
}

function onCancel() {
    Services.call("iExpense_employeeSearchClose", function() {
        Storage.set("EmpToAddName" , "");
        Storage.set("EmpToAddTitle" , "");

        returnToEmployeesTable();
    },displayReportServiceError('Failed to select employee'))
}

function onLoad() {
    Fields.clearAll();
    Table.clear();
    $('#Previous').hide();
    $("#Next").hide();
    $("#listRange").hide();

    // set prev/next button
    $('#Next').show();
    $('#Previous').show();
    // $('#Next').prop( "disabled",  true);
    $('#Next').parent().prop( "style",  'flex: 1 1 50px !important');
    // $('#Previous').prop( "disabled", true);
    $('#Previous').parent().prop( "style",  'flex: 1 1 50px !important');
    $("<span id='listRange' style='flex: 1 1 50px !important; text-align: center; align-self: center'></span>").insertAfter($("#Previous").parent());
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");

    Storage.deleteByPrefix("PopupEmployee");
    // Storage.remove("PopupEmployeeName");
    // Storage.remove("PopupEmployeeTitle");
    populateField("EmployeeSearchBy", "Employee Name");
    
    if (Storage.get("EmployeeSearchValue").length > 0) {
        Fields.set("EmployeeSearchValue", Storage.get("EmployeeSearchValue"));
        onSearch();
    }
}

function OnSelectEmployee(row, col, rowCells) {
    var rowData = rowCells;
    // Services.call("iExpense_employeeSearchClose", function(rowCells) {
    Storage.set("attendeeIndex", row);
    Services.call("iExpense_employeeSearchSelect", function(rowCells) {
        // var index = Storage.get("attendeeIndex");
        // Storage.set("AttendiesEmpTableEmpName_" + index , rowData[0]);
        // Storage.set("AttendiesEmpTableEmpTitle_" + index, rowData[2]);
        Storage.set("EmpToAddName" , rowData[0]);
        Storage.set("EmpToAddTitle" , rowData[2]);
        returnToEmployeesTable()
    }, displayReportServiceError('Failed to select employee'))
}


function EmployeeSearchBy_lov_item_handler(item, label) {
	populateFieldHTML("EmployeeSearchBy", label !== undefined ? label : item);
	store("EmployeeSearchBy", item);
}

function onNext() {
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
	Storage.set('moveNext', 'true')
	Services.call('iExpense_employeeSearchPrevNext', onGetSuccess, displayReportServiceError("Failed to fetch next employees"));
}

function onPrev() {
    Storage.remove("prevButtonLabel");
    Storage.remove("nextButtonLabel");
	Storage.set('moveNext', 'false')
	Services.call('iExpense_employeeSearchPrevNext', onGetSuccess, displayReportServiceError("Failed to fetch previous employees"));
}

