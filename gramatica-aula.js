"use strict";
/* Gramática, nova tela (26/10/2026, pedido do usuário: “confuso, mecânico, não sei o que abrir, bloquear nada a ver”).
   Uma porta só: a Aula de hoje (~10 min, um tópico) em 5 passos — Entender (a armadilha do português), Ver (3 frases que
   você conhece, com a parte da regra marcada), Produzir (5 frases do português para o alemão, digitando ou falando),
   Consertar (seus erros de verdade; sem eles, uma frase estragada pela regra) e Usar (uma frase sua). Sem múltipla escolha.
   O tópico é escolhido pelos seus erros da semana, pelo que venceu, pelo livro do curso (Menschen) e pelo próximo passo; dá
   para trocar. Todos os 49 tópicos ficam abertos, agrupados pelo que você quer fazer (GRAM_GOALS); o nível é só etiqueta.
   O alemão que você escreve passa pelo corretor por regra (corretor.js, LanguageTool) e pela comparação com a frase modelo. */
const GRAM_GOALS = [
  ["base", "Primeiros passos: verbo e substantivo", ["praesens", "vokalwechsel", "plural", "genero", "wortbildung"]],
  ["ordem", "Montar a frase (ordem das palavras)", ["v2", "trennbar", "modal", "nebensatz", "konnektoren", "deshalb", "indirekt", "relativ", "doppelkonj", "obwohl", "temporal", "zuinf", "umzu", "ohnezu", "indem", "konnektb2"]],
  ["passado", "Falar do passado e do “e se”", ["perfekt", "praeteritum", "praetall", "alswenn", "plusquam", "konj2irreal", "konj2verg"]],
  ["casos", "Artigos, casos e pronomes: quem faz o quê", ["akkusativ", "dativ", "perspron", "possessiv", "demonstr", "adjektiv", "adjsubst", "zweiobjekt", "genitiv", "ndekl"]],
  ["lugar", "Lugar, tempo e preposições", ["richtung", "praepakk", "praepdat", "praep", "verbpaare", "uhrzeit", "zeitpraep", "wfragen", "daworter", "genpraep"]],
  ["pedir", "Pedir, sugerir e ser educado", ["sie", "imperativ", "konjunktiv"]],
  ["descrever", "Negar, responder, comparar e descrever", ["negacao", "janeindoch", "partikeln", "man", "komparativ", "falsos", "partizip"]],
  ["verbos", "Verbos especiais", ["reflexiv", "lassen", "werden3", "futur", "vermutung"]],
  ["formal", "Hospital e textos formais", ["passiv", "passiv2", "passivers", "nominal", "konj1", "fvg"]]];
const AULA_PRODUCE = 5, AULA_FIX = 3;
const aula = {id: null, steps: [], i: 0, why: "", res: null, busy: false, clip: null, score: {prod: 0, prodN: 0, fix: 0, fixN: 0}};

