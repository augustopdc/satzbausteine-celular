"use strict";
/* Menschen: o que faz a lição durar e virar fala (09/11/2026).
   1) Revisão misturada: as frases dos passos já feitos (e das lições antes da atual) voltam embaralhadas, sem dizer de que
      regra são; cada passo tem a sua data (2, 7, 20, 45, 90 dias; errou → amanhã). Não mexe no FSRS do Treino.
      progress.practice.menschen.rev = {"1-willi": {b, due, n, w, at}}.
   2) Conversa de fecho: 5 minutos com uma das pessoas da Conversa sobre o tema da lição; o app marca POR REGRA, nas suas
      falas, o que você usou da lição (as mesmas regras do “Sua vez”, MS_CHECK). Resultado na sessão da Conversa
      (topic "ms-fecho-N", mission {done, total}).
   Carregado depois de menschen-aula.js e de missoes.js. */

// ---------- 1) Revisão misturada ----------
const MS_REV_DAYS = [2, 7, 20, 45, 90];
const MS_MIX_PASSOS = 4, MS_MIX_PER = 2, MS_MIX_MIN = 3;
const MS_DAY = 864e5;

/* A data de revisão de um passo: a guardada; passo feito e ainda não revisto volta 2 dias depois; passo de lição anterior
   à atual que nunca foi feito no app conta como visto na aula (vencido). Passo da lição atual ainda não feito: null. */
function msRevEntry(l, p, st = msState()) {
  const key = msPassoKey(l.n, p.id), s = st.rev && st.rev[key];
  if (s) return {...s, app: true};
  const done = st.passos[key];
  if (done) return {b: 0, due: done + MS_REV_DAYS[0] * MS_DAY, n: 0, w: 0, at: 0, app: true};
  return l.n < msCurrent() ? {b: 0, due: 0, n: 0, w: 0, at: 0, app: false} : null;
}
function msRevList() {
  const out = [];
  for (const l of MENSCHEN_LICOES) for (const p of l.passos || []) {
    if (!p.frases || !p.frases.some(id => byId.get(id))) continue;
    const rev = msRevEntry(l, p);
    if (rev) out.push({l, p, key: msPassoKey(l.n, p.id), rev});
  }
  return out;
}
/* Vencidos: primeiro os que você fez no app (o mais atrasado antes), depois os das lições anteriores, da mais recente para trás. */
function msMixDue(now = Date.now()) {
  return msRevList().filter(x => x.rev.due <= now).sort((a, b) => (b.rev.app ? 1 : 0) - (a.rev.app ? 1 : 0) || (a.rev.app ? a.rev.due - b.rev.due : b.l.n - a.l.n));
}
/* As frases do passo nesta rodada: a cada revisão o passo traz as duas seguintes da lista. */
function msMixCards(p, turn) {
  const ids = p.frases.filter(id => byId.get(id)), start = ids.length ? (turn * MS_MIX_PER) % ids.length : 0;
  return [...ids.slice(start), ...ids.slice(0, start)].slice(0, MS_MIX_PER);
}
/* A rodada: até 4 passos vencidos, 2 frases de cada, uma de cada passo por vez (nunca duas do mesmo passo seguidas).
   Com menos de 3 vencidos, completa com os que vencem em seguida (extra: a data deles não muda). */
