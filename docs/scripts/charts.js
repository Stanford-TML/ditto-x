// Live user-study charts: horizontal bars (mean) + one dot per subject, drawn as SVG.
//
//   <figure class="study-chart" data-study="intervention" data-metric="success"
//           data-scale="pct" data-title="Success rate with intervention"></figure>
//
// data-study/data-metric pick a block from study-data.js; data-scale is "pct" (0-100 %)
// or "sec" (0-200 s, lower is better); data-title is the chart title.
//
// Emphasis form: DITTO-X / full feedback in the accent, the rest in grays. Palettes
// validated with the dataviz validator (light surface #fcfcfb):
//   accent vs MANUS gray        normal ΔE 26.4, deutan 21.2
//   accent / dark / light gray  normal ΔE 15.7, deutan 10.1
// Grays sit below 3:1 contrast, so every row carries a visible value label and the
// numbers are also in a table. Hovering a subject highlights them in every chart.

import STUDY from "./study-data.js";

const NS = "http://www.w3.org/2000/svg";
const COLOR = { ditto: "#A8334A", manus: "#A8A49C", full: "#A8334A", force: "#84817C", haptics: "#B4B1AC" };
const INK = { primary: "#2E2D29", secondary: "#585754", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7" };

const SCALES = {
  pct: { max: 100, ticks: [0, 25, 50, 75, 100], fmt: (v) => `${v.toFixed(1)}%`, tick: (v) => (v === 100 ? `${v}%` : `${v}`) },
  sec: { max: 200, ticks: [0, 50, 100, 150, 200], fmt: (v) => `${v.toFixed(1)} s`, tick: (v) => (v === 200 ? `${v} s` : `${v}`), note: "lower is better" },
};

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};

// Bar with a 4px rounded data-end and a square baseline end.
function barPath(x0, y, w, h, r = 4) {
  r = Math.min(r, w, h / 2);
  return `M${x0},${y}H${x0 + w - r}Q${x0 + w},${y} ${x0 + w},${y + r}V${y + h - r}Q${x0 + w},${y + h} ${x0 + w - r},${y + h}H${x0}Z`;
}

