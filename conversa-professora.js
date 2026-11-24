/* Professora (16/11/2026, pedido do Luiz): “Treinar com a IA” em cada tópico da Gramática abre uma conversa de treino
   daquele tópico. Ela explica em português (a partir da ficha do app, nunca de regra inventada), treina em alemão com
   perguntas que pedem a estrutura, responde dúvidas em português e volta ao alemão. Pelo Ao vivo (Gemini) quando ligado;
   senão, pelo Gemma local (as frases em português ficam só escritas: as vozes locais são alemãs).
   O placar é por regra: cada fala dele em alemão passa pelo detector do tópico (aulaDetect) e os erros da correção do
   Gemma são ligados ao tópico por gramErrTopics. Falas dele em português (perguntas) não são conferidas nem contadas. */
const PROF_TEACHER = {name: "Anke", voice: "aoede"};
const PROF_MAX_RECORD = 10; // no máximo 10 respostas por conversa entram no acerto do tópico

/* Puro: a frase está em português? Acentos do português ou palavras que não existem em alemão. */
const PROF_PT_WORDS = new Set(["não", "nao", "você", "voce", "que", "é", "porque", "isso", "isto", "como", "eu", "uma", "do", "dos", "entendi", "pode", "explica",
  "explicar", "quando", "qual", "mas", "mais", "com", "sim", "por", "para", "seria", "aqui", "esse", "essa", "então", "entao", "certo", "errado", "palavra",
  "frase", "verbo", "significa", "quer", "dizer", "obrigado", "tá", "ta", "beleza", "dúvida", "duvida", "regra", "também", "tambem", "ou", "no", "na", "os", "as"]);
function profIsPt(text) {
  const s = String(text || "").toLowerCase();
  const words = s.split(/[^\p{L}]+/u).filter(Boolean);
  if (!words.length) return false;
  if (/[ãõçêâôáíú]/.test(s)) return true;
  const n = words.filter(w => PROF_PT_WORDS.has(w)).length;
  return n >= 2 || (words.length <= 3 && n >= 1 && !["na", "no", "so", "da", "um", "ja"].includes(words[0]));
}
/* Fala dele que não deve passar pela correção nem pelo tutor: pergunta em português na aula. */
function profSkipCheck(turn) { return !!(conv.topic && conv.topic.teacher && turn && profIsPt(turn.de)); }

