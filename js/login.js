import { funnelShell } from './funnel.js'
import { $, esc } from './ui.js'
import { field, focusHeading, root, validateFields } from './recruitment.js'
import { agentIdentity, localDestination, readSession, STAFF, startSession } from './session.js'
import { promotedReviewer, recordSession, signInAgents } from './store.js'

funnelShell()
document.body.classList.add('identity-page')
const params = new URLSearchParams(location.search)
const notice = params.has('expired') || readSession().expired ? 'Your session expired. Sign in again to continue.'
  : params.has('signedout') ? 'You’re signed out.' : ''
const identities = [...STAFF, ...signInAgents().map(agent => ({ ...agentIdentity(agent), email: agent.email }))]
let email = ''
let identity

function draw(step = 'identify') {
  const heading = { workspace: 'Choose your workspace', identify: 'Sign in to Sölunet', link: 'Check your inbox', mfa: 'Confirm it’s you' }[step]
  root.innerHTML = `<section class="identity-panel flow-stack">
    <p class="eyebrow">Prototype sign-in</p><h1 class="p-h2" tabindex="-1">${heading}</h1>
    ${notice ? `<p class="notice" role="status">${notice}</p>` : ''}
    ${step === 'workspace' ? '<div class="actions"><button class="btn primary" id="seller-workspace">Seller portal</button><button class="btn" id="staff-workspace">Marina review</button></div>' : step === 'identify' ? `<p class="dim">Use a fictional account to open your agent or Marina workspace.</p>
      <form class="flow-stack" novalidate>
        ${field({ id: 'email', label: 'Email address', type: 'email', value: email, autocomplete: 'email', max: 254 })}
        <div class="actions"><button class="btn primary" value="link">Send sign-in link</button>
        <button class="btn" value="passkey">Continue with passkey</button></div>
      </form>` : `<p class="dim">${step === 'link' ? `Open the simulated sign-in link sent to ${esc(email)}.` : 'Approve the simulated second-factor prompt for this staff account.'}</p>
      <div class="actions"><button class="btn primary" id="continue">${step === 'link' ? 'Open sign-in link' : 'Confirm staff sign-in'}</button>
      <button class="btn" id="back">Back</button></div>`}
      <p class="meta">Applicants open their private application link. <a class="linkbtn" href="index.html#act">See demo identities</a></p>
    </section>`
  if (step === 'identify') $('form', root).onsubmit = event => {
    event.preventDefault()
    if (!validateFields(event.currentTarget)) return
    email = $('#email').value.trim().toLowerCase()
    identity = identities.find(candidate => candidate.email === email)
    if (!identity) {
      $('#email-error').textContent = 'Use an active fictional seller or staff email from the demo hub.'
      $('#email').setAttribute('aria-invalid', 'true')
      $('#email').focus()
      return
    }
    if (event.submitter?.value === 'passkey') continueSignIn()
    else draw('link')
  }
  else if (step === 'workspace') {
    $('#seller-workspace').onclick = finish
    $('#staff-workspace').onclick = () => { identity = promotedReviewer(identity); draw('mfa') }
    focusHeading()
  }
  else {
    $('#continue').onclick = step === 'mfa' ? finish : continueSignIn
    $('#back').onclick = () => { draw(); focusHeading() }
    focusHeading()
  }
}
function continueSignIn() {
  if (identity.role !== 'agent') draw('mfa')
  else if (promotedReviewer(identity)) draw('workspace')
  else finish()
}
function finish() {
  const { email: _email, ...actor } = identity
  recordSession('sign_in', startSession(actor))
  location.replace(localDestination(params.get('next'), actor.home))
}
draw()
