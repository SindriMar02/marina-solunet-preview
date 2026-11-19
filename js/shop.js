// Guest home · premium pass 19 Nov 2026. References (design-refs/REFS.md): Moke Valley (one subject owns the first
// screen), Good Roads (title + one fact row, a tour card beside the story, one large photo per stop), Pioneer
// Expeditions (price with its unit and limits), Kaer (slim phone decision bar). Tour copy is Bókun's (data/tours.json).
import * as store from './store.js'
import { $, esc, isk, storeShell, scrollReveal } from './ui.js'

storeShell('tours')
const brand = store.storeBrand()
document.title = `${brand} · Blue ice cave tours in Iceland`
const ice = store.tour('icecave'), east = store.tour('eastfjords')
const DATA = await fetch(new URL('../data/tours.json', import.meta.url)).then(r => r.ok ? r.json() : []).then(x => Array.isArray(x) ? x : []).catch(() => [])
const fix = v => String(v || '').replace(/\bHofn\b/g, 'Höfn').replace(/\bJokulsarlon\b/g, 'Jökulsárlón').replace(/\bice bergs\b/g, 'icebergs').replace(/\bVok\b/g, 'Vök')
const info = t => DATA.find(x => x.activityId === t.activityId)
const d = info(ice), e = info(east)
const open = store.offer(ice.id)?.status === 'active' && !store.agentOffer(ice, null).error
const photo = n => d?.photos?.[n - 1] || null
const book = `s.html?t=${ice.id}#choose`

const ICON = {
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  group: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.8 14.6c2.2.2 3.9 1.6 4.4 4.4"/>',
  pin: '<path d="M12 21s-6.5-6.1-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  season: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5"/>',
}
const ic = n => `<svg viewBox="0 0 24 24" aria-hidden="true" class="ic">${ICON[n]}</svg>`

// The day, in Bókun's own order: airport → Diamond Beach → Jökulsárlón → ice cave → airport.
const steps = (d?.itinerary || []).map(s => ({ title: fix(s.title), body: fix(s.body) }))
const STOP_PHOTO = { 'Diamond Beach': 9, 'Jökulsárlón Glacier Lagoon': 8, 'Blue Ice Cave tour': 6 }
const stops = steps.filter(s => STOP_PHOTO[s.title])
const routeName = s => s.title.replace(/^Transfer from /, '').replace(/ to Jökulsárlón$/, '').replace(/^Return to /, '').replace(/ Glacier Lagoon$/, '').replace(/ tour$/, '')
const facts = [['clock', d?.durationText || ice.duration], ['group', `Up to ${d?.maxPerBooking || ice.max} guests`], ['pin', `From ${fix(d?.meeting?.title || 'Hornafjörður Airport').replace('airport', 'Airport')}`], ['season', 'Until April']]
const included = (d?.included || []).map(x => fix(x).replace(/\.$/, '')).filter(x => !/^Local taxes$/i.test(x))