function profTopic(id) {
  const t = GRAMMAR_BY_ID.get(id);
  return {id: "prof-" + id, group: "Professora", level: convLevel(), pt: "Treino com a IA · " + t.title, de: t.title, voice: PROF_TEACHER.voice, sie: false,
    teacher: {id, title: t.title, name: PROF_TEACHER.name}};
}
/* Instruções: o que ensinar vem da ficha (texto fixo do app). */
function profPrompt(topic, level) {
  const T = topic.teacher, t = GRAMMAR_BY_ID.get(T.id), f = typeof fichaOf === "function" ? fichaOf(T.id) : null;
  const plain = s => String(s || "").replace(/[[\]]/g, "");
  const rule = [];
  if (f) {
    if (f.ideia) rule.push("- Main idea: " + f.ideia);
    if (f.macete) rule.push("- Trick to remember: " + f.macete);
    if (f.armadilha && f.armadilha.errado) rule.push(`- Typical mistake of Brazilians: Portuguese "${f.armadilha.pt}" → wrong "${f.armadilha.errado}", right "${f.armadilha.certo}".`);
    for (const c of f.conversa || []) rule.push("- " + c);
    if (f.visual && f.visual.nota) rule.push("- " + plain(f.visual.nota));
  } else {
    rule.push("- " + t.short, ...(t.body || []).map(p => "- " + p));
    if (t.trap) rule.push(`- Typical mistake: wrong "${t.trap[0]}", right "${t.trap[1]}".`);
  }
  const ex = f && f.exemplos ? f.exemplos.map(([de, pt]) => `- ${plain(de)} (${pt})`) : (t.examples || []).map(([de, pt]) => `- ${de} (${pt})`);
  const drill = f && f.treino ? f.treino.map(([pt, de]) => `- ${pt} → ${de}`) : [];
  return [`You are ${T.name}, a warm and patient German teacher. You give Luiz, a Brazilian doctor learning German (level ${level}), a short one-to-one lesson on ONE grammar point: "${T.title}". You use "du" with him.`,
    "Languages: explanations, answers to his doubts and short comments about the rule in Brazilian Portuguese; practice in German. Never English.",
    "The app's explanation of this point (base everything on it, never contradict it, do not add other rules or exceptions):", ...rule,
    "Examples:", ...ex,
    ...(drill.length ? ["Practice sentences (Portuguese → German) you may use from time to time:", ...drill] : []),
    "How the lesson goes:",
    "1. Start: greet him in one short German sentence. Then, in Portuguese, explain the point in at most 4 short sentences with ONE German example, and ask if it is clear or if he has a question.",
    "2. Practice, in German: ask him simple personal questions whose natural answer needs this structure (his work as a doctor, his day, Curitiba, his dog Eduarda, the move to Germany). One question per turn, 1 or 2 short sentences. Make it a real conversation; do not say \"make a sentence with ...\". Now and then you may give him a Portuguese sentence from the practice list to say in German.",
    "3. Mistakes on THIS point: the first time, repeat his sentence correctly inside your reply (\"Ah, du bist nach Hause gegangen!\"); if he makes the same mistake again, let him try again with a small hint (\"Fast! bin oder habe?\"); the third time, explain it in Portuguese in one or two sentences and go back to German. Ignore small mistakes on other points unless they block understanding.",
    "4. When he asks something in Portuguese or says he did not understand, answer in Portuguese, short (1 to 3 sentences), then switch back to German with an easy question for him.",
    "5. If he gets stuck twice in a row, offer in Portuguese to explain again.",
    "6. When he gets it right, say so briefly (Genau! Super!) and continue.",
    "Rules:",
    "- German at his level: " + (CONV_LEVEL_RULES[level] || CONV_LEVEL_RULES.A1),
    "- Never mix the two languages inside one sentence; a German example inside a Portuguese explanation is fine.",
    "- A note from the app in square brackets at the end of his message may tell you how to react to a mistake. Follow it, never read it aloud and never mention it.",
    "- His messages are transcribed speech: ignore capitalization and punctuation.",
    "- No emojis, no lists, no markdown."].join("\n");
}
function profStart(topic) {
  return `(Begin the lesson as ${topic.teacher.name}: greet Luiz in one short German sentence, then explain "${topic.teacher.title}" in Portuguese as planned and ask if it is clear.)`;
}
/* Ao vivo: o que muda nas instruções da ligação (no lugar de “só alemão”). */
function profLiveLanguage() {
  return "Speak German for the practice and Brazilian Portuguese for explanations and for answering his doubts, as described above. Never English. When you speak Portuguese, speak it naturally; when you speak German, follow the pace below.";
}
const PROF_ASK_PT = "(Hinweis, nicht vorlesen: Luiz möchte, dass du den Punkt noch einmal auf Brasilianisch-Portugiesisch erklärst, kurz und mit einem neuen deutschen Beispiel. Danach geht es auf Deutsch weiter.)";
function profAskPt() {
  if (conv.live) { if (conv.live.ready) window.satzDesktop.liveText(PROF_ASK_PT).catch(() => {}); return; }
  if (!conv.busy && !conv.finished) partnerTurn(PROF_ASK_PT);
}

/* ---------- Placar por regra ---------- */
/* Puro: o que cada fala dele em alemão mostrou. used = o detector achou a estrutura; err = a correção apontou erro do
   tópico; pending = correção ainda chegando. */
