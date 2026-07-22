from pathlib import Path

path = Path('app.js')
source = path.read_text(encoding='utf-8')
start_marker = 'function renderApprovalLoadingState() {'
end_marker = 'function loadApprovalData() {'
start = source.find(start_marker)
end = source.find(end_marker, start)
if start < 0 or end <= start:
    raise SystemExit('Approval lifecycle helper region not found')

canonical = r'''function renderApprovalLoadingState() {
  var tbody = $('approvalTableBody');
  var mobileList = $('approvalMobileList');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="skeleton-screen approval-desktop-skeleton" style="padding:20px;">' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div></div>'.repeat(5) +
      '</div></td></tr>';
  }
  if (mobileList) {
    mobileList.innerHTML = '<div class="approval-mobile-skeleton">' +
      '<div class="approval-card-skeleton"><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-40"></div></div>'.repeat(4) +
      '</div>';
  }
}

function setApprovalRefreshing(refreshing) {
  var page = $('page-approval');
  if (page) page.classList.toggle('approval-refreshing', !!refreshing);
}

function clearApprovalWatchdog() {
  if (approvalLoadState.watchdog) {
    clearTimeout(approvalLoadState.watchdog);
    approvalLoadState.watchdog = null;
  }
}

function runQueuedApprovalReload() {
  if (!approvalLoadState.queued) return;
  approvalLoadState.queued = false;
  setTimeout(function() { loadApprovalData(); }, 0);
}

'''

source = source[:start] + canonical + source[end:]
path.write_text(source, encoding='utf-8')
