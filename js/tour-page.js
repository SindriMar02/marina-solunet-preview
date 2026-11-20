import * as store from './store.js'
import { $, esc, isk, pct, storeShell, dayLabel, scrollReveal } from './ui.js'
import { mountPicker } from './picker.js'
import { galleryGrid, wireGallery } from './gallery.js'
// Every word and photo on the tour page comes from Marina's Bókun product data (ui/data/tours.json).
const FIX = [[/\bHofn\b/g, 'Höfn'], [/\bJokulsarlon\b/g, 'Jökulsárlón'], [/\bice bergs\b/g, 'icebergs'], [/\bReykjavik\b/g, 'Reykjavík'], [/Hornafjörður airport/g, 'Hornafjörður Airport']]
const clean = v => typeof v === 'string' ? FIX.reduce((x, [a, b]) => x.replace(a, b), v) : Array.isArray(v) ? v.map(clean) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'src' ? x : clean(x)])) : v
const DATA = clean(await fetch(new URL('../data/tours.json', import.meta.url)).then(r => r.ok ? r.json() : []).then(x => Array.isArray(x) ? x : []).catch(() => []))
storeShell('tours')
const P = new URLSearchParams(location.search), k = P.get('k'), l = k && store.link(k)
const seller = l && !l.revoked ? store.agent(l.agentId) : null
const active = seller && l.expires > new Date().toISOString() && seller.state === 'active'
const tourId = P.get('t') || l?.tourId

const stripFor = a => `<div class="seller"><span class="mark" aria-hidden="true">${esc(a.name[0])}</span>
  <p>Recommended by <b>${esc(a.name)}</b> · <span class="mt">${esc(a.sellerId)}</span><br><span class="meta">An independent seller with ${esc(store.storeBrand())}.</span></p></div>`
const directUrl = () => `s.html${tourId ? `?t=${encodeURIComponent(tourId)}` : ''}`
const sellerStrip = (credit = active ? seller : null) => credit ? stripFor(credit)
  : l ? `<div class="notice"><p>This seller link is no longer active. <a class="linkbtn" href="${directUrl()}">Book directly with Marina Travel</a></p></div>`
  : k ? `<div class="notice"><p>We could not find the seller for this link in this browser. <a class="linkbtn" href="${directUrl()}">Book directly with Marina Travel</a></p></div>` : ''

if (!tourId) {
  const open = store.TOURS.filter(t => store.offer(t.id)?.status === 'active' && !store.agentOffer(t, active ? seller : null).error)
  $('#main').innerHTML = `<div class="wrap"><p class="eyebrow">${esc(store.storeBrand())} · by Marina Travel</p><h1 class="h-page" style="margin:10px 0 16px">Choose a tour</h1>${sellerStrip()}
    ${open.length ? '' : '<p class="notice" style="margin-top:24px">No tours are open for booking right now. Please check back soon.</p>'}
    <div class="cards" style="margin-top:24px">${open.map(t => `<a class="card" href="s.html?${k ? `k=${esc(k)}&` : ''}t=${t.id}"><div class="ph"><img src="${t.img.replace('../', '')}" alt=""></div>
    <h2 class="h-task">${esc(t.title)}</h2><p class="meta">${esc(t.place)} · ${esc(t.duration)}</p><p><span class="money">${isk(store.priceOf(t))}</span> <span class="meta">${esc(t.unit)}</span></p></a>`).join('')}</div></div>`
} else page(store.tour(tourId))

