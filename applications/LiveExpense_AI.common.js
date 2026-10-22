// // Logger.setLevel("info");
// Logger.setMaxEntries(100);


var app = {};
app.name = 'LiveExpense'; //The application name, will be updated upon application rename
app.addLogoutToMenu = true;
app.isSPA = true;
app.loginPage = 'Login.html';
app.logoutCallback = customLogoutCB;

function customLogoutCB() {
    var callingApp = Storage.get("CallingMainApp");
    if (callingApp) {
    	window.location.href = callingApp+"Login.html";
    } else {
        Page.navigate(app.loginPage);
    }
}

// Customr customizable properties
app.defaultConfig = "";

app.serviceManagerHost = '';		// to execute API calls on other server
app.serviceCallTimeout = 120000;		// milliseconds to wait for service calls to finish
app.serviceSuppressedParams = [
    'Select_', 
    'AgeDays_', 
    'Location_', 
    'MerchantName_',
    'TransactionAmount_', 
    'TransactionDate_'];		    // inputs that won't be sent to service calls
app.loginPage = 'Login.html';


function addUsernameToMenu() {
    //  display user name in menu
    if ($("#menu-username").length === 0 && Storage.get("LoggedInUsername") !== "") {
       $('<div id="menu-username" style="bottom: 5px; font-size: 10px; position: absolute; right:5px">User: ' + Storage.get("LoggedInUsername") + '</div>').insertBefore('#sidebarLogo');
    } else {
        $("#menu-username").text('User: ' + Storage.get("LoggedInUsername"));
    }
}

function checkHomeMenu() {
    var callingApp = Storage.get("CallingMainApp");
    if (callingApp ==="") {
        $("#menu-item-Home").parent().hide();
    } else {
        $("#menu-item-Home").attr("href", "");
        $("#menu-item-Home").click(function() {
    	    window.location.href = callingApp+"Home.html";
        });
    }
}

function addShowSnapshot() {
    if ($("#show-snapshot-btn").length === 0) {
        $(".ui-listview").append('<div style="margin-left: 5px;position: absolute;bottom: 40px; margin-top: 20px;font-size: smaller;" ><button style="border: none" id="show-snapshot-btn">Display EBS Snapshot</button></div>');
        $("#show-snapshot-btn").click(function() {
            Services.call("EBS_TakeSnapshot", function(){
                window.open(location.origin + "/ServiceManager/data/temp/EBS_CurrentWindow.html","_blank");
            });
        });
    }
    if (!app.snapshotKeyIsSet) {
        app.snapshotKeyIsSet = true;
        $(document).on('keydown', function(event) {
            // Check if Alt key is pressed and the key is 'S' (case-insensitive)
            if (event.altKey && (event.key === 's' || event.key === 'S')) {
                event.preventDefault(); // Prevent default browser actions (e.g., opening history)
                Services.call("EBS_TakeSnapshot", function(){
                    window.open(location.origin + "/ServiceManager/data/temp/EBS_CurrentWindow.html","_blank");
                });
            }
        });
    }
    
    // if (Storage.get("debugger") === "true") {
    //     if ($("#show-snapshot-btn").length === 0) {
    //         $("#debugger").append('<div style="margin-top: 20px;" ><button style="border: none" id="show-snapshot-btn">Display Current Snapshot</button></div>')
    //         $("#show-snapshot-btn").click(function() {
    //             Services.call("EBS_TakeSnapshot", function(){
    //                 window.open(location.origin + "/ServiceManager/data/temp/EBS_CurrentWindow.html","_blank")
    //             })
    //         })
    //     }
    // }
}

var origDebuggerInit = Debugger.start;
Debugger.start = function() {
    origDebuggerInit();
    // addShowSnapshot();
}

Events.pageChanged = function(){
    invokeI18n();
    addUsernameToMenu();
    checkHomeMenu();
    showHideCinfigurationList();
    addShowSnapshot();
    
};


function setTableHeaderRows(serviceName, numOfRows) {
    // If tableHasHtableHeaderRows is set to some configurations but we have some services that needs other configuration...
    if (!getEnvConfiguration().tableHasHeader && getEnvConfiguration().ExpenseTableHasHeaderServices && getEnvConfiguration().ExpenseTableHasHeaderServices.indexOf(serviceName) > -1) {
        Storage.set("tableHeaderRows", numOfRows);
    }
}

function resetTableHeaderRows() {
    Storage.set("tableHeaderRows",  getEnvConfiguration().tableHeaderRows);
}

// function setHistoryBackPage (title, location) {
//     var currentTitle = document.title;
//     var currentLocation = location.href;
//     history.replaceState(null, title, location);
//     history.pushState(null, currentTitle, currentLocation);
// }

function disableBackFunction(event) {
    history.pushState(null, document.title, location.href);
}

function disableBrowserBackButton() {
    // disable back
    setTimeout(function() {
        history.pushState(null, document.title, location.href);
        window.addEventListener('popstate', disableBackFunction);
    }, 1000);
}

function enableBrowserBackButton() {
    window.removeEventListener('popstate', disableBackFunction);
}


disableBrowserBackButton();

function clearForm() {
    $(function(){
        Fields.clearAll();
        Object.keys(defaultValues).forEach(function(paramName) {
	    	if ($('#' + paramName).attr("data-type") !== 'date') {
	    	    delete defaultValues[paramName];
	    	}
        });     // so it won't override the effect of Fields.clear
    });
}

function reLogin() {
    Storage.remove("LoginErrorMessageExists");
    Storage.remove("LoginErrorMessage");
    Services.killSession();
    Services.startSession();
    //Page.navigate("Reports.html");
	Services.call('iExpense_login', function() {
	    Storage.remove("LineDetailsUpdate");
        if (Storage.get("LoginErrorMessageExists") === "true") {
            var errorMessage = Storage.get("LoginErrorMessage");
            if (errorMessage.toLowerCase().startsWith("error")) {
                errorMessage = errorMessage.substr(5);
            }
            Popup.ok(getTranslationForId("@popup_title_error"), errorMessage);
        } else {
            if (location.hash === "#Reports") {
                location.reload();
            } else {
                Page.navigate("Reports.html");
            }
        }
    }, displayReportServiceError("Failed to Login"));
}

// Log in, run the success function.
// Log in, then run the supplied function.
function reLoginAndRun(onSuccess) {
    Storage.remove("LoginErrorMessageExists");
    Storage.remove("LoginErrorMessage");

    Services.killSession();
    Services.startSession();

    Services.call('iExpense_login', function() {
        Storage.remove("LineDetailsUpdate");

        if (Storage.get("LoginErrorMessageExists") === "true") {
            var errorMessage = Storage.get("LoginErrorMessage");

            if (errorMessage.toLowerCase().startsWith("error")) {
                errorMessage = errorMessage.substr(5);
            }

            Popup.ok(
                getTranslationForId("@popup_title_error"),
                errorMessage
            );
            return;
        }

        if (typeof onSuccess === "function") {
            onSuccess();
        }
    }, displayReportServiceError("Failed to Login"));
}


ERROR_SEESION_EXPIRED_MSG1 = "session not found or already in use";
ERROR_SEESION_EXPIRED_MSG2 = "missing query parameter: sessionId";
function displayReportServiceError(msg, goToPage) {
    return function(response, serviceName) {
        Spinner.stop();
    	var errorMsg = Storage.get('Error');
    	var reportErrorMsg = Storage.get('reportErrorMessage');
        Storage.remove("reportErrorMessage");
        var errorMessage = reportErrorMsg || errorMsg;
        console.error(msg + ": " + errorMessage);
        var serviceRunId = Storage.get("serviceRunId");
        if (errorMessage.indexOf(ERROR_SEESION_EXPIRED_MSG1) > -1 || errorMessage.indexOf(ERROR_SEESION_EXPIRED_MSG2) > -1) {
            errorMessage += "<br><br>click OK to re-login"
        } else if (serviceRunId.length > 0) {
            errorMessage = "An unexpected error has occurred. <br>Please try again in few minutes or contact your System Administrator<br><br><small>Service Error Id: [" + serviceRunId + "]</small>";
        }
        Popup.ok(getTranslationForId("@popup_title_error"), msg + "<br><br>" + errorMessage, function() {
            if (goToPage) {
                Page.navigate(goToPage);
            } else {
                if (errorMessage.indexOf(ERROR_SEESION_EXPIRED_MSG1) > -1 || errorMessage.indexOf(ERROR_SEESION_EXPIRED_MSG2) > -1) {
                    reLogin();
                    // customLogoutCB();
                }
            }
        });
        
    }
}

function OnCancelPopup(onOk) {
    Popup.custom(getTranslationForId("@popup_title_cancel"), getTranslationForId("@popup_message_cancel"), getTranslationForId("@popup_button_yes"), getTranslationForId("@popup_button_no"), onOk, function(){});
}

function removeStorageByPRefixAndIndex (prefix, index) {
	var regex = new RegExp("^" + prefix + ".*_" + index + "$");
	Object.keys(sessionStorage).forEach(function(key) {
		if (regex.test(key)) {
			Storage.remove(key);
		}
	});
}

function addNewLineAfterButton (buttonId) {
    // set new line after button
	$('<p style="flex-basis: 100%; margin:0"></p>').insertAfter( $("#"+buttonId).parent() );
}

function disableLovField(lovId) {
    var lovSelector = "#" + lovId;
    $(lovSelector).parent().prop('disabled', true);
    $(lovSelector).parent().css('background-color', 'rgba(234, 234, 234, 0.6)');
    $(lovSelector + "_lov_trigger").off();
    $(lovSelector + '_lov_trigger').css('background-color', 'rgba(234, 234, 234, 0.6)');
}

function addTableActionListener(actionId, cb) {
    $('[id^=\"' + actionId + '\"]').on('click', function(){
        rowIdToProcess = this.getAttribute('data-row-id');
        cb(rowIdToProcess);
    });
}


function takeSnapshot() {
    Services.call("EBS_TakeSnapshot",function(){}, displayReportServiceError("Failed to take snapshot"));
}

function getSnapshot() {
    Services.call("EBS_TakeSnapshot",function(){
        setTimeout(function() {window.open(window.location.origin + "/ServiceManager/data/temp/EBS_CurrentWindow.html")},0);
        Spinner.stop();
    }, displayReportServiceError("Failed to take snapshot"));
}

function generateTableActionFontIcon (elementId, index) {
    var fontDetails = {
        displayReport: {font: 'fa-file-o', color: '#235784', size: '22px'},
        removeLine: {font: 'fa-trash-o', color: '#4e4e4e', size: '22px'},
        editLine: {font:'fa-pencil', color: '#b97106', size: '22px'},
        approvedLine: {font: 'fa-check', color: '#5cb85c', size: '22px'},
    };
    
    var fontName = fontDetails[elementId].font;
    var fontColor = fontDetails[elementId].color;
    var fontSize = fontDetails[elementId].size;
    var style = "color:" + fontColor + ";font-size:" + fontSize;
    var id = elementId + index;
    return '<span class="TableActionIcon" id="'+id+'" data-row-id=' + index + ' style=' + style + '><i class="fa ' + fontName +  ' aria-hidden="true"></i></span>';
}

/***** TAB: Config *****/
// to make sure the services will be in the backup

var extend = function ( defaults, options ) {
    var extended = {};
    var prop;
    for (prop in defaults) {
        if (Object.prototype.hasOwnProperty.call(defaults, prop)) {
            extended[prop] = defaults[prop];
        }
    }
    for (prop in options) {
        if (Object.prototype.hasOwnProperty.call(options, prop)) {
            extended[prop] = options[prop];
        }
    }
    return extended;
};

