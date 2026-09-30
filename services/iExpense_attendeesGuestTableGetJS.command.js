function getGuests(scroll) {
    var iExpense_attendeesGuestTableGet_Response = Services.call("iExpense_attendeesGuestTableGet", {
    	"ItemizedItem": ServiceManager.getInput("ItemizedItem"),
    	"ReportCreateGuestName": ServiceManager.getInput("ReportCreateGuestName"),
    	"scrollDown": scroll,
    	"sessionId": ServiceManager.getInput("sessionId"),
    	"mock": ServiceManager.getInput("mock")
    });
    var iExpense_attendeesGuestTableGet_Error = Services.getResponseValue(iExpense_attendeesGuestTableGet_Response, 'Error');
    if (iExpense_attendeesGuestTableGet_Error.length !== 0) {
    	throw(iExpense_attendeesGuestTableGet_Error);
    }

    return iExpense_attendeesGuestTableGet_Response;
}

// function removeDuplicates(arr) {
//   var seen = {};
//   var result = [];

//   for (var i = 0; i < arr.length; i++) {
//     var item = arr[i];
//     if (!seen[item]) {
//       seen[item] = true;
//       result.push(item);
//     }
//   }
//   return result;
// }

var getGuestResponse = getGuests(false);
var guestNames = Services.getResponseArray(getGuestResponse, 'AttendiesGuestTableName');
var guestTitles = Services.getResponseArray(getGuestResponse, 'AttendiesGuestTableTitle');
var guestEmployers = Services.getResponseArray(getGuestResponse, 'AttendiesGuestTableEmployer');
var rowsTo = parseInt(Services.getResponseValue(getGuestResponse, "guestPaginationInfo").split(" ")[3]);

if (rowsTo === 15) {
    var prevRowsTo = rowsTo;
    var guestNames1;
    var guestTitles1;
    var guestEmployers1;
    var safeCouter = 0;
    while (safeCouter < 10) {
        getGuestResponse = getGuests(true);
        guestNames1 = Services.getResponseArray(getGuestResponse, 'AttendiesGuestTableName');
        guestTitles1 = Services.getResponseArray(getGuestResponse, 'AttendiesGuestTableTitle');
        guestEmployers1 = Services.getResponseArray(getGuestResponse, 'AttendiesGuestTableEmployer');
        rowsTo = parseInt(Services.getResponseValue(getGuestResponse, "guestPaginationInfo").split(" ")[3]);
        
        if (rowsTo === prevRowsTo) {
            break;        
        } else {
            guestNames = guestNames.concat(guestNames1.slice(prevRowsTo - rowsTo));
            guestTitles = guestTitles.concat(guestTitles1.slice(prevRowsTo - rowsTo));
            guestEmployers = guestEmployers.concat(guestEmployers1.slice(prevRowsTo - rowsTo));
            prevRowsTo = rowsTo;
        }
        safeCouter += 1;
    }
}

// guestNames = removeDuplicates(guestNames);
// guestTitles = removeDuplicates(guestTitles);
// guestEmployers = removeDuplicates(guestEmployers);

if (guestNames.every(function(element) { return element === ""; })) {
    guestNames = guestEmployers;
}

return {
	"AttendiesGuestTableName":  guestNames,
	"AttendiesGuestTableTitle": guestTitles,
	"AttendiesGuestTableEmployer": guestEmployers,
	"rowsTo": rowsTo
}

