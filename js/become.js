import * as store from './store.js'
import { $, esc, isk, siteShell, scrollReveal } from './ui.js'
import { TERMS, journey, root, worked, timeText } from './recruitment.js'

siteShell()
const { guided, source } = journey()
await store.visitRecruitment()
const params = new URLSearchParams()
if (guided) params.set('demo', 'anna')
if (source) params.set('src', source)
const applyUrl = () => `apply.html?${params}`
const process = ['Apply', 'Verify your email', 'Take the test', 'Marina reviews', 'Get your invitation']
root.innerHTML = `
  <div class="site-well">
    <section class="feature-intro" data-reveal aria-labelledby="opening">
      <p class="eyebrow">Independent sales agents · Marina Travel</p>
      <h1 class="feature-title" id="opening">Sell Iceland.</h1>
      <p class="editorial-copy">Earn up to 17% of the eligible tour price before VAT.</p>
      <p class="editorial-copy dim">Find customers for Marina’s tours. We operate the trips, take payment and look after the guest.</p>
      <div id="intake" class="flow-stack"></div>
    </section>
    <figure class="feature-photo">
      <img src="assets/img/ice-cave.jpg" alt="Blue ice on Marina Travel’s ice cave tour">
      <figcaption class="meta">Jökulsárlón, Diamond Beach and Blue Ice Cave</figcaption>
    </figure>
    <section class="editorial-section editorial-split" aria-labelledby="process">
      <div>
        <header class="editorial-heading" data-reveal><h2 id="process">From application to invitation.</h2></header>
        <ol class="formula" data-reveal>${process.map((step, i) => `<li><span>${step}</span><span class="v meta">${String(i + 1).padStart(2, '0')}</span></li>`).join('')}</ol>
      </div>
      <div class="photo-pair" data-reveal>
        <img src="assets/img/eastfjords.jpg" alt="Landscape on the Enchanted Eastfjords tour" loading="lazy">
        <img src="assets/img/ice-cave.jpg" alt="Inside the blue ice cave" loading="lazy">
      </div>
    </section>
    <section class="editorial-section" aria-labelledby="tours">
      <header class="editorial-heading" data-reveal><h2 id="tours">Two pilot tours</h2></header>
      <div class="editorial-split" data-reveal>
      ${store.TOURS.filter(t => store.offer(t.id)?.status === 'active' && t.min).map(t => `<article class="flow-stack">
        <p class="eyebrow">${esc(t.place)}</p><h3 class="h-task">${esc(t.title)}</h3>
        <p class="dim">${t.min}–${t.max} guests per booking · Ages ${t.age}+ · ${esc(t.unit)}</p>
        <p class="meta">${t.capacity === 'ON_REQUEST' ? 'On request · Marina confirms availability' : 'Scheduled departures · Subject to available seats'}. Pilot season dates to be confirmed.</p>
      </article>`).join('')}
      </div>
      <div class="notice section-follow"><p>Example with illustrative 11% VAT. On a ${isk(worked.listGrossMinor)} list price before a 5% guest discount, you earn 12% of ${isk(worked.listNetMinor)} before VAT, or <strong class="num">${isk(worked.agentAmountMinor)}</strong>.</p></div>
    </section>
  </div>
  <section class="editorial-section paper-band" aria-labelledby="fit">
    <div class="site-well editorial-split">
      <header class="editorial-heading" data-reveal><h2 id="fit">Who can apply?</h2><p class="dim">Tell us which markets you serve, which languages you sell in and how you reach customers. Marina uses those details and the test to assess fit for the pilot.</p></header>
      <div class="flow-stack" data-reveal>
        <h3 class="h-task">Pilot terms in brief</h3>
        ${TERMS.slice(0, 3).map(term => `<p>${term}</p>`).join('')}
        <p class="proto">Prototype · Use sample details. Applications stay in this browser.</p>
      </div>
    </div>
  </section>
  <div class="site-well">
    <section class="editorial-section editorial-split" aria-labelledby="faq">
      <header class="editorial-heading" data-reveal><h2 id="faq">Common questions</h2></header>
      <div class="editorial-faq" data-reveal>
        <details><summary>Who handles bookings and payments?</summary><p class="dim">Marina handles the booking and guest support. Guests pay Marina through Bókun. You send the tour link or quote.</p></details>
        <details><summary>How does a customer discount affect commission?</summary><p class="dim">A 5% guest discount reduces a 17% commission rate to 12% of the eligible list price before VAT.</p></details>
        <details><summary>What happens after the test?</summary><p class="dim">Marina reviews qualifying applications. If approved, you receive an invitation with your own seller number and link.</p></details>
        <details><summary>Can I ask for a test accommodation?</summary><p class="dim">Call Marina before starting your attempt.</p><a class="linkbtn" href="tel:+3548678899">Call +354 867 8899</a></details>
      </div>
    </section>
  </div>`

function renderIntake() {
  const status = store.intakeState()
  const reset = timeText(store.reviewCapacity().reset)
  const copy = {
    open: '',
    paused: 'Applications are paused. You can keep a draft in this tab and return when intake reopens.',
    closed: 'Applications are closed. Leave your details to join the waitlist.',
    capacity: `This week’s review queue is full. Capacity resets ${reset}. You can save a draft and submit when a place opens. The demo reply estimate is five days after submission.`,
  }
  const label = { open: 'Apply', closed: 'Join the waitlist', paused: 'Open your draft', capacity: 'Save an application draft' }[status]
  $('#intake').innerHTML = `${copy[status] ? `<p class="notice" role="status">${esc(copy[status])}</p>` : ''}
    <div class="actions"><a class="btn primary" href="${esc(applyUrl())}">${label}</a>
    <a class="btn" href="a/sell.html">Agent sign-in <span class="sr">(demo)</span></a></div>`
}
renderIntake()
window.addEventListener('storage', renderIntake)
scrollReveal()