function getConfigurations() {
    // Services.call("iExpense_getConfiguration")
    origServicesCallSync('iExpense_getConfiguration', function(){alert("Failed to load configuration service")});
    
    // specific env configuration
    var ebs1213 = {
        ExpensesFilteredExpenseTypes: '',
        // FormsUrl: 'http://auravm01.us-west-2.compute.internal:8000',
        RespName: Storage.get("EBS1213_ExpensesMenuPrefix"),
        FunctionId: Storage.get("EBS1213_ExpensesFunctionId"),
        ExpensesHomeUrl: "/OA_HTML/RF.jsp?function_id=1019886&resp_id=54021&resp_appl_id=200&security_group_id=0&lang_code=US",
        ExpensesTableReportTotalColumnName: 'ReportTotalCurrency',
        ExpenseTypeCategories: "Receipt-Based;PerDiem;Mileage;",
        ExpenseConfirmationDialogExists: "false",
        ExpensesLongScroll: "false",
        LocationFieldEditable: "false",
        ProjectTaskFieldEditable: "false",
        ExpenseShowMultiLanguage: false,
        EnableAIToScanReceipt: true,
    };
    var ebs122 = {
        EbsVersion: "12.2.14",
        // FormsUrl: Storage.get("EBS122_ExpensesEbsUrl"),
        RespName: Storage.get("EBS122_ExpensesMenuPrefix"),
        FunctionId: Storage.get("EBS122_ExpensesFunctionId"),
        ExpensesHomeUrl: "/OA_HTML/RF.jsp?function_id=1019886&resp_id=54021&resp_appl_id=200&security_group_id=0&lang_code=US",
        ExpensesFilteredExpenseTypes: '',
        ExpensesTableReportTotalColumnName: 'ReportTotal',
        ExpenseTypeCategories: "Receipt-Based;PerDiem;Mileage;",
        ExpenseConfirmationDialogExists: "true",
        ExpenseTableHasHeaderServices: "iExpense_getReportDetailsPerDiemLines,iExpense_getReportDetailsMileageLines", 
        ExpensesLongScroll: "true",
        LocationFieldEditable: "true",
        ProjectTaskFieldEditable: "true",
        ExpenseShowMultiLanguage: false,
        ExpensesAttachmentsDialog: true,
        CashLinesWindowSize: 30,
        CashLinesMilleageWindowSize: 15,
        CashLinesPerDiemWindowSize: 15,
        CashLinesMinWindowSize: 10,
        CashLinesMinMilleageWindowSize: 5,
        CashLinesMinPerDiemWindowSize: 5,
        EnableAIToScanReceipt: true,
        SpecificServices: [
            "iExpense_OpenApproverSearchWindow_ebs12211", // Services.call("iExpense_OpenApproverSearchWindow_ebs12211")
            "iExpense_LocationSearchOpen_ebs12211", // Services.call("iExpense_LocationSearchOpen_ebs12211")
            "iExpense_openAllocationSearchWindow_ebs12211", // Services.call("iExpense_openAllocationSearchWindow_ebs12211")
            "iExpense_lineDetailsSet_ebs12211", // Services.call("iExpense_lineDetailsSet_ebs12211")
            "iExpense_removeUpdateReport_ebs12211", // Services.call("iExpense_removeUpdateReport_ebs12211")
            "iExpense_lineDetailsGet_ebs12211", // Services.call("iExpense_lineDetailsGet_ebs12211")
            "iExpense_removeFirstAttachment_ebs12211", // Services.call("iExpense_removeFirstAttachment_ebs12211")
            "iExpense_downloadAttachment_ebs12211", // Services.call("iExpense_downloadAttachment_ebs12211")
            "iExpense_employeeSearchOpen_ebs12211", // Services.call("iExpense_employeeSearchOpen_ebs12211")
            "iExpense_employeeSearchGet_ebs12211", // Services.call("iExpense_employeeSearchGet_ebs12211")
            "iExpense_GetAttachments_ebs12211", // Services.call("iExpense_GetAttachments_ebs12211")
            "iExpense_RemoveAttachment_ebs12211", // Services.call("iExpense_RemoveAttachment_ebs12211")
            "iExpense_AddUpdateAttachment_ebs12211", // Services.call("iExpense_AddUpdateAttachment_ebs12211")
            "iExpense_GetReviewLineViolation_ebs12211", // Services.call("iExpense_GetReviewLineViolation_ebs12211")
            "iExpense_lineDetailsCancel_ebs12211", // Services.call("iExpense_lineDetailsCancel_ebs12211")
            "iExpense_saveReportReview_ebs12211", // Services.call("iExpense_saveReportReview_ebs12211")
            "iExpense_ReviewGetDetails_ebs12211", // Services.call("iExpense_ReviewGetDetails_ebs12211")
            "iExpense_reviewAndFinish_ebs12211", // Services.call("iExpense_reviewAndFinish_ebs12211")
            "iExpense_withdraw_report_ebs12211", // Services.call("iExpense_withdraw_report_ebs12211")
            "iExpense_getUpdReports_ebs12211", // Services.call("iExpense_getUpdReports_ebs12211")
            "iExpense_getUpdReportsPrevNext_ebs12211", // Services.call("iExpense_getUpdReportsPrevNext_ebs12211")
            "iExpense_cash_removeLine_ebs12211", // Services.call("iExpense_cash_removeLine_ebs12211"),
            "iExpense_employeeSearchPrevNext_ebs12211",// Services.call("iExpense_employeeSearchPrevNext_ebs12211")
            "iExpense_locationEnterName_ebs12211", // Services.call("iExpense_locationEnterName_ebs12211")
            "iExpense_AllocationEnterValue_ebs12211", // Services.call("iExpense_AllocationEnterValue_ebs12211")
            "iExpense_CashLinesGetReceiptLines_ebs122", // Services.call("iExpense_CashLinesGetReceiptLines_ebs122")
            "iExpense_CashLinesNextPrev_ebs122",  // Services.call("iExpense_CashLinesNextPrev_ebs122")
            "iExpense_employeeEnterName_ebs12211",  // Services.call("iExpense_employeeEnterName_ebs12211")
            ]
        };
    
    return {
         "configurations": {
            "ebs1213": ebs1213,
            "ebs122": ebs122
         },
         "DefaultConfiguration": "ebs122"
    };
}

function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Query variable %s not found', variable);
}

function loadEnvConfiguration() {
    var configurationsData = getConfigurations();

    var configurations = configurationsData.configurations;
    var defaultConfiguration = configurationsData.DefaultConfiguration;
    // Set env conf variables to storage
    var confName = defaultConfiguration;
    var iExpenseConfig = configurations[confName];
    if (window.location.href.indexOf('?conf=') > -1) {
        // check requested configuratons
        confName = getQueryVariable("conf");
        if (configurations[confName] !== undefined) {
            iExpenseConfig = configurations[confName];
            iExpenseConfig.confName = confName;
        } else {
            Popup.ok("Error", "Unknown configuration");
        }
    }
    setConfListBox(configurations, confName);

    Storage.set("iExpenseConfig", JSON.stringify(iExpenseConfig));
    for (var attrname in iExpenseConfig) { 
        Storage.set(attrname, iExpenseConfig[attrname]);
    }
        
}

function showHideCinfigurationList() {
    $("#confList").hide();
    if (window.location.hash === "#Login") {
        $("#confList").show();
    }
}

function setConfListBox(configurations, confName) {
    if ($("#confList").length > 0) return;
    var confKeysArr = Object.keys(configurations);
    var selectBox =  '<select style="color: white; position: absolute;bottom: 0px;font-size: 10px; background-color: darkblue" size="1" id="confList">';
    for (var i=0; i<confKeysArr.length; i++) {
        selectBox +="<option>" + confKeysArr[i] + "</option>";
    }
    selectBox +='</select>' ;
    $("#mainPage").append(selectBox);
    $('#confList').val(confName);
    $('#confList').change(function () {
        Page.navigate("Login");
        window.location.search = "?conf=" + ($('#confList').val());
    });
}

var origServicesCall = window.Services.call;
var origServicesCallSync = window.Services.callSync;
window.Services.call = function(serviceName, successFunction, failureFunction, customInput, loadingMessage) {
    var resolvedServiceName = resolveServiceName(serviceName);
    origServicesCall(resolvedServiceName, successFunction, failureFunction, customInput, loadingMessage);
}

window.Services.callSync = function(serviceName, failureFunction, customInput, loadingMessage) {
    var resolvedServiceName = resolveServiceName(serviceName);
    return origServicesCallSync(resolvedServiceName, failureFunction, customInput, loadingMessage);
}


function getEnvConfiguration() {
    var iExpenseConfig = Storage.get("iExpenseConfig");
    if (!iExpenseConfig || iExpenseConfig === "") {
        loadEnvConfiguration();
    }
    return JSON.parse(Storage.get("iExpenseConfig"));
}


function resolveServiceName (serviceName) {
    var conf = getEnvConfiguration();
    var retServiceName = serviceName;
    if (conf["SpecificServices"]) {
        for (var i = 0; i< conf["SpecificServices"].length; i++) {
            if (conf["SpecificServices"][i].indexOf(serviceName + "_") === 0) {
                return conf["SpecificServices"][i];
            }
        }
    }
    // if (conf["SpecificServices"] && conf["SpecificServices"].toString().indexOf(serviceName) > -1) {
    //     // retServiceName += "_" + conf["confName"];
    //     retServiceName = conf["SpecificServices"][];
    // }
    return retServiceName;
}


/***** TAB: I18n *****/
//<script type="text/javascript" src="res/api18n/api18n.js"></script>

// to make sure the services will be in the backup
// Services.call("IExpense_LanguageDictionary")

createLanguageMenu = function () {};

function initI18n() {
    cleanLanguageDictionary();
}

function invokeI18n() {
    loadLanguageModule();
}


app.languageConfiguration = {
    dictionaryService: 'IExpense_LanguageDictionary',
    defaultLanguage: 'english',
    languages: [ //all supported languages in the dictionary should be added to app.languageConfiguration
        {
            title: 'EN',
            language: 'english'
        },
        {
            title: 'TST',
            language: 'test'
        },
    ]
}


/***** TAB: AttachmentsCommon *****/
function deleteAttachment() {
    removeAttachmentViewer();
    Popup.okCancel(getTranslationForId("@popup_title_remove_attachment"), getTranslationForId("@popup_message_remove_attachment"), function() {
            Services.call("iExpense_removeFirstAttachment", function() {
            Fields.clear("attachmentPath_filename");
            Storage.remove("AttachmentExists");
            Storage.remove("attachmentPath_filename");
            $("#removeAttchmentBtn").hide();
            showHideAttachmentButtons(true);
        }, displayReportServiceError('Failed to remove attachment'));
    }, function(){});
}

function getDeleteAttachmentIcon() {
    return $('<i id="removeAttchmentBtn" class="fa fa-times" width="30" height="30">').click(deleteAttachment);
}

function revmoveDeleteAttachmentIcon() {
    $("#removeAttchmentBtn").remove();
}

function showHideAttachmentButtons(show) {
    if (show) {
        $("label[for='attachmentPath'].ui-icon-bullets").show();
        $(".ui-icon-camera").show();
    } else {
        $("label[for='attachmentPath'].ui-icon-bullets").hide();
        $(".ui-icon-camera").hide();
    }
}

function downloadAttachment(rowIndex) {
    Storage.set('attachmentRowIndex', rowIndex);
    Services.call("iExpense_downloadAttachment", function() {
        if (Storage.get("AttachmentType").toLowerCase() === "file") {
            var downloadLink = Storage.get("AP_EXPORTS");
            downloadAttachmentContent(downloadLink + "&inline=true");
            // downloadAttachmentContent(downloadLink + "&delete=true&inline=true");
        } 
        else if (Storage.get("AttachmentType").toLowerCase().indexOf("text") > -1) {
            Popup.ok("Attachment", Storage.get("AttachmentText"));
        }
    }, displayReportServiceError('Failed to download attachment'));
}

// Handling multiple attachments on review page
var attachNum = 0;
function getAttchments() {
    Storage.deleteByPrefix("ExpenseAttachment");
    Services.call("iExpense_GetAttachments", function() {
        attachNum = Storage.count("ExpenseAttachmentType");
        if (attachNum > 0) {
            $("#Attachments").text("Attachments (" + attachNum + ")");
        } else {
            $("#Attachments").text("Add Attachment");
        }
    }, displayReportServiceError('Failed to get attachments'));
}

function handleAttachments(originPage) {
    Storage.set("OriginLineDetailsPage", originPage);
    if (attachNum > 0) {
        Page.navigate("ExpenseLineAttachments.html");        
    } else {
        Storage.set("AttachmentUpdateMode", "false");
        Storage.set("OriginAttachmentsPage", originPage);
        Page.navigate("ExpenseLineAddAttachment.html");
    }
}

function removeAttachmentViewer() {
    $('#dynamicImageContainer').remove();
}

function downloadAttachmentContent(url) {
    var myBlob;
    $('#dynamicImageContainer').remove();
    URL.revokeObjectURL(myBlob);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function(e) {
        if (this.status == 200) {
            myBlob = this.response;
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(myBlob);
            if (myBlob.type.indexOf("image")>=0){
                generateImagePreview(link)
            }
            else{
                var filename = url.split("file=")[1].split("&")[0]
                // window.open(url);
                link.download = filename;
                link.click();
            }
        }
    };
    xhr.send();
}

function generateImagePreview(link){
    var imageContainerHtml = '<div id="dynamicImageContainer" style="width:100%" class="outer-field-container"></div>';
    if ($(".table-field-container").length >0) {
        $(imageContainerHtml).insertAfter('.table-field-container');
    } 
    else if ($("#attachmentPath_container").length > 0 ) 
    {
        $(imageContainerHtml).insertAfter('#attachmentPath_container');
    }
    else {
        $(imageContainerHtml).insertAfter('#mainForm');
    }
    $('#dynamicImageContainer').append($('<i id="closeAttchViewer" class="fa fa-close list-button" style="color:#000000 !important; position:absolute; right:20px"> </i>'));
    $("#closeAttchViewer").click(removeAttachmentViewer);
    $('#dynamicImageContainer').append($('<i id="zoomInAttchViewer" class="fa fa-plus list-button" style="color:#000000 !important; position:absolute; right:50px"> </i>'));
    $("#zoomInAttchViewer").click(function() {
        $("#dynamicImage").css("width", $("#dynamicImage").width() + 100);
        $("#dynamicImage").css("height", $("#dynamicImage").height() + 100);
    });
    $('#dynamicImageContainer').append($('<i id="zoomOutAttchViewer" class="fa fa-minus list-button" style="color:#000000 !important; position:absolute; right:80px"> </i>'));
    $("#zoomOutAttchViewer").click(function() {
        $("#dynamicImage").css("width", Math.max(500, $("#dynamicImage").width() - 100));
        $("#dynamicImage").css("height", Math.max(700, $("#dynamicImage").height() - 100));
    });
    $('#dynamicImageContainer').append($("<img id='dynamicImage' />"));
    document.getElementById('dynamicImage').src = link.href;
    document.getElementById('dynamicImage').href = link.href;
}


