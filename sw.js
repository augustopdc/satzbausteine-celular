"use strict";
/* Service worker da versão do celular (iPhone/navegador; o aplicativo do PC não usa).
   - App: na instalação, guarda o index.html e tudo o que ele carrega (lido do próprio index.html, sem lista para manter).
     A versão abaixo é trocada pelo script de publicação; versão nova = cache novo, e o antigo é apagado.
   - Áudio: guardado conforme toca ou é baixado antes pela página (celular.js), num cache que sobrevive às atualizações. */
const VERSION = "7edf738988c4";
const APP_CACHE = "satz-app-" + VERSION;
const AUDIO_CACHE = "satz-audio";
const AUDIO_PATH = /\/(audio-charon|audio-cenas|audio-katja|audio|audio-pronuncia)\/[^/]+\.mp3$/;

async function appFiles() {
  const html = await (await fetch("index.html", {cache: "no-store"})).text();
  const refs = [...html.matchAll(/(?:src|href)="([^":#?]+\.(?:js|css|png|webmanifest|woff2))"/g)].map(m => m[1]);
  // O worker do otimizador e os ícones do manifesto não aparecem no index.html.
  return ["./", "index.html", "optimizer-worker.js", "icon-192.png", "icon-512.png", ...new Set(refs)];
}
/* O Safari do iPhone pede o áudio em pedaços (Range) e não toca uma resposta inteira vinda do cache. */
async function partial(res, range) {
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range || "");
  let start = m && m[1] ? Number(m[1]) : 0, end = m && m[2] ? Number(m[2]) : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start > end) return new Response(null, {status: 416, headers: {"Content-Range": "bytes */" + size}});
  return new Response(buf.slice(start, end + 1), {status: 206, headers: {"Content-Type": "audio/mpeg", "Accept-Ranges": "bytes",
    "Content-Range": "bytes " + start + "-" + end + "/" + size, "Content-Length": String(end - start + 1)}});
}
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll((await appFiles()).map(u => new Request(u, {cache: "no-store"})));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("satz-app-") && key !== APP_CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  // Livros baixados no celular (leitura-celular.js): só existem no cache do aparelho.
  if (url.pathname.includes("/livro-local/")) {
    event.respondWith((async () => {
      const hit = await (await caches.open("satz-livros")).match(url.pathname);
      if (!hit) return new Response("Livro não baixado neste aparelho.", {status: 404});
      const range = req.headers.get("range");
      return range && /\.mp3$/.test(url.pathname) ? partial(hit, range) : hit;
    })());
    return;
  }
  if (AUDIO_PATH.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(AUDIO_CACHE), range = req.headers.get("range");
      let hit = await cache.match(url.pathname);
      if (!hit) {
        // Baixa o arquivo inteiro (sem Range) para poder guardar; responde ao pedaço pedido a partir dele.
        const res = await fetch(url.pathname);
        if (!res.ok || res.status !== 200) return res;
        await cache.put(url.pathname, res.clone()).catch(() => {});
        hit = res;
      }
      return range ? partial(hit, range) : hit;
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    // Em desenvolvimento (versão "dev"), a rede vem primeiro: o código editado aparece sem limpar nada.
    if (VERSION === "dev") { try { const res = await fetch(req, {cache: "no-store"}); if (res.ok) { cache.put(req, res.clone()).catch(() => {}); return res; } } catch (e) { /* sem rede: usa a cópia */ } }
    const hit = await cache.match(req, {ignoreSearch: true}) || (req.mode === "navigate" ? await cache.match("index.html") : null);
    if (hit) return hit;
    try { return await fetch(req); }
    catch (e) { return new Response("Sem internet e sem cópia guardada.", {status: 503, headers: {"Content-Type": "text/plain;charset=utf-8"}}); }
  })());
});
