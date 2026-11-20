import * as store from './store.js'
import { $, $$, esc, icon } from './ui.js'
import { answerRows, selectNumberKey, workedFormula, TEST_CATEGORIES, accessUrl, refundPolicy, root } from './recruitment.js'
import { accordion, arrow, bindAccordion, funnelShell, revealSections, smoothMarketing } from './funnel.js'

funnelShell('how')
const { app: anna } = store.demoTrail()
const roles = [
  ['agents', 'Independent seller', 'Find customers, explain the tour and share your seller link, QR code or quote. Use Marina’s approved prices and sales materials.'],
  ['suppliers', 'Marina Travel', 'Set prices and availability, operate the tour and support guests. The customer-service office is in Romania, and Marina has a sales office in Singapore.'],
  ['applications', 'Sölunet', 'Score tests, create approved accounts and record which seller made each sale. Marina makes the decisions that need human judgment.'],
]
const money = [
  ['Guest pays Marina', 'The guest books in Bókun and pays Marina directly.'],
  ['Teya can hold the payment', `Teya can hold the funds until tour day. ${refundPolicy}`],
  ['Payment is released', 'When Teya holds a payment until tour day, it releases the funds to Marina on that date.'],
  ['Commission becomes payable', 'Commission is payable once the paid tour runs. Refunds and cancellations can reduce or reverse it.'],
  ['Marina issues a statement', 'The monthly statement shows individual sales, refunds and commission. Marina handles pilot payouts.'],
]
const details = [
  ['What’s in the winter pilot?', '<p>One Marina ice cave tour, recruitment and application, a scored test and human review, seller tools, booking attribution and monthly statements. The ice cave season runs to April, with Seyðisfjörður planned for summer 2027.</p>'],
  ['Which features come after phase 1?', '<p>Automated payouts and bank integration, full accounting or CRM, team-leader and multilevel sales, a separate app, multilingual interfaces, a large catalogue, advanced analytics and automated marketing are outside the first phase.</p>'],
  ['How could partner tours work later?', '<p>Marina can add partner-operated tours once terms are agreed. On a partner tour the seller’s share may come from Marina’s margin, with an allowed discount deducted from that share.</p>'],
]

root.innerHTML = `
  <section class="well section editorial-hero">
    <p class="eyebrow">The seller programme</p><h1>How Sölunet works</h1>
    <p class="lede">Independent sellers bring travellers to Marina’s tours. Marina runs the trip, and Sölunet makes sure each sale reaches the right seller’s statement.</p>
    <div class="actions"><a class="btn primary" href="index.html">Follow Anna’s first sale ${arrow}</a><a class="btn" href="#money">See the money path</a></div>
  </section>
  <div class="band"><section class="well section">
    <header class="section-head" data-reveal><h2>Who does what</h2></header>
    <div class="columns" data-reveal>${roles.map(([symbol, title, copy]) => `<article><div class="mini-icon">${icon(symbol)}</div><h3>${title}</h3><p>${copy}</p></article>`).join('')}</div>
  </section></div>
  <section class="well section split" id="money">
    <header class="section-head" data-reveal><p class="eyebrow">The money path</p><h2>From guest payment to monthly statement</h2><p>Marina handles payment and refunds. The seller can track each booking and see when commission becomes payable.</p></header>
    <ol class="money-path" data-reveal>${money.map(([title, copy], i) => `<li><span aria-hidden="true">${i + 1}</span><div><h3>${title}</h3><p>${copy}</p></div></li>`).join('')}</ol>
  </section>
  <section class="well section split attribution">
    <header class="section-head" data-reveal><p class="eyebrow">Attribution</p><h2>Every sale has a seller number</h2><p>Anna’s number is MT-00001. The booking and the commission entry carry that reference so Anna and Marina can compare the same sale.</p></header>
    <div data-reveal>${accordion([
      ['Personal link and QR', '<p>The QR code opens the same personal link. A Bókun referral tracking code follows the guest into booking.</p>'],
      ['Seller code', '<p>Marina can identify the seller using the unique MT number attached to the sale.</p>'],
      ['A quote for a group', '<p>The seller prepares a quote with the departure, group size and any permitted discount. The quote connects the booking to that seller.</p>'],
      ['A commission example', workedFormula()],
    ], { id: 'attribution', active: 0 })}</div>
  </section>
  <div class="band"><section class="well section">
    <header class="section-head" data-reveal><p class="eyebrow">Illustrative recruitment wave</p><h2>Marina reviews the applicants who qualify</h2><p>From Einar’s example. The numbers describe a scenario for one wave.</p></header>
    <ol class="figures funnel-figures" data-reveal>${[['10,000', 'See the ad'], ['2,000', 'Visit'], ['800', 'Start'], ['500', 'Finish'], ['50', 'Qualify']].map(([n, label]) => `<li><strong>${n}</strong><span>${label}</span></li>`).join('')}</ol>
    <p class="section-follow">The test does the first pass. Marina staff can approve, reject or take a closer look at a shortlisted application. Approval starts account setup automatically.</p>
  </section></div>
  <section class="well section split" id="sample">
    <header class="section-head" data-reveal><h2>Try the seller test</h2><p>The test checks ${TEST_CATEGORIES}.</p><a class="btn" href="${esc(accessUrl('test', anna?.access))}">Open the timed test ${arrow}</a></header>
    <div class="flow-stack" data-reveal>
      ${[store.TEST_BANK[0], store.TEST_BANK[8]].map((item, i) => `<div class="sample-card" data-sample="${i}">
        <p class="eyebrow">Sample question ${i + 1}</p>${answerRows(item)}<p class="hint" role="status"></p>
      </div>`).join('')}
    </div>
  </section>
  <section class="well section split">
    <header class="section-head" data-reveal><h2>Phase 1 and what follows</h2></header>
    <div data-reveal>${accordion(details, { id: 'pilot-detail', active: 0 })}</div>
  </section>`

$$('[data-sample]').forEach((area, index) => {
  const { correct, options } = [store.TEST_BANK[0], store.TEST_BANK[8]][index]
  area.onkeydown = event => selectNumberKey(event, area)
  area.addEventListener('change', event => {
    $('[role="status"]', area).textContent = Number(event.target.value) === correct ? 'Correct.' : `Correct answer: ${options[correct]}`
  })
})
$$('[data-accordion]').forEach(area => bindAccordion(area))
revealSections()
smoothMarketing()
