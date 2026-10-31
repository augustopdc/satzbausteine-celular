"use strict";
/* Aula guiada de cada lição do Menschen, na ordem das páginas do Kursbuch (os `passos` de menschen-data.js). Cada passo:
   do que trata → palavras (do português para o alemão, digitando ou falando, com caixas de revisão espaçada) → ouvir (o
   ciclo da faixa em menschen.js) → a regra (no formato das fichas) → produzir (frases da lição) → sua vez (uma frase ou uma
   história sua, conferida por regra e pelo corretor). Nada fica trancado: dá para pular de passo e de etapa à vontade.
   Progresso em progress.practice.menschen = {passos: {"1-padaria": quando terminou}, words: {alemão: {b, due, n, w, at}}}. */
const MS_WORD_DAYS = [0, 1, 3, 7, 14, 30, 60, 120];
const MS_PHASES = {sobre: "Do que trata", palavras: "Palavras", ouvir: "Ouvir", regra: "A regra", produzir: "Produzir", usar: "Sua vez"};
const MS_PRODUCE = 5;

// ---------- Progresso (sincroniza com o celular) ----------
function msState() {
  if (!progress.practice) progress.practice = {};
  const s = progress.practice.menschen;
  if (!s || typeof s !== "object") progress.practice.menschen = {passos: {}, words: {}};
  else { if (!s.passos) s.passos = {}; if (!s.words) s.words = {}; }
  return progress.practice.menschen;
}
function sanitizeMenschen(src) {
  const out = {passos: {}, words: {}};
  if (!src || typeof src !== "object") return out;
  for (const [k, v] of Object.entries(src.passos || {})) if (/^\d{1,2}-[a-z0-9]{1,20}$/.test(k) && Number(v) > 0) out.passos[k] = Number(v);
  for (const [k, s] of Object.entries(src.words || {})) {
    if (!k.trim() || k.length > 80 || !s || typeof s !== "object") continue;
    const b = Math.max(0, Math.min(MS_WORD_DAYS.length - 1, Math.round(Number(s.b) || 0))), n = Math.max(0, Math.round(Number(s.n) || 0));
    const w = Math.max(0, Math.min(n, Math.round(Number(s.w) || 0)));
    if (n) out.words[k] = {b, due: Number(s.due) || 0, n, w, at: Number(s.at) || 0};
  }
  return out;
}
function mergeMenschen(local, incoming) {
  const out = sanitizeMenschen(local), inc = sanitizeMenschen(incoming);
  for (const [k, v] of Object.entries(inc.passos)) out.passos[k] = Math.max(out.passos[k] || 0, v);
  for (const [k, s] of Object.entries(inc.words)) if (!out.words[k] || s.at > out.words[k].at) out.words[k] = s;
  return out;
}
function msPassoKey(n, id) { return n + "-" + id; }
function msPassoDone(n, id) { return !!msState().passos[msPassoKey(n, id)]; }
function msNextPasso(l) { return (l.passos || []).find(p => !msPassoDone(l.n, p.id)) || null; }

// ---------- Palavras ----------
/* Todas as palavras dos passos: alemão → [alemão, extra, português]. */
function msAllWords() {
  const out = new Map();
  for (const l of MENSCHEN_LICOES) for (const p of l.passos || []) for (const w of p.palavras || []) if (!out.has(w[0])) out.set(w[0], w);
  return out;
}
function msDueWords(now = Date.now()) {
  const st = msState().words, all = msAllWords();
  return [...all.values()].filter(w => st[w[0]] && st[w[0]].due <= now);
}
/* Acertou: sobe uma caixa (1, 3, 7… dias). Errou: volta para a caixa 0 e reaparece em 10 minutos. */
function msWordRecord(de, ok, now = Date.now()) {
  const st = msState(), s = st.words[de] ? {...st.words[de]} : {b: 0, due: 0, n: 0, w: 0, at: 0};
  s.n++;
  if (ok) { s.b = Math.min(MS_WORD_DAYS.length - 1, s.b + 1); s.due = now + MS_WORD_DAYS[s.b] * 864e5 - 3600e3; }
  else { s.w++; s.b = 0; s.due = now + 10 * 60000; }
  s.at = now;
  st.words[de] = s;
  return s;
}
function msWordNorm(s) {
  return String(s || "").trim().toLocaleLowerCase("de").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[.!?,;:¡¿“”"]+/g, " ").replace(/\s+/g, " ").trim();
}
/* Respostas aceitas: “der/die Jugendliche” vale com qualquer dos dois; o que está entre parênteses é opcional. */
function msWordAnswers(de) {
  const out = [];
  for (const alt of de.replace(/\s*\([^)]*\)/g, "").split(/\s+\/\s+/)) {
    const m = alt.match(/^(der|die|das)\/(der|die|das)\s+(.+)$/);
    if (m) out.push(m[1] + " " + m[3], m[2] + " " + m[3]); else out.push(alt);
  }
  return out.map(msWordNorm);
}
function msLev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const prev = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}
/* {ok, close (uma letra de diferença numa palavra comprida), article (só o artigo errado)}. Com “…”, as partes têm de
   aparecer na ordem (Habe ich euch schon von meinem Onkel erzählt?). */
