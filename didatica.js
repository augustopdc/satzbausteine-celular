"use strict";
/* Recursos didáticos: escada de aprendizagem (apresentar → lacuna → produzir), progressão por nível,
   metas “Já consigo…”, notas de gramática, diagnóstico de erros, critérios das notas e cores de gênero.
   Carregado antes de app.js; as funções usam o estado de app.js apenas quando chamadas. */

// ---------- Molde e lacuna ----------
function moldRegex(card) {
  if (!card.molde || !card.molde.includes("___")) return null;
  try {
    return new RegExp("^" + card.molde.split("___").map(p => p.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")).join("\\s*(.+?)\\s*") + "$", "du");
  } catch (e) { return null; }
}
/* O que o molde deixa trocável (valida o catálogo: todo molde precisa bater com a frase). */
function moldFillers(card) {
  const re = moldRegex(card);
  const m = re && card.frase.match(re);
  if (!m) return null;
  const fillers = m.slice(1).map(s => (s || "").trim()).filter(Boolean);
  return fillers.length ? fillers : null;
}
/* A lacuna do treino não é mais a parte trocável do molde (que muitas vezes era um nome, um número ou algo que a
   situação já entrega): ela esconde o que vale aprender. Candidatas, em ordem:
   1) as palavras em alemão do foco que estão na frase (herzlich willkommen);
   2) o fim da frase quando ele é verbo (infinitivo, particípio, prefixo separável, verbo da subordinada);
   3) a parte trocável do molde, se não for trivial.
   Nunca vira lacuna: nome próprio, número, só artigo/pronome, nem palavra que a situação ou a tradução já mostram.
   Cartão sem molde continua indo direto para a frase inteira. */
const GAP_FUNC = new Set(("der die das den dem des ein eine einen einem einer eines kein keine keinen ich du er sie es wir ihr mich dich mir dir ihm ihn uns euch ihnen "
  + "und oder aber denn in im an am auf zu zum zur mit von vom bei beim nach aus für um nicht ja nein bitte so da hier sich man").split(" "));
function gapTokens(frase) {
  const toks = [];
  for (const m of frase.matchAll(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)) toks.push({w: m[0], lo: m[0].toLocaleLowerCase("de"), at: m.index, end: m.index + m[0].length});
  return toks;
}
function gapGiveaway(card, words) {
  const hint = (card.situacao + " " + card.traducao).toLocaleLowerCase("de");
  const content = words.filter(w => !GAP_FUNC.has(w.toLocaleLowerCase("de")));
  if (!content.length) return true;
  if (content.every(w => /^\d/.test(w))) return true;
  return content.every(w => w.length <= 2 || new RegExp("(^|[^\\p{L}])" + w.toLocaleLowerCase("de").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^\\p{L}])", "u").test(hint));
}
function gapFromRuns(card, toks, idxs, source) {
  if (!idxs.length) return null;
  const words = idxs.map(i => toks[i].w);
  if (gapGiveaway(card, words)) return null;
  if (idxs.length >= toks.length - 1) return null;
  const runs = [];
  for (const i of idxs) { const last = runs[runs.length - 1]; if (last && last[last.length - 1] === i - 1) last.push(i); else runs.push([i]); }
  let display = "", pos = 0;
  const fillers = [];
  for (const run of runs) {
    const a = toks[run[0]].at, b = toks[run[run.length - 1]].end;
    display += card.frase.slice(pos, a) + "___";
    fillers.push(card.frase.slice(a, b));
    pos = b;
  }
  display += card.frase.slice(pos);
  // Nada de número (datas, pedidos), parte só de artigo/pronome, nem lacuna que atravessa ponto e vírgula ou ponto final.
  if (fillers.some(f => /\d/.test(f) || /[;.!?]/.test(f) || gapTokens(f).every(t => GAP_FUNC.has(t.lo)))) return null;
  // Com várias lacunas, nenhuma pode ser algo que a situação ou a tradução já mostram (ex.: o nome “Jana”).
  if (fillers.length > 1 && fillers.some(f => gapGiveaway(card, gapTokens(f).map(t => t.w)))) return null;
  return {fillers, display, source};
}
function clozeCandidates(card) {
  if (!moldFillers(card)) return [];
  const toks = gapTokens(card.frase), out = [], seen = new Set();
  const add = g => { if (g && !seen.has(g.display)) { seen.add(g.display); out.push(g); } };
  // 1) Foco: a maior sequência contínua de palavras da frase que aparecem no foco (até 3), com pelo menos uma de conteúdo.
  const foco = new Set(((card.alvo || "").match(/[\p{L}]+(?:-[\p{L}]+)*/gu) || []).map(w => w.toLocaleLowerCase("de")));
  const alvoLo = (card.alvo || "").toLocaleLowerCase("de");
  let best = [];
  for (let i = 0; i < toks.length; i++) {
    let run = [];
    for (let j = i; j < toks.length && run.length < 3 && foco.has(toks[j].lo); j++) {
      if (run.length && /[^\s]/.test(card.frase.slice(toks[j - 1].end, toks[j].at))) break; // não atravessa vírgula ou outra pontuação
      run.push(j);
    }
    while (run.length && GAP_FUNC.has(toks[run[run.length - 1]].lo)) run.pop();
    // Artigo/preposição na frente só fica se o foco traz a dupla junta (“zu Hause”, “im Moment”).
    if (run.length > 1 && GAP_FUNC.has(toks[run[0]].lo) && !alvoLo.includes(toks[run[0]].lo + " " + toks[run[1]].lo)) run = run.slice(1);
    if (run.some(k => !GAP_FUNC.has(toks[k].lo)) && run.length > best.length) best = run;
  }
  add(gapFromRuns(card, toks, best, "foco"));
  // 2) A última palavra, quando é minúscula e de conteúdo: em alemão costuma ser o verbo (infinitivo com modal,
  //    particípio, prefixo separável, verbo da subordinada) — a parte que mais trava.
  const last = toks[toks.length - 1];
  if (last && toks.length >= 4 && /^\p{Ll}/u.test(last.w) && (last.lo.length >= 3 || (typeof EX_PREFIX !== "undefined" && EX_PREFIX.includes(last.lo)))
    && (!GAP_FUNC.has(last.lo) || (typeof EX_PREFIX !== "undefined" && EX_PREFIX.includes(last.lo))))
    add(gapFromRuns(card, toks, [toks.length - 1], "fim"));
  // 3) A parte trocável do molde, se não for trivial.
  const fill = moldFillers(card);
  const idxs = [];
  for (const f of fill) {
    const ft = gapTokens(f).map(t => t.lo);
    for (let i = 0; i + ft.length <= toks.length; i++) if (ft.every((w, j) => toks[i + j].lo === w) && !idxs.includes(i)) { for (let j = 0; j < ft.length; j++) idxs.push(i + j); break; }
  }
  if (idxs.length) add(gapFromRuns(card, toks, idxs.sort((a, b) => a - b), "molde"));
  return out;
}
/* Lacuna usada no treino. Com mais de uma boa candidata, a sessão sorteia uma por cartão (e mantém até o fim),
   para você não decorar a posição do buraco; fora da sessão (testes, painéis), a primeira. */
function clozeParts(card) {
  const list = clozeCandidates(card);
  if (!list.length) return null;
  const pick = typeof session !== "undefined" && session.gapPick ? session.gapPick.get(card.id) : undefined;
  if (pick == null && typeof session !== "undefined" && session.active) {
    session.gapPick = session.gapPick || new Map();
    const i = Math.floor(Math.random() * list.length);
    session.gapPick.set(card.id, i);
    return list[i];
  }
  return list[pick != null && pick < list.length ? pick : 0];
}

// ---------- Reforço Nicos Weg: só entram frases novas até o capítulo em que o usuário está ----------
const NW_CHAPTERS = ["Bem-vindos", "Conhecendo pessoas", "Contatos", "Em companhia", "Países e idiomas", "Objetos", "Moradia",
  "Dias e horários", "Compromissos", "Vida profissional", "Orientação", "Comida e lazer", "Alimentos", "Clima e férias", "Roupas",
  "Família", "Esporte e fitness", "Saúde", "Uma nova pátria"];
// Nicos Weg A2: índice global = 19 + capítulo (0 a 18 são o A1).
const NW2_CHAPTERS = ["Bem-vindos de novo", "Dinheiro e banco", "Família e gerações", "Morar junto e vizinhança", "Viagens e hotel",
  "Rotina e tempo livre", "Associações e o que importa", "Internet e reclamações", "Restaurante e cozinha", "Amizades e relacionamentos",
  "Cidade, mudança e acidentes", "Antes e hoje", "Profissão e candidatura", "Cultura na cidade", "Festas e feriados",
  "Presentes e roupas", "Cinema", "Emoções, opinião e futebol", "Tecnologia e invenções"];
const NW_A2_BASE = NW_CHAPTERS.length;
function nwChapterLabel(i) {
  return i < NW_A2_BASE ? "A1 · " + (i ? "cap. " + i : "início") : "A2 · " + (i - NW_A2_BASE ? "cap. " + (i - NW_A2_BASE) : "início");
}
function nwChapter(card) {
  const v = tag(card, "NW");
  if (v) return Number(v);
  const v2 = tag(card, "NW2");
  return v2 ? NW_A2_BASE + Number(v2) : null;
}
function sceneChapter(s) { return s.nw ? s.nw : Number.isFinite(s.nw2) ? NW_A2_BASE + s.nw2 : null; }
function nwLocked(card) {
  const ch = nwChapter(card), max = Number(settings.nwChapter);
  return ch !== null && Number.isFinite(max) && ch > max;
}

// ---------- Progressão por nível ----------
const LEVELS = ["A1", "A2", "B1", "B2"];
const LEVEL_UNLOCK = .6;
/* Domínio para abrir o próximo nível: a última produção (falar/escrever a frase) não foi “De novo”.
   Só apresentar a frase ou reconhecê-la na escuta não basta. */
function levelMastered(card) {
  const p = cardProgress(card.id);
  return !!(p && p.production && p.production.lastGrade && p.production.lastGrade !== "again");
}
function levelStats() {
  const stats = {};
  for (const lv of LEVELS) stats[lv] = {total: 0, learned: 0, unseen: 0};
  for (const c of cards) {
    if (tag(c, "Modus") !== "Produktion" || isMedical(c) || isMine(c) || nwLocked(c)) continue;
    const s = stats[tag(c, "Niveau")];
    if (!s) continue;
    s.total++;
    if (levelMastered(c)) s.learned++;
    if (!cardProgress(c.id) || !cardProgress(c.id).introducedAt) s.unseen++;
  }
  return stats;
}
function unlockedLevels(stats = levelStats()) {
  const open = new Set(["A1"]);
  for (let i = 1; i < LEVELS.length; i++) {
    const prev = stats[LEVELS[i - 1]];
    const ratio = prev.total ? prev.learned / prev.total : 1;
    // Ter visto todas as frases não basta: é preciso acertar 60% delas na produção.
    if (ratio >= LEVEL_UNLOCK) open.add(LEVELS[i]); else break;
  }
  return open;
}
function currentLevel(stats = levelStats()) {
  const open = unlockedLevels(stats);
  return LEVELS.filter(l => open.has(l)).pop();
}
function levelSummary() {
  const stats = levelStats(), level = currentLevel(stats), i = LEVELS.indexOf(level);
  const s = stats[level], pct = s.total ? Math.round(s.learned / s.total * 100) : 100;
  const next = LEVELS[i + 1];
  return {level, pct, next, text: "Nível atual: " + level + " (" + pct + "% dominado)" + (next ? " · o " + next + " abre com " + Math.round(LEVEL_UNLOCK * 100) + "%" : " · todos os níveis abertos")};
}

// ---------- Metas “Já consigo…” ----------
const has = (key, ...values) => c => values.some(v => hasTag(c, key, v));
const lv = (...levels) => c => levels.includes(tag(c, "Niveau"));
const and = (...fns) => c => fns.every(f => f(c));
const CANDO = [
  {id: "apresentar", text: "Cumprimentar, me apresentar e me despedir", when: and(has("Funktion", "Cumprimentar", "Apresentar", "Despedir"), lv("A1", "A2"))},
  {id: "entender", text: "Pedir para repetir e checar se entendi", when: has("Funktion", "PedirRepeticao", "PedirLentidao", "ChecarCompreensao", "SinalizarCompreensao")},
  {id: "compras", text: "Fazer compras e pedir serviços simples", when: and(has("Thema", "Konsum", "Dienstleistung"), lv("A1", "A2"))},
  {id: "consulta", text: "Explicar sintomas e marcar consultas", when: and(has("Thema", "Gesundheit"), lv("A1", "A2", "B1"))},
  {id: "telefone", text: "Resolver coisas por telefone", when: c => hasTag(c, "Thema", "Telefon") || hasTag(c, "Funktion", "TelefoneAbertura") || hasTag(c, "Funktion", "TelefoneFecho")},
  {id: "burocracia", text: "Resolver burocracia em repartições", when: c => hasTag(c, "Thema", "Behoerde") || (hasTag(c, "Thema", "Ankunft") && hasTag(c, "Bezug", "GER_Servicos"))},
  {id: "moradia", text: "Procurar, visitar e alugar um apartamento", when: has("Thema", "Wohnen")},
  {id: "chegada", text: "Dar conta das primeiras semanas na Alemanha", when: has("Thema", "Ankunft")},
  {id: "narrar", text: "Contar o que aconteceu", when: and(has("Funktion", "Narrar", "Relatar"), lv("A2", "B1"))},
  {id: "opinar", text: "Dar minha opinião e justificá-la", when: and(has("Funktion", "Opinar", "Justificar", "Avaliar", "ConcordarParcialmente", "Discordar"), lv("B1", "B2"))},
  {id: "reclamar", text: "Reclamar com firmeza e cortesia", when: has("Funktion", "Reclamar")},
  {id: "email", text: "Escrever e-mails e cartas formais", when: c => /^\[escrito\]/.test(c.situacao) && hasTag(c, "Register", "formell")},
  {id: "discussao", text: "Participar de discussões da prova oral (B2)", when: has("Bezug", "Goethe_M2", "telc_M2", "telc_M3")},
  {id: "anamnese", text: "Fazer uma anamnese completa", when: has("Bezug", "FSP_Anamnese")},
  {id: "aufklaerung", text: "Explicar exames e condutas ao paciente", when: has("Bezug", "FSP_Aufklaerung")},
  {id: "fachbegriffe", text: "Traduzir termos técnicos para o paciente", when: has("Bezug", "FSP_Fachbegriffe")},
  {id: "caso", text: "Apresentar um caso ao médico sênior", when: has("Bezug", "FSP_Fallvorstellung")},
  {id: "arztbrief", text: "Escrever a documentação e a carta médica", when: has("Bezug", "FSP_Dokumentation")}
];
const CANDO_DONE = .8;
let candoCache = null;
function candoLists() {
  if (!candoCache || candoCache.size !== cards.length) {
    candoCache = {size: cards.length, lists: CANDO.map(g => cards.filter(c => tag(c, "Modus") === "Produktion" && g.when(c)))};
  }
  return candoCache.lists;
}
function candoProgress() {
  return CANDO.map((g, i) => {
    const list = candoLists()[i], learned = list.filter(studied).length;
    return {...g, total: list.length, learned, pct: list.length ? learned / list.length : 0, done: list.length > 0 && learned / list.length >= CANDO_DONE};
  }).filter(g => g.total > 0);
}
function nextCando(progressList = candoProgress()) {
  return progressList.filter(g => !g.done).sort((a, b) => b.pct - a.pct)[0] || null;
}
function checkAchievements() {
  const achieved = new Set(Array.isArray(settings.achieved) ? settings.achieved : []);
  let changed = false;
  for (const g of candoProgress()) {
    if (g.done && !achieved.has(g.id)) {
      achieved.add(g.id);
      changed = true;
      toast("Nova conquista: já consigo " + g.text.charAt(0).toLowerCase() + g.text.slice(1) + "!", "success", 7000);
    }
  }
  if (changed) { settings.achieved = [...achieved]; saveSettings(); }
}
function candoRow(g) {
  const bar = h("span");
  setWidth(bar, g.pct * 100);
  return h("div", {class: "cando" + (g.done ? " done" : "")},
    h("span", {class: "cando-icon", "aria-hidden": "true"}, g.done ? icon("check", 16) : ""),
    h("div", {class: "cando-main"},
      h("div", {class: "cando-top"}, h("b", {text: g.text}), h("span", {class: "muted small-text", text: g.learned + " / " + g.total})),
      h("div", {class: "track"}, bar)));
}
function renderCando() {
  const list = candoProgress();
  const done = list.filter(g => g.done).length;
  $("candoSummary").textContent = done + " de " + list.length + " metas alcançadas. Uma meta é alcançada quando você domina " + Math.round(CANDO_DONE * 100) + "% das frases ligadas a ela.";
  $("candoList").replaceChildren(...list.sort((a, b) => Number(b.done) - Number(a.done) || b.pct - a.pct).map(candoRow));
}

// ---------- Notas de gramática ----------
const GRAMMAR_BY_ID = new Map((typeof GRAMATICA !== "undefined" ? GRAMATICA : []).map(t => [t.id, t]));
const topicCache = new Map();
function topicsFor(card) {
  if (topicCache.has(card.id)) return topicCache.get(card.id);
  const found = [];
  for (const t of GRAMMAR_BY_ID.values()) { try { if (t.detect(card)) found.push(t.id); } catch (e) { /* regra com problema */ } }
  topicCache.set(card.id, found);
  return found;
}
function topicCards(topicId) {
  const t = GRAMMAR_BY_ID.get(topicId);
  return t ? cards.filter(c => topicsFor(c).includes(topicId)) : [];
}
function grammarChips(card) {
  const priority = ["relativ", "indirekt", "umzu", "alswenn", "doppelkonj", "zweiobjekt", "daworter", "deshalb",
    "nebensatz", "v2", "trennbar", "perfekt", "praeteritum", "modal", "imperativ", "reflexiv", "dativ", "akkusativ", "genitiv", "praep", "wfragen",
    "komparativ", "adjektiv", "possessiv", "konnektoren", "passiv", "konjunktiv", "genero", "negacao", "falsos", "sie"];
  const ids = topicsFor(card).sort((a, b) => priority.indexOf(a) - priority.indexOf(b)).slice(0, 2);
  return ids.map(id => h("button", {class: "chip chip-grammar", type: "button", onclick: () => openGrammarDialog(id)}, iconText("book", GRAMMAR_BY_ID.get(id).title, 15)));
}
function grammarTopicContent(t, withExamples = true) {
  const examples = withExamples ? topicCards(t.id).slice(0, 6) : [];
  return [
    h("p", {class: "lede", text: t.short}),
    ...t.body.map(p => h("p", {text: p})),
    h("div", {class: "trap"},
      h("b", {text: "Armadilha para brasileiros"}),
      h("p", {class: "trap-wrong", lang: "de"}, h("span", {text: "✗ "}), t.trap[0]),
      h("p", {class: "trap-right", lang: "de"}, h("span", {text: "✓ "}), t.trap[1])),
    h("div", {class: "grammar-examples"}, ...t.examples.map(([de, pt]) => h("p", null, h("b", {lang: "de", text: de}), h("span", {class: "muted", text: " — " + pt})))),
    examples.length ? h("h3", {text: "No seu catálogo"}) : null,
    examples.length ? h("div", {class: "list"}, ...examples.map(catalogItem)) : null
  ].filter(Boolean);
}
function openGrammarDialog(id) {
  const t = GRAMMAR_BY_ID.get(id), dialog = $("grammarDialog");
  if (!t || !dialog) return;
  stopAudio();
  $("grammarDialogTitle").textContent = t.title;
  fill($("grammarDialogBody"), ...grammarTopicContent(t, false),
    h("div", {class: "row spaced"}, h("button", {class: "primary", type: "button", onclick: () => { dialog.close(); showView("grammar"); renderGrammarTopic(id); }}, "Ver tópico completo")));
  dialog.showModal();
}
function renderGrammar() {
  $("grammarDetail").hidden = true;
  $("grammarList").hidden = false;
  if (typeof renderGrammarTrain === "function") renderGrammarTrain();
  $("grammarList").replaceChildren(...[...GRAMMAR_BY_ID.values()].map(t => {
    const list = topicCards(t.id), learned = list.filter(studied).length, bar = h("span");
    const ex = typeof gramStat === "function" ? gramStat(t.id) : null;
    setWidth(bar, list.length ? learned / list.length * 100 : 0);
    return h("button", {class: "grammar-card", type: "button", onclick: () => renderGrammarTopic(t.id)},
      h("b", {text: t.title}), h("span", {class: "muted small-text", text: t.short}),
      h("div", {class: "track"}, bar), h("span", {class: "small-text muted", text: list.length + " frases · " + learned + " aprendidas"
        + (ex ? " · exercícios: " + (typeof gramStatText === "function" ? gramStatText(ex) : Math.round(ex.pct * 100) + "% de " + ex.n) : "")}));
  }));
}
function renderGrammarTopic(id) {
  const t = GRAMMAR_BY_ID.get(id);
  if (!t) return;
  $("grammarList").hidden = true;
  if ($("grammarTrain")) $("grammarTrain").hidden = true;
  $("grammarDetail").hidden = false;
  const hasForm = typeof exFormCount === "function" && exFormCount(id) >= 5;
  fill($("grammarDetail"),
    h("button", {class: "quiet small", type: "button", onclick: renderGrammar}, "← Todos os tópicos"),
    h("h2", {text: t.title}),
    ...grammarTopicContent(t, true),
    h("div", {class: "row spaced"}, h("button", {class: "primary", type: "button", onclick: () => startTopicSession(id)}, "Treinar frases deste tópico"),
      typeof startExercise === "function" ? h("button", {type: "button", onclick: () => startExercise("build", id)}, "Montar a frase") : null,
      hasForm ? h("button", {type: "button", onclick: () => startExercise("form", id)}, "Escolha a forma certa") : null));
  window.scrollTo({top: 0});
}
function startTopicSession(id) {
  const list = topicCards(id).filter(c => tag(c, "Modus") === "Produktion");
  const due = list.filter(c => modeProgress(c.id, "production")).sort((a, b) => modeProgress(a.id, "production").due - modeProgress(b.id, "production").due);
  const fresh = list.filter(c => !modeProgress(c.id, "production")).sort(sortNew);
  const ids = [...due.slice(0, 12), ...fresh.slice(0, 8)].map(c => c.id);
  showView("practice");
  setSessionMode("production");
  startSession({custom: ids, label: GRAMMAR_BY_ID.get(id).title});
}

// ---------- Diagnóstico de erros ----------
function renderReasonChips() {
  const box = $("reasonChips");
  box.replaceChildren(...ERROR_REASONS.map(r => h("button", {class: "chip chip-reason", type: "button", "aria-pressed": "false", dataset: {reason: r.id},
    onclick: e => e.currentTarget.setAttribute("aria-pressed", String(e.currentTarget.getAttribute("aria-pressed") !== "true"))}, r.label)));
}
function selectedReasons() {
  return all("#reasonChips [aria-pressed='true']").map(b => b.dataset.reason);
}
function recordReasons(record, why) {
  if (!why.length) return;
  record.why = why;
  progress.errorStats = progress.errorStats || {};
  for (const r of why) progress.errorStats[r] = (progress.errorStats[r] || 0) + 1;
}
function reasonCards(reasonId) {
  return cards.filter(c => ["production", "listening"].some(m => (modeProgress(c.id, m)?.why || []).includes(reasonId)));
}
function renderDiagnosis() {
  const stats = progress.errorStats || {}, total = Object.values(stats).reduce((a, b) => a + b, 0), box = $("diagnosis");
  if (!total) { fill(box, h("p", {class: "muted", text: "Quando errar uma frase, marque o motivo (vocabulário, ordem, gênero…). Aqui aparecerá onde você mais erra, com treinos e notas de gramática para cada ponto."})); return; }
  const rows = ERROR_REASONS.filter(r => stats[r.id]).sort((a, b) => stats[b.id] - stats[a.id]).map(r => {
    const bar = h("span"), n = stats[r.id], list = reasonCards(r.id);
    setWidth(bar, n / total * 100);
    return h("div", {class: "diag-row"},
      h("div", {class: "diag-top"}, h("b", {text: r.label}), h("span", {class: "muted small-text", text: n + " (" + Math.round(n / total * 100) + "%)"})),
      h("div", {class: "track"}, bar),
      h("div", {class: "row diag-actions"},
        list.length ? h("button", {class: "small", type: "button", onclick: () => { showView("practice"); setSessionMode("production"); startSession({custom: list.slice(0, 20).map(c => c.id), label: "Erros de " + r.label.toLowerCase()}); }}, "Treinar " + Math.min(20, list.length) + " frases") : null,
        ...r.topics.slice(0, 3).map(tid => h("button", {class: "chip chip-grammar small", type: "button", onclick: () => openGrammarDialog(tid)}, iconText("book", GRAMMAR_BY_ID.get(tid).title, 15)))));
  });
  fill(box, h("p", {class: "muted small-text", text: total + " erros marcados até agora."}), ...rows);
}

// ---------- Critérios das notas ----------
function showRubric() {
  if (settings.showRubric === "always") return true;
  if (settings.showRubric === "never") return false;
  return Object.values(progress.days).reduce((a, b) => a + Number(b || 0), 0) < 300;
}

// ---------- Cores de gênero ----------
const PLURAL_NOUNS = new Set(["Varizen", "Extremitäten", "Meningen", "Ovarien", "Tonsillen", "Blähungen", "Kopfschmerzen", "Gallensteine", "Nierensteine", "Krampfadern",
  "Eierstöcke", "Mandeln", "Hirnhäute", "Muskelschmerzen", "Gelenkschmerzen", "Schluckbeschwerden", "Arme", "Metastasen", "Hämorrhoiden"]);
const GENDER_WORD = {masculino: "der", feminino: "die", neutro: "das"};
function genderClass(article, noun) {
  if (PLURAL_NOUNS.has(noun)) return "g-pl";
  return {der: "g-der", die: "g-die", das: "g-das"}[article.toLowerCase()] || "";
}
/* Marca “artigo + substantivo” de um sintagma simples (termos médicos) com a cor do gênero. */
function genderize(text) {
  if (!settings.genderColors) return [text];
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/\b(der|die|das)\s+((?:[a-zäöüß-]+\s+)?)([A-ZÄÖÜ][\wäöüß-]*)/g)) {
    const cls = genderClass(m[1], m[3]);
    if (!cls) continue;
    out.push(text.slice(last, m.index), h("span", {class: "gender " + cls, title: cls === "g-pl" ? "plural" : {"g-der": "masculino", "g-die": "feminino", "g-das": "neutro"}[cls]}, m[0]));
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out.filter(x => x !== "");
}
/* Gênero anunciado no campo Foco (“Toilette é feminino”): devolve {palavra, classe}. */
function genderFromTarget(card) {
  const m = (card.alvo || "").match(/^([A-ZÄÖÜ][\wäöüß-]+) é (masculino|feminino|neutro)/);
  return m && settings.genderColors ? {word: m[1], cls: genderClass(GENDER_WORD[m[2]], m[1])} : null;
}

// ---------- Situação em alemão ----------
function germanSituation(card) {
  return settings.germanSituations && typeof SITUACOES_DE !== "undefined" ? SITUACOES_DE[card.id] || "" : "";
}
