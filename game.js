// DIMOOOON: page wiring — car selection, game loop, input and result screen.
;(() => {
  'use strict'

  const { W, H, CARS, RIVAL_COUNT, createRace, update, draw, drawCar, installDownpipes } = globalThis.DimoooonRace
  const $ = (id) => document.getElementById(id)

  const selectView = $('select-view')
  const raceView = $('race-view')
  const canvas = $('game')
  const ctx = canvas.getContext('2d')
  const tuneBtn = $('tune-btn')
  const result = $('result')

  let race = null
  let scale = 1
  const keys = new Set()
  // Cars that already let the driver down this session, shown as badges on the cards.
  const history = {}

  function renderCards() {
    const list = $('cars')
    list.textContent = ''
    for (const car of CARS) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'car-card'
      card.innerHTML = `
        <canvas class="car-preview" width="440" height="220"></canvas>
        <h3></h3>
        <p class="spec"></p>
        <p class="tagline"></p>
        <p class="stars">Reliability <span>★★★★★</span>*</p>
        <span class="choose">Choose ▶</span>`
      card.querySelector('h3').textContent = car.name
      card.querySelector('.spec').textContent = car.spec
      card.querySelector('.tagline').textContent = car.tagline
      if (history[car.id]) {
        const badge = document.createElement('span')
        badge.className = 'badge'
        badge.textContent = history[car.id]
        card.append(badge)
      }
      const pctx = card.querySelector('canvas').getContext('2d')
      pctx.scale(2, 2)
      pctx.translate(110, 55)
      pctx.rotate(Math.PI / 2)
      pctx.scale(1.3, 1.3)
      drawCar(pctx, 0, 0, car.look)
      card.addEventListener('click', () => startRace(car))
      list.append(card)
    }
  }

  function showView(name) {
    selectView.hidden = name !== 'select'
    raceView.hidden = name !== 'race'
    keys.clear()
  }

  function startRace(car) {
    race = createRace(car)
    $('car-name').textContent = car.name
    result.hidden = true
    tuneBtn.hidden = true
    showView('race')
    resize()
  }

  function backToCars() {
    race = null
    renderCards()
    showView('select')
    window.scrollTo(0, 0)
  }

  function showResult(won) {
    const car = race.car
    history[car.id] = won ? '🏆 Champion' : `${car.breaks.emoji} Broke down`
    $('result-emoji').textContent = won ? '🏆' : car.breaks.emoji
    $('result-title').textContent = won ? 'DIMOOOON!' : car.breaks.title
    $('result-text').textContent = won
      ? 'Downpipes installed, all 10 cars overtaken. First place!'
      : car.breaks.text
    $('result-stats').textContent = `${car.name} · overtaken ${won ? RIVAL_COUNT : car.breaks.after}/${RIVAL_COUNT}`
    result.hidden = false
    ;(won ? $('again-btn') : $('cars-btn')).focus()
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = canvas.clientWidth
    if (!width) return
    scale = (width / W) * dpr
    canvas.width = Math.round(W * scale)
    canvas.height = Math.round(H * scale)
  }
  new ResizeObserver(resize).observe(canvas)

  let last = performance.now()
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    if (race && !raceView.hidden) {
      update(race, dt, keys)
      tuneBtn.hidden = !race.tuneReady
      if (race.result && result.hidden) showResult(race.result.won)
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      draw(ctx, race)
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  const dirOf = (code) =>
    code === 'ArrowLeft' || code === 'KeyA' ? 'left' : code === 'ArrowRight' || code === 'KeyD' ? 'right' : null

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || raceView.hidden) return
    const dir = dirOf(e.code)
    if (dir) {
      e.preventDefault()
      keys.add(dir)
    } else if ((e.code === 'Space' || e.code === 'Enter') && race?.tuneReady) {
      e.preventDefault()
      installDownpipes(race)
    } else if (e.code === 'Escape') {
      backToCars()
    }
  })
  window.addEventListener('keyup', (e) => keys.delete(dirOf(e.code)))
  window.addEventListener('blur', () => keys.clear())

  for (const btn of document.querySelectorAll('.touch-btn')) {
    const dir = btn.dataset.dir
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      keys.add(dir)
    })
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(type, () => keys.delete(dir))
    btn.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  tuneBtn.addEventListener('click', () => race && installDownpipes(race))
  $('back-btn').addEventListener('click', backToCars)
  $('cars-btn').addEventListener('click', backToCars)
  $('again-btn').addEventListener('click', () => startRace(race.car))

  renderCards()
})()
