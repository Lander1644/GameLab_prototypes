/* Pruebas del reactor.  Uso:  node tools/test-reactor.js
 * Comprueba que:
 *  (1) con procedimientos (reaccionando a las señales) se gana en todas las dificultades,
 *      mientras que con solo las palancas o sin hacer nada se rinde peor,
 *  (2) cada procedimiento hace lo que dice (boro, desvío de vapor, aislar fuga, diésel, RHR),
 *  (3) el SCRAM no termina la partida: empieza el enfriamiento y solo el protocolo completo lo logra,
 *  (4) las señales (cues) aparecen cuando toca y recomiendan comandos válidos,
 *  (5) el analizador de comandos de la terminal y la guía del HTML son coherentes. */
'use strict';
const fs = require('fs');
const path = require('path');
const Sim = require('../reactor/sim.js');
const Cmd = require('../reactor/commands.js');

// Generador pseudoaleatorio con semilla para que las pruebas sean repetibles
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? 'OK   ' : 'FALLA') + '  ' + name + (extra ? '  (' + extra + ')' : ''));
  if (!ok) failures++;
}

// Juega una partida completa; la política se llama cada 0.3 s como lo haría una persona atenta
function play(key, seed, policy) {
  const rand = mulberry(seed);
  const s = Sim.create(key, rand);
  const st = { seen: {} };
  let acc = 0;
  while (s.status === 'running') {
    Sim.step(s, Sim.DT, rand);
    acc += Sim.DT;
    if (acc >= 0.3) { acc = 0; policy(s, st); }
  }
  return s;
}

// Las palancas: barras siguen a la demanda, bomba sigue a la temperatura
const levers = (s) => {
  const mid = (s.diff.bandT[0] + s.diff.bandT[1]) / 2;
  Sim.setControls(s, s.rods + 0.8 * (s.P - s.demand), s.pump + 0.35 * (s.T - mid));
};
// Operador completo: palancas + ejecuta el comando que recomienda cada señal tras un tiempo de reacción
function protocolOperator(delay) {
  return (s, st) => {
    if (s.phase === 'cooldown') Sim.setControls(s, null, 100); else levers(s);
    const cues = Sim.cues(s), ids = new Set(cues.map((c) => c.id));
    for (const id of Object.keys(st.seen)) if (!ids.has(id)) delete st.seen[id];
    for (const c of cues) {
      if (!(c.id in st.seen)) st.seen[c.id] = s.t;
      if (c.cmd && s.t - st.seen[c.id] >= delay) {
        const p = Cmd.parseLine(c.cmd);
        if (p.ok) Cmd.apply(Sim, s, p);
        st.seen[c.id] = s.t + 100;             // ya lo ejecutó: no repetir hasta que la señal se apague
      }
    }
  };
}
const idle = () => {};
const rodsOut = (s) => Sim.setControls(s, 0, null);

/* ---------- (1) Partidas completas ---------- */
const SEEDS = 30;
for (const key of Object.keys(Sim.DIFFICULTIES)) {
  const stat = (policy) => {
    let wins = 0, pct = 0;
    for (let seed = 1; seed <= SEEDS; seed++) { const s = play(key, seed, policy); if (s.status === 'won') wins++; pct += Sim.summary(s).pct; }
    return { wins: wins, pct: pct / SEEDS };
  };
  const pro = stat(protocolOperator(3)), lev = stat(levers), nada = stat(idle);
  check(key + ': con procedimientos (3 s de reacción) se gana siempre', pro.wins === SEEDS, pro.wins + '/' + SEEDS + ' · estable medio ' + (pro.pct * 100).toFixed(0) + ' %');
  check(key + ': con solo las palancas se pierden partidas (los apagones exigen el diésel)', lev.wins < SEEDS, lev.wins + '/' + SEEDS + ' ganadas');
  check(key + ': no hacer nada rinde mucho peor', nada.pct < pro.pct - 0.2, 'sin tocar ' + (nada.pct * 100).toFixed(0) + ' %');
  const melt = play(key, 1, rodsOut);
  check(key + ': sacar todas las barras funde el núcleo', melt.status === 'meltdown', 't=' + melt.t.toFixed(1) + ' s');
}

/* ---------- Escenarios controlados ---------- */
// Reactor estable a ~75 % de potencia, sin eventos aleatorios (se aplaza todo)
function hotStart(key) {
  const rand = mulberry(11);
  const s = Sim.create(key || 'normal', rand);
  s.nextDemand = s.nextLeak = s.nextBurst = s.nextBlackout = 1e9;
  Sim.setControls(s, 28, 60);
  for (let i = 0; i < 20 / Sim.DT; i++) Sim.step(s, Sim.DT, rand);
  return s;
}
function run(s, secs, every, fn) {
  const rand = mulberry(5);
  let acc = 0;
  for (let i = 0; i < secs / Sim.DT && s.status === 'running'; i++) {
    Sim.step(s, Sim.DT, rand); acc += Sim.DT;
    if (every && acc >= every) { acc = 0; fn && fn(s); }
  }
  return s;
}

