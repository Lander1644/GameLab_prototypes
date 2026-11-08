# robot_py/lib/

Intérprete de Python para el navegador (**Skulpt**), vendorizado aquí para que el juego
funcione **sin internet** (abriendo `index.html` con doble clic, `file://`).

```
lib/skulpt.min.js      define el global Sk
lib/skulpt-stdlib.js   biblioteca estándar que Sk carga con su `read`
```

Se cargan desde `../index.html` antes de `runner.js`, que es quien conecta Skulpt con el juego
(ver `../INTERPRETE_PROMPT.md`).

Origen: paquete npm `skulpt` **v1.2.0**, carpeta `dist/` (`skulpt.min.js` y `skulpt-stdlib.js`).
No se usa CDN: estos archivos viajan dentro del repo. Para actualizarlos:

```
npm pack skulpt            # baja skulpt-<version>.tgz
tar -xzf skulpt-*.tgz      # extrae package/dist/
# copia package/dist/skulpt.min.js y package/dist/skulpt-stdlib.js aquí
```

Fuente oficial: https://skulpt.org · GitHub: `skulpt/skulpt`
