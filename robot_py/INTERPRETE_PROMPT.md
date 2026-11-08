# Prompt para Claude Code — conectar el intérprete de Python al juego

Copia y pega lo siguiente a Claude Code, ejecutándolo **dentro de la carpeta del repo**
(`GameLab_prototypes`). Todo lo demás del juego ya está hecho y probado; solo falta el
intérprete.

---

**Tarea:** En el juego `robot_py/` (un robot que se programa en Python en el navegador), falta
conectar el intérprete. Usa **Skulpt** (Python en JavaScript) vendorizado localmente para que
funcione **sin internet** y abriendo `index.html` con doble clic (`file://`). No cambies
`sim.js`, `levels.js` ni `game.js`: su contrato ya está fijado. Solo debes:

1. **Vendorizar Skulpt** en `robot_py/lib/`:
   - Obtén `skulpt.min.js` y `skulpt-stdlib.js` (paquete npm `skulpt`, carpeta `dist/`, o el
     release de GitHub `skulpt/skulpt`). Cópialos a `robot_py/lib/skulpt.min.js` y
     `robot_py/lib/skulpt-stdlib.js`. No uses CDN: deben viajar dentro del repo.
   - Verifícalos: son archivos JS que definen el global `Sk`.

2. **Cargar Skulpt** añadiendo en `robot_py/index.html`, **antes** de `<script src="runner.js">`:
   ```html
   <script src="lib/skulpt.min.js"></script>
   <script src="lib/skulpt-stdlib.js"></script>
   ```

3. **Reescribir `robot_py/runner.js`** (ahora es un stub) para que cumpla EXACTAMENTE este
   contrato que `game.js` espera:

   ```
   window.RobotPy.run(source, api, hooks) -> Promise
   ```
   - `source`: string con el código Python del editor.
   - `api`: objeto con funciones JS que Python debe poder llamar por su nombre. Las ACCIONES
     devuelven None; los SENSORES devuelven bool:
       - Acciones: `avanzar`, `girar_izquierda`, `girar_derecha`, `romper`
         (y los alias `girar_izq`, `girar_der`).
       - Sensores (bool): `camino_libre`, `hay_roca`, `hay_pared`, `en_meta`.
   - `hooks.onOutput(text)`: envía aquí lo que imprima `print()`.
   - **Resolver** la promesa cuando el programa termina. Algunas funciones de `api` lanzan, al
     chocar o al llegar a la meta, una excepción de parada del robot: un objeto JS con
     `.robotStop === true`. **Eso NO es un error**: debes resolver igual (game.js ya lee el
     resultado de la jugada desde su propio estado).
   - **Rechazar** la promesa solo ante un error real de Python (SyntaxError, NameError,
     IndentationError, etc.) con `new Error(mensajeCortoYClaro)`.
   - Debes proteger contra bucles infinitos sin acciones (`while True: pass`): usa un límite de
     tiempo de Skulpt y, si salta, rechaza con un mensaje tipo "Tu programa tardó demasiado
     (¿un bucle que nunca termina?)". (Los bucles que SÍ llaman acciones ya los corta `sim.js`.)
   - Al terminar, **elimina la marca `stub`** (el stub actual la pone).

   Implementación de referencia (ajústala si tu versión de Skulpt lo requiere):
   ```js
   (function (root) {
     'use strict';
     const SENSORES = { camino_libre: 1, hay_roca: 1, hay_pared: 1, en_meta: 1 };

     function builtinRead(x) {
       if (Sk.builtinFiles === undefined || Sk.builtinFiles.files[x] === undefined)
         throw 'File not found: ' + x;
       return Sk.builtinFiles.files[x];
     }

     function run(source, api, hooks) {
       let stop = null;                     // lleva la señal de parada del robot a través de Skulpt

       // Registrar cada función de la API como builtin global de Python
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
         execLimit: 3000,                   // ms: corta while True: pass
       });

       return Sk.misceval.asyncToPromise(function () {
         return Sk.importMainWithBody('<stdin>', false, source, true);
       }).then(
         function () { return; },                         // terminó normal
         function (e) {
           if (stop) return;                              // el robot chocó/llegó: fin normal
           throw new Error(amistoso(e));                  // error real de Python
         }
       );
     }

     function amistoso(e) {
       try { return e.toString(); } catch (_) { return 'Error al ejecutar el programa.'; }
     }

     root.RobotPy = { run: run };           // sin `stub`
   })(typeof window !== 'undefined' ? window : globalThis);
   ```

4. **Probar**:
   - `node tools/test-robot_py.js` debe seguir pasando (no tocaste `sim.js`).
   - Abre `robot_py/index.html` y comprueba, al menos: el nivel 1 (`for i in range(6): avanzar()`)
     gana con 3 estrellas; el nivel 5 (`while not en_meta(): avanzar()`) gana; un error de
     sintaxis se muestra en la consola sin colgar la página; `print("hola")` aparece en la consola.

5. **No** añadas la tarjeta del menú todavía: hazlo (o pídemelo) una vez que el intérprete
   funcione, para no dejar un acceso roto en la feria.

---

> Nota de diseño (por si Skulpt diera problemas): `runner.js` es la única pieza acoplada al
> intérprete. Si en el futuro se cambia Skulpt por Brython u otro, basta con reescribir
> `runner.js` respetando el mismo contrato; el resto del juego no se entera.
