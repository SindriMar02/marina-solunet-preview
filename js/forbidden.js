import { esc, siteShell } from './ui.js'
import { homeUrl } from './session.js'
import { root } from './recruitment.js'

siteShell()
document.body.classList.add('workbench', 'identity-page')
root.innerHTML = `<section class="identity-panel flow-stack"><p class="eyebrow">Access denied · 403</p>
  <h1 class="p-h2">You don’t have access</h1><p class="dim">Your current role cannot open this page.</p>
  <div class="actions"><a class="btn primary" href="${esc(homeUrl())}">Return to your workspace</a>
  <a class="btn" href="login.html">Use another account</a></div></section>`
