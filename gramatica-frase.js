/* O desenho da frase alemã (24/10/2026, rodada 3 da Gramática): os campos da frase (1º lugar | verbo | meio | fim, a
   Satzklammer) e as palavras indo para o lugar certo com mola (FLIP). Um desenho só para seis tópicos: v2, separáveis,
   modais, Perfekt, subordinada e o exercício “Transforme” (comece com Heute… / responda com weil).
   Tudo por regra e conservador: só frases de uma oração, sujeito pronome e verbo em 2º lugar; na dúvida, a frase fica de fora. */
const GF_PRON = /^(ich|du|er|sie|es|wir|ihr|man|Sie)$/;
// Advérbios de tempo que podem ir para o 1º lugar sozinhos (com o substantivo de período que vier logo depois: heute Abend).
const GF_TIME = new Set(["heute", "morgen", "jetzt", "gestern", "später", "bald", "dann", "danach", "oft", "manchmal", "immer", "abends", "morgens", "mittags",
  "nachmittags", "vormittags", "nachts", "übermorgen", "gleich", "sofort", "zuerst", "endlich", "montags", "dienstags", "mittwochs", "donnerstags", "freitags", "samstags", "sonntags"]);
const GF_TIME_NEXT = /^(früh|Abend|Morgen|Mittag|Nachmittag|Vormittag|Nacht)$/;
const GF_NOT_VERB = new Set(["auch", "nicht", "noch", "schon", "gern", "gerne", "sehr", "nur", "bitte", "ja", "nein", "so", "mal", "doch", "immer", "oft", "hier", "da", "dort", "kein", "keine"]);
const GF_MODAL = /^(kann|kannst|können|könnt|konnte|konnten|muss|musst|müssen|müsst|musste|mussten|will|willst|wollen|wollt|wollte|wollten|soll|sollst|sollen|sollt|sollte|sollten|darf|darfst|dürfen|dürft|durfte|möchte|möchtest|möchten|möchtet|werde|wirst|wird|werden|werdet|würde|würdest|würden)$/;
const GF_PERF = /^(habe|hast|hat|haben|habt|bin|bist|ist|sind|seid)$/;
const GF_EN_ADV = new Set(["morgen", "unten", "oben", "dagegen", "trotzdem", "zusammen", "wegen", "gegen", "selten", "drinnen", "draußen", "hinten", "vorne", "neben", "zwischen", "einen", "keinen", "meinen", "deinen", "seinen", "ihren", "unseren", "den", "denen", "ihnen", "Ihnen"]);
const gfLow = w => w === "Sie" ? w : w.toLocaleLowerCase("de");
const gfCap = w => w.charAt(0).toLocaleUpperCase("de") + w.slice(1);
/* Uma oração principal simples: {words, punct, fin, subj, end, kind} ou null.
   fin = verbo conjugado (sempre o 2º elemento), subj = sujeito pronome (antes ou logo depois do verbo),
   end = 2ª parte do verbo no fim (infinitivo depois de modal, particípio depois de haben/sein, prefixo separável). */
