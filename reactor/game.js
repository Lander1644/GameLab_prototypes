/* Interfaz del juego "Estabiliza el reactor": dibujo, controles y avisos.
 * La física vive en sim.js y los comandos de la terminal en commands.js
 * (ambos se pueden probar con Node sin navegador). */
(() => {
  'use strict';
  const Sim = window.ReactorSim;
  const Cmd = window.ReactorCommands;
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
    'SCRAM es el apagado de emergencia: se insertan todas las barras de golpe. Pero apagar la reacción no apaga el calor: el núcleo sigue produciendo calor residual.',
    'Tras un apagado queda ~7 % de calor residual (por la desintegración de los productos de fisión). Por eso existe el sistema RHR.',
    'El ácido bórico disuelto en el refrigerante absorbe neutrones: frena la reacción, pero despacio, porque hay que mezclarlo con toda el agua.',
    'Si se pierde la red eléctrica, los generadores diésel de emergencia arrancan en segundos para mantener las bombas funcionando (el accidente de Fukushima fue, en esencia, un apagón prolongado).',
    'El desvío de vapor (steam dump) manda vapor al condensador sin pasar por la turbina: enfría rápido, pero se desperdicia esa energía.',
    'El agua del reactor enfría el núcleo y además frena (modera) los neutrones para que provoquen nuevas fisiones.',
    'Los operadores reales no improvisan: siguen procedimientos escritos paso a paso, como los de la guía de la terminal.',
    'Aquí el tiempo va comprimido: un reactor real reacciona mucho más despacio y tiene varias capas de seguridad.',
  ];

  const ENDINGS = {
    won:      { title: '¡Reactor estabilizado!', text: 'Mantuviste la central funcionando hasta el final del turno.', learn: 'Los operadores reales hacen justo esto: equilibran potencia y refrigeración mientras cambia la demanda.' },
    meltdown: { title: '¡Sobrecalentamiento!', text: 'El núcleo llegó a 420 °C sin que el refrigerante pudiera controlarlo.', learn: 'Por eso las centrales reales tienen sistemas automáticos que apagan el reactor mucho antes de llegar aquí.' },
    shutdown: { title: 'Reactor apagado', text: 'La potencia se quedó en casi cero y la reacción en cadena se extinguió.', learn: 'Reiniciar un reactor lleva horas: el xenón acumulado complica volver a subir la potencia.' },
    hot:      { title: 'El núcleo sigue caliente', text: 'Se acabó el tiempo de enfriamiento y el núcleo no bajó de 90 °C.', learn: 'El SCRAM frena la reacción, pero el calor residual sigue ahí: hay que enfriar con la bomba, el desvío de vapor y el RHR.' },
  };

  // Final de la fase de enfriamiento tras un SCRAM
  function coolEnding(sm) {
    if (!sim.justified) return { title: 'Parada segura… pero innecesaria', text: 'Enfriaste el núcleo, pero el reactor estaba estable: la red se quedó sin energía sin motivo.', learn: 'El SCRAM es el último recurso: siempre es seguro, pero cuesta mucho volver a arrancar.' };
    return {
      title: sm.stars === 3 ? '¡Parada fría lograda!' : 'Parada fría',
      text: 'Llevaste el núcleo por debajo de ' + Sim.COOL_TARGET_T + ' °C en ' + Math.round(sim.coolT) + ' s' + (sm.stars === 3 ? '.' : ' (un poco lento: para 3 estrellas hacen falta ' + Sim.COOL_PAR + ' s o menos).'),
      learn: 'Apagar la reacción no basta: queda calor residual. Bomba + desvío de vapor + RHR en el orden correcto es lo que lo retira de forma segura.',
    };
  }

  let sim = Sim.create('normal');
  let active = false, paused = false, diffKey = 'normal';
  let last = 0, acc = 0, histAcc = 0, logSeen = 0, factIdx = 0, factClock = 0;
  let history = [], bubbles = [], dumpPhase = 0, uiPhase = null, cueKey = '', curCues = [], prevCueIds = new Set(), flowPhase = 0, steamPhase = 0, pumpAngle = 0, fanAngle = 0, endTimer = null;

  const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  /* ---------- Control de partida ---------- */

  function start(key) {
    clearTimeout(endTimer);
    diffKey = key;
    sim = Sim.create(key);
    active = true; paused = false; acc = 0; histAcc = 0; logSeen = 0; factClock = 0;
    history = []; bubbles = [];
    termReset();
    uiPhase = null; cueKey = ''; curCues = []; prevCueIds = new Set(); dumpPhase = 0;
    $('rods').value = sim.rods; $('pump').value = sim.pump;
    $('duration').textContent = fmtTime(sim.diff.duration);
    $('log').innerHTML = '';
    $('pause').textContent = 'Pausa (P)';
    $('startOverlay').classList.add('hidden');
    $('endOverlay').classList.add('hidden');
    applyPhaseUi();
    showFact();
  }

  const HINTS = { temp: $('tempHint').innerHTML, pow: $('powHint').innerHTML, rods: $('rodsHint').innerHTML };

  function setZones() {
    const d = sim.diff;
    const lo = sim.phase === 'cooldown' ? 0 : d.bandT[0], hi = sim.phase === 'cooldown' ? Sim.COOL_TARGET_T : d.bandT[1];
    $('zoneT').style.left = (lo / 450 * 100) + '%';
    $('zoneT').style.width = ((hi - lo) / 450 * 100) + '%';
  }

  // Cambia la interfaz entre la operación normal y la fase de enfriamiento (tras el SCRAM)
  function applyPhaseUi() {
    uiPhase = sim.phase;
    const cool = sim.phase === 'cooldown';
    setZones();
    $('pctLabel').textContent = cool ? 'Meta:' : 'Estable:';
    $('duration').textContent = fmtTime(cool ? Sim.COOL_LIMIT : sim.diff.duration);
    $('tempHint').innerHTML = cool ? 'Tras el SCRAM queda calor residual. Baja de <b>90 °C</b> (zona verde) antes de que se acabe el tiempo.' : HINTS.temp;
    $('powHint').innerHTML = cool ? 'Reactor apagado: la potencia debe quedarse en <b>cero</b>.' : HINTS.pow;
    $('rodsHint').innerHTML = cool ? 'Barras insertadas por el SCRAM: no se pueden sacar.' : HINTS.rods;
    $('rods').disabled = cool; $('rodsBox').classList.toggle('locked', cool);
    $('zoneP').style.display = cool ? 'none' : ''; $('markDemand').style.display = cool ? 'none' : '';
    $('scram').disabled = cool;
    $('scram').title = cool ? 'El reactor ya está apagado' : 'Apagado de emergencia';
    $('rods').value = sim.rods;
  }

  function showFact() {
    $('fact').textContent = FACTS[factIdx % FACTS.length];
    factIdx++;
  }

  function finish() {
    active = false;
    const sm = Sim.summary(sim);
    const e = sim.status === 'cooled' ? coolEnding(sm) : ENDINGS[sim.status];
    $('endTitle').textContent = e.title;
    $('endText').textContent = e.text;
    $('endLearn').textContent = '💡 ' + e.learn;
    const cooling = sim.status === 'cooled' || sim.status === 'hot';
    $('endStats').textContent = cooling
      ? 'Enfriamiento: ' + Math.round(sim.coolT) + ' s · Temperatura final: ' + Math.round(sim.T) + ' °C'
      : 'Tiempo estable: ' + Math.round(sm.pct * 100) + ' % · Duración del turno: ' + fmtTime(sim.t);
    $('endStars').innerHTML = (sim.status === 'won' || sim.status === 'cooled')
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
    const cool = sim.phase === 'cooldown';
    $('time').textContent = fmtTime(cool ? sim.coolT : sim.t);
    $('pct').textContent = cool ? '< ' + Sim.COOL_TARGET_T + ' °C' : Math.round(Sim.summary(sim).pct * 100) + ' %';
    $('vTemp').textContent = Math.round(T) + ' °C';
    $('vPow').textContent = Math.round(sim.P) + ' %';
    if ($('vDemand')) $('vDemand').textContent = sim.demand + ' %';
    $('vRods').textContent = Math.round(sim.rods) + ' %';
    $('vPump').textContent = Math.round(sim.pump) + ' %';

    const ft = $('fillT');
    ft.style.width = clamp(T / 450, 0, 1) * 100 + '%';
    ft.className = 'fill temp' + (cool ? (T > Sim.RHR_MAX_T ? ' hot' : T > Sim.COOL_TARGET_T ? ' cold' : '') : T >= Sim.warnTemp(d) ? ' danger' : T > d.bandT[1] ? ' hot' : T < d.bandT[0] ? ' cold' : '');

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
    g.fillStyle = '#18224a'; g.strokeStyle = sim.leak > 0 ? '#ff4d6d' : Sim.noPower(sim) ? '#ffc13d' : '#5c6fb3'; g.lineWidth = 3;
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
    const pumpEff = Sim.pumpEff(sim);
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

    drawSignals(dt, time);

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


  /* ---------- Señales sobre el dibujo: apagón, desvío de vapor, boro, diésel, RHR ---------- */

  function ringRect(x, y, w, hh, color, pulse) {
    g.save(); g.globalAlpha = 0.35 + 0.65 * pulse; g.strokeStyle = color; g.lineWidth = 3;
    roundRect(g, x - 5, y - 5, w + 10, hh + 10, 11); g.stroke(); g.restore();
  }

  function box(x, y, w, hh, border) {
    g.fillStyle = '#18224a'; g.strokeStyle = border; g.lineWidth = 2.5;
    roundRect(g, x, y, w, hh, 9); g.fill(); g.stroke();
  }

  function bar(x, y, w, frac, color) {
    g.fillStyle = '#0a1128'; g.fillRect(x, y, w, 8);
    g.fillStyle = color; g.fillRect(x, y, w * clamp(frac, 0, 1), 8);
  }

  function drawSignals(dt, time) {
    const has = (id) => curCues.some((c) => c.id === id && c.cmd);
    const pulse = 0.5 + 0.5 * Math.sin(time * 9);
    const cool = sim.phase === 'cooldown';
    const blackout = sim.blackout > 0;
    if (active && !paused) dumpPhase += 220 * dt;

    // Apagón: la sala se oscurece (menos si el diésel ya está en marcha)
    if (blackout) {
      const a = sim.diesel === 'on' ? 0.14 : 0.42 + (Math.sin(time * 23) > 0.85 ? 0.12 : 0);
      g.fillStyle = 'rgba(4,6,16,' + a + ')'; g.fillRect(0, 0, CW, CH);
    }

    // Desvío de vapor: una derivación entre la línea de vapor y el retorno, con su válvula
    const vx = 415, vyTop = 150, vyBot = 235, vyV = 192;
    g.save(); g.lineCap = 'butt'; g.setLineDash([]);
    g.beginPath(); g.moveTo(vx, vyTop); g.lineTo(vx, vyBot); g.strokeStyle = '#1a2550'; g.lineWidth = 11; g.stroke();
    if (sim.dump > 0) { g.setLineDash([7, 8]); g.lineDashOffset = -dumpPhase; g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.stroke(); g.setLineDash([]); }
    else { g.strokeStyle = '#2f3d78'; g.lineWidth = 5; g.stroke(); }
    g.restore();
    const ready = Sim.dumpReady(sim);
    const vcol = sim.dump > 0 ? '#3dff9a' : ready ? '#9fb0ea' : '#4a547f';
    g.fillStyle = '#18224a'; g.strokeStyle = vcol; g.lineWidth = 3;
    g.beginPath(); g.arc(vx, vyV, 8, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath();
    if (sim.dump > 0) { g.moveTo(vx, vyV - 5); g.lineTo(vx, vyV + 5); } else { g.moveTo(vx - 5, vyV); g.lineTo(vx + 5, vyV); }
    g.strokeStyle = vcol; g.lineWidth = 3; g.stroke();
    if ((has('calor') || has('enfriar')) && ready) {
      g.save(); g.globalAlpha = 0.35 + 0.65 * pulse; g.strokeStyle = '#3dff9a'; g.lineWidth = 3;
      g.beginPath(); g.arc(vx, vyV, 13 + 2 * pulse, 0, Math.PI * 2); g.stroke(); g.restore();
    }
    g.font = 'bold 10px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = sim.dump > 0 ? '#3dff9a' : '#93a0cf';
    g.fillText(sim.dump > 0 ? 'ABIERTO ' + Math.ceil(sim.dump) + ' s' : sim.dumpCd > 0 ? 'recarga ' + Math.ceil(sim.dumpCd) + ' s' : 'Desvío', vx + 2, 226);

    // Tanque de boro: su nivel es el boro disuelto; se conecta al lazo frío (x=270)
    const bx = 296, by = 300, bw = 34, bh = 62;
    const injecting = sim.boronTarget > sim.boron + 0.5;
    if (injecting) pipe([[bx, 346], [270, 346]], '#c78bff', flowPhase, 8, 4);
    else { g.strokeStyle = '#1a2550'; g.lineWidth = 8; g.beginPath(); g.moveTo(bx, 346); g.lineTo(270, 346); g.stroke(); }
    box(bx, by, bw, bh, sim.boron > 1 ? '#a66bff' : '#3a4678');
    const lvl = clamp(sim.boron / 100, 0, 1) * (bh - 6);
    g.fillStyle = '#a66bff'; g.fillRect(bx + 3, by + bh - 3 - lvl, bw - 6, lvl);
    g.fillStyle = '#fff'; g.font = 'bold 10px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(Math.round(sim.boron) + ' %', bx + bw / 2, by + bh / 2 + 4);
    g.fillStyle = '#93a0cf'; g.font = '11px system-ui, sans-serif'; g.fillText('Boro', bx + bw / 2, by - 7);
    if (has('pico') || has('diluir')) ringRect(bx, by, bw, bh, has('pico') ? '#ffc13d' : '#3dff9a', pulse);

    // Generador diésel
    const dx = 346, dy = 312, dw = 80, dh = 60;
    const dcol = sim.diesel === 'on' ? '#3dff9a' : sim.diesel === 'starting' ? '#ffc13d' : blackout ? '#ff4d6d' : '#3a4678';
    box(dx, dy, dw, dh, dcol);
    g.textAlign = 'center'; g.fillStyle = '#93a0cf'; g.font = '11px system-ui, sans-serif';
    g.fillText('Generador diésel', dx + dw / 2, dy - 7);
    g.font = 'bold 11px system-ui, sans-serif';
    if (sim.diesel === 'on') { g.fillStyle = '#3dff9a'; g.fillText('EN MARCHA', dx + dw / 2, dy + 26); }
    else if (sim.diesel === 'starting') { g.fillStyle = '#ffc13d'; g.fillText('arrancando…', dx + dw / 2, dy + 26); }
    else if (blackout) { g.fillStyle = '#ff4d6d'; if (Math.floor(time * 3) % 2 === 0) g.fillText('¡ARRANCAR!', dx + dw / 2, dy + 26); }
    else { g.fillStyle = '#6b78a8'; g.fillText('en espera', dx + dw / 2, dy + 26); }
    const dfrac = sim.diesel === 'on' ? 1 : sim.diesel === 'starting' ? 1 - sim.dieselT / sim.diff.dieselTime : 0;
    bar(dx + 8, dy + 38, dw - 16, dfrac, sim.diesel === 'on' ? '#3dff9a' : '#ffc13d');
    if (has('apagon')) ringRect(dx, dy, dw, dh, '#ff4d6d', pulse);

    // RHR (sistema de calor residual): solo se usa tras un SCRAM
    const rx = 442, ry = 312, rw = 98, rh = 60;
    const rcol = sim.rhr === 'on' ? '#3dff9a' : sim.rhr === 'starting' ? '#ffc13d' : cool && sim.T <= Sim.RHR_MAX_T ? '#3dff9a' : '#3a4678';
    box(rx, ry, rw, rh, rcol);
    g.textAlign = 'center'; g.fillStyle = '#93a0cf'; g.font = '11px system-ui, sans-serif';
    g.fillText('RHR · calor residual', rx + rw / 2, ry - 7);
    g.font = 'bold 11px system-ui, sans-serif';
    if (!cool) { g.fillStyle = '#6b78a8'; g.fillText('solo tras SCRAM', rx + rw / 2, ry + 26); }
    else if (sim.rhr === 'on') { g.fillStyle = '#3dff9a'; g.fillText('EN MARCHA', rx + rw / 2, ry + 26); }
    else if (sim.rhr === 'starting') { g.fillStyle = '#ffc13d'; g.fillText('arrancando…', rx + rw / 2, ry + 26); }
    else if (sim.T > Sim.RHR_MAX_T) { g.fillStyle = '#6b78a8'; g.fillText('espera < ' + Sim.RHR_MAX_T + ' °C', rx + rw / 2, ry + 26); }
    else { g.fillStyle = '#3dff9a'; if (Math.floor(time * 3) % 2 === 0) g.fillText('¡CONECTAR!', rx + rw / 2, ry + 26); }
    const rfrac = sim.rhr === 'on' ? 1 : sim.rhr === 'starting' ? 1 - sim.rhrT / Sim.RHR_START : 0;
    bar(rx + 8, ry + 38, rw - 16, rfrac, sim.rhr === 'on' ? '#3dff9a' : '#ffc13d');
    if (has('rhr')) ringRect(rx, ry, rw, rh, '#3dff9a', pulse);
    if (has('fuga')) { g.save(); g.globalAlpha = 0.35 + 0.65 * pulse; g.strokeStyle = '#ffc13d'; g.lineWidth = 3; g.beginPath(); g.arc(34, 378, 25, 0, Math.PI * 2); g.stroke(); g.restore(); }

    // Carteles de arriba a la derecha
    const banners = [];
    if (cool) banners.push({ t: '⛔ SCRAM · enfriando · ' + Math.max(0, Math.ceil(Sim.COOL_LIMIT - sim.coolT)) + ' s', c: '#38e1ff', flash: false });
    if (blackout) banners.push(sim.diesel === 'on' ? { t: '🔋 Diésel en marcha · ' + Math.ceil(sim.blackout) + ' s', c: '#3dff9a', flash: false } : { t: '🔌 APAGÓN · ' + Math.ceil(sim.blackout) + ' s', c: '#ff4d6d', flash: true });
    g.font = 'bold 15px system-ui, sans-serif'; g.textAlign = 'center';
    banners.forEach((b, i) => {
      g.globalAlpha = b.flash ? 0.6 + 0.4 * pulse : 1; g.fillStyle = b.c; g.fillText(b.t, 410, 28 + i * 22); g.globalAlpha = 1;
    });

    // Fichas con el comando que conviene ejecutar (se pulsan en la terminal, tecla T)
    if (active) {
      let cx = 292;
      g.font = 'bold 12px ui-monospace, Consolas, monospace'; g.textAlign = 'left';
      curCues.filter((c) => c.cmd).slice(0, 2).forEach((c) => {
        const label = '▶ ' + c.cmd, w = g.measureText(label).width + 14;
        g.globalAlpha = 0.7 + 0.3 * pulse;
        g.fillStyle = c.level === 'bad' ? '#ff4d6d' : c.level === 'warn' ? '#ffc13d' : '#3dff9a';
        roundRect(g, cx, 380, w, 18, 9); g.fill();
        g.globalAlpha = 1; g.fillStyle = '#0a0f21'; g.fillText(label, cx + 7, 393);
        cx += w + 6;
      });
    }

    // Sin energía: rótulo junto a la bomba
    if (Sim.noPower(sim)) { g.fillStyle = '#ffc13d'; g.font = 'bold 11px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText('SIN', 4, 258); g.fillText('ENERGÍA', 4, 271); }
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

    if (sim.phase === 'cooldown') {
      h.setLineDash([5, 4]); h.strokeStyle = '#3dff9a'; h.beginPath(); h.moveTo(x0, yT(Sim.COOL_TARGET_T)); h.lineTo(x0 + w, yT(Sim.COOL_TARGET_T)); h.stroke(); h.setLineDash([]);
      h.fillStyle = '#3dff9a'; h.textAlign = 'right'; h.fillText('meta 90 °C', x0 + w - 4, yT(Sim.COOL_TARGET_T) - 4);
    }
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

  /* ---------- Terminal de protocolo de emergencia ---------- */

  let consoleOpen = false;
  let cmdHist = [], histPos = 0;
  const termOut = $('termOut'), termInput = $('termInput'), consoleEl = $('console'), toggleBtn = $('consoleToggle');

  function termLine(text, cls) {
    const div = document.createElement('div');
    div.className = 'line ' + (cls || 'muted');
    div.textContent = text;
    termOut.appendChild(div);
    termOut.scrollTop = termOut.scrollHeight;
  }

  function termReset() {
    termOut.innerHTML = '';
    termLine('Sala de control lista. Cuando suene una señal 🔔, ejecuta su comando (o pulsa «Cargar ▸» en la guía). «ayuda» muestra la lista.', 'muted');
  }

  function runMeta(cmd) {
    if (cmd.name === 'estado') termLine(Cmd.stateLine(sim), 'muted');
    else if (cmd.name === 'procesos') Cmd.processLines(sim).forEach((l) => termLine(l, 'muted'));
    else if (cmd.name === 'ayuda') { termLine('Comandos:', 'muted'); for (const c of Cmd.COMMANDS) termLine('  ' + c.help, 'muted'); }
    else if (cmd.name === 'limpiar') termOut.innerHTML = '';
  }

  function submitTerminal() {
    const text = termInput.value;
    termInput.value = '';
    if (!text.trim()) return;
    cmdHist.push(text); histPos = cmdHist.length;

    for (const p of Cmd.parse(text)) {
      termLine(p.raw, 'cmd');
      if (!p.ok) { termLine('✕ ' + p.error, 'bad'); continue; }
      if (p.cmd.kind === 'meta') { runMeta(p.cmd); continue; }          // consultas: funcionan siempre
      if (!active) { termLine('✕ El reactor no está en marcha. Empieza una partida primero.', 'bad'); continue; }
      if (paused) { termLine('✕ El juego está en pausa.', 'bad'); continue; }
      const r = Cmd.apply(Sim, sim, p);                                   // los procedimientos actúan al instante y corren en paralelo
      termLine((r.ok ? '› ' : '✕ ') + r.text, r.ok ? 'ok' : 'bad');
      $('rods').value = sim.rods; $('pump').value = sim.pump;
    }
  }

  /* ---------- Señales (avisos que dicen cuándo ejecutar cada comando) ---------- */

  function updateCues() {
    const cues = active ? Sim.cues(sim) : [];
    curCues = cues;
    const key = cues.map((c) => c.id + '|' + c.cmd + '|' + c.title).join(';');
    if (key === cueKey) return;
    cueKey = key;

    const bar = $('cueBar');
    bar.innerHTML = '';
    for (const c of cues) {
      const el = document.createElement(c.cmd ? 'button' : 'div');
      if (c.cmd) el.type = 'button';
      el.className = 'cue ' + c.level + (c.cmd ? '' : ' info');
      const ico = document.createElement('span'); ico.className = 'ico'; ico.textContent = c.icon;
      const body = document.createElement('span'); body.className = 'body';
      const t = document.createElement('b'); t.textContent = c.title;
      const sm = document.createElement('small'); sm.textContent = c.text;
      body.append(t, sm); el.append(ico, body);
      if (c.cmd) {
        const code = document.createElement('code'); code.textContent = c.cmd; el.append(code);
        el.title = 'Abrir la terminal con este comando';
        el.addEventListener('click', () => { openConsole(); termInput.value = c.cmd; termInput.focus(); });
      }
      bar.appendChild(el);
    }

    for (const c of cues) {
      if (c.cmd && !prevCueIds.has(c.id)) termLine('🔔 ' + c.title + ' — ' + c.text + '  Escribe:  ' + c.cmd, 'alertline');
    }
    prevCueIds = new Set(cues.map((c) => c.id));

    const n = cues.filter((c) => c.cmd).length;
    $('cueCount').hidden = n === 0; $('cueCount').textContent = n;
    toggleBtn.classList.toggle('alert', n > 0);

    const guide = $('paneGuide');
    let first = null;
    document.querySelectorAll('.proto[data-cue]').forEach((card) => {
      const on = cues.some((c) => c.cmd && c.id === card.dataset.cue);
      card.classList.toggle('now', on);
      if (on && !first) first = card;
    });
    if (first) guide.scrollTo({ top: first.getBoundingClientRect().top - guide.getBoundingClientRect().top + guide.scrollTop - 8, behavior: 'smooth' });
  }

  function openConsole() {
    consoleOpen = true;
    consoleEl.classList.add('open');
    consoleEl.setAttribute('aria-hidden', 'false');
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.hidden = true;
    setTimeout(() => termInput.focus(), 60);
  }
  function closeConsole() {
    consoleOpen = false;
    consoleEl.classList.remove('open');
    consoleEl.setAttribute('aria-hidden', 'true');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.hidden = false;
  }
  function toggleConsole() { consoleOpen ? closeConsole() : openConsole(); }

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
    updateCues();
    if (sim.phase !== uiPhase) applyPhaseUi();
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

  $('rods').addEventListener('input', (e) => { if (active && !paused && sim.phase === 'operation') setRods(+e.target.value); else e.target.value = sim.rods; });
  $('pump').addEventListener('input', (e) => { if (active && !paused) setPump(+e.target.value); else e.target.value = sim.pump; });
  $('scram').addEventListener('click', () => { if (active && !paused && sim.phase === 'operation') { Sim.scram(sim); $('rods').value = 100; } });
  $('pause').addEventListener('click', togglePause);
  $('again').addEventListener('click', () => start(diffKey));
  $('changeDiff').addEventListener('click', () => { $('endOverlay').classList.add('hidden'); $('startOverlay').classList.remove('hidden'); });
  document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => start(b.dataset.diff)));

  // Terminal
  toggleBtn.addEventListener('click', toggleConsole);
  $('consoleClose').addEventListener('click', closeConsole);
  $('termForm').addEventListener('submit', (e) => { e.preventDefault(); submitTerminal(); });
  document.querySelectorAll('.proto .load').forEach((b) => b.addEventListener('click', () => {
    termInput.value = b.dataset.cmds;
    termInput.focus();
    termLine('(protocolo cargado — revísalo y pulsa «Ejecutar»)', 'muted');
  }));
  termInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); if (histPos > 0) { histPos--; termInput.value = cmdHist[histPos] || ''; } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (histPos < cmdHist.length) { histPos++; termInput.value = cmdHist[histPos] || ''; } }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target === termInput) { if (e.key === 'Escape') { closeConsole(); } return; }  // dentro de la terminal, escribe libre
    if (e.key === 'Escape' && consoleOpen) { closeConsole(); return; }
    if (e.key === 't' || e.key === 'T') { toggleConsole(); return; }
    const k = e.key;
    if (k === 'p' || k === 'P') { togglePause(); return; }
    if (!active || paused) return;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { setRods(sim.rods - 2); e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { setRods(sim.rods + 2); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { setPump(sim.pump - 2); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { setPump(sim.pump + 2); e.preventDefault(); }
  });

  setZones();
  termReset();
  $('duration').textContent = fmtTime(sim.diff.duration);
  showFact();
  requestAnimationFrame(frame);
})();
