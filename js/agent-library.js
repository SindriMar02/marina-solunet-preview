import { $, $$, agentShell, copy, esc } from './ui.js'
import { root } from './recruitment.js'
import { createLink, materials } from './store.js'
import { salesKit } from './sales-kit.js'
import { liveReports } from './reporting.js'

agentShell('more', 'Sales library')
root.classList.add('work-inner')
root.innerHTML = `<header class="work-heading"><p class="eyebrow">Tools for agents</p><h1 class="p-h2">Sales library</h1>
  <p class="dim">Use the Marina-published text and images for the tours you sell. Share your own tour link so the booking is credited to you.</p></header>
  <form class="work-filters" aria-label="Library filters">
    <label>Product<select class="input" name="product"><option value="">All granted tours</option></select></label>
    <label>Channel<select class="input" name="channel"><option>Email</option><option>Direct message</option><option>Social</option></select></label>
    <label>Language<select class="input" name="language"><option>English</option></select></label>
  </form>
  <p class="hint" role="status" id="library-status"></p><div id="kits"></div>`
const form = $('form', root)
let assets = new Map()
try { assets = await salesKit() } catch { $('#library-status').textContent = 'The product snapshot is unavailable.' }
function draw() {
  const rows = materials()
  const product = form.elements.product
  const selected = product.value
  product.innerHTML = '<option value="">All granted tours</option>' + rows.map(row => `<option value="${row.tourId}">${esc(assets.get(row.tourId)?.shortTitle || row.tourId)}</option>`).join('')
  if (rows.some(row => row.tourId === selected)) product.value = selected
  const visible = rows.filter(row => !product.value || row.tourId === product.value).filter(row => assets.has(row.tourId))
  $('#kits').innerHTML = visible.length ? visible.map(row => {
    const asset = assets.get(row.tourId)
    const published = row.state === 'published'
    return `<section class="work-section" data-ledger-reveal>
      <div class="work-section-heading"><h2 class="h-task">${esc(asset.shortTitle)}</h2><span class="meta">Kit v${row.revision} · ${esc(form.elements.channel.value)} · English</span></div>
      ${published ? `<p class="meta">Published by ${esc(row.reviewer)} for this prototype. Use on the selected channel for this tour only. Real photo rights require Marina confirmation.</p>
        ${asset.description.map(text => `<p>${esc(text)}</p>`).join('')}
        <div class="actions"><button class="btn" data-text="${row.tourId}">Copy sales text</button><button class="btn" data-link="${row.tourId}">Create seller link</button>
          <a class="btn" href="tour.html?t=${row.tourId}">Share or quote tour</a></div>
        <ul class="kit-photos">${asset.photos.map(photo => `<li><a href="../${esc(photo.src)}" download><img src="../${esc(photo.src)}" alt="${esc(photo.alt)}" loading="lazy"><span>Download photo</span></a></li>`).join('')}</ul>
        <p class="meta">No video has been supplied for this kit.</p>` : `<p>Marina has ${row.state === 'withdrawn' ? 'withdrawn this sales kit' : 'yet to publish this kit'}.</p><a class="linkbtn" href="tour.html?t=${row.tourId}">Open your tour tools</a>`}
    </section>`
  }).join('') : '<p class="notice">No sales kits match this filter.</p>'
  $$('[data-text]').forEach(button => button.onclick = () => copy(assets.get(button.dataset.text).description.join('\n\n'), 'Sales text copied'))
  $$('[data-link]').forEach(button => button.onclick = () => {
    try {
      const key = createLink(button.dataset.link, 'library')
      const url = new URL('../s.html?k=' + key, location.href).href
      const anchor = Object.assign(document.createElement('a'), { href: url, textContent: 'Open your seller link', className: 'linkbtn' })
      $('#library-status').replaceChildren(anchor)
      copy(url, 'Seller link copied')
    } catch { $('#library-status').textContent = 'This tour is unavailable for sharing.' }
  })
}
form.onchange = draw
form.onsubmit = event => event.preventDefault()
draw()
liveReports(draw)
