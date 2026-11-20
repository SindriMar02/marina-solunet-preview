import * as store from './store.js'
import { annaProfile, pilotExample } from './recruitment.js'
import { dayLabel, esc, isk, qrSvg } from './ui.js'

import { tourPhoto } from './funnel.js'

const photoSizes = 'auto, (max-width: 390px) calc(100vw - 60px), 330px'
const card = (label, body, classes = '') =>
  `<div class="preview-card mini-ui ${classes}"><p class="preview-label">${label}</p>${body}</div>`
const field = (label, value) => `<div class="mini-field"><strong>${label}</strong><span>${esc(value)}</span></div>`
const row = (label, value) => `<div class="preview-row"><span>${label}</span><strong>${value}</strong></div>`
const tick = label => `<li><span class="check">✓</span>${label}</li>`
const action = (label, primary = false) => `<span class="mini-action${primary ? ' mini-primary' : ''}">${label}</span>`

export function walkthroughPreviews({ seller, quote, paid }, guestLink) {
  const tour = store.tour('icecave')
  const sellerNumber = esc(seller?.sellerId || 'MT-00001')
  const question = store.TEST_BANK[1]
  const exampleScore = store.scoreAttempt(Object.fromEntries(store.TEST_BANK
    .filter(item => item.id !== 'request').map(item => [item.id, item.correct])))
  const bookingDays = store.departures(tour.id, '2026-12-12', 2)
  const { rule, cap } = store.agentOffer(tour, null)
  const estimate = pax => store.priceLine({
    listGrossMinor: store.priceOf(tour) * pax, vatBps: tour.vatBps,
    commissionBps: rule?.commissionBps ?? 1700, maxDiscountBps: cap ?? 0, discountBps: 0,
  })
  const sellerQuote = quote && store.quote(quote.k)
  const orderLines = paid.slice(-2).map(({ id, ref }) => {
    const order = store.orderById(id)
    const state = store.commissionStatus(order)
    const labels = { pending: 'Pending until the tour runs', payable: 'Payable' }
    return [esc(ref), store.balanceOf(id), labels[state] || 'No commission']
  })
  const statement = orderLines.length ? orderLines : [
    ['Blue Ice Cave · 2 guests', estimate(2).agentAmountMinor, 'Pending until the tour runs'],
    ['Blue Ice Cave · 1 guest', estimate(1).agentAmountMinor, 'Payable'],
  ]
  const link = guestLink?.split('&')[0]
  const publicLink = link ? new URL(link, location.href).href : null

  return {
    link: publicLink,
    panels: [
      `<div class="ad-entry mini-ui mini-post">
        <div class="ad-meta"><img class="marina-avatar" src="assets/img/marina-logo-dark.png" alt=""><div><strong>Marina Travel</strong><p>Promoted</p></div></div>
        <p class="ad-body">Sell Iceland. Earn up to 17% on every tour you sell.</p>
        ${tourPhoto('ice-cave-hero', '', photoSizes, { className: 'mini-photo' })}
        <div class="mini-bar"><strong>Become an independent seller</strong>${action('Apply')}</div>
      </div>`,
      card('Seller application · 1 of 3', `<h4>About you</h4>
        ${field('Name', annaProfile.name)}${field('Country', annaProfile.country)}${field('Email', annaProfile.email)}
        <div class="mini-actions">${action('Continue', true)}</div>`),
      card('Seller test', `<div class="mini-test-meta"><strong>Question 2 of ${store.TEST_BANK.length}</strong><span class="num">${store.TEST_MINUTES - 1}:24 left</span></div>
        <progress class="meter" value="2" max="${store.TEST_BANK.length}"></progress>
        <h4>${esc(question.prompt)}</h4>
        <ul class="mini-answers">${question.options.map((option, i) => `<li${i === question.correct ? ' class="picked"' : ''}>${esc(option)}</li>`).join('')}</ul>`),
      card('Marina · Applications', `<h4>Review queue</h4>
        <div class="mini-queue">${row('Anna · worked example', `${exampleScore}/100`)}${row('Ambiguous market', 'Look closer')}</div>
        <strong>Automatic checks</strong>
        <ul class="mini-checks">${['Email verified', 'Pass mark met', 'No duplicate found'].map(tick).join('')}</ul>
        <div class="mini-actions">${action('Approve', true)}${action('Look closer')}${action('Reject')}</div>`),
      card('Your seller account', `<div class="mini-person"><span class="avatar">A</span><div><h4>${esc(seller?.name || annaProfile.name)}</h4><p class="num">${sellerNumber}</p></div></div>
        <div class="mini-qr-row"><div class="qr" data-preview-qr><p class="meta">Example QR</p></div><div><strong>Personal QR</strong><p>Share it with guests to credit your bookings.</p></div></div>
        <div class="mini-actions">${action('Open seller hub', true)}</div>`),
      card('Seller hub · Share and quote', `<h4>Blue Ice Cave</h4>
        <div class="mini-qr-row"><div class="qr" data-preview-qr><p class="meta">Example QR</p></div><div><strong>Seller link</strong><p class="mini-link">${link ? esc(link) : 'Created when Anna shares this tour'}</p>${link ? action('Copy link') : ''}</div></div>
        <div class="mini-quote">
          <strong>${sellerQuote ? 'Guest quote' : 'Example guest quote'}</strong><p class="mini-subtitle">${pilotExample}</p>
          ${row(`${sellerQuote?.pax || 2} guests`, isk(sellerQuote?.totalMinor ?? estimate(2).customerGrossMinor))}
        </div>`),
      card('Marina Travel · Booking', `${tourPhoto('ice-cave-hero', '', photoSizes, { className: 'mini-photo' })}
        <h4>Blue Ice Cave</h4><p class="mini-subtitle">From Hornafjörður Airport · ${tour.min}–${tour.max} guests</p><p class="mini-subtitle">${pilotExample}</p>
        ${bookingDays.flatMap(day => day.starts.map(slot => row(`${dayLabel(day.date)} · ${slot.time}`,
          slot.onRequest ? 'On request' : `${slot.seatsLeft} seats left`))).join('')}
        ${row('Per guest', isk(store.priceOf(tour)))}`, 'mini-booking'),
      card('Seller hub · Commission', `<h4>Monthly statement</h4><p class="mini-subtitle">${sellerNumber} · ${orderLines.length ? 'Commission in ISK' : 'Example · Commission in ISK'}</p>
        ${statement.map(([name, amount, state]) => `<div class="preview-row mini-statement"><div><strong>${name}</strong><br><span class="status${state === 'Payable' ? ' confirmed' : ''}">${state}</span></div><strong>${isk(amount)}</strong></div>`).join('')}`),
    ],
  }
}

export async function fillPreviewQr(link, targets) {
  // Before Anna shares a tour the preview still shows a real (example) code: it opens the guest site.
  const target = link || new URL('shop.html', location.href).href
  const svg = await qrSvg(target, { example: true })
  targets.forEach(target => { target.innerHTML = svg })
}
