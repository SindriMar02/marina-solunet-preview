import * as store from './store.js'
import { $, $$, siteShell, scrollReveal, esc } from './ui.js'
import { answerRows, selectNumberKey, workedFormula, TEST_CATEGORIES, accessUrl, root } from './recruitment.js'

siteShell('how')
document.title = `How ${store.settings().brand} works`
const anna = store.demoApplication()
const invited = store.invitationFor(anna)
const seller = store.agent(anna?.agentId)
const departure = 't=eastfjords&d=2027-06-05&s=5263195&p=6'
const guest = seller?.state === 'active' && anna.linkKey
  ? `s.html?k=${anna.linkKey}&${departure}`
  : `s.html?${departure}&c=MT-00001`
const steps = [
  ['18 Nov', 'Agent', 'See the invitation to sell', 'Anna, a Marina employee acting as a pilot agent, sees the ad.', 'become.html?demo=anna&src=linkedin-w1'],
  ['18 Nov', 'Agent', 'Apply and verify', 'She tells Marina how she sells and confirms her email address.', 'apply.html?demo=anna&src=linkedin-w1'],
  ['18 Nov', 'System', 'Score the test', 'Sölunet scores her answers and sends qualifying applications to the review queue.', accessUrl('test', anna?.access)],
  ['18 Nov', 'Marina', 'Make a decision', 'A member of the Marina team checks the evidence and decides.', `m/applications.html?id=${anna?.attempt?.submittedAt ? anna.id : 'fixture-9-0'}`],
  ['18 Nov', 'System', 'Create the seller account', 'Approval issues a unique seller number, a personal link, a QR code and an invitation to activate.', invited ? `activate.html?inv=${invited.token}` : 'activate.html'],
  ['5 Dec', 'Agent', 'Share a link or send a quote', 'Anna chooses the 13:00 Eastfjords departure for a group.', 'a/tour.html?t=eastfjords&demo=anna'],
  ['5 Dec', 'Guest', 'Pay Marina on Bókun', 'The guest books with Marina and sees the booking status after payment.', guest],
  ['5 Dec', 'System', 'Record the commission', 'The same booking, seller number and commission appear in both ledgers.', 'm/sales.html'],
]