function profAttempts(turns, id, detect) {
  const out = [];
  for (const t of turns || []) {
    if (t.who !== "me" || profIsPt(t.de)) continue;
    let used = null;
    try { used = detect ? detect(t.de) : null; } catch (e) { used = null; }
    const c = t.check, pending = !!(c && c.state === "checking");
    const err = !!(c && (c.errors || []).some(e => typeof gramErrTopics === "function" && gramErrTopics(e.errado, e.certo).includes(id)));
    if (used || err) out.push({de: t.de, used: !!used, err, pending, ok: !!used && !err && !pending});
  }
  return out;
}
function profState() {
  const T = mis.topic.teacher, t = GRAMMAR_BY_ID.get(T.id);
  const list = profAttempts(conv.turns, T.id, typeof aulaDetect === "function" ? aulaDetect(t) : null);
  return {T, t, list, ok: list.filter(x => x.ok).length, err: list.filter(x => x.err).length};
}
function profPanel(box) {
  const {T, t, list, ok, err} = profState();
  fill(box, h("div", {class: "mis-head"},
    h("p", {class: "label", text: "Treino com a IA"}),
    h("p", {class: "mis-goal", text: T.title}),
    h("p", {class: "mis-stat"}, h("b", {text: String(ok)}), " de " + list.length + (list.length === 1 ? " fala certa" : " falas certas"))),
  err ? h("p", {class: "muted small-text", text: plural(err, "fala teve", "falas tiveram") + " erro de " + T.title.split(/[:(]/)[0].trim() + "."}) : null,
  h("div", {class: "row"}, h("button", {class: "quiet small", type: "button", onclick: profAskPt}, "Explica em português")),
  typeof convFichaNode === "function" ? convFichaNode(T.id, t) : null);
}
/* Vai com a sessão salva (como as metas da missão) e conta no acerto do tópico, uma vez. */
function profSessionExtra() {
  const {T, list} = profState(), done = list.filter(x => !x.pending);
  if (!mis.recorded) {
    mis.recorded = true;
    for (const x of done.slice(-PROF_MAX_RECORD)) gramRecord([T.id], x.ok);
  }
  return done.length ? {mission: {done: done.filter(x => x.ok).length, total: done.length}} : {};
}
function profSummaryNode() {
  const {T, list, ok} = profState(), info = typeof gramInfos === "function" ? gramInfos().find(y => y.t.id === T.id) : null;
  return h("div", {class: "mis-result" + (list.length && ok === list.length ? " ok" : "")},
    list.length ? h("p", null, T.title + ": ", h("b", {text: ok + " de " + list.length}), list.length === 1 ? " fala certa." : " falas certas.")
      : h("p", null, "O app não encontrou " + T.title.split(/[:(]/)[0].trim().toLowerCase() + " nas suas falas. Na próxima, tente usar mais."),
    info && typeof gramBadge === "function" ? h("p", null, "O tópico agora está: ", gramBadge(info.state)) : null,
    h("div", {class: "row"}, h("button", {class: "small", type: "button", onclick: () => { showView("grammar"); renderGrammarTopic(T.id); }}, "Voltar ao tópico"),
      h("button", {class: "quiet small", type: "button", onclick: () => profOpen(T.id)}, "Treinar de novo")));
}

/* ---------- Porta: na Gramática ---------- */
function profOpen(id) {
  if (!GRAMMAR_BY_ID.has(id)) return;
  if (typeof aula !== "undefined" && aula.id && typeof aulaClose === "function") aulaClose(); // vindo do fim da aula
  showView("conversa");
  openConversaTopic(profTopic(id));
}
function profButton(id, cls = "") {
  if (typeof convAvailable !== "function" || !convAvailable()) return null;
  if (typeof liveRefresh === "function" && liveAvailable() && !liveState.info) liveRefresh();
  return h("button", {class: cls, type: "button", title: "Conversa com a professora sobre este tópico: ela explica em português e treina com você em alemão. Pelo Ao vivo (Gemini) quando ele estiver ligado na Conversa.",
    onclick: () => profOpen(id)}, iconText("chat", "Treinar com a IA"));
}
