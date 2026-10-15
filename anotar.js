"use strict";
/* Anotação automática de livros com a IA local (mesmo formato das anotações feitas à mão):
   frases → {pt, g, t: [tópicos de gramática]}; palavras → [lema, classe, significado, obs].
   Roda em segundo plano (lotes de 8 frases e de 20 palavras), salva a cada poucos lotes e retoma de onde parou.
   Pausa enquanto há uma conversa ou um monólogo 4/3/2 aberto, para a parceira não ficar lenta.
   Carregado antes de app.js; usa o estado e as funções de app.js, leitura.js e conversa.js apenas quando chamado. */

const ANNOT_S_BATCH = 8, ANNOT_W_BATCH = 20, ANNOT_SAVE_EVERY = 4;
const annot = {jobs: new Map()};

function annotWordKey(w) { return w.toLocaleLowerCase("de"); }
/* Frases e palavras do livro que ainda faltam anotar. */
function annotTodo(book, notes) {
  const sentences = [], forms = new Map();
  book.chapters.forEach(ch => ch.blocks.forEach(b => b.s.forEach(([sid, text]) => {
    sentences.push({sid, text});
    for (const m of text.matchAll(/\p{L}+(?:-\p{L}+)*/gu)) {
      const w = m[0], k = annotWordKey(w);
      if (w.length > 1 && !forms.has(k)) forms.set(k, {w, ex: text});
    }
  })));
  return {sentences: sentences.filter(s => !(notes.s[s.sid] && notes.s[s.sid].pt)), words: [...forms.entries()].filter(([k]) => !notes.w[k]).map(([k, v]) => ({k, ...v})),
    totalS: sentences.length, totalW: forms.size};
}
function annotTopicList() { return GRAMATICA.map(g => g.id + " = " + g.title).join("; "); }
const ANNOT_S_SCHEMA = () => ({type: "object", properties: {itens: {type: "array", items: {type: "object", properties: {
  n: {type: "integer"}, pt: {type: "string"}, g: {type: "string"}, t: {type: "array", maxItems: 3, items: {type: "string", enum: GRAMATICA.map(g => g.id)}}},
  required: ["n", "pt", "g", "t"]}}}, required: ["itens"]});
