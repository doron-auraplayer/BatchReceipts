
function onLoad() {
    // Not working with regular button/jquery click. 
    // If I update a field and immediatly click the done button the done is not trigered in the standard way
    var myButton = document.getElementById('Save'); // Or use querySelector('.my-button-class')
    if (myButton) { // Always a good practice to check if the element exists
      myButton.addEventListener('click', function() {
          onSave();
      });
    }

	$("#Add_Line").addClass("TableAddLineBtn");
	$("#Add_Line").text("");
    $("#Add_Line").append('<i class="fa fa-plus" aria-hidden="true"></i>');
	$("#Add_Line").css({'top': '3px'});
	//$("#Add_Line").css({'margin-left': '10px'});

    /*$("#NewName").attr("style", "width: 80%;display: inline;");
    $("#NewEmployer").attr("style", "width: 80%;display: inline;");*/
    $("#tableOutput_wrapper").parent().append($("#Add_Line"));

    loadGuestTable();
}

function loadGuestTable() {
    Table.clear();
    Services.call("iExpense_attendeesGuestTableGetJS", function() {
        $(".table-actions-container").parent().attr("style", "text-align: center;");
    } , displayReportServiceError('Failed to get guests'));    
}

/*Events.tablePopulated = function(){
    $('input[id^="AttendiesGuestTableName_"]').change(OnUpdateGuestDetails);
    $('input[id^="AttendiesGuestTableEmployer_"]').change(OnUpdateGuestDetails);
};*/

function hasDuplicateGuets() {
    var guestNamesArr = Storage.getArray("AttendiesGuestTableName");

    var seen = {}; // Use an object as a hash map to store seen elements
    for (var j = 0; j < guestNamesArr.length; j++) {
      var item = guestNamesArr[j];
      if (item.length >0 && seen[item]) { // If the item is already a key in 'seen', it's a duplicate
        return true;
      }
      seen[item] = true; // Mark the item as seen
    }
    return false; // No duplicates found
}

function hasGuetsWithEmptyValues() {
    var guestNamesArr = Storage.getArray("AttendiesGuestTableName");
    var guestEmployerArr = Storage.getArray("AttendiesGuestTableEmployer");

    for (var i = 0; i < guestNamesArr.length; i++) {
        if (guestNamesArr[i].length === 0 && guestEmployerArr[i].length === 0) {
            return true;
        }
    }
    return false;
}

function onSave() {
    //console.log("in done");
    Fields.storeAll();
    if (hasDuplicateGuets()) {
        Popup.ok("Error", "You have duplicate guest names");
        return;
    }
    if (hasGuetsWithEmptyValues()) {
        Popup.ok("Error", "You have lines with empty values");
        return;
    }

    var goToPage = "LineDetails.html";
    if (Storage.get("GuestsCommingFrom") === "ItemizedLine") {
        Storage.clear("GuestsCommingFrom");
        goToPage = "ItemizedLine.html";
    }

    // Services.call("iExpense_attendeesGuestTableRemoveAll", function() {
    //     var index = 0;
    //     Table.toArray().forEach (function(row) {
    //         Storage.set("guestIndex", index);
    //     	Storage.set("GuestName", row.AttendiesGuestTableName);
    //     	Storage.set("GuestEmployer", row.AttendiesGuestTableEmployer);
    //     	Services.callSync("iExpense_attendeesGuestTableAddRow", displayReportServiceError('Failed to set new Guest'));
    //     	index++;
    //     });
        
    //     Storage.set("fromSelectGuest", "true");
    //     Page.navigate(goToPage);
        
    // },  displayReportServiceError('Failed to remove all guests'));
    Storage.set("fromSelectGuest", "true");
    Page.navigate(goToPage);
}

function onCancel() {
    var goToPage = "LineDetails.html";
    if (Storage.get("GuestsCommingFrom") === "ItemizedLine") {
        Storage.clear("GuestsCommingFrom");
        goToPage = "ItemizedLine.html";
    }
    Page.navigate(goToPage);
}

function onAddLine() {
    Storage.set("AddNewGuest", false);
    Popup.openPage("NewGuest", newGuestPopupClosed); //, height, width);
}

function newGuestPopupClosed() {
    if (Storage.get("AddNewGuest") !== 'true') {
        return;
    }
    
    var tableCountRows = Table.countRows();
    Storage.set("AttendiesGuestTableName_" + tableCountRows, "");
    Storage.set("AttendiesGuestTableEmployer_" + tableCountRows, "");
    Table.populate();
    Storage.set("GuestNewRow", "true");
    Storage.set("guestIndex", Table.countRows() - 1);
	Services.call("iExpense_attendeesGuestTableAddRow", function() {
	    loadGuestTable();
	}, displayReportServiceError('Failed to add new Guest'));    
}

function Delete(rowIndex) {
    var selectorPart = "Guest";
    if (Storage.get("GuestsCommingFrom") === 'ItemizedLine') {
        selectorPart = "Child" + selectorPart;
    }
    Storage.set("SelectorPart", selectorPart);
	Storage.set("removeIndex", rowIndex);
    Services.call("iExpense_empOrGuestTableRemoveJS", function() {
        loadGuestTable();
    }, displayReportServiceError('Failed to remove Guest'));
}

// function OnUpdateGuestDetails(e) {
//     var row = e.currentTarget.id.split("_")[1];
//     Fields.storeAll();
//     Storage.set("guestIndex", row);
//     Storage.set("GuestNewRow", "false");
// 	Storage.set("GuestName", Storage.get("AttendiesGuestTableName_" + row));
// 	Storage.set("GuestEmployer", Storage.get("AttendiesGuestTableEmployer_" + row));
// 	Services.callSync("iExpense_attendeesGuestTableAddRow", displayReportServiceError('Failed to update Guest'));
// }

