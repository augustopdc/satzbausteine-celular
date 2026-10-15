"use strict";
/* Sincronização pelo GitHub entre o PC e o celular: um arquivo comprimido (progresso.json.gz) num repositório PRIVADO.
   Cada aparelho baixa, mescla (mergeIncoming: cartão por cartão fica a revisão mais recente) e envia de volta; se o outro
   enviou no meio do caminho, o GitHub recusa (sha diferente) e tudo recomeça. Sem conseguir ler a nuvem, nada é enviado.
   - PC: os pedidos passam pelo processo principal (nuvem.cjs), que guarda a chave criptografada.
   - Celular: fala direto com a API do GitHub; a chave fica no armazenamento do app (só dá acesso a esse repositório).
   As configurações de SYNCED_SETTINGS viajam junto (vence a mudança mais recente, `syncAt`). Carregado depois de app.js. */

const CLOUD_KEY = "satzbausteine.github", CLOUD_LAST = "satzbausteine.githubLast", CLOUD_FILE = "progresso.json.gz";
const CLOUD_MIN_GAP = 60 * 1000;
const cloud = {busy: false, last: 0, error: "", lastTry: 0, timer: null};

function cloudWeb() { return !window.satzDesktop; }
function cloudWebConfig() { const c = safeRead(CLOUD_KEY, null); return c && c.repo && c.token ? c : null; }
function cloudApiBase() {
  // Nos testes (localhost), um servidor falso pode fazer o papel do GitHub.
  const test = location.hostname === "localhost" ? safeRead("satzbausteine.githubApi", "") : "";
  return test || "https://api.github.com";
}
function cloudRepo() { return cloudWeb() ? (cloudWebConfig() || {}).repo || "" : ((desktopInfo || {}).cloud || {}).connected ? desktopInfo.cloud.repo : ""; }
function cloudConnected() { return !!cloudRepo(); }

