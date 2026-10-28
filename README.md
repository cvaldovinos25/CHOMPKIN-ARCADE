# CHOMPKIN AR
Juego de realidad aumentada sobre papel: se imprime la hoja del laberinto, se apunta la cámara del celular y el juego se proyecta sobre el impreso, siguiendo su posición y perspectiva.

## Cómo usarlo
1. Imprime (fondo blanco, lineas azul oscuro neon) `print/hoja-laberinto.pdf` (A4) , `print/hoja-laberinto-A2.pdf` (A2, 420 x 594 mm, 300 ppp) o `print/hoja-laberinto-80cm.pdf` (80 cm de ancho x 113,1 cm de alto, 190 ppp), `print/hoja-laberinto-1m.pdf` (1 m de ancho x 1,414 m de alto, 150 ppp), sin escalar; papel mate, sin brillos) y ponla sobre una superficie plana con buena luz.
2. Abre el juego en el celular (GitHub Pages), pulsa PLAY y apunta la cámara al papel. Deben verse los 4 cuadros negros de las esquinas.
3. Desliza el dedo para mover la calabaza. Si pierdes los cuadros, el juego se pausa y sigue al volver a enfocarlos.

## Cómo funciona
- 4 marcadores ArUco (librería js-aruco2, licencia MIT/BSD) en las esquinas permiten calcular la homografía de la hoja.
- El juego se dibuja en una textura y se proyecta con WebGL sobre el papel. Los muros son los impresos; los dulces y personajes son digitales.
- No se guarda ni envía ninguna imagen.

## Publicar en GitHub Pages
1. Crea el repositorio `CHOMPKIN-AR` y sube todo el contenido.
2. Settings > Pages > Deploy from a branch > `main` / root.
3. Dirección: `https://TU-USUARIO.github.io/CHOMPKIN-AR/` (el QR de la hoja apunta a `cvaldovinos25`; regenera la hoja si usas otro usuario).
