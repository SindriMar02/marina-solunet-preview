import * as store from './store.js'
import { $, esc, isk, dayLabel } from './ui.js'
const o = store.orderById(new URLSearchParams(location.search).get('o'))
if (!o) $('#main').innerHTML = '<h1>Checkout not found</h1><p class="muted">This checkout link is not valid in this browser. <a href="shop.html">See the tours</a></p>'
else if (o.state !== 'handed_off') location.replace(`r.html?o=${o.id}`)
else {
  const t = store.tour(o.tourId), onReq = t.capacity === 'ON_REQUEST'
  $('#main').innerHTML = `
    <p class="muted">${esc(store.bookingParties(t.id, store.agent(o.agentId), o.line))}</p>
    <h1>${esc(t.title)}</h1>
    <div class="row2"><span>${esc(dayLabel(o.date))} · ${esc(o.time)}</span><span>${o.pax} guest${o.pax === 1 ? '' : 's'}</span></div>
    <div class="row2"><span>List price</span><span>${isk(o.line.listGrossMinor)}</span></div>
    ${o.line.discountGrossMinor ? `<div class="row2"><span>Promo code</span><span>${isk(-o.line.discountGrossMinor)}</span></div>` : ''}
    <div class="row2 tot"><span>${onReq ? 'Due after acceptance' : 'Total'}</span><span>${isk(o.line.customerGrossMinor)}</span></div>
    <form id="f" style="display:grid;gap:18px" novalidate>
    <div style="display:grid;gap:6px"><label for="n">Lead traveller</label><input id="n" name="name" autocomplete="name" required aria-describedby="n-err"><p class="muted" id="n-err" role="alert" hidden>Add the lead traveller's name.</p></div>
    <div style="display:grid;gap:6px"><label for="e">Email for the voucher</label><input id="e" name="email" type="email" autocomplete="email" required aria-describedby="e-err"><p class="muted" id="e-err" role="alert" hidden>Add an email address like name@example.com.</p></div>
    <button class="b main" id="pay" type="submit">${onReq ? 'Send request' : `Pay ${isk(o.line.customerGrossMinor)}`}</button>
    <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr">
      <button class="b" id="decl" type="button">Simulate: bank declines</button>
      <button class="b" id="leave" type="button">Simulate: guest leaves</button>
    </div>
    </form>
    ${o.line.cancellation ? `<p class="muted">Cancellation: ${esc(o.line.cancellation)}</p>` : ''}
    <p class="muted">After payment you return to Marina Travel to see your booking status.</p>`
  const go = outcome => { store.payOutcome(o.id, outcome, { name: $('#n').value, email: $('#e').value }); location.href = `r.html?o=${o.id}` }
  $('#f').onsubmit = e => { e.preventDefault()
    const bad = [['n', 'n-err'], ['e', 'e-err']].filter(([id, err]) => { const ok = $('#' + id).checkValidity() && $('#' + id).value.trim(); $('#' + err).hidden = !!ok; $('#' + id).setAttribute('aria-invalid', ok ? 'false' : 'true'); return !ok })
    if (bad.length) { $('#' + bad[0][0]).focus(); return }
    go('paid') }
  $('#decl').onclick = () => go('declined'); $('#leave').onclick = () => go('abandon')
}