/***** TAB: ExpensesCommon *****/
// ---- Date format support ----
// ---- (init logic in Reports.html page calling iExpense_settingsGet) ----
var DATE_FORMATS = {
    "MM-dd-yyyy": "MM-DD-yyyy", //MM-dd-yyyy (12-01-2025)
    "MM.dd.yyyy": "MM.DD.yyyy", //MM.dd.yyyy (12.01.2025)
    "MM/dd/yyyy": "MM/DD/yyyy", //MM/dd/yyyy (12/01/2025)
    "yyyy-MM-dd": "yyyy-MM-DD", //yyyy-MM-dd (2025-12-01)
    "yyyy-MMM-dd": "yyyy-MMM-DD", //yyyy-MMM-dd (2025-Dec-01)
    "yyyy.MM.dd": "yyyy.MM.DD", //yyyy.MM.dd (2025.12.01)
    "yyyy.MMM.dd": "yyyy.MMM.DD", //yyyy.MMM.dd (2025.Dec.01)
    "yyyy/MM/dd": "yyyy/MM/DD", //yyyy/MM/dd (2025/12/01)
    "yyyy/MMM/dd": "yyyy/MMM/DD", //yyyy/MMM/dd (2025/Dec/01)
    "dd-MM-yyyy": "DD-MM-yyyy", //dd-MM-yyyy (01-12-2025)
    "dd-MMM-yyyy": "DD-MMM-yyyy", //dd-MMM-yyyy (01-Dec-2025)
    "dd.MM.yyyy": "DD.MM.yyyy", //dd.MM.yyyy (01.12.2025)
    "dd.MMM.yyyy": "DD.MMM.yyyy", //dd.MMM.yyyy (01.Dec.2025)
    "dd/MM/yyyy": "DD/MM/yyyy", //dd/MM/yyyy (01/12/2025)
    "dd/MMM/yyyy": "DD/MMM/yyyy" //dd/MMM/yyyy (01/Dec/2025)
}
function setAndStoreDateField(key, checkExist) {
    if (checkExist && Storage.get(key + "Exist") !== "true")
        return;


    var storageDate = Storage.get(key);
    if (storageDate === '') {
        //Fields.setAndStore(key, moment().format("DD-MMM-yyyy"));
    } else {
        Fields.setAndStore(key, moment(storageDate, DATE_FORMATS[Storage.get("DateFormat")]).format("DD-MMM-YYYY"));
    }
}
function storeDateFormatted(key, checkExist) {
    console.log("storeDateFormatted key",key,checkExist);
    Storage.set(key + "Formatted", "");
    if (checkExist && Storage.get(key + "Exist") !== "true") {
        return;
    }
    Storage.set(key + "Formatted", moment(Fields.get(key), "DD-MMM-YYYY").format(DATE_FORMATS[Storage.get("DateFormat")]));
}

// ---- Itemization configuration ----
var itemizedExpenseTypes = "Hotel,";
app.itemizedExpenseTypes = itemizedExpenseTypes;
Storage.set("itemizedExpenseTypes", itemizedExpenseTypes);
//app.itemizedItemExpenseTypes = "Hotel,Meals,Entertainment,Telephone Calls";

// app.autoFocusConfig = {
//     autoFocusFirstElement: true,
//     autoFocusOnServiceCall: true,
//     autoFocusPagesConfig: {
//         "LineDetailsMileage": {
//             autoFocusFirstElement: false
//         }
//     }
// };

app.autoFocusConfig = {
    autoFocusFirstElement: true,
    autoFocusOnServiceCall: true,
    autoFocusPagesConfig: {
        "Report_General": {
            autoFocusFirstElement: false
        },
        "LineDetails": {
            autoFocusFirstElement: false
        },
        "LineDetailsMileage": {
            autoFocusFirstElement: false,
        },
        "ExpenseGroupAllocations": {
            autoFocusFirstElement: false,
        }
    }
};


iExpenseLineFields = [
    'expenseType',
    'ReceiptCurrencyChoice',
    'ExchRate',
    'DetailReceiptAmount',
    'StartDate',
    'DetailDailyRate',
    'NumberOfDays',
    'Justification',
    'LocationName',
    'DetailMerchantName',
    'AirTravelType',
    'AirTicketClass',
    'AirFromLocation',
    'AirToLocation',
    'AccEndDate',
    'CompanyAttendees',
    'MealNumberAttendees',
    'MealAttendees',
    'attachmentPath',
    'TripDistance',
    'DailyDistance',
    'DistanceRate',
    'DistancePopList',
    'DetailReimbursAmt',
    'VehicleType',
    'VehicleCategory',
    'FromLocation',
    'ToLocation',
    'LicensePlate',
    'DetailReceiptMissing',
    'ItemizedExpenseType',
    'ItemizedStartDate',
    'ItemizedDailyRate',
    'ItemizedNumDays',
    'ItemizedAmountOrig',
    'ItemizedJustification',
    'ItemizedCompanyAttendees',
    'ItemizeNumberAttendees',
    'ItemizedMealAttendees',
    ];

iExpenseLineFixedFields = [
    'expenseType',
    'ReceiptCurrencyChoice',
    'ExchRate',
    'DetailReceiptAmount',
    'DetailMerchantName',
    ];

function showFieldIfExist(fieldName) {
    if (Storage.get(fieldName+'Exist') == 'true') {
        showField(fieldName);
    } else {
        hideField(fieldName);
    }
}

function showField(field) {
    var elm=document.getElementById(field + '_container')
    if (elm) {
        elm.style.display = 'block';
    }
}
function hideField(field) {
    var elm = document.getElementById(field + '_container');
    if (elm) {
        elm.style.display = 'none';   
    }
}

function showFieldsByExpenseType() {
    iExpenseLineFields.forEach(function(fieldName) {
        showFieldIfExist(fieldName);
    });

    // Fields.validate();
}

function cleanExpenseStorageVariables() {
    // Clean previous completed credit lines
    Storage.deleteByPrefix("CashLines_Completed");
}

function getPaginationButtonLabel(buttonId, txtLabel) {
    var numRegexRes = txtLabel.match(/.(\d+)/);
    var num = (numRegexRes !== null)?numRegexRes[1]:"";
    return getTranslationForId(buttonId) + " " + num;
}

function setExpenseDetailIcons(insertAfterContainer) {
        var iconsContainer = $('<div style="display:flex;justify-content:space-evenly"></div>');
        iconsContainer.insertAfter(insertAfterContainer);
    
        var label = $('<label class="read-only-label reviewIconsLabel"><nobr>Details</nobr></label>');
        label.insertBefore(iconsContainer);
        
        var isCreaditCardExpenses = Storage.get("isCreditCardExpensesExist");
        iconsContainer.append($("#Credit").parent());
        $("#Credit").addClass("ReviewBtn");
        $("#Credit").text("");
        $('<div class="ReviewBtnLabel">Credit</div>').insertAfter("#Credit");
        $("#Credit").css({'cssText': 'background-color:#0275d8!important; font-size:22px!important;'});
        $("#Credit").append('<i class="fa fa-credit-card" aria-hidden="true"></i>');
        $("#Credit").parent().addClass("ReviewBtnContainer");
        if (!isCreaditCardExpenses || isCreaditCardExpenses !=="true") {
            $("#Credit").parent().hide();
        } 
        
        var isCashLinesExist = Storage.get("isCashLinesExist");
        iconsContainer.append($("#Cash").parent());
        $("#Cash").addClass("ReviewBtn");
        $("#Cash").text("");
        $('<div class="ReviewBtnLabel">Cash</div>').insertAfter("#Cash");
        $("#Cash").css({'cssText': 'background-color:#4caf50!important; font-size:22px!important;'});
        $("#Cash").append('<i class="fa fa-dollar" aria-hidden="true"></i>');
        $("#Cash").parent().addClass("ReviewBtnContainer");
        if (!isCashLinesExist || isCashLinesExist !=="true") {
            $("#Cash").parent().hide();
        } 
    
        var isPerDiemExpenses = Storage.get("isPerDiemLinesExist");
        iconsContainer.append($("#Per_Diem").parent());
        $("#Per_Diem").addClass("ReviewBtn");
        $("#Per_Diem").text("");
        $('<div class="ReviewBtnLabel">Per Diem</div>').insertAfter("#Per_Diem");
        $("#Per_Diem").css({'cssText': 'background-color:#ff9800!important; font-size:22px!important;'});
        $("#Per_Diem").append('<i class="fa fa-calendar" aria-hidden="true"></i>');
        $("#Per_Diem").parent().addClass("ReviewBtnContainer");
        if (!isPerDiemExpenses || isPerDiemExpenses !=="true") {
            $("#Per_Diem").parent().hide();
        } 
        
        var isMileageExpenses = Storage.get("isMileageLinesExist");
        iconsContainer.append($("#Mileage").parent());
        $("#Mileage").addClass("ReviewBtn");
        $("#Mileage").text("");
        $('<div class="ReviewBtnLabel">Mileage</div>').insertAfter("#Mileage");
        $("#Mileage").css({'cssText': 'background-color:#dc5a56!important; font-size:22px!important;'});
        $("#Mileage").append('<i class="fa fa-car" aria-hidden="true"></i>');
        $("#Mileage").parent().addClass("ReviewBtnContainer");
        if (!isMileageExpenses || isMileageExpenses !=="true") {
            $("#Mileage").parent().hide();
        } 

        var isExpenseAllocations = Storage.get("ExpenseAllocationPageExists");
        iconsContainer.append($("#Allocations").parent());
        $("#Allocations").addClass("ReviewBtn");
        $("#Allocations").text("");
        $('<div class="ReviewBtnLabel">Expense Allocation</div>').insertAfter("#Allocations");
        $("#Allocations").css({'cssText': 'background-color:#2196f3!important; font-size:22px!important;'});
        $("#Allocations").append('<i class="fa fa-tasks" aria-hidden="true"></i>');
        $("#Allocations").parent().addClass("ReviewBtnContainer");
        if (!isExpenseAllocations || isExpenseAllocations !=="true") {
            $("#Allocations").parent().hide();
        } 

    
}

function getFloatValue(val) {
    if (val.length ===0) return 0;
    return parseFloat(val.replace(/,/g,""));
}

function formatNumericField(val, blankOnZero) {
    var formattedVal = Number(val.replace(/,/g,"")).toLocaleString("en",{minimumFractionDigits: 2,maximumFractionDigits: 2});
    if (formattedVal === "0.00" && blankOnZero) {
        return "";
    } else {
        return formattedVal;
    }
    
}
app.isSPA = true;
app.loginPage = 'Login.html';
app.isSPA = true;
app.loginPage = 'Login.html';
app.isSPA = true;
app.loginPage = 'Login.html';

/***** TAB: ReceiptBatch *****/

function removeAttachmentViewer() {
  var $overlay = findAttachmentViewerOverlay();

  if ($overlay.length && isEmbeddedEditorSaving()) {
    Popup.ok('Receipt Details', 'Please wait for the save to finish.');
    return false;
  }

  closeReceiptDetailsBesidePreview();

  restoreReceiptListPreviewSplit();

  $('#dynamicImageOverlay, #dynamicPdfOverlay').remove();

  $(document)
    .off('keydown.attachmentViewer')
    .off('mousemove.attachmentViewer')
    .off('mouseup.attachmentViewer');

  clearActivePreviewReceipt();
  setAttachmentViewerMode(ATTACHMENT_VIEWER_MODE_PREVIEW);

  return true;
}

function clearImagePreview() {
  removeAttachmentViewer();
}

function clearPdfPreview() {
  removeAttachmentViewer();
}


(function initAttachmentViewerViewport() {
  var viewportContent =
    'width=device-width, initial-scale=1, viewport-fit=cover';
  var $viewport = $('head meta[name="viewport"]');

  if ($viewport.length) {
    $viewport.attr('content', viewportContent);
  } else {
    $('head').append(
      '<meta name="viewport" content="' + viewportContent + '">'
    );
  }
}());