/* ---------- (2) Cada procedimiento ---------- */
// Boro: baja la potencia despacio
(() => {
  const a = hotStart(), b = hotStart();
  Sim.setBoron(b, 50);
  run(a, 25); run(b, 25);
  check('boro: baja la potencia respecto a no inyectarlo', b.P < a.P - 8, 'P ' + a.P.toFixed(0) + ' → ' + b.P.toFixed(0));
  const r = Sim.setBoron(b, 0);
  const before = b.boron;
  run(b, 10);
  check('boro: «boro 0» lo diluye, pero despacio', r.ok && b.boron < before && b.boron > 0.1 * before, before.toFixed(0) + ' % → ' + b.boron.toFixed(0) + ' % en 10 s');
})();

// Desvío de vapor: enfría rápido, no cuenta como estable, tiene espera
(() => {
  const a = hotStart(), b = hotStart();
  a.T = b.T = 345;
  const r = Sim.startDump(b);
  run(a, 6); run(b, 6);
  check('desvío de vapor: enfría más que no hacer nada', r.ok && b.T < a.T - 15, 'T ' + a.T.toFixed(0) + ' → ' + b.T.toFixed(0));
  const c = hotStart(); Sim.startDump(c);
  const stable0 = c.stable; c.T = 300; c.P = c.demand = 50;
  run(c, 3);
  check('desvío de vapor: mientras está abierto no suma tiempo estable', c.stable === stable0);
  const d = hotStart(); Sim.startDump(d);
  check('desvío de vapor: no se puede abrir dos veces seguidas', !Sim.startDump(d).ok);
  run(d, Sim.DUMP_TIME + 1);
  check('desvío de vapor: se recarga antes de volver a usarse', !Sim.startDump(d).ok && d.dumpCd > 0);
  run(d, Sim.DUMP_COOLDOWN + 1);
  check('desvío de vapor: tras la espera vuelve a estar listo', Sim.startDump(d).ok);
})();

// Aislar fuga
(() => {
  const s = hotStart();
  check('aislar_fuga: sin fuga no hace nada', !Sim.isolateLeak(s).ok);
  s.leak = 10;
  const eff0 = Sim.pumpEff(s);
  const r = Sim.isolateLeak(s);
  check('aislar_fuga: corta la fuga y mejora la bomba', r.ok && s.leak === 0 && Sim.pumpEff(s) > eff0, eff0.toFixed(0) + ' % → ' + Sim.pumpEff(s).toFixed(0) + ' %');
  run(s, 9);
  check('aislar_fuga: el lazo vuelve a su eficiencia normal', s.isolated <= 0 && Sim.pumpEff(s) === s.pump);
})();

// Apagón y diésel
(() => {
  const noDiesel = hotStart(), withDiesel = hotStart();
  check('diesel: sin apagón no hace nada', !Sim.startDiesel(withDiesel).ok);
  noDiesel.blackout = withDiesel.blackout = Sim.BLACKOUT_TIME;
  check('apagón: la bomba se queda en circulación natural', Sim.pumpEff(noDiesel) <= noDiesel.diff.natural + 1e-9 && Sim.noPower(noDiesel));
  const r = Sim.startDiesel(withDiesel);
  const cut = (s) => Sim.setControls(s, 90, null);                 // además baja la potencia como haría un operador
  run(noDiesel, Sim.BLACKOUT_TIME, 0.3, () => {});                 // sin hacer nada
  run(withDiesel, Sim.BLACKOUT_TIME, 0.3, cut);
  check('apagón: sin diésel ni recorte de potencia el núcleo se funde', noDiesel.status === 'meltdown', 'T=' + noDiesel.T.toFixed(0));
  check('apagón: arrancando el diésel y bajando la potencia se sobrevive', r.ok && withDiesel.status === 'running' && withDiesel.T < 400, 'T=' + withDiesel.T.toFixed(0));
  check('apagón: con el diésel en marcha la bomba recupera su fuerza', (() => { const s = hotStart(); s.blackout = 20; Sim.startDiesel(s); run(s, s.diff.dieselTime + 0.5); return s.diesel === 'on' && Sim.pumpEff(s) === s.pump; })());
  check('apagón: la red exterior vuelve sola al terminar', (() => { const s = hotStart(); s.blackout = 2; run(s, 3); return s.blackout === 0 && !Sim.noPower(s); })());
})();