function msWordCheck(de, typed) {
  const t = msWordNorm(typed);
  if (!t) return {ok: false};
  if (de.includes("…")) {
    let at = 0;
    for (const part of de.split("…").map(msWordNorm).filter(Boolean)) { const k = t.indexOf(part, at); if (k < 0) return {ok: false}; at = k + part.length; }
    return {ok: true};
  }
  const answers = msWordAnswers(de);
  if (answers.includes(t)) return {ok: true};
  for (const a of answers) {
    const art = a.match(/^(der|die|das) /);
    if (art && !t.startsWith(art[0])) continue;
    // A letra a mais ou a menos não pode estar no fim: ali moram o plural e a terminação (die Eltern × die Elter).
    if (a.length >= 6 && a.slice(-2) === t.slice(-2) && msLev(a, t) <= 1) return {ok: true, close: true};
  }
  const bare = t.replace(/^(der|die|das) /, "");
  return {ok: false, article: answers.some(a => /^(der|die|das) /.test(a) && a.slice(4) === bare)};
}
function msWordHint(w) {
  if (/^(der|die|das)(\/(der|die|das))? /.test(w[0])) return "com o artigo (der, die ou das)";
  if (/ hat | ist |^hat |^ist /.test(" " + w[1] + " ")) return w[0].includes(" ") ? "a expressão com o verbo" : "o verbo no infinitivo";
  return w[0].includes(" ") ? "a expressão" : "";
}
function msWordDe(w) {
  // Só plural (die Eltern, die Großeltern): o die não é feminino, então fica sem a cor do gênero.
  const m = w[1] !== "só plural" && w[0].match(/^(der|die|das)\s+(.+)$/), cls = m ? genderClass(m[1], m[2]) : "";
  return h("span", {class: "ms-de" + (cls && settings.genderColors ? " gender " + cls : ""), lang: "de", text: w[0]});
}
function msWordList(list) {
  return h("div", {class: "ms-wlist"}, ...list.map(w => h("div", {class: "ms-wrow"},
    typeof fichaHear === "function" ? fichaHear(w[0].replace(/\s*\([^)]*\)/g, "")) : h("span"),
    h("div", null, msWordDe(w), w[1] ? h("span", {class: "ms-extra", lang: "de", text: " " + w[1]}) : null, h("p", {class: "ms-pt", text: w[2]})))));
}

// ---------- A aula: abrir, navegar, fechar ----------
function msPhasesOf(p) {
  return ["sobre", p.palavras && p.palavras.length ? "palavras" : null, p.faixas && p.faixas.length ? "ouvir" : null, p.regra ? "regra" : null,
    p.frases && p.frases.length ? "produzir" : null, p.usar ? "usar" : null, "fim"].filter(Boolean);
}
function msOpenPasso(n, id, phase = 0) {
  const l = msLessonData(n), p = l.passos.find(x => x.id === id);
  if (!p) return;
  msStop();
  Object.assign(menschen, {track: null, data: null, view: n});
  menschen.passo = {n, id, phases: msPhasesOf(p), i: phase, res: null, busy: false, clip: null, drill: null, prod: null, faixa: null, words: {ok: 0, n: 0}};
  if (ltAvailable()) ltCheck("Hallo.");
  renderMenschen();
  window.scrollTo({top: 0});
}
/* Revisão das palavras vencidas de todas as lições (fora de um passo). */
function msOpenReview() {
  const due = msDueWords();
  if (!due.length) { toast("Nenhuma palavra para revisar agora.", "info"); return; }
  msStop();
  Object.assign(menschen, {track: null, data: null});
  menschen.passo = {n: menschen.view || msCurrent(), review: true, phases: ["palavras", "fim"], i: 0, res: null, busy: false, clip: null,
    drill: msNewDrill(due.slice(0, 20)), words: {ok: 0, n: 0}};
  renderMenschen();
  window.scrollTo({top: 0});
}
function msClosePasso(quiet = false) {
  msStop();
  saveProgress();
  menschen.passo = null;
  menschen.track = null;
  menschen.data = null;
  if (!quiet) { renderMenschen(); window.scrollTo({top: 0}); }
}
function msRenderPasso() { renderMenschen(); }
function msGoPhase(j) {
  const P = menschen.passo;
  if (!P) return;
  msStop();
  P.i = Math.max(0, Math.min(P.phases.length - 1, j));
  P.res = null;
  P.busy = false;
  if (P.phases[P.i] === "fim" && !P.review) { msState().passos[msPassoKey(P.n, P.id)] = Date.now(); saveProgress(); }
  msRenderPasso();
  window.scrollTo({top: 0});
  const el = $("msInput");
  if (el) el.focus();
}
function msNext() { if (menschen.passo) msGoPhase(menschen.passo.i + 1); }
function msNextButton(label) {
  const P = menschen.passo, next = P.phases[P.i + 1];
  return h("button", {class: "primary", type: "button", onclick: msNext}, label || (next === "fim" ? "Terminar o passo" : "Próximo: " + MS_PHASES[next]));
}
function msPassoView(box) {
  const P = menschen.passo, l = msLessonData(P.n);
  const p = P.review ? null : l.passos.find(x => x.id === P.id), cur = P.phases[P.i];
  const k = p ? l.passos.indexOf(p) : -1;
  const nav = P.review ? null : h("ol", {class: "aula-nav ms-nav"}, ...P.phases.filter(x => x !== "fim").map((x, j) =>
    h("li", {class: (j < P.i ? "done" : "") + (j === P.i ? " here" : "")}, h("button", {type: "button", onclick: () => msGoPhase(j)}, MS_PHASES[x]))));
  const head = h("div", {class: "ms-passo-head"},
    h("button", {class: "quiet small", type: "button", onclick: () => msClosePasso()}, iconText("back", "Lektion " + l.n)),
    h("p", {class: "ms-kicker", text: p ? "Passo " + (k + 1) + " de " + l.passos.length + " · " + p.pag : "Revisão"}),
    h("h2", {class: "ms-passo-title", text: p ? p.titulo : "Palavras para revisar"}), nav);
  const body = cur === "fim" ? msPassoEnd(l, p)
    : {sobre: msPhSobre, palavras: msPhPalavras, ouvir: msPhOuvir, regra: msPhRegra, produzir: msPhProduzir, usar: msPhUsar}[cur](l, p);
  fill(box, head, body);
  if (cur === "ouvir") msMountOuvir(l, p);
}

