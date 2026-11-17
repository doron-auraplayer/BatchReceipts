// Enqueues receipt analysis followed by transaction matching for the requested
// EBS user. ReceiptBatch_AnalyzeAndMatch runs both steps in order in the
// background. The response confirms enqueue only; it does not mean the work has
// finished.

var ebsUser = ServiceManager.getInput('EBS_USER');
var statuses = ServiceManager.getInput('P_STATUSES') || 'NEW';

if (ebsUser === null || ebsUser === undefined || String(ebsUser).trim() === '') {
    throw new Error('EBS_USER is required to start receipt analysis');
}

Services.callAsync('ReceiptBatch_AnalyzeAndMatch', {
    'EBS_USER': String(ebsUser).trim(),
    'P_STATUSES': statuses
});

return {};
