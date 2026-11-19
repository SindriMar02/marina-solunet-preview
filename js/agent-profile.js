import { $, agentShell, esc } from './ui.js'
import { field, root, validateFields } from './recruitment.js'
import { agentProfile, updateProfile } from './store.js'

agentShell('today', 'Profile')
root.classList.add('work-inner')
const seller = agentProfile()
root.innerHTML = `<header class="work-heading"><p class="eyebrow">Seller · ${esc(seller.sellerId)}</p><h1 class="p-h2">Your profile</h1>
  <p>${esc(seller.name)}${seller.country ? ' · ' + esc(seller.country) : ''}</p>
  ${seller.email ? `<p class="meta">${esc(seller.email)}</p>` : ''}
  ${seller.terms ? `<p class="meta">Terms ${esc(seller.terms.version)} accepted ${esc(seller.terms.acceptedAt.slice(0, 10))}</p>` : ''}</header>
  <a class="linkbtn" href="notifications.html">View notifications</a>
  <form class="flow work-section" novalidate>
    ${field({ id: 'address', type: 'textarea', label: 'Address', value: seller.profile?.address, max: 500 })}
    ${field({ id: 'phone', type: 'tel', label: 'Phone', value: seller.profile?.phone, max: 80 })}
    <section class="work-section"><h2 class="h-task">Payout setup</h2>
      <p class="dim">Prototype · Marina Finance collects bank details securely before payout. Enter fictional profile details here.</p>
      <label class="field">Collection status<select class="input" id="payout-status"><option value="pending">Awaiting finance setup</option>
        <option value="requested"${seller.payoutStatus === 'requested' ? ' selected' : ''}>Request payout setup from finance</option></select></label>
    </section>
    <div><button class="btn primary">Save profile</button></div><p class="hint" role="status" id="saved"></p></form>`
$('form', root).onsubmit = async event => {
  event.preventDefault()
  if (!validateFields(event.currentTarget)) return
  try {
    await updateProfile({ address: $('#address').value, phone: $('#phone').value, payoutStatus: $('#payout-status').value })
    $('#saved').textContent = 'Profile saved.'
  } catch { $('#saved').textContent = 'Check your profile details and sign-in.' }
}
