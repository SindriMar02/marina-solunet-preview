import { $, $$, esc, qs, isk, stamp } from './ui.js'
import { priceLine, TERMS_VERSION } from './store.js'

export const accessUrl = (page, access) => `${page}.html${access ? `?access=${encodeURIComponent(access)}` : ''}`
export const accessKey = () => qs('access') || sessionStorage.getItem('solunet-access')
export const rememberAccess = access => { if (access) sessionStorage.setItem('solunet-access', access) }
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

export function validateFields(form) {
  let first
  for (const input of $$('input, textarea', form)) {
    const error = $('#' + input.id + '-error', form)
    if (!error) continue
    const emailInvalid = input.type === 'email' && input.value
      && !/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(input.value.trim())
    // Say what is missing in the field's own words: "Add your name", not a generic "required".
    const label = (form.querySelector(`label[for="${input.id}"]`)?.textContent || 'this field').trim().replace(/\s*\(.*\)$/, '')
    const defaultMessage = input.required && !input.value.trim() ? `Add your ${label.charAt(0).toLowerCase() + label.slice(1)}.`
      : input.validity.typeMismatch || emailInvalid ? 'Enter a valid email address.' : ''
    error.textContent = defaultMessage
    if (defaultMessage) {
      input.setAttribute('aria-invalid', 'true')
      first ||= input
    } else input.removeAttribute('aria-invalid')
  }
  first?.focus()
  return !first
}

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
  'You sell as an independent agent. Marina Travel runs the tours, sets prices and availability, takes guest payments through Bókun and supports the guest.',
  'Use Marina-approved prices, sales text and images. Send guests to Marina for payment and for the cancellation terms that apply to their booking.',
  'Commission is calculated on the eligible list price before VAT. A guest discount uses part of the agent’s commission rate. Refunds can reduce the commission.',
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