function msMixBuild(now = Date.now()) {
  const due = msMixDue(now);
  if (!due.length) return null;
  const pick = due.slice(0, MS_MIX_PASSOS);
  if (pick.length < MS_MIX_MIN) {
    const keys = new Set(pick.map(x => x.key));
    pick.push(...msRevList().filter(x => !keys.has(x.key)).sort((a, b) => a.rev.due - b.rev.due).slice(0, MS_MIX_MIN - pick.length).map(x => ({...x, extra: true})));
  }
  const groups = pick.map(x => ({...x, ids: msMixCards(x.p, x.rev.n)}));
  const items = [];
  for (let k = 0; k < MS_MIX_PER; k++) for (const g of groups) if (g.ids[k]) items.push({key: g.key, id: g.ids[k]});
  return {groups, items, k: 0, grades: [], settled: {}};
}
/* Todas certas: sobe um degrau (7, 20, 45, 90 dias). Alguma errada: volta amanhã, do começo. Só “quase”: de novo em 2 dias. */
function msRevRecord(key, grades, now = Date.now()) {
  const st = msState(), cur = st.rev[key] || {b: 0, due: 0, n: 0, w: 0, at: 0}, s = {b: cur.b, due: cur.due, n: cur.n + 1, w: cur.w, at: now};
  if (grades.includes("no")) { s.b = 0; s.w++; s.due = now + MS_DAY - 3600e3; }
  else if (grades.every(g => g === "ok")) { s.b = Math.min(MS_REV_DAYS.length - 1, cur.b + 1); s.due = now + MS_REV_DAYS[s.b] * MS_DAY - 3600e3; }
  else s.due = now + MS_REV_DAYS[0] * MS_DAY - 3600e3;
  st.rev[key] = s;
  return s;
}
function msRevWhen(due, now = Date.now()) {
  const d = Math.max(1, Math.round((due - now) / MS_DAY));
  return d === 1 ? "amanhã" : "em " + d + " dias";
}
function sanitizeMsRev(src) {
  const out = {};
  for (const [k, s] of Object.entries(src || {})) {
    if (!/^\d{1,2}-[a-z0-9]{1,20}$/.test(k) || !s || typeof s !== "object") continue;
    const n = Math.max(0, Math.round(Number(s.n) || 0));
    if (!n) continue;
    out[k] = {b: Math.max(0, Math.min(MS_REV_DAYS.length - 1, Math.round(Number(s.b) || 0))), due: Number(s.due) || 0, n,
      w: Math.max(0, Math.min(n, Math.round(Number(s.w) || 0))), at: Number(s.at) || 0};
  }
  return out;
}
function mergeMsRev(local, incoming) {
  const out = sanitizeMsRev(local);
  for (const [k, s] of Object.entries(sanitizeMsRev(incoming))) if (!out[k] || s.at > out[k].at) out[k] = s;
  return out;
}