var ATTACHMENT_CONFIG = {
  imageExtensions: [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'bmp',
    'svg',
    'heic'
  ],

  pdfExtension: 'pdf',

  defaultStatuses: 'NEW,FAILED,AI_FAILED,PROCESSED,DRAFT,READY,SUBMITTED',

  storageKeys: {
    allowApprove: 'AllowApprove',
    showData: 'ShowData',
    allowEdit: 'AllowEdit',
    receiptId: 'RECEIPTBATCH_RECEIPT_ID',
    receiptStatus: 'RECEIPTBATCH_STATUS',
    previewReceiptId: 'receipt_ID',
    receiptDocumentUrl: 'RECEIPTBATCH_DOCUMENT_URL',
    receiptFileType: 'RECEIPTBATCH_FILE_TYPE',
    previewExpenseType: 'PreviewExpenseType',
    previewAmount: 'PreviewAmount',
    previewReceiptDate: 'PreviewReceiptDate',
    previewMerchant: 'PreviewMerchant',
    previewLocation: 'PreviewLocation',
    previewDepartment: 'PreviewDepartment',
    applyStatuses: 'applyReceiptFilterFromInput'
  },

  storageValues: {
    allowApprove: 'allowApprove',
    showData: 'AllowData',
    allowEdit: 'allowEdit'
  },

  statuses: {
    new: 'NEW'
  },

  receiptActions: {
    refresh: 'Refresh',
    deleteReceiptService: 'ReceiptBatch_delete_receipt',
    reloadFunction: 'reloadReceiptTable',
    restoreSelection: 'onReceiptListFetchFailed'
  },

  spinners: {
    deleteReceipt: 'DELETE_RECEIPT'
  },

  split: {
    paneId: 'attachmentViewerSplitPane',
    paneClass: 'attachmentViewerSplitPane',
    editableId: 'receiptEditPanel'
  },

  viewerLayout: {
    fullscreen: 'fullscreen',
    split: 'split'
  },

  editor: {
    saveFunction: 'onSave',
    readyState: 'complete',
    readyPath: 'ReceiptDetails.html'
  },

  zoom: {
    min: 1,
    max: 5,
    step: 0.25,
    initial: 1,
    doubleTap: 2.5
  }
};

// ----------------------------------------------------------------------------
// Device and text helpers
// ----------------------------------------------------------------------------

function isMobileDevice() {
  return window.innerWidth <= 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
      .test(navigator.userAgent);
}

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeStatuses(statuses) {
  if (!statuses) {
    return ATTACHMENT_CONFIG.defaultStatuses;
  }

  if (Array.isArray(statuses)) {
    statuses = statuses.join(',');
  }

  return String(statuses)
    .split(',')
    .map(function (status) {
      return $.trim(status).toUpperCase();
    })
    .filter(function (status) {
      return status !== '';
    })
    .join(',');
}

function extractFileName(url) {
  var cleanUrl;
  var pathname;
  var fileName;
  var parts;

  if (!url) {
    return 'attachment';
  }

  try {
    cleanUrl = String(url).split('#')[0].split('?')[0];
    pathname = new URL(cleanUrl, window.location.origin).pathname;
    fileName = pathname.substring(pathname.lastIndexOf('/') + 1);

    return decodeURIComponent(fileName || 'attachment');
  } catch (error) {
    parts = String(url).split('?')[0].split('#')[0].split('/');
    fileName = parts[parts.length - 1] || 'attachment';

    try {
      return decodeURIComponent(fileName);
    } catch (decodeError) {
      return fileName;
    }
  }
}

function normalizeFileType(fileType) {
  return String(fileType || '')
    .replace('.', '')
    .trim()
    .toLowerCase();
}

function getFileExtension(url, fileType) {
  var normalizedType = normalizeFileType(fileType);
  var fileName;
  var parts;

  if (normalizedType) {
    return normalizedType;
  }

  fileName = extractFileName(url);
  parts = fileName.split('.');

  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function isImageUrl(url, fileType) {
  return ATTACHMENT_CONFIG.imageExtensions.indexOf(
    getFileExtension(url, fileType)
  ) !== -1;
}

function isPdfUrl(url, fileType) {
  return getFileExtension(url, fileType) ===
    ATTACHMENT_CONFIG.pdfExtension;
}

function getSelectedFileType() {
  return Storage.get(ATTACHMENT_CONFIG.storageKeys.receiptFileType) || '';
}

function hasSelectedExpenseType() {
  var expenseType = Storage.get(
    ATTACHMENT_CONFIG.storageKeys.previewExpenseType
  );

  if (expenseType === null || expenseType === undefined) {
    return false;
  }

  return String(expenseType).trim() !== '';
}

// ----------------------------------------------------------------------------
// Viewer capabilities
// ----------------------------------------------------------------------------

// Preview layout and read-only state are per-page settings. They are kept in
// shared variables (not storage) and are reset by every configureReceiptViewer
// call so a page never inherits the previous page's viewer behaviour.
var attachmentViewerPreviewLayout = ATTACHMENT_CONFIG.viewerLayout.fullscreen;
var attachmentViewerReadOnly = false;

function getAttachmentViewerPreviewLayout() {
  return attachmentViewerPreviewLayout;
}

function isAttachmentViewerReadOnly() {
  return attachmentViewerReadOnly === true;
}

function getViewerCapabilities() {
  var isReadOnly = isAttachmentViewerReadOnly();

  return {
    isReadOnly: isReadOnly,

    canApprove:
      !isReadOnly &&
      Storage.get(ATTACHMENT_CONFIG.storageKeys.allowApprove) ===
      ATTACHMENT_CONFIG.storageValues.allowApprove,

    canShowData:
      Storage.get(ATTACHMENT_CONFIG.storageKeys.showData) ===
      ATTACHMENT_CONFIG.storageValues.showData,

    canEdit:
      !isReadOnly &&
      Storage.get(ATTACHMENT_CONFIG.storageKeys.allowEdit) ===
      ATTACHMENT_CONFIG.storageValues.allowEdit
  };
}

function resetViewerCapabilities() {
  Storage.remove(ATTACHMENT_CONFIG.storageKeys.allowApprove);
  Storage.remove(ATTACHMENT_CONFIG.storageKeys.showData);
  Storage.remove(ATTACHMENT_CONFIG.storageKeys.allowEdit);

  attachmentViewerPreviewLayout = ATTACHMENT_CONFIG.viewerLayout.fullscreen;
  attachmentViewerReadOnly = false;
}

function configureReceiptViewer(options) {
  options = options || {};

  // Drop any docked split preview/placeholders left behind by the previous
  // page before the new page's settings are applied.
  if ((receiptListSplitPlaceholders !== null
      && receiptListSplitPlaceholders.length > 0)
    || $('#receiptListPreviewSplit').length > 0) {
    restoreReceiptListPreviewSplit();
  }

  resetViewerCapabilities();

  if (options.previewLayout === ATTACHMENT_CONFIG.viewerLayout.split) {
    attachmentViewerPreviewLayout = ATTACHMENT_CONFIG.viewerLayout.split;
  }

  if (options.readOnly === true) {
    attachmentViewerReadOnly = true;
  }

  if (options.allowApprove) {
    Storage.set(
      ATTACHMENT_CONFIG.storageKeys.allowApprove,
      ATTACHMENT_CONFIG.storageValues.allowApprove
    );
  }

  if (options.showData) {
    Storage.set(
      ATTACHMENT_CONFIG.storageKeys.showData,
      ATTACHMENT_CONFIG.storageValues.showData
    );
  }

  if (options.allowEdit) {
    Storage.set(
      ATTACHMENT_CONFIG.storageKeys.allowEdit,
      ATTACHMENT_CONFIG.storageValues.allowEdit
    );
  }
}

// ----------------------------------------------------------------------------
// Receipt loading and filter
// ----------------------------------------------------------------------------

function loadReceiptBatchesByUser(statuses, userName, successCallback, failureCallback) {
  var loggedInUser = userName || Storage.get('LoggedInUsername');
  var normalizedStatuses = normalizeStatuses(statuses);

  Storage.set('EBS_USER', loggedInUser);
  Storage.set('ReceiptBatch_statuses', normalizedStatuses);

  Services.call(
    'ReceiptBatch_get_by_userAndStatuses',
    typeof successCallback === 'function' ? successCallback : function () {},
    typeof failureCallback === 'function' ? failureCallback : function () {}
  );
}

function loadReceiptBatchesByUserAndStatuses(statuses, successCallback, failureCallback) {
  loadReceiptBatchesByUser(statuses, null, successCallback, failureCallback);
}

function applyReceiptFilterFromInput(inputSelector) {
  var selector = inputSelector || '#receiptStatusesInput';

  loadReceiptBatchesByUser($(selector).val());
}

function createReceiptStatusesFilter(containerSelector) {
  var selector = containerSelector || 'body';
  var defaultStatuses = escapeHtml(ATTACHMENT_CONFIG.defaultStatuses);
  var html;

  if ($('#receiptStatusesFilterPanel').length) {
    return;
  }

  html = ''
    + '<div id="receiptStatusesFilterPanel" '
    + 'class="receiptStatusesFilterPanel">'
    + '<label for="receiptStatusesInput">Statuses</label>'
    + '<input id="receiptStatusesInput" type="text" '
    + 'value="' + defaultStatuses + '" '
    + 'placeholder="NEW,FAILED,AI_FAILED,PROCESSED,SUBMITTED">'
    + '<button id="applyReceiptStatusesBtn" type="button">'
    + 'Load Receipts'
    + '</button>'
    + '</div>';

  $(selector).prepend(html);

  $('#applyReceiptStatusesBtn')
    .off('click.receiptFilter')
    .on('click.receiptFilter', function () {
      applyReceiptFilterFromInput('#receiptStatusesInput');
    });
}

// ----------------------------------------------------------------------------
// Receipt metadata
// ----------------------------------------------------------------------------

// The raw stored value of a preview key. Only null and undefined are absences: the
// number 0 and the boolean false are values a receipt can really have.
function previewMetaValue(key) {
  var value = Storage.get(key);

  if (value === null || value === undefined) {
    return ' ';
  }

  return value;
}

function getReceiptMetaFields() {
  return [
    {
      key: 'expenseType',
      label: 'Expense Type',
      value: previewMetaValue(
        ATTACHMENT_CONFIG.storageKeys.previewExpenseType
      )
    },
    {
      key: 'totalAmount',
      label: 'Total Amount',
      value: previewMetaValue(
        ATTACHMENT_CONFIG.storageKeys.previewAmount
      )
    },
    {
      key: 'receiptDate',
      label: 'Receipt Date',
      value: previewMetaValue(
        ATTACHMENT_CONFIG.storageKeys.previewReceiptDate
      )
    },
    {
      key: 'merchant',
      label: 'Merchant',
      value: previewMetaValue(
        ATTACHMENT_CONFIG.storageKeys.previewMerchant
      )
    },
    {
      key: 'location',
      label: 'Location',
      value: previewMetaValue(
        ATTACHMENT_CONFIG.storageKeys.previewLocation
      )
    },
    {
      key: 'department',
      label: 'Department',
      value: previewMetaValue(
        ATTACHMENT_CONFIG.storageKeys.previewDepartment
      )
    }
  ];
}

function getReceiptMetaHtml() {
  var capabilities = getViewerCapabilities();
  var fields;
  var html = '';

  if (!capabilities.canShowData) {
    return '';
  }

  fields = getReceiptMetaFields();

  html += '<div id="receiptMetaPanel" class="attachmentMetaPanel">';

  $.each(fields, function (index, field) {
    html += ''
      + '<div class="attachmentMetaItem">'
      + '<b>' + escapeHtml(field.label) + ':</b> '
      + escapeHtml(field.value)
      + '</div>';
  });

  html += '</div>';

  return html;
}

function refreshReceiptMetaPanel() {
  var $panel = $('#receiptMetaPanel');
  var capabilities = getViewerCapabilities();

  if (!capabilities.canShowData) {
    return;
  }

  if (!$panel.length) {
    return;
  }

  $panel.replaceWith(getReceiptMetaHtml());

  if ($('#receiptEditPanel').length) {
    $('#receiptMetaPanel').hide();
  }
}

// ----------------------------------------------------------------------------
// Successful-save bridge from the embedded ReceiptDetails editor
// ----------------------------------------------------------------------------

var activePreviewReceiptId = '';
function captureActivePreviewReceiptId() {
  var receiptId = Storage.get(ATTACHMENT_CONFIG.storageKeys.receiptId);

  if (receiptId === null || receiptId === undefined
    || String(receiptId).trim() === '') {
    return;
  }

  activePreviewReceiptId = receiptId;
}

var activePreviewReceiptStatus = '';
var activePreviewDeleteReceiptId = '';
var deleteInFlight = false;

function normalizeReceiptStatus(status) {
  return String(status === null || status === undefined ? '' : status)
    .trim()
    .toUpperCase();
}

function captureActivePreviewReceiptStatus() {
  var status = Storage.get(ATTACHMENT_CONFIG.storageKeys.receiptStatus);

  if (status === null || status === undefined || String(status).trim() === '') {
    activePreviewReceiptStatus = '';
    return;
  }

  activePreviewReceiptStatus = normalizeReceiptStatus(status);
}

function currentPreviewReceiptStatus() {
  return activePreviewReceiptStatus;
}

function captureActivePreviewReceipt() {
  captureActivePreviewReceiptId();
  captureActivePreviewReceiptStatus();

  activePreviewDeleteReceiptId = activePreviewReceiptId;
}

function clearActivePreviewReceipt() {
  activePreviewReceiptId = '';
  activePreviewReceiptStatus = '';
  activePreviewDeleteReceiptId = '';
  deleteInFlight = false;
}

function receiptExpenseDataSaved(input) {
  var selectedReceiptId;

  if (!input || typeof input !== 'object') {
    return false;
  }

  if (!Object.prototype.hasOwnProperty.call(input, 'P_RECEIPT_ID')) {
    return false;
  }

  if (input.P_RECEIPT_ID === null || input.P_RECEIPT_ID === undefined
    || String(input.P_RECEIPT_ID).trim() === '') {
    return false;
  }

  if (!findAttachmentViewerOverlay().length) {
    selectedReceiptId = Storage.get(ATTACHMENT_CONFIG.storageKeys.receiptId);

    if (String(input.P_RECEIPT_ID) !== String(selectedReceiptId)) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'P_STATUS')) {
      importSavedReceiptStatusIntoReceiptList(input.P_STATUS);
    }

    return false;
  }

  if (activePreviewReceiptId === null || activePreviewReceiptId === undefined
    || String(activePreviewReceiptId).trim() === '') {
    return false;
  }

  if (String(input.P_RECEIPT_ID) !== String(activePreviewReceiptId)) {
    return false;
  }

  selectedReceiptId = Storage.get(ATTACHMENT_CONFIG.storageKeys.receiptId);

  if (selectedReceiptId === null || selectedReceiptId === undefined
    || String(selectedReceiptId).trim() === '') {
    return false;
  }

  if (String(input.P_RECEIPT_ID) !== String(selectedReceiptId)) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'P_EXPENSE_TYPE')) {
    Storage.set('RECEIPTBATCH_EXPENSE_TYPE', input.P_EXPENSE_TYPE);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'P_TOTAL_AMOUNT')) {
    Storage.set('RECEIPTBATCH_TOTAL_AMOUNT', input.P_TOTAL_AMOUNT);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'P_RECEIPT_DATE')) {
    Storage.set('RECEIPTBATCH_RECEIPT_DATE', input.P_RECEIPT_DATE);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'P_MERCHANT')) {
    Storage.set('RECEIPTBATCH_MERCHANT', input.P_MERCHANT);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'P_LOCATION')) {
    Storage.set('RECEIPTBATCH_LOCATION', input.P_LOCATION);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'P_DEPARTMENT')) {
    Storage.set('RECEIPTBATCH_DEPARTMENT', input.P_DEPARTMENT);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'P_CREDIT_TRANSACTION')) {
    Storage.set('RECEIPTBATCH_CREDIT_TRANSACTION', input.P_CREDIT_TRANSACTION);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'P_STATUS')) {
    Storage.set('RECEIPTBATCH_STATUS', input.P_STATUS);
  }

  setPreviewReceiptMetadataFromSelectedReceipt();
  refreshReceiptMetaPanel();
  updateEditButtonState();

  if (Object.prototype.hasOwnProperty.call(input, 'P_STATUS')) {
    applySavedPreviewReceiptStatus(input.P_STATUS);
  }

  return true;
}

