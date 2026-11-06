/* =====================================================================
 * questions.js  —  LÓGICA DE PREGUNTAS
 * Depende de: config.js, utils.js, bank.js, state.js
 * ---------------------------------------------------------------------
 * - Elige las 10 preguntas de la partida (y guarda las 20 restantes).
 * - Mezcla las opciones.
 * - Dibuja la pregunta y las marcas de color en las opciones.
 * - Valida si una opción es la correcta.
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  const Util = Quiz.Util;
  const SIMBOLOS = ['▲', '◆', '●', '■']; // un símbolo por opción (no usamos letras para no confundir con las teclas A y L)

  // ---------------------------------------------------------------------
  // SELECCIÓN ALEATORIA
  // ---------------------------------------------------------------------

  /**
   * Devuelve una copia de la pregunta con las opciones en orden aleatorio
   * y con `indiceCorrecto` ya recalculado.
   * Se hace UNA vez por pregunta (al armar la partida), así la posición
   * de cada opción no cambia durante la ronda.
   */
  function mezclarOpciones(pregunta) {
    const opciones = Util.mezclar(pregunta.opciones);
    return {
      id: pregunta.id,
      tema: pregunta.tema,
      enunciado: pregunta.enunciado,
      opciones: opciones,
      indiceCorrecto: opciones.indexOf(pregunta.respuesta)
    };
  }

  /**
   * Se llama UNA sola vez al comenzar la partida.
   * Mezcla las 30 preguntas del banco y las divide:
   *   - las primeras 10 → preguntas de la partida (sin repetidas, en orden aleatorio)
   *   - las otras 20    → reserva para el desempate
   * Como cada pregunta aparece una sola vez en la lista mezclada, es
   * imposible que se repita o que una pregunta de desempate ya se haya usado.
   */
  function seleccionarPreguntasAleatorias() {
    const total = Quiz.Config.PREGUNTAS_POR_PARTIDA;
    const preparadas = Util.mezclar(Quiz.BancoPreguntas).map(mezclarOpciones);
    Quiz.Estado.preguntasPartida = preparadas.slice(0, total);
    Quiz.Estado.reservaDesempate = preparadas.slice(total);
    Quiz.Estado.indiceRonda = 0;
  }

  /**
   * Saca la siguiente pregunta de la reserva de desempate (y la elimina de
   * la reserva para que no se repita).
   * Caso extremo: si se agotaran las 20 (20 desempates seguidos sin ganador)
   * se vuelve a mezclar todo el banco, sin repetir la pregunta inmediata anterior.
   */
  function obtenerPreguntaDesempate() {
    const estado = Quiz.Estado;
    if (estado.reservaDesempate.length === 0) {
      const ultimaId = estado.ronda ? estado.ronda.pregunta.id : null;
      estado.reservaDesempate = Util.mezclar(Quiz.BancoPreguntas)
        .filter(function (p) { return p.id !== ultimaId; })
        .map(mezclarOpciones);
    }
    return estado.reservaDesempate.shift();
  }

  // ---------------------------------------------------------------------
  // VALIDACIÓN
  // ---------------------------------------------------------------------

  /** ¿La opción elegida es la correcta? (función pura: no toca el estado ni el DOM) */
  function validarRespuesta(pregunta, indiceElegido) {
    return indiceElegido === pregunta.indiceCorrecto;
  }

  // ---------------------------------------------------------------------
  // VISTA DE LA PREGUNTA
  // ---------------------------------------------------------------------

  function obtenerBotonesOpciones() {
    return Array.prototype.slice.call(document.querySelectorAll('#opciones .opcion'));
  }

  /** Dibuja el enunciado y las opciones de la ronda (todas bloqueadas al inicio). */
  function mostrarPregunta(ronda) {
    const contenedor = Util.porId('opciones');
    Util.porId('enunciado').textContent = ronda.pregunta.enunciado;
    contenedor.innerHTML = '';

    ronda.pregunta.opciones.forEach(function (texto, i) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'opcion opcion-' + i + ' bloqueada';
      boton.dataset.indice = String(i);
      boton.disabled = true;

      const simbolo = document.createElement('span');
      simbolo.className = 'simbolo';
      simbolo.textContent = SIMBOLOS[i] || '';
      const etiqueta = document.createElement('span');
      etiqueta.className = 'texto-opcion';
      etiqueta.textContent = texto; // textContent evita que el texto se interprete como HTML

      boton.appendChild(simbolo);
      boton.appendChild(etiqueta);
      contenedor.appendChild(boton);
    });
  }

  /** Activa (true) o bloquea (false) los clics en todas las opciones. */
  function habilitarOpciones(habilitar) {
    obtenerBotonesOpciones().forEach(function (boton) {
      boton.disabled = !habilitar;
      boton.classList.toggle('bloqueada', !habilitar);
      boton.classList.toggle('habilitada', habilitar);
    });
  }

  function marcarSeleccion(indice) {
    const boton = obtenerBotonesOpciones()[indice];
    if (boton) { boton.classList.add('seleccionada'); }
  }

  function marcarIncorrecta(indice) {
    const boton = obtenerBotonesOpciones()[indice];
    if (boton) {
      boton.classList.remove('seleccionada');
      boton.classList.add('incorrecta');
    }
  }

  /** Resalta la opción correcta y atenúa las demás. */
  function mostrarRespuestaCorrecta() {
    const correcta = Quiz.Estado.ronda.pregunta.indiceCorrecto;
    obtenerBotonesOpciones().forEach(function (boton, i) {
      boton.classList.remove('seleccionada');
      if (i === correcta) {
        boton.classList.add('correcta');
      } else if (!boton.classList.contains('incorrecta')) {
        boton.classList.add('descartada');
      }
    });
  }

  /** Quita todas las marcas (se usa antes del intento de robo). */
  function limpiarMarcas() {
    obtenerBotonesOpciones().forEach(function (boton) {
      boton.classList.remove('seleccionada', 'incorrecta', 'correcta', 'descartada');
    });
  }

  /** Texto de la opción correcta de la ronda actual (para mensajes). */
  function textoRespuestaCorrecta() {
    const p = Quiz.Estado.ronda.pregunta;
    return p.opciones[p.indiceCorrecto];
  }

  Quiz.Preguntas = {
    seleccionarPreguntasAleatorias: seleccionarPreguntasAleatorias,
    obtenerPreguntaDesempate: obtenerPreguntaDesempate,
    mezclarOpciones: mezclarOpciones,
    mostrarPregunta: mostrarPregunta,
    validarRespuesta: validarRespuesta,
    habilitarOpciones: habilitarOpciones,
    marcarSeleccion: marcarSeleccion,
    marcarIncorrecta: marcarIncorrecta,
    mostrarRespuestaCorrecta: mostrarRespuestaCorrecta,
    limpiarMarcas: limpiarMarcas,
    textoRespuestaCorrecta: textoRespuestaCorrecta
  };

})(window.Quiz);
