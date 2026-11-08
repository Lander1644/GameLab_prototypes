/* Niveles de "Programa al robot (Python)".
 *
 * Mapa:  #  muro de acero (NO se rompe)   X  roca (se rompe)   .  piso
 *        R  robot (inicio)   G  meta   B  batería (hay que recogerlas todas antes de la meta)
 * facing: N, E, S, W   (hacia dónde mira el robot al empezar)
 * goal:   qué hay que lograr (se muestra bajo el nombre del nivel)
 * learn:  la idea de programación que enseña el nivel
 * hint:   pista que se muestra solo si el estudiante la pide (NO es la solución)
 * par:    nº de líneas de código de la solución de referencia (para las estrellas:
 *         3★ = igual o menos; 2★ = hasta 1,5×; 1★ = el resto). Solo cuentan las líneas con
 *         código (se ignoran las vacías y los comentarios).
 *
 * El editor empieza vacío en todos los niveles: el estudiante escribe su propio programa.
 * Las soluciones de referencia están en tools/test-robot_py.js (no en el juego).
 * Para agregar un nivel: añade un objeto aquí y su solución en el test, y corre
 *   node tools/test-robot_py.js
 */
(function (root) {
  'use strict';

  const LEVELS = [
    {
      name: 'Primeros pasos',
      goal: 'Lleva el robot hasta la meta ★.',
      learn: 'avanzar() da un paso adelante. Un bucle for repite instrucciones un número fijo de veces.',
      hint: 'Cuenta cuántas casillas hay hasta la meta. for i in range(n): repite lo que esté sangrado debajo n veces.',
      facing: 'E', par: 2,
      map: [
        '#########',
        '#R.....G#',
        '#########',
      ],
    },
    {
      name: 'Giros',
      goal: 'Dobla la esquina para llegar a la meta.',
      learn: 'girar_derecha() y girar_izquierda() hacen girar al robot sobre su sitio; después avanza hacia donde mira.',
      hint: 'Avanza hasta la esquina, gira hacia la meta y vuelve a avanzar. Puedes usar dos bucles for.',
      facing: 'E', par: 5,
      map: [
        '######',
        '#R...#',
        '####.#',
        '####G#',
        '######',
      ],
    },
    {
      name: 'Sigue el pasillo',
      goal: 'Recorre la espiral sin contar los pasos.',
      learn: 'if / else decide qué hacer según lo que el robot detecta: si hay pared, gira; si no, avanza.',
      hint: 'Todas las esquinas giran a la derecha. Dentro de un while not en_meta(): pregunta con if hay_pared(): y usa else para avanzar.',
      facing: 'E', par: 5,
      map: [
        '########',
        '#R.....#',
        '######.#',
        '#...G#.#',
        '#.####.#',
        '#......#',
        '########',
      ],
    },
    {
      name: 'Rocas y esquinas',
      goal: 'Rompe las rocas, pero cuidado: las esquinas son de acero.',
      learn: 'elif permite elegir entre varias opciones: roca, pared o camino libre. Solo se ejecuta la primera que se cumple.',
      hint: 'Si llamas romper() frente al acero, el robot choca. Pregunta primero con if hay_roca():, luego elif hay_pared(): y por último else.',
      facing: 'E', par: 7,
      map: [
        '##########',
        '#R.X.X...#',
        '########.#',
        '#..X..G#X#',
        '#.######.#',
        '#..X..X..#',
        '##########',
      ],
    },
    {
      name: 'Izquierda o derecha',
      goal: 'Ahora el pasillo gira hacia ambos lados.',
      learn: 'Un if puede ir dentro de otro (if anidado). El robot solo ve hacia delante: para elegir lado, gira y vuelve a mirar.',
      hint: 'Si el camino está libre, avanza. Si no, gira a la derecha; y si ahí también hay pared, date la vuelta (girar_izquierda() dos veces).',
      facing: 'E', par: 8,
      map: [
        '#########',
        '#R......#',
        '#######.#',
        '#.......#',
        '#.#######',
        '#......G#',
        '#########',
      ],
    },
    {
      name: 'La fábrica',
      goal: 'Recoge las dos baterías ⚡ y llega a la meta.',
      learn: 'Combinar if, elif, else y un if anidado dentro de un while resuelve recorridos que nunca habías visto.',
      hint: 'Junta lo de los dos niveles anteriores: primero revisa si hay roca, luego si el camino está libre y, si no, decide hacia qué lado girar.',
      facing: 'E', par: 10,
      map: [
        '##########',
        '#R.X..B..#',
        '########.#',
        '#..X.....#',
        '#.########',
        '#...X.B..#',
        '########.#',
        '#G..X....#',
        '##########',
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.ROBOT_PY_LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
