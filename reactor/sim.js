/* Simulación del reactor (sin dibujo, sin DOM) para poder probarla con Node:
 *   node tools/test-reactor.js
 *
 * Modelo simplificado y "comprimido" en el tiempo (un reactor real es mucho más lento):
 *  - rods:  % de inserción de las barras de control (más insertadas = menos potencia)
 *  - pump:  % de la bomba de refrigerante
 *  - P:     potencia del reactor (%), sigue a las barras con retraso
 *  - T:     temperatura del núcleo (°C), sube con la potencia y baja con el refrigerante
 *  - X:     "xenón" (veneno de neutrones): se acumula con la potencia y frena la reacción
 *  - H:     calor residual (de la desintegración): sigue ahí aunque se apague la reacción
 *
 * Además de las palancas (barras y bomba) hay PROCEDIMIENTOS que se ejecutan desde la terminal
 * y corren en paralelo, cada uno con su duración, su espera o su requisito:
 *  - boro            frena la reacción despacio (control lento, como las barras pero con inercia)
 *  - desvío de vapor manda calor al condensador (enfría rápido, pero esa energía no llega a la red)
 *  - aislar fuga     cierra el lazo que pierde agua (la fuga para, pero ese lazo enfría menos un rato)
 *  - apagón + diésel las bombas se quedan sin energía hasta que arranca el generador de emergencia
 *  - RHR             remoción de calor residual: solo después de un SCRAM y por debajo de 200 °C
 *
 * El SCRAM ya no termina la partida: empieza la fase de ENFRIAMIENTO (phase = 'cooldown'). El
 * reactor sigue caliente por el calor residual y hay que bajar el núcleo de 90 °C para dejarlo
 * en parada segura.
 *
 * Cada procedimiento devuelve { ok, text }: text es lo que la terminal le muestra al jugador.
 * cues(s) devuelve las SEÑALES activas (qué está pasando y qué comando conviene).
 */
