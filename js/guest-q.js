import * as store from './store.js'
import { $, esc, isk, pct, storeShell, dayLabel, stamp, viewerTime, statusTag } from './ui.js'
storeShell()
const key = new URLSearchParams(location.search).get('k')
let q = store.quote(key)
window.addEventListener('storage', () => { store.refresh(); q = store.quote(key); if (q) draw() })
if (!q) $('#main').innerHTML = '<h1 class="h-page">Quote not found</h1><p class="notice err" style="margin-top:16px">This quote link is not valid in this browser. Ask your seller to send it again, or <a href="shop.html">see the tours</a>.</p>'
else draw()

function draw() {
  store.markOpened(q)
  const t = store.tour(q.tourId), a = store.agent(q.agentId), o = q.orderId && store.orderById(q.orderId)
  const p = store.preview({ tourId: t.id, date: q.date, startTimeId: q.startTimeId, pax: q.pax, quoteKey: q.k })
  const local = viewerTime(q.date, q.time)
  let foot = ''
  if (o && o.state !== 'failed') foot = `<p class="notice ok">This quote has been used. ${statusTag(o.state)} ${o.ref ? `· reference ${esc(o.ref)}` : ''}</p><a class="btn" href="r.html?o=${o.id}">See your booking</a>`
  else if (p.error === 'quote_expired') foot = `<p class="notice">This quote expired on ${esc(stamp(q.expires))} UTC. Ask ${esc(a.name)} for a new one.</p>`
  else if (p.error === 'price_changed') foot = `<p class="notice">The price of this tour changed after your quote was made: it was <b class="money">${isk(p.was)}</b>, it is now <b class="money">${isk(p.now)}</b>. Nothing has been charged. Ask ${esc(a.name)} for an updated quote.</p>`
  else if (p.error === 'no_seats') foot = `<p class="notice">This departure no longer has ${q.pax} seats. Nothing has been charged. Ask ${esc(a.name)} for another time.</p>`
  else if (p.error) foot = `<p class="notice" role="status">${esc(store.saleError(p.error) || 'Ask your seller for an updated quote.')}</p>`
  else foot = `<button class="btn primary full" id="go">${t.capacity === 'ON_REQUEST' ? 'Send booking request' : `Pay ${isk(q.totalMinor)}`}</button>
      <p class="meta">You pay Marina Travel on its secure Bókun checkout. Price and seats are checked again when you pay; this quote does not hold seats.</p>
      <p class="meta held-note">${t.capacity === 'ON_REQUEST' ? 'Marina Travel confirms the date first, then you pay. ' : ''}Planned with Teya: your payment is held until the day of your tour. Any refund under the cancellation terms goes back to the card you paid with.</p><p class="proto">Demo prices. Nothing is charged.</p>`
  $('#main').innerHTML = `
    <p class="eyebrow">Quote from ${esc(a.name)} · ${esc(a.sellerId)}</p>
    <article class="paper" style="margin-top:14px" aria-label="Quote">
      <div><p class="eyebrow">${esc(store.storeBrand())} · quote for ${esc(q.customer)}</p>
        <h1 class="h-page" style="margin-top:8px">${esc(t.title)}</h1>
        <p class="dim" style="margin-top:6px">${esc(t.place)} · ${esc(t.duration)} · ${esc(t.meeting)}</p></div>
      <hr>
      <dl class="facts" style="border:0;padding:0">
        <div><dt class="meta">Date</dt><dd>${esc(dayLabel(q.date))}</dd></div>
        <div><dt class="meta">Departure</dt><dd>${esc(q.time)} Iceland${local ? `<br><span class="meta">${esc(local)}</span>` : ''}</dd></div>
        <div><dt class="meta">Guests</dt><dd>${q.pax}</dd></div>
        <div><dt class="meta">Valid until</dt><dd>${esc(stamp(q.expires))} UTC</dd></div>
      </dl>
      <hr>
      <div class="price">
        <div class="line"><span>${q.pax} × ${isk(q.listMinor / q.pax)} ${esc(t.unit)}</span><span>${isk(q.listMinor)}</span></div>
        ${q.discountBps ? `<div class="line save"><span>Discount from ${esc(a.name)} (${pct(q.discountBps)})</span><span>${isk(q.totalMinor - q.listMinor)}</span></div>` : ''}
        <div class="total"><span>Total</span><b class="money">${isk(q.totalMinor)}</b></div>
      </div>
      <p class="meta">${esc(store.bookingParties(t.id, a, q.line))}</p>
      ${q.line?.cancellation || store.offerTerms(t.id)?.cancellation ? `<p class="meta">Cancellation: ${esc(q.line?.cancellation || store.offerTerms(t.id).cancellation)}</p>` : ''}
    </article>
    <div style="display:grid;gap:12px;margin-top:20px">${foot}</div>`
  const go = $('#go')
  if (go) go.onclick = () => {
    // A new attempt key after a failed payment, the same key for repeated clicks on one attempt.
    const tries = store.quoteFailures(q.k)
    const r = store.checkout({ tourId: t.id, date: q.date, startTimeId: q.startTimeId, pax: q.pax, quoteKey: q.k, requestKey: 'rk_q_' + q.k + (tries ? '_' + tries : '') })
    if (r.error) { draw(); return }
    location.href = r.checkoutUrl || `r.html?o=${r.orderId}`
  }
}