function importSavedReceiptStatusIntoReceiptList(status) {
  var applyStatuses = getReceiptStatusFilterFunction();

  if (!applyStatuses) {
    return false;
  }

  Storage.set('P_STATUSES', buildReceiptStatusList(status));

  applyStatuses('#receiptStatusesInput');

  return true;
}

function buildReceiptStatusList(status) {
  var statuses = normalizeStatuses(ATTACHMENT_CONFIG.defaultStatuses).split(',');
  var normalizedStatus = normalizeStatuses(status);

  if (normalizedStatus !== '' && statuses.indexOf(normalizedStatus) === -1) {
    statuses.push(normalizedStatus);
  }

  return statuses.join(',');
}

// ----------------------------------------------------------------------------
// Viewer toolbar mode: the preview action set versus the open editor's action set
// ----------------------------------------------------------------------------
var ATTACHMENT_VIEWER_MODE_PREVIEW = 'preview';
var ATTACHMENT_VIEWER_MODE_EDIT = 'edit';
var attachmentViewerMode = ATTACHMENT_VIEWER_MODE_PREVIEW;

function currentAttachmentViewerMode() {
  return attachmentViewerMode;
}

function isEditorSplitOpen() {
  return $('#' + ATTACHMENT_CONFIG.split.editableId).length > 0;
}

function resolveAttachmentViewerMode(mode) {
  if (mode !== ATTACHMENT_VIEWER_MODE_PREVIEW
    && mode !== ATTACHMENT_VIEWER_MODE_EDIT) {
    return attachmentViewerMode;
  }

  if (mode === ATTACHMENT_VIEWER_MODE_EDIT && !isEditorSplitOpen()) {
    return ATTACHMENT_VIEWER_MODE_PREVIEW;
  }

  return mode;
}

function setAttachmentViewerMode(mode) {
  attachmentViewerMode = mode;
}

function resolveDownloadFileName(url, downloadName) {
  if (downloadName === null || downloadName === undefined
    || String(downloadName).trim() === '') {
    return extractFileName(url);
  }

  return downloadName;
}

function getDownloadButtonHtml(url, label, buttonId, downloadName) {
  return ''
    + '<button id="' + buttonId + '" type="button" '
    + 'class="attachmentViewerButton attachmentViewerButtonDownload" '
    + 'data-attachment-url="' + escapeHtml(url) + '" '
    + 'data-attachment-name="'
    + escapeHtml(resolveDownloadFileName(url, downloadName)) + '">'
    + escapeHtml(label)
    + '</button>';
}

function getCloseButtonHtml() {
  return ''
    + '<button id="closeAttchViewer" type="button" '
    + 'class="attachmentViewerButton attachmentViewerButtonClose" '
    + 'aria-label="Close viewer">Close</button>';
}

function getSaveButtonHtml() {
  return ''
    + '<button id="saveAttachmentEditBtn" type="button" '
    + 'class="attachmentViewerButton attachmentViewerButtonSave">'
    + 'Save'
    + '</button>';
}

function getCancelButtonHtml() {
  return ''
    + '<button id="cancelAttachmentEditBtn" type="button" '
    + 'class="attachmentViewerButton attachmentViewerButtonCancel">'
    + 'Cancel'
    + '</button>';
}

function getAttachmentViewerActionsHtml(mode, capabilities, url, downloadLabel, downloadName, status) {
  var resolvedMode = resolveAttachmentViewerMode(mode);

  if (capabilities && capabilities.isReadOnly) {
    return ''
      + getDownloadButtonHtml(url, downloadLabel, 'downloadAttchViewerBtn', downloadName)
      + getCloseButtonHtml();
  }

  if (resolvedMode === ATTACHMENT_VIEWER_MODE_EDIT) {
    return ''
      + getDownloadButtonHtml(url, downloadLabel, 'downloadAttchViewerBtn', downloadName)
      + getSaveButtonHtml()
      + getCancelButtonHtml();
  }

  return ''
    + getDownloadButtonHtml(url, downloadLabel, 'downloadAttchViewerBtn', downloadName)
    + getEditButtonHtml(capabilities)
    + getAnalyzeButtonHtml(status)
    + getApproveButtonHtml(capabilities)
    + getDeleteButtonHtml()
    + getCloseButtonHtml();
}

function getDeleteButtonHtml() {
  return ''
    + '<button id="removeAttachmentBtn" type="button" '
    + 'class="attachmentViewerButton attachmentViewerButtonDelete">'
    + 'Delete'
    + '</button>';
}

function getAnalyzeButtonHtml(status) {
  if (normalizeReceiptStatus(status) !== ATTACHMENT_CONFIG.statuses.new) {
    return '';
  }

  return ''
    + '<button id="analyzeReceiptBtn" type="button" '
    + 'class="attachmentViewerButton attachmentViewerButtonAnalyze">'
    + 'Analyze'
    + '</button>';
}
function resolvePreviewStatusForToolbar() {
  return currentPreviewReceiptStatus();
}

function applyAttachmentViewerMode(mode, capabilities, status) {
  var $overlay = findAttachmentViewerOverlay();
  var $group;
  var resolvedMode;
  var resolvedStatus;

  if (!$overlay.length) {
    return attachmentViewerMode;
  }

  resolvedMode = resolveAttachmentViewerMode(mode);

  if (resolvedMode !== ATTACHMENT_VIEWER_MODE_PREVIEW
    && resolvedMode !== ATTACHMENT_VIEWER_MODE_EDIT) {
    return attachmentViewerMode;
  }

  $group = $overlay.find('.attachmentViewerToolbarActions').first();

  if (!$group.length) {
    return attachmentViewerMode;
  }

  resolvedStatus = status === undefined || status === null
    ? resolvePreviewStatusForToolbar()
    : status;

  if (($overlay.attr('data-attachment-mode') || '') === resolvedMode
    && ($overlay.attr('data-attachment-status') || '') === resolvedStatus) {
    return resolvedMode;
  }

  $group.html(getAttachmentViewerActionsHtml(
    resolvedMode,
    capabilities || getViewerCapabilities(),
    $overlay.attr('data-attachment-url'),
    $overlay.attr('data-attachment-download-label'),
    $overlay.attr('data-attachment-download-name'),
    resolvedStatus
  ));

  $overlay.attr('data-attachment-mode', resolvedMode);
  $overlay.attr('data-attachment-status', resolvedStatus);
  setAttachmentViewerMode(resolvedMode);
  bindAttachmentViewerActionButtons(resolvedMode);

  return resolvedMode;
}

function saveEmbeddedEditorData() {
  var editorWindow;
  var saveFunction;

  if (isEmbeddedEditorSaving()) {
    Popup.ok('Receipt Details', 'Please wait for the save to finish.');
    return false;
  }

  if (!isEmbeddedEditorSaveReady()) {
    Popup.ok(
      'Receipt Details',
      'The receipt editor is not ready yet. Please wait for it to finish loading and try again.'
    );
    return false;
  }

  editorWindow = getEmbeddedEditorWindow();
  saveFunction = editorWindow[ATTACHMENT_CONFIG.editor.saveFunction];

  try {
    saveFunction.call(editorWindow);
  } catch (error) {
    Popup.ok('Receipt Details', 'The receipt editor could not be reached.');
    return false;
  }

  return true;
}

function cancelAttachmentEditMode() {
  if (closeReceiptDetailsBesidePreview() === false) {
    return false;
  }

  applyAttachmentViewerMode(
    ATTACHMENT_VIEWER_MODE_PREVIEW,
    getViewerCapabilities()
  );

  return true;
}

// ----------------------------------------------------------------------------
// Receipt actions the viewer REUSES from ReceiptsAttachments.js
// ----------------------------------------------------------------------------
function getReceiptPageFunction(name) {
  var pageFunction;

  try {
    pageFunction = (typeof window !== 'undefined' && window ? window : this)[name];
  } catch (error) {
    return null;
  }

  return typeof pageFunction === 'function' ? pageFunction : null;
}

function getReceiptRefreshFunction() {
  return getReceiptPageFunction(ATTACHMENT_CONFIG.receiptActions.refresh);
}

function getReceiptTableReloadFunction() {
  return getReceiptPageFunction(ATTACHMENT_CONFIG.receiptActions.reloadFunction);
}

function getReceiptStatusFilterFunction() {
  return getReceiptPageFunction(ATTACHMENT_CONFIG.storageKeys.applyStatuses);
}

function applySavedPreviewReceiptStatus(status) {
  var $overlay = findAttachmentViewerOverlay();

  if ($overlay.length) {
    activePreviewReceiptStatus = normalizeReceiptStatus(status);
  } else {
    activePreviewReceiptStatus = '';
  }

  if (!isEditorSplitOpen() && $overlay.length) {
    applyAttachmentViewerMode(
      ATTACHMENT_VIEWER_MODE_PREVIEW,
      getViewerCapabilities(),
      activePreviewReceiptStatus
    );
  }

  return activePreviewReceiptStatus;
}

function runReceiptSelectionPendingAction(action) {
  var beginPending = getReceiptPageFunction('runReceiptSelectionPending');

  if (!beginPending) {
    action();
    return false;
  }

  beginPending(action);
  return true;
}

function releaseReceiptSelectionPending() {
  var restoreReceiptSelection = getReceiptPageFunction(
    ATTACHMENT_CONFIG.receiptActions.restoreSelection
  );

  if (!restoreReceiptSelection) {
    return false;
  }

  restoreReceiptSelection();
  return true;
}

function reloadReceiptTableAfterViewerDelete() {
  var reloadReceiptTable = getReceiptTableReloadFunction();

  if (!reloadReceiptTable) {
    releaseReceiptSelectionPending();
    return false;
  }

  reloadReceiptTable(true);
  return true;
}

