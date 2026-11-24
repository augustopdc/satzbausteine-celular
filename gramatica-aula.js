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
const aula = {id: null, steps: [], i: 0, why: "", res: null, busy: false, clip: null, score: {prod: 0, prodN: 0, prodHelp: 0, fix: 0, fixN: 0, fixHelp: 0}};

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
/* Quantas frases o aulaPool teria, sem sortear a ordem. */
function aulaPoolSize(id, lv) {
  const own = typeof fichaCards === "function" ? fichaCards(id).length : 0;
  return own + gramWindow(exTopicList(id), 8, lv).filter(c => c.frase && !/\n/.test(c.frase) && c.frase.split(/\s+/).length <= 14 && c.traducao).length;
}
/* Aula de hoje: até 3 sugestões, cada uma com o motivo. Com as 3 achadas, não confere mais nenhum tópico. */
function aulaPick() {
  const infos = gramInfos(), byId = new Map(infos.map(x => [x.t.id, x])), out = [], seen = new Set(), lv = gramLevels();
  const add = (id, why) => { if (out.length < 3 && !seen.has(id) && byId.has(id) && aulaPoolSize(id, lv) >= 6) { seen.add(id); out.push({id, why}); } };
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
  Object.assign(aula, {id, steps, i: 0, why, res: null, busy: false, score: {prod: 0, prodN: 0, prodHelp: 0, fix: 0, fixN: 0, fixHelp: 0}});
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
  const final = !!(aula.res && aula.res.final);
  const input = h("textarea", {id: "aulaInput", lang: "de", rows: "2", spellcheck: "false", autocomplete: "off", placeholder, readonly: final});
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (final) aulaNext(); else onCheck(); } });
  const voice = typeof speechAvailable === "function" && speechAvailable() && !final;
  return [input, h("div", {class: "row"},
    final ? null : h("button", {class: "primary", type: "button", disabled: aula.busy, onclick: onCheck}, aula.busy ? "Conferindo…" : aula.res ? "Conferir de novo" : "Conferir", h("kbd", null, "Enter")),
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
/* Uma tentativa com pistas (gramatica-correcao.js): Produzir e Consertar usam o mesmo passo.
   1ª conferência conta para o tópico (pela regra, não pela frase inteira). Errou: a região e o tipo do problema; de novo:
   uma pista mais explícita; de novo (ou “Ver a resposta”): a resposta comentada. O registro diz se foi sozinho, com pista ou vendo. */
function aulaDetect(t) { return typed => { try { return !!t.detect({id: "K1-0000", frase: typed, tags: "Modus::Produktion Niveau::A2", traducao: "", situacao: ""}); } catch (e) { return null; } }; }
function aulaAttempt(t, step, cfg) {
  const r = aula.res, kind = cfg.kind, sc = aula.score;
  const finish = (res, code) => {
    res.final = true; res.code = code;
    gramHelpLog([t.id], code);
    if (res.diag && res.diag.topicOk && res.tries > 0 && code !== "s") sc[kind + "Help"]++;
    if (kind === "fix" && step.key && res.diag && (res.diag.exact || res.diag.grade === "ok")) gramMarkFixed(step.key);
  };
  const check = async giveUp => {
    if (aula.busy || (aula.res && aula.res.final)) return;
    const res = aula.res || {tries: 0, help: 0};
    const typed = giveUp === true ? "" : ($("aulaInput").value || "").trim();
    if (!typed && giveUp !== true) { $("aulaInput").focus(); return; }
    if (!typed) {
      if (!res.tries) { gramRecord([t.id], false); sc[kind + "N"]++; }
      res.diag = res.diag || gramDiagnose({model: cfg.model, typed: ""});
      res.typed = res.typed || "";
      aula.res = res; finish(res, res.diag.topicOk ? "s" : "m"); res.grade = "no";
      renderAula(); aulaKeep(res.typed); return;
    }
    aula.busy = true; renderAula(); aulaKeep(typed);
    const lt = await ltCheck(typed);
    const diag = gramDiagnose({model: cfg.model, typed, wrong: cfg.wrong, detect: aulaDetect(t), lt, topic: t.id});
    aula.busy = false;
    if (!res.tries) { gramRecord([t.id], diag.topicOk); sc[kind + "N"]++; if (diag.topicOk) sc[kind]++; res.firstOk = diag.topicOk; }
    res.tries++; res.typed = typed; res.diag = diag; res.ltOn = lt !== null; res.grade = diag.grade;
    aula.res = res;
    if (diag.grade === "ok") finish(res, res.tries === 1 && !res.peek ? "s" : String(Math.max(1, Math.min(2, res.help || 1))));
    else if (res.tries >= 3) finish(res, res.firstOk ? "s" : "m");
    else res.help = Math.min(2, res.tries);
    renderAula(); aulaKeep(typed);
    if (!res.final) { const el = $("aulaInput"); if (el) el.focus(); }
  };
  const view = h("div", {class: "aula-step"}, ...cfg.head,
    ...aulaInputRow(check, cfg.placeholder),
    r && !r.final ? aulaHintView(t, step, cfg, r) : null,
    r && r.final ? aulaFinalView(t, step, cfg, r) : null);
  if (!r && cfg.prefill) setTimeout(() => { const el = $("aulaInput"); if (el && !el.value) el.value = cfg.prefill; }, 0);
  return view;
}
/* Ainda não: a sua frase com o problema sublinhado e a pista; nada da resposta. */
function aulaHintView(t, step, cfg, r) {
  const p1 = gcHint1(r.diag, t), p2 = r.help >= 2 ? gcHint2(r.diag, cfg.model, cfg.it) : null;
  const marked = gcMarkTyped(r.typed, r.diag);
  return h("div", {class: "aula-result " + (r.diag.topicOk ? "quase" : "no"), dataset: {help: String(r.help)}},
    h("p", {class: "aula-status", text: r.diag.topicOk ? "Quase. Tente de novo." : "Ainda não. Tente de novo."}),
    h("p", {class: "aula-de gc-typed", lang: "de"}, ...marked.map(x => x.bad ? h("span", {class: "gc-bad", text: x.text}) : x.text)),
    h("p", {class: "gc-lead", text: p1.lead}),
    h("p", {class: "small-text", text: p1.ask}),
    p2 ? h("div", {class: "gc-hint2"}, h("p", {class: "label", text: "Mais uma pista"}), ...p2.lines.map(x => h("p", {class: "small-text", text: x})),
      p2.skeleton ? h("p", {class: "aula-de gc-skel", lang: "de", text: p2.skeleton}) : null,
      !p2.lines.length && !p2.skeleton ? h("p", {class: "small-text", text: t.short}) : null) : null,
    h("div", {class: "row"},
      r.help < 2 ? h("button", {class: "small", type: "button", onclick: () => { r.help = 2; renderAula(); aulaKeep(r.typed); }}, "Mais uma pista") : null,
      h("button", {class: "quiet small", type: "button", onclick: () => { r.peek = true; openGrammarDialog(t.id); }}, iconText("book", "Ver a regra", 15)),
      h("button", {class: "quiet small", type: "button", onclick: () => {
        r.final = true; r.code = r.firstOk ? "s" : "m"; gramHelpLog([t.id], r.code); renderAula(); aulaKeep(r.typed);
      }}, "Ver a resposta")));
}
/* As três perguntas, separadas: regra, sentido, outros erros. */
function aulaDiagView(t, r) {
  const g = r.diag, name = t.title.split(/[:(]/)[0].trim().toLowerCase(), words = g.ruleWords.length ? " (" + g.ruleWords.slice(0, 3).join(" … ") + ")" : "";
  const line = (cls, label, text) => h("li", {class: "gc-" + cls}, h("span", {class: "gc-mark", "aria-hidden": "true", text: cls === "ok" ? "✓" : cls === "no" ? "✗" : "·"}), h("b", {text: label + ": "}), text);
  const rule = {ok: line("ok", "Regra", "você acertou " + (words ? "a parte da regra" + words : name) + "."),
    no: line("no", "Regra", "a parte da regra ainda não" + words + "."),
    absent: line("na", "Regra", "você não usou " + name + ". Tudo bem se foi de propósito."),
    unknown: line("na", "Regra", "não deu para conferir só a regra nesta frase.")}[g.rule];
  const meaning = {ok: line("ok", "Sentido", g.exact ? "igual à frase modelo." : "as palavras batem com o pedido."),
    perto: line("na", "Sentido", "algumas palavras diferem do modelo. Pode ser outra forma certa."),
    longe: line("no", "Sentido", "a frase ficou diferente do pedido.")}[g.meaning];
  const other = !r.typed ? null : g.others.length ? line("na", "Outros pontos", g.rule === "ok" ? "não contam para este tópico." : "veja abaixo.")
    : r.ltOn ? line("ok", "Outros erros", "o corretor não encontrou.") : line("na", "Outros erros", "sem o corretor neste aparelho.");
  return h("ul", {class: "gc-diag"}, rule, meaning, other);
}
function aulaFinalView(t, step, cfg, r) {
  const g = r.diag, ok = g.grade === "ok";
  const helped = {s: "", 1: " na 2ª tentativa, com pista", 2: " com a 2ª pista", m: ""}[r.code] || "";
  const msg = !r.typed ? "Esta é a frase:" : ok ? (g.exact ? "Certo" : "Certo do jeito que importa") + helped + "!" : g.topicOk ? "A regra está certa; veja o resto." : "Compare com a frase modelo.";
  const cmpBox = h("div", {class: "gc-compare"});
  if (r.cmp) gcCompareView(cmpBox, r, t);
  return h("div", {class: "aula-result " + (ok ? "ok" : g.topicOk ? "quase" : "no")},
    h("p", {class: "aula-status", text: msg}),
    r.typed ? aulaDiagView(t, r) : null,
    r.typed && !g.exact ? h("div", null, h("p", {class: "muted small-text", text: cfg.kind === "fix" ? "A versão de referência (verde = igual ao que você escreveu):" : "Frase modelo (verde = igual ao que você escreveu):"}), diffLine(cfg.model, r.typed).line)
      : h("p", {class: "aula-de", lang: "de", text: cfg.model}),
    g.others.length ? ltList(r.typed, g.others) : null,
    cfg.why ? h("p", {class: "small-text", text: cfg.why}) : null,
    cmpBox,
    h("div", {class: "row"},
      h("button", {class: "primary", type: "button", onclick: aulaNext}, "Próximo", h("kbd", null, "Enter")),
      cfg.say ? h("button", {class: "small", type: "button", onclick: cfg.say}, iconText("volume", "Ouvir")) : null,
      !ok && r.typed && !r.cmp && typeof convAvailable === "function" && convAvailable() ? h("button", {class: "small", type: "button", onclick: async e => {
        e.currentTarget.disabled = true; e.currentTarget.textContent = "Comparando…";
        r.cmp = await gcCompare(t, cfg.pt || "", cfg.model, r.typed);
        renderAula(); aulaKeep(r.typed);
      }}, "Comparar minha resposta") : null,
      !ok && r.typed ? h("button", {class: "quiet small", type: "button", onclick: e => { e.currentTarget.remove(); aulaCountOwn(t, step, cfg, r); }}, "A minha versão também está certa") : null));
}
/* Você decide: conta como certo (desfaz o erro contado) e, no Consertar, tira o erro da fila. */
function aulaCountOwn(t, step, cfg, r) {
  if (!r.firstOk) { gramRecord([t.id], true); gramUndoMiss([t.id]); aula.score[cfg.kind]++; r.firstOk = true; }
  r.diag = {...r.diag, grade: "ok", topicOk: true}; r.grade = "ok";
  if (cfg.kind === "fix" && step.key) gramMarkFixed(step.key);
  saveProgress(); toast("Contei como certo.", "success");
  renderAula(); aulaKeep(r.typed);
}
function gcCompareView(box, r, t) {
  const c = r.cmp;
  if (c.state === "fail") return fill(box, h("p", {class: "muted small-text", text: "Não foi possível comparar agora. Leve a frase para o tutor."}));
  if (c.state === "incerto") return fill(box, h("p", {class: "small-text"}, h("b", {text: "A IA não conseguiu decidir com segurança. "}), c.text || "", " Na dúvida, leve a frase para o tutor."));
  fill(box,
    h("p", {class: "small-text"}, h("b", {text: c.state === "certo" ? "A IA acha que a sua versão também está certa. " : "A IA acha que há um erro. "}), c.text),
    c.fixed ? h("p", {class: "aula-de", lang: "de"}, "→ ", c.fixed) : null,
    h("p", {class: "muted small-text", text: "É uma opinião da IA, não um veredito: se concordar, use “A minha versão também está certa”."}));
}
function aulaProduce(t, step) {
  const c = step.card, it = formItem(c, t.id);
  const situ = String(c.situacao || "").replace(/^\[(du|Sie|ihr|neutro|escrito)\]\s*/, "");
  return aulaAttempt(t, step, {kind: "prod", model: c.frase, wrong: it && it.wrong, it, pt: c.traducao, say: () => aulaSay(c), placeholder: "Escreva ou fale a frase em alemão",
    head: [h("p", {class: "label", text: "Como se diz em alemão?"}), h("p", {class: "aula-pt", text: c.traducao}), situ ? h("p", {class: "muted small-text", text: situ}) : null]});
}
function aulaFix(t, step) {
  return aulaAttempt(t, step, {kind: "fix", model: step.correct, wrong: step.errado, pt: step.pt || "", prefill: step.errado, placeholder: "Escreva a frase certa",
    why: step.why || t.short, say: () => fichaSay(step.correct),
    head: [h("p", {class: "label", text: step.key ? "Uma frase sua (" + step.src + "): conserte" : "Esta frase tem um erro: escreva certa"}),
      h("p", {class: "aula-wrong", lang: "de", text: step.errado}), step.pt ? h("p", {class: "muted small-text", text: step.pt}) : null]});
}
function aulaUse(t) {
  const r = aula.res, ex = t.examples && t.examples[0];
  const check = async giveUp => {
    if (aula.busy || aula.res) return;
    const typed = giveUp === true ? "" : ($("aulaInput").value || "").trim();
    if (!typed) { aula.res = {typed: "", final: true}; renderAula(); return; }
    aula.busy = true; renderAula(); aulaKeep(typed);
    let uses = null;
    try { uses = !!t.detect({id: "K1-0000", frase: typed, tags: "Modus::Produktion Niveau::A2", traducao: "", situacao: ""}); } catch (e) { uses = null; }
    const lt = await ltCheck(typed);
    aula.busy = false;
    aula.res = {typed, uses, lt: (lt || []).filter(m => m.cat !== "STYLE"), ltOn: lt !== null, final: true};
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
    h("p", null, "Produzir: ", h("b", {text: s.prod + " de " + s.prodN}), " de primeira", s.prodHelp ? ", mais " + s.prodHelp + " com pista" : "",
      s.fixN ? [" · Consertar: ", h("b", {text: s.fix + " de " + s.fixN}), s.fixHelp ? " (+" + s.fixHelp + " com pista)" : ""] : null),
    h("p", {class: "muted small-text", text: "Só a parte da regra conta para o tópico: erro de outro assunto não derruba esta aula."}),
    x ? h("p", null, "Agora ", h("b", {text: t.title}), " está: ", gramBadge(x.state)) : null,
    h("div", {class: "row"},
      next ? h("button", {class: "primary", type: "button", onclick: () => startAula(next.id, next.why)}, "Próxima aula: " + GRAMMAR_BY_ID.get(next.id).title) : null,
      typeof profButton === "function" ? profButton(t.id) : null,
      h("button", {type: "button", onclick: aulaClose}, "Voltar à Gramática")));
}
