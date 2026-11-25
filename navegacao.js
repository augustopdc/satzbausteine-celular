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
  activation: ["Falar de um tema", "10 frases já aprendidas de um tema para um monólogo livre."],
  template: ["Variar frases", "Fale três variações de uma frase trocando as lacunas."],
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
const nav = {hub: "hoje", last: {}, collapsed: ""};

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
  // PC: clicar no lugar que já está aberto recolhe (ou abre de novo) as telas dele, sem trocar de tela.
  if (views.length > 1 && hubOf(currentView) === id && currentView !== "settings") {
    nav.collapsed = nav.collapsed === id ? "" : id;
    navSyncGroups(hubOf(currentView), currentView);
    navPillTrack();
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
  // Trocar de lugar desfaz o “recolhido” (voltar ao lugar abre as telas dele de novo).
  if (nav.collapsed && nav.collapsed !== hub) nav.collapsed = "";
  navSyncGroups(hub, view);
  const gear = $("navSettings");
  if (gear) { gear.classList.toggle("on", view === "settings"); if (view === "settings") gear.setAttribute("aria-current", "page"); else gear.removeAttribute("aria-current"); }
  navPillTrack();
  updateSidebarStatus(view);
  updateSidebarNow(view);
  titleWatch(view);
  // Luz atmosférica por lugar (style.css, bloco “Visual de assinatura”, etapa 5).
  const root = document.documentElement;
  root.dataset.hub = hub; root.dataset.view = view;
  navConvMode(view);
  const back = $("hubBack"), showBack = view !== "hub" && hubViews(hub).length > 1;
  if (!back) return;
  back.hidden = !showBack;
  if (showBack) $("hubBackLabel").textContent = hubById(hub).label;
  $("miniTitle").classList.toggle("after-long", showBack && hubById(hub).label.length > 8);
}

/* Lugar aceso e grupo aberto no menu. No PC, Configurações mora só na engrenagem do rodapé: o lugar Eu não acende nem abre
   (no celular continua dentro de Eu). Lugar recolhido pelo clique (nav.collapsed) continua aceso, com o grupo fechado. */
function navSyncGroups(hub, view) {
  const gearOnly = view === "settings" && !navPhone();
  all(".nav-hub").forEach(b => {
    const on = !gearOnly && b.dataset.hub === hub, many = hubViews(b.dataset.hub).length > 1;
    b.classList.toggle("on", on);
    b.classList.toggle("collapsed", on && nav.collapsed === b.dataset.hub);
    if (many) b.setAttribute("aria-expanded", String(on && nav.collapsed !== b.dataset.hub)); else b.removeAttribute("aria-expanded");
  });
  all(".nav-sub").forEach(g => g.classList.toggle("open", !gearOnly && g.dataset.sub === hub && nav.collapsed !== hub));
}
/* Modo especial aberto na Conversa (Krimi ou Plantão na Innere): o topo da folha ganha a luz da cena. */
function navConvMode(view = typeof currentView !== "undefined" ? currentView : "") {
  const t = view === "conversa" && typeof conv !== "undefined" && conv.topic && !conv.finished ? conv.topic : null;
  document.documentElement.dataset.convMode = t && t.krimi ? "krimi" : t && t.innere ? "innere" : "";
}
// ---------- Barra lateral de assinatura (25/11/2026; pedido em _dev/.cache/PEDIDO-BARRA-LATERAL.md) ----------
/* Pílula deslizante: no PC e no trilho de ícones, o fundo do item atual é uma superfície só (::before do .nav) que desliza
   e muda de largura até o novo item (de um lugar a um subitem recuado, por exemplo). Enquanto um grupo abre ou fecha, os
   itens abaixo dele andam: navPillTrack mede de novo a cada quadro até a gaveta assentar (com temporizador de reserva,
   porque a janela escondida não roda requestAnimationFrame). Item invisível (Configurações no PC, grupo fechado): some. */