function RemoveActivePreviewReceipt() {
  var receiptId = activePreviewDeleteReceiptId;

  if (deleteInFlight) {
    return false;
  }

  if (receiptId === null || receiptId === undefined
    || String(receiptId).trim() === '') {
    return false;
  }

  if (removeAttachmentViewer() === false) {
    return false;
  }
  
  deleteInFlight = true;

  Popup.okCancel(
    'Remove Attachment',
    'Are you sure you want to remove this attachment?',

    function () {
      Storage.set(ATTACHMENT_CONFIG.storageKeys.previewReceiptId, receiptId);

      Spinner.start('Removing attachment', ATTACHMENT_CONFIG.spinners.deleteReceipt);

      runReceiptSelectionPendingAction(function () {
        Services.call(
          ATTACHMENT_CONFIG.receiptActions.deleteReceiptService,

          function () {
            deleteInFlight = false;

            Spinner.stop(ATTACHMENT_CONFIG.spinners.deleteReceipt);

            if (removeAttachmentViewer() === false) {
              releaseReceiptSelectionPending();

              Popup.ok(
                'Remove Attachment',
                'The receipt was removed. Reload the receipt list to see the change.'
              );
              return;
            }

            if (reloadReceiptTableAfterViewerDelete()) {
              return;
            }

            Popup.ok(
              'Remove Attachment',
              'The receipt was removed. Reload the receipt list to see the change.'
            );
          },

          function () {
            var restoreReceiptSelection = getReceiptPageFunction(
              ATTACHMENT_CONFIG.receiptActions.restoreSelection
            );

            deleteInFlight = false;

            Spinner.stop(ATTACHMENT_CONFIG.spinners.deleteReceipt);

            if (restoreReceiptSelection) {
              restoreReceiptSelection();
            }

            Popup.ok(
              'Remove Attachment',
              'Failed to remove attachment'
            );
          }
        );
      });
    },

    function () {
      deleteInFlight = false;
    }
  );

  return true;
}

var analyzeInFlight = false;

function releaseAnalyzeGuard() {
  analyzeInFlight = false;
}

function analyzeActivePreviewReceipt() {
  var refreshFunction = getReceiptRefreshFunction();

  if (analyzeInFlight) {
    return false;
  }

  if (!refreshFunction) {
    Popup.ok('Analyze', 'Refresh is not defined on this page');
    return false;
  }

  if (currentPreviewReceiptStatus() !== ATTACHMENT_CONFIG.statuses.new) {
    return false;
  }

  analyzeInFlight = true;

  if (removeAttachmentViewer() === false) {
    releaseAnalyzeGuard();
    return false;
  }

  try {
    refreshFunction.call(window);
  } catch (error) {
    releaseAnalyzeGuard();
    Popup.ok('Analyze', 'The analyze request could not be started');
    return false;
  }

  releaseAnalyzeGuard();

  return true;
}

function bindDownloadActionButton(buttonId, fallbackName) {
  $(buttonId)
    .off('click.attachmentViewer')
    .on('click.attachmentViewer', function (event) {
      var $button = $(this);

      event.preventDefault();
      event.stopPropagation();

      downloadFile(
        $button.attr('data-attachment-url'),
        $button.attr('data-attachment-name') || fallbackName
      );
    });
}

function bindAttachmentViewerActionButtons(mode) {
  if (mode === ATTACHMENT_VIEWER_MODE_EDIT) {
    bindDownloadActionButton('#downloadAttchViewerBtn', 'attachment');

    $('#saveAttachmentEditBtn')
      .off('click.attachmentViewer')
      .on('click.attachmentViewer', function (event) {
        event.preventDefault();
        event.stopPropagation();
        saveEmbeddedEditorData();
      });

    $('#cancelAttachmentEditBtn')
      .off('click.attachmentViewer')
      .on('click.attachmentViewer', function (event) {
        event.preventDefault();
        event.stopPropagation();
        cancelAttachmentEditMode();
      });

    return;
  }

  bindDownloadActionButton('#downloadAttchViewerBtn', 'attachment');
  bindOptionalViewerActions(getViewerCapabilities());

  if ($('#analyzeReceiptBtn').length) {
    bindAnalyzeButton();
  }

  bindViewerCloseEvents(
    '#' + findAttachmentViewerOverlay().attr('id'),
    '#closeAttchViewer'
  );
}

// ----------------------------------------------------------------------------
// Viewer toolbar buttons
// ----------------------------------------------------------------------------

function getApproveButtonHtml(capabilities) {
  if (!capabilities.canApprove) {
    return '';
  }

  return ''
    + '<button id="ApproveImageBtn" type="button" '
    + 'class="attachmentViewerButton attachmentViewerButtonApprove">'
    + 'Add Line'
    + '</button>';
}

function getEditButtonHtml(capabilities) {
  if (!capabilities.canEdit) {
    return '';
  }

  if (!hasSelectedExpenseType()) {
    return ''
      + '<button id="editReceiptDataBtn" type="button" '
      + 'class="attachmentViewerButton attachmentViewerButtonEdit" '
      + 'disabled="disabled" aria-disabled="true" '
      + 'title="Expense Type is required to edit the receipt data">'
      + 'Edit Data'
      + '</button>';
  }

  return ''
    + '<button id="editReceiptDataBtn" type="button" '
    + 'class="attachmentViewerButton attachmentViewerButtonEdit">'
    + 'Edit Data'
    + '</button>';
}

function bindApproveButton() {
  $('#ApproveImageBtn')
    .off('click.attachmentViewer')
    .on('click.attachmentViewer', function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (typeof approveReceipt === 'function') {
        approveReceipt();
      } else {
        Popup.ok(
          'Add Line',
          'approveReceipt() is not defined on this page'
        );
      }
    });
}

function bindRemoveButton() {
  $('#removeAttachmentBtn')
    .off('click.attachmentViewer')
    .on('click.attachmentViewer', function (event) {
      event.preventDefault();
      event.stopPropagation();

      RemoveActivePreviewReceipt();
    });
}

function bindAnalyzeButton() {
  $('#analyzeReceiptBtn')
    .off('click.attachmentViewer')
    .on('click.attachmentViewer', function (event) {
      event.preventDefault();
      event.stopPropagation();

      analyzeActivePreviewReceipt();
    });
}

// ----------------------------------------------------------------------------
// Split view: the receipt editor beside the preview
// ----------------------------------------------------------------------------

function findAttachmentViewerOverlay() {
  return $('#dynamicImageOverlay, #dynamicPdfOverlay').first();
}

function getEmbeddedEditorFrame() {
  var $panel = $('#' + ATTACHMENT_CONFIG.split.editableId);

  if (!$panel.length) {
    return null;
  }

  return $panel.find('iframe')[0] || null;
}

function getEmbeddedEditorWindow() {
  var iframe = getEmbeddedEditorFrame();

  if (!iframe) {
    return null;
  }

  try {
    return iframe.contentWindow || null;
  } catch (error) {
    return null;
  }
}

