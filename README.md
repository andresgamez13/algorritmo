# Algorritmo

Explorador local de influencias y reconocimiento musical hecho en HTML, CSS, JavaScript y D3. La interfaz integra el diseño de `dist/data/algorritmo_codigo` y calcula sus visualizaciones con el grafo completo de `dist/data/MC1_graph.json`.

## Ejecutar en Windows

Desde PowerShell, en la raíz del proyecto, ejecuta:

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Abre [Algorritmo](http://127.0.0.1:8000/). La navegación ofrece las vistas [Rastrear influencias](http://127.0.0.1:8000/#influencias) y [Artistas emergentes](http://127.0.0.1:8000/#emergentes). Usa Ctrl+C en la terminal para detener el servidor. D3 7.9.0 se sirve desde `dist/vendor`.

## Visualizaciones y datos

1. **Línea de tiempo.** Muestra las canciones del género y los años elegidos. El selector permite incluir álbumes. Cuando coinciden varias obras en un año, un punto indica cuántas hay. Selecciónalo para abrir el grupo y usa el punto central para cerrarlo. Puedes mantener abiertos varios años. Al seleccionar una obra, los arcos llegan a las obras influidas que cumplen los filtros o al punto de su año cuando está cerrado. La ficha y la mini red incluyen también las relaciones que quedan fuera del filtro.
2. **Burbujas.** Cada artista o grupo se atribuye por `PerformerOf`. El tamaño cuenta canciones y álbumes publicados en el género hasta el año seleccionado. X acumula canciones notables con `notoriety_date` hasta ese año, Y cuenta las del propio año. Los valores iguales a la mediana quedan a la izquierda en X y abajo en Y. Si varias burbujas se superponen, selecciona el punto para elegir un artista.
3. **Podio de emergentes.** Ordena a los tres primeros por las obras reconocidas ese año. Los empates se ordenan por nombre. El filtro de reconocimiento fechado recalcula las medianas entre quienes ya tenían algún reconocimiento.
4. **Éxitos acumulados.** Muestra el acumulado al cierre de cada uno de los últimos ocho años. Usa los mismos criterios que el eje X.
5. **Cómo otros usan su música.** Cuenta aristas entrantes de `CoverOf`, `DirectlySamples`, `InterpolatesFrom`, `LyricalReferenceTo` e `InStyleOf` desde canciones o álbumes publicados hasta el año elegido.
6. **Productividad.** Cuenta las canciones y álbumes del género publicados por cada artista hasta el año elegido. Incluye obras con y sin reconocimiento.

Los gráficos 4 a 6 se muestran en una fila debajo de las burbujas y el podio. Se actualizan al seleccionar hasta cuatro artistas. Las obras de cada artista se filtran por el género activo. Las obras fuente en el gráfico de tipos de influencia pueden pertenecer a cualquier género.

## Código

[main.js](dist/src/main.js) carga e indexa el grafo una vez. [timeline-data.js](dist/src/timeline-data.js), [recognition-data.js](dist/src/recognition-data.js) y [comparison-data.js](dist/src/comparison-data.js) calculan los datos de cada vista. [graph.js](dist/src/graph.js) conserva las aristas paralelas de NetworkX mediante la combinación de origen, destino y clave. La [demo del grafo pequeño](http://127.0.0.1:8000/demo.html) usa su propio archivo `graph.json`.
