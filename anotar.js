"use strict";
/* Anotação automática de livros com a IA local (mesmo formato das anotações feitas à mão):
   frases → {pt, g, t: [tópicos de gramática]}; palavras → [lema, classe, significado, obs]; capítulos → c[índice] = resumo.
   Capítulo por capítulo, começando onde você parou (dá para ler o capítulo assim que ele fica pronto): frases em lotes
   de 8, depois as palavras novas daquele capítulo (com a tradução da frase como contexto), depois um resumo curto.
   Páginas sem história (Impressum, sumário…) são puladas. Um livro por vez (os outros esperam na fila).
   Salva a cada capítulo e a cada poucos lotes; retoma de onde parou; pausa enquanto há uma conversa ou um 4/3/2 aberto.
   Carregado antes de app.js; usa o estado e as funções de app.js, leitura.js e conversa.js apenas quando chamado. */

const ANNOT_S_BATCH = 8, ANNOT_W_BATCH = 20, ANNOT_SAVE_EVERY = 4;
const ANNOT_SKIP = /^(impressum|inhalt|inhaltsverzeichnis|copyright|danksagung|anmerkungen?|quellen|bildnachweis|über (den|die) autor(in)?|zum autor|zur autorin|weitere (titel|bücher))\b/i;
const ANNOT_SKIP_PT = "(página de créditos ou sumário: sem tradução)";
const annot = {jobs: new Map(), queue: []};

function annotWordKey(w) { return w.toLocaleLowerCase("de"); }
function annotSkipChapter(ch) { return ANNOT_SKIP.test(String(ch.title || "").trim()); }
/* Capítulos na ordem de trabalho: o atual (onde você parou), os seguintes e, por último, os anteriores. */
function annotChapterOrder(book, start = 0) {
  const n = book.chapters.length, s = Math.min(Math.max(0, start), n - 1);
  return [...Array(n).keys()].map(i => (s + i) % n);
}
/* O que falta anotar, por capítulo: frases sem tradução, palavras ainda fora do dicionário (na primeira frase em que
   aparecem dentro da ordem de trabalho) e o resumo. */
function annotTodo(book, notes, start = 0) {
  const seen = new Set(Object.keys(notes.w || {}));
  const chapters = annotChapterOrder(book, start).map(ci => {
    const ch = book.chapters[ci], skip = annotSkipChapter(ch), sentences = [], words = [];
    ch.blocks.forEach(b => b.s.forEach(([sid, text]) => {
      sentences.push({sid, text});
      if (skip) return;
      for (const m of text.matchAll(/\p{L}+(?:-\p{L}+)*/gu)) {
        const w = m[0], k = annotWordKey(w);
        if (w.length > 1 && !seen.has(k)) { seen.add(k); words.push({k, w, ex: text, sid}); }
      }
    }));
    return {ci, skip, title: ch.title, sentences: sentences.filter(s => !(notes.s[s.sid] && notes.s[s.sid].pt)), words, summary: !skip && !(notes.c && notes.c[ci])};
  });
  const totalS = book.chapters.reduce((n, ch) => n + ch.blocks.reduce((m, b) => m + b.s.length, 0), 0);
  return {chapters, totalS, left: chapters.reduce((n, c) => n + c.sentences.length + Math.ceil(c.words.length / 5) + (c.summary ? 1 : 0), 0)};
}
function annotTopicList() { return GRAMATICA.map(g => g.id + " = " + g.title).join("; "); }
const ANNOT_S_SCHEMA = () => ({type: "object", properties: {itens: {type: "array", items: {type: "object", properties: {
  n: {type: "integer"}, pt: {type: "string"}, g: {type: "string"}, t: {type: "array", maxItems: 3, items: {type: "string", enum: GRAMATICA.map(g => g.id)}}},
  required: ["n", "pt", "g", "t"]}}}, required: ["itens"]});
const ANNOT_W_SCHEMA = {type: "object", properties: {itens: {type: "array", items: {type: "object", properties: {
  forma: {type: "string"}, lema: {type: "string"}, classe: {type: "string"}, significado: {type: "string"}, obs: {type: "string"}},
  required: ["forma", "lema", "classe", "significado", "obs"]}}}, required: ["itens"]};
