import { root } from './recruitment.js'
import { arrow, funnelShell, tourPhoto } from './funnel.js'

funnelShell('ad')
root.innerHTML = `<div class="well ad-page">
  <p class="eyebrow">LinkedIn sponsored post · Specimen</p>
  <article class="ad-entry">
    <header class="ad-meta"><img class="marina-avatar" src="assets/img/marina-logo-dark.png" alt="" width="48" height="48"><div><h1>Marina Travel</h1><p>Promoted</p></div></header>
    <p class="ad-body">Sell Iceland. Earn up to 17% on every tour you sell. No fee, no stock, and the guest pays the operator directly. Apply in 10 minutes.</p>
    <a class="ad-link" href="become.html?demo=anna&src=linkedin-w1">
      ${tourPhoto('ice-cave-hero', 'A guide inside a blue ice cave', '(max-width: 618px) calc(100vw - 36px), 578px', { lazy: false })}
      <div><span><strong>Sell Iceland with Marina Travel</strong><small>Sölunet · Independent seller programme</small></span><span class="btn">Apply ${arrow}</span></div>
    </a>
  </article>
  <a class="text-action" href="index.html#demo-story">Return to Anna’s walkthrough ${arrow}</a>
</div>`
