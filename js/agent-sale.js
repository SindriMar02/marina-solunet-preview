import * as store from './store.js'
import { $, esc, isk, pct, agentShell, dayLabel, stamp, statusTag } from './ui.js'
agentShell('sales', 'Sale')
window.addEventListener('storage', () => location.reload())
const o = store.myOrder(new URLSearchParams(location.search).get('id'))
if (!o || o.agentId !== store.me().id) location.replace('../403.html')
else draw()
function draw() {
  const t = store.tour(o.tourId), L = o.line, ents = store.entriesOf(o.id), bal = store.balanceOf(o.id)
  const captured = o.payments.filter(p => p.kind === 'capture').reduce((s, p) => s + p.amount, 0)
  const refunds = o.payments.filter(p => p.kind !== 'capture')
  const settle = !['confirmed', 'partially_refunded'].includes(o.state) ? (o.state === 'cancelled' ? 'Nothing to pay: the booking was cancelled.' : 'Earned only when the booking is confirmed and paid.')
    : store.money(o)?.released ? `Earned. The tour ran on ${dayLabel(o.date)} and Teya paid the money out to Marina. In the next monthly payout.`
    : `Pending until the tour on ${dayLabel(o.date)}. Teya holds the guest's payment until then; if the guest cancels first, the refund costs nothing and this commission is reversed.`
  $('#main').innerHTML = `
    <a class="linkbtn" href="sales.html">← Your sales</a>
    <p class="eyebrow" style="margin-top:16px">${esc(o.ref || 'No booking reference yet')}</p>
    <h1 class="h-page" style="margin:10px 0 6px">${esc(t.title)}</h1>
    <p class="dim">${esc(store.supplierForOrder(o))} · ${esc(dayLabel(o.date))} · ${esc(o.time)} Iceland · ${o.pax} guest${o.pax === 1 ? "" : "s"} · ${statusTag(o.state)}</p>
    <p class="money" style="margin:28px 0 4px;font-size:clamp(40px,7vw,72px);font-weight:600;letter-spacing:-.03em;line-height:1">${isk(bal)}</p>
    <p class="meta">Your commission on this sale · ${esc({ pending: 'pending until the tour has run', payable: 'payable in the next monthly payout', unconfirmed: 'waiting for Marina to confirm the payment' }[store.commissionStatus(o)] || 'nothing owed')}</p>

    <section style="margin-top:36px"><h2 class="h-task" style="margin-bottom:12px">How it was worked out</h2>
      <ol class="formula">
        <li><span>List price, ${o.pax} guest${o.pax === 1 ? "" : "s"}</span><span class="v">${isk(L.listGrossMinor)}</span><span class="why">The tour's price before any discount.</span></li>
        <li><span>Price before VAT</span><span class="v">${isk(L.listNetMinor)}</span><span class="why">VAT is ${pct(L.vatBps)} in this demo.</span></li>
        ${L.ruleKind === 'share_of_margin' ? `
          <li><span>Supplier payable</span><span class="v">${isk(L.supplierCostMinor)}</span></li>
          <li><span>Agreed fees</span><span class="v">${isk(L.feeMinor)}</span></li>
          <li><span>Margin before discount and commission</span><span class="v">${isk(L.marginMinor)}</span></li>
          <li><span>Your ${pct(L.commissionBps)} margin share, less the guest discount</span><span class="v">${isk(L.agentAmountMinor)}</span>
            <span class="why">Guest discount before VAT ${isk(L.discountNetMinor)}. Rule version ${esc(L.policyVersion)}.</span></li>` : `
          <li><span>Your rate</span><span class="v">${pct(L.commissionBps)} − ${pct(L.discountBps)} = ${pct(L.agentRateBps)}</span><span class="why">Your ${pct(L.discountBps)} discount to the customer comes out of your ${pct(L.commissionBps)}.</span></li>
          <li><span>Commission on this sale</span><span class="v">${isk(L.agentAmountMinor)}</span><span class="why">${pct(L.agentRateBps)} of ${isk(L.listNetMinor)}, rounded to the whole krona. Rule version ${esc(L.policyVersion || 'comm-2026-11-18.3')}.</span></li>`}
        ${ents.map(e => `<li class="${e.amount < 0 ? 'neg' : ''}"><span>${e.type === 'accrual' ? 'Credited' : e.type === 'reversal' ? 'Reversed' : 'Adjusted'} · ${esc(stamp(e.at))}</span><span class="v">${isk(e.amount, { sign: true })}</span><span class="why">${esc(e.reason)}</span></li>`).join('')}
        <li class="sum"><span>Your commission now</span><span class="v">${isk(bal)}</span></li>
      </ol></section>

    <section><h2 class="h-task" style="margin-bottom:12px">Booking and payment</h2>
      <div class="price">
        <div class="line"><span>Customer was quoted</span><span>${isk(L.customerGrossMinor)}</span></div>
        <div class="line"><span>Customer paid</span><span>${captured ? isk(captured) : '—'}</span></div>
        ${refunds.map(r => `<div class="line"><span>Refunded ${esc(stamp(r.at))}</span><span>${isk(-r.amount)}</span></div>`).join('')}
        <div class="line"><span>Credited because</span><span>${esc({ visit: 'customer used your link', code: 'customer entered your code', quote: 'customer paid your quote' }[o.why] || o.why)}</span></div>
      </div></section>

    <section><h2 class="h-task" style="margin-bottom:12px">Payout</h2><p class="dim">${esc(settle)}</p></section>

    <section><h2 class="h-task" style="margin-bottom:12px">History</h2>
      <ol class="hist">${o.history.slice().reverse().map(h => `<li><div class="when">${esc(stamp(h.at))} UTC</div><div>${esc(h.what)}</div><div class="meta">${esc(h.detail)}</div></li>`).join('')}</ol></section>

    <section><p class="meta">Something wrong with this sale? Claims open in a later slice; for now contact Marina with reference ${esc(o.ref || o.id)}.</p></section>`
}
