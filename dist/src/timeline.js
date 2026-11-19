const baselinePadding = 116;
const yearGap = 22;
const firstSongOffset = 23;
const rowGap = 16;
const inset = 32;

function arcPath(start, end, width) {
  const dx = end.x - start.x;
  if (dx === 0) {
    if (start.y === end.y) {
      return `M${start.x},${start.y} C${start.x - 24},${start.y - 49} ${start.x + 24},${start.y - 49} ${end.x},${end.y}`;
    }
    const direction = start.x <= width / 2 ? 1 : -1;
    const side = direction * (24 + Math.min(50, Math.abs(start.y - end.y) / 3));
    return `M${start.x},${start.y} C${start.x + side},${start.y} ${end.x + side},${end.y} ${end.x},${end.y}`;
  }

  const top = Math.min(0, start.y, end.y) - Math.min(80, 25 + Math.abs(dx) * .21);
  return `M${start.x},${start.y} C${start.x + dx * .15},${top} ${end.x - dx * .15},${top} ${end.x},${end.y}`;
}

function layoutPoints(d3, songs, x, openYears) {
  const groups = d3.groups(songs, song => song.year).sort(([a], [b]) => a - b);
  const largest = d3.max(groups, ([, members]) => members.length) ?? 2;
  const radius = d3.scaleSqrt().domain([2, Math.max(3, largest)]).range([8.5, 10.5]);
  const points = [];
  const bySongId = new Map();

  for (const [year, members] of groups) {
    const cx = x(year);
    const clustered = members.length > 1;
    const open = clustered && openYears.has(year);
    if (clustered) {
      const anchor = {
        key: `year:${year}`, kind: "year", year, x: cx, y: 0, open,
        count: members.length, radius: open ? 8 : radius(members.length)
      };
      points.push(anchor);
      if (!open) {
        for (const song of members) bySongId.set(song.id, anchor);
        continue;
      }
    }

    members.forEach((song, index) => {
      const offset = firstSongOffset + Math.floor(index / 2) * rowGap;
      const point = {
        ...song, key: `song:${JSON.stringify(song.id)}`, kind: "song", x: cx,
        y: open ? (index % 2 ? offset : -offset) : 0
      };
      points.push(point);
      bySongId.set(song.id, point);
    });
  }

  return { points, bySongId };
}

function position(point) {
  return `translate(${point.x},${point.y})`;
}

function yearLabel(point, affected) {
  const action = point.open ? "Cerrar grupo" : "Abrir grupo";
  const related = !point.open && affected ? ` · ${affected} con influencia de la obra seleccionada` : "";
  return `${point.year} · ${point.count} obras${related} · ${action}`;
}

