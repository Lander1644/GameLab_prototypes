/* Motor de comandos del "protocolo de emergencia" del reactor. Sin DOM: se prueba con Node.
 *   node tools/test-reactor.js   (incluye pruebas de estos comandos)
 *
 * La terminal del juego acepta una o varias líneas; cada línea es un comando:
 *   barras <0-100>   ajusta las barras de control (más = menos potencia)
 *   bomba  <0-100>   ajusta la bomba de refrigerante (más = más enfriamiento)
 *   esperar <seg>    pausa antes del siguiente comando (para encadenar pasos de un protocolo)
 *   scram            apagado de emergencia (inserta todas las barras)
 *   estado           muestra las lecturas actuales
 *   ayuda / limpiar  ayudas de la propia consola
 *
 * Se puede separar varios comandos por salto de línea o por ";". Lo que vaya tras "#" es comentario.
 * La lógica (parseo y efecto sobre el reactor) vive aquí; el tiempo de "esperar" y el dibujo, en game.js.
 */
(function (root) {
  'use strict';

  // kind: 'control' actúa sobre el reactor · 'wait' solo pausa la cola · 'meta' lo resuelve la consola
  const COMMANDS = [
    { name: 'barras',  aliases: ['rods', 'varillas', 'control'],   arg: 'pct',  kind: 'control', help: 'barras <0-100> — inserta las barras de control a ese %. Más barras = menos potencia.' },
    { name: 'bomba',   aliases: ['pump', 'refrigerante', 'agua'],  arg: 'pct',  kind: 'control', help: 'bomba <0-100> — ajusta la bomba de refrigerante. Más bomba = más enfriamiento.' },
    { name: 'esperar', aliases: ['espera', 'wait'],                arg: 'secs', kind: 'wait',    help: 'esperar <1-60> — pausa esos segundos antes del siguiente comando.' },
    { name: 'scram',   aliases: ['apagar', 'emergencia'],          arg: null,   kind: 'control', help: 'scram — apagado de emergencia: inserta todas las barras de golpe.' },
    { name: 'estado',  aliases: ['status', 'leer', 'lecturas'],    arg: null,   kind: 'meta',    help: 'estado — muestra temperatura, potencia, demanda y controles.' },
    { name: 'ayuda',   aliases: ['help', 'comandos', '?'],         arg: null,   kind: 'meta',    help: 'ayuda — lista los comandos disponibles.' },
    { name: 'limpiar', aliases: ['clear', 'cls', 'borrar'],        arg: null,   kind: 'meta',    help: 'limpiar — borra lo escrito en la consola.' },
  ];

  const byName = {};
  for (const c of COMMANDS) { byName[c.name] = c; for (const a of c.aliases) byName[a] = c; }

  function resolve(word) {
    return word ? (byName[word.toLowerCase()] || null) : null;
  }

  // Divide el texto en líneas (por salto de línea o ";"), quita comentarios y espacios, descarta vacías
  function splitLines(text) {
    return String(text).split(/[\n;]+/).map((l) => l.replace(/#.*/, '').trim()).filter((l) => l.length > 0);
  }

  // Analiza UNA línea → { ok:true, cmd, value, raw } | { ok:false, error, raw }
  function parseLine(line) {
    const raw = String(line).trim();
    const parts = raw.split(/\s+/);
    const cmd = resolve(parts[0]);
    if (!cmd) return { ok: false, raw: raw, error: 'No conozco «' + (parts[0] || '') + '». Escribe «ayuda» para ver los comandos.' };
    if (cmd.arg === null) {
      if (parts.length > 1) return { ok: false, raw: raw, error: 'El comando «' + cmd.name + '» no lleva número.' };
      return { ok: true, raw: raw, cmd: cmd, value: null };
    }
    if (parts.length < 2) return { ok: false, raw: raw, error: 'Falta el número. Ejemplo: ' + cmd.help.split(' — ')[0].trim() };
    const n = Number(parts[1].replace(',', '.'));
    if (!isFinite(n)) return { ok: false, raw: raw, error: '«' + parts[1] + '» no es un número.' };
    if (cmd.arg === 'pct' && (n < 0 || n > 100)) return { ok: false, raw: raw, error: 'Usa un valor entre 0 y 100.' };
    if (cmd.arg === 'secs' && (n <= 0 || n > 60)) return { ok: false, raw: raw, error: 'Usa una espera entre 1 y 60 segundos.' };
    return { ok: true, raw: raw, cmd: cmd, value: n };
  }

  // Analiza un texto completo → lista de resultados de parseLine
  function parse(text) { return splitLines(text).map(parseLine); }

  // Aplica un comando de control al reactor. Sim = API de sim.js. Devuelve { ok, text }.
  function apply(Sim, sim, step) {
    const c = step.cmd;
    if (sim.status !== 'running') return { ok: false, text: 'El reactor no está en marcha; no puedo ejecutar «' + c.name + '».' };
    switch (c.name) {
      case 'barras': Sim.setControls(sim, step.value, null); return { ok: true, text: 'Barras de control → ' + Math.round(sim.rods) + ' %.' };
      case 'bomba':  Sim.setControls(sim, null, step.value); return { ok: true, text: 'Bomba de refrigerante → ' + Math.round(sim.pump) + ' %.' };
      case 'scram':  Sim.scram(sim); return { ok: true, text: 'SCRAM ejecutado: todas las barras insertadas.' };
      default:       return { ok: false, text: 'El comando «' + c.name + '» no actúa sobre el reactor.' };
    }
  }

  // Línea de lecturas para el comando "estado"
  function stateLine(sim) {
    return 'T=' + Math.round(sim.T) + ' °C   P=' + Math.round(sim.P) + ' %   la red pide ' + sim.demand +
           ' %   barras=' + Math.round(sim.rods) + ' %   bomba=' + Math.round(sim.pump) + ' %';
  }

  const api = { COMMANDS: COMMANDS, resolve: resolve, splitLines: splitLines, parseLine: parseLine, parse: parse, apply: apply, stateLine: stateLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReactorCommands = api;
})(typeof window !== 'undefined' ? window : globalThis);
