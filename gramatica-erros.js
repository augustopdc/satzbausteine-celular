/* Seus erros reais (Conversa e Escrita) dentro da Gramática (24/10/2026, rodada 2).
   O tópico de cada erro sai por REGRA, comparando a frase errada com a corrigida (o que saiu e o que entrou), nunca pela IA.
   Quando a regra não acha nada, o tipo do erro da Escrita dá um palpite; se nem isso, o erro fica sem tópico (não aparece aqui). */
const GRAM_ERR_TIPOS = {posicao: ["nebensatz", "v2", "modal", "trennbar"], separavel: ["trennbar"], caso: ["akkusativ", "dativ", "praep", "genitiv"],
  genero: ["genero"], adjetivo: ["adjektiv"], tempo: ["perfekt", "praeteritum"], preposicao: ["praep", "dativ", "wfragen"],
  pronome: ["possessiv", "reflexiv"], registro: ["sie"]};
const GRAM_ERR_ORDER = ["nebensatz", "indirekt", "relativ", "trennbar", "modal", "perfekt", "deshalb", "konnektoren", "v2"];
const GRAM_ART = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|kein|keine|keinen|keinem|keiner|keines|mein|meine[mnrs]?|dein|deine[mnrs]?|seine[mnrs]?|ihre[mnrs]?|unser|unsere[mnrs]?|eure[mnrs]?|ihre)$/;
const GRAM_PREP_DAT = /^(mit|bei|nach|seit|von|zu|aus|gegenüber|vom|zum|zur|beim)$/, GRAM_PREP_AKK = /^(für|durch|gegen|ohne|um)$/;
const GRAM_PREP_2 = /^(in|an|auf|über|unter|vor|hinter|neben|zwischen|im|ins|am|ans)$/;
const GRAM_SEP = /^(an|auf|aus|ein|mit|vor|zu|zurück|weg|los|fern|nach|vorbei|her|hin|mit|fest|um)$/;
const gramErrTok = s => String(s || "").replace(/[.,!?;:"„“”()…]/g, " ").split(/\s+/).filter(Boolean);
function gramMinus(a, b) {
  const rest = [...b], out = [];
  for (const w of a) { const k = rest.indexOf(w); if (k >= 0) rest.splice(k, 1); else out.push(w); }
  return out;
}
/* Caso pedido pela forma que entrou: dem/einem/-em → dativo; den/einen/-en → acusativo; des/eines → genitivo. */
function gramArtCase(w) {
  if (/^(des|eines|keines)$/.test(w)) return "genitiv";
  if (/em$/.test(w)) return "dativ";
  if (/^(den|einen|keinen)$|en$/.test(w)) return "akkusativ";
  return null;
}
function gramErrTopics(errado, certo, tipo) {
  const A = gramErrTok(errado), B = gramErrTok(certo), a = A.map(w => w.toLowerCase()), b = B.map(w => w.toLowerCase());
  const out = [], add = id => { if (id && !out.includes(id)) out.push(id); };
  const removed = gramMinus(a, b), added = gramMinus(b, a);
  const any = (list, re) => list.some(w => re.test(w));
  if (!removed.length && !added.length && a.join(" ") !== b.join(" ")) {
    // Só a ordem mudou: o tópico de ordem que a frase certa mostra.
    const found = topicsFor({id: "G-" + certo, frase: certo, tags: "", situacao: "", traducao: ""});
    add(GRAM_ERR_ORDER.find(id => found.includes(id)) || "v2");
    return out;
  }
  if ((any(removed, /^nicht$/) && any(added, /^kein/)) || (any(removed, /^kein/) && any(added, /^nicht$/))) add("negacao");
  const HABEN = /^(habe|hast|hat|haben|habt)$/, SEIN = /^(bin|bist|ist|sind|seid)$/;
  if ((any(removed, HABEN) && any(added, SEIN)) || (any(removed, SEIN) && any(added, HABEN))) add("perfekt");
  if (any(added, /^(war|warst|waren|wart|hatte|hattest|hatten|hattet)$/) && any(removed, /^(gewesen|gehabt)$/)) add("praeteritum");
  if (any(removed, /^wo(hin|her)?$/) && any(added, /^wo(hin|her)?$/)) add("wfragen");
  if (any(removed, /^(als|wie)$/) && any(added, /^(als|wie)$/)) add("komparativ");
  const DU = /^(du|dich|dir|dein\w*)$/;
  if ((any(removed, DU) && B.some(w => /^(Sie|Ihnen|Ihr\w*)$/.test(w))) || (any(added, DU) && A.some(w => /^(Sie|Ihnen|Ihr\w*)$/.test(w)))) add("sie");
  const PRON_D = /^(mir|dir|ihm|ihnen)$/, PRON_A = /^(mich|dich|ihn)$/;
  if (any(removed, PRON_A) && any(added, PRON_D)) add("dativ");
  if (any(removed, PRON_D) && any(added, PRON_A)) add("akkusativ");
  if (!removed.length && any(added, /^(mich|dich|sich|uns|euch)$/)) add("reflexiv");
  // Prefixo separável que foi para o fim (rufe … an no lugar de anrufe).
  if (added.some(w => GRAM_SEP.test(w)) && removed.some(w => added.some(p => GRAM_SEP.test(p) && w.startsWith(p) && w.length > p.length + 2))) add("trennbar");
  // Artigo/possessivo trocado: o caso vem da preposição logo antes, ou da forma que entrou.
  const artIn = added.filter(w => GRAM_ART.test(w)), artOut = removed.filter(w => GRAM_ART.test(w));
  if (artIn.length && artOut.length) {
    const w = artIn[0], k = b.indexOf(w), prev = k > 0 ? b[k - 1] : "";
    if (/^(mein|dein|sein|ihr|unser|eur)/.test(w)) add("possessiv");
    if (GRAM_PREP_2.test(prev)) add("praep");
    else if (GRAM_PREP_DAT.test(prev)) add("dativ");
    else if (GRAM_PREP_AKK.test(prev)) add("akkusativ");
    else if (/^(der|die|das)$/.test(w) && /^(der|die|das)$/.test(artOut[0])) add("genero");
    else add(gramArtCase(w) || "genero");
  }
  // Terminação do adjetivo: mesma raiz, outra terminação, antes de um substantivo.
  for (const w of added) {
    if (GRAM_ART.test(w)) continue;
    const k = b.indexOf(w), next = B[k + 1] || "";
    if (/^[A-ZÄÖÜ]/.test(next) && removed.some(r => !GRAM_ART.test(r) && r.length >= 3 && r.replace(/(e|en|er|es|em)$/, "") === w.replace(/(e|en|er|es|em)$/, ""))) { add("adjektiv"); break; }
  }
  if (!out.length && tipo && GRAM_ERR_TIPOS[tipo]) {
    const found = topicsFor({id: "G-" + certo, frase: certo, tags: "", situacao: "", traducao: ""});
    add(GRAM_ERR_TIPOS[tipo].find(id => found.includes(id)) || GRAM_ERR_TIPOS[tipo][0]);
  }
  return out.slice(0, 2);
}
function gramErrKey(errado, certo) {
  let x = 5381;
  for (const ch of gramErrNorm(errado) + "→" + gramErrNorm(certo)) x = (x * 33 + ch.charCodeAt(0)) >>> 0;
  return x.toString(36);
}
const gramErrNorm = s => String(s || "").replace(/[.,!?;:"„“”…]/g, "").replace(/\s+/g, " ").trim();
/* Frase inteira da Escrita: a frase do texto onde cada erro está, com TODAS as correções dela aplicadas. */
function gramEscritaItems(t) {
  if (!t.fb || !t.fb.erros.length || typeof escritaSpans !== "function") return [];
  const text = t.v1, spans = escritaSpans(text, t.fb.erros), out = [];
  let from = 0;
  for (const s of escritaSentences(text)) {
    const a = text.indexOf(s, from), b = a + s.length;
    if (a < 0) continue;
    from = b;
    const inside = t.fb.erros.map((e, i) => [e, spans[i]]).filter(([, p]) => p && p[0] >= a && p[1] <= b);
    if (!inside.length) continue;
    let fixed = s;
    for (const [e, p] of inside.slice().sort((x, y) => y[1][0] - x[1][0])) fixed = fixed.slice(0, p[0] - a) + e.certo + fixed.slice(p[1] - a);
    const topics = [...new Set(inside.flatMap(([e]) => gramErrTopics(e.trecho, e.certo, e.tipo)))].slice(0, 2);
    out.push({at: t.fb.at || t.at, src: "Escrita", errado: s, certo: fixed, explicacao: inside.map(([e]) => e.explicacao).filter(Boolean).join(" "), topics});
  }
  return out;
}
/* Todos os seus erros com tópico, do mais novo para o mais antigo, sem repetir a mesma correção. */
function gramMyErrors() {
  const p = progress.practice || {}, out = [], seen = new Set();
  const push = x => {
    if (!x.topics.length || !x.errado || gramErrNorm(x.errado) === gramErrNorm(x.certo)) return;
    x.key = gramErrKey(x.errado, x.certo);
    if (seen.has(x.key)) return;
    seen.add(x.key);
    out.push(x);
  };
  for (const s of ((p.conversa || {}).sessions || [])) for (const e of s.errors || [])
    push({at: s.at, src: s.fsp ? "Anamnese" : "Conversa", errado: e.errado, certo: e.certo, explicacao: e.explicacao, topics: gramErrTopics(e.errado, e.certo)});
  for (const t of Object.values((p.escrita || {}).texts || {})) if (!t.deleted) gramEscritaItems(t).forEach(push);
  return out.sort((a, b) => b.at - a.at);
}
/* Reescrita certa conta como consertada: sai do selo e da fila do “5 minutos”, mas continua na lista do tópico. */
function gramFixed(key) { return ((gramData().fixed || {})[key] || {n: 0}).n > 0; }
function gramMarkFixed(key) {
  const d = gramData(), f = d.fixed || (d.fixed = {});
  f[key] = {n: ((f[key] || {}).n || 0) + 1, at: Date.now()};
}
const GRAM_ERR_WEEK = 7 * 864e5;
/* Erros seus ainda não consertados por tópico (para o selo e para subir o tópico para “Agora”). */
function gramErrorsByTopic(list = gramMyErrors(), since = Date.now() - GRAM_ERR_WEEK) {
  const m = new Map();
  for (const x of list) if (x.at >= since && !gramFixed(x.key)) for (const id of x.topics) m.set(id, (m.get(id) || 0) + 1);
  return m;
}
function gramWhen(at) {
  const days = Math.floor((dayStart(dateKey()) - dayStart(dateKey(new Date(at)))) / 864e5);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][new Date(at).getDay()];
  return new Date(at).toLocaleDateString("pt-BR", {day: "numeric", month: "short"});
}
/* A frase errada com as palavras que mudam marcadas (o que sumiu ou foi trocado na correção). */
function gramErrLine(x) {
  const ops = wordDiff(x.certo, x.errado).ops, out = [];
  for (const op of ops) {
    if (op[0] === "ins") continue;
    const w = op[0] === "del" ? op[1] : op[2];
    if (out.length) out.push(" ");
    out.push(op[0] === "eq" ? w : h("mark", {class: "gram-err-mark", text: w}));
  }
  return h("p", {class: "gram-err-de", lang: "de"}, ...out);
}
function gramErrSection(id) {
  const list = gramMyErrors().filter(x => x.topics.includes(id));
  if (!list.length) return null;
  const open = list.filter(x => !gramFixed(x.key)), show = [...open, ...list.filter(x => gramFixed(x.key))].slice(0, 3);
  return h("section", {class: "gram-mine"},
    h("h3", {class: "label", text: "Seus erros"}),
    ...show.map(x => h("div", {class: "gram-err" + (gramFixed(x.key) ? " fixed" : "")}, gramErrLine(x),
      h("span", {class: "muted small-text", text: x.src + ", " + gramWhen(x.at) + (gramFixed(x.key) ? " · já reescrita" : "")}))),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => startGramFix(id)}, "Reescrever " + (list.length === 1 ? "a sua frase" : "as suas frases"))));
}
/* Item de reescrita: a sua frase vem no campo para você consertar. */
function fixItem(x) { return {kind: "fix", errado: x.errado, certo: x.certo, correct: x.certo, explicacao: x.explicacao, topics: x.topics, key: x.key, src: x.src, at: x.at}; }
function startGramFix(id) {
  const list = gramMyErrors().filter(x => x.topics.includes(id));
  const items = [...list.filter(x => !gramFixed(x.key)), ...list.filter(x => gramFixed(x.key))].slice(0, 8).map(fixItem);
  exBegin("fix", id, items, "Suas frases: " + GRAMMAR_BY_ID.get(id).title, 1);
}
function checkFix() {
  const item = ex.items[ex.i], input = $("exInput");
  if (ex.answered || !input) return;
  const mine = input.value.trim();
  input.readOnly = true;
  input.blur();
  const ok = gramErrNorm(mine) === gramErrNorm(item.correct);
  if (ok) gramMarkFixed(item.key);
  exGrade(ok, mine);
}
/* Tela da reescrita: a sua frase, com o que mudar marcado, já no campo para você consertar (sem mostrar a correção). */
function renderFixItem(item) {
  const input = h("textarea", {id: "exInput", class: "ex-fix-input", rows: 2, autocomplete: "off", autocapitalize: "off", spellcheck: "false", lang: "de", "aria-label": "Sua frase corrigida"});
  input.value = item.errado;
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); checkFix(); } });
  const t = GRAMMAR_BY_ID.get(item.topics[0]);
  fill($("grammarDetail"), ...exHeader(),
    h("div", {class: "ex-situation"}, h("p", {class: "muted small-text", text: (item.src === "Escrita" ? "Você escreveu" : "Você disse na " + item.src) + ", " + gramWhen(item.at) + ":"}), gramErrLine(item)),
    h("p", {class: "muted small-text", text: "Conserte a frase no campo. A parte marcada é onde está o erro" + (t ? " (" + t.title + ")." : ".")}),
    input, umlautRow(input),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: checkFix}, "Conferir", h("kbd", null, "Enter")),
      h("button", {class: "quiet", type: "button", onclick: () => { if (ex.answered) return; input.readOnly = true; exGrade(false); }}, "Não sei")),
    h("div", {id: "exFeedback", class: "pron-feedback"}));
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
