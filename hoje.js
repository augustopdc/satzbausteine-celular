"use strict";
/* Tela Hoje: anel da meta do dia, roteiro (cartões → leitura → diário), sequência da semana, trilha até a Approbation e escrita.
   Tudo é calculado por regra a partir do progresso; nada aqui grava dados. */
const HOJE_NAME = "Luiz";
const HOJE_READ_MIN = 10, HOJE_DIARY_MIN = 3;
const hoje = {seenIncomplete: false, routeDone: null};
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function hojeReadMs(day = dateKey()) {
  const r = (progress.practice || {}).reading, d = r && r.days && r.days[day];
  return Number(d && d.ms) || 0;
}
function hojeDiaryDone(day = dateKey()) {
  return typeof escritaTexts === "function" && escritaTexts().some(t => t.kind === "diario" && t.ref === "diario|" + day);
}
/* Roteiro do dia. No plantão e no pós-plantão a leitura fica opcional; o diário (3 min) vale todo dia. */
function hojeRoute(load) {
  const total = load.dueProd + load.dueListen + load.fresh;
  const stats = (progress.dayStats || {})[dateKey()] || {}, rest = load.plan.type === "plantao" || load.plan.type === "pos";
  const readMin = Math.floor(hojeReadMs() / 60000), diary = hojeDiaryDone();
  const cardsMin = total ? Math.max(1, Math.ceil(total * averageSeconds() / 60)) : 0;
  const doneMin = Math.round((stats.ms || 0) / 60000);
  return [
    {id: "cards", title: "Cartões", done: !total, min: cardsMin,
      meta: total ? plural(load.dueProd + load.dueListen, "revisão", "revisões") + " e " + plural(load.fresh, "nova", "novas") : stats.reviews ? plural(stats.reviews, "avaliação", "avaliações") + " hoje" : "Nada pendente",
      time: total ? "~" + cardsMin + " min" : doneMin ? doneMin + " min" : ""},
    {id: "reading", title: "Leitura com áudio", done: readMin >= HOJE_READ_MIN, optional: rest, min: Math.max(0, HOJE_READ_MIN - readMin),
      meta: rest && !readMin ? "Opcional hoje" : readMin ? readMin + " de " + HOJE_READ_MIN + " min" : HOJE_READ_MIN + " min de livro",
      progress: Math.min(1, readMin / HOJE_READ_MIN), time: readMin >= HOJE_READ_MIN ? readMin + " min" : HOJE_READ_MIN - readMin + " min"},
    {id: "diary", title: "Diário", done: diary, min: diary ? 0 : HOJE_DIARY_MIN,
      meta: "3 frases", time: HOJE_DIARY_MIN + " min"}
  ];
}
function hojeNext(items) { return items.find(i => !i.done && !i.optional) || items.find(i => !i.done) || null; }
/* Minutos feitos hoje (treino + leitura + diário) e a meta: o tempo escolhido, ou o que o roteiro pede. */
function hojeMinutes(load, items) {
  const stats = (progress.dayStats || {})[dateKey()] || {};
  const done = Math.round((stats.ms || 0) / 60000 + hojeReadMs() / 60000 + (hojeDiaryDone() ? HOJE_DIARY_MIN : 0));
  const left = items.filter(i => !i.done && !i.optional).reduce((s, i) => s + i.min, 0);
  return {done, goal: load.budget || Math.max(10, done + left), complete: !left};
}
function hojeGo(id) {
  if (id === "cards") { $("homeProduction").click(); return; }
  if (id === "reading") { navGo("reading"); return; }
  if (id === "diary") { Object.assign(escrita, {view: "editor", spec: escritaDiarySpec()}); navGo("escrita"); }
}