// ---------- Etapas ----------
function msPhSobre(l, p) {
  return h("div", {class: "aula-step ms-sobre"},
    h("p", {class: "aula-lede", text: p.sobre}),
    p.quem ? h("p", {class: "muted small-text", text: "Quem fala no áudio: " + p.quem}) : null,
    h("p", {class: "ms-bookref"}, icon("book", 16), h("span", {text: "No livro: " + p.pag})),
    p.palavras ? [h("p", {class: "label", text: "As palavras deste passo"}), msWordList(p.palavras)] : null,
    h("div", {class: "row"}, msNextButton(p.palavras ? "Treinar estas palavras" : null)));
}
function msNewDrill(words) { return {items: words, queue: words.map((w, k) => k), pos: 0, tried: new Set(), firstOk: 0, res: null}; }
function msInputRow(onCheck, opts = {}) {
  const P = menschen.passo, done = !!(opts.res || P.res);
  const input = h(opts.big ? "textarea" : "input", {id: "msInput", lang: "de", type: opts.big ? null : "text", rows: opts.big ? "7" : null, class: "ms-input" + (opts.big ? " big" : ""),
    spellcheck: "false", autocomplete: "off", placeholder: opts.placeholder || "", readonly: done});
  input.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.shiftKey || (opts.big && !e.ctrlKey && !done)) return;
    e.preventDefault();
    if (done) (opts.onNext || msNext)(); else onCheck();
  });
  const voice = typeof speechAvailable === "function" && speechAvailable() && !done;
  return [input, h("div", {class: "row"},
    done ? null : h("button", {class: "primary", type: "button", disabled: P.busy, onclick: () => onCheck()}, P.busy ? "Conferindo…" : "Conferir", h("kbd", null, opts.big ? "Ctrl+Enter" : "Enter")),
    voice ? h("button", {type: "button", class: P.clip ? "danger-solid" : "", onclick: () => msVoice(opts.big ? 90000 : 15000)}, icon(P.clip ? "stop" : "mic", 18), P.clip ? "Parar" : "Falar") : null,
    done || opts.noGiveUp ? null : h("button", {class: "quiet small", type: "button", onclick: () => onCheck(true)}, "Não sei"))];
}
async function msVoice(maxMs) {
  const P = menschen.passo;
  if (!P) return;
  if (P.clip) { P.clip.stop(); return; }
  stopAudio();
  const before = ($("msInput") || {}).value || "";
  const clip = await startClip(maxMs);
  if (!clip) return;
  P.clip = clip;
  msRenderPasso();
  msKeep(before);
  const blob = await clip.done;
  if (P.clip === clip) P.clip = null;
  if (menschen.passo !== P) return;
  msRenderPasso();
  try {
    const text = await transcribeBlob(blob, maxMs > 20000);
    const el = $("msInput");
    if (el && text) { el.value = (before && maxMs > 20000 ? before.trim() + " " : "") + text; el.focus(); setStatus("Confira o que o app ouviu e aperte Conferir.", "info"); }
  } catch (e) { setStatus("Não foi possível transcrever a fala: " + e.message, "error"); }
}
function msKeep(text) { const el = $("msInput"); if (el) el.value = text; }

