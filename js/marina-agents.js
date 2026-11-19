import { $, $$, adminShell, esc, isk, sheet } from './ui.js'
import { field, root, validateFields } from './recruitment.js'
import { agentRoster, manageAgent, tour } from './store.js'
import { ledger, liveReports } from './reporting.js'

adminShell('Agent roster')
root.classList.add('work-inner')
root.innerHTML = `<header class="work-heading"><p class="eyebrow">Marina Travel · People</p><h1 class="p-h2">Agent roster</h1>
  <p class="dim">Manage seller access, tour grants and pilot promotion. Sales totals use captured, confirmed bookings in the selected period.</p></header>
  <form class="work-filters" aria-label="Roster filters">
    <label>Seller status<select class="input" name="state"><option value="">All statuses</option><option>invited</option><option>active</option><option>suspended</option></select></label>
    <label>Sales from<input class="input" name="from" type="date"></label><label>Sales through<input class="input" name="to" type="date"></label>
  </form>
  <p class="meta" id="roster-result" role="status" tabindex="-1"></p><section class="work-section" id="roster" aria-label="Sellers"></section>`
const settings = $('form', root)
const date = at => at ? esc(at.slice(0, 10)) : 'Unknown'
function draw() {
  const filters = Object.fromEntries(new FormData(settings))
  const rows = agentRoster(filters).filter(row => !filters.state || row.state === filters.state)
  $('#roster').innerHTML = `<div data-ledger-reveal>${ledger(['Seller', 'Activity', 'Tour grants', 'Sales in period', 'Actions'], rows.map((row, index) => [
    `<strong>${esc(row.name)}</strong><p class="meta">${esc(row.sellerId)} · ${esc(row.country || 'Country unknown')}</p><p>${esc(row.state)}${row.employee ? ' · Marina employee' : ''}</p>
     ${row.reason ? `<p class="meta">${esc(row.reason)}</p>` : ''}${row.appeal ? `<p class="meta">Seller appeal · ${esc(row.appeal)}</p>` : ''}
     ${row.pilotFeedback ? `<p class="meta">Pilot feedback · ${esc(row.pilotFeedback.note)} · Would refer: ${esc(row.pilotFeedback.referral)}</p>` : ''}`,
    `<p>Activated · ${date(row.activatedAt)}</p><p class="meta">Last activity · ${date(row.lastActivityAt)}</p><p class="meta">Approval to first sale · ${row.approvalHours == null ? 'No matched sale' : row.approvalHours.toFixed(1) + ' h'}</p>`,
    `<p>${row.grants.map(id => esc(tour(id).title)).join('<br>') || 'No grants'}</p>`,
    `<p>${row.bookings} bookings · ${row.guests} guests${row.repeat ? ' · Repeat seller' : ''}</p>
      <p class="meta">Gross ${isk(row.gross)} · Refunds ${isk(row.refunds)} · Net ${isk(row.gross - row.refunds)}</p>
      ${row.bookings ? `<p class="meta">Average ${(row.guests / row.bookings).toFixed(1)} guests · ${isk(Math.round(row.gross / row.bookings))}</p>` : ''}
      <p class="meta">Attribution · ${esc(row.methods || '—')}<br>Recruitment · ${esc(row.source || '—')} · ${esc(row.market || '—')}</p>`,
    `<button class="btn" data-seller="${index}">Manage</button>`,
  ]))}</div>`
  $$('[data-seller]').forEach(button => button.onclick = event => manage(event, rows[Number(button.dataset.seller)]))
}
function manage(event, row) {
  const choices = [
    ...(row.state === 'active' ? [['suspend', 'Suspend seller']] : []),
    ...(row.state === 'suspended' ? [['reactivate', 'Reactivate seller']] : []),
    ...(!row.employee && row.state === 'active' && row.approvalHours != null ? [['promote', 'Promote to Marina reviewer']] : []),
    ...['icecave', 'eastfjords'].map(id => [`${row.grants.includes(id) ? 'revoke' : 'grant'}:${id}`, `${row.grants.includes(id) ? 'Revoke' : 'Grant'} · ${tour(id).title}`]),
    ['feedback', 'Record pilot feedback'], ['payout', 'Record a manual payout reference'],
  ]
  sheet({
    title: row.sellerId + ' · ' + row.name, opener: event.currentTarget, viaKey: event.detail === 0,
    body: `<form class="flow" novalidate><label class="field">Action<select class="input" name="action">${choices.map(([key, label]) => `<option value="${key}">${esc(label)}</option>`).join('')}</select></label>
      <div class="flow-stack" id="payout-fields" hidden><label class="field">Statement month<input class="input" type="month" name="month"></label>
        ${field({ id: 'payout-ref', label: 'Fictional manual payout reference', max: 120 })}</div>
      <label class="field" id="feedback-fields" hidden>Would the pilot seller refer another agent?
        <select class="input" name="referral"><option value="unknown">Unrecorded</option><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option></select></label>
      ${field({ id: 'seller-reason', label: 'Reason', type: 'textarea' })}
      <label class="checkline" id="staff-verification" hidden><input type="checkbox" name="verified">Confirm staff verification (prototype)</label>
      <p class="hint err" role="alert" data-error></p><div><button class="btn primary">Record change</button></div></form>`,
    onOpen(dialog, close) {
      const form = $('form', dialog)
      const applyAction = () => {
        const action = form.elements.action.value
        $('#feedback-fields', dialog).hidden = action !== 'feedback'
        $('#payout-fields', dialog).hidden = action !== 'payout'
        $('#payout-ref', dialog).required = action === 'payout'
        $('#staff-verification', dialog).hidden = !['promote', 'payout'].includes(action)
        form.elements.verified.checked = false
      }
      form.elements.action.onchange = applyAction
      applyAction()
      form.onsubmit = async e => {
        e.preventDefault()
        if (!validateFields(form)) return
        const [action, tourId] = form.elements.action.value.split(':')
        if (['promote', 'payout'].includes(action) && !form.elements.verified.checked) {
          $('[data-error]', dialog).textContent = 'Confirm staff verification to continue.'
          form.elements.verified.focus()
          return
        }
        try {
          await manageAgent(row.id, { action, tourId, reason: $('#seller-reason', dialog).value,
            month: form.elements.month.value, referral: form.elements.referral.value, reference: $('#payout-ref', dialog).value })
          close()
          draw()
          $('#roster-result').textContent = 'Seller record updated.'
          $('#roster-result').focus()
        } catch {
          $('[data-error]', dialog).textContent = 'Check the details and your session. This change could not be recorded.'
        }
      }
    },
  })
}
settings.oninput = draw
settings.onsubmit = event => event.preventDefault()
draw()
liveReports(draw)
