import * as store from './store.js'
import { $, $$, adminShell, esc, isk, sheet } from './ui.js'

adminShell('Suppliers')
function draw() {
  $('#suppliers').innerHTML = store.suppliers().map(s => {
    const products = store.TOURS.filter(t => t.supplierId === s.id)
    return `<section class="panel supplier-panel" aria-labelledby="supplier-${s.id}">
      <header><h2 class="h-task" id="supplier-${s.id}">${esc(s.name)}</h2>
       <p class="status ${s.status === 'active' ? 'confirmed' : 'pending'}">${esc({ active: 'Active', pending: 'Pending approval', paused: 'New sales paused' }[s.status])}</p></header>
      <dl class="facts">
        <div><dt>Connection</dt><dd>${s.route === 'bokun_owned' ? 'Bókun · owned inventory' : 'Bókun · resale'} · ${esc(s.routeStatus)}</dd></div>
        <div><dt>Products and terms</dt><dd><ul class="supplier-products">${products.map(t => {
          const terms = store.offerTerms(t.id)
          const offer = store.offer(t.id)
          const published = offer?.status === 'active' && s.status === 'active'
          return `<li><strong>${esc(t.title)}</strong><p class="meta">Bókun ${t.activityId} · ${published ? 'Open for prototype bookings' : 'Held from new bookings'} · ${terms ? `Terms v${terms.version}` : 'Awaiting terms'}</p>
            <p class="meta">13 Nov 2026 Bókun snapshot · ${isk(t.pricePerPax)} · ${esc(t.unit)}. Prototype rate, verify live price and basis in Bókun.</p></li>`
        }).join('')}</ul></dd></div>
      </dl>
      ${s.status === 'active' ? `<button type="button" class="btn" data-pause="${s.id}" aria-label="Pause new sales for ${esc(s.name)}">Pause new sales</button>` : ''}
      ${s.status === 'paused' ? `<button type="button" class="btn" data-resume="${s.id}" aria-label="Resume new sales for ${esc(s.name)}">Resume new sales</button>` : ''}
    </section>`
  }).join('')
  $$('[data-pause]').forEach(button => button.onclick = e => {
    const s = store.supplier(button.dataset.pause)
    sheet({
      title: `Pause new sales for ${s.name}?`, opener: button, viaKey: e.detail === 0,
      body: `<p>Guests will stop being able to start a new booking for tours run by ${esc(s.name)}. Existing bookings can still be managed.</p>
        <div class="actions"><button class="btn" type="button" id="keep">Keep selling</button><button class="btn" type="button" id="confirm-pause">Pause new sales</button></div>`,
      onOpen(dialog, close) {
        $('#keep', dialog).onclick = close
        $('#confirm-pause', dialog).onclick = () => {
          store.refresh()
          const changed = store.pauseSupplier(s.id)
          close()
          draw()
          $('.h-page').focus({ preventScroll: true })
          $('#result').textContent = changed ? `New sales paused for ${s.name}.` : `The status of ${s.name} has already changed.`
        }
      },
    })
  })
  $$('[data-resume]').forEach(button => button.onclick = () => {
    store.refresh()
    const s = store.supplier(button.dataset.resume)
    const changed = store.resumeSupplier(s.id)
    draw()
    $('.h-page').focus({ preventScroll: true })
    $('#result').textContent = changed ? `New sales open again for ${s.name}.` : `The status of ${s.name} has already changed.`
  })
}
draw()
window.addEventListener('storage', () => { store.refresh(); draw() })