function gramLevelOf(id) {
  const ch = GRAM_CHAPTER[id] ?? 0;
  return ch >= GRAM_B2_BASE ? "B2" : ch >= GRAM_B1_BASE ? "B1" : ch >= NW_A2_BASE ? "A2" : "A1";
}
/* Frases para a aula: do seu tamanho (gramWindow), uma oração, até 14 palavras; as que você já estudou primeiro. */
function aulaPool(id) {
  const cat = exPool(id).filter(c => c.frase && !/\n/.test(c.frase) && c.frase.split(/\s+/).length <= 14 && c.traducao);
  // Frases de treino da ficha (escritas para o tópico) entram junto: tópico novo sem frases detectadas no catálogo também tem aula.
  return [...(typeof fichaCards === "function" ? fichaCards(id) : []), ...cat];
}
/* Ouvir uma frase da aula: cartão do catálogo pela voz dele; frase da ficha pelo áudio da gramática. */
function aulaSay(c) { if (c.ficha || c.marked) fichaSay(c.frase); else speakCard(c); }
/* Aula de hoje: até 3 sugestões, cada uma com o motivo. */
function aulaPick() {
  const infos = gramInfos(), byId = new Map(infos.map(x => [x.t.id, x])), out = [], seen = new Set();
  const add = (id, why) => { if (!seen.has(id) && byId.has(id) && aulaPool(id).length >= 6) { seen.add(id); out.push({id, why}); } };
  for (const x of infos.filter(y => y.errs).sort((a, b) => b.errs - a.errs)) add(x.t.id, plural(x.errs, "erro seu", "erros seus") + " nesta semana");
  for (const x of infos.filter(y => y.state === "revisar")) add(x.t.id, x.due ? "Hora de revisar: o último treino foi há " + plural(x.due, "dia", "dias") : "Ainda está escorregando nos exercícios");
  if (typeof MENSCHEN_LICOES !== "undefined" && typeof msCurrent === "function") {
    const l = MENSCHEN_LICOES.find(y => y.n === msCurrent());
    for (const id of (l && l.gram) || []) if (byId.has(id) && byId.get(id).state !== "firme") add(id, "Do seu livro: Lektion " + l.n);
  }
  const cur = gramCurrentChapter();
  for (const x of infos.filter(y => y.state !== "firme").sort((a, b) => Math.abs(a.ch - cur) - Math.abs(b.ch - cur) || a.ch - b.ch)) add(x.t.id, x.state === "novo" ? "Próximo passo para o seu nível" : "Continuar de onde parou");
  for (const x of infos) add(x.t.id, "Para manter firme");
  return out.slice(0, 3);
}

// ---------- Tela inicial ----------
function aulaHero(box) {
  const picks = aulaPick(), first = picks[0];
  if (!first) { fill(box, h("p", {class: "muted", text: "Ainda não há frases suficientes para uma aula."})); box.hidden = false; return; }
  const t = GRAMMAR_BY_ID.get(first.id);
  fill(box,
    h("div", {class: "aula-hero"},
      h("p", {class: "label", text: "Aula de hoje · uns 10 minutos"}),
      h("h2", {class: "aula-title", text: t.title}),
      h("p", {class: "aula-why", text: first.why}),
      h("p", {class: "muted", text: t.short}),
      h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => startAula(first.id, first.why)}, iconText("play", "Começar a aula")),
        h("button", {class: "quiet small", type: "button", onclick: renderGrammarTables}, "Tabelas de consulta"))),
    picks.length > 1 ? h("div", {class: "aula-alt"}, h("span", {class: "muted small-text", text: "Ou:"}),
      ...picks.slice(1).map(p => h("button", {class: "chip", type: "button", title: p.why, onclick: () => startAula(p.id, p.why)}, GRAMMAR_BY_ID.get(p.id).title))) : null);
  box.hidden = false;
}
/* Todos os tópicos, abertos, pelo que você quer fazer. */
function gramGoalsList(box) {
  const infos = gramInfos(), byId = new Map(infos.map(x => [x.t.id, x]));
  const opened = gram.familiesOpen || (gram.familiesOpen = new Set());
  fill(box, h("section", {class: "gram-zone"}, h("h2", {class: "label gram-sec", text: "Todos os tópicos"}),
    ...GRAM_GOALS.map(([id, title, ids]) => {
      const list = ids.map(k => byId.get(k)).filter(Boolean);
      const d = h("details", {class: "gram-family", dataset: {family: id}},
        h("summary", null, h("b", {text: title}), h("span", {class: "muted small-text", text: gramFamilyNote(list)})),
        h("div", {class: "gram-rows"}, ...list.map(x => h("button", {class: "gram-row", type: "button", dataset: {topic: x.t.id}, onclick: () => renderGrammarTopic(x.t.id)},
          h("span", {class: "gram-row-main"}, h("b", {text: x.t.title}), h("span", {class: "muted small-text", text: x.t.short})),
          h("span", {class: "gram-row-side"}, h("span", {class: "tag", text: gramLevelOf(x.t.id)}), gramBadge(x.state))))));
      d.open = opened.has(id);
      d.addEventListener("toggle", () => { d.open ? opened.add(id) : opened.delete(id); });
      return d;
    })));
}

