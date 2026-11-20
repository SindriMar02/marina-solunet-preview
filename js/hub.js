import * as store from './store.js'
import { $, $$, esc, sheet } from './ui.js'
import { accessUrl, field, pilotExample, rememberAccess, root } from './recruitment.js'
import { agentIdentity, endSession, principal, STAFF, startSession } from './session.js'

import { arrow, funnelShell, revealSections, smoothMarketing } from './funnel.js'
import { fillPreviewQr, walkthroughPreviews } from './walkthrough-previews.js'

const iceCave = store.tour('icecave')
const booking = { date: '2026-12-12', startTimeId: 2774517, pax: 2 }
const bookingQuery = new URLSearchParams({ d: booking.date, s: booking.startTimeId, p: booking.pax })
const guestUrl = key => `s.html?k=${encodeURIComponent(key)}&${bookingQuery}`
const annaApplication = 'apply.html?demo=anna&src=linkedin-w1'

function usableReferral(trail) {
  const key = trail.shared?.k
  if (!trail.active || !key) return null
  const { credit, line } = store.preview({ ...booking, tourId: iceCave.id, refKey: key })
  return credit?.id === trail.seller.id && line ? key : null
}

function guestStage(trail, linkSale, shared) {
  const { app, seller, invite, active, open } = trail
  const role = 'Guest'
  const title = 'Book and pay Marina'
  if (linkSale) return { role, title, href: `r.html?o=${linkSale.id}`, copy: 'The guest can open the receipt credited to Anna.' }
  if (!active) {
    const invitation = seller?.state === 'invited' && Date.parse(invite?.expiresAt) > Date.now()
      ? `activate.html?inv=${invite.token}` : null
    return { role, title, href: invitation || (app ? accessUrl('status', app.access) : annaApplication),
      access: app?.access && !invitation ? app.access : null,
      label: invitation ? 'Activate Anna’s account' : app ? 'Check Anna’s application' : 'Start Anna’s application',
      copy: 'Anna needs an active seller account before she can create a tour link and credit this booking.' }
  }
  if (open) return { role, title, href: `pay.html?o=${open.id}`, copy: 'Marina confirmed Anna’s guest booking. The guest can open the payment screen.' }
  const offer = store.agentOffer(iceCave, seller)
  if (offer.error) return { role, title, copy: `Anna’s tour link is unavailable. ${store.saleError(offer.error)}` }
  return { role, title, href: shared ? guestUrl(shared) : null, create: !shared, referral: true,
    label: shared ? undefined : 'Create Anna’s tour link',
    copy: shared
      ? 'The guest requests the tour through Anna’s link. Once Marina confirms the booking, the guest pays Marina.'
      : 'Anna needs a link for this tour. Create it to open the guest booking with her seller number and any discount she set.' }
}

funnelShell('hub')
root.innerHTML = `<div class="well">
  <header class="section editorial-hero">
    <p class="eyebrow">Marina Travel · Sölunet prototype</p>
    <h1>Follow Anna’s first sale.</h1>
    <p class="lede">Anna works at Marina Travel. She applies as an independent agent and sells the winter ice cave tour. Follow her application, then compare the guest, seller and Marina records.</p>
    <div class="actions"><a class="btn primary" href="#demo-story">Start the walkthrough</a><a class="btn" href="shop.html">Open the guest site</a></div>
  </header>
  <section class="section walkthrough" id="demo-story">
    <header class="section-head"><h2>From ad to first sale.</h2><p class="dim">Each stage opens the relevant screen. Return here to continue Anna’s story.</p></header>
    <div class="story-layout">
      <nav class="story-rail" aria-label="Walkthrough stages"><p class="eyebrow">Walkthrough stages</p><ol id="stages"></ol><div class="story-select"><label class="sr" for="stage-select">Jump to a stage</label><select id="stage-select"></select></div></nav>
      <ol class="story" id="story"></ol>
    </div>
  </section>
  <section class="section split" id="act">
    <header class="section-head"><h2>Demo identities</h2>
      <p class="dim" id="identity"></p><p class="meta">The switcher simulates a sign-in in this tab. <a class="linkbtn" href="login.html">Try the hosted sign-in</a></p></header>
    <ul class="work-list" id="identities"></ul>
  </section>
  <section class="section split">
    <header class="section-head"><h2>Filter examples</h2><p class="dim">Use Marina Reviewer or Marina Admin to see the checks and their reasons.</p></header>
    <ul class="work-list" id="examples"></ul>
  </section>
  <section class="section split">
    <header class="section-head"><h2>Rehearsal controls</h2><p class="dim">Use fictional details. Resetting starts the trial again in this browser.</p></header>
    <div class="flow-stack"><div class="actions">${principal()?.role === 'admin' ? '<button class="btn" id="reset" type="button">Reset prototype data</button>' : '<a class="btn" href="#act">Switch to Marina Admin to reset</a>'}</div>
    <p class="meta">The summer Eastfjords scenario remains available through a seeded seller. The winter trial gives Anna access to the ice cave tour.</p></div>
  </section>
</div>`

