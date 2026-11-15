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
const CONV_NAMES = {charon: "Jonas", aoede: "Lena", system: "Lena", thorsten: "Jonas", kerstin: "Lena"};
const CONV_START = "(Beginne das Gespräch mit einer kurzen Begrüßung und einer ersten Frage zum Thema. Du kennst Luiz schon: frag nicht nach seinem Namen.)";
const CONV_HUH = "Wie bitte? Kannst du das bitte einfacher sagen?";
const CONV_HUH_SIE = "Wie bitte? Können Sie das bitte einfacher sagen?";
const conv = {topic: null, messages: [], turns: [], busy: false, clip: null, token: 0, startedAt: 0, audio: new Map(), ttsWarned: false, status: null, finished: false};

// ---------- Dados (progresso) ----------
function convData() {
  progress.practice = progress.practice || {scenes: {}, pron: {}};
  return progress.practice.conversa || (progress.practice.conversa = {sessions: []});
}
function sanitizeConversa(src) {
  const out = {sessions: [], memory: convSanitizeMemory(src && src.memory)};
  // O ponto da conversa (conversa-foco.js): o erro que ele está treinando e se acertou nas conversas seguintes.
  const foco = src && typeof sanitizeFoco === "function" ? sanitizeFoco(src.foco) : null;
  if (foco) out.foco = foco;
  if (!src || !Array.isArray(src.sessions)) return out;
  const str = (v, n) => String(v == null ? "" : v).slice(0, n);
  out.sessions = src.sessions.filter(s => s && Number.isFinite(Number(s.at)) && Number(s.at) > 0)
    .map(s => ({at: Number(s.at), topic: str(s.topic, 40), turns: Math.max(0, Math.round(Number(s.turns) || 0)), words: Math.max(0, Math.round(Number(s.words) || 0)),
      secs: Math.max(0, Math.round(Number(s.secs) || 0)),
      errors: (Array.isArray(s.errors) ? s.errors : []).filter(e => e && e.certo).slice(0, 8).map(e => {
        const o = {errado: str(e.errado, 300), certo: str(e.certo, 300), explicacao: str(e.explicacao, 500)};
        if (CONV_TIPOS.includes(e.tipo)) o.tipo = e.tipo;
        for (const k of ["regra", "molde", "exemplo", "exemplo_pt"]) if (e[k]) o[k] = str(e[k], 300);
        return o;
      }),
      // Anamnese da FSP: quantos fatos do caso foram descobertos.
      ...(s.fsp && Number(s.fsp.total) > 0 ? {fsp: {found: Math.max(0, Math.min(Number(s.fsp.total), Math.round(Number(s.fsp.found) || 0))), total: Math.round(Number(s.fsp.total))}} : {}),
      // Jogo “Was habe ich?” e missões (missoes.js).
      ...(s.game && s.game.id ? {game: {id: str(s.game.id, 40), solved: !!s.game.solved, questions: Math.max(0, Math.round(Number(s.game.questions) || 0)), tries: Math.max(0, Math.min(3, Math.round(Number(s.game.tries) || 0)))}} : {}),
      // Correção de tutor: quantos movimentos a parceira fez e quantas vezes ele se corrigiu.
      ...(s.tutor && Number(s.tutor.moves) > 0 ? {tutor: {moves: Math.round(Number(s.tutor.moves)), reparos: Math.max(0, Math.min(Number(s.tutor.moves), Math.round(Number(s.tutor.reparos) || 0)))}} : {}),
      ...(s.mission && Number(s.mission.total) > 0 ? {mission: {done: Math.max(0, Math.min(Number(s.mission.total), Math.round(Number(s.mission.done) || 0))), total: Math.round(Number(s.mission.total))}} : {})}))
    .sort((a, b) => a.at - b.at).slice(-300);
  return out;
}
/* Memória das Pessoas (pessoas.js): fatos que o Luiz confirmou e a novidade da vez de cada personagem. */
function convSanitizeMemory(m) {
  const out = {facts: {}, hooks: {}}, str = (v, n) => String(v == null ? "" : v).slice(0, n), num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  if (!m || typeof m !== "object") return out;
  for (const [id, f] of Object.entries(m.facts || {})) {
    if (!/^F-[\w-]{1,30}$/.test(id) || !f || !f.p) continue;
    out.facts[id] = {p: str(f.p, 20), de: str(f.de, 200), pt: str(f.pt, 200), at: num(f.at), updatedAt: num(f.updatedAt), ...(f.deleted ? {deleted: true} : {})};
  }
  for (const [p, hk] of Object.entries(m.hooks || {})) if (/^[a-z]{1,20}$/.test(p) && hk) out.hooks[p] = {n: Math.max(0, Math.round(num(hk.n))), updatedAt: num(hk.updatedAt)};
  return out;
}
function mergeConversa(local, incoming) {
  const out = sanitizeConversa(local), seen = new Set(out.sessions.map(s => s.at)), inc = sanitizeConversa(incoming);
  for (const s of inc.sessions) if (!seen.has(s.at)) out.sessions.push(s);
  out.sessions.sort((a, b) => a.at - b.at);
  out.sessions = out.sessions.slice(-300);
  // Memória: vale o mais recente de cada fato e de cada novidade (apagar também é uma mudança).
  for (const [id, f] of Object.entries(inc.memory.facts)) if (!out.memory.facts[id] || f.updatedAt > out.memory.facts[id].updatedAt) out.memory.facts[id] = f;
  for (const [p, hk] of Object.entries(inc.memory.hooks)) if (!out.memory.hooks[p] || hk.updatedAt > out.memory.hooks[p].updatedAt) out.memory.hooks[p] = hk;
  if (inc.foco && (!out.foco || inc.foco.updatedAt > out.foco.updatedAt)) out.foco = inc.foco;
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
function convName(topic = conv.topic) { return topic && topic.persona ? topic.persona.name : topic && topic.role ? topic.rolePt : CONV_NAMES[settings.convVoice] || "Jonas"; }
/* Situações usam Sie, exceto as cenas informais (improviso de cena com du). */
function convSie(topic = conv.topic) { return topic && topic.persona ? !!topic.persona.sie : !!(topic && topic.role && topic.sie !== false); }
function convSystemPrompt({name, level, topic, known}) {
  if (topic.patient && typeof fspPatientPrompt === "function") return fspPatientPrompt(topic, level);
  if (topic.game && typeof wasPrompt === "function") return wasPrompt(topic, level);
  // Pessoas (pessoas.js): ficha do personagem com memória no lugar da parceira genérica.
  const persona = topic.persona && typeof pessoaPromptLines === "function";
  const lines = persona ? [...pessoaPromptLines(topic.persona), `Luiz's German level: ${level}.`]
    : [`You are ${name}, a friendly German conversation partner for Luiz, a Brazilian doctor who is learning German (level ${level}).`];
  if (persona) { /* o tom e o du/Sie já vêm da ficha */ }
  else if (topic.role) lines.push(`Role-play: you are ${topic.role}. Situation: ${topic.setting} Stay in your role and use "${convSie(topic) ? "Sie" : "du"}".`);
  else lines.push(`Topic: ${topic.de}. Use "du".`);
  if (topic.mission && typeof missionPromptLines === "function") lines.push(...missionPromptLines(topic));
  if (typeof focoPromptLines === "function") lines.push(...focoPromptLines());
  if (topic.lesson && typeof msFechoPromptLines === "function") lines.push(...msFechoPromptLines(topic));
  if (topic.book) lines.push(`Luiz is reading the German book "${topic.book.title}" and has just read the chapter "${topic.book.chapter}". Talk with him about it: ask simple questions about what happens, the characters, what he thinks and feels about it and what he would do, one question at a time. If he does not remember, help with a small hint. Chapter text, for reference only (do not read it out or quote long parts):`,
    topic.book.text);
  if (topic.script && topic.script.length) lines.push("This is a variation of a scene Luiz has already practised. Original script, for reference only (do NOT repeat it word for word):",
    ...topic.script.map(s => "  " + s),
    "Keep the same situation and your role, but change some details (for example prices, times, products, names) and ask one small unexpected question, so Luiz has to listen and adapt. When the situation is naturally finished, say goodbye in one short sentence.");
  lines.push("Rules:",
    "- Speak ONLY German. " + (CONV_LEVEL_RULES[level] || CONV_LEVEL_RULES.A1),
    persona ? "- Keep the conversation going: end with ONE simple question, or with your own opinion or a tiny story that invites him to answer."
      : "- Always end your turn with ONE simple question or a natural next step, so the conversation continues.",
    persona ? "- First react to what Luiz just said, in your own way (an opinion, a joke, a short memory of yours), not with a generic comment like \"Das ist interessant\". Follow the subject he brings up."
      : "- First react to what Luiz just said (a short, interested comment), then ask a question that follows from it. Stay with the same subject for a few turns; change it only when it is used up, and then smoothly.",
    "- Never ask something that was already asked or answered in this conversation. You already know that his name is Luiz.",
    ...(convShapeOn(topic) ? ["- A note from the app in square brackets at the end of Luiz's message may tell you what kind of turn to make (for example: no question this turn). Follow it exactly, never read it aloud and never mention it. A turn without a question is normal between friends."] : []),
    convTutorOn(topic)
      ? "- Mistakes: a note from the app in square brackets at the end of Luiz's message tells you if and how to react to a mistake. Follow it exactly, never read it aloud and never mention it. Without a note, do not correct anything. Never say \"richtig\" or \"falsch\", and never explain grammar unless the note asks for a tip."
      : "- Never explain grammar and never say \"richtig\" or \"falsch\". If Luiz makes a mistake, naturally reuse the correct form in your reply (recast). Example: Luiz: \"Ich habe nach Hause gegangen.\" You: \"Ah, du bist nach Hause gegangen! Wann?\"",
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
   diria diferente, vai para “estilo” e nunca conta como erro. Desde 06/11/2026 cada erro traz o nome da regra, um porquê
   curto com as palavras dele, o molde e um exemplo novo; “microfone” separa o que provavelmente foi a transcrição
   (gabaritos do Claude e do GPT em _dev/.cache/resumo-conversa). */
const CONV_TIPOS = ["alemao", "vocabulario", "microfone"];
const CONV_SUMMARY_SCHEMA = {type: "object", properties: {
  erros: {type: "array", maxItems: 5, items: {type: "object", properties: {errado: {type: "string"}, certo: {type: "string"}, tipo: {type: "string", enum: CONV_TIPOS},
    regra: {type: "string"}, porque: {type: "string"}, molde: {type: "string"}, exemplo: {type: "string"}, exemplo_pt: {type: "string"}},
    required: ["errado", "certo", "tipo", "regra", "porque", "molde", "exemplo", "exemplo_pt"]}},
  estilo: {type: "array", maxItems: 3, items: {type: "object", properties: {disse: {type: "string"}, natural: {type: "string"}, porque: {type: "string"}}, required: ["disse", "natural", "porque"]}},
  elogio: {type: "string"}, frases: {type: "array", maxItems: 3, items: {type: "string"}}}, required: ["erros", "estilo", "elogio", "frases"]};
/* A Conversa pede também o próximo passo: uma frase para dizer da próxima vez (no lugar das “frases para praticar”). */
const CONV_SUMMARY_NEXT_SCHEMA = {...CONV_SUMMARY_SCHEMA, properties: {...CONV_SUMMARY_SCHEMA.properties,
  proximo: {type: "object", properties: {de: {type: "string"}, pt: {type: "string"}}, required: ["de", "pt"]}}, required: [...CONV_SUMMARY_SCHEMA.required, "proximo"]};
const CONV_ERROR_EXAMPLES = JSON.stringify({erros: [
  {errado: "ich trinke keine Kaffee", certo: "ich trinke keinen Kaffee", tipo: "alemao", regra: "Objeto masculino: kein vira keinen",
    porque: "Kaffee é der, e aqui é o que você bebe (o objeto, acusativo). Por isso keine ganha -n: keinen, igual a einen.",
    molde: "der → einen / keinen", exemplo: "Ich habe heute keinen Hunger.", exemplo_pt: "Hoje eu não estou com fome."},
  {errado: "Kannst du ein Thema erzählen?", certo: "Kannst du ein Thema vorschlagen?", tipo: "vocabulario", regra: "Sugerir é vorschlagen, não erzählen",
    porque: "erzählen é contar uma história, então 'contar um tema' soa estranho. Para pedir uma sugestão, use vorschlagen.",
    molde: "Kannst du … vorschlagen?", exemplo: "Kannst du ein Restaurant vorschlagen?", exemplo_pt: "Você pode sugerir um restaurante?"},
  {errado: "was es ist du lieber", certo: "Was isst du lieber?", tipo: "microfone", regra: "Talvez isst (comer), não ist",
    porque: "isst (come) soa igual a ist, e a transcrição pode ter escrito 'es ist'. Se a pergunta era sobre comida, a frase é esta.",
    molde: "ich esse, du isst, er isst", exemplo: "Was isst du am Abend?", exemplo_pt: "O que você come à noite?"}],
  estilo: [{disse: "Ich möchte heute sprechen über das Wetter", natural: "Ich möchte heute über das Wetter sprechen",
    porque: "Na fala às vezes se ouve assim, mas o padrão é deixar sprechen no fim, depois de über das Wetter."}]});
const CONV_ERROR_RULES = `Split his problems into two lists.
"erros" = things he should fix. "tipo":
- "alemao": a broken rule of German (gender/article, case, adjective ending, verb conjugation, sein/haben in the Perfekt, verb position V2 or verb at the end, separable prefix, wrong preposition, du/Sie mixed up);
- "vocabulario": a wrong or non-existent word, or a word with the wrong meaning;
- "microfone": the text was probably transcribed wrong (it sounds almost the same as a sensible sentence, like isst/ist or Kuchen/kochen; a word repeated many times; garbled numbers). It is a guess: say so.
"estilo" = correct German that a native speaker would usually say differently (word choice, idiom, a more natural order). An order that is possible in speech but less common, like a phrase after the final verb, is style. When in doubt between error and style, it is style.
Fields, in Brazilian Portuguese (except the German parts), talking to him as "você":
- errado: the wrong part exactly as transcribed.
- certo: the corrected German, changing as little as possible and keeping his meaning (do not swap his verb for another one). It must itself be correct German, with the conjugated verb in 2nd position. Never add facts he did not say (a time, a number, a noun, a topic): if a number or a part is garbled, leave it out of "certo" and say so in "porque".
- regra: a short title of the rule, at most 8 words.
- porque: at most 2 short sentences that use HIS words to show what changed and why. No generic openings like "Em alemão, …", no unexplained grammar terms. If the same rule already appeared earlier in the list, start with "De novo".
- molde: the pattern to memorize, very short.
- exemplo: ONE new everyday or medical A1/A2 German sentence with the same pattern, different from his sentence; exemplo_pt: its translation.
For "estilo": disse, natural and porque (at most 2 short sentences).
Never list a correct sentence as an error and never put the same thing in both lists (one line = one entry). Inside the Portuguese texts, quote German words with single quotes ('...'), never with double quotes. Ignore capitalization and punctuation (it is transcribed speech). Short answers without a verb that are normal in spoken German (e.g. "Mit Milch, bitte.", "Ja, gern.", "Aus Brasilien.") are correct.
Example of the expected quality (from other conversations, never copy it): ${CONV_ERROR_EXAMPLES}`;
/* Lê o JSON do resumo (Conversa, 4/3/2 e FSP). Descarta “erros” em que o certo só difere em maiúsculas, pontuação ou espaços:
   na fala transcrita isso não é erro do aluno. Por regra: palavra repetida 3 vezes = microfone; porquê com no máximo 2 frases;
   exemplo igual à correção some; frase para praticar igual a uma correção some. */
const convBare = s => String(s || "").toLowerCase().replace(/[.,!?;:"“”„'’()…-]/g, "").replace(/\s+/g, " ").trim();
function convRepeats(s) {
  const n = {};
  return convBare(s).split(" ").filter(w => w.length > 2).some(w => (n[w] = (n[w] || 0) + 1) >= 3);
}
/* Hora embaralhada pela transcrição (“14.20 Uhr 30”): número dos dois lados do Uhr. */
const convGarbled = s => /\d[\d.:]*\s*uhr\s*\d/i.test(String(s || ""));
/* “N/A”, “-”, “nenhum”: o modelo preenchendo um campo obrigatório sem ter o que dizer. */
function convFilled(s) {
  const t = convClean(s);
  return /^(n\/?a|-+|—|nenhum[a]?|none)\.?$/i.test(t) || /\bn\/a\b/i.test(t) ? "" : t;
}
function convShort(s, max = 2) {
  return String(s || "").split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú„“"])/).slice(0, max).join(" ").trim();
}
function convFeedback(j) {
  const bare = convBare, ok = j && typeof j === "object";
  const errors = ok && Array.isArray(j.erros) ? j.erros.filter(e => e && e.certo && bare(e.errado) !== bare(e.certo)).map(e => {
    const errado = convClean(e.errado), certo = convClean(e.certo), exemplo = convFilled(e.exemplo);
    const out = {errado, certo, explicacao: convShort(convClean(e.porque || e.explicacao)),
      tipo: convRepeats(errado) || convGarbled(errado) ? "microfone" : CONV_TIPOS.includes(e.tipo) ? e.tipo : "alemao"};
    // Palavra repetida também na “correção”: o modelo não sabe o que foi dito, então não há o que sugerir.
    if (out.tipo === "microfone" && convRepeats(certo)) out.certo = "";
    // Hora embaralhada: a “correção” escolheria uma hora por ele (o Gemma pôs 14:30 para “14.20 Uhr 30”).
    if (convGarbled(errado)) Object.assign(out, {certo: "", explicacao: "Os números saíram misturados na transcrição, então o app não sabe que hora você disse."});
    const regra = convClean(e.regra).slice(0, 70), molde = convFilled(e.molde).slice(0, 80);
    if (regra) out.regra = regra;
    if (molde) out.molde = molde;
    if (exemplo && bare(exemplo) !== bare(certo) && bare(exemplo) !== bare(errado)) {
      out.exemplo = exemplo;
      if (convFilled(e.exemplo_pt)) out.exemplo_pt = convFilled(e.exemplo_pt);
    }
    return out;
  }) : [];
  const seen = new Set(errors.map(e => bare(e.errado))), style = [];
  for (const s of ok && Array.isArray(j.estilo) ? j.estilo : []) {
    if (!s || !s.natural || bare(s.disse) === bare(s.natural) || seen.has(bare(s.disse))) continue;
    // Estilo que repete um erro (a mesma fala, mais longa ou mais curta) não é dica nova.
    const d = bare(s.disse);
    if (d && errors.some(e => { const x = bare(e.errado); return x.length > 3 && (d.includes(x) || x.includes(d)); })) continue;
    const disse = convClean(s.disse), natural = convClean(s.natural);
    // “Die Sonne, Brille, Brille, Brille” não é estilo: é a transcrição repetindo palavras.
    if (convRepeats(disse)) errors.push({errado: disse, certo: convRepeats(natural) ? "" : natural, tipo: "microfone", regra: "Talvez o microfone tenha repetido palavras",
      explicacao: "A transcrição repetiu palavras, então não dá para saber o que você disse." + (convRepeats(natural) ? "" : " Talvez fosse a frase abaixo.")});
    // “14.20 Uhr 30”: a hora saiu embaralhada; não dá para escolher uma hora por ele.
    else if (convGarbled(disse)) errors.push({errado: disse, certo: "", tipo: "microfone", regra: "Talvez o microfone tenha embaralhado a hora",
      explicacao: "Os números saíram misturados na transcrição, então o app não sabe que hora você disse."});
    else style.push({disse, natural, explicacao: convShort(convClean(s.porque || s.explicacao))});
  }
  const fixes = new Set(errors.map(e => bare(e.certo)).concat(style.map(s => bare(s.natural))));
  const p = ok && j.proximo && typeof j.proximo === "object" ? {de: convClean(j.proximo.de), pt: convClean(j.proximo.pt)} : null;
  const proximo = p && p.de && !fixes.has(bare(p.de)) ? p : null;
  if (proximo) fixes.add(bare(proximo.de));
  const frases = ok && Array.isArray(j.frases) ? j.frases.map(convClean).filter(f => f && !fixes.has(bare(f))) : [];
  return {errors, style, frases, elogio: ok ? convClean(j.elogio) : "", proximo};
}
/* Tópico da Gramática ligado ao erro, pela mesma regra dos “Seus erros” (gramatica-erros.js); microfone e vocabulário ficam sem. */
function convErrTopic(e) {
  if (!e || e.tipo === "microfone" || e.tipo === "vocabulario" || typeof gramErrTopics !== "function" || typeof GRAMMAR_BY_ID === "undefined") return null;
  return gramErrTopics(e.errado, e.certo).find(id => GRAMMAR_BY_ID.has(id)) || null;
}
const convSpeakBtn = (text, label = "Ouvir") => h("button", {class: "icon-btn quiet", type: "button", title: label, "aria-label": label, onclick: () => convSpeak(text)}, icon("volume", 16));
/* O que ele disse com as palavras que saíram riscadas, e a correção com as que entraram marcadas (wordDiff). */
function convDiffPair(e) {
  const said = [], fix = [], add = (list, node) => { if (list.length) list.push(" "); list.push(node); };
  for (const [op, a, b] of wordDiff(e.certo, e.errado).ops) {
    if (op === "eq") { add(said, b); add(fix, a); }
    else if (op === "near") { add(said, h("s", {text: b})); add(fix, h("mark", {text: a})); }
    else if (op === "del") add(said, h("s", {text: a}));
    else add(fix, h("mark", {text: a}));
  }
  return [said, fix];
}
function convOpenTopic(id) {
  if (typeof startAula !== "function") return;
  showView("grammar");
  startAula(id, "Um erro da sua conversa");
}
function convPatternNode(e) {
  if (!e.molde && !e.exemplo) return null;
  return h("div", {class: "ce-pattern"},
    e.molde ? h("p", null, h("span", {class: "ce-k", text: "Molde"}), h("span", {class: "ce-molde", lang: "de", text: e.molde})) : null,
    e.exemplo ? h("p", null, h("span", {class: "ce-k", text: "Outro exemplo"}), h("span", {class: "ce-ex", lang: "de", text: e.exemplo}), convSpeakBtn(e.exemplo, "Ouvir o exemplo")) : null,
    e.exemplo && e.exemplo_pt ? h("p", {class: "ce-ex-pt", text: e.exemplo_pt}) : null);
}
/* A regra da ficha de gramática do tópico (texto fixo, escrito e conferido no app), recolhida: o porquê acima é do Gemma
   e às vezes erra; esta é a referência. Também serve de lembrete quando o tópico é parecido, mas não idêntico ao erro. */
function convFichaNode(topic, t) {
  const f = topic && typeof fichaOf === "function" ? fichaOf(topic) : null;
  if (!f || !f.ideia) return null;
  return h("details", {class: "ce-ficha"},
    h("summary", null, h("span", {class: "ce-k", text: "A regra do app"}), h("span", {text: t.title}), icon("chevron", 14)),
    h("p", {text: f.ideia}),
    f.macete ? h("p", {class: "ce-macete"}, h("span", {class: "ce-k", text: "Macete"}), f.macete) : null,
    f.armadilha && f.armadilha.errado && f.armadilha.certo ? h("p", {class: "ce-trap"}, h("span", {class: "ce-k", text: "Armadilha"}),
      h("s", {lang: "de", text: f.armadilha.errado}), " → ", h("b", {lang: "de", text: f.armadilha.certo})) : null);
}
function convErrorCard(e, frase) {
  const topic = convErrTopic(e), t = topic && GRAMMAR_BY_ID.get(topic), [said, fix] = convDiffPair(e);
  return h("li", {class: "ce-card"},
    h("div", {class: "ce-head"}, h("b", {class: "ce-rule", text: e.regra || (e.tipo === "vocabulario" ? "Palavra trocada" : "Correção")}),
      t ? h("button", {class: "chip ce-topic", type: "button", title: "Fazer a aula deste tópico", onclick: () => convOpenTopic(topic)}, t.title) : null),
    h("p", {class: "ce-label", text: "Você disse"}), h("p", {class: "ce-de ce-said", lang: "de"}, ...said),
    h("p", {class: "ce-label", text: "Certo"}), h("p", {class: "ce-de ce-fix", lang: "de"}, ...fix, " ", convSpeakBtn(e.certo, "Ouvir a forma correta")),
    e.explicacao ? h("p", {class: "ce-why", text: e.explicacao}) : null,
    convPatternNode(e),
    convFichaNode(topic, t),
    h("div", {class: "ce-actions"}, convCardButton({erro: {errado: e.errado, certo: e.certo, explicacao: e.explicacao, frase}}),
      t ? h("button", {class: "quiet small", type: "button", onclick: () => convOpenTopic(topic)}, "Treinar esta regra") : null));
}
/* Provável erro da transcrição: sem riscar e sem cartão; “Fui eu que errei” vira um erro normal (e passa a contar). */
function convMicCard(e, frase) {
  const li = h("li", {class: "ce-card ce-mic"},
    h("div", {class: "ce-head"}, h("b", {class: "ce-rule", text: e.regra || "Talvez o microfone"})),
    h("p", {class: "ce-label", text: "O app entendeu"}), h("p", {class: "ce-de ce-heard", lang: "de", text: e.errado}),
    e.certo ? h("p", {class: "ce-label", text: "Você quis dizer?"}) : null, e.certo ? h("p", {class: "ce-de", lang: "de"}, e.certo, " ", convSpeakBtn(e.certo)) : null,
    e.explicacao ? h("p", {class: "ce-why", text: e.explicacao}) : null,
    convPatternNode(e),
    e.certo && h("div", {class: "ce-actions"}, h("button", {class: "quiet small", type: "button", title: "Passa a contar como erro seu", onclick: () => {
      e.tipo = "alemao";
      saveProgress();
      li.replaceWith(convErrorCard(e, frase));
    }}, "Fui eu que errei")));
  return li;
}
/* Bloco comum do resumo: erros, estilo e microfone. `lineWith` acha a fala inteira em que o trecho apareceu. */
function convErrorsBlock(errors, style, lineWith, title = "") {
  const real = errors.filter(e => e.tipo !== "microfone"), mic = errors.filter(e => e.tipo === "microfone");
  return [h("h4", {text: title || (real.length ? (real.length === 1 ? "O erro mais importante" : "Os erros mais importantes") : "Nenhum erro importante encontrado")}),
    real.length ? h("ul", {class: "conv-errors conv-err"}, ...real.map(e => convErrorCard(e, lineWith(e.errado)))) : null,
    ...convStyleList(style),
    mic.length ? h("h4", {text: "Talvez o microfone não tenha entendido"}) : null,
    mic.length ? h("ul", {class: "conv-errors conv-mic"}, ...mic.map(e => convMicCard(e, lineWith(e.errado)))) : null];
}
/* No topo: a regra que mais apareceu (2+ vezes) e o que ficou bom. */
function convSummaryTop(errors, elogio) {
  const real = errors.filter(e => e.tipo !== "microfone"), counts = new Map();
  for (const e of real) { const t = convErrTopic(e); if (t) counts.set(t, (counts.get(t) || 0) + 1); }
  const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0] || [];
  if (!(n >= 2) && !elogio) return null;
  return h("div", {class: "ce-top"},
    n >= 2 ? h("div", null, h("span", {class: "ce-k", text: "O que mais apareceu"}), h("b", {text: GRAMMAR_BY_ID.get(top).title}),
      h("span", {class: "muted small-text", text: n + " de " + real.length + " erros"})) : null,
    elogio ? h("div", null, h("span", {class: "ce-k", text: "O que ficou bom"}), h("p", {text: elogio})) : null);
}
function convNextNode(proximo) {
  if (!proximo) return null;
  return h("div", {class: "ce-next"}, h("span", {class: "ce-k", text: "Próximo passo: diga em voz alta"}),
    h("p", {class: "ce-de", lang: "de"}, proximo.de, " ", convSpeakBtn(proximo.de)),
    proximo.pt ? h("p", {class: "muted small-text", text: proximo.pt}) : null,
    h("div", {class: "ce-actions"}, convCardButton({frase: proximo.de})));
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
const CONV_HINT_SCHEMA = {type: "object", properties: {
  palavras: {type: "array", minItems: 2, maxItems: 4, items: {type: "object", properties: {de: {type: "string"}, pt: {type: "string"}}, required: ["de", "pt"]}},
  respostas: {type: "array", minItems: 1, maxItems: 2, items: {type: "object", properties: {inicio: {type: "string"}, frase: {type: "string"}, pt: {type: "string"}}, required: ["inicio", "frase", "pt"]}}},
  required: ["palavras", "respostas"]};
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
/* A ordem importa: “ouvido”, “sentido” e o 1º erro saem primeiro, e a parceira já pode responder (convCheckEarly)
   enquanto o resto da correção (estilo, frase corrigida) ainda está sendo escrito. */
const CONV_CHECK_SCHEMA = {type: "object", properties: {
  ouvido: {type: "string"}, sentido: {type: "string"},
  erros: {type: "array", maxItems: 3, items: {type: "object", properties: {errado: {type: "string"}, certo: {type: "string"}, explicacao: {type: "string"}}, required: ["errado", "certo", "explicacao"]}},
  estilo: {type: "array", maxItems: 2, items: {type: "object", properties: {disse: {type: "string"}, natural: {type: "string"}, explicacao: {type: "string"}}, required: ["disse", "natural", "explicacao"]}},
  corrigida: {type: "string"}}, required: ["ouvido", "sentido", "erros", "estilo", "corrigida"]};
function convCheckLevel() { return CONV_CHECK_LEVELS[settings.convCheck] ? settings.convCheck : "equilibrado"; }
function convCheckPrompt(level, cefr = convLevel()) {
  return `You check ONE line that Luiz, a Brazilian learner of German (level ${cefr}), said in a spoken conversation. The partner's previous line is given only as context; do not check it. ${CONV_CHECK_LEVELS[level].rule} Ignore capitalization and punctuation (it is transcribed speech). Short answers without a verb that are normal in spoken German (e.g. "Mit Milch, bitte.", "Ja, gern.", "Aus Brasilien.") are correct. For each mistake: the wrong part exactly as he said it, the correct German, and one short sentence in Brazilian Portuguese explaining the rule. "corrigida" = his whole line with the mistakes fixed and nothing else changed (keep his words and meaning); with no mistakes, repeat his line. Only report something you are sure is wrong; when in doubt, it is not a mistake. Never assume facts he did not say (for example how he travelled). When a word is wrong or does not exist, give the word that best fits what he most likely meant, using the partner's question as context. The correction must itself be correct German, and so must "corrigida" as a whole: when you change a word, also fix what depends on it in the same phrase (for example "nicht die Lust" → "keine Lust"). Two more fields, usually empty: "ouvido" = a word that looks like a speech-recognition error, exactly as written; otherwise "". If fixing the line would mean replacing a word by a DIFFERENT word that sounds similar (kochen/Kuchen, ist/isst, Baum/Bauch), that is "ouvido", NOT a mistake: then leave "erros" empty for it. "sentido" = only if his line is (almost) correct German but probably does not say what he means (e.g. "Ich bin kalt" when he means "Mir ist kalt"), the sentence he probably meant; otherwise "". Do not report the same thing in "erros". Answer as JSON.`;
}
/* Lê a resposta da IA com os mesmos filtros do resumo final; sem erro e sem dica = certo. */
function convCheckResult(said, j, level) {
  if (!j) return {state: "fail", errors: [], style: [], fixed: ""};
  const {errors, style} = convFeedback(j);
  const fixed = convClean(j.corrigida), changed = errors.length && fixed && convBare(fixed) !== convBare(said);
  // Dica de estilo que só repete a frase corrigida (o Gemma faz isso às vezes) não é dica.
  const st = level === "rigido" ? style.filter(s => convBare(s.natural) !== convBare(fixed)) : [];
  // “ouvido” só vale se a palavra está mesmo na fala; “sentido” só se diz outra coisa.
  const heard = convClean(j.ouvido), meant = convClean(j.sentido);
  const ouvido = heard && convBare(said).includes(convBare(heard)) ? heard : "";
  const sentido = meant && convBare(meant) !== convBare(said) && !errors.some(e => convBare(e.certo) === convBare(meant)) ? meant : "";
  return {state: errors.length ? "erro" : st.length ? "estilo" : "ok", errors, style: st, fixed: changed ? fixed : "", ouvido, sentido};
}
/* Puro: lê a correção ainda pela metade. Devolve null enquanto não dá para decidir; quando “ouvido”, “sentido” e a
   lista de erros vazia (ou o 1º erro inteiro) já chegaram, devolve só isso. É o que o movimento do tutor precisa. */
function convCheckEarly(partial) {
  const s = String(partial || ""), k = s.indexOf('"erros"'), open = k < 0 ? -1 : s.indexOf("[", k);
  if (open < 0) return null;
  let cand = "";
  if (/^\s*\]/.test(s.slice(open + 1))) cand = s.slice(0, open + 1) + "]}";
  else {
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = open + 1; i < s.length && end < 0; i++) {
      const c = s[i];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) end = i + 1;
    }
    if (end < 0) return null;
    cand = s.slice(0, end) + "]}";
  }
  try {
    const j = JSON.parse(cand);
    return typeof j.ouvido === "string" && typeof j.sentido === "string" && Array.isArray(j.erros) ? {ouvido: j.ouvido, sentido: j.sentido, erros: j.erros, estilo: [], corrigida: ""} : null;
  } catch (e) { return null; }
}
/* onEarly (correção de tutor): chamado uma vez, assim que dá para decidir o movimento, antes de a correção acabar. */
async function convCheckTurn(turn, bubble, onEarly = null) {
  const level = convCheckLevel(), token = conv.token;
  if (level === "off" || !convAvailable() || turn.de === CONV_HUH || turn.de === CONV_HUH_SIE) return;
  const k = conv.turns.indexOf(turn), prev = conv.turns.slice(0, Math.max(0, k)).reverse().find(t => t.who === "partner");
  turn.check = {state: "checking", errors: [], style: [], fixed: ""};
  convCheckMark(turn, bubble);
  let j = null;
  const messages = [{role: "system", content: convCheckPrompt(level)}, {role: "user", content: (prev ? "Partner: " + prev.de + "\n" : "") + "Luiz: " + turn.de}];
  const opts = {kind: "check", temperature: .1, maxTokens: 500, schema: CONV_CHECK_SCHEMA};
  const id = onEarly && window.satzDesktop.convStream ? convNewId() : "";
  try {
    let r;
    if (id) {
      let partial = "", told = false;
      convBindDeltas();
      convStreams.set(id, delta => {
        partial += delta;
        if (told || token !== conv.token) return;
        const early = convCheckEarly(partial);
        if (early) { told = true; onEarly(convCheckResult(turn.de, early, level)); }
      });
      r = await window.satzDesktop.convStream(id, messages, opts);
    } else r = await window.satzDesktop.convChat(messages, opts);
    j = parseLooseJson(r.text);
  } catch (e) { reportError("conversa", "correção da fala: " + e.message); }
  if (id) convStreams.delete(id);
  if (token !== conv.token) return;
  turn.check = convCheckResult(turn.de, j, level);
  convCheckMark(turn, bubble);
  if (typeof focoObserve === "function") focoObserve(turn);
}
/* ---------- Correção de tutor (06/11/2026; proposta em _dev/.cache/conversa-tutor) ----------
   A correção da fala roda ANTES da resposta e o app escolhe, por regra, UM movimento; a parceira só recebe uma nota
   dizendo o que fazer. Pesquisa (Lyster & Ranta; Ammar & Spada) + revisão do GPT: no máximo 1 correção por fala,
   recast curto na 1ª vez, fazer completar na 2ª, dica de uma linha na 3ª; depois de uma tentativa frustrada, ela dá o
   certo e segue; transcrição estranha vira pergunta neutra, nunca erro; sentido duvidoso vira “Meinst du …?”. */
const CONV_TUTOR_WAIT = 3000; // espera máxima pela correção antes de a parceira responder sem ela
/* Na fala dita (mãos livres/microfone), a resposta não pode esperar: 0,9 s. Sem a correção a tempo ela responde sem nota,
   e a correção aparece no seu balão quando chegar (medido em 10/11/2026: a espera de 1–3 s pesava no ritmo). */
const CONV_TUTOR_WAIT_VOICE = 900;
function convTutorOn(topic = conv.topic) {
  return !!topic && !topic.patient && !topic.game && convCheckLevel() !== "off" && convAvailable();
}
function convTutorFresh() { return {counts: {}, pending: null, fixes: [], moves: 0, reparos: 0}; }
/* As palavras que a correção põe (o que mudou), para destacar no balão dela e para saber se ele consertou. */
function convFixWords(errado, certo) {
  return wordDiff(certo, errado).ops.filter(([op]) => op === "ins" || op === "near").map(([, a]) => a).filter(w => normWord(w));
}
function convSaysAll(said, words) {
  const got = String(said || "").split(/\s+/).map(normWord);
  return words.length > 0 && words.every(w => got.includes(normWord(w)));
}
/* A regra do erro (tópico da Gramática por gramErrTopics), para contar repetições; sem tópico, as palavras certas. */
function convTutorKey(e) {
  const t = typeof gramErrTopics === "function" ? gramErrTopics(e.errado, e.certo)[0] : null;
  return t || "w:" + convFixWords(e.errado, e.certo).map(normWord).join(" ");
}
/* Puro: o movimento desta fala. `st` = conv.tutor; `n` = número da fala dele nesta conversa (0 = a primeira). */
function convTutorMove(said, check, st, n) {
  const c = check || {}, none = {kind: "none"};
  if (!c.state || c.state === "fail" || c.state === "checking") return none;
  const p = st.pending && st.pending.n === n - 1 ? st.pending : null;
  // 1) Pode ter sido o microfone: pergunta neutra, sem contar como erro.
  if (c.ouvido || convRepeats(said) || convGarbled(said))
    return {kind: "hear", word: c.ouvido || (convGarbled(said) ? (String(said).match(/\d[\d.:]*\s*uhr\s*\d+/i) || [""])[0] : "")};
  // 2) Frase certa que diz outra coisa: confirmar a intenção.
  if (c.sentido) return {kind: "meaning", meant: c.sentido};
  // 3) Ele consertou o que ficou pendente: reconhecer.
  if (p && convSaysAll(said, p.words)) return {kind: "praise", certo: p.certo, key: p.key};
  // 4) Pediu para ele completar e não deu: dar o certo e seguir (não prender a conversa).
  if (p && p.kind === "elicit") return {kind: "model", errado: p.errado, certo: p.certo, words: p.words, key: p.key};
  const e = (c.errors || []).find(x => x.tipo !== "microfone");
  if (!e) return none;
  // No máximo 2 correções seguidas: na 3ª fala seguida com erro, deixa passar (vai para o resumo).
  if (st.fixes.includes(n - 1) && st.fixes.includes(n - 2)) return {kind: "none", skipped: true};
  const key = convTutorKey(e), seen = st.counts[key] || 0, words = convFixWords(e.errado, e.certo);
  const kind = seen === 1 && words.length ? "elicit" : seen === 2 ? "hint" : "recast";
  return {kind, errado: e.errado, certo: e.certo, words, key};
}
/* Aplica o movimento ao estado da conversa (conta repetições, guarda o pendente). */
function convTutorApply(st, move, n) {
  if (move.kind === "none") return st;
  st.moves++;
  if (move.kind === "praise") { st.reparos++; st.pending = null; return st; }
  if (move.kind === "model") st.pending = null;
  if (["recast", "elicit", "hint"].includes(move.kind)) {
    st.counts[move.key] = (st.counts[move.key] || 0) + 1;
    st.pending = move.words.length ? {n, kind: move.kind, errado: move.errado, certo: move.certo, words: move.words, key: move.key} : null;
  }
  if (move.kind !== "hear" && move.kind !== "meaning") st.fixes.push(n);
  return st;
}
/* A nota que vai junto da fala dele (só para o modelo; não aparece na tela nem fica no histórico). */
function convTutorNote(move) {
  const head = "[Note from the app, never read it aloud or mention it: ";
  const q = s => "\"" + String(s || "").replace(/"/g, "'") + "\"";
  switch (move.kind) {
    case "recast": return head + `Luiz said ${q(move.errado)}; correct is ${q(move.certo)}. In your reply, say the correct form once, naturally and short (adapt ich/du as fits), without saying that he was wrong and without explaining. Then continue the conversation.]`;
    case "elicit": return head + `same kind of mistake again: ${q(move.errado)} (correct: ${q(move.certo)}). Do NOT say the correct form and do NOT repeat the wrong word either: repeat his sentence with "…" in place of the wrong part and end with "?", so that he tries again (for example, for "ich habe nach Hause gegangen": "Du … nach Hause gegangen?"). Say nothing else in this turn.]`;
    case "hint": return head + `third time the same mistake: ${q(move.errado)} → ${q(move.certo)}. Give ONE very short tip in simple German (at most 8 words, e.g. "Kleiner Tipp: hier brauchst du ‚bin'."), say the correct sentence once, then continue.]`;
    case "model": return head + `he could not fix ${q(move.errado)}. Give him the correct form once, as HIS sentence, not as something you did (for example "Man sagt: Ich bin nach Berlin gefahren." or "Ah, du bist nach Berlin gefahren!"), correct: ${q(move.certo)}. Then continue the conversation. Do not ask him to repeat it.]`;
    case "praise": return head + `Luiz just fixed his earlier mistake himself (${q(move.certo)}). Acknowledge it in 1 to 3 words (e.g. "Genau!") and continue the conversation.]`;
    case "meaning": return head + `his sentence may not say what he means; he probably meant ${q(move.meant)}. Check it in ONE short, friendly question (e.g. "Ist dir kalt?" or "Meinst du: …?"). Do not call it a mistake.]`;
    case "hear": return head + (move.word ? `the speech recognition may have misheard ${q(move.word)}.` : "the speech recognition may have garbled his line.")
      + ` Ask ONE short, neutral question to check what he said (e.g. "Hast du ‚Kuchen' gesagt?" or "Das habe ich nicht verstanden. Noch mal?"). Do not correct him and do not joke about his pronunciation.]`;
    default: return "";
  }
}
/* Espera a correção (até CONV_TUTOR_WAIT) e decide o movimento; sem correção a tempo, ela responde sem nota. */
async function convTutorPrepare(turn, bubble) {
  if (!convTutorOn()) { convCheckTurn(turn, bubble); return null; }
  const st = conv.tutor || (conv.tutor = convTutorFresh()), n = conv.turns.filter(t => t.who === "me").indexOf(turn);
  // A parceira não espera a correção inteira: basta o começo dela (ouvido, sentido e o 1º erro) para decidir.
  let early = null, wake;
  const gotEarly = new Promise(r => { wake = r; });
  const check = convCheckTurn(turn, bubble, c => { early = c; wake(); });
  const how = await Promise.race([check.then(() => "full"), gotEarly.then(() => "early"), wait(turn.spoken ? CONV_TUTOR_WAIT_VOICE : CONV_TUTOR_WAIT).then(() => "late")]);
  const c = how === "full" ? turn.check : how === "early" ? early : null;
  if (!c) return null;
  turn.checkHow = how;
  const move = convTutorMove(turn.de, c, st, n);
  convTutorApply(st, move, n);
  turn.move = move.kind;
  return move.kind === "none" ? null : move;
}
/* No balão dela: as palavras da correção que ela de fato disse ficam em destaque (só nos movimentos que dão o certo). */
/* Ela responde com “du”: o “bin” dele vira “bist”, “habe” vira “hast”, “mein” vira “dein”, “gehe” vira “gehst”. */
const CONV_PERSON = {bin: "bist", habe: "hast", hab: "hast", war: "warst", hatte: "hattest", mich: "dich", mir: "dir", ich: "du"};
function convPersonForms(w) {
  const x = normWord(w), out = new Set([x]);
  if (CONV_PERSON[x]) out.add(CONV_PERSON[x]);
  if (/^mein/.test(x)) out.add("dein" + x.slice(4));
  if (/e$/.test(x) && x.length > 3) out.add(x.slice(0, -1) + "st");
  if (/^(kann|muss|will|soll|darf|mag)$/.test(x)) out.add(x + "st");
  if (x === normWord("möchte")) out.add(normWord("möchtest"));
  return out;
}
function convRecastNodes(text, words) {
  const want = (words || []).filter(w => normWord(w)).map(convPersonForms), out = [];
  if (!want.length) return [text];
  String(text).split(/(\s+)/).forEach(part => {
    const k = normWord(part), i = k ? want.findIndex(set => set.has(k)) : -1;
    if (i >= 0) { want.splice(i, 1); out.push(h("mark", {class: "cv-recast", title: "A forma certa do que você disse", text: part})); }
    else out.push(part);
  });
  return out;
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

// ---------- Alemão da parceira conferido (09/11/2026) ----------
/* O Gemma às vezes erra o próprio alemão (“Ein Tierärztin”). Antes de a fala dela aparecer e ser dita, o LanguageTool
   confere só as regras de gramática (~35 ms por fala). Erro com UMA sugestão é trocado por regra; com várias sugestões
   (“eine Hund” → ein/einen/einem) o Gemma reescreve a frase e o corretor confere de novo. Sem corretor, sem resposta a
   tempo ou na dúvida, vale a fala original. O corretor não vê ordem das palavras nem caso pedido pelo verbo. */
const CONV_GUARD_WAIT = 350, CONV_GUARD_REPAIR_WAIT = 2500;
function convGuardOn() { return typeof ltAvailable === "function" && ltAvailable(); }
/* Falas em que ela cita uma palavra ou deixa “…” de propósito (movimentos do tutor) não são conferidas. */
function convGuardSkip(text, move) {
  return !!(move && (move.kind === "elicit" || move.kind === "hint")) || /[…„“”‚‘"«»]|\.\.\./.test(text) || String(text).trim().split(/\s+/).length < 2;
}
/* Puro: aplica as correções seguras. Devolve o texto, o que foi trocado e o que ficou em aberto (várias sugestões). */
function convGuardApply(text, matches) {
  const rel = (matches || []).filter(m => m.cat === "GRAMMAR" && m.l > 0 && m.sug && m.sug.length).sort((a, b) => b.o - a.o);
  let out = String(text), last = Infinity;
  const fixed = [], open = [];
  for (const m of rel) {
    if (m.o + m.l > last) continue;
    last = m.o;
    const part = String(text).substr(m.o, m.l), sug = m.sug[0];
    // Só troca direto palavra por palavra: sugestão que junta palavras (“einen Tasse-Kaffee”) vai para a reescrita.
    const sameSize = String(sug).split(/\s+/).length === part.split(/\s+/).length && (!String(sug).includes("-") || part.includes("-"));
    if (m.sug.length === 1 && sug && sug !== part && sameSize) { out = out.slice(0, m.o) + sug + out.slice(m.o + m.l); fixed.unshift({de: part, para: sug}); }
    else open.unshift({part, sug: m.sug.slice(0, 3)});
  }
  return {text: out, fixed, open};
}
function convGuardRepairMessages(text, open) {
  const list = open.map(o => "\"" + o.part + "\" (maybe: " + o.sug.join(" / ") + ")").join("; ");
  return [{role: "system", content: "You fix German grammar. A grammar checker flagged part of ONE line of spoken German. Rewrite the whole line with only the flagged grammar fixed (gender, case, verb form), choosing the form that fits the sentence. Change nothing else: same words, same meaning, same punctuation. If the flagged part is in fact correct, repeat the line unchanged. Answer with the line only."},
    {role: "user", content: "Line: " + text + "\nFlagged: " + list}];
}
/* Puro: a reescrita só vale se mudou pouco e o corretor não acha mais nada nela. */
function convGuardAccept(orig, repaired, matches, nOpen) {
  const r = convClean(repaired);
  if (!r || r === orig) return false;
  const changed = wordDiff(r, orig).ops.filter(([op]) => op !== "eq").length;
  return changed > 0 && changed <= 2 * Math.max(1, nOpen) + 2 && !(matches || []).some(m => m.cat === "GRAMMAR");
}
function convGuardWarm() { if (convGuardOn()) window.satzDesktop.ltCheck("Hallo, wie geht es dir?", {grammarOnly: true}).catch(() => {}); }
async function convGuard(text, move = null, waitMs = CONV_GUARD_WAIT) {
  const same = {text, changed: false};
  if (!convGuardOn() || convGuardSkip(text, move)) return same;
  const lt = t => window.satzDesktop.ltCheck(t, {grammarOnly: true}).then(r => r.matches || []);
  try {
    const matches = await Promise.race([lt(text), wait(waitMs).then(() => null)]);
    if (!matches || !matches.length) return same;
    const a = convGuardApply(text, matches);
    let out = a.text;
    if (a.open.length && convAvailable()) {
      const repaired = await Promise.race([(async () => {
        const r = await window.satzDesktop.convChat(convGuardRepairMessages(out, a.open), {kind: "repair", temperature: 0, maxTokens: 160});
        const rep = convClean(r.text);
        return convGuardAccept(out, rep, await lt(rep), a.open.length) ? rep : null;
      })(), wait(CONV_GUARD_REPAIR_WAIT).then(() => null)]);
      if (repaired) out = repaired;
    }
    if (out === text) return same;
    (conv.guardLog || (conv.guardLog = [])).push({de: text, para: out});
    console.log("conversa: fala da parceira corrigida: " + text + " → " + out);
    return {text: out, changed: true};
  } catch (e) { return same; }
}

// ---------- Formatos vivos (09/11/2026, etapa 3 da proposta em _dev/.cache/conversa-tutor) ----------
/* Uma pessoa não pergunta em toda fala. O app escolhe POR REGRA o formato da próxima fala dela e manda numa nota
   (como a do tutor): responder o que ele perguntou, contar algo dela, opinar, ou pedir que ele
   conte mais, sem pergunta (a novidade do dia já entra na abertura). Depois confere por regra: no máximo UMA pergunta por fala, e nenhuma quando o formato
   não é de pergunta (se ela já disse outra coisa). Só nas conversas livres e com as pessoas; atendente, paciente,
   jogo, missão, cena e livro precisam perguntar. */
function convShapeOn(topic = conv.topic) {
  return !!topic && !topic.patient && !topic.game && !topic.mission && !topic.role && !topic.script && !topic.book;
}
const convWordCount = text => String(text || "").split(/\s+/).filter(w => normWord(w)).length;
/* Frases que são pergunta de verdade (4+ palavras): “Na?”, “Echt?”, “Und du?” não contam. */
function convQuestions(text) {
  return (String(text || "").match(/[^.!?…]+[.!?…]+/g) || []).filter(x => /\?\s*$/.test(x) && convWordCount(x) >= 4);
}
/* Quantas falas seguidas dela, até agora, terminaram em pergunta. */
function convAskStreak(turns) {
  let n = 0;
  for (let i = turns.length - 1; i >= 0; i--) { if (turns[i].who !== "partner") continue; if (convQuestions(turns[i].de).length) n++; else break; }
  return n;
}
const CONV_ASKS = /^(und (du|sie|ihr|dir|ihnen|bei dir|bei ihnen)|w(as|ie|o|ann|arum|er|oher|ohin|elche[rsnm]?|ieso)\b)/i;
/* Puro: o formato da próxima fala dela. turns já inclui a fala dele; null = livre (ela pode perguntar). */
function convShapePick(turns, topic) {
  if (!convShapeOn(topic)) return null;
  const partner = turns.filter(t => t.who === "partner"), mine = turns.filter(t => t.who === "me");
  if (!partner.length || !mine.length || turns[turns.length - 1].who !== "me") return null;
  const said = String(mine[mine.length - 1].de || "").trim(), words = convWordCount(said);
  if (said === CONV_HUH || said === CONV_HUH_SIE || CONV_SLOW_ASK.test(said)) return null;
  // Ele perguntou: ela responde de si, sem devolver interrogatório.
  if (/\?\s*$/.test(said) || CONV_ASKS.test(said.replace(/^(und|aber|ja|nein|also)[, ]+(?!du|sie|ihr|dir|bei)/i, ""))) return {kind: "answer"};
  const streak = convAskStreak(turns);
  // Duas perguntas seguidas, ou uma pergunta e ele já contou bastante: agora é a vez dela dar algo.
  if (streak < 2 && !(streak >= 1 && words >= 5)) return null;
  // Em rodízio: contar algo dela → opinar → pedir que ele conte mais (os dois últimos só se ele deu assunto).
  const used = partner.map(t => t.shape).filter(k => k && k !== "answer");
  let kind = ["tell", "opine", "more"][used.length % 3];
  if ((kind === "opine" && words < 4) || (kind === "more" && words < 6)) kind = "tell";
  return kind === "more" ? {kind, say: CONV_MORE[partner.length % CONV_MORE.length]} : {kind};
}
const CONV_MORE = ["Erzähl mal!", "Erzähl mehr davon!", "Das will ich genauer hören!", "Und weiter? Erzähl!"];
const convShapeNoQuestion = shape => !!shape;
function convShapeNote(shape) {
  const head = "[Note from the app, never read it aloud or mention it: ", stop = " Then stop: he will answer by himself.]";
  switch (shape && shape.kind) {
    case "answer": return head + "Luiz asked YOU something. Answer it about yourself with one or two concrete details from your own life. Do not ask anything back in this turn, not even \"Und du?\"." + stop;
    case "tell": return head + "in this turn do NOT ask a question. React to what he said and tell one small concrete thing from your own life that relates to it." + stop;
    case "opine": return head + "in this turn do NOT ask a question. Say what you honestly think about what he just said, with a reason or your own experience; you may disagree a little or tease him kindly. Not a compliment about his German." + stop;
    case "more": return head + "in this turn do NOT ask a question. React with real interest in a few words and invite him to tell more with a short imperative such as \"" + (shape.say || CONV_MORE[0]) + "\"." + stop;
    default: return "";
  }
}
/* Confere por regra, frase a frase (serve ao texto que chega aos poucos): fica no máximo uma pergunta por fala; em
   formato sem pergunta ela sai, desde que a fala já tenha 4+ palavras de outra coisa (senão a fala ficaria vazia). */
function convQuestionFilter(shape) {
  const st = {asked: 0, words: 0, dropped: 0}, noQ = convShapeNoQuestion(shape);
  const fn = piece => (String(piece || "").match(/[^.!?…]+(?:[.!?…]+["“”»«)]*|$)/g) || []).filter(x => {
    const isQ = /\?["“”»«)]*\s*$/.test(x) && convWordCount(x) >= 4;
    if (isQ && (st.asked >= 1 || (noQ && st.words >= 4))) { st.dropped++; return false; }
    if (isQ) st.asked++;
    st.words += convWordCount(x);
    return true;
  }).join("").trim();
  fn.state = st;
  return fn;
}
/* A correção vem antes do formato: com recast, dica, modelo, completar ou checar o que ouviu, a fala fica sem formato
   (teste com o Gemma real: com as duas notas ela às vezes opinava e esquecia de dizer a forma certa). O elogio combina. */
const convShapeFor = (shape, move) => move && move.kind !== "praise" ? null : shape;

// ---------- Pausa para pensar (mãos livres) ----------
/* Puro: a fala transcrita parece ter parado no meio? Termina em conjunção, artigo, possessivo, preposição que não é
   prefixo separável (“Ich rufe dich an.” está completa), “äh”, vírgula ou reticências; ou é só um pronome solto. */
const CONV_OPEN_WORDS = "und oder aber weil dass wenn sondern ob als obwohl bevor nachdem der die den dem des eine einen einem einer "
  + "mein meine meinen meinem meiner dein deine deinen deinem deiner seine seinen seinem seiner ihre ihren ihrem unser unsere kein keine keinen keinem keiner "
  + "in im am ans ins zum zur vom beim für über unter durch gegen ohne seit bis von hinter neben zwischen wegen äh ähm ehm hm hmm also";
const CONV_OPEN_SUBJ = new Set(["ich", "du", "er", "wir", "ihr", "man"]);
let convOpenEnd = null; // montado no 1º uso (normWord vem do app.js, carregado depois)
function convUnfinished(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (/(,|…|\.\.\.|-|–)$/.test(t)) return true;
  if (!convOpenEnd) convOpenEnd = new Set(CONV_OPEN_WORDS.split(" ").map(normWord));
  const words = t.split(/\s+/).map(normWord).filter(Boolean), last = words[words.length - 1], prev = words[words.length - 2];
  if (!last) return false;
  if (CONV_OPEN_SUBJ.has(last)) return words.length === 1 || convOpenEnd.has(prev);
  return convOpenEnd.has(last);
}

// ---------- Voz ----------
async function convSpeak(text, slow = false) {
  stopAudio();
  if (convLocal()) return convLocalSay(text, slow);
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
  return speak(text, slow);
}
function convTtsWarn(e) {
  if (conv.ttsWarned) return;
  conv.ttsWarned = true;
  const code = (String(e && e.message || "").match(/sem-chave|limite|sem-internet|google-\d+|autoteste/) || [""])[0];
  const msg = {"sem-chave": "A voz do Google não tem chave configurada (Configurações → Conversa). Usando a voz do computador.",
    limite: "Limite mensal da voz do Google atingido (900 mil caracteres). Para não haver cobrança, a conversa usa a voz do computador até o mês virar.",
    "sem-internet": "Sem internet: a conversa usa a voz do computador."}[code] || "A voz do Google falhou; usando a voz do computador.";
  toast(msg, code === "limite" ? "error" : "info", 9000);
}

// ---------- Voz local (Piper): frase por frase, interrompível ----------
const CONV_LOCAL_VOICES = {thorsten: "m", kerstin: "f"};
const CONV_FEMALE = new Set(["aoede", "kore", "leda", "zephyr", "kerstin"]);
function convLocal() { return !!(CONV_LOCAL_VOICES[settings.convVoice] && window.satzDesktop && window.satzDesktop.ttsLocal); }
/* O tema pode pedir voz de mulher (paciente da FSP, personagens das missões): na voz local vira Kerstin; de homem, Thorsten. */
function convLocalVoice(topic = conv.topic) {
  if (topic && topic.voice) return CONV_FEMALE.has(topic.voice) ? "kerstin" : "thorsten";
  return CONV_LOCAL_VOICES[settings.convVoice] ? settings.convVoice : "thorsten";
}
/* Corta o texto que vai chegando em trechos com sentido completo: uma frase inteira (ou mais, se a 1ª for muito curta).
   Não corta em vírgula, em ordinal (“am 14. März”), em hora (“8.15 Uhr”) nem em abreviação. Com final = true, o resto também sai. */
const CONV_ABBR = /(?:(?:^|\s)[zdu]|\bz\.\s?B|\bd\.\s?h|\bu\.\s?a|\bbzw|\bca|\busw|\betc|\bDr|\bHr|\bFr|\bNr|\bProf|\bggf|\bevtl|\bvgl|\bSt)\.$/;
function convSegments(text, final = false, minChars = 12) {
  const segments = [];
  let start = 0;
  const re = /[.!?…]+["“”»«)]*(?=\s|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    if (end === text.length && !final) break;
    const before = text.slice(0, m.index + 1);
    if (m[0][0] === "." && (/\d\.$/.test(before) || CONV_ABBR.test(before))) continue;
    const piece = text.slice(start, end).trim();
    if (piece.length < minChars) continue;
    segments.push(piece);
    start = end;
  }
  let rest = text.slice(start);
  if (final && rest.trim()) { segments.push(rest.trim()); rest = ""; }
  return {segments, rest};
}
/* Toca trechos em ordem. Os pedidos à voz saem assim que o trecho chega (o processo principal gera em fila),
   então o próximo já está pronto enquanto o anterior toca. cancel() para o áudio e descarta o que falta. */
function convSpeaker({voice, slow = false, group, onStart} = {}) {
  const sp = {group: group || "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), slow, canceled: false, ended: false, spoken: [], items: [], playing: null, startedAt: 0};
  let resolveDone, kick = null;
  sp.done = new Promise(r => { resolveDone = r; });
  const finish = () => { if (sp.finished) return; sp.finished = true; resolveDone(sp); };
  async function loop() {
    for (let i = 0; ; i++) {
      while (i >= sp.items.length) { if (sp.ended || sp.canceled) return finish(); await new Promise(r => { kick = r; }); kick = null; }
      if (sp.canceled) return finish();
      const it = sp.items[i];
      let r;
      try { r = await it.audio; } catch (e) { convTtsWarn(e); r = null; }
      if (sp.canceled) return finish();
      if (!r || r.canceled || !r.audio) continue;
      const url = URL.createObjectURL(new Blob([r.audio], {type: "audio/wav"})), player = new Audio(url);
      sp.playing = player; audioPlayer = player;
      if (sp.ducked) player.volume = CONV_BARGE.duckVolume;
      sp.spoken.push(it.text);
      if (!sp.startedAt) { sp.startedAt = performance.now(); if (onStart) onStart(sp); }
      await player.play().then(() => waitForEnd(player, 400), () => {});
      URL.revokeObjectURL(url);
      sp.playing = null;
    }
  }
  sp.push = text => {
    const t = convClean(text);
    if (!t || sp.canceled) return;
    sp.items.push({text: t, audio: window.satzDesktop.ttsLocal(t, {voice, slow, group: sp.group})});
    if (kick) kick();
  };
  sp.end = () => { sp.ended = true; if (kick) kick(); };
  // Você começou a falar por cima: ela abaixa a voz; se era só um “Ja”/“Mhm”, volta ao normal e continua.
  sp.duck = on => { sp.ducked = !!on; if (sp.playing) sp.playing.volume = on ? CONV_BARGE.duckVolume : 1; };
  sp.cancel = () => {
    if (sp.canceled) return;
    sp.canceled = true;
    if (sp.playing) sp.playing.pause();
    window.satzDesktop.convCancel(sp.group).catch(() => {});
    if (kick) kick();
    finish();
  };
  loop();
  return sp;
}
/* Para a fala da parceira e a resposta que ainda está chegando (você tomou a palavra). */
function convInterrupt() {
  const sp = conv.speaker;
  if (!sp || sp.finished) return false;
  const cut = !!sp.playing || sp.spoken.length < sp.items.length || !sp.ended;
  sp.interrupted = true;
  sp.cancel();
  // A resposta já estava no histórico (o texto chega antes do áudio acabar): fica só o que ela chegou a dizer.
  const rec = sp.record;
  if (rec && cut) {
    const said = sp.spoken.join(" ");
    rec.msg.content = said ? said + " …" : "…";
    rec.turn.interrupted = true;
    if (rec.bubble && rec.bubble.isConnected) { const nb = convBubble(rec.turn); rec.bubble.replaceWith(nb); rec.bubble = nb; }
  }
  return true;
}
/* Você pediu para repetir ou falar mais devagar: a resposta seguinte sai na voz lenta. */
const CONV_SLOW_ASK = /langsam|nicht verstanden|verstehe (das |dich |sie )?nicht|noch ?(ein)?mal|wiederhol|wie bitte|einfacher/i;
function convLocalSay(text, slow = false) {
  if (conv.speaker) conv.speaker.cancel();
  const sp = convSpeaker({voice: convLocalVoice(), slow});
  conv.speaker = sp;
  convSegments(text, true).segments.forEach(sp.push);
  sp.end();
  return sp;
}
function convNewId() { return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
const convStreams = new Map();
function convBindDeltas() {
  if (convBindDeltas.done || !window.satzDesktop || !window.satzDesktop.onConvDelta) return;
  convBindDeltas.done = true;
  window.satzDesktop.onConvDelta(d => { const f = d && convStreams.get(d.id); if (f) f(String(d.text || "")); });
}
/* Turno da parceira com a voz local: o texto chega aos poucos, cada frase pronta já vai para a voz. */
async function partnerTurnLocal(userText, metrics, move = null, shape = null) {
  const token = conv.token, id = convNewId(), t0 = performance.now();
  conv.messages.push({role: "user", content: userText});
  convSetBusy(true, convName() + " está respondendo…");
  convBindDeltas();
  const m = metrics || {};
  m.pedido = Math.round(t0);
  const sp = convSpeaker({voice: convLocalVoice(), slow: CONV_SLOW_ASK.test(userText), group: id, onStart: () => { m.primeiroAudio = Math.round(performance.now()); }});
  conv.speaker = sp;
  let pending = "", chain = Promise.resolve();
  // Cada frase é conferida (alemão da parceira) enquanto a anterior toca; a ordem das frases é mantida.
  const parts = [], keep = convShapeOn() ? convQuestionFilter(shape) : x => x;
  const say = piece => {
    const seg = keep(convClean(piece));
    if (!seg) return;
    const g = convGuard(seg, move);
    chain = chain.then(async () => { const r = await g; parts.push(r.text); sp.push(r.text); });
  };
  convStreams.set(id, delta => {
    if (!m.primeiraPalavra) m.primeiraPalavra = Math.round(performance.now());
    pending += delta;
    const {segments, rest} = convSegments(pending, false);
    pending = rest;
    segments.forEach(say);
  });
  let r;
  try { r = await window.satzDesktop.convStream(id, convOutgoing(move, shape), {kind: "turn", temperature: .7, maxTokens: 160}); }
  catch (e) {
    convStreams.delete(id); sp.cancel();
    if (token !== conv.token) return;
    conv.messages.pop();
    convSetBusy(false, "");
    setStatus("A parceira não respondeu: " + cleanIpcError(e, "erro desconhecido"), "error");
    return;
  }
  convStreams.delete(id);
  if (token !== conv.token) { sp.cancel(); return; }
  m.respostaCompleta = Math.round(performance.now());
  if (!r.canceled && !sp.canceled) {
    convSegments(pending, true).segments.forEach(say);
    await chain;
    if (token !== conv.token) { sp.cancel(); return; }
    sp.end();
  }
  // Interrompida: guarda só o que ela chegou a dizer, para o modelo saber onde parou.
  const full = parts.join(" ") || convClean(r.text) || "…";
  const interrupted = sp.canceled || r.canceled;
  const text = interrupted ? (sp.spoken.join(" ") ? sp.spoken.join(" ") + " …" : "…") : full;
  const msg = {role: "assistant", content: text};
  conv.messages.push(msg);
  const turn = {who: "partner", de: interrupted ? text : full, interrupted, recast: convRecastWords(move)};
  if (shape) turn.shape = shape.kind;
  conv.turns.push(turn);
  convSetBusy(false, "");
  const bubble = convBubble(turn);
  $("convChat").append(bubble);
  sp.record = {msg, turn, bubble};
  convScroll();
  if (typeof missionRender === "function") missionRender();
  conv.lastMetrics = m;
  if (interrupted) return;
  $("convStatus").textContent = speechAvailable() ? "Sua vez: fale (F) ou escreva e aperte Enter. Falar ou apertar F interrompe a parceira." : "Sua vez: escreva e aperte Enter.";
  if (settings.convHandsFree) {
    if (settings.convBargeIn) convListen({bargeIn: true});
    else sp.done.then(() => { if (token === conv.token && !sp.interrupted) convListen(); });
  }
}
/* Gravações guardadas a pedido (Configurações da Conversa), para comparar o reconhecimento depois. */
async function convKeepRec(blob, text, how, metrics) {
  if (!settings.convKeepRec || !window.satzDesktop || !window.satzDesktop.convSaveRec) return null;
  const id = new Date().toISOString().replace(/[:.]/g, "-").toLowerCase().slice(0, 23) + "-" + Math.random().toString(36).slice(2, 5);
  try {
    const wav = await blobToWav16k(blob);
    await window.satzDesktop.convSaveRec(id, wav, {whisper: text, modelo: desktopInfo && desktopInfo.speech ? desktopInfo.speech.model : "", modo: how,
      tema: conv.topic ? conv.topic.id : "", voz: settings.convVoice, tempos: metrics || null});
    return id;
  } catch (e) { return null; }
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
  if (s.loading) return h("p", {class: "muted small-text", text: "Preparando a parceira de conversa… pode ir escolhendo o tema."});
  return h("p", {class: "muted small-text", text: "Parceira pronta, sem limite de conversa."});
}
/* Escolha em 4 caminhos (Tema, Situação, Monólogo, Medicina); só o escolhido aparece, com uma sugestão em destaque.
   Os outros grupos ficam no DOM escondidos (o autoteste conta todos os cartões). */
const CONV_TABS = [
  ["pessoas", "Conversar com alguém", "Cinco pessoas com vida própria. Elas lembram do que você contou.", "Pessoas"],
  ["tema", "Conversar sobre um tema", "Bate-papo no seu nível sobre um assunto do dia a dia.", "Tema"],
  ["situacao", "Praticar uma situação", "Ela faz o outro papel: balcão, telefone, Bürgeramt…", "Situação"],
  ["monologo", "Monólogo 4/3/2", "Conte a mesma coisa três vezes, cada vez mais rápido.", "Monólogo"],
  ["medicina", "Medicina e FSP", "Paciente que não sabe o que tem e anamnese como na prova.", "Medicina"]];
function convTab() { const t = localStorage.getItem("satzbausteine.convTab"); return CONV_TABS.some(x => x[0] === t) ? t : "pessoas"; }
function convCard(t, suggested) {
  const ok = !!(conv.status && conv.status.installed);
  return h("article", {class: "scene-card" + (suggested ? " suggested" : "")},
    h("div", {class: "scene-top"}, h("span", {class: "tag", text: t.level}), t.role ? h("span", {class: "tag", text: "Sie"}) : null, suggested ? h("span", {class: "status s-next", text: "Sugerida"}) : null),
    h("h3", {text: t.pt}),
    t.role ? h("p", {class: "muted small-text", text: "Com: " + t.rolePt.toLowerCase()}) : null,
    h("div", {class: "row"}, h("button", {class: (suggested ? "primary " : "") + "small", type: "button", disabled: !ok, onclick: () => openConversa(t.id)}, "Conversar")));
}
function renderConvSetup() {
  $("convRoom").hidden = true;
  $("f432Room").hidden = true;
  $("convSetup").hidden = false;
  const level = convLevel(), data = convData(), last = data.sessions[data.sessions.length - 1], tab = convTab();
  const done = new Set(data.sessions.map(s => s.topic));
  const pick = list => list.find(t => !done.has(t.id) && LEVELS.indexOf(t.level) <= LEVELS.indexOf(level)) || list.find(t => !done.has(t.id)) || list[0];
  const grid = list => { const sug = pick(list); return h("div", {class: "scene-grid"}, ...[sug, ...list.filter(t => t !== sug)].map(t => convCard(t, t === sug))); };
  const temas = CONV_TOPICS.filter(t => t.group === "Temas"), sit = CONV_TOPICS.filter(t => t.group === "Situações"), livre = CONV_TOPICS.filter(t => t.group === "Livre");
  const panes = {
    pessoas: [typeof pessoasSetupNode === "function" ? pessoasSetupNode() : null],
    // Temas e situações (conversa-temas.js): sugestão em destaque, categorias, busca e cartões com a frase de abertura.
    tema: typeof convBrowser === "function" ? [convBrowser("Temas"), convFreeNode()] : [h("section", {class: "scene-group"}, h("h2", {text: "Temas"}), grid(temas)),
      livre.length ? h("section", {class: "scene-group"}, h("h2", {text: "Livre"}), h("div", {class: "scene-grid"}, ...livre.map(t => convCard(t, false)))) : null],
    situacao: [typeof convBrowser === "function" ? convBrowser("Situações") : h("section", {class: "scene-group"}, h("h2", {text: "Situações do dia a dia"}), grid(sit)),
      typeof missionSetupNode === "function" ? missionSetupNode() : null],
    monologo: [f432SetupNode()],
    medicina: [typeof fspSetupNode === "function" ? fspSetupNode() : null]};
  if (typeof missionSetupNode === "function") {
    // As missões ficam em Situação; o jogo do diagnóstico vai para Medicina.
    const [jogo, missoes] = panes.situacao[1];
    panes.situacao[1] = missoes;
    panes.medicina.unshift(jogo);
  }
  const seg = h("div", {class: "segmented conv-tabs", role: "group", "aria-label": "O que praticar"},
    ...CONV_TABS.map(([id, label, , short]) => h("button", {type: "button", "aria-pressed": String(id === tab), "aria-label": label, onclick: () => { localStorage.setItem("satzbausteine.convTab", id); renderConvSetup(); }}, h("b", {class: "tab-long", text: label}), h("b", {class: "tab-short", text: short}))));
  const status = convModelLine();
  status.classList.remove("notice");
  const [lvl, lvlHelp] = titled("b", "Nível " + level, "A parceira fala nesse nível e usa, de preferência, as palavras das frases que você já aprendeu; conforme você avança no treino, a conversa sobe junto. Fale (F) ou escreva. Ela responde repetindo certo o que você disse, sem interromper. Cada fala sua ganha um sinal (Certo ou o número de erros; toque para ver a correção) e, no fim, você vê o resumo dos erros em português.");
  fill($("convSetup"),
    h("div", {class: "conv-strip"},
      h("div", {class: "conv-strip-row"}, lvl, status,
        last ? h("span", {class: "muted small-text", text: plural(data.sessions.length, "conversa feita", "conversas feitas") + " · última em " + new Date(last.at).toLocaleDateString("pt-BR")}) : null),
      lvlHelp),
    typeof liveSetupNode === "function" ? liveSetupNode() : null,
    seg,
    h("p", {class: "mode-desc", text: CONV_TABS.find(x => x[0] === tab)[2]}),
    ...Object.entries(panes).map(([id, nodes]) => h("div", {class: "conv-pane", hidden: id !== tab}, ...nodes.flat())));
}
function convBubble(turn) {
  const mine = turn.who === "me";
  const el = h("div", {class: "bubble " + (mine ? "me" : "other")});
  el.append(h("span", {class: "bubble-name", text: mine ? "Você" : convName()}, turn.interrupted ? h("span", {class: "muted small-text", text: " · interrompida"}) : null));
  const de = h("p", {class: "bubble-de", lang: "de"}, ...(!mine && turn.recast ? convRecastNodes(turn.de, turn.recast) : [turn.de]));
  if (mine) {
    el.append(de);
    if (turn.heard) el.append(h("p", {class: "cv-heard-old muted small-text"}, "O app tinha ouvido: ", h("span", {lang: "de", text: turn.heard})));
    // Fala enviada sem você conferir (mãos livres, envio automático): dá para consertar o que o app ouviu errado.
    if (turn.spoken && !conv.finished) el.append(h("button", {class: "cv-heard", type: "button", title: "Corrigir o que o app ouviu (não conta como erro seu)",
      onclick: () => convFixHeard(turn, el)}, icon("pen", 13), h("span", {text: "Ouviu errado?"})));
    return el;
  }
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
/* Troca a fala pelo que você disse de verdade: no balão, no histórico que vai para o modelo e na gravação guardada
   (a correção fica junto do que o Whisper ouviu, para medir o reconhecimento depois). A correção da fala é refeita. */
function convApplyHeard(turn, text) {
  const old = turn.de;
  if (!text || text === old) return false;
  if (!turn.heard) turn.heard = old;
  turn.de = text;
  for (let i = conv.messages.length - 1; i > 0; i--) if (conv.messages[i].role === "user" && conv.messages[i].content === old) { conv.messages[i].content = text; break; }
  turn.check = null;
  if (turn.rec && window.satzDesktop && window.satzDesktop.convSaveRec) window.satzDesktop.convSaveRec(turn.rec, null, {corrigido: text}).catch(() => {});
  return true;
}
function convFixHeard(turn, bubble) {
  if (bubble.querySelector(".cv-heard-form")) return;
  const input = h("input", {type: "text", lang: "de", "aria-label": "O que você disse de verdade"});
  input.value = turn.de;
  const form = h("form", {class: "cv-heard-form"}, input, h("button", {class: "small", type: "submit"}, "Corrigir"),
    h("button", {class: "quiet small", type: "button", onclick: () => form.remove()}, "Cancelar"));
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!convApplyHeard(turn, convClean(input.value))) { form.remove(); return; }
    const nb = convBubble(turn);
    bubble.replaceWith(nb);
    convCheckTurn(turn, nb);
  });
  bubble.append(form);
  input.focus();
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
  if (conv.live && typeof liveEnd === "function") liveEnd();
  const level = convLevel();
  Object.assign(conv, {topic, turns: [], busy: false, token: conv.token + 1, startedAt: Date.now(), ttsWarned: false, finished: false, tutor: convTutorFresh(),
    messages: [{role: "system", content: convSystemPrompt({name: convName(topic), level, topic, known: convKnownSentences()})}]});
  $("convSetup").replaceChildren();
  $("convRoom").hidden = false;
  $("convSummary").hidden = true;
  $("convHelp").hidden = true;
  $("convTitle").textContent = topic.pt;
  fill($("convMeta"), h("span", {class: "tag", text: "Nível " + level}), h("span", {class: "tag", text: convSie(topic) ? "Sie · formal" : "du · informal"}),
    h("span", {class: "tag", text: "Com: " + convName(topic)}));
  if (typeof missionReset === "function") missionReset(topic);
  $("convSetting").textContent = topic.game ? "Você é o médico: o paciente não sabe o que tem. Pergunte, descubra os sintomas e dê o diagnóstico."
    : topic.lesson ? "Fecho da lição: uns 5 minutos de conversa sobre o tema. Fale da sua vida; a lista acima marca o que você usar da lição."
    : topic.mission ? "Situação: " + convName(topic).toLowerCase() + " faz o outro papel. Fique atento: no meio aparece um imprevisto."
    : topic.patient ? "Você é o médico: cumprimente, apresente-se e faça a anamnese completa (queixa atual, vegetativa, antecedentes, medicamentos, alergias, hábitos, família, social). O paciente só conta o que você perguntar. Quando acabar, toque em “Terminar e ver erros”."
    : topic.script ? "Improviso da cena: a mesma situação, mas com detalhes diferentes. Ouça bem e se adapte."
    : topic.role ? "Situação: você é o cliente/paciente; " + convName(topic).toLowerCase() + " faz o outro papel." : "";
  $("convShowText").checked = settings.convShowText !== false;
  $("convAutoSend").checked = !!settings.convAutoSend;
  $("convHandsFree").checked = !!settings.convHandsFree;
  $("convBargeIn").checked = !!settings.convBargeIn;
  $("convBargeInWrap").hidden = !convLocal();
  $("convCheck").value = convCheckLevel();
  conv.handsFreePaused = false; conv.emptyListens = 0;
  $("convHuh").title = "Envia: “" + (convSie(topic) ? CONV_HUH_SIE : CONV_HUH) + "” (ela repete mais fácil)";
  $("convRoom").classList.remove("finished");
  $("convChat").replaceChildren();
  $("convText").value = "";
  if (typeof salaOpen === "function") salaOpen(topic);
  window.scrollTo({top: 0});
  convGuardWarm();
  if (settings.convHandsFree) vadLoad();
  if (convLocal()) window.satzDesktop.ttsLocalWarm(convLocalVoice(topic)).then(() => window.satzDesktop.ttsLocalWarm(convLocalVoice(topic), true)).catch(() => {});
  const opening = topic.lesson && typeof msFechoStart === "function" ? msFechoStart(topic) : topic.persona && typeof pessoaStart === "function" ? pessoaStart(topic.persona) : CONV_START;
  // Ao vivo (piloto): a ligação pelo Gemini Live cuida da voz; o resto da sala é o mesmo.
  if (typeof liveOn === "function" && liveOn()) { convSetBusy(false, ""); liveBegin(topic, opening); return; }
  if (topic.luizStarts) { convSetBusy(false, "Você começa: cumprimente e faça a sua pergunta."); $("convText").focus(); if (settings.convHandsFree) convListen(); }
  else partnerTurn(opening);
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
/* O que vai para o modelo: o histórico limpo e, só na última fala dele, a nota do tutor (nunca fica guardada). */
function convOutgoing(move, shape = null) {
  const ctx = convContext(conv.messages), note = [move ? convTutorNote(move) : "", convShapeNote(shape)].filter(Boolean).join("\n");
  if (!note) return ctx;
  const last = ctx[ctx.length - 1];
  return [...ctx.slice(0, -1), {role: last.role, content: last.content + "\n\n" + note}];
}
/* Palavras a destacar no balão dela: só quando o movimento dá a forma certa. */
const convRecastWords = move => move && ["recast", "hint", "model"].includes(move.kind) ? move.words : null;
async function partnerTurn(userText, metrics, move = null, shape = null) {
  if (convLocal()) return partnerTurnLocal(userText, metrics, move, shape);
  const token = conv.token;
  conv.messages.push({role: "user", content: userText});
  convSetBusy(true, convName() + " está respondendo…");
  try {
    const r = await window.satzDesktop.convChat(convOutgoing(move, shape), {kind: "turn", temperature: .7, maxTokens: 160});
    if (token !== conv.token) return;
    const kept = convShapeOn() ? convQuestionFilter(shape)(convClean(r.text)) : convClean(r.text);
    const text = (await convGuard(kept || convClean(r.text) || "…", move, 800)).text;
    if (token !== conv.token) return;
    conv.messages.push({role: "assistant", content: text});
    const turn = {who: "partner", de: text, recast: convRecastWords(move)};
    if (shape) turn.shape = shape.kind;
    conv.turns.push(turn);
    convSetBusy(false, "");
    $("convChat").append(convBubble(turn));
    convScroll();
    if (typeof missionRender === "function") missionRender();
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
  if (conv.live) {
    const typed = convClean(textArg != null ? textArg : $("convText").value);
    if (typed && liveSendTyped(typed)) { $("convText").value = ""; $("convHelp").hidden = true; }
    return;
  }
  const text = convClean(textArg != null ? textArg : $("convText").value);
  if (!text) { $("convText").focus(); return; }
  $("convText").value = "";
  $("convHelp").hidden = true;
  const metrics = conv.pendingMetrics || {}; conv.pendingMetrics = null;
  const rec = conv.pendingRec; conv.pendingRec = null;
  const turn = {who: "me", de: text};
  if (textArg != null && text !== CONV_HUH && text !== CONV_HUH_SIE) turn.spoken = true;
  if (rec) turn.rec = rec;
  const bubble = convBubble(turn);
  conv.turns.push(turn);
  $("convChat").append(bubble);
  convScroll();
  if (typeof missionAfterTurn === "function") missionAfterTurn(turn);
  const token = conv.token, tutor = convTutorOn();
  (async () => {
    // Correção de tutor: confere a fala antes e a parceira reage ao erro (um movimento por vez).
    let move = null;
    if (tutor) {
      convSetBusy(true, convName() + " está pensando…");
      move = await convTutorPrepare(turn, bubble);
      metrics.conferido = Math.round(performance.now());
      if (token !== conv.token) return;
    }
    await partnerTurn(text, metrics, move, convShapeFor(convShapePick(conv.turns, conv.topic), move));
    if (rec && window.satzDesktop.convSaveRec) window.satzDesktop.convSaveRec(rec, null, {enviado: text, tempos: metrics, movimento: move ? move.kind : "nenhum"}).catch(() => {});
    if (metrics.primeiroAudio && metrics.falaFim) console.log("conversa: fim da fala → voz em " + (metrics.primeiroAudio - metrics.falaFim) + " ms", metrics);
    if (!tutor) return convCheckTurn(turn, bubble);
  })();
}
async function convMic() {
  if (conv.live && typeof liveToggleMic === "function") { liveToggleMic(); return; }
  if (conv.clip) { conv.pendingMetrics = {falaFim: Math.round(performance.now())}; conv.clip.stop(); return; }
  if (convInterrupt()) await wait(30);
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
  const mm = conv.pendingMetrics || {falaFim: Math.round(performance.now())};
  mm.capturaFim = Math.round(performance.now());
  try { text = convDedupeHeard(await transcribeBlob(blob, false, {fast: true})); } catch (e) { setStatus("Não foi possível transcrever: " + e.message, "error"); }
  mm.transcrito = Math.round(performance.now());
  conv.pendingMetrics = mm;
  conv.pendingRec = await convKeepRec(blob, text, "botao", mm);
  if (token !== conv.token) return;
  convSetBusy(false, "");
  if (!text) { $("convStatus").textContent = "Não ouvi nada. Tente de novo mais perto do microfone, ou escreva."; return; }
  if (settings.convAutoSend) { convSend(text); return; }
  $("convText").value = text;
  $("convText").focus();
  $("convStatus").textContent = "Confira o que o app ouviu (corrija se ele ouviu errado) e envie com Enter.";
}
// ---------- Mãos livres: ouvir sozinho, detectar o fim da fala e enviar ----------
/* Fim da fala (09/11/2026): com 1 s de silêncio o app transcreve o que já ouviu SEM parar de gravar. Frase com cara de
   completa e silêncio até a transcrição chegar (~1 s) → envia, já transcrita. Frase parada no meio (convUnfinished) →
   espera você pensar até CONV_THINK_MS. Voltou a falar → segue gravando. Se a transcrição parcial falhar, vale a regra
   antiga (CONV_SILENCE_OLD_MS). */
const CONV_SILENCE_MS = 1000, CONV_SILENCE_OLD_MS = 1300, CONV_THINK_MS = 3500, CONV_WAIT_SPEECH_MS = 12000, CONV_MAX_MS = 45000;
/* Com o detector de voz o silêncio é confiável: o retrato sai com 0,7 s. Ao Whisper vai só o trecho em que você falou
   (do começo da fala − 0,3 s ao fim + 0,4 s), sempre no modelo pequeno: medido em 10/11/2026 com as falas do usuário,
   o “mais preciso” levava 5–7 s por fala e o pequeno com a janela do tamanho da fala ~0,8–1,3 s. */
const CONV_SILENCE_VAD_MS = 700, CONV_TRIM_BEFORE = .3, CONV_TRIM_AFTER = .4;
/* Whisper às vezes repete uma frase inteira (“Wie sagt man? Wie sagt man? …”), sobretudo com silêncio sobrando:
   cada frase de 2+ palavras fica uma vez só. Palavra solta repetida (“am… am…”) fica: é hesitação ou microfone (convGarbled). */
function convDedupeHeard(text) {
  const parts = String(text || "").match(/[^.!?…]+(?:[.!?…]+|$)/g) || [];
  const seen = new Set(), out = [];
  for (const p of parts) {
    const t = p.trim(), k = convBare(t);
    if (!t) continue;
    if (k.split(" ").length >= 2 && seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out.join(" ");
}
/* Espera a fala da parceira acabar (áudio do Google ou voz do Windows). */
async function convWaitAudio(player) {
  if (player && player.done) { await player.done; return; }
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
/* Grava com detecção de voz: começa a contar quando a fala aparece e para no silêncio (ver CONV_SILENCE_MS).
   Fala = Silero VAD (vad.js) quando o modelo está carregado; senão, volume acima de 3× o ruído medido no início.
   Com a parceira falando (interromper falando), ~150 ms de voz abaixam o volume dela e 500 ms a interrompem;
   “Ja”/“Mhm” curtos não cortam (stat.backchannels). Sem fala em 12 s, desiste e espera o usuário (F). */
async function convListen(opts = {}) {
  if (!settings.convHandsFree || currentView !== "conversa" || conv.busy || conv.finished || conv.clip || !conv.topic || !speechAvailable()) return;
  const bargeIn = !!opts.bargeIn;
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}}); }
  catch (e) { setStatus("Acesso ao microfone negado ou indisponível.", "error"); return; }
  const token = conv.token, ctx = new AudioContext(), analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize), mr = new MediaRecorder(stream), chunks = [];
  let resolveDone;
  const done = new Promise(r => { resolveDone = r; });
  const t0 = Date.now(), t0perf = performance.now(), stat = {spoke: false, reason: "", noise: 0, n: 0, loudRun: 0, lastLoud: 0, snapAt: 0, snapBusy: false, noSnap: false, open: false, early: null, onData: null, snaps: 0, waited: 0, backchannels: 0, ducked: false, vadMax: 0};
  // Detector de voz: cada quadro de 32 ms atualiza a fala contínua (vadSt); o relógio de 50 ms abaixo só lê o resultado.
  const vadSt = {voiced: false, start: 0, last: -Infinity};
  const talking = () => bargeIn && conv.speaker && !conv.speaker.finished && !conv.speaker.canceled;
  const vad = await vadAttach(stream, p => {
    const now = Date.now();
    if (talking()) stat.vadMax = Math.max(stat.vadMax, p);
    vadTrack(vadSt, p, now, VAD_CFG, talking());
    if (vadSt.voiced) stat.lastLoud = now;
  });
  stat.vad = !!vad;
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); if (stat.onData) { const f = stat.onData; stat.onData = null; f(); } };
  mr.onstop = () => { if (vad) vad.close(); unduck(); stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => {}); resolveDone(new Blob(chunks, {type: mr.mimeType || "audio/webm"})); };
  const unduck = () => { if (stat.ducked && conv.speaker && conv.speaker.duck) conv.speaker.duck(false); stat.ducked = false; };
  let timer = null;
  const stop = reason => { if (timer === null) return; clearInterval(timer); timer = null; stat.reason = stat.reason || reason; if (mr.state === "recording") mr.stop(); };
  // Retrato da fala até aqui: decide se já pode enviar ou se você parou para pensar.
  const snapshot = async () => {
    const mark = stat.lastLoud;
    stat.snapAt = mark; stat.snapBusy = true;
    let text = "", ok = false;
    try {
      const got = new Promise(r => { stat.onData = r; });
      mr.requestData();
      await got;
      text = convDedupeHeard(await transcribeBlob(new Blob(chunks, {type: mr.mimeType || "audio/webm"}), false, {fast: true, range: spokenRange(mark)}));
      ok = true; stat.snaps++;
    } catch (e) { stat.noSnap = true; }
    stat.snapBusy = false;
    if (timer === null || stat.lastLoud !== mark || !ok) return;
    if (convUnfinished(text)) { stat.open = true; stat.waited++; $("convStatus").textContent = "Pode continuar… (estou esperando você terminar a frase)"; return; }
    stat.early = {text, mark, at: Math.round(performance.now())};
    stop("silêncio");
  };
  // Trecho em que você falou, em segundos desde o começo da gravação (a escuta por cima começa com ela falando).
  const spokenRange = end => stat.speechAt ? {from: Math.max(0, (stat.speechAt - tRec) / 1000 - CONV_TRIM_BEFORE), to: (end - tRec) / 1000 + CONV_TRIM_AFTER} : null;
  mr.start();
  const tRec = Date.now();
  timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length), now = Date.now();
    if (typeof salaMic === "function") salaMic(rms);
    let run;
    if (vad) run = vadRun(vadSt, now);
    else {
      if (now - t0 < 300) { stat.noise += rms; stat.n++; return; }
      const threshold = Math.max(.012, stat.noise / Math.max(1, stat.n) * 3);
      if (rms > threshold) { stat.loudRun++; stat.lastLoud = now; }
      else stat.loudRun = 0;
      run = stat.loudRun * 50;
    }
    if (stat.open && run >= 150) { stat.open = false; $("convStatus").textContent = "Ouvindo… (pare de falar e ele envia sozinho)"; }
    if (!stat.spoke) {
      if (talking()) {
        const act = convBargeAction(run);
        if (act === "cut") { unduck(); stat.spoke = true; stat.speechAt = vad ? vadSt.start : now - run; convInterrupt(); $("convStatus").textContent = "Ouvindo… (pare de falar e ele envia sozinho)"; }
        else if (act === "duck" && !stat.ducked) { stat.ducked = true; if (conv.speaker.duck) conv.speaker.duck(true); }
        else if (act === "none" && stat.ducked && run === 0) { unduck(); stat.backchannels++; }
      }
      else {
        if (stat.ducked) unduck();
        if (run >= (vad ? 96 : 150)) { stat.spoke = true; stat.speechAt = vad ? vadSt.start : now - run; $("convStatus").textContent = "Ouvindo… (pare de falar e ele envia sozinho)"; }
      }
    }
    const quiet = now - stat.lastLoud;
    if (stat.spoke && quiet > (stat.noSnap ? CONV_SILENCE_OLD_MS : CONV_THINK_MS)) stop("silêncio");
    else if (stat.spoke && !stat.noSnap && quiet > (vad ? CONV_SILENCE_VAD_MS : CONV_SILENCE_MS) && !stat.snapBusy && stat.snapAt !== stat.lastLoud) snapshot();
    else if (!stat.spoke && now - t0 > CONV_WAIT_SPEECH_MS + (bargeIn && conv.speaker && !conv.speaker.finished ? 60000 : 0)) stop("sem fala");
    else if (now - t0 > CONV_MAX_MS) stop("tempo máximo");
  }, 50);
  conv.clip = {stop: () => stop("manual"), done};
  if (!bargeIn) convBeep();
  $("convMic").classList.add("danger-solid");
  $("convMic").replaceChildren(icon("stop", 18), "Parar", h("kbd", null, "F"));
  convSetBusy(true, bargeIn ? "Pode falar quando quiser: falar interrompe a parceira." : "Pode falar… (mãos livres)");
  $("convMic").disabled = false;
  const blob = await done;
  conv.clip = null;
  conv.lastListen = {spoke: stat.spoke, reason: stat.reason, ms: Date.now() - t0, snaps: stat.snaps, waited: stat.waited, noSnap: stat.noSnap,
    vad: stat.vad, backchannels: stat.backchannels, vadMax: Math.round(stat.vadMax * 100) / 100};
  $("convMic").classList.remove("danger-solid");
  $("convMic").replaceChildren(icon("mic", 18), "Falar", h("kbd", null, "F"));
  if (token !== conv.token) return;
  if (conv.handsFreePaused) { conv.handsFreePaused = false; convSetBusy(false, "Escuta pausada. Aperte F para falar."); return; }
  if (!stat.spoke) { convSetBusy(false, "Não ouvi nada. Aperte F quando quiser falar (as mãos livres voltam depois da próxima resposta)."); return; }
  convSetBusy(true, "Transcrevendo sua fala neste computador…");
  let text = "";
  const mm = {falaFim: Math.round(t0perf + (stat.lastLoud - t0)), capturaFim: Math.round(performance.now())};
  // O retrato feito no silêncio já é a fala inteira (nada foi dito depois): não transcreve de novo.
  const early = stat.early && stat.early.mark === stat.lastLoud ? stat.early : null;
  if (early) text = early.text;
  else try { text = convDedupeHeard(await transcribeBlob(blob, false, {fast: true, range: spokenRange(stat.lastLoud)})); } catch (e) { setStatus("Não foi possível transcrever: " + e.message, "error"); }
  mm.transcrito = Math.round(performance.now());
  if (stat.waited) mm.esperouPensar = stat.waited;
  const range = spokenRange(stat.lastLoud);
  if (range) mm.trecho = [Math.round(range.from * 10) / 10, Math.round(range.to * 10) / 10];
  mm.vad = !!stat.vad;
  conv.pendingMetrics = mm;
  conv.pendingRec = await convKeepRec(blob, text, "maos-livres", mm);
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
/* Ajuda em degraus para quando você trava: 1) palavras que ajudam, 2) o começo da frase, 3) a resposta inteira, escondida
   até você tocar. Uma chamada só à IA; cada toque em “Dica” (ou “Mais ajuda”) abre o degrau seguinte. */
const CONV_HINT_STEPS = ["Palavras que ajudam", "Comece assim", "Uma resposta possível"];
function convHintPrompt(level, sie) {
  return `Luiz (German level ${level}) is in a German conversation and does not know what to answer to the partner's last message (${sie ? "he uses \"Sie\"" : "he uses \"du\""}). Help him in steps. "palavras": 2 to 4 useful GERMAN words for his answer (single words or two-word chunks, never Portuguese and never a whole answer; nouns with their article, verbs in the infinitive), each with its Brazilian Portuguese meaning; avoid words that are already in the partner's message. "respostas": 2 different, short possible answers at his level, each a complete and correct German sentence: "inicio" = the first 2 to 4 words of the answer, "frase" = the whole answer, "pt" = its Brazilian Portuguese translation. Answer as JSON.`;
}
/* Confere a resposta da IA por regra: o começo tem de ser mesmo o começo da frase (senão vem das primeiras palavras dela). */
function convHintData(j) {
  const words = j && Array.isArray(j.palavras) ? j.palavras.filter(p => p && convClean(p.de)).map(p => ({de: convClean(p.de), pt: convClean(p.pt)})) : [];
  // Fora: repetidas e “palavras” iguais à tradução (o Gemma às vezes devolve a palavra em português, ex.: “Brasil (Brasil)”).
  const seen = new Set(), uniq = words.filter(p => convBare(p.de) !== convBare(p.pt) && !seen.has(convBare(p.de)) && seen.add(convBare(p.de)));
  const answers = (j && Array.isArray(j.respostas) ? j.respostas : []).filter(r => r && convClean(r.frase)).slice(0, 2).map(r => {
    const frase = convClean(r.frase), all = frase.split(/\s+/);
    let inicio = convClean(r.inicio).replace(/\s*(…|\.\.\.)$/, "");
    if (!inicio || !convBare(frase).startsWith(convBare(inicio)) || convBare(inicio) === convBare(frase)) inicio = all.slice(0, Math.max(1, Math.min(3, all.length - 1))).join(" ");
    return {inicio: inicio.replace(/[.,!?;:]+$/, "") + " …", frase, pt: convClean(r.pt)};
  });
  return {words: uniq.slice(0, 4), answers};
}
async function convHint() {
  if (conv.busy) return;
  const last = [...conv.turns].reverse().find(t => t.who === "partner");
  if (!last) return;
  if (conv.hint && conv.hint.turn === last) {
    conv.hint.step = Math.min(CONV_HINT_STEPS.length, conv.hint.step + 1);
    convHintRender();
    return;
  }
  convSetBusy(true, "Preparando a ajuda…");
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: convHintPrompt(convLevel(), convSie())},
      {role: "user", content: "Partner: " + last.de}], {kind: "hint", temperature: .5, maxTokens: 400, schema: CONV_HINT_SCHEMA});
    const data = convHintData(parseLooseJson(r.text));
    if (!data.words.length && !data.answers.length) throw new Error("a ajuda não saiu no formato esperado");
    conv.hint = {turn: last, step: data.words.length ? 1 : 2, ...data};
    convSetBusy(false, "");
    convHintRender();
  } catch (e) { convSetBusy(false, ""); setStatus("Não consegui: " + cleanIpcError(e, "erro"), "error"); }
}
function convHintRender() {
  const hint = conv.hint, speak = text => h("button", {class: "icon-btn quiet", type: "button", title: "Ouvir", "aria-label": "Ouvir", onclick: () => convSpeak(text)}, icon("volume", 16));
  const steps = [
    hint.words.length ? h("div", {class: "hint-words"}, ...hint.words.map(w => h("button", {class: "hint-word", type: "button", title: "Ouvir", onclick: () => convSpeak(w.de)},
      h("b", {lang: "de", text: w.de}), w.pt ? h("span", {text: w.pt}) : null))) : h("p", {class: "muted small-text", text: "Sem palavras sugeridas desta vez."}),
    h("div", {class: "hint-lines"}, ...hint.answers.map(a => h("p", {class: "hint-start"}, h("span", {lang: "de", text: a.inicio}), speak(a.inicio.replace(/ …$/, ""))))),
    h("div", {class: "hint-lines"}, ...hint.answers.map(a => h("div", {class: "hint-full"},
      h("button", {class: "hint-hidden", type: "button", title: "Toque para ver", onclick: e => e.currentTarget.classList.add("shown")}, h("span", {lang: "de", text: a.frase})),
      speak(a.frase), a.pt ? h("p", {class: "muted small-text", text: a.pt}) : null)))];
  convHelpBox(
    h("div", {class: "hint-head"}, h("h3", {text: "Ajuda para responder"}),
      h("ol", {class: "hint-dots", "aria-label": "Degrau " + hint.step + " de " + steps.length}, ...steps.map((_, k) => h("li", {class: k < hint.step ? "on" : ""})))),
    ...steps.slice(0, hint.step).map((node, k) => h("section", {class: "hint-step" + (k === hint.step - 1 ? " current" : "")}, h("p", {class: "label", text: CONV_HINT_STEPS[k]}), node)),
    hint.step < steps.length
      ? h("div", {class: "row hint-more"}, h("button", {class: "small", type: "button", onclick: convHint}, "Mais ajuda"), h("span", {class: "muted small-text", text: "Tente falar antes de abrir o próximo degrau."}))
      : h("p", {class: "muted small-text hint-foot", text: "Toque na frase para ver. Depois, fale com as suas palavras: mudar a resposta vale mais do que copiar."}));
}
/* Pedido do resumo final da Conversa (também usado pelo teste com o Gemma real em _dev/.cache/resumo-conversa). */
function convSummaryPrompt(level) {
  return `You are a German teacher for Luiz, a Brazilian learner (level ${level}). Below is a spoken conversation (transcribed speech: ignore capitalization and punctuation). Evaluate ONLY Luiz's lines. ${CONV_ERROR_RULES} At most 5 errors and 3 style notes, only the most important; empty lists if there is nothing. Then: elogio = ONE sentence in Brazilian Portuguese naming one concrete thing he did well, quoting his German words (not a generic compliment); proximo = one useful, correct German sentence at his level that he can say next time about this topic, using the rules he got wrong today and different from every "certo", with its Portuguese translation (pt); frases = empty list. Answer as JSON.`;
}
async function convFinish() {
  if (conv.busy || conv.finished) return;
  if (conv.live && typeof liveEnd === "function") liveEnd();
  const mine = conv.turns.filter(t => t.who === "me");
  if (!mine.length) { convReset(); return; }
  if (conv.topic.patient && typeof fspFinish === "function") return fspFinish(mine);
  convSetBusy(true, "Preparando o resumo dos seus erros…");
  let j = null;
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: convSummaryPrompt(convLevel())},
      {role: "user", content: convTranscript()}], {kind: "summary", temperature: .2, maxTokens: 2400, schema: CONV_SUMMARY_NEXT_SCHEMA});
    j = parseLooseJson(r.text);
  } catch (e) { setStatus("Não consegui montar o resumo: " + cleanIpcError(e, "erro"), "error"); }
  conv.finished = true;
  $("convRoom").classList.add("finished");
  convSetBusy(false, "");
  const {errors, style, frases, elogio, proximo} = convFeedback(j);
  // O ponto: resultado do que estava sendo cobrado e o novo ponto (antes de guardar esta sessão, para contar só as anteriores).
  const focoLast = typeof focoSettle === "function" ? focoSettle() : null;
  const foco = typeof focoSet === "function" ? focoSet(errors, convData().sessions) || focoActive() : null;
  const words = mine.reduce((n, t) => n + t.de.split(/\s+/).filter(Boolean).length, 0), secs = Math.round((Date.now() - conv.startedAt) / 1000);
  const data = convData();
  data.sessions.push({at: Date.now(), topic: conv.topic.id, turns: mine.length, words, secs, errors, ...(typeof missionSessionExtra === "function" ? missionSessionExtra() : {}),
    ...(conv.tutor && conv.tutor.moves ? {tutor: {moves: conv.tutor.moves, reparos: conv.tutor.reparos}} : {})});
  data.sessions = data.sessions.slice(-300);
  progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
  saveProgress();
  renderConvSummary({errors, style, frases, elogio, proximo, words, turns: mine.length, secs, ok: !!j, foco, focoLast});
  // Pessoas: a próxima conversa traz outra novidade dela, e ela pode lembrar do que você contou (se você confirmar).
  if (conv.topic.persona && typeof pessoaAfterSession === "function") { pessoaAfterSession(conv.topic.persona); saveProgress(); pessoaSummaryFacts(conv.topic.persona, $("convSummary")); }
}
function renderConvSummary({errors, style = [], frases: allFrases, elogio, proximo = null, words, turns, secs, ok, foco = null, focoLast = null}) {
  // Com o próximo passo, as “frases para praticar” só repetiriam o que já está na tela.
  const frases = proximo ? [] : allFrases;
  const tutorText = () => ["Conversa: " + conv.topic.pt + " (" + new Date().toLocaleDateString("pt-BR") + ")", "",
    ...conv.turns.map(t => (t.who === "me" ? "Eu: " : convName() + ": ") + t.de), "", "Erros apontados pelo app:",
    ...(errors.length ? errors.map(e => "- " + e.errado + " → " + e.certo + (e.regra ? " · " + e.regra : "") + " (" + e.explicacao + ")" + (e.tipo === "microfone" ? " [talvez a transcrição]" : "")) : ["- nenhum"]),
    ...(style.length ? ["", "Sugestões de estilo (o app acha que está certo, mas soaria mais natural assim):", ...style.map(s => "- " + s.disse + " → " + s.natural + " (" + s.explicacao + ")")] : [])].join("\n");
  fill($("convSummary"),
    h("h3", {text: "Resumo da conversa"}),
    h("p", {class: "muted", text: turns + (turns === 1 ? " fala sua" : " falas suas") + " · " + words + " palavras · " + formatDuration(secs)
      + (conv.tutor && conv.tutor.reparos ? " · você se corrigiu " + plural(conv.tutor.reparos, "vez", "vezes") : "")}),
    typeof missionSummaryNode === "function" ? missionSummaryNode() : null,
    typeof focoResultNode === "function" ? focoResultNode(focoLast) : null,
    elogio ? h("p", {class: "foco-good"}, h("span", {class: "ce-k", text: "Ficou bom"}), elogio) : null,
    !ok ? h("p", {class: "notice warn", text: "O resumo não saiu no formato esperado. A conversa foi registrada mesmo assim."}) : null,
    // Um ponto só (o que se repete pesa mais), treino de 1 minuto e cobrança na próxima conversa (conversa-foco.js).
    foco && typeof focoCardNode === "function" ? focoCardNode(foco)
      : ok && !errors.some(e => e.tipo !== "microfone") ? h("p", {class: "foco-none", text: "Nenhum erro importante nesta conversa."}) : null,
    typeof focoOthersNode === "function" ? focoOthersNode(errors, foco) : null,
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
  convInterrupt();
  if (conv.clip) { conv.clip.stop(); conv.clip = null; }
  stopAudio();
  conv.topic = null; conv.turns = []; conv.messages = []; conv.busy = false; conv.finished = false;
  if (typeof missionReset === "function") missionReset(null);
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
  else if (e.key === "Escape" && conv.clip) { e.preventDefault(); convInterrupt(); conv.handsFreePaused = true; conv.clip.stop(); }
  else if (e.key === "Escape" && convInterrupt()) e.preventDefault();
}

// ---------- Configurações ----------
async function renderConvSettings() {
  if (!$("convVoice")) return;
  $("convVoice").value = ["charon", "aoede", "system", "thorsten", "kerstin"].includes(settings.convVoice) ? settings.convVoice : "charon";
  $("convKeepRec").checked = !!settings.convKeepRec;
  $("convRecFolder").hidden = !(window.satzDesktop && window.satzDesktop.convRecFolder);
  const box = $("convKeyBox"), info = $("convModelInfo");
  if (!convAvailable()) { box.hidden = true; info.textContent = "A conversa só funciona no aplicativo do Windows."; return; }
  let s = null;
  try { s = await window.satzDesktop.convStatus(); } catch (e) { /* sem status */ }
  if (!s) return;
  info.textContent = s.installed ? "Modelo de conversa: " + s.model + " (roda na placa de vídeo, offline; desliga sozinho após 10 min sem uso)." : "Modelo de conversa não instalado (pasta resources\\llm).";
  const used = Math.round(s.tts.used / 1000), limit = Math.round(s.tts.limit / 1000);
  const keyText = s.tts.key === "app" ? "Chave do Google: configurada (guardada criptografada neste computador)." : s.tts.key === "dev" ? "Chave do Google: encontrada na pasta de desenvolvimento." : "Chave do Google: não configurada (a conversa usa a voz do computador).";
  const input = h("input", {type: "password", autocomplete: "off", spellcheck: "false", placeholder: "Cole aqui a chave da API", "aria-label": "Chave da API do Google"});
  fill(box, h("h3", {text: "Voz do Google (Chirp 3 HD)"}),
    h("p", {class: "small-text", text: keyText}),
    h("p", {class: "muted small-text", text: "Usado este mês: " + used + " mil de " + limit + " mil caracteres. A cota grátis do Google é de 1 milhão por mês; ao chegar em " + limit + " mil, o app passa sozinho para a voz do computador até o mês virar, para não haver cobrança. Falas repetidas vêm do cache e não gastam."}),
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
  $("convMore").addEventListener("click", e => { if (e.target.closest("button")) e.currentTarget.open = false; });
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
  $("convVoice").addEventListener("change", e => { settings.convVoice = e.target.value; saveSettings(); if (convLocal()) window.satzDesktop.ttsLocalWarm(convLocalVoice(null)).catch(() => {}); });
  $("convBargeIn").addEventListener("change", e => { settings.convBargeIn = e.target.checked; saveSettings(); });
  $("convKeepRec").addEventListener("change", e => { settings.convKeepRec = e.target.checked; saveSettings(); });
  $("convRecFolder").addEventListener("click", () => window.satzDesktop.convRecFolder());
  all("#convUmlauts [data-char]").forEach(b => b.addEventListener("click", () => {
    const t = $("convText"), i = t.selectionStart ?? t.value.length;
    t.value = t.value.slice(0, i) + b.dataset.char + t.value.slice(t.selectionEnd ?? i);
    t.focus(); t.selectionStart = t.selectionEnd = i + 1;
  }));
}
