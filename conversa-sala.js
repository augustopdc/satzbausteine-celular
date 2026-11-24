/* Sala da Conversa como uma ligação (11/11/2026, pedido do usuário: visual com cara de app pago, “pode improvisar bastante,
   animações etc.”). Em cima, a presença dela (#convStage): avatar com a inicial em letra de livro e três anéis que crescem
   com a voz dela (nível real no modo ao vivo, pelo AnalyserNode do livePlayer; nos outros modos, uma onda suave enquanto ela
   fala) e mudam de cor com o seu microfone; embaixo do nome, o estado em palavras. Um laço de requestAnimationFrame lê o
   estado da conversa (conv, conv.live, conv.speaker, audioPlayer) e só escreve variáveis CSS (--her, --me) e data-state.
   Sem animação com “reduzir movimento”. Os balões ganham entrada animada no CSS. */
const sala = {raf: 0, me: 0, her: 0, el: null, t0: 0};
const SALA_LABEL = {connecting: "Conectando…", speaking: "{n} fala", listening: "Ouvindo você", thinking: "{n} pensa…", turn: "Sua vez", muted: "Microfone desligado", done: "Conversa encerrada"};

function salaEl() {
  if (sala.el && sala.el.isConnected) return sala.el;
  const chat = $("convChat");
  if (!chat) return null;
  sala.el = h("section", {id: "convStage", class: "cv-stage", "data-state": "turn", "aria-live": "polite"},
    h("div", {class: "cv-orb", "aria-hidden": "true"},
      h("span", {class: "cv-ring r3"}), h("span", {class: "cv-ring r2"}), h("span", {class: "cv-ring r1"}),
      h("span", {class: "cv-avatar"}, h("span", {class: "cv-initial"}))),
    h("div", {class: "cv-stage-text"}, h("p", {class: "cv-who"}), h("p", {class: "cv-state"})),
    h("div", {class: "cv-stage-act"}));
  chat.before(sala.el);
  return sala.el;
}
/* Ao abrir uma conversa: nome, cidade (pessoas) e o laço da animação. */
function salaOpen(topic) {
  const el = salaEl();
  if (!el) return;
  const name = convName(topic), p = topic && topic.persona;
  el.querySelector(".cv-initial").textContent = (name.replace(/^Dra?\.\s*/, "")[0] || "?").toUpperCase();
  fill(el.querySelector(".cv-who"), h("b", {text: name}), p && p.city ? h("span", {class: "cv-city", text: p.city}) : topic && topic.krimi && typeof krimiSuspect === "function" ? h("span", {class: "cv-city", text: krimiSuspect(topic.krimi, topic.sid).papelPt})
    : topic && topic.rolePt && topic.rolePt !== name ? h("span", {class: "cv-city", text: topic.rolePt}) : null);
  // Ao telefone: um botão liga e desliga a “linha” na voz dela (conversa.js, convPhoneToggle).
  fill(el.querySelector(".cv-stage-act"), topic && topic.phone ? h("button", {class: "quiet small cv-phone", type: "button", "aria-pressed": String(convPhoneOn(topic)),
    title: "Som de ligação na voz (toque para ligar ou desligar)", onclick: convPhoneToggle}, icon("phone", 16), h("span", {text: "Linha de telefone"})) : null);
  el.hidden = false;
  sala.me = 0; sala.her = 0; sala.t0 = performance.now();
  salaSetState(salaState()); // já na abertura (janela escondida não roda o laço)
  if (!sala.raf) sala.raf = requestAnimationFrame(salaTick);
}
/* Nível do microfone (0–1), vindo da escuta (convListen) ou do ao vivo (liveMic). */
function salaMic(rms) { sala.me = Math.max(sala.me, Math.min(1, rms * 9)); }
function salaState() {
  if (conv.finished) return "done";
  const L = conv.live;
  if (L) {
    if (!L.ready) return "connecting";
    if (L.player.playing()) return "speaking";
    if (L.muted) return "muted";
    if (L.meText || sala.me > .12) return "listening";
    if (L.awaiting) return "thinking";
    return "turn";
  }
  const sp = conv.speaker, ap = typeof audioPlayer !== "undefined" ? audioPlayer : null;
  if ((sp && !sp.finished && sp.playing) || (ap && !ap.paused && !ap.ended && ap.currentTime > 0)) return "speaking";
  if (typeof speechSynthesis !== "undefined" && speechSynthesis.speaking) return "speaking";
  if (conv.clip) return "listening";
  if (conv.busy) return "thinking";
  return "turn";
}
function salaSetState(state) {
  const el = sala.el;
  if (!el) return;
  el.dataset.state = state;
  el.querySelector(".cv-state").textContent = SALA_LABEL[state].replace("{n}", convName());
}
function salaTick(now) {
  sala.raf = 0;
  const el = sala.el;
  if (!el || !el.isConnected || !conv.topic) return;
  // Sala escondida (outra tela): espera em marcha lenta e volta sozinha quando a conversa reaparecer.
  if ($("convRoom").hidden || document.hidden) { sala.raf = 1; setTimeout(() => { sala.raf = requestAnimationFrame(salaTick); }, 500); return; }
  const state = salaState(), L = conv.live;
  // “Reduzir movimento”: anéis parados, só o estado em palavras; confere 4 vezes por segundo em vez de 60.
  if (reducedMotion()) {
    el.style.setProperty("--her", "0"); el.style.setProperty("--me", "0");
    if (el.dataset.state !== state) salaSetState(state);
    sala.raf = 1; setTimeout(() => { sala.raf = requestAnimationFrame(salaTick); }, 250);
    return;
  }
  // Voz dela: nível real no ao vivo; nos outros modos, uma onda suave enquanto fala.
  let her = 0;
  if (state === "speaking") her = L && L.player.level ? Math.min(1, L.player.level() * 6) : .32 + .18 * Math.sin(now / 95) + .1 * Math.sin(now / 37);
  sala.her += (her - sala.her) * (her > sala.her ? .5 : .12);
  sala.me *= .9;
  el.style.setProperty("--her", sala.her.toFixed(3));
  el.style.setProperty("--me", sala.me.toFixed(3));
  if (el.dataset.state !== state) salaSetState(state);
  sala.raf = requestAnimationFrame(salaTick);
}
