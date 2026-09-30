var removeIndex = ServiceManager.getInput("removeIndex");
var SelectorPart = ServiceManager.getInput("SelectorPart");
var scrollResponse = Services.call("iExpense_empOrGustTableScrollTop", {
    "SelectorPart": SelectorPart,
	"sessionId": ServiceManager.getInput("sessionId"),
	"mock": ServiceManager.getInput("mock")
});

var rowRangeSplit = Services.getResponseValue(scrollResponse, "RowRange").split(" ");
var rowsFrom = parseInt(rowRangeSplit[1]) || 1;
var rowsTo = parseInt(rowRangeSplit[3]) || removeIndex + 1;

var safeCouter = 0;
while (rowsTo <= removeIndex) {
    scrollResponse = Services.call("iExpense_empOrGustTableScrollDown", {
        "SelectorPart": SelectorPart,
	    "sessionId": ServiceManager.getInput("sessionId"),
	    "mock": ServiceManager.getInput("mock")
    });
    
    rowRangeSplit = Services.getResponseValue(scrollResponse, "RowRange").split(" ");
    rowsFrom = parseInt(rowRangeSplit[1]);
    rowsTo = parseInt(rowRangeSplit[3]);
    
    if (safeCouter > 10)
        break;
    safeCouter++;
}

var calculatedIndex = removeIndex - rowsFrom + 1;
var removeResponse = Services.call("iExpense_empOrGustTableRemove", {
    "SelectorPart": SelectorPart,
    "removeIndex": calculatedIndex,
    "sessionId": ServiceManager.getInput("sessionId"),
    "mock": ServiceManager.getInput("mock")
});

return {
	"calculatedIndex": calculatedIndex
}