(function (root) {
  'use strict';

  const DT = 0.05;            // paso de simulación (s)
  const MELTDOWN_T = 420;     // °C: fusión del núcleo
  const START_T = 297;

  // --- Procedimientos
    const BLACKOUT_TIME = 30;   // s que dura un apagón de la red exterior
  const DUMP_TIME = 7;        // s que dura el desvío de vapor abierto
  const DUMP_COOLDOWN = 16;   // s de espera antes de poder abrirlo otra vez
  const LEAK_EFF = 0.55;      // eficiencia de la bomba con fuga
  const ISOLATE_TIME = 8;     // s que el lazo aislado enfría menos
  const ISOLATE_EFF = 0.75;   // eficiencia de la bomba con el lazo aislado
  const BORON_K = 0.006;      // cada 1 % de boro resta 0,6 % de potencia (boro 100 → 40 % de la potencia)
  const DECAY = 0.07;         // fracción de calor residual (~7 %, como en un reactor real)

  // --- Fase de enfriamiento (después del SCRAM)
  const COOL_TARGET_T = 90;   // °C: "parada fría"
  const COOL_LIMIT = 90;      // s máximos para lograrlo
  const COOL_PAR = 50;        // s: dentro de este tiempo = 3 estrellas
  const RHR_MAX_T = 200;      // °C: el RHR solo puede conectarse por debajo de esto
  const RHR_START = 4;        // s que tarda en arrancar el RHR

  const DIFFICULTIES = {
    facil:   { label: 'Fácil',   duration: 60,  xenon: 0.15, feedback: 0.0020, eventRate: 0.8, noise: 0,   bandT: [240, 360], tolP: 15, dieselTime: 4,   natural: 30 },
    normal:  { label: 'Normal',  duration: 90,  xenon: 0.35, feedback: 0.0012, eventRate: 1.0, noise: 1.5, bandT: [250, 350], tolP: 15, dieselTime: 3.5, natural: 24 },
    dificil: { label: 'Difícil', duration: 120, xenon: 0.50, feedback: 0.0006, eventRate: 1.5, noise: 3,   bandT: [270, 330], tolP: 10, dieselTime: 3,   natural: 18 },
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
      P: P0, X: P0 / 100, T: START_T, H: DECAY * P0,
      demand: 50,
      leak: 0, burst: 0,
      nextDemand: 12 + rand() * 4,
      nextLeak: (25 + rand() * 10) / d.eventRate,
      nextBurst: (40 + rand() * 10) / d.eventRate,
      nextBlackout: (32 + rand() * 12) / d.eventRate,
      lowTime: 0, stable: 0, warned: false,
      // procedimientos en paralelo
      boron: 0, boronTarget: 0,             // % de boro actual y objetivo
      dump: 0, dumpCd: 0,                   // s restantes del desvío abierto / de su espera
      isolated: 0,                          // s restantes con el lazo aislado
      blackout: 0, diesel: 'off', dieselT: 0,   // diesel: off | starting | on
      // fase de enfriamiento (tras el SCRAM)
      phase: 'operation',                   // operation | cooldown
      coolT: 0, rhr: 'off', rhrT: 0,        // rhr: off | starting | on
      justified: true,
      status: 'running',                    // running | won | meltdown | shutdown | cooled | hot
      log: [{ t: 0, text: 'Reactor en marcha. La red pide 50 % de potencia.', level: 'info' }],
    };
  }

  // Las palancas: las barras solo se mueven en operación (tras el SCRAM quedan insertadas)
  function setControls(s, rods, pump) {
    if (s.status !== 'running') return;
    if (rods != null && s.phase === 'operation') s.rods = clamp(rods, 0, 100);
    if (pump != null) s.pump = clamp(pump, 0, 100);
  }

  // Eficiencia real de la bomba (%), contando fuga, lazo aislado y apagón
  function pumpEff(s) {
    let eff = s.pump;
    if (s.leak > 0) eff *= LEAK_EFF;
    else if (s.isolated > 0) eff *= ISOLATE_EFF;
    if (s.blackout > 0 && s.diesel !== 'on') eff = Math.min(eff, s.diff.natural);   // sin energía: circulación natural
    return eff;
  }

  function noPower(s) { return s.blackout > 0 && s.diesel !== 'on'; }
  function dumpReady(s) { return s.dump <= 0 && s.dumpCd <= 0; }

  function inBand(s) {
    const d = s.diff;
    if (s.dump > 0) return false;   // el calor desviado no llega a la red: no cuenta como estable
    return s.T >= d.bandT[0] && s.T <= d.bandT[1] && Math.abs(s.P - s.demand) <= d.tolP;
  }

  /* ---------- Procedimientos (los llama la terminal) ---------- */

  function notRunning(s) { return s.status !== 'running' ? { ok: false, text: 'El reactor ya no está en marcha.' } : null; }

  function setBoron(s, level) {
    const nr = notRunning(s); if (nr) return nr;
    if (s.phase !== 'operation') return { ok: false, text: 'El reactor ya está apagado: no hace falta ajustar el boro.' };
    s.boronTarget = clamp(level, 0, 100);
    const dir = s.boronTarget > s.boron ? 'inyectando' : s.boronTarget < s.boron ? 'diluyendo' : 'sin cambios';
    return { ok: true, text: 'Boro → objetivo ' + Math.round(s.boronTarget) + ' % (' + dir + '). Actúa despacio: compénsalo con las barras.' };
  }

  function startDump(s) {
    const nr = notRunning(s); if (nr) return nr;
    if (s.dump > 0) return { ok: false, text: 'El desvío de vapor ya está abierto (' + Math.ceil(s.dump) + ' s).' };
    if (s.dumpCd > 0) return { ok: false, text: 'El desvío de vapor se está recargando (' + Math.ceil(s.dumpCd) + ' s).' };
    s.dump = DUMP_TIME;
    return { ok: true, text: 'Desvío de vapor abierto ' + DUMP_TIME + ' s: el calor va al condensador (esa energía no llega a la red).' };
  }

  function isolateLeak(s) {
    const nr = notRunning(s); if (nr) return nr;
    if (s.leak <= 0) return { ok: false, text: 'No hay ninguna fuga que aislar.' };
    s.leak = 0; s.isolated = ISOLATE_TIME;
    say(s, 'Fuga aislada: ese lazo enfría menos durante unos segundos.', 'ok');
    return { ok: true, text: 'Fuga aislada. Ese lazo enfriará al ' + Math.round(ISOLATE_EFF * 100) + ' % durante ' + ISOLATE_TIME + ' s.' };
  }

  function startDiesel(s) {
    const nr = notRunning(s); if (nr) return nr;
    if (s.blackout <= 0) return { ok: false, text: 'No hay apagón: la red exterior alimenta las bombas.' };
    if (s.diesel === 'on') return { ok: false, text: 'El diésel ya está en marcha.' };
    if (s.diesel === 'starting') return { ok: false, text: 'El diésel ya está arrancando (' + Math.ceil(s.dieselT) + ' s).' };
    s.diesel = 'starting'; s.dieselT = s.diff.dieselTime;
    return { ok: true, text: 'Arrancando el generador diésel (' + s.diff.dieselTime + ' s). Mientras tanto, baja la potencia con las barras.' };
  }

  function startRhr(s) {
    const nr = notRunning(s); if (nr) return nr;
    if (s.phase !== 'cooldown') return { ok: false, text: 'El RHR solo se usa después de un SCRAM.' };
    if (s.rhr !== 'off') return { ok: false, text: s.rhr === 'on' ? 'El RHR ya está funcionando.' : 'El RHR ya está arrancando.' };
    if (noPower(s)) return { ok: false, text: 'El RHR no tiene energía (apagón): arranca el diésel primero.' };
    if (s.T > RHR_MAX_T) return { ok: false, text: 'Aún está a ' + Math.round(s.T) + ' °C: el RHR solo se conecta por debajo de ' + RHR_MAX_T + ' °C.' };
    s.rhr = 'starting'; s.rhrT = RHR_START;
    return { ok: true, text: 'Conectando el sistema de remoción de calor residual (' + RHR_START + ' s).' };
  }

  function scram(s) {
    if (s.status !== 'running' || s.phase !== 'operation') return;
    const d = s.diff;
    s.justified = s.T > d.bandT[1] || noPower(s);     // ¿había motivo real para apagar?
    s.rods = 100;
    s.phase = 'cooldown'; s.coolT = 0;
    s.leak = 0; s.burst = 0;
    say(s, 'SCRAM: barras insertadas y turbina disparada. Ahora hay que enfriar el núcleo por debajo de ' + COOL_TARGET_T + ' °C.', 'bad');
  }

  /* ---------- Simulación ---------- */

  function tickTimers(s, dt) {
    if (s.leak > 0) {
      s.leak -= dt;
      if (s.leak <= 0) say(s, 'Fuga reparada: la bomba vuelve a su eficiencia normal.', 'ok');
    }
    if (s.burst > 0) {
      s.burst -= dt;
      if (s.burst <= 0) say(s, 'El pico de reactividad terminó.', 'ok');
    }
    if (s.isolated > 0) {
      s.isolated -= dt;
      if (s.isolated <= 0) say(s, 'Lazo reabierto: la bomba vuelve a su eficiencia normal.', 'ok');
    }
    if (s.dump > 0) {
      s.dump -= dt;
      if (s.dump <= 0) { s.dump = 0; s.dumpCd = DUMP_COOLDOWN; say(s, 'Desvío de vapor cerrado (se recarga unos segundos).', 'info'); }
    } else if (s.dumpCd > 0) {
      s.dumpCd = Math.max(0, s.dumpCd - dt);
    }
    if (s.blackout > 0) {
      s.blackout -= dt;
      if (s.diesel === 'starting') {
        s.dieselT -= dt;
        if (s.dieselT <= 0) { s.diesel = 'on'; say(s, 'Diésel en marcha: las bombas vuelven a tener energía.', 'ok'); }
      }
      if (s.blackout <= 0) { s.blackout = 0; s.diesel = 'off'; say(s, 'La red exterior volvió: las bombas tienen energía otra vez.', 'ok'); }
    }
    if (s.rhr === 'starting') {
      s.rhrT -= dt;
      if (s.rhrT <= 0) { s.rhr = 'on'; say(s, 'RHR en marcha: el calor residual se está retirando.', 'ok'); }
    }
  }

  function runEvents(s, rand) {
    const d = s.diff;
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
    if (s.t >= s.nextBlackout && s.blackout <= 0) {
      s.blackout = BLACKOUT_TIME; s.diesel = 'off';
      say(s, '¡APAGÓN! La red exterior se cayó y las bombas se detienen. Arranca el diésel.', 'bad');
      s.nextBlackout = s.t + (55 + rand() * 20) / d.eventRate;
    }
  }

  function step(s, dt, rand) {
    if (s.status !== 'running') return;
    rand = rand || Math.random;
    const d = s.diff;
    s.t += dt;
    tickTimers(s, dt);
    if (s.phase === 'operation') runEvents(s, rand);

    // Boro: se inyecta rápido y se diluye despacio
    s.boron += (s.boronTarget - s.boron) * (1 - Math.exp(-dt / (s.boronTarget > s.boron ? 4 : 14)));

    // Coeficiente de temperatura: si el núcleo se calienta, la reacción se frena un poco
    const feedback = clamp(1 - d.feedback * (s.T - 300), 0.6, 1.4);
    const boronFactor = 1 - BORON_K * s.boron;
    let target = ((100 - s.rods) * (1 - d.xenon * s.X) * feedback + (s.burst > 0 ? 12 : 0)) * boronFactor;
    target = clamp(target, 0, 120);
    s.P += (target - s.P) * (1 - Math.exp(-dt / 2));
    s.X += (s.P / 100 - s.X) * (1 - Math.exp(-dt / 25));
    s.H += (DECAY * s.P - s.H) * (1 - Math.exp(-dt / 35));     // el calor residual baja mucho más despacio

    // Calor generado: 93 % inmediato + calor residual (en régimen estable equivale a P)
    const heat = 8 * ((1 - DECAY) * s.P + s.H);
    const pe = pumpEff(s);
    const k = 0.025 * (pe + 10);
    let cooling;
    if (s.phase === 'operation') {
      cooling = k * (s.T - 30);
      if (s.dump > 0) cooling += 0.025 * 50 * (s.T - 30);
    } else {
      // Tras el SCRAM el circuito secundario solo enfría hasta ~180 °C; por debajo hace falta el RHR
      cooling = 0.6 * k * Math.max(0, s.T - 180);
      if (s.dump > 0) cooling += 2.4 * Math.max(0, s.T - 150);
      if (s.rhr === 'on') cooling += 0.025 * 80 * (s.T - 30);
    }
    s.T += ((heat - cooling) / 25) * dt;
    if (s.T < 30) s.T = 30;

    if (s.phase === 'operation' && inBand(s)) s.stable += dt;

    const warn = warnTemp(d);
    if (s.phase === 'operation') {
      if (s.T > warn && !s.warned) { s.warned = true; say(s, '¡Temperatura peligrosa! Sube la bomba, inserta barras o abre el desvío de vapor.', 'bad'); }
      if (s.T < warn - 15) s.warned = false;
    }

    if (s.T >= MELTDOWN_T) {
      s.status = 'meltdown';
    } else if (s.phase === 'operation') {
      s.lowTime = s.P < 3 ? s.lowTime + dt : 0;
      if (s.lowTime > 6) s.status = 'shutdown';
      else if (s.t >= d.duration) s.status = 'won';
    } else {
      s.coolT += dt;
      if (s.T <= COOL_TARGET_T) { s.status = 'cooled'; say(s, 'Parada fría alcanzada: el núcleo está seguro.', 'ok'); }
      else if (s.coolT >= COOL_LIMIT) s.status = 'hot';
    }
  }

  /* ---------- Señales: qué está pasando y qué comando conviene ----------
   * Cada señal: { id, level: bad|warn|ok|info, icon, title, text, cmd }
   * cmd es el comando recomendado (o null si solo hay que esperar). */
  function cues(s) {
    const out = [];
    if (s.status !== 'running') return out;
    const d = s.diff;
    if (s.phase === 'operation') {
      if (s.blackout > 0 && s.diesel === 'off')
        out.push({ id: 'apagon', level: 'bad', icon: '🔌', title: 'APAGÓN', text: 'Las bombas se quedaron sin energía.', cmd: 'diesel' });
      else if (s.blackout > 0 && s.diesel === 'starting')
        out.push({ id: 'diesel', level: 'info', icon: '🔋', title: 'Diésel arrancando…', text: 'Mientras tanto, inserta barras para bajar la potencia.', cmd: null });
      if (s.leak > 0)
        out.push({ id: 'fuga', level: 'warn', icon: '💧', title: 'FUGA', text: 'La bomba pierde fuerza.', cmd: 'aislar_fuga' });
      if (s.burst > 0)
        out.push({ id: 'pico', level: 'warn', icon: '⚡', title: 'PICO DE REACTIVIDAD', text: 'La potencia sube sola: frénala con boro.', cmd: 'boro 40' });
      if (s.T >= d.bandT[1] + 15 && dumpReady(s))
        out.push({ id: 'calor', level: 'bad', icon: '🌡', title: 'TEMPERATURA ALTA', text: 'Saca calor rápido por el condensador.', cmd: 'desviar_vapor' });
      if (s.boron > 15 && s.burst <= 0 && s.P < s.demand - 8)
        out.push({ id: 'diluir', level: 'info', icon: '🧪', title: 'Sobra boro', text: 'La potencia no llega a lo que pide la red: dilúyelo.', cmd: 'boro 0' });
    } else {
      if (s.T > RHR_MAX_T) {
        out.push({ id: 'enfriar', level: 'warn', icon: '♨', title: 'ENFRIAR EL NÚCLEO', text: 'Sube la bomba y abre el desvío hasta bajar de ' + RHR_MAX_T + ' °C.', cmd: dumpReady(s) ? 'desviar_vapor' : null });
      } else if (s.rhr === 'off') {
        out.push({ id: 'rhr', level: 'ok', icon: '✅', title: '¡YA PUEDES CONECTAR EL RHR!', text: 'Está por debajo de ' + RHR_MAX_T + ' °C.', cmd: noPower(s) ? 'diesel' : 'enfriar_residual' });
      } else if (s.rhr === 'starting') {
        out.push({ id: 'rhr-wait', level: 'info', icon: '⏳', title: 'RHR arrancando…', text: 'En unos segundos retirará el calor residual.', cmd: null });
      }
    }
    return out;
  }

  function summary(s) {
    const pct = s.t > 0 ? s.stable / s.t : 1;
    let stars = 0;
    if (s.status === 'won') stars = pct >= 0.8 ? 3 : pct >= 0.6 ? 2 : 1;
    if (s.status === 'cooled') stars = !s.justified ? 1 : s.coolT <= COOL_PAR ? 3 : 2;
    return { pct: pct, stars: stars };
  }

  const api = {
    DT: DT, MELTDOWN_T: MELTDOWN_T, DIFFICULTIES: DIFFICULTIES,
    BLACKOUT_TIME: BLACKOUT_TIME, DUMP_TIME: DUMP_TIME, DUMP_COOLDOWN: DUMP_COOLDOWN,
    COOL_TARGET_T: COOL_TARGET_T, COOL_LIMIT: COOL_LIMIT, COOL_PAR: COOL_PAR, RHR_MAX_T: RHR_MAX_T, RHR_START: RHR_START,
    create: create, step: step, setControls: setControls, scram: scram, pumpEff: pumpEff, noPower: noPower, dumpReady: dumpReady,
    setBoron: setBoron, startDump: startDump, isolateLeak: isolateLeak, startDiesel: startDiesel, startRhr: startRhr,
    inBand: inBand, summary: summary, warnTemp: warnTemp, cues: cues,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReactorSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
