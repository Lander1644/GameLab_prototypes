/* Pruebas de la simulación de "Programa al robot (Python)".  Uso:  node tools/test-robot_py.js
 *
 * Como el control de flujo lo pone Python, cada solución de referencia se guarda dos veces:
 *   py: el programa Python que escribiría un estudiante (su nº de líneas debe ser el "par")
 *   js: la misma lógica en JavaScript, usando la MISMA API (a.avanzar(), a.hay_roca()…)
 * Se comprueba que: las reglas del mundo funcionan, cada nivel se resuelve con su referencia,
 * el par coincide con la referencia, y las estrategias ingenuas FALLAN donde el nivel exige if. */
'use strict';
const Sim = require('../robot_py/sim.js');
const LEVELS = require('../robot_py/levels.js');

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? 'OK   ' : 'FALLA') + '  ' + name + (extra ? '  (' + extra + ')' : ''));
  if (!ok) failures++;
}

// Ejecuta una "solución" JS sobre un nivel. RobotStop (win/crash/loop) es parada normal.
function play(lv, solve) {
  const run = Sim.createRun(lv);
  const a = Sim.pythonApi(run);
  try { solve(a); } catch (e) { if (!e || !e.robotStop) throw e; }
  return Sim.result(run);
}

// Mismo criterio que game.js para contar líneas de código
const codeLines = (src) => src.split('\n').map((l) => l.replace(/#.*/, '').trim()).filter((l) => l.length > 0).length;

/* ---------- Reglas del mundo ---------- */
const demo = { name: 'demo', facing: 'E', map: ['#######', '#R.X.G#', '#######'] };
check('avanzar contra una roca choca', play(demo, (a) => { a.avanzar(); a.avanzar(); }).reason === 'rock');
check('romper y avanzar permite llegar', play(demo, (a) => { a.avanzar(); a.romper(); a.avanzar(); a.avanzar(); a.avanzar(); }).status === 'win');
check('romper un muro de acero choca', play({ name: 'd2', facing: 'N', map: demo.map }, (a) => { a.romper(); }).reason === 'steel');
check('romper sin nada delante no rompe', play(demo, (a) => { a.romper(); }).status === 'incomplete');
check('un while sin avanzar se corta (tope de pasos)', play(demo, (a) => { while (!a.en_meta()) { a.girar_izquierda(); } }).status === 'loop');
check('sensores ven roca delante', (() => { const a = Sim.pythonApi(Sim.createRun(demo)); a.avanzar(); return !a.camino_libre() && a.hay_roca() && !a.hay_pared(); })());
check('alias girar_izq / girar_der existen', (() => { const a = Sim.pythonApi(Sim.createRun(demo)); return typeof a.girar_izq === 'function' && typeof a.girar_der === 'function'; })());

/* ---------- Soluciones de referencia ---------- */
const REF = [
  { // 1 Primeros pasos
    py: 'for i in range(6):\n    avanzar()',
    js: (a) => { for (let i = 0; i < 6; i++) a.avanzar(); },
  },
  { // 2 Giros
    py: 'for i in range(3):\n    avanzar()\ngirar_derecha()\nfor i in range(2):\n    avanzar()',
    js: (a) => { for (let i = 0; i < 3; i++) a.avanzar(); a.girar_derecha(); for (let i = 0; i < 2; i++) a.avanzar(); },
  },
  { // 3 Sigue el pasillo (if / else)
    py: 'while not en_meta():\n    if hay_pared():\n        girar_derecha()\n    else:\n        avanzar()',
    js: (a) => { while (!a.en_meta()) { if (a.hay_pared()) a.girar_derecha(); else a.avanzar(); } },
  },
  { // 4 Rocas y esquinas (if / elif / else)
    py: 'while not en_meta():\n    if hay_roca():\n        romper()\n    elif hay_pared():\n        girar_derecha()\n    else:\n        avanzar()',
    js: (a) => { while (!a.en_meta()) { if (a.hay_roca()) a.romper(); else if (a.hay_pared()) a.girar_derecha(); else a.avanzar(); } },
  },
  { // 5 Izquierda o derecha (if anidado)
    py: 'while not en_meta():\n    if camino_libre():\n        avanzar()\n    else:\n        girar_derecha()\n        if hay_pared():\n            girar_izquierda()\n            girar_izquierda()',
    js: (a) => { while (!a.en_meta()) { if (a.camino_libre()) a.avanzar(); else { a.girar_derecha(); if (a.hay_pared()) { a.girar_izquierda(); a.girar_izquierda(); } } } },
  },
  { // 6 La fábrica (todo junto)
    py: 'while not en_meta():\n    if hay_roca():\n        romper()\n    elif camino_libre():\n        avanzar()\n    else:\n        girar_derecha()\n        if hay_pared():\n            girar_izquierda()\n            girar_izquierda()',
    js: (a) => { while (!a.en_meta()) { if (a.hay_roca()) a.romper(); else if (a.camino_libre()) a.avanzar(); else { a.girar_derecha(); if (a.hay_pared()) { a.girar_izquierda(); a.girar_izquierda(); } } } },
  },
];

check('hay una referencia por nivel', REF.length === LEVELS.length, REF.length + ' de ' + LEVELS.length);

LEVELS.forEach((lv, i) => {
  const label = 'Nivel ' + (i + 1) + ' «' + lv.name + '»';
  const r = play(lv, REF[i].js);
  check(label + ': la referencia gana', r.status === 'win', 'estado ' + r.status);
  check(label + ': el par coincide con la referencia', codeLines(REF[i].py) === lv.par, codeLines(REF[i].py) + ' líneas, par ' + lv.par);
  check(label + ': el editor empieza sin código', !('start' in lv));
});

/* ---------- Las estrategias ingenuas deben fallar donde el nivel exige if ---------- */
const NAIVE = {
  'romper y avanzar siempre': (a) => { while (!a.en_meta()) { a.romper(); a.avanzar(); } },
  'si hay pared, girar a la derecha': (a) => { while (!a.en_meta()) { if (a.hay_pared()) a.girar_derecha(); else a.avanzar(); } },
  'roca / pared→derecha / avanzar': (a) => { while (!a.en_meta()) { if (a.hay_roca()) a.romper(); else if (a.hay_pared()) a.girar_derecha(); else a.avanzar(); } },
};
const mustFail = [
  [3, 'romper y avanzar siempre'],                // 4: romper frente al acero de la esquina
  [3, 'si hay pared, girar a la derecha'],        // 4: choca con la primera roca
  [4, 'si hay pared, girar a la derecha'],        // 5: gira siempre a la derecha → da vueltas
  [5, 'roca / pared→derecha / avanzar'],          // 6: necesita elegir lado
  [5, 'romper y avanzar siempre'],
];
mustFail.forEach(([i, k]) => {
  const r = play(LEVELS[i], NAIVE[k]);
  check('Nivel ' + (i + 1) + ': «' + k + '» NO basta', r.status !== 'win', 'estado ' + r.status + (r.reason ? ' / ' + r.reason : ''));
});

check('estrellas: igual al par = 3, hasta 1,5×par = 2, más = 1',
  Sim.starsFor(2, 2) === 3 && Sim.starsFor(3, 2) === 2 && Sim.starsFor(4, 2) === 1);

process.exit(failures ? 1 : 0);
