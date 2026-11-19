export const COMPETENCIES = {
  selling: ['discount', 'more-discount'],
  product: ['east-size', 'ice-size', 'materials'],
  communication: ['bank', 'family'],
  tourism: ['age', 'request', 'group'],
  scenarios: ['merchant', 'cash'],
}
export const CATEGORY_NAMES = {
  selling: 'Selling skill', product: 'Product knowledge', communication: 'Customer communication',
  tourism: 'Tourism basics', scenarios: 'Sales situations',
}
export const MARKETS = {
  China: /\b(?:mainland\s+)?china\b/i,
  'Hong Kong': /\b(?:hong\s*kong|hk)\b/i,
  Taiwan: /\b(?:taiwan|tw)\b/i,
}
export const CHECKS = ['Application fields and consent', 'Mailbox verification', 'Duplicate identity', 'Market and language fit',
  'Intake and cohort cap', 'Timed test and score', 'Competency minimums', 'Completion time', 'Answer patterns',
  'Reference or channel evidence', 'Reviewer capacity and decision']
export const initialPolicy = () => ({
  version: 1, effectiveAt: '2026-11-19T00:00:00Z', cohort: 'Winter pilot',
  floors: Object.fromEntries(Object.keys(COMPETENCIES).map(key => [key, 45])),
  gates: Object.keys(MARKETS), fastSeconds: 180, requireEvidence: false,
})
const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
const phone = value => String(value || '').replace(/\D/g, '')
const openMarket = /\b(europe|european|iceland|nordic|north america|canada|united states|usa|uk|united kingdom|ireland|germany|france|benelux|spain|sweden|italy|english-speaking|netherlands|portugal|finland|denmark|norway|austria|switzerland|belgium|poland|mexico|czechia|greece)\b/i
const duration = seconds => `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
const result = (outcome, reason) => ({ outcome, reason })
export function screenApplication(app, context) {
  const { policy, apps, capacity, bank } = context
  const attempt = app.attempt
  const gated = policy.gates.filter(market => MARKETS[market].test(app.markets))
  const openedGate = Object.keys(MARKETS).some(market => !policy.gates.includes(market) && MARKETS[market].test(app.markets))
  const hasOpenMarket = openMarket.test(app.markets) || openedGate
  const marketHold = gated.length > 0 && !hasOpenMarket
  const duplicate = [...(context.sellerPhones || []).map(seller => ({ ...seller, agentId: seller.id })), ...apps].find(other => other.id !== app.id && phone(app.phone).length >= 7 && phone(app.phone) === phone(other.phone))
  const similar = apps.find(other => other.id !== app.id && norm(other.name) === norm(app.name) && norm(other.country) === norm(app.country))
  const match = duplicate || similar
  const matchLabel = match?.agentId ? context.sellerNumber(match.agentId) || match.id : match?.id
  const languageFit = /[\p{L}]{2,}/u.test(app.languages) && !/^(unknown|none|n\/?a|any|all|tbc|tbd)$/i.test(app.languages.trim())
  const completed = Boolean(attempt?.submittedAt)
  const passed = completed && attempt.score >= attempt.threshold
  const scores = Object.entries(COMPETENCIES).map(([key, ids]) => {
    const items = bank.filter(item => ids.includes(item.id))
    const possible = items.reduce((sum, item) => sum + item.weight, 0)
    const earned = items.reduce((sum, item) => sum + (attempt?.answers?.[item.id] === item.correct ? item.weight : 0), 0)
    return { key, earned, possible, floor: policy.floors[key], passed: earned * 100 >= possible * policy.floors[key] }
  })
  const measured = completed ? Date.parse(attempt.submittedAt) - Date.parse(attempt.startedAt) : 0
  const elapsed = Math.floor(measured / 1000)
  const tooFast = measured > 0 && measured < policy.fastSeconds * 1000
  const wrong = bank.filter(item => attempt?.answers?.[item.id] !== item.correct)
  const comparator = completed && wrong.length >= 3 && apps.find(other => other.id !== app.id && !other.id.startsWith('fixture-')
    && other.attempt?.submittedAt && bank.every(item => other.attempt.answers[item.id] === attempt.answers[item.id]))
  const evidence = app.links || app.reference
  const wait = app.state === 'waitlist'
  const verified = Boolean(app.verifiedAt)
  const checks = [
    result('Pass', app.id.startsWith('fixture-') ? 'Seeded application' : 'Required fields, privacy acknowledgement and simulated bot check'),
    verified ? result('Pass', `Verified ${new Date(app.verifiedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`) : result('Pending', 'Waiting for mailbox verification'),
    !verified ? result('Pending', 'Runs after mailbox verification') :
      match ? result('Flag', `${duplicate ? 'Duplicate phone' : 'Possible same person'} with ${matchLabel}`) : result('Pass', 'No matching phone or name and country'),
    !verified ? result('Pending', 'Runs after mailbox verification') : marketHold ? result('Hold', `Readiness pending for ${gated.join(', ')} · Marina admin`) :
      !hasOpenMarket || !languageFit ? result('Flag', 'Confirm the applicant’s audience and language fit') :
      result('Pass', gated.length ? `Open market can proceed. Held markets: ${gated.join(', ')}` : 'Declared market and language fit the prototype cohort'),
    wait ? result('Hold', 'Waitlisted at intake') : result('Pass', 'Admitted within the intake limit'),
    completed ? result(passed ? 'Pass' : 'Decline', `${attempt.score}/100 against frozen pass mark ${attempt.threshold}`) :
      attempt?.expiredAt ? result('Hold', 'Time expired; applicant can request reconsideration') : result('Pending', 'Awaiting a submitted test'),
    completed ? result(scores.every(score => score.passed) ? 'Pass' : 'Flag', scores.map(s =>
      `${CATEGORY_NAMES[s.key]} ${s.earned}/${s.possible} (minimum ${s.floor}%)`).join(' · ')) : result('Pending', 'Runs on test submission'),
    completed ? result(tooFast && !app.timingAccommodation ? 'Flag' : 'Pass',
      measured > 0 ? `Completed in ${duration(elapsed)}${app.timingAccommodation ? ' · accommodation recorded' : tooFast ? ' · flagged for review' : ''}` : 'Timing measurement unavailable') :
      result('Pending', 'Runs on test submission'),
    completed ? comparator ? result('Flag', `Matching wrong answers with ${comparator.id} · ${wrong.map(item => item.id).join(', ')}`)
      : result('Pass', 'No repeated wrong-answer pattern found') : result('Pending', 'Runs on test submission'),
    completed ? evidence ? result('Pass', app.links ? 'Channel link supplied' : 'Alternative reference supplied') :
      result(policy.requireEvidence ? 'Flag' : 'Pass', policy.requireEvidence ? 'Request a channel link or alternative reference' : 'Optional for this cohort') :
      result('Pending', 'Runs on test submission'),
    completed && passed && !marketHold ? capacity.left ? result('Pass', 'Route to the assigned human reviewer') :
      result('Hold', `Weekly decision limit reached · resets ${capacity.reset.slice(0, 10)}`) : result('Pending', 'Awaiting a reviewable application'),
  ].map((check, i) => ({ label: CHECKS[i], ...check }))
  return { checks, scores, elapsed, gated, marketHold, passed, flags: checks.some(check => check.outcome === 'Flag') }
}
