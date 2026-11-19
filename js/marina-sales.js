import { field, validateFields } from './recruitment.js'
import { exportSheet } from './reporting.js'
import * as store from './store.js'
import { $, esc, isk, adminShell, dayLabel, statusTag, sheet } from './ui.js'
adminShell('Sales')
const sales = () => store.allOrders().filter(o => !$('#supplier').value || (store.supplierIdForOrder(o) ?? 'unknown') === $('#supplier').value)
function draw() {
  const filter = $('#supplier'), selected = filter.value
  filter.innerHTML = '<option value="">All suppliers</option>' + store.suppliers().map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')
    + (store.allOrders().some(o => !store.supplierIdForOrder(o)) ? '<option value="unknown">Unknown supplier</option>' : '')
  filter.value = [...filter.options].some(o => o.value === selected) ? selected : ''
  const os = sales()
  if (!os.length) { $('#t').innerHTML = '<tbody><tr><td colspan="9"><p class="notice">No sales for this selection.</p></td></tr></tbody>'; return }
  const groups = {}
  os.forEach(o => (groups[o.agentId || 'direct'] ||= []).push(o))
  const paid = o => ['confirmed', 'partially_refunded'].includes(o.state)
  const moneyNote = o => { const m = store.money(o); if (!m) return ''
    const fee = m.refundFeeMinor ? ` · refund fee ${isk(m.refundFeeMinor)}` : (store.refunded(o) ? ' · refund fee 0 kr' : '')
    return `<div class="sub">${m.held ? `Held until ${esc(dayLabel(m.releaseOn))} (planned Teya hold)` : m.released ? 'Paid out to Marina' : m.unknown ? 'Paid before the hold: settlement unknown' : 'Refunded'}${m.feeUnknown ? ' · refund fee unknown' : fee}</div>` }
  const net = o => o.payments.reduce((t, p) => t + (p.kind === 'capture' ? p.amount : -p.amount), 0)
  $('#t').innerHTML = `<thead><tr><th>Departure</th><th>Tour · booking</th><th>Supplier</th><th class="num">Guests</th><th>Status</th><th>Credited</th><th class="num">Customer paid, net</th><th class="num">Commission</th><th>Demo actions</th></tr></thead>
  <tbody>${Object.entries(groups).map(([aid, list]) => { const a = store.agent(aid)
    return `<tr class="grp"><td colspan="9">${a ? `${esc(a.sellerId)} · ${esc(a.name)} · ${esc(a.city)}` : 'Direct sales (no seller)'}</td></tr>` + list.map(o => { const t = store.tour(o.tourId)
      return `<tr><td data-label="Departure" class="when">${esc(dayLabel(o.date))}<div class="sub">${esc(o.time)} Iceland</div></td>
        <td data-label="Tour · booking"><span class="tour">${esc(t.title)}</span><div class="sub">${esc(o.ref || 'no booking yet')}</div></td>
        <td data-label="Supplier">${esc(store.supplierForOrder(o))}</td>
        <td data-label="Guests" class="num">${o.pax}</td><td data-label="Status">${statusTag(o.state)}${moneyNote(o)}</td>
        <td data-label="Credited to">${a ? `<span class="mt">${esc(a.sellerId)}</span>` : '—'}<div class="sub">${esc({ visit: 'link', code: 'code', quote: 'quote', direct: 'direct' }[o.why] || o.why)}</div></td>
        <td data-label="Customer paid, net" class="num money">${store.captured(o) ? isk(net(o)) : '<span class="dim">—</span>'}</td>
        <td data-label="Commission" class="num money">${isk(store.balanceOf(o.id))}${store.commissionStatus(o) ? `<div class="sub">${esc({ pending: 'pending', payable: 'payable', unconfirmed: 'unconfirmed' }[store.commissionStatus(o)])}</div>` : ''}</td>
        <td data-label="Actions"><div class="acts">
          ${o.state === 'requested' ? `<fieldset class="response"><legend>Simulated: the supplier answers in Bókun</legend>
            <button class="btn" data-response="accepted" data-id="${o.id}">Accept</button>
            <button class="btn" data-response="rejected" data-id="${o.id}">Reject</button>
            <button class="btn" data-response="expired" data-id="${o.id}">Expire</button></fieldset>` : ''}
          ${o.refundCase ? '<p class="meta">Refund case opened</p>' : ''}
          ${store.money(o)?.held && ['confirmed', 'partially_refunded'].includes(o.state) ? `<button class="btn" data-a="tourday" data-id="${o.id}">Tour day</button>` : ''}
          ${o.state === 'confirmed' ? `<button class="btn" data-a="half" data-id="${o.id}">Refund half</button>` : ''}
          ${['confirmed', 'partially_refunded', 'requested'].includes(o.state) ? `<button class="btn" data-a="cancel" data-id="${o.id}">Cancel · full refund</button>` : ''}
        </div></td></tr>` }).join('') }).join('')}</tbody>
  <tfoot><tr><td colspan="6">Sales shown · ${os.filter(paid).length} paid bookings · ${os.filter(paid).reduce((s, o) => s + o.pax, 0)} guests</td>
    <td class="num money">${isk(os.reduce((s, o) => s + net(o), 0))}</td>
    <td class="num money">${isk(os.reduce((s, o) => s + store.balanceOf(o.id), 0))}</td><td></td></tr></tfoot>`
  document.querySelectorAll('[data-response]').forEach(button => button.onclick = () => {
    store.refresh()
    store.simulateSupplierResponse(button.dataset.id, button.dataset.response)
    draw()
    $('.tablewrap').focus({ preventScroll: true })
  })
  document.querySelectorAll('[data-a]').forEach(button => button.onclick = event => {
    const action = button.dataset.a, id = button.dataset.id, order = store.orderById(id)
    const title = { half: 'Refund half', cancel: 'Cancel and refund', tourday: 'Mark the tour as run' }[action]
    const settleTour = action === 'tourday'
    sheet({
      title, opener: button, viaKey: event.detail === 0,
      body: `<form class="flow" novalidate><p>${esc(order.ref || id)} · ${esc(store.tour(order.tourId).title)}</p>
        ${settleTour ? '<p>Simulate Teya releasing the funds to Marina and making commission payable.</p>' :
          `${field({ id: 'refund-reason', label: 'Reason', type: 'textarea' })}
          <label class="checkline"><input type="checkbox" id="sales-mfa">Confirm staff verification (prototype)</label>`}
        <p class="hint err" role="alert" id="sales-error"></p><div><button class="btn primary">Confirm</button></div></form>`,
      onOpen(dialog, close) {
        $('form', dialog).onsubmit = e => {
          e.preventDefault()
          if (!validateFields(e.currentTarget)) return
          if (!settleTour && !$('#sales-mfa', dialog).checked) {
            $('#sales-error', dialog).textContent = 'Confirm staff verification to continue.'
            $('#sales-mfa', dialog).focus()
            return
          }
          try {
            const operation = { half: store.adminRefundHalf, cancel: store.adminCancel, tourday: store.adminRunTourDay }[action]
            operation(id, $('#refund-reason', dialog)?.value)
            close()
            draw()
            $('#sales-action-result').textContent = `${title} recorded for ${order.ref || id}.`
            $('.tablewrap').focus({ preventScroll: true })
          } catch {
            $('#sales-error', dialog).textContent = 'The change could not be recorded. Check your session and refresh the booking.'
          }
        }
      },
    })
  })
}
$('#supplier').onchange = draw
$('#export').onclick = event => {
  const columns = ['booking', 'seller', 'tour', 'departure', 'guests', 'state', 'gross ISK', 'refunds ISK', 'net ISK', 'commission ISK', 'attribution']
  const rows = sales().map(o => [o.ref, store.agent(o.agentId)?.sellerId, store.tour(o.tourId).title, o.date + ' ' + o.time,
    o.pax, o.state, store.captured(o), store.refunded(o), store.netPaid(o), store.balanceOf(o.id), o.why])
  exportSheet(event, { kind: 'sales', columns, rows, filters: { supplier: $('#supplier').value } })
}
draw()
window.addEventListener('storage', () => { store.refresh(); draw() })
