/* runner.js — PUENTE entre el juego y el intérprete de Python (Skulpt).
 *
 * Única pieza acoplada al intérprete: expone el contrato que game.js espera y que sim.js
 * alimenta. Si algún día se cambia Skulpt por otro intérprete, basta reescribir este archivo
 * respetando el mismo contrato; el resto del juego no se entera.
 *
 *   window.RobotPy.run(source, api, hooks) -> Promise
 *
 *   source : string  — el código Python del editor.
 *   api    : objeto de funciones JS que Python llamará por su nombre. Las ACCIONES
 *            (avanzar, girar_izquierda, girar_derecha, romper, y los alias girar_izq/girar_der)
 *            devuelven None; los SENSORES (camino_libre, hay_roca, hay_pared, en_meta) devuelven
 *            bool. Al chocar o llegar a la meta, una acción lanza una señal de parada del robot
 *            (objeto con .robotStop === true): NO es un error.
 *   hooks  : { onOutput(text) }  — recibe lo que imprima print().
 *
 *   RESUELVE cuando el programa termina (también si paró por la señal del robot: game.js lee el
 *   resultado de la jugada desde su propio estado). RECHAZA solo ante un error real de Python
 *   (SyntaxError, NameError, IndentationError…) con un Error de mensaje corto y claro.
 */
(function (root) {
  'use strict';

  // Qué funciones de la API son sensores (devuelven bool); el resto son acciones (devuelven None).
  const SENSORES = { camino_libre: 1, hay_roca: 1, hay_pared: 1, en_meta: 1 };

  function builtinRead(x) {
    if (typeof Sk === 'undefined' || Sk.builtinFiles === undefined || Sk.builtinFiles.files[x] === undefined)
      throw 'File not found: ' + x;
    return Sk.builtinFiles.files[x];
  }

  function run(source, api, hooks) {
    if (typeof Sk === 'undefined')
      return Promise.reject(new Error('No se pudo cargar el intérprete de Python (Skulpt).'));

    let stop = null;                     // lleva la señal de parada del robot a través de Skulpt

    // Registrar cada función de la API como builtin global de Python.
    Object.keys(api).forEach(function (name) {
      const esSensor = !!SENSORES[name];
      Sk.builtins[name] = new Sk.builtin.func(function () {
        try {
          const r = api[name]();
          if (esSensor) return r ? Sk.builtin.bool.true$ : Sk.builtin.bool.false$;
          return Sk.builtin.none.none$;
        } catch (e) {
          if (e && e.robotStop) { stop = e; throw new Sk.builtin.SystemExit('robot-stop'); }
          throw e;
        }
      });
    });

    Sk.configure({
      output: function (t) { if (hooks && hooks.onOutput) hooks.onOutput(t); },
      read: builtinRead,
      __future__: Sk.python3,
      execLimit: 3000,                   // ms: corta bucles sin acciones (while True: pass)
    });

    return Sk.misceval.asyncToPromise(function () {
      return Sk.importMainWithBody('<stdin>', false, source, true);
    }).then(
      function () { return; },           // terminó con normalidad
      function (e) {
        if (stop) return;                // el robot chocó o llegó a la meta: fin normal
        if (esLimiteDeTiempo(e))
          throw new Error('Tu programa tardó demasiado (¿un bucle que nunca termina?).');
        throw new Error(amistoso(e));    // error real de Python
      }
    );
  }

  // Skulpt lanza una excepción de tiempo al superar execLimit (TimeLimitError: "... exceeded run
  // time limit."); la reconocemos por su nombre/texto para dar un mensaje claro al estudiante.
  function esLimiteDeTiempo(e) {
    if (e && typeof Sk !== 'undefined' && Sk.builtin && Sk.builtin.TimeLimitError &&
        e instanceof Sk.builtin.TimeLimitError) return true;
    return /TimeLimitError|run time limit|execution time|timed out|too long/i.test(mensaje(e));
  }

  function mensaje(e) {
    if (!e) return '';
    if (typeof e === 'string') return e;
    try { return e.toString(); } catch (_) { return ''; }
  }

  // Texto corto y claro para el estudiante (Skulpt ya da mensajes legibles tipo "SyntaxError: ...").
  function amistoso(e) {
    const s = mensaje(e);
    return s || 'Error al ejecutar el programa.';
  }

  root.RobotPy = { run: run };           // sin la marca `stub`: el intérprete ya está conectado
})(typeof window !== 'undefined' ? window : globalThis);
