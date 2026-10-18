// Pushed to git
function initData() {
    Storage.clear();
    loadEnvConfiguration(); 

    initI18n();
    clearForm();
    if (getEnvConfiguration().ExpenseShowMultiLanguage) {
        $("#Language_container").show();
        var currentLanguage = localStorage.getItem('language')?localStorage.getItem('language'):"English";
    	Language_lov_item_handler(currentLanguage);
    }
}

//function Language_lov_item_handler(item, label) {
//	populateFieldHTML("Language", label !== undefined ? label : item);
//	store("Language", item);
//	if (typeof api18n === 'undefined') {
//        localStorage.setItem('language', item);
//        invokeI18n();
//	} else {
//        switchLanguage(item);
//	}
//}
function Language_lov_item_handler(item, label) {
	populateFieldHTML("Language", label !== undefined ? label : item);
	store("Language", item);
}

function test () {console.log("aaa")}

function onLogin() {
    Storage.remove("LoginErrorMessageExists");
    Storage.remove("LoginErrorMessage");
    Services.killSession();
    Services.startSession();
	Services.call('iExpense_login_with_resps', function() {
	    Storage.remove("LineDetailsUpdate");
        if (Storage.get("LoginErrorMessageExists") === "true") {
            var errorMessage = Storage.get("LoginErrorMessage");
            if (errorMessage.toLowerCase().startsWith("error")) {
                errorMessage = errorMessage.substr(5);
            }
            Popup.ok(getTranslationForId("@popup_title_error"), errorMessage);
        } else {
            if (Storage.count("respIds") === 1) {
                var expenseUrl = Storage.get ("ExpensesHomeUrl");
                var currRespId = expenseUrl.match("resp_id=(.*)&resp_appl")[1].trim();
                expenseUrl = expenseUrl.replace(currRespId,  Storage.get("respIds_0"))
                Storage.set('respId', Storage.get("respIds_0"));
                Storage.set("ExpensesHomeUrl", expenseUrl);
                Storage.set("CurrentRespName", Storage.get("respNames_0"));
                Page.navigate("Reports.html");
            } else {
                Page.navigate("Responsibilities.html");
            }
        }
    }, displayReportServiceError("Failed to Login"));

}