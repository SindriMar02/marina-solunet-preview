import * as store from './store.js'
import { $, $$, esc, isk, icon, qrSvg } from './ui.js'
import { journey, journeyUrl, pilotExample, refundPolicy, root, timeText } from './recruitment.js'
import { accordion, arrow, bindAccordion, funnelShell, revealSections, smoothMarketing, tourPhoto } from './funnel.js'

const campaign = journey()
const applyUrl = journeyUrl('apply', campaign)
funnelShell('become', { apply: applyUrl, landing: true })

const check = '<span class="check" aria-hidden="true">✓</span>'
const applyLink = () => `<a class="btn primary" data-intake-link href="${esc(applyUrl)}">Apply in 10 minutes ${arrow}</a>`
const pilot = [store.tour('icecave'), store.tour('eastfjords')]
const sampleLink = 's.html?t=icecave&c=MT-00001'
const sampleQr = '<div class="qr" data-example-qr><p class="meta">Example QR</p></div>'
const photoSizes = 'auto, (max-width: 680px) calc(100vw - 36px), (max-width: 1265px) 31vw, 393px'
const exampleCommission = store.priceLine({
  listGrossMinor: store.priceOf(pilot[0]) * 2, vatBps: pilot[0].vatBps,
  commissionBps: 1700, discountBps: 0, maxDiscountBps: 500,
}).agentAmountMinor
const row = (name, value) => `<div class="preview-row"><span>${name}</span><strong>${value}</strong></div>`
const tickRow = (name, value) => row(name, `${value ? value + ' ' : ''}${check}`)
const features = [
  ['Apply in 10 minutes', 'Tell Marina how you reach travellers and verify your email. A short test checks your sales judgment, product knowledge and customer communication. Marina reviews the applications that qualify.'],
  ['Your link, QR and quotes', 'Once approved, you get your own seller number, a personal link and a QR code. Use the seller hub to share the tour or prepare a quote for a group.'],
  ['Guests pay Marina directly', `Guests book through Bókun and pay Marina through Teya. Teya can hold the payment until tour day. ${refundPolicy}`],
  ['Every sale and krona on your phone', 'See paid bookings as they come in. Your monthly statement records sales, refunds and commission. Commission is payable after the tour has run.'],
]
const featureArts = [
  ['Application', 'About you', row('Full name', 'Anna') + row('Country', 'Iceland') + row('Languages', 'Icelandic, English') + tickRow('Email verified', '')],
  ['Seller tools', 'Ready to share', `<div class="feature-share">${sampleQr}<div><strong>Sample booking link</strong><a class="linkbtn" href="${esc(sampleLink)}"><code>${esc(sampleLink)}</code></a></div></div>` + row('Seller number', 'MT-00001')],
  ['Bókun checkout', 'Blue Ice Cave', `<p class="feature-example">${pilotExample}</p>` + row('Total for two guests', isk(store.priceOf(pilot[0]) * 2)) + row('Teya', '<span class="status">Payment held</span>')],
  ['Monthly statement', 'Anna · MT-00001', `<div class="preview-row"><span><time datetime="2026-12-12">12 Dec 2026</time><br>Blue Ice Cave · 2 guests</span><strong>${isk(exampleCommission)}<br><span class="status">After the tour</span></strong></div><p class="feature-example">${pilotExample}</p>`],
]
const featurePreview = ([label, title, body], className, inert = false) =>
  `<article class="preview-card ${className}" ${inert ? 'inert' : ''}><p class="preview-label">${label}</p><h3>${title}</h3>${body}</article>`