// ---------- Bytes: base64 e gzip ----------
function bytesToB64(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
function b64ToBytes(b64) { const s = atob(String(b64 || "").replace(/\s+/g, "")), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
async function gzipText(text) { return new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()); }
async function gunzipText(bytes) { return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text(); }
const utf8 = bytes => new TextDecoder().decode(bytes);

/* Um pedido ao arquivo do progresso: devolve {status, bytes}. */
async function cloudCall(method, body = null, accept = "") {
  if (!cloudWeb()) {
    const r = await window.satzDesktop.cloudRequest(method, body, accept);
    return {status: r.status, bytes: b64ToBytes(r.b64)};
  }
  const c = cloudWebConfig();
  if (!c) throw new Error("Sincronização com o GitHub não configurada.");
  const r = await fetch(cloudApiBase() + "/repos/" + c.repo + "/contents/" + CLOUD_FILE, {method, cache: "no-store",
    headers: {"Authorization": "Bearer " + c.token, "Accept": accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(body ? {"Content-Type": "application/json"} : {})},
    body: body || undefined});
  return {status: r.status, bytes: new Uint8Array(await r.arrayBuffer())};
}
function cloudDevice() {
  if (!cloudWeb()) return "PC";
  return /iPhone|iPad/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "navegador";
}
function cloudHttpError(status) {
  if (status === 401) return "O GitHub recusou a chave de acesso (expirou?). Crie outra e conecte de novo.";
  if (status === 403) return "A chave não tem permissão de escrita nesse repositório.";
  if (status === 404) return "Repositório não encontrado, ou a chave não tem acesso a ele.";
  return "O GitHub respondeu " + status + ".";
}
/* Configurações que vieram da nuvem: valem se foram mudadas depois das deste aparelho. */
function applyCloudSettings(remote) {
  if (!remote || typeof remote !== "object" || !(Number(remote.syncAt) > Number(settings.syncAt || 0))) return false;
  applyImportedSettings(syncedSettings(remote));
  settings.syncAt = Number(remote.syncAt);
  settings.syncKey = JSON.stringify(syncedSettings());
  safeWrite(KEY_SETTINGS, settings);
  return true;
}

async function cloudSync({quiet = true, force = false} = {}) {
  if (!cloudConnected() || cloud.busy || progressReadFailed) return false;
  if (!force && (session.active || Date.now() - cloud.lastTry < CLOUD_MIN_GAP || (cloudWeb() && !navigator.onLine))) return false;
  cloud.busy = true; cloud.lastTry = Date.now();
  renderCloud();
  let ok = false;
  try {
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      // 1. Lê o que está na nuvem (404 = ainda não existe) e mescla.
      const got = await cloudCall("GET");
      let sha = null, pulled = false;
      if (got.status === 200) {
        const meta = JSON.parse(utf8(got.bytes));
        sha = meta.sha;
        let gz = meta.encoding === "base64" && meta.content ? b64ToBytes(meta.content) : null;
        if (!gz) { const raw = await cloudCall("GET", null, "application/vnd.github.raw+json"); if (raw.status !== 200) throw new Error(cloudHttpError(raw.status)); gz = raw.bytes; }
        const parsed = JSON.parse(await gunzipText(gz));
        if (!parsed || !parsed.progress) throw new Error("O arquivo na nuvem não tem progresso.");
        await mergeIncoming(parsed, {settings: false});
        pulled = applyCloudSettings(parsed.settings);
      } else if (got.status !== 404) throw new Error(cloudHttpError(got.status));
      if (pulled && !session.active) refreshAll();
      // 2. Envia o resultado da mescla (com o sha lido; se outro aparelho enviou antes, o GitHub recusa e recomeça).
      const payload = await backupPayload(false);
      payload.settings = {...syncedSettings(), syncAt: Number(settings.syncAt || 0)};
      payload.device = cloudDevice();
      const body = JSON.stringify({message: "Sincronização · " + payload.device + " · " + new Date().toISOString(), content: bytesToB64(await gzipText(JSON.stringify(payload))), ...(sha ? {sha} : {})});
      const put = await cloudCall("PUT", body);
      if (put.status === 200 || put.status === 201) ok = true;
      else if (put.status !== 409 && put.status !== 422) throw new Error(cloudHttpError(put.status));
    }
    if (!ok) throw new Error("O outro aparelho estava sincronizando ao mesmo tempo. Tente de novo.");
    cloud.last = Date.now(); cloud.error = "";
    safeWrite(CLOUD_LAST, cloud.last);
    if (hasAnyProgress() && $("restoreOffer")) $("restoreOffer").hidden = true;
    if (!quiet) setStatus("Progresso sincronizado com o GitHub.", "success");
  } catch (e) {
    cloud.error = e.message || String(e);
    reportError("nuvem", cloud.error, e.stack);
    if (!quiet) setStatus("Não foi possível sincronizar: " + cloud.error, "error");
  }
  cloud.busy = false;
  renderCloud();
  return ok;
}
function cloudSyncSoon(delay = 1500) { if (!cloudConnected()) return; clearTimeout(cloud.timer); cloud.timer = setTimeout(() => cloudSync(), delay); }

