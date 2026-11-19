import { isArtist, personName, yearOf } from "./timeline-data.js?v=3";

export const quadrants = {
  emerging: "Emergentes",
  established: "Consolidados",
  low: "Baja tracción",
  slowing: "Pierden impulso"
};

export function catalogRecognition(graph) {
  const byGenre = new Map();
  let firstYear = Infinity;
  let lastYear = -Infinity;

  for (const work of graph.nodes) {
    const type = work["Node Type"];
    const year = yearOf(work.release_date);
    if ((type !== "Song" && type !== "Album") || !work.genre || year === null) continue;

    const recognitionYear = type === "Song" && work.notable === true ? yearOf(work.notoriety_date) : null;
    const performers = new Set(graph.incoming.get(work.id)
      .filter(edge => edge["Edge Type"] === "PerformerOf")
      .map(edge => edge.source));

    for (const id of performers) {
      const artist = graph.byId.get(id);
      if (!isArtist(artist)) continue;
      if (!byGenre.has(work.genre)) byGenre.set(work.genre, new Map());
      const roster = byGenre.get(work.genre);
      if (!roster.has(id)) roster.set(id, { id, name: personName(artist), works: [] });
      roster.get(id).works.push({ id: work.id, year, recognitionYear });
      firstYear = Math.min(firstYear, year);
      lastYear = Math.max(lastYear, year, recognitionYear ?? year);
    }
  }

  return { byGenre, firstYear, lastYear };
}

function median(values) {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function quadrantFor(row, medianX, medianY) {
  if (row.current > medianY) return row.accumulated <= medianX ? "emerging" : "established";
  return row.accumulated <= medianX ? "low" : "slowing";
}

export function recognitionStats(catalog, genre, year, recognizedOnly) {
  const rows = [];
  for (const artist of catalog.byGenre.get(genre)?.values() ?? []) {
    let published = 0;
    let accumulated = 0;
    let current = 0;
    for (const work of artist.works) {
      if (work.year > year) continue;
      published++;
      if (work.recognitionYear === null || work.recognitionYear > year) continue;
      accumulated++;
      if (work.recognitionYear === year) current++;
    }
    if (published && (!recognizedOnly || accumulated > 0)) {
      rows.push({ id: artist.id, name: artist.name, published, accumulated, current });
    }
  }

  const medianX = median(rows.map(row => row.accumulated));
  const medianY = median(rows.map(row => row.current));
  rows.sort((a, b) => a.name.localeCompare(b.name, "es"));
  for (const row of rows) row.quadrant = quadrantFor(row, medianX, medianY);
  const top = rows.filter(row => row.quadrant === "emerging")
    .sort((a, b) => b.current - a.current).slice(0, 3);
  return { rows, medianX, medianY, top };
}
