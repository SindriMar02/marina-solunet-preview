import { $, esc, sheet } from './ui.js'
import { field, validateFields } from './recruitment.js'
import { recordExport, refresh } from './store.js'

export function ledger(columns, rows, empty = 'No records match these filters.') {
  if (!rows.length) return `<p class="notice">${esc(empty)}</p>`
  return `<table class="work-ledger"><thead><tr>${columns.map(title => `<th scope="col">${esc(title)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map((value, i) => `<td data-label="${esc(columns[i])}">${value}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

export function csv(columns, rows) {
  const cell = value => {
    const raw = String(value ?? '')
    const safe = typeof value !== 'number' && /^[\u0000-\u0020]*[=+@-]|^[\t\r\n]/.test(raw) ? "'" + raw : raw
    return '"' + safe.replaceAll('"', '""') + '"'
  }
  return [columns, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
export function exportSheet(event, { kind, columns, rows, filters }) {
  const contents = csv(columns, rows)
  sheet({
    title: 'Export ' + kind, opener: event.currentTarget, viaKey: event.detail === 0,
    body: `<form class="flow" novalidate><p><strong class="num">${rows.length}</strong> records match the current filters.</p>
      <p class="meta">Columns · ${esc(columns.join(', '))}</p>
      ${field({ id: 'export-purpose', label: 'Purpose', type: 'textarea', max: 500 })}
      <label class="checkline"><input type="checkbox" id="export-mfa" required>Confirm staff verification (prototype)</label>
      <p class="hint err" role="alert" id="export-error"></p>
      <div><button class="btn primary">Download CSV</button></div></form>`,
    onOpen(dialog, close) {
      $('form', dialog).onsubmit = async submit => {
        submit.preventDefault()
        const purpose = $('#export-purpose', dialog).value
        if (!validateFields(submit.currentTarget)) return
        if (!$('#export-mfa', dialog).checked) {
          $('#export-error', dialog).textContent = 'Confirm staff verification to export.'
          $('#export-mfa', dialog).focus()
          return
        }
        submit.submitter.disabled = true
        try {
          await recordExport(kind, filters, rows.length, purpose)
          const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
          const download = Object.assign(document.createElement('a'), { href: url, download: `solunet-${kind}.csv` })
          download.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
          close()
        } catch {
          $('#export-error', dialog).textContent = 'The export could not be recorded. Check your session.'
          submit.submitter.disabled = false
        }
      }
    },
  })
}
export function liveReports(draw) {
  window.addEventListener('storage', () => { refresh(); draw() })
  window.addEventListener('pageshow', event => { if (event.persisted) { refresh(); draw() } })
}
