import { $, agentShell, esc } from './ui.js'
import { root } from './recruitment.js'
import { agentNotifications } from './store.js'
import { liveReports } from './reporting.js'

agentShell('notifications', 'Notifications')
root.classList.add('work-inner')
root.innerHTML = `<header class="work-heading"><p class="eyebrow">Agent account</p><h1 class="p-h2">Notifications</h1>
  <p class="dim">Updates from your seller account and bookings.</p><a class="linkbtn" href="profile.html">Back to your profile</a></header><div id="notifications"></div>`
function draw() {
  const events = agentNotifications()
  $('#notifications').innerHTML = events.length ? `<ol class="work-list" data-ledger-reveal>${events.map(event => `<li>
    <div><a class="linkbtn" href="${esc(event.href)}">${esc(event.label)}</a><p class="meta">${esc(event.at.slice(0, 16).replace('T', ' '))} UTC</p></div></li>`).join('')}</ol>`
    : '<p class="notice">No updates yet.</p>'
}
draw()
liveReports(draw)
