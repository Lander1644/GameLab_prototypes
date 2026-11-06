/* =====================================================================
 * players.js  —  JUGADORES Y MARCADOR
 * Depende de: state.js, utils.js
 * ---------------------------------------------------------------------
 * - Valida y guarda los nombres.
 * - Dibuja el marcador permanente (nombres, puntos, quién tiene el turno).
 * No decide cuándo se dan puntos (eso lo hace answers.js).
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  const porId = Quiz.Util.porId;
  const MAX_LARGO_NOMBRE = 16;

  /**
   * Valida los nombres escritos en el formulario y los guarda en el estado.
   * Devuelve { ok: true } o { ok: false, error: 'texto para mostrar' }.
   */
  function registrarJugadores(nombre1, nombre2) {
    const n1 = String(nombre1 || '').trim().slice(0, MAX_LARGO_NOMBRE);
    const n2 = String(nombre2 || '').trim().slice(0, MAX_LARGO_NOMBRE);

    if (!n1 || !n2) {
      return { ok: false, error: 'Escribe el nombre de ambos jugadores.' };
    }
    // Con nombres iguales no sabríamos a quién se refiere cada mensaje.
    if (n1.toLowerCase() === n2.toLowerCase()) {
      return { ok: false, error: 'Los nombres deben ser diferentes.' };
    }

    Quiz.Estado.jugadores[0].nombre = n1;
    Quiz.Estado.jugadores[1].nombre = n2;
    return { ok: true };
  }

  /** Refresca nombres y puntos en el marcador de la pantalla de juego. */
  function actualizarPuntuaciones() {
    Quiz.Estado.jugadores.forEach(function (jugador, i) {
      porId('nombre-' + i).textContent = jugador.nombre;
      porId('puntos-' + i).textContent = jugador.puntos;
    });
  }

  /**
   * Resalta al jugador que tiene el turno (0 o 1). Con `null` quita el resalte.
   * El rival queda atenuado para que se vea claro de quién es el turno.
   */
  function mostrarJugadorActivo(indice) {
    [0, 1].forEach(function (i) {
      const tarjeta = porId('jugador-' + i);
      tarjeta.classList.toggle('activo', i === indice);
      tarjeta.classList.toggle('en-espera', indice !== null && i !== indice);
    });
  }

  /** Escribe el pequeño texto de estado bajo cada jugador ("¡LISTO!", "Bloqueada"...). */
  function mostrarEstadoTecla(indice, texto, clase) {
    const caja = porId('estado-' + indice);
    caja.textContent = texto;
    caja.className = 'jugador-estado' + (clase ? ' ' + clase : '');
  }

  /** Vacía el formulario de registro (para una partida nueva). */
  function limpiarFormulario() {
    porId('nombre-jugador-1').value = '';
    porId('nombre-jugador-2').value = '';
    Quiz.Pantallas.mostrarErrorRegistro('');
  }

  Quiz.Jugadores = {
    registrarJugadores: registrarJugadores,
    actualizarPuntuaciones: actualizarPuntuaciones,
    mostrarJugadorActivo: mostrarJugadorActivo,
    mostrarEstadoTecla: mostrarEstadoTecla,
    limpiarFormulario: limpiarFormulario
  };

})(window.Quiz);
