// Tour photo viewer. Focus rule (CLAUDE.md, focus-guard): a pointer open focuses the viewer itself, a keyboard open the
// close button; background inert; Esc, the close button and the backdrop close it; focus returns to the opener.
// Arrow keys and the side buttons move between photos; swipe on touch. One open at a time.
import { esc } from './ui.js'

let current = null

export function openGallery(photos, start = 0, { opener, viaKey = false, title = 'Photos' } = {}) {
  if (!photos.length) return
  current?.close()
  let i = Math.max(0, Math.min(start, photos.length - 1)), closed = false
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const el = document.createElement('div')
  el.className = 'lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title); el.tabIndex = -1
  el.innerHTML = `
    <div class="lb-bar"><p class="lb-count" aria-live="polite"></p>
      <button class="btn lb-close" type="button" aria-label="Close photos">Close</button></div>
    <figure class="lb-stage"><img alt=""><figcaption class="meta"></figcaption></figure>
    ${photos.length > 1 ? `<button class="lb-nav prev" type="button" aria-label="Previous photo">‹</button>
    <button class="lb-nav next" type="button" aria-label="Next photo">›</button>` : ''}`
  const img = el.querySelector('img'), count = el.querySelector('.lb-count'), cap = el.querySelector('figcaption')
  const behind = [...document.body.children]
  behind.forEach(n => { n.inert = true })
  const scrollY = window.scrollY
  document.documentElement.classList.add('lb-lock')
  document.body.append(el)

  function show(n, dir = 0) {
    i = (n + photos.length) % photos.length
    const p = photos[i]
    if (!reduce && dir) { img.classList.remove('in'); void img.offsetWidth }
    img.src = p.src; img.alt = p.alt || ''; img.width = p.w || 0; img.height = p.h || 0
    img.style.setProperty('--from', `${dir * 24}px`)
    img.classList.add('in')
    count.textContent = `Photo ${i + 1} of ${photos.length}`
    cap.textContent = p.alt || ''
    // warm the next photo so arrowing never shows an empty frame
    const nx = new Image(); nx.src = photos[(i + 1) % photos.length].src
  }
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowRight' && photos.length > 1) { e.preventDefault(); show(i + 1, 1) }
    else if (e.key === 'ArrowLeft' && photos.length > 1) { e.preventDefault(); show(i - 1, -1) }
    else if (e.key === 'Tab') {
      const f = [...el.querySelectorAll('button')].filter(b => b.offsetParent !== null)
      const a = document.activeElement
      if (e.shiftKey && (a === f[0] || a === el)) { e.preventDefault(); f.at(-1).focus() }
      else if (!e.shiftKey && a === f.at(-1)) { e.preventDefault(); f[0].focus() }
    }
  }
  let x0 = null
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') x0 = e.clientX })
  el.addEventListener('pointerup', e => {
    if (x0 == null) return
    const dx = e.clientX - x0; x0 = null
    if (Math.abs(dx) > 48) show(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1)
  })
  el.addEventListener('click', e => { if (e.target === el || e.target.classList.contains('lb-stage')) close() })
  el.querySelector('.lb-close').onclick = close
  if (photos.length > 1) { el.querySelector('.prev').onclick = () => show(i - 1, -1); el.querySelector('.next').onclick = () => show(i + 1, 1) }
  document.addEventListener('keydown', onKey)

  show(i)
  requestAnimationFrame(() => {
    if (closed) return
    el.classList.add('open')
    ;(viaKey ? el.querySelector('.lb-close') : el).focus({ preventScroll: true })
  })

  function close() {
    if (closed) return; closed = true; current = null
    document.removeEventListener('keydown', onKey)
    el.classList.remove('open')
    const done = () => {
      el.remove()
      behind.forEach(n => { n.inert = false })
      document.documentElement.classList.remove('lb-lock')
      window.scrollTo(0, scrollY)
      opener?.focus({ preventScroll: true })
    }
    if (reduce) done(); else setTimeout(done, 180)
  }
  current = { close }
  return current
}

/** Grid on the page: one large photo and two beside it, plus "All N photos". */
export function galleryGrid(photos, title) {
  const shown = photos.slice(0, 3)
  return `<div class="tour-gallery n${shown.length}">
    ${shown.map((p, n) => `<button type="button" class="tg-item" data-photo="${n}" aria-label="Open photo ${n + 1} of ${photos.length}">
      <img src="${esc(p.src)}" alt="${esc(p.alt || '')}" width="${p.w || ''}" height="${p.h || ''}" ${n ? 'loading="lazy"' : 'fetchpriority="high"'}></button>`).join('')}
    ${photos.length > 3 ? `<button type="button" class="btn tg-all" data-photo="0">All ${photos.length} photos</button>` : ''}
  </div>`
}

export function wireGallery(root, photos, title) {
  root.querySelectorAll('[data-photo]').forEach(b => {
    b.addEventListener('click', e => openGallery(photos, Number(b.dataset.photo), { opener: b, viaKey: e.detail === 0, title }))
  })
}
