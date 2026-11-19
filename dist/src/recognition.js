import { catalogRecognition, quadrants, recognitionStats } from "./recognition-data.js?v=3";
import { renderComparison, selectionColors } from "./comparison.js?v=4";
import { artistComparison } from "./comparison-data.js?v=4";

const format = new Intl.NumberFormat("es-CO");
const width = 820;
const height = 344;
const area = { left: 68, right: 788, top: 22, bottom: 292 };

function integerTicks(d3, maximum) {
  return maximum <= 7 ? d3.range(maximum + 1) : d3.ticks(0, maximum, 7).filter(Number.isInteger);
}

function drawBubbles(d3, container, stats, selectGroup) {
  const { rows, medianX, medianY } = stats;
  container.replaceChildren();
  container.hidden = !rows.length;
  if (!rows.length) return () => {};

  const maxX = d3.max(rows, row => row.accumulated);
  const maxY = d3.max(rows, row => row.current);
  const padX = Math.max(1, maxX) * .25;
  const padY = Math.max(1, maxY) * .32;
  const x = d3.scaleLinear().domain([-padX, Math.max(1, maxX) + padX]).range([area.left, area.right]);
  const y = d3.scaleLinear().domain([-padY, Math.max(1, maxY) + padY]).range([area.bottom, area.top]);
  const radius = d3.scaleSqrt().domain([0, d3.max(rows, row => row.published)]).range([4, 22]);
  const splitX = x(medianX);
  const splitY = y(medianY);
  const zones = [
    ["emerging", area.left, area.top, splitX, splitY],
    ["established", splitX, area.top, area.right, splitY],
    ["low", area.left, splitY, splitX, area.bottom],
    ["slowing", splitX, splitY, area.right, area.bottom]
  ];

  const svg = d3.select(container).append("svg").attr("id", "quad")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "group")
    .attr("aria-label", "Reconocimiento acumulado y nuevas obras reconocidas. Selecciona un punto para consultar sus artistas.");
  const backgrounds = svg.append("g").attr("aria-hidden", "true");
  backgrounds.selectAll("rect").data(zones).join("rect")
    .attr("class", ([key]) => `quadrant-zone ${key}`)
    .attr("x", ([, left]) => left).attr("y", ([,, top]) => top)
    .attr("width", ([, left,, right]) => right - left)
    .attr("height", ([,, top,, bottom]) => bottom - top);

  const ticksX = integerTicks(d3, maxX);
  const ticksY = integerTicks(d3, maxY);
  const guides = svg.append("g").attr("aria-hidden", "true");
  guides.append("g").attr("class", "recognition-axis")
    .attr("transform", `translate(0,${area.bottom})`)
    .call(d3.axisBottom(x).tickValues(ticksX).tickFormat(d3.format("d")).tickSizeInner(area.top - area.bottom)
      .tickSizeOuter(0).tickPadding(8));
  guides.append("g").attr("class", "recognition-axis")
    .attr("transform", `translate(${area.left},0)`)
    .call(d3.axisLeft(y).tickValues(ticksY).tickFormat(d3.format("d")).tickSizeInner(area.left - area.right)
      .tickSizeOuter(0).tickPadding(8));
  guides.append("line").attr("class", "median-guide")
    .attr("x1", splitX).attr("x2", splitX).attr("y1", area.top).attr("y2", area.bottom);
  guides.append("line").attr("class", "median-guide")
    .attr("x1", area.left).attr("x2", area.right).attr("y1", splitY).attr("y2", splitY);
  guides.selectAll(".quadrant-name").data(zones).join("text")
    .attr("class", ([key]) => `quadrant-name ${key}`)
    .attr("x", ([, left]) => left + 9)
    .attr("y", ([key,, top,, bottom]) => key === "low" || key === "slowing" ? bottom - 9 : top + 17)
    .text(([key]) => quadrants[key].toUpperCase());
  guides.append("text").attr("class", "recognition-axis-label").attr("text-anchor", "middle")
    .attr("x", (area.left + area.right) / 2).attr("y", height - 10).text("Reconocimiento acumulado");
  guides.append("text").attr("class", "recognition-axis-label").attr("text-anchor", "middle")
    .attr("transform", `translate(18,${(area.top + area.bottom) / 2}) rotate(-90)`).text("Nuevas obras reconocidas");

  const groups = Array.from(d3.group(rows, row => `${row.accumulated}:${row.current}`).values());
  const marks = svg.append("g").selectAll("g").data(groups).join("g")
    .attr("class", group => `artist-point ${group[0].quadrant}`)
    .attr("transform", ([row]) => `translate(${x(row.accumulated)},${y(row.current)})`)
    .attr("data-accumulated", ([row]) => row.accumulated)
    .attr("data-current", ([row]) => row.current)
    .attr("role", "button").attr("tabindex", 0)
    .attr("aria-label", group => {
      const [row] = group;
      const name = group.length === 1 ? row.name : `${format.format(group.length)} artistas`;
      return `${name}, ${row.accumulated} acumuladas, ${row.current} nuevas`;
    })
    .on("click", (_, group) => selectGroup(group))
    .on("keydown", (event, group) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectGroup(group);
      }
    });

  marks.append("title").text(group => group.length === 1
    ? `${group[0].name} · ${group[0].published} obras publicadas`
    : `${format.format(group.length)} artistas con los mismos valores. Selecciona para consultarlos.`);
  marks.selectAll(".artist-bubble").data(group => [...group].sort((a, b) => b.published - a.published))
    .join("circle").attr("class", "artist-bubble").attr("r", row => radius(row.published));
  marks.append("text").attr("class", "artist-point-label").attr("x", group =>
    radius(d3.max(group, row => row.published)) + 5).attr("dy", ".34em")
    .text(group => group.length > 1 ? `×${format.format(group.length)}` :
      (group[0].name.length > 14 ? `${group[0].name.slice(0, 13)}…` : group[0].name));


  const selection = svg.append("g").attr("class", "artist-selections").attr("aria-hidden", "true");
  return rows => {
    const ids = new Set(rows.map(row => row.id));
    marks.attr("aria-pressed", group => group.some(row => ids.has(row.id)));
    const rings = selection.selectAll("g").data(rows, row => row.id).join("g")
      .attr("transform", row => `translate(${x(row.accumulated)},${y(row.current)})`);
    rings.selectAll("circle").data((row, index) => [{ row, index }]).join("circle")
      .attr("class", "artist-highlight").attr("stroke", ({ index }) => selectionColors[index])
      .attr("r", ({ row, index }) => radius(row.published) + 4 + index * 2);
  };
}

