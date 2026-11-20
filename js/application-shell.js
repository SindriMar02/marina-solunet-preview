import { $, $$ } from './ui.js'
import { funnelShell } from './funnel.js'
import { root } from './recruitment.js'

const steps = ['About you', 'How you sell', 'Agreement', 'Test', 'Review', 'Your account']
const guidance = [
  ['Tell us how you sell, then confirm your email and take the seller test.', 'Marina uses your name and country to identify your application and your email to send verification and status updates.'],
  ['Review your application and confirm your email. The seller test comes next.', 'Your languages, markets and experience help Marina understand which guests you can serve and how you reach them.'],
  ['Confirm your email to unlock the seller test. The system scores your answers automatically.', 'We ask you to acknowledge how Marina uses your application details for eligibility and review.'],
  ['The system scores your test as soon as you submit. Marina staff review applications that pass the automatic checks.', 'The questions cover tour knowledge, selling and how you handle common guest situations.'],
  ['Marina staff review qualified applications. Approval automatically creates your account and MT seller number and sends your activation email.', 'Marina reviews your application and the test checks before giving you access to sell its tours.'],
  ['Marina has created your account and MT seller number. Confirm your email and complete your profile to access your hub.', 'Marina asks for bank details only after approval, so it can pay your commission. Marina never asks for card details during seller setup.'],
]
let rail
let progress
let context

export function applicationShell() {
  funnelShell()
  document.body.classList.add('application')
  root.className = 'application-content flow'
  const layout = document.createElement('div')
  layout.className = 'application-layout well'
  root.before(layout)
  layout.innerHTML = `<aside class="application-rail" aria-label="Application progress">
    <p class="rail-title">Seller application</p>
    <div class="application-step-label"></div>
    <div class="application-track"><div></div></div>
    <ol class="application-steps">${steps.map((step, i) => `<li><span class="step-number" aria-hidden="true">${i + 1}</span>${step}<span class="sr step-state"></span></li>`).join('')}</ol>
    <div class="rail-preview"><p>Seller profile</p><div class="rail-person"><span class="avatar" aria-hidden="true"></span><div><strong></strong><span></span></div></div><p class="rail-languages"></p></div>
  </aside>
  <div class="application-pane">
    <aside class="application-context" aria-label="About this step">
      <div><h2>What happens next</h2><p></p></div>
      <div><h2>Why we ask this</h2><p></p></div>
    </aside>
  </div>`
  $('.application-pane', layout).prepend(root)
  rail = $('.application-rail', layout)
  progress = $$('.application-steps li', rail)
  context = $$('.application-context p', layout)
}

export function sellerPreview(profile = {}, sellerId, editable = false) {
  profile ||= {}

  const name = profile.name?.trim()
  const code = [profile.country?.trim(), sellerId].filter(Boolean).join(' · ')
  $('.rail-person strong', rail).textContent = name || 'Your name'
  $('.rail-person .avatar', rail).textContent = name ? Array.from(name)[0].toLocaleUpperCase() : '–'
  const languageText = profile.languages?.trim()
  const detail = $('.rail-person div span', rail)
  const languages = $('.rail-languages', rail)
  detail.textContent = code || 'Country'
  detail.hidden = !editable && !code
  languages.textContent = languageText || 'Languages'
  languages.hidden = !editable && !languageText
  $('.rail-preview', rail).hidden = !editable && !name
}

export function applicationStep(index, profile, sellerId, { complete = false, known = true, editable = false } = {}) {
  progress.forEach((node, i) => {
    const done = complete || (known && i < index)
    node.classList.toggle('done', done)
    if (i === index && !complete) node.setAttribute('aria-current', 'step')
    else node.removeAttribute('aria-current')
    $('.step-number', node).textContent = done ? '✓' : i + 1
    $('.step-state', node).textContent = done ? ', completed' : ''
  })
  $('.application-step-label', rail).textContent = complete ? 'Application complete' : !known ? steps[index] : `Step ${index + 1} of ${steps.length} · ${steps[index]}`
  $('.application-track > div', rail).style.transform = `scaleX(${(complete ? steps.length : known ? index + 1 : 0) / steps.length})`
  const [next, why] = guidance[index]
  context[0].textContent = complete
    ? 'Open your seller hub to find tours and share your personal link or QR code.'
    : !known && index === 5
      ? 'After Marina approves your application, the system creates your account and MT seller number automatically and sends you an invitation.'
      : next
  context[1].textContent = why
  sellerPreview(profile, sellerId, editable)
}
