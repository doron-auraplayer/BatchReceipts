function onTableClick(row, col, rowCells) {
    var expenseUrl = Storage.get ("ExpensesHomeUrl");
    var currRespId = expenseUrl.match("resp_id=(.*)&resp_appl")[1].trim();
    var currRespAppId = expenseUrl.match("resp_appl_id=(.*)&security_group_id")[1].trim();
    var newRespId = Storage.get("respIds_" + row);
    var newRespAppId = Storage.get("respAppIds_" + row);
    Storage.set('respId', newRespId);
    Storage.set('respAppId', newRespAppId);
    Storage.set("CurrentRespName", Storage.get("respNames_" + row));
    expenseUrl = expenseUrl.replace(currRespId,  newRespId);
    expenseUrl = expenseUrl.replace(currRespAppId,  newRespAppId);
    Storage.set("ExpensesHomeUrl", expenseUrl);

    Page.navigate("Reports.html");
}

