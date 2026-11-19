import * as store from './store.js'
import { $, esc, qs, siteShell } from './ui.js'
import { accessKey, accessUrl, field, focusHeading, journey, rememberAccess, root, TERMS, validateFields } from './recruitment.js'

siteShell()
const { guided, source } = journey()
const draftKey = guided ? 'solunet-anna-draft' : 'solunet-application-draft'
const mailKey = guided ? 'solunet-anna-mail' : 'solunet-application-mail'
const read = key => JSON.parse(sessionStorage.getItem(key) || 'null')
const saved = read(draftKey)
const demo = guided ? {
  name: 'Anna', country: 'Iceland', email: store.ANNA_EMAIL, languages: 'Icelandic, English', markets: 'Iceland and English-speaking visitors',
  salesExperience: 'I help guests choose tours.', tourismExperience: 'I work at Marina Travel and am testing the external agent experience.',
  channels: 'Direct recommendations and email',
} : {}
let draft = saved?.fields || demo
const stepIndex = value => Math.max(0, Math.min(2, Number.parseInt(value ?? '0', 10) || 0))
let step = stepIndex(qs('step') ?? saved?.step)
let mail = read(mailKey)
const explicitAccess = qs('access')
if (explicitAccess) mail = null
const steps = ['About you', 'How you sell', 'Confirm']
const fields = [
  [
    { id: 'name', label: 'Name', autocomplete: 'name', max: 120 },
    { id: 'country', label: 'Country', autocomplete: 'country-name', max: 120 },
    { id: 'email', label: 'Email', type: 'email', autocomplete: 'email', max: 254 },
  ],
  [
    { id: 'languages', label: 'Languages', help: 'List the languages you can use with guests.', max: 240 },
    { id: 'markets', label: 'Markets served', help: 'List the places or audiences where you find customers.', max: 240 },
    { id: 'salesExperience', label: 'Sales experience', type: 'textarea', help: 'Tell us what you have sold, or enter “None yet”.' },
    { id: 'tourismExperience', label: 'Tourism experience', type: 'textarea', help: 'Tell us about relevant work, or enter “None yet”.' },
    { id: 'channels', label: 'Sales channels', help: 'For example, referral partners, email or a travel newsletter.', max: 500 },
    { id: 'links', label: 'Links to your sales channels', help: 'Include any sites Marina should review.', required: false },
  ],
]
function saveDraft() { sessionStorage.setItem(draftKey, JSON.stringify({ fields: draft, step })) }
function saveMail() { sessionStorage.setItem(mailKey, JSON.stringify(mail)) }
function showStep(index, moveFocus) {
  step = index
  const url = new URL(location.href)
  url.searchParams.set('step', step)
  history.pushState(null, '', url)
  saveDraft()
  draw(moveFocus)
}

function draw(moveFocus = false) {
  const state = store.intakeState()
  if (qs('mail')) { drawMail(moveFocus); return }
  const existing = guided && store.demoApplication()
  if (existing && store.applicationByAccess(existing.access)) {
    root.innerHTML = `<header><p class="eyebrow">Anna’s application · Demo</p><h1 class="h-page">Continue your application</h1></header>
      <a class="btn primary" href="${accessUrl('status', existing.access)}">Open application status</a>`
    return
  }
  root.innerHTML = `
    <header>
      <p class="eyebrow">Application · Step ${step + 1} of 3</p>
      <h1 class="h-page" tabindex="-1">${steps[step]}</h1>
      <p class="proto">${guided ? 'Anna’s demo details are filled in. You can edit them.' : 'Prototype · Use fictional details. Your draft is saved in this tab.'}</p>
    </header>
    <ol class="flow-progress meta">${steps.map((x, i) => `<li${i === step ? ' aria-current="step"' : ''}>${x}</li>`).join('')}</ol>
    <div id="intake-status" aria-live="polite"></div>
    <form novalidate>
      ${step < 2 ? fields[step].map(f => field({ ...f, value: draft[f.id] })).join('') : `
        <dl class="flow-check review-summary">${fields.flat().filter(f => draft[f.id]).map(f => `<div><dt class="meta">${esc(f.label)}</dt><dd>${esc(draft[f.id])}</dd></div>`).join('')}</dl>
        <div class="flow-stack">
          <h2 class="h-task">How Marina uses your details</h2>
          <p>Your application details and test answers are used to assess your fit for the pilot. Approved applicants receive an invitation at the email they verified.</p>
          <details class="editorial-faq"><summary>Preview the draft agent terms</summary>${TERMS.map(t => `<p class="dim">${t}</p>`).join('')}</details>
          <p class="proto">Verification email and the live Turnstile check are simulated in this prototype.</p>
        </div>`}
      <p class="hint err" role="alert" id="submit-error"></p>
      <div class="actions">
        ${step > 0 ? '<button type="button" class="btn" id="back">Back</button>' : '<a class="btn" href="become.html">Back to recruitment</a>'}
        <button class="btn primary" id="continue" type="submit">${step < 2 ? 'Continue' : state === 'closed' ? 'Join the waitlist' : 'Submit application'}</button>
      </div>
    </form>`
  const form = $('form', root)
  form.addEventListener('input', () => {
    draft = { ...draft, ...Object.fromEntries(new FormData(form)) }
    saveDraft()
  })
  if (step > 0) $('#back').onclick = () => showStep(step - 1, true)
  form.onsubmit = async e => {
    e.preventDefault()
    if (!validateFields(form)) return
    draft = { ...draft, ...Object.fromEntries(new FormData(form)) }
    if (step < 2) { showStep(step + 1, true); return }
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].some(f => f.required && !draft[f.id]?.trim())) { showStep(i, true); validateFields($('form', root)); return }
    }
    const button = $('#continue')
    button.disabled = true
    try {
      const waitlist = store.intakeState() === 'closed'
      const result = await store.createApplication({ ...draft, source }, { guided, waitlist })
      mail = { ...result, waitlist }
      rememberAccess(result.access)
      saveMail()
      sessionStorage.removeItem(draftKey)
      history.replaceState(null, '', `?mail=1${guided ? '&demo=anna' : ''}`)
      drawMail(true)
    } catch (error) {
      updateIntake()
      $('#submit-error').textContent = ({ application_invalid: 'Check your application details and use a complete email address.', intake_closed: 'Intake closed while you were applying. You can join the waitlist.' })[error.message]
        || 'Your draft is saved in this tab. Check the intake status or try again.'
    }
  }
  updateIntake()
  if (moveFocus) focusHeading()
}

