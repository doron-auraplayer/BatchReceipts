var url = ServiceManager.getInput("url")+"/OA_HTML/RF.jsp?function_id=MAINMENUREST&security_group_id=0";

var respId = ServiceManager.getInput("respId");
var applId = ServiceManager.getInput("applId");
var secgrpId = ServiceManager.getInput("secgrpId");
var mackkey = ServiceManager.getInput("mackkey");

        //   <params><param>65622</param><param>0</param><param>-1</param><param>0</param><param>HOMEPAGE</param><param>mainMenuRESTUcV8B8Nh</param></params>            
var input = "<params><param>"+respId+"</param><param>"+applId+"</param><param>-1</param><param>"+secgrpId+"</param><param>HOMEPAGE</param><param>"+mackkey+"</param></params>";
var cookies = ServiceManager.getInput("cookies");

var headers = {
    'Cookie': cookies,
    'Content-Type': 'application/xml'
}

var data = Services.callExternal("POST", url, input, headers);

console.log(JSON.stringify(data.response));

return {
    "menu" : data.response
};

