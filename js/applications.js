import { principal } from './session.js'
import * as store from './store.js'
import { $, $$, esc, qs, adminShell, dayLabel, sheet, segmented } from './ui.js'
import { field, focusHeading, root, timeTag, validateFields } from './recruitment.js'
// Stored check reasons may carry ISO timestamps from older evaluations; show them as people read dates.
const readableTimes = text => String(text ?? '').replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z/g, iso =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC')

adminShell('Applications', ['admin', 'reviewer'])
const views = {
  eligible: 'Eligible', look_closer: 'Look closer', approved: 'Approved', rejected: 'Rejected',
  waitlist: 'Waitlist', reconsideration: 'Reconsideration', submitted: 'Awaiting verification',
  verified: 'Verified', not_qualified: 'Auto-declined', market_hold: 'Market hold', timed_out: 'Timed out',
}
const { name: reviewer, role } = principal()
const decisions = {
  approve: ['Approve', 'Creates a seller number and sends the invitation (demo).'],
  look_closer: ['Look closer', 'Moves the application to the closer-review queue.'],
  reject: ['Reject', 'Records the reason category and gives the applicant a reconsideration route.'],
}
let pageSize = Math.max(25, Number(qs('show')) || 25)
let dialogOpen = false
const orders = {
  score: ['Highest score', (a, b) => (b.attempt?.score ?? -1) - (a.attempt?.score ?? -1)],
  waiting: ['Longest waiting', (a, b) => enteredAt(a).localeCompare(enteredAt(b))],
  name: ['Applicant name', (a, b) => a.name.localeCompare(b.name)],
}
let sort = Object.hasOwn(orders, qs('order')) ? qs('order') : 'score'
let shortcuts = sessionStorage.getItem('solunet-review-keys') !== 'off'
const enteredAt = a => a.reviewAt || a.attempt?.submittedAt || a.createdAt
function queueHref(view, id, row) {
  const params = new URLSearchParams({ view })
  if (id) params.set('id', id)
  if (row) params.set('row', row)
  if (sort !== 'score') params.set('order', sort)
  if (pageSize > 25) params.set('show', pageSize)
  return `applications.html?${params}`
}
const score = app => app.attempt?.score == null ? '—' : `${app.attempt.score} / 100`
function waiting(app) {
  if (['approved', 'rejected'].includes(app.state)) return 'Reviewed'
  const start = app.reviewAt || app.attempt?.submittedAt || app.createdAt
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(start)) / 3600_000))
  return hours >= 24 ? `${Math.floor(hours / 24)}d waiting` : hours ? `${hours}h waiting` : 'New'
}
function safeLinks(links) {
  return links.split(/[\s,]+/).filter(Boolean).map(link => {
    try {
      const url = new URL(link)
      if (url.protocol === 'https:' || url.protocol === 'http:') return `<a class="linkbtn" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a>`
    } catch {}
    return `<span>${esc(link)}</span>`
  }).join(' ')
}
function render({ focus = false, noteDraft = '', result = '' } = {}) {
  const requested = qs('id')
  const selected = requested && store.application(requested)
  const requestedView = qs('view')
  const current = views[selected?.state] ? selected.state : Object.hasOwn(views, requestedView) ? requestedView : 'eligible'
  const all = store.applications()
  const queue = all.filter(a => a.state === current).sort((a, b) => orders[sort][1](a, b)
    || enteredAt(a).localeCompare(enteredAt(b)) || a.id.localeCompare(b.id))
  const cap = store.reviewCapacity()
  const reviewers = store.reviewActors()
  const usage = store.intakeUsage()
  const detailsAvailable = selected && views[selected.state]
  const hadFocus = root.contains(document.activeElement)
  root.innerHTML = `
    <header class="review-head"><p class="eyebrow">People · Marina Travel</p>
      <h1 class="h-page" tabindex="-1">Applications</h1>
      <p class="proto">Prototype · ${all.length} applications in this browser</p>
      <dl class="stat-strip">
        <div><dt>Reviews left this week</dt><dd class="fig key">${cap.left} <span class="meta">of ${cap.total}</span></dd>
          <progress class="meter" max="${cap.total || 1}" value="${cap.left}" aria-label="${cap.left} of ${cap.total} reviews left this week"></progress>
          <span class="note" id="capacity-label">Resets ${dayLabel(cap.reset.slice(0, 10))}</span></div>
        <div><dt>Places used</dt><dd class="fig">${usage.used} <span class="meta">of ${usage.cap}</span></dd><span class="note">Weekly intake cap</span></div>
        <div><dt>Waiting at intake</dt><dd class="fig">${usage.waiting}</dd><span class="note">Held until a place opens</span></div>
        <div><dt>Open for review</dt><dd class="fig">${all.filter(a => ['eligible', 'look_closer', 'reconsideration'].includes(a.state)).length}</dd><span class="note">Eligible, closer look, reconsideration</span></div>
      </dl>
    </header>
    <nav class="queue-tabs" aria-label="Application views">
      ${Object.entries(views).map(([key, label]) => `<a href="${queueHref(key)}"${key === current ? ' aria-current="page"' : ''}>${label} &nbsp; <span class="num">${all.filter(a => a.state === key).length}</span></a>`).join('')}
    </nav>
    <p class="hint" role="status">${esc(result)}</p>
    ${role === 'admin' ? '<a class="linkbtn" href="overview.html#application-export">Export applications</a>' : ''}
    <div class="review-grid"${requested ? ' data-detail' : ''}>
      <section class="review-list" aria-label="${views[current]} applications" data-ledger-reveal>
        ${queue.length ? `<div class="review-list-tools">
          <label class="field" for="sort-apps"><span class="label">Sort applications</span><select class="input" id="sort-apps">${Object.entries(orders).map(([key, [label]]) => `<option value="${key}"${sort === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
          <label class="review-keys"><input type="checkbox" id="review-keys"${shortcuts ? ' checked' : ''}>Use J/K between rows</label>
        </div>` : ''}
        ${queue.length ? `<ol class="decision-list">${queue.slice(0, pageSize).map(app => `
          <li><a class="review-row" data-app="${app.id}" href="${queueHref(current, app.id)}"${selected?.id === app.id ? ' aria-current="true"' : ''}>
            <strong>${esc(app.name)}</strong><span class="num">${score(app)}</span>
            <span class="meta" data-full>${esc(app.country)} · ${esc(app.markets)} · ${esc(app.languages)}</span>
            <span class="meta" data-full>${waiting(app)} · ${esc(reviewers.find(actor => actor.id === (app.assignedTo || 'reviewer'))?.name || 'Assigned reviewer')}</span>
          </a></li>`).join('')}</ol>
          ${queue.length > pageSize ? '<button class="btn section-follow" id="more" type="button">Show more applications</button>' : ''}`
          : '<p class="notice">There are no applications in this view.</p>'}
      </section>
      ${requested ? `<section class="flow" id="detail" aria-label="Application evidence">
        <a class="linkbtn review-back" href="${queueHref(current, null, detailsAvailable ? selected.id : null)}">← Back to ${views[current]}</a>
        ${detailsAvailable ? detail(selected, cap, noteDraft, reviewers) : '<h2 class="h-task" tabindex="-1">This application is unavailable</h2>'}</section>`
        : '<p class="split-hint dim">Open an application to see review evidence.</p>'}
    </div>`

  segmented($('.queue-tabs'))
  const sortField = $('#sort-apps')
  if (sortField) sortField.onchange = () => {
    sort = sortField.value
    history.replaceState(null, '', queueHref(current, requested))
    render()
    $('#sort-apps')?.focus({ preventScroll: true })
  }
  const keyField = $('#review-keys')
  if (keyField) keyField.onchange = () => {
    shortcuts = keyField.checked
    sessionStorage.setItem('solunet-review-keys', shortcuts ? 'on' : 'off')
  }
  const more = $('#more')
  if (more) more.onclick = () => {
    const next = queue[pageSize]
    pageSize += 25
    history.replaceState(null, '', queueHref(current, requested))
    render()
    $(`[data-app="${next.id}"]`)?.focus()
  }
  const note = $('#note-form')
  if (note) note.onsubmit = async event => {
    event.preventDefault()
    if (!validateFields(note)) return
    const value = $('#note').value
    try {
      await store.addReviewNote(selected.id, reviewer, value)
      render({ result: 'Review note saved.' })
      $('#note').focus()
    } catch { $('#note-error').textContent = 'This note could not be saved. Please try again.' }
  }
  const assignment = $('#assignment')
  if (assignment) assignment.onclick = event => adminCaseAction(event, selected, 'assign')
  const expire = $('#expire-invite')
  if (expire) expire.onclick = event => sheet({
    title: 'Simulate invitation expiry?', opener: event.currentTarget, viaKey: event.detail === 0,
    body: '<p>The applicant can request a replacement invitation from their private status page.</p><button type="button" class="btn primary" data-expire>Expire invitation</button><p class="hint err" role="alert" data-error></p>',
    onOpen(dialog, close) {
      $('[data-expire]', dialog).onclick = async () => {
        try {
          await store.expireDemoInvitation(selected.id, selected.reviewRevision ?? 0)
          close()
          render({ focus: true, result: 'Invitation expired for the prototype recovery rehearsal.' })
        } catch { $('[data-error]', dialog).textContent = 'The invitation changed. Reopen the case to continue.' }
      }
    },
  })
  const secondOpinion = $('#second-opinion')
  if (secondOpinion) secondOpinion.onclick = event => adminCaseAction(event, selected, 'opinion')
  $$('[data-decision]').forEach(button => button.onclick = event => confirmDecision(selected, button, event.detail === 0))

  if (focus && requested) $('#app-heading')?.focus()
  else if (focus) focusHeading()
  else if (hadFocus) root.querySelector('h1')?.focus({ preventScroll: true })
}

function detail(app, cap, noteDraft, reviewers) {
  const attempt = app.attempt
  const seller = store.agent(app.agentId)
  const inv = store.invitationFor(app)
  const flag = {
    waitlist: 'Intake closed at submission', reconsideration: 'Applicant requested reconsideration',
    look_closer: 'Reviewer requested a closer look',
  }[app.state] || 'None recorded'
  const facts = [
    ['Country', esc(app.country)], ['Markets served', esc(app.markets)], ['Languages', esc(app.languages)],
    ['Sales experience', esc(app.salesExperience)], ['Tourism experience', esc(app.tourismExperience)],
    ['Channels', esc(app.channels)], ['Links', app.links ? safeLinks(app.links) : 'None supplied'],
    ['Reference', esc(app.reference || 'None supplied')],
    ['Recruitment source', esc(app.source || 'Direct')],
    ['Assigned reviewer', esc(reviewers.find(actor => actor.id === (app.assignedTo || 'reviewer'))?.name)], ['First touch', app.firstTouchAt ? timeTag(app.firstTouchAt) : 'Pending'], ['Reply by', app.replyBy ? timeTag(app.replyBy) : '—'], ['Last decision', esc(app.reviewer || 'Pending')], ['Flags', flag],
  ]
  const reviewable = ['eligible', 'look_closer', 'reconsideration', ...(role === 'admin' ? ['market_hold', 'not_qualified'] : [])].includes(app.state)
  const screening = store.applicationScreening(app)
  const override = ['market_hold', 'not_qualified', 'reconsideration'].includes(app.state)
  return `<div class="case"><header class="bo-panel case-head"><span class="state-chip">${esc(views[app.state])}</span>
    <div class="case-title"><h2 tabindex="-1" id="app-heading">${esc(app.name)}</h2>
      <p class="case-score"><b>${attempt?.score ?? '—'}</b><span>${attempt?.score == null ? 'no test result' : '/ 100'}</span></p></div>
    <p class="meta num">${attempt ? `Test ${esc(attempt.version)} · Pass mark ${attempt.threshold} · ` : ''}${esc(app.country)} · ${esc(app.markets)}</p>
    ${app.decidedAt ? `<p class="meta">Reviewed by ${esc(app.reviewer)} · ${timeTag(app.decidedAt)}</p>` : ''}
    ${app.reason ? `<p class="meta">Reason · ${esc(app.reason)}</p>` : ''}
    ${seller ? `<p class="status confirmed">${esc(seller.sellerId)} · ${seller.state === 'active' ? 'Active' : 'Invited'}</p>` : ''}
    ${role === 'admin' && app.guided && inv && !inv.consumedAt && Date.parse(inv.expiresAt) > Date.now() ? '<div><button type="button" class="btn" id="expire-invite">Simulate invitation expiry</button></div>' : ''}
    ${inv || app.access ? `<div class="case-links">${inv ? `<a class="linkbtn" href="../activate.html?inv=${inv.token}">Open the invitation (demo)</a>` : ''}${app.access ? `<a class="linkbtn" href="../status.html?access=${app.access}">Open applicant status (demo)</a>` : ''}</div>` : ''}
  </header>
  <section class="bo-panel" aria-label="Applicant details"><dl class="review-summary">${facts.map(([label, value]) => `<div><dt class="meta">${label}</dt><dd>${value}</dd></div>`).join('')}</dl></section>
  <section class="bo-panel" aria-labelledby="checks-title">
    <h3 class="h-task" id="checks-title">Automatic checks</h3>
    <p class="meta">Prototype recruitment policy v${screening.policyVersion ?? attempt?.policy?.version ?? 1}</p>
    <ol class="screening-list">${screening.checks.map((check, index) => `<li style="--check-order:${index}">
      <span class="screening-mark" aria-hidden="true"></span>
      <div><strong>${esc(check.label)}</strong><p class="meta">${esc(readableTimes(check.reason))}</p></div>
      <span class="status ${check.outcome === 'Pass' ? 'confirmed' : check.outcome === 'Pending' ? '' : 'exception'}">${esc(check.outcome)}</span></li>`).join('')}</ol>
  </section>
  ${app.reviewHistory?.length ? `<section class="bo-panel"><h3 class="h-task">Decision history</h3><ol class="work-list">
    ${app.reviewHistory.map(item => `<li><div><strong>${esc(item.decision.replaceAll('_', ' '))} · ${esc(item.reviewer)}</strong><p class="meta">${timeTag(item.at)}${item.reason ? ' · ' + esc(item.reason) : ''}</p></div></li>`).join('')}</ol></section>` : ''}
  ${role === 'admin' ? '<div class="actions bo-panel"><button class="btn" id="assignment">Assign reviewer</button><button class="btn" id="second-opinion">Record second opinion</button></div>' : ''}
  ${reviewable ? `<section class="bo-panel" aria-labelledby="decision-title">
    <h3 class="h-task" id="decision-title">Make a decision</h3>
    ${!cap.left ? '<p class="notice">Weekly review capacity is full. You can still mark this application for a closer look.</p>' : ''}
    <div class="review-actions">${Object.entries(decisions).filter(([key]) => !override || role === 'admin' || key !== 'approve').map(([key, [label, consequence]]) => `
      <div><button class="btn${key === 'approve' ? ' primary' : ''}" type="button" data-decision="${key}" aria-describedby="effect-${key}"${!cap.left && key !== 'look_closer' ? ' disabled' : ''}>${label}</button>
        <p class="meta" id="effect-${key}">${esc(key === 'approve' ? `Creates ${store.nextSellerId()} and sends the invitation (demo).` : consequence)}</p></div>`).join('')}</div>
    <p class="hint err" id="decision-error" role="alert"></p>
  </section>` : ''}
  <section class="bo-panel" aria-labelledby="answers-title">
    <h3 class="h-task" id="answers-title">Test answers</h3>
    ${attempt?.submittedAt ? `<ol class="decision-list">${store.TEST_BANK.map((item, i) => {
      const chosen = attempt.answers[item.id]
      const right = chosen === item.correct
      return `<li><p><strong>${i + 1}. ${esc(item.prompt)}</strong></p>
        <p class="status ${right ? 'confirmed' : 'exception'}">${right ? 'Correct' : 'Incorrect'} · ${right ? item.weight : 0} of ${item.weight} points</p>
        <p class="meta">Answer given · ${esc(item.options[chosen] || 'Unanswered')}</p>
        ${right ? '' : `<p class="meta">Expected · ${esc(item.options[item.correct])}</p>`}</li>`
    }).join('')}</ol>` : '<p class="dim">No submitted answers.</p>'}
  </section>
  <section class="bo-panel" aria-labelledby="notes-title">
    <h3 class="h-task" id="notes-title">Review notes</h3>
    ${app.notes.length ? `<ol class="decision-list">${app.notes.map(n => `<li><p class="meta">${esc(n.by)} · ${timeTag(n.at)}</p><p class="review-note">${esc(n.text)}</p></li>`).join('')}</ol>` : '<p class="dim">No review notes yet.</p>'}
    <form id="note-form" novalidate>
      ${field({ id: 'note', label: 'Add a review note', type: 'textarea', value: noteDraft })}
      <div><button type="submit" class="btn">Save note</button></div>
    </form>
  </section></div>`
}

function confirmDecision(app, opener, keyboard) {
  const action = opener.dataset.decision
  const [label] = decisions[action]
  const effect = $('#effect-' + action).textContent
  const needsExplanation = action === 'approve' && ['look_closer', 'market_hold', 'not_qualified', 'reconsideration'].includes(app.state)
  dialogOpen = true
  const close = sheet({
    title: `${label} · ${app.name}`, opener, viaKey: keyboard,
    body: `<form class="flow" novalidate><p>${esc(effect)}</p>
      ${action === 'reject' ? `<div class="field"><label for="reason">Reason category</label><select required class="input" id="reason" aria-describedby="reason-error"><option value="">Choose a reason</option>${store.REASONS.map(reason => `<option>${esc(reason)}</option>`).join('')}</select><p class="hint err" role="alert" id="reason-error"></p></div>` : ''}
      ${needsExplanation ? field({ id: 'reason', label: 'Explain the approval', type: 'textarea' }) : ''}
      <p class="hint err" role="alert" id="confirm-error"></p>
      <div><button type="submit" class="btn primary">Confirm ${label.toLowerCase()}</button></div></form>`,
    onClose() { dialogOpen = false },
    onOpen(dialog) {
      $('form', dialog).onsubmit = async event => {
        event.preventDefault()
        const reason = $('#reason', dialog)
        if (reason && !reason.value.trim()) {
          $('#reason-error', dialog).textContent = 'Add a reason before confirming.'
          reason.setAttribute('aria-invalid', 'true')
          reason.focus()
          return
        }
        const button = event.submitter
        button.disabled = true
        try {
          const updated = await store.reviewApplication(app.id, reviewer, action, reason?.value, Date.now(), app.reviewRevision ?? 0)
          close()
          history.replaceState(null, '', queueHref(updated.state, updated.id))
          render({ focus: true, result: 'Decision recorded.' })
        } catch (error) {
          const message = ({
            intake_capacity: 'Review capacity is full. This decision was not saved.',
            not_reviewable: 'This application changed while you were reviewing it. Reopen its current evidence.',
          })[error.message] || 'This decision could not be saved. Please try again.'
          if (error.message === 'not_reviewable') {
            store.refresh()
            const latest = store.application(app.id)
            close()
            render({ focus: true, result: latest ? `${message} Current state: ${views[latest.state] || latest.state}. Last decision: ${latest.reviewer || 'pending'}.` : message })
            return
          }
          $('#confirm-error', dialog).textContent = message
          button.disabled = false
        }
      }
    },
  })
}

function adminCaseAction(event, app, action) {
  const assign = action === 'assign'
  sheet({
    title: assign ? 'Assign reviewer' : 'Record a second opinion',
    opener: event.currentTarget, viaKey: event.detail === 0,
    body: `<form class="flow">${assign ? `<label class="field">Reviewer<select class="input" name="assignee">${store.reviewActors().map(actor =>
      `<option value="${actor.id}"${(app.assignedTo || 'reviewer') === actor.id ? ' selected' : ''}>${esc(actor.name)}</option>`).join('')}</select></label>` : ''}
      ${field({ id: 'case-reason', label: assign ? 'Reason for assignment' : 'Second opinion', type: 'textarea' })}
      <p class="hint err" role="alert" data-error></p><div><button class="btn primary">Save</button></div></form>`,
    onOpen(dialog, close) {
      $('form', dialog).onsubmit = async e => {
        e.preventDefault()
        if (!validateFields(e.currentTarget)) return
        const reason = $('#case-reason', dialog).value
        try {
          if (assign) await store.assignApplication(app.id, $('[name=assignee]', dialog).value, reason, app.reviewRevision ?? 0)
          else await store.recordSecondOpinion(app.id, reason, app.reviewRevision ?? 0)
          close()
          render({ focus: true, result: assign ? 'Assignment saved.' : 'Second opinion recorded.' })
        } catch {
          $('[data-error]', dialog).textContent = 'The case changed or your session expired. Reopen the case to continue.'
        }
      }
    },
  })
}

root.addEventListener('keydown', event => {
  if (!shortcuts || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !/^[jk]$/.test(event.key)) return
  const rows = $$('[data-app]')
  const index = rows.indexOf(document.activeElement)
  if (index < 0) return
  const next = rows[index + (event.key === 'j' ? 1 : -1)]
  if (next) { event.preventDefault(); next.focus() }
})
render({ focus: Boolean(qs('id')) })
const row = qs('row')
if (row) $$('[data-app]').find(link => link.dataset.app === row)?.focus()
window.addEventListener('storage', () => {
  if (!dialogOpen && !root.contains(document.activeElement)) render({ noteDraft: $('#note')?.value })
})
window.addEventListener('pageshow', event => {
  if (event.persisted) { store.refresh(); render({ noteDraft: $('#note')?.value }) }
})
