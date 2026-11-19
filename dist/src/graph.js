function validId(id) {
  return (typeof id === "string" && id.trim() !== "") || Number.isFinite(id);
}

export function indexGraph(data) {
  if (!Array.isArray(data?.nodes) || !Array.isArray(data?.links)) {
    throw new Error('El JSON debe incluir los arreglos "nodes" y "links".');
  }

  const byId = new Map();
  const incoming = new Map();
  const outgoing = new Map();

  for (const node of data.nodes) {
    if (!validId(node?.id) || byId.has(node.id)) {
      throw new Error(`Identificador de nodo inválido o duplicado (${node?.id}).`);
    }
    byId.set(node.id, node);
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }

  const linkIds = new Set();
  const edgeKeys = new Set();
  for (const link of data.links) {
    if (!byId.has(link?.source) || !byId.has(link?.target)) {
      throw new Error(`Arista con origen o destino desconocido (${link?.source} → ${link?.target}).`);
    }
    if (link.id === undefined && data.multigraph === true) {
      const identity = JSON.stringify([link.source, link.target, link.key]);
      if (!validId(link.key) || edgeKeys.has(identity)) {
        throw new Error(`Clave de arista inválida o duplicada (${identity}).`);
      }
      edgeKeys.add(identity);
    } else {
      if (!validId(link.id) || linkIds.has(link.id)) {
        throw new Error(`Identificador de arista inválido o duplicado (${link.id}).`);
      }
      linkIds.add(link.id);
    }
    outgoing.get(link.source).push(link);
    incoming.get(link.target).push(link);
  }

  return { nodes: data.nodes, links: data.links, byId, incoming, outgoing };
}

export function degrees(graph) {
  return graph.nodes.map(({ id, label }) => ({
    id,
    label: label ?? String(id),
    incoming: graph.incoming.get(id).length,
    outgoing: graph.outgoing.get(id).length
  }));
}

export function reachableFrom(graph, startId) {
  if (!graph.byId.has(startId)) {
    throw new Error(`Nodo desconocido (${startId}).`);
  }
  const visited = new Set([startId]);
  const queue = [startId];
  for (let i = 0; i < queue.length; i += 1) {
    for (const { target } of graph.outgoing.get(queue[i])) {
      if (!visited.has(target)) {
        visited.add(target);
        queue.push(target);
      }
    }
  }
  return queue.slice(1);
}