function page(t) {
  if (!t || store.offer(t.id)?.status !== 'active') {
    $('#main').innerHTML = '<div class="wrap"><h1 class="h-page">This tour is not open for booking</h1><p class="notice" style="margin-top:16px">It may be out of season or paused.</p><a class="linkbtn" href="shop.html">See available tours</a></div>'
    return
  }
  const d = DATA.find(x => x.activityId === t.activityId) || null
  document.title = `${d?.shortTitle || t.title} · ${store.storeBrand()}`
  const photos = d?.photos?.length ? d.photos : [{ src: t.img.replace('../', ''), alt: t.title }]
  const para = x => { const [body, ...bullets] = x.split('\n• ')
    const kind = /^Disclaimer:/.test(body) ? ' class="meta"' : ''
    return `<p${kind}>${esc(body.replace(/^Disclaimer:\s*/, ''))}</p>${bullets.length ? `<ul class="tour-list">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}` }
  const list = (items, cls = '') => items?.length ? `<ul class="tour-list ${cls}">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''
  const sec = (id, title, html) => html ? `<section class="tour-sec" aria-labelledby="${id}" data-reveal><h2 class="tour-h2" id="${id}">${title}</h2>${html}</section>` : ''
  const cancelText = c => {
    if (!c?.rules?.length) return t.cancellation ? `<p class="dim">${esc(t.cancellation)}</p>` : ''
    const r = [...c.rules].sort((a, b) => b.cutoffHours - a.cutoffHours)
    const fromBooking = r[0].cutoffHours >= 24 * 365
    const bands = r.map((x, n) => { const inner = r[n + 1]
      const when = n === 0 && fromBooking ? (inner ? `From booking until ${inner.cutoffHours} hours before the tour` : 'From booking')
        : inner ? `From ${x.cutoffHours} until ${inner.cutoffHours} hours before the tour` : `Within ${x.cutoffHours} hours of the start`
      return `<li>${when}: ${Number(x.chargePercent)}% of the price is charged.</li>` }).join('')
    return `${fromBooking ? '' : `<p class="dim">Free cancellation up to ${r[0].cutoffHours} hours before the tour starts.</p>`}
      <ul class="tour-list">${bands}</ul>
      <p class="meta held-note">You pay Marina Travel through Teya. Any refund under the cancellation terms goes back to the card you paid with. If Marina Travel cancels, for example because of weather, you can choose a full refund or a new date.</p>`
  }
  const chips = [d?.durationText || t.duration, d?.meeting?.title ? `Starts at ${d.meeting.title}` : t.meeting,
    (d?.maxPerBooking || t.max) ? `Up to ${d?.maxPerBooking || t.max} guests per booking` : null,
    d?.languages?.length ? `Guide: ${d.languages.join(', ')}` : null, d?.difficulty ? `${d.difficulty[0]}${d.difficulty.slice(1).toLowerCase()} difficulty` : null,
    `Age ${d?.minAge ?? t.age}+`].filter(Boolean)
  const map = d?.meeting?.lat != null ? `https://www.google.com/maps/search/?api=1&query=${d.meeting.lat},${d.meeting.lng}` : null
  $('#main').innerHTML = `
    <div class="wrap tour-wrap">
      <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="shop.html">${esc(store.storeBrand())}</a><span aria-hidden="true">/</span><span>${esc(t.season || t.place)}</span></nav>
      <header class="tour-head">
        <h1 class="tour-title reveal d1">${esc(d?.shortTitle || t.title)}</h1>
        <p class="tour-sub reveal d1">${esc(d?.excerpt || t.place)}</p>
        <p class="meta reveal d1">Run by ${esc(store.supplier(t.supplierId).name)} · licensed Icelandic travel agency</p>
        <ul class="tour-chips reveal d2">${chips.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        <div class="tour-decide reveal d2"><p class="p-price"><b class="money">${isk(store.priceOf(t))}</b> <span>${esc(t.unit)}</span></p>
          <a class="btn primary" href="#choose">Choose a date</a>
          <p class="meta">Example price · the price per person depends on your group size.</p></div>
      </header>
      <div class="reveal d2" id="gallery">${galleryGrid(photos, d?.shortTitle || t.title)}</div>
      <div class="grid2 tour-grid">
        <div class="tour-body">
          <div id="sellerstrip">${sellerStrip()}</div>
          ${sec('about', 'About this tour', d?.description?.length ? d.description.map(para).join('') : (t.blurb ? `<p>${esc(t.blurb)}</p>` : ''))}
          ${sec('day', 'Your day', d?.itinerary?.length ? `<ol class="tour-steps">${d.itinerary.map(x => `<li><b>${esc(x.title)}</b>${x.body ? `<span class="dim">${esc(x.body)}</span>` : ''}</li>`).join('')}</ol>` : '')}
          ${d?.included?.length || d?.excluded?.length ? `<div class="tour-two" data-reveal>
            ${d.included?.length ? `<section aria-labelledby="inc"><h2 class="tour-h2" id="inc">Included</h2>${list(d.included, 'yes')}</section>` : ''}
            ${d.excluded?.length ? `<section aria-labelledby="exc"><h2 class="tour-h2" id="exc">Not included</h2>${list(d.excluded, 'no')}</section>` : ''}</div>` : ''}
          ${sec('bring', 'What to bring', list(d?.bring))}
          ${sec('know', 'Good to know', list(d?.goodToKnow))}
          ${sec('meet', 'Where it starts', d?.meeting ? `<p><b>${esc(d.meeting.title)}</b><br><span class="dim">${esc(d.meeting.address || '')}</span></p>${map ? `<a class="linkbtn" href="${map}" target="_blank" rel="noopener">Open in Google Maps</a>` : ''}` : `<p>${esc(t.meeting)}</p>`)}
          ${sec('cancel', 'Cancellation', cancelText(d?.cancellation))}
          <section class="tour-sec" aria-labelledby="choose"><h2 class="tour-h2" id="choose">Choose your departure</h2>
            <div id="picker" style="display:grid;gap:24px"></div></section>
        </div>
        <aside class="sticky"><div class="panel" id="pay" tabindex="-1"></div></aside>
      </div>
    </div>
    <div class="tour-bar gone" id="tourbar"><span><span class="meta">Example</span> <b class="money">${isk(store.priceOf(t))}</b> <span class="meta">${esc(t.unit)}</span></span><a class="btn primary" href="#choose">See dates</a></div>`
  wireGallery($('#gallery'), photos, d?.shortTitle || t.title)
  const bar = $('#tourbar'); document.body.classList.add('has-bar')
  if ('IntersectionObserver' in window) {
    const seen = new Set()
    const io = new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)); bar.classList.toggle('gone', seen.size > 0) })
    ;[$('#choose'), $('#pay'), $('#picker'), document.querySelector('.tour-head')].forEach(n => n && io.observe(n))
  }
  scrollReveal()
  const asked = P.get('d'), known = store.departures(t.id).some(x => x.date === asked)
  const sel = { date: known ? asked : t.defaultDate || store.departures(t.id)[0].date, startTimeId: P.get('s') ? Number(P.get('s')) : null, pax: Number(P.get('p')) || t.min }
  let code = (P.get('c') || '').trim(), error = '', shown = null, confirmChange = false
  const picker = mountPicker($('#picker'), t.id, sel, () => { confirmChange = false; draw() })
  // One request key per checkout intent (selection + seller + code), kept through the hand-off like the real API.
  const intent = () => `rk-${t.id}-${k}-${sel.date}-${sel.startTimeId}-${sel.pax}-${code.toUpperCase()}`
  const keyFor = (fresh = false) => { let v = !fresh && sessionStorage.getItem(intent()); if (!v) { v = 'rk_' + crypto.randomUUID().replace(/-/g, ''); sessionStorage.setItem(intent(), v) } return v }
  const view = () => store.preview({ tourId: t.id, date: sel.date, startTimeId: sel.startTimeId, pax: sel.pax, refKey: k, code })
  function draw() {
    const st = picker.state(), p = view(), l2 = p.line
    const codeBad = p.error === 'code_invalid'
    shown = { total: l2?.customerGrossMinor, seller: p.credit ? p.credit.sellerId : null }
    const strip = $('#sellerstrip'); if (strip) strip.innerHTML = sellerStrip(p.credit && !codeBad ? p.credit : (active ? seller : null))
    $('#pay').innerHTML = `
      <p class="eyebrow">Your booking</p>
      ${st.departure ? `<p class="h-task">${esc(dayLabel(sel.date))} · ${esc(st.departure.time)} Iceland · ${sel.pax} guest${sel.pax === 1 ? "" : "s"}</p>` : '<p class="h-task">Choose a departure time</p>'}
      ${l2 ? `<div class="price">
        <div class="line"><span>${sel.pax} × ${isk(store.priceOf(t))} ${esc(t.unit)}</span><span>${isk(l2.listGrossMinor)}</span></div>
        ${l2.discountGrossMinor ? `<div class="line save"><span>Discount from ${esc(p.credit.name)} (${pct(l2.discountBps)})</span><span>${isk(-l2.discountGrossMinor)}</span></div>` : ''}
        <div class="total"><span>You pay</span><b class="money">${isk(l2.customerGrossMinor)}</b></div>
      </div>` : ''}
      ${d?.included?.length ? `<p class="meta">Included: ${esc(d.included.filter(x => !/^Local taxes$/i.test(x)).map(x => x.replace(/\.$/, '')).join(' · '))}</p>` : ''}
      <p class="meta">${esc(store.bookingParties(t.id, codeBad ? null : p.credit))}</p>
      <details ${code ? 'open' : ''}><summary class="meta" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Have a seller code?</summary>
        <div class="field" style="margin-top:8px"><label for="code">Seller code, e.g. SN-00004</label>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px"><input class="input" id="code" value="${esc(code)}" autocomplete="off" spellcheck="false" ${codeBad ? 'aria-invalid="true" aria-describedby="codeerr"' : ''}><button class="btn" id="apply">Apply</button></div>
        ${codeBad ? `<p class="hint err" id="codeerr" role="alert">"${esc(code)}" is not an active seller code. Correct it or <button class="linkbtn" id="rmcode">remove it</button> to continue.</p>` : ''}</div></details>
      ${!error && store.saleError(p.error) ? `<p class="notice" role="status">${esc(store.saleError(p.error))}</p>` : ''}
      ${error ? `<div class="notice ${confirmChange ? '' : 'err'}" role="alert">${error}</div>` : ''}
      <button class="btn primary full" id="go" ${st.ok && !p.error ? '' : 'disabled'}>${confirmChange ? 'Confirm and continue' : t.capacity === 'ON_REQUEST' ? 'Send booking request' : `Pay ${l2 ? isk(l2.customerGrossMinor) : 'total'}`}</button>
      <p class="meta">${t.capacity === 'ON_REQUEST' ? `On request: ${esc(store.supplier(t.supplierId).name)} confirms the booking before payment.` : 'You pay Marina Travel on its secure Bókun checkout.'}</p>
      <p class="meta held-note">You pay Marina Travel through Teya. Any refund under the cancellation terms goes back to the card you paid with. If Marina Travel cancels, for example because of weather, you can choose a full refund or a new date.</p>
      ${d?.cancellation?.rules?.length ? `<p class="meta">${Math.max(...d.cancellation.rules.map(r => r.cutoffHours)) >= 24 * 365 ? 'A cancellation charge applies from booking.' : `Free cancellation up to ${Math.max(...d.cancellation.rules.map(r => r.cutoffHours))} hours before the tour.`} <a class="linkbtn" href="#cancel">Cancellation terms</a></p>` : store.offerTerms(t.id) ? `<p class="meta">Cancellation: ${esc(store.offerTerms(t.id).cancellation)}</p>` : ''}
      <p class="proto">Demo departures. Nothing is charged. On the live site Bókun prices your exact group size; this tour's price per person changes with the number of guests.</p>`
    $('#apply').onclick = () => { code = $('#code').value.trim(); error = ''; confirmChange = false; draw(); (view().error === 'code_invalid' ? $('#code') : $('#apply')).focus() }
    const rm = $('#rmcode'); if (rm) rm.onclick = () => { code = ''; error = ''; draw(); $('#code').focus() }
    $('#go').onclick = go
  }
  function go() {
    // Never charge a total or credit a seller the guest did not see: re-read, and ask again if anything moved.
    const before = { ...shown }
    store.refresh(); const now = view()
    if (!now.line) { draw(); return }
    if (now.line.customerGrossMinor !== before.total || (now.credit ? now.credit.sellerId : null) !== before.seller) {
      draw(); confirmChange = true
      error = `Something changed since you looked: the total is now <b class="money">${isk(now.line.customerGrossMinor)}</b>${(now.credit ? now.credit.sellerId : null) !== before.seller ? ' and the credited seller changed' : ''}. Check it and press Confirm to continue.`
      draw(); $('#go').focus(); return
    }
    let r = store.checkout({ tourId: t.id, date: sel.date, startTimeId: sel.startTimeId, pax: sel.pax, refKey: k, code, requestKey: keyFor() })
    if (r.replay && ['failed', 'cancelled', 'exception'].includes(r.state)) r = store.checkout({ tourId: t.id, date: sel.date, startTimeId: sel.startTimeId, pax: sel.pax, refKey: k, code, requestKey: keyFor(true) })
    if (r.error) { confirmChange = false; error = esc({ code_invalid: `"${code}" is not an active seller code.`, no_seats: 'Those seats were just taken. Choose another departure.', party_size_not_allowed: `This tour takes ${t.min} to ${t.max} guests per booking.` }[r.error] || r.error); draw(); return }
    if (r.total !== now.line.customerGrossMinor) { confirmChange = true; error = `The total changed to <b class="money">${isk(r.total)}</b>. Check it and press Confirm to continue.`; draw(); $('#go').focus(); return }
    location.href = r.checkoutUrl || `r.html?o=${r.orderId}`
  }
  window.addEventListener('storage', () => { store.refresh(); picker.render(); draw() })
  draw()
}