/* Palavras: do português para o alemão. Errou → volta no fim da rodada; só a 1ª tentativa de cada palavra mexe na caixa. */
function msPhPalavras(l, p) {
  const P = menschen.passo;
  if (!P.drill) P.drill = msNewDrill(p.palavras);
  const D = P.drill;
  if (D.pos >= D.queue.length) return msDrillEnd(D);
  const w = D.items[D.queue[D.pos]], r = D.res;
  const check = giveUp => {
    if (D.res) return;
    const typed = giveUp === true ? "" : ($("msInput").value || "").trim();
    if (!typed && giveUp !== true) { $("msInput").focus(); return; }
    const c = msWordCheck(w[0], typed), idx = D.queue[D.pos];
    if (!D.tried.has(idx)) {
      D.tried.add(idx);
      msWordRecord(w[0], c.ok);
      if (c.ok) D.firstOk++;
      P.words.n++; if (c.ok) P.words.ok++;
      saveProgress();
    }
    if (!c.ok && D.queue.indexOf(idx, D.pos + 1) < 0) D.queue.push(idx);
    D.res = {...c, typed};
    if (c.ok && typeof uiSound === "function") uiSound("ok");
    if (typeof fichaSay === "function") fichaSay(w[0].replace(/\s*\([^)]*\)/g, ""));
    msRenderPasso();
    msKeep(typed);
  };
  const next = () => { D.pos++; D.res = null; msRenderPasso(); const el = $("msInput"); if (el) el.focus(); };
  const hint = msWordHint(w);
  return h("div", {class: "aula-step ms-drill"},
    h("p", {class: "ms-kicker", text: "Palavra " + Math.min(D.pos + 1, D.queue.length) + " de " + D.queue.length}),
    h("p", {class: "label", text: "Como se diz em alemão?"}),
    h("p", {class: "aula-pt", text: w[2]}),
    hint ? h("p", {class: "muted small-text", text: "Escreva " + hint + "."}) : null,
    ...msInputRow(check, {res: r, onNext: next, placeholder: "em alemão"}),
    r ? h("div", {class: "aula-result " + (r.ok ? "ok" : "no")},
      h("p", {class: "aula-status", text: r.ok ? (r.close ? "Certo, só confira a grafia:" : "Certo!") : r.article ? "A palavra está certa, o artigo não:" : r.typed ? "A certa é:" : "Esta é a palavra:"}),
      h("p", {class: "ms-drill-de"}, msWordDe(w), w[1] ? h("span", {class: "ms-extra", lang: "de", text: " " + w[1]}) : null,
        typeof fichaHear === "function" ? fichaHear(w[0].replace(/\s*\([^)]*\)/g, "")) : null),
      !r.ok ? h("p", {class: "muted small-text", text: "Ela volta no fim da rodada."}) : null,
      h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: next}, "Próxima", h("kbd", null, "Enter")),
        !r.ok && r.typed ? h("button", {class: "quiet small", type: "button", onclick: e => {
          e.currentTarget.remove();
          const idx = D.queue[D.pos], at = D.queue.indexOf(idx, D.pos + 1);
          if (at >= 0) D.queue.splice(at, 1);
          msWordRecord(w[0], true); D.firstOk++; P.words.ok++; saveProgress(); toast("Contei como certo.", "success");
        }}, "Eu acertei (o app errou)") : null)) : null,
    r ? null : h("div", {class: "row"}, h("button", {class: "quiet small", type: "button", onclick: msNext}, "Pular as palavras")));
}
function msDrillEnd(D) {
  const P = menschen.passo, total = D.items.length;
  return h("div", {class: "aula-step aula-end"},
    h("h3", {text: "Palavras: " + D.firstOk + " de " + total + " de primeira"}),
    h("p", {class: "muted", text: "Cada palavra volta para revisão em 1, 3, 7… dias (as erradas, antes). A lista do dia aparece na página da lição."}),
    h("div", {class: "row"},
      P.review ? h("button", {class: "primary", type: "button", onclick: () => msClosePasso()}, "Voltar à lição") : msNextButton(),
      h("button", {class: "small", type: "button", onclick: () => { P.drill = msNewDrill(D.items); msRenderPasso(); }}, iconText("repeat", "De novo"))));
}
function msFaixaLabel(l, id, uso) {
  const f = (l.faixas || []).find(x => x[0] === id);
  return f ? f[1] : (uso === "cena" ? "A cena" : "Faixa " + id);
}
function msPhOuvir(l, p) {
  const P = menschen.passo, list = p.faixas.map(([id, uso]) => ({id, uso: uso || "cena", label: msFaixaLabel(l, id, uso)}));
  if (!P.faixa || !list.some(f => f.id === P.faixa)) P.faixa = list[0].id;
  return h("div", {class: "aula-step ms-ouvir"},
    list.length > 1 ? h("div", {class: "chips ms-faixa-chips", role: "group", "aria-label": "Áudios deste passo"}, ...list.map(f =>
      h("button", {class: "chip", type: "button", "aria-pressed": String(f.id === P.faixa), onclick: () => { msStop(); P.faixa = f.id; msRenderPasso(); }},
        h("span", {class: "ms-track-book", text: f.id.startsWith("kb") ? "KB" : "AB"}), " " + f.label))) : null,
    h("div", {id: "msPlayer"}),
    h("div", {class: "row ms-foot"}, msNextButton()));
}
function msMountOuvir(l, p) {
  const P = menschen.passo, f = p.faixas.find(x => x[0] === P.faixa) || p.faixas[0];
  if (menschen.track && menschen.track.id === f[0]) { msRenderPlayer(); return; }
  msOpenTrack({id: f[0], label: msFaixaLabel(l, f[0], f[1]), uso: f[1] || "cena"}, {embedded: true, ctx: f[1] === "cena" || !f[1] ? {sobre: p.sobre, quem: p.quem} : null});
}
/* regra.aula (opcional): a explicação em conversa, uma ideia por vez. {resumo, ideias: [{titulo, blocos}], bolso: [linhas]}.
   Blocos: fala (texto), lado (português × alemão), tabela, macete, erro (o erro de brasileiro), troca e complete (as peças das
   fichas). Sem regra.aula, a etapa usa o formato antigo: foco + visuais + interativo. */
