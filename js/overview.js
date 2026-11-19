import { $, adminShell, esc, isk, sheet } from './ui.js'
import { field, root, validateFields } from './recruitment.js'
import { intakePolicy, oversightReport, reportApplications, surgeProjection, recordCampaignSpend } from './store.js'
import { exportSheet, ledger, liveReports } from './reporting.js'

export function overview(readOnly = false) {
  adminShell(readOnly ? 'Codebear oversight' : 'Marina overview', [readOnly ? 'oversight' : 'admin'])
  root.classList.add('work-inner')
  root.innerHTML = `<header class="work-heading">
    <p class="eyebrow">${readOnly ? 'Codebear · Örn · Read-only' : 'Marina Travel · Network operations'}</p>
    <h1 class="p-h2">${readOnly ? 'Pilot oversight' : 'Recruitment overview'}</h1>
    <p class="dim">${readOnly ? 'Marina owns the network and its decisions. This view shows aggregate performance, policy and redacted audit evidence for the handover.' : 'Follow applicants from submission to their first credited sale. Track staff capacity and decisions across the pilot.'}</p>
    <p class="proto">Prototype · Shared fictional records</p>
  </header>
  <form class="work-filters" id="report-filters" aria-label="Report filters">
    <label>Cohort<input class="input" name="cohort" placeholder="All cohorts"></label>
    <label>Source<input class="input" name="source" placeholder="All sources"></label>
    <label>Market<input class="input" name="market" placeholder="All markets"></label>
    <label>Applied from<input class="input" name="from" type="date"></label>
    <label>Applied through<input class="input" name="to" type="date"></label>
    <label>Decision<select class="input" name="decision"><option value="">Any decision</option>
      ${['submitted', 'verified', 'eligible', 'look_closer', 'market_hold', 'not_qualified', 'waitlist', 'approved', 'rejected', 'reconsideration', 'timed_out'].map(value => `<option value="${value}">${label(value)}</option>`).join('')}</select></label>
    <label class="checkline"><input type="checkbox" name="fixtures" checked>Include the example applicants</label>
  </form>
  <div id="report"></div>
  ${readOnly ? '' : '<div><button class="btn" id="campaign">Record prototype campaign spend</button></div><p class="meta" role="status" id="campaign-result"></p>'}
  ${readOnly ? '' : `<section class="work-section"><h2 class="h-task">Rehearse an application surge</h2>
    <p class="dim">Prototype example · 500 completions and 50 eligible cases. The estimate applies the configured intake cap and remaining weekly decisions.</p>
    <form id="surge" class="work-filters"><label>Completions<input class="input" name="completions" type="number" min="0" max="100000" value="500" required></label>
      <label>Eligible cases<input class="input" name="eligible" type="number" min="0" max="100000" value="50" required></label></form>
    <p id="surge-result" role="status"></p></section>`}
  ${readOnly ? '<a class="btn" href="audit.html">Read the redacted audit</a>' :
    '<section class="work-section" id="application-export"><h2 class="h-task">Application export</h2><p class="dim">Download the application list for the filters above.</p><button class="btn" id="export">Preview CSV</button></section>'}`
  const form = $('#report-filters')
  const filters = () => Object.fromEntries(new FormData(form))
  const surge = $('#surge')
  const drawSurge = () => {
    if (!surge) return
    try {
      const result = surgeProjection(surge.elements.completions.valueAsNumber, surge.elements.eligible.valueAsNumber)
      $('#surge-result').textContent = `${result.admitted} admitted · ${result.waiting} held at intake · ${result.decisions} decisions this week · ${result.carryover} eligible cases carry over to ${result.reset.slice(0, 10)}.`
    } catch { $('#surge-result').textContent = 'Enter whole counts with eligible cases at or below completions.' }
  }
  if (surge) {
    surge.oninput = drawSurge
    surge.onsubmit = event => event.preventDefault()
  }
  const draw = () => {
    drawSurge()
    const report = oversightReport(filters())
    const policy = intakePolicy().policy
    const capacity = report.capacity
    $('#report').innerHTML = `<section class="work-section" data-ledger-reveal>
      <div class="work-section-heading"><h2 class="h-task">Pilot funnel</h2><p class="meta" role="status">As of ${esc(report.asOf.slice(0, 16).replace('T', ' '))} UTC · Policy v${policy.version}</p></div>
      ${ledger(['Stage', 'Applicants', 'From previous stage', 'Median elapsed'], report.funnel.map(row => [
        esc(row.label), row.count, row.previous == null ? '—' : row.previous
          ? `${row.progressed} / ${row.previous} · ${Math.round(row.progressed * 100 / row.previous)}%` : '0 / 0',
        row.elapsed == null ? '—' : `${row.elapsed.toFixed(1)} h`,
      ]))}
      <p class="meta">A first sale is a captured, confirmed booking. Later refunds remain visible below.</p>
    </section>
    <section class="work-section"><h2 class="h-task">Review workload</h2>
      <p>${capacity.total - capacity.left} of ${capacity.total} weekly decisions used · ${report.backlog} cases in queue</p>
      <p class="meta">Resets ${esc(capacity.reset.slice(0, 10))} UTC</p>
      ${ledger(['Reviewer', 'Assigned', 'Untouched', 'Overdue', 'Oldest case'], report.workload.map(row => [esc(row.reviewer), row.assigned, row.untouched, row.overdue, row.oldestHours == null ? '—' : `${Math.round(row.oldestHours)} h`]))}
    </section>
    <section class="work-section"><h2 class="h-task">Decisions by reviewer</h2>
      ${ledger(['Reviewer / cohort', 'Evidence', 'Decisions', 'Overrides'], report.decisions.map(row => [
        `${esc(row.reviewer)}<div class="meta">${esc(row.cohort)}</div>`,
        `${esc(row.score)} · ${esc(row.flags)}<div class="meta">Test ${esc(row.test)} · Policy v${esc(row.policy)}</div>`,
        `${row.approve} approvals / ${row.approve + row.reject} final · ${row.look_closer} closer review`, row.override,
      ]), 'Decision groups appear after Marina reviews an application.')}
    </section>
    <section class="work-section"><h2 class="h-task">Holds, appeals and exceptions</h2>
      ${ledger(['Outcome', 'Count'], report.branch.map(([name, count]) => [label(name), count]))}
    </section>
    <section class="work-section"><h2 class="h-task">Recruitment traffic</h2><p class="meta">Prototype visits and starts are recorded by source across this browser.</p>
      ${ledger(['Source', 'Visits', 'Starts', 'Applied', 'First sale', 'Cost per productive agent'],
        report.traffic.map(([name, counts]) => [esc(name), counts.visit, counts.start, counts.applied, counts.productive, counts.cost == null ? '—' : isk(counts.cost)]),
        'Open the recruitment ad to record traffic.')}
      <p class="meta">Select one cohort to compare recorded spend with sellers who made a first sale.</p>
    </section>`
  }
  form.oninput = draw
  form.onsubmit = event => event.preventDefault()
  if (!readOnly) $('#campaign').onclick = event => sheet({
    title: 'Record prototype campaign spend', opener: event.currentTarget, viaKey: event.detail === 0,
    body: `<form class="flow" novalidate><p class="meta">For the active cohort. Use a fictional campaign amount in ISK.</p>
      ${field({ id: 'campaign-source', label: 'Recruitment source', value: 'linkedin-w1', max: 120 })}
      <label class="field">Campaign spend (ISK)<input class="input" id="campaign-amount" type="number" min="0" required></label>
      ${field({ id: 'campaign-reason', label: 'Reason', type: 'textarea' })}
      <p class="hint err" data-error role="alert"></p><div><button class="btn primary">Save</button></div></form>`,
    onOpen(dialog, close) {
      const form = $('form', dialog)
      form.onsubmit = async e => {
        e.preventDefault()
        if (!validateFields(form)) return
        try {
          await recordCampaignSpend($('#campaign-source', dialog).value.trim(), $('#campaign-amount', dialog).valueAsNumber, $('#campaign-reason', dialog).value)
          close()
          $('#campaign-result').textContent = 'Campaign spend recorded.'
          draw()
        } catch { $('[data-error]', dialog).textContent = 'Enter a whole amount and check your admin session.' }
      }
    },
  })
  if (!readOnly) $('#export').onclick = event => {
    const selection = filters()
    const report = reportApplications(selection)
    const columns = ['id', 'name', 'cohort', 'source', 'market', 'applied', 'verified', 'tested', 'score', 'passMark', 'policy', 'decision', 'reviewer', 'seller', 'firstSale']
    exportSheet(event, { kind: 'applications', columns, rows: report.map(app => columns.map(key => app[key])), filters: selection })
  }
  draw()
  liveReports(draw)
}
function label(value) { const text = value.replaceAll('_', ' '); return text.charAt(0).toUpperCase() + text.slice(1) }
