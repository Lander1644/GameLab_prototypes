
/* =====================================================================
 * visuals.js — ANIMACIÓN VISUAL DEL MARCADOR
 * ---------------------------------------------------------------------
 * Actualiza el nivel de los frascos al cambiar el texto del puntaje.
 * No modifica puntos, preguntas, temporizadores ni reglas del juego.
 * ===================================================================== */

(function () {
  'use strict';

  function conectarFrasco(indice) {

    const puntos = document.getElementById('puntos-' + indice);

    const tarjeta = document.getElementById('jugador-' + indice);

    if (!puntos || !tarjeta) return;


    function actualizarFrasco() {

      // Leer los puntos actuales del jugador
      const valor = Math.max(
        0,
        Number(puntos.textContent.trim()) || 0
      );


      // Convertir puntos en porcentaje de llenado
      const porcentaje = Math.min(
        100,
        (valor / 10) * 100
      );


      // Actualizar el nivel del líquido mediante CSS
      tarjeta.style.setProperty(
        '--fill',
        porcentaje + '%'
      );


      // Actualizar descripción accesible
      const frasco = tarjeta.querySelector('.potion-score');

      if (frasco) {
        frasco.setAttribute(
          'aria-label',
          valor + ' puntos'
        );
      }

    }


    // Detectar automáticamente cambios en el marcador
    new MutationObserver(actualizarFrasco).observe(puntos, {
      childList: true,
      characterData: true,
      subtree: true
    });


    // Mostrar nivel inicial
    actualizarFrasco();

  }


  function iniciar() {
    conectarFrasco(0);
    conectarFrasco(1);
  }


  // Esperar a que el HTML esté cargado
  if (document.readyState === 'loading') {

    document.addEventListener(
      'DOMContentLoaded',
      iniciar
    );

  } else {

    iniciar();

  }

})();
