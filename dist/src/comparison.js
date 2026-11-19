import { influenceColors, influenceLabels } from "./timeline-data.js?v=3";

export const selectionColors = ["#2EC5CE", "#729DFF", "#C192FF", "#F7B54D"];
const types = Object.keys(influenceLabels);
const letters = "ABCD";
const width = 360;

function integerTicks(d3, maximum) {
  return maximum <= 4 ? d3.range(maximum + 1) : d3.ticks(0, maximum, 4).filter(Number.isInteger);
}

function drawHistory(d3, svg, rows) {
  const years = rows[0].annual.map(point => point.year);
  const max = Math.max(1, d3.max(rows.flatMap(row => row.annual), point => point.value));
  const x = d3.scaleLinear().domain(d3.extent(years)).range([35, width - 15]);
  const y = d3.scaleLinear().domain([0, max]).range([151, 16]);
  svg.append("g").attr("class", "comparison-axis").attr("transform", "translate(0,151)")
    .call(d3.axisBottom(x).tickValues([years[0], years[2], years[4], years[7]]).tickFormat(d3.format("d")).tickSizeOuter(0));
  svg.append("g").attr("class", "comparison-grid").attr("transform", "translate(35,0)")
    .call(d3.axisLeft(y).tickValues(integerTicks(d3, max)).tickFormat(d3.format("d")).tickSizeInner(35 + 15 - width).tickSizeOuter(0));

  const line = d3.line().x(point => x(point.year)).y(point => y(point.value));
  const series = svg.append("g").selectAll("g").data(rows).join("g")
    .attr("color", (_, index) => selectionColors[index]);
  series.append("path").attr("class", "comparison-series").attr("d", row => line(row.annual))
    .attr("fill", "none").attr("stroke", "currentColor").attr("stroke-width", 2)
    .append("title").text(row => row.name);
  series.selectAll("circle").data(row => row.annual.map(point => ({ ...point, name: row.name }))).join("circle")
    .attr("cx", point => x(point.year)).attr("cy", point => y(point.value)).attr("r", 2.8)
    .attr("fill", "currentColor").append("title").text(point => `${point.name} · ${point.year} · ${point.value}`);
}

function drawInfluences(d3, svg, rows) {
  const totals = rows.map(row => d3.sum(types, type => row.influences[type]));
  const x = d3.scaleLinear().domain([0, Math.max(1, d3.max(totals))]).range([28, width - 35]);
  const y = d3.scaleBand().domain(rows.map((_, index) => index)).range([8, 142]).padding(.26);
  rows.forEach((row, index) => {
    const group = svg.append("g").attr("class", "comparison-influences").attr("transform", `translate(0,${y(index)})`);
    const barHeight = Math.min(y.bandwidth(), 30);
    const offset = barHeight / 2 + 4;
    group.append("text").attr("x", 8).attr("y", offset).attr("fill", selectionColors[index]).text(letters[index]);
    let subtotal = 0;
    for (const type of types) {
      const count = row.influences[type];
      if (!count) continue;
      const start = x(subtotal);
      subtotal += count;
      group.append("rect").attr("x", start).attr("width", x(subtotal) - start)
        .attr("height", barHeight).attr("fill", influenceColors[type])
        .append("title").text(`${row.name} · ${influenceLabels[type]} · ${count}`);
    }
    group.append("text").attr("x", x(totals[index]) + 5).attr("y", offset).text(totals[index]);
  });
}

function drawProductivity(d3, svg, rows) {
  const x = d3.scaleBand().domain(rows.map((_, index) => index)).range([14, width - 14]).padding(.33);
  const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(rows, row => row.published))]).range([132, 24]);
  const groups = svg.selectAll("g").data(rows).join("g").attr("class", "comparison-productivity");
  groups.append("rect").attr("x", (_, index) => x(index)).attr("width", x.bandwidth())
    .attr("y", row => y(row.published)).attr("height", row => y(0) - y(row.published))
    .attr("fill", (_, index) => selectionColors[index]).attr("rx", 4)
    .append("title").text(row => `${row.name} · ${row.published} ${row.published === 1 ? "obra publicada" : "obras publicadas"}`);
  groups.append("text").attr("x", (_, index) => x(index) + x.bandwidth() / 2).attr("text-anchor", "middle")
    .attr("y", row => y(row.published) - 6).text(row => row.published);
  groups.append("text").attr("x", (_, index) => x(index) + x.bandwidth() / 2).attr("text-anchor", "middle")
    .attr("y", 147).attr("fill", (_, index) => selectionColors[index]).text((_, index) => letters[index]);
}

export function renderComparison(d3, rows, remove) {
  const empty = !rows.length;
  document.getElementById("cmpBody").hidden = empty;
  document.getElementById("comparison-empty").hidden = !empty;
  const chips = d3.select("#selbar").selectAll(".selchip").data(rows, row => row.id).join(enter => {
    const chip = enter.append("span").attr("class", "selchip");
    chip.append("i").attr("class", "dot").attr("aria-hidden", "true");
    chip.append("span");
    chip.append("button").attr("type", "button").text("×");
    return chip;
  });
  chips.select(".dot").style("background", (_, index) => selectionColors[index]);
  chips.select("span").text((row, index) => `${letters[index]} · ${row.name}`);
  chips.select("button").attr("aria-label", row => `Quitar ${row.name}`)
    .on("click", (_, row) => remove(row.id));
  if (empty) {
    d3.selectAll("#cmpBody svg").selectAll("*").remove();
    return;
  }

  const legend = d3.select("#comparison-legend").selectAll("span").data(types).join(enter => {
    const item = enter.append("span");
    item.append("i").attr("class", "dot").attr("aria-hidden", "true");
    item.append("small");
    return item;
  });
  legend.select(".dot").style("background", type => influenceColors[type]);
  legend.select("small").text(type => influenceLabels[type]);
  for (const [id, draw] of [["c1", drawHistory], ["c2", drawInfluences], ["c3", drawProductivity]]) {
    const svg = d3.select(`#${id}`);
    svg.selectAll("*").remove();
    draw(d3, svg, rows);
  }
}
