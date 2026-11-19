import { $, $$, adminShell, esc, sheet } from './ui.js'
import { field, root, validateFields } from './recruitment.js'
import { principal } from './session.js'
import { appendAuditCorrection, auditTrail } from './store.js'
import { exportSheet, ledger, liveReports } from './reporting.js'

adminShell('Audit log', ['admin', 'oversight'])
const readOnly = principal().role === 'oversight'
root.classList.add('work-inner')
root.innerHTML = `<header class="work-heading"><p class="eyebrow">${readOnly ? 'Codebear · Read-only evidence' : 'Marina Travel · Records'}</p>
  <h1 class="p-h2">Audit log</h1><p class="dim">${readOnly ? 'Review dated events and policy versions with personal details redacted.' : 'Review changes, overrides and export history by actor, action and UTC date.'}</p></header>
  <form class="work-filters" id="audit-filters" aria-label="Audit filters">
    <label>Actor<select name="actor" class="input"></select></label>
    <label>Action<select name="action" class="input"></select></label>
    <label>From<input name="from" type="date" class="input"></label>
    <label>Through<input name="to" type="date" class="input"></label>
  </form>
  ${readOnly ? '' : '<button type="button" class="btn" id="export">Preview CSV</button>'}
  <p class="meta" role="status" id="audit-result" tabindex="-1"></p>
  <section class="work-section" aria-label="Audit events" id="events"></section>`
const form = $('#audit-filters')
const filters = () => Object.fromEntries(new FormData(form))
let limit = 50
function draw() {
  const all = auditTrail()
  for (const [name, label] of [['actor', 'All actors'], ['action', 'All actions']]) {
    const control = form.elements[name]
    const value = control.value
    control.innerHTML = `<option value="">${label}</option>` + [...new Set(all.map(row => row[name]))].filter(Boolean).sort()
      .map(key => `<option value="${esc(key)}">${esc(key)}</option>`).join('')
    control.value = value
  }
  const rows = auditTrail(filters())
  const brief = value => esc(typeof value === 'object' && value ? JSON.stringify(value) : value)
  $('#events').innerHTML = `<p class="meta" role="status">${rows.length} events</p><div data-ledger-reveal>${ledger(
    ['Time (UTC)', 'Actor', 'Action / case', 'Evidence'], rows.slice(0, limit).map((event, index) => [
      esc(event.at.slice(0, 19).replace('T', ' ')), `${esc(event.actor)} <div class="meta">${esc(event.role)}</div>`,
      `${esc(event.action)}<div class="meta">${esc(event.subject)}</div>`,
      `<span class="meta">Policy v${esc(event.policyVersion ?? '—')}</span><p>${esc(event.reason || event.detail)}</p>
      ${event.count != null ? `<p>${event.count} records</p><p class="meta">${brief(event.filters)}</p>` : ''}
      ${event.old != null || event.new != null ? `<details><summary>Show change</summary><p>Before · ${brief(event.old)}</p><p>After · ${brief(event.new)}</p></details>` : ''}
      <p class="meta">${esc(event.id)}</p>
      ${event.corrects ? `<p class="meta">Corrects ${esc(event.corrects)}</p>` : ''}
      ${readOnly ? '' : `<button class="linkbtn" type="button" data-correct="${index}">Append correction</button>`}`,
    ]))}</div>${rows.length > limit ? '<button class="btn" id="more">Show more events</button>' : ''}`
  $$('[data-correct]').forEach(button => button.onclick = click => correction(click, rows[Number(button.dataset.correct)]))
  $('#more')?.addEventListener('click', () => { limit += 50; draw(); ($('#more') || form.elements.actor).focus() })
}
function correction(event, record) {
  sheet({
    title: 'Append an audit correction', opener: event.currentTarget, viaKey: event.detail === 0,
    body: `<form class="flow" novalidate><p class="meta">${esc(record.action)} · ${esc(record.id)}</p>
      ${field({ id: 'correction', label: 'Corrected evidence and reason', type: 'textarea' })}
      <p class="hint err" role="alert" data-error></p><div><button class="btn primary">Record correction</button></div></form>`,
    onOpen(dialog, close) {
      $('form', dialog).onsubmit = async e => {
        e.preventDefault()
        if (!validateFields(e.currentTarget)) return
        try {
          await appendAuditCorrection(record.id, $('#correction', dialog).value)
          close()
          draw()
          $('#audit-result').textContent = 'Linked correction recorded.'
          $('#audit-result').focus()
        } catch { $('[data-error]', dialog).textContent = 'The correction could not be added. Check your admin session.' }
      }
    },
  })
}
form.oninput = () => { limit = 50; draw() }
form.onsubmit = event => event.preventDefault()
if (!readOnly) $('#export').onclick = event => {
  const selection = filters()
  const columns = ['at', 'id', 'actor', 'role', 'action', 'subject', 'policyVersion', 'old', 'new', 'reason', 'detail', 'filters', 'count', 'corrects']
  const rows = auditTrail(selection).map(row => columns.map(key => typeof row[key] === 'object' && row[key] !== null ? JSON.stringify(row[key]) : row[key]))
  exportSheet(event, { kind: 'audit', columns, rows, filters: selection })
}
draw()
liveReports(draw)
