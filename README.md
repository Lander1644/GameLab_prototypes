# GameLab_prototypes
Videojuegos para las ferias y eventos

Pequeños juegos que se ejecutan **localmente en el navegador**, sin instalar nada y sin internet. Los hicimos para la feria de fusión científica de nuestra comunidad estudiantil.

## Cómo jugar

1. Descarga el repositorio (`Code → Download ZIP`) o clónalo: `git clone https://github.com/Lander1644/GameLab_prototypes.git`
2. Abre **`index.html`** con doble clic (Chrome, Edge o Firefox). Ahí aparece el menú con todos los juegos.
3. Para la feria: presiona `F11` y juega en pantalla completa.

## Juegos

| Juego | Carpeta | De qué trata |
|---|---|---|
| ☢️ Estabiliza el reactor | `reactor/` | Controla barras y refrigerante con las palancas, y responde a las señales (apagón, fuga, pico, calor) con procedimientos en una terminal: `boro`, `desviar_vapor`, `aislar_fuga`, `diesel`, `enfriar_residual`. El SCRAM inicia una fase de enfriamiento hasta parada fría. 3 dificultades. |
| 🧩 Programa al robot | `robot2/` | Versión con bloques estilo Scratch que se **arrastran y sueltan**: bucles «repetir» (for) y «mientras» (while) con condiciones, y un bloque **«Romper»** para abrirse paso entre rocas (los muros de acero no se rompen). 8 niveles. Las estrellas dependen de cuántos bloques uses frente a la solución de referencia del nivel (3★ = igual o menos; 2★ = hasta 1,5 veces; 1★ = el resto). |
| 🧪 Duelo de Química Aplicada | `quizz_QA/` | Quiz para dos jugadores con pulsadores de teclado (A / L): 10 preguntas de un banco de 30, robo de pregunta y desempate. |

Controles: los juegos se pueden jugar con mouse/táctil; el teclado está explicado dentro de cada juego.

## Estructura

```
index.html          menú principal
shared/style.css    estilos comunes
reactor/            sim.js (física, sin DOM) · commands.js (terminal, sin DOM) · game.js (dibujo y controles) · index.html · reactor.css
robot2/             logic.js (reglas) · levels.js (mapas) · game.js (interfaz, bloques arrastrables) · index.html · robot2.css
quizz_QA/           quiz de dos jugadores (index.html · style.css · js/ con un módulo por tema; ver su README)
tools/              pruebas automáticas con Node (opcional)
```

La lógica de cada juego está separada del dibujo para poder probarla sin navegador.

## Agregar o modificar cosas

- **Nuevo nivel del robot (bloques Scratch):** igual en `robot2/levels.js` (además `#` es muro de acero, `X` roca rompible, y `allow` indica qué bloques hay disponibles). La `solution` debe ser el algoritmo *natural* del nivel, no el atajo más corto posible: sus bloques son el "par" de las estrellas. Valídalo con `node tools/test-robot2.js` (con `--deep` avisa si hay algo más corto hasta 6 bloques).
- **Ajustar la dificultad del reactor:** los parámetros están al inicio de `reactor/sim.js` (`DIFFICULTIES`). Corre `node tools/test-reactor.js` para comprobar que sigue siendo ganable.
- **Nuevo juego:** crea una carpeta con su `index.html` (puedes copiar el `<link>` a `../shared/style.css`) y agrega una tarjeta en el `index.html` de la raíz.

Las pruebas necesitan [Node.js](https://nodejs.org) (solo para desarrollar; para jugar no hace falta).

## Notas

- Todo usa HTML + CSS + JavaScript sin librerías ni internet, así funciona aunque el wifi de la feria falle.
- El progreso del robot (estrellas) se guarda en el navegador de cada computadora.
- El reactor es una simulación **simplificada y acelerada** con fines divulgativos; un reactor real es mucho más lento y tiene muchas capas de seguridad.
