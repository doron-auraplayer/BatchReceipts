function GoBack() {
    if (Storage.get("ApplicationFlow") == "inReview") {
        Page.navigate("Review.html");
    } else {
        Page.navigate("Report_Display_General_Details.html");
    }
}

Events.tablePopulated = function(){
    if (Table.countRows() > 0 && Storage.get("AllocationPaymentMethod_0") === "") {
        Table.deleteRow(0);
    }
};

function onLoad() {
	Services.call("iExpense_getReportDetailsAllocations", function(){}, displayReportServiceError("Failed to load resource allocations details"));
}