/* O anel enche a partir do valor anterior (na primeira vez, do zero) e o número conta até o valor novo. */
function hojeRing(box, m) {
  const r = 54, c = 2 * Math.PI * r, pct = m.complete ? 1 : Math.min(1, m.goal ? m.done / m.goal : 0);
  const prev = Number(box.dataset.pct || 0), prevDone = Number(box.dataset.done || 0), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dash = p => (c * p).toFixed(1) + " " + c.toFixed(1);
  const svg = svgEl("svg", {viewBox: "0 0 132 132", width: 132, height: 132, "aria-hidden": "true"});
  const bar = svgEl("circle", {cx: 66, cy: 66, r, class: "ring-bar" + (pct > 0 || prev > 0 ? "" : " empty"), "stroke-dasharray": dash(still ? pct : prev), transform: "rotate(-90 66 66)"});
  svg.append(svgEl("circle", {cx: 66, cy: 66, r, class: "ring-track"}), bar);
  const num = h("b", {text: still ? m.done : prevDone});
  fill(box, svg, h("div", {class: "ring-center"}, m.complete ? icon("check", 34) : num, h("span", {text: m.complete ? "meta cumprida" : "de " + m.goal + " min"})));
  box.dataset.pct = pct;
  box.dataset.done = m.done;
  if (!still) {
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.setAttribute("stroke-dasharray", dash(pct)); if (pct > 0) bar.classList.remove("empty"); }));
    if (!m.complete && m.done !== prevDone) {
      const t0 = performance.now(), from = prevDone, to = m.done;
      const step = now => { const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3); num.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
  }
  box.classList.toggle("complete", m.complete);
  box.setAttribute("aria-label", m.complete ? "Meta de hoje cumprida" : m.done + " de " + m.goal + " minutos de estudo hoje");
}
/* Anel pequeno da meta do dia ao lado de “Hoje” no menu (e no ícone da aba, no celular). */
function navRing(m) {
  const btn = document.querySelector('.nav-hub[data-hub="hoje"]');
  if (!btn) return;
  let ring = $("navRing");
  if (!ring) {
    ring = svgEl("svg", {id: "navRing", class: "nav-ring", viewBox: "0 0 20 20", "aria-hidden": "true"});
    ring.append(svgEl("circle", {cx: 10, cy: 10, r: 7.5, class: "t"}), svgEl("circle", {cx: 10, cy: 10, r: 7.5, class: "b", transform: "rotate(-90 10 10)"}));
    btn.append(ring);
  }
  const c = 2 * Math.PI * 7.5, pct = m.complete ? 1 : Math.min(1, m.goal ? m.done / m.goal : 0);
  ring.querySelector(".b").setAttribute("stroke-dasharray", (c * pct).toFixed(1) + " " + c.toFixed(1));
  ring.classList.toggle("done", !!m.complete);
  ring.classList.toggle("zero", pct === 0);
  btn.title = "Hoje · " + (m.complete ? "meta cumprida" : m.done + " de " + m.goal + " min");
}
function hojeCelebrate() {
  const ring = $("heroRing");
  ring.classList.remove("celebrate");
  void ring.offsetWidth;
  ring.classList.add("celebrate");
  setTimeout(() => ring.classList.remove("celebrate"), 1600);
  toast("Meta de hoje cumprida. Até amanhã!", "success");
  uiSound("meta");
}
function hojeRouteList(items, next) {
  const before = hoje.routeDone, now = new Set(items.filter(it => it.done).map(it => it.id));
  hoje.routeDone = now;
  const fresh = before ? [...now].filter(id => !before.has(id)) : [];
  if (fresh.length && navigator.vibrate) navigator.vibrate(15);
  fill($("homeRoute"), items.map(it => {
    let bar = null;
    if (!it.done && it.progress > 0) { const fillEl = h("i"); setWidth(fillEl, it.progress * 100); bar = h("span", {class: "route-bar"}, fillEl); }
    return h("li", {class: "route-item" + (it.done ? " done" : it === next ? " now" : "") + (fresh.includes(it.id) ? " just-done" : "") + (it.optional && !it.done ? " optional" : "")},
      h("button", {class: "route-btn", type: "button", onclick: () => hojeGo(it.id)},
        h("span", {class: "route-mark"}, it.done ? icon("check", 14) : null),
        h("span", {class: "route-text"}, h("b", {text: it.title}),
          h("span", {class: "route-meta"}, it.de ? h("i", {lang: "de", class: "route-de", text: it.de}) : it.meta), bar),
        h("span", {class: "route-time", text: it.done ? "" : it.time})));
  }));
}

