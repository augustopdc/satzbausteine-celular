"use strict";
/* Gestos e transições do celular: arrastar folhas, deslizar o cartão para avaliar, próximo cartão pronto por baixo e
   o título que vira barra fina ao rolar. Só retorno visual: navigator.vibrate não funciona no iPhone. */
function motionOff() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
const DRAG_START = 10;

/* Arrasto num eixo: só começa depois de 10 px na direção certa; na outra direção, deixa o navegador rolar.
   onEnd recebe a distância e a velocidade (px/ms). O clique logo depois de um arrasto é ignorado. */
function trackDrag(el, {axis, accept, onStart, onMove, onEnd, onCancel}) {
  let s = null;
  const pos = e => axis === "x" ? e.clientX : e.clientY, cross = e => axis === "x" ? e.clientY : e.clientX;
  el.addEventListener("pointerdown", e => {
    if (e.button || !accept(e)) return;
    s = {id: e.pointerId, p0: pos(e), c0: cross(e), last: pos(e), t: e.timeStamp, v: 0, on: false};
  });
  el.addEventListener("pointermove", e => {
    if (!s || e.pointerId !== s.id) return;
    const d = pos(e) - s.p0, c = cross(e) - s.c0;
    if (!s.on) {
      if (Math.hypot(d, c) < DRAG_START) return;
      if (Math.abs(d) < Math.abs(c) * 1.3 || !accept(e)) { s = null; return; }
      s.on = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* evento simulado */ }
      onStart();
    }
    const dt = e.timeStamp - s.t;
    if (dt > 0) { s.v = (pos(e) - s.last) / dt; s.last = pos(e); s.t = e.timeStamp; }
    onMove(d);
  });
  el.addEventListener("pointerup", e => {
    if (!s || e.pointerId !== s.id) return;
    const was = s; s = null;
    if (!was.on) return;
    // Parou antes de soltar: não conta como “jogar”.
    onEnd(pos(e) - was.p0, e.timeStamp - was.t > 80 ? 0 : was.v);
    const eat = ev => { ev.stopPropagation(); ev.preventDefault(); };
    el.addEventListener("click", eat, {capture: true, once: true});
    setTimeout(() => el.removeEventListener("click", eat, {capture: true}), 300);
  });
  el.addEventListener("pointercancel", e => {
    if (!s || e.pointerId !== s.id) return;
    const was = s; s = null;
    if (was.on) onCancel();
  });
}
/* Para onde o movimento iria se o dedo soltasse e o objeto seguisse freando (como no iOS, “Designing Fluid Interfaces”):
   distância + velocidade × r/(1 − r), com r = 0,995 por ms, entre o “rápido” (0,99) e o “normal” (0,998) do iOS.
   Um peteleco curto e rápido conta como ir até o fim; parar antes de soltar zera a velocidade (trackDrag). */
const FLICK_RATE = .995;
function projected(d, v) { return d + v * FLICK_RATE / (1 - FLICK_RATE); }
/* Passar da borda: resistência que cresce (a do iOS), em vez de parede ou proporção fixa. */
function rubberBand(x, dim) { return (1 - 1 / (x * .55 / dim + 1)) * dim; }
function springBack(el) {
  el.classList.add("drag-back");
  el.style.removeProperty("transform");
  setTimeout(() => el.classList.remove("drag-back"), 260);
}

// ---------- Folhas ----------
/* Só no celular, onde a folha sobe de baixo. Passou de 30% da altura (ou foi jogada para baixo), fecha; senão, volta. */
function sheetDrag(dlg) {
  const reset = () => { dlg.classList.remove("dragging", "drag-back"); dlg.style.removeProperty("transform"); dlg.style.removeProperty("--sheet-fade"); };
  dlg.addEventListener("close", reset);
  trackDrag(dlg, {
    axis: "y",
    accept: e => navPhone() && dlg.scrollTop <= 0 && !e.target.closest("button, a, input"),
    onStart: () => dlg.classList.add("dragging"),
    onMove: d => {
      // Para cima só cede um pouco, com resistência crescente.
      const y = d > 0 ? d : -rubberBand(-d, dlg.offsetHeight);
      dlg.style.transform = "translateY(" + y + "px)";
      dlg.style.setProperty("--sheet-fade", String(Math.max(0, 1 - Math.max(0, y) / dlg.offsetHeight)));
    },
    onEnd: (d, v) => {
      dlg.classList.remove("dragging");
      if (d < 16 || projected(d, v) <= Math.max(80, dlg.offsetHeight * .3)) { springBack(dlg); dlg.style.removeProperty("--sheet-fade"); return; }
      if (motionOff()) { dlg.close(); return; }
      // Sai na velocidade em que foi jogada: a curva ease-out começa com inclinação ~4,35, então o tempo que mantém a
      // velocidade do dedo é 4,35 × o que falta ÷ velocidade (entre 120 e 300 ms; solta parada, desce em 300 ms).
      const left = Math.max(0, dlg.offsetHeight - Math.max(0, d)), ms = Math.min(300, Math.max(120, 4.35 * left / Math.max(v, .01)));
      const a = dlg.animate([{transform: dlg.style.transform}, {transform: "translateY(100%)"}], {duration: ms, easing: "cubic-bezier(.23, 1, .32, 1)", fill: "forwards"});
      const done = () => { a.cancel(); reset(); if (dlg.open) dlg.close(); };
      a.finished.then(done, done);
      setTimeout(done, 300);
    },
    onCancel: () => { dlg.classList.remove("dragging"); springBack(dlg); dlg.style.removeProperty("--sheet-fade"); }
  });
}

