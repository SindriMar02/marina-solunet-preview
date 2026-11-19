import { $, $$, adminShell, esc, sheet } from './ui.js'
import { field, root, validateFields } from './recruitment.js'
import { materials, tour, updateMaterial } from './store.js'
import { salesKit } from './sales-kit.js'
import { liveReports } from './reporting.js'

adminShell('Sales materials')
root.classList.add('work-inner')
root.innerHTML = `<header class="work-heading"><p class="eyebrow">Marina Travel · Product publication</p><h1 class="p-h2">Sales materials</h1>
  <p class="dim">Review the Bókun snapshot and publish or withdraw each kit for agents with the corresponding tour grant. Approvals made here are prototype records.</p></header>
  <p id="material-result" role="status" tabindex="-1"></p><div id="materials"></div>`
let content = new Map()
try { content = await salesKit() } catch { $('#material-result').textContent = 'The Bókun snapshot is unavailable.' }
function draw() {
  const records = materials()
  $('#materials').innerHTML = records.map((row, index) => {
    const source = content.get(row.tourId)
    return `<section class="work-section">
      <div class="work-section-heading"><h2 class="h-task">${esc(tour(row.tourId).title)}</h2><span class="status ${row.state === 'published' ? 'confirmed' : 'pending'}">${esc(row.state)} · v${row.revision}</span></div>
      <p class="meta">Bókun product ${tour(row.tourId).activityId} · 13 Nov snapshot · English ·  ${source?.photos.length || 0} photos</p>
      ${source?.description?.length ? `<details><summary>Review official description</summary>${source.description.map(text => `<p>${esc(text)}</p>`).join('')}</details>` : ''}
      <p class="meta">Share channels · direct messages, email and social in the prototype. Rights and video assets await Marina confirmation.</p>
      ${row.history.length ? `<details><summary>Publication history</summary><ol class="work-list">${row.history.map(item => `<li><div><strong>${esc(item.state)} · ${esc(item.reviewer)}</strong><p class="meta">${esc(item.at)} · ${esc(item.reason)}</p></div></li>`).join('')}</ol></details>` : ''}
      <div><button class="btn" data-material="${index}"${!source && row.state !== 'published' ? ' disabled' : ''}>${row.state === 'published' ? 'Withdraw' : 'Publish'} kit</button></div>
    </section>`
  }).join('')
  $$('[data-material]').forEach(button => button.onclick = event => {
    const row = records[Number(button.dataset.material)]
    const state = row.state === 'published' ? 'withdrawn' : 'published'
    sheet({
      title: state === 'published' ? 'Publish sales kit' : 'Withdraw sales kit', opener: button, viaKey: event.detail === 0,
      body: `<form class="flow" novalidate>${field({ id: 'material-reason', label: 'Reason', type: 'textarea' })}
        <p class="hint err" role="alert" data-error></p><div><button class="btn primary">Record change</button></div></form>`,
      onOpen(dialog, close) {
        $('form', dialog).onsubmit = async e => {
          e.preventDefault()
          if (!validateFields(e.currentTarget)) return
          try {
            await updateMaterial(row.tourId, state, $('#material-reason', dialog).value, row.revision)
            close()
            draw()
            $('#material-result').textContent = 'Publication state updated.'
            $('#material-result').focus()
          } catch { $('[data-error]', dialog).textContent = 'The kit changed or your session expired. Reopen the kit and try again.' }
        }
      },
    })
  })
}
draw()
liveReports(draw)