root.innerHTML = `
  <div class="site-well">
    <section class="feature-intro" data-reveal aria-labelledby="opening">
      <p class="eyebrow">${esc(store.networkLabel())}</p>
      <h1 class="feature-title" id="opening">A sales network for tours and activities.</h1>
      <p class="editorial-copy dim">Independent agents sell tours and activities from Marina and partner companies by link, QR code or quote. Suppliers run the experiences. Marina recruits and supports agents, takes guest payments and pays agent commission.</p>
    </section>
    <figure class="feature-photo">
      <img src="assets/img/eastfjords.jpg" alt="The Eastfjords coastline on a Marina Travel tour">
      <figcaption class="meta">Enchanted Eastfjords · from Seyðisfjörður</figcaption>
    </figure>
    <section class="editorial-section" aria-labelledby="loop">
      <header class="editorial-heading" data-reveal><h2 id="loop">From first click to commission.</h2><p class="proto">Illustrative dates from the pilot story</p></header>
      <ol class="editorial-ledger">
        ${steps.map(([date, who, title, copy, href], i) => `<li data-reveal>
          <div class="step-date num"><span>Step ${i + 1}</span><time datetime="2026-${date === '18 Nov' ? '11-18' : '12-05'}">${date}</time></div>
          <span class="meta">${who}</span><div><h3>${title}</h3><p class="dim">${copy}</p></div>
          <a class="linkbtn" href="${esc(href)}" data-loop-step="${i + 1}" aria-label="See it · ${title}">See it <span aria-hidden="true">&nbsp;↗</span></a>
        </li>`).join('')}
      </ol>
    </section>
    <section class="editorial-section" aria-labelledby="roles">
      <header class="editorial-heading" data-reveal><h2 id="roles">Who does what</h2></header>
      <div class="editorial-cols network-roles" data-reveal>
        <div><h3 class="h-task">Marina</h3><p class="dim">Approves suppliers and agents, runs bookings and payments, supports guests and agents, and pays commission.</p></div>
        <div><h3 class="h-task">Suppliers</h3><p class="dim">Run the experiences, manage availability and respond to booking requests in Bókun.</p></div>
        <div><h3 class="h-task">The agent does</h3><p class="dim">Finds customers and sells tours. Independent agents choose where and how much they work.</p></div>
        <div><h3 class="h-task">The system does</h3><p class="dim">Scores the test, creates approved accounts and keeps track of who sold what, when and for how much.</p></div>
      </div>
    </section>
  </div>
  <section class="editorial-section paper-band" aria-labelledby="money">
    <div class="site-well editorial-split">
      <header class="editorial-heading" data-reveal><h2 id="money">One sale, worked through.</h2><p class="dim">On Marina’s own tours, the agent earns up to 17% of the eligible list price before VAT. Any discount the agent gives comes out of that rate.</p><p class="proto">Illustrative amounts</p></header>
      <div data-reveal>${workedFormula()}</div>
    </div>
  </section>
  <div class="site-well">
    <section class="editorial-section editorial-split" aria-labelledby="partners">
      <header class="editorial-heading" data-reveal>
        <h2 id="partners">Partner tours</h2>
        <p class="dim">An agent can earn a share of Marina’s margin after supplier cost and agreed fees. Any allowed guest discount comes out of the agent’s share. Partner tours open after Marina approves the terms and grants access.</p>
        <p class="proto">Illustrative amounts before VAT · no fees</p>
      </header>
      <ol class="formula" data-reveal>
        <li><span>Eligible list price</span><span class="v">100</span></li>
        <li><span>Supplier receives</span><span class="v">−80</span></li>
        <li><span>Marina’s margin before discount and commission</span><span class="v">20</span></li>
        <li><span>Agent budget at a 50% share</span><span class="v">10</span></li>
        <li><span>Guest discount, if allowed</span><span class="v">−5</span></li>
        <li><span>Guest pays</span><span class="v">95</span></li>
        <li class="sum"><span>Agent earns</span><span class="v">5</span></li>
        <li class="sum"><span>Marina keeps</span><span class="v">10</span></li>
      </ol>
    </section>
    <section class="editorial-section editorial-split" id="sample" aria-labelledby="test-title">
      <div class="flow-stack" data-reveal>
        <header class="editorial-heading"><h2 id="test-title">Try the agent test.</h2><p class="dim">It checks ${TEST_CATEGORIES}. The system scores it from 0 to 100, Marina sets the pass mark, and a person decides who gets an invitation.</p></header>
        <div><a class="btn primary" href="${esc(accessUrl('test', anna?.access))}">Take the full test</a></div>
      </div>
      <div class="flow-stack" id="sample-questions">
        ${[store.TEST_BANK[0], store.TEST_BANK[8]].map((item, index) => `<div data-sample="${index}" data-reveal>
          <p class="eyebrow">Sample question ${index + 1} of 2</p>
          ${answerRows(item)}
          <p class="hint" role="status"></p>
        </div>`).join('')}
      </div>
    </section>
    <section class="editorial-section" aria-labelledby="scale">
      <header class="editorial-heading" data-reveal><h2 id="scale">Review 50, even when 500 finish.</h2><p class="dim">One recruitment wave, with the numbers from Marina’s brief.</p></header>
      <ol class="funnel-ledger" data-reveal>
        ${[['10.000', 'See the ad'], ['2.000', 'Open the application page'], ['800', 'Start an application'], ['500', 'Finish the test'], ['50', 'Meet the pass mark'], ['50', 'Marina reviews']].map(([num, copy]) => `<li><strong class="num">${num}</strong><span class="meta">${copy}</span></li>`).join('')}
      </ol>
      <p class="editorial-copy section-follow dim">Marina can pause intake and cap weekly reviews. Approved accounts are created automatically.</p>
    </section>
    <section class="editorial-section" aria-labelledby="today">
      <header class="editorial-heading" data-reveal><h2 id="today">What is real today?</h2></header>
      <div class="editorial-cols" data-reveal>
        <div><h3 class="h-task">Backend core</h3><p class="dim">The booking, supplier rules and commission ledger run against a simulated Bókun adapter.</p></div>
        <div><h3 class="h-task">In this demo</h3><p class="dim">The screens use sample data in this browser. Applications, invitations, sign-in and payments are simulated.</p></div>
        <div><h3 class="h-task">Later phases</h3><p class="dim">The live Bókun connection, guest payments and agent payouts.</p></div>
      </div>
    </section>
    <section class="editorial-section" aria-labelledby="doors">
      <header class="editorial-heading" data-reveal><h2 id="doors">See Sölunet in action.</h2></header>
      <div class="actions" data-reveal>
        <a class="btn primary" href="index.html">Walk through the demo</a>
        <a class="btn" href="a/sell.html">Open the agent portal</a>
        <a class="btn" href="m/applications.html">Open Marina admin</a>
      </div>
    </section>
  </div>`

$$('[data-sample]').forEach((area, index) => {
  const { correct, options } = [store.TEST_BANK[0], store.TEST_BANK[8]][index]
  area.onkeydown = event => selectNumberKey(event, area)
  area.addEventListener('change', event => {
    $('[role="status"]', area).textContent = Number(event.target.value) === correct ? 'Correct.' : `The correct answer is ${options[correct]}.`
  })
})
$('[data-loop-step="6"]').onclick = () => {
  store.refresh()
  const current = store.agent(store.demoApplication()?.agentId)
  store.switchAgent(current?.state === 'active' ? current.id : 'agt_anna')
}
scrollReveal()