// ---------- Cartão ----------
/* Direita = Bom (avalia na hora). Esquerda = Errei: o cartão volta ao lugar e abre os motivos, como o botão;
   deslizar para a esquerda de novo segue sem motivo, como repetir a tecla. */
function clearCardDrag(flash) {
  flash.classList.remove("dragging");
  for (const p of ["transform", "--sw-good", "--sw-again"]) flash.style.removeProperty(p);
}
function initCardSwipe() {
  const flash = $("flashCard");
  trackDrag(flash, {
    axis: "x",
    accept: e => e.pointerType !== "mouse" && session.active && session.revealed && session.step !== "present"
      && !e.target.closest("button, a, input, textarea, summary, details, .shadow-panel") && !String(getSelection()),
    onStart: () => flash.classList.add("dragging"),
    onMove: d => {
      const limit = Math.min(110, flash.offsetWidth * .3), k = Math.min(1, Math.abs(d) / limit);
      flash.style.transform = "translateX(" + d + "px)" + (motionOff() ? "" : " rotate(" + d / 60 + "deg)");
      flash.style.setProperty("--sw-good", String(d > 0 ? k : 0));
      flash.style.setProperty("--sw-again", String(d < 0 ? k : 0));
    },
    onEnd: (d, v) => {
      const limit = Math.min(110, flash.offsetWidth * .3), go = Math.abs(d) >= 16 && Math.abs(projected(d, v)) >= limit && Math.sign(projected(d, v)) === Math.sign(d);
      if (!go) { backCard(flash); return; }
      if (d > 0) { session.leaveDir = 1; gradeTap("good"); return; }
      if (session.pendingGrade === "again") { session.leaveDir = -1; gradeTap("again"); return; }
      backCard(flash);
      gradeTap("again");
    },
    onCancel: () => backCard(flash)
  });
}
function backCard(flash) {
  flash.classList.remove("dragging");
  flash.style.removeProperty("--sw-good");
  flash.style.removeProperty("--sw-again");
  springBack(flash);
}
/* Próximo cartão pronto por baixo: uma cópia do atual sai por cima enquanto o novo já está desenhado no lugar.
   Devolve false quando não há animação (o cartão entra direto). */
let cardGhostEl = null;
function cardGhost(grade) {
  const flash = $("flashCard"), moved = flash.style.transform;
  let dir = session.leaveDir || 0;
  // Com o dedo, tocar em Bom/Errei faz o cartão sair para o mesmo lado do deslizar: a animação ensina o gesto
  // (como fechar a aba do Safari pelo X, que desliza a aba).
  if (!dir && (grade === "good" || grade === "again") && matchMedia("(pointer: coarse)").matches) dir = grade === "good" ? 1 : -1;
  session.leaveDir = 0;
  // A cópia sai antes da limpeza, para levar o selo “Bom” ou “Errei” junto.
  const g = flash.cloneNode(true);
  clearCardDrag(flash);
  if (cardGhostEl) { cardGhostEl.remove(); cardGhostEl = null; }
  // Avaliou pelo teclado: o próximo cartão aparece na hora, sem a cópia saindo nem a entrada (“key” pula as duas).
  if (session.viaKey) { session.viaKey = false; return "key"; }
  const r = flash.getBoundingClientRect();
  if (motionOff() || document.visibilityState !== "visible" || !r.width) return false;
  g.removeAttribute("id");
  g.removeAttribute("aria-live");
  g.removeAttribute("tabindex");
  g.querySelectorAll("[id]").forEach(x => x.removeAttribute("id"));
  g.classList.remove("enter", "dragging");
  g.classList.add("flash-ghost");
  if (dir) g.classList.add("swiped");
  g.setAttribute("aria-hidden", "true");
  g.inert = true;
  for (const [k, v] of [["left", r.left], ["top", r.top], ["width", r.width], ["height", r.height]]) g.style.setProperty(k, v + "px");
  flash.after(g);
  cardGhostEl = g;
  const from = moved || "none";
  const a = dir
    ? g.animate([{transform: from}, {transform: "translateX(" + dir * (window.innerWidth + 40) + "px) rotate(" + dir * 8 + "deg)"}], {duration: 200, easing: "cubic-bezier(.3, .6, .4, 1)", fill: "forwards"})
    : g.animate([{opacity: 1, transform: from}, {opacity: 0, transform: "translateY(-8px)"}], {duration: 160, easing: "ease-out", fill: "forwards"});
  const done = () => { g.remove(); if (cardGhostEl === g) cardGhostEl = null; };
  a.finished.then(done, done);
  setTimeout(done, 400);
  return true;
}

// ---------- Título que encolhe ----------
/* Quando o título grande sai de baixo da barra de cima, ele aparece pequeno e centrado nela. Com “Voltar”, divide a barra
   que já existe; sem “Voltar”, a própria barra aparece, translúcida. Título escondido (leitura, treino) não mostra nada. */
let titleIO = null;
function titleWatch(view) {
  if (typeof IntersectionObserver !== "function") return;
  if (titleIO) titleIO.disconnect();
  document.body.classList.remove("title-small");
  const title = document.querySelector("#view-" + view + " .page-head h1"), bar = $("miniTitle");
  if (!title || !bar || !navPhone()) return;
  const top = bar.offsetHeight || 52;
  titleIO = new IntersectionObserver(entries => {
    const e = entries[entries.length - 1], box = e.boundingClientRect;
    const small = box.height > 0 && !e.isIntersecting && box.top < top;
    if (small) bar.firstElementChild.textContent = title.textContent;
    document.body.classList.toggle("title-small", small);
  }, {rootMargin: -top + "px 0px 0px 0px"});
  titleIO.observe(title);
}
function initGestures() {
  initCardSwipe();
  window.matchMedia("(max-width: 600px)").addEventListener("change", () => titleWatch(currentView));
}
