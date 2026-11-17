// Runs receipt analysis and then transaction matching, in that order.
// Both steps are executed synchronously in the background so the caller can
// return as soon as the work is accepted. Analysis must finish successfully
// before matching starts.

var ebsUser = ServiceManager.getInput('EBS_USER');
var statuses = ServiceManager.getInput('P_STATUSES') || 'NEW';

if (ebsUser === null || ebsUser === undefined || String(ebsUser).trim() === '') {
    throw new Error('EBS_USER is required to start receipt analysis');
}

var trimmedEbsUser = String(ebsUser).trim();

var analyzeResponse = Services.call('ReceiptBatch_AnalyzeRPA', {
    'EBS_USER': trimmedEbsUser,
    'P_STATUSES': statuses
});
var analyzeError = ServiceManager.getResponseValue(analyzeResponse, 'Error');
if (analyzeError && analyzeError.length !== 0) {
    throw (analyzeError);
}

var matchingResponse = Services.call('ReceiptBatch_TransactionMatching', {
    'EBS_USER': trimmedEbsUser
});
var matchingError = ServiceManager.getResponseValue(matchingResponse, 'Error');
if (matchingError && matchingError.length !== 0) {
    throw (matchingError);
}

return {};
