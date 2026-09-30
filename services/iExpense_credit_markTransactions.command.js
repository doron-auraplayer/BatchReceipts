// var PAGINATION_SIZE = 10;
// var selection = ServiceManager.getInput("selection").split(',');

// var response = Services.call("iExpense_credit_paginateToFirstTransaction", {
//     "keepAlive": true
// });
// var error = ServiceManager.getResponseValue(response, 'Error');
// if (error.length !== 0) {
// 	throw(error);
// }

// for (var i = 0; i < selection.length; i += 10) {
//     var input = [];
//     for (var j = i; j < i + 10 && j < selection.length; j++) {
//         input.push({"select": selection[j]});
//     }
//     console.log('input ' + i + ':' + JSON.stringify(input));
//     var response = Services.call("iExpense_credit_markTransactionsAndPaginate", {
//     	"selection": input,
//     	"keepAlive": true
//     });
//     var error = ServiceManager.getResponseValue(response, 'Error');
//     if (error.length !== 0) {
//     	throw(error);
//     }
// }

var selection = ServiceManager.getInput("selection").split(',');
var input = [];
for (var i = 0; i < selection.length; i ++) {
    input.push({"select": selection[i]});
}
console.log('input ' + i + ':' + JSON.stringify(input));
var response = Services.call("iExpense_credit_setTransactions", {
	"selection": input,
	"keepAlive": true
});
var error = ServiceManager.getResponseValue(response, 'Error');
if (error.length !== 0) {
	throw(error);
}


return {
};