const ANNOT_W_SCHEMA = {type: "object", properties: {itens: {type: "array", items: {type: "object", properties: {
  forma: {type: "string"}, lema: {type: "string"}, classe: {type: "string"}, significado: {type: "string"}, obs: {type: "string"}},
  required: ["forma", "lema", "classe", "significado", "obs"]}}}, required: ["itens"]};
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
async function annotWords(batch) {
  const sys = "You make a small German–Brazilian Portuguese glossary for Luiz, a learner. For each German word form (with an example sentence from the book) give: "
    + "forma (exactly as given), lema (dictionary form; nouns with article, e.g. \"der Nachbar\"; verbs in the infinitive), classe (in Portuguese: substantivo, verbo, adjetivo, advérbio, preposição, pronome, artigo, conjunção, numeral, interjeição or nome próprio), "
    + "significado (short meaning in Brazilian Portuguese, fitting the example) and obs (short useful note in Portuguese, e.g. the form's tense or case, or an empty string). Answer as JSON.";
  const user = batch.map(x => x.w + " — " + x.ex.slice(0, 160)).join("\n");
  const r = await window.satzDesktop.convChat([{role: "system", content: sys}, {role: "user", content: user}], {kind: "annot-w", temperature: .2, maxTokens: 70 * batch.length + 300, schema: ANNOT_W_SCHEMA});
  const j = parseLooseJson(r.text);
  return j && Array.isArray(j.itens) ? j.itens : [];
}
async function annotWaitWhileTalking(job) {
  while (!job.cancel && currentView === "conversa" && ((conv.topic && !conv.finished) || f432.topic)) { job.paused = true; annotUpdate(job); await wait(3000); }
  if (job.paused) { job.paused = false; annotUpdate(job); }
}
function annotUpdate() {
  if (currentView === "reading" && !reading.book) renderLibrary();
}
async function annotateBook(id) {
  if (annot.jobs.has(id) || !convAvailable()) return;
  const job = {id, pct: 0, cancel: false, paused: false, phase: "frases"};
  annot.jobs.set(id, job);
  annotUpdate(job);
  let book;
  try {
    book = await window.satzDesktop.getBook(id);
    // Mantém os significados por ocorrência (o) e as expressões (x) que já existiam.
    const notes = {s: {...((book.notes && book.notes.s) || {})}, w: {...((book.notes && book.notes.w) || {})}, o: (book.notes && book.notes.o) || {}, x: (book.notes && book.notes.x) || {}};
    const todo = annotTodo(book, notes), total = todo.sentences.length + Math.ceil(todo.words.length / 5);
    let done = 0, batches = 0, failures = 0;
    const save = () => window.satzDesktop.saveBookNotes(id, JSON.stringify(notes));
    const tick = () => { job.pct = total ? Math.min(99, Math.round(done / total * 100)) : 99; annotUpdate(job); };
    for (let i = 0; i < todo.sentences.length && !job.cancel; i += ANNOT_S_BATCH) {
      await annotWaitWhileTalking(job);
      if (job.cancel) break;
      const batch = todo.sentences.slice(i, i + ANNOT_S_BATCH), prev = i ? todo.sentences[i - 1].text : "";
      try {
        for (const it of await annotSentences(batch, prev)) {
          const s = batch[Number(it.n) - 1];
          if (s && it.pt) notes.s[s.sid] = {pt: convClean(it.pt), g: convClean(it.g), t: (Array.isArray(it.t) ? it.t : []).filter(t => GRAMMAR_BY_ID.has(t)).slice(0, 3)};
        }
      } catch (e) { if (++failures > 5) throw e; reportError("anotar", e.message); }
      done += batch.length;
      tick();
      if (++batches % ANNOT_SAVE_EVERY === 0) await save();
    }
    job.phase = "palavras";
    for (let i = 0; i < todo.words.length && !job.cancel; i += ANNOT_W_BATCH) {
      await annotWaitWhileTalking(job);
      if (job.cancel) break;
      const batch = todo.words.slice(i, i + ANNOT_W_BATCH), byForm = new Map(batch.map(x => [annotWordKey(x.w), x]));
      try {
        for (const it of await annotWords(batch)) {
          const x = byForm.get(annotWordKey(String(it.forma || "")));
          if (x && it.significado) notes.w[x.k] = [convClean(it.lema), convClean(it.classe), convClean(it.significado), convClean(it.obs)];
        }
      } catch (e) { if (++failures > 5) throw e; reportError("anotar", e.message); }
      done += Math.ceil(batch.length / 5);
      tick();
      if (++batches % ANNOT_SAVE_EVERY === 0) await save();
    }
    await save();
    job.pct = 100;
    if (!job.cancel) setStatus("Livro anotado: " + book.title + ". Traduções e gramática já aparecem na leitura.", "success");
  } catch (e) {
    setStatus("A anotação parou: " + cleanIpcError(e, "erro") + ". Toque em “Continuar anotação” para retomar.", "error");
  } finally {
    annot.jobs.delete(id);
    if (currentView === "reading") { if (!reading.book) renderLibrary(); else if (reading.book.id === id) openBook(id, true); }
  }
}
function annotStatusNode(b) {
  const job = annot.jobs.get(b.id), n = b.notes || {s: 0, total: 0, w: 0};
  if (job) {
    const bar = h("span");
    setWidth(bar, job.pct);
    return h("div", {class: "book-status"},
      h("span", {text: job.paused ? "Anotação pausada enquanto você conversa (" + job.pct + "%)" : "Anotando " + job.phase + " com a IA… " + job.pct + "%"}),
      h("div", {class: "track"}, bar),
      h("span", {class: "muted small-text", text: "Pode continuar usando o app; o que já foi anotado fica salvo."}),
      h("button", {class: "quiet small", type: "button", onclick: () => { job.cancel = true; }}, "Parar"));
  }
  const complete = n.total && n.s >= n.total && n.w > 0;
  if (complete) return h("div", {class: "book-status ok"}, h("span", {text: "Anotado: traduções, gramática e " + n.w.toLocaleString("pt-BR") + " palavras"}));
  const ai = conv.status ? conv.status.installed : convAvailable();
  if (!ai) return n.s ? h("div", {class: "book-status"}, h("span", {class: "muted small-text", text: "Anotado em parte (" + Math.round(n.s / n.total * 100) + "%)."})) : null;
  const pct = n.total ? Math.round(n.s / n.total * 100) : 0;
  return h("div", {class: "book-status"},
    h("span", {class: "muted small-text", text: n.s ? "Anotado em parte (" + pct + "% das frases)." : "Sem traduções. A IA do computador pode traduzir cada frase, apontar a gramática e montar o dicionário de palavras (cerca de 2 horas para um livro de 17 mil palavras, em segundo plano; dá para parar e continuar depois)."}),
    h("button", {class: "small", type: "button", onclick: () => annotateBook(b.id)}, n.s ? "Continuar anotação" : "Anotar com a IA"));
}
