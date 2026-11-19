import * as store from './store.js'
import { $, esc, isk, agentShell, dayLabel, monthLabel, statusTag, segmented } from './ui.js'
agentShell('sales', 'Sales')
const F = [['all', 'All'], ['confirmed', 'Confirmed'], ['pending', 'Waiting'], ['cancelled', 'Cancelled'], ['failed', 'Failed']]
let f = new URLSearchParams(location.search).get('f') || 'all'
const fresh = sessionStorage.getItem('fresh-order')
function draw() {
  const all = store.salesFor(store.me().id)
  const match = o => f === 'all' || (f === 'confirmed' ? ['confirmed', 'partially_refunded'].includes(o.state) : f === 'pending' ? ['handed_off', 'requested'].includes(o.state) : o.state === f)
  const rows = all.filter(match)
  const conf = all.filter(o => ['confirmed', 'partially_refunded'].includes(o.state))
  $('#totals').innerHTML = [['Confirmed bookings', conf.length], ['Cancelled bookings', all.filter(o => o.state === 'cancelled').length], ['Guests on confirmed bookings', conf.reduce((s, o) => s + o.pax, 0)],
    ['Gross captured sales', isk(all.reduce((sum, o) => sum + store.captured(o), 0))], ['Customers paid, net of refunds', isk(all.reduce((sum, o) => sum + store.netPaid(o), 0))], ['Your commission', isk(all.reduce((s, o) => s + store.balanceOf(o.id), 0))]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')
  if (!$('#pills .pill')) {
    $('#pills').innerHTML = F.map(([k, l]) => `<button class="pill" type="button" data-f="${k}" aria-pressed="${k === f}">${l}</button>`).join('')
    const seg = segmented($('#pills'))
    document.querySelectorAll('.pill').forEach(b => b.onclick = () => {
      f = b.dataset.f; history.replaceState(null, '', `?f=${f}`)
      document.querySelectorAll('.pill').forEach(other => other.setAttribute('aria-pressed', String(other === b)))
      seg?.select(b); draw()
    })
  }
  $('#list').removeAttribute('data-ledger-reveal')
  if (!rows.length) { $('#list').innerHTML = `<p class="notice" style="margin-top:24px">${all.length ? 'No sales match this filter.' : 'No sales yet. Share a tour from Sell to make your first one.'}</p>`; return }
  requestAnimationFrame(() => $('#list').setAttribute('data-ledger-reveal', ''))
  const byMonth = {}
  rows.forEach(o => (byMonth[o.date.slice(0, 7)] ||= []).push(o))
  $('#list').innerHTML = Object.entries(byMonth).map(([m, os]) => `
    <div class="month"><h2>${esc(monthLabel(m + '-01'))} departures</h2><span class="meta">${os.length} ${os.length === 1 ? 'booking' : 'bookings'}</span></div>
    <ul class="rows phone">${os.map(o => { const t = store.tour(o.tourId); return `<li><a class="row${o.id === fresh ? ' fresh' : ''}" href="sale.html?id=${o.id}">
      <span class="r1">${esc(t.title)}</span><span class="r2">${esc(dayLabel(o.date))} · ${esc(o.time)} Iceland · ${o.pax} guests · ${statusTag(o.state)}</span>
      <span class="r3"><span class="dim">Your commission</span><span class="money">${isk(store.balanceOf(o.id))}</span></span></a></li>` }).join('')}</ul>
    <table class="ledger desk"><thead><tr><th>Departure</th><th>Tour</th><th class="num">Guests</th><th>Status</th><th class="num">Customer paid, net</th><th class="num">Your commission</th></tr></thead>
    <tbody>${os.map(o => { const t = store.tour(o.tourId); return `<tr class="link${o.id === fresh ? ' fresh' : ''}" data-href="sale.html?id=${o.id}">
      <td class="when">${esc(dayLabel(o.date))}<div class="sub">${esc(o.time)} Iceland</div></td>
      <td><a class="tour" href="sale.html?id=${o.id}" style="text-decoration:none">${esc(t.title)}</a><div class="sub">${esc(o.ref || 'No booking yet')}</div></td>
      <td class="num">${o.pax}</td><td>${statusTag(o.state)}</td>
      <td class="num money">${['confirmed', 'partially_refunded'].includes(o.state) ? isk(o.payments.reduce((t, p) => t + (p.kind === 'capture' ? p.amount : -p.amount), 0)) : '<span class="dim">—</span>'}</td>
      <td class="num money">${isk(store.balanceOf(o.id))}</td></tr>` }).join('')}</tbody></table>`).join('')
  document.querySelectorAll('tr.link').forEach(tr => tr.onclick = e => { if (e.target.closest('a')) return; location.href = tr.dataset.href })
  sessionStorage.removeItem('fresh-order')
}
draw()
window.addEventListener('storage', () => { store.refresh(); draw() })
