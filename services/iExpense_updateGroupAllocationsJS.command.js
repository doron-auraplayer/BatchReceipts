var indexArr = ServiceManager.getInput("ResouceIndexList").split(",");


var response;
var error;
for (var i=0; i<indexArr.length; i++ ) {
    response = Services.call("iExpense_AllocationsSelectLine", {
        "keepAlive": true,
    	"resourceSelectedLine": indexArr[i]
    });
    error = ServiceManager.getResponseValue(response, 'Error');
    if (error.length !== 0) {
    	throw(error);
    }
}
response = Services.call("iExpense_openAllocationUpdateWindow", {
    "keepAlive": true,
});
error = ServiceManager.getResponseValue(response, 'Error');
if (error.length !== 0) {
	throw(error);
}

return {
};