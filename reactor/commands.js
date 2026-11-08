/* Motor de comandos del "protocolo de emergencia" del reactor. Sin DOM: se prueba con Node.
 *   node tools/test-reactor.js   (incluye pruebas de estos comandos)
 *
 * Las barras y la bomba se mueven con las palancas. La terminal es para los PROCEDIMIENTOS: cada
 * comando arranca un proceso que corre en paralelo mientras sigues manejando las palancas.
 *
 *   boro <0-100>        inyecta (o diluye) boro: frena la reacción despacio
 *   desviar_vapor       abre el desvío de vapor: enfría rápido, pero esa energía no llega a la red
 *   aislar_fuga         cierra el lazo que pierde agua
 *   diesel              arranca el generador de emergencia (durante un apagón)
 *   enfriar_residual    conecta el RHR (solo tras un SCRAM y por debajo de 200 °C)
 *   procesos            lista qué procedimientos están en marcha
 *   estado              muestra las lecturas actuales
 *   ayuda / limpiar     ayudas de la propia consola
 *
 * Se pueden escribir varios comandos separados por salto de línea o por ";". Lo que vaya tras "#"
 * es comentario. El efecto sobre el reactor vive en sim.js; aquí solo se analiza el texto y se llama.
 */
(function (root) {
  'use strict';

  // kind: 'control' actúa sobre el reactor · 'meta' lo resuelve la propia consola
  const COMMANDS = [
    { name: 'boro',             aliases: ['boron', 'acido_borico'],        arg: 'pct', kind: 'control', help: 'boro <0-100> — fija el boro del refrigerante (frena la reacción despacio). «boro 0» lo diluye.' },
    { name: 'desviar_vapor',    aliases: ['desviar', 'desvio', 'steam_dump'], arg: null, kind: 'control', help: 'desviar_vapor — manda vapor al condensador: enfría rápido, pero esa energía no llega a la red.' },
    { name: 'aislar_fuga',      aliases: ['aislar', 'isolate'],            arg: null,  kind: 'control', help: 'aislar_fuga — cierra el lazo que pierde agua (la fuga para; ese lazo enfría menos un rato).' },
    { name: 'diesel',           aliases: ['generador', 'arrancar_diesel'], arg: null,  kind: 'control', help: 'diesel — arranca el generador de emergencia durante un apagón.' },
    { name: 'enfriar_residual', aliases: ['rhr', 'residual'],              arg: null,  kind: 'control', help: 'enfriar_residual — conecta el RHR: solo tras un SCRAM y por debajo de 200 °C.' },
    { name: 'procesos',         aliases: ['ps', 'jobs'],                   arg: null,  kind: 'meta',    help: 'procesos — lista los procedimientos en marcha o disponibles.' },
    { name: 'estado',           aliases: ['status', 'leer', 'lecturas'],   arg: null,  kind: 'meta',    help: 'estado — muestra temperatura, potencia, demanda y controles.' },
    { name: 'ayuda',            aliases: ['help', 'comandos', '?'],        arg: null,  kind: 'meta',    help: 'ayuda — lista los comandos disponibles.' },
    { name: 'limpiar',          aliases: ['clear', 'cls', 'borrar'],       arg: null,  kind: 'meta',    help: 'limpiar — borra lo escrito en la consola.' },
  ];

  // Comandos de la versión anterior: ya no existen, pero se avisa dónde está ahora cada cosa
  const LEGACY = {
    barras: 'Las barras de control se mueven con la palanca de arriba (↑ ↓).',
    bomba: 'La bomba se mueve con su palanca (← →).',
    scram: 'El apagado de emergencia es el botón rojo ⛔ SCRAM.',
    esperar: 'Ya no hace falta «esperar»: los procedimientos corren solos en paralelo.',
  };

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
    if (!cmd) {
      const old = LEGACY[(parts[0] || '').toLowerCase()];
      if (old) return { ok: false, raw: raw, error: '«' + parts[0] + '» ya no es un comando. ' + old };
      return { ok: false, raw: raw, error: 'No conozco «' + (parts[0] || '') + '». Escribe «ayuda» para ver los comandos.' };
    }
    if (cmd.arg === null) {
      if (parts.length > 1) return { ok: false, raw: raw, error: 'El comando «' + cmd.name + '» no lleva número.' };
      return { ok: true, raw: raw, cmd: cmd, value: null };
    }
    if (parts.length < 2) return { ok: false, raw: raw, error: 'Falta el número. Ejemplo: ' + cmd.help.split(' — ')[0].trim() };
    const n = Number(parts[1].replace(',', '.'));
    if (!isFinite(n)) return { ok: false, raw: raw, error: '«' + parts[1] + '» no es un número.' };
    if (cmd.arg === 'pct' && (n < 0 || n > 100)) return { ok: false, raw: raw, error: 'Usa un valor entre 0 y 100.' };
    return { ok: true, raw: raw, cmd: cmd, value: n };
  }

  // Analiza un texto completo → lista de resultados de parseLine
  function parse(text) { return splitLines(text).map(parseLine); }

  // Ejecuta un comando de control sobre el reactor. Sim = API de sim.js. Devuelve { ok, text }.
  function apply(Sim, sim, step) {
    switch (step.cmd.name) {
      case 'boro':             return Sim.setBoron(sim, step.value);
      case 'desviar_vapor':    return Sim.startDump(sim);
      case 'aislar_fuga':      return Sim.isolateLeak(sim);
      case 'diesel':           return Sim.startDiesel(sim);
      case 'enfriar_residual': return Sim.startRhr(sim);
      default:                 return { ok: false, text: 'El comando «' + step.cmd.name + '» no actúa sobre el reactor.' };
    }
  }

  // Línea de lecturas para el comando "estado"
  function stateLine(sim) {
    const base = 'T=' + Math.round(sim.T) + ' °C   P=' + Math.round(sim.P) + ' %   barras=' + Math.round(sim.rods) + ' %   bomba=' + Math.round(sim.pump) + ' %   boro=' + Math.round(sim.boron) + ' %';
    return sim.phase === 'cooldown'
      ? base + '   [enfriamiento: meta < 90 °C]'
      : base + '   la red pide ' + sim.demand + ' %';
  }

  // Líneas para el comando "procesos": el estado de cada procedimiento
  function processLines(sim) {
    const s = (n) => Math.ceil(n) + ' s';
    const L = [];
    L.push('boro             ' + Math.round(sim.boron) + ' %' + (Math.round(sim.boron) !== Math.round(sim.boronTarget) ? ' → objetivo ' + Math.round(sim.boronTarget) + ' %' : ''));
    L.push('desviar_vapor    ' + (sim.dump > 0 ? 'ABIERTO · ' + s(sim.dump) : sim.dumpCd > 0 ? 'recargando · ' + s(sim.dumpCd) : 'listo'));
    L.push('aislar_fuga      ' + (sim.isolated > 0 ? 'lazo aislado · ' + s(sim.isolated) : sim.leak > 0 ? '¡HAY UNA FUGA! · listo' : 'sin fugas'));
    L.push('diesel           ' + (sim.blackout <= 0 ? 'sin apagón' : sim.diesel === 'on' ? 'EN MARCHA' : sim.diesel === 'starting' ? 'arrancando · ' + s(sim.dieselT) : '¡SIN ENERGÍA! · listo para arrancar'));
    L.push('enfriar_residual ' + (sim.phase !== 'cooldown' ? 'solo tras un SCRAM' : sim.rhr === 'on' ? 'EN MARCHA' : sim.rhr === 'starting' ? 'arrancando · ' + s(sim.rhrT) : sim.T > 200 ? 'esperando < 200 °C (ahora ' + Math.round(sim.T) + ')' : '¡LISTO PARA CONECTAR!'));
    return L;
  }

  const api = {
    COMMANDS: COMMANDS, LEGACY: LEGACY, resolve: resolve, splitLines: splitLines, parseLine: parseLine, parse: parse,
    apply: apply, stateLine: stateLine, processLines: processLines,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReactorCommands = api;
})(typeof window !== 'undefined' ? window : globalThis);