const navPill = {shown: false, until: 0, timer: 0};
function navPillEl() { return document.querySelector(".sidebar .nav"); }
function syncNavPill() {
  const el = navPillEl();
  if (!el) return;
  if (navPhone()) { el.classList.remove("has-nav-pill"); delete el.dataset.pillReady; navPill.shown = false; return; }
  el.classList.add("has-nav-pill");
  let act = el.querySelector('button[aria-current="page"]');
  const closed = act && act.closest(".nav-sub:not(.open)");
  if (closed && closed.previousElementSibling && closed.previousElementSibling.classList.contains("collapsed")) act = closed.previousElementSibling;
  if (!act || !act.offsetWidth || act.closest(".nav-sub:not(.open)")) {
    el.style.setProperty("--nav-o", "0");
    navPill.shown = false;
    return;
  }
  const ra = act.getBoundingClientRect(), rn = el.getBoundingClientRect();
  const box = {x: Math.round(ra.left - rn.left), y: Math.round(ra.top - rn.top), w: Math.round(ra.width), h: Math.round(ra.height)};
  // Reaparecendo (ou no 1º desenho): vai direto ao lugar, sem deslizar do canto; a transição volta no quadro seguinte.
  if (!navPill.shown) delete el.dataset.pillReady;
  for (const k of ["x", "y", "w", "h"]) el.style.setProperty("--nav-" + k, box[k] + "px");
  el.style.setProperty("--nav-r", getComputedStyle(act).borderTopLeftRadius);
  el.style.setProperty("--nav-o", "1");
  if (!navPill.shown) {
    navPill.shown = true;
    const frame = typeof pillFrame === "function" ? pillFrame : f => setTimeout(f, 50);
    if (!reducedMotion()) frame(() => frame(() => { if (navPill.shown) el.dataset.pillReady = "1"; }));
  }
}
function navPillTrack(ms = 420) {
  syncNavPill();
  navPill.until = Date.now() + ms;
  if (navPill.timer) return;
  const step = () => {
    navPill.timer = 0;
    syncNavPill();
    if (Date.now() < navPill.until) navPill.timer = setTimeout(step, 16);
  };
  navPill.timer = setTimeout(step, 16);
}
/* Puro (testado): o que o botão da esquerda do rodapé mostra. Fora da Hoje, a sequência (clicar leva à Hoje); na Hoje,
   onde a sequência já aparece grande, o ritmo do dia (clicar abre o seletor do dia). */
const SIDEBAR_DAY_ICON = {normal: "sun", folga: "sun", plantao: "moon", pos: "moon"};
function sidebarStatusState(view, streakDays, type) {
  if (view === "home") {
    const t = SIDEBAR_DAY_ICON[type] ? type : "normal";
    const label = (typeof SHIFT_LABELS !== "undefined" && SHIFT_LABELS[t]) || {normal: "Dia comum", plantao: "Plantão", pos: "Pós-plantão", folga: "Folga"}[t];
    return {mode: "day", type: t, icon: SIDEBAR_DAY_ICON[t], text: label, title: "Hoje: " + label + ". Clique para trocar o tipo de dia e o tempo."};
  }
  const n = Math.max(0, Math.floor(Number(streakDays) || 0));
  const text = n + (n === 1 ? " dia" : " dias");
  return {mode: "streak", text, title: text + " seguidos de estudo. Clique para ir à Hoje."};
}
function updateSidebarStatus(view = typeof currentView !== "undefined" ? currentView : "home") {
  const btn = $("sidebarStatus");
  if (!btn) return;
  let type = "normal", days = 0;
  try { type = dayPlan().type; } catch (e) { /* progresso ainda não carregou */ }
  try { days = streak(); } catch (e) { /* idem */ }
  const st = sidebarStatusState(view, days, type);
  btn.dataset.mode = st.mode;
  btn.title = st.title;
  btn.setAttribute("aria-label", st.mode === "day" ? "Tipo de dia: " + st.text + ". Trocar" : st.text + " seguidos. Ir para a Hoje");
  const day = $("sidebarDay");
  if (st.mode === "day" && day && day.dataset.type !== st.type) {
    day.dataset.type = st.type;
    fill(day, icon(st.icon, 18), h("i", {class: "sb-dot", "aria-hidden": "true"}), h("span", {class: "streak-text", text: st.text}));
  }
}
/* Puro (testado): o livro em andamento para o atalho “Continuar lendo”: o lido mais recentemente entre os que estão
   entre 1% e 99% (mesma conta da estante: a frase em que parou sobre o total; sem a contagem, o começo do capítulo).
   meta = {id: {t: título, c: capítulos, n: frases}} (guardado pela estante); pos = {id: {ch, sel, at}}. */