function isEmbeddedEditorSaving() {
  var editorWindow = getEmbeddedEditorWindow();

  if (!editorWindow) {
    return false;
  }

  try {
    return editorWindow.saveBusy === true;
  } catch (error) {
    return false;
  }
}
function getEmbeddedEditorSaveFunction() {
  var editorWindow = getEmbeddedEditorWindow();

  if (!editorWindow) {
    return null;
  }

  try {
    return typeof editorWindow[ATTACHMENT_CONFIG.editor.saveFunction] === 'function'
      ? editorWindow[ATTACHMENT_CONFIG.editor.saveFunction]
      : null;
  } catch (error) {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Embedded editor readiness: the frame's own load event, with a bounded retry
// ----------------------------------------------------------------------------
var embeddedEditorLoadBindingGeneration = 0;

function isEmbeddedEditorFrameLoaded() {
  var iframe = getEmbeddedEditorFrame();
  var frameDocument;

  if (!iframe) {
    return false;
  }

  try {
    frameDocument = iframe.contentDocument;

    if (!frameDocument) {
      return false;
    }

    if (String(frameDocument.readyState) === ATTACHMENT_CONFIG.editor.readyState) {
      return true;
    }

    return String(iframe.contentWindow.location.href)
      .indexOf(ATTACHMENT_CONFIG.editor.readyPath) !== -1
      && String(frameDocument.readyState) !== 'loading';
  } catch (error) {
    return false;
  }
}
function isEmbeddedEditorSaveReady() {
  return getEmbeddedEditorSaveFunction() !== null;
}


var embeddedEditorLoadHandler = null;

var EMBEDDED_EDITOR_LOAD_RETRIES = 20;
var EMBEDDED_EDITOR_LOAD_RETRY_DELAY = 50;

function waitForEmbeddedEditorLoad(generation, attemptsLeft) {
  var iframe = getEmbeddedEditorFrame();

  if (generation !== embeddedEditorLoadBindingGeneration) {
    return;
  }

  if (!isEditorSplitOpen()) {
    return;
  }

  if (embeddedEditorLoadHandler && iframe) {
    try {
      iframe.removeEventListener('load', embeddedEditorLoadHandler);
    } catch (error) {
    }
  }

  embeddedEditorLoadHandler = null;

  if (isEmbeddedEditorFrameLoaded()) {
    applyAttachmentEditModeIfReady();
    return;
  }

  if (!iframe || attemptsLeft <= 0) {
    return;
  }

  function onEmbeddedEditorLoad() {
    applyAttachmentEditModeIfReady();
  }

  try {
    iframe.addEventListener('load', onEmbeddedEditorLoad);
  } catch (error) {
  }

  embeddedEditorLoadHandler = onEmbeddedEditorLoad;

  setTimeout(function () {
    waitForEmbeddedEditorLoad(generation, attemptsLeft - 1);
  }, EMBEDDED_EDITOR_LOAD_RETRY_DELAY);
}
function watchEmbeddedEditorLoad() {
  embeddedEditorLoadBindingGeneration += 1;
  embeddedEditorLoadHandler = null;

  waitForEmbeddedEditorLoad(embeddedEditorLoadBindingGeneration, EMBEDDED_EDITOR_LOAD_RETRIES);
}

function openReceiptDetailsBesidePreview() {
  var $overlay = $('#dynamicImageOverlay, #dynamicPdfOverlay').first();
  var $stage = $overlay.find('.attachmentViewerStage').first();
  var $splitPane;

  if (!$overlay.length || !$stage.length) {
    Popup.ok('Edit Data', 'The receipt preview is not available');
    return;
  }

  if ($('#receiptEditPanel').length) {
    return;
  }

  $overlay.css({
    display: 'flex',
    'flex-direction': 'column'
  });

  $stage.wrap(
    '<div id="' + ATTACHMENT_CONFIG.split.paneId + '" '
    + 'class="' + ATTACHMENT_CONFIG.split.paneClass + '"></div>'
  );

  $splitPane = $('#' + ATTACHMENT_CONFIG.split.paneId);
  $splitPane.css({
    display: 'flex',
    flex: '1 1 auto',
    'min-height': '0',
    width: '100%',
    overflow: 'hidden'
  });

  $stage.css({
    flex: '1 1 50%',
    width: '50%',
    'min-width': '0',
    height: '100%'
  });

  $splitPane.append(
    '<div id="' + ATTACHMENT_CONFIG.split.editableId + '" '
    + 'class="' + ATTACHMENT_CONFIG.split.editableId + '"></div>'
  );

  $('#' + ATTACHMENT_CONFIG.split.editableId).css({
    flex: '1 1 50%',
    width: '50%',
    'min-width': '0',
    height: '100%',
    overflow: 'hidden',
    'background-color': '#ffffff',
    'border-left': '1px solid #d8d8d8'
  });

  $('#editReceiptDataBtn').hide();
  $('#receiptMetaPanel').hide();

  Popup.asIframe(
    'ReceiptDetails.html',
    ATTACHMENT_CONFIG.split.editableId,
    null,
    '100%',
    '100%'
  );

  applyAttachmentEditModeIfReady();

  watchEmbeddedEditorLoad();
}

function applyAttachmentEditModeIfReady() {
  if (!isEditorSplitOpen()) {
    return;
  }

  applyAttachmentViewerMode(
    ATTACHMENT_VIEWER_MODE_EDIT,
    getViewerCapabilities()
  );
}

function closeReceiptDetailsBesidePreview() {
  var $splitPane = $('#' + ATTACHMENT_CONFIG.split.paneId);
  var $stage;

  if (!$splitPane.length) {
    return true;
  }

  if (isEmbeddedEditorSaving()) {
    Popup.ok('Receipt Details', 'Please wait for the save to finish.');
    return false;
  }
  embeddedEditorLoadBindingGeneration += 1;
  embeddedEditorLoadHandler = null;

  $('#' + ATTACHMENT_CONFIG.split.editableId).remove();
  $stage = $splitPane.children('.attachmentViewerStage').first();

  if ($stage.length) {
    $stage.css({
      flex: '',
      width: '',
      'min-width': '',
      height: ''
    });
    $stage.unwrap();
  } else {
    $splitPane.remove();
  }

  $('#editReceiptDataBtn').show();
  $('#receiptMetaPanel').show();
  applyAttachmentViewerMode(
    ATTACHMENT_VIEWER_MODE_PREVIEW,
    getViewerCapabilities()
  );

  return true;
}

function bindEditButton() {
  $('#editReceiptDataBtn')
    .off('click.attachmentViewer')
    .on('click.attachmentViewer', function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (!hasSelectedExpenseType()) {
        return;
      }

      openReceiptDetailsBesidePreview();
    });
}

function updateEditButtonState() {
  var $button = $('#editReceiptDataBtn');
  var title = 'Expense Type is required to edit the receipt data';

  if ($button.length === 0) {
    return;
  }

  if (hasSelectedExpenseType()) {
    $button.prop('disabled', false).removeAttr('aria-disabled').removeAttr('title');
    return;
  }

  $button.prop('disabled', true).attr('aria-disabled', 'true').attr('title', title);
}

function bindOptionalViewerActions(capabilities) {
  if (capabilities.canApprove) {
    bindApproveButton();
  }
  if (capabilities.canEdit) {
    bindEditButton();
  }
  if (!capabilities.isReadOnly) {
    bindRemoveButton();
  }
}

// ----------------------------------------------------------------------------
// Split preview layout (opt-in per page)
// The shared viewer stays a fullscreen overlay by default. A page that opts in
// with previewLayout: 'split' has the rendered overlay docked beside the receipt
// list, and the list content is put back in place when the viewer closes.
// ----------------------------------------------------------------------------

var receiptListSplitPlaceholders = null;
var receiptListSplitResizeBound = false;

function getReceiptListSplitHostPage() {
  // Matches the CSS scope exactly: only the active InProgressLines #mainPage
  // opts into the split layout, so no other page can be affected.
  var $mainPage = $('#mainPage');

  if ($mainPage.length && $mainPage.hasClass('ap-page-inprogresslines')) {
    return $mainPage;
  }

  return $();
}

function getReceiptListSplitContent($mainPage) {
  var $content = $mainPage.find('#content').first();

  if ($content.length) {
    return $content;
  }

  return $mainPage.find('.ui-content').first();
}

function createReceiptListSplitPlaceholder(element) {
  var placeholder;

  if (!element || !element.parentNode) {
    return null;
  }

  placeholder = document.createComment('receiptListPreviewPlaceholder');
  element.parentNode.insertBefore(placeholder, element);

  return placeholder;
}

function restoreReceiptListSplitPlaceholder(entry) {
  var placeholder;
  var element;
  var parentNode;

  if (!entry) {
    return;
  }

  placeholder = entry.placeholder;
  element = entry.element;

  if (!placeholder || !placeholder.parentNode) {
    return;
  }

  parentNode = placeholder.parentNode;

  if (element && element.parentNode
    && (element.parentNode !== parentNode
      || element.previousSibling !== placeholder)) {
    parentNode.insertBefore(element, placeholder);
  }

  parentNode.removeChild(placeholder);
}

function restoreReceiptListSplitContentWithoutPlaceholders($wrapper, $content) {
  var $listPane = $wrapper.find('#receiptListPane').first();
  var $heading;
  var $moved;

  if (!$listPane.length || !$content.length) {
    return;
  }

  $moved = $listPane.children('form#mainForm, .table-field-container');

  if (!$moved.length) {
    $moved = $listPane.children('form, .field-container');
  }

  if (!$moved.length) {
    return;
  }

  $heading = $content.children('#header-title').first();

  if ($heading.length) {
    $heading.after($moved);
  } else {
    $content.prepend($moved);
  }
}

function unbindReceiptListSplitResize() {
  if (!receiptListSplitResizeBound) {
    return;
  }

  receiptListSplitResizeBound = false;
  $(window).off('resize.receiptListSplit');
}

function restoreReceiptListPreviewSplit() {
  var $wrapper = $('#receiptListPreviewSplit');
  var placeholders = receiptListSplitPlaceholders;
  var hadSplit = $wrapper.length > 0
    || (placeholders !== null && placeholders.length > 0);

  receiptListSplitPlaceholders = null;

  if (placeholders && placeholders.length) {
    $.each(placeholders, function (index, entry) {
      restoreReceiptListSplitPlaceholder(entry);
    });
  } else if ($wrapper.length) {
    restoreReceiptListSplitContentWithoutPlaceholders(
      $wrapper,
      $('#mainPage').find('#content').first()
    );
  }

  $wrapper.remove();
  $('#receiptListPane, #receiptPreviewPane').remove();

  $('#mainPage').removeClass('receipt-list-preview-open');
  $('.ap-page-inprogresslines').removeClass('receipt-list-preview-open');

  unbindReceiptListSplitResize();

  if (hadSplit) {
    adjustReceiptListTableForSplit();
  }
}

function adjustReceiptListTableForSplit() {
  var $table = $('#tableOutput');

  if (!$table.length || !$.fn.DataTable
    || !$.fn.DataTable.isDataTable('#tableOutput')) {
    return;
  }

  try {
    $table.DataTable().columns.adjust();
  } catch (error) {
  }

  try {
    $table.DataTable().responsive.recalc();
  } catch (error) {
  }
}

function bindReceiptListSplitResize() {
  receiptListSplitResizeBound = true;

  $(window)
    .off('resize.receiptListSplit')
    .on('resize.receiptListSplit', function () {
      adjustReceiptListTableForSplit();
    });
}

function moveReceiptListContentIntoSplitPane($content, $listPane) {
  var $form = $content.children('form#mainForm').first();
  var $tableContainer = $content.children('.table-field-container').first();

  if (!$form.length) {
    $form = $content.children('form').first();
  }

  if (!$tableContainer.length) {
    $tableContainer = $content.children('.field-container').first();
  }

  receiptListSplitPlaceholders = [];

  if ($form.length) {
    receiptListSplitPlaceholders.push({
      element: $form[0],
      placeholder: createReceiptListSplitPlaceholder($form[0])
    });
    $listPane.append($form);
  }

  if ($tableContainer.length) {
    receiptListSplitPlaceholders.push({
      element: $tableContainer[0],
      placeholder: createReceiptListSplitPlaceholder($tableContainer[0])
    });
    $listPane.append($tableContainer);
  }
}

function dockAttachmentViewerForSplitLayout() {
  var $mainPage;
  var $content;
  var $overlay;
  var $wrapper;
  var $listPane;
  var $previewPane;
  var $heading;

  if (getAttachmentViewerPreviewLayout() !== ATTACHMENT_CONFIG.viewerLayout.split) {
    return false;
  }

  $mainPage = getReceiptListSplitHostPage();

  if (!$mainPage.length) {
    return false;
  }

  restoreReceiptListPreviewSplit();

  $content = getReceiptListSplitContent($mainPage);

  if (!$content.length) {
    return false;
  }

  $overlay = findAttachmentViewerOverlay();

  if (!$overlay.length) {
    return false;
  }

  $wrapper = $('<div id="receiptListPreviewSplit" '
    + 'class="receipt-list-preview-split"></div>');
  $listPane = $('<div id="receiptListPane" '
    + 'class="receipt-list-pane"></div>');
  $previewPane = $('<div id="receiptPreviewPane" '
    + 'class="receipt-preview-pane"></div>');

  $wrapper.append($listPane).append($previewPane);

  $heading = $content.children('#header-title').first();

  if ($heading.length) {
    $wrapper.insertAfter($heading);
  } else {
    $content.prepend($wrapper);
  }

  moveReceiptListContentIntoSplitPane($content, $listPane);

  $overlay
    .addClass('receipt-viewer-docked')
    .attr('role', 'region')
    .attr('aria-label', 'Receipt preview')
    .removeAttr('aria-modal');

  $previewPane.append($overlay);

  $mainPage.addClass('receipt-list-preview-open');

  bindReceiptListSplitResize();
  adjustReceiptListTableForSplit();

  return true;
}

// ----------------------------------------------------------------------------
// Download and common viewer bindings
// ----------------------------------------------------------------------------

function downloadFile(url, fileName) {
  var link;

  if (!url) {
    Popup.ok('Download', 'No document URL is available');
    return;
  }

  if (
    isMobileDevice() &&
    /iPhone|iPad|iPod/i.test(navigator.userAgent)
  ) {
    window.open(url, '_blank', 'noopener');
    return;
  }

  link = document.createElement('a');
  link.href = url;
  link.download = fileName || extractFileName(url);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function bindViewerCloseEvents(overlaySelector, closeButtonSelector) {
  $(closeButtonSelector)
    .off('click.attachmentViewer')
    .on('click.attachmentViewer', function (event) {
      event.preventDefault();
      event.stopPropagation();
      removeAttachmentViewer();
    });

  $(overlaySelector)
    .off('click.attachmentViewer')
    .on('click.attachmentViewer', function (event) {
      if (event.target === this) {
        removeAttachmentViewer();
      }
    });

  $(document)
    .off('keydown.attachmentViewer')
    .on('keydown.attachmentViewer', function (event) {
      if (event.key === 'Escape' || event.keyCode === 27) {
        removeAttachmentViewer();
      }
    });
}

// ----------------------------------------------------------------------------
// Image viewer
// ----------------------------------------------------------------------------

var HEIC_PREVIEW_FALLBACK_ID = 'dynamicImageHeicFallback';

var HEIC_PREVIEW_FALLBACK_MESSAGE = 'This browser cannot preview the original '
  + 'HEIC image. Use the Download button above to download the original file.';

function isHeicPreviewImage(url, fileType) {
  return getFileExtension(url, fileType) === 'heic';
}

function clearHeicPreviewFallback($stage) {
  $stage.find('#' + HEIC_PREVIEW_FALLBACK_ID).remove();
}

function showHeicPreviewFallback($stage) {
  var fallbackSelector = '#' + HEIC_PREVIEW_FALLBACK_ID;

  if ($stage.find(fallbackSelector).length) {
    return false;
  }

  $('<div></div>')
    .attr('id', HEIC_PREVIEW_FALLBACK_ID)
    .addClass('attachmentViewerImageFallback')
    .attr('role', 'status')
    .css({
      color: '#ffffff',
      'font-size': '14px',
      'line-height': '1.5',
      padding: '16px',
      'text-align': 'center'
    })
    .text(HEIC_PREVIEW_FALLBACK_MESSAGE)
    .appendTo($stage);

  return true;
}

function handleAttachmentImagePreviewError($stage, isHeicImage) {
  if (isHeicImage) {
    showHeicPreviewFallback($stage);
    return;
  }

  Popup.ok('Preview', 'The image could not be loaded');
}

function generateReciptImagePreview(link, fileType) {
  var imageUrl = link && link.href ? link.href : link;
  var imageFileType = fileType || getSelectedFileType();
  var fileName = extractFileName(imageUrl);
  var capabilities = getViewerCapabilities();
  var $image;
  var $stage;
  var isHeicImage = isHeicPreviewImage(imageUrl, imageFileType);
  var scale = ATTACHMENT_CONFIG.zoom.initial;
  var translateX = 0;
  var translateY = 0;
  var isTouch = isTouchDevice();
  var isDragging = false;
  var startX = 0;
  var startY = 0;
  var startTranslateX = 0;
  var startTranslateY = 0;
  var lastTapTime = 0;

  if (!imageUrl) {
    Popup.ok('Preview', 'No document URL was returned');
    return;
  }

  if (!isImageUrl(imageUrl, imageFileType)) {
    showAttachmentPreview(imageUrl, imageFileType);
    return;
  }

  if (removeAttachmentViewer() === false) {
    return;
  }

  captureActivePreviewReceipt();
  setAttachmentViewerMode(ATTACHMENT_VIEWER_MODE_PREVIEW);

  $('body').append(
    '<div id="dynamicImageOverlay" class="attachmentViewerOverlay" '
    + 'role="dialog" aria-modal="true" aria-label="Image preview" '
    + 'data-attachment-viewer="image" '
    + 'data-attachment-mode="' + ATTACHMENT_VIEWER_MODE_PREVIEW + '" '
    + 'data-attachment-status="' + escapeHtml(activePreviewReceiptStatus) + '" '
    + 'data-attachment-url="' + escapeHtml(imageUrl) + '" '
    + 'data-attachment-download-label="Download">'
    + '<div class="attachmentViewerToolbar">'
    + '<div class="attachmentViewerToolbarGroup attachmentViewerToolbarZoom">'
    + '<button id="zoomOutAttchViewer" type="button" '
    + 'class="attachmentViewerButton" aria-label="Zoom out">'
    + '<svg class="attachmentViewerZoomIcon" aria-hidden="true" '
    + 'focusable="false" viewBox="0 0 24 24" fill="none" '
    + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    + 'stroke-linejoin="round">'
    + '<circle cx="10" cy="10" r="6"></circle>'
    + '<path d="M14.5 14.5 L21 21"></path>'
    + '<path d="M7 10 H13"></path>'
    + '</svg>'
    + '</button>'
    + '<button id="zoomInAttchViewer" type="button" '
    + 'class="attachmentViewerButton" aria-label="Zoom in">'
    + '<svg class="attachmentViewerZoomIcon" aria-hidden="true" '
    + 'focusable="false" viewBox="0 0 24 24" fill="none" '
    + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    + 'stroke-linejoin="round">'
    + '<circle cx="10" cy="10" r="6"></circle>'
    + '<path d="M14.5 14.5 L21 21"></path>'
    + '<path d="M7 10 H13"></path>'
    + '<path d="M10 7 V13"></path>'
    + '</svg>'
    + '</button>'
    + '</div>'
    + '<div class="attachmentViewerToolbarGroup attachmentViewerToolbarActions">'
    + getAttachmentViewerActionsHtml(
      ATTACHMENT_VIEWER_MODE_PREVIEW,
      capabilities,
      imageUrl,
      'Download',
      undefined,
      activePreviewReceiptStatus
    )
    + '</div>'
    + '</div>'
    + getReceiptMetaHtml()
    + '<div id="imageViewerStage" class="attachmentViewerStage">'
    + '<img id="dynamicImage" class="attachmentViewerImage" '
    + 'src="' + escapeHtml(imageUrl) + '" '
    + 'alt="' + escapeHtml(fileName) + '" draggable="false">'
    + '</div>'
    + '</div>'
  );

  $image = $('#dynamicImage');
  $stage = $('#imageViewerStage');

  function applyTransform() {
    $image.css(
      'transform',
      'translate(' + translateX + 'px, ' + translateY + 'px) '
      + 'scale(' + scale + ')'
    );
  }

  function resetTransform() {
    scale = ATTACHMENT_CONFIG.zoom.initial;
    translateX = 0;
    translateY = 0;
    applyTransform();
  }

  function zoomTo(nextScale) {
    scale = Math.max(
      ATTACHMENT_CONFIG.zoom.min,
      Math.min(ATTACHMENT_CONFIG.zoom.max, nextScale)
    );

    if (scale <= ATTACHMENT_CONFIG.zoom.initial) {
      translateX = 0;
      translateY = 0;
    }

    applyTransform();
  }

  $('#zoomInAttchViewer')
    .off('click.attachmentViewer')
    .on('click.attachmentViewer', function (event) {
      event.preventDefault();
      event.stopPropagation();
      zoomTo(scale + ATTACHMENT_CONFIG.zoom.step);
    });

  $('#zoomOutAttchViewer')
    .off('click.attachmentViewer')
    .on('click.attachmentViewer', function (event) {
      event.preventDefault();
      event.stopPropagation();
      zoomTo(scale - ATTACHMENT_CONFIG.zoom.step);
    });

  bindAttachmentViewerActionButtons(ATTACHMENT_VIEWER_MODE_PREVIEW);

  $image.on('load', function () {
    clearHeicPreviewFallback($stage);
  });

  $image.on('error', function () {
    handleAttachmentImagePreviewError($stage, isHeicImage);
  });

  $image.on('contextmenu', function (event) {
    event.preventDefault();
  });

  if (isTouch) {
    $image.on('touchstart.attachmentViewer', function (event) {
      var touch;

      if (scale <= 1) {
        return;
      }

      touch = event.originalEvent.touches[0];
      isDragging = true;
      startX = touch.clientX;
      startY = touch.clientY;
      startTranslateX = translateX;
      startTranslateY = translateY;
      event.preventDefault();
    });

    $image.on('touchmove.attachmentViewer', function (event) {
      var touch;

      if (!isDragging || scale <= 1) {
        return;
      }

      touch = event.originalEvent.touches[0];
      translateX = startTranslateX + touch.clientX - startX;
      translateY = startTranslateY + touch.clientY - startY;
      applyTransform();
      event.preventDefault();
    });

    $image.on('touchend.attachmentViewer', function () {
      isDragging = false;
    });

    $stage.on('touchend.attachmentViewer', function (event) {
      var currentTime = new Date().getTime();

      if (currentTime - lastTapTime < 300) {
        if (scale > 1) {
          resetTransform();
        } else {
          zoomTo(ATTACHMENT_CONFIG.zoom.doubleTap);
        }

        event.preventDefault();
      }

      lastTapTime = currentTime;
    });
  } else {
    $image.css('cursor', 'grab');

    $image.on('mousedown.attachmentViewer', function (event) {
      if (scale <= 1) {
        return;
      }

      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startTranslateX = translateX;
      startTranslateY = translateY;
      $image.css('cursor', 'grabbing');
      event.preventDefault();
    });

    $(document).on('mousemove.attachmentViewer', function (event) {
      if (!isDragging || scale <= 1) {
        return;
      }

      translateX = startTranslateX + event.clientX - startX;
      translateY = startTranslateY + event.clientY - startY;
      applyTransform();
    });

    $(document).on('mouseup.attachmentViewer', function () {
      isDragging = false;
      $image.css('cursor', 'grab');
    });
  }

  applyTransform();
}

// ----------------------------------------------------------------------------
// PDF viewer
// ----------------------------------------------------------------------------

function generatePdfPreview(link, fileType) {
  var pdfUrl = link && link.href ? link.href : link;
  var pdfFileType = fileType || getSelectedFileType();
  var fileName = extractFileName(pdfUrl);
  var capabilities = getViewerCapabilities();

  if (!pdfUrl) {
    Popup.ok('Preview', 'No document URL was returned');
    return;
  }

  if (!isPdfUrl(pdfUrl, pdfFileType)) {
    showAttachmentPreview(pdfUrl, pdfFileType);
    return;
  }

  if (fileName.toLowerCase().slice(-4) !== '.pdf') {
    fileName += '.pdf';
  }
  if (removeAttachmentViewer() === false) {
    return;
  }

  captureActivePreviewReceipt();
  setAttachmentViewerMode(ATTACHMENT_VIEWER_MODE_PREVIEW);

  $('body').append(
    '<div id="dynamicPdfOverlay" class="attachmentViewerOverlay" '
    + 'role="dialog" aria-modal="true" aria-label="PDF preview" '
    + 'data-attachment-viewer="pdf" '
    + 'data-attachment-mode="' + ATTACHMENT_VIEWER_MODE_PREVIEW + '" '
    + 'data-attachment-status="' + escapeHtml(activePreviewReceiptStatus) + '" '
    + 'data-attachment-url="' + escapeHtml(pdfUrl) + '" '
    + 'data-attachment-download-label="Download PDF" '
    + 'data-attachment-download-name="' + escapeHtml(fileName) + '">'
    + '<div class="attachmentViewerToolbar">'
    + '<div class="attachmentViewerToolbarGroup attachmentViewerToolbarActions">'
    + getAttachmentViewerActionsHtml(
      ATTACHMENT_VIEWER_MODE_PREVIEW,
      capabilities,
      pdfUrl,
      'Download PDF',
      fileName,
      activePreviewReceiptStatus
    )
    + '</div>'
    + '</div>'
    + getReceiptMetaHtml()
    + '<div class="attachmentViewerStage">'
    + '<iframe id="dynamicPdf" class="attachmentViewerPdf" '
    + 'src="' + escapeHtml(pdfUrl) + '" '
    + 'title="' + escapeHtml(fileName) + '"></iframe>'
    + '</div>'
    + '</div>'
  );

  bindAttachmentViewerActionButtons(ATTACHMENT_VIEWER_MODE_PREVIEW);
}

// ----------------------------------------------------------------------------
// Smart preview and ReceiptBatch row selection
// ----------------------------------------------------------------------------

function showAttachmentPreview(link, fileType) {
  var url = link && link.href ? link.href : link;
  var selectedFileType = fileType || getSelectedFileType();
  var fileName;

  if (!url) {
    Popup.ok('Preview', 'No document URL was returned');
    return;
  }

  if (isPdfUrl(url, selectedFileType)) {
    generatePdfPreview(url, selectedFileType); 
    if (getViewerCapabilities().canEdit) {
        openReceiptDetailsBesidePreview(); 
        
    }
    dockAttachmentViewerForSplitLayout();
    return;
  }

  if (isImageUrl(url, selectedFileType)) {
    generateReciptImagePreview(url, selectedFileType); 
    if (getViewerCapabilities().canEdit && currentPreviewReceiptStatus() !== 'NEW')
        { 
            openReceiptDetailsBesidePreview(); 
        }
    dockAttachmentViewerForSplitLayout();
    return;
  }

  fileName = extractFileName(url);
  downloadFile(url, fileName);
}

function bindAttachmentLinks(selector) {
  $(selector)
    .off('click.attachmentViewer')
    .on('click.attachmentViewer', function (event) {
      event.preventDefault();
      event.stopPropagation();
      showAttachmentPreview(this.href, $(this).data('file-type') || '');
    });
}

function setSelectedReceipt(row) {
  var fields = [
    'RECEIPTBATCH_RECEIPT_ID',
    'RECEIPTBATCH_INSERT_DATE',
    'RECEIPTBATCH_STATUS',
    'RECEIPTBATCH_EBS_USER_NAME',
    'RECEIPTBATCH_FILE_NAME',
    'RECEIPTBATCH_FILE_TYPE',
    'RECEIPTBATCH_EXPENSE_TYPE',
    'RECEIPTBATCH_TOTAL_AMOUNT',
    'RECEIPTBATCH_RECEIPT_DATE',
    'RECEIPTBATCH_MERCHANT',
    'RECEIPTBATCH_LOCATION',
    'RECEIPTBATCH_REPORT_ID',
    'RECEIPTBATCH_REPORT_NAME',
    'RECEIPTBATCH_REPORT_CREATE_DATE',
    'RECEIPTBATCH_DEPARTMENT',
    'RECEIPTBATCH_TEMPLATE_NAME',
    'RECEIPTBATCH_PAYMENT_TYPE',
    'RECEIPTBATCH_CREDIT_TRANSACTION',
    'RECEIPTBATCH_LINE_NUM'
  ];

  $.each(fields, function (index, fieldName) {
    Storage.set(fieldName, Storage.get(fieldName + '_' + row));
  });
}

function setPreviewReceiptMetadataFromSelectedReceipt() {
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewExpenseType,
    Storage.get('RECEIPTBATCH_EXPENSE_TYPE')
  );
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewAmount,
    Storage.get('RECEIPTBATCH_TOTAL_AMOUNT')
  );
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewReceiptDate,
    Storage.get('RECEIPTBATCH_RECEIPT_DATE')
  );
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewMerchant,
    Storage.get('RECEIPTBATCH_MERCHANT')
  );
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewLocation,
    Storage.get('RECEIPTBATCH_LOCATION')
  );
  Storage.set(
    ATTACHMENT_CONFIG.storageKeys.previewDepartment,
    Storage.get('RECEIPTBATCH_DEPARTMENT')
  );
}

