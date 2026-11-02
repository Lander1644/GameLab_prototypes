/* Simulación del reactor (sin dibujo, sin DOM) para poder probarla con Node:
 *   node tools/test-reactor.js
 *
 * Modelo simplificado y "comprimido" en el tiempo (un reactor real es mucho más lento):
 *  - rods:  % de inserción de las barras de control (más insertadas = menos potencia)
 *  - pump:  % de la bomba de refrigerante
 *  - P:     potencia del reactor (%), sigue a las barras con retraso
 *  - T:     temperatura del núcleo (°C), sube con la potencia y baja con el refrigerante
 *  - X:     "xenón" (veneno de neutrones): se acumula con la potencia y frena la reacción
 */
(function (root) {
  'use strict';

  const DT = 0.05;            // paso de simulación (s)
  const MELTDOWN_T = 420;     // °C: fusión del núcleo
  const START_T = 297;

  const DIFFICULTIES = {
    facil:   { label: 'Fácil',   duration: 60,  xenon: 0.15, feedback: 0.0020, eventRate: 0.8, noise: 0,   bandT: [240, 360], tolP: 15 },
    normal:  { label: 'Normal',  duration: 90,  xenon: 0.35, feedback: 0.0012, eventRate: 1.0, noise: 1.5, bandT: [250, 350], tolP: 15 },
    dificil: { label: 'Difícil', duration: 120, xenon: 0.50, feedback: 0.0006, eventRate: 1.5, noise: 3,   bandT: [270, 330], tolP: 10 },
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function say(s, text, level) {
    s.log.push({ t: s.t, text: text, level: level || 'info' });
  }

  function warnTemp(d) {
    return Math.min(d.bandT[1] + 30, MELTDOWN_T - 10);
  }

  function create(key, rand) {
    rand = rand || Math.random;
    const d = DIFFICULTIES[key];
    const P0 = 50;
    // Posición de barras que deja la potencia en equilibrio en P0 (con el xenón de equilibrio)
    const rods = Math.round(100 - P0 / (1 - d.xenon * P0 / 100));
    return {
      key: key, diff: d,
      t: 0, rods: rods, pump: 50,
      P: P0, X: P0 / 100, T: START_T,
      demand: 50,
      leak: 0, burst: 0,
      nextDemand: 12 + rand() * 4,
      nextLeak: (25 + rand() * 10) / d.eventRate,
      nextBurst: (40 + rand() * 10) / d.eventRate,
      lowTime: 0, stable: 0, warned: false,
      status: 'running',      // running | won | meltdown | shutdown | scram
      log: [{ t: 0, text: 'Reactor en marcha. La red pide 50 % de potencia.', level: 'info' }],
    };
  }

  function setControls(s, rods, pump) {
    if (s.status !== 'running') return;
    if (rods != null) s.rods = clamp(rods, 0, 100);
    if (pump != null) s.pump = clamp(pump, 0, 100);
  }

  function inBand(s) {
    const d = s.diff;
    return s.T >= d.bandT[0] && s.T <= d.bandT[1] && Math.abs(s.P - s.demand) <= d.tolP;
  }

  function runEvents(s, dt, rand) {
    const d = s.diff;
    if (s.leak > 0) {
      s.leak -= dt;
      if (s.leak <= 0) say(s, 'Fuga reparada: la bomba vuelve a su eficiencia normal.', 'ok');
    }
    if (s.burst > 0) {
      s.burst -= dt;
      if (s.burst <= 0) say(s, 'El pico de reactividad terminó.', 'ok');
    }
    if (s.t >= s.nextDemand) {
      let nd;
      do { nd = 30 + Math.round(rand() * 10) * 5; } while (Math.abs(nd - s.demand) < 15);
      s.demand = nd;
      say(s, 'La red eléctrica ahora pide ' + nd + ' % de potencia.', 'info');
      s.nextDemand = s.t + (14 + rand() * 8) / d.eventRate;
    }
    if (s.t >= s.nextLeak && s.leak <= 0) {
      s.leak = 10;
      say(s, '¡Fuga de refrigerante! La bomba pierde eficiencia unos segundos.', 'warn');
      s.nextLeak = s.t + (28 + rand() * 14) / d.eventRate;
    }
    if (s.t >= s.nextBurst && s.burst <= 0) {
      s.burst = 8;
      say(s, '¡Pico de reactividad! La potencia sube por sí sola.', 'warn');
      s.nextBurst = s.t + (35 + rand() * 15) / d.eventRate;
    }
  }

  function step(s, dt, rand) {
    if (s.status !== 'running') return;
    rand = rand || Math.random;
    const d = s.diff;
    s.t += dt;
    runEvents(s, dt, rand);

    // Coeficiente de temperatura: si el núcleo se calienta, la reacción se frena un poco
    const feedback = clamp(1 - d.feedback * (s.T - 300), 0.6, 1.4);
    let target = (100 - s.rods) * (1 - d.xenon * s.X) * feedback + (s.burst > 0 ? 12 : 0);
    target = clamp(target, 0, 120);
    s.P += (target - s.P) * (1 - Math.exp(-dt / 2));
    s.X += (s.P / 100 - s.X) * (1 - Math.exp(-dt / 25));

    const pumpEff = s.pump * (s.leak > 0 ? 0.55 : 1);
    const cooling = 0.025 * (pumpEff + 10) * (s.T - 30);
    s.T += ((8 * s.P - cooling) / 25) * dt;
    if (s.T < 30) s.T = 30;

    if (inBand(s)) s.stable += dt;

    const warn = warnTemp(d);
    if (s.T > warn && !s.warned) { s.warned = true; say(s, '¡Temperatura peligrosa! Sube la bomba o inserta barras.', 'bad'); }
    if (s.T < warn - 15) s.warned = false;

    if (s.T >= MELTDOWN_T) {
      s.status = 'meltdown';
    } else {
      s.lowTime = s.P < 3 ? s.lowTime + dt : 0;
      if (s.lowTime > 6) s.status = 'shutdown';
      else if (s.t >= d.duration) s.status = 'won';
    }
  }

  function scram(s) {
    if (s.status !== 'running') return;
    s.rods = 100;
    s.status = 'scram';
    say(s, 'SCRAM: todas las barras de control insertadas.', 'bad');
  }

  function summary(s) {
    const pct = s.t > 0 ? s.stable / s.t : 1;
    let stars = 0;
    if (s.status === 'won') stars = pct >= 0.8 ? 3 : pct >= 0.6 ? 2 : 1;
    return { pct: pct, stars: stars };
  }

  const api = {
    DT: DT, MELTDOWN_T: MELTDOWN_T, DIFFICULTIES: DIFFICULTIES,
    create: create, step: step, setControls: setControls, scram: scram,
    inBand: inBand, summary: summary, warnTemp: warnTemp,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReactorSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