function gfMain(text) {
  const raw = String(text || "").trim();
  if (!raw || /[,;:"„“”()–—\n]/.test(raw) || !/[.!]$/.test(raw)) return null;
  const punct = raw.slice(-1), words = raw.slice(0, -1).trim().split(/\s+/);
  if (words.length < 3 || words.length > 10 || words.some(w => /[^\p{L}\p{N}'-]/u.test(w))) return null;
  if (words.slice(1).some(w => /^(und|oder|aber|denn|sondern|weil|dass|wenn|ob|als|obwohl|damit)$/i.test(w))) return null;
  const verbish = w => /^\p{Ll}/u.test(w) && !GF_NOT_VERB.has(w) && !GF_TIME.has(w) && !GF_PRON.test(w);
  // “Sie” no começo pode ser ela ou o senhor: fica de fora.
  const p0 = words[0].toLocaleLowerCase("de");
  let subj;
  if (GF_PRON.test(p0) && words[0] !== "Sie" && verbish(words[1])) subj = 0;
  else if (!GF_PRON.test(p0) && /^\p{Lu}/u.test(words[0]) && verbish(words[1]) && GF_PRON.test(words[2])) subj = 2;
  else return null;
  const fin = 1, last = words.length - 1, fv = words[fin].toLocaleLowerCase("de"), lw = words[last];
  let end = -1, kind = null;
  if (last - fin >= 2 && /^\p{Ll}/u.test(lw)) {
    if (GF_MODAL.test(fv) && /(en|ern|eln)$/.test(lw) && !GF_EN_ADV.has(lw)) { end = last; kind = "modal"; }
    else if (GF_PERF.test(fv) && typeof rdNonFinite === "function" && rdNonFinite(lw)) { end = last; kind = "perfekt"; }
    else if (!GF_MODAL.test(fv) && !GF_PERF.test(fv) && typeof RD_PARTICLES !== "undefined" && RD_PARTICLES.has(lw)) { end = last; kind = "trennbar"; }
  }
  return {words, punct, fin, subj, end, kind};
}
const gfTokens = words => words.map((w, id) => ({id, w}));
const gfText = (toks, punct) => toks.map(t => t.w).join(" ") + punct;
/* Campos da frase principal: 1º lugar | verbo | meio | fim. */
function gfMainFields(toks, finIdx, endIdx) {
  return toks.map((t, k) => ({...t, f: k < finIdx ? "vorfeld" : k === finIdx ? "verbo" : endIdx >= 0 && k >= endIdx ? "fim" : "meio"}));
}
/* “Comece com Heute”: Ich habe heute keine Zeit. → Heute habe ich keine Zeit. */
function gfFront(text) {
  const m = gfMain(text);
  if (!m || m.subj !== 0) return null;
  const k = m.words.findIndex((w, j) => j > m.fin && j !== m.end && GF_TIME.has(w));
  if (k < 0) return null;
  const take = k + 1 < m.words.length && k + 1 !== m.end && GF_TIME_NEXT.test(m.words[k + 1]) ? 2 : 1;
  const src = gfTokens(m.words), moved = src.slice(k, k + take);
  const out = [{...moved[0], w: gfCap(moved[0].w)}, ...moved.slice(1), src[m.fin], {...src[0], w: gfLow(src[0].w)},
    ...src.filter((t, j) => j > m.fin && (j < k || j >= k + take))];
  const to = gfMainFields(out, take, m.end >= 0 ? out.findIndex(t => t.id === m.end) : -1);
  return {from: src, to, punct: m.punct, text: gfText(out, m.punct), start: moved.map(t => gfCap(t.w)).join(" "), moved: [...moved.map(t => t.id), 0]};
}
/* “Responda com weil”: Ich kann heute nicht kommen. → Weil ich heute nicht kommen kann. (separável junta: aufstehe). */
function gfWeil(text) {
  const m = gfMain(text);
  if (!m || m.subj !== 0 || m.punct !== ".") return null;
  const src = gfTokens(m.words), n = src.length;
  const weil = {id: n, w: "Weil", f: "conj"}, subj = {...src[0], w: gfLow(src[0].w), f: "meio"};
  let tail, mid = src.filter((t, j) => j > m.fin && j !== m.end).map(t => ({...t, f: "meio"}));
  if (m.kind === "trennbar") tail = [{id: n + 1, w: m.words[m.end].toLocaleLowerCase("de") + m.words[m.fin], f: "fim"}];
  else if (m.end >= 0) tail = [{...src[m.end], f: "fim"}, {...src[m.fin], f: "fim"}];
  else tail = [{...src[m.fin], f: "fim"}];
  const to = [weil, subj, ...mid, ...tail];
  return {from: src, to, punct: ".", text: gfText(to, "."), start: "Weil", moved: tail.map(t => t.id)};
}
/* Ordem “do português” para a demonstração de cada tópico (o erro típico) → ordem certa. */
function gfDemo(topic, text) {
  if (topic === "nebensatz") {
    const w = gfWeil(text);
    if (!w || w.to.length < 4) return null;
    // weil ich habe heute keine Zeit → weil ich heute keine Zeit habe (só o verbo conjugado anda)
    const fin = w.to[w.to.length - 1];
    if (fin.id >= w.from.length) return null;
    return {from: [w.to[0], w.to[1], fin, ...w.to.slice(2, -1)], to: w.to, punct: ".", moved: [fin.id]};
  }
  const m = gfMain(text);
  if (!m) return null;
  const src = gfTokens(m.words), to = gfMainFields(src, m.fin, m.end);
  if (topic === "v2" && m.subj === 2) return {from: [src[0], src[2], src[1], ...src.slice(3)], to, punct: m.punct, moved: [m.fin, m.subj]};
  if ((topic === "modal" && m.kind === "modal") || (topic === "perfekt" && m.kind === "perfekt"))
    return {from: [...src.slice(0, m.fin + 1), src[m.end], ...src.slice(m.fin + 1, m.end)], to, punct: m.punct, moved: [m.end]};
  if (topic === "trennbar" && m.kind === "trennbar")
    return {from: [...src.slice(0, m.fin), {...src[m.end], glue: true}, src[m.fin], ...src.slice(m.fin + 1, m.end)], to, punct: m.punct, moved: [m.end]};
  return null;
}
const GF_LABELS = {vorfeld: "1º lugar", verbo: "verbo", meio: "meio", fim: "fim", conj: "conjunção"};
function gfMotion() { return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && document.visibilityState === "visible"; }
/* Palavras que mudaram de lugar: as que ficam fora da maior sequência que manteve a ordem. */
function gfMoved(from, to) {
  const rank = new Map(from.map((t, k) => [t.id, k])), seq = to.filter(t => rank.has(t.id)).map(t => rank.get(t.id));
  const len = seq.map(() => 1), prev = seq.map(() => -1);
  for (let i = 0; i < seq.length; i++) for (let j = 0; j < i; j++) if (seq[j] < seq[i] && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prev[i] = j; }
  const keep = new Set();
  for (let i = len.indexOf(Math.max(0, ...len)); i >= 0; i = prev[i]) keep.add(seq[i]);
  return from.filter((t, k) => !keep.has(k) && to.some(x => x.id === t.id)).map(t => t.id);
}
function gfRow(toks, withFields, punct) {
  const row = h("div", {class: "gf-row", lang: "de"});
  let field = null;
  for (const t of toks) {
    const el = h("span", {class: "gf-w" + (t.glue ? " glue" : ""), dataset: {id: String(t.id)}, text: t.w});
    if (withFields && t.f) {
      if (!field || field.dataset.f !== t.f) { field = h("span", {class: "gf-field f-" + t.f, dataset: {f: t.f, label: GF_LABELS[t.f]}}); row.append(field); }
      field.append(el);
    } else row.append(el);
  }
  if (punct) row.append(h("span", {class: "gf-punct", text: punct}));
  return row;
}
/* Mostra a ordem “from” e, depois de uma pausa, leva cada palavra até o lugar dela na ordem “to” (com os campos). */
function gfPlay(box, demo, {hold = 650} = {}) {
  const {from, to} = demo, moved = new Set(demo.moved || gfMoved(from, to));
  const finish = () => {
    const before = new Map([...box.querySelectorAll(".gf-w")].map(el => [el.dataset.id, el.getBoundingClientRect()]));
    fill(box, gfRow(to, true, demo.punct));
    box.classList.add("done");
    const anim = gfMotion() && typeof Element.prototype.animate === "function";
    for (const el of box.querySelectorAll(".gf-w")) {
      const id = el.dataset.id, old = before.get(id), now = el.getBoundingClientRect();
      if (moved.has(Number(id))) el.classList.add("moved");
      if (!anim) continue;
      if (!old) { el.animate([{opacity: 0, transform: "translateY(-6px)"}, {opacity: 1, transform: "none"}], {duration: 420, delay: 380, easing: "ease-out", fill: "backwards"}); continue; }
      const dx = old.left - now.left, dy = old.top - now.top;
      if (Math.abs(dx) + Math.abs(dy) < 1) continue;
      el.animate([{transform: "translate(" + dx + "px," + dy + "px)"}, {transform: "none"}], {duration: 700, easing: "cubic-bezier(.34, 1.36, .64, 1)"});
    }
  };
  fill(box, gfRow(from, false, demo.punct));
  box.classList.remove("done");
  clearTimeout(box.gfTimer);
  if (!gfMotion()) { finish(); return; }
  box.gfTimer = setTimeout(() => { if (document.contains(box)) finish(); }, hold);
}
/* Bloco do tópico: “Como a frase se monta” com um exemplo do seu nível. */
const GF_DEMO_TOPICS = {v2: "O verbo fica no 2º lugar; o sujeito pula para depois dele.", trennbar: "O prefixo se solta do verbo e vai para o fim.",
  modal: "O modal fica no 2º lugar; o outro verbo vai para o fim.", perfekt: "haben/sein no 2º lugar; o particípio fecha a frase.",
  nebensatz: "Depois de weil, o verbo conjugado vai para o fim."};
function gfDemoExample(topic) {
  const list = typeof exPool === "function" ? exPool(topic === "nebensatz" ? null : topic) : [];
  for (const c of list.filter(studied).concat(list)) { const d = gfDemo(topic, c.frase); if (d) return {d, card: c}; }
  return null;
}
function gfDiagram(topic) {
  if (!GF_DEMO_TOPICS[topic]) return null;
  const ex = gfDemoExample(topic);
  if (!ex) return null;
  const box = h("div", {class: "gf-stage", "aria-label": "Diagrama da frase"});
  const play = () => gfPlay(box, ex.d);
  const sec = h("section", {class: "gf-diagram"},
    h("div", {class: "row between"}, h("h3", {class: "label", text: "Como a frase se monta"}),
      h("button", {class: "quiet small", type: "button", onclick: play}, iconText("repeat", "Ver de novo", 15))),
    box,
    h("p", {class: "muted small-text", text: GF_DEMO_TOPICS[topic] + " " + (ex.card.traducao ? "(" + ex.card.traducao + ")" : "")}));
  play();
  return sec;
}
/* ---------- Exercício “Transforme” ---------- */
function transformItem(card, topic) {
  if (!card || !card.frase || /\n/.test(card.frase)) return null;
  const modes = topic === "v2" ? ["front"] : topic === "nebensatz" ? ["weil"] : ["front", "weil"];
  for (const mode of modes) {
    const r = mode === "front" ? gfFront(card.frase) : gfWeil(card.frase);
    if (r) return {kind: "transform", mode, card, r, topic: mode === "front" ? "v2" : "nebensatz", correct: r.text};
  }
  return null;
}
function renderTransformItem(item) {
  const input = h("textarea", {id: "exInput", class: "ex-fix-input", rows: 2, autocomplete: "off", autocapitalize: "off", spellcheck: "false", lang: "de", "aria-label": "Frase transformada"});
  input.value = item.r.start + " ";
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); checkTransform(); } });
  fill($("grammarDetail"), ...exHeader(),
    h("div", {class: "ex-situation"}, h("p", {class: "muted small-text", text: item.mode === "front" ? "Comece a frase com “" + item.r.start + "”:" : "Warum? Responda com weil:"}),
      h("p", {class: "gram-err-de", lang: "de", text: item.card.frase}), h("p", {class: "muted small-text", text: item.card.traducao})),
    input, umlautRow(input),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: checkTransform}, "Conferir", h("kbd", null, "Enter")),
      h("button", {class: "quiet", type: "button", onclick: () => { if (ex.answered) return; input.readOnly = true; exGrade(false); }}, "Não sei")),
    h("div", {id: "exFeedback", class: "pron-feedback"}));
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
function checkTransform() {
  const item = ex.items[ex.i], input = $("exInput");
  if (ex.answered || !input) return;
  const mine = input.value.trim();
  input.readOnly = true;
  input.blur();
  exGrade(gramErrNorm(mine) === gramErrNorm(item.correct), mine);
}
/* Depois de responder: a frase se monta na tela (a sua ordem ou a frase de partida → a certa, com os campos). */
function gfFeedback(item, ok, mine) {
  let demo = null;
  if (item.kind === "transform") demo = {from: item.r.from, to: item.r.to, punct: item.r.punct, moved: item.r.moved};
  else if (item.kind === "build") {
    const m = gfMain(item.card.frase), toks = item.words.map((w, k) => ({id: k, w}));
    const to = m && m.words.length === toks.length ? gfMainFields(toks, m.fin, m.end) : toks;
    const from = ok ? to : (ex.picked.length === toks.length ? ex.picked.map(b => toks[item.bank[b].k]) : null);
    if (from && (ok ? m : true)) demo = {from, to, punct: ""};
  } else if (item.kind === "fix") {
    const a = gramErrTok(item.errado), b = gramErrTok(item.correct);
    if (a.length === b.length && a.map(w => w.toLowerCase()).sort().join(" ") === b.map(w => w.toLowerCase()).sort().join(" ")) {
      const used = new Set(), from = a.map((w, k) => ({id: k, w}));
      const m = gfMain(item.correct);
      const toks = b.map(w => { const f = from.find(t => !used.has(t.id) && t.w.toLowerCase() === w.toLowerCase()); used.add(f.id); return {id: f.id, w}; });
      demo = {from, to: m ? gfMainFields(toks, m.fin, m.end) : toks, punct: ""};
    }
  }
  if (!demo) return null;
  const box = h("div", {class: "gf-stage small"});
  gfPlay(box, demo, {hold: ok ? 0 : 500});
  return box;
}
