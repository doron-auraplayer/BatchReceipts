var app = {};
app.isSPA = true;
app.serviceManagerHost = '';			// to execute API calls on other server
app.serviceCallTimeout = 60000;		// milliseconds to wait for service calls to finish
app.serviceSuppressedParams = [];		// fields that won't be sent to service calls
app.addLogoutToMenu = true;			// Adds logout as the last option to the menu (you must set login page for the application)
app.autoFocusConfig = {};			    // Optional custom autofocus configuration
app.loginPage = '';
