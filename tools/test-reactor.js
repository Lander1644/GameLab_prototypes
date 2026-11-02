/* Pruebas de la simulación del reactor.  Uso:  node tools/test-reactor.js
 * Comprueba que: (1) ignorar el juego pierde, (2) un "operador" automático gana
 * en todas las dificultades, (3) sacar todas las barras provoca fusión. */
'use strict';
const Sim = require('../reactor/sim.js');

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

process.exit(failures ? 1 : 0);