const MS_RULE_COLORS = [["m", "masculino"], ["n", "neutro"], ["f", "feminino"], ["p", "plural"], ["v", "verbo"], ["x", "o que muda"]];
function msRuleLegend(aula) {
  const s = JSON.stringify(aula);
  return MS_RULE_COLORS.filter(([k]) => s.includes("{" + k + "|"));
}
function msRuleBlock(b, topic) {
  if (b.tipo === "fala") return h("p", {class: "mr-fala"}, ...fichaMark(b.texto));
  if (b.tipo === "macete") return h("div", {class: "fx-macete"}, h("span", {class: "fx-macete-tag", text: "Macete"}), h("p", null, ...fichaMark(b.texto)));
  if (b.tipo === "lado") return h("div", {class: "mr-lado"},
    h("p", {class: "mr-lado-head", "aria-hidden": "true"}, h("span", {text: "Em português"}), h("span", {text: "Em alemão"})),
    ...b.itens.map(([pt, de]) => h("div", {class: "mr-lado-row"}, h("p", {class: "mr-pt"}, ...fichaMark(pt)),
      h("p", {class: "mr-de", lang: "de"}, h("span", null, ...fichaMark(de)), fichaHear(de)))));
  if (b.tipo === "tabela") return fichaTable(b);
  if (b.tipo === "erro") return h("div", {class: "trap"}, h("b", {text: "O erro de quem fala português"}),
    h("p", {class: "trap-pt"}, "Você quer dizer: ", h("i", {text: "“" + b.pt + "”"})),
    h("p", {class: "trap-wrong", lang: "de"}, h("span", {text: "✗ "}), b.errado),
    h("p", {class: "trap-right", lang: "de"}, h("span", {text: "✓ "}), ...fichaMark(b.certo), fichaHear(b.certo)),
    h("p", {class: "mr-porque"}, ...fichaMark(b.porque)));
  return fichaWidget(b, topic);
}
function msRuleIdea(idea, k, total, topic) {
  return h("section", {class: "mr-ideia"},
    h("h3", {class: "mr-titulo"}, h("span", {class: "mr-num", "aria-label": "Ideia " + (k + 1) + " de " + total, text: String(k + 1)}), h("span", null, ...fichaMark(idea.titulo))),
    ...idea.blocos.map(b => msRuleBlock(b, topic)));
}
function msRuleAula(r, foot) {
  const P = menschen.passo, A = r.aula, n = A.ideias.length;
  P.regraK = Math.min(n, Math.max(1, P.regraK || 1));
  const list = h("div", {class: "mr-ideias"}), more = h("div", {class: "row mr-more"}), end = h("div", {class: "mr-fim"});
  const add = k => { const el = msRuleIdea(A.ideias[k], k, n, r.topic); list.append(el); return el; };
  const update = () => {
    if (P.regraK >= n) {
      fill(more);
      fill(end, A.bolso ? h("div", {class: "mr-bolso"}, h("p", {class: "label", text: "Para levar no bolso"}), h("ol", null, ...A.bolso.map(x => h("li", null, ...fichaMark(x))))) : null, ...foot);
      return;
    }
    fill(more,
      h("button", {class: "primary", type: "button", onclick: () => {
        const el = add(P.regraK++);
        update();
        el.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
      }}, "Entendi, próxima ideia"),
      h("span", {class: "muted small-text", text: "Ideia " + P.regraK + " de " + n}),
      h("button", {class: "quiet small", type: "button", onclick: () => { while (P.regraK < n) add(P.regraK++); update(); }}, "Ver tudo"));
  };
  for (let k = 0; k < P.regraK; k++) add(k);
  update();
  const legend = msRuleLegend(A);
  return [h("p", {class: "aula-lede mr-resumo"}, ...fichaMark(A.resumo)),
    legend.length ? h("p", {class: "mr-legenda", "aria-label": "Legenda das cores"}, ...legend.map(([k, label]) => h("mark", {class: "mr mr-" + k, text: label}))) : null,
    list, more, end];
}
function msPhRegra(l, p) {
  const r = p.regra, t = typeof GRAMMAR_BY_ID !== "undefined" ? GRAMMAR_BY_ID.get(r.topic) : null;
  const full = t && typeof fichaOf === "function" && fichaOf(r.topic) ? fichaNodes(t, false) : null;
  const foot = [
    full ? h("details", {class: "fx-calma ms-ficha-full"}, h("summary", null, h("b", {text: "A ficha completa"}), h("span", {class: "muted small-text", text: t.title})), ...full) : null,
    h("div", {class: "row ms-foot"}, msNextButton(),
      t ? h("button", {class: "quiet small", type: "button", onclick: () => { msClosePasso(true); showView("grammar"); startAula(r.topic, "Menschen · Lektion " + l.n); }}, "Aula de gramática: " + t.title) : null)];
  if (r.aula) return h("div", {class: "aula-step ms-regra aula-ficha mr-aula"}, ...msRuleAula(r, foot));
  return h("div", {class: "aula-step ms-regra aula-ficha"},
    h("p", {class: "aula-lede", text: r.foco}),
    ...(r.visuais || []).map(v => fichaTable(v)),
    ...(r.interativo || []).map(w => fichaWidget(w, r.topic)),
    ...foot);
}
/* Frases da lição para produzir: as que você ainda não viu no Treino primeiro, depois as que você mais esqueceu. */
function msProdCards(p, skip = [], now = Date.now()) {
  const list = p.frases.map(id => byId.get(id)).filter(c => c && !skip.includes(c.id));
  const seen = c => cardProgress(c.id) && cardProgress(c.id).introducedAt;
  const r = c => { const m = modeProgress(c.id, "production"); return m ? retrievabilityNow(m, now) : 0; };
  return [...list.filter(c => !seen(c)), ...list.filter(seen).sort((a, b) => r(a) - r(b))].slice(0, MS_PRODUCE).map(c => c.id);
}
function msPhProduzir(l, p) {
  const P = menschen.passo;
  if (!P.prod) P.prod = {ids: msProdCards(p), k: 0, ok: 0, n: 0, done: []};
  const pr = P.prod;
  if (pr.k >= pr.ids.length) return msProdEnd(l, p);
  const c = byId.get(pr.ids[pr.k]), r = P.res;
  const next = () => { pr.k++; P.res = null; msRenderPasso(); const el = $("msInput"); if (el) el.focus(); };
  const check = async giveUp => {
    if (P.busy || P.res) return;
    const typed = giveUp === true ? "" : ($("msInput").value || "").trim();
    if (!typed && giveUp !== true) { $("msInput").focus(); return; }
    P.busy = true; msRenderPasso(); msKeep(typed);
    const d = typed ? diffLine(c.frase, typed) : null;
    const lt = typed ? await ltCheck(typed) : null, ltErr = (lt || []).filter(m => m.cat !== "STYLE");
    let grade = !typed ? "no" : d.pct >= .85 ? "ok" : d.pct >= .6 ? "quase" : "no";
    if (grade === "ok" && ltErr.some(m => m.cat === "GRAMMAR")) grade = "quase";
    pr.n++; if (grade === "ok") pr.ok++;
    pr.done.push(c.id);
    P.busy = false;
    P.res = {grade, typed, d, lt: ltErr};
    if (grade === "ok" && typeof uiSound === "function") uiSound("ok");
    msRenderPasso(); msKeep(typed);
  };
  const situ = String(c.situacao || "").replace(/^\[(du|Sie|ihr|neutro|escrito)\]\s*/, "");
  const msg = r && {ok: "Certo!", quase: "Quase: compare com a frase modelo.", no: r.typed ? "Compare com a frase modelo." : "Esta é a frase:"}[r.grade];
  return h("div", {class: "aula-step"},
    h("p", {class: "ms-kicker", text: "Frase " + (pr.k + 1) + " de " + pr.ids.length}),
    h("p", {class: "label", text: "Como se diz em alemão?"}),
    h("p", {class: "aula-pt", text: c.traducao}),
    situ ? h("p", {class: "muted small-text", text: situ}) : null,
    ...msInputRow(check, {res: r, onNext: next, placeholder: "Escreva ou fale a frase em alemão"}),
    r ? h("div", {class: "aula-result " + r.grade},
      h("p", {class: "aula-status", text: msg}),
      r.typed ? h("div", null, h("p", {class: "muted small-text", text: "Frase modelo (verde = igual ao que você escreveu):"}), r.d.line)
        : h("p", {class: "aula-de", lang: "de", text: c.frase}),
      c.alvo ? h("p", {class: "muted small-text"}, "O ponto: ", h("span", {lang: "de", text: c.alvo})) : null,
      r.lt && r.lt.length ? [h("p", {class: "label", text: "O corretor encontrou"}), ltList(r.typed, r.lt)] : null,
      h("div", {class: "row"},
        h("button", {class: "primary", type: "button", onclick: next}, "Próxima", h("kbd", null, "Enter")),
        h("button", {class: "small", type: "button", onclick: () => speakCard(c)}, iconText("volume", "Ouvir")),
        r.grade !== "ok" && r.typed ? h("button", {class: "quiet small", type: "button", onclick: e => {
          e.currentTarget.remove(); pr.ok++; r.grade = "ok"; toast("Contei como certo.", "success");
        }}, "A minha versão também está certa") : null)) : null);
}
function msProdEnd(l, p) {
  const P = menschen.passo, pr = P.prod, more = msProdCards(p, pr.done);
  return h("div", {class: "aula-step aula-end"},
    h("h3", {text: "Frases: " + pr.ok + " de " + pr.n + " certas"}),
    h("p", {class: "muted", text: "As frases desta lição também entram no Treino de todo dia, com revisão espaçada, enquanto a Lektion " + l.n + " for a sua lição."}),
    h("div", {class: "row"}, msNextButton(),
      more.length ? h("button", {class: "small", type: "button", onclick: () => { P.prod = {ids: more, k: 0, ok: 0, n: 0, done: pr.done}; P.res = null; msRenderPasso(); }}, "Mais " + plural(more.length, "frase", "frases")) : null,
      h("button", {class: "quiet small", type: "button", onclick: () => { msClosePasso(true); msStudy(l.n); }}, "Estudar no Treino")));
}
/* Sua vez: frase (ou história) sua. O que a lição pede é conferido por regra (checks); o resto, pelo corretor. */
function msUseChecks(u, typed) {
  return (u.checks || []).map(([label, re, min]) => {
    const n = (String(typed || "").match(new RegExp(re, "gu")) || []).length;
    return {label, ok: n >= (min || 1), n, min: min || 1};
  });
}
function msPhUsar(l, p) {
  const P = menschen.passo, u = p.usar, r = P.res;
  const check = async giveUp => {
    if (P.busy || P.res) return;
    const typed = giveUp === true ? "" : ($("msInput").value || "").trim();
    if (!typed) { if (giveUp === true) { P.res = {typed: ""}; msRenderPasso(); } else $("msInput").focus(); return; }
    P.busy = true; msRenderPasso(); msKeep(typed);
    const lt = await ltCheck(typed);
    P.busy = false;
    P.res = {typed, checks: msUseChecks(u, typed), lt: (lt || []).filter(m => m.cat !== "STYLE"), ltOn: lt !== null};
    msRenderPasso(); msKeep(typed);
  };
  const allOk = r && r.typed && r.checks.every(c => c.ok) && !r.lt.length;
  return h("div", {class: "aula-step ms-usar"},
    h("p", {class: "label", text: u.grande ? "Para fechar a lição" : "Agora você"}),
    h("p", {class: "aula-pt", text: u.pt}),
    u.ex ? h("p", {class: "muted small-text"}, "Para começar: ", h("span", {lang: "de", text: u.ex})) : null,
    u.checks && u.checks.length && !r ? h("ul", {class: "ms-checks pending"}, ...u.checks.map(([label]) => h("li", null, h("span", {class: "ms-ck"}), h("span", {text: label})))) : null,
    ...msInputRow(check, {res: r, big: !!u.grande, noGiveUp: !!u.grande, placeholder: u.grande ? "Escreva (ou fale) a sua história em alemão" : "Sua frase em alemão"}),
    r ? h("div", {class: "aula-result " + (!r.typed ? "no" : allOk ? "ok" : "quase")},
      r.typed ? [
        h("p", {class: "aula-status", text: allOk ? "Muito bom: você usou o que a lição ensina e o corretor não achou erro." : "Veja o que falta e o que o corretor encontrou."}),
        h("ul", {class: "ms-checks"}, ...r.checks.map(c => h("li", {class: c.ok ? "ok" : "no"}, h("span", {class: "ms-ck"}, c.ok ? icon("check", 14) : null),
          h("span", {text: c.label + (c.min > 1 && !c.ok ? " (" + c.n + " de " + c.min + ")" : "")})))),
        r.lt.length ? [h("p", {class: "label", text: "O corretor encontrou"}), ltList(r.typed, r.lt)]
          : h("p", {class: "muted small-text", text: r.ltOn ? "O corretor não achou erros." : "Sem o corretor agora: confira com o tutor."}),
        h("p", {class: "muted small-text", text: "O corretor não pega ordem das palavras nem todo erro de caso: na dúvida, leve o texto para a aula."})]
        : h("p", {class: "aula-status", text: "Tudo bem, fica para a próxima."}),
      h("div", {class: "row"},
        msNextButton(),
        r.typed ? h("button", {class: "small", type: "button", onclick: () => { P.res = null; msRenderPasso(); msKeep(r.typed); const el = $("msInput"); if (el) el.focus(); }}, "Corrigir e conferir de novo") : null,
        r.typed && !u.grande ? h("button", {class: "quiet small", type: "button", onclick: e => { e.currentTarget.disabled = true; addMineDrafts(r.typed, convAvailable(), "menschen"); toast("Rascunho criado em Minhas frases: confira e salve lá.", "success"); }}, "Criar cartão") : null)) : null,
    u.conversa && typeof convAvailable === "function" && convAvailable() ? h("div", {class: "row ms-foot"},
      h("button", {class: "quiet small", type: "button", onclick: () => { msClosePasso(true); msTalk(l); }}, iconText("chat", "Contar falando com a IA"))) : null);
}
function msPassoEnd(l, p) {
  const P = menschen.passo;
  if (P.review) return msDrillEnd(P.drill);
  const k = l.passos.indexOf(p), next = l.passos.slice(k + 1).find(x => !msPassoDone(l.n, x.id)) || l.passos[k + 1];
  const pr = P.prod;
  return h("div", {class: "aula-step aula-end"},
    h("h2", {text: "Passo " + (k + 1) + " concluído"}),
    P.words.n || (pr && pr.n) ? h("p", null,
      P.words.n ? ["Palavras: ", h("b", {text: P.words.ok + " de " + P.words.n}), " de primeira"] : null,
      P.words.n && pr && pr.n ? " · " : null,
      pr && pr.n ? ["Frases: ", h("b", {text: pr.ok + " de " + pr.n})] : null) : null,
    h("div", {class: "row"},
      next ? h("button", {class: "primary", type: "button", onclick: () => msOpenPasso(l.n, next.id)}, "Passo " + (l.passos.indexOf(next) + 1) + ": " + next.titulo) : null,
      h("button", {class: next ? "" : "primary", type: "button", onclick: () => msClosePasso()}, "Voltar à lição")));
}

