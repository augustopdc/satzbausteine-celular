"use strict";
/* Escrita: tarefas curtas (formato da prova A1/A2, diário de 3 frases, resumo do capítulo do livro).
   Correção em dois tempos: 1º o app marca onde está cada erro e o tipo (sem a resposta) e você reescreve;
   2º aparecem a correção, a explicação, o que você acertou ao reescrever e a versão natural do texto.
   Quem corrige é o Gemma, no PC. Escrito no celular, o texto viaja pela sincronização e o PC corrige ao abrir.
   O que dá para conferir com certeza (palavras, saudação, du/Sie, conectores, pontos da tarefa) é feito por regra.
   Dados em progress.practice.escrita.texts[id] (mescla por updatedAt, com {deleted}). */
const ESCRITA_TIPOS = {genero: "gênero / artigo", caso: "caso", adjetivo: "terminação do adjetivo", conjugacao: "conjugação",
  posicao: "posição do verbo", separavel: "verbo separável", tempo: "tempo verbal", preposicao: "preposição", pronome: "pronome",
  palavra: "palavra errada", ortografia: "ortografia", maiuscula: "maiúscula", falta: "falta palavra", sobra: "palavra a mais", registro: "du / Sie"};
const ESCRITA_CONECTORES = ["und", "aber", "oder", "denn", "weil", "dass", "deshalb", "deswegen", "darum", "dann", "danach", "trotzdem", "obwohl",
  "wenn", "als", "zuerst", "später", "außerdem", "sondern", "damit", "also", "zum Schluss"];
const ESCRITA_FORMATOS = ["mensagem", "email", "formal", "forum", "diario", "resumo"];
const ESCRITA_KINDS = {prova: "Tarefa da prova", diario: "Diário", livro: "Resumo do livro"};
const ESCRITA_DRAFT_KEY = "satzbausteine.escrita.rascunho";
const escrita = {view: "home", id: null, spec: null, busy: new Set(), pumping: false, books: null, book: null, showPt: false};

