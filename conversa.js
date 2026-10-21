"use strict";
/* Conversa: parceira de conversa ilimitada no nível do usuário (LLM local, Gemma, via satzDesktop.convChat).
   Fluxo: tema → a parceira abre → você fala (Whisper) ou escreve → ela responde com recasts → no fim, resumo dos erros.
   Voz: Google Chirp 3 HD pelo processo principal (com trava mensal) ou, na falta, a voz do Windows.
   Carregado antes de app.js; usa o estado e as funções de app.js apenas quando chamado. */

const CONV_TOPICS = [
  {id: "vorstellen", group: "Temas", level: "A1", pt: "Se apresentar", de: "sich vorstellen: Name, Herkunft, Wohnort, Beruf, Sprachen"},
  {id: "familie", group: "Temas", level: "A1", pt: "Família", de: "die Familie"},
  {id: "tag", group: "Temas", level: "A1", pt: "Minha rotina", de: "der Tagesablauf"},
  {id: "essen", group: "Temas", level: "A1", pt: "Comer e beber", de: "Essen und Trinken, Lieblingsessen"},
  {id: "wohnen", group: "Temas", level: "A1", pt: "Onde eu moro", de: "die Wohnung und der Wohnort"},
  {id: "freizeit", group: "Temas", level: "A1", pt: "Tempo livre e hobbies", de: "Freizeit und Hobbys"},
  {id: "wochenende", group: "Temas", level: "A1", pt: "O fim de semana", de: "das Wochenende: was hast du gemacht?"},
  {id: "arbeit", group: "Temas", level: "A1", pt: "Meu trabalho", de: "die Arbeit: Luiz ist Arzt (Dienste, Kollegen, Krankenhaus)"},
  {id: "wetter", group: "Temas", level: "A1", pt: "Tempo e estações", de: "das Wetter und die Jahreszeiten"},
  {id: "deutsch", group: "Temas", level: "A2", pt: "Por que aprendo alemão", de: "Deutsch lernen und der geplante Umzug nach Deutschland"},
  {id: "urlaub", group: "Temas", level: "A2", pt: "Viagens e férias", de: "Urlaub und Reisen"},
  {id: "stadt", group: "Temas", level: "A2", pt: "Brasil e Alemanha", de: "das Leben in Brasilien und in Deutschland: Unterschiede"},
  {id: "baeckerei", group: "Situações", level: "A1", pt: "Na padaria", role: "eine Verkäuferin in einer Bäckerei", rolePt: "Vendedora", setting: "Luiz kauft Frühstück.", sie: true},
  {id: "restaurant", group: "Situações", level: "A1", pt: "No restaurante", role: "der Kellner in einem Restaurant", rolePt: "Garçom", setting: "Luiz möchte essen und trinken und am Ende bezahlen.", sie: true},
  {id: "weg", group: "Situações", level: "A1", pt: "Perguntar o caminho", role: "eine Frau auf der Straße", rolePt: "Passante", setting: "Luiz sucht den Bahnhof und fragt nach dem Weg.", sie: true, luizStarts: true},
  {id: "termin", group: "Situações", level: "A2", pt: "Marcar consulta", role: "die Mitarbeiterin am Telefon einer Hausarztpraxis", rolePt: "Recepcionista", setting: "Luiz ruft an und möchte einen Termin.", sie: true},
  {id: "wohnung", group: "Situações", level: "A2", pt: "Visitar apartamento", role: "der Vermieter einer Wohnung", rolePt: "Proprietário", setting: "Luiz besichtigt eine Wohnung und stellt Fragen.", sie: true},
  {id: "buergeramt", group: "Situações", level: "A2", pt: "Bürgeramt: Anmeldung", role: "ein Sachbearbeiter im Bürgeramt", rolePt: "Atendente", setting: "Luiz meldet seine neue Wohnung an.", sie: true},
  {id: "frei", group: "Livre", level: "A1", pt: "Conversa livre", de: "ein freies Gespräch: frag Luiz zuerst, worüber er sprechen möchte"}
];
const CONV_LEVEL_RULES = {
  A1: "Use A1 German: at most 2 short sentences per turn (max. 10 words each), present tense or Perfekt, very common words.",
  A2: "Use A2 German: at most 3 short sentences per turn, present tense, Perfekt and modal verbs; simple 'weil' or 'dass' clauses are fine.",
  B1: "Use B1 German: at most 3 or 4 sentences per turn, natural everyday language; subordinate clauses are fine.",
  B2: "Use natural spoken German (B2), at most 4 sentences per turn."
};
const CONV_NAMES = {charon: "Jonas", aoede: "Lena", system: "Lena"};
const CONV_START = "(Beginne das Gespräch mit einer kurzen Begrüßung und einer ersten Frage.)";
const CONV_HUH = "Wie bitte? Kannst du das bitte einfacher sagen?";
const CONV_HUH_SIE = "Wie bitte? Können Sie das bitte einfacher sagen?";
const conv = {topic: null, messages: [], turns: [], busy: false, clip: null, token: 0, startedAt: 0, audio: new Map(), ttsWarned: false, status: null, finished: false};

// ---------- Dados (progresso) ----------
function convData() {
  progress.practice = progress.practice || {scenes: {}, pron: {}};
  return progress.practice.conversa || (progress.practice.conversa = {sessions: []});
}
function sanitizeConversa(src) {
  const out = {sessions: []};
  if (!src || !Array.isArray(src.sessions)) return out;
  const str = (v, n) => String(v == null ? "" : v).slice(0, n);
  out.sessions = src.sessions.filter(s => s && Number.isFinite(Number(s.at)) && Number(s.at) > 0)
    .map(s => ({at: Number(s.at), topic: str(s.topic, 40), turns: Math.max(0, Math.round(Number(s.turns) || 0)), words: Math.max(0, Math.round(Number(s.words) || 0)),
      secs: Math.max(0, Math.round(Number(s.secs) || 0)),
      errors: (Array.isArray(s.errors) ? s.errors : []).filter(e => e && e.certo).slice(0, 8).map(e => ({errado: str(e.errado, 300), certo: str(e.certo, 300), explicacao: str(e.explicacao, 500)})),
      // Anamnese da FSP: quantos fatos do caso foram descobertos.
      ...(s.fsp && Number(s.fsp.total) > 0 ? {fsp: {found: Math.max(0, Math.min(Number(s.fsp.total), Math.round(Number(s.fsp.found) || 0))), total: Math.round(Number(s.fsp.total))}} : {})}))
    .sort((a, b) => a.at - b.at).slice(-300);
  return out;
}
function mergeConversa(local, incoming) {
  const out = sanitizeConversa(local), seen = new Set(out.sessions.map(s => s.at));
  for (const s of sanitizeConversa(incoming).sessions) if (!seen.has(s.at)) out.sessions.push(s);
  out.sessions.sort((a, b) => a.at - b.at);
  out.sessions = out.sessions.slice(-300);
  return out;
}

