const NODE_RADIUS = 12;

function simulationLinks(graph) {
  const order = new Map(graph.nodes.map(({ id }, index) => [id, index]));
  const groups = new Map();
  for (const link of graph.links) {
    const source = order.get(link.source);
    const target = order.get(link.target);
    const key = `${Math.min(source, target)}:${Math.max(source, target)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...link, direction: source <= target ? 1 : -1 });
  }

  return Array.from(groups.values()).flatMap(group =>
    group.map((link, index) => ({
      ...link,
      bend: (index - (group.length - 1) / 2) * 42 * link.direction,
      loopAngle: -Math.PI / 2 + 2 * Math.PI * index / group.length
    }))
  );
}

function pointToward(origin, x, y, distance) {
  const dx = x - origin.x;
  const dy = y - origin.y;
  const length = Math.hypot(dx, dy) || 1;
  return [origin.x + distance * dx / length, origin.y + distance * dy / length];
}

function edgePath({ source, target, bend, loopAngle }) {
  if (source === target) {
    const point = (angle, radius) =>
      [source.x + Math.cos(angle) * radius, source.y + Math.sin(angle) * radius];
    const start = point(loopAngle - .65, NODE_RADIUS);
    const end = point(loopAngle + .65, NODE_RADIUS + 2);
    const first = point(loopAngle - .55, 62);
    const second = point(loopAngle + .55, 62);
    return `M${start} C${first} ${second} ${end}`;
  }

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const x = (source.x + target.x) / 2 - dy * bend / length;
  const y = (source.y + target.y) / 2 + dx * bend / length;
  const start = pointToward(source, x, y, NODE_RADIUS);
  const end = pointToward(target, x, y, NODE_RADIUS + 2);
  return `M${start} Q${x},${y} ${end}`;
}

export function renderNetwork(d3, container, graph) {
  // D3 modifica las posiciones de los nodos y sustituye los extremos de las aristas.
  const nodes = graph.nodes.map(node => ({ ...node }));
  const links = simulationLinks(graph);
  const svg = d3.select(container).append("svg")
    .attr("role", "img")
    .attr("aria-label", "Red de nodos con flechas que indican la dirección de las aristas");

  svg.append("defs").append("marker")
    .attr("id", "network-arrow")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 10)
    .attr("refY", 5)
    .attr("markerWidth", 7)
    .attr("markerHeight", 7)
    .attr("orient", "auto")
    .append("path")
    .attr("class", "arrow")
    .attr("d", "M0,0 L10,5 L0,10 Z");

  const layer = svg.append("g");
  const edges = layer.append("g").selectAll("path")
    .data(links).join("path")
    .attr("class", "edge")
    .attr("marker-end", "url(#network-arrow)");
  edges.append("title").text(link => {
    const source = graph.byId.get(link.source);
    const target = graph.byId.get(link.target);
    return `${source.label ?? source.id} → ${target.label ?? target.id} (${link.label ?? link.id})`;
  });

  const nodeMarks = layer.append("g").selectAll("g")
    .data(nodes).join("g").attr("class", "node");
  nodeMarks.append("circle").attr("r", NODE_RADIUS);
  nodeMarks.append("text").attr("x", NODE_RADIUS + 6).attr("dy", ".35em")
    .text(node => node.label ?? node.id);

  const viewport = svg.node();
  const centerX = d3.forceX(viewport.clientWidth / 2).strength(.08);
  const centerY = d3.forceY(viewport.clientHeight / 2).strength(.08);
  const linkForce = d3.forceLink(links).id(node => node.id)
    .distance(105)
    .strength(link => link.source === link.target ? 0 : .25);
  const simulation = d3.forceSimulation(nodes)
    .force("links", linkForce)
    .force("charge", d3.forceManyBody().strength(-390))
    .force("collision", d3.forceCollide(26))
    .force("x", centerX)
    .force("y", centerY);

  function draw() {
    edges.attr("d", edgePath);
    nodeMarks.attr("transform", node => `translate(${node.x},${node.y})`);
  }

  simulation.tick(90);
  simulation.on("tick", draw);
  draw();

  const zoom = d3.zoom()
    .extent(() => [[0, 0], [viewport.clientWidth, viewport.clientHeight]])
    .scaleExtent([.25, 4])
    .on("zoom", event => layer.attr("transform", event.transform));
  svg.call(zoom);

  nodeMarks.call(d3.drag()
    .on("start", (event, node) => {
      if (!event.active) simulation.alphaTarget(.25).restart();
      node.fx = node.x;
      node.fy = node.y;
    })
    .on("drag", (event, node) => {
      node.fx = event.x;
      node.fy = event.y;
    })
    .on("end", (event, node) => {
      if (!event.active) simulation.alphaTarget(0);
      node.fx = null;
      node.fy = null;
    }));

  const observer = new ResizeObserver(() => {
    centerX.x(viewport.clientWidth / 2);
    centerY.y(viewport.clientHeight / 2);
    simulation.alpha(.3).restart();
  });
  observer.observe(viewport);

  return {
    zoomBy: factor => svg.call(zoom.scaleBy, factor),
    resetView: () => svg.call(zoom.transform, d3.zoomIdentity)
  };
}
