// Dispatches receipt analysis for the requested EBS user.
// The response confirms dispatch only; it does not mean the work has finished.

var ebsUser = ServiceManager.getInput('EBS_USER');
var statuses = ServiceManager.getInput('P_STATUSES') || 'NEW';

if (ebsUser === null || ebsUser === undefined || String(ebsUser).trim() === '') {
    throw new Error('EBS_USER is required to start receipt analysis');
}

Services.callAsync('ReceiptBatch_AnalyzeRPA', {
    'EBS_USER': String(ebsUser).trim(),
    'P_STATUSES': statuses
});

return {};
