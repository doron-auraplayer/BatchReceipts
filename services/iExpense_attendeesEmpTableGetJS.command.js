function getAttendies(scroll) {
    var iExpense_attendeesEmpTableGet_Response = Services.call("iExpense_attendeesEmpTableGet", {
    	"ItemizedItem": ServiceManager.getInput("ItemizedItem"),
    	"ReportCreateEmpName": ServiceManager.getInput("ReportCreateEmpName"),
    	"scrollDown": scroll,
    	"sessionId": ServiceManager.getInput("sessionId"),
    	"mock": ServiceManager.getInput("mock")
    });
    var iExpense_attendeesEmpTableGet_Error = Services.getResponseValue(iExpense_attendeesEmpTableGet_Response, 'Error');
    if (iExpense_attendeesEmpTableGet_Error.length !== 0) {
    	throw(iExpense_attendeesEmpTableGet_Error);
    }
    
    return iExpense_attendeesEmpTableGet_Response;
}

function removeDuplicates(arr) {
  var seen = {};
  var result = [];

  for (var i = 0; i < arr.length; i++) {
    var item = arr[i];
    if (!seen[item]) {
      seen[item] = true;
      result.push(item);
    }
  }
  return result;
}

var getAttResponse = getAttendies(false);
var attNames = Services.getResponseArray(getAttResponse, 'AttendiesEmpTableEmpName');
var attTitles = Services.getResponseArray(getAttResponse, 'AttendiesEmpTableEmpTitle');
var rowsTo = parseInt(Services.getResponseValue(getAttResponse, "AttPaginationInfo").split(" ")[3]);

if (rowsTo === 15) {
    var prevRowsTo = rowsTo;
    var attNames1;
    var safeCouter = 0;
    while (safeCouter < 10) {
        getAttResponse = getAttendies(true);
        attNames1 = Services.getResponseArray(getAttResponse, 'AttendiesEmpTableEmpName');
        rowsTo = parseInt(Services.getResponseValue(getAttResponse, "AttPaginationInfo").split(" ")[3]);
        if (rowsTo === prevRowsTo) {
            break;        
        } else {
            attNames = attNames.concat(attNames1.slice(prevRowsTo - rowsTo));
            prevRowsTo = rowsTo;
        }
        safeCouter += 1;
    }
}

attNames = removeDuplicates(attNames);


return {
	"AttendiesEmpTableEmpName":  attNames,
	"AttendiesEmpTableEmpTitle": attTitles,
	"rowsTo": rowsTo
}