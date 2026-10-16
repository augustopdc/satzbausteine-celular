"use strict";
/* Minhas frases: cartões criados pelo usuário (frases da aula, de séries, de livros e erros da Conversa).
   Ficam em progress.mine.items (entram no backup e na sincronização; apagar deixa uma marca com deleted para a
   sincronização não trazer o cartão de volta). Viram cartões comuns (Thema::Meine) no treino, com FSRS.
   A parceira de conversa (LLM local) preenche tradução, situação, molde, foco e nível; o usuário revisa.
   Carregado antes de app.js; usa o estado e as funções de app.js apenas quando chamado. */

const MINE_ID = /^M-[a-z0-9]{6,20}$/;
const MINE_SOURCES = {aula: "Aula", serie: "Série ou filme", livro: "Livro", conversa: "Conversa", escrita: "Escrita", cena: "Cena", outro: "Outro"};
const MINE_LEVELS = ["A1", "A2", "B1", "B2"];
const MINE_REGS = {du: "du · informal", Sie: "Sie · formal", neutro: "neutro"};
const MINE_CHECKS = {conferir: "Para conferir", tutor: "Validado pelo tutor"};
const minePending = m => !!m && !m.deleted && m.check === "conferir";
const mine = {drafts: [], busy: false, editing: null};

function isMine(card) { return !!card && MINE_ID.test(card.id); }
function mineData() { return progress.mine || (progress.mine = {items: {}}); }
function newMineId() { return "M-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function sanitizeMineItem(m) {
  if (!m || typeof m !== "object") return null;
  const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
  const updatedAt = Number(m.updatedAt) || Number(m.at) || 0;
  if (!(updatedAt > 0)) return null;
  if (m.deleted) return {deleted: true, updatedAt};
  const item = {frase: str(m.frase, 400), traducao: str(m.traducao, 400), situacao: str(m.situacao, 400), molde: str(m.molde, 400), foco: str(m.foco, 300),
    reg: MINE_REGS[m.reg] ? m.reg : "neutro", nivel: MINE_LEVELS.includes(m.nivel) ? m.nivel : "A1", fonte: MINE_SOURCES[m.fonte] ? m.fonte : "outro",
    at: Number(m.at) || updatedAt, updatedAt};
  // check: "conferir" (criado pela IA sem você revisar; fica fora do treino), "tutor" (validado pelo tutor). Sem campo = conferido.
  if (MINE_CHECKS[m.check]) item.check = m.check;
  if (!item.frase || !item.traducao) return null;
  if (m.erro && typeof m.erro === "object" && m.erro.certo) item.erro = {errado: str(m.erro.errado, 300), certo: str(m.erro.certo, 300), explicacao: str(m.erro.explicacao, 500)};
  return item;
}
function sanitizeMine(src) {
  const out = {items: {}};
  if (!src || typeof src !== "object" || !src.items || typeof src.items !== "object") return out;
  for (const [id, m] of Object.entries(src.items)) { const item = MINE_ID.test(id) ? sanitizeMineItem(m) : null; if (item) out.items[id] = item; }
  return out;
}
/* Vale a versão mais recente de cada cartão (inclusive a marca de apagado). */
function mergeMine(local, incoming) {
  const out = sanitizeMine(local);
  for (const [id, m] of Object.entries(sanitizeMine(incoming).items)) if (!out.items[id] || m.updatedAt > out.items[id].updatedAt) out.items[id] = m;
  return out;
}
function mineToCard(id, m) {
  const layer = {A1: 1, A2: 2, B1: 3, B2: 3}[m.nivel] || 1, register = {du: "du", Sie: "Sie", neutro: "neutral"}[m.reg];
  return {id, situacao: "[" + m.reg + "] " + (m.situacao || "Diga em alemão: “" + m.traducao + "”"), frase: m.frase, audio: "", traducao: m.traducao,
    molde: m.molde, alvo: m.foco, erro: m.erro || null,
    tags: `Funktion::Eigene Register::${register} Niveau::${m.nivel} Prio::1 Modus::Produktion Bezug::Meine Quelle::Meine Schicht::${layer} Thema::Meine`};
}
/* Cartões “para conferir” ainda não entram no treino (nem nas listas de frases). */
function mineCards() { return Object.entries(mineData().items).filter(([, m]) => !m.deleted && !minePending(m)).map(([id, m]) => mineToCard(id, m)); }
function minePendingItems() { return Object.entries(mineData().items).filter(([, m]) => minePending(m)).sort((a, b) => b[1].at - a[1].at); }
function setMineCheck(id, check) {
  const m = mineData().items[id];
  if (!m || m.deleted) return;
  const next = {...m};
  if (check) next.check = check; else delete next.check;
  saveMineItem(id, next);
}
/* Recoloca os cartões próprios na lista de frases (depois de criar, editar, apagar ou sincronizar). */
function applyMine() {
  cards = cards.filter(c => !isMine(c)).concat(mineCards());
  refreshCards();
}
function saveMineItem(id, fields) {
  const now = Date.now(), old = mineData().items[id];
  const item = sanitizeMineItem({...fields, at: old && !old.deleted ? old.at : now, updatedAt: now});
  if (!item) return false;
  mineData().items[id] = item;
  saveProgress();
  applyMine();
  return true;
}
function deleteMineItem(id) {
  mineData().items[id] = {deleted: true, updatedAt: Date.now()};
  if (progress.cards[id]) { delete progress.cards[id]; saveProgress([id]); } else saveProgress();
  applyMine();
}

