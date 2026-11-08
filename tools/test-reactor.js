/* Pruebas de la simulación del reactor.  Uso:  node tools/test-reactor.js
 * Comprueba que: (1) ignorar el juego pierde, (2) un "operador" automático gana
 * en todas las dificultades, (3) sacar todas las barras provoca fusión,
 * (4) el motor de comandos de la terminal de protocolo parsea y actúa bien. */
'use strict';
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

// Operador automático: reacciona cada 0.3 s como lo haría una persona atenta
function play(key, seed, policy) {
  const rand = mulberry(seed);
  const s = Sim.create(key, rand);
  let acc = 0;
  while (s.status === 'running') {
    Sim.step(s, Sim.DT, rand);
    acc += Sim.DT;
    if (acc >= 0.3) { acc = 0; policy(s); }
  }
  return s;
}

const operator = (s) => {
  const mid = (s.diff.bandT[0] + s.diff.bandT[1]) / 2;
  Sim.setControls(s, s.rods + 0.8 * (s.P - s.demand), s.pump + 0.35 * (s.T - mid));
};
const idle = () => {};
const rodsOut = (s) => Sim.setControls(s, 0, null);

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? 'OK   ' : 'FALLA') + '  ' + name + (extra ? '  (' + extra + ')' : ''));
  if (!ok) failures++;
}

for (const key of Object.keys(Sim.DIFFICULTIES)) {
  const wins = [], pcts = [];
  for (let seed = 1; seed <= 20; seed++) {
    const s = play(key, seed, operator);
    wins.push(s.status === 'won');
    pcts.push(Sim.summary(s).pct);
  }
  const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  check(key + ': el operador automático gana', wins.every(Boolean), 'estable medio ' + (avg * 100).toFixed(0) + ' %');

  const idleRuns = [];
  for (let seed = 1; seed <= 20; seed++) idleRuns.push(Sim.summary(play(key, seed, idle)).pct);
  const idleAvg = idleRuns.reduce((a, b) => a + b, 0) / idleRuns.length;
  check(key + ': no hacer nada rinde peor que jugar', idleAvg < avg - 0.1, 'sin tocar ' + (idleAvg * 100).toFixed(0) + ' %');

  const melt = play(key, 1, rodsOut);
  check(key + ': sacar todas las barras funde el núcleo', melt.status === 'meltdown', 't=' + melt.t.toFixed(1) + ' s');
}

/* ---------- Terminal de protocolo de emergencia (commands.js) ---------- */

// Parseo correcto y con alias / mayúsculas / coma decimal
check('comandos: «barras 40» se parsea', (() => { const p = Cmd.parseLine('barras 40'); return p.ok && p.cmd.name === 'barras' && p.value === 40; })());
check('comandos: alias «pump 80» = bomba', (() => { const p = Cmd.parseLine('pump 80'); return p.ok && p.cmd.name === 'bomba' && p.value === 80; })());
check('comandos: no distingue mayúsculas', Cmd.parseLine('SCRAM').ok && Cmd.parseLine('Barras 10').ok);
check('comandos: «scram» no lleva número', Cmd.parseLine('scram').ok && !Cmd.parseLine('scram 5').ok);
check('comandos: barras fuera de 0-100 falla', !Cmd.parseLine('barras 140').ok && !Cmd.parseLine('barras -3').ok);
check('comandos: falta el número → error claro', !Cmd.parseLine('barras').ok);
check('comandos: comando inventado falla', !Cmd.parseLine('volar 10').ok);
check('comandos: espera fuera de 1-60 falla', !Cmd.parseLine('esperar 0').ok && !Cmd.parseLine('esperar 90').ok);

// Varias líneas / ";" / comentarios
const multi = Cmd.parse('bomba 100; barras 55 # baja potencia\nesperar 4; estado');
check('comandos: separa por ; y por salto de línea', multi.length === 4 && multi.every((p) => p.ok));
check('comandos: ignora comentarios con #', Cmd.parse('barras 50 # esto no cuenta').length === 1);
check('comandos: descarta líneas vacías', Cmd.parse('\n\n  \n;;').length === 0);

// Efecto sobre la simulación
(() => {
  const s = Sim.create('normal');
  Cmd.apply(Sim, s, Cmd.parseLine('barras 70'));
  Cmd.apply(Sim, s, Cmd.parseLine('bomba 90'));
  check('comandos: «barras 70» mueve las barras', Math.round(s.rods) === 70, 'rods=' + Math.round(s.rods));
  check('comandos: «bomba 90» mueve la bomba', Math.round(s.pump) === 90, 'pump=' + Math.round(s.pump));
  const r = Cmd.apply(Sim, s, Cmd.parseLine('scram'));
  check('comandos: «scram» apaga el reactor', r.ok && s.status === 'scram' && s.rods === 100);
  const r2 = Cmd.apply(Sim, s, Cmd.parseLine('bomba 50'));
  check('comandos: con el reactor apagado los comandos no actúan', !r2.ok);
})();

// Los protocolos de la guía (los mismos del index.html) son válidos y ejecutables
const PROTOCOLOS = [
  'barras 30; esperar 3; estado',
  'barras 65; esperar 3; estado',
  'bomba 100; barras 55; esperar 4; estado',
  'barras 70; bomba 90; esperar 3; estado',
  'bomba 100; barras 85; esperar 5; estado',
  'scram',
];
PROTOCOLOS.forEach((src, i) => {
  const steps = Cmd.parse(src);
  check('protocolo ' + (i + 1) + ' se parsea sin errores', steps.length > 0 && steps.every((p) => p.ok), src);
});

process.exit(failures ? 1 : 0);
