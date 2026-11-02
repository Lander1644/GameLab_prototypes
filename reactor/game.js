/* Interfaz del juego "Estabiliza el reactor": dibujo, controles y avisos.
 * La física vive en sim.js (se puede probar con Node sin navegador). */
(() => {
  'use strict';
  const Sim = window.ReactorSim;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const coreCv = $('core'), g = coreCv.getContext('2d');
  const chartCv = $('chart'), h = chartCv.getContext('2d');
  g.scale(2, 2); h.scale(2, 2);                   // el lienzo tiene el doble de píxeles que el tamaño lógico
  const CW = 560, CH = 400, HW = 560, HH = 180;

  const FACTS = [
    'Las barras de control suelen ser de boro o cadmio: absorben neutrones y frenan la reacción en cadena.',
    'Una central nuclear genera electricidad igual que una de carbón: calienta agua para mover una turbina. Solo cambia la fuente de calor.',
    'En muchos reactores, si el núcleo se calienta de más la reacción se frena sola (coeficiente de temperatura negativo).',
    'El xenón-135 es un "veneno" de neutrones: se acumula mientras el reactor trabaja y hace más lento cambiar la potencia.',
    'SCRAM es el apagado de emergencia: se insertan todas las barras de control de golpe.',
    'El agua del reactor enfría el núcleo y además frena (modera) los neutrones para que provoquen nuevas fisiones.',
    'Aquí el tiempo va comprimido: un reactor real reacciona mucho más despacio y tiene varias capas de seguridad.',
  ];

  const ENDINGS = {
    won:      { title: '¡Reactor estabilizado!', text: 'Mantuviste la central funcionando hasta el final del turno.', learn: 'Los operadores reales hacen justo esto: equilibran potencia y refrigeración mientras cambia la demanda.' },
    meltdown: { title: '¡Sobrecalentamiento!', text: 'El núcleo llegó a 420 °C sin que el refrigerante pudiera controlarlo.', learn: 'Por eso las centrales reales tienen sistemas automáticos que apagan el reactor mucho antes de llegar aquí.' },
    shutdown: { title: 'Reactor apagado', text: 'La potencia se quedó en casi cero y la reacción en cadena se extinguió.', learn: 'Reiniciar un reactor lleva horas: el xenón acumulado complica volver a subir la potencia.' },
    scram:    { title: 'Apagado de emergencia (SCRAM)', text: 'Insertaste todas las barras: es seguro, pero la red se quedó sin energía.', learn: 'El SCRAM es el último recurso: siempre es seguro, pero cuesta mucho volver a arrancar.' },
  };

  let sim = Sim.create('normal');
  let active = false, paused = false, diffKey = 'normal';
  let last = 0, acc = 0, histAcc = 0, logSeen = 0, factIdx = 0, factClock = 0;
  let history = [], bubbles = [], flowPhase = 0, fanAngle = 0, endTimer = null;

  const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  /* ---------- Control de partida ---------- */

  function start(key) {
    clearTimeout(endTimer);
    diffKey = key;
    sim = Sim.create(key);
    active = true; paused = false; acc = 0; histAcc = 0; logSeen = 0; factClock = 0;
    history = []; bubbles = [];
    $('rods').value = sim.rods; $('pump').value = sim.pump;
    $('duration').textContent = fmtTime(sim.diff.duration);
    $('log').innerHTML = '';
    $('pause').textContent = 'Pausa (P)';
    $('startOverlay').classList.add('hidden');
    $('endOverlay').classList.add('hidden');
    setZones();
    showFact();
  }

  function setZones() {
    const d = sim.diff;
    $('zoneT').style.left = (d.bandT[0] / 450 * 100) + '%';
    $('zoneT').style.width = ((d.bandT[1] - d.bandT[0]) / 450 * 100) + '%';
  }

  function showFact() {
    $('fact').textContent = FACTS[factIdx % FACTS.length];
    factIdx++;
  }

  function finish() {
    active = false;
    const sm = Sim.summary(sim);
    const e = ENDINGS[sim.status];
    $('endTitle').textContent = e.title;
    $('endText').textContent = e.text;
    $('endLearn').textContent = '💡 ' + e.learn;
    $('endStats').textContent = 'Tiempo estable: ' + Math.round(sm.pct * 100) + ' % · Duración del turno: ' + fmtTime(sim.t);
    $('endStars').innerHTML = sim.status === 'won'
      ? '★'.repeat(sm.stars) + '<span class="off">' + '★'.repeat(3 - sm.stars) + '</span>'
      : '';
    // Un instante para ver lo que pasó en el núcleo antes de tapar la pantalla
    endTimer = setTimeout(() => $('endOverlay').classList.remove('hidden'), sim.status === 'meltdown' ? 1500 : 600);
  }

  /* ---------- HUD ---------- */

  function sensorT() {                        // el "ruido del sensor" se nota en dificultades altas
    const n = sim.diff.noise;
    return sim.T + (Math.sin(sim.t * 7.3) + Math.sin(sim.t * 3.1)) * n;
  }

  function updateHud() {
    const d = sim.diff, T = sensorT();
    $('time').textContent = fmtTime(sim.t);
    $('pct').textContent = Math.round(Sim.summary(sim).pct * 100) + ' %';
    $('vTemp').textContent = Math.round(T) + ' °C';
    $('vPow').textContent = Math.round(sim.P) + ' %';
    $('vDemand').textContent = sim.demand + ' %';
    $('vRods').textContent = Math.round(sim.rods) + ' %';
    $('vPump').textContent = Math.round(sim.pump) + ' %';

    const ft = $('fillT');
    ft.style.width = clamp(T / 450, 0, 1) * 100 + '%';
    ft.className = 'fill temp' + (T >= Sim.warnTemp(d) ? ' danger' : T > d.bandT[1] ? ' hot' : T < d.bandT[0] ? ' cold' : '');

    $('fillP').style.width = clamp(sim.P / 120, 0, 1) * 100 + '%';
    $('zoneP').style.left = clamp((sim.demand - d.tolP) / 120, 0, 1) * 100 + '%';
    $('zoneP').style.width = (2 * d.tolP / 120 * 100) + '%';
    $('markDemand').style.left = (sim.demand / 120 * 100) + '%';

    const log = $('log');
    while (logSeen < sim.log.length) {
      const e = sim.log[logSeen++];
      const li = document.createElement('li');
      li.className = e.level; li.textContent = fmtTime(e.t) + '  ' + e.text;
      log.prepend(li);
      while (log.children.length > 4) log.lastChild.remove();
    }
  }

  /* ---------- Dibujo del núcleo ---------- */

  function roundRect(c, x, y, w, hh, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r);
    c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function pipe(points, color, phase) {
    g.lineJoin = 'round'; g.lineCap = 'butt';
    g.beginPath(); points.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.setLineDash([]); g.strokeStyle = '#1c2a0c'; g.lineWidth = 16; g.stroke();
    g.setLineDash([9, 11]); g.lineDashOffset = -phase; g.strokeStyle = color; g.lineWidth = 7; g.stroke();
    g.setLineDash([]);
  }

  function drawCore(dt, time) {
    const T = sim.T, P = sim.P;
    const hot = clamp((T - 150) / 270, 0, 1);
    // Verde mientras todo va bien -> amarillo -> rojo al acercarse a la fusión
    const hue = hot < 0.54 ? 160 - 111 * hot : 100 - 217 * (hot - 0.54);
    const vx = 150, vy = 80, vw = 260, vh = 270;

    g.clearRect(0, 0, CW, CH);
    g.fillStyle = '#0a1006'; g.fillRect(0, 0, CW, CH);

    // Circuito de refrigeración: núcleo -> turbina -> bomba -> núcleo
    const speed = sim.pump * (sim.leak > 0 ? 0.55 : 1) * 1.1;
    flowPhase += speed * dt;
    const hotColor = `hsl(${Math.max(0, 52 - 52 * hot)} 100% 55%)`, coldColor = '#b8ff2e';
    pipe([[vx + vw, vy + 50], [505, vy + 50], [505, 165]], hotColor, flowPhase);
    pipe([[505, 255], [505, 384], [95, 384], [95, vy + 235], [vx, vy + 235]], coldColor, flowPhase);

    // Turbina (el ventilador gira con la potencia)
    fanAngle += (P / 100) * 8 * dt;
    g.fillStyle = '#141f0a'; g.strokeStyle = '#7fb326'; g.lineWidth = 2;
    roundRect(g, 466, 160, 78, 100, 10); g.fill(); g.stroke();
    g.save(); g.translate(505, 205); g.rotate(fanAngle); g.fillStyle = '#d8ff7a';
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.ellipse(0, -14, 5, 14, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.fillStyle = '#9fba7d'; g.font = '12px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('Turbina', 505, 250);
    g.fillText('Núcleo', vx + vw / 2, vy + vh + 18);

    // Vasija con agua
    g.save();
    roundRect(g, vx, vy, vw, vh, 18); g.clip();
    g.fillStyle = `hsl(${hue} 90% ${19 + hot * 8}%)`; g.fillRect(vx, vy, vw, vh);
    const cx = vx + vw / 2, cy = vy + vh * 0.62;
    const glow = g.createRadialGradient(cx, cy, 8, cx, cy, 160);
    glow.addColorStop(0, `rgba(214,255,60,${clamp(P / 120, 0, 1) * 0.8})`);
    glow.addColorStop(1, 'rgba(255,214,10,0)');
    g.fillStyle = glow; g.fillRect(vx, vy, vw, vh);

    // Combustible
    for (let i = 0; i < 8; i++) {
      const fx = vx + 18 + i * 32;
      const k = clamp(P / 100, 0, 1);
      g.fillStyle = `rgb(${Math.round(110 + 145 * k)},${Math.round(125 + 100 * k)},${Math.round(60 + 40 * k)})`;
      roundRect(g, fx, vy + 130, 12, 125, 4); g.fill();
    }

    // Burbujas (más potencia = más burbujas)
    if (active && !paused && Math.random() < P / 160) {
      bubbles.push({ x: vx + 14 + Math.random() * (vw - 28), y: vy + 250, v: 40 + Math.random() * 50, r: 1.5 + Math.random() * 2.5 });
    }
    g.fillStyle = 'rgba(220,255,120,.4)';
    bubbles = bubbles.filter((b) => b.y > vy + 4);
    for (const b of bubbles) {
      if (active && !paused) { b.y -= b.v * dt; b.x += Math.sin(b.y * 0.1) * 0.3; }
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();

    // Barras de control
    const tip = vy + (sim.rods / 100) * 240;
    for (let i = 0; i < 7; i++) {
      const rx = vx + 34 + i * 32;
      g.fillStyle = '#c4c9b8'; g.fillRect(rx, 28, 10, tip - 28);
      g.fillStyle = '#7a806c'; g.fillRect(rx + 7, 28, 3, tip - 28);
      g.fillStyle = '#f2ffd0'; g.fillRect(rx, tip - 6, 10, 6);
    }
    g.fillStyle = '#33481a'; g.fillRect(vx + 10, 14, vw - 20, 14);

    // Contorno de la vasija (parpadea en rojo si hay peligro)
    const danger = T >= Sim.warnTemp(sim.diff);
    g.lineWidth = 5;
    g.strokeStyle = danger ? (Math.floor(time * 4) % 2 === 0 ? '#ff4a1c' : '#ffd60a') : '#8fc22a';
    roundRect(g, vx, vy, vw, vh, 18); g.stroke();

    // Avisos sobre el dibujo
    g.textAlign = 'left'; g.font = 'bold 14px system-ui, sans-serif';
    if (sim.leak > 0) {
      g.fillStyle = '#ff4a1c';
      const dy = (time * 90) % 50;
      g.beginPath(); g.arc(95, 300 + dy, 4, 0, Math.PI * 2); g.fill();
      if (Math.floor(time * 3) % 2 === 0) g.fillText('💧 FUGA', 20, 300);
    }
    if (sim.burst > 0 && Math.floor(time * 3) % 2 === 0) { g.fillStyle = '#ffd60a'; g.fillText('⚡ PICO', 20, 100); }
    if (sim.status === 'meltdown') {
      g.fillStyle = `rgba(255,40,60,${0.25 + 0.2 * Math.sin(time * 14)})`; g.fillRect(0, 0, CW, CH);
    }
    if (paused) {
      g.fillStyle = 'rgba(5,8,20,.6)'; g.fillRect(0, 0, CW, CH);
      g.fillStyle = '#fff'; g.font = 'bold 32px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('PAUSA', CW / 2, CH / 2);
    }
  }

  /* ---------- Gráfica ---------- */

  function drawChart() {
    const d = sim.diff;
    const pad = { l: 34, r: 8, t: 10, b: 18 };
    const x0 = pad.l, y0 = pad.t, w = HW - pad.l - pad.r, hh = HH - pad.t - pad.b;
    const yT = (v) => y0 + hh - clamp(v / 450, 0, 1) * hh;
    const yP = (v) => y0 + hh - clamp(v / 120, 0, 1) * hh;
    const win = 40, tEnd = Math.max(sim.t, win), tStart = tEnd - win;
    const xOf = (t) => x0 + ((t - tStart) / win) * w;

    h.clearRect(0, 0, HW, HH);
    h.fillStyle = '#0a1006'; h.fillRect(0, 0, HW, HH);
    h.fillStyle = 'rgba(184,255,46,.12)';
    h.fillRect(x0, yT(d.bandT[1]), w, yT(d.bandT[0]) - yT(d.bandT[1]));

    h.font = '10px system-ui, sans-serif'; h.textAlign = 'right'; h.fillStyle = '#7b9460'; h.strokeStyle = '#22340f'; h.lineWidth = 1;
    for (let v = 0; v <= 400; v += 100) {
      h.beginPath(); h.moveTo(x0, yT(v)); h.lineTo(x0 + w, yT(v)); h.stroke();
      h.fillText(v + '°', x0 - 4, yT(v) + 3);
    }
    h.setLineDash([4, 4]); h.strokeStyle = '#ff4a1c'; h.beginPath();
    h.moveTo(x0, yT(Sim.MELTDOWN_T)); h.lineTo(x0 + w, yT(Sim.MELTDOWN_T)); h.stroke(); h.setLineDash([]);

    const line = (key, y, color, dash) => {
      h.beginPath(); let started = false;
      for (const p of history) {
        if (p.t < tStart - 0.5) continue;
        const x = xOf(p.t), yy = y(p[key]);
        if (started) h.lineTo(x, yy); else { h.moveTo(x, yy); started = true; }
      }
      h.setLineDash(dash || []); h.strokeStyle = color; h.lineWidth = 2; h.stroke(); h.setLineDash([]);
    };
    line('demand', yP, 'rgba(198,255,61,.55)', [5, 4]);
    line('P', yP, '#c6ff3d');
    line('T', yT, '#ff9d00');

    h.textAlign = 'left'; h.font = '11px system-ui, sans-serif';
    h.fillStyle = '#ff9d00'; h.fillText('— Temperatura (°C)', x0 + 6, HH - 5);
    h.fillStyle = '#c6ff3d'; h.fillText('— Potencia (%)', x0 + 130, HH - 5);
    h.fillStyle = 'rgba(198,255,61,.8)'; h.fillText('- - Lo que pide la red', x0 + 230, HH - 5);
  }

  /* ---------- Bucle principal ---------- */

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    if (active && !paused) {
      acc += dt;
      while (acc >= Sim.DT && sim.status === 'running') { Sim.step(sim, Sim.DT); acc -= Sim.DT; histAcc += Sim.DT; }
      if (histAcc >= 0.25) {
        histAcc = 0;
        history.push({ t: sim.t, T: sim.T, P: sim.P, demand: sim.demand });
        if (history.length > 200) history.shift();
      }
      factClock += dt;
      if (factClock > 14) { factClock = 0; showFact(); }
      if (sim.status !== 'running') finish();
    }
    drawCore(dt, now / 1000);
    drawChart();
    updateHud();
    requestAnimationFrame(frame);
  }

  /* ---------- Controles ---------- */

  function setRods(v) { Sim.setControls(sim, v, null); $('rods').value = sim.rods; }
  function setPump(v) { Sim.setControls(sim, null, v); $('pump').value = sim.pump; }

  function togglePause() {
    if (!active) return;
    paused = !paused;
    $('pause').textContent = paused ? 'Seguir (P)' : 'Pausa (P)';
  }

  $('rods').addEventListener('input', (e) => { if (active && !paused) setRods(+e.target.value); else e.target.value = sim.rods; });
  $('pump').addEventListener('input', (e) => { if (active && !paused) setPump(+e.target.value); else e.target.value = sim.pump; });
  $('scram').addEventListener('click', () => { if (active && !paused) { Sim.scram(sim); $('rods').value = 100; } });
  $('pause').addEventListener('click', togglePause);
  $('again').addEventListener('click', () => start(diffKey));
  $('changeDiff').addEventListener('click', () => { $('endOverlay').classList.add('hidden'); $('startOverlay').classList.remove('hidden'); });
  document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => start(b.dataset.diff)));

  document.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'p' || k === 'P') { togglePause(); return; }
    if (!active || paused) return;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { setRods(sim.rods - 2); e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { setRods(sim.rods + 2); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { setPump(sim.pump - 2); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { setPump(sim.pump + 2); e.preventDefault(); }
  });

  setZones();
  $('duration').textContent = fmtTime(sim.diff.duration);
  showFact();
  requestAnimationFrame(frame);
})();
