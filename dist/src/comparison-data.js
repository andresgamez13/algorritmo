import { influenceLabels } from "./timeline-data.js?v=3";

export function artistComparison(graph, works, artist, year) {
  const firstYear = year - 7;
  const countsByYear = new Map();
  const influences = Object.fromEntries(Object.keys(influenceLabels).map(type => [type, 0]));
  let accumulated = 0;
  let published = 0;

  for (const work of artist.works) {
    if (work.year > year) continue;
    published++;
    if (work.recognitionYear !== null && work.recognitionYear <= year) {
      if (work.recognitionYear < firstYear) {
        accumulated++;
      } else {
        const count = countsByYear.get(work.recognitionYear) ?? 0;
        countsByYear.set(work.recognitionYear, count + 1);
      }
    }

    for (const link of graph.incoming.get(work.id)) {
      const type = link["Edge Type"];
      if (!Object.hasOwn(influenceLabels, type) || link.source === work.id) continue;
      const dependent = works.byId.get(link.source);
      if (dependent?.year != null && dependent.year <= year) influences[type]++;
    }
  }

  const annual = Array.from({ length: 8 }, (_, index) => {
    const year = firstYear + index;
    accumulated += countsByYear.get(year) ?? 0;
    return { year, value: accumulated };
  });
  return { id: artist.id, name: artist.name, annual, influences, published };
}
