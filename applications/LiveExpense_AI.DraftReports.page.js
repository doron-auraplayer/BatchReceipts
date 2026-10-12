//'NEW,PROCESSING,PROCESSED,READY,ANALYZED_FAILED,AI_FAILED,LINE_CREATED,LINE_FAILED,SUBMITTED'
var statuses = 'LINE_CREATED,LINE_FAILED,SUBMITTED';

function onLoad() {
    Table.clear();
    Storage.set('draftAiReport', 'false');
    Services.call('ReceiptBatch_get_draft_reports',reportStatus);
}

function reportStatus() {
    var $table = $('#tableOutput');
    var columnIndex = $table
        .find('thead th[id="*th*REPORT_LINE_STATUS"]')
        .index();

    if (columnIndex < 0) {
        return;
    }

    function getCount(fieldName, rowIndex) {
        return Math.max(
            0,
            Number(Storage.get(fieldName + '_' + rowIndex)) || 0
        );
    }

    function renderRow(row, rowIndex) {
        var total = getCount('TOTAL_LINES', rowIndex);
        var pending = getCount('PENDING_LINES', rowIndex);
        var created = getCount('CREATED_LINES', rowIndex);
        var failed = getCount('FAILED_LINES', rowIndex);

        var html =
            '<div style="font-weight:bold;margin-bottom:6px;">' +
                'Total: ' + total +
            '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
                '<span class="label label-success">' +
                    'Created: ' + created +
                '</span>' +
                '<span class="label label-warning">' +
                    'Pending: ' + pending +
                '</span>' +
                '<span class="label label-danger">' +
                    'Failed: ' + failed +
                '</span>' +
            '</div>';

        $(row).children('td').eq(columnIndex).html(html);
    }

    // Include all rows when the table uses pagination.
    if ($.fn.dataTable &&
        $.fn.dataTable.isDataTable($table[0])) {

        $table.DataTable().rows().every(function () {
            renderRow(this.node(), this.index());
            this.invalidate('dom');
        });
    } else {
        $table.find('tbody tr').each(function (rowIndex) {
            renderRow(this, rowIndex);
        });
    }
}

function click_Refresh() {
    onLoad();
}


function onTableClick(row, col, rowCells) {
	var pendingLines = Number(Storage.get("PENDING_LINES_" + row));
	if (pendingLines > 0) {
    Popup.toast("Some receipts are still pending. Please wait.", 3000);
    return;
    }
    
    //Storage.copyFromIndex("REPORT_NUMBER", row);
	Storage.set("ReportNumber", Storage.get("REPORT_NUMBER_" + row));
	    
	reLoginAndRun(function() {
        Services.call(
            'ReceiptBatch_DraftReport',
            function() {
                Storage.set("updateMode", "true");
                Storage.set('draftAiReport', 'true');
                Page.navigate("Report_General.html");
            },
            displayReportServiceError("Failed to get report details")
        );
    });

}