function updateIntake() {
  const box = $('#intake-status')
  if (!box) return
  const state = store.intakeState()
  const message = { paused: 'Intake is paused. You can continue editing your draft.', closed: 'Intake is closed. Submit these details to join the waitlist.', capacity: 'This week’s review capacity has been reached. You can continue editing your draft.' }[state]
  box.innerHTML = message ? `<p class="notice">${message}</p>` : ''
  if (step === 2) {
    $('#continue').disabled = state === 'paused' || state === 'capacity'
    $('#continue').textContent = state === 'closed' ? 'Join the waitlist' : 'Submit application'
  }
}

function drawMail(moveFocus) {
  const wait = mail?.waitlist || store.applicationByAccess(explicitAccess)?.state === 'waitlist'
  root.innerHTML = `
    <header>
      <p class="eyebrow">${wait ? 'Waitlist' : 'Email verification'}</p>
      <h1 class="h-page" tabindex="-1">${wait ? 'Waitlist request received' : 'Check your email'}</h1>
      <p>${wait ? 'If this address can join the waitlist, Marina will contact it when intake reopens.' : 'If this address can continue, Marina will send a verification link. Use that link to open your test rules.'}</p>
      <p class="proto">Prototype · Email delivery is simulated.</p>
    </header>
    <p id="mail-error" class="hint err" role="alert"></p>
    <div class="actions">
      ${wait ? '' : '<button class="btn primary" id="verify">Open the verification link (demo)</button>'}
      <a class="btn" href="${esc(accessUrl('status', mail?.access || explicitAccess))}">Application status</a>
    </div>
    <div id="recovery"></div>`
  if (!wait) $('#verify').onclick = verify
  if (moveFocus) focusHeading()
}

async function verify() {
  const button = $('#verify')
  button.disabled = true
  const access = explicitAccess || (mail ? mail.access : accessKey())
  const current = store.applicationByAccess(access)
  try {
    let verified = current?.verifiedAt ? access : null
    if (!verified) verified = await store.verifyEmail(mail?.verify || current?.verify)
    rememberAccess(verified)
    sessionStorage.removeItem(mailKey)
    location.href = accessUrl('test', verified)
  } catch {
    $('#mail-error').textContent = 'This verification link is unavailable or expired. Open the latest link from your inbox, or request a new one here.'
    const recovery = $('#recovery')
    recovery.innerHTML = '<button type="button" class="linkbtn" id="resend">Request a new verification link</button><p class="hint" role="status"></p>'
    $('#resend').onclick = async () => {
      try {
        const verify = await store.resendVerification(access)
        mail = { ...mail, access, verify }
        saveMail()
        button.disabled = false
      } catch {
        button.disabled = false
      }
      $('[role="status"]', recovery).textContent = 'If this address can continue, a new link is available. Try opening the verification link again.'
    }
  }
}

window.addEventListener('popstate', () => {
  step = stepIndex(qs('step'))
  draw(true)
})
window.addEventListener('storage', () => { store.refresh(); updateIntake() })
window.addEventListener('pageshow', e => { if (e.persisted) { store.refresh(); updateIntake() } })
if (!qs('mail') && !qs('step') && step > 0) {
  const url = new URL(location.href)
  url.searchParams.set('step', step)
  history.replaceState(null, '', url)
}
draw()
