import { applicantSession, guardPage, principal } from './session.js'
import { $, $$, esc, qs, isk, stamp } from './ui.js'
import { ANNA_EMAIL, applicantLink, priceLine, TERMS_VERSION } from './store.js'

export const annaProfile = {
  name: 'Anna', country: 'Iceland', email: ANNA_EMAIL, languages: 'Icelandic, English', markets: 'Iceland and English-speaking visitors',
  salesExperience: 'I help guests choose tours.', tourismExperience: 'I work at Marina Travel and am testing the external agent experience.',
  channels: 'Direct recommendations and email',
}

export const accessUrl = (page, access) => `${page}.html${access ? `?access=${encodeURIComponent(access)}` : ''}`
export function accessKey() {
  const access = qs('access') || sessionStorage.getItem('solunet-access')
  if (qs('access')) rememberAccess(access)
  return access
}
export function rememberAccess(access) {
  const own = applicantLink(access)
  if (own) {
    applicantSession(own.id)
    sessionStorage.setItem('solunet-access', access)
  }
}
export function guardApplicant(access) {
  const link = applicantLink(access)
  if (!link || !principal()) return
  guardPage(['applicant'], actor => actor.id === link.id && Boolean(applicantLink(access)))
}
export const timeText = date => `${stamp(date)} Iceland time`
export const timeTag = date => `<time datetime="${esc(date)}">${esc(timeText(date))}</time>`
export const root = $('#main')
export const focusHeading = (area = root) => area.querySelector('h1, h2, legend')?.focus()
export const field = ({ id, label, value = '', type = 'text', required = true, help = '', autocomplete = 'off', max = 1500 }) => `
  <div class="field">
    <label for="${id}">${esc(label)}${required ? '' : ' (optional)'}</label>
    ${type === 'textarea'
      ? `<textarea class="input" id="${id}" name="${id}" maxlength="${max}" ${required ? 'required' : ''} aria-describedby="${id}-help ${id}-error">${esc(value)}</textarea>`
      : `<input class="input" id="${id}" name="${id}" type="${type}" value="${esc(value)}" maxlength="${max}" autocomplete="${autocomplete}" ${required ? 'required' : ''} aria-describedby="${id}-help ${id}-error">`}
    <p id="${id}-help" class="hint">${esc(help)}</p><p id="${id}-error" class="hint err" role="alert"></p>
  </div>`

function validateField(input) {
  const error = input.form && $('#' + input.id + '-error', input.form)
  if (!error) return true
  const emailInvalid = input.type === 'email' && input.value
    && !/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(input.value.trim())
  const label = (input.labels?.[0]?.textContent || 'this field').trim().replace(/\s*\(.*\)$/, '')
  const missing = input.required && (input.type === 'checkbox' ? !input.checked : !input.value.trim())
  let message = ''
  if (missing) message = input.dataset.requiredMessage || `Add your ${label.charAt(0).toLowerCase() + label.slice(1)}.`
  else if (input.validity.typeMismatch || emailInvalid) message = 'Enter a valid email address.'
  else if (input.minLength > 0 && input.value && input.value.length < input.minLength) message = `Enter at least ${input.minLength} characters.`
  if (error.textContent !== message) error.textContent = message
  if (message) input.setAttribute('aria-invalid', 'true')
  else input.removeAttribute('aria-invalid')
  return !message
}

export function validateFields(form) {
  const invalid = $$('input, textarea', form).filter(input => !validateField(input))
  invalid[0]?.focus()
  return !invalid.length
}

root?.addEventListener('focusout', event => {
  // Submit handles validation itself. A blur error can move the button between pointer down and click.
  if (event.relatedTarget?.matches('button, a')) return
  if (event.target.matches('.field input, .field textarea') && event.target.closest('.application-content, .identity-panel')) validateField(event.target)
})
root?.addEventListener('input', event => {
  if (event.target.matches('input[aria-invalid], textarea[aria-invalid]') && event.target.closest('.application-content, .identity-panel')) validateField(event.target)
})

export function answerRows(item, { name = item.id, choice, headingId } = {}) {
  return `<fieldset class="answer-set">
    <legend class="h-task"${headingId ? ` id="${headingId}" tabindex="-1"` : ''}>${esc(item.prompt)}</legend>
    ${item.options.map((option, index) => `<label class="answer">
      <input type="radio" name="${esc(name)}" value="${index}"${choice === index ? ' checked' : ''}>
      <span class="meta num" aria-hidden="true">${index + 1}</span><span>${esc(option)}</span>
    </label>`).join('')}
  </fieldset>`
}

export function selectNumberKey(event, area) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !/^[1-4]$/.test(event.key)) return
  const radio = $(`input[type="radio"][value="${Number(event.key) - 1}"]`, area)
  if (radio) { event.preventDefault(); radio.focus(); radio.click() }
}

export const TEST_CATEGORIES = 'selling, product knowledge, customer handling, tourism basics and sales scenarios'
export const TERMS = [
  'You choose where, when and how you find customers. Income is commission-based and there is no guaranteed income. You are responsible for your own taxes.',
  'You sell as an independent agent. Marina Travel runs the tours, sets prices and availability, takes guest payments through Bókun and supports the guest.',
  'Use Marina-approved prices, sales text and images. Send guests to Marina for payment and for the cancellation terms that apply to their booking.',
  'Commission is calculated on the eligible list price before VAT. A guest discount uses part of the agent’s commission rate. Commission is earned only on paid tours that run, and is paid monthly after the tour date. Each tour’s cancellation rules apply.',
  'The pilot screens use simulated bookings, payments and invitations. Bank details will be collected securely before the first payout, subject to Marina’s approval of the process.',
]
export const termsDownload = () => URL.createObjectURL(new Blob([
  `Marina Travel · Draft agent terms · ${TERMS_VERSION}\n\n${TERMS.join('\n\n')}\n`,
], { type: 'text/plain' }))

export const worked = priceLine({ listGrossMinor: 111000, vatBps: 1100, commissionBps: 1700, discountBps: 500, maxDiscountBps: 500 })
export const workedFormula = () => `<ol class="formula">
  <li><span>Eligible tour list price</span><span class="v">${isk(worked.listGrossMinor)}</span></li>
  <li><span>List price before VAT</span><span class="v">${isk(worked.listNetMinor)}</span><span class="why">VAT at 11% is illustrative.</span></li>
  <li><span>Agent rate after a five-point discount</span><span class="v">17% − 5% = 12%</span></li>
  <li class="sum"><span>Agent earns</span><span class="v">${isk(worked.agentAmountMinor)}</span><span class="why">12% of ${isk(worked.listNetMinor)} before VAT.</span></li>
  <li><span>Guest pays Marina</span><span class="v">${isk(worked.customerGrossMinor)}</span><span class="why">Marina keeps the remainder before VAT and operating costs.</span></li>
</ol>`

export function journey() {
  const guided = qs('demo') === 'anna'
  return { guided, source: (qs('src') || (guided ? 'anna-demo' : '')).slice(0, 120) }
}

export function journeyUrl(page, { guided, source }) {
  const params = new URLSearchParams()
  if (guided) params.set('demo', 'anna')
  if (source) params.set('src', source)
  return `${page}.html${params.size ? '?' + params : ''}`
}

export const pilotExample = 'Pilot example: Marina confirms the pilot departure.'
export const refundPolicy = 'Marina can avoid a processing fee on eligible refunds while Teya holds the payment. Your tour’s cancellation rules determine the refund.'