const ANNOT_C_SCHEMA = {type: "object", properties: {resumo: {type: "string"}}, required: ["resumo"]};
async function annotSentences(batch, prev) {
  const sys = "You annotate a German book for Luiz, a Brazilian learner (level " + convLevel() + "). For each numbered sentence give:\n"
    + "- pt: a natural Brazilian Portuguese translation (translate the meaning in context, not word by word);\n"
    + "- g: ONE short note in Brazilian Portuguese about the most useful grammar point or idiom that is literally in the sentence. Only write it if you are sure it is correct; otherwise use an empty string. Name tenses exactly: \"hatte\", \"stand\", \"bat\" are Präteritum; \"war geworden\" is Plusquamperfekt; only \"hat/ist + Partizip II\" is Perfekt.\n"
    + "- t: up to 3 grammar topic ids that clearly occur in the sentence, from this list only: " + annotTopicList() + ". Use \"perfekt\" only for a real Perfekt (hat/ist + Partizip II); an empty list is fine.\n"
    + "Keep the numbering. Answer as JSON.";
  const user = (prev ? "Previous sentence (context only): " + prev + "\n\n" : "") + batch.map((s, i) => (i + 1) + ". " + s.text).join("\n");
  const r = await window.satzDesktop.convChat([{role: "system", content: sys}, {role: "user", content: user}], {kind: "annot-s", temperature: .2, maxTokens: 250 * batch.length, schema: ANNOT_S_SCHEMA()});
  const j = parseLooseJson(r.text);
  return j && Array.isArray(j.itens) ? j.itens : [];
}
/* Palavras com a frase de exemplo e a tradução dela (ajuda a acertar o sentido de palavras com vários significados). */
async function annotWords(batch, notesS) {
  const sys = "You make a small German–Brazilian Portuguese glossary for Luiz, a learner. For each German word form (with an example sentence from the book and its translation) give: "
    + "forma (exactly as given), lema (dictionary form; nouns with article, e.g. \"der Nachbar\"; verbs in the infinitive), classe (in Portuguese: substantivo, verbo, adjetivo, advérbio, preposição, pronome, artigo, conjunção, numeral, interjeição or nome próprio), "
    + "significado (short meaning in Brazilian Portuguese, fitting the example) and obs (short useful note in Portuguese, e.g. the form's tense or case, or an empty string). Answer as JSON.";
  const user = batch.map(x => { const pt = notesS[x.sid] && notesS[x.sid].pt; return x.w + " — " + x.ex.slice(0, 160) + (pt ? " (tradução: " + pt.slice(0, 160) + ")" : ""); }).join("\n");
  const r = await window.satzDesktop.convChat([{role: "system", content: sys}, {role: "user", content: user}], {kind: "annot-w", temperature: .2, maxTokens: 70 * batch.length + 300, schema: ANNOT_W_SCHEMA});
  const j = parseLooseJson(r.text);
  return j && Array.isArray(j.itens) ? j.itens : [];
}
/* Resumo do capítulo para ler ANTES (prévia): só o que acontece nele, sem adiantar o resto do livro. */
async function annotSummary(ch, title) {
  const text = ch.blocks.flatMap(b => b.s.map(s => s[1])).join(" ").slice(0, 16000);
  const sys = "Summarize this chapter of a German book for Luiz, a Brazilian learner (level " + convLevel() + "), who will read it next. "
    + "Write 2 or 3 short sentences in simple Brazilian Portuguese: who appears and what happens in THIS chapter only. Do not reveal anything beyond this chapter and do not judge. Answer as JSON.";
  const r = await window.satzDesktop.convChat([{role: "system", content: sys}, {role: "user", content: "Chapter: " + title + "\n\n" + text}], {kind: "annot-c", temperature: .2, maxTokens: 300, schema: ANNOT_C_SCHEMA});
  const j = parseLooseJson(r.text);
  return j && j.resumo ? convClean(j.resumo) : "";
}
async function annotWaitWhileTalking(job) {
  while (!job.cancel && currentView === "conversa" && ((conv.topic && !conv.finished) || f432.topic)) { job.paused = true; annotUpdate(job); await wait(3000); }
  if (job.paused) { job.paused = false; annotUpdate(job); }
}
function annotUpdate() {
  if (currentView === "reading" && !reading.book) renderLibrary();
}
/* Um livro por vez: com outro em andamento, este entra na fila. */
function annotateBook(id) {
  if (annot.jobs.has(id) || annot.queue.includes(id) || !convAvailable()) return;
  if (annot.jobs.size) { annot.queue.push(id); annotUpdate(); return; }
  return annotRun(id);
}
async function annotRun(id) {
  const job = {id, pct: 0, cancel: false, paused: false, phase: "frases", chapter: ""};
  annot.jobs.set(id, job);
  annotUpdate(job);
  let book;
  try {
    book = await window.satzDesktop.getBook(id);
    // Mantém os significados por ocorrência (o), as expressões (x) e os resumos (c) que já existiam.
    const old = book.notes || {};
    const notes = {s: {...(old.s || {})}, w: {...(old.w || {})}, o: old.o || {}, x: old.x || {}, c: {...(old.c || {})}};
    const pos = bookPosition(id), todo = annotTodo(book, notes, pos ? pos.ch : 0), total = Math.max(1, todo.left);
    let done = 0, batches = 0, failures = 0;
    const save = () => window.satzDesktop.saveBookNotes(id, JSON.stringify(notes));
    const tick = () => { job.pct = Math.min(99, Math.round(done / total * 100)); annotUpdate(job); };
    const guard = async fn => { try { await fn(); } catch (e) { if (++failures > 5) throw e; reportError("anotar", e.message); } };
    for (const ch of todo.chapters) {
      if (job.cancel) break;
      job.chapter = (ch.ci + 1) + ". " + ch.title;
      if (ch.skip) { for (const s of ch.sentences) notes.s[s.sid] = {pt: ANNOT_SKIP_PT, g: "", t: []}; done += ch.sentences.length; tick(); continue; }
      job.phase = "frases";
      for (let i = 0; i < ch.sentences.length && !job.cancel; i += ANNOT_S_BATCH) {
        await annotWaitWhileTalking(job);
        if (job.cancel) break;
        const batch = ch.sentences.slice(i, i + ANNOT_S_BATCH), prev = i ? ch.sentences[i - 1].text : "";
        await guard(async () => {
          for (const it of await annotSentences(batch, prev)) {
            const s = batch[Number(it.n) - 1];
            if (s && it.pt) notes.s[s.sid] = {pt: convClean(it.pt), g: convClean(it.g), t: (Array.isArray(it.t) ? it.t : []).filter(t => GRAMMAR_BY_ID.has(t)).slice(0, 3)};
          }
        });
        done += batch.length; tick();
        if (++batches % ANNOT_SAVE_EVERY === 0) await save();
      }
      job.phase = "palavras";
      for (let i = 0; i < ch.words.length && !job.cancel; i += ANNOT_W_BATCH) {
        await annotWaitWhileTalking(job);
        if (job.cancel) break;
        const batch = ch.words.slice(i, i + ANNOT_W_BATCH), byForm = new Map(batch.map(x => [annotWordKey(x.w), x]));
        await guard(async () => {
          for (const it of await annotWords(batch, notes.s)) {
            const x = byForm.get(annotWordKey(String(it.forma || "")));
            if (x && it.significado) notes.w[x.k] = [convClean(it.lema), convClean(it.classe), convClean(it.significado), convClean(it.obs)];
          }
        });
        done += Math.ceil(batch.length / 5); tick();
        if (++batches % ANNOT_SAVE_EVERY === 0) await save();
      }
      if (ch.summary && !job.cancel) {
        job.phase = "resumo";
        await guard(async () => { const r = await annotSummary(book.chapters[ch.ci], ch.title); if (r) notes.c[ch.ci] = r; });
        done++; tick();
      }
      await save();   // cada capítulo pronto já pode ser lido
      if (currentView === "reading" && reading.book && reading.book.id === id && reading.ch === ch.ci && !job.cancel) openBook(id, true);
    }
    await save();
    job.pct = 100;
    if (!job.cancel) setStatus("Livro anotado: " + book.title + ". Traduções, gramática e resumos já aparecem na leitura.", "success");
  } catch (e) {
    setStatus("A anotação parou: " + cleanIpcError(e, "erro") + ". Toque em “Continuar anotação” para retomar.", "error");
  } finally {
    annot.jobs.delete(id);
    if (currentView === "reading") { if (!reading.book) renderLibrary(); else if (reading.book.id === id) openBook(id, true); }
    const next = annot.queue.shift();
    if (next) annotRun(next);
  }
}
function annotStatusNode(b) {
  const job = annot.jobs.get(b.id), n = b.notes || {s: 0, total: 0, w: 0};
  if (job) {
    const bar = h("span");
    setWidth(bar, job.pct);
    return h("div", {class: "book-status"},
      h("span", {text: job.paused ? "Anotação pausada enquanto você conversa (" + job.pct + "%)" : "Anotando " + job.phase + (job.chapter ? " · capítulo " + job.chapter : "") + " · " + job.pct + "%"}),
      h("div", {class: "track"}, bar),
      h("span", {class: "muted small-text", text: "Cada capítulo pronto já pode ser lido. Pode continuar usando o app; o que já foi anotado fica salvo."}),
      h("button", {class: "quiet small", type: "button", onclick: () => { job.cancel = true; }}, "Parar"));
  }
  if (annot.queue.includes(b.id)) return h("div", {class: "book-status"}, h("span", {class: "muted small-text", text: "Na fila: a anotação começa quando o outro livro terminar."}),
    h("button", {class: "quiet small", type: "button", onclick: () => { annot.queue = annot.queue.filter(x => x !== b.id); annotUpdate(); }}, "Tirar da fila"));
  const complete = n.total && n.s >= n.total && n.w > 0;
  if (complete) return h("div", {class: "book-status ok"}, h("span", {text: "Anotado: traduções, gramática e " + n.w.toLocaleString("pt-BR") + " palavras"}));
  const ai = conv.status ? conv.status.installed : convAvailable();
  if (!ai) return n.s ? h("div", {class: "book-status"}, h("span", {class: "muted small-text", text: "Anotado em parte (" + Math.round(n.s / n.total * 100) + "%)."})) : null;
  const pct = n.total ? Math.round(n.s / n.total * 100) : 0;
  return h("div", {class: "book-status"},
    h("span", {class: "muted small-text", text: n.s ? "Anotado em parte (" + pct + "% das frases)." : "Sem traduções. A IA do computador traduz cada frase, aponta a gramática, monta o dicionário e resume cada capítulo — capítulo por capítulo, começando onde você parou (cerca de 2 horas para 17 mil palavras; o primeiro capítulo fica pronto em uns 10 minutos)."}),
    h("button", {class: "small", type: "button", onclick: () => annotateBook(b.id)}, n.s ? "Continuar anotação" : "Anotar com a IA"));
}
