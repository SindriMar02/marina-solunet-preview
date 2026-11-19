import * as store from './store.js'
import { $, esc, isk, pct, agentShell, dayLabel, stamp, viewerTime, copy, qrSvg, statusTag } from './ui.js'
agentShell('sell', 'Quote')
const P = new URLSearchParams(location.search)

if (P.get('q')) view(store.quote(P.get('q'))); else build()

function build() {
  const t = store.tour(P.get('t')), date = P.get('d'), startTimeId = Number(P.get('s')), pax = Number(P.get('p'))
  const dep = t && store.departure(t.id, date, startTimeId)
  if (!t || !dep) { $('#main').innerHTML = '<p class="notice err">This departure is no longer available. <a href="sell.html">Back to tours</a></p>'; return }
  const policy = store.agentOffer(t)
  if (policy.error) { $('#main').textContent = store.saleError(policy.error); return }
  const cap = Math.min(policy.cap, store.me().discountBps)
  let disc = cap
  const discounts = [...new Set([0, 100, 200, 300, 400, 500].filter(n => n <= cap).concat(cap))]
  const draw = () => {
    const l = store.quoteLine(t, pax, store.me(), disc)
    $('#main').innerHTML = `
      <a class="linkbtn" href="tour.html?t=${t.id}">← ${esc(t.title)}</a>
      <p class="eyebrow" style="margin-top:16px">New quote</p>
      <h1 class="h-page" style="margin:10px 0 6px">${esc(dayLabel(date))} · ${esc(dep.time)} Iceland</h1>
      <p class="dim">${esc(t.title)} · ${pax} guests${viewerTime(date, dep.time) ? ` · ${esc(viewerTime(date, dep.time))}` : ''}</p>
      <form id="f" style="margin-top:28px" novalidate>
        <div class="field"><span class="label" id="dl">Guest discount</span>
          <div class="seg" role="group" aria-labelledby="dl">${discounts.map(b => `<button type="button" data-b="${b}" aria-pressed="${b === disc}">${pct(b)}</button>`).join('')}</div></div>
        <div class="panel">
          <div class="price">
            <div class="line"><span>List price, ${pax} × ${isk(store.priceOf(t))}</span><span>${isk(l.listGrossMinor)}</span></div>
            <div class="line save"><span>Discount (${pct(l.discountBps)})</span><span>${isk(-l.discountGrossMinor)}</span></div>
            <div class="total"><span>Customer pays</span><b class="money">${isk(l.customerGrossMinor)}</b></div>
            <div class="line"><span>Your estimated commission · ${l.ruleKind === 'share_of_margin' ? `${pct(l.commissionBps)} of ${isk(l.marginMinor)} margin, less the net discount` : `${pct(l.agentRateBps)} of ${isk(l.listNetMinor)} before VAT`}</span><span class="money">${isk(l.agentAmountMinor)}</span></div>
          </div>
        </div>
        <div class="field"><label for="cn">Customer name</label><input class="input" id="cn" autocomplete="off" required aria-describedby="cnerr"><p class="hint err" id="cnerr" role="alert"></p></div>
        <div class="field"><label for="ce">Customer email (optional)</label><input class="input" id="ce" type="email" autocomplete="off"></div>
        <p class="meta">The customer can use this quote for 24 hours. Price and seats are checked again when they pay; a quote does not hold seats.</p>
        <p class="hint err" id="quote-error" role="alert"></p>
        <button class="btn primary full" type="submit">Create quote</button>
      </form>`
    document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { disc = Number(b.dataset.b); const n = $('#cn').value, e = $('#ce').value; draw(); $('#cn').value = n; $('#ce').value = e })
    $('#f').onsubmit = e => { e.preventDefault(); const name = $('#cn').value.trim()
      if (!name) { $('#cn').setAttribute('aria-invalid', 'true'); $('#cnerr').textContent = 'Add the customer\'s name so they recognise the quote.'; $('#cn').focus(); return }
      try { const q = store.createQuote({ tourId: t.id, date, startTimeId, pax, customer: name, email: $('#ce').value.trim(), discountBps: disc }); location.replace(`quote.html?q=${q.id}`) }
      catch (err) { $('#quote-error').textContent = store.saleError(err.message) || 'This departure could not be quoted.' } }
  }
  draw()
}

async function view(q) {
  if (!q) { $('#main').innerHTML = '<p class="notice err">Quote not found. <a href="sell.html">Back</a></p>'; return }
  const t = store.tour(q.tourId), o = q.orderId && store.orderById(q.orderId)
  const url = new URL(`../q.html?k=${q.k}`, location.href).href
  const st = o ? o.state : q.expires < new Date().toISOString() ? 'expired' : q.opened ? 'opened' : 'sent'
  $('#main').innerHTML = `
    <a class="linkbtn" href="sell.html">← Sell</a>
    <p class="eyebrow" style="margin-top:16px">Quote for ${esc(q.customer)}</p>
    <h1 class="h-page" style="margin:10px 0 6px">${esc(dayLabel(q.date))} · ${esc(q.time)} Iceland</h1>
    <p class="dim">${esc(t.title)} · ${q.pax} guests · valid until ${esc(stamp(q.expires))} UTC</p>
    <div class="panel" style="margin-top:24px">
      <div class="price">
        <div class="total"><span>Customer pays</span><b class="money">${isk(q.totalMinor)}</b></div>
        <div class="line"><span>You earn when it is paid</span><span class="money">${isk(q.agentAmountMinor)}</span></div>
        <div class="line"><span>Status</span><span>${o ? statusTag(o.state) : `<span class="status pending">${esc({ sent: 'Sent', opened: 'Opened by the customer', expired: 'Expired' }[st])}</span>`}</span></div>
      </div>
    </div>
    <h2 class="h-task" style="margin:32px 0 12px">Send it</h2>
    <div class="qr" id="qr"></div>
    <p class="url" style="margin:12px 0 16px">${esc(url)}</p>
    <div style="display:grid;gap:12px">
      <button class="btn primary full" id="cp">Copy quote link</button>
      ${navigator.share ? '<button class="btn full" id="ns">Share…</button>' : ''}
      <a class="btn full" href="${esc(url)}" target="_blank" rel="noopener">Open as the customer (new tab)</a>
      <p class="proto">Same-browser demo: open it as the customer here; a QR scanned on another phone has no data.</p>
    </div>`
  $('#cp').onclick = () => copy(url, 'Quote link copied')
  const ns = $('#ns'); if (ns) ns.onclick = () => navigator.share({ title: `${t.title} for ${q.customer}`, url }).catch(() => {})
  $('#qr').innerHTML = await qrSvg(url)
}