/* ---------- (3) SCRAM → fase de enfriamiento ---------- */
(() => {
  const s = hotStart();
  s.T = 380;                                  // situación peligrosa: el SCRAM está justificado
  Sim.scram(s);
  check('SCRAM: no termina la partida (empieza el enfriamiento)', s.status === 'running' && s.phase === 'cooldown');
  check('SCRAM: las barras quedan insertadas y no se pueden sacar', s.rods === 100 && (Sim.setControls(s, 0, null), s.rods === 100));
  check('SCRAM: se vuelve a llamar sin efecto', (() => { const t = s.coolT; Sim.scram(s); return s.coolT === t; })());
  check('SCRAM: boro y comandos de operación se rechazan', !Sim.setBoron(s, 30).ok);
  check('SCRAM: el RHR no se puede conectar por encima de 200 °C', !Sim.startRhr(s).ok);
  check('SCRAM: queda calor residual cuando la potencia ya cayó', (() => { const t = hotStart(); Sim.scram(t); run(t, 12); return t.P < 3 && t.H > 1; })());
})();

function coolDown(policy, justified) {
  const s = hotStart();
  if (justified) s.T = 380;
  Sim.scram(s);
  run(s, Sim.COOL_LIMIT + 5, 0.3, policy);
  return s;
}
(() => {
  const nada = coolDown(idle, true);
  const bomba = coolDown((s) => Sim.setControls(s, null, 100), true);
  const sinRhr = coolDown((s) => { Sim.setControls(s, null, 100); if (Sim.dumpReady(s)) Sim.startDump(s); }, true);
  const full = (s) => { Sim.setControls(s, null, 100); if (Sim.dumpReady(s)) Sim.startDump(s); if (s.T <= Sim.RHR_MAX_T) Sim.startRhr(s); };
  const ok = coolDown(full, true), sinMotivo = coolDown(full, false);
  check('enfriamiento: sin hacer nada se agota el tiempo (núcleo aún caliente)', nada.status === 'hot', 'T=' + nada.T.toFixed(0));
  check('enfriamiento: solo con la bomba tampoco basta', bomba.status === 'hot', 'T=' + bomba.T.toFixed(0));
  check('enfriamiento: bomba + desvío sin RHR no llega a parada fría', sinRhr.status === 'hot', 'T=' + sinRhr.T.toFixed(0));
  check('enfriamiento: protocolo completo (bomba + desvío + RHR) llega a parada fría', ok.status === 'cooled', 'en ' + ok.coolT.toFixed(0) + ' s');
  check('enfriamiento: apagado justificado y rápido da 3 estrellas', Sim.summary(ok).stars === 3, ok.coolT.toFixed(0) + ' s, par ' + Sim.COOL_PAR);
  check('enfriamiento: apagar sin motivo (todo estable) da solo 1 estrella', sinMotivo.status === 'cooled' && Sim.summary(sinMotivo).stars === 1);
  check('enfriamiento: el calor residual no funde un núcleo bien enfriado', ok.status !== 'meltdown');
})();

/* ---------- (4) Señales ---------- */
(() => {
  const ids = (s) => Sim.cues(s).map((c) => c.id);
  const quiet = hotStart(); quiet.T = 300; quiet.P = quiet.demand;
  check('señales: con todo tranquilo no hay ninguna', ids(quiet).length === 0, ids(quiet).join(','));
  const a = hotStart(); a.blackout = 20;
  check('señal apagon → «diesel»', Sim.cues(a).some((c) => c.id === 'apagon' && c.cmd === 'diesel'));
  Sim.startDiesel(a);
  check('señal: con el diésel arrancando pasa a informativa (sin comando)', Sim.cues(a).some((c) => c.id === 'diesel' && c.cmd === null) && !ids(a).includes('apagon'));
  const f = hotStart(); f.leak = 8;
  check('señal fuga → «aislar_fuga»', Sim.cues(f).some((c) => c.id === 'fuga' && c.cmd === 'aislar_fuga'));
  const b = hotStart(); b.burst = 5;
  check('señal pico → «boro 40»', Sim.cues(b).some((c) => c.id === 'pico' && c.cmd === 'boro 40'));
  const h = hotStart(); h.T = h.diff.bandT[1] + 20;
  check('señal calor → «desviar_vapor»', Sim.cues(h).some((c) => c.id === 'calor' && c.cmd === 'desviar_vapor'));
  Sim.startDump(h);
  check('señal calor: se apaga mientras el desvío ya está abierto', !ids(h).includes('calor'));
  const d = hotStart(); d.boron = d.boronTarget = 30; d.P = 30; d.demand = 60;
  check('señal diluir → «boro 0» cuando sobra boro', Sim.cues(d).some((c) => c.id === 'diluir' && c.cmd === 'boro 0'));
  const c1 = hotStart(); c1.T = 380; Sim.scram(c1);
  check('señal enfriar: tras el SCRAM por encima de 200 °C, pide enfriar', ids(c1).includes('enfriar') && !ids(c1).includes('rhr'));
  c1.T = 180;
  check('señal rhr → «enfriar_residual» al bajar de 200 °C', Sim.cues(c1).some((c) => c.id === 'rhr' && c.cmd === 'enfriar_residual'));
  Sim.startRhr(c1);
  check('señal: con el RHR arrancando es informativa', Sim.cues(c1).some((c) => c.id === 'rhr-wait' && c.cmd === null));
  // Todo comando que una señal recomienda es válido
  const cmds = [a, f, b, h, d, c1].concat([]).flatMap((s) => Sim.cues(s).map((c) => c.cmd).filter(Boolean)).concat(['diesel', 'aislar_fuga', 'boro 40', 'desviar_vapor', 'boro 0', 'enfriar_residual']);
  check('señales: todos los comandos recomendados se entienden en la terminal', cmds.every((c) => Cmd.parseLine(c).ok), cmds.length + ' comprobados');
})();

