import { $, agentShell, esc } from './ui.js'
import { field, root, validateFields } from './recruitment.js'
import { agentProfile, updateProfile } from './store.js'

agentShell('restricted', 'Seller access')
root.classList.add('work-inner')
const seller = agentProfile()
root.innerHTML = `<header class="work-heading"><p class="eyebrow">Seller · ${esc(seller.sellerId)}</p>
  <h1 class="p-h2">${seller.state === 'suspended' ? 'Selling access is paused' : 'Selling access is active'}</h1>
  <p class="dim">${seller.state === 'suspended' ? esc(seller.restriction || 'Contact Marina about your account.') : 'Your approved tools are available.'}</p></header>
  <div class="actions"><a class="btn" href="money.html">View statements</a><a class="btn" href="sales.html">View sales</a>
    ${seller.state === 'active' ? '<a class="btn primary" href="sell.html">Open seller tools</a>' : ''}</div>
  ${seller.state === 'suspended' ? `<form class="flow work-section" novalidate>
    <h2 class="h-task">Request reconsideration</h2>${seller.restrictionAppealAt ? `<p class="meta">Last sent ${esc(seller.restrictionAppealAt.slice(0, 10))}</p>` : ''}
    ${field({ id: 'appeal', label: 'What would you like Marina to review?', type: 'textarea' })}
    <div><button class="btn primary">Send to Marina (demo)</button></div><p class="hint" role="status" id="appeal-result"></p></form>` : ''}`
const form = $('form', root)
if (form) form.onsubmit = async event => {
  event.preventDefault()
  if (!validateFields(form)) return
  try {
    await updateProfile({ appeal: $('#appeal').value })
    form.reset()
    $('#appeal-result').textContent = 'Your request was recorded.'
  } catch { $('#appeal-result').textContent = 'Your request could not be saved.' }
}