function clearPreviewReceiptMetadata() {
  Storage.remove(ATTACHMENT_CONFIG.storageKeys.previewExpenseType);
  Storage.remove(ATTACHMENT_CONFIG.storageKeys.previewAmount);
  Storage.remove(ATTACHMENT_CONFIG.storageKeys.previewReceiptDate);
  Storage.remove(ATTACHMENT_CONFIG.storageKeys.previewMerchant);
  Storage.remove(ATTACHMENT_CONFIG.storageKeys.previewLocation);
  Storage.remove(ATTACHMENT_CONFIG.storageKeys.previewDepartment);
}

function setReceiptForPreview(rowIndex) {
  setSelectedReceipt(rowIndex);
  Storage.set(
    'receipt_ID',
    Storage.get(ATTACHMENT_CONFIG.storageKeys.receiptId)
  );
  setPreviewReceiptMetadataFromSelectedReceipt();
}

function Preview(rowIndex) {
  if (isEmbeddedEditorSaving()) {
    Popup.ok('Receipt Details', 'Please wait for the save to finish.');
    return;
  }

  setReceiptForPreview(rowIndex);

  Services.call(
    'js_ReceiptBatch_get_receipt_by_id',
    function () {
      var documentUrl = Storage.get(
        ATTACHMENT_CONFIG.storageKeys.receiptDocumentUrl
      );
      var fileType = Storage.get(
        ATTACHMENT_CONFIG.storageKeys.receiptFileType
      );

      if (!documentUrl) {
        documentUrl = Storage.get('DOCUMENT_URL');
      }

      if (!fileType) {
        fileType = Storage.get('FILE_TYPE');
      }

      if (!documentUrl) {
        Popup.ok('Preview', 'No document URL was returned');
        return;
      }

      showAttachmentPreview(documentUrl, fileType);
    },
    function () {
      Popup.ok('Preview', 'Failed to load receipt preview');
    }
  );
}

function formatReceiptDate(value, dateFormat) {
  var date;
  var day;
  var month;
  var year;
  var hours;
  var minutes;
  var seconds;
  var hasTime;

  if (!value) {
    return ' ';
  }

  date = new Date(value);

  if (isNaN(date.getTime())) {
    return value;
  }

  function pad(number) {
    return number < 10 ? '0' + number : String(number);
  }

  day = pad(date.getDate());
  month = dateFormat === 'DD-Mon-YYYY'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()]
    : pad(date.getMonth() + 1);
  year = date.getFullYear();
  hours = pad(date.getHours());
  minutes = pad(date.getMinutes());
  seconds = pad(date.getSeconds());

  hasTime =
    date.getHours() !== 0 ||
    date.getMinutes() !== 0 ||
    date.getSeconds() !== 0;

  if (hasTime && dateFormat !== 'DD-Mon-YYYY') {
    return day + '-' + month + '-' + year
      + ' ' + hours + ':' + minutes + ':' + seconds;
  }

  return day + '-' + month + '-' + year;
}

function initReceiptAttachmentViewer(options) {
  options = options || {};

  if (options.createStatusesFilter) {
    createReceiptStatusesFilter(
      options.filterContainerSelector || 'body'
    );
  }

  if (options.attachmentSelector) {
    bindAttachmentLinks(options.attachmentSelector);
  }

  if (options.autoLoadReceipts) {
    loadReceiptBatchesByUser(options.statuses, options.userName);
  }
}

app.isSPA = true;
app.loginPage = 'Login.html';