$('#main').innerHTML = `
  <section class="p-hero" aria-labelledby="hero-title">
    <picture class="p-hero-media">
      <img src="assets/img/shop/ice-cave-hero.jpg" alt="A guest in a pink jacket standing under the arched blue ceiling of an ice cave" fetchpriority="high">
    </picture>
    <div class="p-hero-copy site-well">
      <p class="eyebrow arrive a1">Vatnajökull · Iceland</p>
      <h1 id="hero-title" class="p-title arrive a2"><span>Inside the</span> <span>blue ice.</span></h1>
      <ul class="p-facts arrive a3">${facts.map(([i, t]) => `<li>${ic(i)}<span>${esc(t)}</span></li>`).join('')}</ul>
      <div class="actions arrive a4">
        ${open ? `<a class="btn primary" href="${book}">Choose a date</a>` : ''}
        <a class="btn" href="#day">See the day</a>
      </div>
    </div>
  </section>

  <section class="p-day" id="day" aria-labelledby="day-title">
    <div class="site-well">
      <header class="p-head" data-reveal>
        <p class="eyebrow">One day, three places</p>
        <h2 id="day-title" class="p-h2">Ice cave, glacier lagoon and Diamond Beach.</h2>
        <p class="dim p-lede">${esc(fix(d?.description?.[0] || ice.blurb).split(/(?<=\.)\s+/).slice(0, 2).join(' '))}</p>
      </header>
      <ol class="p-route" id="route" aria-label="The route">
        ${steps.map((s, n) => `<li><span class="dot" aria-hidden="true"></span><span class="name">${esc(routeName(s))}</span></li>`).join('')}
      </ol>
    </div>
    <div class="p-stops">
      ${stops.map((s, n) => { const p = photo(STOP_PHOTO[s.title])
        return `<article class="p-stop ${n % 2 ? 'flip' : ''}">
          <figure class="p-stop-media" data-mask>${p ? `<img src="${esc(p.src)}" alt="${esc(p.alt)}" width="${p.w}" height="${p.h}" loading="lazy">` : ''}</figure>
          <div class="p-stop-copy" data-reveal><p class="eyebrow">Stop ${n + 1} of ${stops.length}</p><h3 class="p-h3">${esc(routeName(s))}</h3><p class="dim">${esc(s.body)}</p></div>
        </article>` }).join('')}
    </div>
  </section>

  <section class="p-book" id="book" aria-labelledby="book-title">
    <div class="site-well p-book-grid">
      <figure class="p-book-media" data-mask>${photo(1) ? `<img src="${esc(photo(1).src)}" alt="${esc(photo(1).alt)}" loading="lazy">` : ''}</figure>
      <div class="p-card" data-reveal>
        <p class="eyebrow">${esc(ice.season)}</p>
        <h2 id="book-title" class="p-h2 small">${esc(fix(d?.shortTitle) || ice.title)}</h2>
        <p class="p-price"><b class="money">${isk(store.priceOf(ice))}</b> <span>per person</span></p>
        <p class="meta">Example price. The price per person depends on the size of your group; you see the exact total before you pay.</p>
        <ul class="p-facts stacked">${facts.map(([i, t]) => `<li>${ic(i)}<span>${esc(t)}</span></li>`).join('')}</ul>
        ${included.length ? `<div class="p-inc"><p class="eyebrow">Included</p><ul class="tour-list yes">${included.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${open ? `<a class="btn primary full" href="${book}">Choose a date</a>` : '<p class="notice">Bookings are paused for now.</p>'}
        <p class="meta">On request: Marina Travel confirms your date by email before you pay. Free cancellation up to 48 hours before the tour.</p>
        <p class="proto">Prototype · One of Marina's three ice cave tours; Einar picks the pilot tour.</p>
      </div>
    </div>
  </section>

  <div class="site-well">
    <section class="shop-section shop-how" id="how" aria-labelledby="how-title">
      <header class="shop-head" data-reveal><p class="eyebrow">How booking works</p><h2 id="how-title" class="shop-h2">Your money waits for your tour.</h2>
        <p class="dim shop-sub">Send a booking request for your date. Marina Travel confirms it, then you pay by card. The payment is held until the day of your tour, and any refund under the tour's cancellation terms goes back to your card.</p></header>
      <ol class="money-path" id="path">
        <li><span class="dot"></span><b>Request, then pay</b><span class="meta">Pick a date and send a request. Marina Travel confirms it by email, then you pay securely by card.</span></li>
        <li><span class="dot"></span><b>Held until your tour</b><span class="meta">Teya, the Icelandic payment company, holds the money. Marina Travel is not paid yet.</span></li>
        <li><span class="dot"></span><b>Your tour day</b><span class="meta">Meet your guide. After the tour, the payment goes to Marina Travel.</span></li>
      </ol>
      <p class="proto">Prototype · The hold is planned with Teya; its exact terms are being confirmed.</p>
    </section>

    <a class="p-next" href="s.html?t=${east.id}" data-reveal>
      <img src="${esc(e?.photos?.[0]?.src || east.img.replace('../', ''))}" alt="" loading="lazy">
      <span><span class="eyebrow">Summer 2027 · shore excursion</span><b>${esc(east.title)}</b><span class="meta">${esc(fix(e?.excerpt))}</span></span>
      <span class="p-next-go" aria-hidden="true">→</span>
    </a>

    <section class="shop-section shop-sell" aria-labelledby="sell-title" data-reveal>
      <img src="assets/img/shop/diamond-beach.jpg" alt="Ice blocks on the black sand of Diamond Beach" loading="lazy">
      <div><p class="eyebrow">Sell with us</p><h2 id="sell-title" class="shop-h2">Know travellers heading to Iceland?</h2>
        <p class="dim">Share your own link, QR code or quote. When your guest pays and the tour runs, you earn up to 17% of the tour price before VAT. You never handle the guest's money.</p>
        <div class="actions"><a class="btn primary" href="become.html?src=site">Become a seller</a><a class="btn" href="how.html">How the network works</a></div></div>
    </section>
  </div>

  ${open ? `<div class="tour-bar gone" id="homebar"><span><span class="meta">Example</span> <b class="money">${isk(store.priceOf(ice))}</b> <span class="meta">per person</span></span><a class="btn primary" href="${book}">Choose a date</a></div>` : ''}`

// One signature per page section, all once and calm: the route line draws, stop photos unmask, the money path draws.
const once = (el, cls, margin = '-18%') => {
  if (!el) return
  if (!('IntersectionObserver' in window)) { el.classList.add(cls); return }
  const io = new IntersectionObserver(([x]) => { if (x.isIntersecting) { el.classList.add(cls); io.disconnect() } }, { rootMargin: `0px 0px ${margin} 0px` })
  io.observe(el)
}
document.documentElement.classList.add('js-mask') // masks apply only once JS runs: no JS = photos fully visible
once($('#route'), 'drawn'); once($('#path'), 'drawn')
document.querySelectorAll('[data-mask]').forEach(m => once(m, 'shown', '-10%'))

// Phone decision bar (Kaer): only after the hero's own action has left view, gone again over the booking card.
const bar = $('#homebar')
if (bar && 'IntersectionObserver' in window) {
  document.body.classList.add('has-bar')
  const seen = new Set()
  const io = new IntersectionObserver(es => { es.forEach(x => x.isIntersecting ? seen.add(x.target) : seen.delete(x.target)); bar.classList.toggle('gone', seen.size > 0) })
  ;[$('.p-hero'), $('#book'), document.querySelector('.store-footer')].forEach(n => n && io.observe(n))
}
scrollReveal()
