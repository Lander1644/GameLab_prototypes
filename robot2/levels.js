/* Niveles de "Programa al robot" (bloques estilo Scratch).
 *
 * Mapa:  #  muro de acero (NO se rompe)    X  roca (se rompe con «Romper»)    .  piso
 *        R  robot (inicio)    G  meta    B  batería (hay que recogerlas todas)
 * facing:   hacia dónde mira el robot al empezar (N, E, S, W)
 * allow:    bloques disponibles en el nivel (F, L, R, X, FOR, WHILE)
 * max:      máximo de bloques (cuentan también los bucles)
 * solution: solución de referencia (par = sus bloques). Sintaxis:
 *           F L R X   |   4[F] = repetir 4 veces   |   ?free[F] = mientras camino libre
 *           condiciones: free, rock, wall, notgoal
 * Para agregar un nivel: añade un objeto aquí y corre  node tools/test-robot2.js
 */
(function (root) {
  'use strict';

  const ALL = ['F', 'L', 'R', 'X', 'FOR', 'WHILE'];

  const LEVELS = [
    {
      name: 'Primeros pasos',
      hint: 'Arrastra los bloques al programa. Tienes pocos bloques: usa «repetir» para no escribir lo mismo muchas veces.',
      learn: 'Un bucle «repetir» (for) ejecuta las mismas instrucciones un número fijo de veces.',
      facing: 'E', max: 3, allow: ['F', 'FOR'],
      solution: '6[F]',
      map: [
        '#########',
        '#R.....G#',
        '#########',
      ],
    },
    {
      name: 'Giros',
      hint: 'Ahora puedes girar. Recuerda: el robot gira sobre su sitio y luego avanza hacia donde mira.',
      learn: 'El orden importa: girar antes o después de avanzar lleva al robot a lugares distintos.',
      facing: 'E', max: 6, allow: ['F', 'L', 'R', 'FOR'],
      solution: '2[3[F] R]',
      map: [
        '######',
        '#R...#',
        '####.#',
        '####G#',
        '######',
      ],
    },
    {
      name: 'Una roca en el camino',
      hint: 'Las rocas 🪨 bloquean el paso. Usa «Romper» cuando tengas una roca justo enfrente.',
      learn: 'Romper elimina la roca que hay delante. Si no hay nada que romper, el bloque no hace nada.',
      facing: 'E', max: 8, allow: ['F', 'L', 'R', 'X', 'FOR'],
      solution: '2[F X F R]',
      map: [
        '#####',
        '#R.X#',
        '###.#',
        '###G#',
        '#####',
      ],
    },
    {
      name: 'Muros de acero',
      hint: 'Los muros grises son de acero: ¡esos no se pueden romper! Busca el camino donde solo haya rocas.',
      learn: 'Un buen programador conoce los límites: unos obstáculos se rompen y otros hay que rodearlos.',
      facing: 'S', max: 11, allow: ['F', 'L', 'R', 'X', 'FOR'],
      solution: '3[F F L X]',
      map: [
        '#####',
        '#R#G#',
        '#.#.#',
        '#.X.#',
        '#####',
      ],
    },
    {
      name: 'Mientras haya camino',
      hint: 'El pasillo es muy largo para «repetir» (máximo 9). Prueba «mientras» con la condición «camino libre».',
      learn: 'Un bucle «mientras» (while) repite hasta que la condición deja de cumplirse: no necesitas contar los pasos.',
      facing: 'E', max: 3, allow: ALL,
      solution: '?free[F]',
      map: [
        '##############',
        '#R..........G#',
        '##############',
      ],
    },
    {
      name: 'Pasillo de rocas',
      hint: 'Hay rocas por todas partes. Combina «mientras no llegué a la meta» con «romper» y «avanzar».',
      learn: 'Si un bloque no hace nada cuando no hace falta (como Romper), puedes ponerlo siempre dentro del bucle.',
      facing: 'E', max: 4, allow: ALL,
      solution: '?notgoal[X F]',
      map: [
        '##############',
        '#R.X..XX.X..G#',
        '##############',
      ],
    },
    {
      name: 'Escalera de rocas',
      hint: 'Cada escalón tiene una roca. Busca el patrón que se repite.',
      learn: 'Encontrar el patrón que se repite es la clave para escribir programas cortos.',
      facing: 'E', max: 8, allow: ALL,
      solution: '3[X F R F L]',
      map: [
        '#######',
        '#RX####',
        '##.X###',
        '###.X##',
        '####G##',
        '#######',
      ],
    },
    {
      name: 'La fábrica',
      hint: 'Recoge las dos baterías ⚡ y llega a la meta. Hay rocas, muros y un recorrido en serpiente: combina bucles dentro de bucles.',
      learn: 'Dividir un problema grande en partes que se repiten es la base de la programación.',
      facing: 'E', max: 15, allow: ALL,
      solution: '2[2[X F] R] 2[2[X F] L] 2[X F]',
      map: [
        '#####',
        '#RX.#',
        '###.#',
        '#B.X#',
        '#.###',
        '#.BG#',
        '#####',
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.ROBOT2_LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
