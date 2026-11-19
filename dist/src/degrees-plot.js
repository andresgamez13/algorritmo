const series = ["incoming", "outgoing"];
const labels = { incoming: "Entrada", outgoing: "Salida" };

export function renderDegrees(d3, container, rows) {
  const width = 680;
  const margin = { top: 10, right: 34, bottom: 36, left: 162 };
  const height = margin.top + rows.length * 48 + margin.bottom;
  const maximum = Math.max(1, d3.max(rows, row => Math.max(row.incoming, row.outgoing)));
  const x = d3.scaleLinear().domain([0, maximum]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(rows.map(row => row.id))
    .range([margin.top, height - margin.bottom]).paddingInner(.22);
  const bar = d3.scaleBand().domain(series).range([0, y.bandwidth()]).padding(.12);
  const nodeLabels = new Map(rows.map(row => [row.id, String(row.label)]));
  const ticks = maximum < 7 ? d3.range(maximum + 1) : x.ticks(6);

  const svg = d3.select(container).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Gráfico de barras con los grados de entrada y salida de cada nodo");

  svg.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(ticks).tickFormat(d3.format("d"))
      .tickSizeInner(margin.top + margin.bottom - height).tickSizeOuter(0).tickPadding(8));

  svg.append("g").attr("class", "axis")
    .attr("transform", `translate(${margin.left - 12},0)`)
    .call(d3.axisLeft(y).tickSize(0).tickPadding(0).tickFormat(id => {
      const label = nodeLabels.get(id);
      return label.length > 17 ? `${label.slice(0, 16)}…` : label;
    }))
    .selectAll(".tick").append("title").text(id => nodeLabels.get(id));

  const marks = svg.append("g").selectAll("g")
    .data(rows.flatMap(row => series.map(key => ({
      id: row.id, label: row.label, key, value: row[key]
    }))))
    .join("g")
    .attr("transform", row => `translate(0,${y(row.id) + bar(row.key)})`);

  marks.append("rect")
    .attr("class", row => row.key)
    .attr("x", x(0))
    .attr("width", row => x(row.value) - x(0))
    .attr("height", bar.bandwidth());
  marks.append("text")
    .attr("class", "bar-value")
    .attr("x", row => x(row.value) + 6)
    .attr("y", bar.bandwidth() / 2)
    .attr("dominant-baseline", "central")
    .text(row => row.value);
  marks.append("title").text(row => `${row.label} · ${labels[row.key]} ${row.value}`);
}