// ---------- Preencher com a IA ----------
const MINE_SCHEMA = {type: "object", properties: {frase: {type: "string"}, correta: {type: "boolean"}, correcao: {type: "string"}, traducao: {type: "string"},
  situacao: {type: "string"}, registro: {type: "string", enum: ["du", "Sie", "neutro"]}, molde: {type: "string"}, foco: {type: "string"},
  nivel: {type: "string", enum: MINE_LEVELS}}, required: ["frase", "correta", "correcao", "traducao", "situacao", "registro", "molde", "foco", "nivel"]};
function mineSystemPrompt() {
  return [`You create flashcards for Luiz, a Brazilian doctor learning German (his level now: ${convLevel()}). You get a German sentence (sometimes also a correction). Answer as JSON:`,
    "- frase: the German sentence to learn. It must be correct, natural German. If the input has a real mistake, fix it with minimal changes; keep correct colloquial forms (e.g. \"hab\", \"'nen\") as they are.",
    "- correta: true if the input sentence was already correct German.",
    "- correcao: if it was not correct, one short sentence in Brazilian Portuguese explaining the mistake; otherwise an empty string.",
    "- traducao: a natural Brazilian Portuguese translation.",
    "- situacao: a short instruction in Brazilian Portuguese that makes Luiz say exactly this sentence, describing the intention, not translating word by word. Examples: \"Apoie uma viagem de trem por ser mais confortável que dirigir.\", \"Peça que o paciente tire a roupa da parte de cima.\", \"Você não sabe a resposta à pergunta; diga isso diretamente.\"",
    "- registro: \"du\", \"Sie\" or \"neutro\" (neutro if the sentence works with both).",
    "- molde: the same sentence with one or two exchangeable parts replaced by ___ (a reusable pattern), e.g. \"Ich nehme ___, weil das bequemer ist.\"; empty string if there is no useful pattern.",
    "- foco: the key word or structure to notice, short, in Brazilian Portuguese with the German form, e.g. \"bequemer é comparativo de bequem.\"",
    "- nivel: CEFR level of the sentence (A1, A2, B1 or B2)."].join("\n");
}
async function mineFill(text, erro) {
  let user = "Sentence: " + text;
  if (erro) user = "Luiz said (with a mistake): " + (erro.frase || erro.errado) + "\nCorrection: " + erro.errado + " → " + erro.certo + (erro.explicacao ? " (" + erro.explicacao + ")" : "") + "\nCreate the card for Luiz's whole sentence, corrected.";
  const r = await window.satzDesktop.convChat([{role: "system", content: mineSystemPrompt()}, {role: "user", content: user}], {kind: "mine", temperature: .2, maxTokens: 600, schema: MINE_SCHEMA});
  const j = parseLooseJson(r.text);
  if (!j || !j.frase || !j.traducao) throw new Error("A resposta da IA veio incompleta.");
  const c = s => convClean(s);
  return {frase: c(j.frase), correta: j.correta !== false, correcao: c(j.correcao), traducao: c(j.traducao), situacao: c(j.situacao),
    reg: MINE_REGS[j.registro] ? j.registro : "neutro", molde: c(j.molde).replace(/_+/g, "___").replace(/\s+,/g, ","), foco: c(j.foco), nivel: MINE_LEVELS.includes(j.nivel) ? j.nivel : "A1"};
}
/* Da Conversa: cria o cartão direto a partir de um erro ou de uma frase para praticar. */
async function mineFromConversa(entry) {
  const f = entry.erro ? await mineFill(entry.erro.certo, entry.erro) : await mineFill(entry.frase);
  const id = newMineId();
  const erro = entry.erro ? {errado: entry.erro.errado, certo: entry.erro.certo, explicacao: entry.erro.explicacao} : (!f.correta && f.correcao ? {errado: entry.frase, certo: f.frase, explicacao: f.correcao} : null);
  // A correção e o cartão vêm da IA sem você ver: por padrão, esperam a conferência em Minhas frases.
  saveMineItem(id, {...f, fonte: MINE_SOURCES[entry.fonte] ? entry.fonte : "conversa", erro, check: settings.mineReview !== false ? "conferir" : undefined});
  return id;
}

