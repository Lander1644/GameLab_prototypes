/* =====================================================================
 * timers.js  —  TEMPORIZADORES
 * Depende de: config.js, state.js
 * ---------------------------------------------------------------------
 * Este módulo SOLO cuenta tiempo y avisa cuando termina. No sabe nada de
 * respuestas ni de puntos: quien lo usa le pasa la función `onFin` que
 * debe ejecutarse al terminar.
 *
 * Seguridad contra "temporizadores fantasma":
 *   1) Cada temporizador tiene un nombre y un "token" propio. Si se
 *      reinicia o se detiene, su token deja de ser el vigente y cualquier
 *      aviso pendiente se ignora.
 *   2) Cada temporizador recuerda el `rondaId` con el que nació. Si la
 *      ronda cambió (o la partida se reinició), su aviso se descarta.
 *   Así, un temporizador viejo NUNCA puede afectar a la pregunta siguiente.
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  const activos = {};          // nombre → token del temporizador vigente
  let funcionVista = null;     // función que dibuja el contador (la conecta script.js)

  /** Conecta la función que muestra el tiempo en pantalla. Mantiene este módulo libre de HTML. */
  function conectarVista(funcion) {
    funcionVista = funcion;
  }

  /** Detiene un temporizador por nombre (si existe). */
  function detener(nombre) {
    const token = activos[nombre];
    if (!token) { return; }
    clearInterval(token.intervalo);
    clearTimeout(token.fin);
    delete activos[nombre];
  }

  /**
   * Motor genérico. Cuenta `segundos` y luego llama a `onFin`.
   * Si `mostrar` es true, avisa a la vista cada TICK_MS para dibujar el contador.
   */
  function iniciar(nombre, segundos, etiqueta, onFin, mostrar) {
    detener(nombre); // nunca dos temporizadores con el mismo nombre

    const token = {};
    const rondaIdAlNacer = Quiz.Estado.rondaId;
    const inicio = Date.now();
    const duracionMs = segundos * 1000;
    activos[nombre] = token;

    function esVigente() {
      return activos[nombre] === token && Quiz.Estado.rondaId === rondaIdAlNacer;
    }

    function dibujar() {
      if (!mostrar || !funcionVista) { return; }
      const restante = Math.max(0, (duracionMs - (Date.now() - inicio)) / 1000);
      funcionVista(etiqueta, restante, segundos);
    }

    token.intervalo = setInterval(function () {
      if (!esVigente()) { detener(nombre); return; }
      dibujar();
    }, Quiz.Config.TICK_MS);

    token.fin = setTimeout(function () {
      if (!esVigente()) { return; }
      detener(nombre);
      if (mostrar && funcionVista) { funcionVista(etiqueta, 0, segundos); }
      onFin();
    }, duracionMs);

    dibujar();
  }

  // ---------- Temporizadores con nombre (uno por etapa del juego) ----------

  function iniciarTemporizadorLectura(onFin) {
    iniciar('lectura', Quiz.Config.TIEMPOS.LECTURA, 'Tiempo de lectura', onFin, true);
  }

  function iniciarTemporizadorPulsadores(onFin, etiqueta) {
    iniciar('pulsadores', Quiz.Config.TIEMPOS.PULSADORES, etiqueta || '¡Presiona tu tecla!', onFin, true);
  }

  function iniciarTemporizadorRespuesta(onFin, etiqueta) {
    iniciar('respuesta', Quiz.Estado.ronda.pregunta.tipo ? Quiz.Config.TIEMPOS.INTERACTIVA : Quiz.Config.TIEMPOS.RESPUESTA, etiqueta || 'Elige una respuesta', onFin, true);
  }

  /** Pausa sin contador visible (suspenso, lectura de mensajes, final de ronda). */
  function iniciarPausa(segundos, onFin) {
    iniciar('pausa', segundos, '', onFin, false);
  }

  /** Detiene TODOS los temporizadores. Se llama al cambiar de ronda y al reiniciar. */
  function detenerTemporizadores() {
    Object.keys(activos).forEach(detener);
  }

  /** Solo para pruebas/depuración: ¿cuántos temporizadores siguen vivos? */
  function cantidadActivos() {
    return Object.keys(activos).length;
  }

  Quiz.Temporizadores = {
    conectarVista: conectarVista,
    iniciarTemporizadorLectura: iniciarTemporizadorLectura,
    iniciarTemporizadorPulsadores: iniciarTemporizadorPulsadores,
    iniciarTemporizadorRespuesta: iniciarTemporizadorRespuesta,
    iniciarPausa: iniciarPausa,
    detenerTemporizadores: detenerTemporizadores,
    cantidadActivos: cantidadActivos
  };

})(window.Quiz);
