/* =====================================================================
 * screens.js  —  PANTALLAS Y ELEMENTOS VISUALES GENERALES
 * Depende de: utils.js, state.js
 * ---------------------------------------------------------------------
 * Este módulo SOLO muestra y oculta cosas. No sabe nada de puntos,
 * turnos ni reglas: recibe textos ya listos y los coloca en el HTML.
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  const porId = Quiz.Util.porId;

  /** Muestra una sola pantalla (por ejemplo 'inicio') y oculta las demás. */
  function mostrarPantalla(nombre) {
    document.querySelectorAll('.pantalla').forEach(function (pantalla) {
      pantalla.classList.toggle('activa', pantalla.id === 'pantalla-' + nombre);
    });
    const activa = porId('pantalla-' + nombre);
    activa.tabIndex = -1;
    activa.focus({ preventScroll: true });
    Quiz.Estado.pantalla = nombre;
    if (Quiz.Estudio) Quiz.Estudio.alCambiarPantalla(nombre);
  }

  // ---------- Las seis pantallas del juego ----------
  function mostrarPantallaInicial()    { mostrarPantalla('inicio'); }
  function mostrarInstrucciones()      { mostrarPantalla('instrucciones'); }
  function mostrarPantallaJuego()      { mostrarPantalla('juego'); }

  function mostrarRegistroJugadores() {
    mostrarPantalla('registro');
    porId('nombre-jugador-1').focus();
  }

  /** Pantalla de desempate. `repetido` = true si ya hubo una pregunta de desempate fallida. */
  function mostrarDesempate(repetido) {
    const jugadores = Quiz.Estado.jugadores;
    porId('desempate-titulo').textContent = repetido ? '¡Seguimos empatados!' : '¡EMPATE!';
    porId('desempate-texto').textContent = repetido
      ? 'Nadie acertó la pregunta anterior. Va otra pregunta de desempate.'
      : 'Ambos jugadores terminaron con los mismos puntos. Una pregunta decidirá al ganador: ¡quien acierte gana la partida!';
    porId('desempate-marcador').textContent =
      jugadores[0].nombre + ' ' + jugadores[0].puntos + '  —  ' + jugadores[1].puntos + ' ' + jugadores[1].nombre;
    mostrarPantalla('desempate');
  }

  /** Pantalla final. `datos` = { ganador: índice, porDesempate: boolean } */
  function mostrarPantallaFinal(datos) {
    const jugadores = Quiz.Estado.jugadores;
    const ganador = jugadores[datos.ganador];
    porId('final-ganador').textContent = ganador.nombre;
    porId('final-detalle').textContent = datos.porDesempate
      ? 'Ganó en la ronda de desempate'
      : 'Ganó la partida';
    [0, 1].forEach(function (i) {
      porId('final-nombre-' + i).textContent = jugadores[i].nombre;
      porId('final-puntos-' + i).textContent = jugadores[i].puntos;
      porId('final-jugador-' + i).classList.toggle('ganador', i === datos.ganador);
    });
    porId('final-mensaje').textContent =
      '¡Felicidades, ' + ganador.nombre + '! Demostraste que la química se te da muy bien. ' +
      '¡Gracias por jugar y suerte a todos en la feria!';
    mostrarPantalla('final');
  }

  // ---------- Elementos de la pantalla de juego ----------

  /** Muestra el texto de la ronda ("Pregunta 3 de 10") y la insignia de desempate. */
  function mostrarRonda(texto, esDesempate) {
    porId('etiqueta-ronda').textContent = texto;
    porId('insignia-desempate').hidden = !esDesempate;
  }

  /** Muestra un mensaje destacado. `tipo` cambia el color (ver style.css). */
  function mostrarMensaje(texto, tipo) {
    const caja = porId('mensaje');
    caja.className = 'mensaje mensaje-' + (tipo || 'info');
    caja.textContent = texto;
    porId('question-panel').dataset.result = (tipo === 'robo' && Quiz.Estado.ronda && Quiz.Estado.ronda.ganadorRonda === null) ? 'info' : (tipo || 'info');
  }

  /** Actualiza el número y la barra del temporizador. */
  function mostrarTemporizador(etiqueta, segundosRestantes, segundosTotales) {
    porId('temporizador-etiqueta').textContent = etiqueta;
    porId('temporizador-numero').textContent = Math.ceil(segundosRestantes - 0.001);
    const porcentaje = Math.max(0, Math.min(100, (segundosRestantes / segundosTotales) * 100));
    porId('barra-progreso').style.width = porcentaje + '%';
    porId('zona-temporizador').classList.toggle('urgente', segundosRestantes <= 3);
    if (Quiz.Estudio) Quiz.Estudio.actualizarCuenta(segundosRestantes);
  }

  /** Deja el temporizador "apagado" con un texto (por ejemplo durante el suspenso). */
  function limpiarTemporizador(etiqueta) {
    porId('temporizador-etiqueta').textContent = etiqueta || '';
    porId('temporizador-numero').textContent = '–';
    porId('barra-progreso').style.width = '0%';
    porId('zona-temporizador').classList.remove('urgente');
  }

  function mostrarErrorRegistro(texto) {
    porId('registro-error').textContent = texto || '';
  }

  Quiz.Pantallas = {
    mostrarPantalla: mostrarPantalla,
    mostrarPantallaInicial: mostrarPantallaInicial,
    mostrarInstrucciones: mostrarInstrucciones,
    mostrarRegistroJugadores: mostrarRegistroJugadores,
    mostrarPantallaJuego: mostrarPantallaJuego,
    mostrarDesempate: mostrarDesempate,
    mostrarPantallaFinal: mostrarPantallaFinal,
    mostrarRonda: mostrarRonda,
    mostrarMensaje: mostrarMensaje,
    mostrarTemporizador: mostrarTemporizador,
    limpiarTemporizador: limpiarTemporizador,
    mostrarErrorRegistro: mostrarErrorRegistro
  };

})(window.Quiz);
