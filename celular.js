"use strict";
/* Versão do celular (iPhone/navegador). No aplicativo do PC nada disto roda.
   - Registra o service worker (sw.js): o app abre sem internet.
   - Pede ao navegador para não apagar os dados (no iPhone, o app precisa estar na Tela de Início).
   - Guarda antes o áudio que vai ser usado: frases que vencem em 7 dias, próximas novas e cenas até o nível seguinte.
   Carregado depois de app.js. */

const AUDIO_CACHE_NAME = "satz-audio";
const offline = {busy: false, done: 0, total: 0, stored: null, persisted: null};

function offlineSupported() { return !window.satzDesktop && "serviceWorker" in navigator && "caches" in window && (location.protocol === "https:" || location.hostname === "localhost"); }
const audioPath = rel => new URL(rel, location.href).pathname;

/* Áudios a guardar já (lista de caminhos, sem repetir). Função pura sobre o estado: testada em _dev/tests. */
function offlineAudioList(now = Date.now(), days = 7) {
  const out = new Set(), until = now + days * DAY_MS;
  const voiced = c => usesNeural(c);
  for (const c of cards) {
    const p = cardProgress(c.id);
    if (!p || !voiced(c)) continue;
    if (["production", "listening"].some(m => p[m] && p[m].due <= until)) out.add(audioUrl(c, PRIMARY_VOICE));
  }
  const unseen = cards.filter(c => tag(c, "Modus") === "Produktion" && !cardProgress(c.id));
  const perDay = Math.max(1, Number(settings.newLimit) || 10);
  for (const c of orderNew(unseen, settings.levelGate).filter(voiced).slice(0, perDay * days * 1.5)) out.add(audioUrl(c, PRIMARY_VOICE));
  // Compreensão: as próximas que a escuta vai apresentar (LISTEN_NEW_PER_DAY por dia).
  const listen = cards.filter(c => tag(c, "Modus") === "Verstehen" && !cardProgress(c.id));
  for (const c of orderNew(listen, settings.levelGate).filter(voiced).slice(0, LISTEN_NEW_PER_DAY * days * 1.5)) out.add(audioUrl(c, PRIMARY_VOICE));
  const lvl = LEVELS.indexOf(currentLevel());
  for (const s of CENAS) if (LEVELS.indexOf(s.level) <= lvl + 1) s.lines.forEach((_, i) => out.add(sceneUrl(s.id, i)));
  return [...out];
}
/* Todo o áudio que a versão do celular usa (voz principal + cenas). */
function offlineAllAudio() {
  return [...cards.filter(usesNeural).map(c => audioUrl(c, PRIMARY_VOICE)), ...CENAS.flatMap(s => s.lines.map((_, i) => sceneUrl(s.id, i)))];
}
async function offlineFetch(list) {
  if (offline.busy || !navigator.onLine) return;
  offline.busy = true;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const have = new Set((await cache.keys()).map(r => new URL(r.url).pathname));
    const missing = list.map(audioPath).filter(p => !have.has(p));
    offline.done = 0; offline.total = missing.length;
    let next = 0;
    const worker = async () => {
      while (next < missing.length && navigator.onLine) {
        const p = missing[next++];
        try { const res = await fetch(p, {cache: "no-store"}); if (res.ok && res.status === 200) await cache.put(p, res); } catch (e) { /* tenta na próxima vez */ }
        offline.done++;
        if (offline.done % 50 === 0 && currentView === "settings") renderOffline();
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  } catch (e) { reportError("áudio offline", e.message, e.stack); }
  offline.busy = false;
  offline.stored = null;
  if (currentView === "settings") renderOffline();
}
async function offlineStatus() {
  try {
    const keys = await (await caches.open(AUDIO_CACHE_NAME)).keys();
    const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : {};
    offline.stored = {files: keys.length, usage: est.usage || 0};
  } catch (e) { offline.stored = {files: 0, usage: 0}; }
  if (currentView === "settings") renderOffline();
}
function renderOffline() {
  const box = $("offlinePanel");
  if (!box) return;
  if (!offlineSupported()) { box.hidden = true; return; }
  box.hidden = false;
  if (!offline.stored && !offline.busy) offlineStatus();
  const s = offline.stored, all = offlineAllAudio().length, mb = n => (n / 1048576).toLocaleString("pt-BR", {maximumFractionDigits: 0}) + " MB";
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  fill($("offlineText"),
    h("p", {text: offline.busy ? "Baixando áudio: " + offline.done + " de " + offline.total + "…"
      : s ? s.files.toLocaleString("pt-BR") + " de " + all.toLocaleString("pt-BR") + " áudios guardados neste aparelho (" + mb(s.usage) + " ocupados pelo app)."
      : "Conferindo o que já está guardado…"}),
    h("p", {class: "muted small-text", text: "O app guarda sozinho o áudio das frases dos próximos 7 dias, das próximas novas e das cenas até o nível seguinte. Para ter tudo sem internet, baixe todo o áudio (cerca de 140 MB, melhor no Wi-Fi)."}),
    !standalone ? h("p", {class: "notice warn", text: "No iPhone, abra no Safari, toque em Compartilhar → “Adicionar à Tela de Início” e use o app por esse ícone. Fora dele, o Safari apaga os dados depois de 7 dias sem uso."}) : null,
    offline.persisted === false ? h("p", {class: "muted small-text", text: "O navegador não garantiu guardar os dados para sempre: mantenha a sincronização ligada."}) : null);
  $("offlineAll").disabled = offline.busy || !navigator.onLine;
  $("offlineAll").textContent = offline.busy ? "Baixando…" : "Baixar todo o áudio";
}
function offlinePrefetchSoon() {
  if (!offlineSupported()) return;
  clearTimeout(offline.timer);
  // Espera o app terminar de abrir (catálogo e progresso carregados) antes de montar a lista.
  offline.timer = setTimeout(() => { if (document.documentElement.dataset.ready) offlineFetch(offlineAudioList()); else offlinePrefetchSoon(); }, 3000);
}
function offlineInit() {
  if (!offlineSupported()) return;
  document.documentElement.classList.add("offline-app");
  navigator.serviceWorker.register("sw.js").catch(e => reportError("service worker", e.message, e.stack));
  // Versão nova publicada: recarrega quando não há treino em andamento.
  // Na primeira instalação o service worker também assume o controle: aí não há o que recarregar.
  let reloading = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !hadController) return;
    if (session.active) { toast("Há uma versão nova do app. Ela entra quando você terminar o treino.", "info"); return; }
    reloading = true; location.reload();
  });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(ok => { offline.persisted = ok; }).catch(() => {});
  $("offlineAll").addEventListener("click", () => offlineFetch(offlineAllAudio()));
  window.addEventListener("online", offlinePrefetchSoon);
  offlinePrefetchSoon();
}
offlineInit();
