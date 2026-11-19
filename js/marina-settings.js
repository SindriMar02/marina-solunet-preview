import { $, adminShell, esc, sheet } from './ui.js'
import { field, root, validateFields } from './recruitment.js'
import { CATEGORY_NAMES, MARKETS } from './filter-policy.js'
import { intakePolicy, intakeState, intakeUsage, reviewCapacity, setIntake } from './store.js'

adminShell('Intake settings')
root.classList.add('work-inner')
function draw(message = '') {
  const intake = intakePolicy()
  const policy = intake.policy
  const capacity = reviewCapacity()
  const usage = intakeUsage()
  const number = (name, label, value, max = '') => `<label>${label}<input class="input" name="${name}" type="number" min="0" ${max ? 'max="' + max + '"' : ''} value="${value}" required></label>`
  root.innerHTML = `<header class="work-heading"><p class="eyebrow">Marina Travel · Policy v${policy.version}</p><h1 class="p-h2">Intake settings</h1>
    <p class="dim">Set the qualifying policy and weekly limits for the prototype pilot.</p>
    <p class="meta">Effective ${esc(policy.effectiveAt.slice(0, 16).replace('T', ' '))} UTC · Intake ${esc(intakeState())} · ${usage.used} / ${usage.cap} places used · ${usage.waiting} waiting · ${capacity.left} of ${capacity.total} reviews available until ${esc(capacity.reset.slice(0, 10))}</p></header>
    <p role="status" class="meta" id="settings-status" tabindex="-1">${esc(message)}</p>
    <form id="policy" class="flow">
      <section class="work-section"><h2 class="h-task">Cohort and capacity</h2><div class="work-filters">
        <label>Cohort name<input class="input" name="cohort" required maxlength="100" value="${esc(policy.cohort)}"></label>
        <label>Intake state<select class="input" name="state">${['open', 'paused', 'closed'].map(state => `<option value="${state}"${intake.state === state ? ' selected' : ''}>${state}</option>`).join('')}</select></label>
        <label>Weekly reset anchor (UTC)<input class="input" name="firstReset" type="date" value="${esc(intake.firstReset.slice(0, 10))}" required></label>
        ${number('cap', 'Application cap', intake.cap)}${number('reviewCapacity', 'Weekly decision cap', intake.reviewCapacity)}
      </div><p class="meta">A reopened intake lets waitlisted applicants claim a place from their status page.</p></section>
      <section class="work-section"><h2 class="h-task">Test rules</h2><div class="work-filters">
        ${number('passMark', 'Pass mark (%)', intake.passMark, 100)}
        ${Object.entries(CATEGORY_NAMES).map(([key, label]) => number(key, label + ' (%)', policy.floors[key], 100)).join('')}
        ${number('fastSeconds', 'Flag under (seconds)', policy.fastSeconds, 900)}
      </div><p class="meta">A started test keeps the policy and pass mark it began with.</p></section>
      <section class="work-section"><h2 class="h-task">Readiness and evidence</h2>
        ${Object.keys(MARKETS).map(market => `<label class="checkline"><input type="checkbox" name="gates" value="${esc(market)}"${policy.gates.includes(market) ? ' checked' : ''}>Hold ${esc(market)} pending readiness review</label>`).join('')}
        <label class="checkline"><input type="checkbox" name="requireEvidence"${policy.requireEvidence ? ' checked' : ''}>Flag missing channel link or alternative reference</label>
      </section>
      <div><button class="btn primary">Preview policy change</button></div>
    </form>`
  $('#policy').onsubmit = event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const patch = {
      firstReset: data.get('firstReset') + 'T00:00:00Z', cohort: data.get('cohort').trim(), state: data.get('state'), gates: data.getAll('gates'), requireEvidence: data.has('requireEvidence'),
      ...Object.fromEntries(['cap', 'reviewCapacity', 'passMark', 'fastSeconds'].map(key => [key, Number(data.get(key))])),
      floors: Object.fromEntries(Object.keys(CATEGORY_NAMES).map(key => [key, Number(data.get(key))])),
    }
    sheet({
      title: `Publish policy v${policy.version + 1}?`, opener: event.submitter, viaKey: keyboardSubmit,
      body: `<form class="flow" novalidate><p>${esc(patch.cohort)} · ${patch.state} · ${patch.cap} applications · ${patch.reviewCapacity} decisions per week. Weekly reset anchor ${esc(patch.firstReset.slice(0, 10))} UTC.</p>
        <p>Pass mark ${patch.passMark}% · Timing flag below ${patch.fastSeconds}s · Held markets ${esc(patch.gates.join(', ') || 'none')}.</p>
        <p class="meta">${Object.entries(patch.floors).map(([key, value]) => `${esc(CATEGORY_NAMES[key])} ${value}%`).join(' · ')}</p>
        ${field({ id: 'policy-reason', label: 'Reason for the change', type: 'textarea' })}
        <p class="hint err" role="alert" data-error></p><div><button class="btn primary">Publish policy</button></div></form>`,
      onOpen(dialog, close) {
        $('form', dialog).onsubmit = async e => {
          e.preventDefault()
          if (!validateFields(e.currentTarget)) return
          try {
            await setIntake({ ...patch, seenVersion: policy.version }, $('#policy-reason', dialog).value)
            close()
            draw('Policy published.')
            $('#settings-status').focus()
          } catch { $('[data-error]', dialog).textContent = 'Check the settings and your session, then reopen the preview.' }
        }
      },
    })
  }
  let keyboardSubmit = true
  const trigger = $('#policy button')
  trigger.onclick = event => { keyboardSubmit = event.detail === 0 }
}
draw()