const faq = [
  ['When do I earn commission?', 'You earn commission only on paid tours that run and are not cancelled. Commission becomes payable after the tour date and is paid monthly, with a statement.'],
  ['How does the discount work?', 'You can give a guest up to 5% off. The discount comes out of your commission rate. A 5% discount brings a 17% rate down to 12% of the eligible list price before VAT.'],
  ['Who handles payment and cancellations?', `The guest pays Marina directly. Teya can hold the payment until the tour date. ${refundPolicy}`],
  ['What is the test like?', `The test has ${store.TEST_BANK.length} questions and a ${store.TEST_MINUTES}-minute time limit. It covers selling, the tour, customer communication, tourism basics and common situations. Qualifying applications go to Marina for review. If you need an accommodation, call Marina before starting.`],
  ['How long does review take?', 'Review time depends on application volume. If your application goes to review, your status page gives you a reply estimate. If approved, you’ll receive an invitation at your verified address.'],
  ['What do I need to start?', 'There’s no fee and no stock to buy. Tell us about your experience, the languages you sell in and how you reach travellers. You can work wherever you are based. Marina checks the markets and languages it can support in the pilot.'],
  ['Is this employment or guaranteed income?', 'You sell independently and choose when and how you work. You handle your own taxes. There is no guaranteed income.'],
]

