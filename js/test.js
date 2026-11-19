import * as store from './store.js'
import { $, $$, esc, siteShell } from './ui.js'
import { recruitmentMotion, guardApplicant, accessKey, accessUrl, answerRows, selectNumberKey, focusHeading, rememberAccess, root, TEST_CATEGORIES, timeTag } from './recruitment.js'

const access = accessKey()
guardApplicant(access)
siteShell()
recruitmentMotion()
const status = accessUrl('status', access)
const bank = store.TEST_BANK
const full = store.TEST_MINUTES * 60
let attempt
let interval
let busy = false
let warned
let pending = Promise.resolve()
if (store.applicationByAccess(access)) rememberAccess(access)

function draw(moveFocus = false) {
  clearInterval(interval)
  const app = store.applicationByAccess(access)
  attempt = app?.attempt?.fixtureOnly ? null : app?.attempt
  if (attempt?.submittedAt) {
    root.innerHTML = `<header><p class="eyebrow">Agent test · Receipt</p><h1 class="h-page" tabindex="-1">Your test was received</h1>
      <p>Received ${timeTag(attempt.submittedAt)}. The demo reply estimate is ${timeTag(app.replyBy)}.</p>
      <p class="proto">Prototype · Keep your status link to follow your application.</p></header>
      <div class="actions"><a class="btn primary" href="${esc(status)}">View application status</a><a class="btn" href="index.html#demo-story">Back to the demo</a></div>`
  } else if (attempt?.expiredAt) {
    root.innerHTML = `<header><p class="eyebrow">Agent test</p><h1 class="h-page" tabindex="-1">Time is up</h1>
      <p>Your attempt has ended. Your test needed to be complete and submitted before the timer ran out.</p></header>
      <div><a class="btn primary" href="${esc(status)}">View application status</a></div>`
  } else if (attempt) {
    drawAttempt()
  } else {
    drawRules(app)
  }
  if (moveFocus) focusHeading()
}

function drawRules(app) {
  root.innerHTML = `
    <header><p class="eyebrow">Agent test · Rules</p><h1 class="h-page" tabindex="-1">Before you start</h1>
      <p>This test checks ${TEST_CATEGORIES}.</p></header>
    <ol class="formula">
      <li><span>Questions</span><span class="v num">${bank.length}</span></li>
      <li><span>Time allowed</span><span class="v num">${store.TEST_MINUTES} minutes</span></li>
      <li><span>Attempts</span><span class="v num">One</span></li>
    </ol>
    <div class="flow-stack">
      <p>You can go back and change answers within your attempt. On a question page, use keys 1–4 to choose an answer or use the radio controls.</p>
      <p>Answer every question and submit before time runs out. If you reload or lose your connection, reopen the same test link in this browser. The timer keeps running.</p>
      <p>For a test accommodation, contact Marina before starting.</p><div><a class="linkbtn" href="tel:+3548678899">Call Marina at +354 867 8899</a></div>
    </div>
    <p class="proto">Prototype · Your answers stay in this browser.</p>
    <p class="hint err" role="alert"></p>
    <div class="actions">${app?.state === 'verified'
      ? '<button type="button" class="btn primary" id="start">Start test</button>'
      : app ? `<a class="btn primary" href="${esc(status)}">Verify your email first</a>`
      : '<a class="btn primary" href="apply.html?demo=anna">Apply and verify to start</a>'}
      <a class="btn" href="how.html#sample">Try the sample questions</a>
    </div>`
  const start = $('#start')
  if (start) start.onclick = async () => {
    start.disabled = true
    try { await store.startTest(access); draw(true) }
    catch { $('.hint.err').textContent = 'This test could not be started. Reopen your status link or try again.'; start.disabled = false }
  }
}

