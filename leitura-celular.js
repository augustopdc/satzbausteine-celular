"use strict";
/* Leitura no celular. O PC envia cada livro (texto, anotações e um MP3 por capítulo) para o repositório PRIVADO do GitHub
   (livros/<id>/…, lista em livros/index.json); o celular baixa e guarda tudo no próprio aparelho (Cache Storage), e o
   service worker serve o áudio de livro-local/<id>/… com respostas parciais. Nada disso vai para o site público.
   Carregado depois de leitura-extra.js; usa a configuração do GitHub de nuvem.js só quando chamado. */

const RD_BOOKS_CACHE = "satz-livros", RD_LOCAL_KEY = "satzbausteine.livrosLocal", RD_INDEX_KEY = "satzbausteine.livrosIndex";
const rdLocalUrl = (id, file) => new URL("livro-local/" + id + "/" + file, location.href).pathname;
/* Endereço de uma ilustração do livro: no PC vem do processo principal; no celular, do que foi baixado. */
function rdImageUrl(book, name) { return window.satzDesktop ? "livro/" + book.id + "/img/" + encodeURIComponent(name) : rdLocalUrl(book.id, "img/" + name); }
const rdMB = n => (n / 1048576).toLocaleString("pt-BR", {maximumFractionDigits: 0}) + " MB";
const rdWeb = {busy: null, done: 0, total: 0, index: null, error: ""};

// ---------- PC: enviar para o celular ----------
function rdSendButton(b) {
  if (!window.satzDesktop || !window.satzDesktop.sendBookToPhone || !b.audio || b.sync.state !== "done") return null;
  const connected = desktopInfo && desktopInfo.cloud && desktopInfo.cloud.connected;
  const sent = (readingState().sent || {})[b.id];
  const status = h("span", {id: "rdSend-" + b.id, class: "muted small-text", text: !connected ? "Para ler no celular, conecte o GitHub em Configurações → Sincronizar com o celular."
    : sent ? "No celular desde " + new Date(sent.at).toLocaleDateString("pt-BR") + " (" + rdMB(sent.size) + "). Envie de novo se mudou alguma anotação." : "Vai para o seu repositório privado do GitHub; o áudio fica com 1/3 do tamanho."});
  const btn = h("button", {class: "small", type: "button", disabled: !connected, onclick: async () => {
    btn.disabled = true;
    status.textContent = "Preparando o áudio…";
    try {
      const r = await window.satzDesktop.sendBookToPhone(b.id);
      const s = readingState();
      s.sent = {...(s.sent || {}), [b.id]: {at: Date.now(), size: r.size}};
      safeWrite(KEY_READING, s);
      status.textContent = "Enviado ✓ (" + rdMB(r.size) + "). No celular: Leitura → Baixar.";
      toast("Livro enviado para o celular. Abra o app no iPhone → Leitura → Baixar.", "success");
    } catch (e) { status.textContent = "Não consegui enviar: " + cleanIpcError(e, "erro"); }
    btn.disabled = false;
  }}, iconText("phone", sent ? "Enviar de novo" : "Enviar para o celular"));
  return h("div", {class: "book-status"}, btn, status);
}
function rdOnSendProgress(d) {
  const el = document.getElementById("rdSend-" + d.id);
  if (!el) return;
  if (d.stage === "audio") el.textContent = "Preparando o áudio por capítulo… " + d.pct + "%";
  if (d.stage === "upload") el.textContent = "Enviando para o GitHub… " + d.pct + "%";
}