// ---------- Prompts ----------
function convLevel() { return typeof currentLevel === "function" ? currentLevel() || "A1" : "A1"; }
/* Frases que o usuário já domina (produção, não médicas), das mais estáveis para as menos. */
function convKnownSentences(max = 40) {
  return cards.filter(c => tag(c, "Modus") === "Produktion" && !isMedical(c) && studied(c))
    .map(c => [c, Number((modeProgress(c.id, "production") || {}).stability) || 0])
    .sort((a, b) => b[1] - a[1]).slice(0, max).map(([c]) => c.frase);
}
function convName(topic = conv.topic) { return topic && topic.role ? topic.rolePt : CONV_NAMES[settings.convVoice] || "Jonas"; }
/* Situações usam Sie, exceto as cenas informais (improviso de cena com du). */
function convSie(topic = conv.topic) { return !!(topic && topic.role && topic.sie !== false); }
function convSystemPrompt({name, level, topic, known}) {
  if (topic.patient && typeof fspPatientPrompt === "function") return fspPatientPrompt(topic, level);
  const lines = [`You are ${name}, a friendly German conversation partner for Luiz, a Brazilian doctor who is learning German (level ${level}).`];
  if (topic.role) lines.push(`Role-play: you are ${topic.role}. Situation: ${topic.setting} Stay in your role and use "${convSie(topic) ? "Sie" : "du"}".`);
  else lines.push(`Topic: ${topic.de}. Use "du".`);
  if (topic.book) lines.push(`Luiz is reading the German book "${topic.book.title}" and has just read the chapter "${topic.book.chapter}". Talk with him about it: ask simple questions about what happens, the characters, what he thinks and feels about it and what he would do, one question at a time. If he does not remember, help with a small hint. Chapter text, for reference only (do not read it out or quote long parts):`,
    topic.book.text);
  if (topic.script && topic.script.length) lines.push("This is a variation of a scene Luiz has already practised. Original script, for reference only (do NOT repeat it word for word):",
    ...topic.script.map(s => "  " + s),
    "Keep the same situation and your role, but change some details (for example prices, times, products, names) and ask one small unexpected question, so Luiz has to listen and adapt. When the situation is naturally finished, say goodbye in one short sentence.");
  lines.push("Rules:",
    "- Speak ONLY German. " + (CONV_LEVEL_RULES[level] || CONV_LEVEL_RULES.A1),
    "- Always end your turn with ONE simple question or a natural next step, so the conversation continues.",
    "- Never explain grammar and never say \"richtig\" or \"falsch\". If Luiz makes a mistake, naturally reuse the correct form in your reply (recast). Example: Luiz: \"Ich habe nach Hause gegangen.\" You: \"Ah, du bist nach Hause gegangen! Wann?\"",
    "- If Luiz says he does not understand, say the same thing again, shorter and with easier words.",
    "- If Luiz asks \"Wie sagt man ... auf Deutsch?\", give the German word with its article, then continue.",
    "- Luiz's messages are transcribed speech: ignore capitalization and punctuation.",
    "- No emojis, no English, no Portuguese, no lists, no markdown.");
  if (known && known.length >= 5) lines.push("Luiz already knows these sentences. Prefer their words and structures:", ...known.map(s => "- " + s));
  return lines.join("\n");
}
/* O processo principal corta cada mensagem em 6000 caracteres: em conversas longas, fica o final (o mais recente). */
function convTranscript(max = 5800) {
  const lines = conv.turns.map(t => (t.who === "me" ? "Luiz: " : "Partner: ") + t.de), out = [];
  let chars = 0;
  for (let i = lines.length - 1; i >= 0 && chars + lines[i].length + 1 <= max; i--) { out.unshift(lines[i]); chars += lines[i].length + 1; }
  return (out.length < lines.length ? "(earlier part omitted)\n" : "") + out.join("\n");
}
/* Erro × estilo: só o que quebra uma regra é erro (vira cartão com o erro marcado). O que está certo, mas um nativo
   diria diferente, vai para “estilo” e nunca conta como erro. */
const CONV_SUMMARY_SCHEMA = {type: "object", properties: {
  erros: {type: "array", maxItems: 5, items: {type: "object", properties: {errado: {type: "string"}, certo: {type: "string"}, explicacao: {type: "string"}}, required: ["errado", "certo", "explicacao"]}},
  estilo: {type: "array", maxItems: 3, items: {type: "object", properties: {disse: {type: "string"}, natural: {type: "string"}, explicacao: {type: "string"}}, required: ["disse", "natural", "explicacao"]}},
  elogio: {type: "string"}, frases: {type: "array", maxItems: 3, items: {type: "string"}}}, required: ["erros", "estilo", "elogio", "frases"]};
const CONV_ERROR_RULES = `Split his problems into two lists. "erros" = real mistakes only: a broken rule of German (gender/article, case, adjective ending, verb conjugation, sein/haben in the Perfekt, verb position V2 or verb at the end, separable prefix, wrong preposition, wrong or non-existent word, wrong meaning, du/Sie mixed up). For each: the wrong part exactly as he said it, the correct German, and a one-sentence explanation in Brazilian Portuguese. "estilo" = sentences that are grammatically correct but a native speaker would usually say differently (word choice, a more idiomatic phrase, more natural word order): what he said, the more natural version and a short explanation in Brazilian Portuguese. Never put the same thing in both lists, never list a correct sentence as an error, and when in doubt, it is style, not an error. Ignore capitalization and punctuation (it is transcribed speech). Short answers without a verb that are normal in spoken German (e.g. "Mit Milch, bitte.", "Ja, gern.", "Aus Brasilien.") are correct.`;
/* Lê o JSON do resumo (Conversa e 4/3/2). Descarta “erros” em que o certo só difere em maiúsculas, pontuação ou espaços:
   na fala transcrita isso não é erro do aluno. */
