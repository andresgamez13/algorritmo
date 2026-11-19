export const influenceLabels = {
  CoverOf: "Cover",
  DirectlySamples: "Sample",
  InterpolatesFrom: "Interpolación",
  InStyleOf: "Estilo",
  LyricalReferenceTo: "Referencia lírica"
};

export const influenceColors = {
  CoverOf: "#2EC5CE",
  DirectlySamples: "#3B82F6",
  InterpolatesFrom: "#A259F7",
  InStyleOf: "#F59E0B",
  LyricalReferenceTo: "#22C55E"
};

export function yearOf(value) {
  return /^\d{4}$/.test(String(value)) ? Number(value) : null;
}

function compareWorks(a, b) {
  return (a.year ?? Infinity) - (b.year ?? Infinity) || a.name.localeCompare(b.name, "es");
}

export function personName(person) {
  return person.stage_name || person.name || String(person.id);
}

export function isArtist(node) {
  return node["Node Type"] === "Person" || node["Node Type"] === "MusicalGroup";
}

export function catalogWorks(graph) {
  const byId = new Map();
  const byGenre = new Map();
  let firstYear = Infinity;
  let lastYear = -Infinity;

  for (const node of graph.nodes) {
    const kind = node["Node Type"];
    if (kind !== "Song" && kind !== "Album") continue;
    const year = yearOf(node.release_date);
    const work = { ...node, kind, name: node.name || String(node.id), year };
    byId.set(work.id, work);
    if (year === null || !work.genre) continue;
    if (!byGenre.has(work.genre)) byGenre.set(work.genre, []);
    byGenre.get(work.genre).push(work);
    firstYear = Math.min(firstYear, year);
    lastYear = Math.max(lastYear, year);
  }

  for (const works of byGenre.values()) works.sort(compareWorks);
  return { byId, byGenre, firstYear, lastYear };
}

function relatedWorks(works, links, id, endpoint) {
  const matches = new Map();
  for (const link of links) {
    const type = link["Edge Type"];
    const work = works.byId.get(link[endpoint]);
    if (!work || work.id === id || !Object.hasOwn(influenceLabels, type)) continue;
    if (!matches.has(work.id)) matches.set(work.id, { work, types: new Set() });
    matches.get(work.id).types.add(type);
  }
  return Array.from(matches.values()).sort((a, b) => compareWorks(a.work, b.work));
}

export function workInfluences(graph, works, id) {
  return {
    influenced: relatedWorks(works, graph.incoming.get(id), id, "source"),
    inspirations: relatedWorks(works, graph.outgoing.get(id), id, "target")
  };
}