// ---------- A aula ----------
function aulaFixItems(id, pool, used) {
  const mine = typeof gramMyErrors === "function" ? gramMyErrors().filter(x => x.topics.includes(id)) : [];
  const out = [...mine.filter(x => !gramFixed(x.key)), ...mine.filter(x => gramFixed(x.key))].slice(0, 2)
    .map(x => ({k: "consertar", errado: x.errado, correct: x.certo, why: x.explicacao, key: x.key, src: x.src + ", " + gramWhen(x.at)}));
  // Depois dos seus, os erros típicos da ficha (com o porquê).
  const f = typeof fichaOf === "function" ? fichaOf(id) : null;
  for (const [errado, certo, why] of (f && f.erros) || []) if (out.length < AULA_FIX) out.push({k: "consertar", errado, correct: certo, why});
  for (const c of pool) {
    if (out.length >= AULA_FIX) break;
    if (used.has(c.id)) continue;
    const it = formItem(c, id);
    if (!it) continue;
    used.add(c.id);
    out.push({k: "consertar", errado: it.wrong, correct: it.correct, pt: c.traducao});
  }
  return out;
}
function startAula(id, why = "") {
  const pool = aulaPool(id), used = new Set(), f = typeof fichaOf === "function" ? fichaOf(id) : null;
  const own = pool.filter(c => c.ficha), cat = pool.filter(c => !c.ficha);
  // Ver: os exemplos da ficha (com a parte da regra entre colchetes) ou frases do catálogo que a regra do exercício consegue
  // estragar (então a regra está nelas com certeza), de preferência já estudadas.
  const showable = cat.filter(c => formItem(c, id));
  const fx = f ? (f.exemplos || []).map(([de, pt], k) => ({id: "X-" + id + "-" + k, frase: de, traducao: pt, marked: true})) : [];
  const ver = [...fx, ...showable, ...cat].filter((c, k, a) => a.indexOf(c) === k).slice(0, 3);
  ver.forEach(c => used.add(c.id));
  // Produzir: 3 frases da ficha + 2 do catálogo (as que você já viu primeiro); completa com o que houver.
  const prod = [...own.slice(0, 3), ...cat.filter(c => !used.has(c.id)).slice(0, 2)];
  for (const c of [...own.slice(3), ...cat]) { if (prod.length >= AULA_PRODUCE) break; if (!prod.includes(c) && !used.has(c.id)) prod.push(c); }
  prod.forEach(c => used.add(c.id));
  // Falar: 4 frases de uma faixa do livro de gramática deste tópico (gramlivro.js), quando há.
  const tracks = typeof gbTracksFor === "function" ? gbTracksFor(id) : [];
  const falar = tracks.length ? [{k: "falar", track: tracks[Math.floor(Math.random() * tracks.length)]}] : [];
  const steps = [{k: "entender"}, {k: "ver", cards: ver}, ...prod.map(card => ({k: "produzir", card})), ...falar, ...aulaFixItems(id, pool, used), {k: "usar"}];
  Object.assign(aula, {id, steps, i: 0, why, res: null, busy: false, score: {prod: 0, prodN: 0, fix: 0, fixN: 0}});
  stopAudio();
  $("grammarList").hidden = true;
  $("grammarTrain").hidden = true;
  $("grammarDetail").hidden = false;
  // O corretor demora uns segundos na primeira vez: já acorda enquanto você lê a explicação.
  if (ltAvailable()) ltCheck("Hallo.");
  renderAula();
  window.scrollTo({top: 0});
}
function aulaPhase(k) { return {entender: "Entender", ver: "Ver", produzir: "Produzir", falar: "Falar", consertar: "Consertar", usar: "Usar"}[k]; }
/* Passo Falar: o drill do livro dentro da aula (4 frases seguidas da faixa, a partir de um ponto ao acaso). */
function aulaSpeak(t, step) {
  const box = h("div", {class: "gb-embed"});
  const intro = h("p", {class: "muted", text: "Do seu livro de gramática: ouça a frase, responda em voz alta na pausa e compare com a resposta."});
  setTimeout(() => {
    if (step.started && gb.track === step.track.id) { gb.box = box; gbRender(); return; }
    step.started = true;
    gbOpen(step.track.id, {box, topics: [t.id], items: list => { const k = Math.max(0, Math.floor(Math.random() * Math.max(1, list.length - 4))); return list.slice(k, k + 4); },
      onDone: () => { gb.box = null; gb.track = null; aulaNext(); }});
  }, 0);
  return h("div", {class: "aula-step"}, intro, box,
    h("div", {class: "row"}, h("button", {class: "quiet small", type: "button", onclick: () => { gbStop(); gb.box = null; gb.track = null; aulaNext(); }}, "Pular este passo")));
}
function aulaNav() {
  const kinds = ["entender", "ver", "produzir", "falar", "consertar", "usar"].filter(k => aula.steps.some(s => s.k === k));
  const cur = (aula.steps[aula.i] || {}).k;
  return h("ol", {class: "aula-nav"}, ...kinds.map(k => {
    const idx = aula.steps.map((s, j) => s.k === k ? j : -1).filter(j => j >= 0), done = idx.every(j => j < aula.i), here = k === cur;
    const count = idx.length > 1 && here ? " " + (idx.indexOf(aula.i) + 1) + "/" + idx.length : "";
    return h("li", {class: (done ? "done" : "") + (here ? " here" : "")}, aulaPhase(k) + count);
  }));
}
function aulaNext() { aula.i++; aula.res = null; renderAula(); const el = $("aulaInput"); if (el) el.focus(); }
function aulaClose() { if (aula.clip) aula.clip.stop(); if (typeof gbStop === "function") { gbStop(); gb.box = null; gb.track = null; } aula.id = null; saveProgress(); renderGrammar(); }
function renderAula() {
  const box = $("grammarDetail"), t = GRAMMAR_BY_ID.get(aula.id);
  if (!box || !t) return;
  const step = aula.steps[aula.i];
  const head = [h("div", {class: "aula-head"}, h("button", {class: "quiet small", type: "button", onclick: aulaClose}, "← Sair da aula"), h("b", {text: t.title})), aulaNav()];
  if (!step) return fill(box, ...head, aulaEnd(t));
  const body = {entender: aulaUnderstand, ver: aulaSee, produzir: aulaProduce, falar: aulaSpeak, consertar: aulaFix, usar: aulaUse}[step.k](t, step);
  fill(box, ...head, body);
}
function aulaUnderstand(t) {
  const extra = typeof GRAM_EXTRA !== "undefined" ? GRAM_EXTRA[t.id] : null;
  const ficha = typeof fichaNodes === "function" ? fichaNodes(t, false) : null;
  if (ficha) return h("div", {class: "aula-step aula-ficha"}, ...ficha,
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: aulaNext}, "Entendi, vamos ver")));
  return h("div", {class: "aula-step"},
    h("p", {class: "aula-lede", text: t.short}),
    h("div", {class: "trap"},
      h("b", {text: "A armadilha do português"}),
      extra && extra.pt ? h("p", {class: "trap-pt"}, "Em português: ", h("i", {text: "“" + extra.pt + "”"})) : null,
      h("p", {class: "trap-wrong", lang: "de"}, h("span", {text: "✗ "}), t.trap[0]),
      h("p", {class: "trap-right", lang: "de"}, h("span", {text: "✓ "}), t.trap[1])),
    extra && extra.clinic ? h("div", {class: "gram-clinic"}, h("b", {class: "label", text: "No hospital"}),
      h("p", {class: "gram-clinic-de", lang: "de", text: extra.clinic[0]}), h("p", {class: "muted small-text", text: extra.clinic[1]})) : null,
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: aulaNext}, "Entendi, vamos ver"),
      h("button", {class: "quiet small", type: "button", onclick: () => openGrammarDialog(t.id)}, "Ler a explicação completa")));
}
/* A frase com a parte da regra marcada: a palavra que a regra do exercício troca ou move. */
function aulaMarked(card, id) {
  const it = formItem(card, id), toks = exTokens(card.frase);
  let mark = new Set();
  if (it && it.wrong) {
    const w = exTokens(it.wrong);
    if (w.length === toks.length) toks.forEach((x, k) => { if (x !== w[k]) mark.add(k); });
    else { const rest = [...w]; toks.forEach((x, k) => { const j = rest.indexOf(x); if (j >= 0) rest.splice(j, 1); else mark.add(k); }); }
  }
  return h("p", {class: "aula-de", lang: "de"}, ...toks.flatMap((x, k) => [k ? " " : "", mark.has(k) ? h("mark", {class: "aula-mark", text: x}) : x]));
}
function aulaSee(t, step) {
  return h("div", {class: "aula-step"},
    h("p", {class: "muted", text: "Três frases com " + t.title.split(/[:(]/)[0].trim().toLowerCase() + ". Repare na parte marcada."}),
    h("div", {class: "aula-see"}, ...step.cards.map(c => h("div", {class: "aula-see-item"},
      h("button", {class: "icon-btn quiet", type: "button", "aria-label": "Ouvir", title: "Ouvir", onclick: () => aulaSay(c)}, icon("volume", 18)),
      h("div", null, c.marked ? h("p", {class: "aula-de", lang: "de"}, ...fichaMark(c.frase, "aula-mark")) : aulaMarked(c, t.id), h("p", {class: "muted small-text", text: c.traducao}))))),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: aulaNext}, "Agora é a sua vez")));
}
function aulaInputRow(onCheck, placeholder) {
  const input = h("textarea", {id: "aulaInput", lang: "de", rows: "2", spellcheck: "false", autocomplete: "off", placeholder, readonly: !!aula.res});
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (aula.res) aulaNext(); else onCheck(); } });
  const voice = typeof speechAvailable === "function" && speechAvailable() && !aula.res;
  return [input, h("div", {class: "row"},
    aula.res ? null : h("button", {class: "primary", type: "button", disabled: aula.busy, onclick: onCheck}, aula.busy ? "Conferindo…" : "Conferir", h("kbd", null, "Enter")),
    voice ? h("button", {type: "button", class: aula.clip ? "danger-solid" : "", onclick: aulaVoice}, icon(aula.clip ? "stop" : "mic", 18), aula.clip ? "Parar" : "Falar") : null,
    aula.res ? null : h("button", {class: "quiet small", type: "button", onclick: () => onCheck(true)}, "Não sei"))];
}
async function aulaVoice() {
  if (aula.clip) { aula.clip.stop(); return; }
  stopAudio();
  const clip = await startClip(15000);
  if (!clip) return;
  aula.clip = clip;
  renderAula();
  const blob = await clip.done;
  aula.clip = null;
  renderAula();
  try {
    const text = await transcribeBlob(blob, false);
    const el = $("aulaInput");
    if (el && text) { el.value = text; el.focus(); setStatus("Confira o que o app ouviu e aperte Conferir.", "info"); }
  } catch (e) { setStatus("Não foi possível transcrever a fala: " + e.message, "error"); }
}
function aulaKeep(text) { const el = $("aulaInput"); if (el) el.value = text; }
function aulaProduce(t, step) {
  const c = step.card, r = aula.res;
  const check = async giveUp => {
    if (aula.busy || aula.res) return;
    const typed = giveUp === true ? "" : ($("aulaInput").value || "").trim();
    if (!typed && giveUp !== true) { $("aulaInput").focus(); return; }
    aula.busy = true; renderAula(); aulaKeep(typed);
    const d = typed ? diffLine(c.frase, typed) : null, it = formItem(c, t.id);
    const words = typed.split(/\s+/).map(normWord);
    const keyOk = !typed ? false : !(it && it.blank) || words.includes(normWord(it.blank.right));
    const lt = typed ? await ltCheck(typed) : null, ltErr = (lt || []).filter(m => m.cat !== "STYLE");
    let grade = !typed ? "no" : d.pct >= .85 && keyOk ? "ok" : d.pct >= .6 ? "quase" : "no";
    if (grade === "ok" && ltErr.some(m => m.cat === "GRAMMAR")) grade = "quase";
    gramRecord([t.id], grade === "ok");
    aula.score.prodN++; if (grade === "ok") aula.score.prod++;
    aula.busy = false;
    aula.res = {grade, typed, d, keyOk, it, lt: ltErr};
    renderAula(); aulaKeep(typed);
  };
  const situ = String(c.situacao || "").replace(/^\[(du|Sie|ihr|neutro|escrito)\]\s*/, "");
  return h("div", {class: "aula-step"},
    h("p", {class: "label", text: "Como se diz em alemão?"}),
    h("p", {class: "aula-pt", text: c.traducao}),
    situ ? h("p", {class: "muted small-text", text: situ}) : null,
    ...aulaInputRow(check, "Escreva ou fale a frase em alemão"),
    r ? aulaProduceResult(t, c, r) : null);
}
function aulaProduceResult(t, c, r) {
  const msg = {ok: "Certo!", quase: "Quase: compare com a frase modelo.", no: r.typed ? "Compare com a frase modelo." : "Esta é a frase:"}[r.grade];
  return h("div", {class: "aula-result " + r.grade},
    h("p", {class: "aula-status", text: msg}),
    r.typed ? h("div", null, h("p", {class: "muted small-text", text: "Frase modelo (verde = igual ao que você escreveu):"}), r.d.line)
      : h("p", {class: "aula-de", lang: "de", text: c.frase}),
    r.it && r.it.blank && !r.keyOk && r.typed ? h("p", {class: "aula-key small-text"}, "A parte da regra: ", h("b", {lang: "de", text: r.it.blank.right.replace(/[.,!?]+$/, "")})) : null,
    r.lt && r.lt.length ? [h("p", {class: "label", text: "O corretor encontrou"}), ltList(r.typed, r.lt)] : null,
    h("div", {class: "row"},
      h("button", {class: "primary", type: "button", onclick: aulaNext}, "Próximo", h("kbd", null, "Enter")),
      h("button", {class: "small", type: "button", onclick: () => aulaSay(c)}, iconText("volume", "Ouvir")),
      r.grade !== "ok" && r.typed ? h("button", {class: "quiet small", type: "button", onclick: e => {
        e.currentTarget.remove(); gramUndoMiss([t.id]); gramRecord([t.id], true); aula.score.prod++; r.grade = "ok"; saveProgress(); toast("Contei como certo.", "success");
      }}, "A minha versão também está certa") : null));
}
function aulaFix(t, step) {
  const r = aula.res;
  const check = async giveUp => {
    if (aula.busy || aula.res) return;
    const typed = giveUp === true ? "" : ($("aulaInput").value || "").trim();
    const ok = !!typed && gramErrNorm(typed) === gramErrNorm(step.correct);
    gramRecord([t.id], ok);
    if (ok && step.key) gramMarkFixed(step.key);
    aula.score.fixN++; if (ok) aula.score.fix++;
    aula.res = {ok, typed};
    renderAula(); aulaKeep(typed);
  };
  const view = h("div", {class: "aula-step"},
    h("p", {class: "label", text: step.key ? "Uma frase sua (" + step.src + "): conserte" : "Esta frase tem um erro: escreva certa"}),
    h("p", {class: "aula-wrong", lang: "de", text: step.errado}),
    step.pt ? h("p", {class: "muted small-text", text: step.pt}) : null,
    ...aulaInputRow(check, "Escreva a frase certa"),
    r ? h("div", {class: "aula-result " + (r.ok ? "ok" : "no")},
      h("p", {class: "aula-status", text: r.ok ? "Certo!" : "A certa é:"}),
      r.ok ? null : (r.typed ? diffLine(step.correct, r.typed).line : h("p", {class: "aula-de", lang: "de", text: step.correct})),
      step.why ? h("p", {class: "small-text", text: step.why}) : h("p", {class: "small-text muted", text: t.short}),
      h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: aulaNext}, "Próximo", h("kbd", null, "Enter")))) : null);
  // A sua frase errada já vem no campo, para você consertar só o que precisa.
  if (!r) setTimeout(() => { const el = $("aulaInput"); if (el && !el.value) el.value = step.errado; }, 0);
  return view;
}
function aulaUse(t) {
  const r = aula.res, ex = t.examples && t.examples[0];
  const check = async giveUp => {
    if (aula.busy || aula.res) return;
    const typed = giveUp === true ? "" : ($("aulaInput").value || "").trim();
    if (!typed) { aula.res = {typed: ""}; renderAula(); return; }
    aula.busy = true; renderAula(); aulaKeep(typed);
    let uses = null;
    try { uses = !!t.detect({id: "K1-0000", frase: typed, tags: "Modus::Produktion Niveau::A2", traducao: "", situacao: ""}); } catch (e) { uses = null; }
    const lt = await ltCheck(typed);
    aula.busy = false;
    aula.res = {typed, uses, lt: (lt || []).filter(m => m.cat !== "STYLE"), ltOn: lt !== null};
    renderAula(); aulaKeep(typed);
  };
  return h("div", {class: "aula-step"},
    h("p", {class: "label", text: "Agora uma frase sua"}),
    h("p", {class: "aula-pt", text: "Escreva uma frase sobre a sua vida, o trabalho ou a mudança usando: " + t.title.split(/[:(]/)[0].trim() + "."}),
    ex ? h("p", {class: "muted small-text"}, "Exemplo: ", h("span", {lang: "de", text: ex[0]})) : null,
    ...aulaInputRow(check, "Sua frase em alemão"),
    r ? h("div", {class: "aula-result " + (!r.typed ? "no" : r.lt.length ? "quase" : "ok")},
      r.typed ? [
        h("p", {class: "aula-status", text: r.lt.length ? "Quase: veja o que o corretor encontrou." : r.ltOn ? "O corretor não encontrou erros." : "Sem o corretor neste aparelho: confira com o tutor."}),
        r.uses === false ? h("p", {class: "small-text", text: "Não encontrei " + t.title.split(/[:(]/)[0].trim().toLowerCase() + " na sua frase. Tudo bem se foi de propósito; senão, tente de novo."}) : null,
        r.lt.length ? ltList(r.typed, r.lt) : null,
        h("p", {class: "muted small-text", text: "O corretor não pega ordem das palavras nem todo erro de caso: na dúvida, leve a frase para a aula."})] : h("p", {class: "aula-status", text: "Tudo bem, fica para a próxima."}),
      h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: aulaNext}, "Terminar", h("kbd", null, "Enter")),
        r.typed ? h("button", {class: "quiet small", type: "button", onclick: e => { e.currentTarget.disabled = true; addMineDrafts(r.typed, convAvailable(), "aula"); toast("Rascunho criado em Minhas frases: confira e salve lá.", "success"); }}, "Criar cartão") : null)) : null);
}
function aulaEnd(t) {
  saveProgress();
  const s = aula.score, x = gramInfos().find(y => y.t.id === t.id), next = aulaPick().find(p => p.id !== t.id);
  return h("div", {class: "aula-step aula-end"},
    h("h2", {text: "Aula concluída"}),
    h("p", null, "Produzir: ", h("b", {text: s.prod + " de " + s.prodN}), s.fixN ? [" · Consertar: ", h("b", {text: s.fix + " de " + s.fixN})] : null),
    x ? h("p", null, "Agora ", h("b", {text: t.title}), " está: ", gramBadge(x.state)) : null,
    h("div", {class: "row"},
      next ? h("button", {class: "primary", type: "button", onclick: () => startAula(next.id, next.why)}, "Próxima aula: " + GRAMMAR_BY_ID.get(next.id).title) : null,
      h("button", {type: "button", onclick: aulaClose}, "Voltar à Gramática")));
}