const pText = (p) => (p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`);
const noted = (node) => node.closest("[data-note-subject]")?.dataset.noteSubject;

function footText(block) {
  if (block.vsFull) {
    const [, ...rest] = block.series;
    return `Paired t-tests vs ${block.series[0].label.toLowerCase()}: ` +
      rest.map((s) => `${s.label.toLowerCase()} ${pText(block.vsFull[s.key].p)}`).join(", ") + " · dots are individual subjects";
  }
  return `Paired t-test, t(${block.df}) = ${Math.abs(block.t).toFixed(2)}, ${pText(block.p)} · dots are individual subjects`;
}

function render(fig) {
  const block = STUDY[fig.dataset.study][fig.dataset.metric];
  const sc = SCALES[fig.dataset.scale || "pct"];
  const note = noted(fig);
  fig.replaceChildren();

  const head = document.createElement("figcaption");
  head.className = "chart-title";
  head.innerHTML = `${fig.dataset.title}${sc.note ? ` <span>· ${sc.note}</span>` : ""}`;
  fig.appendChild(head);

  const cs = getComputedStyle(fig);
  const W = Math.max(240, fig.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  fig.dataset.renderedWidth = fig.clientWidth;
  const longest = Math.max(...block.series.map((s) => s.label.length));
  const labelW = longest > 8 ? 128 : 88, padR = 14, rowH = 46, barH = 20, top = block.chance ? 16 : 6, axisH = 26;
  const plotW = W - labelW - padR;
  const H = top + rowH * block.series.length + axisH;
  const x = (v) => labelW + (Math.min(v, sc.max) / sc.max) * plotW;

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
    "aria-label": `${fig.dataset.title}: ` + block.series.map((s) => `${s.label} ${sc.fmt(s.mean)}`).join(", ") });
  fig.appendChild(svg);

  // Gridlines + ticks (hairline, recessive); fewer ticks when narrow.
  const yEnd = top + rowH * block.series.length;
  const ticks = plotW < 260 ? sc.ticks.filter((_, i) => i % 2 === 0) : sc.ticks;
  for (const t of ticks) {
    el("line", { x1: x(t), x2: x(t), y1: top, y2: yEnd, stroke: t === 0 ? INK.axis : INK.grid, "stroke-width": 1 }, svg);
    const tx = el("text", { x: x(t), y: yEnd + 17, "text-anchor": t === 0 ? "start" : t === sc.max ? "end" : "middle", class: "tick" }, svg);
    tx.textContent = sc.tick(t);
  }
  // Chance reference line (identification tasks: 1 in 3).
  if (block.chance) {
    el("line", { x1: x(block.chance), x2: x(block.chance), y1: top - 4, y2: yEnd, stroke: INK.muted, "stroke-width": 1, "stroke-dasharray": "3 3" }, svg);
    el("text", { x: x(block.chance), y: top - 7, "text-anchor": "middle", class: "tick" }, svg).textContent = "random guess";
  }

  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;
  fig.appendChild(tip);
  const showTip = (html, cx, cy) => {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const padL = parseFloat(cs.paddingLeft), padT = parseFloat(cs.paddingTop);
    tip.style.left = `${Math.min(Math.max(cx - r.width / 2, 0), W - r.width) + padL}px`;
    tip.style.top = `${padT + head.offsetHeight + parseFloat(getComputedStyle(head).marginBottom) + cy - r.height - 8}px`;
  };
  const hideTip = () => { tip.hidden = true; };

  block.series.forEach((s, i) => {
    const y0 = top + i * rowH;
    const cy = y0 + rowH / 2;

    // Row label: name + mean (text in ink; the bar beside it carries the colour).
    el("text", { x: 0, y: cy - 3, class: "row-name" }, svg).textContent = s.label;
    el("text", { x: 0, y: cy + 13, class: "row-value" }, svg).textContent = sc.fmt(s.mean);

    el("path", { d: barPath(x(0), cy - barH / 2, Math.max(x(s.mean) - x(0), 1), barH), fill: COLOR[s.key], "aria-hidden": "true" }, svg);
    const hit = el("rect", { x: x(0), y: y0 + 4, width: plotW, height: rowH - 8, fill: "transparent" }, svg);
    hit.addEventListener("pointerenter", () => showTip(`<strong>${s.label}</strong> · mean ${sc.fmt(s.mean)}<br>SD ${sc.fmt(s.sd)} · ${s.values.length} subjects`, x(s.mean), y0));
    hit.addEventListener("pointerleave", hideTip);

    s.values.forEach((v, j) => {
      const subj = block.subjects[j];
      const jitter = ((j % 3) - 1) * 5; // separates equal values without implying order
      const g = el("g", { class: "subject", "data-subject": subj }, svg);
      el("circle", { cx: x(v), cy: cy + jitter, r: 4.5, fill: INK.primary, stroke: "#fff", "stroke-width": 2 }, g);
      if (subj === note) el("text", { x: x(v) + 5, y: cy + jitter - 5, class: "note-star" }, g).textContent = "*";
      const target = el("circle", { cx: x(v), cy: cy + jitter, r: 10, fill: "transparent" }, g);
      target.addEventListener("pointerenter", () => {
        document.querySelectorAll(`.study-chart .subject[data-subject="${subj}"]`).forEach((n) => n.classList.add("is-hot"));
        document.querySelectorAll(".study-chart").forEach((c) => c.classList.add("has-hot"));
        const rows = block.series.map((ss) => `${ss.label} ${sc.fmt(ss.values[j])}`).join("<br>");
        showTip(`<strong>Subject ${subj.slice(1)}${subj === note ? "*" : ""}</strong><br>${rows}`, x(v), y0);
      });
      target.addEventListener("pointerleave", () => {
        document.querySelectorAll(".study-chart .subject.is-hot").forEach((n) => n.classList.remove("is-hot"));
        document.querySelectorAll(".study-chart.has-hot").forEach((c) => c.classList.remove("has-hot"));
        hideTip();
      });
    });
  });

  const foot = document.createElement("p");
  foot.className = "chart-foot";
  foot.textContent = footText(block);
  fig.appendChild(foot);
}

// Data table (the accessible view of the same numbers), built from the charts it sits under.
//   <details class="chart-table" data-study="collection" data-metrics="success:pct:Success rate,time:sec:Time per success">
function renderTable(details) {
  const study = STUDY[details.dataset.study];
  const metrics = details.dataset.metrics.split(",").map((m) => { const [key, scale, label] = m.split(":"); return { key, sc: SCALES[scale], label }; });
  const first = study[metrics[0].key];
  const note = noted(details);
  const cells = (fn) => metrics.flatMap((m) => study[m.key].series.map((ser) => `<td>${m.sc.fmt(fn(ser))}</td>`)).join("");
  const rows = first.subjects.map((s, j) => `<tr><th scope="row">${s}${s === note ? "*" : ""}</th>${cells((ser) => ser.values[j])}</tr>`).join("");
  details.querySelector(".chart-table-body").innerHTML = `
    <table>
      <thead>
        <tr><th rowspan="2" scope="col">Subject</th>${metrics.map((m) => `<th colspan="${study[m.key].series.length}" scope="colgroup">${m.label}</th>`).join("")}</tr>
        <tr>${metrics.flatMap((m) => study[m.key].series.map((ser) => `<th scope="col">${ser.label}</th>`)).join("")}</tr>
      </thead>
      <tbody>${rows}<tr class="mean"><th scope="row">Mean</th>${cells((ser) => ser.mean)}</tr></tbody>
    </table>`;
}

const figs = [...document.querySelectorAll(".study-chart[data-study]")];
figs.forEach(render);
document.querySelectorAll(".chart-table[data-study]").forEach(renderTable);

// Redraw only when a chart's width actually changes (not on the observer's initial call).
let raf;
new ResizeObserver(() => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => figs.forEach((f) => { if (+f.dataset.renderedWidth !== f.clientWidth) render(f); }));
}).observe(document.querySelector(".article") || document.body);

// ---- Policy charts (DAgger) ------------------------------------------------------------
// Line chart, one small multiple per task:
//   <figure class="study-chart line-chart" data-kind="rounds" data-task="Tong"></figure>
// Grouped horizontal bars (tasks x conditions):
//   <figure class="study-chart" data-kind="quantity" data-title="..."></figure>
// Colours: DITTO-X accent vs MANUS gray (validated above); quantity chart reuses the
// validated accent / dark-gray / light-gray triple.
const POLICY = STUDY.policy;
const Q_COLOR = { pretrain: "#B4B1AC", qty: "#84817C", dagger: "#A8334A" };
const pctFmt = (v) => `${v.toFixed(1)}%`;
const countFmt = ([k, n]) => `${k}/${n}`;

function tipper(fig, cs, head) {
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;
  fig.appendChild(tip);
  return {
    show(html, cx, cy, W) {
      tip.innerHTML = html;
      tip.hidden = false;
      const r = tip.getBoundingClientRect();
      tip.style.left = `${Math.min(Math.max(cx - r.width / 2, 0), W - r.width) + parseFloat(cs.paddingLeft)}px`;
      tip.style.top = `${parseFloat(cs.paddingTop) + head.offsetHeight + parseFloat(getComputedStyle(head).marginBottom) + cy - r.height - 10}px`;
    },
    hide() { tip.hidden = true; },
  };
}

function chartFrame(fig, title) {
  fig.replaceChildren();
  const head = document.createElement("figcaption");
  head.className = "chart-title";
  head.innerHTML = title;
  fig.appendChild(head);
  const cs = getComputedStyle(fig);
  const W = Math.max(200, fig.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  fig.dataset.renderedWidth = fig.clientWidth;
  return { head, cs, W };
}

function renderRounds(fig) {
  const block = POLICY.rounds;
  const task = block.tasks.find((t) => t.task === fig.dataset.task);
  const { head, cs, W } = chartFrame(fig, task.task);
  const padL = 34, padR = 46, top = 10, H = 170, bottom = 24;
  const plotH = H - top - bottom;
  const xs = block.steps.map((_, i) => padL + (i / (block.steps.length - 1)) * (W - padL - padR));
  const y = (v) => top + plotH * (1 - v / 100);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
    "aria-label": `${task.task}: ` + task.series.map((s) => `${s.label} ${s.values.map(pctFmt).join(" → ")}`).join("; ") });
  fig.appendChild(svg);
  for (const t of [0, 50, 100]) {
    el("line", { x1: padL, x2: W - padR + 8, y1: y(t), y2: y(t), stroke: t === 0 ? INK.axis : INK.grid, "stroke-width": 1 }, svg);
    el("text", { x: padL - 6, y: y(t) + 4, "text-anchor": "end", class: "tick" }, svg).textContent = t === 100 ? "100%" : `${t}`;
  }
  const short = block.steps.map((st) => st.replace(/^Round /, "R")); // full names stay in the tooltip + table
  short.forEach((st, i) => {
    el("text", { x: xs[i], y: H - 6, "text-anchor": "middle", class: "tick" }, svg).textContent = st;
  });
  const tip = tipper(fig, cs, head);
  // Optional build-up for slides (unused on the site): data-upto="N" shows only the first N steps,
  // data-qty="off" hides the quantity-matched baseline. Axes stay identical so frames line up.
  const upto = Math.min(block.steps.length, +(fig.dataset.upto || block.steps.length));
  const showQty = fig.dataset.qty !== "off" && upto === block.steps.length;
  // MANUS first so DITTO-X draws on top.
  for (const s of [...task.series].reverse()) {
    const c = COLOR[s.key];
    if (upto > 1) el("polyline", { points: s.values.slice(0, upto).map((v, i) => `${xs[i]},${y(v)}`).join(" "), fill: "none", stroke: c, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    s.values.slice(0, upto).forEach((v, i) => {
      el("circle", { cx: xs[i], cy: y(v), r: 4.5, fill: c, stroke: "#fcfcfb", "stroke-width": 2 }, svg);
      const hit = el("circle", { cx: xs[i], cy: y(v), r: 12, fill: "transparent" }, svg);
      hit.addEventListener("pointerenter", () => tip.show(`<strong>${s.label}</strong> · ${block.steps[i]}<br>${pctFmt(v)} (${countFmt(s.counts[i])} rollouts)`, xs[i], y(v), W));
      hit.addEventListener("pointerleave", () => tip.hide());
    });
  }

  // Quantity-matched DITTO-X baseline: same data budget as round 2, collected without DAgger.
  // Drawn as a dashed line from the DITTO-X pretrain point to a hollow marker at round 2.
  const q = POLICY.quantity.tasks.find((t) => t.task === task.task);
  const last = upto - 1;
  const ditto = task.series.find((s) => s.key === "ditto");
  if (q && showQty) {
    const qv = q.values[1];
    el("line", { x1: xs[0], y1: y(ditto.values[0]), x2: xs[last], y2: y(qv), stroke: Q_COLOR.qty, "stroke-width": 1.5, "stroke-dasharray": "4 3" }, svg);
    el("circle", { cx: xs[last], cy: y(qv), r: 4.5, fill: "#fcfcfb", stroke: Q_COLOR.qty, "stroke-width": 2 }, svg);
    const hit = el("circle", { cx: xs[last], cy: y(qv), r: 12, fill: "transparent" }, svg);
    hit.addEventListener("pointerenter", () => tip.show(`<strong>DITTO-X, quantity-matched</strong><br>No DAgger, same data as round 2<br>${pctFmt(qv)} (${countFmt(q.counts[1])} rollouts)`, xs[last], y(qv), W));
    hit.addEventListener("pointerleave", () => tip.hide());
  }

  // End labels at round 2, nudged apart so they never overlap (min 15px).
  const ends = task.series.map((s) => ({ v: s.values[last], y: y(s.values[last]) }));
  if (q && showQty) ends.push({ v: q.values[1], y: y(q.values[1]), muted: true });
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  for (const e of ends) el("text", { x: xs[last] + 9, y: e.y + 4, class: e.muted ? "end-label muted" : "end-label" }, svg).textContent = pctFmt(e.v);
}

// Grouped horizontal bars: one row group per category, one bar per series.
function renderGrouped(fig, block, colors) {
  const { head, cs, W } = chartFrame(fig, fig.dataset.title);
  const longest = Math.max(...block.tasks.map((t) => t.task.length));
  const labelW = longest > 20 ? 232 : longest > 12 ? 190 : 88, padR = 48, barH = 12, gap = 3, rowPad = 16, axisH = 26, top = 4;
  const n = block.series.length;
  const rowH = n * barH + (n - 1) * gap + rowPad;
  const H = top + rowH * block.tasks.length + axisH;
  const plotW = W - labelW - padR;
  const x = (v) => labelW + (v / 100) * plotW;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
    "aria-label": `${fig.dataset.title}: ` + block.tasks.map((t) => `${t.task} ` + block.series.map((s, i) => `${s.label} ${pctFmt(t.values[i])}`).join(", ")).join("; ") });
  fig.appendChild(svg);
  const yEnd = top + rowH * block.tasks.length;
  const ticks = plotW < 260 ? [0, 50, 100] : [0, 25, 50, 75, 100];
  for (const t of ticks) {
    el("line", { x1: x(t), x2: x(t), y1: top, y2: yEnd, stroke: t === 0 ? INK.axis : INK.grid, "stroke-width": 1 }, svg);
    el("text", { x: x(t), y: yEnd + 17, "text-anchor": t === 0 ? "start" : "middle", class: "tick" }, svg).textContent = t === 100 ? "100%" : `${t}`;
  }
  const tip = tipper(fig, cs, head);
  block.tasks.forEach((t, r) => {
    const y0 = top + r * rowH + rowPad / 2;
    el("text", { x: 0, y: y0 + (n * barH + (n - 1) * gap) / 2 + 5, class: "row-name" }, svg).textContent = t.task;
    block.series.forEach((s, i) => {
      const yb = y0 + i * (barH + gap);
      el("path", { d: barPath(x(0), yb, Math.max(x(t.values[i]) - x(0), 1), barH, 3), fill: colors[s.key] }, svg);
      el("text", { x: x(t.values[i]) + 6, y: yb + barH - 2, class: "bar-value" }, svg).textContent = pctFmt(t.values[i]);
      const hit = el("rect", { x: x(0), y: yb - 1, width: plotW + padR, height: barH + 2, fill: "transparent" }, svg);
      hit.addEventListener("pointerenter", () => tip.show(`<strong>${t.task}</strong> · ${s.label}<br>${pctFmt(t.values[i])} (${countFmt(t.counts[i])} rollouts)`, x(t.values[i]), yb, W));
      hit.addEventListener("pointerleave", () => tip.hide());
    });
  });
}

function renderPolicyTable(details) {
  const R = POLICY.rounds, Q = POLICY.quantity;
  const rows = R.tasks.map((t) => {
    const q = Q.tasks.find((x) => x.task === t.task);
    const cells = t.series.flatMap((s) => s.counts.map((c, i) => `<td>${pctFmt(s.values[i])} <span class="n">${countFmt(c)}</span></td>`)).join("");
    return `<tr><th scope="row">${t.task}</th>${cells}<td>${pctFmt(q.values[1])} <span class="n">${countFmt(q.counts[1])}</span></td></tr>`;
  }).join("");
  details.querySelector(".chart-table-body").innerHTML = `
    <table>
      <thead>
        <tr><th rowspan="2" scope="col">Task</th>${R.tasks[0].series.map((s) => `<th colspan="3" scope="colgroup">${s.label}</th>`).join("")}<th rowspan="2" scope="col">Quantity-<br>matched</th></tr>
        <tr>${R.tasks[0].series.flatMap(() => R.steps.map((st) => `<th scope="col">${st}</th>`)).join("")}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

const policyFigs = [...document.querySelectorAll(".study-chart[data-kind]")];
const renderPolicy = (f) => {
  if (f.dataset.kind === "rounds") return renderRounds(f);
  if (f.dataset.kind === "proficient") return renderGrouped(f, STUDY.proficient, COLOR);
  return renderGrouped(f, POLICY.quantity, Q_COLOR);
};
policyFigs.forEach(renderPolicy);
document.querySelectorAll(".chart-table[data-kind='policy']").forEach(renderPolicyTable);
let raf2;
new ResizeObserver(() => {
  cancelAnimationFrame(raf2);
  raf2 = requestAnimationFrame(() => policyFigs.forEach((f) => { if (+f.dataset.renderedWidth !== f.clientWidth) renderPolicy(f); }));
}).observe(document.querySelector(".article") || document.body);