export function createTimeline(d3, container, onSelect) {
  const svg = d3.select(container).append("svg").attr("id", "tlViz")
    .attr("role", "group")
    .attr("aria-label", "Obras agrupadas por año");
  const grid = svg.append("g").attr("aria-hidden", "true");
  const baseline = grid.append("line").attr("class", "timeline-baseline");
  const years = grid.append("g");
  const plane = svg.append("g");
  const arcs = plane.append("g").attr("aria-hidden", "true");
  const markers = plane.append("g");
  const openYears = new Set();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let state;
  let tabStop;
  let containerWidth;
  let previousBaseline;

  function activate(point) {
    tabStop = point.key;
    if (point.kind === "song") {
      onSelect(point.id);
      return;
    }

    if (point.open) openYears.delete(point.year);
    else openYears.add(point.year);
    draw(true);
  }

  function draw(animate = false) {
    const { songs, from, to, selectedId, influences } = state;
    containerWidth = container.clientWidth;
    const width = Math.max(containerWidth, 320, (to - from) * yearGap + inset * 2);
    const x = d3.scaleLinear().domain([from, to]).range([inset, width - inset]);
    const { points, bySongId } = layoutPoints(d3, songs, x, openYears);
    const selected = bySongId.get(selectedId);
    const top = d3.min(points, point => point.y) ?? 0;
    const bottom = d3.max(points, point => point.y) ?? 0;
    const axisY = baselinePadding - top;
    const height = axisY + bottom + 32;
    const oldScrollTop = container.scrollTop;

    if (!points.some(point => point.key === tabStop)) tabStop = selected?.key ?? points[0]?.key;
    svg.attr("width", width).attr("height", height);
    plane.attr("transform", `translate(0,${axisY})`);
    baseline.attr("x1", inset).attr("x2", width - inset).attr("y1", axisY).attr("y2", axisY);
    if (previousBaseline !== undefined && axisY !== previousBaseline) {
      container.scrollTop = oldScrollTop + axisY - previousBaseline;
    }
    previousBaseline = axisY;

    const ticks = from === to ? [from] : [
      from,
      ...x.ticks(Math.floor(width / 115)).filter(year =>
        Number.isInteger(year) && x(year) - inset > 54 && width - inset - x(year) > 54
      ),
      to
    ];
    const labels = years.selectAll("g").data(ticks).join(enter => {
      const tick = enter.append("g");
      tick.append("line").attr("class", "timeline-grid").attr("y1", 28);
      tick.append("text").attr("class", "timeline-year").attr("y", 20).attr("text-anchor", "middle");
      return tick;
    }).attr("transform", year => `translate(${x(year)},0)`);
    labels.select("line").attr("y2", height - 14);
    labels.select("text").text(year => year);

    // Preserve each link's key so its path can move between a year and its individual work.
    const affected = new Map();
    const links = [];
    if (selected) {
      for (const { work } of influences) {
        const end = bySongId.get(work.id);
        if (!end) continue;
        const count = affected.get(end.key) ?? 0;
        affected.set(end.key, count + 1);
        links.push({ id: work.id, end, visible: count === 0 });
      }
    }
    const transition = animate && !reduceMotion.matches ? svg.transition().duration(220) : null;
    const paths = arcs.selectAll("path").interrupt()
      .data(links, link => JSON.stringify(link.id))
      .join("path").attr("class", "influence-arc")
      .attr("data-target-song-id", link => link.id)
      .attr("data-endpoint", link => link.end.kind)
      .attr("data-target-year", link => link.end.year);
    (transition ? paths.transition(transition) : paths)
      .attr("d", link => arcPath(selected, link.end, width))
      .style("opacity", link => link.visible ? 1 : 0);

    const marks = markers.selectAll(".timeline-marker").interrupt().data(points, point => point.key).join(
      enter => {
        const mark = enter.append("g").attr("role", "button")
          .attr("class", point => `timeline-marker ${point.kind}-marker`)
          .attr("transform", point => position(transition ? { ...point, y: 0 } : point));
        mark.append("title");

        const workMarks = mark.filter(point => point.kind === "song");
        workMarks.append("circle").attr("class", "song-hit").attr("r", 8);
        workMarks.append("circle").attr("class", "song-ring").attr("r", 7);
        workMarks.append("circle").attr("class", "song-point").attr("r", 4.5);

        const yearMarks = mark.filter(point => point.kind === "year");
        yearMarks.append("circle").attr("class", "year-hit");
        yearMarks.append("circle").attr("class", "year-ring");
        yearMarks.append("circle").attr("class", "year-point");
        yearMarks.append("text").attr("class", "year-count").attr("aria-hidden", "true");

        return mark;
      },
      update => update,
      exit => {
        exit.attr("tabindex", -1).attr("aria-hidden", "true").style("pointer-events", "none");
        if (!transition) {
          exit.remove();
          return;
        }
        exit.transition(transition)
          .attr("transform", point => position({ ...point, y: 0 }))
          .style("opacity", 0)
          .remove();
      }
    )
      .attr("tabindex", point => point.key === tabStop ? 0 : -1)
      .attr("aria-hidden", null)
      .style("pointer-events", null)
      .attr("data-year", point => point.year)
      .classed("is-selected", point => point.key === selected?.key)
      .on("focus", (_, point) => {
        tabStop = point.key;
        marks.attr("tabindex", mark => mark.key === tabStop ? 0 : -1);
      })
      .on("click", (_, point) => activate(point))
      .on("keydown", (event, point) => {
        const index = points.indexOf(point);
        let target;
        switch (event.key) {
          case "Enter":
          case " ":
            activate(point);
            break;
          case "ArrowRight":
          case "ArrowDown":
            target = points[Math.min(index + 1, points.length - 1)];
            break;
          case "ArrowLeft":
          case "ArrowUp":
            target = points[Math.max(index - 1, 0)];
            break;
          case "Home":
            target = points[0];
            break;
          case "End":
            target = points.at(-1);
            break;
          default:
            return;
        }
        event.preventDefault();
        if (target) marks.filter(mark => mark.key === target.key).node().focus();
      });

    (transition ? marks.transition(transition) : marks).attr("transform", position).style("opacity", 1);

    const songMarks = marks.filter(point => point.kind === "song")
      .attr("data-song-id", point => point.id)
      .attr("aria-label", point => `${point.name}, ${point.year}`)
      .attr("aria-pressed", point => point.id === selectedId);
    songMarks.select("title").text(point => `${point.year} · ${point.name}`);
    songMarks.select(".song-point").attr("r", point => point.id === selectedId ? 5.5 : 4.5);

    const yearMarks = marks.filter(point => point.kind === "year")
      .classed("is-open", point => point.open)
      .attr("aria-expanded", point => point.open)
      .attr("aria-label", point => yearLabel(point, affected.get(point.key)));
    yearMarks.select("title").text(point => yearLabel(point, affected.get(point.key)));
    yearMarks.select(".year-hit").attr("r", point => Math.max(point.radius, 10));
    yearMarks.select(".year-ring").attr("r", point => point.radius + 2);
    yearMarks.select(".year-point").attr("r", point => point.radius);
    yearMarks.select(".year-count").style("font-size", point => point.radius < 10 ? "9px" : "11px")
      .text(point => point.open ? "−" : point.count);
  }

  new ResizeObserver(() => {
    if (state && container.clientWidth > 0 && container.clientWidth !== containerWidth) draw();
  }).observe(container);

  return {
    update(next) {
      state = next;
      container.hidden = !state.songs.length;
      draw();
    }
  };
}
