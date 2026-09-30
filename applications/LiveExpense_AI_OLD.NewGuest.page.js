function onAdd() {
    var newName = Fields.get("GuestName");
    if (newName.length < 1) {
        return;
    }
    
	Storage.set("GuestName", newName);
	Storage.set("GuestEmployer", Fields.get("GuestEmployer"));
	
	if (hasDuplicate()) {
	    Popup.toast("Guest must be unique", 5000);
	    return;
	}
	
	Storage.set("AddNewGuest", true);
	Popup.closePage("NewGuest");
}

function onCancel() {
	Popup.closePage("NewGuest");
}

function hasDuplicate() {
    var guestNames = Storage.getArray("AttendiesGuestTableName");
    var guestEmployers = Storage.getArray("AttendiesGuestTableEmployer");
    var newName = Storage.get("GuestName");
    var newEmployer = Storage.get("GuestEmployer");
    
    for (var i = 0; i < guestNames.length; i++) {
        if (newName === guestNames[i] && newEmployer === guestEmployers[i]) {
            return true;
        }
    }
    
    return false;
}

function onLoad() {
    Storage.set("AddNewGuest", false);
    Storage.clear("GuestName");
    Storage.clear("GuestEmployer");
	Fields.clear("GuestName", "GuestEmployer");
}

