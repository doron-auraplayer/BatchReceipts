

var url = ServiceManager.getInput("url")+"/OA_HTML/RF.jsp?function_id=MAINMENUREST&security_group_id=0";

var input = "<params><param>RESPLIST</param><param>HOMEPAGE</param></params>";
var cookies = ServiceManager.getInput("cookies")+';treemenu1=0,1';

//console.log('url is '+url);
//console.log('cookie is '+cookies);


// console.log('cookie is '+cookies.map(function(cookie){return cookie.name+'='+cookie.value}).join(';'))

var headers = {
    // "Cookie": "JSESSIONID="+ServiceManager.getInput("jsessionId")+"; "+ServiceManager.getInput("system")+"="+ServiceManager.getInput("systemId")+"; treemenu1=none open",
    // "Cookie": cookies.map(function(cookie){return cookie.name+'='+cookie.value}).join(';'),
    "Cookie": cookies,
    'Content-Type': 'text/xml'
};

var input = '<params><param>RESPLIST</param><param>HOMEPAGE</param></params>';

// console.log('headers are '+JSON.stringify(headers));
var UNEXPECTED_ERROR = "<error>Unexpected error while processing the request.</error>";
var data = {"response": UNEXPECTED_ERROR};
var retries = 0;
do {
    Utils.sleep(1000);
    data = Services.callExternal("POST", url, input, headers);
    //console.log('data is '+JSON.stringify(data));
    retries++;
} while ((!data.response || data.response.indexOf(UNEXPECTED_ERROR) > -1) && retries < 5);

//  console.log('data is '+JSON.stringify(data));

return {
    "data" : data.response
};

