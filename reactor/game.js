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
  let history = [], bubbles = [], flowPhase = 0, steamPhase = 0, pumpAngle = 0, fanAngle = 0, endTimer = null;

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

  function pipe(points, color, phase, w, inner) {
    w = w || 16; inner = inner || 7;
    g.lineJoin = 'round'; g.lineCap = 'butt';
    g.beginPath(); points.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.setLineDash([]); g.strokeStyle = '#1a2550'; g.lineWidth = w; g.stroke();
    g.setLineDash([9, 11]); g.lineDashOffset = -phase; g.strokeStyle = color; g.lineWidth = inner; g.stroke();
    g.setLineDash([]);
  }

  const mix = (c1, c2, t) => 'rgb(' + c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(',') + ')';

  function drawPump(px, py, r) {
    g.fillStyle = '#18224a'; g.strokeStyle = sim.leak > 0 ? '#ff4d6d' : '#5c6fb3'; g.lineWidth = 3;
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.save(); g.translate(px, py); g.rotate(pumpAngle); g.fillStyle = '#9fb0ea';
    for (let i = 0; i < 5; i++) { g.rotate((Math.PI * 2) / 5); g.beginPath(); g.ellipse(0, -r * 0.5, r * 0.15, r * 0.38, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.fillStyle = '#18224a'; g.beginPath(); g.arc(px, py, r * 0.16, 0, Math.PI * 2); g.fill();
  }

  function drawCore(dt, time) {
    const T = sim.T, P = sim.P;
    const hot = clamp((T - 150) / 270, 0, 1);
    // Verde mientras todo va bien -> amarillo -> rojo al acercarse a la fusión
    const hue = hot < 0.54 ? 160 - 111 * hot : 100 - 217 * (hot - 0.54);
    const vx = 60, vy = 80, vw = 190, vh = 270;          // vasija del reactor (con agua)
    const cx0 = vx + 26, cw = vw - 52, cy0 = vy + 110, ch = 124;   // bloque del núcleo, rodeado de agua
    const ex = 300, ey = 115, ew = 90, eh = 150;         // intercambiador de calor
    const tx = 440, ty = 115, tw = 100, th = 90;         // turbina
    const pumpX = 34, pumpY = 378;                       // bomba del refrigerante (esquina inferior izquierda)

    g.clearRect(0, 0, CW, CH);
    g.fillStyle = '#0d142b'; g.fillRect(0, 0, CW, CH);

    const hotColor = `hsl(${hue} 85% 55%)`, coldColor = 'hsl(205 85% 55%)';
    const pumpEff = sim.pump * (sim.leak > 0 ? 0.55 : 1);
    flowPhase += pumpEff * 1.1 * dt;                     // circuito primario: depende de la bomba
    steamPhase += (30 + P * 0.9) * dt;                   // circuito secundario: depende de la potencia
    pumpAngle += (pumpEff / 100) * 14 * dt;

    // Intercambiador de calor: el circuito primario calienta el agua del secundario (turbina)
    g.fillStyle = '#18224a'; g.strokeStyle = '#5c6fb3'; g.lineWidth = 2;
    roundRect(g, ex, ey, ew, eh, 10); g.fill(); g.stroke();
    g.fillStyle = 'rgba(56,225,255,.10)'; roundRect(g, ex + 3, ey + 3, ew - 6, eh - 6, 8); g.fill();

    // Circuito primario: vasija -> intercambiador (serpentín) -> bomba -> vasija
    const coil = g.createLinearGradient(0, 140, 0, 240);
    coil.addColorStop(0, hotColor); coil.addColorStop(1, coldColor);
    pipe([[vx + vw, vy + 60], [ex, vy + 60]], hotColor, flowPhase);
    pipe([[ex, 140], [ex + 75, 162], [ex + 15, 188], [ex + 75, 214], [ex, 240]], coil, flowPhase, 11, 5);
    pipe([[ex, 240], [270, 240], [270, pumpY], [pumpX, pumpY], [pumpX, vy + 235], [vx, vy + 235]], coldColor, flowPhase);
    drawPump(pumpX, pumpY, 19);

    // Circuito secundario: vapor -> turbina -> agua de regreso
    pipe([[ex + ew, 150], [tx, 150]], '#d6ecff', steamPhase);
    pipe([[tx + tw / 2, ty + th], [tx + tw / 2, 235], [ex + ew, 235]], '#4aa8ff', steamPhase);

    // Turbina (el ventilador gira con la potencia)
    fanAngle += (P / 100) * 8 * dt;
    g.fillStyle = '#18224a'; g.strokeStyle = '#5c6fb3'; g.lineWidth = 2;
    roundRect(g, tx, ty, tw, th, 10); g.fill(); g.stroke();
    g.save(); g.translate(tx + tw / 2, ty + th / 2); g.rotate(fanAngle); g.fillStyle = '#9fb0ea';
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.ellipse(0, -17, 6, 17, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();

    g.fillStyle = '#93a0cf'; g.font = '12px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('Intercambiador de calor', ex + ew / 2, ey - 7);
    g.fillText('Turbina', tx + tw / 2, ty - 7);
    g.fillText('Circuito secundario', 465, 262);
    g.textAlign = 'left'; g.fillText('Bomba', 58, 397);

    // Vasija: el agua rodea al bloque del núcleo
    g.save();
    roundRect(g, vx, vy, vw, vh, 18); g.clip();
    g.fillStyle = `hsl(${hue} 70% ${18 + hot * 8}%)`; g.fillRect(vx, vy, vw, vh);

    // Circulación del agua: baja por los costados y sube por el núcleo (más rápido con la bomba)
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 3; g.setLineDash([6, 12]); g.lineDashOffset = -flowPhase;
    for (const lx of [vx + 13, vx + vw - 13]) { g.beginPath(); g.moveTo(lx, vy + 24); g.lineTo(lx, vy + vh - 14); g.stroke(); }
    g.setLineDash([]);

    // Bloque del núcleo: se calienta con la potencia
    const k = clamp(P / 100, 0, 1);
    g.fillStyle = '#141b38'; roundRect(g, cx0, cy0, cw, ch, 10); g.fill();
    g.fillStyle = `rgba(255,150,40,${0.10 + 0.55 * k})`; roundRect(g, cx0, cy0, cw, ch, 10); g.fill();
    const glow = g.createRadialGradient(cx0 + cw / 2, cy0 + ch / 2, 6, cx0 + cw / 2, cy0 + ch / 2, cw * 0.75);
    glow.addColorStop(0, `rgba(255,205,90,${0.55 * k})`); glow.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = glow; g.fillRect(vx, vy, vw, vh);
    g.lineWidth = 3; g.strokeStyle = mix([92, 111, 179], [255, 190, 90], k);
    roundRect(g, cx0, cy0, cw, ch, 10); g.stroke();

    // Combustible (uranio): 5 varillas dentro del núcleo
    g.fillStyle = `rgb(${Math.round(110 + 145 * k)},${Math.round(125 + 100 * k)},${Math.round(60 + 40 * k)})`;
    for (let i = 0; i < 5; i++) roundRect(g, cx0 + 16 + i * 26, cy0 + 8, 12, ch - 16, 4), g.fill();

    // Burbujas (más potencia = más burbujas), suben desde el núcleo
    if (active && !paused && Math.random() < P / 160) {
      bubbles.push({ x: cx0 + 8 + Math.random() * (cw - 16), y: cy0 + ch - 10, v: 40 + Math.random() * 50, r: 1.5 + Math.random() * 2.5 });
    }
    g.fillStyle = 'rgba(255,255,255,.35)';
    bubbles = bubbles.filter((b) => b.y > vy + 4);
    for (const b of bubbles) {
      if (active && !paused) { b.y -= b.v * dt; b.x += Math.sin(b.y * 0.1) * 0.3; }
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();

    // Barras de control: bajan desde arriba hacia los huecos entre varillas de combustible
    const tip = cy0 + (sim.rods / 100) * (ch - 14);
    for (let i = 0; i < 4; i++) {
      const rx = cx0 + 31 + i * 26;
      g.fillStyle = '#b6bfdc'; g.fillRect(rx, 28, 8, tip - 28);
      g.fillStyle = '#6f7aa6'; g.fillRect(rx + 5, 28, 3, tip - 28);
      g.fillStyle = '#e8ecff'; g.fillRect(rx, tip - 6, 8, 6);
    }
    g.fillStyle = '#2a3869'; g.fillRect(cx0 + 20, 14, cw - 40, 14);

    g.fillStyle = 'rgba(232,236,255,.8)'; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('Núcleo del reactor', cx0 + cw / 2, cy0 + ch + 18);

    // Contorno de la vasija (parpadea en rojo si hay peligro)
    const danger = T >= Sim.warnTemp(sim.diff);
    g.lineWidth = 5;
    g.strokeStyle = danger && Math.floor(time * 4) % 2 === 0 ? '#ff4d6d' : '#5c6fb3';
    roundRect(g, vx, vy, vw, vh, 18); g.stroke();

    // Avisos sobre el dibujo
    g.textAlign = 'left'; g.font = 'bold 13px system-ui, sans-serif';
    if (sim.leak > 0) {
      g.fillStyle = '#ff4d6d';
      const dy = (time * 60) % 18;
      g.beginPath(); g.arc(pumpX + 2, pumpY + 12 + dy * 0.5, 3.5, 0, Math.PI * 2); g.fill();
      if (Math.floor(time * 3) % 2 === 0) g.fillText('💧 FUGA', 4, 292);
    }
    if (sim.burst > 0 && Math.floor(time * 3) % 2 === 0) { g.fillStyle = '#ffc13d'; g.fillText('⚡ PICO', 300, 90); }
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
    h.fillStyle = '#0d142b'; h.fillRect(0, 0, HW, HH);
    h.fillStyle = 'rgba(61,255,154,.12)';
    h.fillRect(x0, yT(d.bandT[1]), w, yT(d.bandT[0]) - yT(d.bandT[1]));

    h.font = '10px system-ui, sans-serif'; h.textAlign = 'right'; h.fillStyle = '#6b78a8'; h.strokeStyle = '#1d2a55'; h.lineWidth = 1;
    for (let v = 0; v <= 400; v += 100) {
      h.beginPath(); h.moveTo(x0, yT(v)); h.lineTo(x0 + w, yT(v)); h.stroke();
      h.fillText(v + '°', x0 - 4, yT(v) + 3);
    }
    h.setLineDash([4, 4]); h.strokeStyle = '#ff4d6d'; h.beginPath();
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
    line('demand', yP, 'rgba(56,225,255,.55)', [5, 4]);
    line('P', yP, '#38e1ff');
    line('T', yT, '#ff9a3d');

    h.textAlign = 'left'; h.font = '11px system-ui, sans-serif';
    h.fillStyle = '#ff9a3d'; h.fillText('— Temperatura (°C)', x0 + 6, HH - 5);
    h.fillStyle = '#38e1ff'; h.fillText('— Potencia (%)', x0 + 130, HH - 5);
    h.fillStyle = 'rgba(56,225,255,.75)'; h.fillText('- - Lo que pide la red', x0 + 230, HH - 5);
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
