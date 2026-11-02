/* Valida los niveles de "Programa al robot" (bloques estilo Scratch).
 * Uso:  node tools/test-robot2.js          (rápido)
 *       node tools/test-robot2.js --deep   (busca soluciones más cortas hasta 6 bloques; tarda más)
 * Para cada nivel comprueba que:
 *   1. la solución de referencia gana, cabe en el límite de bloques y solo usa bloques permitidos,
 *   2. no existe una solución más corta que el "par" (búsqueda exhaustiva con los bloques permitidos).
 * Además prueba las reglas: romper, muros de acero, "mientras" infinito, etc.
 */
'use strict';
const Logic = require('../robot2/logic.js');
const LEVELS = require('../robot2/levels.js');

const DEEP = process.argv.includes('--deep');
const SEARCH_CAP = DEEP ? 6 : 5;
const FOR_NS = [2, 3, 4, 5, 6, 7, 8, 9];

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? 'OK   ' : 'FALLA') + '  ' + name + (extra ? '  (' + extra + ')' : ''));
  if (!ok) failures++;
}

/* ---------- Reglas del juego ---------- */
const demo = { name: 'demo', facing: 'E', map: ['#######', '#R.X.G#', '#######'] };
const P = Logic.parseProgram;
check('avanzar contra una roca choca', Logic.run(demo, P('2[F]')).status === 'crash' && Logic.run(demo, P('2[F]')).reason === 'rock');
check('romper y avanzar permite llegar', Logic.run(demo, P('F X 3[F]')).status === 'win');
check('romper un muro de acero falla', Logic.run(demo, P('L X')).reason === 'steel' || Logic.run({ name: 'd2', facing: 'N', map: demo.map }, P('X')).reason === 'steel');
check('romper sin nada delante no hace nada', Logic.run(demo, P('X F')).status === 'incomplete');
check('un «mientras» infinito se corta', Logic.run(demo, P('?notgoal[L]')).status === 'loop');
check('un «mientras» con cuerpo vacío se corta', Logic.run(demo, P('?notgoal[]')).status === 'loop');
check('"camino libre" se detiene ante una roca', Logic.run(demo, P('?free[F]')).trace.filter((t) => t.ev === 'move').length === 1);
check('contar bloques incluye los bucles', Logic.countBlocks(P('2[F ?free[F X]]')) === 5);

/* ---------- Búsqueda exhaustiva ---------- */
function* seqs(k, depth, allow) {
  if (k === 0) { yield []; return; }
  for (let size = 1; size <= k; size++) {
    for (const item of itemsOfSize(size, depth, allow)) {
      for (const rest of seqs(k - size, depth, allow)) yield [item, ...rest];
    }
  }
}
function* itemsOfSize(size, depth, allow) {
  if (size === 1) { for (const t of ['F', 'L', 'R', 'X']) if (allow.includes(t)) yield { t: t }; return; }
  if (depth >= Logic.MAX_DEPTH) return;
  for (const body of seqs(size - 1, depth + 1, allow)) {
    if (allow.includes('FOR')) for (const n of FOR_NS) yield { t: 'FOR', n: n, body: body };
    if (allow.includes('WHILE')) for (const c of Object.keys(Logic.CONDS)) yield { t: 'WHILE', cond: c, body: body };
  }
}
function usedTypes(nodes, set) { for (const n of nodes) { set.add(n.t); if (n.body) usedTypes(n.body, set); } return set; }

LEVELS.forEach((lv, i) => {
  const label = 'Nivel ' + (i + 1) + ' «' + lv.name + '»';
  let program;
  try { program = Logic.parseProgram(lv.solution); } catch (e) { check(label + ': solución legible', false, e.message); return; }
  const blocks = Logic.countBlocks(program);
  const res = Logic.run(lv, program);
  check(label + ': la solución gana', res.status === 'win', 'estado ' + res.status);
  check(label + ': cabe en el límite', blocks <= lv.max, blocks + ' de ' + lv.max + ' bloques');
  const bad = [...usedTypes(program, new Set())].filter((t) => !lv.allow.includes(t));
  check(label + ': usa solo bloques permitidos', bad.length === 0, bad.join(','));

  if (blocks - 1 < 1) { check(label + ': no existe solución más corta que el par', true, 'par ' + blocks); return; }
  const cap = Math.min(blocks - 1, SEARCH_CAP);
  let shorter = null;
  for (let k = 1; k <= cap && !shorter; k++) {
    for (const p of seqs(k, 0, lv.allow)) {
      if (Logic.run(lv, p).status === 'win') { shorter = { k: k, p: p }; break; }
    }
  }
  if (shorter) check(label + ': no existe solución más corta que el par', false, 'hay una de ' + shorter.k + ' bloques: ' + JSON.stringify(shorter.p));
  else if (blocks - 1 > SEARCH_CAP) console.log('      (par de ' + blocks + ' bloques: se comprobó que no hay solución de hasta ' + SEARCH_CAP + ' bloques)');
  else check(label + ': no existe solución más corta que el par', true, 'par ' + blocks);
});

process.exit(failures ? 1 : 0);
