function removeEmptyEmployeeLines() {
    var numRows = Storage.count('AttendiesEmpTableEmpName_0');
    for (var i=numRows-1; i>=0; i--) {
        if (Storage.get("AttendiesEmpTableEmpName_" + i) === "") {
            removeStorageByPRefixAndIndex("AttendiesEmpTableEmpName", i);
            Table.deleteRow(i);
        }
    }

}

function addEmployee() {
    var newEmpNameToAdd = Storage.get("EmpToAddName");
    var newEmpTitleToAdd = Storage.get("EmpToAddTitle");

    if (newEmpNameToAdd.length >0) {
        var empIndex = Table.countRows();
        Storage.set("AttendiesEmpTableEmpName_" + empIndex , newEmpNameToAdd);
        Storage.set("AttendiesEmpTableEmpTitle_" + empIndex, newEmpTitleToAdd);
        Table.populate();
    //     Storage.set("attendeeIndex", empIndex);
    // 	Storage.set("EmployeeName", newEmpNameToAdd);
    // 	Services.call("iExpense_employeeTableAddLine", function() {
    //         Storage.set("AttendiesEmpTableEmpName_" + empIndex , newEmpNameToAdd);
    //         Storage.set("AttendiesEmpTableEmpTitle_" + empIndex, newEmpTitleToAdd);
    //         Table.populate();
    // 	},displayReportServiceError('Failed to set new Employee'));
    }


}

function loadEmpTable() {
    Services.call("iExpense_attendeesEmpTableGetJS", function() {
        // removeEmptyEmployeeLines();
    }, displayReportServiceError('Failed to get attendees list'));
}

function onLoad() {
	$("#Add_Employee").addClass("TableAddLineBtn");
	$("#Add_Employee").css({'top': '3px'});
	$("#Add_Employee").css({'margin-left': '10px'});

    $("#AttendeeName").attr("style", "width: 80%;display: inline;");
    $("#AttendeeName").parent().append($("#Add_Employee"));
    $("#AttendeeName").parent().append($("#Clean_Employee"));
    
    $('#AttendeeName').keydown(function(e) {
        // Enter or Tab
        if (Fields.get("AttendeeName").length > 0 && (e.which == 13 || e.which == 9)) {
          e.preventDefault();
          onAddEmployee();
        }
    });

    Events.tableConfigure = function(config){
        config.lengthChange = false;
        
        config.responsive = true;
        config.columnDefs = [{
            width:'40%', targets: '0',
        },{
            width:'45%', targets: '1'
        }];
        return config;
    };
    $("#table_add_button").hide();
    //New employee selection
    if (Storage.get("fromEmployeeSearch") === 'true') {
        // return from search employee window, index is already set
        Storage.remove("fromEmployeeSearch");
        addEmployee();
    } else {
        //New employee selection
        loadEmpTable();
    }
}

function searchEmployee() {
	Services.call("iExpense_employeeSearchOpen", function() {
	    Page.navigate("EmployeeSearch.html");
	}, displayReportServiceError('Failed to open employee search popup'));
}


function onAddEmployee() {
    Storage.set("attendeeIndex", Table.countRows());

    if (Fields.get("AttendeeName").length > 0) {
    	Services.call("iExpense_employeeEnterName", function() {
            var isSearchWindow = Storage.get("EmployeeSearchWindowDisplayed") === "true";
            if (isSearchWindow) {
                Storage.set("EmployeeSearchValue", Fields.get("AttendeeName"));
        	    Page.navigate("EmployeeSearch.html");
            } else {
                Storage.set("AttendiesEmpTableEmpName_" + Table.countRows(), Storage.get("ResolvedEmpName") );
                Table.populate();
            }
    	    Fields.clear("AttendeeName");
    	}, displayReportServiceError('Failed to enter employee name'));
    } else {
      Storage.clear("EmployeeSearchValue");
      searchEmployee(); 
    }
}

function hasDuplicates() {
    var empNameArr = Storage.getArray("AttendiesEmpTableEmpName");
    var seen = {}; // Use an object as a hash map to store seen elements
    for (var i = 0; i < empNameArr.length; i++) {
      var item = empNameArr[i];
      if (seen[item]) { // If the item is already a key in 'seen', it's a duplicate
        return true;
      }
      seen[item] = true; // Mark the item as seen
    }
    return false; // No duplicates found
}

function onSave() {
    
    if (hasDuplicates()) {
        Popup.ok("Error", "You have set duplicate Attedies");
        return;
    }
    
    var goToPage = "LineDetails.html";
    if (Storage.get("AttendiesCommingFrom") === "ItemizedLine") {
        Storage.clear("AttendiesCommingFrom");
        goToPage = "ItemizedLine.html";
    } 

    Storage.set("fromSelectEmployees", "true");
    Page.navigate(goToPage);

}

function onCancel() {
    
    var goToPage = "LineDetails.html";
    if (Storage.get("AttendiesCommingFrom") === "ItemizedLine") {
        Storage.clear("AttendiesCommingFrom");
        goToPage = "ItemizedLine.html";
    } 
    Storage.set("fromSelectEmployees", "true");
    Page.navigate(goToPage);
}


function Remove(rowIndex) {
    var selectorPart = "Employee";
    if (Storage.get("AttendiesCommingFrom") === 'ItemizedLine') {
        console.log("AttendiesCommingFrom === ItemizedLine");
        selectorPart = "Child" + selectorPart;
    }
    Storage.set("SelectorPart", selectorPart);
    Storage.set("removeIndex", rowIndex);
    Services.call("iExpense_empOrGuestTableRemoveJS", function() {
        loadEmpTable();
    }, displayReportServiceError('Failed to remove Employee'));
}