function render() {
  const trail = store.demoTrail()
  const { app, seller, invite, active, quote, paid, requested, visited } = trail
  const status = accessUrl('status', app?.access)
  const tour = `a/tour.html?t=icecave&${bookingQuery}`
  const linkSale = paid.find(order => order.why !== 'quote')
  const quoteSale = paid.find(order => order.why === 'quote')
  const review = `m/applications.html${app?.tested ? '?id=' + app.id : ''}`
  const shared = usableReferral(trail)
  const { panels, link } = walkthroughPreviews(trail, shared ? guestUrl(shared) : null)
  const sellerAccount = active && store.signInAgents().find(agent => agent.id === seller.id)
  const sellerActor = sellerAccount ? agentIdentity(sellerAccount) : null
  const steps = [
    { short: 'Recruitment', role: 'Applicant', title: 'Read the recruitment ad', copy: 'Anna sees Marina’s invitation on LinkedIn and opens the seller programme.', href: 'ad.html', done: visited },
    { short: 'Application', role: 'Applicant', title: 'Apply and verify', copy: 'Anna tells Marina where and how she sells. She confirms her email before opening the timed test.', href: app ? status : annaApplication, done: app?.verifiedAt },
    { short: 'Test', role: 'Applicant', title: 'Take the timed test', copy: 'Anna answers 12 questions. The system scores the test and decides which applications go to Marina. Take at least three minutes in the demo to avoid an unusually fast attempt being flagged.', href: accessUrl('test', app?.access), done: app?.tested },
    { short: 'Review', role: 'Marina reviewer', title: 'Review the application', copy: 'The reviewer reads the application and test checks, then approves, rejects or takes a closer look. A flagged approval needs an explanation.', href: review, done: app?.state === 'approved', actor: STAFF[0] },
    { short: 'Activation', role: 'Applicant', title: 'Activate the seller account', copy: 'Approval creates Anna’s seller number and invitation. She confirms her email, sets up her account and accepts the terms.', href: invite ? `activate.html?inv=${invite.token}` : status, done: active },
    { short: 'Seller tools', role: 'Seller', title: 'Get a link or a quote', copy: 'Anna opens the winter ice cave tour in her seller hub, shares a link or prepares a quote for two guests.', href: active ? tour : status, done: shared || quote, actor: active ? sellerActor : null, extra: quoteSale ? ['Open the quote receipt', `r.html?o=${quoteSale.id}`] : quote ? ['Open the quote', `q.html?k=${quote.k}`] : null },
    { short: 'Guest booking', ...guestStage(trail, linkSale, shared), done: linkSale || quoteSale,
      extra: active && !shared && !linkSale && !requested ? ['Open Anna’s seller tools', tour, sellerActor] : null },
    { short: 'Commission', role: 'Marina admin', title: 'Compare the sale and statement', copy: requested ? `${requested.ref} is awaiting confirmation in Marina Sales. Then compare the guest receipt with Anna’s sale and monthly statement.` : 'The guest payment credits Anna’s seller number. Marina and Anna see the same sale. The monthly statement lists commission after the tour runs.', href: 'm/sales.html', done: paid.length, actor: STAFF[2], extra: active ? ['Open Anna’s statement', 'a/money.html', sellerActor] : null },
  ]
  $('#stages').innerHTML = steps.map(({ short }, i) => `<li><a href="#stage-${i + 1}"><span>${String(i + 1).padStart(2, '0')}</span>${short}</a></li>`).join('')
  $('#stage-select').innerHTML = steps.map(({ short }, i) => `<option value="stage-${i + 1}">${i + 1}. ${short}</option>`).join('')
  $('#story').innerHTML = steps.map(({ title, role, copy, href, label, create, done, extra }, i) => `<li id="stage-${i + 1}" class="story-stage" data-reveal>
    <article>
      <div class="stage-copy">
        <div class="stage-meta"><span class="role-badge">${role}</span>${done ? ' <span class="status confirmed">Completed</span>' : ''}</div>
        <h3>${title}</h3><p>${esc(copy)}</p>
        ${create ? `<button class="btn primary" type="button" data-stage="${i}">${label} ${arrow}</button>`
          : href ? `<a class="btn" data-stage="${i}" href="${esc(href)}" aria-label="${label || `Open this screen · ${title}`}">${label || 'Open this screen'} ${arrow}</a>` : ''}
        ${i === 6 ? `<p class="meta">${pilotExample}</p><p class="hint err" id="guest-link-error" role="alert"></p>` : ''}
        ${extra ? `<a class="text-action" data-extra="${i}" href="${esc(extra[1])}">${extra[0]} ${arrow}</a>` : ''}
      </div>
      <div class="stage-art" aria-hidden="true">${panels[i]}</div>
    </article></li>`).join('')

  void fillPreviewQr(link, $$('[data-preview-qr]'))

  const plainClick = event => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
  const openScreen = (event, actor, access, guest = false) => {
    if (!plainClick(event)) return
    if (actor) {
      const { email, sellerId, ...identity } = actor
      const current = principal()
      if (current?.id !== identity.id || current.role !== identity.role || !store.sessionAllowed(current)) {
        store.recordSession('switch', startSession(identity), 'Prototype walkthrough')
      }
    } else if (access) rememberAccess(access)
    else if (guest || principal()?.role !== 'applicant') {
      if (principal()) store.recordSession('sign_out', principal())
      endSession()
    }
  }
  $$('[data-stage]').forEach(link => link.onclick = event => {
    const index = Number(link.dataset.stage)
    const { actor, role, href, referral, access: stageAccess } = steps[index]
    if (referral && plainClick(event)) {
      event.preventDefault()
      store.refresh()
      const latest = store.demoTrail()
      const account = latest.active && store.signInAgents().find(agent => agent.id === latest.seller.id)
      try {
        if (!account || store.agentOffer(iceCave, latest.seller).error) throw new Error('not_granted')
        let key = usableReferral(latest)
        if (!key) {
          openScreen(event, agentIdentity(account))
          key = store.createLink(iceCave.id, 'link')
        }
        const { credit, line } = store.preview({ ...booking, tourId: iceCave.id, refKey: key })
        if (credit?.id !== account.id || !line) throw new Error('not_granted')
        openScreen(event, null, null, true)
        location.href = guestUrl(key)
      } catch {
        $('#guest-link-error').textContent = 'Anna’s tour link could not be opened. Check her seller account and try again.'
      }
    } else if (index === 6) {
      openScreen(event, null, stageAccess, true)
    } else if (index === 4 && active && href.startsWith('activate.html')) {
      openScreen(event, sellerActor)
    } else {
      const applicantPage = href === status || (role === 'Applicant' && index > 0 && !href.startsWith('activate.html'))
      const access = applicantPage ? app?.access : null
      openScreen(event, actor, access, role === 'Guest')
    }
  })
  $$('[data-extra]').forEach(link => link.onclick = event => openScreen(event, steps[Number(link.dataset.extra)].extra[2], null, true))
  stageIndex = -1
  updateStage()
  revealSections()
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
    <div class="actions"><a class="btn" data-example href="m/applications.html?id=${id}">Review case</a>
    ${access ? `<a class="linkbtn" href="${accessUrl('status', access)}">Applicant status</a>` : ''}</div></li>`).join('')
  $$('[data-example]').forEach(link => link.onclick = event => {
    if (!['reviewer', 'admin'].includes(principal()?.role)) openScreen(event, STAFF[0])
  })
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
let scrollFrame = 0
let stageIndex = -1
let animatedStage
function updateStage() {
  scrollFrame = 0
  const sections = $$('.story-stage')
  const reference = $('.story-rail').getBoundingClientRect().bottom
  const baseline = Math.max(150, Math.min(reference, innerHeight * .35))
  let reached = -1
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].getBoundingClientRect().top <= baseline) reached = i
  }
  const current = Math.max(0, reached)
  const nextPreview = sections[reached]
  if (animatedStage !== nextPreview) {
    animatedStage?.classList.remove('stage-active')
    nextPreview?.classList.add('stage-active')
    animatedStage = nextPreview
  }
  if (stageIndex === current) return
  stageIndex = current
  $$('#stages a').forEach((link, i) => {
    if (i === current) link.setAttribute('aria-current', 'step')
    else link.removeAttribute('aria-current')
  })
  if ($('#stage-select').selectedIndex !== current) $('#stage-select').selectedIndex = current
}
const scheduleStage = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateStage) }
$('#stage-select').addEventListener('change', event => { location.hash = event.target.value })
window.addEventListener('scroll', scheduleStage, { passive: true })
window.addEventListener('resize', scheduleStage)
render()
smoothMarketing()
window.addEventListener('storage', () => { store.refresh(); render() })
window.addEventListener('pageshow', event => { if (event.persisted) location.reload() })