const convBare = s => String(s || "").toLowerCase().replace(/[.,!?;:"“”„'’()…-]/g, "").replace(/\s+/g, " ").trim();
function convFeedback(j) {
  const bare = convBare;
  const errors = j && Array.isArray(j.erros) ? j.erros.filter(e => e && e.certo && bare(e.errado) !== bare(e.certo))
    .map(e => ({errado: convClean(e.errado), certo: convClean(e.certo), explicacao: convClean(e.explicacao)})) : [];
  const seen = new Set(errors.map(e => bare(e.errado)));
  const style = j && Array.isArray(j.estilo) ? j.estilo.filter(s => s && s.natural && bare(s.disse) !== bare(s.natural) && !seen.has(bare(s.disse)))
    .map(s => ({disse: convClean(s.disse), natural: convClean(s.natural), explicacao: convClean(s.explicacao)})) : [];
  return {errors, style, frases: j && Array.isArray(j.frases) ? j.frases.map(convClean).filter(Boolean) : [], elogio: j ? convClean(j.elogio) : ""};
}
/* Lista das sugestões de estilo: sem riscar nada; o cartão (opcional) é da versão natural, sem erro marcado. */
function convStyleList(style) {
  if (!style.length) return [];
  return [h("h4", {text: "Sugestões de estilo (não são erros)"}),
    h("ul", {class: "conv-errors conv-style"}, ...style.map(s => h("li", null,
      h("p", null, h("span", {lang: "de", text: s.disse}), " → ", h("b", {lang: "de", text: s.natural}),
        h("button", {class: "icon-btn quiet", type: "button", title: "Ouvir", "aria-label": "Ouvir a versão mais natural", onclick: () => convSpeak(s.natural)}, icon("volume", 16)),
        convCardButton({frase: s.natural}, "conv-card-style")),
      h("p", {class: "muted small-text", text: s.explicacao}))))];
}
const CONV_HOWTO_SCHEMA = {type: "object", properties: {de: {type: "string"}, nota: {type: "string"}}, required: ["de", "nota"]};
const CONV_HINT_SCHEMA = {type: "object", properties: {dicas: {type: "array", minItems: 1, maxItems: 2, items: {type: "object", properties: {de: {type: "string"}, pt: {type: "string"}}, required: ["de", "pt"]}}}, required: ["dicas"]};
function parseLooseJson(text) {
  const s = String(text || "").trim();
  try { return JSON.parse(s); } catch (e) { /* tenta o trecho entre chaves */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { /* inválido */ } }
  return null;
}
const convClean = text => String(text || "").replace(/\*\*?|__|`/g, "").replace(/\s+/g, " ").trim();

// ---------- Correção a cada fala ----------
/* Cada fala sua ganha um sinal claro: “Certo”, “N erros” (toque para ver a versão corrigida) ou “Certo, com uma dica”
   (só estilo, na correção rígida). Roda depois da resposta da parceira (a placa de vídeo atende um pedido por vez)
   e não trava a conversa. */
const CONV_CHECK_LEVELS = {
  off: {label: "Desligada"},
  suave: {label: "Suave", rule: `Report ONLY mistakes that make the line hard to understand or change what he means: a wrong or non-existent word, the wrong meaning, a missing or wrong verb that makes the sentence unclear. Do NOT report wrong endings, articles, gender, cases, conjugation, sein/haben or word order when the meaning is still clear: in this mode "in ein Krankenhaus", "mein Frau", "gestern ich habe", "weil es ist gesund" and "ich habe nach Hause gegangen" are NOT reported. When in doubt, report nothing. "estilo" must be empty.`},
  equilibrado: {label: "Equilibrada", rule: `Report real mistakes only: a broken rule of German (gender/article, case, adjective ending, verb conjugation, sein/haben in the Perfekt, verb position V2 or verb at the end, separable prefix, wrong preposition, wrong or non-existent word, wrong meaning, du/Sie mixed up). Something that is correct but unusual is NOT a mistake. "estilo" must be empty.`},
  rigido: {label: "Rígida", rule: `Report every real mistake: a broken rule of German (gender/article, case, adjective ending, verb conjugation, sein/haben in the Perfekt, verb position V2 or verb at the end, separable prefix, wrong preposition, wrong or non-existent word, wrong meaning, du/Sie mixed up). Also, in "estilo", up to 2 things that are correct but a native speaker would say differently (more natural word order, word choice, idiom). Never put the same thing in both lists.`}};
const CONV_CHECK_SCHEMA = {type: "object", properties: {
  erros: {type: "array", maxItems: 3, items: {type: "object", properties: {errado: {type: "string"}, certo: {type: "string"}, explicacao: {type: "string"}}, required: ["errado", "certo", "explicacao"]}},
  estilo: {type: "array", maxItems: 2, items: {type: "object", properties: {disse: {type: "string"}, natural: {type: "string"}, explicacao: {type: "string"}}, required: ["disse", "natural", "explicacao"]}},
  corrigida: {type: "string"}}, required: ["erros", "estilo", "corrigida"]};
function convCheckLevel() { return CONV_CHECK_LEVELS[settings.convCheck] ? settings.convCheck : "equilibrado"; }
function convCheckPrompt(level, cefr = convLevel()) {
  return `You check ONE line that Luiz, a Brazilian learner of German (level ${cefr}), said in a spoken conversation. The partner's previous line is given only as context; do not check it. ${CONV_CHECK_LEVELS[level].rule} Ignore capitalization and punctuation (it is transcribed speech). Short answers without a verb that are normal in spoken German (e.g. "Mit Milch, bitte.", "Ja, gern.", "Aus Brasilien.") are correct. For each mistake: the wrong part exactly as he said it, the correct German, and one short sentence in Brazilian Portuguese explaining the rule. "corrigida" = his whole line with the mistakes fixed and nothing else changed (keep his words and meaning); with no mistakes, repeat his line. Only report something you are sure is wrong; when in doubt, it is not a mistake. Never assume facts he did not say (for example how he travelled). When a word is wrong or does not exist, give the word that best fits what he most likely meant, using the partner's question as context. The correction must itself be correct German. Answer as JSON.`;
}
/* Lê a resposta da IA com os mesmos filtros do resumo final; sem erro e sem dica = certo. */
function convCheckResult(said, j, level) {
  if (!j) return {state: "fail", errors: [], style: [], fixed: ""};
  const {errors, style} = convFeedback(j);
  const fixed = convClean(j.corrigida), changed = errors.length && fixed && convBare(fixed) !== convBare(said);
  // Dica de estilo que só repete a frase corrigida (o Gemma faz isso às vezes) não é dica.
  const st = level === "rigido" ? style.filter(s => convBare(s.natural) !== convBare(fixed)) : [];
  return {state: errors.length ? "erro" : st.length ? "estilo" : "ok", errors, style: st, fixed: changed ? fixed : ""};
}
async function convCheckTurn(turn, bubble) {
  const level = convCheckLevel(), token = conv.token;
  if (level === "off" || !convAvailable() || turn.de === CONV_HUH || turn.de === CONV_HUH_SIE) return;
  const k = conv.turns.indexOf(turn), prev = conv.turns.slice(0, Math.max(0, k)).reverse().find(t => t.who === "partner");
  turn.check = {state: "checking", errors: [], style: [], fixed: ""};
  convCheckMark(turn, bubble);
  let j = null;
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: convCheckPrompt(level)},
      {role: "user", content: (prev ? "Partner: " + prev.de + "\n" : "") + "Luiz: " + turn.de}], {kind: "check", temperature: .1, maxTokens: 500, schema: CONV_CHECK_SCHEMA});
    j = parseLooseJson(r.text);
  } catch (e) { reportError("conversa", "correção da fala: " + e.message); }
  if (token !== conv.token) return;
  turn.check = convCheckResult(turn.de, j, level);
  convCheckMark(turn, bubble);
}
/* O sinal fica dentro do balão, embaixo da frase; com erro ou dica, ele abre e fecha a correção. */
function convCheckMark(turn, bubble) {
  const c = turn.check;
  if (!bubble || !c) return;
  bubble.querySelector(".cv-check")?.remove();
  bubble.querySelector(".cv-fix")?.remove();
  const n = c.errors.length, opens = c.state === "erro" || c.state === "estilo";
  const label = {checking: "Conferindo…", ok: "Certo", erro: n === 1 ? "1 erro" : n + " erros", estilo: "Certo, com uma dica", fail: "Não conferida"}[c.state];
  const mark = h(opens ? "button" : "span", {class: "cv-check " + c.state, type: opens ? "button" : null, "aria-expanded": opens ? "false" : null,
    title: c.state === "fail" ? "A correção desta fala não saiu; o resumo no fim continua valendo." : opens ? "Ver a correção" : null},
    c.state === "ok" || c.state === "estilo" ? icon("check", 14) : c.state === "erro" ? h("i", {class: "cv-dot"}) : null, h("span", {text: label}),
    opens ? icon("chevron", 14) : null);
  if (opens) mark.addEventListener("click", () => {
    const open = bubble.querySelector(".cv-fix");
    if (open) open.remove();
    else { const fix = convFixNode(turn); bubble.append(fix); convRevealAboveInput(fix); }
    mark.setAttribute("aria-expanded", String(!open));
  });
  bubble.append(mark);
}
/* A frase corrigida com as palavras trocadas marcadas, os erros explicados (com “Criar cartão”) e as dicas de estilo. */
/* A caixa de digitar fica presa embaixo da tela: rola só o necessário para a correção aberta aparecer acima dela. */
function convRevealAboveInput(el) {
  const box = document.querySelector("#convRoom .conv-input"), r = el.getBoundingClientRect();
  const limit = box && !box.hidden ? box.getBoundingClientRect().top - 16 : window.innerHeight - 16;
  if (r.bottom > limit) window.scrollBy({top: r.bottom - limit, behavior: "smooth"});
}
function convFixNode(turn) {
  const c = turn.check, speakBtn = text => h("button", {class: "icon-btn quiet", type: "button", title: "Ouvir", "aria-label": "Ouvir", onclick: () => convSpeak(text)}, icon("volume", 16));
  return h("div", {class: "cv-fix"},
    c.fixed ? h("div", {class: "cv-fixed"}, h("p", {lang: "de"}, convDiffNodes(c.fixed, turn.de)), speakBtn(c.fixed)) : null,
    c.errors.length ? h("ul", {class: "cv-list"}, ...c.errors.map(e => h("li", null,
      h("p", {class: "cv-pair"}, h("s", {lang: "de", text: e.errado}), h("span", {class: "cv-arrow", "aria-hidden": "true"}, icon("chevron", 13)), h("b", {lang: "de", text: e.certo})),
      e.explicacao ? h("p", {class: "cv-why", text: e.explicacao}) : null,
      convCardButton({erro: {...e, frase: turn.de}})))) : null,
    c.style.length ? h("ul", {class: "cv-list cv-style"}, ...c.style.map(s => h("li", null,
      h("p", {class: "cv-pair"}, h("span", {lang: "de", text: s.disse}), h("span", {class: "cv-arrow", "aria-hidden": "true"}, icon("chevron", 13)), h("b", {lang: "de", text: s.natural}), speakBtn(s.natural)),
      s.explicacao ? h("p", {class: "cv-why", text: s.explicacao}) : null))) : null);
}
function convDiffNodes(fixed, said) {
  const out = [];
  for (const [op, word] of wordDiff(fixed, said).ops) {
    if (op === "del") continue;
    if (out.length) out.push(" ");
    out.push(op === "eq" ? word : h("mark", {text: word}));
  }
  return out;
}

// ---------- Voz ----------
async function convSpeak(text, slow = false) {
  stopAudio();
  // O tema pode pedir uma voz (ex.: paciente mulher da FSP = Aoede), a não ser que o usuário tenha escolhido a voz do Windows.
  const voice = conv.topic && conv.topic.voice && settings.convVoice !== "system" ? conv.topic.voice : settings.convVoice || "charon";
  if (voice !== "system" && window.satzDesktop && window.satzDesktop.tts) {
    const key = voice + (slow ? "|s|" : "|n|") + text;
    try {
      let url = conv.audio.get(key);
      if (!url) {
        const r = await window.satzDesktop.tts(text, {voice, slow});
        url = URL.createObjectURL(new Blob([r.audio], {type: "audio/mpeg"}));
        conv.audio.set(key, url);
      }
      const player = new Audio(url);
      audioPlayer = player;
      await player.play().catch(() => {});
      return player;
    } catch (e) { convTtsWarn(e); }
  }
  speak(text, slow);
  return null;
}
function convTtsWarn(e) {
  if (conv.ttsWarned) return;
  conv.ttsWarned = true;
  const code = (String(e && e.message || "").match(/sem-chave|limite|sem-internet|google-\d+|autoteste/) || [""])[0];
  const msg = {"sem-chave": "A voz do Google não tem chave configurada (Configurações → Conversa). Usando a voz do Windows.",
    limite: "Limite mensal da voz do Google atingido (900 mil caracteres). Para não haver cobrança, a conversa usa a voz do Windows até o mês virar.",
    "sem-internet": "Sem internet: a conversa usa a voz do Windows."}[code] || "A voz do Google falhou; usando a voz do Windows.";
  toast(msg, code === "limite" ? "error" : "info", 9000);
}

// ---------- Tela ----------
function convAvailable() { return !!(window.satzDesktop && window.satzDesktop.convChat); }
async function renderConversa() {
  const idle = () => !conv.topic && !f432.topic;
  if (idle()) renderConvSetup();
  if (!convAvailable()) return;
  try { conv.status = await window.satzDesktop.convStatus(); } catch (e) { conv.status = null; }
  if (idle()) renderConvSetup();
  if (conv.status && conv.status.installed && !conv.status.running && !conv.status.loading) {
    window.satzDesktop.convStart().then(s => { conv.status = s; if (currentView === "conversa" && idle()) renderConvSetup(); })
      .catch(e => { reportError("conversa", e.message); if (currentView === "conversa" && idle()) renderConvSetup(); });
    conv.status.loading = true;
    if (idle()) renderConvSetup();
  }
}
function convModelLine() {
  const s = conv.status;
  if (!convAvailable()) return h("p", {class: "notice warn", text: "A conversa precisa do aplicativo do Windows (com a parceira instalada)."});
  if (!s) return h("p", {class: "muted small-text", text: "Verificando a parceira de conversa…"});
  if (!s.installed) return h("p", {class: "notice warn", text: "A parceira de conversa não está instalada: falta o modelo em resources\\llm (llama.cpp + arquivo .gguf)."});
  if (s.loading) return h("p", {class: "muted small-text", text: "Carregando a parceira na placa de vídeo… (uns 15 segundos; pode ir escolhendo o tema)"});
  return h("p", {class: "muted small-text", text: "Parceira pronta · roda neste computador, sem internet e sem limite."});
}
function renderConvSetup() {
  $("convRoom").hidden = true;
  $("f432Room").hidden = true;
  $("convSetup").hidden = false;
  const level = convLevel(), data = convData(), last = data.sessions[data.sessions.length - 1];
  const groups = ["Temas", "Situações", "Livre"].map(g => [g, CONV_TOPICS.filter(t => t.group === g)]);
  fill($("convSetup"),
    h("div", {class: "panel"},
      h("p", {text: "Seu nível agora: " + level + ". A parceira fala nesse nível e usa, de preferência, as palavras das frases que você já aprendeu. Conforme você avança no treino, a conversa sobe junto."}),
      h("p", {class: "muted small-text", text: "Fale (F) ou escreva. Ela responde repetindo certo o que você disse, sem interromper. Cada fala sua ganha um sinal (Certo ou o número de erros; toque para ver a correção) e, no fim, você vê o resumo dos erros em português."}),
      convModelLine(),
      last ? h("p", {class: "muted small-text", text: data.sessions.length + (data.sessions.length === 1 ? " conversa feita" : " conversas feitas") + " · última em " + new Date(last.at).toLocaleDateString("pt-BR") + "."}) : null),
    f432SetupNode(),
    typeof fspSetupNode === "function" ? fspSetupNode() : null,
    ...groups.map(([g, list]) => h("section", {class: "scene-group"},
      h("h2", {text: g === "Situações" ? "Situações (ela faz o outro papel)" : g}),
      h("div", {class: "scene-grid"}, ...list.map(t => h("article", {class: "scene-card"},
        h("div", {class: "scene-top"}, h("span", {class: "tag", text: t.level}), t.role ? h("span", {class: "tag", text: "Sie"}) : null),
        h("h3", {text: t.pt}),
        t.role ? h("p", {class: "muted small-text", text: "Com: " + t.rolePt.toLowerCase()}) : null,
        h("div", {class: "row"}, h("button", {class: "primary small", type: "button", disabled: !(conv.status && conv.status.installed), onclick: () => openConversa(t.id)}, "Conversar"))))))));
}
function convBubble(turn) {
  const mine = turn.who === "me";
  const el = h("div", {class: "bubble " + (mine ? "me" : "other")});
  el.append(h("span", {class: "bubble-name", text: mine ? "Você" : convName()}));
  const de = h("p", {class: "bubble-de", lang: "de", text: turn.de});
  if (mine) { el.append(de); return el; }
  const showText = settings.convShowText !== false;
  if (!showText) {
    de.hidden = true;
    el.append(h("button", {class: "quiet small reveal-text", type: "button", onclick: e => { de.hidden = false; e.currentTarget.remove(); }}, "Mostrar texto"));
  }
  const pt = h("p", {class: "bubble-pt", hidden: true});
  const translate = h("button", {class: "quiet small", type: "button", onclick: async e => {
    const btn = e.currentTarget;
    if (turn.pt) { pt.textContent = turn.pt; pt.hidden = !pt.hidden; return; }
    btn.disabled = true;
    try {
      const r = await window.satzDesktop.convChat([{role: "system", content: "Translate the German text into natural Brazilian Portuguese. Answer only with the translation."}, {role: "user", content: turn.de}], {kind: "translate", temperature: .2, maxTokens: 200});
      turn.pt = convClean(r.text); pt.textContent = turn.pt; pt.hidden = false;
    } catch (err) { setStatus("Não consegui traduzir: " + cleanIpcError(err, "erro"), "error"); }
    btn.disabled = false;
  }}, "Tradução");
  el.append(de, pt, h("div", {class: "row bubble-actions"},
    h("button", {class: "quiet small", type: "button", onclick: () => convSpeak(turn.de)}, icon("volume", 16), "Ouvir"),
    h("button", {class: "quiet small", type: "button", onclick: () => convSpeak(turn.de, true)}, icon("slow", 16), "Devagar"),
    translate));
  return el;
}
function convScroll() { const c = $("convChat"); c.lastElementChild?.scrollIntoView({behavior: "smooth", block: "nearest"}); }
function convSetBusy(busy, text) {
  conv.busy = busy;
  for (const id of ["convSend", "convHuh", "convHowto", "convHint", "convFinish"]) $(id).disabled = busy || conv.finished;
  $("convMic").disabled = (busy && !conv.clip) || conv.finished || !speechAvailable();
  $("convMic").hidden = !speechAvailable();
  $("convStatus").textContent = text || "";
  const pending = $("convChat").querySelector(".bubble.pending");
  if (busy && text && text.startsWith(convName()) && !pending) { $("convChat").append(h("div", {class: "bubble other pending"}, h("span", {class: "bubble-name", text: convName()}), h("p", {class: "typing-dots", text: "…"}))); convScroll(); }
  if (!busy && pending) pending.remove();
}
function openConversa(id) {
  const topic = CONV_TOPICS.find(t => t.id === id);
  if (topic) openConversaTopic(topic);
}
function openConversaTopic(topic) {
  if (!topic) return;
  const level = convLevel();
  Object.assign(conv, {topic, turns: [], busy: false, token: conv.token + 1, startedAt: Date.now(), ttsWarned: false, finished: false,
    messages: [{role: "system", content: convSystemPrompt({name: convName(topic), level, topic, known: convKnownSentences()})}]});
  $("convSetup").replaceChildren();
  $("convRoom").hidden = false;
  $("convSummary").hidden = true;
  $("convHelp").hidden = true;
  $("convTitle").textContent = topic.pt;
  fill($("convMeta"), h("span", {class: "tag", text: "Nível " + level}), h("span", {class: "tag", text: convSie(topic) ? "Sie · formal" : "du · informal"}),
    h("span", {class: "tag", text: "Com: " + convName(topic)}));
  $("convSetting").textContent = topic.patient ? "Você é o médico: cumprimente, apresente-se e faça a anamnese completa (queixa atual, vegetativa, antecedentes, medicamentos, alergias, hábitos, família, social). O paciente só conta o que você perguntar. Quando acabar, toque em “Terminar e ver erros”."
    : topic.script ? "Improviso da cena: a mesma situação, mas com detalhes diferentes. Ouça bem e se adapte."
    : topic.role ? "Situação: você é o cliente/paciente; " + convName(topic).toLowerCase() + " faz o outro papel." : "";
  $("convShowText").checked = settings.convShowText !== false;
  $("convAutoSend").checked = !!settings.convAutoSend;
  $("convHandsFree").checked = !!settings.convHandsFree;
  $("convCheck").value = convCheckLevel();
  conv.handsFreePaused = false; conv.emptyListens = 0;
  $("convHuh").title = "Envia: “" + (convSie(topic) ? CONV_HUH_SIE : CONV_HUH) + "” (ela repete mais fácil)";
  $("convRoom").classList.remove("finished");
  $("convChat").replaceChildren();
  $("convText").value = "";
  window.scrollTo({top: 0});
  if (topic.luizStarts) { convSetBusy(false, "Você começa: cumprimente e faça a sua pergunta."); $("convText").focus(); if (settings.convHandsFree) convListen(); }
  else partnerTurn(CONV_START);
}
/* Conversa sem fim: o modelo recebe as instruções e só as falas mais recentes (até 30 mensagens e ~14 mil
   caracteres), para não passar do contexto (8192 tokens) nem do limite de mensagens do processo principal. */
const CONV_WINDOW = 30, CONV_WINDOW_CHARS = 14000;
function convContext(messages) {
  const [system, ...rest] = messages;
  let start = Math.max(0, rest.length - CONV_WINDOW), chars = 0;
  for (let i = rest.length - 1; i >= start; i--) { chars += rest[i].content.length; if (chars > CONV_WINDOW_CHARS) { start = i + 1; break; } }
  while (start < rest.length - 1 && rest[start].role !== "user") start++;
  if (!start) return messages;
  const note = "\n\n(The beginning of this conversation is no longer shown. Continue it naturally; do not greet again or restart the topic.)";
  return [{role: system.role, content: system.content + note}, ...rest.slice(start)];
}
async function partnerTurn(userText) {
  const token = conv.token;
  conv.messages.push({role: "user", content: userText});
  convSetBusy(true, convName() + " está respondendo…");
  try {
    const r = await window.satzDesktop.convChat(convContext(conv.messages), {kind: "turn", temperature: .7, maxTokens: 160});
    if (token !== conv.token) return;
    const text = convClean(r.text) || "…";
    conv.messages.push({role: "assistant", content: text});
    const turn = {who: "partner", de: text};
    conv.turns.push(turn);
    convSetBusy(false, "");
    $("convChat").append(convBubble(turn));
    convScroll();
    const speaking = convSpeak(text);
    $("convStatus").textContent = speechAvailable() ? "Sua vez: fale (F) ou escreva e aperte Enter." : "Sua vez: escreva e aperte Enter.";
    if (settings.convHandsFree) speaking.then(convWaitAudio).then(() => { if (token === conv.token) convListen(); });
  } catch (e) {
    if (token !== conv.token) return;
    conv.messages.pop();
    convSetBusy(false, "");
    setStatus("A parceira não respondeu: " + cleanIpcError(e, "erro desconhecido"), "error");
  }
}
function convSend(textArg) {
  if (conv.busy || conv.finished || !conv.topic) return;
  const text = convClean(textArg != null ? textArg : $("convText").value);
  if (!text) { $("convText").focus(); return; }
  $("convText").value = "";
  $("convHelp").hidden = true;
  const turn = {who: "me", de: text}, bubble = convBubble(turn);
  conv.turns.push(turn);
  $("convChat").append(bubble);
  convScroll();
  partnerTurn(text).then(() => convCheckTurn(turn, bubble));
}
async function convMic() {
  if (conv.clip) { conv.clip.stop(); return; }
  if (conv.busy || conv.finished || !speechAvailable()) return;
  stopAudio();
  const clip = await startClip(30000);
  if (!clip) return;
  conv.clip = clip;
  const token = conv.token;
  $("convMic").classList.add("danger-solid");
  $("convMic").replaceChildren(icon("stop", 18), "Parar", h("kbd", null, "F"));
  convSetBusy(true, "Gravando… fale em alemão (até 30 s). F ou o botão para parar.");
  $("convMic").disabled = false;
  const blob = await clip.done;
  conv.clip = null;
  $("convMic").classList.remove("danger-solid");
  $("convMic").replaceChildren(icon("mic", 18), "Falar", h("kbd", null, "F"));
  if (token !== conv.token) return;
  convSetBusy(true, "Transcrevendo sua fala neste computador…");
  let text = "";
  try { text = await transcribeBlob(blob, false); } catch (e) { setStatus("Não foi possível transcrever: " + e.message, "error"); }
  if (token !== conv.token) return;
  convSetBusy(false, "");
  if (!text) { $("convStatus").textContent = "Não ouvi nada. Tente de novo mais perto do microfone, ou escreva."; return; }
  if (settings.convAutoSend) { convSend(text); return; }
  $("convText").value = text;
  $("convText").focus();
  $("convStatus").textContent = "Confira o que o app ouviu (corrija se ele ouviu errado) e envie com Enter.";
}
// ---------- Mãos livres: ouvir sozinho, detectar o fim da fala e enviar ----------
const CONV_SILENCE_MS = 1300, CONV_WAIT_SPEECH_MS = 12000, CONV_MAX_MS = 45000;
/* Espera a fala da parceira acabar (áudio do Google ou voz do Windows). */
async function convWaitAudio(player) {
  if (player) { await waitForEnd(player, 1500); return; }
  await wait(300);
  for (let i = 0; i < 600 && window.speechSynthesis && window.speechSynthesis.speaking; i++) await wait(100);
}
function convBeep() {
  try {
    const ctx = new AudioContext(), osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = 880; gain.gain.value = .06;
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + .12);
    osc.onended = () => ctx.close();
  } catch (e) { /* sem áudio */ }
}
/* Grava com detecção de voz: começa a contar quando a fala aparece (acima do ruído medido no início)
   e para após ~1,3 s de silêncio. Sem fala em 12 s, desiste e espera o usuário (F). */
async function convListen() {
  if (!settings.convHandsFree || currentView !== "conversa" || conv.busy || conv.finished || conv.clip || !conv.topic || !speechAvailable()) return;
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio: true}); }
  catch (e) { setStatus("Acesso ao microfone negado ou indisponível.", "error"); return; }
  const token = conv.token, ctx = new AudioContext(), analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize), mr = new MediaRecorder(stream), chunks = [];
  let resolveDone;
  const done = new Promise(r => { resolveDone = r; });
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => {}); resolveDone(new Blob(chunks, {type: mr.mimeType || "audio/webm"})); };
  const t0 = Date.now(), stat = {spoke: false, reason: "", noise: 0, n: 0, loudRun: 0, lastLoud: 0};
  let timer = null;
  const stop = reason => { if (timer === null) return; clearInterval(timer); timer = null; stat.reason = stat.reason || reason; if (mr.state === "recording") mr.stop(); };
  mr.start();
  timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length), now = Date.now();
    if (now - t0 < 300) { stat.noise += rms; stat.n++; return; }
    const threshold = Math.max(.012, stat.noise / Math.max(1, stat.n) * 3);
    if (rms > threshold) { stat.loudRun++; stat.lastLoud = now; if (stat.loudRun >= 3 && !stat.spoke) { stat.spoke = true; $("convStatus").textContent = "Ouvindo… (pare de falar e ele envia sozinho)"; } }
    else stat.loudRun = 0;
    if (stat.spoke && now - stat.lastLoud > CONV_SILENCE_MS) stop("silêncio");
    else if (!stat.spoke && now - t0 > CONV_WAIT_SPEECH_MS) stop("sem fala");
    else if (now - t0 > CONV_MAX_MS) stop("tempo máximo");
  }, 50);
  conv.clip = {stop: () => stop("manual"), done};
  convBeep();
  $("convMic").classList.add("danger-solid");
  $("convMic").replaceChildren(icon("stop", 18), "Parar", h("kbd", null, "F"));
  convSetBusy(true, "Pode falar… (mãos livres)");
  $("convMic").disabled = false;
  const blob = await done;
  conv.clip = null;
  conv.lastListen = {spoke: stat.spoke, reason: stat.reason, ms: Date.now() - t0};
  $("convMic").classList.remove("danger-solid");
  $("convMic").replaceChildren(icon("mic", 18), "Falar", h("kbd", null, "F"));
  if (token !== conv.token) return;
  if (conv.handsFreePaused) { conv.handsFreePaused = false; convSetBusy(false, "Escuta pausada. Aperte F para falar."); return; }
  if (!stat.spoke) { convSetBusy(false, "Não ouvi nada. Aperte F quando quiser falar (as mãos livres voltam depois da próxima resposta)."); return; }
  convSetBusy(true, "Transcrevendo sua fala neste computador…");
  let text = "";
  try { text = await transcribeBlob(blob, false); } catch (e) { setStatus("Não foi possível transcrever: " + e.message, "error"); }
  conv.lastListen.text = text;
  if (token !== conv.token) return;
  convSetBusy(false, "");
  if (text) { conv.emptyListens = 0; convSend(text); return; }
  conv.emptyListens = (conv.emptyListens || 0) + 1;
  if (conv.emptyListens <= 2) { $("convStatus").textContent = "Não entendi. Fale de novo."; convListen(); }
  else { conv.emptyListens = 0; $("convStatus").textContent = "Não consegui entender (barulho?). Aperte F para tentar de novo, ou escreva."; }
}
function convHelpBox(...nodes) { fill($("convHelp"), h("button", {class: "icon-btn quiet help-close", type: "button", "aria-label": "Fechar", onclick: () => { $("convHelp").hidden = true; }}, "×"), ...nodes); $("convHelp").hidden = false; }
function convHowto() {
  const input = h("input", {type: "text", placeholder: "Escreva em português o que você quer dizer", "aria-label": "O que você quer dizer, em português"});
  const out = h("div");
  const ask = async () => {
    const pt = input.value.trim();
    if (!pt || conv.busy) return;
    convSetBusy(true, "Procurando como se diz…");
    try {
      const last = [...conv.turns].reverse().find(t => t.who === "partner");
      const r = await window.satzDesktop.convChat([{role: "system", content: `Luiz (German level ${convLevel()}) is in a German conversation (${convSie() ? "role-play, he uses \"Sie\"" : "he uses \"du\""}). He wants to say something and wrote it in Brazilian Portuguese. Give ONE natural, simple German sentence at his level that says exactly this, and a very short note in Brazilian Portuguese about a key word or structure (or an empty note). Answer as JSON.`},
        {role: "user", content: (last ? "The partner just said: " + last.de + "\n" : "") + "Luiz wants to say: " + pt}], {kind: "howto", temperature: .3, maxTokens: 200, schema: CONV_HOWTO_SCHEMA});
      const j = parseLooseJson(r.text) || {de: convClean(r.text), nota: ""};
      const de = convClean(j.de);
      fill(out, h("p", {class: "help-de", lang: "de", text: de}), j.nota ? h("p", {class: "muted small-text", text: convClean(j.nota)}) : null,
        h("div", {class: "row"}, h("button", {class: "quiet small", type: "button", onclick: () => convSpeak(de)}, icon("volume", 16), "Ouvir"),
          h("button", {class: "small", type: "button", onclick: () => { $("convText").value = de; $("convText").focus(); $("convHelp").hidden = true; }}, "Usar (ou fale você mesmo)")));
    } catch (e) { setStatus("Não consegui: " + cleanIpcError(e, "erro"), "error"); }
    convSetBusy(false, "");
  };
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); ask(); } });
  convHelpBox(h("h3", {text: "Como digo…?"}), h("div", {class: "row"}, input, h("button", {class: "primary small", type: "button", onclick: ask}, "Traduzir")), out);
  input.focus();
}
async function convHint() {
  if (conv.busy) return;
  const last = [...conv.turns].reverse().find(t => t.who === "partner");
  if (!last) return;
  convSetBusy(true, "Pensando em respostas possíveis…");
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: `Luiz (German level ${convLevel()}) is in a German conversation and does not know what to answer. Suggest 2 short, different possible answers at his level to the partner's last message (${convSie() ? "he uses \"Sie\"" : "he uses \"du\""}), each with a Brazilian Portuguese translation. Answer as JSON.`},
      {role: "user", content: "Partner: " + last.de}], {kind: "hint", temperature: .6, maxTokens: 250, schema: CONV_HINT_SCHEMA});
    const j = parseLooseJson(r.text);
    const list = j && Array.isArray(j.dicas) ? j.dicas.filter(d => d && d.de) : [];
    convHelpBox(h("h3", {text: "Ideias de resposta"}), h("p", {class: "muted small-text", text: "Use como ponto de partida e mude o que quiser. Falar com as suas palavras vale mais."}),
      ...list.map(d => h("div", {class: "help-item"}, h("p", {class: "help-de", lang: "de", text: convClean(d.de)}), h("p", {class: "muted small-text", text: convClean(d.pt)}),
        h("button", {class: "quiet small", type: "button", onclick: () => convSpeak(convClean(d.de))}, icon("volume", 16), "Ouvir"))));
  } catch (e) { setStatus("Não consegui: " + cleanIpcError(e, "erro"), "error"); }
  convSetBusy(false, "");
}
async function convFinish() {
  if (conv.busy || conv.finished) return;
  const mine = conv.turns.filter(t => t.who === "me");
  if (!mine.length) { convReset(); return; }
  if (conv.topic.patient && typeof fspFinish === "function") return fspFinish(mine);
  convSetBusy(true, "Preparando o resumo dos seus erros…");
  let j = null;
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: `You are a German teacher for Luiz, a Brazilian learner (level ${convLevel()}). Below is a spoken conversation (transcribed speech: ignore capitalization and punctuation). Evaluate ONLY Luiz's lines. ${CONV_ERROR_RULES} At most 5 errors and 3 style notes, only the most important; empty lists if there is nothing. Then write one short encouraging sentence in Brazilian Portuguese (elogio) and up to 3 useful, correct German sentences based on what Luiz wanted to say, for him to practise (frases). Answer as JSON.`},
      {role: "user", content: convTranscript()}], {kind: "summary", temperature: .2, maxTokens: 1000, schema: CONV_SUMMARY_SCHEMA});
    j = parseLooseJson(r.text);
  } catch (e) { setStatus("Não consegui montar o resumo: " + cleanIpcError(e, "erro"), "error"); }
  conv.finished = true;
  $("convRoom").classList.add("finished");
  convSetBusy(false, "");
  const {errors, style, frases, elogio} = convFeedback(j);
  const words = mine.reduce((n, t) => n + t.de.split(/\s+/).filter(Boolean).length, 0), secs = Math.round((Date.now() - conv.startedAt) / 1000);
  const data = convData();
  data.sessions.push({at: Date.now(), topic: conv.topic.id, turns: mine.length, words, secs, errors});
  data.sessions = data.sessions.slice(-300);
  progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
  saveProgress();
  renderConvSummary({errors, style, frases, elogio, words, turns: mine.length, secs, ok: !!j});
}
function renderConvSummary({errors, style = [], frases, elogio, words, turns, secs, ok}) {
  const tutorText = () => ["Conversa: " + conv.topic.pt + " (" + new Date().toLocaleDateString("pt-BR") + ")", "",
    ...conv.turns.map(t => (t.who === "me" ? "Eu: " : convName() + ": ") + t.de), "", "Erros apontados pelo app:",
    ...(errors.length ? errors.map(e => "- " + e.errado + " → " + e.certo + " (" + e.explicacao + ")") : ["- nenhum"]),
    ...(style.length ? ["", "Sugestões de estilo (o app acha que está certo, mas soaria mais natural assim):", ...style.map(s => "- " + s.disse + " → " + s.natural + " (" + s.explicacao + ")")] : [])].join("\n");
  fill($("convSummary"),
    h("h3", {text: "Resumo da conversa"}),
    h("p", {class: "muted", text: turns + (turns === 1 ? " fala sua" : " falas suas") + " · " + words + " palavras · " + formatDuration(secs)}),
    elogio ? h("p", {text: elogio}) : null,
    !ok ? h("p", {class: "notice warn", text: "O resumo não saiu no formato esperado. A conversa foi registrada mesmo assim."}) : null,
    h("h4", {text: errors.length ? "Os erros mais importantes" : "Nenhum erro importante encontrado"}),
    errors.length ? h("ul", {class: "conv-errors"}, ...errors.map(e => h("li", null,
      h("p", null, h("s", {lang: "de", text: e.errado}), " → ", h("b", {lang: "de", text: e.certo}),
        h("button", {class: "icon-btn quiet", type: "button", title: "Ouvir", "aria-label": "Ouvir a forma correta", onclick: () => convSpeak(e.certo)}, icon("volume", 16)),
        convCardButton({erro: {...e, frase: convLineWith(e.errado)}})),
      h("p", {class: "muted small-text", text: e.explicacao})))) : null,
    ...convStyleList(style),
    frases.length ? h("h4", {text: "Frases para praticar"}) : null,
    frases.length ? h("ul", {class: "conv-errors"}, ...frases.map(f => h("li", null, h("p", null, h("span", {lang: "de", text: f}),
      h("button", {class: "icon-btn quiet", type: "button", title: "Ouvir", "aria-label": "Ouvir a frase", onclick: () => convSpeak(f)}, icon("volume", 16)),
      convCardButton({frase: f}))))) : null,
    errors.length + frases.length > 1 ? h("button", {class: "small", type: "button", title: "Erros e frases para praticar (as sugestões de estilo ficam de fora)", onclick: e => { e.currentTarget.disabled = true; $("convSummary").querySelectorAll(".conv-card:not([disabled]):not(.conv-card-style)").forEach(b => b.click()); }}, "Criar cartões de tudo") : null,
    h("p", {class: "muted small-text", text: "As correções são feitas por um modelo automático: confira as dúvidas com o seu tutor."}),
    h("div", {class: "row"},
      h("button", {class: "primary", type: "button", onclick: () => openConversaTopic(conv.topic)}, "Conversar de novo"),
      h("button", {type: "button", onclick: convReset}, "Outro tema"),
      h("button", {class: "quiet", type: "button", onclick: async () => {
        try { await navigator.clipboard.writeText(tutorText()); toast("Conversa e erros copiados. Cole na mensagem para o tutor.", "success"); }
        catch (e) { setStatus("Não consegui copiar.", "error"); }
      }}, "Copiar para o tutor")));
  $("convSummary").hidden = false;
  $("convSummary").scrollIntoView({behavior: "smooth", block: "start"});
}
/* A fala do usuário em que aparece o trecho errado (para o cartão ter a frase inteira). */
function convLineWith(part) {
  const norm = s => String(s || "").toLowerCase().replace(/[.,!?;:"“”„]/g, "").replace(/\s+/g, " ").trim();
  const p = norm(part), turn = conv.turns.find(t => t.who === "me" && p && norm(t.de).includes(p));
  return turn ? turn.de : "";
}
/* Botão “Criar cartão”: a IA monta o cartão e ele vai para Minhas frases. Cliques são feitos um de cada vez. */
let convCardChain = Promise.resolve();
function convCardButton(entry, extraClass = "") {
  const btn = h("button", {class: "quiet small conv-card" + (extraClass ? " " + extraClass : ""), type: "button", onclick: () => {
    btn.disabled = true; btn.textContent = "Criando…";
    convCardChain = convCardChain.then(() => mineFromConversa(entry)).then(id => {
      const waiting = typeof minePending === "function" && minePending(mineData().items[id]);
      btn.textContent = waiting ? "Criado ✓ · confira em Minhas frases" : "Cartão criado ✓";
      btn.title = waiting ? "Cartões criados pela IA só entram no treino depois de conferidos (Minhas frases)." : "";
    },
      e => { btn.disabled = false; btn.textContent = "Criar cartão"; setStatus("Não consegui criar o cartão: " + cleanIpcError(e, "erro"), "error"); });
  }}, "Criar cartão");
  return btn;
}
function convReset() {
  conv.token++;
  if (conv.clip) { conv.clip.stop(); conv.clip = null; }
  stopAudio();
  conv.topic = null; conv.turns = []; conv.messages = []; conv.busy = false; conv.finished = false;
  renderConvSetup();
  window.scrollTo({top: 0});
}
function convLeave() {
  if (conv.clip) { conv.handsFreePaused = true; conv.clip.stop(); }
  if (f432.rec) f432.rec.stop();
}
function convKey(e) {
  if (!conv.topic || conv.finished) return;
  if (e.key.toLowerCase() === "f" && !e.ctrlKey) { e.preventDefault(); convMic(); }
  else if (e.key === "Escape" && conv.clip) { e.preventDefault(); conv.handsFreePaused = true; conv.clip.stop(); }
}

// ---------- Configurações ----------
async function renderConvSettings() {
  if (!$("convVoice")) return;
  $("convVoice").value = ["charon", "aoede", "system"].includes(settings.convVoice) ? settings.convVoice : "charon";
  const box = $("convKeyBox"), info = $("convModelInfo");
  if (!convAvailable()) { box.hidden = true; info.textContent = "A conversa só funciona no aplicativo do Windows."; return; }
  let s = null;
  try { s = await window.satzDesktop.convStatus(); } catch (e) { /* sem status */ }
  if (!s) return;
  info.textContent = s.installed ? "Modelo de conversa: " + s.model + " (roda na placa de vídeo, offline; desliga sozinho após 10 min sem uso)." : "Modelo de conversa não instalado (pasta resources\\llm).";
  const used = Math.round(s.tts.used / 1000), limit = Math.round(s.tts.limit / 1000);
  const keyText = s.tts.key === "app" ? "Chave do Google: configurada (guardada criptografada neste computador)." : s.tts.key === "dev" ? "Chave do Google: encontrada na pasta de desenvolvimento." : "Chave do Google: não configurada (a conversa usa a voz do Windows).";
  const input = h("input", {type: "password", autocomplete: "off", spellcheck: "false", placeholder: "Cole aqui a chave da API", "aria-label": "Chave da API do Google"});
  fill(box, h("h3", {text: "Voz do Google (Chirp 3 HD)"}),
    h("p", {class: "small-text", text: keyText}),
    h("p", {class: "muted small-text", text: "Usado este mês: " + used + " mil de " + limit + " mil caracteres. A cota grátis do Google é de 1 milhão por mês; ao chegar em " + limit + " mil, o app passa sozinho para a voz do Windows até o mês virar, para não haver cobrança. Falas repetidas vêm do cache e não gastam."}),
    s.tts.canStoreKey ? h("div", {class: "row"}, input,
      h("button", {class: "small", type: "button", onclick: async () => {
        try { await window.satzDesktop.setTtsKey(input.value); input.value = ""; toast("Chave salva.", "success"); renderConvSettings(); }
        catch (e) { setStatus(cleanIpcError(e, "Chave inválida."), "error"); }
      }}, "Salvar chave"),
      s.tts.key === "app" ? h("button", {class: "quiet small", type: "button", onclick: async () => { await window.satzDesktop.clearTtsKey(); renderConvSettings(); }}, "Remover chave") : null) : null);
  box.hidden = false;
}
function bindConversa() {
  $("convSend").addEventListener("click", () => convSend());
  $("convMic").addEventListener("click", convMic);
  $("convHuh").addEventListener("click", () => convSend(convSie() ? CONV_HUH_SIE : CONV_HUH));
  $("convHowto").addEventListener("click", convHowto);
  $("convHint").addEventListener("click", convHint);
  $("convFinish").addEventListener("click", convFinish);
  $("convBack").addEventListener("click", () => { if (conv.turns.some(t => t.who === "me") && !conv.finished && !confirm("Sair sem ver o resumo dos erros?")) return; convReset(); });
  $("convText").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); convSend(); } });
  $("convShowText").addEventListener("change", e => { settings.convShowText = e.target.checked; saveSettings(); });
  $("convAutoSend").addEventListener("change", e => { settings.convAutoSend = e.target.checked; saveSettings(); });
  $("convHandsFree").addEventListener("change", e => {
    settings.convHandsFree = e.target.checked; saveSettings();
    if (!e.target.checked && conv.clip) { conv.handsFreePaused = true; conv.clip.stop(); }
    if (e.target.checked && conv.topic && !conv.busy && !conv.finished) { conv.handsFreePaused = false; convListen(); }
  });
  $("convCheck").addEventListener("change", e => { settings.convCheck = e.target.value; saveSettings(); });
  $("convVoice").addEventListener("change", e => { settings.convVoice = e.target.value; saveSettings(); });
  all("#convUmlauts [data-char]").forEach(b => b.addEventListener("click", () => {
    const t = $("convText"), i = t.selectionStart ?? t.value.length;
    t.value = t.value.slice(0, i) + b.dataset.char + t.value.slice(t.selectionEnd ?? i);
    t.focus(); t.selectionStart = t.selectionEnd = i + 1;
  }));
}
