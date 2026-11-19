import * as store from './store.js'
import { $, esc, isk, pct, agentShell, dayLabel, sheet, copy, qrSvg } from './ui.js'
import { mountPicker } from './picker.js'
const params = new URLSearchParams(location.search)
const t = store.tour(params.get('t') || 'eastfjords')
agentShell('sell', 'Sell')
if (!t || store.agentOffer(t).error) {
  $('#main').innerHTML = `<p class="notice">${esc(t ? store.saleError(store.agentOffer(t).error) : 'Tour unavailable.')}</p><a class="linkbtn" href="sell.html">Back to tours</a>`
} else showTour()

function showTour() {
  document.title = `${t.title} · Sell`
  $('#place').textContent = `Run by ${store.supplier(t.supplierId).name} · ${t.place}`
  $('#title').textContent = t.title
  $('#facts').innerHTML = [['Duration', t.duration], ['Meeting', t.meeting], ['Guests per booking', t.min === t.max ? `${t.min}` : `${t.min} to ${t.max}`], ['Ages', `${t.age} and over`]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')

  const guided = params.get('demo') === 'anna' && t.id === 'eastfjords'
  const proposed = params.get('d')
  const chosen = store.departures(t.id).find(day => day.date === proposed)
  const start = chosen?.starts.find(item => item.startTimeId === Number(params.get('s')))
  const pax = Number(params.get('p'))
  const sel = { date: chosen?.date || t.defaultDate, startTimeId: start?.startTimeId || (guided ? 5263195 : null),
    pax: Number.isInteger(pax) && pax >= t.min && pax <= t.max ? pax : t.min }
  if (guided) {
    const bridge = document.createElement('a')
    bridge.className = 'linkbtn'
    bridge.href = '../index.html#demo-story'
    bridge.textContent = 'Return to Anna’s walkthrough'
    document.querySelector('main').append(bridge)
  }
  const picker = mountPicker($('#picker'), t.id, sel, () => summary())

  function summary() {
    const st = picker.state(), a = store.me()
    const p = store.preview({ tourId: t.id, date: sel.date, startTimeId: sel.startTimeId, pax: sel.pax, code: a.sellerId })
    const l = p.line
    if (!l) {
      $('#summary').textContent = store.saleError(p.error) || 'This tour is unavailable.'
      return
    }
    $('#summary').innerHTML = `
      <p class="eyebrow">Your sale</p>
      ${st.departure ? `<p class="h-task">${esc(dayLabel(sel.date))} · ${esc(st.departure.time)} Iceland · ${sel.pax} guests</p>` : '<p class="h-task">Choose a departure</p>'}
      <div class="price">
        <div class="line"><span>List price</span><span>${isk(l.listGrossMinor)}</span></div>
        <div class="line save"><span>Your discount to the customer (${pct(l.discountBps)})</span><span>${isk(-l.discountGrossMinor)}</span></div>
        <div class="total"><span>Customer pays</span><b class="money">${isk(l.customerGrossMinor)}</b></div>
        <div class="line"><span>${l.ruleKind === 'share_of_margin' ? `Your estimated commission (${pct(l.commissionBps)} of ${isk(l.marginMinor)} margin, less the net discount)` : `Your estimated commission (${pct(l.commissionBps)} − ${pct(l.discountBps)} = ${pct(l.agentRateBps)} of ${isk(l.listNetMinor)} before VAT)` }</span><span class="money">${isk(l.agentAmountMinor)}</span></div>
      </div>
      ${st.ok ? '' : `<p class="hint warn">${esc(errText(st.error))}</p>`}
      <div class="actions" style="display:grid;gap:12px">
        <button class="btn primary full" id="quote" ${st.ok ? '' : 'disabled'}>Make a quote for a customer</button>
        <button class="btn full" id="share">Share this tour (link or QR)</button>
      </div>
      <p class="meta">Share: the customer gets your link and chooses the date and party themselves. Quote: you send this exact departure and party; the customer can use it for 24 hours, and price and seats are checked again when they pay.</p>`
    $('#quote').onclick = () => { if (!st.ok) return; location.href = `quote.html?t=${t.id}&d=${sel.date}&s=${sel.startTimeId}&p=${sel.pax}` }
    $('#share').onclick = e => share(e.currentTarget, e.detail === 0)
  }
  function errText(e) { return { choose_departure: 'Choose a departure time first.', party_size_not_allowed: `This tour takes ${t.min}–${t.max} guests per booking.`, no_seats: 'Not enough seats on that departure.' }[e] || e }

  async function share(opener, viaKey) {
    const k = store.createLink(t.id, 'link')
    const selected = new URLSearchParams({ k })
    if (picker.state().ok) {
      selected.set('d', sel.date)
      selected.set('s', sel.startTimeId)
      selected.set('p', sel.pax)
    }
    const url = new URL(`../s.html?${selected}`, location.href).href
    sheet({ title: 'Share this tour', opener, viaKey, body: `
        <div style="display:grid;gap:16px">
          <div class="qr" id="qr" aria-label="QR code for your link"></div>
          <p class="url" id="url">${esc(url)}</p>
          <button class="btn primary full" id="cp">Copy link</button>
          ${navigator.share ? '<button class="btn full" id="ns">Share…</button>' : ''}
          <a class="btn full" href="${esc(url)}" target="_blank" rel="noopener">Open as your customer (new tab)</a>
          <p class="meta">This link credits ${esc(store.me().sellerId)} for this tour for 12 months. Customers see that you are an independent seller for Marina Travel.</p>
          <p class="proto">Same-browser demo: open it as the customer here; a QR scanned on another phone has no data.</p>
        </div>`,
      onOpen: async el => {
        el.querySelector('#cp').onclick = () => copy(url, 'Link copied')
        const ns = el.querySelector('#ns'); if (ns) ns.onclick = () => navigator.share({ title: t.title, url }).catch(() => {})
        el.querySelector('#qr').innerHTML = await qrSvg(url)
      } })
  }
  summary()
  window.addEventListener('storage', () => { store.refresh(); picker.render(); summary() })
}