function drawPodium(d3, ranking, summary, top, recognizedOnly, selectedIds, toggle) {
  summary.textContent = top.length ? "Por nuevas obras reconocidas. Selecciona un artista para comparar."
    : recognizedOnly ? "No hay emergentes para este género y año."
    : "No hay emergentes con estas medianas. Prueba el filtro de reconocimiento fechado.";
  const entries = d3.select(ranking).selectAll("li").data(top, row => row.id).join(enter => {
    const item = enter.append("li").attr("class", "podium-place");
    const button = item.append("button").attr("type", "button");
    button.append("span").attr("class", "podium-name");
    button.append("span").attr("class", "podium-value");
    button.append("span").attr("class", "podium-step").attr("aria-hidden", "true");
    return item;
  });
  const worksLabel = count => `${format.format(count)} ${count === 1 ? "obra nueva" : "obras nuevas"}`;
  entries.attr("data-place", (_, index) => index + 1);
  entries.select("button")
    .attr("aria-pressed", row => selectedIds.includes(row.id))
    .attr("aria-label", (row, index) => `Puesto ${index + 1}, ${row.name}, ${worksLabel(row.current)}`)
    .attr("title", row => row.name)
    .style("--artist-color", row => selectionColors[selectedIds.indexOf(row.id)] ?? null)
    .on("click", (_, row) => toggle(row.id));
  entries.select(".podium-name").text(row => row.name);
  entries.select(".podium-value").text(row => worksLabel(row.current));
  entries.select(".podium-step").text((_, index) => index + 1);
}

export function createRecognition(d3, graph, works) {
  const byId = id => document.getElementById(id);
  const catalog = catalogRecognition(graph);
  const year = byId("yearEm");
  const cohort = byId("cohort");
  const count = byId("recognition-count");
  const chart = byId("bubble-chart");
  const ranking = byId("rank");
  const summary = byId("emerging-summary");
  const details = byId("artist-details");
  const picker = byId("coordinate-artist");
  const metrics = byId("artist-metrics");
  const compare = byId("compare-artist");
  const firstYear = Math.min(works.firstYear, catalog.firstYear);
  const lastYear = Math.max(works.lastYear, catalog.lastYear);
  for (let value = firstYear; value <= lastYear; value++) year.add(new Option(value, value));
  year.value = Math.min(lastYear, Math.max(firstYear, 2029));

  let genre;
  let stats;
  let highlight;
  let selectedGroup = [];
  let selectedIds = [];

  function showArtist() {
    const row = selectedGroup[picker.selectedIndex];
    if (!row) return;
    metrics.textContent = `${quadrants[row.quadrant]} · ${row.published} obras publicadas · ${row.accumulated} reconocidas en total · ${row.current} nuevas`;
    compare.textContent = selectedIds.includes(row.id) ? "Quitar de la comparación" : "Comparar artista";
  }

  function refreshSelection() {
    const rows = selectedIds.map(id => stats.byId.get(id));
    highlight(rows);
    drawPodium(d3, ranking, summary, stats.top, cohort.value === "recognized", selectedIds, toggle);
    const roster = catalog.byGenre.get(genre);
    const comparisons = selectedIds.map(id => artistComparison(graph, works, roster.get(id), Number(year.value)));
    renderComparison(d3, comparisons, toggle);
    showArtist();
  }

  function toggle(id) {
    if (selectedIds.includes(id)) selectedIds = selectedIds.filter(previous => previous !== id);
    else selectedIds = [...selectedIds.slice(-3), id];
    refreshSelection();
  }

  function selectGroup(group) {
    selectedGroup = group;
    picker.replaceChildren(...group.map(row => new Option(row.name, String(row.id))));
    details.hidden = false;
    if (group.length === 1) toggle(group[0].id);
    else {
      showArtist();
      picker.focus();
    }
  }

  function render() {
    stats = recognitionStats(catalog, genre, Number(year.value), cohort.value === "recognized");
    stats.byId = new Map(stats.rows.map(row => [row.id, row]));
    selectedIds = selectedIds.filter(id => stats.byId.has(id));
    selectedGroup = [];
    details.hidden = true;
    count.textContent = stats.rows.length
      ? `${format.format(stats.rows.length)} artistas y bandas · Medianas de ${format.format(stats.medianX)} acumuladas y ${format.format(stats.medianY)} nuevas`
      : "No hay artistas que coincidan con estos filtros.";
    highlight = drawBubbles(d3, chart, stats, selectGroup);
    refreshSelection();
  }

  picker.addEventListener("change", showArtist);
  compare.addEventListener("click", () => {
    const row = selectedGroup[picker.selectedIndex];
    if (row) toggle(row.id);
  });
  for (const input of [year, cohort]) input.addEventListener("change", render);

  return {
    updateGenre(value) {
      if (genre === value) return;
      genre = value;
      selectedIds = [];
      render();
    }
  };
}