// ---------- A página da lição ----------
function msAulaHome(l, blocks) {
  const next = msNextPasso(l), doneN = l.passos.filter(p => msPassoDone(l.n, p.id)).length, due = msDueWords().length;
  const hero = h("div", {class: "panel ms-hero"},
    next ? [
      h("p", {class: "ms-kicker", text: doneN ? "Continue de onde parou · " + doneN + " de " + l.passos.length + " passos feitos" : "Comece por aqui · a lição tem " + l.passos.length + " passos, na ordem do livro"}),
      h("h3", {class: "ms-hero-title", text: "Passo " + (l.passos.indexOf(next) + 1) + " · " + next.titulo}),
      h("p", {class: "muted small-text", text: next.pag}),
      h("p", {class: "ms-hero-sobre", text: next.sobre}),
      h("button", {class: "primary", type: "button", onclick: () => msOpenPasso(l.n, next.id)}, iconText("play", doneN ? "Continuar" : "Começar a aula"))]
    : [h("p", {class: "ms-kicker", text: "Lição completa"}),
      h("h3", {class: "ms-hero-title", text: "Você fez os " + l.passos.length + " passos da Lektion " + l.n}),
      h("p", {class: "muted", text: "Revise as palavras, refaça um passo quando quiser e marque a próxima lição quando a aula do curso chegar lá."})],
    h("div", {class: "ms-bar"}, h("span", {style: "width:" + Math.round(doneN / l.passos.length * 100) + "%"})));
  const list = h("ol", {class: "ms-passos", "aria-label": "Passos da lição"}, ...l.passos.map((p, k) => {
    const done = msPassoDone(l.n, p.id);
    return h("li", null, h("button", {class: "ms-passo" + (done ? " done" : "") + (p === next ? " next" : ""), type: "button", onclick: () => msOpenPasso(l.n, p.id)},
      h("span", {class: "ms-passo-n"}, done ? icon("check", 16) : String(k + 1)),
      h("span", {class: "ms-passo-txt"}, h("b", {text: p.titulo}), h("span", {class: "muted small-text", text: p.pag}))));
  }));
  const review = due ? h("div", {class: "panel ms-review"},
    h("p", null, h("b", {text: String(due)}), " " + (due === 1 ? "palavra para revisar hoje" : "palavras para revisar hoje")),
    h("button", {type: "button", onclick: msOpenReview}, iconText("repeat", "Revisar agora"))) : null;
  const all = h("details", {class: "ms-all"}, h("summary", null, h("b", {text: "Tudo da Lektion " + l.n}),
    h("span", {class: "muted small-text", text: "metas, frases, gramática, áudios, palavras e conversa, sem ordem"})), h("div", {class: "ms-grid"}, ...blocks));
  return [h("div", {class: "ms-home"}, hero, h("div", {class: "panel ms-passos-box"}, h("h3", {text: "Os passos"}), list), review), all];
}
