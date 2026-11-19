/* Departure picker (BLUEPRINT §5 P5/A2): date strip, time rows with seats in words, party size bounded by
   the rate, and "next departure that fits your group". The start-time id is the identity carried onward. */
import * as store from './store.js'
import { $, $$, esc, dayLabel, viewerTime } from './ui.js'

export function mountPicker(root, tourId, sel, onChange) {
  const t = store.tour(tourId)
  sel.pax = sel.pax || t.min
  const render = () => {
    // remember which control had focus so a re-render never drops the user's place
    const ae = document.activeElement, keep = ae && root.contains(ae) ? (ae.dataset.date ? `[data-date="${ae.dataset.date}"]` : ae.dataset.start ? 'slot' : ae.dataset.step ? `[data-step="${ae.dataset.step}"]` : ae.id ? `#${ae.id}` : null) : null
    const scrollX = $('.dates', root)?.scrollLeft || 0
    const days = store.departures(tourId)
    if (!sel.date) {
      const firstOpen = days.find(d => d.starts.some(s => !s.soldOut && (s.seatsLeft == null || s.seatsLeft >= sel.pax)))
      sel.date = (firstOpen || days[0]).date
    }
    const day = days.find(d => d.date === sel.date)
    if (sel.startTimeId && !day.starts.some(s => s.startTimeId === sel.startTimeId)) sel.startTimeId = null
    if (!sel.startTimeId && day.starts.length === 1 && !day.starts[0].soldOut) sel.startTimeId = day.starts[0].startTimeId
    const cur = day.starts.find(s => s.startTimeId === sel.startTimeId)
    const sizeErr = store.sizeError(t, sel.pax)
    const seatErr = cur ? store.seatError(cur, sel.pax) : null
    const fit = !sizeErr && (seatErr || !cur || cur.soldOut) ? nextFit(days, sel) : null

    root.innerHTML = `
      <div class="field"><span class="label" id="dl-${t.id}">Date</span>
        <div class="dates" role="group" aria-labelledby="dl-${t.id}">${days.map(d => {
          const open = d.starts.some(s => !s.soldOut); const [w, dd] = dayLabel(d.date).split(' ')
          return `<button type="button" class="date${open ? '' : ' none'}" data-date="${d.date}" aria-pressed="${d.date === sel.date}"
            aria-label="${esc(dayLabel(d.date))}${open ? '' : ', full'}"><span class="w">${w}</span><span class="d">${dd}</span>${open ? '' : '<span class="full">Full</span>'}</button>` }).join('')}</div></div>
      <div class="field"><span class="label" id="tl-${t.id}">Departure, Iceland time · ${esc(dayLabel(sel.date))}</span>
        <ul class="slots" role="radiogroup" aria-labelledby="tl-${t.id}">${day.starts.map(s => {
          const words = s.onRequest ? 'On request' : s.soldOut ? 'Sold out' : `${s.seatsLeft} ${s.seatsLeft === 1 ? 'seat' : 'seats'} left`
          const local = viewerTime(sel.date, s.time)
          const firstOpen = day.starts.find(x => !x.soldOut)
          const stop = sel.startTimeId ? s.startTimeId === sel.startTimeId : firstOpen ? s === firstOpen : s === day.starts[0]
          return `<li><button type="button" class="slot" role="radio" data-start="${s.startTimeId}" aria-label="${esc(`${s.time} Iceland time, ${words}${local ? `, ${local}` : ''}${s.illustrative ? ', prototype departure' : ''}`)}" aria-checked="${s.startTimeId === sel.startTimeId}"
            ${s.soldOut ? 'aria-disabled="true"' : ''} tabindex="${stop ? 0 : -1}">
            <span class="t">${esc(s.time)}<small>Iceland</small></span><span class="s">${esc(words)}</span>
            ${local ? `<span class="local">${esc(local)}</span>` : ''}${s.illustrative ? '<span class="local">Prototype departure (illustrative)</span>' : ''}</button></li>` }).join('')}</ul></div>
      <div class="field"><label for="pax-${t.id}">Guests</label>
        <div class="stepper"><button type="button" data-step="-1" aria-label="One guest fewer">−</button>
          <input id="pax-${t.id}" inputmode="numeric" pattern="[0-9]*" value="${sel.pax}" aria-describedby="paxh-${t.id}">
          <button type="button" data-step="1" aria-label="One guest more">+</button></div>
        <p class="hint${sizeErr || seatErr ? ' warn' : ''}" id="paxh-${t.id}" aria-live="polite">${esc(paxHint(t, cur, sel.pax, sizeErr, seatErr))}</p>
        ${fit ? `<button type="button" class="linkbtn" data-fit="${fit.date}|${fit.startTimeId}">Next departure that fits ${sel.pax} guests: ${esc(dayLabel(fit.date))} at ${esc(fit.time)}</button>` : ''}
      </div>`

    $$('.date', root).forEach(b => b.onclick = () => { sel.date = b.dataset.date; sel.startTimeId = null; render(); emit() })
    const radios = $$('.slot', root)
    radios.forEach((b, i) => {
      b.onclick = () => { if (b.getAttribute('aria-disabled') === 'true') return; sel.startTimeId = Number(b.dataset.start); render(); emit(); $(`.slot[data-start="${sel.startTimeId}"]`, root)?.focus() }
      // radio-group keys: arrows move to the next AVAILABLE departure and select it
      b.onkeydown = e => { const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (!k) return; e.preventDefault()
        for (let j = 1; j <= radios.length; j++) { const n = radios[(i + k * j + radios.length * j) % radios.length]
          if (n.getAttribute('aria-disabled') !== 'true') { sel.startTimeId = Number(n.dataset.start); render(); emit(); $(`.slot[data-start="${sel.startTimeId}"]`, root)?.focus(); return } } }
    })
    $$('[data-step]', root).forEach(b => b.onclick = () => { sel.pax = Math.max(1, Math.min(50, sel.pax + Number(b.dataset.step))); render(); emit() })
    const inp = $(`#pax-${t.id}`, root)
    inp.onchange = () => { const n = parseInt(inp.value, 10); sel.pax = Number.isFinite(n) ? Math.max(1, Math.min(50, n)) : t.min; render(); emit() }
    const f = $('[data-fit]', root)
    if (f) f.onclick = () => { const [d, s] = f.dataset.fit.split('|'); sel.date = d; sel.startTimeId = Number(s); render(); emit(); $(`.slot[data-start="${sel.startTimeId}"]`, root)?.focus() }
    const strip = $('.dates', root); if (strip) { strip.scrollLeft = scrollX
      // Bring the chosen day into the strip sideways only; never scroll the page (audit #20).
      const on = $(`.date[aria-pressed="true"]`, root)
      if (on) { const l = on.offsetLeft - strip.offsetLeft, r = l + on.offsetWidth
        if (l < strip.scrollLeft) strip.scrollLeft = l; else if (r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = r - strip.clientWidth } }
    if (keep) (keep === 'slot' ? $('.slot[tabindex="0"]', root) : $(keep, root))?.focus({ preventScroll: true })
  }
  const emit = () => onChange && onChange(sel, state())
  const state = () => {
    const day = store.departures(tourId).find(d => d.date === sel.date)
    const cur = day && day.starts.find(s => s.startTimeId === sel.startTimeId)
    const err = !cur ? 'choose_departure' : store.sizeError(t, sel.pax) || store.seatError(cur, sel.pax)
    return { ok: !err, error: err, departure: cur }
  }
  render()
  return { state, render }
}

function paxHint(t, cur, pax, sizeErr, seatErr) {
  const limits = t.min === t.max ? `${t.min} per booking` : `${t.min}–${t.max} guests per booking`
  if (sizeErr) return pax < t.min ? `This tour takes ${limits}. Add ${t.min - pax} more to book.` : `This tour takes ${limits}. Split into two bookings or ask Marina.`
  if (seatErr && cur) return `Only ${cur.seatsLeft} ${cur.seatsLeft === 1 ? 'seat is' : 'seats are'} left at ${cur.time}. Choose another time or date.`
  if (!cur) return `${limits}. Choose a departure time.`
  return cur.onRequest ? `${limits} · on request: Marina confirms each booking` : `${limits} · ${cur.seatsLeft} seats left at ${cur.time}`
}

function nextFit(days, sel) {
  for (const d of days) {
    if (d.date < sel.date) continue
    for (const s of d.starts) {
      if (d.date === sel.date && s.startTimeId === sel.startTimeId) continue
      if (!s.soldOut && (s.seatsLeft == null || s.seatsLeft >= sel.pax)) return { date: d.date, startTimeId: s.startTimeId, time: s.time }
    }
  }
  return null
}
