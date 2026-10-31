"use strict";
/* Navegação em 5 lugares: Hoje, Treinar, Falar, Ler e escrever, Eu.
   PC: o menu lateral mostra os lugares e abre, logo abaixo do lugar atual, as telas dele; clicar no lugar volta à última tela usada nele.
   Celular (≤ 600 px): 5 abas; lugar com mais de uma tela tem uma página de lista (view "hub"). A tela entra empurrando a lista
   para o lado e “Voltar” faz o caminho inverso, como no iPhone (View Transitions; sem suporte ou com “reduzir movimento”, troca direto). */
const HUBS = [
  {id: "hoje", label: "Hoje", views: ["home"]},
  {id: "treinar", label: "Treinar", views: ["practice", "grammar", "artigos", "pron", "activation", "template", "exam"]},
  {id: "falar", label: "Falar", views: ["conversa", "scenes"]},
  {id: "ler", label: "Ler e escrever", views: ["menschen", "reading", "escrita"]},
  {id: "eu", label: "Eu", views: ["plan", "minhas", "catalog", "coverage", "settings"]}
];
const HUB_ROWS = {
  practice: ["Cartões", "Revisões e frases novas do dia: produção, escuta e ditado."],
  grammar: ["Gramática", "Notas, tabelas e exercícios de montar a frase."],
  artigos: ["Artigos", "der, die, das e o plural de cada substantivo, com revisão espaçada."],
  pron: ["Pronúncia", "Pares de sons parecidos, ouvindo e gravando."],
  activation: ["Ativação", "10 frases já aprendidas de um tema para um monólogo livre."],
  template: ["Molde", "Fale três variações de uma frase trocando as lacunas."],
  exam: ["Modo Prova", "Tarefas no formato da prova, com autoavaliação."],
  conversa: ["Conversa", "Parceira no seu nível, 4/3/2 e paciente simulado (FSP)."],
  scenes: ["Cenas", "Diálogos do dia a dia e do hospital para treinar a sua parte."],
  menschen: ["Menschen", "O livro do curso: lição por lição, com frases, gramática e os áudios."],
  reading: ["Leitura","Livros com áudio, tradução e gramática de cada frase."],
  escrita: ["Escrita", "Tarefas da prova, diário de 3 frases e resumo do livro."],
  plan: ["Meu plano", "Rumo ao B2, capítulo do curso, plantões e pacote para a aula."],
  minhas: ["Minhas frases", "Seus cartões: da aula, das séries e dos seus erros."],
  catalog: ["Frases", "Todas as frases do catálogo, com busca."],
  coverage: ["Cobertura", "Quanto do catálogo você já aprendeu, por tema e nível."],
  settings: ["Configurações", "Áudio, backup, sincronização e aparência."]
};
// Telas que dependem do PC (Whisper, IA local): fora do app do PC não aparecem.
const NAV_WEB_HIDDEN = ["conversa", "minhas", "pron", "menschen"];
const NAV_KEY = "satzbausteine.navLast";
const nav = {hub: "hoje", last: {}};

function navPhone() { return window.matchMedia("(max-width: 600px)").matches; }
function hubById(id) { return HUBS.find(x => x.id === id) || HUBS[0]; }
function hubOf(view) { return view === "hub" ? nav.hub : (HUBS.find(x => x.views.includes(view)) || HUBS[0]).id; }
function hubViews(id) {
  const web = document.documentElement.classList.contains("web");
  return hubById(id).views.filter(v => !(web && NAV_WEB_HIDDEN.includes(v)));
}

/* Troca de tela com animação: "push" (entra pela direita), "pop" (volta) ou "fade". */
function navGo(view, dir = "fade") {
  const same = view === currentView && (view !== "hub" || hubOf(currentView) === nav.hub);
  // Janela sem foco (minimizada, escondida, autoteste): troca direto, porque a animação ficaria parada esperando a tela.
  const motion = typeof document.startViewTransition === "function" && document.visibilityState === "visible" && document.hasFocus() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (same || !motion) { showView(view); return; }
  document.documentElement.dataset.nav = dir;
  const t = document.startViewTransition(() => {
    showView(view);
    const el = $("view-" + view);
    if (el) el.classList.add("vt");
  });
  const guard = setTimeout(() => { try { t.skipTransition(); } catch (e) { /* já terminou */ } }, 1500);
  // Transição pulada rejeita ready/finished: não é erro.
  t.ready.catch(() => {});
  t.finished.catch(() => {}).finally(() => { clearTimeout(guard); delete document.documentElement.dataset.nav; });
}
function navHub(id) {
  const views = hubViews(id), last = nav.last[id];
  if (!views.length) return;
  if (navPhone() && views.length > 1) {
    if (hubOf(currentView) === id) { if (currentView !== "hub") navGo("hub", "pop"); return; }
    nav.hub = id;
    navGo(last && views.includes(last) ? last : "hub", "fade");
    return;
  }
  navGo(last && views.includes(last) ? last : views[0], "fade");
}