// ---------- Tela ----------
function renderMinhas() {
  if (convAvailable() && !conv.status && !mine.statusAsked) {
    mine.statusAsked = true;
    window.satzDesktop.convStatus().then(s => { conv.status = s; if (currentView === "minhas") renderMinhas(); }).catch(() => {});
  }
  const items = Object.entries(mineData().items).filter(([, m]) => !m.deleted && !minePending(m)).sort((a, b) => b[1].at - a[1].at);
  const waiting = minePendingItems();
  const ai = !!(conv.status && conv.status.installed);
  const input = h("textarea", {id: "mineInput", lang: "de", rows: "4", spellcheck: "false", placeholder: "Cole ou escreva frases em alemão, uma por linha.\nEx.: Ich hab keine Ahnung, wo er ist."});
  const source = h("select", {id: "mineSource", "aria-label": "De onde vem a frase"}, ...Object.entries(MINE_SOURCES).map(([k, v]) => h("option", {value: k}, v)));
  source.value = settings.mineSource || "aula";
  source.addEventListener("change", () => { settings.mineSource = source.value; saveSettings(); });
  const pending = mine.drafts.length;
  fill($("mineAdd"),
    h("h2", {text: "Adicionar frases"}),
    h("p", {class: "muted small-text", text: "Frases da aula, de séries, de livros ou do dia a dia (a “mineração de frases” do Refold). A parceira de conversa preenche tradução, situação, molde e foco; você confere e salva. Se a frase tiver erro, ela sugere a correção."}),
    input,
    h("div", {class: "row between spaced"},
      h("label", {class: "inline-field"}, "Origem: ", source),
      h("div", {class: "row"},
        h("button", {type: "button", class: "quiet", onclick: () => { addMineDrafts(input.value, false); input.value = ""; }}, "Preencher eu mesmo"),
        h("button", {type: "button", class: "primary", disabled: !ai || mine.busy, onclick: () => { addMineDrafts(input.value, true); input.value = ""; }}, mine.busy ? "Preparando…" : "Preparar cartões com a IA"))),
    !ai ? h("p", {class: "muted small-text", text: "Sem a parceira de conversa instalada, preencha os campos você mesmo."}) : null);
  const review = h("label", {class: "inline-field small-text"}, h("input", {type: "checkbox", checked: settings.mineReview !== false,
    onchange: e => { settings.mineReview = e.target.checked; saveSettings(); }}), " Conferir antes de treinar os cartões que a IA cria a partir da Conversa e do 4/3/2");
  fill($("mineDrafts"), pending ? h("h2", {text: "Para revisar (" + pending + ")"}) : null, ...mine.drafts.map(draftForm),
    pending > 1 ? h("div", {class: "row"}, h("button", {type: "button", class: "primary", onclick: saveAllDrafts}, "Salvar todos")) : null,
    waiting.length ? h("section", {class: "panel soft mine-check"},
      h("h2", {text: "Criados pela IA: conferir antes de treinar (" + waiting.length + ")"}),
      h("p", {class: "muted small-text", text: "A correção e a frase vêm da IA, que às vezes erra. Confira (ou leve à aula: eles saem no Pacote para a aula). Só entram no treino depois de conferidos."}),
      ...waiting.map(([id, m]) => mineCheckRow(id, m)),
      waiting.length > 1 ? h("div", {class: "row"}, h("button", {type: "button", class: "quiet small", onclick: () => { waiting.forEach(([id]) => setMineCheck(id, null)); renderMinhas(); toast("Cartões liberados para o treino.", "success"); }}, "Todos estão certos")) : null) : null);
  fill($("mineList"),
    h("div", {class: "row between"}, h("h2", {text: "Meus cartões (" + items.length + ")"}),
      items.length ? h("button", {type: "button", onclick: () => { filters.session = {Thema: "Meine"}; syncFilterSelects("session"); showView("practice"); }}, "Treinar só as minhas") : null),
    items.length ? h("p", {class: "muted small-text", text: "Entram no treino como frases novas, antes das do catálogo (dentro do limite de novas do dia), e seguem o mesmo agendamento."}) : h("p", {class: "muted", text: "Nenhum cartão ainda."}),
    review,
    ...items.map(([id, m]) => mineRow(id, m)));
}
function mineCheckRow(id, m) {
  return h("article", {class: "mine-row"},
    h("div", {class: "mine-main"},
      h("p", {class: "mine-de", lang: "de", text: m.frase}),
      h("p", {class: "muted small-text", text: m.traducao}),
      m.erro ? h("p", {class: "small-text mine-erro"}, "Seu erro: ", h("s", {lang: "de", text: m.erro.errado}), " → ", h("b", {lang: "de", text: m.erro.certo})) : null,
      m.erro && m.erro.explicacao ? h("p", {class: "muted small-text", text: m.erro.explicacao}) : null),
    h("div", {class: "mine-side"},
      h("span", {class: "status s-new", text: "Para conferir"}),
      h("div", {class: "row"},
        h("button", {type: "button", class: "icon-btn quiet", title: "Ouvir", "aria-label": "Ouvir", onclick: () => mineSpeak(m.frase)}, icon("volume", 18)),
        h("button", {type: "button", class: "primary small", onclick: () => { setMineCheck(id, null); renderMinhas(); }}, "Está certo"),
        h("button", {type: "button", class: "small", onclick: () => { setMineCheck(id, "tutor"); renderMinhas(); }}, "Validado pelo tutor"),
        h("button", {type: "button", class: "quiet small", onclick: () => { mine.drafts.unshift({...m, id, editing: true}); renderMinhas(); window.scrollTo({top: 0, behavior: "smooth"}); }}, "Corrigir"),
        h("button", {type: "button", class: "quiet small", onclick: () => { if (confirm("Apagar este cartão?")) { deleteMineItem(id); renderMinhas(); } }}, "Apagar"))));
}
function mineRow(id, m) {
  const card = byId.get(id), st = card ? cardStatus(card) : {key: "new", label: "Nova"};
  return h("article", {class: "mine-row"},
    h("div", {class: "mine-main"},
      h("p", {class: "mine-de", lang: "de", text: m.frase}),
      h("p", {class: "muted small-text", text: m.traducao}),
      m.erro ? h("p", {class: "small-text mine-erro"}, "Seu erro: ", h("s", {lang: "de", text: m.erro.errado}), " → ", h("b", {lang: "de", text: m.erro.certo})) : null),
    h("div", {class: "mine-side"},
      h("span", {class: "status s-" + st.key, text: st.label}),
      h("span", {class: "tag", text: MINE_SOURCES[m.fonte] + " · " + m.nivel}),
      m.check === "tutor" ? h("span", {class: "tag", text: "✓ validado pelo tutor"}) : null,
      h("div", {class: "row"},
        h("button", {type: "button", class: "icon-btn quiet", title: "Ouvir", "aria-label": "Ouvir", onclick: () => mineSpeak(m.frase)}, icon("volume", 18)),
        m.check !== "tutor" ? h("button", {type: "button", class: "quiet small", title: "Marcar que o tutor conferiu esta frase", onclick: () => { setMineCheck(id, "tutor"); renderMinhas(); }}, "Tutor ✓") : null,
        h("button", {type: "button", class: "quiet small", onclick: () => { mine.drafts.unshift({...m, id, editing: true}); renderMinhas(); window.scrollTo({top: 0, behavior: "smooth"}); }}, "Editar"),
        h("button", {type: "button", class: "quiet small", onclick: () => { if (confirm("Apagar este cartão e o progresso dele?")) { deleteMineItem(id); renderMinhas(); } }}, "Apagar"))));
}
function draftForm(d) {
  const field = (label, key, attrs = {}) => {
    const el = h(attrs.textarea ? "textarea" : "input", {type: attrs.textarea ? null : "text", value: d[key] || "", lang: attrs.lang || null, rows: attrs.textarea ? "2" : null, spellcheck: "false"});
    if (attrs.textarea) el.value = d[key] || "";
    el.addEventListener("input", () => { d[key] = el.value; });
    return h("div", {class: "field"}, h("label", {text: label}), el);
  };
  const select = (label, key, options) => {
    const el = h("select", null, ...Object.entries(options).map(([k, v]) => h("option", {value: k}, v)));
    el.value = d[key];
    el.addEventListener("change", () => { d[key] = el.value; });
    return h("div", {class: "field"}, h("label", {text: label}), el);
  };
  return h("article", {class: "panel soft mine-draft"},
    d.loading ? h("p", {class: "muted", text: "Preparando “" + d.frase + "”…"}) : null,
    d.error ? h("p", {class: "notice warn", text: d.error}) : null,
    d.sugestao ? h("div", {class: "notice"}, h("span", null, "A IA acha que o certo é ", h("b", {lang: "de", text: d.sugestao.frase}), ". " + d.sugestao.correcao),
      h("button", {type: "button", class: "small", onclick: () => { d.erro = {errado: d.frase, certo: d.sugestao.frase, explicacao: d.sugestao.correcao}; d.frase = d.sugestao.frase; d.sugestao = null; renderMinhas(); }}, "Usar a correção")) : null,
    d.loading ? null : h("div", {class: "grid two"},
      field("Frase em alemão", "frase", {lang: "de"}), field("Tradução", "traducao"),
      field("Situação (o que faz você dizer a frase)", "situacao", {textarea: true}), field("Molde (partes trocáveis com ___)", "molde", {lang: "de"}),
      field("Foco (palavra ou estrutura)", "foco"),
      h("div", {class: "grid two"}, select("Registro", "reg", MINE_REGS), select("Nível", "nivel", Object.fromEntries(MINE_LEVELS.map(l => [l, l]))))),
    d.erro ? h("p", {class: "small-text"}, "Erro marcado: ", h("s", {lang: "de", text: d.erro.errado}), " → ", h("b", {lang: "de", text: d.erro.certo}),
      h("button", {type: "button", class: "quiet small", onclick: () => { d.erro = null; renderMinhas(); }}, "tirar")) : null,
    d.loading ? null : h("div", {class: "row"},
      h("button", {type: "button", class: "primary small", onclick: () => saveDraft(d)}, d.editing ? "Salvar alterações" : "Salvar cartão"),
      h("button", {type: "button", class: "quiet small", onclick: () => mineSpeak(d.frase)}, icon("volume", 16), "Ouvir"),
      h("button", {type: "button", class: "quiet small", onclick: () => { mine.drafts = mine.drafts.filter(x => x !== d); renderMinhas(); }}, "Descartar")));
}
function saveDraft(d, quiet) {
  if (!d.frase.trim() || !d.traducao.trim()) { if (!quiet) setStatus("Preencha pelo menos a frase e a tradução.", "error"); return false; }
  // Quem salva o formulário revisou o cartão: sai de “para conferir” (a marca do tutor fica).
  const ok = saveMineItem(d.id || newMineId(), {...d, check: d.check === "tutor" ? "tutor" : undefined});
  if (ok) { mine.drafts = mine.drafts.filter(x => x !== d); if (!quiet) { toast("Cartão salvo. Ele entra no treino como frase nova.", "success"); renderMinhas(); } }
  return ok;
}
function saveAllDrafts() {
  const n = mine.drafts.filter(d => !d.loading).slice().filter(d => saveDraft(d, true)).length;
  toast(n + (n === 1 ? " cartão salvo." : " cartões salvos."), "success");
  renderMinhas();
}
async function addMineDrafts(text, useAi, source) {
  const lines = String(text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 30);
  if (!lines.length) { $("mineInput") && $("mineInput").focus(); return; }
  const fonte = source || settings.mineSource || "aula";
  const drafts = lines.map(frase => ({frase, traducao: "", situacao: "", molde: "", foco: "", reg: "neutro", nivel: convLevel(), fonte, erro: null, loading: useAi}));
  mine.drafts.push(...drafts);
  renderMinhas();
  if (!useAi) return;
  mine.busy = true;
  for (const d of drafts) {
    try {
      const f = await mineFill(d.frase);
      const original = d.frase;
      Object.assign(d, {traducao: f.traducao, situacao: f.situacao, molde: f.molde, foco: f.foco, reg: f.reg, nivel: f.nivel});
      if (!f.correta && f.frase !== original) d.sugestao = {frase: f.frase, correcao: f.correcao || "Há um erro na frase."};
    } catch (e) { d.error = "Não consegui preencher: " + cleanIpcError(e, "erro") + ". Preencha você mesmo."; }
    d.loading = false;
    if (currentView === "minhas") renderMinhas();
  }
  mine.busy = false;
  if (currentView === "minhas") renderMinhas();
}
/* Áudio das frases próprias: voz do Google (mesma trava e cache da Conversa) ou voz do Windows. */
function mineSpeak(text, slow) {
  if (settings.audioSource === "system") { speak(text, slow); return; }
  convSpeak(text, slow);
}
/* Verso do cartão: mostra o erro que originou a frase. */
function mineErrorNode(card) {
  if (!card || !card.erro) return null;
  return h("div", {class: "mine-erro-box"}, h("span", {class: "muted small-text", text: "Seu erro que virou este cartão: "}),
    h("s", {lang: "de", text: card.erro.errado}), " → ", h("b", {lang: "de", text: card.erro.certo}),
    card.erro.explicacao ? h("p", {class: "muted small-text", text: card.erro.explicacao}) : null);
}
