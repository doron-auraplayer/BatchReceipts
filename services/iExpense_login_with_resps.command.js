// #####################
// #      Login      #
// #####################

var response = Services.call("iExpense_login", {
	"HomePageTitle": ServiceManager.getInput("HomePageTitle"),
	"usernameField": ServiceManager.getInput("usernameField"),
	"passwordField": ServiceManager.getInput("passwordField"),
	//"FormsUrl": ServiceManager.getInput('FormsUrl'),
	"keepAlive": ServiceManager.getInput('keepAlive'),
});

var LoginErrorLineExists = ServiceManager.getResponseValue(response, 'LoginErrorLineExists');
var LoginErrorBoxExists = ServiceManager.getResponseValue(response, 'LoginErrorBoxExists');
var LoginErrorMessage = ServiceManager.getResponseValue(response, 'LoginErrorMessage');
var LoginErrorMessageExists = ServiceManager.getResponseValue(response, 'LoginErrorMessageExists');
var LoggedInUsername = ServiceManager.getResponseValue(response, 'LoggedInUsername');
var cookies = ServiceManager.getResponseValue(response, 'cookies');
var sessionId = response.Response.sessionId;

var error = ServiceManager.getResponseValue(response, 'Error');
if (error.length !== 0) {
	throw(error);
}

/*
console.log(LoginErrorLineExists +', '+ LoginErrorBoxExists+', '+LoginErrorMessageExists+', '+ (LoginErrorLineExists || LoginErrorBoxExists || LoginErrorMessageExists));
if (LoginErrorLineExists || LoginErrorBoxExists || LoginErrorMessageExists){
    throw (error);
}*/

// ##############################
// #  Retrieve Responsibilities  #
// ##############################
// console.log('cookies: '+JSON.stringify(cookies));

cookies = cookies.map(function(cookie){return cookie.name+'='+cookie.value}).join(';');
var response = Services.call("getResponsibilitiesList", {
	"url": ServiceManager.getInput("FormsUrl"),
	"cookies": cookies
});
var error = ServiceManager.getResponseValue(response, 'Error');
if (error.length !== 0) {
	throw(error);
}
var data = ServiceManager.getResponseValue(response, 'data');
// console.log('data ='+data);

// ##############################
// #  Filter Responsibilities  #
// ##############################

function extractRESPObjects(xmlString) {
  var respObjects = [];
  var startIndex = xmlString.indexOf('<RESP>');
  while (startIndex !== -1) {
    var endIndex = xmlString.indexOf('</RESP>', startIndex);
    if (endIndex !== -1) {
      var respData = xmlString.substring(startIndex, endIndex + 7); // Include '</RESP>' in the substring
      var respObject = {
        RESPNAME: extractTagValue(respData, 'RESPNAME'),
        RESPID: extractTagValue(respData, 'RESPID'),
        APPLID: extractTagValue(respData, 'APPLID'),
        SECGRPID: extractTagValue(respData, 'SECGRPID'), 
        MACKEY: extractTagValue(respData, 'MACKEY')
      };

      respObjects.push(respObject);
      startIndex = xmlString.indexOf('<RESP>', endIndex);
    } else {
      break;
    }
  }
  return respObjects;
}

function extractTagValue(xml, tag, debug) {
  var openTag = '<' + tag + '>';
  var closeTag = '</' + tag + '>';
  var startIndex = xml.indexOf(openTag);
  if (startIndex !== -1) {
    startIndex += openTag.length;
    var endIndex = xml.indexOf(closeTag, startIndex);
    if (endIndex !== -1) {
      return xml.substring(startIndex, endIndex);
    }
  }
  return null;
}

var resps = extractRESPObjects(data);
var respNames = [];
var respIds = [];
var respAppIds = [];

// console.log("resps: " + JSON.stringify(resps));
resps.forEach(function (resp) {
//   console.log("Resp: " + JSON.stringify(resp));
  if (resp.RESPNAME.indexOf(ServiceManager.getInput("RespName")) >= 0) {
    var response = Services.call("getResponsibilityInnerMenu", {
      "url": ServiceManager.getInput("FormsUrl"),
      "respId": resp.RESPID,
      "applId": resp.APPLID,
      "secgrpId": resp.SECGRPID,
      "cookies": cookies,
      "mackkey": resp.MACKEY
    });
    
    var menuXml = ServiceManager.getResponseValue(response, 'menu');
    if (menuXml.indexOf('<URL>') >= 0){
        var startIndex = menuXml.indexOf('<URL>') + 5; // +5 to skip the <URL> tag itself
        var endIndex = menuXml.indexOf('</URL>', startIndex);
    
        var url = menuXml.substring(startIndex, endIndex);
        // console.log("URL: " + url);
        if (url){ //check the functionId
            var respFunctionId = url.match(/[?&]function_id=([^&]+)/);
            if (respFunctionId && respFunctionId[1] === ServiceManager.getInput("FunctionId")){
                respNames.push(resp.RESPNAME);
                respIds.push(resp.RESPID);
                respAppIds.push(resp.APPLID)
            }
        }
    } 
  }
});

return {
    LoginErrorLineExists: LoginErrorLineExists,
    LoginErrorBoxExists: LoginErrorBoxExists,
    LoginErrorMessage: LoginErrorMessage,
    LoginErrorMessageExists: LoginErrorMessageExists,
    LoggedInUsername: LoggedInUsername,
    respNames: respNames,
    respIds: respIds,
    respAppIds: respAppIds,
    sessionId: sessionId
};