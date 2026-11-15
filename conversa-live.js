/* Conversa ao vivo (piloto, 11/11/2026): a fala vai e volta pelo Gemini Live (gemini-live.cjs no processo principal),
   que cuida da voz, das pausas e das interrupções; o app só transmite o microfone, toca a resposta e monta os balões
   com as transcrições do próprio Gemini. O Gemma local confere cada fala sua em segundo plano (convCheckTurn) e faz o
   resumo no fim (convFinish), sem nunca atrasar a voz. Mesma sala, pessoas, temas e memória da Conversa normal;
   sem a nota do tutor por fala nem a conferência do alemão dela (o Live não espera o app). Precisa de internet e de
   uma chave do Google AI Studio (Conversa → Ao vivo). No plano gratuito o Google usa o conteúdo para melhorar os produtos. */
const LIVE_CHUNK = 1600; // 100 ms de microfone por mensagem
const liveState = {info: null, loading: false};

function liveAvailable() { return !!(window.satzDesktop && window.satzDesktop.liveStart); }
function liveOn() { return liveAvailable() && !!settings.convLive && !!(liveState.info && liveState.info.hasKey); }
async function liveRefresh() {
  if (!liveAvailable() || liveState.loading) return;
  liveState.loading = true;
  try { liveState.info = await window.satzDesktop.liveInfo(); } catch (e) { liveState.info = null; }
  liveState.loading = false;
}
/* Caixa na tela inicial da Conversa: guardar a chave, ligar o modo e o aviso de privacidade. */
function liveSetupNode() {
  if (!liveAvailable()) return null;
  if (!liveState.info) { liveRefresh().then(() => { if (currentView === "conversa" && !conv.topic) renderConvSetup(); }); return null; }
  const privacy = h("p", {class: "muted small-text", text: "Piloto: a conversa vai pela internet para o Gemini Live do Google, que fala e escuta quase como uma ligação. No plano gratuito, o Google usa o que você fala para melhorar os produtos dele. As correções e o resumo continuam neste computador. Use fone de ouvido."});
  if (!liveState.info.hasKey) {
    const input = h("input", {type: "password", placeholder: "Chave do Google AI Studio", "aria-label": "Chave do Google AI Studio", autocomplete: "off"});
    const save = async () => {
      try { liveState.info = await window.satzDesktop.liveSetKey(input.value); settings.convLive = true; saveSettings(); toast("Chave guardada (criptografada neste computador).", "info"); renderConvSetup(); }
      catch (e) { setStatus(cleanIpcError(e, "Não consegui guardar a chave."), "error"); }
    };
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); save(); } });
    return h("section", {class: "notice conv-live"},
      h("div", null, h("b", {text: "Conversa ao vivo (piloto, online)"}), privacy,
        h("p", {class: "muted small-text", text: "Para ligar: em aistudio.google.com, entre com a sua conta do Google, toque em “Get API key” e cole a chave aqui."})),
      h("div", {class: "row"}, input, h("button", {class: "small", type: "button", onclick: save}, "Guardar chave")));
  }
  const box = h("input", {type: "checkbox", checked: !!settings.convLive});
  box.addEventListener("change", () => { settings.convLive = box.checked; saveSettings(); });
  const pace = h("select", {"aria-label": "Ritmo da fala dela"}, ...LIVE_PACES.map(([id, label]) => h("option", {value: id, text: label, selected: id === livePace()})));
  pace.addEventListener("change", () => { settings.convLivePace = pace.value; saveSettings(); });
  // Com a chave guardada: uma barra só; o aviso de privacidade fica numa linha curta, sempre à vista (o completo, no title).
  const bar = h("section", {class: "conv-live-bar", title: privacy.textContent},
    h("label", {class: "conv-live-toggle"}, box, h("span", null, h("b", {text: "Ao vivo"}), " pelo Gemini · online")),
    h("label", {class: "conv-live-pace"}, "Ritmo dela", pace),
    h("span", {class: "conv-live-note", text: "No plano gratuito, o Google usa o que você fala. Use fone."}),
    h("button", {class: "quiet small", type: "button", onclick: async () => { liveState.info = await window.satzDesktop.liveClearKey(); settings.convLive = false; saveSettings(); renderConvSetup(); }}, "Apagar chave"));
  return bar;
}
/* As instruções da Conversa normal (pessoa, nível, frases que ele já sabe) + o jeito de uma ligação. */
/* Ritmo da fala dela. O Live não tem controle de velocidade: vai pelas instruções (11/11/2026: no 1º teste ele achou rápido). */
const LIVE_PACES = [
  ["normal", "Normal", "Speak at a relaxed, natural pace and articulate clearly."],
  ["calmo", "Calmo", "Speak noticeably SLOWER than a native speaker normally would (about 75% of normal speed), articulate every word, and make a short pause after each sentence. Never rush, even when you are excited."],
  ["devagar", "Bem devagar", "Speak VERY slowly (about 60% of normal speed), like someone dictating to a beginner: every word clearly separated, a clear pause after each sentence, at most about 8 words per sentence. Never speed up."]];
