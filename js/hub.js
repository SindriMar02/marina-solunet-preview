import * as store from './store.js'
import { $, $$, esc, siteShell, sheet } from './ui.js'
import { accessUrl, root } from './recruitment.js'

siteShell('hub')
root.innerHTML = `
  <div class="site-well">
    <header class="feature-intro">
      <p class="eyebrow">Marina Travel · Guided prototype</p>
      <h1 class="feature-title">Follow Anna’s first sale.</h1>
      <p class="editorial-copy dim">Anna works at Marina Travel. In the pilot she goes through Sölunet as an independent agent would, from seeing the ad to finding her first sale on both ledgers.</p>
      <div class="actions"><a class="btn primary" href="shop.html">Open the guest site</a><a class="btn" href="how.html">How it works</a><a class="btn" href="#demo-story">Start the walkthrough</a></div>
      <p class="proto">Demo · The application, agent, guest and Marina views share data in this browser.</p>
    </header>
    <section class="editorial-section" id="demo-story" aria-labelledby="story-title">
      <header class="editorial-heading"><h2 id="story-title">From application to booking.</h2>
        <p class="dim">Return here after each step. Completed steps are marked as you go.</p></header>
      <ol class="editorial-ledger story" id="story"></ol>
      <div class="actions section-follow"><a class="btn" href="a/sales.html" id="agent-ledger">Agent sales ledger</a><a class="btn" href="m/sales.html">Marina sales ledger</a></div>
    </section>
    <section class="editorial-section editorial-split" aria-labelledby="act">
      <header class="editorial-heading"><h2 id="act">Act as</h2><p class="dim">Choose the agent whose portal and sales ledger you want to use.</p></header>
      <div class="flow-stack"><ul class="rows" id="who"></ul><a class="linkbtn" href="a/sell.html">Open the selected agent’s portal</a></div>
    </section>
    <section class="editorial-section editorial-split" aria-labelledby="scenario-heading">
      <header class="editorial-heading"><h2 id="scenario-heading">Scenario switches</h2><p class="dim">Explore price changes and recruitment states, or reset the walkthrough.</p></header>
      <div class="flow-stack">
        <div class="actions"><button class="btn" id="bump" type="button">Raise Eastfjords price 5%</button><button class="btn" id="reset" type="button">Reset all prototype data</button></div>
        <p class="meta" id="bumpstate" role="status"></p>
        <details class="flow" id="intake-settings"><summary>Marina intake settings (demo)</summary>
          <form>
            <div class="field"><label for="intake-state">Intake state</label>
              <select class="input" id="intake-state"><option value="open">Open</option><option value="paused">Paused</option><option value="closed">Closed · waitlist</option></select></div>
            <div class="field"><label for="intake-cap">Application cap</label><input class="input" id="intake-cap" type="number" required min="0"></div>
            <div class="field"><label for="review-cap">Weekly review capacity</label><input class="input" id="review-cap" type="number" required min="0"></div>
            <div class="field"><label for="pass-mark">Pass mark (new attempts)</label><input class="input" id="pass-mark" type="number" required min="0" max="100"></div>
            <div><button type="submit" class="btn">Save intake settings</button></div><p class="hint" role="status" id="settings-result"></p>
          </form>
        </details>
        <p class="proto">Prices use Marina’s 13 Nov Bókun snapshot. The per-person basis is unverified. VAT at 11%, seat counts and the 13:00 Eastfjords start are illustrative. Payments are simulated.</p>
      </div>
    </section>
  </div>`

