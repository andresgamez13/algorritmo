import { influenceLabels, isArtist, personName } from "./timeline-data.js?v=3";

const esc = value => String(value).replace(/[&<>"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
})[char]);

export function drawWorkDetail(d3, graph, work, relations, visibleCount) {
  const detail = document.getElementById("workDetail");
  const wrapper = document.getElementById("work-network");
  const message = document.getElementById("network-empty");
  wrapper.hidden = !relations?.influenced.length && !relations?.inspirations.length;
  message.hidden = !wrapper.hidden;

  if (!work) {
    detail.innerHTML = '<p class="empty">Selecciona una obra en la línea de tiempo.</p>';
    message.textContent = "Selecciona una obra.";
    return;
  }

  const performers = new Set(graph.incoming.get(work.id)
    .filter(edge => edge["Edge Type"] === "PerformerOf")
    .map(edge => edge.source));
  const names = Array.from(performers, id => graph.byId.get(id)).filter(isArtist).map(personName);
  const { influenced, inspirations } = relations;
  const songCount = influenced.filter(({ work }) => work.kind === "Song").length;
  detail.innerHTML = `
    <div>
      <h2>${esc(work.name)} (${work.year})</h2>
      <p class="kv">${esc(work.genre)} · ${work.kind === "Song" ? "Canción" : "Álbum"}</p>
      <p class="kv">En listas de éxitos · <b>${work.notable === true ? "Sí" : "No"}</b></p>
      ${work.notoriety_date ? `<p class="kv">Primer reconocimiento · <b>${esc(work.notoriety_date)}</b></p>` : ""}
      ${work.written_date ? `<p class="kv">Año de composición · <b>${esc(work.written_date)}</b></p>` : ""}
      <p class="kv">Intérpretes · <b>${names.length ? names.map(esc).join(", ") : "Sin registro"}</b></p>
    </div>
    <div>
      <h3>Obras en las que influyó</h3>
      <p class="sub">${influenced.length} obras en el grafo (${songCount} canciones) · ${visibleCount} con arco en la línea de tiempo</p>
      <ul class="plain infl">${influenced.map(({ work: dependent, types }) => `
        <li><b>${esc(dependent.name)}</b>
          <span>${dependent.year ?? "Sin año"} · ${esc(dependent.genre ?? "Sin género")} · ${Array.from(types, type => influenceLabels[type]).join(", ")}</span>
        </li>`).join("")}</ul>
    </div>`;

  message.textContent = "Esta obra no tiene influencias registradas con otras obras.";
  if (!wrapper.hidden) {
    drawNetwork(d3, wrapper.querySelector("svg"), work, influenced, inspirations);
    wrapper.scrollTop = 0;
  }
}

function drawNetwork(d3, element, work, influenced, inspirations) {
  const width = 420;
  const top = 38;
  const spacing = 57;
  const height = Math.max(125, top * 2 + (Math.max(influenced.length, inspirations.length) - 1) * spacing);
  const root = { work, x: 210, y: top, kind: "root" };
  const neighbors = [
    ...inspirations.map((relation, index) => ({ ...relation, x: 66, y: top + index * spacing, kind: "in" })),
    ...influenced.map((relation, index) => ({ ...relation, x: 354, y: top + index * spacing, kind: "out" }))
  ];

  const svg = d3.select(element).attr("viewBox", `0 0 ${width} ${height}`);
  svg.selectAll("*").remove();
  const defs = svg.append("defs");
  const colors = { in: "#5FD0D6", out: "#C9A7FF" };
  for (const [kind, color] of Object.entries(colors)) {
    defs.append("marker").attr("id", `arrow-${kind}`).attr("viewBox", "0 0 10 10")
      .attr("refX", 9).attr("refY", 5).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
      .append("path").attr("d", "M0,0 L10,5 L0,10 Z").attr("fill", color);
  }
  svg.append("g").selectAll("path").data(neighbors).join("path")
    .attr("class", "influence-network-edge")
    .attr("fill", "none")
    .attr("stroke", node => colors[node.kind]).attr("stroke-opacity", .72)
    .attr("stroke-dasharray", node => node.kind === "in" ? "4 3" : null)
    .attr("marker-end", node => `url(#arrow-${node.kind})`)
    .attr("d", node => {
      const [start, end] = node.kind === "in" ? [node, root] : [root, node];
      const x1 = start.x + 53;
      const x2 = end.x - 54;
      const mid = (x1 + x2) / 2;
      return `M${x1},${start.y} C${mid},${start.y} ${mid},${end.y} ${x2},${end.y}`;
    });
  const nodes = svg.append("g").selectAll("g").data([root, ...neighbors]).join("g")
    .attr("class", node => `influence-network-node ${node.kind}`)
    .attr("transform", node => `translate(${node.x},${node.y})`);
  nodes.append("title").text(node => [node.work.name, ...Array.from(node.types ?? [], type => influenceLabels[type])].join(" · "));
  nodes.append("rect").attr("x", -52).attr("y", -21).attr("width", 104).attr("height", 42).attr("rx", 8)
    .attr("fill", node => ({ root: "#6333AD", out: "#30215A", in: "#163D47" })[node.kind]);
  nodes.append("text").attr("y", -2).attr("text-anchor", "middle").attr("fill", "#F1ECFF").attr("font-size", 11)
    .text(node => node.work.name.length > 14 ? `${node.work.name.slice(0, 13)}…` : node.work.name);
  nodes.append("text").attr("y", 12).attr("text-anchor", "middle").attr("fill", "#D9D4EC").attr("font-size", 10)
    .text(node => node.work.year ?? "");
}