function drawAttempt() {
  const position = attempt.position
  const item = bank[position]
  const incomplete = bank.flatMap((q, i) => q.id in attempt.answers ? [] : [i])
  root.innerHTML = `
    <header>
      <p class="eyebrow">Marina Travel · Agent test</p>
      <h1 class="h-page" tabindex="-1">${item ? `Question ${position + 1} of ${bank.length}` : 'Review and submit'}</h1>
    </header>
    <div class="timer">
      <p class="meta num" id="clock" role="timer"></p>
      <progress class="meter" id="remaining" max="${full}" aria-label="Time remaining"></progress>
      <p class="hint warn" id="warning" role="status"></p>
    </div>
    ${item ? `<div id="question">${answerRows(item, { choice: attempt.answers[item.id] })}</div>
      <div class="actions"><button type="button" class="btn" id="prev"${position === 0 ? ' disabled' : ''}>Back</button>
        <button type="button" class="btn primary" id="next">${position === bank.length - 1 ? 'Review answers' : 'Next question'}</button>
        <button type="button" class="linkbtn" id="review">Go to review</button></div>`
    : `<p>${incomplete.length === 0 ? 'All 12 questions are answered. Submit when you’re ready.' : `${incomplete.length === 1 ? `Question ${incomplete[0] + 1} is` : `Questions ${incomplete.map(i => i + 1).join(', ')} are`} still unanswered. Choose ${incomplete.length === 1 ? 'it' : 'one'} below to return to it.`}</p>
      <div class="jump-list" aria-label="Jump to a question">${bank.map((q, i) => `<button class="btn${incomplete.includes(i) ? ' primary' : ''}" type="button" data-jump="${i}" aria-label="Question ${i + 1}, ${incomplete.includes(i) ? 'unanswered' : 'answered'}">${i + 1}${incomplete.includes(i) ? ' ·' : ''}</button>`).join('')}</div>
      <div class="actions"><button type="button" class="btn" id="prev">Back</button>
      ${incomplete.length === 0 ? '<button type="button" class="btn primary" id="submit">Submit test</button>' : ''}</div>`}
    <p class="hint err" role="alert" id="test-error"></p>`
  const question = $('#question')
  if (question) {
    question.onchange = e => {
      const value = Number(e.target.value)
      report('')
      pending = pending.then(async () => {
        try { attempt = await store.saveTestProgress(access, attempt.id, { itemId: item.id, choice: value }) }
        catch (error) {
          if (['test_expired', 'attempt_used'].includes(error.message)) { await syncAttempt(); return }
          report('Your choice could not be saved. Select it again before continuing.')
        }
      })
    }
    $('#next').onclick = () => go(position + 1)
    $('#review').onclick = () => go(bank.length)
  }
  $('#prev').onclick = () => go(position - 1)
  $$('[data-jump]').forEach(b => { b.onclick = () => go(Number(b.dataset.jump)) })
  const submit = $('#submit')
  if (submit) submit.onclick = () => act(() => store.submitTest(access, attempt.id), submit)
  tick()
  interval = setInterval(tick, 250)
}

function report(message) {
  const error = $('#test-error')
  if (error) error.textContent = message
}
async function act(operation, button) {
  if (busy) return
  busy = true
  if (button) button.setAttribute('aria-disabled', 'true')
  try {
    await pending
    if (!attempt || attempt.submittedAt || attempt.expiredAt) return
    await operation()
    draw(true)
  } catch (error) {
    if (['test_expired', 'attempt_used'].includes(error.message)) await syncAttempt()
    else if (error.message === 'test_incomplete') draw(true)
    else report('Your attempt is still saved. Please try again.')
  } finally {
    busy = false
    if (button) button.removeAttribute('aria-disabled')
  }
}
function go(position) {
  if (position < 0) return
  return act(() => store.saveTestProgress(access, attempt.id, { position }))
}

async function syncAttempt() {
  store.refresh()
  const latest = store.applicationByAccess(access)?.attempt
  if (latest && !latest.expiredAt && !latest.submittedAt && Date.parse(latest.endsAt) <= Date.now()) {
    try { await store.expireTest(access, latest.id) } catch { store.refresh() }
  }
  draw(true)
}

function tick() {
  const seconds = Math.max(0, Math.ceil((Date.parse(attempt.endsAt) - Date.now()) / 1000))
  const clock = $('#clock')
  if (!clock) return
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} remaining`
  if (clock.textContent !== text) {
    clock.textContent = text
    $('#remaining').value = seconds
  }
  const warning = seconds > 300 ? '' : seconds > 60 ? 'Five minutes or less remain.' : seconds ? 'One minute or less remains.' : 'Time is up.'
  const announcement = $('#warning')
  if (warning && warned !== warning) {
    warned = warning
    announcement.textContent = warning
  }
  if (!seconds) { clearInterval(interval); void syncAttempt() }
}

root.addEventListener('keydown', event => {
  const question = $('#question')
  if (question) selectNumberKey(event, question)
})
window.addEventListener('storage', e => {
  if (e.key !== 'solunet-proto-v1') return
  const latest = store.applicationByAccess(access)?.attempt
  if (!attempt && latest || latest?.submittedAt !== attempt?.submittedAt || latest?.expiredAt !== attempt?.expiredAt) draw()
})
window.addEventListener('pageshow', event => {
  if (!event.persisted) return
  store.refresh()
  draw()
})
draw()
