import { indexGraph } from "./graph.js";
import { catalogWorks, workInfluences } from "./timeline-data.js?v=3";
import { createTimeline } from "./timeline.js?v=5";
import { drawWorkDetail } from "./work-detail.js";
import { createRecognition } from "./recognition.js?v=4";

const byId = id => document.getElementById(id);
const format = new Intl.NumberFormat("es-CO");
const views = ["bienvenida", "genero", "influencias", "emergentes"];

export async function main() {
  const response = await fetch("./data/MC1_graph.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`Error HTTP ${response.status} al leer MC1_graph.json.`);
  const graph = indexGraph(await response.json());
  const d3 = window.d3;
  if (!d3) throw new Error("No se pudo cargar la biblioteca D3 local.");
  const catalog = catalogWorks(graph);
  if (!catalog.byGenre.size) throw new Error("El grafo no contiene obras con género y año.");
  const genres = Array.from(catalog.byGenre.keys()).sort((a, b) => a.localeCompare(b, "es"));
  const state = {
    intent: "influencias",
    view: null,
    genre: catalog.byGenre.has("Oceanus Folk") ? "Oceanus Folk" : genres[0],
    from: catalog.firstYear,
    to: catalog.lastYear,
    workType: "Song",
    selectedId: null
  };
  const genreInputs = ["genrePick", "genreInf", "genreEm"].map(byId);
  const rangeFrom = byId("yMin");
  const rangeTo = byId("yMax");
  const timeline = createTimeline(d3, byId("timeline"), id => {
    state.selectedId = id;
    renderTimeline();
  });
  const recognition = createRecognition(d3, graph, catalog);

  function renderTimeline() {
    const { from, to, genre, workType } = state;
    const works = catalog.byGenre.get(genre).filter(work =>
      from <= work.year && work.year <= to && (workType === "all" || work.kind === workType)
    );
    const visible = new Set(works.map(work => work.id));
    if (!visible.has(state.selectedId)) state.selectedId = null;
    const selected = catalog.byId.get(state.selectedId);
    const relations = selected ? workInfluences(graph, catalog, selected.id) : null;
    const influences = relations?.influenced.filter(({ work }) => visible.has(work.id)) ?? [];
    const count = format.format(works.length);
    byId("tlCount").textContent = works.length
      ? `${count} ${works.length === 1 ? "obra" : "obras"} · ${from === to ? from : `${from}–${to}`}`
      : "No hay obras para el rango seleccionado.";
    timeline.update({ songs: works, from, to, selectedId: state.selectedId, influences });
    drawWorkDetail(d3, graph, selected, relations, influences.length);
  }

  function render() {
    if (state.view === "influencias") renderTimeline();
    if (state.view === "emergentes") recognition.updateGenre(state.genre);
  }

  function show(view) {
    if (view === state.view) return;
    state.view = view;
    byId("s-bienvenida").classList.toggle("on", view === "bienvenida");
    byId("s-app").classList.toggle("on", view !== "bienvenida");
    for (const name of views.slice(1)) byId(`v-${name}`).classList.toggle("on", view === name);
    for (const button of byId("topnav").querySelectorAll("button")) {
      if (button.dataset.go === view) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    byId("topnav").hidden = view === "genero";
    byId("goIntent").textContent = state.intent === "emergentes" ? "Ver artistas emergentes" : "Rastrear influencias";
    render();
    window.scrollTo(0, 0);
  }

  function viewFromUrl() {
    const hash = location.hash.slice(1);
    if (hash === "recognition-heading") return "emergentes";
    return views.includes(hash) ? hash : "bienvenida";
  }

  function go(view) {
    if (state.view !== view) history.pushState(null, "", `#${view}`);
    show(view);
  }

  for (const input of genreInputs) {
    for (const genre of genres) input.add(new Option(genre, genre));
    input.value = state.genre;
    input.addEventListener("change", () => {
      state.genre = input.value;
      state.selectedId = null;
      for (const other of genreInputs) other.value = state.genre;
      render();
    });
  }

  function syncRange() {
    rangeFrom.value = state.from;
    rangeTo.value = state.to;
    byId("year-start").textContent = state.from;
    byId("year-end").textContent = state.to;
    const span = Math.max(1, catalog.lastYear - catalog.firstYear);
    const fill = byId("yFill");
    fill.style.left = `${100 * (state.from - catalog.firstYear) / span}%`;
    fill.style.width = `${100 * (state.to - state.from) / span}%`;
  }

  for (const input of [rangeFrom, rangeTo]) {
    input.min = catalog.firstYear;
    input.max = catalog.lastYear;
    input.addEventListener("input", () => {
      if (input === rangeFrom) state.from = Math.min(input.valueAsNumber, state.to);
      else state.to = Math.max(input.valueAsNumber, state.from);
      syncRange();
      renderTimeline();
    });
  }
  syncRange();
  byId("work-type").addEventListener("change", event => {
    state.workType = event.target.value;
    renderTimeline();
  });

  for (const button of document.querySelectorAll("[data-intent]")) {
    button.disabled = false;
    button.addEventListener("click", () => {
      state.intent = button.dataset.intent;
      go("genero");
    });
  }
  for (const button of document.querySelectorAll("[data-go]")) {
    button.addEventListener("click", () => go(button.dataset.go));
  }
  byId("goIntent").addEventListener("click", () => go(state.intent));
  window.addEventListener("popstate", () => show(viewFromUrl()));
  window.addEventListener("hashchange", () => show(viewFromUrl()));
  byId("app-status").textContent = `${format.format(graph.nodes.length)} nodos · ${format.format(graph.links.length)} relaciones`;
  show(viewFromUrl());
}
