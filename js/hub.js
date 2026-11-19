import * as store from './store.js'
import { $, $$, esc, siteShell, sheet } from './ui.js'
import { accessUrl, field, root } from './recruitment.js'
import { agentIdentity, endSession, principal, STAFF, startSession } from './session.js'

siteShell('hub')
document.body.classList.add('workbench')
root.innerHTML = `<div class="site-well work-page">
  <header class="feature-intro">
    <p class="eyebrow">Marina Travel · Sölunet prototype</p>
    <h1 class="feature-title">Follow Anna’s first sale.</h1>
    <p class="editorial-copy dim">Anna works at Marina Travel. She applies as an independent agent and sells the winter ice cave tour. Follow her application, then compare the guest, seller and Marina records.</p>
    <div class="actions"><a class="btn primary" href="#demo-story">Start the walkthrough</a><a class="btn" href="shop.html">Open the guest site</a></div>
  </header>
  <section class="editorial-section" id="demo-story">
    <header class="editorial-heading"><h2>From ad to first sale.</h2><p class="dim">Return here between steps to follow the same applicant and switch roles.</p></header>
    <ol class="editorial-ledger story" id="story"></ol>
  </section>
  <section class="editorial-section editorial-split" id="act">
    <header class="editorial-heading"><h2>Demo identities</h2>
      <p class="dim" id="identity"></p><p class="meta">The switcher simulates a sign-in in this tab. <a class="linkbtn" href="login.html">Try the hosted sign-in</a></p></header>
    <ul class="work-list" id="identities"></ul>
  </section>
  <section class="editorial-section editorial-split">
    <header class="editorial-heading"><h2>Filter examples</h2><p class="dim">Use Marina Reviewer or Marina Admin to see the checks and their reasons.</p></header>
    <ul class="work-list" id="examples"></ul>
  </section>
  <section class="editorial-section editorial-split">
    <header class="editorial-heading"><h2>Rehearsal controls</h2><p class="dim">Use fictional details. Resetting starts the trial again in this browser.</p></header>
    <div class="flow-stack"><div class="actions">${principal()?.role === 'admin' ? '<button class="btn" id="reset" type="button">Reset prototype data</button>' : '<a class="btn" href="#act">Switch to Marina Admin to reset</a>'}</div>
    <p class="meta">The summer Eastfjords scenario remains available through a seeded seller. The winter trial gives Anna access to the ice cave tour.</p></div>
  </section>
</div>`

