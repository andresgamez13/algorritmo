import { degrees, indexGraph } from "./graph.js";
import { renderNetwork } from "./network.js";
import { renderDegrees } from "./degrees-plot.js";

const status = document.querySelector("#status");
const network = document.querySelector("#network");
const degreesPlot = document.querySelector("#degrees");

async function main() {
  const response = await fetch("./data/graph.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`Error HTTP ${response.status} al leer el archivo.`);
  const graph = indexGraph(await response.json());
  if (!window.d3) throw new Error("No se pudo cargar la biblioteca D3 local.");

  status.textContent = `${graph.nodes.length} nodos · ${graph.links.length} aristas dirigidas`;
  if (graph.nodes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "El archivo no contiene nodos.";
    network.append(empty);
    return;
  }

  const view = renderNetwork(window.d3, network, graph);
  renderDegrees(window.d3, degreesPlot, degrees(graph));
  const controls = [
    ["#zoom-out", () => view.zoomBy(1 / 1.3)],
    ["#zoom-in", () => view.zoomBy(1.3)],
    ["#reset-view", view.resetView]
  ];
  for (const [selector, action] of controls) {
    const button = document.querySelector(selector);
    button.addEventListener("click", action);
    button.disabled = false;
  }
}

main().catch(error => {
  status.textContent = `No se pudo iniciar el explorador. ${error.message}`;
  status.classList.add("error");
});
