export const STAFF = [
  { id: 'reviewer', name: 'Marina Reviewer', email: 'reviewer@example.com', role: 'reviewer', home: 'm/applications.html' },
  { id: 'backup', name: 'Marina Backup Reviewer', email: 'backup@example.com', role: 'reviewer', home: 'm/applications.html' },
  { id: 'admin', name: 'Marina Admin', email: 'admin@example.com', role: 'admin', home: 'm/overview.html' },
  { id: 'orn', name: 'Örn · Codebear', email: 'orn@example.com', role: 'oversight', home: 'm/oversight.html' },
]
const KEY = 'solunet-session'
const DURATION = 12 * 60 * 60_000
const PRIVATE = ['solunet-access', 'solunet-anna-draft', 'solunet-anna-mail', 'solunet-application-draft', 'solunet-application-mail', 'fresh-order']

export const sessionsEnabled = () => typeof document !== 'undefined'
export function readSession(now = Date.now()) {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    return { principal: value?.expiresAt > now ? value : null, expired: Boolean(value && value.expiresAt <= now) }
  } catch { return { principal: null, expired: false } }
}
export const principal = () => readSession().principal
export function endSession() {
  for (let index = sessionStorage.length - 1; index >= 0; index--) {
    const key = sessionStorage.key(index)
    if (key?.startsWith('solunet-start-')) sessionStorage.removeItem(key)
  }
  for (const key of [KEY, ...PRIVATE]) sessionStorage.removeItem(key)
}
export function startSession(identity, now = Date.now()) {
  endSession()
  const value = { ...identity, sessionId: crypto.randomUUID(), expiresAt: now + DURATION }
  sessionStorage.setItem(KEY, JSON.stringify(value))
  return value
}
export function agentIdentity(agent) {
  return { id: agent.id, name: agent.name, role: 'agent', revision: agent.revision || 0, home: 'a/sell.html' }
}
export function applicantSession(id) {
  if (principal()?.role === 'applicant' && principal().id === id) return principal()
  return startSession({ id, role: 'applicant', name: 'Applicant', home: 'status.html' })
}
export function requireRole(...roles) {
  const actor = principal()
  if (sessionsEnabled() && !roles.includes(actor?.role)) throw new Error('permission_denied')
  return actor
}
export function relativeRoot() {
  return /\/(a|m)\/[^/]*$/.test(location.pathname) ? '../' : './'
}
export function localDestination(value, fallback) {
  if (!value || !/^(?:(?:a|m)\/)?[a-z-]+\.html(?:\?[^#]*)?$/.test(value)) return fallback
  return value
}
export function signInUrl() {
  const prefix = relativeRoot()
  const next = (prefix === '../' ? location.pathname.split('/').slice(-2).join('/') : location.pathname.split('/').at(-1)) + location.search
  return prefix + 'login.html?' + new URLSearchParams({ next })
}
export function homeUrl(actor = principal()) {
  return relativeRoot() + (actor?.home || 'index.html')
}
export function guardPage(roles, allowed = () => true) {
  const check = () => {
    const { principal: actor, expired } = readSession()
    if (roles.includes(actor?.role) && allowed(actor)) return true
    document.body.hidden = true
    const target = actor ? relativeRoot() + '403.html' : signInUrl() + (expired ? '&expired=1' : '')
    location.replace(target)
    return false
  }
  if (!check()) {
    // Stop this page's script while the redirect happens, without reporting the expected stop as a console error.
    window.addEventListener('error', e => { if (String(e.message).includes('permission_denied')) e.preventDefault() }, { once: true })
    throw new Error('permission_denied')
  }
  const identity = principal()
  const recheck = () => {
    if (check() && principal()?.sessionId !== identity.sessionId) {
      document.body.hidden = true
      location.reload()
    }
  }
  window.addEventListener('pageshow', recheck)
  window.addEventListener('storage', recheck)
  window.addEventListener('focus', recheck)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recheck() })
  setTimeout(check, Math.max(0, identity.expiresAt - Date.now()))
  return identity
}