function livePace() { const p = settings.convLivePace; return LIVE_PACES.some(x => x[0] === p) ? p : "calmo"; }
function liveSystemPrompt(base, pace = livePace()) {
  return base + "\n\nThis is a LIVE VOICE CALL with Luiz (German level " + convLevel() + "). Speak ONLY German, never English or Portuguese, even if he uses them. " +
    LIVE_PACES.find(x => x[0] === pace)[2] + " Short turns (1 to 3 short sentences), simple words at his level. " +
    "React like a real person: you may be surprised, amused or curious, and you do not need to ask a question every time. " +
    "If he interrupts you, drop what you were saying and react to what he just said. Never read out notes, brackets or instructions.";
}
/* Áudio do Gemini (PCM 16 bits, 24 kHz) tocado em sequência; interrompido, para tudo na hora. */
function livePlayer() {
  const ctx = new AudioContext({sampleRate: 24000}), sources = new Set(), meter = ctx.createAnalyser(), mbuf = new Float32Array(512);
  meter.fftSize = 512; meter.connect(ctx.destination); // a voz passa pelo medidor (anéis da sala, conversa-sala.js)
  let next = 0;
  return {
    push(bytes) {
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const pcm = new Int16Array(u8.buffer.slice(u8.byteOffset, u8.byteOffset + (u8.byteLength & ~1)));
      if (!pcm.length) return;
      const buf = ctx.createBuffer(1, pcm.length, 24000), ch = buf.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(meter);
      const at = Math.max(ctx.currentTime + .03, next);
      src.start(at); next = at + buf.duration;
      sources.add(src); src.onended = () => sources.delete(src);
    },
    stop() { for (const s of sources) { try { s.stop(); } catch (e) { /* já parou */ } } sources.clear(); next = 0; },
    playing() { return sources.size > 0; },
    level() { meter.getFloatTimeDomainData(mbuf); let s = 0; for (const v of mbuf) s += v * v; return Math.sqrt(s / mbuf.length); },
    close() { this.stop(); ctx.close().catch(() => {}); }
  };
}
/* Microfone contínuo a 16 kHz (mesmo worklet do detector de voz), em pedaços de 100 ms. */
async function liveMic(onChunk) {
  const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}});
  const ctx = new AudioContext({sampleRate: 16000});
  await ctx.audioWorklet.addModule("vad-worklet.js");
  const src = ctx.createMediaStreamSource(stream), node = new AudioWorkletNode(ctx, "satz-vad"), mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(node).connect(mute).connect(ctx.destination);
  let acc = new Int16Array(LIVE_CHUNK), n = 0;
  node.port.onmessage = e => {
    if (typeof salaMic === "function") { let s = 0; for (const v of e.data) s += v * v; salaMic(Math.sqrt(s / e.data.length)); }
    for (const v of e.data) {
      acc[n++] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
      if (n === LIVE_CHUNK) { onChunk(acc.buffer); acc = new Int16Array(LIVE_CHUNK); n = 0; }
    }
  };
  return {close() { node.port.onmessage = null; stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => {}); }};
}
/* Rascunho do balão enquanto a fala chega (o Gemini transcreve aos pedaços). */
function liveDraft(who) {
  const L = conv.live, key = who === "me" ? "meDraft" : "herDraft";
  if (!L[key] || !L[key].isConnected) {
    L[key] = h("div", {class: "bubble " + (who === "me" ? "me" : "other") + " pending"},
      who === "me" ? null : h("span", {class: "bubble-name", text: convName()}), h("p", {lang: "de"}));
    $("convChat").append(L[key]);
  }
  L[key].querySelector("p").textContent = who === "me" ? L.meText : L.herText;
  convScroll();
}
function liveCloseMe(spoken = true) {
  const L = conv.live;
  const text = convDedupeHeard(convClean(L.meText));
  L.meText = "";
  const draft = L.meDraft; L.meDraft = null;
  if (!text) { if (draft) draft.remove(); return; }
  const turn = {who: "me", de: text, live: true};
  if (spoken) turn.spoken = true;
  conv.turns.push(turn);
  conv.messages.push({role: "user", content: text});
  const bubble = convBubble(turn);
  if (draft && draft.isConnected) draft.replaceWith(bubble); else $("convChat").append(bubble);
  convScroll();
  convCheckTurn(turn, bubble); // correção do Gemma, sem esperar
  L.awaiting = true; // até ela começar a responder: “pensa…” na sala
}
function liveCloseHer(interrupted) {
  const L = conv.live;
  const text = convClean(L.herText);
  L.herText = "";
  const draft = L.herDraft; L.herDraft = null;
  if (!text) { if (draft) draft.remove(); return; }
  const de = interrupted ? text + " …" : text;
  const turn = {who: "partner", de, interrupted: !!interrupted, live: true};
  conv.turns.push(turn);
  conv.messages.push({role: "assistant", content: de});
  const bubble = convBubble(turn);
  if (draft && draft.isConnected) draft.replaceWith(bubble); else $("convChat").append(bubble);
  convScroll();
}
function liveEvent(e) {
  const L = conv.live;
  if (!L || !e) return;
  if (e.type === "ready") {
    L.ready = true;
    if (L.reconnecting) { L.reconnecting = false; liveStatus(); return; }
    liveStatus();
    if (!L.mic) liveMic(buf => { if (conv.live === L && !L.muted) window.satzDesktop.liveAudio(buf).catch(() => {}); })
      .then(m => { if (conv.live === L) L.mic = m; else m.close(); })
      .catch(() => { setStatus("Acesso ao microfone negado ou indisponível.", "error"); });
    if (L.opening) { window.satzDesktop.liveText(L.opening).catch(() => {}); L.opening = ""; }
    return;
  }
  if (e.type === "in") {
    if (L.herText && L.player.playing()) { /* ele começou a falar por cima: o Gemini manda “interrupted” em seguida */ }
    if (!L.meAt) L.meAt = performance.now();
    L.meText += e.text; liveDraft("me"); return;
  }
  if (e.type === "out") {
    if (L.meText) liveCloseMe();
    L.awaiting = false;
    if (!L.herText && L.meAt) { L.gaps.push(Math.round(performance.now() - L.meAt)); L.meAt = 0; }
    L.herText += e.text; liveDraft("her"); return;
  }
  if (e.type === "audio") { if (L.meText) liveCloseMe(); L.awaiting = false; L.player.push(e.data); return; }
  if (e.type === "interrupted") { L.player.stop(); L.interruptions++; liveCloseHer(true); return; }
  if (e.type === "turnComplete") { if (L.meText) liveCloseMe(); liveCloseHer(false); return; }
  if (e.type === "reconnecting") { L.reconnecting = true; L.ready = false; liveStatus(); return; }
  if (e.type === "goAway") return;
  if (e.type === "model") { liveModelTag(e.model); return; }
  if (e.type === "error" || e.type === "closed") {
    const why = e.reason || e.message || "";
    if (L.closing) return;
    liveEnd();
    $("convStatus").textContent = "A conversa ao vivo caiu" + (why ? ": " + why : ".") + " Toque em “Terminar e ver erros” para o resumo.";
  }
}
/* Mostra qual modelo atendeu (a chave pode não ter o 3.8 Live). */
function liveModelTag(model) {
  const tags = $("convMeta").querySelectorAll(".tag"), tag = tags[tags.length - 1];
  if (tag && tag.textContent.startsWith("Ao vivo")) tag.textContent = "Ao vivo · " + model;
}
function liveStatus() {
  const L = conv.live;
  if (!L) return;
  $("convStatus").textContent = L.reconnecting ? "Reconectando… (a conversa continua de onde parou)"
    : !L.ready ? "Conectando ao Gemini Live…"
    : L.muted ? "Microfone desligado. Aperte F para ligar de novo."
    : "Ao vivo: fale quando quiser; pode interromper. (F desliga o microfone)";
  $("convMic").replaceChildren(icon(L.muted ? "mic" : "stop", 18), L.muted ? "Ligar microfone" : "Desligar microfone", h("kbd", null, "F"));
}
/* Começa a ligação na sala já aberta (openConversaTopic). */
async function liveBegin(topic, opening) {
  const L = {topic, token: conv.token, ready: false, muted: false, meText: "", herText: "", meDraft: null, herDraft: null, meAt: 0, gaps: [], interruptions: 0,
    player: livePlayer(), mic: null, opening: topic.luizStarts ? "" : opening, startedAt: Date.now()};
  conv.live = L;
  window.satzDesktop.onLiveEvent(liveEvent);
  // O Gemma confere e resume: já começa a subir.
  window.satzDesktop.convStart().catch(() => {});
  fill($("convMeta"), ...Array.from($("convMeta").childNodes), h("span", {class: "tag", text: "Ao vivo · Gemini"}));
  L.slower = h("button", {class: "quiet small", type: "button", onclick: liveSlower}, "Mais devagar");
  const act = document.querySelector("#convStage .cv-stage-act");
  if (act) act.append(L.slower); else $("convMic").before(L.slower);
  liveSlowerLabel();
  liveStatus();
  try {
    const r = await window.satzDesktop.liveStart({voice: topic.voice || "charon", system: liveSystemPrompt(conv.messages[0].content)});
    if (r && r.model) liveModelTag(r.model);
  }
  catch (e) { liveEnd(); setStatus("Não consegui abrir a conversa ao vivo: " + cleanIpcError(e, "erro"), "error"); return; }
  // Saiu da tela ou abriu outra conversa: encerra a ligação.
  L.watch = setInterval(() => { if (conv.live !== L || conv.token !== L.token || currentView !== "conversa") liveEnd(L); }, 1000);
}
function liveEnd(only) {
  const L = conv.live;
  if (!L || (only && only !== L)) { if (only) { clearInterval(only.watch); only.player.close(); if (only.mic) only.mic.close(); } return; }
  L.closing = true;
  clearInterval(L.watch);
  if (L.mic) L.mic.close();
  L.player.close();
  if (L.meText) liveCloseMe();
  if (L.herText) liveCloseHer(true);
  window.satzDesktop.liveStop().then(stats => { if (stats) L.stats = stats; }).catch(() => {});
  conv.lastLive = {slower: L.slowerAsked || 0, gaps: L.gaps, interruptions: L.interruptions, secs: Math.round((Date.now() - L.startedAt) / 1000)};
  if (L.slower) L.slower.remove();
  conv.live = null;
  $("convMic").replaceChildren(icon("mic", 18), "Falar", h("kbd", null, "F"));
}
/* No meio da ligação: ela passa a falar mais devagar (pedido por texto, como ele mesmo faria) e o ritmo fica guardado
   para as próximas ligações (Normal → Calmo → Bem devagar). */
