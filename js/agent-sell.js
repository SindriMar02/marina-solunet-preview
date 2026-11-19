import * as store from './store.js'
import { $, esc, isk, agentShell, dayLabel, stamp } from './ui.js'
agentShell('sell', 'Sell')
const heading = $('#main h1')
heading.closest('main').classList.add('work-inner')
const seller = store.me()
heading.textContent = 'Sell your first tour.'
heading.previousElementSibling.textContent = 'Seller tools · ' + seller.sellerId
heading.nextElementSibling.insertAdjacentHTML('afterend', `<section class="work-section agent-intro">
  <h2 class="h-task">Choose how to sell</h2>
  <p class="dim">Open a tour to share your link or prepare a quote for a specific departure.</p>
  <div class="actions"><a class="btn" href="#tours">View assigned tours</a><a class="btn" href="library.html">Open sales library</a></div>
</section>`)
function draw() {
  $('#tours').innerHTML = store.suppliers().map(s => `
    <section aria-labelledby="name-${s.id}">
      <h2 class="h-task" id="name-${s.id}">${esc(s.name)}</h2>
      <div class="cards">${store.TOURS.filter(t => t.supplierId === s.id).map(t => {
        const policy = store.agentOffer(t)
        if (policy.error) return `<article class="card locked-tour">
          <p class="status pending">${s.status === 'pending' ? 'Coming' : 'Unavailable'}</p>
          <h3>${esc(t.title)}</h3><p class="meta">Run by ${esc(s.name)}</p>
          <p><span class="money">${isk(store.priceOf(t))}</span> <span class="meta">${esc(t.unit)}</span></p>
          <p class="dim">${s.status === 'pending' ? 'Coming: partner tours open when Marina approves the partner' : esc(store.saleError(policy.error))}</p></article>`
        const next = store.departures(t.id).flatMap(d => d.starts.map(st => ({ ...st, date: d.date }))).find(st => !st.soldOut)
        const earnings = policy.rule.kind === 'percent_of_price'
          ? `You earn ${policy.rule.commissionBps / 100}% − your discount`
          : `You earn ${policy.rule.commissionBps / 100}% of Marina’s margin`
        return `<a class="card" href="tour.html?t=${t.id}"><div class="ph"><img src="${t.img}" alt="" loading="lazy"></div>
          <h3>${esc(t.title)}</h3><p class="meta">Run by ${esc(s.name)} · ${esc(t.place)} · ${esc(t.duration)} · ${t.min}–${t.max} guests per booking</p>
          <p><span class="money">${isk(store.priceOf(t))}</span> <span class="meta">${esc(t.unit)}</span></p>
          <p>${earnings}</p>
          <p class="meta">${t.capacity === 'ON_REQUEST' ? `On request · ${esc(s.name)} confirms each booking` : next ? `Next: ${esc(dayLabel(next.date))} ${esc(next.time)}` : 'No departures'}</p></a>`
      }).join('')}</div>
    </section>`).join('')
  const qs = store.myQuotes()
  $('#quotes').innerHTML = qs.length ? qs.map(q => { const t = store.tour(q.tourId), o = q.orderId && store.myOrder(q.orderId)
    const st = o ? ({ confirmed: 'Paid', partially_refunded: 'Paid, part refunded', cancelled: 'Cancelled', failed: 'Payment not completed', requested: 'Requested', handed_off: 'At checkout, not paid yet' }[o.state] || o.state)
      : q.expires < new Date().toISOString() ? 'Expired' : q.opened ? 'Opened by the customer' : 'Created'
    return `<li><a class="row" href="quote.html?q=${q.id}"><span class="r1">${esc(q.customer || 'Customer')} · ${esc(t.title)}</span>
      <span class="r2">${esc(dayLabel(q.date))} · ${esc(q.time)} Iceland · ${q.pax} guests</span>
      <span class="r3"><span class="meta">${esc(st)} · made ${esc(stamp(q.created))}</span><span class="money">${isk(q.totalMinor)}</span></span></a></li>` }).join('')
    : '<li><p class="meta" style="padding:14px 0">No quotes yet. Open a tour and choose "Make a quote".</p></li>'
}
draw()
window.addEventListener('storage', () => { store.refresh(); draw() })