/* ---------- (5) Terminal ---------- */
const P = Cmd.parseLine;
check('comandos: «boro 40» se parsea', (() => { const p = P('boro 40'); return p.ok && p.cmd.name === 'boro' && p.value === 40; })());
check('comandos: acepta coma decimal y mayúsculas', P('BORO 12,5').ok && P('Desviar_Vapor').ok);
check('comandos: los alias funcionan (rhr, desvio, ps)', P('rhr').cmd.name === 'enfriar_residual' && P('desvio').cmd.name === 'desviar_vapor' && P('ps').cmd.name === 'procesos');
check('comandos: boro fuera de 0-100 falla', !P('boro 140').ok && !P('boro -3').ok);
check('comandos: falta el número en «boro» → error claro', !P('boro').ok);
check('comandos: los que no llevan número rechazan uno', !P('diesel 5').ok && !P('desviar_vapor 2').ok);
check('comandos: comando inventado falla', !P('volar 10').ok);
for (const old of ['barras 40', 'bomba 80', 'scram', 'esperar 3']) {
  const p = P(old);
  check('comandos: «' + old + '» ya no existe y explica dónde está', !p.ok && /ya no es un comando/.test(p.error), p.error);
}
check('comandos: hay exactamente 8 comandos de reactor + limpiar', Cmd.COMMANDS.length === 9 && Cmd.COMMANDS.filter((c) => c.kind === 'control').length === 5);
const multi = Cmd.parse('desviar_vapor; boro 30 # frena\nestado');
check('comandos: separa por ; y por salto de línea y quita comentarios', multi.length === 3 && multi.every((p) => p.ok));
check('comandos: descarta líneas vacías', Cmd.parse('\n\n  \n;;').length === 0);
check('comandos: «apply» ejecuta sobre la simulación', (() => { const s = hotStart(); s.leak = 5; return Cmd.apply(Sim, s, P('aislar_fuga')).ok && s.leak === 0; })());
check('comandos: «procesos» y «estado» devuelven texto', Cmd.processLines(hotStart()).length === 5 && /T=/.test(Cmd.stateLine(hotStart())));

/* ---------- La guía del HTML usa comandos y señales válidos ---------- */
(() => {
  const html = fs.readFileSync(path.join(__dirname, '../reactor/index.html'), 'utf8');
  const loads = [...html.matchAll(/data-cmds="([^"]*)"/g)].map((m) => m[1]);
  check('guía: tiene protocolos cargables', loads.length >= 6, loads.length + ' protocolos');
  check('guía: todos los protocolos se entienden en la terminal', loads.every((src) => { const p = Cmd.parse(src); return p.length > 0 && p.every((x) => x.ok); }), loads.join(' | '));
  const cueIds = [...html.matchAll(/data-cue="([^"]*)"/g)].map((m) => m[1]);
  const needed = ['apagon', 'fuga', 'pico', 'calor', 'diluir', 'enfriar', 'rhr'];
  check('guía: hay una tarjeta para cada señal que puede aparecer', needed.every((id) => cueIds.includes(id)), 'faltan: ' + needed.filter((id) => !cueIds.includes(id)).join(',') || 'ninguna');
})();

process.exit(failures ? 1 : 0);
