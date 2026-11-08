/* Pruebas de la simulación de "Programa al robot (Python)".  Uso:  node tools/test-robot_py.js
 *
 * Como el control de flujo lo pone Python, aquí las soluciones de referencia se escriben
 * como funciones JavaScript que usan la MISMA API que verá el estudiante (a.avanzar(), etc.).
 * Se comprueba que: las reglas del mundo funcionan, cada nivel se resuelve con su referencia,
 * y los sensores responden bien. */
'use strict';
const Sim = require('../robot_py/sim.js');
const LEVELS = require('../robot_py/levels.js');

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? 'OK   ' : 'FALLA') + '  ' + name + (extra ? '  (' + extra + ')' : ''));
  if (!ok) failures++;
}

// Ejecuta una "solución" (función JS que usa la API) sobre un nivel y devuelve el resultado.
// Captura RobotStop (parada normal: win/crash/loop) para no tratarla como error.
function play(lv, solve) {
  const run = Sim.createRun(lv);
  const a = Sim.pythonApi(run);
  try { solve(a); } catch (e) { if (!e || !e.robotStop) throw e; }
  return Sim.result(run);
}

/* ---------- Reglas del mundo ---------- */
const demo = { name: 'demo', facing: 'E', map: ['#######', '#R.X.G#', '#######'] };
check('avanzar contra una roca choca', play(demo, (a) => { a.avanzar(); a.avanzar(); }).status === 'crash' &&
                                       play(demo, (a) => { a.avanzar(); a.avanzar(); }).reason === 'rock');
check('romper y avanzar permite llegar', play(demo, (a) => { a.avanzar(); a.romper(); a.avanzar(); a.avanzar(); a.avanzar(); }).status === 'win');
check('romper un muro de acero choca', play({ name: 'd2', facing: 'N', map: demo.map }, (a) => { a.romper(); }).reason === 'steel');
check('romper sin nada delante no rompe', play(demo, (a) => { a.romper(); }).status === 'incomplete');
check('un while sin avanzar se corta (tope de pasos)', play(demo, (a) => { while (!a.en_meta()) { a.girar_izquierda(); } }).status === 'loop');
check('sensor camino_libre detecta la roca', (() => { const r = Sim.createRun(demo); const a = Sim.pythonApi(r); a.avanzar(); return a.camino_libre() === false && a.hay_roca() === true; })());
check('alias girar_izq / girar_der existen', (() => { const a = Sim.pythonApi(Sim.createRun(demo)); return typeof a.girar_izq === 'function' && typeof a.girar_der === 'function'; })());

/* ---------- Soluciones de referencia de cada nivel ---------- */
const SOLUTIONS = [
  // 1 Primeros pasos
  (a) => { for (let i = 0; i < 6; i++) a.avanzar(); },
  // 2 Giros
  (a) => { for (let i = 0; i < 3; i++) a.avanzar(); a.girar_derecha(); a.avanzar(); a.avanzar(); },
  // 3 Una roca
  (a) => { a.avanzar(); a.romper(); a.avanzar(); a.girar_derecha(); a.avanzar(); a.avanzar(); },
  // 4 Muros de acero
  (a) => { a.avanzar(); a.avanzar(); a.girar_izquierda(); a.romper(); a.avanzar(); a.avanzar(); a.girar_izquierda(); a.avanzar(); a.avanzar(); },
  // 5 Mientras haya camino
  (a) => { while (!a.en_meta()) a.avanzar(); },
  // 6 Pasillo de rocas
  (a) => { while (!a.en_meta()) { a.romper(); a.avanzar(); } },
];

LEVELS.forEach((lv, i) => {
  const r = play(lv, SOLUTIONS[i]);
  check('Nivel ' + (i + 1) + ' «' + lv.name + '» se resuelve', r.status === 'win', 'estado ' + r.status);
});

// Las estrellas se calculan por líneas de código vs par
check('estrellas: igual al par = 3, hasta 1,5×par = 2, más = 1',
  Sim.starsFor(2, 2) === 3 && Sim.starsFor(3, 2) === 2 && Sim.starsFor(4, 2) === 1);

process.exit(failures ? 1 : 0);
