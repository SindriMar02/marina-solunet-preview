import * as store from './store.js'
import { $, esc, qs, siteShell, copy, qrSvg } from './ui.js'
import { accessUrl, field, focusHeading, root, TERMS, termsDownload, timeTag, validateFields } from './recruitment.js'

siteShell()
const key = qs('inv')
const resetUrl = 'index.html#demo-story'
const termsUrl = termsDownload()
let step = 0
let email = ''
let version = ''

function render(moveFocus = false) {
  const invite = store.invitation(key)
  const app = store.application(invite?.appId)
  const seller = store.agent(invite?.agentId)
  if (invite?.consumedAt && seller?.state === 'active') { void ready(app, seller, moveFocus); return }
  if (!app || !seller || Date.parse(invite.expiresAt) <= Date.now()) {
    root.innerHTML = `<header><p class="eyebrow">Seller activation</p><h1 class="h-page" tabindex="-1">${key ? 'This invitation is unavailable' : 'Set up your seller account'}</h1>
      <p>${key ? 'Open your application status to request a fresh invitation.' : 'Once Marina approves an application, the invitation opens your seller setup with your assigned seller number.'}</p></header>
      <div class="actions">
        <a class="btn primary" href="${esc(accessUrl('status', app?.access))}">Check application status</a>
        <a class="btn" href="m/applications.html?id=fixture-9-0">See a demo application</a>
      </div>`
  } else if (step === 0) {
    root.innerHTML = `<header><p class="eyebrow">Invitation · ${esc(seller.sellerId)}</p><h1 class="h-page" tabindex="-1">Welcome to Sölunet, ${esc(app.name)}</h1>
      <p>Sign in with the email that received this invitation. The link is valid until ${timeTag(invite.expiresAt)}.</p>
      <p class="proto">Prototype · This screen simulates Marina’s hosted login.</p></header>
      <form novalidate>
        ${field({ id: 'email', type: 'email', label: 'Approved email', value: email || app.email, autocomplete: 'email', max: 254 })}
        <div><button class="btn primary" type="submit">Sign in with Marina’s login (demo)</button></div>
      </form>`
    $('form', root).onsubmit = event => {
      event.preventDefault()
      if (!validateFields(event.currentTarget)) return
      const entered = $('#email').value.trim().toLowerCase()
      if (entered !== app.email) {
        $('#email-error').textContent = 'Use the email address Marina invited.'
        $('#email').setAttribute('aria-invalid', 'true')
        $('#email').focus()
        return
      }
      email = entered
      advance(1)
    }
  } else if (step === 1) {
    root.innerHTML = `<header><p class="eyebrow">Seller activation · Step 2 of 3</p><h1 class="h-page" tabindex="-1">Read the agent terms</h1>
      <p class="meta">Draft version ${store.TERMS_VERSION}</p></header>
      <div class="paper">${TERMS.map(term => `<p>${term}</p>`).join('')}</div>
      <div><a class="linkbtn" href="${esc(termsUrl)}" download="marina-agent-terms-${store.TERMS_VERSION}.txt">Download this version</a></div>
      <form>
        <label class="checkline"><input type="checkbox" id="accept" required ${version ? 'checked' : ''}>I accept the draft terms, version ${store.TERMS_VERSION}.</label>
        <div class="actions"><button type="button" class="btn" id="back">Back</button><button class="btn primary" type="submit">Continue to profile</button></div>
      </form>`
    $('#back').onclick = () => advance(0)
    $('form', root).onsubmit = event => { event.preventDefault(); version = store.TERMS_VERSION; advance(2) }
  } else {
    root.innerHTML = `<header><p class="eyebrow">Seller activation · Step 3 of 3</p><h1 class="h-page" tabindex="-1">Complete your profile</h1>
      <p>Bank details will be collected securely before your first payout, subject to Marina’s approval of the process.</p>
      <p class="proto">Prototype · Use a fictional address and phone number.</p></header>
      <form novalidate>
        ${field({ id: 'address', label: 'Address', type: 'textarea' })}
        ${field({ id: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', max: 80 })}
        <p class="hint err" id="activation-error" role="alert"></p>
        <div class="actions"><button type="button" class="btn" id="back">Back</button><button class="btn primary" type="submit">Activate my account</button></div>
      </form>`
    $('#back').onclick = () => advance(1)
    $('form', root).onsubmit = async event => {
      event.preventDefault()
      if (!validateFields(event.currentTarget)) return
      const button = event.submitter
      button.disabled = true
      try {
        await store.activate(key, { email, emailVerified: true, termsVersion: version, address: $('#address').value, phone: $('#phone').value })
        render(true)
      } catch (error) {
        $('#activation-error').textContent = error.message === 'invite_invalid'
          ? 'This invitation has expired or was already used. Check your application status.'
          : 'Your profile could not be saved. Check your details and try again.'
        button.disabled = false
      }
    }
  }
  if (moveFocus) focusHeading()
}

function advance(next) { step = next; render(true) }

async function ready(app, seller, moveFocus) {
  const url = new URL(`s.html?k=${app.linkKey}`, location.href).href
  root.innerHTML = `<header><p class="eyebrow">Seller account · Active</p><h1 class="h-page" tabindex="-1">Your link is ready</h1>
    <p>Your seller number is <strong class="mt">${esc(seller.sellerId)}</strong>. Share your personal link or QR code to credit tour bookings to your account.</p></header>
    <div class="qr" id="qr" aria-label="QR code for your personal seller link"></div>
    <a class="url linkbtn" href="${esc(url)}">${esc(url)}</a>
    <div class="actions">
      <a class="btn primary" href="a/sell.html" id="portal">Open your portal</a>
      <button class="btn" id="copy">Copy your link</button>
      <a class="linkbtn" href="${resetUrl}">Back to the demo</a>
    </div>
    <p class="proto">Demo links credit bookings in this browser. Use the printed link if the QR service is unavailable.</p>`
  $('#portal').onclick = () => { store.refresh(); store.switchAgent(seller.id) }
  $('#copy').onclick = () => copy(url, 'Seller link copied')
  if (moveFocus) focusHeading()
  const qr = $('#qr')
  qr.innerHTML = await qrSvg(url)
}

render()
