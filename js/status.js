import * as store from './store.js'
import { $, esc, siteShell } from './ui.js'
import { recruitmentMotion, guardApplicant, accessKey, accessUrl, field, focusHeading, rememberAccess, root, timeTag, validateFields } from './recruitment.js'

const access = accessKey()
guardApplicant(access)
siteShell()
recruitmentMotion()
const messages = {
  signed: 'Your seller account is active.',
  submitted: 'Verify your email to open the test.',
  verified: 'Your email is verified. Your test is ready.',
  eligible: 'The Marina review team will read your application.',
  market_hold: 'Marina is holding applications for this market while it checks launch readiness.',
  look_closer: 'The Marina review team is taking a closer look.',
  not_qualified: 'Your application did not move into the review queue. You can ask Marina to reconsider.',
  timed_out: 'Your test ended before submission. You can ask Marina to review what happened.',
  approved: 'You have been approved. Open your invitation to set up your account.',
  rejected: 'Marina has made a decision on your application. You can ask for reconsideration.',
  waitlist: 'Your details are on the waitlist. Marina will contact you when intake reopens.',
  reconsideration: 'Your request for reconsideration has reached the Marina review team.',
}

function render(moveFocus = false) {
  const app = store.applicationByAccess(access)
  if (!app) {
    root.innerHTML = `<header><p class="eyebrow">Application status</p><h1 class="h-page" tabindex="-1">This status link is unavailable</h1>
      <p>Open the private status link from your application email. Demo links are available for 30 days in the browser where you applied.</p></header>
      <div class="actions"><a class="btn" href="apply.html">Open the application</a><a class="btn" href="index.html">Back to the demo</a></div>`
    return
  }
  rememberAccess(access)
  const attempt = app.attempt?.fixtureOnly ? null : app.attempt
  const seller = store.agent(app.agentId)
  const active = Boolean(seller?.activatedAt)
  const invite = store.invitationFor(app)
  const canOpen = invite && Date.parse(invite.expiresAt) > Date.now()
  const canLeaveWaitlist = app.state === 'waitlist' && store.intakeState() === 'open'
  const canAppeal = ['rejected', 'not_qualified', 'timed_out'].includes(app.state)
  const record = [
    ['Application received', app.createdAt, app.state === 'waitlist' ? 'Waitlist request' : 'Received'],
    ['Email verified', app.verifiedAt, app.state === 'waitlist' ? 'On the waitlist' : 'Awaiting verification'],
    ['Test done', attempt?.submittedAt || attempt?.expiredAt, attempt?.expiredAt ? 'Time expired' : attempt?.submittedAt ? 'Received' : attempt?.startedAt ? 'In progress' : 'Awaiting test'],
    ['In review', app.reviewAt, app.reviewAt ? 'Marina review team' : 'Awaiting review'],
    ['Decision', app.decidedAt || (app.state === 'not_qualified' ? attempt?.submittedAt : null), ({ not_qualified: 'No shortlist place', approved: 'Approved', rejected: 'Rejected', look_closer: 'Taking a closer look', reconsideration: 'Reconsideration requested', waitlist: 'Waitlisted' })[app.state] || 'Pending'],
  ]
  root.innerHTML = `
    <header><p class="eyebrow">Application status</p><h1 class="h-page" tabindex="-1">${esc(app.name)}</h1>
      <p>${canLeaveWaitlist ? 'Intake has reopened. Continue with the details you already submitted.' : messages[active ? 'signed' : app.state]}</p>
      ${['eligible', 'look_closer', 'reconsideration'].includes(app.state) ? `<p class="meta">Expected reply · ${timeTag(app.replyBy)} (demo estimate)</p>` : ''}
      <p class="proto">Prototype · Application details live in this browser.</p>
    </header>
    <ol class="formula status-history">
      ${record.map(([label, at, detail]) => `<li><strong>${label}</strong><span class="status ${at ? 'confirmed' : 'pending'}">${at ? timeTag(at) : 'Pending'}</span>
        <span class="why">${esc(detail)}</span></li>`).join('')}
    </ol>
    ${app.state === 'not_qualified' && attempt ? `<p class="notice">Your test scored ${attempt.score}/100. The pass mark for your attempt was ${attempt.threshold}/100.</p>` : ''}
    ${['rejected', 'reconsideration'].includes(app.state) && app.reason ? `<p class="notice">Reason category · ${esc(app.reason)}</p>` : ''}
    <div class="actions">
      ${app.state === 'submitted' ? `<a class="btn primary" href="apply.html?mail=1&access=${encodeURIComponent(access)}">Open verification email (demo)</a>` : ''}
      ${canLeaveWaitlist ? '<button type="button" class="btn primary" id="continue-waitlist">Continue your application</button>' : ''}
      ${app.state === 'verified' ? `<a class="btn primary" href="${accessUrl('test', access)}">${attempt ? 'Resume the test' : 'Read the test rules'}</a>` : ''}
      ${active && invite ? `<a class="btn primary" href="login.html?next=a%2Fsell.html">Sign in to your portal</a>` : ''}
      ${app.state === 'approved' && !active ? `${canOpen ? `<a class="btn primary" href="activate.html?inv=${invite.token}">Open your invitation</a>` : ''}
        <button type="button" class="btn" id="recover">Request a new invitation (demo)</button>` : ''}
      <a class="linkbtn" href="index.html#demo-story">Back to the demo</a>
    </div>
    <p class="hint err" role="alert" id="status-error"></p>
    ${canAppeal ? `<details><summary>Ask for reconsideration</summary><form novalidate>
      ${field({ id: 'appeal', label: 'What would you like Marina to reconsider?', type: 'textarea' })}
      <div><button class="btn primary" type="submit">Send to Marina (demo)</button></div>
    </form></details>` : ''}`
  const waitlist = $('#continue-waitlist')
  if (waitlist) waitlist.onclick = async () => {
    waitlist.disabled = true
    try {
      await store.releaseWaitlist(access)
      location.href = `apply.html?mail=1&access=${encodeURIComponent(access)}`
    } catch {
      $('#status-error').textContent = 'Intake changed while you were here. Your waitlist request is still saved.'
      waitlist.disabled = false
    }
  }
  const recover = $('#recover')
  if (recover) recover.onclick = async () => {
    recover.disabled = true
    try { const newInvite = await store.recoverInvitation(access); location.href = `activate.html?inv=${newInvite.token}` }
    catch { $('#status-error').textContent = 'The invitation is unavailable. Please check your status again.'; recover.disabled = false }
  }
  const form = $('form', root)
  if (form) form.onsubmit = async event => {
    event.preventDefault()
    if (!validateFields(form)) return
    try { await store.reconsider(access, $('#appeal').value); render(true) }
    catch { $('#status-error').textContent = 'Your request could not be sent. Check your status and try again.' }
  }
  if (moveFocus) focusHeading()
}
render()
window.addEventListener('storage', () => {
  if (!root.contains(document.activeElement) || document.activeElement.tagName !== 'TEXTAREA') render()
})
window.addEventListener('pageshow', e => { if (e.persisted) { store.refresh(); render() } })