root.innerHTML = `
  <section class="well hero" id="overview" aria-labelledby="opening">
    <div class="hero-copy">
      <p class="eyebrow">Marina Travel’s independent seller programme</p>
      <h1 id="opening">Sell Iceland. Earn up to 17% on every eligible tour you sell. <span>We’ll take care of the trip.</span></h1>
      <p>Connect travellers with tours from a licensed Icelandic agency based in Höfn. Marina runs the tours, takes payment and looks after your guests.</p>
      <div class="hero-actions actions">${applyLink()}<a class="btn" href="#how-it-works">See how it works</a></div>
      <p class="intake-note notice" id="intake-note" role="status" hidden></p>
    </div>
    <div class="hero-art" aria-label="Example seller dashboard">
      <div class="hero-cards" data-parallax>
        <div class="preview-card collage-sales">
          <div class="preview-label">Seller hub</div><p class="feature-example">${pilotExample}</p><h2>My sales</h2>
          ${row('Blue Ice Cave · 2 guests', isk(store.priceOf(pilot[0]) * 2))}
          ${row('Blue Ice Cave · 1 guest', isk(store.priceOf(pilot[0])))}
        </div>
        <div class="preview-card collage-seller">
          <p class="preview-label">Seller setup</p>
          <div class="preview-person"><span class="avatar" aria-hidden="true">A</span><div><h2>Anna</h2><p>MT-00001</p></div></div>
          ${tickRow('Application', '')}${tickRow('Test', '91/100')}${tickRow('Approved', '')}${tickRow('Link and QR ready', '')}
        </div>
        <div class="preview-card collage-qr">${sampleQr}</div>
      </div>
    </div>
  </section>
  <div class="well trust" aria-label="About Marina Travel">
    <span>Licensed Icelandic travel agency</span><span>4.7 from 114 TourRadar reviews</span><span>Booked on <strong>Bókun</strong></span><span>Payments by <strong>Teya</strong></span>
  </div>
  <div class="band">
    <dl class="well figures" data-reveal>
      <div><dt>Commission on eligible sales</dt><dd>17%</dd></div>
      <div><dt>Discount you can offer guests</dt><dd>Up to 5%</dd></div>
      <div><dt>To join the programme</dt><dd>0 kr</dd></div>
    </dl>
  </div>
  <section class="well section split features" id="how-it-works">
    <div data-reveal>
      <header class="section-head"><p class="eyebrow">How it works</p><h2>From application to first sale</h2></header>
      ${accordion(features.map(([title, copy], i) => [title, `<p>${copy}</p><div class="mobile-feature-art">${featurePreview(featureArts[i], 'mobile-feature-card')}</div>`]), { id: 'feature', single: true, active: 0 })}
      <a class="text-action" href="how.html">Explore how Sölunet works ${arrow}</a>
    </div>
    <div class="feature-art" data-reveal>
      ${featureArts.map((preview, i) => featurePreview(preview, i ? 'feature-card' : 'feature-card selected', Boolean(i))).join('')}
    </div>
  </section>
  <div class="band">
    <section class="well section">
      <header class="section-head" data-reveal><h2>Marina handles the rest</h2></header>
      <div class="columns" data-reveal>
        ${[
          ['sell', 'Tours, guides and vehicles', 'Marina sets the prices, manages seats in Bókun and runs the tour with local guides and its own vehicles.'],
          ['sales', 'Payments, refunds and guest support', 'Marina takes payment and handles refunds. The customer-service team in Romania supports travellers before their trip.'],
          ['library', 'Approved sales text and photos', 'Use Marina’s descriptions and tour photography in your own channels.'],
        ].map(([symbol, title, copy]) => `<article><div class="mini-icon">${icon(symbol)}</div><h3>${title}</h3><p>${copy}</p></article>`).join('')}
      </div>
    </section>
  </div>
  <section class="well section split calculator" id="earnings">
    <header class="section-head" data-reveal>
      <p class="eyebrow">Earnings calculator</p><h2>What could a month of sales earn?</h2>
      <p>Pick a tour and see how the number of guests and the discount you offer change your commission.</p>
      <p class="fine-print">Illustrative amounts in ISK, before your own taxes. Commission is calculated on the list price before illustrative 11% VAT. It applies only to paid tours that run and is paid after the tour date. No guaranteed income.</p>
    </header>
    <div class="calc-card" data-reveal>
      <div class="field"><label for="calc-tour">Tour</label><select id="calc-tour">${pilot.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select><p class="hint" id="calc-price"></p></div>
      <div class="range-field"><div><label for="calc-guests">Guests per month</label><output id="calc-guests-value" for="calc-guests"></output></div><input type="range" id="calc-guests" min="0" max="50" value="8"><div class="range-limits" aria-hidden="true"><span>0</span><span>50</span></div></div>
      <div class="range-field"><div><label for="calc-discount">Guest discount</label><output id="calc-discount-value" for="calc-discount"></output></div><input type="range" id="calc-discount" min="0" max="5" value="0"><div class="range-limits" aria-hidden="true"><span>0%</span><span>5%</span></div></div>
      <dl class="calc-results" aria-live="polite" aria-atomic="true">
        <div><dt>Commission per guest</dt><dd id="calc-per"></dd></div>
        <div><dt>Commission per month</dt><dd id="calc-total"></dd></div>
      </dl>
    </div>
  </section>
  <section class="well section" id="tours">
    <header class="section-head" data-reveal><p class="eyebrow">The tour programme</p><h2>Tours you’ll sell</h2><p>The winter pilot features an ice cave tour. Marina adds tours and grants access as the programme expands.</p></header>
    <div class="columns tour-grid" data-reveal>
      <article class="tour-card"><a href="s.html?t=icecave"><div>${tourPhoto('ice-cave-hero', 'A guide inside a blue glacier cave', photoSizes)}</div><span class="tour-copy"><small>${pilotExample}</small><strong>Blue Ice Cave ${arrow}</strong><span>Explore the ice below Vatnajökull with a local guide. The season runs through April.</span></span></a></article>
      <article class="tour-card"><a href="s.html?t=eastfjords"><div>${tourPhoto('seydisfjordur', 'The waterfront at Seyðisfjörður', photoSizes)}</div><span class="tour-copy"><small>Summer 2027</small><strong>Seyðisfjörður and the Eastfjords ${arrow}</strong><span>Day tours for cruise guests from the port.</span></span></a></article>
      <article class="tour-card"><div>${tourPhoto('glacier-walk', 'Travellers walking on a glacier in Iceland', photoSizes)}</div><div class="tour-copy"><small>After the pilot</small><h3>Partner tours</h3><p>Marina plans to add tours from other Icelandic operators as partner agreements are made.</p></div></article>
    </div>
  </section>
  <div class="band"><section class="well section">
    <header class="section-head" data-reveal><h2>What’s included</h2></header>
    <div class="columns inclusions" data-reveal>
      ${[
        ['What Marina provides', 'Tours, prices and availability', 'Bókun booking and Teya payment', 'Approved copy and photography', 'Guest support and tour operation'],
        ['What you do', 'Find travellers and answer initial questions', 'Use Marina’s approved sales materials', 'Share your personal link, QR or quote', 'Manage your own work and taxes'],
        ['What you get', 'A unique seller number', 'A hub for tours, tools and sales', 'Up to 17% commission on eligible sales', 'Monthly statements and payment'],
      ].map(([title, ...items]) => `<div><h3>${title}</h3><ul class="checklist">${items.map(s => `<li>${check}<span>${s}</span></li>`).join('')}</ul></div>`).join('')}
    </div>
  </section></div>
  <section class="well section">
    <header class="section-head" data-reveal><h2>Who it suits</h2></header>
    <div class="columns profile-grid" data-reveal>
      ${[
        ['Travel-agency employee', 'You advise travellers already and want to earn extra income from Iceland enquiries.'],
        ['Tour guide abroad', 'Guests ask where to go next. You can recommend a trip and share a booking link.'],
        ['Travel creator', 'You write about Iceland or help an audience plan trips. You can share a tour you can explain well.'],
      ].map(([title, copy]) => `<article><p class="eyebrow">Example profile</p><h3>${title}</h3><p>${copy}</p></article>`).join('')}
    </div>
  </section>
  <section class="well section split faq" id="faq">
    <header class="section-head" data-reveal><h2>Frequently asked questions</h2><a class="text-action" href="mailto:hello@marinatravel.is">Ask Marina ${arrow}</a></header>
    <div data-reveal>${accordion(faq.map(([title, copy]) => [title, `<p>${copy}</p>`]), { id: 'faq-item' })}</div>
  </section>
  <section class="well section cta-section">
    <div class="cta-band" data-reveal>
      <div class="cta-copy"><h2>Ready to sell Iceland?</h2><p>Tell Marina how you reach travellers and take the short seller test.</p>${applyLink()}</div>
      <div class="cta-aside"><strong>Free to join</strong><span>Paid monthly after the tour has run.</span></div>
    </div>
  </section>`