/* Chamado pelo showView: marca a tela e o lugar atuais, abre o grupo do lugar no menu e mostra o “Voltar” do celular. */
function updateNav(view) {
  const hub = hubOf(view);
  if (view !== "hub") {
    nav.hub = hub;
    if (nav.last[hub] !== view) { nav.last[hub] = view; try { localStorage.setItem(NAV_KEY, JSON.stringify(nav.last)); } catch (e) { /* sem armazenamento */ } }
  }
  all(".nav button[data-view]").forEach(b => { if (b.dataset.view === view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  all(".nav-hub").forEach(b => b.classList.toggle("on", b.dataset.hub === hub));
  all(".nav-sub").forEach(g => g.classList.toggle("open", g.dataset.sub === hub));
  const back = $("hubBack"), showBack = view !== "hub" && hubViews(hub).length > 1;
  if (!back) return;
  back.hidden = !showBack;
  if (showBack) $("hubBackLabel").textContent = hubById(hub).label;
}

function renderHub() {
  const hub = hubById(nav.hub);
  $("hubTitle").textContent = hub.label;
  const due = $("navDue");
  fill($("hubRoot"), h("div", {class: "hub-list"}, hubViews(hub.id).map(v => {
    const svg = document.querySelector('.nav button[data-view="' + v + '"] svg');
    return h("button", {class: "hub-row", type: "button", onclick: () => navGo(v, "push")},
      h("span", {class: "hub-ico"}, svg ? svg.cloneNode(true) : null),
      h("span", {class: "hub-text"}, h("b", {text: HUB_ROWS[v][0]}), h("span", {text: HUB_ROWS[v][1]})),
      v === "practice" && due && !due.hidden ? h("span", {class: "hub-badge", text: due.textContent}) : null,
      icon("chevron", 18));
  })));
}

/* As explicações longas do topo de cada tela ficam atrás de um “i” ao lado do título. */
function initPageHelp() {
  all(".page-head").forEach(head => {
    const lede = head.querySelector(".lede"), title = head.querySelector("h1");
    if (!lede || !title || lede.id) return;
    lede.hidden = true;
    lede.classList.add("page-help");
    const btn = h("button", {class: "icon-btn quiet help-toggle", type: "button", "aria-expanded": "false", "aria-label": "Sobre esta tela", title: "Sobre esta tela"}, icon("info", 18));
    btn.addEventListener("click", () => { lede.hidden = !lede.hidden; btn.setAttribute("aria-expanded", String(!lede.hidden)); });
    const row = h("div", {class: "title-row"});
    title.before(row);
    row.append(title, btn);
  });
}
/* O mesmo vale dentro das telas: a explicação de um bloco fica escondida atrás de um “i” ao lado do título dele.
   No HTML, basta a classe “explain” no parágrafo; no código, titled(tag, título, explicação). */
function explainToggle(p) {
  p.hidden = true;
  p.classList.add("explain-text");
  const btn = h("button", {class: "icon-btn quiet help-toggle help-mini", type: "button", "aria-expanded": "false", "aria-label": "Mais sobre isto", title: "Mais sobre isto"}, icon("info", 16));
  btn.addEventListener("click", () => { p.hidden = !p.hidden; btn.setAttribute("aria-expanded", String(!p.hidden)); });
  return btn;
}
function titled(tag, text, explain) {
  const p = h("p", {class: "muted small-text", text: explain});
  return [h(tag, {class: "titled"}, h("span", {text}), explainToggle(p)), p];
}
function initExplain(root = document) {
  root.querySelectorAll("p.explain:not(.explain-text)").forEach(p => {
    const prev = p.previousElementSibling, btn = explainToggle(p);
    if (prev && /^H[1-4]$/.test(prev.tagName)) { prev.classList.add("titled"); prev.append(btn); }
    else if (prev && prev.querySelector("h2, h3")) { const t = prev.querySelector("h2, h3"); t.classList.add("titled"); t.append(btn); }
    else p.before(btn);
  });
}
/* Folha de ações: um toque no cartão abre as opções (em vez de repetir os mesmos botões em todos os cartões).
   No celular sobe de baixo; no PC aparece no meio. Esc ou toque fora fecham. */
function actionSheet({title, sub, actions}) {
  let dlg = $("actionSheet");
  if (!dlg) {
    dlg = h("dialog", {id: "actionSheet", class: "sheet", "aria-labelledby": "actionSheetTitle"});
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg);
  }
  fill(dlg, h("div", {class: "sheet-body"},
    h("span", {class: "sheet-grip", "aria-hidden": "true"}),
    h("h2", {id: "actionSheetTitle", text: title}),
    sub ? h("p", {class: "muted small-text", text: sub}) : null,
    h("div", {class: "sheet-actions"}, ...actions.map(a => h("button", {class: "sheet-action" + (a.primary ? " primary" : ""), type: "button", onclick: () => { dlg.close(); a.onclick(); }},
      a.icon ? icon(a.icon, 18) : null, h("span", null, h("b", {text: a.label}), a.note ? h("small", {text: a.note}) : null)))),
    h("button", {class: "quiet sheet-cancel", type: "button", onclick: () => dlg.close()}, "Cancelar")));
  if (!dlg.open) dlg.showModal();
}
function initNav() {
  initPageHelp();
  initExplain();
  try { nav.last = JSON.parse(localStorage.getItem(NAV_KEY)) || {}; } catch (e) { nav.last = {}; }
  all(".nav-hub").forEach(b => b.addEventListener("click", () => navHub(b.dataset.hub)));
  all(".nav-sub button[data-view]").forEach(b => b.addEventListener("click", () => navGo(b.dataset.view)));
  $("hubBackBtn").addEventListener("click", () => navGo("hub", "pop"));
}