function msOpenMix() {
  const mix = msMixBuild();
  if (!mix) { toast("Nenhuma frase para a revisão misturada agora.", "info"); return; }
  msStop();
  Object.assign(menschen, {track: null, data: null});
  menschen.passo = {n: menschen.view || msCurrent(), mix, phases: ["mix", "fim"], i: 0, res: null, busy: false, clip: null, words: {ok: 0, n: 0}};
  if (ltAvailable()) ltCheck("Hallo.");
  renderMenschen();
  window.scrollTo({top: 0});
}
/* Grava a data dos passos cujas frases já foram todas respondidas (os extras não mudam de data). */
function msMixSettle(M) {
  for (const g of M.groups) {
    if (M.settled[g.key]) continue;
    const idx = M.items.map((it, k) => it.key === g.key ? k : -1).filter(k => k >= 0);
    if (idx.some(k => !M.grades[k])) continue;
    const grades = idx.map(k => M.grades[k]);
    M.settled[g.key] = {grades, rev: g.extra ? null : msRevRecord(g.key, grades)};
  }
  saveProgress();
}
function msMixOrigin(g) {
  const t = g.p.regra && typeof GRAMMAR_BY_ID !== "undefined" ? GRAMMAR_BY_ID.get(g.p.regra.topic) : null;
  return "Lektion " + g.l.n + " · " + g.p.titulo + (t ? " · " + t.title : "");
}
function msPhMix() {
  const P = menschen.passo, M = P.mix, it = M.items[M.k], c = byId.get(it.id), r = P.res, g = M.groups.find(x => x.key === it.key);
  const next = () => {
    msMixSettle(M);
    M.k++; P.res = null;
    if (M.k >= M.items.length) return msNext();
    msRenderPasso();
    const el = $("msInput"); if (el) el.focus();
  };
  const check = async giveUp => {
    if (P.busy || P.res) return;
    const typed = giveUp === true ? "" : ($("msInput").value || "").trim();
    if (!typed && giveUp !== true) { $("msInput").focus(); return; }
    P.busy = true; msRenderPasso(); msKeep(typed);
    const d = typed ? diffLine(c.frase, typed) : null;
    const lt = typed ? await ltCheck(typed) : null, ltErr = (lt || []).filter(m => m.cat !== "STYLE");
    let grade = !typed ? "no" : d.pct >= .85 ? "ok" : d.pct >= .6 ? "quase" : "no";
    if (grade === "ok" && ltErr.some(m => m.cat === "GRAMMAR")) grade = "quase";
    M.grades[M.k] = grade;
    P.busy = false;
    P.res = {grade, typed, d, lt: ltErr};
    if (grade === "ok" && typeof uiSound === "function") uiSound("ok");
    msRenderPasso(); msKeep(typed);
  };
  const situ = String(c.situacao || "").replace(/^\[(du|Sie|ihr|neutro|escrito)\]\s*/, "");
  const msg = r && {ok: "Certo!", quase: "Quase: compare com a frase modelo.", no: r.typed ? "Compare com a frase modelo." : "Esta é a frase:"}[r.grade];
  return h("div", {class: "aula-step ms-mix"},
    h("p", {class: "ms-kicker", text: "Frase " + (M.k + 1) + " de " + M.items.length + " · de " + plural(M.groups.length, "passo diferente", "passos diferentes")}),
    h("p", {class: "label", text: "Como se diz em alemão?"}),
    h("p", {class: "aula-pt", text: c.traducao}),
    situ ? h("p", {class: "muted small-text", text: situ}) : null,
    ...msInputRow(check, {res: r, onNext: next, placeholder: "Escreva ou fale a frase em alemão"}),
    r ? h("div", {class: "aula-result " + r.grade},
      h("p", {class: "aula-status", text: msg}),
      r.typed ? h("div", null, h("p", {class: "muted small-text", text: "Frase modelo (verde = igual ao que você escreveu):"}), r.d.line)
        : h("p", {class: "aula-de", lang: "de", text: c.frase}),
      c.alvo ? h("p", {class: "muted small-text"}, "O ponto: ", h("span", {lang: "de", text: c.alvo})) : null,
      h("p", {class: "ms-mix-origin"}, icon("book", 15), h("span", {text: "De onde vem: " + msMixOrigin(g)})),
      r.lt && r.lt.length ? [h("p", {class: "label", text: "O corretor encontrou"}), ltList(r.typed, r.lt)] : null,
      h("div", {class: "row"},
        h("button", {class: "primary", type: "button", onclick: next}, M.k + 1 >= M.items.length ? "Ver o resultado" : "Próxima", h("kbd", null, "Enter")),
        h("button", {class: "small", type: "button", onclick: () => speakCard(c)}, iconText("volume", "Ouvir")),
        r.grade !== "ok" && r.typed ? h("button", {class: "quiet small", type: "button", onclick: e => {
          e.currentTarget.remove(); r.grade = "ok"; M.grades[M.k] = "ok"; toast("Contei como certo.", "success");
        }}, "A minha versão também está certa") : null)) : null);
}
function msMixEnd() {
  const P = menschen.passo, M = P.mix, now = Date.now();
  msMixSettle(M);
  const ok = M.grades.filter(g => g === "ok").length, more = msMixDue().length;
  const rows = M.groups.map(g => {
    const s = M.settled[g.key];
    if (!s) return null;
    const good = s.grades.filter(x => x === "ok").length, all = good === s.grades.length;
    const phase = msPhasesOf(g.p).indexOf("regra");
    return h("li", {class: "ms-mix-row" + (all ? " ok" : "")},
      h("span", {class: "ms-ck"}, all ? icon("check", 14) : null),
      h("div", {class: "ms-mix-txt"}, h("b", {text: g.p.titulo}),
        h("span", {class: "muted small-text", text: msMixOrigin(g).replace(" · " + g.p.titulo, "") + " · " + good + " de " + s.grades.length
          + (s.rev ? " · volta " + msRevWhen(s.rev.due, now) : " · reforço, a data não muda")})),
      !all && phase >= 0 ? h("button", {class: "small", type: "button", onclick: () => msOpenPasso(g.l.n, g.p.id, phase)}, "Rever a regra") : null);
  });
  return h("div", {class: "aula-step aula-end"},
    h("h3", {text: "Revisão misturada: " + ok + " de " + M.items.length + " certas"}),
    h("p", {class: "muted", text: "Cada passo volta sozinho: quanto mais vezes você acerta, mais longe ele fica. O que você errou volta amanhã."}),
    h("ul", {class: "ms-mix-list"}, ...rows),
    h("div", {class: "row"},
      h("button", {class: "primary", type: "button", onclick: () => msClosePasso()}, "Voltar à lição"),
      more ? h("button", {class: "small", type: "button", onclick: msOpenMix}, iconText("repeat", "Mais uma rodada")) : null));
}
function msMixPanel() {
  const mix = msMixBuild();
  if (!mix) return null;
  return h("div", {class: "panel ms-review ms-mix-panel"},
    h("div", null,
      h("p", null, h("b", {text: String(mix.items.length)}), " frases de " + plural(mix.groups.length, "passo anterior", "passos anteriores") + ", misturadas"),
      h("p", {class: "muted small-text", text: "Sem dizer de que regra são: lembrar sozinho é o que fixa. Uns " + Math.max(2, Math.round(mix.items.length * .6)) + " minutos."})),
    h("button", {type: "button", onclick: msOpenMix}, iconText("repeat", "Revisão misturada")));
}