function renderIntake() {
  const state = store.intakeState()
  const note = {
    paused: 'Applications are paused. You can keep a draft in this tab and return when intake reopens.',
    closed: 'Applications are closed. Leave your details to join the waitlist.',
    capacity: `The review queue is full. Save a draft and return when capacity resets ${timeText(store.reviewCapacity().reset)}.`,
  }[state]
  $('#intake-note').hidden = !note
  $('#intake-note').textContent = note || ''
  const label = { open: 'Apply in 10 minutes', closed: 'Join the waitlist', paused: 'Open your draft', capacity: 'Save a draft' }[state]
  $$('[data-intake-link]').forEach(link => {
    link.innerHTML = `${state === 'open' && link.classList.contains('sub-apply') ? 'Apply' : label} ${arrow}`
  })
}

function renderCalculator() {
  const tour = store.tour($('#calc-tour').value)
  const guests = $('#calc-guests').valueAsNumber
  const discount = $('#calc-discount').valueAsNumber
  const price = store.priceOf(tour)
  const line = store.priceLine({ listGrossMinor: price, vatBps: tour.vatBps, commissionBps: 1700, discountBps: discount * 100, maxDiscountBps: 500 })
  $('#calc-price').textContent = `${isk(price)} per guest · ${tour.id === 'icecave' ? pilotExample : tour.season}`
  $('#calc-guests-value').textContent = guests
  $('#calc-discount-value').textContent = `${discount}%`
  $('#calc-per').textContent = isk(line.agentAmountMinor)
  $('#calc-total').textContent = isk(line.agentAmountMinor * guests)
}

const featureCards = $$('.feature-card')
bindAccordion($('.features [data-accordion]'), i => featureCards.forEach((card, j) => {
  card.classList.toggle('selected', i === j)
  card.inert = i !== j
}))
bindAccordion($('.faq [data-accordion]'))
$('.calc-card').addEventListener('input', renderCalculator)
renderCalculator()
renderIntake()
window.addEventListener('storage', () => { store.refresh(); renderIntake(); renderCalculator() })
window.addEventListener('pageshow', event => { if (event.persisted) { store.refresh(); renderIntake(); renderCalculator() } })
revealSections()
smoothMarketing()
void qrSvg(new URL(sampleLink, location.href).href, { example: true }).then(svg => {
  $$('[data-example-qr]').forEach(target => { target.innerHTML = svg })
})
void store.visitRecruitment(campaign.source)
