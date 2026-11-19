/* Sölunet prototype "backend" in the browser. It mirrors the Worker's real API shapes and rules
   (src/orders.ts startCheckout + applyBooking, src/commission.ts priceLine) so the UI can later swap
   to fetch() without redesign. State lives in localStorage so the agent, guest and admin tabs of one
   browser share one world. PROTOTYPE DATA: departures and the 13:00 start are illustrative; prices are
   Marina's 13 Nov Bókun snapshot (per-person basis unverified); VAT 11% is illustrative (accountant). */

import { COMPETENCIES, initialPolicy, MARKETS, screenApplication } from './filter-policy.js'
import { principal, requireRole as checkRole, sessionsEnabled, STAFF } from './session.js'

const KEY = 'solunet-proto-v1'
const BPS = 10000

// ---------- commission maths: a line-for-line port of src/commission.ts (test/ui-parity.test.ts checks it) ----------
export function roundDiv(a, b) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || b <= 0) throw new Error('roundDiv: bad operands')
  const sign = a < 0 ? -1 : 1, abs = Math.abs(a), q = Math.floor(abs / b), r = abs - q * b
  return sign * (r * 2 >= b ? q + 1 : q)
}
export function priceLine(input) {
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`)
  }
  const { listGrossMinor, vatBps, commissionBps, discountBps, maxDiscountBps } = input
  if (commissionBps > BPS) throw new Error('commission above 100%')
  if (maxDiscountBps > commissionBps) throw new Error('max discount above the commission rate')
  if (discountBps > maxDiscountBps) throw new Error('discount above the allowed maximum')
  const listNetMinor = roundDiv(listGrossMinor * BPS, BPS + vatBps)
  const discountGrossMinor = roundDiv(listGrossMinor * discountBps, BPS)
  const agentRateBps = commissionBps - discountBps
  return {
    listGrossMinor, vatBps, listNetMinor, discountBps, discountGrossMinor,
    customerGrossMinor: listGrossMinor - discountGrossMinor, commissionBps, agentRateBps,
    agentAmountMinor: roundDiv(listNetMinor * agentRateBps, BPS),
  }
}
export function targetBalance(full, paid, returned) {
  if (paid <= 0) return 0
  const kept = Math.max(0, paid - Math.min(returned, paid))
  return roundDiv(full * kept, paid)
}

export function checkMarginAllocation(margin, agent, discount) {
  if (margin < 0 || agent < 0 || discount < 0 || agent + discount > margin) {
    throw new Error('discount and payout exceed the available margin')
  }
}

/** Prices one line in minor units. The offer's eligible gross is the only amount discounts apply to. */
export function priceOfferLine(i) {
  const { kind, cost, units, feeMinor, excludedGrossMinor = 0, ...base } = i
  if (![units, feeMinor, excludedGrossMinor].every(n => Number.isSafeInteger(n) && n >= 0) ||
      units === 0 || excludedGrossMinor > base.listGrossMinor) throw new Error('invalid offer components')
  const eligibleGrossMinor = base.listGrossMinor - excludedGrossMinor
  const eligibleNetMinor = roundDiv(eligibleGrossMinor * BPS, BPS + base.vatBps)
  const listNetMinor = roundDiv(base.listGrossMinor * BPS, BPS + base.vatBps)
  const excludedNetMinor = listNetMinor - eligibleNetMinor
  if (kind === 'percent_of_price' && cost.kind === 'own_inventory') {
    const line = priceLine({ ...base, listGrossMinor: eligibleGrossMinor })
    return { ...line, listGrossMinor: base.listGrossMinor, listNetMinor,
      customerGrossMinor: line.customerGrossMinor + excludedGrossMinor, eligibleGrossMinor, eligibleNetMinor,
      excludedGrossMinor, excludedNetMinor, discountNetMinor: eligibleNetMinor - roundDiv(line.customerGrossMinor * BPS, BPS + base.vatBps),
      supplierCostMinor: null, feeMinor, marginMinor: null, operatorRetainedMinor: null }
  }
  if (kind !== 'share_of_margin' || cost.kind === 'own_inventory') throw new Error('rule and cost basis do not match')
  if (!Object.values(base).every(n => Number.isSafeInteger(n) && n >= 0) ||
      base.commissionBps > BPS || base.maxDiscountBps > BPS || base.discountBps > base.maxDiscountBps) {
    throw new Error('invalid margin rule or discount')
  }
  if (cost.kind === 'cost_bps' && (!Number.isSafeInteger(cost.bps) || cost.bps < 0 || cost.bps > BPS)) {
    throw new Error('invalid supplier cost rate')
  }
  const supplierCostMinor = cost.kind === 'cost_bps'
    ? roundDiv(eligibleNetMinor * cost.bps, BPS) : cost.unitCostMinor * units
  if (!Number.isSafeInteger(supplierCostMinor) || supplierCostMinor < 0) throw new Error('invalid supplier cost')
  const marginMinor = eligibleNetMinor - supplierCostMinor - feeMinor
  const discountGrossMinor = roundDiv(eligibleGrossMinor * base.discountBps, BPS)
  const discountNetMinor = eligibleNetMinor - roundDiv((eligibleGrossMinor - discountGrossMinor) * BPS, BPS + base.vatBps)
  const agentAmountMinor = roundDiv(marginMinor * base.commissionBps, BPS) - discountNetMinor
  checkMarginAllocation(marginMinor, agentAmountMinor, discountNetMinor)
  return {
    listGrossMinor: base.listGrossMinor, vatBps: base.vatBps, listNetMinor, discountBps: base.discountBps,
    discountGrossMinor, discountNetMinor, customerGrossMinor: base.listGrossMinor - discountGrossMinor,
    commissionBps: base.commissionBps, agentRateBps: 0, agentAmountMinor, eligibleGrossMinor, eligibleNetMinor,
    excludedGrossMinor, excludedNetMinor, supplierCostMinor, feeMinor, marginMinor,
    operatorRetainedMinor: marginMinor - discountNetMinor - agentAmountMinor,
  }
}

// ---------- fixture ----------
export const TOURS = [
  {
    id: 'eastfjords', supplierId: 'sup_1', activityId: 1223828, title: 'Enchanted Eastfjords: Elves, Puffins, Vök Baths', firstDate: '2027-06-01', defaultDate: '2027-06-05',
    place: 'from Seyðisfjörður', img: '../assets/img/eastfjords.jpg', season: 'Summer 2027 · cruise-ship days',
    blurb: 'From the port of Seyðisfjörður over the mountains to Borgarfjörður Eystri: elf stories, a puffin colony up close, and the Vök floating baths on the way back.', capacity: 'LIMITED', duration: '6 hours',
    meeting: 'Pick-up in Seyðisfjörður', age: 6, min: 6, max: 15, pricePerPax: 245400, vatBps: 1100,
    unit: 'per person', cancellation: 'From booking until 48 hours before the tour, cancelling costs 3% of the price. Within 48 hours of the start, 100% is charged.',
    starts: [{ id: 5263194, time: '08:30', seats: 15 }, { id: 5263195, time: '13:00', seats: 15, illustrative: true }],
  },
  {
    id: 'icecave', supplierId: 'sup_1', activityId: 408491, title: 'Blue Ice Cave from Hornafjörður Airport', firstDate: '2026-12-01', defaultDate: '2026-12-05',
    place: 'from Hornafjörður Airport', img: '../assets/img/shop/ice-cave-hero.jpg', season: 'Ice cave season · until April',
    blurb: 'Walk into a cave of blue glacier ice under Vatnajökull, then the icebergs of Jökulsárlón and Diamond Beach, where the ice washes up on black sand. A small group, a local guide.', capacity: 'ON_REQUEST', duration: '11 hours',
    meeting: 'Meet at Hornafjörður Airport', age: 6, min: 1, max: 4, pricePerPax: 193488, vatBps: 1100,
    unit: 'per person', cancellation: 'Free cancellation up to 48 hours before the tour. Within 48 hours of the start, 100% is charged.',
    starts: [{ id: 2774517, time: '07:55', seats: null }],
  },
  {
    id: 'green-cliffs', supplierId: 'sup_borea', activityId: 11612, title: 'Green Cliffs of Hornstrandir',
    capacity: 'LIMITED', pricePerPax: 57700, unit: '13 Nov 2026 price snapshot', starts: [],
  },
]
export const tour = id => TOURS.find(t => t.id === id || String(t.activityId) === String(id))

const AGENTS = [
  { id: 'agt_anna', sellerId: 'MT-00001', name: 'Anna', city: 'Reykjavík', note: 'Marina employee, pilot agent', discountBps: 0, state: 'active' },
  { id: 'agt_klara', sellerId: 'MT-00002', name: 'Klara Weber', city: 'Munich', note: 'Instagram, WhatsApp, newsletter', discountBps: 500, state: 'active' },
  { id: 'agt_wei', sellerId: 'MT-00003', name: 'Wei Chen', city: 'Shanghai', note: 'Gated market (China checks pending)', discountBps: 0, state: 'active' },
]
const PILOT_IDS = ['eastfjords', 'icecave']
const CATALOGUE = {
  settings: { brand: 'Sölunet', operatorLegalName: 'Marina Travel ehf.', issuancePrefix: 'SN' },
  suppliers: [
    { id: 'sup_1', name: 'Marina Travel', status: 'active', route: 'bokun_owned', routeStatus: 'active' },
    { id: 'sup_borea', name: 'Borea Adventures', status: 'pending', route: 'bokun_resold', routeStatus: 'pending' },
  ],
  offers: TOURS.map(t => ({ id: 'off_' + t.id, tourId: t.id, supplierId: t.supplierId, status: t.supplierId === 'sup_1' ? 'active' : 'pending' })),
  terms: TOURS.map(t => ({
    id: 'terms_' + t.id, offerId: 'off_' + t.id, version: 1, approved: t.supplierId === 'sup_1',
    from: '2026-01-01T00:00:00Z', to: null, currency: 'ISK', unit: 'traveller',
    cost: t.supplierId === 'sup_1' ? { kind: 'own_inventory' } : null, feeMinor: 0,
    cancellation: t.cancellation || 'Pending supplier approval.',
    maxDiscountBps: t.supplierId === 'sup_1' ? 500 : 0, discountAllowed: t.supplierId === 'sup_1',
  })),
  rules: [{ id: 'rr_marina', supplierId: 'sup_1', kind: 'percent_of_price', commissionBps: 1700, maxDiscountBps: 500, from: '2026-01-01T00:00:00Z' }],
}

const pilotGrants = (agentId, grantedBy) => PILOT_IDS.map(tourId => ({ agentId, tourId, grantedBy, revoked: false }))
export const settings = () => S.settings
export const networkLabel = () => `${settings().brand} · operated by ${settings().operatorLegalName}`
export const suppliers = () => S.suppliers
export const supplier = id => S.suppliers.find(s => s.id === id)
export const offer = tourId => S.offers.find(o => o.tourId === tourId)
export const offerTerms = (tourId, now = Date.now()) => {
  const rows = S.terms.filter(t => t.offerId === offer(tourId)?.id && t.approved && Date.parse(t.from) <= now && (!t.to || Date.parse(t.to) > now))
  return rows.length === 1 ? rows[0] : null
}
export const bookingParties = (tourId, seller, snapshot) => {
  const operator = snapshot?.merchant || settings().operatorLegalName
  const name = snapshot?.supplierName || supplier(tour(tourId)?.supplierId)?.name
  return [name && `Tour by ${name}`, `booked and paid with ${operator}`, seller?.name && `recommended by ${seller.name}`].filter(Boolean).join(' · ')
}

export function supplierForOrder(o) {
  return o.line.supplierName || (PILOT_IDS.includes(o.tourId) ? 'Marina Travel' : 'Unknown supplier')
}
export const supplierIdForOrder = o => o.line.supplierId || (PILOT_IDS.includes(o.tourId) ? 'sup_1' : null)
export function pauseSupplier(id) {
  requireRole('admin')
  if (sessionsEnabled()) refresh()
  const owner = supplier(id)
  if (!owner || owner.status !== 'active') return false
  owner.status = 'paused'
  log('staff', 'supplier.pause', id, 'Paused new sales')
  save()
  return true
}

export function resumeSupplier(id) {
  requireRole('admin')
  if (sessionsEnabled()) refresh()
  const owner = supplier(id)
  if (!owner || owner.status !== 'paused') return false
  owner.status = 'active'
  log('staff', 'supplier.resume', id, 'Resumed new sales')
  save()
  return true
}

export const saleError = code => ({
  not_granted: 'This seller is not approved to sell this tour.',
  supplier_paused: 'The supplier has paused new bookings.',
  offer_unavailable: 'This tour is unavailable for booking.',
  terms_missing: 'The offer needs current approved terms.',
  unavailable: 'The offer needs an approved payout rule.',
  pricing_refused: 'The price and discount could not be confirmed.',
})[code]
function salePolicy(t, a, now = Date.now()) {
  const o = offer(t.id), s = supplier(t.supplierId)
  if (s?.status === 'paused') return { error: 'supplier_paused' }
  if (s?.status !== 'active' || o?.status !== 'active' || s?.routeStatus !== 'active') return { error: 'offer_unavailable' }
  if (a ? a.state !== 'active' || !S.grants.some(g => g.agentId === a.id && g.tourId === t.id && !g.revoked) : s.route === 'bokun_resold') {
    return { error: 'not_granted' }
  }
  const terms = offerTerms(t.id, now)
  if (!terms?.cost || (s.route === 'bokun_owned') !== (terms.cost.kind === 'own_inventory')) return { error: 'terms_missing' }
  const rank = r => r.agentId ? r.tourId ? 1 : 2 : r.tourId ? 3 : 4
  const rule = S.rules.filter(r => (!r.agentId || r.agentId === a?.id) && (r.tourId === t.id || r.supplierId === s.id)
    && Date.parse(r.from) <= now && (!r.to || Date.parse(r.to) > now))
    .sort((x, y) => rank(x) - rank(y) || Date.parse(y.from) - Date.parse(x.from) || y.id.localeCompare(x.id))[0]
  if (!rule || (s.route === 'bokun_owned') !== (rule.kind === 'percent_of_price')) return { error: 'unavailable' }
  const cap = terms.discountAllowed ? Math.min(terms.maxDiscountBps, rule.maxDiscountBps) : 0
  return { o, s, terms, rule, cap }
}

export const agentOffer = (t, a = me()) => salePolicy(t, a)
export function quoteLine(t, pax, a, wanted = a?.discountBps ?? 0) {
  const policy = salePolicy(t, a)
  if (policy.error) throw new Error(policy.error)
  const { o, s, terms, rule, cap } = policy
  const units = Math.max(1, Number.isInteger(pax) ? pax : 1)
  const line = priceOfferLine({
    kind: rule.kind, cost: terms.cost, units, feeMinor: terms.feeMinor,
    listGrossMinor: priceOf(t) * units, vatBps: t.vatBps, commissionBps: a ? rule.commissionBps : 0,
    discountBps: a ? Math.min(wanted, a.discountBps, cap) : 0, maxDiscountBps: a ? cap : 0,
  })
  return { ...line, supplierId: s.id, supplierName: s.name, routeKind: s.route, offerId: o.id, termsId: terms.id,
    termsVersion: terms.version, currency: terms.currency, merchant: settings().operatorLegalName, cancellation: terms.cancellation,
    ruleKind: rule.kind, ruleId: rule.id, discountCapBps: cap, units, policyVersion: 'comm-2026-11-18.4' }
}

function days(from, n) {
  const out = [], d = new Date(from + 'T12:00:00Z')
  for (let i = 0; i < n; i++) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1) }
  return out
}

function seed() {
  const taken = {}
  // The scenario Sindri asked for: on 5 Dec the 08:30 is sold out, the 13:00 is open.
  taken['eastfjords|2027-06-05|5263194'] = 15
  taken['eastfjords|2027-06-06|5263194'] = 11
  return {
    v: 4, ...structuredClone(CATALOGUE), grants: AGENTS.flatMap(a => pilotGrants(a.id, 'Marina pilot staff')), ...seedFunnel(), now: '2026-11-18T12:00:00Z', currentAgent: 'agt_klara', priceBump: 0,
    agents: structuredClone(AGENTS), taken, links: [], quotes: [], orders: [], entries: [], audit: [], seq: 120,
  }
}

/** v3 → v4: terms carry the Bókun cancellation wording; a capture made before the Teya hold has an UNKNOWN settlement
    state (absence of a field proves nothing about Teya), never 'held'. */
function toV4(s) {
  const terms = (s.terms || []).map(x => { const t = TOURS.find(y => 'terms_' + y.id === x.id); return t?.cancellation ? { ...x, cancellation: t.cancellation } : x })
  const orders = (s.orders || []).map(o => o.payments?.some(p => p.kind === 'capture') && !o.settlement ? { ...o, settlement: 'unknown' } : o)
  return { ...s, terms, orders, v: 4 }
}
// Keep the existing sale payload contract at v4. Upgrade the nested recruitment and audit schema to v5.
function toSliceC(data) {
  if (data.funnelSchema === 5 && data.intake.policy) return data
  const policy = initialPolicy()
  const upgraded = { ...data, funnelSchema: 5, intake: { ...data.intake, policy },
    audit: (data.audit || []).map(event => ({ id: crypto.randomUUID(), role: 'legacy', ...event })) }
  for (const app of upgraded.applications) {
    app.cohort ||= policy.cohort
    if (app.attempt) app.attempt.policy ||= structuredClone(policy)
    if (app.id.startsWith('fixture-')) app.fixture = true
  }
  seedFilterExamples(upgraded)
  for (const app of upgraded.applications) {
    app.screening ||= screenApplication(app, { policy: app.attempt?.policy || policy, apps: upgraded.applications,
      bank: TEST_BANK, capacity: { left: 1 }, sellerNumber: id => upgraded.agents.find(agent => agent.id === id)?.sellerId })
    app.screening.policyVersion ||= app.attempt?.policy?.version || policy.version
  }
  return upgraded
}

export const FILTER_EXAMPLES = [
  ['fixture-9-0', 'Worked pass · 91/100'],
  ['fixture-0-1', 'Human review · ambiguous market'],
  ['fixture-0-2', 'Auto-decline · below pass mark'],
  ['fixture-0-3', 'Waitlist · intake full'],
  ['fixture-0-4', 'Duplicate · shared seller phone'],
  ['fixture-0-5', 'Gated market · Taiwan'],
  ['fixture-0-6', 'Timing flag · 2m 10s'],
  ['fixture-0-7', 'Competency flag · selling floor'],
]
function seedFilterExamples(data) {
  const policy = data.intake.policy
  const seller = data.agents.find(agent => agent.id === 'agt_klara')
  if (seller) seller.fixturePhone = '+1 202 555 0102'
  const rows = FILTER_EXAMPLES.map(([id, label]) => {
    const app = data.applications.find(row => row.id === id)
    if (!app) return null
    app.example = label
    app.access ||= token()
    app.accessUntil ||= iso(Date.now() + 30 * DAY)
    if (app.state === 'not_qualified' || app.state === 'eligible') return app
    return null
  })
  const [pass, flag, fail, waiting, duplicate, gate, fast, category] = rows
  if (flag) { flag.markets = 'International audience'; flag.state = 'look_closer' }
  if (waiting) {
    waiting.state = 'waitlist'
    const { answers, score, threshold, version } = waiting.attempt
    waiting.attempt = { answers, score, threshold, version, fixtureOnly: true }
    waiting.verifiedAt = null
  }
  if (duplicate) { duplicate.phone = seller?.fixturePhone; duplicate.state = 'look_closer' }
  if (gate) { gate.markets = 'Taiwan'; gate.state = 'market_hold' }
  if (fast) {
    fast.attempt.startedAt = iso(Date.parse(fast.attempt.submittedAt) - 130_000)
    fast.state = 'look_closer'
  }
  if (category) category.state = 'look_closer'
  for (const [closedId, openId] of [['fixture-10-0', 'fixture-1-1'], ['fixture-11-0', 'fixture-2-1']]) {
    const held = data.applications.find(app => app.id === closedId && app.state === 'eligible')
    const eligible = data.applications.find(app => app.id === openId && app.state === 'not_qualified')
    if (!held || !eligible) continue
    held.state = 'market_hold'
    eligible.state = 'eligible'
    eligible.attempt.answers = Object.fromEntries(TEST_BANK.map(item => [item.id, item.correct]))
    eligible.attempt.score = scoreAttempt(eligible.attempt.answers)
    eligible.reviewAt = eligible.attempt.submittedAt
  }
  for (const app of [flag, duplicate, gate, fast, category].filter(Boolean)) {
    app.attempt.answers = Object.fromEntries(TEST_BANK.map(item => [item.id,
      app === category && COMPETENCIES.selling.includes(item.id) ? (item.correct + 1) % item.options.length : item.correct]))
    app.attempt.score = scoreAttempt(app.attempt.answers)
    app.reviewAt = app.attempt.submittedAt
    app.assignedTo = 'reviewer'
  }
  for (const app of [pass, flag, fail, waiting, duplicate, gate, fast, category].filter(Boolean)) {
    app.screening = screenApplication(app, { policy, apps: data.applications, bank: TEST_BANK,
      sellerNumber: id => data.agents.find(agent => agent.id === id)?.sellerId, capacity: { left: 1 } })
    if (app === duplicate && seller) app.screening.checks[2] = { ...app.screening.checks[2], outcome: 'Flag', reason: `Duplicate phone with ${seller.sellerId}` }
  }
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (s?.v === 4 || s?.v === 5) {
      const upgraded = toSliceC(s)
      if (upgraded !== s) localStorage.setItem(KEY, JSON.stringify(upgraded))
      return upgraded
    }
    if (s?.v === 3) { const m = toSliceC(toV4(s)); localStorage.setItem(KEY, JSON.stringify(m)); return m }
    if (s?.v === 1 || s?.v === 2) {
      const agents = s.agents.map(({ mt, ...a }) => ({ ...a, sellerId: a.sellerId || mt }))
      const migrated = { ...s, ...(s.v === 1 ? seedFunnel() : {}), ...structuredClone(CATALOGUE), agents,
        grants: agents.filter(a => a.state === 'active').flatMap(a => pilotGrants(a.id, 'Marina pilot backfill')), v: 3 }
      const m4 = toSliceC(toV4(migrated))
      localStorage.setItem(KEY, JSON.stringify(m4))
      return m4
    }
  } catch {}
  const s = toSliceC(seed()); try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} ; return s
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch {} }
export function reset() { requireRole('admin'); S = toSliceC(seed()); save(); ensureDemoShares() }
export function refresh() { S = load() }
window.addEventListener('storage', e => { if (e.key === KEY) S = load() })

export function sessionAllowed(actor) {
  if (!actor) return false
  if (actor.role !== 'agent' && !actor.employee) return true
  const seller = findAgent(actor.id)
  return Boolean(seller && (seller.accessRevision || 0) === (actor.revision || 0) && (!actor.employee || seller.state === 'active'))
}
function requireRole(...roles) {
  const actor = checkRole(...roles)
  if (actor && !sessionAllowed(actor)) throw new Error('permission_denied')
  return actor
}

export const state = () => { if (sessionsEnabled()) throw new Error('permission_denied'); return S }
const uid = p => `${p}_${crypto.randomUUID()}`
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('')
function log(actor, action, subject, detail, at = new Date().toISOString(), extra = {}) {
  const identity = extra.identity || principal()
  const { identity: _identity, ...fields } = extra
  S.audit.unshift({ id: crypto.randomUUID(), at, actor: identity?.name || actor, actorId: identity?.id,
    role: identity?.role || 'system', action, subject, detail, policyVersion: S.intake.policy?.version, ...fields })
}
export function recordSession(action, actor, reason = '') {
  refresh()
  if (actor) { log(actor.name, 'session.' + action, actor.role, reason, iso(), { identity: actor }); save() }
}

// ---------- agents ----------
export const agents = () => { requireRole('admin'); return S.agents }
const findAgent = id => S.agents.find(a => a.id === id)
export function agent(id) {
  const seller = findAgent(id)
  if (!seller || !sessionsEnabled() || principal()?.role === 'admin') return seller
  const { name, sellerId, state, city, activatedAt } = seller
  return { id, name, sellerId, state, city, activatedAt }
}
const findSellerCode = value => {
  const code = String(value || '').trim().toUpperCase()
  return /^[A-Z]{2,6}-[0-9]{5}$/.test(code) ? S.agents.find(a => a.sellerId === code) : undefined
}
export const agentBySellerId = value => agent(findSellerCode(value)?.id)
export const me = () => findAgent(sessionsEnabled() ? requireRole('agent').id : S.currentAgent)
export function switchAgent(id) { if (sessionsEnabled()) throw new Error('permission_denied'); S.currentAgent = id; save() }
export function setDiscount(bps) {
  if (sessionsEnabled()) refresh()
  if (me()?.state !== 'active') throw new Error('not_granted')
  const cap = Math.max(0, ...TOURS.map(t => agentOffer(t).cap ?? 0))
  if (!Number.isInteger(bps) || bps < 0 || bps > cap) throw new Error('discount_out_of_range')
  me().discountBps = bps; save()
}

// ---------- departures (shape of the real availability: per date, per start, seats or null = on request) ----------
export function priceOf(t) { return t.id === 'eastfjords' ? Math.round(t.pricePerPax * (1 + (S.priceBump || 0) / 10000)) : t.pricePerPax }
export function departures(tourId, from = null, n = 21) {
  const t = tour(tourId)
  from = from || t.firstDate || '2026-12-01'
  return days(from, n).map(date => ({
    date,
    starts: t.starts.map(st => {
      const used = S.taken[`${t.id}|${date}|${st.id}`] || 0
      const seatsLeft = st.seats == null ? null : Math.max(0, st.seats - used)
      return { startTimeId: st.id, time: st.time, seatsLeft, soldOut: seatsLeft === 0, onRequest: t.capacity === 'ON_REQUEST', illustrative: !!st.illustrative }
    }),
  }))
}
export function departure(tourId, date, startTimeId) {
  const d = departures(tourId, date, 1)[0]
  return d && d.starts.find(s => s.startTimeId === Number(startTimeId))
}

// ---------- links and quotes ----------
export function createLink(tourId = null, source = 'link') {
  if (sessionsEnabled()) refresh()
  if (me()?.state !== 'active') throw new Error('not_granted')
  if (tourId) {
    const t = tour(tourId), policy = t ? agentOffer(t) : { error: 'offer_unavailable' }
    if (policy.error) throw new Error(policy.error)
  }
  const k = token(); S.links.push({ k, agentId: me().id, tourId, source, at: new Date().toISOString(), expires: '2027-11-18T00:00:00Z', revoked: false })
  me().lastActivityAt = iso()
  save(); return k
}
export const link = k => S.links.find(l => l.k === k)
export function createQuote({ tourId, date, startTimeId, pax, customer, email, discountBps }) {
  if (sessionsEnabled()) refresh()
  const t = tour(tourId), a = me()
  if (a?.state !== 'active') throw new Error('not_granted')
  if (!t) throw new Error('offer_unavailable')
  const policy = salePolicy(t, a)
  if (policy.error) throw new Error(policy.error)
  const dep = departure(tourId, date, startTimeId)
  const err = sizeError(t, pax) || seatError(dep, pax); if (err) throw new Error(err)
  if (discountBps != null && (!Number.isInteger(discountBps) || discountBps < 0)) throw new Error('discount_out_of_range')
  const line = quoteLine(t, pax, a, discountBps ?? a.discountBps)
  const q = { k: token(), id: uid('q'), agentId: a.id, tourId: t.id, date, startTimeId: Number(startTimeId), time: dep.time, pax, customer, email,
    kind: 'quote', line, listMinor: line.listGrossMinor, discountBps: line.discountBps, totalMinor: line.customerGrossMinor, agentAmountMinor: line.agentAmountMinor,
    created: new Date().toISOString(), expires: new Date(Date.now() + 24 * 3600e3).toISOString(), orderId: null, opened: null }
  a.lastActivityAt = q.created
  S.quotes.push(q); log(a.sellerId, 'quote.created', q.id, `${t.title} ${date} ${dep.time} x${pax}`); save(); return q
}
const findQuote = key => S.quotes.find(q => q.k === key || q.id === key)
export function quote(key) {
  if (!sessionsEnabled()) return findQuote(key)
  const q = S.quotes.find(item => item.k === key)
  if (!q) return
  const { email, ...guest } = q
  return guest
}
export function quoteFailures(key) {
  const q = quote(key)
  return q ? S.orders.filter(order => order.quoteId === q.id && order.state === 'failed').length : 0
}
export const myQuotes = () => S.quotes.filter(q => q.agentId === me().id).slice().reverse()
export const myQuote = id => myQuotes().find(q => q.id === id)
export const myOrder = id => salesFor(me().id).find(o => o.id === id)
export const signInAgents = () => S.agents.filter(a => ['active', 'suspended'].includes(a.state)).map(a => ({
  id: a.id, name: a.name, revision: a.accessRevision || 0, sellerId: a.sellerId, email: a.email || `${a.id.replace('agt_', '')}@example.com`, state: a.state,
}))
export function markOpened(q) {
  if (sessionsEnabled()) refresh()
  const saved = S.quotes.find(row => row.k === q.k)
  if (saved && !saved.opened) { saved.opened = new Date().toISOString(); save() }
}

// ---------- checkout (mirrors startCheckout: errors use the real codes) ----------
export function sizeError(t, pax) {
  if (!Number.isInteger(pax) || pax < 1) return 'bad_pax'
  if (pax < t.min || pax > t.max) return 'party_size_not_allowed'
  return null
}
export function seatError(dep, pax) {
  if (!dep) return 'no_departure'
  if (dep.seatsLeft != null && dep.seatsLeft < pax) return 'no_seats'
  return null
}
export function preview({ tourId, date, startTimeId, pax, refKey, quoteKey, code }) {
  const t = tour(tourId)
  if (!t) return { error: 'offer_unavailable' }
  // who gets credit: quote > confirmed code > link visit (src/attribution.ts)
  let credit = null, why = null
  const now = new Date().toISOString()
  // A typed code is a promise: a wrong or inactive one is an error even when another credit exists (src/orders.ts).
  const codeAgent = code && code.trim() ? findSellerCode(code) : null
  if (code && code.trim() && (!codeAgent || codeAgent.state !== 'active')) return { error: 'code_invalid', line: salePolicy(t, null).error ? null : quoteLine(t, pax, null) }
  if (quoteKey) {
    const q = quote(quoteKey)
    if (!q) return { error: 'quote_invalid' }
    if (q.orderId && orderById(q.orderId)?.state !== 'failed') return { error: 'quote_used', orderId: q.orderId }
    if (q.expires <= now) return { error: 'quote_expired' }
    if (q.tourId !== t.id || q.date !== date || q.startTimeId !== Number(startTimeId) || q.pax !== pax) return { error: 'quote_mismatch' }
    const qa = findAgent(q.agentId); if (!qa || qa.state !== 'active') return { error: 'quote_invalid' }
    credit = qa; why = 'quote'
  } else if (codeAgent) {
    credit = codeAgent; why = 'code'
  } else if (refKey) {
    const l = link(refKey)
    if (l && !l.revoked && l.expires > now) {
      const a = findAgent(l.agentId)
      if ((l.tourId && l.tourId !== t.id) || (l.tourId && a?.state !== 'active')) return { error: 'not_granted' }
      if (a?.state === 'active') { credit = a; why = 'visit' }
    }
  }
  const policy = salePolicy(t, credit)
  if (policy.error) return { error: policy.error, credit, why }
  const err = sizeError(t, pax) || seatError(departure(tourId, date, startTimeId), pax)
  let line
  try { line = quoteLine(t, pax, credit, why === 'quote' ? quote(quoteKey).discountBps : credit?.discountBps) }
  catch { return { error: 'pricing_refused', credit, why } }
  if (why === 'quote') {
    const q = quote(quoteKey)
    if (q.listMinor !== line.listGrossMinor || q.discountBps !== line.discountBps ||
        (q.line && JSON.stringify(q.line) !== JSON.stringify(line))) {
      return { error: 'price_changed', was: q.totalMinor, now: line.customerGrossMinor, line, credit, why }
    }
  }
  return { error: err, line, credit, why }
}

export function checkout(input) {
  // Idempotent like the real API: the same request key returns the same hand-off, never a second order.
  if (!input.requestKey || input.requestKey.length < 16) return { error: 'bad_request_key' }
  const fp = JSON.stringify([input.tourId, input.date, Number(input.startTimeId), input.pax, input.refKey || null, input.quoteKey || null, (input.code || '').trim().toUpperCase() || null])
  const same = S.orders.find(o => o.requestKey === input.requestKey)
  if (same) {
    if (same.fingerprint !== fp) return { error: 'request_key_reused' }
    return { ok: true, replay: true, orderId: same.id, state: same.state, checkoutUrl: same.state === 'handed_off' ? `pay.html?o=${same.id}` : null,
      total: same.line.customerGrossMinor, currency: same.line.currency || 'ISK', startTime: same.time, credited: same.agentId ? { sellerId: agent(same.agentId).sellerId, reason: same.why, discountMinor: same.line.discountGrossMinor } : null }
  }
  const p = preview(input)
  if (p.error) return p
  const t = tour(input.tourId), dep = departure(input.tourId, input.date, input.startTimeId)
  const o = {
    id: uid('ord'), ref: null, agentId: p.credit ? p.credit.id : null, why: p.why || 'direct', tourId: t.id, date: input.date,
    startTimeId: Number(input.startTimeId), time: dep.time, pax: input.pax, line: p.line, state: 'handed_off',
    quoteId: input.quoteKey ? quote(input.quoteKey).id : null, created: new Date().toISOString(), payments: [], history: [],
    requestKey: input.requestKey, fingerprint: fp, from: input.quoteKey ? `q.html?k=${input.quoteKey}` : `s.html?k=${input.refKey || ''}&t=${t.id}&d=${input.date}&s=${input.startTimeId}&p=${input.pax}${input.code ? `&c=${encodeURIComponent(input.code.trim())}` : ''}`,
  }
  o.history.push({ at: o.created, what: 'Checkout started', detail: p.credit ? `credited to ${p.credit.sellerId} (${p.why})` : 'direct sale, no seller' })
  S.orders.push(o)
  if (o.quoteId) findQuote(o.quoteId).orderId = o.id
  save()
  return { ok: true, orderId: o.id, state: o.state, checkoutUrl: `pay.html?o=${o.id}`, total: p.line.customerGrossMinor, currency: p.line.currency, startTime: dep.time,
    credited: p.credit ? { sellerId: p.credit.sellerId, reason: p.why, discountMinor: p.line.discountGrossMinor } : null }
}

export const orderById = id => S.orders.find(o => o.id === id)

/** The guest finishes (or abandons) the mock Bókun checkout. Mirrors applyBooking's outcomes. */
export function payOutcome(orderId, outcome, guest = {}) {
  const o = orderById(orderId); if (!o) throw new Error('not_found')
  if (o.state !== 'handed_off') return o
  const t = tour(o.tourId), now = new Date().toISOString()
  o.guest = { name: guest.name || '', email: guest.email || '' }
  if (outcome === 'abandon') { o.history.push({ at: now, what: 'Guest left the checkout', detail: 'no payment taken' }); save(); return o }
  if (outcome === 'declined') { o.state = 'failed'; o.history.push({ at: now, what: 'Payment declined by the bank', detail: 'nothing charged' }); save(); return o }
  const dep = departure(o.tourId, o.date, o.startTimeId)
  if (dep.seatsLeft != null && dep.seatsLeft < o.pax) { o.state = 'failed'; o.history.push({ at: now, what: 'Sold out during checkout', detail: 'nothing charged' }); save(); return o }
  o.ref = `MAR-T${String(++S.seq).padStart(6, '0')}`
  const k = `${o.tourId}|${o.date}|${o.startTimeId}`
  if (dep.seatsLeft != null) S.taken[k] = (S.taken[k] || 0) + o.pax
  if (t.capacity === 'ON_REQUEST') {
    o.state = 'requested'
    if (o.line.routeKind === 'bokun_resold' && outcome === 'request_paid') {
      o.payments.push({ kind: 'capture', id: `pay-${o.ref}`, amount: o.line.customerGrossMinor, at: now }); o.settlement = 'teya_hold'
    }
    o.history.push({ at: now, what: `Request ${o.ref} sent to ${supplierForOrder(o)}`, detail: 'Waiting for supplier confirmation in Bókun.' })
  } else {
    o.state = 'confirmed'
    o.payments.push({ kind: 'capture', id: `pay-${o.ref}`, amount: o.line.customerGrossMinor, at: now }); o.settlement = 'teya_hold'
    o.history.push({ at: now, what: `Paid and confirmed · ${o.ref}`, detail: `captured ${o.line.customerGrossMinor}` })
    settle(o, now)
    recordConfirmed(o, now)
  }
  save(); return o
}

/** Ledger move, exactly like applyBooking: post (target − current balance) once per state. */
function settle(o, at) {
  if (!o.agentId || o.line.agentAmountMinor <= 0) return
  const captured = o.payments.filter(p => p.kind === 'capture').reduce((s, p) => s + p.amount, 0)
  const returned = o.payments.filter(p => p.kind !== 'capture').reduce((s, p) => s + p.amount, 0)
  const target = o.state === 'cancelled' ? 0 : o.state === 'confirmed' || o.state === 'partially_refunded' ? targetBalance(o.line.agentAmountMinor, captured, returned) : null
  if (target === null) return
  const bal = S.entries.filter(e => e.orderId === o.id).reduce((s, e) => s + e.amount, 0)
  const d = target - bal
  if (d === 0) return
  const first = !S.entries.some(e => e.orderId === o.id)
  S.entries.push({ id: uid('com'), orderId: o.id, agentId: o.agentId, amount: d, type: d > 0 ? (first ? 'accrual' : 'adjustment') : 'reversal', at,
    reason: o.state === 'cancelled' ? 'booking cancelled' : returned ? `refund ${returned}` : 'paid booking matched' })
}

function recordConfirmed(order, at) {
  order.confirmedAt ||= at
  const seller = findAgent(order.agentId)
  if (!seller) return
  seller.lastActivityAt = at
  const app = S.applications.find(row => row.agentId === seller.id)
  if (app && !app.firstSaleAt) {
    app.firstSaleAt = at
    log('Booking', 'application.first_sale', app.id, order.ref, at, { orderId: order.id, agentId: seller.id })
  }
}

// Admin demo actions (slice 3 will replace these with the exception flow)
export function simulateSupplierResponse(id, response) {
  requireRole('admin')
  if (sessionsEnabled()) refresh()
  const o = orderById(id)
  if (o?.state !== 'requested' || !['accepted', 'rejected', 'expired'].includes(response)) return
  const now = new Date().toISOString()
  if (response === 'accepted') {
    o.state = 'confirmed'
    if (!o.payments.some(p => p.kind === 'capture')) { o.payments.push({ kind: 'capture', id: `pay-${o.ref}`, amount: o.line.customerGrossMinor, at: now }); o.settlement = 'teya_hold' }
    settle(o, now)
    recordConfirmed(o, now)
  } else {
    o.state = netPaid(o) > 0 ? 'exception' : 'failed'
    o.outcome = response
    if (netPaid(o) > 0) o.refundCase = { reason: response, amount: netPaid(o), openedAt: now }
  }
  o.history.push({ at: now, what: `Supplier response in Bókun · ${response}`, detail: o.refundCase ? 'Refund case opened' : '' })
  log(supplierForOrder(o), `request.${response}`, o.ref, 'Simulated Bókun response')
  save()
}
export const storeBrand = () => S.settings.storeBrand || 'Ice Cave Adventure'
/** Teya holds each payment until the tour date (Einar, 19 Nov). Before release a refund costs Marina nothing;
    after release a refund goes back through the card network and carries the card fee (3% is Einar's example). */
export const CARD_FEE_BPS_AFTER_RELEASE = 300
export function money(o) {
  if (!o.payments.some(p => p.kind === 'capture')) return null
  const released = Boolean(o.releasedAt), net = netPaid(o), unknown = o.settlement !== 'teya_hold'
  return { held: !unknown && !released && net > 0, released, unknown: unknown && !released, releaseOn: o.date, releasedAt: o.releasedAt || null,
    refundFeeMinor: o.refundFeeMinor || 0, feeUnknown: Boolean(o.refundFeeUnknown), net }
}
/** Commission on a sale is pending while the guest's money is held, payable once the tour has run (Teya pays out). */
export function commissionStatus(o) {
  const bal = balanceOf(o.id), m = money(o)
  if (!bal) return null
  if (!m) return 'pending'
  return m.released ? 'payable' : m.unknown ? 'unconfirmed' : 'pending'
}
function refundFee(o, amount) {
  if (o.settlement !== 'teya_hold' && !o.releasedAt) { o.refundFeeUnknown = true; return 'fee unknown: paid before the Teya hold' }
  const fee = o.releasedAt ? Math.round(amount * CARD_FEE_BPS_AFTER_RELEASE / 10000) : 0
  o.refundFeeMinor = (o.refundFeeMinor || 0) + fee
  return fee ? `card fee ${fee} (paid out already)` : 'no fee: Teya still held the payment'
}
/** Demo: the tour has run, so Teya pays the held money out to Marina and the commission becomes payable. */
export function adminRunTourDay(id) {
  requireRole('admin')
  if (sessionsEnabled()) refresh()
  const o = orderById(id)
  if (!o || o.releasedAt || !['confirmed', 'partially_refunded'].includes(o.state)) return false
  const now = new Date().toISOString()
  o.releasedAt = now
  o.history.push({ at: now, what: 'Tour day passed · Teya paid the money out to Marina', detail: `released ${netPaid(o)}` })
  log('staff', 'payment.released', o.ref, 'Demo: tour day')
  save()
  return true
}
export const netPaid = o => o.payments.reduce((t, p) => t + (p.kind === 'capture' ? p.amount : -p.amount), 0)
export const captured = o => o.payments.filter(p => p.kind === 'capture').reduce((t, p) => t + p.amount, 0)
export const refunded = o => o.payments.filter(p => p.kind !== 'capture').reduce((t, p) => t + p.amount, 0)
export function adminRefundHalf(id, reason = '') { if (requireRole('admin') && !reason.trim()) throw new Error('reason_required'); if (sessionsEnabled()) refresh(); const o = orderById(id); if (!o || o.state !== 'confirmed') return; const now = new Date().toISOString()
  const amt = Math.min(Math.round(o.line.customerGrossMinor / 2), netPaid(o)); if (amt <= 0) return; o.payments.push({ kind: 'refund', id: `ref-${o.ref}-${o.payments.length}`, amount: amt, at: now })
  o.state = 'partially_refunded'; o.history.push({ at: now, what: 'Half refunded to the guest', detail: `refund ${amt} · ${refundFee(o, amt)}` }); settle(o, now); log('staff', 'refund.half', o.ref, String(amt), now, { reason }); save() }
export function adminCancel(id, reason = '') { if (requireRole('admin') && !reason.trim()) throw new Error('reason_required'); if (sessionsEnabled()) refresh(); const o = orderById(id); if (!o || !['confirmed', 'partially_refunded', 'requested'].includes(o.state)) return; const now = new Date().toISOString()
  const paid = o.payments.filter(p => p.kind === 'capture').reduce((s, p) => s + p.amount, 0) - o.payments.filter(p => p.kind !== 'capture').reduce((s, p) => s + p.amount, 0)
  const feeNote = paid > 0 ? refundFee(o, paid) : ''
  if (paid > 0) o.payments.push({ kind: 'refund', id: `ref-${o.ref}-cancel`, amount: paid, at: now })
  const k = `${o.tourId}|${o.date}|${o.startTimeId}`; if (S.taken[k]) S.taken[k] = Math.max(0, S.taken[k] - o.pax)
  o.state = 'cancelled'; o.history.push({ at: now, what: paid ? 'Cancelled, full refund' : 'Cancelled, nothing was charged', detail: paid ? `refund ${paid} · ${feeNote}` : '' }); settle(o, now); log('staff', 'booking.cancel', o.ref, '', now, { reason }); save() }
export function togglePriceBump() { requireRole('admin'); if (sessionsEnabled()) refresh(); S.priceBump = S.priceBump ? 0 : 500; save(); return S.priceBump }

// ---------- reads ----------
export function balanceOf(orderId) { return S.entries.filter(e => e.orderId === orderId).reduce((s, e) => s + e.amount, 0) }
export function entriesOf(orderId) { return S.entries.filter(e => e.orderId === orderId) }
export function salesFor(agentId) {
  const actor = requireRole('agent', 'admin')
  if (actor?.role === 'agent' && actor.id !== agentId) throw new Error('permission_denied')
  return S.orders.filter(o => o.agentId === agentId).slice().reverse().map(order => {
    if (actor?.role !== 'agent') return order
    const { guest, fingerprint, requestKey, from, ...visible } = order
    return visible
  })
}
export function allOrders() { requireRole('admin'); return S.orders.slice().reverse() }

// ---------- recruitment ----------
// This browser-only fixture contains the key. The real key and scoring stay server-side (src/funnel.ts).
export const TEST_VERSION = 'pilot-1'
export const TEST_MINUTES = 15
export const TERMS_VERSION = 'pilot-1'
export const ANNA_EMAIL = 'anna@example.com'
export const TEST_BANK = [
  { id: 'east-size', type: 'Knowledge', prompt: 'How many guests can book the Eastfjords tour together?', options: ['1–4', '6–15', 'Any group size', 'Exactly 15'], correct: 1, weight: 7 },
  { id: 'ice-size', type: 'Knowledge', prompt: 'What is the party size for the ice cave pilot tour?', options: ['6–15', '1–6', '1–4', 'Exactly 4'], correct: 2, weight: 7 },
  { id: 'age', type: 'Knowledge', prompt: 'What minimum age is listed for both pilot tours?', options: ['6 years', '4 years', '5 years', 'No minimum age'], correct: 0, weight: 7 },
  { id: 'request', type: 'Knowledge', prompt: 'When does a guest pay for the on-request ice cave tour?', options: ['When the agent sends a quote', 'Before Marina checks the request', 'When they open the link', 'After Marina accepts the request'], correct: 3, weight: 9 },
  { id: 'merchant', type: 'Knowledge', prompt: 'Who takes the guest’s payment for a tour sold through Sölunet?', options: ['The agent through their own checkout', 'Marina Travel through Bókun', 'Whoever shared the link', 'The agent, who pays Marina later'], correct: 1, weight: 9 },
  { id: 'discount', type: 'Knowledge', prompt: 'You give a 5% guest discount. What happens to your 17% commission rate?', options: ['It stays at 17%', 'It drops to 5%', 'It drops to 12%', 'It rises to 22%'], correct: 2, weight: 8 },
  { id: 'materials', type: 'Knowledge', prompt: 'What should you use when promoting a Marina tour?', options: ['Marina’s approved sales text, prices and images', 'Your own price claims with Marina’s images', 'Any photo and last season’s price', 'Another operator’s cancellation terms'], correct: 0, weight: 7 },
  { id: 'more-discount', type: 'Scenario', prompt: 'A guest asks for more than the allowed discount. How do you respond?', options: ['Promise the extra discount and adjust later', 'Collect the difference yourself', 'Offer the rate within the allowed limit and refer any exception to Marina', 'Ask the guest to use another agent’s code'], correct: 2, weight: 9 },
  { id: 'bank', type: 'Scenario', prompt: 'A guest’s bank app interrupted payment. They offer to send you their card details. What do you do?', options: ['Ask the guest to pay again immediately', 'Send them to their booking status page to check the outcome', 'Ask them to send the card details in a message', 'Treat the booking as confirmed'], correct: 1, weight: 10 },
  { id: 'family', type: 'Scenario', prompt: 'A family wants to bring a five-year-old on the ice cave tour. What do you tell them?', options: ['Book and tell the guide on arrival', 'Book them as age six', 'Say the age limit only applies to groups', 'Explain the minimum age is six and refer them to Marina for options'], correct: 3, weight: 9 },
  { id: 'group', type: 'Scenario', prompt: 'A party of 16 wants a single Eastfjords booking. What do you do?', options: ['Explain the limit is 15 per booking and ask Marina about options', 'Enter 15 and promise a place for the last guest', 'Book 16 and ask the guide to handle it', 'Use an ice cave booking instead'], correct: 0, weight: 9 },
  { id: 'cash', type: 'Scenario', prompt: 'A guest offers you cash and asks you to guarantee a full refund if they cancel. How do you respond?', options: ['Take the cash and promise a refund', 'Take the cash and decide the terms later', 'Send Marina’s payment link and refer the guest to Marina for the applicable cancellation terms', 'Promise a refund and send your own payment link'], correct: 2, weight: 9 },
]

const HOUR = 3600_000
const DAY = 24 * HOUR
const iso = (time = Date.now()) => new Date(time).toISOString()
const validChoice = (item, value) => Number.isInteger(value) && value >= 0 && value < item.options.length
export function scoreAttempt(answers = {}) {
  const earned = TEST_BANK.reduce((total, item) => total + (answers[item.id] === item.correct ? item.weight : 0), 0)
  const possible = TEST_BANK.reduce((total, item) => total + item.weight, 0)
  return Math.round(100 * earned / possible)
}

function seedFunnel() {
  const groups = [
    ['Germany', 'German, English', 'German-speaking Europe', 'Lena Fischer|Jonas Klein|Mara Vogel|Felix Bauer|Nina Wagner|Lukas Hoffmann|Lea Schäfer|Emil Koch|Eva Richter|Max Braun|Nora Beck|Jan Roth'],
    ['France', 'French, English', 'France and Belgium', 'Camille Laurent|Thomas Petit|Louise Dubois|Gabriel Moreau|Alice Robert|Hugo Richard|Chloé Simon|Louis Bernard|Léa Roux|Jules Blanc|Sarah David|Adam Roy'],
    ['United Kingdom', 'English', 'UK and Ireland', 'Maya Patel|Oliver Reed|Amelia Clarke|Liam Hughes|Sophie Walsh|Noah Davies|Grace Walker|Theo Lewis|Isla Hall|Aiden Shaw|Eleanor Kent|Daniel Moore'],
    ['United States', 'English, Spanish', 'United States', 'Elena Brooks|Miles Jackson|Avery Chen|Jordan Rivera|Riley Morgan|Isaac Green|Nora Hayes|Lucas Kim|Maya Foster|Levi Clark|Zoe Nguyen|Eden Stone'],
    ['Canada', 'English, French', 'Canada', 'Amélie Gagnon|Noah Tremblay|Léa Bouchard|Émile Roy|Olivia Brown|Julien Fortin|Mia Wilson|Liam Martin|Emma Fraser|Lucas MacDonald|Sofia Wong|Owen Reid'],
    ['Netherlands', 'Dutch, English', 'Benelux', 'Sanne de Vries|Daan Jansen|Lotte Bakker|Bram Visser|Eva de Jong|Finn Smit|Roos Meijer|Thijs Bos|Nina Vos|Jesse Mulder|Noor van Dijk|Milan van Leeuwen'],
    ['Spain', 'Spanish, English', 'Spain', 'Lucía García|Hugo Martín|Sofía López|Pablo Ruiz|Alba Romero|Mateo Torres|Inés Navarro|Leo Ramos|Ana Gil|Mario Cruz|Clara Vega|Daniel Mora'],
    ['Sweden', 'Swedish, English', 'Nordics', 'Elsa Lindberg|Oscar Lund|Astrid Berg|Isak Lind|Alma Nyström|Axel Dahl|Maja Ek|Leo Holm|Vera Sjöberg|Hugo Wallin|Saga Andersson|Elias Larsson'],
    ['Italy', 'Italian, English', 'Italy', 'Giulia Rossi|Luca Marino|Sofia Costa|Matteo Ricci|Anna Conti|Marco Gallo|Emma Villa|Leo Ferrari|Chiara Greco|Andrea Rizzo|Elisa Fontana|Paolo Bruno'],
    ['Iceland', 'Icelandic, English', 'Nordics', 'Elín Jónsdóttir|Aron Einarsson|Sara Björnsdóttir|Kári Pálsson|Lilja Guðmundsdóttir|Ólafur Kristjánsson|Hildur Ólafsdóttir|Eva Sigurðardóttir'],
    ['Hong Kong', 'Cantonese, English', 'Hong Kong', 'Vivian Lau|Adrian Chan'],
    ['Taiwan', 'Mandarin, English', 'Taiwan', 'Mei Lin|Ting Huang'],
  ]
  const profiles = [
    ['Runs a travel newsletter and handles group enquiries.', 'Coordinates small-group itineraries.', 'Newsletter, referrals'],
    ['Sells through a local community and repeat customers.', 'Has travelled independently and researched the pilot tours.', 'Community groups, referrals'],
    ['Works with travel planners on customer enquiries.', 'Has experience arranging airport transfers and day trips.', 'Travel planners, email'],
  ]
  const applications = groups.flatMap(([country, languages, markets, names], group) => names.split('|').map((name, index) => {
    const id = `fixture-${group}-${index}`
    const [salesExperience, tourismExperience, channels] = profiles[(group + index) % profiles.length]
    const createdAt = iso(Date.parse('2026-11-18T12:00:00Z') - (group * 6 + index) * HOUR)
    const submittedAt = iso(Date.parse(createdAt) + HOUR)
    const answers = Object.fromEntries(TEST_BANK.map((item, j) => [item.id,
      (index === 0 ? j !== (group + 3) % 12 : (j + index * 2 + group) % (3 + index % 3) < 2)
        ? item.correct : (item.correct + 1) % item.options.length]))
    const score = scoreAttempt(answers)
    return { id, name, email: `${id}@example.com`, country, languages, markets, salesExperience, tourismExperience, channels,
      links: '', source: 'Pilot fixture', state: score >= 70 ? 'eligible' : 'not_qualified', createdAt, verifiedAt: createdAt,
      reviewAt: score >= 70 ? submittedAt : null, replyBy: '2026-11-23T17:00:00Z', notes: [],
      attempt: { id: `test-${id}`, startedAt: iso(Date.parse(submittedAt) - 10 * 60_000), submittedAt, answers, score, version: TEST_VERSION, threshold: 70 } }
  }))
  // Einar's worked score, separate from the fresh guided application.
  const example = applications.find(a => a.id === 'fixture-9-0')
  example.name = 'Anna · worked example'
  example.attempt.answers = Object.fromEntries(TEST_BANK.map(item => [item.id, item.id === 'request' ? 0 : item.correct]))
  example.attempt.score = scoreAttempt(example.attempt.answers)
  example.notes.push({ by: 'Marina review team', at: example.createdAt, text: 'The 91/100 example from Marina’s brief. Start a fresh application from the demo hub to run Anna’s full story.' })
  return { intake: { state: 'open', cap: 500, reviewCapacity: 60, baselineReviews: 22, firstReset: '2026-11-23T00:00:00Z', passMark: 70 },
    applications, invitations: [], demo: {} }
}

// Serialize funnel mutations across same-origin tabs. The synchronous fallback reloads immediately
// before writing; transactional guarantees across browsers/devices belong to the backend.
function funnelWrite(change) {
  const run = () => {
    refresh()
    try {
      const result = change()
      localStorage.setItem(KEY, JSON.stringify(S))
      return result
    } catch (error) {
      refresh()
      throw error
    }
  }
  const locks = globalThis.navigator?.locks
  return locks ? locks.request(KEY + '-funnel', async () => run()) : Promise.resolve().then(run)
}

export function reviewCapacity(now = Date.now()) {
  const first = Date.parse(S.intake.firstReset)
  const period = 7 * DAY
  const reset = now < first ? first : first + (Math.floor((now - first) / period) + 1) * period
  const used = (now < first ? S.intake.baselineReviews : 0) + S.audit.filter(event => ['application.approve', 'application.reject'].includes(event.action)
    && Date.parse(event.at) >= reset - period && Date.parse(event.at) < reset).length
  return { left: Math.max(0, S.intake.reviewCapacity - used), total: S.intake.reviewCapacity, reset: iso(reset) }
}
export function intakeState(now = Date.now()) {
  if (S.intake.state !== 'open') return S.intake.state
  if (intakeUsage(now).used >= S.intake.cap) return 'closed'
  return reviewCapacity(now).left ? 'open' : 'capacity'
}
export function intakeUsage(now = Date.now()) {
  const records = S.applications.filter(app => !app.fixture)
  const used = records.filter(app => app.state !== 'waitlist' && (app.verifiedAt || Date.parse(app.releasedAt || app.createdAt) > now - DAY)).length
  return { used, cap: S.intake.cap, waiting: records.filter(app => app.state === 'waitlist').length }
}
export function setIntake(patch, reason = '') {
  return funnelWrite(() => {
    const actor = requireRole('admin')
    if (actor && !reason.trim()) throw new Error('reason_required')
    const old = structuredClone(S.intake)
    const current = S.intake.policy
    if (patch.seenVersion !== undefined && patch.seenVersion !== current.version) throw new Error('stale_policy')
    const policy = { ...current, ...Object.fromEntries(Object.entries(patch).filter(([key]) =>
      ['cohort', 'floors', 'gates', 'fastSeconds', 'requireEvidence'].includes(key))) }
    if (!policy.cohort?.trim() || !Array.isArray(policy.gates) || policy.gates.some(key => !Object.hasOwn(MARKETS, key))
      || Object.keys(COMPETENCIES).some(key => !Number.isInteger(policy.floors?.[key]) || policy.floors[key] < 0 || policy.floors[key] > 100)
      || !Number.isInteger(policy.fastSeconds) || policy.fastSeconds < 0 || policy.fastSeconds > TEST_MINUTES * 60
      || typeof policy.requireEvidence !== 'boolean') throw new Error('intake_invalid')
    if (patch.firstReset !== undefined) {
      if (typeof patch.firstReset !== 'string' || !Number.isFinite(Date.parse(patch.firstReset))) throw new Error('intake_invalid')
      S.intake.firstReset = iso(Date.parse(patch.firstReset))
    }
    if (patch.state !== undefined && !['open', 'paused', 'closed'].includes(patch.state)) throw new Error('intake_invalid')
    for (const key of ['cap', 'reviewCapacity', 'passMark']) {
      if (patch[key] !== undefined && (!Number.isInteger(patch[key]) || patch[key] < 0 || (key === 'passMark' && patch[key] > 100))) throw new Error('intake_invalid')
    }
    for (const key of ['state', 'cap', 'reviewCapacity', 'passMark']) if (patch[key] !== undefined) S.intake[key] = patch[key]
    S.intake.policy = { ...policy, version: current.version + 1, effectiveAt: iso() }
    log('Marina admin', 'policy.update', policy.cohort, reason, iso(), { old, new: structuredClone(S.intake), reason })
    return structuredClone(S.intake)
  })
}
const findApplication = id => S.applications.find(a => a.id === id)
const canReview = (app, actor) => !actor || actor.role === 'admin' || (app.assignedTo || 'reviewer') === actor.id
export function applications() {
  const actor = requireRole('admin', 'reviewer')
  return S.applications.filter(app => canReview(app, actor))
}
export const application = id => applications().find(a => a.id === id)
export const applicationFromInvitation = key => {
  const invite = invitation(key)
  if (!invite || Date.parse(invite.expiresAt) <= Date.now()) return
  const app = findApplication(invite.appId)
  return { name: app.name, email: app.email, access: app.access, linkKey: app.linkKey }
}
const findAccess = (key, now) => key && S.applications.find(a => a.access === key && Date.parse(a.accessUntil) > now)
export const applicantLink = key => { const app = findAccess(key, Date.now()); return app ? { id: app.id } : null }
const scopedAccess = (key, now = Date.now()) => {
  const app = findAccess(key, now)
  if (!sessionsEnabled()) return app
  const actor = principal()
  return actor?.role === 'applicant' && app?.id === actor.id ? app : null
}
export function applicationByAccess(key, now = Date.now()) {
  const app = scopedAccess(key, now)
  if (!app || !sessionsEnabled()) return app
  const { id, name, state, createdAt, replyBy, verifiedAt, agentId, reviewAt, decidedAt, verify, reason, attempt } = app
  const visibleAttempt = attempt && { ...attempt }
  if (visibleAttempt) delete visibleAttempt.policy
  return { id, name, state, createdAt, replyBy, verifiedAt, agentId, reviewAt, decidedAt, verify,
    reason: ['rejected', 'reconsideration'].includes(state) ? reason : undefined, attempt: visibleAttempt }
}
export const intakePolicy = () => { requireRole('admin', 'reviewer', 'oversight'); return structuredClone(S.intake) }
export function applicationScreening(app) {
  const stored = application(app.id)
  if (!stored) throw new Error('permission_denied')
  return stored.screening || screen(stored, Date.now())
}
function screen(app, now) {
  const policy = app.attempt?.policy || app.entryPolicy || S.intake.policy
  return { policyVersion: policy.version, checkedAt: iso(now), ...screenApplication(app, {
    policy, apps: S.applications, bank: TEST_BANK, sellerNumber: id => agent(id)?.sellerId, capacity: reviewCapacity(now),
    sellerPhones: S.agents.map(a => ({ phone: a.profile?.phone || a.fixturePhone, id: a.id })),
  }) }
}
function funnelEvent(app, action, old, at, reason = '') {
  log('Recruitment', 'application.' + action, app.id, reason, iso(at), {
    old, new: app.state, reason, policyVersion: app.attempt?.policy?.version || app.entryPolicy?.version,
  })
}


export function demoApplication() {
  const app = findApplication(S.demo.applicationId)
  return !sessionsEnabled() || app?.guided ? app : null
}
export function demoTrail() {
  const app = demoApplication()
  const seller = app && agent(app.agentId)
  const active = seller?.state === 'active'
  const fits = record => seller && record.agentId === seller.id && record.tourId === 'icecave'
  const orders = S.orders.filter(fits)
  const scope = (item, keys) => item && Object.fromEntries(keys.map(key => [key, item[key]]))
  const story = scope(app, ['id', 'access', 'verifiedAt', 'state', 'reviewAt', 'agentId', 'firstSaleAt'])
  if (story) story.tested = app.attempt?.submittedAt
  return {
    app: story,
    seller: scope(seller, ['id', 'sellerId', 'name', 'state']), active, visited: S.demo.visitedAt,
    invite: scope(invitationForRecord(app), ['token', 'expiresAt']),
    quote: scope(S.quotes.findLast(q => fits(q) && Date.parse(q.expires) > Date.now()), ['k']),
    shared: scope(S.links.findLast(link => fits(link) && !link.revoked), ['k']),
    paid: orders.filter(o => o.confirmedAt && captured(o) > 0).map(o => scope(o, ['id', 'ref', 'why', 'state'])),
    open: scope(orders.findLast(o => o.state === 'handed_off'), ['id']),
    requested: scope(orders.find(o => o.state === 'requested'), ['id', 'ref']),
  }
}
export function demoExamples() {
  return FILTER_EXAMPLES.map(([id, label]) => ({ id, label, access: findApplication(id)?.access }))
}

export function visitRecruitment(source = '', stage = 'visit') {
  return funnelWrite(() => {
    S.demo.visitedAt ||= iso()
    if (!['visit', 'start'].includes(stage)) throw new Error('invalid_stage')
    S.recruitmentTraffic ||= {}
    const key = (source || 'Direct').slice(0, 120)
    const previous = Object.hasOwn(S.recruitmentTraffic, key) ? S.recruitmentTraffic[key] : { visit: 0, start: 0 }
    S.recruitmentTraffic = { ...S.recruitmentTraffic, [key]: { ...previous, [stage]: previous[stage] + 1 } }
  })
}

export function createApplication(raw, { now = Date.now(), guided = false, waitlist = false, winterTrial = false } = {}) {
  return funnelWrite(() => {
    const input = Object.fromEntries(['name', 'country', 'email', 'languages', 'markets', 'salesExperience', 'tourismExperience', 'channels', 'links', 'source', 'phone', 'reference']
      .map(key => [key, String(raw[key] ?? '').trim()]))
    input.email = input.email.toLowerCase()
    const fields = ['name', 'country', 'languages', 'markets', 'salesExperience', 'tourismExperience', 'channels']
    if (fields.some(key => !input[key] || input[key].length > 1500) || !/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(input.email)) throw new Error('application_invalid')
    if (sessionsEnabled() && raw.privacy !== 'on') throw new Error('application_invalid')
    const repeated = S.applications.find(a => a.email === input.email)
    if (repeated) {
      log('Recruitment', 'application.duplicate_suppressed', repeated.id, 'Existing mailbox matched', iso(now))
      return { ok: true, access: null, verify: null }
    }
    const status = intakeState(now)
    if (status !== 'open' && !(status === 'closed' && waitlist)) throw new Error('intake_' + status)
    const access = token()
    const verify = status === 'closed' ? null : token()
    const app = { ...input, id: 'app-' + crypto.randomUUID(), access, accessUntil: iso(now + 30 * DAY), verify, verifyUntil: iso(now + DAY),
      state: status === 'closed' ? 'waitlist' : 'submitted', createdAt: iso(now), replyBy: iso(now + 5 * DAY), notes: [] }
    app.winterTrial = winterTrial
    app.guided = guided
    app.cohort = S.intake.policy.cohort
    app.entryPolicy = structuredClone(S.intake.policy)
    S.applications.push(app)
    app.screening = screen(app, now)
    funnelEvent(app, 'submitted', null, now)
    // The guided story follows the demo link OR, failing that, the first application made in this browser,
    // so a presenter who opens the pages directly still sees the steps tick off.
    if (guided || !S.demo.applicationId) S.demo.applicationId = app.id
    return { ok: true, access, verify }
  })
}

export function releaseWaitlist(access, now = Date.now()) {
  return funnelWrite(() => {
    const app = scopedAccess(access, now)
    if (app?.state !== 'waitlist' || intakeState(now) !== 'open') throw new Error('intake_unavailable')
    app.state = 'submitted'
    if (app.attempt?.fixtureOnly) delete app.attempt
    app.releasedAt = iso(now)
    app.accessUntil = iso(now + 30 * DAY)
    app.verify = token()
    app.verifyUntil = iso(now + DAY)
    app.replyBy = iso(now + 5 * DAY)
    app.screening = screen(app, now)
    funnelEvent(app, 'waitlist_released', 'waitlist', now)
  })
}

export function resendVerification(access, now = Date.now()) {
  return funnelWrite(() => {
    const app = scopedAccess(access, now)
    if (app?.state !== 'submitted') throw new Error('verify_invalid')
    app.verify = token()
    app.verifyUntil = iso(now + DAY)
    return app.verify
  })
}
export function verifyEmail(key, now = Date.now()) {
  return funnelWrite(() => {
    const app = key && S.applications.find(a => a.verify === key)
    if (!app || app.state !== 'submitted' || Date.parse(app.verifyUntil) <= now) throw new Error('verify_invalid')
    app.verify = null
    app.verifiedAt = iso(now)
    app.state = 'verified'
    app.screening = screen(app, now)
    funnelEvent(app, 'verified', 'submitted', now)
    return app.access
  })
}

export function startTest(access, now = Date.now()) {
  return funnelWrite(() => {
    const app = scopedAccess(access, now)
    if (app?.attempt?.submittedAt || app?.attempt?.expiredAt) throw new Error('attempt_used')
    if (app?.state !== 'verified') throw new Error('test_not_available')
    if (app.attempt && Date.parse(app.attempt.endsAt) <= now) throw new Error('test_expired')
    app.attempt ||= { id: 'attempt-' + crypto.randomUUID(), startedAt: iso(now), endsAt: iso(now + TEST_MINUTES * 60_000),
      version: TEST_VERSION, threshold: S.intake.passMark, policy: structuredClone(S.intake.policy), answers: {}, position: 0 }
    return app.attempt
  })
}
function activeAttempt(access, id, now) {
  const attempt = scopedAccess(access, now)?.attempt
  if (!attempt || attempt.id !== id) throw new Error('test_not_available')
  if (attempt.submittedAt || attempt.expiredAt) throw new Error('attempt_used')
  return attempt
}
export function saveTestProgress(access, id, { itemId, choice, position }, now = Date.now()) {
  return funnelWrite(() => {
    const attempt = activeAttempt(access, id, now)
    if (Date.parse(attempt.endsAt) <= now) throw new Error('test_expired')
    if (itemId && validChoice(TEST_BANK.find(item => item.id === itemId) || { options: [] }, choice)) attempt.answers[itemId] = choice
    if (Number.isInteger(position) && position >= 0 && position <= TEST_BANK.length) attempt.position = position
    return attempt
  })
}
export function expireTest(access, id, now = Date.now()) {
  return funnelWrite(() => {
    const attempt = activeAttempt(access, id, now)
    if (Date.parse(attempt.endsAt) > now) throw new Error('test_active')
    attempt.expiredAt = iso(now)
    const app = scopedAccess(access, now)
    app.state = 'timed_out'
    app.screening = screen(app, now)
    funnelEvent(app, 'timed_out', 'verified', now)
  })
}
export function submitTest(access, id, answers, now = Date.now()) {
  return funnelWrite(() => {
    const attempt = activeAttempt(access, id, now)
    if (Date.parse(attempt.endsAt) <= now) throw new Error('test_expired')
    const choices = answers ?? attempt.answers
    if (TEST_BANK.some(item => !validChoice(item, choices[item.id]))) throw new Error('test_incomplete')
    attempt.answers = Object.fromEntries(TEST_BANK.map(item => [item.id, choices[item.id]]))
    attempt.score = scoreAttempt(attempt.answers)
    attempt.submittedAt = iso(now)
    const app = scopedAccess(access, now)
    app.screening = screen(app, now)
    const { marketHold, passed, flags } = app.screening
    app.state = !passed ? 'not_qualified' : marketHold ? 'market_hold' : flags ? 'look_closer' : 'eligible'
    if (['eligible', 'look_closer'].includes(app.state)) {
      app.reviewAt = attempt.submittedAt
      app.assignedTo = 'reviewer'
      app.assignedAt = attempt.submittedAt
    }
    funnelEvent(app, 'tested', 'verified', now)
    app.replyBy = iso(now + 5 * DAY)
    return attempt
  })
}

// Calculate inside the same lock and save as the invited agent, never as a separate reservation.
export function nextSellerId() {
  const prefix = settings().issuancePrefix
  if (!/^[A-Z]{2,6}$/.test(prefix)) throw new Error('seller_prefix_invalid')
  const max = S.agents.reduce((n, a) => Math.max(n, Number(a.sellerId?.match(/-([0-9]{5})$/)?.[1]) || 0), 0)
  if (max >= 99999) throw new Error('seller_numbers_exhausted')
  return `${prefix}-${String(max + 1).padStart(5, '0')}`
}
function issueInvitation(app, now) {
  const invite = { token: token(), agentId: app.agentId, appId: app.id, expiresAt: iso(now + 48 * HOUR) }
  S.invitations.push(invite)
  return invite
}
export const invitation = key => S.invitations.find(i => i.token === key && !i.revokedAt)
const invitationForRecord = app => S.invitations.find(i => i.appId === app?.id && !i.revokedAt)
export const invitationFor = app => {
  const actor = requireRole('applicant', 'reviewer', 'admin')
  if (actor?.role === 'applicant' && actor.id !== app?.id) return
  if (actor?.role === 'reviewer' && !canReview(findApplication(app?.id) || {}, actor)) return
  return invitationForRecord(app)
}
export function recoverInvitation(access, now = Date.now()) {
  return funnelWrite(() => {
    const app = scopedAccess(access, now)
    if (agent(app?.agentId)?.state !== 'invited') throw new Error('invite_invalid')
    const old = invitationFor(app)
    if (old) old.revokedAt = iso(now)
    const invite = issueInvitation(app, now)
    log('Recruitment', 'invitation.reissue', app.id, 'Applicant requested a replacement', iso(now))
    return invite
  })
}
export const REASONS = ['Product or policy understanding', 'Customer handling', 'Sales approach', 'Market or language fit', 'Other']
export function reviewApplication(id, reviewer, decision, reason = '', now = Date.now(), seenRevision) {
  return funnelWrite(() => {
    const actor = requireRole('reviewer', 'admin')
    const app = application(id)
    const previous = app?.state
    if (actor) reviewer = actor.name
    if (!app || !['eligible', 'look_closer', 'reconsideration', ...(actor?.role === 'admin' ? ['market_hold', 'not_qualified'] : [])].includes(app.state)
      || (app.state === 'reconsideration' && decision === 'approve' && actor?.role !== 'admin')
      || (seenRevision !== undefined && seenRevision !== (app.reviewRevision ?? 0))) throw new Error('not_reviewable')
    if (!['approve', 'look_closer', 'reject'].includes(decision)) throw new Error('decision_invalid')
    if (!reviewer?.trim()) throw new Error('reviewer_required')
    const override = decision === 'approve' && ['reconsideration', 'market_hold', 'not_qualified'].includes(previous)
    if ((decision === 'reject' || override || (actor && previous === 'look_closer' && decision === 'approve')) && !reason?.trim()) throw new Error('reason_required')
    if (!reviewCapacity(now).left && decision !== 'look_closer') throw new Error('intake_capacity')
    if (decision === 'approve') {
      app.agentId = 'agt-' + crypto.randomUUID()
      S.agents.push({ id: app.agentId, sellerId: nextSellerId(), name: app.name, city: app.country, note: 'Invited through Sölunet', discountBps: 0, state: 'invited' })
      const key = token()
      S.links.push({ k: key, agentId: app.agentId, tourId: null, source: 'activation', at: iso(now), expires: iso(now + 365 * DAY), revoked: false })
      app.linkKey = key
      issueInvitation(app, now)
    }
    app.state = { approve: 'approved', reject: 'rejected', look_closer: 'look_closer' }[decision]
    app.reviewer = reviewer.trim()
    app.firstTouchAt ||= iso(now)
    app.reviewHistory ||= []
    app.reviewHistory.push({ previous, decision, reviewer: app.reviewer, reason: reason?.trim() || '', at: iso(now) })
    app.reason = reason?.trim() || ''
    app.decidedAt = iso(now)
    app.reviewRevision = (app.reviewRevision ?? 0) + 1
    funnelEvent(app, decision, previous, now, app.reason)
    if (override) funnelEvent(app, 'override', previous, now, app.reason)
    return app
  })
}
export function addReviewNote(id, by, content, now = Date.now()) {
  return funnelWrite(() => {
    const actor = requireRole('admin', 'reviewer')
    if (actor) by = actor.name
    const app = application(id)
    if (!app || !content.trim() || !by.trim()) throw new Error('note_invalid')
    app.firstTouchAt ||= iso(now)
    app.notes.push({ by, text: content.trim().slice(0, 1500), at: iso(now) })
    funnelEvent(app, 'note', app.state, now)
  })
}
export function reconsider(access, content, now = Date.now()) {
  return funnelWrite(() => {
    const app = scopedAccess(access, now)
    if (!['rejected', 'not_qualified', 'timed_out'].includes(app?.state) || !content.trim()) throw new Error('reconsideration_invalid')
    app.notes.push({ by: 'Applicant · reconsideration', text: content.trim().slice(0, 1500), at: iso(now) })
    const previous = app.state
    app.state = 'reconsideration'
    app.appealedAt = iso(now)
    app.assignedTo ||= 'reviewer'
    funnelEvent(app, 'appealed', previous, now)
    app.reviewRevision = (app.reviewRevision ?? 0) + 1
    app.reviewAt = iso(now)
    app.replyBy = iso(now + 5 * DAY)
  })
}
export function activate(key, { email, emailVerified, termsVersion, address, phone }, now = Date.now()) {
  return funnelWrite(() => {
    const inv = invitation(key)
    const a = findAgent(inv?.agentId)
    const app = findApplication(inv?.appId)
    if (!inv || inv.consumedAt || Date.parse(inv.expiresAt) <= now || a?.state !== 'invited') throw new Error('invite_invalid')
    if (!emailVerified || email?.trim().toLowerCase() !== app.email) throw new Error('identity_mismatch')
    if (termsVersion !== TERMS_VERSION) throw new Error('terms_required')
    if (!address?.trim() || !phone?.trim()) throw new Error('profile_required')
    a.state = 'active'
    a.email = app.email
    a.country = app.country
    const defaults = pilotGrants(a.id, app.reviewer).filter(grant => (!app.winterTrial || grant.tourId === 'icecave')
      && !S.grants.some(saved => saved.agentId === a.id && saved.tourId === grant.tourId))
    S.grants.push(...defaults)
    a.note = 'Activated through Sölunet'
    a.activatedAt = inv.consumedAt = iso(now)
    a.terms = { version: termsVersion, acceptedAt: iso(now) }
    a.profile = { address: address.trim(), phone: phone.trim() }
    S.currentAgent = a.id
    funnelEvent(app, 'activated', 'approved', now)
    return a
  })
}

let S = load()
export const DEMO_LINK = 'demo-klara-icecave', DEMO_QUOTE = 'demo-quote-icecave'
function ensureDemoShares() {
  let changed = false
  if (!S.links.some(l => l.k === DEMO_LINK)) {
    S.links.push({ k: DEMO_LINK, agentId: 'agt_klara', tourId: 'icecave', source: 'link', at: '2026-11-19T12:00:00Z', expires: '2027-11-18T00:00:00Z', revoked: false, demo: true })
    changed = true
  }
  if (!S.quotes.some(q => q.k === DEMO_QUOTE)) {
    const t = tour('icecave'), a = findAgent('agt_klara'), dep = departure('icecave', '2026-12-12', 2774517)
    if (t && a && dep) {
      const line = quoteLine(t, 2, a, a.discountBps)
      S.quotes.push({ k: DEMO_QUOTE, id: 'q_demo_icecave', agentId: a.id, tourId: t.id, date: '2026-12-12', startTimeId: 2774517, time: dep.time, pax: 2,
        customer: 'the Lindqvist family', email: 'lindqvist@example.com', kind: 'quote', line, listMinor: line.listGrossMinor, discountBps: line.discountBps,
        totalMinor: line.customerGrossMinor, agentAmountMinor: line.agentAmountMinor, created: new Date().toISOString(), expires: new Date(Date.now() + 30 * 864e5).toISOString(), orderId: null, opened: null, demo: true })
      changed = true
    }
  }
  if (changed) save()
}
try { ensureDemoShares() } catch {}

export function reviewActors() {
  requireRole('admin', 'reviewer', 'oversight')
  const invited = S.agents.filter(seller => seller.employeeAt && seller.state === 'active')
    .map(seller => ({ id: seller.id, name: seller.name, role: 'reviewer' }))
  return [...STAFF.filter(actor => actor.role === 'reviewer'), ...invited]
}
export function assignApplication(id, assignee, reason, revision) {
  return funnelWrite(() => {
    requireRole('admin')
    const app = application(id)
    if (!app || (app.reviewRevision ?? 0) !== revision) throw new Error('not_reviewable')
    if (!reviewActors().some(actor => actor.id === assignee) || !reason.trim()) throw new Error('reason_required')
    const previous = app.assignedTo || 'reviewer'
    app.assignedTo = assignee
    app.assignedAt = iso()
    app.reviewRevision = revision + 1
    log('Marina admin', 'application.assign', id, reason, app.assignedAt, { old: previous, new: assignee, reason })
  })
}

export function recordSecondOpinion(id, reason, revision) {
  return funnelWrite(() => {
    const actor = requireRole('admin')
    const app = application(id)
    if (!app || (app.reviewRevision ?? 0) !== revision) throw new Error('not_reviewable')
    if (!reason.trim()) throw new Error('reason_required')
    const at = iso()
    app.notes.push({ by: actor?.name || 'Marina admin', text: reason.trim(), at })
    app.reviewRevision = revision + 1
    funnelEvent(app, 'second_opinion', app.state, Date.parse(at), reason.trim())
  })
}

const dateInRange = (date, { from, to }) => Boolean(date) && (!from || date.slice(0, 10) >= from) && (!to || date.slice(0, 10) <= to)
export function reportApplications(filters = {}) {
  requireRole('admin')
  return matchingApplications(filters).map(app => ({
    id: app.id, name: app.name, cohort: app.cohort, source: app.source || 'Direct', market: app.markets,
    applied: app.createdAt, verified: app.verifiedAt, tested: app.attempt?.submittedAt,
    score: app.attempt?.score, passMark: app.attempt?.threshold, policy: app.attempt?.policy?.version || app.entryPolicy?.version,
    decision: app.state, reviewer: app.reviewer, seller: agent(app.agentId)?.sellerId, firstSale: firstSaleDate(app),
  }))
}
function matchingApplications(filters) {
  return S.applications.filter(app => (filters.fixtures || !app.fixture)
    && (!filters.cohort || app.cohort === filters.cohort)
    && (!filters.source || (app.source || 'Direct') === filters.source)
    && (!filters.market || app.markets.toLowerCase().includes(filters.market.toLowerCase()))
    && (!filters.decision || app.state === filters.decision)
    && dateInRange(app.createdAt, filters))
}
function firstSaleDate(app) {
  if (!app.agentId) return null
  return app.firstSaleAt || S.orders.filter(order => order.agentId === app.agentId && order.ref && captured(order) > 0
    && (order.confirmedAt || ['confirmed', 'partially_refunded', 'refunded', 'cancelled'].includes(order.state)))
    .map(order => order.confirmedAt || order.payments.find(payment => payment.kind === 'capture')?.at).filter(Boolean).sort()[0] || null
}

export function oversightReport(filters = {}, now = Date.now()) {
  requireRole('admin', 'oversight')
  const cohort = matchingApplications(filters)
  const stages = [
    ['Applied', app => app.createdAt],
    ['Verified', app => app.verifiedAt],
    ['Tested', app => app.attempt?.submittedAt],
    ['Passed', app => app.attempt?.submittedAt && app.attempt.score >= app.attempt.threshold ? app.attempt.submittedAt : null],
    ['Approved', app => app.agentId && app.decidedAt],
    ['Activated', app => agent(app.agentId)?.activatedAt],
    ['First sale', firstSaleDate],
  ]
  const median = values => {
    const sorted = values.sort((a, b) => a - b)
    if (!sorted.length) return null
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid] + sorted[mid - 1]) / 2
  }
  const funnel = stages.map(([label, date], index) => {
    const prior = stages[index - 1]?.[1]
    const previous = prior ? cohort.filter(prior).length : null
    const count = cohort.filter(date).length
    const progressed = prior ? cohort.filter(app => prior(app) && date(app)).length : null
    const elapsed = prior ? median(cohort.filter(app => prior(app) && date(app))
      .map(app => Math.max(0, Date.parse(date(app)) - Date.parse(prior(app))) / HOUR)) : null
    return { label, count, previous, progressed, elapsed }
  })
  const backlog = cohort.filter(app => ['eligible', 'look_closer', 'reconsideration'].includes(app.state))
  const decisions = new Map()
  for (const app of cohort) for (const item of app.reviewHistory || []) {
    const attempt = app.attempt
    const score = attempt?.score == null ? 'No score' : `${Math.floor(Math.min(attempt.score, 99) / 10) * 10}–${Math.floor(Math.min(attempt.score, 99) / 10) * 10 + 9}${attempt.score >= 90 ? ' / 100' : ''}`
    const flags = app.screening?.checks.filter(check => check.outcome === 'Flag').map(check => check.label).join(', ') || 'No flags'
    const key = [item.reviewer, app.cohort, score, attempt?.version || '—', attempt?.policy?.version || '—', flags]
    const id = JSON.stringify(key)
    const row = decisions.get(id) || { reviewer: item.reviewer, cohort: app.cohort, score, test: key[3], policy: key[4], flags, approve: 0, reject: 0, look_closer: 0, override: 0 }
    row[item.decision]++
    if (item.decision === 'approve' && ['reconsideration', 'market_hold', 'not_qualified'].includes(item.previous)) row.override++
    decisions.set(id, row)
  }
  const workload = reviewActors().map(actor => {
    const queue = backlog.filter(app => (app.assignedTo || 'reviewer') === actor.id)
    return { reviewer: actor.name, assigned: queue.length, untouched: queue.filter(app => !app.firstTouchAt).length,
      overdue: queue.filter(app => Date.parse(app.replyBy) < now).length,
      oldestHours: queue.length ? Math.max(0, ...queue.map(app => (now - Date.parse(app.reviewAt || app.createdAt)) / HOUR)) : null }
  })
  const branch = ['waitlist', 'timed_out', 'look_closer', 'reconsideration', 'market_hold', 'not_qualified']
    .map(state => [state, cohort.filter(app => app.state === state).length])
  branch.push(['appeals_received', cohort.filter(app => app.appealedAt).length])
  const ids = new Set(cohort.map(app => app.agentId).filter(Boolean))
  branch.push(['later_refunds', S.orders.filter(order => ids.has(order.agentId) && refunded(order) > 0).length])
  branch.push(['payment_exceptions', S.orders.filter(order => ids.has(order.agentId) && order.state === 'exception').length])
  const cohortSellers = [...ids].map(findAgent).filter(Boolean)
  branch.push(['pilot_feedback_recorded', cohortSellers.filter(seller => seller.pilotFeedback).length])
  branch.push(['open_to_referring', cohortSellers.filter(seller => seller.pilotFeedback?.referral === 'yes').length])
  branch.push(['manual_payout_reference_recorded', cohortSellers.filter(seller => Object.keys(seller.payouts || {}).length).length])
  const traffic = [...new Set([...Object.keys(S.recruitmentTraffic || {}), ...cohort.map(app => app.source || 'Direct')])]
    .filter(source => !filters.source || filters.source === source).map(source => {
      const matched = cohort.filter(app => (app.source || 'Direct') === source)
      const count = S.recruitmentTraffic && Object.hasOwn(S.recruitmentTraffic, source) ? S.recruitmentTraffic[source] : { visit: 0, start: 0 }
      const productive = matched.filter(firstSaleDate).length
      const cohortName = filters.cohort || S.intake.policy.cohort
      const spend = S.campaignSpend?.find(row => row.source === source && row.cohort === cohortName)
      const cost = !filters.market && !filters.from && !filters.to && !filters.decision && !filters.fixtures && filters.cohort && spend && productive
        ? Math.round(spend.amount / productive) : null
      return [source, { ...count, applied: matched.length, productive, cost }]
    })
  return { funnel, backlog: backlog.length, workload, decisions: [...decisions.values()], branch, traffic, capacity: reviewCapacity(now), asOf: iso(now) }
}

export function auditTrail(filters = {}) {
  const actor = requireRole('admin', 'oversight')
  return S.audit.filter(event => (!filters.action || event.action === filters.action)
    && dateInRange(event.at, filters)).map(event => {
    if (actor?.role !== 'oversight') return event
    const aggregateActor = ['admin', 'reviewer', 'oversight'].includes(event.role) ? event.actor : event.role
    return { id: event.id, at: event.at, actor: aggregateActor, role: event.role, action: event.action,
      subject: event.action.startsWith('application.') ? event.subject : '', policyVersion: event.policyVersion, corrects: event.corrects }
  }).filter(event => !filters.actor || event.actor === filters.actor)
}

export function recordExport(kind, filters, count, purpose) {
  return funnelWrite(() => {
    requireRole('admin')
    if (!purpose.trim() || !['applications', 'audit', 'sales'].includes(kind) || !Number.isInteger(count) || count < 0) throw new Error('export_invalid')
    log('Marina admin', 'export.' + kind, kind, purpose.trim(), iso(), { reason: purpose.trim(), filters, count })
  })
}

export function agentRoster(filters = {}) {
  requireRole('admin')
  return S.agents.map(seller => {
    const app = S.applications.find(app => app.agentId === seller.id)
    const orders = S.orders.filter(order => order.agentId === seller.id && order.ref && captured(order) > 0
      && dateInRange(order.payments.find(payment => payment.kind === 'capture').at, filters))
    const confirmed = orders.filter(order => order.confirmedAt || ['confirmed', 'partially_refunded', 'cancelled'].includes(order.state))
    const guests = confirmed.reduce((sum, order) => sum + order.pax, 0)
    const gross = confirmed.reduce((sum, order) => sum + captured(order), 0)
    const refunds = confirmed.reduce((sum, order) => sum + refunded(order), 0)
    const lastBooking = orders.flatMap(order => order.payments).map(payment => payment.at).sort().at(-1)
    const firstSale = app && firstSaleDate(app)
    return {
      id: seller.id, sellerId: seller.sellerId, name: seller.name, country: seller.country || app?.country,
      state: seller.state, activatedAt: seller.activatedAt, lastActivityAt: [seller.lastActivityAt, seller.activatedAt, lastBooking].filter(Boolean).sort().at(-1),
      grants: S.grants.filter(grant => grant.agentId === seller.id && !grant.revoked).map(grant => grant.tourId),
      source: app?.source, market: app?.markets, approvalHours: firstSale ? Math.max(0, (Date.parse(firstSale) - Date.parse(app.decidedAt)) / HOUR) : null,
      bookings: confirmed.length, guests, gross, refunds, repeat: confirmed.length > 1, employee: Boolean(seller.employeeAt), reason: seller.suspensionReason, appeal: seller.restrictionAppeal, pilotFeedback: seller.pilotFeedback,
      methods: [...new Set(confirmed.map(order => order.why))].join(', '),
    }
  })
}

export function manageAgent(id, { action, tourId, reason, reference, month, referral }) {
  return funnelWrite(() => {
    const actor = requireRole('admin')
    const seller = findAgent(id)
    if (!seller || !reason?.trim()) throw new Error('agent_change_invalid')
    const before = seller.state
    const at = iso()
    if (action === 'suspend' && seller.state === 'active') {
      seller.state = 'suspended'
      seller.suspensionReason = reason.trim()
    } else if (action === 'reactivate' && seller.state === 'suspended') {
      seller.state = 'active'
      delete seller.suspensionReason
    } else if (action === 'promote' && seller.state === 'active' && !seller.employeeAt) {
      const app = S.applications.find(app => app.agentId === seller.id)
      if (!app || !firstSaleDate(app)) throw new Error('trial_incomplete')
      seller.employeeAt = at
      seller.accessRevision = (seller.accessRevision || 0) + 1
    } else if (['grant', 'revoke'].includes(action) && PILOT_IDS.includes(tourId)) {
      const grant = S.grants.find(row => row.agentId === id && row.tourId === tourId && !row.revoked)
      if (action === 'revoke' && grant) { grant.revoked = true; grant.revokedAt = at; grant.revokedBy = actor?.name }
      else if (action === 'grant' && !grant) S.grants.push(...pilotGrants(id, actor?.name || 'Marina admin').filter(row => row.tourId === tourId))
      else throw new Error('agent_change_invalid')
    } else if (action === 'feedback' && ['yes', 'maybe', 'no', 'unknown'].includes(referral)) {
      seller.pilotFeedback = { note: reason.trim().slice(0, 1500), referral, at }
    } else if (action === 'payout' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && reference?.trim()) {
      seller.payouts ||= {}
      if (seller.payouts[month]) throw new Error('payout_already_recorded')
      const settled = S.orders.filter(order => order.agentId === seller.id && order.releasedAt?.startsWith(month))
      seller.payouts[month] = { at, reference: reference.trim().slice(0, 120),
        amounts: Object.fromEntries(settled.map(order => [order.id, balanceOf(order.id)])) }
    } else throw new Error('agent_change_invalid')
    log('Marina admin', 'agent.' + action, seller.sellerId, tourId || month || '', at, { old: before, new: seller.state, reason: reason.trim() })
  })
}

export function agentProfile() {
  const seller = me()
  return {
    name: seller.name, sellerId: seller.sellerId, email: seller.email, country: seller.country, state: seller.state,
    profile: seller.profile, terms: seller.terms, activatedAt: seller.activatedAt, payoutStatus: seller.payoutStatus,
    restriction: seller.suspensionReason, employee: Boolean(seller.employeeAt), restrictionAppealAt: seller.restrictionAppealAt,
  }
}

export function updateProfile({ address, phone, payoutStatus, appeal }) {
  return funnelWrite(() => {
    requireRole('agent')
    const seller = me()
    if (appeal?.trim() && seller.state === 'suspended') {
      seller.restrictionAppealAt = iso()
      seller.restrictionAppeal = appeal.trim().slice(0, 1500)
      log(seller.sellerId, 'agent.restriction_appeal', seller.sellerId, 'Seller requested reconsideration')
    } else {
      if (seller.state !== 'active' || !address?.trim() || !phone?.trim() || !['requested', 'pending'].includes(payoutStatus)) throw new Error('profile_required')
      seller.profile = { address: address.trim().slice(0, 500), phone: phone.trim().slice(0, 80) }
      seller.payoutStatus = payoutStatus
      seller.lastActivityAt = iso()
      log(seller.sellerId, 'agent.profile_updated', seller.sellerId, 'Profile updated')
    }
  })
}

export function promotedReviewer(seller) {
  const account = findAgent(seller.id)
  if (account?.state !== 'active' || !account.employeeAt) return null
  return { id: account.id, name: account.name, role: 'reviewer', revision: account.accessRevision, home: 'm/applications.html', employee: true }
}

export function agentStatement(month) {
  const seller = me()
  const orders = salesFor(seller.id)
  const rows = orders.flatMap(order => {
    const items = [
      ...order.payments.map(payment => ({ at: payment.at, kind: payment.kind, guest: payment.kind === 'capture' ? payment.amount : -payment.amount })),
      ...entriesOf(order.id).map(entry => ({ at: entry.at, kind: entry.type, commission: entry.amount })),
    ]
    return items.map(item => ({ ...item, orderId: order.id, ref: order.ref, tour: tour(order.tourId).title }))
  }).filter(item => item.at)
  const months = [...new Set([iso().slice(0, 7), ...rows.map(row => row.at.slice(0, 7)), ...Object.keys(seller.payouts || {})])].sort().reverse()
  const period = month || months[0]
  const monthly = rows.filter(row => row.at.startsWith(period)).sort((a, b) => a.at.localeCompare(b.at))
  const amount = type => orders.filter(order => commissionStatus(order) === type)
    .reduce((sum, order) => sum + balanceOf(order.id)
      - (seller.payouts?.[order.releasedAt?.slice(0, 7)]?.amounts?.[order.id] || 0), 0)
  return { months, period, rows: monthly, held: amount('pending'), payable: amount('payable'), payout: seller.payouts?.[period] }
}

const MATERIAL_TOURS = ['icecave', 'eastfjords']
const defaultMaterial = tourId => ({ tourId, revision: 1, state: 'draft', history: [] })
export function materials() {
  const actor = requireRole('agent', 'admin')
  return MATERIAL_TOURS.map(id => S.materials?.[id] || defaultMaterial(id))
    .filter(row => actor?.role !== 'agent' || !agentOffer(tour(row.tourId)).error)
}
export function updateMaterial(tourId, state, reason, seenRevision) {
  return funnelWrite(() => {
    const actor = requireRole('admin')
    if (!MATERIAL_TOURS.includes(tourId) || !['published', 'withdrawn'].includes(state) || !reason.trim()) throw new Error('material_invalid')
    S.materials ||= {}
    const previous = S.materials[tourId] || defaultMaterial(tourId)
    if (previous.revision !== seenRevision || previous.state === state) throw new Error('stale_material')
    const at = iso()
    const reviewer = actor?.name || 'Marina admin'
    const event = { at, reviewer, state, reason: reason.trim() }
    const record = { ...previous, revision: previous.revision + 1, state, at, reviewer, history: [...previous.history, event] }
    S.materials[tourId] = record
    log(reviewer, 'materials.' + state, tourId, reason, at, { old: previous.state, new: state, reason })
  })
}
export function agentNotifications() {
  const seller = me()
  const orders = salesFor(seller.id)
  const activation = seller.activatedAt ? [{ label: 'Seller account activated', at: seller.activatedAt, href: 'sell.html' }] : []
  return [...activation, ...orders.flatMap(order => order.history
    .filter(item => /Checkout started|guest left/i.test(item.what) === false)
    .map(item => ({ label: item.what, at: item.at, href: 'sale.html?id=' + encodeURIComponent(order.id) })))]
    .sort((a, b) => b.at.localeCompare(a.at))
}

export function expireDemoInvitation(id, revision) {
  return funnelWrite(() => {
    requireRole('admin')
    const app = application(id)
    const invite = invitationForRecord(app)
    if (!app?.guided || !invite || invite.consumedAt || (app.reviewRevision ?? 0) !== revision) throw new Error('invite_invalid')
    const at = iso()
    const old = invite.expiresAt
    invite.expiresAt = at
    log('Marina admin', 'invitation.expire', app.id, 'Prototype recovery rehearsal', at, { old, new: at })
  })
}

export function surgeProjection(completions, eligible, now = Date.now()) {
  requireRole('admin', 'oversight')
  if (![completions, eligible].every(value => Number.isInteger(value) && value >= 0) || eligible > completions) throw new Error('invalid_surge')
  const capacity = reviewCapacity(now)
  const { used, cap } = intakeUsage(now)
  const slots = S.intake.state === 'open' ? Math.max(0, cap - used) : 0
  const admitted = Math.min(completions, slots)
  const expectedCases = completions ? Math.round(admitted * eligible / completions) : 0
  const decisions = Math.min(expectedCases, capacity.left)
  return { admitted, carryover: expectedCases - decisions, waiting: completions - admitted, decisions, reset: capacity.reset }
}

export function recordCampaignSpend(source, amount, reason) {
  return funnelWrite(() => {
    requireRole('admin')
    if (!source.trim() || !Number.isSafeInteger(amount) || amount < 0 || !reason.trim()) throw new Error('invalid_spend')
    const cohort = S.intake.policy.cohort
    const previous = S.campaignSpend?.find(row => row.source === source && row.cohort === cohort)
    S.campaignSpend = [...(S.campaignSpend || []).filter(row => row !== previous), { source, cohort, amount }]
    log('Marina admin', 'campaign.spend', cohort, source, iso(), { old: previous?.amount, new: amount, reason })
  })
}

export function appendAuditCorrection(eventId, reason) {
  return funnelWrite(() => {
    requireRole('admin')
    const original = S.audit.find(event => event.id === eventId)
    if (!original || !reason?.trim()) throw new Error('invalid_correction')
    log('Marina admin', 'audit.correction', original.action.startsWith('application.') ? original.subject : '', reason.trim(), iso(), {
      corrects: eventId, reason: reason.trim(), policyVersion: original.policyVersion,
    })
  })
}
