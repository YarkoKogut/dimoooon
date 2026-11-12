// DIMOOOON race: game logic and drawing. No DOM here — game.js wires it to the page.
;(() => {
  'use strict'

  const W = 400
  const H = 600
  const ROAD_L = 60
  const ROAD_R = 340
  const LANES = 4
  const LANE_W = (ROAD_R - ROAD_L) / LANES
  const PLAYER_Y = 470
  const RIVAL_COUNT = 10
  const RIVAL_SPEED = 420
  const RIVAL_GAP = 430
  const RIVAL_LEN = 70
  const STEER_SPEED = 300
  const COUNTDOWN = 2.4
  const TUNE_TIME = 1.8
  const KMH = 0.33 // km/h shown per pixel/second
  const FONT = 'Nunito, "Segoe UI", system-ui, sans-serif'
  const RIVAL_COLORS = ['#b5654a', '#5c7fa3', '#c9a24a', '#6d8f6a', '#8a6fa0', '#a0a4a8', '#c27c5a', '#4f6d7a', '#9a5b5b', '#7a8c6e']
  const SIGNS = ['TOW 24/7', 'DOWNPIPES', 'CAR SERVICE', 'SPARE PARTS']

  // `breaks` cars give up after overtaking `after` cars; the BMW is slow until it gets downpipes.
  const CARS = [
    {
      id: 'g35',
      name: 'Infiniti G35',
      spec: '3.5 V6 · 280 hp',
      tagline: 'Japanese V6. Bulletproof, they said.',
      look: { color: '#9aa3ad', len: 70, cabin: [0.38, 0.8] },
      speed: 640,
      breaks: {
        after: 2,
        emoji: '💨',
        title: 'The clutch is gone!',
        banner: 'CLUTCH IS GONE! 💨',
        text: 'Two cars overtaken, then the clutch said goodbye. Time to call a tow truck.',
        smoke: '#cfcac2',
        from: 'mid',
      },
    },
    {
      id: 'xj',
      name: 'Jaguar XJ',
      spec: '5.0 V8 · 385 hp',
      tagline: 'British luxury. Smells like leather.',
      look: { color: '#2f5a45', len: 78, cabin: [0.33, 0.73] },
      speed: 640,
      breaks: {
        after: 2,
        emoji: '🔥',
        title: 'Burnt valve!',
        banner: 'BURNT VALVE! 🔥',
        text: 'Two cars overtaken, then a valve burnt out. It sounds like a tractor now.',
        smoke: '#55504b',
        from: 'rear',
      },
    },
    {
      id: 'disco',
      name: 'Land Rover Discovery',
      spec: '3.0 V6 diesel · 256 hp',
      tagline: 'Go anywhere. Allegedly.',
      look: { color: '#d8d0bf', len: 76, w: 44, cabin: [0.24, 0.93], boxy: true },
      speed: 620,
      breaks: {
        after: 2,
        emoji: '♨️',
        title: 'Head gasket!',
        banner: 'HEAD GASKET! ♨️',
        text: 'Two cars overtaken, then the head gasket blew. White smoke everywhere.',
        smoke: '#f7f5f0',
        from: 'front',
      },
    },
    {
      id: 'bmw',
      name: 'BMW 750 (2016)',
      spec: '4.4 V8 twin-turbo · 445 hp',
      tagline: 'Big, black and very comfortable.',
      look: { color: '#25292e', len: 80, cabin: [0.32, 0.73], grille: true },
      speed: 330,
      tunedSpeed: 820,
    },
  ]

  const rand = (a, b) => a + Math.random() * (b - a)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const laneX = (lane) => ROAD_L + LANE_W * (lane + 0.5)
  const carW = (look) => look.w || 40
  // Stable pseudo-random number, so roadside item i always looks the same.
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
    return x - Math.floor(x)
  }

  function createRace(car) {
    let lane = 1
    const rivals = Array.from({ length: RIVAL_COUNT }, (_, k) => {
      lane = (lane + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES
      return {
        z: 260 + k * RIVAL_GAP,
        x: laneX(lane),
        len: RIVAL_LEN,
        look: { color: RIVAL_COLORS[k], len: RIVAL_LEN, cabin: [0.34, 0.76] },
      }
    })
    return {
      car,
      t: 0,
      phase: 'countdown',
      phaseT: 0,
      x: laneX(1),
      z: 0,
      len: car.look.len,
      speed: 0,
      tuned: false,
      tuneReady: false,
      saidSlow: false,
      rivals,
      passed: 0,
      best: 0,
      finishZ: null,
      fx: [],
      popups: [],
      smokeT: 0,
      banner: null,
      shake: 0,
      bonkT: 0,
      result: null,
    }
  }

  function setPhase(s, phase) {
    s.phase = phase
    s.phaseT = 0
  }

  function popup(s, text, x, y, color = '#fff3d6', life = 1) {
    s.popups.push({ text, x, y, color, life, max: life })
  }

  function installDownpipes(s) {
    if (s.phase !== 'drive' || !s.tuneReady || s.tuned) return
    s.tuneReady = false
    setPhase(s, 'tuning')
    s.banner = null
  }

  function collide(s) {
    const w = carW(s.car.look)
    for (const r of s.rivals) {
      const dz = r.z - s.z
      const dx = s.x - r.x
      const oz = (s.len + r.len) / 2 - 4 - Math.abs(dz)
      const ox = (w + carW(r.look)) / 2 - 4 - Math.abs(dx)
      if (oz <= 0 || ox <= 0) continue
      const half = w / 2
      const sideX = r.x + Math.sign(dx || 1) * ((w + carW(r.look)) / 2 - 3)
      if (ox < oz && sideX > ROAD_L + half && sideX < ROAD_R - half) {
        s.x = sideX
      } else if (dz > 0) {
        s.z = r.z - (s.len + r.len) / 2 + 3
        s.speed = Math.min(s.speed, RIVAL_SPEED * 0.8)
      } else {
        r.z = s.z - (s.len + r.len) / 2 + 3
      }
      if (s.bonkT <= 0) {
        popup(s, 'Bonk!', s.x, PLAYER_Y - 50, '#ffd9c2', 0.7)
        s.shake = 0.25
        s.bonkT = 0.6
      }
    }
  }

  function updateFx(s, dt) {
    for (const p of s.fx) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.r += p.grow * dt
    }
    s.fx = s.fx.filter((p) => p.life > 0)
    for (const p of s.popups) {
      p.life -= dt
      p.y -= 40 * dt
    }
    s.popups = s.popups.filter((p) => p.life > 0)
    if (s.banner) {
      s.banner.t -= dt
      if (s.banner.t <= 0) s.banner = null
    }
    s.shake = Math.max(0, s.shake - dt)
    s.bonkT -= dt

    const b = s.car.breaks
    if (b && (s.phase === 'broken' || (s.phase === 'failing' && s.phaseT > 0.5))) {
      s.smokeT -= dt
      if (s.smokeT <= 0) {
        s.smokeT = s.phase === 'broken' ? 0.04 : 0.12
        const half = s.len / 2
        const y = PLAYER_Y + (b.from === 'front' ? -half + 12 : b.from === 'rear' ? half : 0)
        s.fx.push({
          x: s.x + rand(-10, 10),
          y,
          vx: rand(-25, 25),
          vy: s.speed * 0.7 + rand(-25, 15),
          r: rand(6, 10),
          grow: rand(18, 30),
          life: 1.4,
          max: 1.4,
          color: b.smoke,
        })
      }
    }
    if (s.tuned && s.phase !== 'done' && Math.random() < dt * 1.6) {
      popup(s, pick(['POP!', 'BANG!', 'BRAAAP!']), s.x + rand(-30, 30), PLAYER_Y + s.len / 2 + 10, '#f2c26b', 0.6)
    }
  }

  // keys: Set of 'left' / 'right' currently held.
  function update(s, dt, keys) {
    s.t += dt
    s.phaseT += dt
    updateFx(s, dt)
    if (s.phase === 'countdown') {
      if (s.phaseT >= COUNTDOWN) setPhase(s, 'drive')
      return
    }
    if (s.phase === 'done') return

    const car = s.car
    const broken = s.phase === 'broken'
    const target = broken ? 0 : s.tuned ? car.tunedSpeed : car.speed
    const acc = broken ? 260 : s.tuned ? 700 : 380
    s.speed += clamp(target - s.speed, -acc * dt, acc * dt)
    s.z += s.speed * dt
    for (const r of s.rivals) r.z += RIVAL_SPEED * dt

    if (broken) {
      // Pull over to the shoulder with the hazards on.
      s.x += (ROAD_R + 16 - s.x) * Math.min(1, dt * 2)
    } else {
      const dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0)
      const half = carW(car.look) / 2
      s.x = clamp(s.x + dir * STEER_SPEED * dt, ROAD_L + half + 4, ROAD_R - half - 4)
      collide(s)
    }

    s.passed = s.rivals.filter((r) => r.z < s.z - (s.len + r.len) / 2).length
    if (s.passed > s.best) {
      s.best = s.passed
      popup(s, `Overtaken! ${s.passed}/${RIVAL_COUNT}`, s.x, PLAYER_Y - 60)
    }

    if (s.phase === 'drive') {
      if (car.breaks && s.passed >= car.breaks.after) {
        setPhase(s, 'failing')
        s.banner = { text: "Hmm... what's that noise? 🤔", t: 1.3 }
      } else if (!car.breaks && !s.tuned) {
        if (s.phaseT > 2.5 && !s.saidSlow) {
          s.saidSlow = true
          s.banner = { text: 'Why is it so slow? 🐌', t: 2.2 }
        }
        if (s.phaseT > 3.5) s.tuneReady = true
      }
      if (s.tuned && s.passed >= RIVAL_COUNT && s.finishZ === null) s.finishZ = s.z + 420
      if (s.finishZ !== null && s.z >= s.finishZ) {
        setPhase(s, 'finished')
        s.banner = { text: 'FINISH! 🏁', t: 1.6 }
      }
    } else if (s.phase === 'failing') {
      if (s.phaseT > 1.1) {
        setPhase(s, 'broken')
        s.banner = { text: car.breaks.banner, t: 3 }
        s.shake = 0.4
      }
    } else if (s.phase === 'broken') {
      if (s.phaseT > 4) {
        setPhase(s, 'done')
        s.result = { won: false }
      }
    } else if (s.phase === 'tuning') {
      if (s.phaseT > TUNE_TIME) {
        setPhase(s, 'drive')
        s.tuned = true
        s.banner = { text: 'DOWNPIPES ON! 🔥', t: 1.6 }
        s.shake = 0.3
      }
    } else if (s.phase === 'finished') {
      if (s.phaseT > 1.6) {
        setPhase(s, 'done')
        s.result = { won: true }
      }
    }
  }

  // ---------- drawing ----------

  function hudPill(ctx, text, x, y, align = 'left', bg = 'rgba(0, 0, 0, 0.4)') {
    ctx.save()
    ctx.font = `800 18px ${FONT}`
    const w = ctx.measureText(text).width + 24
    const h = 34
    const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.roundRect(left, y, w, h, h / 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, left + w / 2, y + h / 2 + 1)
    ctx.restore()
  }

  function outlinedText(ctx, text, x, y, size, fill = '#fff', stroke = '#2f3437') {
    ctx.save()
    ctx.font = `900 ${size}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(4, size / 7)
    ctx.strokeStyle = stroke
    ctx.strokeText(text, x, y)
    ctx.fillStyle = fill
    ctx.fillText(text, x, y)
    ctx.restore()
  }

  // Top-down car centred on (x, y), facing up.
  function drawCar(ctx, x, y, look, opts = {}) {
    const w = carW(look)
    const h = look.len
    const top = y - h / 2
    const left = x - w / 2
    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
    ctx.beginPath()
    ctx.roundRect(left + 3, top + 5, w, h, 10)
    ctx.fill()

    ctx.fillStyle = '#1f2224'
    for (const fy of [0.2, 0.78]) {
      ctx.fillRect(left - 3, top + h * fy - 7, 6, 14)
      ctx.fillRect(left + w - 3, top + h * fy - 7, 6, 14)
    }

    if (opts.flames) {
      for (const sx of [-0.25, 0.25]) {
        const len = rand(8, 20)
        const ex = x + w * sx
        ctx.fillStyle = '#f2a23a'
        ctx.beginPath()
        ctx.moveTo(ex - 5, top + h)
        ctx.lineTo(ex, top + h + len)
        ctx.lineTo(ex + 5, top + h)
        ctx.fill()
        ctx.fillStyle = '#ffe08a'
        ctx.beginPath()
        ctx.moveTo(ex - 2.5, top + h)
        ctx.lineTo(ex, top + h + len * 0.55)
        ctx.lineTo(ex + 2.5, top + h)
        ctx.fill()
      }
    }

    ctx.fillStyle = look.color
    ctx.beginPath()
    ctx.roundRect(left, top, w, h, look.boxy ? 6 : 12)
    ctx.fill()

    const c0 = top + h * look.cabin[0]
    const c1 = top + h * look.cabin[1]
    ctx.fillStyle = 'rgba(255, 255, 255, 0.13)'
    ctx.fillRect(left + 6, c0 + 12, w - 12, c1 - c0 - 21)
    ctx.fillStyle = '#4d5f6b'
    ctx.beginPath()
    ctx.moveTo(left + 5, c0 + 12)
    ctx.lineTo(left + 9, c0)
    ctx.lineTo(left + w - 9, c0)
    ctx.lineTo(left + w - 5, c0 + 12)
    ctx.closePath()
    ctx.moveTo(left + 6, c1 - 9)
    ctx.lineTo(left + w - 6, c1 - 9)
    ctx.lineTo(left + w - 9, c1)
    ctx.lineTo(left + 9, c1)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(left + 11, c0 + 3)
    ctx.lineTo(left + 16, c0 + 3)
    ctx.stroke()

    if (look.boxy) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(left + 7, c0 + 14)
      ctx.lineTo(left + 7, c1 - 11)
      ctx.moveTo(left + w - 7, c0 + 14)
      ctx.lineTo(left + w - 7, c1 - 11)
      ctx.stroke()
    }
    if (look.grille) {
      ctx.fillStyle = '#8d949b'
      ctx.beginPath()
      ctx.roundRect(x - 7, top + 1, 6, 4, 2)
      ctx.roundRect(x + 1, top + 1, 6, 4, 2)
      ctx.fill()
    }

    ctx.fillStyle = '#fff4c8'
    ctx.fillRect(left + 4, top + 2, 8, 4)
    ctx.fillRect(left + w - 12, top + 2, 8, 4)
    ctx.fillStyle = '#c94a44'
    ctx.fillRect(left + 4, top + h - 5, 8, 3)
    ctx.fillRect(left + w - 12, top + h - 5, 8, 3)

    if (opts.hazard) {
      ctx.fillStyle = '#f2a23a'
      for (const [hx, hy] of [
        [left + 3, top + 3],
        [left + w - 3, top + 3],
        [left + 3, top + h - 3],
        [left + w - 3, top + h - 3],
      ]) {
        ctx.beginPath()
        ctx.arc(hx, hy, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  function drawTree(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
    ctx.beginPath()
    ctx.arc(x + 4, y + 5, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#6f8f5a'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#86a46f'
    ctx.beginPath()
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }

  function drawSign(ctx, y, text) {
    ctx.fillStyle = '#7b7671'
    ctx.fillRect(8, y + 12, 4, 10)
    ctx.fillRect(40, y + 12, 4, 10)
    ctx.fillStyle = '#f4efe4'
    ctx.strokeStyle = '#7b7671'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(2, y - 14, 50, 28, 4)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#2f3437'
    ctx.font = `900 9px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const words = text.split(' ')
    if (words.length === 1) ctx.fillText(text, 27, y)
    else {
      ctx.fillText(words[0], 27, y - 6)
      ctx.fillText(words.slice(1).join(' '), 27, y + 6)
    }
  }

  const screenY = (s, z) => PLAYER_Y - (z - s.z)

  function drawRoad(ctx, s) {
    ctx.fillStyle = '#a8b78f'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#9fae86'
    const grass = s.z % 80
    for (let y = grass - 80; y < H; y += 80) {
      ctx.fillRect(0, y, ROAD_L - 8, 40)
      ctx.fillRect(ROAD_R + 8, y, W - ROAD_R - 8, 40)
    }

    const zMin = s.z - (H - PLAYER_Y) - 60
    const zMax = s.z + PLAYER_Y + 60
    for (let i = Math.floor(zMin / 110); i * 110 < zMax; i++) {
      for (const side of [0, 1]) {
        const h = hash(i * 2 + side)
        if (h < 0.4) continue
        const x = side ? ROAD_R + 24 + h * 22 : 12 + h * 26
        drawTree(ctx, x, screenY(s, i * 110 + side * 55), 11 + h * 7)
      }
    }
    for (let i = Math.max(1, Math.floor(zMin / 1300)); i * 1300 < zMax; i++) {
      drawSign(ctx, screenY(s, i * 1300), SIGNS[i % SIGNS.length])
    }

    ctx.fillStyle = '#8c8f8e'
    ctx.fillRect(ROAD_L - 8, 0, ROAD_R - ROAD_L + 16, H)
    ctx.fillStyle = '#5f6366'
    ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H)
    ctx.fillStyle = '#e9e4d8'
    ctx.fillRect(ROAD_L + 3, 0, 3, H)
    ctx.fillRect(ROAD_R - 6, 0, 3, H)
    const dash = s.z % 60
    for (let y = dash - 60; y < H; y += 60) {
      for (let l = 1; l < LANES; l++) ctx.fillRect(ROAD_L + LANE_W * l - 2, y, 4, 30)
    }
  }

  function drawLine(ctx, y, checkered) {
    if (y < -20 || y > H + 20) return
    if (!checkered) {
      ctx.fillStyle = '#e9e4d8'
      ctx.fillRect(ROAD_L, y - 3, ROAD_R - ROAD_L, 6)
      return
    }
    const size = 10
    for (let c = 0; c * size < ROAD_R - ROAD_L; c++) {
      for (let r = 0; r < 2; r++) {
        ctx.fillStyle = (c + r) % 2 ? '#2f3437' : '#f4f1ec'
        ctx.fillRect(ROAD_L + c * size, y - size + r * size, size, size)
      }
    }
  }

  function draw(ctx, s) {
    const sh = s.shake * 16
    ctx.save()
    ctx.translate(rand(-sh, sh), rand(-sh, sh))
    drawRoad(ctx, s)
    drawLine(ctx, screenY(s, -s.len / 2), false)
    if (s.finishZ !== null) drawLine(ctx, screenY(s, s.finishZ - s.len / 2), true)

    for (const r of s.rivals) {
      const y = screenY(s, r.z)
      if (y > -60 && y < H + 60) drawCar(ctx, r.x, y, r.look)
    }
    drawCar(ctx, s.x, PLAYER_Y, s.car.look, {
      hazard: s.phase === 'broken' && Math.sin(s.t * 10) > 0,
      flames: s.tuned && s.phase !== 'done',
    })
    for (const p of s.fx) {
      ctx.globalAlpha = (p.life / p.max) * 0.75
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    for (const p of s.popups) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2)
      outlinedText(ctx, p.text, p.x, p.y, 20, p.color, '#3a2a1c')
    }
    ctx.globalAlpha = 1
    ctx.restore()

    hudPill(ctx, `Pos ${RIVAL_COUNT + 1 - s.passed}/${RIVAL_COUNT + 1}`, 10, 10)
    hudPill(ctx, `🚗 ${s.passed}/${RIVAL_COUNT}`, W / 2, 10, 'center')
    hudPill(ctx, `${Math.round(s.speed * KMH)} km/h`, W - 10, 10, 'right')
    if ((s.phase === 'failing' || s.phase === 'broken') && Math.sin(s.t * 8) > -0.3) {
      hudPill(ctx, '⚠ CHECK ENGINE', 10, H - 46, 'left', 'rgba(217, 134, 47, 0.92)')
    }

    if (s.phase === 'countdown') {
      const n = Math.ceil((COUNTDOWN - s.phaseT) / (COUNTDOWN / 3))
      outlinedText(ctx, String(n), W / 2, 230, 96, '#fff3d6', '#3a2a1c')
    } else if (s.phase === 'drive' && s.phaseT < 0.7 && !s.tuned) {
      outlinedText(ctx, 'GO!', W / 2, 230, 96, '#fff3d6', '#3a2a1c')
    }

    if (s.phase === 'tuning') {
      ctx.save()
      ctx.fillStyle = 'rgba(47, 52, 55, 0.85)'
      ctx.beginPath()
      ctx.roundRect(40, 190, W - 80, 96, 22)
      ctx.fill()
      outlinedText(ctx, 'Installing downpipes... 🔧', W / 2, 222, 19, '#fff3d6', '#2f3437')
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.beginPath()
      ctx.roundRect(70, 250, W - 140, 16, 8)
      ctx.fill()
      ctx.fillStyle = '#f2a23a'
      ctx.beginPath()
      ctx.roundRect(70, 250, (W - 140) * Math.min(1, s.phaseT / TUNE_TIME), 16, 8)
      ctx.fill()
      ctx.restore()
    } else if (s.banner) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, s.banner.t * 3)
      ctx.font = `900 26px ${FONT}`
      const size = Math.min(26, (26 * (W - 70)) / ctx.measureText(s.banner.text).width)
      ctx.fillStyle = 'rgba(47, 52, 55, 0.85)'
      ctx.beginPath()
      ctx.roundRect(20, 200, W - 40, 64, 20)
      ctx.fill()
      outlinedText(ctx, s.banner.text, W / 2, 233, size, '#fff3d6', '#2f3437')
      ctx.restore()
    }
  }

  globalThis.DimoooonRace = { W, H, CARS, RIVAL_COUNT, createRace, update, draw, drawCar, installDownpipes }
})()
