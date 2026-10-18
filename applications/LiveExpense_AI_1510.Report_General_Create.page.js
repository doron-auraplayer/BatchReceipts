// This page is called from the menu and redirects immediatly to the real Page
// This is a workaround as I needed to find a way to know I come from the menu
// of "create new report" and could not find a better way
function onLoad() {
    Storage.remove("updateMode");
    Page.navigate("Report_General.html");
}


