import { $, agentShell, esc, isk, monthLabel } from './ui.js'
import { root } from './recruitment.js'
import { agentStatement } from './store.js'
import { ledger, liveReports } from './reporting.js'

agentShell('money', 'Statements')
root.classList.add('work-inner')
root.innerHTML = `<header class="work-heading"><p class="eyebrow">Seller earnings</p><h1 class="p-h2">Monthly statement</h1>
  <p class="dim">Sales, refunds and commission entries by transaction month. Prototype payouts are recorded by Marina Finance.</p></header>
  <div class="month-pick"><label class="field">Statement month<select class="input" id="month"></select></label></div>
  <section class="work-section" aria-label="Statement transactions" id="statement"></section>`
const month = $('#month')
function draw() {
  const report = agentStatement(month.value)
  month.innerHTML = report.months.map(key => `<option value="${key}"${key === report.period ? ' selected' : ''}>${esc(monthLabel(key + '-01'))}</option>`).join('')
  $('#statement').innerHTML = `<div class="flow-stack" data-ledger-reveal>
    <dl class="stat-strip inset"><div><dt>Pending commission</dt><dd class="fig">${isk(report.held)}</dd><span class="note">Payable after each tour has run</span></div>
      <div><dt>Payable commission</dt><dd class="fig key">${isk(report.payable)}</dd><span class="note">${report.payout ? `Manual payout · ${esc(report.payout.reference)} · ${esc(report.payout.at.slice(0, 10))}` : 'No manual payout reference for this month.'}</span></div></dl>
    ${ledger(['Date', 'Booking', 'Entry', 'Guest amount', 'Commission'], report.rows.map(row => [
      esc(row.at.slice(0, 10)), `<a class="linkbtn" href="sale.html?id=${encodeURIComponent(row.orderId)}">${esc(row.ref || 'Booking')}</a><p class="meta">${esc(row.tour)}</p>`,
      esc(({ capture: 'Sale', refund: 'Refund', accrual: 'Commission earned', reversal: 'Commission reversal', adjustment: 'Commission adjustment' })[row.kind] || row.kind),
      row.guest == null ? '—' : isk(row.guest), row.commission == null ? '—' : isk(row.commission),
    ]), 'No transactions in this month.')}
  </div>`
}
month.onchange = draw
draw()
liveReports(draw)