function sidebarNowPick(meta, pos) {
  let best = null;
  for (const [id, m] of Object.entries(meta || {})) {
    const p = pos && pos[id];
    if (!m || !p || !m.c) continue;
    const pct = m.n && p.sel >= 0 ? Math.round((p.sel + 1) / m.n * 100) : Math.round((p.ch || 0) / m.c * 100);
    if (pct < 1 || pct > 99) continue;
    if (!best || (p.at || 0) > best.at) best = {id, title: m.t || "", pct, at: p.at || 0};
  }
  return best;
}
function updateSidebarNow(view = typeof currentView !== "undefined" ? currentView : "") {
  const box = $("sidebarNow");
  if (!box) return;
  const st = typeof readingState === "function" ? readingState() : {};
  // Quem já lia antes desta versão ainda não tem o resumo guardado: uma busca só, sem pressa, e daí em diante vem da estante.
  if (!st.meta && st.pos && Object.keys(st.pos).length && !updateSidebarNow.asked && window.satzDesktop && window.satzDesktop.listBooks && typeof rdRememberMeta === "function") {
    updateSidebarNow.asked = true;
    setTimeout(() => window.satzDesktop.listBooks().then(books => { if (!readingState().meta) rdRememberMeta(books); }).catch(() => {}), 3000);
  }
  const pick = view === "reading" ? null : sidebarNowPick(st.meta, st.pos);
  if (!pick) { box.hidden = true; return; }
  box.hidden = false;
  const key = pick.id + "|" + pick.pct + "|" + pick.title;
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  const bar = h("i");
  setWidth(bar, pick.pct);
  fill(box, h("button", {class: "nav-now-btn", type: "button", title: "Continuar " + pick.title + " de onde parou", onclick: () => sidebarOpenBook(pick.id)},
    h("span", {class: "nav-now-top"}, h("span", {class: "nav-now-label", text: "Continuar lendo"}), h("span", {class: "nav-now-pct", text: pick.pct + "%"})),
    h("span", {class: "nav-now-title", lang: "de", text: pick.title}),
    h("span", {class: "nav-now-bar", "aria-hidden": "true"}, bar)));
}
/* Abre o livro na frase em que parou: carrega antes, depois mostra a tela (sem passar pela estante). */
async function sidebarOpenBook(id) {
  if (typeof openBook !== "function") return;
  if (!reading.book || reading.book.id !== id) await openBook(id);
  if (!reading.book || reading.book.id !== id) return;
  navGo("reading", "fade");
  if (reading.sel >= 0 && typeof scrollToSentence === "function") requestAnimationFrame(() => scrollToSentence(reading.sel, "center"));
}
/* Botão de tema: um giro curto do ícone novo (180 ms), nada com “reduzir movimento”. */
function themeSpin() {
  const svg = document.querySelector("#themeToggle svg");
  if (!svg || reducedMotion() || typeof svg.animate !== "function") return;
  svg.animate([{transform: "rotate(-35deg) scale(.88)"}, {transform: "none"}], {duration: 180, easing: "cubic-bezier(.23, 1, .32, 1)"});
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
    sheetDrag(dlg);
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
  // Rodapé: a sequência leva à Hoje; na Hoje, o ritmo do dia abre o seletor do dia (#dayBtn).
  $("sidebarStatus").addEventListener("click", e => {
    const b = $("dayBtn");
    if ($("sidebarStatus").dataset.mode === "day" && b) {
      e.stopPropagation(); // senão o clique chega ao documento e fecha o seletor que acabou de abrir
      b.scrollIntoView({block: "nearest", behavior: scrollBehavior()});
      b.click();
      return;
    }
    navGo("home", "fade");
  });
  const navEl = navPillEl();
  if (navEl && typeof ResizeObserver === "function") new ResizeObserver(() => syncNavPill()).observe(navEl);
  // Celular ↔ PC (girar o tablet, redimensionar): Configurações muda de lugar e a pílula liga ou desliga.
  window.matchMedia("(max-width: 600px)").addEventListener("change", () => { if (typeof currentView !== "undefined") updateNav(currentView); });
}