function render() {
  const { app, seller, invite, active, quote, shared, paid, open, requested, visited } = store.demoTrail()
  const status = accessUrl('status', app?.access)
  const tour = 'a/tour.html?t=icecave&d=2026-12-12&s=2774517&p=2'
  const linkSale = paid.find(order => order.why !== 'quote')
  const quoteSale = paid.find(order => order.why === 'quote')
  const review = `m/applications.html${app?.reviewAt ? '?id=' + app.id : ''}`
  const guestLink = shared ? `s.html?k=${shared.k}&d=2026-12-12&s=2774517&p=2` : tour
  const openGuest = open ? `pay.html?o=${open.id}` : null
  const steps = [
    ['Read the recruitment ad', 'Open the fictional LinkedIn placement and follow it to the recruitment page.', 'ad.html', visited],
    ['Apply and verify', 'Use Anna’s prefilled details, then open her simulated verification email.', app ? status : 'apply.html?demo=anna&src=linkedin-w1', app?.verifiedAt],
    ['Take the timed test', 'Read the rules, answer the 12 questions and return to status. For a clean demo pass, spend at least three minutes.', accessUrl('test', app?.access), app?.tested],
    ['Review the case', 'Switch to Marina Reviewer. Inspect the checks and approve the application. A flagged approval needs an explanation.', review, app?.state === 'approved'],
    ['Activate the seller', 'Open Anna’s invitation, confirm her email, accept the terms and add a fictional address and phone.', invite ? `activate.html?inv=${invite.token}` : status, active],
    ['Book through the seller link', 'As Anna, share the ice cave tour. Open the link as a guest and submit a booking request for two.', linkSale ? `r.html?o=${linkSale.id}` : openGuest || (active ? guestLink : status), linkSale],
    ['Book through a quote', 'As Anna, make a quote for two on the ice cave tour. Open its guest link and submit a request.', quoteSale ? `r.html?o=${quoteSale.id}` : quote ? `q.html?k=${quote.k}` : active ? tour : status, quoteSale],
    ['Confirm requests and compare sales', requested ? `${requested.ref} is waiting for confirmation. Switch to Marina Admin and accept the request in Sales.` : 'Switch to Marina Admin for Sales, then to Anna for her sales and monthly statement.', 'm/sales.html', paid.length],
  ]
  $('#story').innerHTML = steps.map(([title, copy, href, done], index) => `<li>
    <span class="step-date num">Step ${index + 1}${done ? ' <span class="status confirmed">Done</span>' : ''}</span>
    <div><h3>${title}</h3><p class="dim">${esc(copy)}</p></div>
    <a class="btn" href="${esc(href)}" aria-label="Open step ${index + 1} · ${title}">Open</a></li>`).join('')
  const identities = [...STAFF, ...store.signInAgents().flatMap(agent => {
    const actor = { ...agentIdentity(agent), email: agent.email, sellerId: agent.sellerId }
    const reviewer = store.promotedReviewer(agent)
    return reviewer ? [actor, { ...reviewer, name: reviewer.name + ' · Marina reviewer', email: agent.email }] : [actor]
  })]
  const current = principal()
  $('#identity').textContent = current ? `Signed in as ${current.name}.` : 'This tab is signed out.'
  $('#identities').innerHTML = identities.map((actor, index) => `<li><div><strong>${esc(actor.name)}</strong>
    <p class="meta">${esc(actor.sellerId ? actor.sellerId + ' · ' : '')}${esc(actor.email)}</p></div>
    <button class="btn" data-persona="${index}" aria-label="Switch to ${esc(actor.name)}">${current?.id === actor.id && current.role === actor.role && store.sessionAllowed(current) ? 'Open workspace' : 'Switch'}</button></li>`).join('')
  $$('[data-persona]').forEach(button => button.onclick = event => {
    const { email, sellerId, ...actor } = identities[Number(button.dataset.persona)]
    if (current?.id === actor.id && current.role === actor.role && store.sessionAllowed(current)) { location.href = actor.home; return }
    sheet({
      title: `Switch to ${actor.name}`, opener: button, viaKey: event.detail === 0,
      body: `<form class="flow">${field({ id: 'switch-reason', label: 'Reason for switching', value: 'Prototype walkthrough' })}
        <div><button class="btn primary">Switch identity</button></div></form>`,
      onOpen(dialog) {
        $('form', dialog).onsubmit = e => {
          e.preventDefault()
          const reason = $('#switch-reason', dialog).value.trim()
          if (!reason) return
          store.recordSession('switch', startSession(actor), reason)
          location.href = actor.id === seller?.id && app?.state === 'approved' ? 'index.html#demo-story' : actor.home
        }
      },
    })
  })
  $('#examples').innerHTML = store.demoExamples().map(({ id, label, access }) => `<li><strong>${esc(label)}</strong>
    <div class="actions"><a class="btn" href="m/applications.html?id=${id}">Review case</a>
    ${access ? `<a class="linkbtn" href="${accessUrl('status', access)}">Applicant status</a>` : ''}</div></li>`).join('')
}
$('#reset')?.addEventListener('click', event => sheet({
  title: 'Reset the prototype?', opener: event.currentTarget, viaKey: event.detail === 0,
  body: '<p>This restores the fixtures and clears work created in this browser.</p><button class="btn primary section-follow" id="confirm-reset">Reset prototype data</button>',
  onOpen(dialog) {
    $('#confirm-reset', dialog).onclick = () => {
      store.reset()
      endSession()
      location.replace('index.html')
    }
  },
}))
render()
window.addEventListener('storage', () => { store.refresh(); render() })
window.addEventListener('pageshow', event => { if (event.persisted) location.reload() })
