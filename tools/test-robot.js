/* Valida los niveles de "Programa al robot".  Uso:  node tools/test-robot.js
 * Para cada nivel comprueba que:
 *   1. la solución de referencia gana y cabe en el límite de bloques (max),
 *   2. ninguna solución más corta existe (búsqueda exhaustiva hasta 9 bloques),
 *      así que el "par" (bloques de la solución) es realmente el mínimo.
 */
'use strict';
const Logic = require('../robot/logic.js');
const LEVELS = require('../robot/levels.js');

// Todas las secuencias con exactamente k bloques (los "Repetir" cuentan 1 + su contenido).
// Se generan con generadores (sin guardarlas en memoria) porque son millones.
function* seqs(k, depth) {
  if (k === 0) { yield []; return; }
  for (let size = 1; size <= k; size++) {
    for (const item of itemsOfSize(size, depth)) {
      for (const rest of seqs(k - size, depth)) yield [item, ...rest];
    }
  }
}
function* itemsOfSize(size, depth) {
  if (size === 1) { yield { t: 'F' }; yield { t: 'L' }; yield { t: 'R' }; return; }
  if (depth >= Logic.MAX_DEPTH) return;
  for (const body of seqs(size - 1, depth + 1)) {
    for (const n of Logic.REP_OPTIONS) yield { t: 'REP', n: n, body: body };
  }
}

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? 'OK   ' : 'FALLA') + '  ' + name + (extra ? '  (' + extra + ')' : ''));
  if (!ok) failures++;
}

LEVELS.forEach((lv, i) => {
  const label = 'Nivel ' + (i + 1) + ' «' + lv.name + '»';
  let program;
  try { program = Logic.parseProgram(lv.solution); } catch (e) { check(label + ': solución legible', false, e.message); return; }
  const blocks = Logic.countBlocks(program);
  const res = Logic.run(lv, program);
  check(label + ': la solución gana', res.status === 'win', 'estado ' + res.status);
  check(label + ': cabe en el límite', blocks <= lv.max, blocks + ' de ' + lv.max + ' bloques');

  let shorter = null;
  const cap = Math.min(blocks - 1, 9);
  for (let k = 1; k <= cap && !shorter; k++) {
    for (const p of seqs(k, 0)) {
      if (Logic.run(lv, p).status === 'win') { shorter = k; console.log('      más corta:', JSON.stringify(p)); break; }
    }
  }
  if (blocks - 1 > 9) console.log('      (par de ' + blocks + ' bloques: no se busca más corto porque la búsqueda exhaustiva se limita a 9)');
  else check(label + ': no existe solución más corta que el par', !shorter, shorter ? 'hay una de ' + shorter + ' bloques' : 'par ' + blocks);
});

process.exit(failures ? 1 : 0);