function findJourney() {
  const app = store.demoApplication()
  const seller = store.agent(app?.agentId)
  const invite = store.invitationFor(app)
  const active = seller?.state === 'active'
  const fits = item => item.agentId === seller?.id && item.tourId === 'eastfjords' && item.date === '2027-06-05' && item.time === '13:00'
  const quote = store.state().quotes.findLast(q => fits(q) && Date.parse(q.expires) > Date.now())
  const shared = store.state().links.findLast(link => link.agentId === seller?.id && link.tourId === 'eastfjords' && !link.revoked)
  const orders = store.allOrders().filter(fits)
  const paid = orders.find(o => store.captured(o) > 0)
  const open = orders.find(o => o.state === 'handed_off')
  return { app, seller, invite, active, quote, shared, paid, open }
}
function renderStory() {
  const { app, seller, invite, active, quote, shared, paid, open } = findJourney()
  const status = accessUrl('status', app?.access)
  const review = `m/applications.html${app?.reviewAt ? `?id=${app.id}` : ''}`
  const tour = 'a/tour.html?t=eastfjords&demo=anna'
  const sale = paid ? `a/sale.html?id=${paid.id}` : 'a/sales.html'
  const guest = paid ? `r.html?o=${paid.id}` : open ? `pay.html?o=${open.id}`
    : quote ? `q.html?k=${quote.k}` : shared ? `s.html?k=${shared.k}&d=2027-06-05&s=5263195&p=6` : active ? tour : status
  const steps = [
    ['See the recruitment page', 'Read the offer for independent agents.', 'become.html?demo=anna&src=linkedin-w1', store.state().demo.visitedAt],
    ['Apply and verify', 'Use Anna’s demo details and open the simulated verification email.', app ? status : 'apply.html?demo=anna&src=linkedin-w1', app?.verifiedAt],
    ['Take the test', 'Start Anna’s timed attempt. Marina sees the score after submission.', accessUrl('test', app?.access), app?.attempt?.submittedAt],
    ['Review and approve', 'Switch to Marina’s review desk and record a decision.', review, app?.state === 'approved'],
    ['Activate the seller account', seller ? `Open the invitation and set up ${seller.sellerId}.` : 'Open Anna’s invitation after approval to set up her seller number, link and QR code.',
      invite ? `activate.html?inv=${invite.token}` : app ? status : 'activate.html', active],
    ['Sell the 13:00 Eastfjords departure', 'Send a quote for six guests on 5 June 2027, or share the tour link.', active ? tour : invite ? `activate.html?inv=${invite.token}` : 'activate.html', quote || shared || paid, active],
    ['Pay as the guest', 'Open the quote or tour link and complete the simulated Bókun payment.', guest, paid],
    ['Compare both ledgers', paid ? `Find ${paid.ref} under ${seller.sellerId} in both ledgers.` : 'Find the same booking, seller number and commission in both ledgers after payment.',
      paid ? sale : 'm/sales.html', paid && store.entriesOf(paid.id).length, active && paid],
  ]
  const focused = document.activeElement?.dataset.storyStep
  $('#story').innerHTML = steps.map(([title, copy, href, done, useSeller], i) => `<li>
    <span class="step-date num">Step ${i + 1}${done ? ' <span class="status confirmed">Done</span>' : ''}</span>
    <div><h3>${title}</h3><p class="dim">${esc(copy)}</p></div>
    <a class="btn" href="${esc(href)}" data-story-step="${i}"${useSeller ? ' data-seller' : ''} aria-label="Open step ${i + 1} · ${title}">Open</a>
  </li>`).join('')
  $('#agent-ledger').href = sale
  if (active) $('#agent-ledger').setAttribute('data-seller', '')
  else $('#agent-ledger').removeAttribute('data-seller')
  $$('[data-seller]').forEach(link => { link.onclick = () => { store.refresh(); if (store.agent(seller.id)?.state === 'active') store.switchAgent(seller.id) } })
  if (focused !== undefined) $(`[data-story-step="${focused}"]`)?.focus({ preventScroll: true })
}
function renderAgents() {
  const focused = document.activeElement?.dataset.agent
  $('#who').innerHTML = store.agents().filter(a => a.state === 'active').map(a => `<li>
    <button type="button" class="row agent-choice" data-agent="${esc(a.id)}" aria-pressed="${store.me().id === a.id}">
      <span class="r1">${esc(a.name)} · <span class="mt">${esc(a.sellerId)}</span>${store.me().id === a.id ? ' · <span class="status confirmed">Selected</span>' : ''}</span>
      <span class="r2">${esc(a.city)} · ${esc(a.note)} · discount ${a.discountBps / 100} points</span>
    </button></li>`).join('')
  $$('[data-agent]').forEach(button => { button.onclick = () => { store.refresh(); store.switchAgent(button.dataset.agent); renderAgents() } })
  if (focused) $$('[data-agent]').find(button => button.dataset.agent === focused)?.focus({ preventScroll: true })
}
function renderPrice() {
  const bumped = Boolean(store.state().priceBump)
  $('#bumpstate').textContent = bumped ? 'Eastfjords price is 5% higher than quotes made before the switch.' : 'Prices as shown in Marina’s Bókun snapshot.'
  $('#bump').setAttribute('aria-pressed', bumped)
}
function fillSettings() {
  const settings = store.state().intake
  $('#intake-state').value = settings.state
  $('#intake-cap').value = settings.cap
  $('#review-cap').value = settings.reviewCapacity
  $('#pass-mark').value = settings.passMark
}
$('#intake-settings form').onsubmit = async event => {
  event.preventDefault()
  try {
    await store.setIntake({ state: $('#intake-state').value, cap: $('#intake-cap').valueAsNumber,
      reviewCapacity: $('#review-cap').valueAsNumber, passMark: $('#pass-mark').valueAsNumber })
    $('#settings-result').textContent = 'Intake settings saved.'
  } catch { $('#settings-result').textContent = 'The settings could not be saved. Check the values and try again.' }
}
$('#bump').onclick = () => { store.refresh(); store.togglePriceBump(); renderPrice() }
$('#reset').onclick = event => sheet({
  title: 'Reset the demo?', opener: event.currentTarget, viaKey: event.detail === 0,
  body: '<p>This restores the starting fixtures and removes applications, accounts, quotes and sales created in this browser.</p><div class="actions section-follow"><button class="btn primary" id="confirm-reset">Reset prototype data</button></div>',
  onOpen(dialog, close) {
    $('#confirm-reset', dialog).onclick = () => {
      store.reset()
      for (const key of ['solunet-anna-draft', 'solunet-anna-mail', 'solunet-application-draft', 'solunet-application-mail', 'solunet-access']) sessionStorage.removeItem(key)
      update()
      fillSettings()
      $('#settings-result').textContent = ''
      close()
    }
  },
})
function update() { renderStory(); renderAgents(); renderPrice() }
update()
fillSettings()
window.addEventListener('storage', () => { store.refresh(); update() })
window.addEventListener('pageshow', event => { if (event.persisted) { store.refresh(); update() } })
