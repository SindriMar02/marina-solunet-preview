import { $, $$, esc, icon, siteShell } from './ui.js'

const motion = matchMedia('(prefers-reduced-motion: reduce)')
const rows = new WeakMap()
const moving = new Set()
motion.addEventListener('change', () => {
  if (motion.matches) for (const panel of moving) rows.get(panel)?.finish()
})

export const arrow = '<span class="arrow" aria-hidden="true">›</span>'
export function funnelShell(page, { apply = 'apply.html', landing = false } = {}) {
  siteShell(page)
  const header = $('.site-top')
  const nav = $('nav', header)
  const session = $('.signout', nav)
  const brand = $('.name', header).textContent
  const wordmark = `<span class="name">${esc(brand)}</span><span class="by">by Marina Travel</span>`
  const home = landing ? '' : 'become.html'
  header.className = 'funnel-header'
  header.innerHTML = `<div class="funnel-mast well">
    <a class="wordmark" href="${home || '#overview'}">${wordmark}</a>
    <div class="mast-links"><a href="index.html"${page === 'hub' ? ' aria-current="page"' : ''}>Walkthrough</a></div>
  </div>
  <div class="funnel-sub"><div class="funnel-sub-inner well">
    <a class="sub-brand" href="${home || '#overview'}">Sell Iceland</a>
    <button class="btn menu-toggle" type="button" aria-controls="funnel-menu" aria-expanded="false" aria-label="Toggle programme navigation">${icon('today')}</button>
    <nav class="funnel-menu" id="funnel-menu" aria-label="Seller programme">
      <a href="${home}#overview"${landing ? ' aria-current="page"' : ''}>Overview</a>
      <a href="${landing ? '#how-it-works' : 'how.html'}"${page === 'how' ? ' aria-current="page"' : ''}>How it works</a>
      <a href="${home}#tours">Tours</a><a href="${home}#faq">FAQ</a>
    </nav>
    <a class="btn primary sub-apply" data-intake-link href="${esc(apply)}">Apply ${arrow}</a>
  </div></div>`
  if (session) $('.mast-links', header).append(session)
  const toggle = $('.menu-toggle', header)
  const menu = $('.funnel-menu', header)
  const narrow = matchMedia('(max-width: 680px)')
  const close = () => { if (toggle.getAttribute('aria-expanded') === 'true') setDisclosure(toggle, menu, false) }
  toggle.onclick = () => setDisclosure(toggle, menu, toggle.getAttribute('aria-expanded') !== 'true')
  menu.addEventListener('click', e => { if (e.target.closest('a')) close() })
  header.addEventListener('keydown', e => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { close(); toggle.focus() }
  })
  document.addEventListener('click', e => { if (!header.contains(e.target)) close() })
  const resize = () => {
    rows.get(menu)?.cancel()
    moving.delete(menu)
    delete menu.dataset.animating
    menu.inert = narrow.matches
    menu.hidden = narrow.matches
    toggle.setAttribute('aria-expanded', 'false')
  }
  narrow.addEventListener('change', resize)
  resize()
  $('.site-footer').innerHTML = `<div class="well footer-inner">
    <div><a class="wordmark" href="become.html">${wordmark}</a>
    <p>Marina Travel ehf. · Hólabraut 20, 780 Höfn · kt. 590514-0390</p></div>
    <div class="footer-links"><a href="how.html">How it works</a><a href="index.html">Walkthrough</a><a href="tel:+3548678899">Contact Marina</a></div>
    <small>Prototype · Use fictional details</small>
  </div>`
}

export function setDisclosure(trigger, panel, open) {
  const from = panel.hidden ? 0 : panel.getBoundingClientRect().height
  rows.get(panel)?.cancel()
  panel.hidden = false
  panel.dataset.animating = ''
  panel.inert = !open
  trigger.setAttribute('aria-expanded', String(open))
  const finish = () => {
    moving.delete(panel)
    delete panel.dataset.animating
    panel.hidden = !open
  }
  if (motion.matches || !panel.animate) { finish(); return }
  const to = open ? panel.scrollHeight : 0
  const animation = panel.animate([{ height: `${from}px` }, { height: `${to}px` }], {
    duration: 360, easing: 'cubic-bezier(.65,.05,.36,1)',
  })
  rows.set(panel, animation)
  moving.add(panel)
  animation.onfinish = finish
}

export function accordion(items, { id, active = -1, single = false } = {}) {
  return `<div class="disclosures" data-accordion ${single ? 'data-single' : ''}>
    ${items.map(([title, body], i) => `<div class="disclosure">
      <h3><button type="button" class="disclosure-trigger" aria-expanded="${i === active}" aria-controls="${id}-${i}">${title}<span aria-hidden="true"></span></button></h3>
      <div class="disclosure-panel" id="${id}-${i}"${i === active ? '' : ' hidden inert'}><div>${body}</div></div>
    </div>`).join('')}</div>`
}

export function bindAccordion(area, onSelect) {
  const single = area.hasAttribute('data-single')
  const triggers = $$('.disclosure-trigger', area)
  const toggle = (button, open) => setDisclosure(button, document.getElementById(button.getAttribute('aria-controls')), open)
  triggers.forEach((button, i) => {
    button.onclick = () => {
      const open = button.getAttribute('aria-expanded') !== 'true'
      if (single) {
        if (!open) return
        for (const other of triggers) if (other !== button && other.getAttribute('aria-expanded') === 'true') toggle(other, false)
      }
      toggle(button, open)
      if (open) onSelect?.(i)
    }
  })
}

export function revealSections() {
  if (!('IntersectionObserver' in window)) return
  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue
      if (!motion.matches) target.classList.add('funnel-arrived')
      observer.unobserve(target)
    }
  }, { rootMargin: '0px 0px -24px' })
  $$('[data-reveal]').forEach(node => observer.observe(node))
}

export function smoothMarketing() {
  let scroller
  let loading
  let pendingFrame = 0
  let lastOffset = -1
  const art = $('[data-parallax]')
  const fine = matchMedia('(hover: hover) and (pointer: fine)')
  function parallax() {
    pendingFrame = 0
    const offset = motion.matches || !fine.matches ? 0 : Math.min(22, Math.max(0, scrollY) * 22 / 720)
    if (offset !== lastOffset) art?.style.setProperty('--drift', `${offset}px`)
    lastOffset = offset
  }
  const schedule = () => { if (art && !pendingFrame) pendingFrame = requestAnimationFrame(parallax) }
  function sync() {
    schedule()
    if (motion.matches || !fine.matches) { scroller?.destroy(); scroller = null; return }
    if (scroller || loading) return
    loading = import('https://cdn.jsdelivr.net/npm/lenis@1.3.17/dist/lenis.mjs')
      .then(({ default: Lenis }) => {
        if (!motion.matches && fine.matches) scroller = new Lenis({ autoRaf: true, lerp: .1, syncTouch: false, anchors: false, stopInertiaOnNavigate: true,
          prevent: node => node.matches?.('.sheet, .scrim'), })
        loading = null
      }).catch(() => { loading = null })
  }
  motion.addEventListener('change', sync)
  fine.addEventListener('change', sync)
  if (art) window.addEventListener('scroll', schedule, { passive: true })
  sync()
}

export function tourPhoto(name, alt, sizes, { lazy = true, className = '' } = {}) {
  const path = `assets/img/shop/${name}`
  const srcset = [400, 800, 1480].map(width => `${path}-${width}.jpg ${width}w`).join(', ')
  return `<img${className ? ` class="${className}"` : ''} src="${path}.jpg" srcset="${srcset}" sizes="${sizes}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ''}>`
}