// ---------- 2) Conversa de fecho ----------
/* Regras do “Sua vez” que não cabem numa conversa livre: carta (saudação, despedida), papel de garçom e de cliente, apresentar-se. */
const MS_FECHO_SKIP = new Set(["anrede", "gruss", "kellnerSagt", "gastPede", "vorstellen"]);
const MS_FECHO_MAX = 5;
/* O que a conversa pede: as regras de MS_CHECK usadas nos passos da lição (a mais usada primeiro), com a exigência mais
   leve de cada uma e no máximo 2 vezes. l.fecho = [[rótulo, regex, mínimo]] substitui a lista. → [[id, rótulo, regex, mínimo]] */
function msFechoMetas(l) {
  if (l.fecho) return l.fecho.map(([label, re, min], k) => ["f" + k, label, re, min || 1]);
  const keyOf = new Map(Object.entries(MS_CHECK).map(([k, re]) => [re, k])), found = new Map();
  let order = 0;
  for (const p of l.passos || []) for (const [label, re, min] of (p.usar && p.usar.checks) || []) {
    const key = keyOf.get(re);
    if (!key || MS_FECHO_SKIP.has(key)) continue;
    const cur = found.get(key);
    if (!cur) found.set(key, {key, label, re, min: min || 1, uses: 1, order: order++});
    else { cur.uses++; if ((min || 1) < cur.min) { cur.min = min || 1; cur.label = label; } }
  }
  return [...found.values()].sort((a, b) => b.uses - a.uses || a.order - b.order).slice(0, MS_FECHO_MAX)
    .sort((a, b) => a.order - b.order).map(x => [x.key, x.label, x.re, Math.min(2, x.min)]);
}
/* Quantas vezes cada regra aparece nas SUAS falas (texto como o Whisper escreveu, com maiúsculas). */
function msFechoCounts(metas, turns) {
  const said = turns.filter(t => t.who === "me").map(t => t.de).join("\n");
  return new Map(metas.map(([id, , re]) => [id, (said.match(new RegExp(re, "gu")) || []).length]));
}
function msFechoPerson(l) {
  const list = CONV_PESSOAS.filter(p => !p.sie);
  return list[(l.n - 1) % list.length];
}
function msFechoId(n) { return "ms-fecho-" + n; }
function msFechoTopic(l) {
  const p = msFechoPerson(l);
  return {id: msFechoId(l.n), group: "Menschen", level: "A2", pt: "Lektion " + l.n + " · fecho com " + p.name, de: l.conversa.de, persona: p, voice: p.voice, sie: false,
    lesson: {n: l.n, tema: l.conversa.pt, metas: msFechoMetas(l),
      gram: (l.gram || []).map(id => typeof GRAMMAR_BY_ID !== "undefined" && GRAMMAR_BY_ID.has(id) ? GRAMMAR_BY_ID.get(id).title : "").filter(Boolean)}};
}
function msFechoPromptLines(topic) {
  const L = topic.lesson;
  return ["Today's conversation has a subject. Luiz has just finished a lesson of his German course (level A2) and wants to use it in a real talk. Subject: " + topic.de + ".",
    "Stay on this subject for the whole conversation. Talk about it from your own life in one short sentence, then let him talk about HIS life and experiences.",
    L.gram.length ? "Give him natural chances to use the grammar of the lesson (" + L.gram.join(", ") + "): for example, ask what he did or how it was to invite the past, ask why to invite a reason. Never name grammar and never ask him to make a sentence." : "",
    "Prefer open questions (Was …? Wie …? Warum …? Erzähl mal!) to yes/no questions, so that he speaks in full sentences."].filter(Boolean);
}
function msFechoStart(topic) {
  return "(Begin the conversation as " + topic.persona.name + ": greet Luiz in one short sentence and open today's subject with ONE simple, open question about his own life. Subject: "
    + topic.de + ". Do not ask his name.)";
}
function msFechoOpen(l) {
  if (!convAvailable()) { toast("A conversa precisa da IA instalada no PC.", "info"); return; }
  if (menschen.passo) msClosePasso(true);
  showView("conversa");
  openConversaTopic(msFechoTopic(l));
}
/* Melhor resultado já guardado: {done, total} ou null. */
function msFechoBest(n) {
  const list = typeof convData === "function" ? convData().sessions.filter(s => s.topic === msFechoId(n) && s.mission) : [];
  return list.reduce((best, s) => !best || s.mission.done / s.mission.total > best.done / best.total ? s.mission : best, null);
}
function msFechoState() {
  const L = mis.topic.lesson, counts = msFechoCounts(L.metas, conv.turns);
  return L.metas.map(([id, label, , min]) => ({id, label, min, n: counts.get(id), auto: counts.get(id) >= min, done: counts.get(id) >= min || mis.manual.has(id)}));
}
/* Painel na sala da Conversa (chamado pelo missionRender). */
function msFechoPanel(box) {
  const L = mis.topic.lesson, list = msFechoState(), n = list.filter(x => x.done).length;
  const mine = conv.turns.filter(t => t.who === "me").length;
  fill(box, h("div", {class: "mis-head"},
    h("p", {class: "label", text: "Fecho da Lektion " + L.n}),
    h("p", {class: "mis-goal", text: "Fale sobre: " + L.tema.toLowerCase() + ". A lista se marca sozinha quando você usa o que a lição ensinou."}),
    h("p", {class: "mis-stat"}, h("b", {text: String(n)}), " de " + list.length)),
  h("ul", {class: "mis-list"}, ...list.map(x => h("li", null,
    h("button", {class: "mis-item" + (x.done ? " on" : ""), type: "button", "aria-pressed": String(x.done),
      title: x.auto ? "O app reconheceu nas suas falas" : "Toque para marcar se você usou e o app não reconheceu",
      onclick: () => { if (x.auto) return; mis.manual.has(x.id) ? mis.manual.delete(x.id) : mis.manual.add(x.id); missionRender(); }},
      h("span", {class: "mis-box"}, x.done ? icon("check", 13) : null),
      h("span", {text: x.label + (x.min > 1 && !x.done ? " (" + x.n + " de " + x.min + ")" : "")}))))),
  n === list.length && list.length ? h("p", {class: "mis-done", text: "Você usou tudo o que a lição pede. Termine quando a conversa fechar naturalmente."})
    : mine >= 8 ? h("p", {class: "muted small-text", text: "Já deu uma boa conversa. Tente encaixar o que falta ou termine para ver os erros."}) : null);
}
function msFechoSessionExtra() {
  const list = msFechoState();
  return list.length ? {mission: {done: list.filter(x => x.done).length, total: list.length}} : {};
}
function msFechoSummaryNode() {
  const L = mis.topic.lesson, list = msFechoState(), miss = list.filter(x => !x.done);
  return h("div", {class: "mis-result" + (!miss.length ? " ok" : "")},
    h("p", null, "Lektion " + L.n + ": você usou ", h("b", {text: (list.length - miss.length) + " de " + list.length}), " pontos da lição nesta conversa."),
    miss.length ? h("p", {class: "muted small-text", text: "Faltou: " + miss.map(x => x.label.replace(/^Usou /, "")).join("; ") + "."}) : null,
    h("div", {class: "row"}, h("button", {class: "small", type: "button", onclick: () => { menschen.view = L.n; showView("menschen"); }}, "Voltar à Lektion " + L.n)));
}
/* Item no fim da lista de passos da lição. */
function msFechoItem(l) {
  if (!l.conversa) return null;
  const ok = typeof convAvailable === "function" && convAvailable(), best = msFechoBest(l.n), p = msFechoPerson(l);
  return h("li", null, h("button", {class: "ms-fecho-item" + (best ? " done" : ""), type: "button", disabled: !ok, onclick: () => msFechoOpen(l)},
    h("span", {class: "ms-passo-n"}, best ? icon("check", 16) : icon("chat", 16)),
    h("span", {class: "ms-passo-txt"}, h("b", {text: "Fechar a lição falando"}),
      h("span", {class: "muted small-text", text: !ok ? "Conversa com a IA: só com ela instalada no PC"
        : best ? "Melhor conversa: " + best.done + " de " + best.total + " pontos da lição usados · repetir com " + p.name
        : "5 minutos de conversa com " + p.name + " · o app marca o que você usar da lição"}))));
}
