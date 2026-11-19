import { siteShell } from './ui.js'
import { root } from './recruitment.js'

siteShell()
document.body.classList.add('workbench')
root.innerHTML = `<article class="site-well work-page ad-entry">
  <div class="flow-stack">
    <p class="eyebrow">Prototype LinkedIn ad · Marina Travel</p>
    <h1 class="p-h2">Help travellers discover Iceland.</h1>
    <p class="p-lede dim">Sell Marina Travel tours through your own network and earn commission on eligible bookings.</p>
    <p>For tourism and travel sellers seeking extra income. Choose where and when you work.</p>
    <div class="actions"><a class="btn primary" href="become.html?demo=anna&src=linkedin-w1">Become a sales agent</a></div>
    <p class="meta">Audience example · English-speaking travel sellers in Europe and North America, including Iceland. Marina funds the campaign.</p>
  </div>
  <figure class="ad-image"><img src="assets/img/shop/ice-cave-hero.jpg" alt="Guide inside a blue ice cave"></figure>
</article>`