// ---------- Dados ----------
function escritaData() {
  progress.practice = progress.practice || {scenes: {}, pron: {}};
  return progress.practice.escrita || (progress.practice.escrita = {texts: {}});
}
function escritaTexts() { return Object.values(escritaData().texts).filter(t => !t.deleted).sort((a, b) => b.at - a.at); }
const escritaStr = (v, n) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim().slice(0, n);
const escritaLine = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
function sanitizeEscritaText(t) {
  if (!t || typeof t !== "object" || !/^E-[a-z0-9]{4,24}$/.test(String(t.id || ""))) return null;
  const updatedAt = Number(t.updatedAt) || 0;
  if (!(updatedAt > 0)) return null;
  if (t.deleted) return {id: t.id, deleted: true, updatedAt};
  const s = t.spec && typeof t.spec === "object" ? t.spec : {};
  const range = Array.isArray(s.palavras) && s.palavras.length === 2 ? s.palavras.map(n => Math.max(0, Math.min(400, Math.round(Number(n) || 0)))) : [0, 0];
  const spec = {de: escritaLine(s.de, 400), pt: escritaLine(s.pt, 400), pontos: (Array.isArray(s.pontos) ? s.pontos : []).slice(0, 3).map(p => escritaLine(p, 200)).filter(Boolean),
    palavras: range, formato: ESCRITA_FORMATOS.includes(s.formato) ? s.formato : "diario", reg: ["du", "Sie"].includes(s.reg) ? s.reg : "", nivel: escritaLine(s.nivel, 4) || "A1",
    minFrases: Math.max(0, Math.min(10, Math.round(Number(s.minFrases) || 0)))};
  const out = {id: t.id, at: Number(t.at) || updatedAt, updatedAt, kind: ESCRITA_KINDS[t.kind] ? t.kind : "diario", ref: escritaLine(t.ref, 160), title: escritaLine(t.title, 160),
    spec, v1: escritaStr(t.v1, 4000), v2: escritaStr(t.v2, 4000), status: ["pendente", "corrigido", "revisto"].includes(t.status) ? t.status : "pendente"};
  if (t.resumoRef) out.resumoRef = escritaStr(t.resumoRef, 1500);
  if (Array.isArray(t.ajuda)) out.ajuda = t.ajuda.filter(a => ["frases", "palavra", "banco"].includes(a)).slice(0, 3);
  if (t.err) { out.err = escritaLine(t.err, 300); out.errAt = Number(t.errAt) || updatedAt; }
  const f = t.fb && typeof t.fb === "object" ? t.fb : null;
  if (f) {
    out.fb = {at: Number(f.at) || updatedAt, natural: escritaStr(f.natural, 4000), elogio: escritaLine(f.elogio, 300),
      erros: (Array.isArray(f.erros) ? f.erros : []).slice(0, 15).filter(e => e && e.trecho && e.certo).map(e => {
        const x = {trecho: escritaLine(e.trecho, 200), certo: escritaLine(e.certo, 200), tipo: ESCRITA_TIPOS[e.tipo] ? e.tipo : "palavra", explicacao: escritaLine(e.explicacao, 400)};
        if (["pedido", "feito"].includes(e.card)) x.card = e.card;
        return x;
      }),
      estilo: (Array.isArray(f.estilo) ? f.estilo : []).slice(0, 3).filter(e => e && e.natural).map(e => ({disse: escritaLine(e.disse, 300), natural: escritaLine(e.natural, 300), explicacao: escritaLine(e.explicacao, 400)})),
      pontos: (Array.isArray(f.pontos) ? f.pontos : []).slice(0, 3).map(p => escritaLine(p, 400))};
  } else if (out.status !== "pendente") out.status = "pendente";
  if (!out.v1) return null;
  return out;
}
function sanitizeEscrita(src) {
  const out = {texts: {}};
  if (!src || typeof src !== "object" || !src.texts || typeof src.texts !== "object") return out;
  for (const t of Object.values(src.texts)) { const x = sanitizeEscritaText(t); if (x) out.texts[x.id] = x; }
  return out;
}
function mergeEscrita(local, incoming) {
  const out = sanitizeEscrita(local);
  for (const [id, t] of Object.entries(sanitizeEscrita(incoming).texts)) if (!out.texts[id] || t.updatedAt > out.texts[id].updatedAt) out.texts[id] = t;
  return out;
}
function saveEscritaText(t) {
  t.updatedAt = Math.max(Date.now(), (t.updatedAt || 0) + 1);
  escritaData().texts[t.id] = t;
  saveProgress();
  if (typeof cloudSyncSoon === "function") cloudSyncSoon();
}
function newEscritaId() { return "E-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ---------- Tarefas ----------
function escritaNw() { const n = Number(settings.nwChapter); return Number.isFinite(n) ? n : 7; }
/* Tarefas da prova já liberadas pelo capítulo do Nicos Weg; a sugerida é a mais avançada ainda não feita. */
function escritaTasksFor(nw = escritaNw(), texts = escritaTexts()) {
  const done = new Set(texts.filter(t => t.kind === "prova").map(t => t.ref));
  const open = ESCRITA_TAREFAS.filter(t => t.nw <= nw);
  const todo = open.filter(t => !done.has(t.id));
  return {open, locked: ESCRITA_TAREFAS.length - open.length, done, suggested: (todo.length ? todo[todo.length - 1] : open[open.length - 1]) || ESCRITA_TAREFAS[0]};
}
function escritaTaskSpec(task) {
  return {de: task.de, pt: task.pt, pontos: task.pontos.map(p => p[0]), palavras: task.palavras.slice(), formato: task.formato, reg: task.reg, nivel: task.nivel};
}
/* Pergunta do diário de hoje: gira entre as liberadas pelo capítulo, uma por dia. */
function escritaDiaryPrompt(nw = escritaNw(), day = dateKey()) {
  const open = ESCRITA_DIARIO.filter(p => p[0] <= nw);
  const n = Math.floor(new Date(day + "T12:00:00").getTime() / DAY_MS);
  const p = open[n % open.length] || ESCRITA_DIARIO[0];
  return {de: p[1], pt: p[2]};
}
/* Tarefa do diário de hoje (também aberta pelo roteiro da tela Hoje). */
function escritaDiarySpec() {
  const diary = escritaDiaryPrompt();
  return {kind: "diario", ref: "diario|" + dateKey(), title: "Diário · " + formatDate(dateKey(), {day: "numeric", month: "short"}),
    de: diary.de, pt: "", ptText: diary.pt, pontos: [], pontosPt: [], palavras: [0, 0], formato: "diario", reg: "", nivel: escritaLevel(), minFrases: 3};
}
function escritaLevel() { return typeof convLevel === "function" ? convLevel() : "A1"; }

// ---------- Conferência por regra ----------
const escritaWords = text => (String(text).match(/\p{L}[\p{L}\p{N}'’-]*/gu) || []);
const escritaBare = s => String(s || "").replace(/[.,!?;:"“”„«»'’()…–—-]/g, " ").replace(/\s+/g, " ").trim();
const escritaLower = s => escritaBare(s).toLocaleLowerCase("de");
function escritaSentences(text) { return String(text).split(/(?<=[.!?…])\s+|\n+/).map(s => s.trim()).filter(s => escritaWords(s).length >= 2); }
/* Usos de du (informal) e de Sie/Ihnen/Ihr no meio da frase (formal; no começo da frase “Sie” pode ser “eles”/“ela”). */
function escritaRegister(text) {
  const informal = (String(text).match(/\b(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure)\b/giu) || []).length;
  let formal = 0;
  for (const m of String(text).matchAll(/\b(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b/gu)) {
    const before = String(text).slice(0, m.index).replace(/\s+$/, "");
    if (before && !/[.!?:\n„“"]$/.test(before)) formal++;
  }
  return {informal, formal};
}
/* Lista de conferências: {k, ok: true | false | null (neutro), label}. pontos = citações devolvidas pela IA (depois da correção). */
function escritaChecks(text, spec, pontos) {
  const out = [], words = escritaWords(text), n = words.length, [min, max] = spec.palavras || [0, 0];
  if (max) out.push({k: "palavras", ok: n >= min && n <= Math.round(max * 1.25), n, min, max, label: n + (n === 1 ? " palavra" : " palavras") + ", alvo " + min + " a " + max});
  else out.push({k: "palavras", ok: null, label: n + " palavras"});
  if (spec.minFrases) { const f = escritaSentences(text).length; out.push({k: "frases", ok: f >= spec.minFrases, label: f + (f === 1 ? " frase" : " frases") + " (pedido: " + spec.minFrases + " ou mais)"}); }
  const letter = ["mensagem", "email", "formal"].includes(spec.formato);
  if (letter) {
    const lines = String(text).split("\n").map(l => l.trim()).filter(Boolean), first = lines[0] || "", tail = lines.slice(-3).join(" ");
    const informalHi = /^(liebe[rs]?|hallo|hi|guten (tag|morgen|abend))\b/i.test(first), formalHi = /^(sehr geehrte[rs]?|guten tag|liebe[rs]? (frau|herr))\b/i.test(first);
    if (spec.reg === "Sie" && spec.formato === "formal") out.push({k: "saudacao", ok: formalHi, label: formalHi ? "Saudação formal ✓" : "Comece com uma saudação formal (Sehr geehrte Frau …, / Sehr geehrte Damen und Herren,)"});
    else out.push({k: "saudacao", ok: informalHi || formalHi, label: informalHi || formalHi ? "Saudação ✓" : spec.reg === "Sie" ? "Comece com uma saudação (Liebe Frau …, / Guten Tag Herr …,)" : "Comece com uma saudação (Liebe …, / Hallo …,)"});
    const bye = spec.reg === "Sie" ? /(mit freundlichen grüßen|freundliche grüße|viele grüße|beste grüße|herzliche grüße)/i : /(viele grüße|liebe grüße|herzliche grüße|bis bald|bis dann|bis morgen|tschüss|lg\b|dein |deine )/i;
    const okBye = bye.test(tail);
    out.push({k: "despedida", ok: okBye, label: okBye ? "Despedida ✓" : spec.reg === "Sie" ? "Termine com uma despedida (Mit freundlichen Grüßen / Viele Grüße) e seu nome" : "Termine com uma despedida (Viele Grüße / Bis bald) e seu nome"});
  }
  if (spec.reg && n < 3) out.push({k: "registro", ok: null, label: spec.reg === "du" ? "Tratamento com du (dir, dich, dein)" : "Tratamento com Sie (Ihnen, Ihr)"});
  else if (spec.reg) {
    const r = escritaRegister(text);
    if (spec.reg === "du") out.push({k: "registro", ok: r.formal === 0, label: r.formal ? "Você escreveu Sie/Ihnen, mas a tarefa é com du (dir, dich, dein)" : "Tratamento com du ✓"});
    else out.push({k: "registro", ok: r.informal === 0, label: r.informal ? "Você usou du/dir/dein, mas a tarefa é com Sie (Ihnen, Ihr)" : "Tratamento com Sie ✓"});
  }
  const low = " " + escritaLower(text) + " ", used = ESCRITA_CONECTORES.filter(c => low.includes(" " + c.toLocaleLowerCase("de") + " "));
  const need = /^A1/.test(spec.nivel || "") ? 1 : 2;
  out.push({k: "conectores", ok: used.length >= need, label: used.length ? "Conectores: " + used.join(", ") + (used.length < need ? " · use mais um (weil, deshalb, dann…)" : "") : "Nenhum conector: ligue as frases com und, aber, dann" + (need > 1 ? ", weil, deshalb…" : "…")});
  if (pontos && spec.pontos && spec.pontos.length) spec.pontos.forEach((p, i) => {
    const q = pontos[i] || "", ok = !!q && escritaWords(q).length >= 2 && escritaLower(text).includes(escritaLower(q));
    out.push({k: "ponto" + (i + 1), ok, label: "Ponto " + (i + 1) + " (" + p + "): " + (ok ? "respondido" : "não encontrei no texto")});
  });
  return out;
}

// ---------- Correção pela IA ----------
const ESCRITA_SCHEMA = {type: "object", properties: {
  erros: {type: "array", maxItems: 15, items: {type: "object", properties: {trecho: {type: "string"}, certo: {type: "string"}, tipo: {type: "string", enum: Object.keys(ESCRITA_TIPOS)}, explicacao: {type: "string"}}, required: ["trecho", "certo", "tipo", "explicacao"]}},
  estilo: {type: "array", maxItems: 3, items: {type: "object", properties: {disse: {type: "string"}, natural: {type: "string"}, explicacao: {type: "string"}}, required: ["disse", "natural", "explicacao"]}},
  natural: {type: "string"}, pontos: {type: "array", maxItems: 3, items: {type: "string"}}, elogio: {type: "string"}},
  required: ["erros", "estilo", "natural", "pontos", "elogio"]};
function escritaPrompt(t) {
  const s = t.spec, level = s.nivel || escritaLevel();
  const task = t.kind === "livro" ? "Task: a short summary, in his own words, of " + (t.title || "a chapter of a book he is reading") + "."
    : t.kind === "diario" ? "Task: a short diary entry (3 sentences or more) answering: " + s.de
      : "Task: " + s.de + (s.pontos.length ? "\nContent points he had to cover:\n" + s.pontos.map((p, i) => (i + 1) + ". " + p).join("\n") : "")
        + (s.reg ? "\nRegister: " + (s.reg === "du" ? "informal (du)" : "formal (Sie)") + "." : "") + (s.palavras[1] ? "\nExpected length: " + s.palavras[0] + "–" + s.palavras[1] + " words." : "");
  return `You are a careful and encouraging German teacher. Luiz, a Brazilian doctor learning German (level ${level}), wrote the text he will send you.
${task}
Correct it and answer as JSON:
- "erros": only real mistakes of written German, i.e. a broken rule: gender/article, case, adjective ending, verb conjugation, tense or sein/haben in the Perfekt, verb position (verb in 2nd position, verb at the end of a subordinate clause), separable prefix, wrong preposition, pronoun, wrong or non-existent word, spelling (including ä, ö, ü, ß), capitalization (nouns and the first word of each sentence are capitalized), a missing or an extra word${s.reg ? ", du/Sie mixed up" : ""}. Do not mark missing commas. For each mistake: "trecho" = the wrong words copied EXACTLY from his text, as short as possible (1 to 5 words) but enough to find the place; "certo" = the corrected version of exactly those words; "tipo" = one of ${Object.keys(ESCRITA_TIPOS).join(", ")}; "explicacao" = one short sentence in Brazilian Portuguese explaining the rule. One entry per mistake. Never list words that are already correct.
- "estilo": up to 3 places that are correct but a native speaker would write differently ("disse", "natural", "explicacao" in Brazilian Portuguese). When in doubt, it is style, not a mistake. Never repeat a mistake here.
- "natural": his whole text rewritten as a native speaker would write it, close to his level, keeping his ideas and about the same length. Do not add new information.
- "pontos": ${s.pontos.length ? "for each content point, in order, copy EXACTLY the sentence of his text that covers it, or \"\" if he did not cover it" : "an empty list"}.
- "elogio": one short sentence in Brazilian Portuguese about something he did well.`;
}
/* Lê o JSON da correção: descarta “erros” iguais ao certo ou que só mudam a pontuação (vírgula não conta), mantém maiúsculas. */
function escritaFeedback(j, text) {
  const errs = [], seen = new Set();
  for (const e of Array.isArray(j && j.erros) ? j.erros : []) {
    if (!e || !e.trecho || !e.certo) continue;
    const trecho = convClean(e.trecho), certo = convClean(e.certo);
    if (!trecho || escritaBare(trecho) === escritaBare(certo)) continue;
    const key = trecho.toLocaleLowerCase("de");
    if (seen.has(key)) continue;
    seen.add(key);
    errs.push({trecho, certo, tipo: ESCRITA_TIPOS[e.tipo] ? e.tipo : "palavra", explicacao: convClean(e.explicacao)});
  }
  const estilo = (Array.isArray(j && j.estilo) ? j.estilo : []).filter(s => s && s.natural && escritaBare(s.disse) !== escritaBare(s.natural) && !seen.has(convClean(s.disse).toLocaleLowerCase("de"))
    // Só sugestões sobre um trecho que existe no texto (a IA às vezes põe aqui um comentário em português).
    && escritaWords(s.disse).length && escritaLower(text).includes(escritaLower(s.disse)))
    .slice(0, 3).map(s => ({disse: convClean(s.disse), natural: convClean(s.natural), explicacao: convClean(s.explicacao)}));
  return {at: Date.now(), erros: errs.slice(0, 15), estilo, natural: convClean(j && j.natural), elogio: convClean(j && j.elogio),
    pontos: (Array.isArray(j && j.pontos) ? j.pontos : []).slice(0, 3).map(p => convClean(p))};
}
/* Onde está cada erro no texto: [início, fim] ou null; sem sobreposição (o primeiro achado vence). */
function escritaFind(text, trecho, from = 0) {
  let i = text.indexOf(trecho, from);
  if (i >= 0) return [i, i + trecho.length];
  i = text.toLocaleLowerCase("de").indexOf(trecho.toLocaleLowerCase("de"), from);
  if (i >= 0) return [i, i + trecho.length];
  const words = trecho.split(/\s+/).filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return null;
  const m = new RegExp(words.join("\\s+"), "iu").exec(text.slice(from));
  return m ? [from + m.index, from + m.index + m[0].length] : null;
}
function escritaSpans(text, erros) {
  const taken = [];
  return erros.map(e => {
    let pos = escritaFind(text, e.trecho), guard = 0;
    while (pos && taken.some(([a, b]) => pos[0] < b && pos[1] > a) && guard++ < 5) pos = escritaFind(text, e.trecho, pos[1]);
    if (pos && taken.some(([a, b]) => pos[0] < b && pos[1] > a)) pos = null;
    if (pos) taken.push(pos);
    return pos;
  });
}
/* Depois de reescrever: corrigiu (o certo aparece), mudou (o errado sumiu, mas não do jeito sugerido) ou ficou igual. */
function escritaFixState(err, v2) {
  if (!v2) return null;
  const norm = s => escritaBare(s).replace(/\s+/g, " ");
  const text = norm(v2), certo = norm(err.certo), errado = norm(err.trecho);
  if (certo && text.includes(certo)) return "ok";
  if (errado && text.includes(errado)) return "igual";
  return "mudou";
}
function escritaRate(t) {
  const n = escritaWords(t.v1).length;
  return t.fb && n ? Math.round(t.fb.erros.length * 1000 / n) / 10 : null;
}
/* Frase do texto que contém o trecho (para o cartão sair com a frase inteira). */
function escritaSentenceWith(text, trecho) {
  return escritaSentences(text).find(s => escritaLower(s).includes(escritaLower(trecho))) || trecho;
}

// ---------- Fila no PC: corrige o que chegou do celular e cria os cartões pedidos lá ----------
function escritaCanCorrect() { return typeof convAvailable === "function" && convAvailable(); }
async function escritaCorrect(id) {
  const t = escritaData().texts[id];
  if (!t || t.deleted || t.status !== "pendente" || escrita.busy.has(id)) return;
  escrita.busy.add(id);
  escritaRefresh();
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: escritaPrompt(t)}, {role: "user", content: t.v1}],
      {kind: "escrita", temperature: .2, maxTokens: 2400, schema: ESCRITA_SCHEMA});
    const j = parseLooseJson(r.text);
    if (!j || !Array.isArray(j.erros)) throw new Error("A resposta da IA veio incompleta.");
    const fresh = escritaData().texts[id];
    if (!fresh || fresh.deleted || fresh.status !== "pendente") return;
    fresh.fb = escritaFeedback(j, fresh.v1);
    fresh.status = "corrigido";
    delete fresh.err; delete fresh.errAt;
    saveEscritaText(fresh);
    if (!(currentView === "escrita" && escrita.view === "texto" && escrita.id === id)) toast("Texto corrigido: “" + (fresh.title || "texto") + "”. Veja em Escrita.", "success");
  } catch (e) {
    const fresh = escritaData().texts[id];
    if (fresh && !fresh.deleted) { fresh.err = cleanIpcError(e, "A correção falhou."); fresh.errAt = Date.now(); saveEscritaText(fresh); }
  } finally {
    escrita.busy.delete(id);
    escritaRefresh();
  }
}
async function escritaMakeCard(id, i) {
  const t = escritaData().texts[id], e = t && t.fb && t.fb.erros[i];
  if (!e || e.card === "feito") return;
  const cardId = await mineFromConversa({erro: {errado: e.trecho, certo: e.certo, explicacao: e.explicacao, frase: escritaSentenceWith(t.v1, e.trecho)}, fonte: "escrita"});
  const fresh = escritaData().texts[id];
  if (fresh && fresh.fb && fresh.fb.erros[i]) { fresh.fb.erros[i].card = "feito"; saveEscritaText(fresh); }
  return cardId;
}
/* Corrige os textos pendentes (do mais antigo) e cria os cartões pedidos no celular, um de cada vez. */
async function escritaPump() {
  if (!escritaCanCorrect() || escrita.pumping) return;
  escrita.pumping = true;
  try {
    for (let guard = 0; guard < 50; guard++) {
      const all = escritaTexts().reverse();
      const next = all.find(t => t.status === "pendente" && !escrita.busy.has(t.id) && !(t.err && Date.now() - (t.errAt || 0) < 10 * 60000));
      if (next) { await escritaCorrect(next.id); continue; }
      const ask = all.map(t => [t, (t.fb ? t.fb.erros : []).findIndex(e => e.card === "pedido")]).find(([, i]) => i >= 0);
      if (!ask) break;
      try { await escritaMakeCard(ask[0].id, ask[1]); }
      catch (e) { setStatus("Não consegui criar um cartão pedido no celular: " + cleanIpcError(e, "erro"), "error"); break; }
    }
  } finally { escrita.pumping = false; }
}
/* Chamado depois de mesclar a sincronização: atualiza a tela e, no PC, corrige o que chegou. */
function escritaAfterMerge() {
  escritaRefresh();
  if (escritaCanCorrect()) setTimeout(escritaPump, 2000);
}
function escritaRefresh() { if (currentView === "escrita") renderEscrita(); }

// ---------- Tela ----------
function renderEscrita() {
  const box = $("escritaRoot");
  if (!box) return;
  // Escrevendo ou lendo a correção, o cabeçalho da página sai do caminho.
  const sec = $("view-escrita"), open = escrita.view !== "home";
  if (sec) sec.classList.toggle("es-open", open);
  if (escrita.view === "texto" && escrita.id && escritaData().texts[escrita.id] && !escritaData().texts[escrita.id].deleted) return escritaTextView(box);
  if (escrita.view === "editor" && escrita.spec) return escritaEditor(box);
  escrita.view = "home";
  escritaHome(box);
  if (escritaCanCorrect() && escritaTexts().some(t => t.status === "pendente")) escritaPump();
}
function escritaOpen(view, extra = {}) { Object.assign(escrita, {view}, extra); renderEscrita(); window.scrollTo({top: 0}); }
function escritaStatusTag(t) {
  if (t.status === "pendente") return escrita.busy.has(t.id) ? ["Corrigindo…", "es-st-wait"] : t.err ? ["A correção falhou", "es-st-err"] : [escritaCanCorrect() ? "Na fila de correção" : "Aguardando o PC corrigir", "es-st-wait"];
  if (t.status === "corrigido") return ["Corrigido: tente consertar", "es-st-new"];
  return ["Revisto ✓", "es-st-done"];
}
function escritaStats(texts = escritaTexts()) {
  const withFb = texts.filter(t => t.fb && escritaWords(t.v1).length);
  const last = withFb.slice(0, 5), rate = last.length ? Math.round(last.reduce((s, t) => s + escritaRate(t), 0) / last.length * 10) / 10 : null;
  const tipos = {};
  for (const t of withFb.slice(0, 10)) for (const e of t.fb.erros) tipos[e.tipo] = (tipos[e.tipo] || 0) + 1;
  return {rate, count: last.length, tipos: Object.entries(tipos).sort((a, b) => b[1] - a[1]).slice(0, 4)};
}
/* Tela inicial: o diário é o cartão principal (pergunta grande e o campo ali mesmo); tarefa da prova e resumo ficam
   menores; “Seus textos” mostra o começo de cada texto, como um diário de verdade; a evolução aparece a partir de 5 textos. */
const ESCRITA_MIN_STATS = 5;
function escritaHome(box) {
  const tasks = escritaTasksFor(), texts = escritaTexts(), stats = escritaStats(texts), diary = escritaDiarySpec();
  const today = texts.find(t => t.ref === diary.ref);
  const select = h("select", {id: "esTask", "aria-label": "Tarefa"});
  for (const lvl of ["A1", "A2"]) {
    const group = tasks.open.filter(t => t.nivel === lvl);
    if (!group.length) continue;
    const og = h("optgroup", {label: lvl});
    group.forEach(t => og.append(h("option", {value: t.id}, (tasks.done.has(t.id) ? "✓ " : "") + t.tema + (t.reg === "Sie" ? " (Sie)" : ""))));
    select.append(og);
  }
  select.value = tasks.suggested.id;
  const startTask = () => {
    const task = ESCRITA_TAREFAS.find(t => t.id === select.value) || tasks.suggested;
    escritaOpen("editor", {spec: {kind: "prova", ref: task.id, title: task.tema, ...escritaTaskSpec(task), ptText: task.pt, pontosPt: task.pontos.map(p => p[1])}});
  };
  fill(box,
    escritaDiaryHero(diary, today),
    h("div", {class: "es-grid"},
      h("section", {class: "panel es-card"},
        h("p", {class: "label ico-inline", lang: "pt-BR"}, icon("pen", 16), "Tarefa da prova"),
        h("p", {class: "es-card-title", text: tasks.suggested.tema}),
        h("p", {class: "muted small-text", text: "Mensagem com 3 pontos, no formato da prova Goethe."}),
        h("div", {class: "row"}, h("button", {class: "small primary", type: "button", onclick: startTask}, "Começar"),
          h("details", {class: "es-more"}, h("summary", {text: "Outra tarefa"}), select,
            tasks.locked ? h("p", {class: "muted small-text", text: "Mais " + tasks.locked + " aparecem conforme você avança no Nicos Weg."}) : null))),
      escritaBookCard()),
    escritaEvolution(stats),
    h("section", {class: "es-diary-list"},
      h("h2", {text: "Seus textos"}),
      texts.length ? h("ol", {class: "es-timeline"}, ...texts.slice(0, 30).map(escritaTimelineItem))
        : h("p", {class: "muted", text: "Nenhum texto ainda. Comece pelo diário de hoje: são só três frases."}),
      !escritaCanCorrect() ? h("p", {class: "muted small-text", text: "No celular você escreve e salva; o PC corrige quando o app abrir lá e a correção volta para cá."}) : null));
}
function escritaDiaryHero(spec, today) {
  const head = [h("p", {class: "label", text: "Diário de hoje"}), h("p", {class: "es-hero-q", lang: "de", text: spec.de}), h("p", {class: "muted small-text", text: spec.ptText})];
  if (today) return h("section", {class: "panel es-hero done"}, ...head,
    h("div", {class: "row"}, h("span", {class: "es-hero-ok ico-inline"}, icon("check", 16), "Diário de hoje escrito."), h("button", {class: "small", type: "button", onclick: () => escritaOpen("texto", {id: today.id})}, "Ver o texto")));
  const input = h("textarea", {id: "esDiary", class: "es-input es-page es-hero-input", lang: "de", rows: "4", spellcheck: "false", autocomplete: "off", autocapitalize: "sentences", placeholder: "Heute …"});
  input.setAttribute("autocorrect", "off");
  input.value = escritaDrafts()[spec.ref] || "";
  const count = h("span", {class: "muted small-text"});
  const update = () => {
    const n = escritaSentences(input.value).length;
    count.textContent = n + " de 3 frases";
    count.classList.toggle("ok", n >= 3);
    const d = escritaDrafts();
    if (input.value.trim()) d[spec.ref] = input.value; else delete d[spec.ref];
    safeWrite(ESCRITA_DRAFT_KEY, d);
  };
  input.addEventListener("input", update);
  update();
  return h("section", {class: "panel es-hero"}, ...head, h("div", {class: "es-sheet"}, input, escritaKeys(input)),
    h("div", {class: "row es-hero-foot"}, count,
      h("button", {class: "primary", type: "button", onclick: () => { escrita.spec = spec; escritaSubmit(input.value); }}, escritaCanCorrect() ? "Enviar para correção" : "Salvar · o PC corrige")));
}
/* Um texto na linha do tempo: o começo dele em destaque; data, tipo e situação pequenos. */
function escritaTimelineItem(t) {
  const [label, cls] = escritaStatusTag(t), first = escritaSentences(t.v1)[0] || t.v1;
  return h("li", null, h("button", {class: "es-tl-item", type: "button", onclick: () => escritaOpen("texto", {id: t.id})},
    h("span", {class: "es-tl-date", text: formatDate(dateKey(new Date(t.at)), {day: "numeric", month: "short"})}),
    h("span", {class: "es-tl-body"},
      h("span", {class: "es-tl-text", lang: "de", text: first.length > 140 ? first.slice(0, 137) + "…" : first}),
      h("span", {class: "es-tl-meta"}, h("span", {text: t.kind === "livro" ? t.title || ESCRITA_KINDS.livro : t.kind === "prova" ? t.title || ESCRITA_KINDS.prova : ESCRITA_KINDS.diario}),
        h("span", {class: "tag " + cls, text: label})))));
}
/* Evolução: só com 5 textos corrigidos (com menos, uma média é só um ponto se achando importante). */
function escritaEvolution(stats) {
  const all = escritaTexts().filter(t => t.fb && escritaWords(t.v1).length).length;
  if (!all) return null;
  if (all < ESCRITA_MIN_STATS) return h("p", {class: "muted small-text es-evo-wait", text: "Depois de " + ESCRITA_MIN_STATS + " textos corrigidos, aparece aqui a sua evolução e o tipo de erro para focar (faltam " + (ESCRITA_MIN_STATS - all) + ")."});
  const top = stats.tipos[0], verb = top && ["posicao", "separavel"].includes(top[0]);
  return h("section", {class: "panel es-stats"},
    h("p", {class: "label", text: "Sua evolução"}),
    h("p", null, h("b", {text: Math.max(0, Math.round(100 - stats.rate)) + "%"}), " das palavras sem erro", h("span", {class: "muted", text: " (últimos " + stats.count + " textos)"})),
    stats.tipos.length ? h("p", {class: "muted small-text", text: "Erros mais comuns: " + stats.tipos.map(([k, n]) => ESCRITA_TIPOS[k] + " (" + n + ")").join(", ")}) : null,
    top ? h("div", {class: "es-focus"}, h("p", null, "Foco da semana: ", h("b", {text: ESCRITA_TIPOS[top[0]]})),
      verb ? h("p", {class: "muted small-text", text: "Na Leitura, a ponte do verbo mostra onde o verbo vai em cada frase escolhida."}) : null,
      h("button", {class: "small", type: "button", onclick: () => showView("grammar")}, "Treinar na Gramática")) : null);
}
/* Resumo do capítulo: já sugere o último capítulo lido; os seletores ficam em “Outro capítulo”. */
function escritaBookCard() {
  const card = h("section", {class: "panel es-card"}, h("p", {class: "label ico-inline", lang: "pt-BR"}, icon("bookOpen", 16), "Resumo do capítulo"));
  if (!escrita.books) {
    card.append(h("p", {class: "muted small-text", text: "Procurando livros…"}));
    escritaLoadBooks().then(() => { if (currentView === "escrita" && escrita.view === "home") renderEscrita(); });
    return card;
  }
  if (!escrita.books.length) { card.append(h("p", {class: "muted small-text", text: "Nenhum livro com resumos ainda. Importe e anote um livro na Leitura" + (escritaCanCorrect() ? "." : " (no PC) e baixe-o aqui na aba Leitura.")})); return card; }
  const first = escrita.books[0], pos = (readingState().pos || {})[first.id];
  const loaded = escrita.book && escrita.book.id === first.id ? escrita.book : null;
  if (!loaded) escritaGetBook(first.id).then(() => { if (currentView === "escrita" && escrita.view === "home") renderEscrita(); });
  const ch = loaded && pos && loaded.notes && loaded.notes.c && loaded.notes.c[pos.ch] ? pos.ch : null;
  if (ch != null) card.append(h("p", {class: "es-card-title", lang: "de", text: loaded.chapters[ch].title}),
    h("p", {class: "muted small-text", text: "Você parou aqui em " + first.title + ". Resuma em 3 a 5 frases."}));
  else card.append(h("p", {class: "muted small-text", text: loaded ? "Escolha um capítulo que você já leu." : "Carregando o livro…"}));
  const bookSel = h("select", {"aria-label": "Livro"}, ...escrita.books.map(b => h("option", {value: b.id}, b.title)));
  const chSel = h("select", {"aria-label": "Capítulo"});
  const fillCh = async () => {
    const b = await escritaGetBook(bookSel.value);
    fill(chSel, ...(b ? b.chapters.map((c, i) => [c, i]).filter(([, i]) => b.notes && b.notes.c && b.notes.c[i]).map(([c, i]) => h("option", {value: String(i)}, c.title)) : []));
    const p = (readingState().pos || {})[bookSel.value];
    if (p && [...chSel.options].some(o => o.value === String(p.ch))) chSel.value = String(p.ch);
  };
  bookSel.addEventListener("change", fillCh);
  const more = h("details", {class: "es-more"}, h("summary", {text: "Outro capítulo"}), bookSel, chSel,
    h("button", {class: "small", type: "button", onclick: async () => { const b = await escritaGetBook(bookSel.value); escritaStartSummary(b, Number(chSel.value)); }}, "Resumir este"));
  more.addEventListener("toggle", () => { if (more.open && !chSel.options.length) fillCh(); });
  card.append(h("div", {class: "row"}, ch != null ? h("button", {class: "small primary", type: "button", onclick: () => escritaStartSummary(loaded, ch)}, "Resumir agora") : null, more));
  return card;
}
function escritaStartSummary(b, ch) {
  if (!b || !Number.isFinite(ch) || !b.notes || !b.notes.c || !b.notes.c[ch]) { setStatus("Escolha um capítulo com resumo.", "info"); return; }
  const words = /^A1/.test(escritaLevel()) ? [20, 60] : [30, 80];
  escritaOpen("editor", {spec: {kind: "livro", ref: "livro|" + b.id + "|" + ch, title: b.title + ", " + b.chapters[ch].title, de: "", pt: "", banco: escritaBookBank(b, ch),
    ptText: "Resuma o capítulo em 3 a 5 frases, com as suas palavras. Não copie frases do livro.", pontos: [], pontosPt: [], palavras: words, formato: "resumo", reg: "", nivel: escritaLevel(), resumoRef: b.notes.c[ch]}});
}
/* 8 a 10 palavras-chave do capítulo (substantivos, verbos e adjetivos que aparecem pela 1ª vez nele). */
function escritaBookBank(b, ch) {
  if (!b || typeof chapterGlossary !== "function") return [];
  const order = [];
  b.chapters.forEach((c, ci) => c.blocks.forEach(bl => (bl.s || []).forEach(([id, text]) => order.push({id, text, ch: ci}))));
  return chapterGlossary(order, b.notes && b.notes.w, ch, 60).filter(w => ["substantivo", "verbo", "adjetivo"].includes(w.classe)).slice(0, 10).map(w => ({de: w.lema || w.w, pt: w.pt || ""}));
}

// ---------- Editor: teclas e ajudas ----------
const ESCRITA_TECLAS = ["und", "aber", "dann", "danach", "weil", "deshalb"];
/* ä ö ü ß e os conectores mais usados, tocáveis (o cursor fica onde estava). */
function escritaKeys(input) {
  const put = text => {
    const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? s;
    input.setRangeText(text, s, e, "end");
    input.dispatchEvent(new Event("input"));
    input.focus();
  };
  const key = (label, text, cls) => { const b = h("button", {class: "es-key" + (cls ? " " + cls : ""), type: "button", text: label}); b.addEventListener("mousedown", e => e.preventDefault()); b.addEventListener("click", () => put(text)); return b; };
  return h("div", {class: "es-keys", role: "group", "aria-label": "Teclas"},
    ...["ä", "ö", "ü", "ß"].map(c => key(c, c)), h("span", {class: "es-keys-sep", "aria-hidden": "true"}),
    ...ESCRITA_TECLAS.map(w => key(w, w + " ", "word")));
}
/* Ajudas escondidas por padrão (e registradas no texto quando usadas): frases úteis, palavras do capítulo e “[palavra]”. */
function escritaScaffolds(spec, input, helpBox) {
  const pc = escritaCanCorrect(), use = kind => { (spec.ajuda = spec.ajuda || new Set()).add(kind); };
  const frases = h("div", {class: "es-frases"});
  const fr = pc && spec.kind !== "livro" ? h("details", {class: "es-scaffold"}, h("summary", {text: "Frases úteis"}), frases) : null;
  if (fr) fr.addEventListener("toggle", () => { if (fr.open) { use("frases"); escritaUsefulPhrases(spec, frases); } });
  const bank = spec.banco && spec.banco.length ? h("details", {class: "es-scaffold"}, h("summary", {text: "Palavras do capítulo"}),
    h("div", {class: "es-bank"}, ...spec.banco.map(w => h("span", {class: "es-bank-word"}, h("b", {lang: "de", text: w.de}), w.pt ? h("small", {text: w.pt}) : null)))) : null;
  if (bank) bank.addEventListener("toggle", () => { if (bank.open) use("banco"); });
  return h("div", {class: "es-scaffolds"}, fr, bank,
    pc ? h("p", {class: "muted small-text es-tip-bracket", text: "Não sabe uma palavra? Escreva em português entre colchetes, como [garfo], e o app sugere em alemão."}) : null,
    helpBox);
}
async function escritaUsefulPhrases(spec, box) {
  escrita.frases = escrita.frases || {};
  if (escrita.frases[spec.ref]) { escritaPhrasesFill(box, escrita.frases[spec.ref]); return; }
  fill(box, h("p", {class: "muted small-text", text: "Pensando em frases para esta tarefa…"}));
  try {
    const task = (spec.de ? spec.de + " / " : "") + (spec.ptText || "") + (spec.pontos && spec.pontos.length ? " Pontos: " + spec.pontos.join("; ") : "");
    const r = await window.satzDesktop.convChat([{role: "system", content: "Luiz (German level " + escritaLevel() + ") must write a short German text for this task. Give 4 short, useful and correct German sentence beginnings or phrases at his level that help him start (not a finished text), each with its Brazilian Portuguese translation." + (spec.reg ? " He uses \"" + spec.reg + "\"." : "") + " Answer as JSON."},
      {role: "user", content: task}], {kind: "frases", temperature: .4, maxTokens: 400, schema: ESCRITA_FRASES_SCHEMA});
    const j = parseLooseJson(r.text), list = j && Array.isArray(j.frases) ? j.frases.filter(f => f && f.de).slice(0, 4).map(f => ({de: escritaLine(f.de, 160), pt: escritaLine(f.pt, 160)})) : [];
    escrita.frases[spec.ref] = list;
    escritaPhrasesFill(box, list);
  } catch (e) { fill(box, h("p", {class: "muted small-text", text: "Não consegui agora: " + cleanIpcError(e, "erro")})); }
}
const ESCRITA_FRASES_SCHEMA = {type: "object", properties: {frases: {type: "array", minItems: 2, maxItems: 4, items: {type: "object", properties: {de: {type: "string"}, pt: {type: "string"}}, required: ["de", "pt"]}}}, required: ["frases"]};
function escritaPhrasesFill(box, list) {
  fill(box, list.length ? list.map(f => h("p", {class: "es-frase"}, h("span", {lang: "de", text: f.de}), f.pt ? h("small", {text: f.pt}) : null))
    : h("p", {class: "muted small-text", text: "Sem sugestões desta vez."}),
    h("p", {class: "muted small-text", text: "Use como ponto de partida: escreva com as suas palavras."}));
}
/* “[garfo]” no texto: o app sugere a palavra em alemão (com artigo) e troca com um toque. */
function escritaWordHelp(input, spec, box) {
  if (!box) return;
  const found = [...new Set([...input.value.matchAll(/\[([^\[\]\n]{2,40})\]/g)].map(m => m[1].trim()))];
  escrita.words = escrita.words || {};
  if (!found.length) { fill(box); return; }
  if (!escritaCanCorrect()) { fill(box, h("p", {class: "muted small-text", text: "No PC, o app sugere a palavra em alemão para o que estiver entre colchetes."})); return; }
  (spec.ajuda = spec.ajuda || new Set()).add("palavra");
  fill(box, ...found.map(pt => {
    const de = escritaWordFor(pt, () => escritaWordHelp(input, spec, box));
    return h("div", {class: "es-word-help"}, h("span", {text: "[" + pt + "]"}), icon("chevron", 13),
      de ? h("b", {lang: "de", text: de}) : h("span", {class: "muted small-text", text: "procurando…"}),
      de ? h("button", {class: "small", type: "button", onclick: () => { input.value = input.value.split("[" + pt + "]").join(de); input.dispatchEvent(new Event("input")); input.focus(); }}, "Trocar") : null);
  }));
}
function escritaWordFor(pt, done) {
  const key = pt.toLocaleLowerCase("pt-BR"), cache = escrita.words;
  if (cache[key] && cache[key] !== "…") return cache[key];
  if (cache[key] === "…") return "";
  cache[key] = "…";
  window.satzDesktop.convChat([{role: "system", content: "Give the German word or short expression for this Brazilian Portuguese word, as a learner at level " + escritaLevel() + " would need it: nouns with their article (der/die/das), verbs in the infinitive. In \"nota\", a very short note in Brazilian Portuguese or empty. Answer as JSON."},
    {role: "user", content: pt}], {kind: "howto", temperature: .2, maxTokens: 120, schema: CONV_HOWTO_SCHEMA})
    .then(r => { const j = parseLooseJson(r.text); cache[key] = j && j.de ? escritaLine(j.de, 60) : ""; done(); })
    .catch(() => { delete cache[key]; });
  return "";
}

// ---------- Correção ----------
/* Cor da correção pelo grupo do erro: verbo (posição, tempo, conjugação, separável), caso e artigo, outros. */
function escritaTipoGroup(tipo) {
  if (["posicao", "separavel", "tempo", "conjugacao"].includes(tipo)) return "verbo";
  if (["caso", "genero", "adjetivo", "pronome", "preposicao"].includes(tipo)) return "caso";
  return "outro";
}
/* Quantas frases saíram sem nenhum erro marcado (o que você acertou também conta). */
function escritaCleanCount(t) {
  if (!t.fb) return null;
  // Frases de verdade (3+ palavras): “Hallo Anna,” e “Viele Grüße” não contam.
  const spans = escritaSpans(t.v1, t.fb.erros).filter(Boolean), sentences = escritaSentences(t.v1).filter(s => escritaWords(s).length >= 3);
  let from = 0, clean = 0;
  for (const s of sentences) {
    const a = t.v1.indexOf(s, from), b = a + s.length;
    from = a >= 0 ? b : from;
    if (a >= 0 && !spans.some(([x, y]) => x < b && y > a)) clean++;
  }
  return {clean, total: sentences.length};
}
function escritaCleanLine(t) {
  const c = escritaCleanCount(t);
  if (!c || !c.total) return null;
  return h("p", {class: "es-clean" + (c.clean ? " some" : "")}, h("b", {text: c.clean + " de " + c.total}), c.total === 1 ? " frase sem erro" : " frases sem erro");
}
async function escritaLoadBooks() {
  try {
    if (window.satzDesktop && window.satzDesktop.listBooks) escrita.books = (await window.satzDesktop.listBooks()).filter(b => b.notes && b.notes.s).map(b => ({id: b.id, title: b.title}));
    else escrita.books = Object.entries(typeof rdLocalList === "function" ? rdLocalList() : {}).map(([id, v]) => ({id, title: v.title}));
  } catch (e) { escrita.books = []; }
  const pos = readingState().pos || {};
  escrita.books.sort((a, b) => ((pos[b.id] || {}).at || 0) - ((pos[a.id] || {}).at || 0));
}
async function escritaGetBook(id) {
  if (escrita.book && escrita.book.id === id) return escrita.book;
  try { escrita.book = window.satzDesktop && window.satzDesktop.getBook ? await window.satzDesktop.getBook(id) : await rdWebGetBook(id); }
  catch (e) { escrita.book = null; }
  return escrita.book;
}
function escritaDrafts() { return safeRead(ESCRITA_DRAFT_KEY, {}) || {}; }
function escritaTaskBox(spec, editing = false) {
  return h("section", {class: "es-task" + (editing ? " editing" : " panel")},
    spec.de ? h("p", {class: "es-prompt", lang: "de", text: spec.de}) : null,
    spec.ptText ? h("p", {class: "muted small-text", text: spec.ptText}) : null,
    spec.pontos && spec.pontos.length && !editing ? h("ol", {class: "es-pontos"}, ...spec.pontos.map((p, i) => h("li", null, h("span", {lang: "de", text: p}),
      spec.pontosPt && spec.pontosPt[i] ? h("span", {class: "muted small-text", text: " — " + spec.pontosPt[i]}) : null))) : null,
    spec.palavras && spec.palavras[1] && !editing ? h("p", {class: "muted small-text", text: "Escreva " + spec.palavras[0] + " a " + spec.palavras[1] + " palavras" + (spec.reg ? " · tratamento: " + (spec.reg === "du" ? "du (informal)" : "Sie (formal)") : "") + "."}) : null);
}
function escritaCheckList(checks, live = false) {
  return h("ul", {class: "es-checks" + (live ? " live" : "")}, ...checks.map(c => {
    const state = c.ok === true ? "ok" : c.ok === false && !live ? "no" : "";
    const ico = h("span", {class: "es-check-ico", "aria-hidden": "true"}, c.ok === true ? icon("check", 12) : state === "no" ? "!" : null);
    let bar = null;
    if (c.k === "palavras" && c.max) {
      const top = c.max * 1.25, fillEl = h("i");
      bar = h("span", {class: "es-wbar"}, fillEl);
      setWidth(fillEl, c.n / top * 100);
      bar.style.setProperty("--a", (c.min / top * 100) + "%");
      bar.style.setProperty("--b", (c.max / top * 100) + "%");
    }
    const body = [ico, h("span", {class: "es-check-label", text: c.label.replace(/ ✓$/, "")}), bar];
    return h("li", {class: state + (c.manual ? " manual" : "")}, c.manual ? h("button", {class: "es-check-btn", type: "button", "aria-pressed": String(c.ok === true), onclick: c.manual}, ...body) : body);
  }));
}
function escritaEditor(box) {
  const spec = escrita.spec, drafts = escritaDrafts();
  const input = h("textarea", {id: "esInput", class: "es-input", lang: "de", rows: "9", spellcheck: "false", autocapitalize: "sentences", autocomplete: "off",
    placeholder: spec.formato === "diario" ? "Heute …" : ["mensagem", "email"].includes(spec.formato) ? (spec.reg === "Sie" ? "Liebe Frau …," : "Hallo …,") : spec.formato === "formal" ? "Sehr geehrte Damen und Herren," : spec.formato === "resumo" ? "In diesem Kapitel …" : "…"});
  input.setAttribute("autocorrect", "off");
  input.value = drafts[spec.ref] || "";
  const checks = h("div", {class: "es-live"}), helpBox = h("div", {class: "es-helps"});
  escrita.pontosOk = escrita.pontosOk && escrita.pontosOk.ref === spec.ref ? escrita.pontosOk : {ref: spec.ref, set: new Set()};
  const update = () => {
    // Os pontos da tarefa entram na lista: você marca quando respondeu (a IA confere depois da correção).
    const pontos = (spec.pontos || []).map((p, i) => ({k: "ponto" + (i + 1), ok: escrita.pontosOk.set.has(i) ? true : null, manual: () => { const s = escrita.pontosOk.set; s.has(i) ? s.delete(i) : s.add(i); update(); },
      label: p + (spec.pontosPt && spec.pontosPt[i] ? " (" + spec.pontosPt[i] + ")" : "")}));
    fill(checks, escritaCheckList([...pontos, ...escritaChecks(input.value, spec)], true));
    escritaWordHelp(input, spec, helpBox);
    const d = escritaDrafts();
    if (input.value.trim()) d[spec.ref] = input.value; else delete d[spec.ref];
    safeWrite(ESCRITA_DRAFT_KEY, d);
  };
  let timer = 0;
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 250); });
  update();
  input.classList.add("es-page");
  input.addEventListener("input", () => document.getElementById("view-escrita").classList.toggle("es-typing", !!input.value.trim()), {once: false});
  fill(box,
    h("div", {class: "row between es-head"}, h("button", {class: "quiet small", type: "button", onclick: () => escritaOpen("home")}, "← Escrita"), h("b", {text: spec.title})),
    escritaTaskBox(spec, true),
    h("div", {class: "es-sheet"}, input, escritaKeys(input)),
    escritaScaffolds(spec, input, helpBox),
    checks,
    h("div", {class: "row"},
      h("button", {id: "esSend", class: "primary", type: "button", onclick: () => escritaSubmit(input.value)}, escritaCanCorrect() ? "Enviar para correção" : "Salvar · o PC corrige")));
  update();
  input.focus();
}
function escritaSubmit(text) {
  const spec = escrita.spec, v1 = escritaStr(text, 4000);
  if (escritaWords(v1).length < 3) { setStatus("Escreva pelo menos uma frase.", "info"); return; }
  const id = newEscritaId(), now = Date.now();
  const t = {id, at: now, updatedAt: now, kind: spec.kind, ref: spec.ref, title: spec.title, v1, v2: "", status: "pendente",
    spec: {de: spec.de || "", pt: spec.ptText || "", pontos: spec.pontos || [], palavras: spec.palavras || [0, 0], formato: spec.formato, reg: spec.reg || "", nivel: spec.nivel || escritaLevel(), minFrases: spec.minFrases || 0}};
  if (spec.resumoRef) t.resumoRef = spec.resumoRef;
  if (spec.ajuda && spec.ajuda.size) t.ajuda = [...spec.ajuda];
  saveEscritaText(t);
  document.getElementById("view-escrita").classList.remove("es-typing");
  const d = escritaDrafts(); delete d[spec.ref]; safeWrite(ESCRITA_DRAFT_KEY, d);
  escritaOpen("texto", {id, spec: null});
  if (escritaCanCorrect()) escritaPump();
  else toast("Texto salvo. Quando o app abrir no PC, ele corrige e a correção volta para cá.", "success", 7000);
}
/* Texto com os erros sublinhados e numerados (1º tempo: só o tipo; 2º tempo: com a correção ao passar o dedo). */
function escritaMarked(text, erros, reveal) {
  const spans = escritaSpans(text, erros), order = spans.map((p, i) => [p, i]).filter(([p]) => p).sort((a, b) => a[0][0] - b[0][0]);
  const out = h("div", {class: "es-text", lang: "de"});
  let at = 0;
  for (const [[a, b], i] of order) {
    if (a > at) out.append(text.slice(at, a));
    if (reveal) {
      const fix = h("span", {class: "es-fix t-" + escritaTipoGroup(erros[i].tipo), title: ESCRITA_TIPOS[erros[i].tipo] + (erros[i].explicacao ? ": " + erros[i].explicacao : "")},
        h("s", {text: text.slice(a, b)}), h("ins", {text: erros[i].certo}), h("sup", {text: String(i + 1)}));
      fix.style.setProperty("--d", (order.findIndex(x => x[1] === i) * 80) + "ms");
      out.append(fix);
    } else out.append(h("mark", {class: "es-mark", title: ESCRITA_TIPOS[erros[i].tipo]}, text.slice(a, b), h("sup", {text: String(i + 1)})));
    at = b;
  }
  out.append(text.slice(at));
  return {node: out, unplaced: spans.filter(p => !p).length};
}
function escritaCardButton(t, i) {
  const e = t.fb.erros[i];
  if (e.card === "feito") return h("span", {class: "muted small-text", text: "Cartão criado ✓ (conferir em Minhas frases)"});
  if (e.card === "pedido") return h("span", {class: "muted small-text", text: escritaCanCorrect() ? "Criando o cartão…" : "Cartão pedido · o PC cria"});
  return h("button", {class: "quiet small", type: "button", onclick: ev => escritaCardClick(t.id, i, ev.currentTarget)}, "Criar cartão");
}
async function escritaCardClick(id, i, btn) {
  const t = escritaData().texts[id];
  if (!t || !t.fb || !t.fb.erros[i]) return;
  if (!escritaCanCorrect()) { t.fb.erros[i].card = "pedido"; saveEscritaText(t); renderEscrita(); toast("O cartão será criado quando o app abrir no PC.", "info"); return; }
  if (btn) { btn.disabled = true; btn.textContent = "Criando…"; }
  try { await escritaMakeCard(id, i); }
  catch (e) { setStatus("Não consegui criar o cartão: " + cleanIpcError(e, "erro"), "error"); }
  renderEscrita();
}
async function escritaAllCards(id) {
  const t = escritaData().texts[id];
  if (!t || !t.fb) return;
  if (!escritaCanCorrect()) { t.fb.erros.forEach(e => { if (!e.card) e.card = "pedido"; }); saveEscritaText(t); renderEscrita(); toast("Os cartões serão criados quando o app abrir no PC.", "info"); return; }
  for (let i = 0; i < t.fb.erros.length; i++) {
    if (escritaData().texts[id].fb.erros[i].card) continue;
    try { await escritaMakeCard(id, i); } catch (e) { setStatus("Não consegui criar todos os cartões: " + cleanIpcError(e, "erro"), "error"); break; }
    renderEscrita();
  }
  renderEscrita();
}
function escritaTextView(box) {
  const t = escritaData().texts[escrita.id], fb = t.fb, [label, cls] = escritaStatusTag(t);
  const head = h("div", {class: "row between es-head"}, h("button", {class: "quiet small", type: "button", onclick: () => escritaOpen("home")}, "← Escrita"),
    h("b", {text: t.title || ESCRITA_KINDS[t.kind]}), h("span", {class: "tag " + cls, text: label}));
  const bank = t.kind === "prova" ? ESCRITA_TAREFAS.find(x => x.id === t.ref) : null;
  const spec = {...t.spec, ptText: t.spec.pt, pontosPt: bank ? bank.pontos.map(p => p[1]) : []};
  const del = h("button", {class: "quiet small", type: "button", onclick: () => {
    if (!confirm("Apagar este texto? (Os cartões já criados continuam em Minhas frases.)")) return;
    escritaData().texts[t.id] = {id: t.id, deleted: true, updatedAt: Date.now()};
    saveProgress(); if (typeof cloudSyncSoon === "function") cloudSyncSoon();
    escritaOpen("home");
  }}, "Apagar texto");
  if (t.status === "pendente") {
    const busy = escrita.busy.has(t.id);
    fill(box, head, escritaTaskBox(spec), h("div", {class: "es-text", lang: "de", text: t.v1}),
      escritaCheckList(escritaChecks(t.v1, t.spec)),
      busy ? h("p", {class: "notice", text: "O Gemma está corrigindo… (até um minuto; na primeira vez do dia ele leva uns 15 s a mais para carregar)"})
        : t.err ? h("div", {class: "notice warn"}, h("p", {text: "A correção falhou: " + t.err}), escritaCanCorrect() ? h("button", {class: "small", type: "button", onclick: () => { delete t.err; delete t.errAt; escritaPump(); }}, "Tentar de novo") : null)
          : escritaCanCorrect() ? h("p", {class: "notice", text: "Na fila de correção…"})
            : h("div", {class: "notice"}, h("p", {text: "Texto salvo. A correção é feita pelo Gemma no PC: quando o app abrir lá, ele corrige sozinho e a correção volta para cá."}),
              typeof cloudSync === "function" ? h("button", {class: "small", type: "button", onclick: async () => { await cloudSync({force: true}); renderEscrita(); }}, "Sincronizar agora") : null),
      h("div", {class: "row"}, del));
    return;
  }
  const n = escritaWords(t.v1).length, rate = escritaRate(t);
  if (t.status === "corrigido") {
    // 1º tempo: só onde e que tipo de erro; você reescreve.
    const marked = escritaMarked(t.v1, fb.erros, false);
    const input = h("textarea", {id: "esRewrite", class: "es-input", lang: "de", rows: "8", spellcheck: "false", autocomplete: "off"});
    input.setAttribute("autocorrect", "off");
    input.value = t.v2 || t.v1;
    fill(box, head, escritaTaskBox(spec),
      h("p", null, fb.erros.length ? h("b", {text: fb.erros.length + (fb.erros.length === 1 ? " erro marcado" : " erros marcados")}) : h("b", {text: "Nenhum erro encontrado."}),
        h("span", {class: "muted", text: " · " + n + " palavras" + (rate != null && fb.erros.length ? " · " + String(rate).replace(".", ",") + " erros a cada 100 palavras" : "")})),
      marked.node,
      fb.erros.length ? h("ol", {class: "es-types"}, ...fb.erros.map((e, i) => h("li", {value: String(i + 1)}, h("b", {text: ESCRITA_TIPOS[e.tipo]}),
        escritaSpans(t.v1, fb.erros)[i] ? null : h("span", {class: "muted small-text", text: " · em: “" + e.trecho + "”"})))) : null,
      escritaCheckList(escritaChecks(t.v1, t.spec, fb.pontos)),
      fb.erros.length ? h("section", {class: "panel es-rewrite"},
        h("h3", {text: "Tente consertar sozinho"}),
        h("p", {class: "muted small-text", text: "Reescreva o texto corrigindo os trechos marcados. Pensar no erro antes de ver a resposta é o que mais ensina."}),
        input, umlautRow(input),
        h("div", {class: "row"},
          h("button", {class: "primary", type: "button", onclick: () => { t.v2 = escritaStr(input.value, 4000); t.status = "revisto"; saveEscritaText(t); renderEscrita(); window.scrollTo({top: 0}); }}, "Ver a correção"),
          h("button", {class: "quiet", type: "button", onclick: () => { t.v2 = ""; t.status = "revisto"; saveEscritaText(t); renderEscrita(); }}, "Pular e ver direto")))
        : h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => { t.status = "revisto"; saveEscritaText(t); renderEscrita(); }}, "Ver a versão natural")),
      h("div", {class: "row"}, del));
    return;
  }
  // 2º tempo: correção completa, o que você acertou ao reescrever, estilo e versão natural.
  const states = fb.erros.map(e => escritaFixState(e, t.v2)), fixed = states.filter(s => s === "ok").length;
  const stateLabel = {ok: ["✓ você corrigiu", "ok"], mudou: ["~ você mudou: confira", "warn"], igual: ["✗ ficou igual", "no"]};
  const canSpeak = typeof convSpeak === "function" && escritaCanCorrect();
  fill(box, head, escritaTaskBox(spec),
    fb.elogio ? h("p", {class: "es-praise ico-inline"}, icon("check", 18), fb.elogio) : null,
    h("p", null, h("b", {text: fb.erros.length + (fb.erros.length === 1 ? " erro" : " erros")}),
      h("span", {class: "muted", text: " · " + n + " palavras" + (rate != null ? " · " + String(rate).replace(".", ",") + " a cada 100 palavras" : "")}),
      t.v2 && fb.erros.length ? h("span", {class: "es-fixed", text: " · você corrigiu " + fixed + " de " + fb.erros.length + " sozinho"}) : null),
    escritaCleanLine(t),
    escritaMarked(t.v1, fb.erros, true).node,
    fb.erros.length ? h("ol", {class: "es-errors"}, ...fb.erros.map((e, i) => {
      const st = states[i] && stateLabel[states[i]];
      return h("li", {value: String(i + 1)},
        h("p", null, h("s", {lang: "de", text: e.trecho}), " → ", h("b", {lang: "de", text: e.certo}), h("span", {class: "tag", text: ESCRITA_TIPOS[e.tipo]}),
          st ? h("span", {class: "es-state " + st[1], text: st[0]}) : null),
        e.explicacao ? h("p", {class: "muted small-text", text: e.explicacao}) : null,
        escritaCardButton(t, i));
    })) : null,
    fb.erros.filter(e => !e.card).length > 1 ? h("div", {class: "row"}, h("button", {class: "small", type: "button", onclick: () => escritaAllCards(t.id)}, "Criar cartões de todos os erros")) : null,
    fb.estilo.length ? h("section", null, h("h3", {text: "Sugestões de estilo (não são erros)"}),
      h("ul", {class: "es-style"}, ...fb.estilo.map(s => h("li", null, h("p", null, h("span", {lang: "de", text: s.disse}), " → ", h("b", {lang: "de", text: s.natural})),
        s.explicacao ? h("p", {class: "muted small-text", text: s.explicacao}) : null)))) : null,
    fb.natural ? h("section", {class: "panel es-natural"}, h("div", {class: "row between"}, h("h3", {text: "Como um nativo escreveria"}),
      canSpeak ? h("button", {class: "icon-btn quiet", type: "button", title: "Ouvir", "aria-label": "Ouvir a versão natural", onclick: () => convSpeak(fb.natural)}, icon("volume", 18)) : null),
      h("p", {class: "es-text", lang: "de", text: fb.natural})) : null,
    t.v2 && t.v2 !== t.v1 ? h("details", {class: "es-v2"}, h("summary", {text: "Sua versão reescrita"}), h("p", {class: "es-text", lang: "de", text: t.v2})) : null,
    t.resumoRef ? h("section", {class: "panel es-natural"}, h("h3", {text: "Resumo de referência (em português)"}), h("p", {text: t.resumoRef})) : null,
    escritaCheckList(escritaChecks(t.v1, t.spec, fb.pontos)),
    t.ajuda && t.ajuda.length ? h("p", {class: "muted small-text", text: "Com ajuda: " + t.ajuda.map(a => ({frases: "frases úteis", palavra: "como se diz", banco: "palavras do capítulo"})[a]).join(", ") + "."}) : null,
    h("p", {class: "muted small-text", text: "A correção é da IA e às vezes erra: os textos vão no Pacote para a aula para o seu tutor conferir."}),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => escritaOpen("home")}, "Escrever outro"), del));
}