/* Semana de segunda a domingo: estudou, hoje, plantão/pós (não quebra a sequência), futuro ou dia perdido. */
function hojeWeek() {
  const today = dateKey(), base = new Date(today + "T12:00:00");
  base.setDate(base.getDate() - (base.getDay() + 6) % 7);
  return ["S", "T", "Q", "Q", "S", "S", "D"].map((label, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const k = dateKey(d), type = dayType(k), studied = Number(progress.days[k] || 0) > 0;
    const st = studied ? "ok" : k === today ? "today" : type === "plantao" || type === "pos" ? "rest" : k > today ? "future" : "miss";
    return {label, st, title: d.toLocaleDateString("pt-BR", {weekday: "long", day: "numeric"}) + ": " + {ok: "estudou", today: "hoje", rest: SHIFT_LABELS[type].toLowerCase(), future: "ainda não chegou", miss: "sem estudo"}[st]};
  });
}
function hojeSpark(values) {
  const w = 200, hgt = 40, max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => (values.length === 1 ? w / 2 : i / (values.length - 1) * w).toFixed(1) + "," + (4 + (1 - (v - min) / span) * (hgt - 8)).toFixed(1)).join(" ");
  const svg = svgEl("svg", {class: "spark", viewBox: "0 0 " + w + " " + hgt, preserveAspectRatio: "none", "aria-hidden": "true"});
  svg.append(svgEl("polyline", {points: pts, "vector-effect": "non-scaling-stroke"}));
  return svg;
}
function hojeTile(iconName, label, value, unit, extra, sub, tone) {
  return h("section", {class: "tile" + (tone ? " " + tone : "")},
    h("div", {class: "tile-head"}, icon(iconName, 17), h("span", {text: label})),
    h("p", {class: "tile-value"}, h("b", {text: value}), unit ? h("span", {text: unit}) : null),
    extra, sub ? h("small", {text: sub}) : null);
}
function hojeTiles() {
  const st = streak(), best = bestStreak();
  const week = h("div", {class: "week"}, hojeWeek().map(d => h("span", {class: "wk wk-" + d.st, title: d.title},
    h("i", null, d.st === "ok" ? icon("check", 12) : d.st === "rest" ? "P" : null), h("small", {text: d.label}))));
  const lv = levelSummary(), li = LEVELS.indexOf(lv.level), plan = planSettings();
  const trail = h("div", {class: "trail"}, LEVELS.map((l, i) => {
    const seg = h("span", {class: "trail-seg"}, h("i"));
    setWidth(seg.firstChild, i < li ? 100 : i === li ? lv.pct : 0);
    return h("span", {class: "trail-step"}, seg, h("small", {text: l === "B2" ? "B2 · FSP" : l}));
  }));
  const b2 = daysUntil(plan.b2), move = daysUntil(plan.move);
  const learned = cards.filter(studied).length, acc = accuracy30();
  const texts = typeof escritaTexts === "function" ? escritaTexts().filter(t => t.fb && escritaWords(t.v1).length).slice(0, 8).reverse() : [];
  const es = texts.length ? escritaStats() : null, rates = texts.map(escritaRate);
  const trend = rates.length >= 2 ? Math.round((rates[rates.length - 1] - rates[0]) / Math.max(.1, rates[0]) * 100) : null;
  return [
    hojeTile("flame", "Sequência", String(st), st === 1 ? "dia" : "dias", week, best > st ? "Recorde: " + best + " dias. Plantão não quebra a sequência." : "Plantão não quebra a sequência.", "warm"),
    hojeTile("target", "Rumo à Approbation", lv.level, lv.pct + "% dominado", trail,
      (b2 > 0 ? "B2 em " + formatDate(plan.b2, {month: "long", year: "numeric"}) : "Meta do B2 no Meu plano") + (move > 0 ? ", mudança em " + move.toLocaleString("pt-BR") + " dias." : ".")),
    hojeTile("book", "Aprendidas", learned.toLocaleString("pt-BR"), learned === 1 ? "frase" : "frases", null,
      acc.pct == null ? "Sem avaliações nos últimos 30 dias" : acc.pct + "% de acerto em 30 dias (" + plural(acc.reviews, "avaliação", "avaliações") + ")"),
    // Precisão (palavras sem erro) em vez de “erros por 100 palavras”: o número absoluto fica na tela da Escrita.
    hojeTile("pen", "Escrita", es && es.rate != null ? Math.max(0, Math.round(100 - es.rate)) + "%" : "—", es && es.rate != null ? "de precisão" : "",
      rates.length >= 5 ? hojeSpark(rates.map(r => 100 - r)) : null,
      !texts.length ? "Escreva o diário de hoje para começar." : trend == null ? "Média dos últimos textos." : trend <= 0 ? Math.abs(trend) + "% menos erros desde o início" : "Erros subiram " + trend + "%: vale rever as correções.")
  ];
}