// ---------- Celular: baixar e ler ----------
function rdLocalList() { return safeRead(RD_LOCAL_KEY, {}) || {}; }
/* Um arquivo do repositório privado, inteiro (bytes) ou null se não existir. */
async function rdCloudRaw(path) {
  const c = cloudWebConfig();
  if (!c) throw new Error("Conecte o GitHub em Ajustes → Sincronizar com o celular.");
  const r = await fetch(cloudApiBase() + "/repos/" + c.repo + "/contents/" + path, {cache: "no-store",
    headers: {"Authorization": "Bearer " + c.token, "Accept": "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28"}});
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(cloudHttpError(r.status));
  return new Uint8Array(await r.arrayBuffer());
}
async function rdWebIndex() {
  try {
    const bytes = await rdCloudRaw("livros/index.json");
    rdWeb.index = bytes ? JSON.parse(new TextDecoder().decode(bytes)) : {books: []};
    safeWrite(RD_INDEX_KEY, rdWeb.index);
    rdWeb.error = "";
  } catch (e) {
    rdWeb.index = safeRead(RD_INDEX_KEY, null) || {books: []};
    rdWeb.error = navigator.onLine ? e.message : "";
  }
  return rdWeb.index;
}
async function rdWebDownload(entry) {
  if (rdWeb.busy) return;
  rdWeb.busy = entry.id; rdWeb.done = 0; rdWeb.total = entry.parts + (entry.images ? 1 : 0) + 1;
  rdWebRender();
  try {
    const cache = await caches.open(RD_BOOKS_CACHE);
    const gz = await rdCloudRaw("livros/" + entry.id + "/livro.json.gz");
    if (!gz) throw new Error("O livro não está mais no GitHub. Envie de novo pelo PC.");
    const meta = JSON.parse(await gunzipText(gz));
    for (const p of meta.parts) {
      const bytes = await rdCloudRaw("livros/" + entry.id + "/" + p.file);
      if (!bytes) throw new Error("Falta o áudio " + p.file + ". Envie o livro de novo pelo PC.");
      await cache.put(rdLocalUrl(entry.id, p.file), new Response(bytes, {headers: {"Content-Type": "audio/mpeg"}}));
      rdWeb.done++;
      rdWebRender();
    }
    // Ilustrações: um arquivo com todas (nome → base64), guardadas uma a uma em livro-local/<id>/img/<nome>.
    if ((meta.images || []).length) {
      const gzImg = await rdCloudRaw("livros/" + entry.id + "/imagens.json.gz");
      if (gzImg) {
        const imgs = JSON.parse(await gunzipText(gzImg));
        for (const [name, b64] of Object.entries(imgs)) {
          if (!/^[\w.-]{1,80}$/.test(name)) continue;
          const type = /\.png$/i.test(name) ? "image/png" : /\.gif$/i.test(name) ? "image/gif" : /\.webp$/i.test(name) ? "image/webp" : /\.svg$/i.test(name) ? "image/svg+xml" : "image/jpeg";
          await cache.put(rdLocalUrl(entry.id, "img/" + name), new Response(b64ToBytes(b64), {headers: {"Content-Type": type}}));
        }
      }
      rdWeb.done++;
      rdWebRender();
    }
    // O texto vai por último: livro sem texto guardado conta como não baixado.
    await cache.put(rdLocalUrl(entry.id, "livro.json"), new Response(JSON.stringify(meta), {headers: {"Content-Type": "application/json"}}));
    const list = rdLocalList();
    list[entry.id] = {title: meta.title, sentAt: meta.sentAt, size: entry.size, at: Date.now(), cover: meta.cover && (meta.images || []).includes(meta.cover) ? meta.cover : null};
    safeWrite(RD_LOCAL_KEY, list);
    toast("“" + meta.title + "” está no celular e funciona sem internet.", "success");
  } catch (e) { setStatus("Não consegui baixar o livro: " + e.message, "error"); }
  rdWeb.busy = null;
  rdWebRender();
}
async function rdWebRemove(id) {
  if (!confirm("Tirar este livro do celular? Ele continua no PC e no GitHub; dá para baixar de novo.")) return;
  const cache = await caches.open(RD_BOOKS_CACHE);
  for (const req of await cache.keys()) if (new URL(req.url).pathname.startsWith(rdLocalUrl(id, ""))) await cache.delete(req);
  const list = rdLocalList(); delete list[id]; safeWrite(RD_LOCAL_KEY, list);
  rdWebRender();
}
async function rdWebGetBook(id) {
  const hit = await (await caches.open(RD_BOOKS_CACHE)).match(rdLocalUrl(id, "livro.json"));
  if (!hit) throw new Error("Este livro não está baixado no celular.");
  const meta = await hit.json();
  return {...meta, audio: {name: "por capítulo"}, parts: meta.parts.map(p => ({...p, url: rdLocalUrl(id, p.file)})),
    notes: meta.notes || {s: {}, w: {}}, status: {sync: {state: "done", matched: (meta.sync || {}).matched}}};
}
/* Correções feitas no celular ficam na cópia do celular (o PC não recebe de volta). */
async function rdWebSaveNotes(id, notes) {
  const cache = await caches.open(RD_BOOKS_CACHE), url = rdLocalUrl(id, "livro.json"), hit = await cache.match(url);
  if (!hit) return;
  const meta = await hit.json();
  meta.notes = notes;
  await cache.put(url, new Response(JSON.stringify(meta), {headers: {"Content-Type": "application/json"}}));
}
async function rdWebLibrary(box) {
  fill(box, typeof rdDiaryNode === "function" ? rdDiaryNode() : null, h("p", {class: "muted", text: "Carregando os livros…"}));
  if (!cloudWebConfig()) {
    fill(box, typeof rdDiaryNode === "function" ? rdDiaryNode() : null,
      h("p", {class: "notice", text: "Para ler no celular, conecte o GitHub em Ajustes → Sincronizar com o celular. Depois, no PC, abra o livro na Leitura e toque em “Enviar para o celular”."}));
    return;
  }
  if (!rdWeb.index || navigator.onLine) await rdWebIndex();
  rdWebRender();
}
function rdWebBook(id) {
  const remote = ((rdWeb.index || {books: []}).books || []).find(b => b.id === id), mine = rdLocalList()[id];
  if (!remote && !mine) return null;
  return {remote, mine, busy: rdWeb.busy === id, outdated: !!(remote && mine && remote.sentAt > mine.sentAt),
    b: {id, title: (remote || mine).title, author: remote ? remote.author : "", chapters: remote ? remote.chapters : 0, cover: mine && mine.cover}};
}
function rdWebBookSettings(id) {
  const x = rdWebBook(id);
  if (!x) return null;
  const {remote, mine, busy, outdated, b} = x;
  return [b.title, [
    h("div", {class: "bd-cover"}, rdCoverNode(b)),
    h("div", {class: "bd-info"},
      remote ? h("p", {class: "muted small-text", text: [rdAuthor(b), remote.chapters + " capítulos", (remote.words || 0).toLocaleString("pt-BR") + " palavras", rdMB(remote.size)].filter(Boolean).join(" · ")}) : null,
      busy ? h("p", {class: "small-text", text: "Baixando… " + rdWeb.done + " de " + rdWeb.total + " partes. Deixe o app aberto."})
        : h("p", {class: "small-text", text: mine ? "Guardado neste aparelho" + (outdated ? ". Há uma versão mais nova no PC." : ".") : "Ainda não está neste aparelho."}),
      h("div", {class: "row"},
        mine && !busy ? h("button", {class: "primary", type: "button", onclick: () => { $("rdBookDialog").close(); openBook(id); }}, bookPosition(id) ? "Continuar lendo" : "Abrir") : null,
        remote && (!mine || outdated) && !busy ? h("button", {class: mine ? "small" : "primary", type: "button", disabled: !!rdWeb.busy || !navigator.onLine, onclick: () => rdWebDownload(remote)}, mine ? "Atualizar" : "Baixar para o celular") : null),
      mine && !busy ? h("div", {class: "bd-foot"}, h("button", {class: "quiet small danger-text", type: "button", onclick: () => rdWebRemove(id)}, "Tirar do celular")) : null)]];
}
function rdWebRender() {
  rdBookDialogRefresh();
  const box = $("readingLibrary");
  if (!box || reading.book || currentView !== "reading") return;
  const local = rdLocalList(), books = (rdWeb.index || {books: []}).books || [];
  const ids = [...new Set([...books.map(b => b.id), ...Object.keys(local)])];
  const items = ids.map(id => {
    const {remote, mine, busy, outdated, b} = rdWebBook(id);
    return rdShelfItem(b, {cloud: !mine,
      open: () => mine && !busy ? openBook(id) : remote && !rdWeb.busy && navigator.onLine ? rdWebDownload(remote) : rdBookDialog(id, rdWebBookSettings),
      gear: () => rdBookDialog(id, rdWebBookSettings),
      alert: busy ? "Baixando… " + rdWeb.done + " de " + rdWeb.total : !mine ? "Toque para baixar" : outdated ? "Versão nova no PC" : null});
  });
  const recent = ids.filter(id => local[id] && bookPosition(id)).sort((x, y) => (bookPosition(y).at || 0) - (bookPosition(x).at || 0))[0];
  fill(box,
    recent && rdWebBook(recent).b.chapters ? rdContinueNode(rdWebBook(recent).b, () => openBook(recent)) : null,
    rdWeb.error ? h("p", {class: "notice warn", text: "Não consegui ver a lista de livros no GitHub: " + rdWeb.error}) : null,
    h("div", {class: "shelf-head"}, h("h2", {text: "Sua estante"})),
    items.length ? rdShelf(items)
      : h("p", {class: "empty", text: "Nenhum livro enviado ainda. No PC, abra a Leitura e toque em “Enviar para o celular” no livro."}),
    typeof rdDiaryNode === "function" ? rdDiaryNode() : null,
    h("p", {class: "muted small-text", text: "Os livros ficam no seu repositório privado e, depois de baixados, neste aparelho. O áudio vem em partes, uma por capítulo (cerca de 1/3 do tamanho original). A explicação de palavras novas pela IA só existe no PC."}));
}
if (window.satzDesktop && window.satzDesktop.onCloudBookProgress) window.satzDesktop.onCloudBookProgress(rdOnSendProgress);