/* Conectar: confere o repositório (existe, é privado, a chave grava). No PC, quem confere e guarda é o processo principal. */
async function cloudConnect(repo, token) {
  repo = String(repo || "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  token = String(token || "").trim();
  if (!cloudWeb()) { desktopInfo.cloud = await window.satzDesktop.cloudConnect({repo, token}); return; }
  if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(repo)) throw new Error("Escreva o repositório como usuario/nome (ex.: luiz/satzbausteine-dados).");
  if (!/^[A-Za-z0-9_]{20,255}$/.test(token)) throw new Error("A chave de acesso não parece um token do GitHub.");
  const r = await fetch(cloudApiBase() + "/repos/" + repo, {cache: "no-store", headers: {"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}});
  if (r.status !== 200) throw new Error(r.status === 401 ? "O GitHub recusou a chave (expirada ou digitada errado)." : cloudHttpError(r.status));
  const meta = await r.json();
  if (!meta.private) throw new Error("Esse repositório é público: qualquer pessoa veria o seu progresso. Use um repositório privado.");
  if (meta.permissions && !meta.permissions.push) throw new Error("A chave só pode ler esse repositório. Dê a ela permissão de escrita em “Contents”.");
  safeWrite(CLOUD_KEY, {repo, token});
}
async function cloudDisconnect() {
  if (!cloudWeb()) desktopInfo.cloud = await window.satzDesktop.cloudDisconnect();
  else { try { localStorage.removeItem(CLOUD_KEY); } catch (e) { /* nada */ } }
  cloud.error = ""; cloud.last = 0;
  renderCloud();
}

function renderCloud() {
  const box = $("cloudPanel");
  if (!box) return;
  if (!cloudWeb() && !desktopInfo) { box.hidden = true; return; }
  box.hidden = false;
  const repo = cloudRepo(), last = cloud.last || Number(safeRead(CLOUD_LAST, 0));
  if (!repo) {
    const repoIn = h("input", {type: "text", id: "cloudRepo", placeholder: "usuario/satzbausteine-dados", autocomplete: "off", autocapitalize: "off", spellcheck: "false"});
    const tokenIn = h("input", {type: "password", id: "cloudToken", placeholder: "github_pat_…", autocomplete: "off"});
    const btn = h("button", {class: "primary", type: "button", onclick: async () => {
      btn.disabled = true; btn.textContent = "Conectando…";
      try {
        await cloudConnect(repoIn.value, tokenIn.value);
        tokenIn.value = "";
        await cloudSync({quiet: false, force: true});
      } catch (e) { setStatus(cleanIpcError(e, "Não foi possível conectar."), "error"); }
      renderCloud();
    }}, "Conectar");
    fill(box, h("h2", {text: "Sincronizar com o celular"}),
      h("p", {class: "muted small-text", text: "PC e celular guardam o progresso num repositório privado do seu GitHub (grátis). Crie o repositório e uma chave de acesso só para ele (permissão “Contents: leitura e escrita”) e cole aqui. O mesmo repositório e a mesma chave servem nos dois aparelhos."}),
      h("div", {class: "grid two"}, h("div", {class: "field"}, h("label", {for: "cloudRepo", text: "Repositório"}), repoIn), h("div", {class: "field"}, h("label", {for: "cloudToken", text: "Chave de acesso (token)"}), tokenIn)),
      h("div", {class: "row"}, btn));
    return;
  }
  fill(box, h("h2", {text: "Sincronizar com o celular"}),
    h("div", {class: "notice" + (cloud.error ? " warn" : "")}, h("span", {text: cloud.busy ? "Sincronizando com " + repo + "…"
      : cloud.error ? "Última tentativa falhou: " + cloud.error
      : "Sincronizando com " + repo + (last ? " · última vez " + new Date(last).toLocaleString("pt-BR") : "") + ". Acontece ao abrir o app, ao terminar um treino e ao sair dele."})),
    h("div", {class: "row"},
      h("button", {type: "button", disabled: cloud.busy, onclick: () => cloudSync({quiet: false, force: true})}, "Sincronizar agora"),
      h("button", {class: "quiet", type: "button", onclick: () => { if (confirm("Desconectar? O progresso continua neste aparelho e no GitHub; só para de sincronizar.")) cloudDisconnect(); }}, "Desconectar")));
}
function cloudInit() {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") cloudSync({force: true}); else cloudSyncSoon(); });
  window.addEventListener("online", () => cloudSyncSoon());
  const t = setInterval(() => { if (document.visibilityState === "visible") cloudSync(); }, 15 * 60 * 1000);
  if (t && t.unref) t.unref();
}
cloudInit();