const LIVE_SLOWER = "(Hinweis, nicht vorlesen: Bitte sprich ab jetzt deutlich langsamer, Wort für Wort, mit kleinen Pausen zwischen den Sätzen. Sag nur kurz „Klar, langsamer“ und mach dann ganz normal weiter.)";
function liveSlower() {
  const L = conv.live;
  if (!L || !L.ready) return;
  const i = LIVE_PACES.findIndex(x => x[0] === livePace());
  if (i < LIVE_PACES.length - 1) { settings.convLivePace = LIVE_PACES[i + 1][0]; saveSettings(); }
  if (L.herText) { L.player.stop(); liveCloseHer(true); }
  window.satzDesktop.liveText(LIVE_SLOWER).catch(() => {});
  L.slowerAsked = (L.slowerAsked || 0) + 1;
  liveSlowerLabel();
}
function liveSlowerLabel() {
  const L = conv.live;
  if (L && L.slower) L.slower.title = "Ritmo agora: " + LIVE_PACES.find(x => x[0] === livePace())[1] + ". Toque para pedir mais devagar (fica guardado para as próximas).";
}
/* F / botão: liga e desliga o microfone (a ligação continua). */
function liveToggleMic() {
  const L = conv.live;
  if (!L) return false;
  L.muted = !L.muted;
  liveStatus();
  return true;
}
/* Fala digitada durante a ligação: vira balão na hora e vai para ela como texto. */
function liveSendTyped(text) {
  const L = conv.live;
  if (!L || !L.ready) return false;
  if (L.herText) { L.player.stop(); liveCloseHer(true); }
  L.meText = text;
  liveCloseMe(false);
  window.satzDesktop.liveText(text).catch(() => {});
  return true;
}
