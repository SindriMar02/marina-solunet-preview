/* Shared UI: formatting, shells, sheet, toast, QR. No framework. */
import * as store from './store.js'
import { endSession, guardPage, principal, relativeRoot } from './session.js'

export const $ = (s, el = document) => el.querySelector(s)
export const $$ = (s, el = document) => [...el.querySelectorAll(s)]
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const qs = k => new URLSearchParams(location.search).get(k)

/** ISK: "1.398.780 kr", never broken (a .money span is nowrap). Negative with a real minus. */
export function isk(minor, { sign = false } = {}) {
  const n = Math.round(minor), s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${n < 0 ? '−' : sign && n > 0 ? '+' : ''}${s} kr`
}
export const pct = bps => `${(bps / 100).toLocaleString('en', { maximumFractionDigits: 2 })}%`
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function dayLabel(iso) { const d = new Date(iso + 'T12:00:00Z'); return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}` }
export function monthLabel(iso) { const d = new Date(iso.slice(0, 10) + 'T12:00:00Z'); return `${MO[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
export function stamp(iso) { const d = new Date(iso); return `${d.getUTCDate()} ${MO[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
/** Iceland is UTC+0 all year. Returns the viewer's local rendering of an Iceland departure, or '' when the same. */
export function viewerTime(date, time) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!tz || tz === 'Atlantic/Reykjavik' || tz === 'UTC') return ''
  const d = new Date(`${date}T${time}:00Z`)
  const local = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(d)
  const ice = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(d)
  return local === ice ? '' : `${local} your time (${tz.split('/').pop().replace(/_/g, ' ')})`
}

export const STATUS = {
  handed_off: 'Awaiting payment', requested: 'Requested', confirmed: 'Confirmed', partially_refunded: 'Part refunded',
  cancelled: 'Cancelled', failed: 'Not completed', exception: 'Needs a person', held: 'Held',
}
export const statusTag = s => `<span class="status ${esc(s)}">${esc(STATUS[s] || s)}</span>`

const ICON = {
  today: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  sell: '<path d="M12 3v12M6 9l6-6 6 6"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  sales: '<path d="M4 19h16M7 16V9M12 16V5M17 16v-4"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="1"/><circle cx="12" cy="12" r="2.5"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  share: '<path d="M8 12h8M12 8l4 4-4 4"/><path d="M20 4v16"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  back: '<path d="M15 6l-6 6 6 6"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
}
export const icon = (n, label) => `<svg viewBox="0 0 24 24" aria-hidden="true"${label ? '' : ''}>${ICON[n] || ''}</svg>`

/** Agent shell: header + 5-tab bar (Today/Money/More land in later slices and are marked). */
export function agentShell(active, title) {
  const actor = guardPage(['agent'], store.sessionAllowed)
  const seller = store.agent(actor.id)
  if (seller.state === 'suspended' && !['money', 'restricted', 'sales'].includes(active)) {
    location.replace('restricted.html')
    throw new Error('seller_suspended')
  }
  window.addEventListener('storage', () => {
    if (store.agent(actor.id)?.state === 'suspended' && !['money', 'restricted', 'sales'].includes(active)) {
      document.body.hidden = true
      location.replace('restricted.html')
    }
  })
  document.body.classList.add('agent', 'workbench')
  const a = store.me()
  const tabs = [['today', 'Profile', 'profile.html'], ['sell', 'Sell', 'sell.html'], ['sales', 'Sales', 'sales.html'], ['money', 'Money', 'money.html'], ['more', 'Library', 'library.html']]
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="top"><a class="logo" href="../index.html" aria-label="Marina Travel prototype hub"><span class="name">${esc(store.settings().brand)}</span><span class="by">by Marina Travel</span></a>
      <span class="where">${esc(title || 'Sales network')}</span><span class="spacer"></span>
      <span class="chip" title="${esc(a.name)}"><span class="sr">Your seller number</span><b>${esc(a.sellerId)}</b></span>${sessionControl()}</header>`)
  document.body.insertAdjacentHTML('beforeend', `<nav class="tabbar" aria-label="Agent sections">${tabs.map(([k, l, h]) =>
    h ? `<a href="${h}" aria-label="${l}"${k === active ? ' aria-current="page"' : ''}>${icon(k)}<span aria-hidden="true">${l}</span></a>`
      : `<span class="tab-off" aria-disabled="true" title="${l}: coming in a later slice">${icon(k)}<span>${l}</span><span class="sr"> (coming in a later slice)</span></span>`).join('')}</nav>`)
  skipLink(); liveRegion(); bindSignOut()
}
function skipLink() {
  if (document.querySelector('.skip')) return
  const m = document.querySelector('main')
  if (m) {
    if (!m.id) m.id = 'main'
    m.tabIndex = -1
  }
  document.body.insertAdjacentHTML('afterbegin', '<a class="skip" href="#main">Skip to content</a>')
}
let toastEl
function liveRegion() {
  if (toastEl) return
  toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); document.body.append(toastEl)
}
export function guestShell() {
  document.body.insertAdjacentHTML('afterbegin', `<header class="top"><a class="logo" href="index.html" aria-label="Marina Travel"><span class="name">${esc(store.settings().brand)}</span><span class="by">by Marina Travel</span></a>
    <span class="spacer"></span><a class="where tel" href="tel:+3548678899">+354 867 8899</a></header>`)
  skipLink(); liveRegion(); bindSignOut()
}
/** The guest-facing site (working name from settings; Einar 19 Nov: a new simple site, marinatravel.is untouched). */
export function storeShell(active) {
  const brand = store.storeBrand()
  document.body.classList.add('store')
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="top store-top">
      <a class="store-mark" href="shop.html" aria-label="${esc(brand)}, home"><span class="name">${esc(brand)}</span><span class="by">by Marina Travel</span></a>
      <span class="chip working" title="Einar and Sindri still choose the final name">working name</span>
      <span class="spacer"></span>
      <nav aria-label="${esc(brand)}">
        <a href="shop.html#tours"${active === 'tours' ? ' aria-current="page"' : ''}>Tours</a>
        <a class="wide-only" href="shop.html#how">How booking works</a>
        <a href="become.html?src=site"${active === 'sell' ? ' aria-current="page"' : ''}>Sell with us</a>
      </nav>
    </header>`)
  document.body.insertAdjacentHTML('beforeend', `
    <footer class="site-footer store-footer"><div class="site-well">
      <div><strong>${esc(brand)}</strong><p class="meta">Tours run and sold by Marina Travel ehf., licensed travel agency · Hólabraut 20, 780 Höfn · kt. 590514-0390</p></div>
      <div class="store-contact"><a class="linkbtn" href="tel:+3548678899">+354 867 8899</a><a class="linkbtn" href="mailto:hello@marinatravel.is">hello@marinatravel.is</a><a class="linkbtn" href="index.html">Prototype hub</a>${principal() ? sessionControl() : ''}</div>
    </div></footer>`)
  skipLink(); liveRegion(); bindSignOut()
}
function sessionControl() {
  return principal() ? '<button type="button" class="linkbtn signout" data-signout>Sign out</button>' :
    `<a class="linkbtn signout" href="${relativeRoot()}login.html">Sign in</a>`
}
function bindSignOut() {
  $('[data-signout]')?.addEventListener('click', () => {
    store.recordSession('sign_out', principal())
    endSession()
    location.replace(relativeRoot() + 'login.html?signedout=1')
  })
}
export function adminShell(title, roles = ['admin']) {
  const actor = guardPage(roles, store.sessionAllowed)
  document.body.classList.add('workbench', 'marina')
  const pages = {
    admin: [['overview', 'Overview'], ['applications', 'Applications'], ['agents', 'Agents'], ['sales', 'Sales'], ['suppliers', 'Suppliers'], ['library', 'Materials'], ['settings', 'Settings'], ['audit', 'Audit']],
    reviewer: [['applications', 'Applications']],
    oversight: [['oversight', 'Overview'], ['audit', 'Audit']],
  }[actor.role]

  document.body.insertAdjacentHTML('afterbegin', `<header class="top"><a class="logo" href="../index.html" aria-label="Prototype hub"><span class="name">${esc(store.settings().brand)}</span><span class="by">by Marina Travel</span></a>
    <span class="where">${esc(title)}</span><span class="spacer"></span><span class="chip">${esc(actor.name)}</span>${sessionControl()}</header>
    <nav class="work-nav" aria-label="Workspace">${pages.map(([id, label]) => `<a href="${id}.html"${location.pathname.endsWith('/' + id + '.html') ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`)
  skipLink(); liveRegion(); bindSignOut()
}

export function toast(msg, ms = 2000) {
  liveRegion()
  toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms)
}
export async function copy(text, msg = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(msg) } catch { toast('Copy did not work here: press and hold the link to copy it', 6000) }
}

/** Modal sheet. Pointer open focuses the panel, keyboard open the first control (focus-guard rule); background is
    inert; Tab and Shift+Tab stay inside; Esc, scrim and Close close it; focus returns to the opener; one at a time. */
let openSheet = null
export function sheet({ title, body, onOpen, onClose, opener, viaKey }) {
  if (openSheet) openSheet()
  const trigger = opener || document.activeElement
  const keyboard = viaKey ?? (document.documentElement.dataset.input !== 'pointer')
  const scrim = document.createElement('div'); scrim.className = 'scrim'
  const el = document.createElement('div'); el.className = 'sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title); el.tabIndex = -1
  el.innerHTML = `<div class="grab" aria-hidden="true"></div><div class="head"><h2 class="h-task">${esc(title)}</h2>
    <button class="btn" data-close aria-label="Close">${icon('close')}</button></div>${body}`
  const behind = new Map([...document.body.children].map(node => [node, node.inert]))
  behind.forEach((_, node) => { node.inert = true })
  document.body.append(scrim, el)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  let closed = false
  requestAnimationFrame(() => {
    if (closed) return
    scrim.classList.add('open'); el.classList.add('open')
    const first = focusables().find(control => !control.hasAttribute('data-close')) || focusables()[0]
    const initial = keyboard && first ? first : el
    initial.focus({ preventScroll: true })
  })
  const focusables = () => $$('button, a[href], input, select, textarea', el).filter(x => !x.disabled && x.getClientRects().length)
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    if (e.key === 'Tab') { const f = focusables(); if (!f.length) return
      const a = document.activeElement
      if (e.shiftKey && (a === f[0] || a === el)) { e.preventDefault(); f.at(-1).focus() }
      else if (!e.shiftKey && a === f.at(-1)) { e.preventDefault(); f[0].focus() } }
  }
  function close() {
    if (closed) return; closed = true; openSheet = null
    document.removeEventListener('keydown', onKey)
    behind.forEach((inert, node) => { node.inert = inert })
    el.inert = true
    scrim.classList.remove('open'); el.classList.remove('open'); el.classList.add('closing')
    const done = () => { scrim.remove(); el.remove() }
    if (reduce) done(); else { el.addEventListener('transitionend', done, { once: true }); setTimeout(done, 400) }
    trigger?.focus({ preventScroll: true })
    onClose?.()
  }
  openSheet = close
  document.addEventListener('keydown', onKey); scrim.addEventListener('click', close); el.querySelector('[data-close]').addEventListener('click', close)
  onOpen && onOpen(el, close)
  return close
}

/** QR via qrcode-generator (cdnjs, loaded once). Dark navy modules on a cream quiet zone. */
let qrLib
export async function qrSvg(text) {
  if (!qrLib) qrLib = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'; s.onload = () => res(window.qrcode); s.onerror = rej; document.head.append(s) })
  try { const q = (await qrLib)(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 6, margin: 0, scalable: true }).replace(/fill="black"/g, 'fill="#1c2b3a"') }
  catch { return '<p class="meta">QR unavailable offline. Use the link.</p>' }
}

export const base = () => location.href.replace(/\/(a|m)\/[^/]*$/, '/').replace(/\/[^/]*$/, '/')

export function siteShell(active) {
  document.body.classList.add('site')
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="top site-top">
      <a class="logo" href="index.html" aria-label="Marina Travel · demo hub"><span class="name">${esc(store.settings().brand)}</span><span class="by">by Marina Travel</span></a>
      <span class="site-brand">${esc(store.settings().brand)}</span><span class="spacer"></span>
      <nav aria-label="${esc(store.settings().brand)}">
        <a href="how.html"${active === 'how' ? ' aria-current="page"' : ''}>How it works</a>
        <a href="index.html"${active === 'hub' ? ' aria-current="page"' : ''}>Demo</a>
        ${sessionControl()}
      </nav>
    </header>`)
  document.body.insertAdjacentHTML('beforeend', `
    <footer class="site-footer"><div class="site-well"><strong>${esc(store.networkLabel())}</strong><span>Höfn, Iceland</span>
      <a class="linkbtn" href="tel:+3548678899">+354 867 8899</a></div></footer>`)
  skipLink()
  liveRegion()
  bindSignOut()
}

export function scrollReveal() {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const groups = $$('[data-reveal]')
  groups.forEach(group => {
    group.classList.add('awaiting')
    ;[...group.children].forEach((child, index) => child.style.setProperty('--reveal-delay', `${index * 80}ms`))
  })
  let observer
  function observe() {
    observer?.disconnect()
    const pending = groups.filter(group => !group.classList.contains('arrived'))
    if (!pending.length) { window.removeEventListener('resize', observe); return }
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('arrived')
        observer.unobserve(entry.target)
      }
    }, { rootMargin: `0px 0px -${Math.round(window.innerHeight * .12)}px 0px` })
    pending.forEach(group => observer.observe(group))
  }
  observe()
  window.addEventListener('resize', observe)
}