/* Monta a tela Hoje (chamado pelo renderHome do app.js, que cuida do resto: calendário, previsão, avisos). */
function renderHoje(load) {
  const items = hojeRoute(load), next = hojeNext(items), m = hojeMinutes(load, items);
  const total = load.dueProd + load.dueListen + load.fresh, now = new Date(), hour = now.getHours(), type = load.plan.type;
  const date = now.toLocaleDateString("pt-BR", {weekday: "long", day: "numeric", month: "long"});
  $("homeGreeting").textContent = date.charAt(0).toUpperCase() + date.slice(1) + (type === "plantao" ? ", dia de plantão" : type === "pos" ? ", pós-plantão" : type === "folga" ? ", dia de folga" : "");
  $("homeHeadline").textContent = (hour < 5 ? "Boa noite" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite") + ", " + HOJE_NAME + ".";
  $("homeSub").textContent = !next ? "Tudo feito por hoje. Bom descanso!" : "";
  $("homeSub").hidden = !!next;
  hojeRing($("heroRing"), m);
  navRing(m);
  // Comemora só quando a meta fecha durante o uso (abrir o app com ela já cumprida não conta).
  if (!m.complete) hoje.seenIncomplete = true;
  else if (hoje.seenIncomplete) { hoje.seenIncomplete = false; hojeCelebrate(); }
  hojeRouteList(items, next);
  $("heroNext").textContent = !next ? "Tudo feito por hoje"
    : next.id === "cards" ? (total === 1 ? "1 cartão para hoje" : total + " cartões para hoje")
    : next.id === "reading" ? "Leitura com áudio, mais " + next.min + " min"
    : "Diário: 3 frases sobre o seu dia";
  $("heroDue").textContent = load.dueProd;
  $("heroNew").textContent = load.fresh;
  $("heroListen").textContent = load.dueListen;
  document.querySelector("#hero .hero-split").hidden = true; // o detalhe fica no roteiro
  $("heroEta").textContent = total ? "Cerca de " + Math.max(1, Math.ceil(total * averageSeconds() / 60)) + " min de cartões"
    : next ? "Cartões em dia." : restrictedToday(load.plan) ? "Nada mais para hoje. Descanse." : "Se quiser mais: um molde, uma cena ou frases novas.";
  const cardsNext = next && next.id === "cards";
  const nextBtn = $("homeNext");
  nextBtn.hidden = !next || cardsNext;
  if (next && !cardsNext) { fill(nextBtn, icon("play", 16), next.id === "reading" ? "Continuar a leitura" : "Escrever o diário"); nextBtn.onclick = () => hojeGo(next.id); }
  $("homeProduction").classList.toggle("primary", !!cardsNext);
  $("homeProduction").textContent = load.dueProd + load.fresh ? "Treinar produção" : "Estudar mais novas";
  $("homeListening").textContent = load.dueListen ? "Treinar escuta (" + load.dueListen + ")" : "Treinar escuta";
  $("homeListening").hidden = !load.dueListen;
  $("hero").classList.toggle("done", !next);
  fill($("homeMetrics"), hojeTiles());
}
