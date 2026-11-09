/* El presentador y la cuenta visual no alteran turnos, puntos ni tiempos. */
(function(Quiz){
 'use strict';
 const $=Quiz.Util.porId;
 let goTimer=null;
 function ocultar(){clearTimeout(goTimer);goTimer=null;$('cuenta-capa').hidden=true;$('cuenta-capa').classList.remove('go');Quiz.Interactivos.cancelarArrastre();}
 function alCambiarPantalla(nombre){ocultar();document.body.dataset.screen=nombre;}
 function actualizarCuenta(segundos){const r=Quiz.Estado.ronda;if(!r||r.fase!==Quiz.FASES.LECTURA)return;const overlay=$('cuenta-capa');if(segundos>0&&segundos<=2){overlay.hidden=false;overlay.classList.remove('go');const palabra=segundos>1?'PREPARADOS…':'LISTOS…';if($('cuenta-palabra').textContent!==palabra)$('cuenta-palabra').textContent=palabra;}}
 function pulsen(){clearTimeout(goTimer);const overlay=$('cuenta-capa');overlay.hidden=false;overlay.classList.add('go');$('cuenta-palabra').textContent='¡PULSEN!';goTimer=setTimeout(ocultar,600);}
 Quiz.Estudio={actualizarCuenta,pulsen,alCambiarPantalla};
})(window.Quiz);
