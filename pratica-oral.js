"use strict";
/* Prática oral: cenas (diálogos com vozes neurais), pares mínimos de pronúncia e escuta contínua.
   Carregado antes de app.js; usa o estado e as funções de app.js apenas quando chamado. */

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function waitForEnd(player, fallbackMs) {
  return new Promise(resolve => {
    if (!player) { setTimeout(resolve, fallbackMs); return; }
    let done = false;
    const finish = () => { if (done) return; done = true; player.removeEventListener("ended", finish); player.removeEventListener("error", finish); resolve(); };
    player.addEventListener("ended", finish);
    player.addEventListener("error", finish);
    setTimeout(finish, Math.max(fallbackMs, 20000));
  });
}
function playClip(url, fallbackText, slow = false) {
  stopAudio();
  const player = cachedPlayer(url), rate = (Number(settings.rate) || .9) * (slow ? .75 : 1);
  audioPlayer = player;
  player.onerror = () => speak(fallbackText, slow);
  try { player.currentTime = 0; } catch (e) { /* carregando */ }
  player.defaultPlaybackRate = rate;
  player.playbackRate = rate;
  player.play().catch(e => { if (e.name !== "AbortError") speak(fallbackText, slow); });
  return player;
}

// ---------- Cenas ----------
const SCENES = typeof CENAS !== "undefined" ? CENAS : [];
const scene = {data: null, idx: 0, swap: false, results: [], clip: null, mode: "idle", token: 0};
const sceneUrl = (id, i) => "audio-cenas/" + id + "-" + (i + 1) + ".mp3";
function sceneStats(id) { return ((progress.practice || {}).scenes || {})[id] || null; }
function renderScenes() {
  $("sceneList").hidden = false;
  $("scenePlayer").hidden = true;
  // Cenas do Nicos Weg primeiro, na ordem dos capítulos; depois as demais por nível.
  const chapter = Number.isFinite(Number(settings.nwChapter)) ? Number(settings.nwChapter) : 18;
  const course = (from, to) => SCENES.filter(s => sceneChapter(s) !== null && sceneChapter(s) >= from && sceneChapter(s) < to).sort((a, b) => sceneChapter(a) - sceneChapter(b));
  const where = "Uma cena por capítulo do curso; você está em " + nwChapterLabel(chapter) + ". As dos capítulos seguintes ficam mais claras, mas já podem ser feitas.";
  const groups = [["Nicos Weg A1", course(0, NW_A2_BASE), where],
    ["Nicos Weg A2", course(NW_A2_BASE, 99), where],
    ...LEVELS.map(level => ["Nível " + level, SCENES.filter(s => s.level === level && sceneChapter(s) === null)])].filter(([, list]) => list.length);
  // Selo só na exceção: a próxima cena sugerida (a primeira ainda não feita até o seu capítulo).
  const suggested = [...course(0, 99), ...SCENES.filter(s => sceneChapter(s) === null)].find(s => !sceneStats(s.id) && (sceneChapter(s) === null || sceneChapter(s) <= chapter));
  $("sceneList").replaceChildren(...groups.map(([title, list, explain]) => h("section", {class: "scene-group"},
    ...(explain ? titled("h2", title, explain) : [h("h2", {text: title})]),
    h("div", {class: "scene-grid"}, ...list.map(s => {
      const st = sceneStats(s.id), mine = s.lines.filter(l => l[0] === "m").length;
      const sc = sceneChapter(s), open = () => sceneSheet(s, mine);
      const card = h("article", {class: "scene-card scene-pick" + (sc !== null && sc > chapter ? " later" : "") + (s === suggested ? " suggested" : ""), tabindex: "0", role: "button", "aria-label": s.title, onclick: open},
        h("div", {class: "scene-top"}, h("span", {class: "tag", text: sc !== null ? (sc >= NW_A2_BASE ? "A2, cap. " + s.nw2 : "Cap. " + s.nw) + ", " + s.theme : s.theme}),
          st ? h("span", {class: "status s-learned", text: "Melhor: " + Math.round(st.best * 100) + "%"}) : s === suggested ? h("span", {class: "status s-next", text: "Sugerida"}) : null),
        h("h3", {text: s.title}),
        h("p", {class: "muted small-text", text: s.setting}),
        h("p", {class: "scene-meta small-text", text: "Com " + s.other.name + ", " + mine + " de " + s.lines.length + " falas são suas"}));
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      return card;
    })))));
}
function sceneSheet(s, mine) {
  actionSheet({title: s.title, sub: s.setting, actions: [
    {label: "Praticar", note: "Você faz as " + mine + " falas suas", icon: "speech", primary: true, onclick: () => openScene(s.id, false)},
    {label: "Trocar papéis", note: "Você faz o papel de " + s.other.name, icon: "repeat", onclick: () => openScene(s.id, true)},
    {label: "Só ouvir", note: "A cena inteira, sem falar", icon: "volume", onclick: () => openScene(s.id, false, true)}]});
}
function openScene(id, swap, listenOnly = false) {
  const data = SCENES.find(s => s.id === id);
  if (!data) return;
  Object.assign(scene, {data, idx: 0, swap, results: [], mode: "idle", token: scene.token + 1});
  $("sceneList").hidden = true;
  $("scenePlayer").hidden = false;
  $("sceneTitle").textContent = data.title + (swap ? " · papéis trocados" : "") + (listenOnly ? " · só ouvir" : "");
  $("sceneSetting").textContent = data.setting + (swap ? " Agora você faz o papel de " + data.other.name + "." : "");
  $("sceneMeta").replaceChildren(h("span", {class: "tag", text: "Nível " + data.level}), h("span", {class: "tag", text: data.register === "du" ? "du · informal" : "Sie · formal"}));
  $("sceneChat").replaceChildren();
  $("sceneSummary").hidden = true;
  $("sceneShowOther").checked = settings.sceneShowOther !== false;
  $("sceneHelp").value = SCENE_HELP[settings.sceneHelp] ? settings.sceneHelp : "auto";
  scene.help = sceneHelpLevel(data.id, swap);
  window.scrollTo({top: 0});
  if (listenOnly) listenWholeScene(); else advanceScene();
}
/* Escada da cena: 1ª vez vendo a frase, depois só a tarefa, e por fim sem ajuda (automático pelo melhor resultado). */
const SCENE_HELP = {auto: "automática", frase: "vendo a frase", tarefa: "só a tarefa", livre: "sem ajuda"};
function sceneHelpLevel(id, swap) {
  if (settings.sceneHelp && settings.sceneHelp !== "auto" && SCENE_HELP[settings.sceneHelp]) return settings.sceneHelp;
  const st = sceneStats(id);
  if (swap) return st && st.best >= .8 ? "tarefa" : "frase";
  return !st || !st.plays ? "frase" : st.best < .8 ? "tarefa" : "livre";
}
function setSceneHelp() {
  if (!scene.data) return;
  scene.help = sceneHelpLevel(scene.data.id, scene.swap);
  const pending = $("sceneChat").querySelector(".bubble.pending");
  if (pending && scene.mode === "turn") pending.replaceWith(bubble(scene.idx, {pending: true}));
}
function myRole() { return scene.swap ? "o" : "m"; }
function bubble(i, {hideText = false, pending = false} = {}) {
  const [who, de, pt, task] = scene.data.lines[i], mine = who === myRole();
  const el = h("div", {class: "bubble " + (mine ? "me" : "other") + (pending ? " pending" : ""), dataset: {i}});
  const name = mine ? (scene.swap ? "Você, como " + scene.data.other.name : "Você") : (who === "o" ? scene.data.other.name : "Parceiro");
  el.append(h("span", {class: "bubble-name", text: name}));
  if (pending) {
    const help = scene.help || "tarefa";
    el.append(h("p", {class: "bubble-task", text: help === "livre" ? "Sua vez: continue a conversa em alemão." : "Sua vez: " + (mine && !scene.swap ? task : "diga em alemão: “" + pt + "”")}));
    if (help === "frase") el.append(h("p", {class: "bubble-hint", lang: "de", text: de}));
  } else {
    const text = h("p", {class: "bubble-de", lang: "de", text: de});
    if (hideText) {
      text.hidden = true;
      el.append(h("button", {class: "quiet small reveal-text", type: "button", onclick: e => { text.hidden = false; e.currentTarget.remove(); }}, "Mostrar texto"));
    }
    el.append(text, h("p", {class: "bubble-pt", text: pt}),
      h("button", {class: "icon-btn bubble-play", type: "button", title: "Ouvir", "aria-label": "Ouvir esta fala", onclick: () => playSceneLine(i)}, icon("volume", 18)));
  }
  return el;
}
function playSceneLine(i, slow) { const line = scene.data.lines[i]; return playClip(sceneUrl(scene.data.id, i), line[1], slow); }
function scrollChat() { const chat = $("sceneChat"); chat.lastElementChild?.scrollIntoView({behavior: "smooth", block: "nearest"}); }
async function advanceScene() {
  const token = scene.token, lines = scene.data.lines;
  while (scene.idx < lines.length && token === scene.token) {
    const i = scene.idx, [who, de] = lines[i];
    if (who !== myRole()) {
      $("sceneChat").append(bubble(i, {hideText: !$("sceneShowOther").checked}));
      scrollChat();
      setSceneControls("listening");
      await waitForEnd(playSceneLine(i), 900 + de.length * 60);
      await wait(350);
      if (token !== scene.token) return;
      scene.idx++;
      continue;
    }
    $("sceneChat").append(bubble(i, {pending: true}));
    scrollChat();
    setSceneControls("turn");
    return;
  }
  if (token === scene.token) finishScene();
}
function setSceneControls(mode) {
  scene.mode = mode;
  const speech = speechAvailable();
  $("sceneSpeak").hidden = !(mode === "turn" || mode === "recording") || !speech;
  $("sceneSpeak").replaceChildren(icon(mode === "recording" ? "stop" : "mic", 18), mode === "recording" ? "Parar e conferir" : "Falar e conferir", h("kbd", null, "F"));
  $("sceneSpeak").classList.toggle("danger-solid", mode === "recording");
  $("sceneSpeak").disabled = mode === "busy";
  $("sceneReveal").hidden = mode !== "turn";
  $("sceneGrade").hidden = mode !== "graded";
  $("sceneStatus").textContent = mode === "listening" ? "Ouvindo…" : mode === "turn" ? "Fale a sua fala em voz alta e depois revele." : mode === "recording" ? "Gravando… fale a sua fala." : mode === "busy" ? "Transcrevendo…" : mode === "graded" ? "Saiu bem?" : "";
}
async function sceneSpeechCheck() {
  if (scene.mode === "recording" && scene.clip) { scene.clip.stop(); return; }
  if (scene.mode !== "turn" || !speechAvailable()) return;
  stopAudio();
  const clip = await startClip(20000);
  if (!clip) return;
  scene.clip = clip;
  setSceneControls("recording");
  const token = scene.token, blob = await clip.done;
  scene.clip = null;
  if (token !== scene.token) return;
  setSceneControls("busy");
  let text = "";
  try { text = await transcribeBlob(blob, false); } catch (e) { setStatus("Não foi possível transcrever: " + e.message, "error"); }
  if (token === scene.token) revealSceneLine(text);
}
function revealSceneLine(heard) {
  if (!(scene.mode === "turn" || scene.mode === "busy")) return;
  const i = scene.idx, pending = $("sceneChat").lastElementChild;
  const done = bubble(i);
  if (typeof heard === "string") {
    const {ops, correct, total} = wordDiff(scene.data.lines[i][1], heard);
    const line = h("p", {class: "diff-line small-diff", lang: "de"});
    ops.forEach(([type, word], k) => { if (k) line.append(" "); line.append(type === "eq" ? word : type === "near" ? h("span", {class: "near"}, word) : h(type, null, word)); });
    done.prepend(h("div", {class: "bubble-heard"}, h("span", {class: "muted small-text", text: "O app ouviu: “" + (heard || "…") + "” · " + correct + "/" + total}), line));
  }
  pending.replaceWith(done);
  scrollChat();
  playSceneLine(i);
  setSceneControls("graded");
}
function gradeSceneLine(ok) {
  if (scene.mode !== "graded") return;
  scene.results.push(ok);
  $("sceneChat").lastElementChild.classList.add(ok ? "ok" : "miss");
  scene.idx++;
  advanceScene();
}
function finishScene() {
  setSceneControls("idle");
  const total = scene.results.length, ok = scene.results.filter(Boolean).length;
  if (total) {
    const pct = ok / total;
    progress.practice = progress.practice || {scenes: {}, pron: {}};
    progress.practice.scenes = progress.practice.scenes || {};
    const prev = progress.practice.scenes[scene.data.id] || {best: 0, plays: 0};
    progress.practice.scenes[scene.data.id] = {best: Math.max(prev.best, pct), last: pct, plays: prev.plays + 1, at: Date.now()};
    progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
    saveProgress();
  }
  const id = scene.data.id, data = scene.data, next = sceneHelpLevel(id, scene.swap);
  fill($("sceneSummary"),
    h("h3", {text: total ? "Cena concluída: " + ok + " de " + total + " falas saíram bem" : "Fim da cena"}),
    h("p", {class: "muted", text: total && ok < total ? "Repita a cena até sair tudo com naturalidade. Depois, troque os papéis." : "Tente agora com os papéis trocados, ou esconda o texto da outra pessoa para treinar a escuta."}),
    total ? h("p", {class: "small-text", text: "Ajuda desta vez: " + SCENE_HELP[scene.help] + ". Próxima vez: " + SCENE_HELP[next]
      + (settings.sceneHelp === "auto" || !settings.sceneHelp ? " (sobe sozinha quando 80% das falas saem bem)." : ".")}) : null,
    h("div", {class: "row"},
      h("button", {class: "primary", type: "button", onclick: () => openScene(id, scene.swap)}, "Repetir"),
      h("button", {type: "button", onclick: () => openScene(id, !scene.swap)}, scene.swap ? "Papéis originais" : "Trocar papéis"),
      h("button", {type: "button", onclick: () => openScene(id, false, true)}, "Ouvir a cena inteira"),
      typeof convAvailable === "function" && convAvailable() ? h("button", {type: "button", title: "A IA faz o outro papel na mesma situação, mudando detalhes: você precisa ouvir e se adaptar",
        onclick: () => sceneImprov(data)}, "Improvisar com a IA") : null,
      h("button", {class: "quiet", type: "button", onclick: renderScenes}, "Outras cenas")),
    sceneCardsNode(data));
  $("sceneSummary").hidden = false;
  $("sceneSummary").scrollIntoView({behavior: "smooth", block: "nearest"});
}
/* Suas falas da cena viram cartões de Minhas frases (sem IA: a cena já tem tradução e tarefa). */
function sceneCardsNode(data) {
  if (typeof saveMineItem !== "function") return null;
  const mineLines = data.lines.map((l, i) => ({l, i})).filter(x => x.l[0] === "m");
  const exists = de => Object.values(mineData().items).some(m => !m.deleted && m.frase === de);
  const make = ({l}) => saveMineItem(newMineId(), {frase: l[1], traducao: l[2], situacao: l[3] + " (cena: " + data.title + ")", molde: "", foco: "",
    reg: data.register === "du" ? "du" : "Sie", nivel: data.level, fonte: "cena", erro: null});
  const rows = mineLines.map(x => {
    const done = exists(x.l[1]);
    const btn = h("button", {class: "quiet small", type: "button", disabled: done, onclick: () => { if (make(x)) { btn.disabled = true; btn.textContent = "Cartão criado ✓"; } }}, done ? "Já é cartão" : "Criar cartão");
    return h("div", {class: "scene-card-row"}, h("span", {lang: "de", text: x.l[1]}), btn);
  });
  const pending = mineLines.filter(x => !exists(x.l[1]));
  return h("details", {class: "spaced"}, h("summary", {text: "Levar as suas falas para o treino (" + mineLines.length + ")"}),
    h("p", {class: "muted small-text", text: "Viram cartões em Minhas frases, com a tarefa da cena como situação. Entram no treino como frases novas."}),
    h("div", {class: "scene-cards"}, ...rows),
    pending.length > 1 ? h("button", {class: "small", type: "button", onclick: e => {
      pending.forEach(make);
      toast(pending.length + " cartões criados.", "success");
      const fresh = sceneCardsNode(data);
      fresh.open = true;
      e.currentTarget.closest("details").replaceWith(fresh);
    }}, "Virar cartões de todas") : null);
}
/* Improviso: a mesma situação com a IA local, que muda detalhes do roteiro. */
function sceneImprov(data) {
  const script = data.lines.map(([who, de]) => (who === "m" ? "Luiz: " : data.other.name + ": ") + de);
  const topic = {id: "cena-" + data.id, group: "Cena", level: data.level, pt: "Improviso: " + data.title, role: data.other.name, rolePt: data.other.name,
    setting: "(descrição em português) " + data.setting, sie: data.register !== "du", luizStarts: data.lines[0][0] === "m", script};
  closeScene();
  showView("conversa");
  openConversaTopic(topic);
}
async function listenWholeScene() {
  const token = scene.token, lines = scene.data.lines;
  setSceneControls("listening");
  for (let i = 0; i < lines.length && token === scene.token; i++) {
    $("sceneChat").append(bubble(i));
    scrollChat();
    await waitForEnd(playSceneLine(i), 900 + lines[i][1].length * 60);
    await wait(450);
  }
  if (token === scene.token) { scene.results = []; finishScene(); }
}
function closeScene() { scene.token++; if (scene.clip) { scene.clip.stop(); scene.clip = null; } stopAudio(); renderScenes(); }
function sceneKey(e) {
  const key = e.key.toLowerCase();
  if (key === "escape") { e.preventDefault(); closeScene(); return true; }
  if (e.code === "Space" || e.key === "Enter") {
    if (scene.mode === "turn") { e.preventDefault(); revealSceneLine(); return true; }
    if (scene.mode === "graded") { e.preventDefault(); gradeSceneLine(true); return true; }
  }
  if (key === "1" && scene.mode === "graded") { e.preventDefault(); gradeSceneLine(false); return true; }
  if (key === "3" && scene.mode === "graded") { e.preventDefault(); gradeSceneLine(true); return true; }
  if (key === "f") { e.preventDefault(); sceneSpeechCheck(); return true; }
  if (key === "r") { e.preventDefault(); const i = Math.min(scene.idx, scene.data.lines.length - 1); playSceneLine(scene.mode === "turn" ? Math.max(0, i - 1) : i); return true; }
  return false;
}

// ---------- Pronúncia ----------
const PRON = typeof PRONUNCIA !== "undefined" ? PRONUNCIA : [];
const pron = {group: null, items: [], i: 0, score: 0, answered: false};
const pronUrl = (group, pair, side) => "audio-pronuncia/" + group + "-" + (pair + 1) + "-" + side + ".mp3";
function playPron(groupId, pairIndex, side) {
  const g = PRON.find(x => x.id === groupId), word = g.pairs[pairIndex][side === "a" ? 0 : 1];
  return playClip(pronUrl(groupId, pairIndex, side), word);
}
function renderPron() {
  $("pronList").hidden = false;
  $("pronPlayer").hidden = true;
  $("pronList").replaceChildren(...PRON.map(g => {
    const best = ((progress.practice || {}).pron || {})[g.id];
    return h("article", {class: "scene-card"},
      h("div", {class: "scene-top"}, h("span", {class: "tag", text: g.pairs.length + " pares"}), best != null ? h("span", {class: "status s-learned", text: "Melhor: " + Math.round(best * 100) + "%"}) : h("span", {class: "status s-new", text: "Novo"})),
      h("h3", {class: "pron-title", text: g.title}),
      h("p", {class: "muted small-text", text: g.tip}),
      h("div", {class: "row"},
        h("button", {class: "primary small", type: "button", onclick: () => startPronQuiz(g.id)}, "Treinar o ouvido"),
        h("button", {class: "small", type: "button", onclick: () => showPronPairs(g.id)}, "Ouvir e repetir")));
  }));
}
function pronHeader(g) {
  return [h("button", {class: "quiet small", type: "button", onclick: () => { stopAudio(); renderPron(); }}, "← Todos os sons"), h("h2", {text: g.title}), h("p", {class: "lede", text: g.tip})];
}
function showPronPairs(groupId) {
  const g = PRON.find(x => x.id === groupId);
  $("pronList").hidden = true;
  $("pronPlayer").hidden = false;
  fill($("pronPlayer"), ...pronHeader(g),
    h("p", {class: "muted", text: "Ouça cada par e repita em voz alta, exagerando a diferença."}),
    h("div", {class: "pair-list"}, ...g.pairs.map((p, i) => h("div", {class: "pair-row"},
      h("button", {class: "pair-word", type: "button", onclick: () => playPron(g.id, i, "a")}, icon("volume", 16), h("b", {lang: "de", text: p[0]}), h("small", {text: p[2]})),
      h("span", {class: "pair-vs", text: "×"}),
      h("button", {class: "pair-word", type: "button", onclick: () => playPron(g.id, i, "b")}, icon("volume", 16), h("b", {lang: "de", text: p[1]}), h("small", {text: p[3]}))))),
    h("div", {class: "row spaced"}, h("button", {class: "primary", type: "button", onclick: () => startPronQuiz(g.id)}, "Agora, treinar o ouvido")));
}
function startPronQuiz(groupId) {
  const g = PRON.find(x => x.id === groupId), items = [];
  for (let k = 0; k < 10; k++) items.push({pair: Math.floor(Math.random() * g.pairs.length), side: Math.random() < .5 ? "a" : "b"});
  Object.assign(pron, {group: g, items, i: 0, score: 0, answered: false});
  $("pronList").hidden = true;
  $("pronPlayer").hidden = false;
  renderPronItem();
}
function renderPronItem() {
  const g = pron.group, item = pron.items[pron.i], p = g.pairs[item.pair];
  pron.answered = false;
  const options = [["a", p[0], p[2]], ["b", p[1], p[3]]];
  fill($("pronPlayer"), ...pronHeader(g),
    h("div", {class: "pron-quiz"},
      h("p", {class: "counter", text: "Pergunta " + (pron.i + 1) + " de " + pron.items.length + " · acertos: " + pron.score}),
      h("button", {class: "play-xl", type: "button", "aria-label": "Ouvir de novo", onclick: () => playPron(g.id, item.pair, item.side)}, icon("play", 36)),
      h("p", {class: "muted", text: "Qual palavra você ouviu? (teclas 1 e 2)"}),
      h("div", {class: "pron-options"}, ...options.map(([side, word, pt], k) => h("button", {class: "pron-option", type: "button", dataset: {side},
        onclick: () => answerPron(side)}, h("kbd", null, String(k + 1)), h("b", {lang: "de", text: word}), h("small", {text: pt})))),
      h("div", {id: "pronFeedback", class: "pron-feedback"})));
  playPron(g.id, item.pair, item.side);
}
function answerPron(side) {
  if (pron.answered) return;
  pron.answered = true;
  const g = pron.group, item = pron.items[pron.i], ok = side === item.side;
  if (ok) pron.score++;
  all(".pron-option").forEach(b => { b.disabled = true; b.classList.add(b.dataset.side === item.side ? "right" : b.dataset.side === side ? "wrong" : "dim"); });
  fill($("pronFeedback"),
    h("p", {class: ok ? "fb-ok" : "fb-bad", text: ok ? "Isso!" : "Quase. Ouça os dois de novo:"}),
    h("div", {class: "row center"},
      h("button", {class: "small", type: "button", onclick: () => playPron(g.id, item.pair, "a")}, icon("volume", 16), g.pairs[item.pair][0]),
      h("button", {class: "small", type: "button", onclick: () => playPron(g.id, item.pair, "b")}, icon("volume", 16), g.pairs[item.pair][1])),
    h("button", {class: "primary", type: "button", onclick: nextPron}, pron.i + 1 < pron.items.length ? "Próxima" : "Ver resultado", h("kbd", null, "Espaço")));
}
function nextPron() {
  if (!pron.answered) return;
  pron.i++;
  if (pron.i < pron.items.length) { renderPronItem(); return; }
  const pct = pron.score / pron.items.length, g = pron.group;
  progress.practice = progress.practice || {scenes: {}, pron: {}};
  progress.practice.pron = progress.practice.pron || {};
  progress.practice.pron[g.id] = Math.max(progress.practice.pron[g.id] || 0, pct);
  progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
  saveProgress();
  fill($("pronPlayer"), ...pronHeader(g),
    h("div", {class: "summary"}, h("div", {class: "summary-icon"}, icon("check", 30)), h("h2", {text: pron.score + " de " + pron.items.length + " acertos"}),
      h("p", {class: "muted", text: pct >= .9 ? "Seu ouvido já distingue bem esse contraste. Agora treine a pronúncia repetindo os pares." : "Ouça os pares mais algumas vezes e repita em voz alta. A distinção vem com a prática."}),
      h("div", {class: "row center"}, h("button", {class: "primary", type: "button", onclick: () => startPronQuiz(g.id)}, "De novo"), h("button", {type: "button", onclick: () => showPronPairs(g.id)}, "Ouvir os pares"), h("button", {class: "quiet", type: "button", onclick: renderPron}, "Outros sons"))));
}
function pronKey(e) {
  if (!pron.group || $("pronPlayer").hidden) return false;
  if (e.key === "1" || e.key === "2") { e.preventDefault(); answerPron(e.key === "1" ? "a" : "b"); return true; }
  if (e.code === "Space" || e.key === "Enter") { if (pron.answered) { e.preventDefault(); nextPron(); return true; } }
  if (e.key.toLowerCase() === "r") { const item = pron.items[pron.i]; if (item) { e.preventDefault(); playPron(pron.group.id, item.pair, item.side); return true; } }
  if (e.key === "Escape") { e.preventDefault(); stopAudio(); renderPron(); return true; }
  return false;
}

// ---------- Escuta contínua ----------
const cont = {list: [], i: 0, paused: false, token: 0};
function ptVoice() {
  if (!("speechSynthesis" in window)) return null;
  return window.speechSynthesis.getVoices().find(v => /^pt(-|_)BR/i.test(v.lang)) || window.speechSynthesis.getVoices().find(v => /^pt/i.test(v.lang)) || null;
}
function speakPortuguese(text) {
  return new Promise(resolve => {
    const voice = ptVoice();
    if (!voice) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 1.05;
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setTimeout(resolve, 15000);
  });
}
function continuousList() {
  const learned = cards.filter(c => usesNeural(c) && matches(c, filters.session) && cardProgress(c.id) && cardProgress(c.id).introducedAt);
  learned.sort((a, b) => (cardProgress(b.id).introducedAt || 0) - (cardProgress(a.id).introducedAt || 0));
  let list = learned.slice(0, 80);
  if ($("contShuffle").checked) list = shuffled(list);
  return list;
}
function startContinuous() {
  const list = continuousList();
  if (list.length < 3) { setStatus("A escuta contínua usa frases que você já começou a aprender. Estude algumas frases primeiro.", "error"); return; }
  Object.assign(cont, {list, i: 0, paused: false, token: cont.token + 1});
  $("practiceSetup").hidden = true;
  $("sessionDone").hidden = true;
  $("contPlayer").hidden = false;
  $("contPause").textContent = "Pausar";
  $("contPortugueseRow").hidden = !ptVoice();
  window.scrollTo({top: 0});
  continuousLoop(cont.token);
}
function stopContinuous() {
  cont.token++;
  stopAudio();
  $("contPlayer").hidden = true;
  $("practiceSetup").hidden = false;
}
async function continuousLoop(token) {
  const voices = Object.keys(AUDIO_VOICES);
  while (token === cont.token && cont.i < cont.list.length) {
    if (cont.paused) { await wait(250); continue; }
    const card = cont.list[cont.i], {reg, text} = splitSituation(card.situacao);
    $("contCounter").textContent = (cont.i + 1) + " de " + cont.list.length;
    setWidth($("contBar"), cont.i / cont.list.length * 100);
    fill($("contCard"), regChip(reg), h("p", {class: "cont-sit muted", text: text}), h("p", {class: "answer", lang: "de", text: card.frase}), h("p", {class: "translation", text: card.traducao}));
    const first = voices[cont.i % voices.length] || PRIMARY_VOICE, second = voices[(cont.i + 1) % voices.length] || PRIMARY_VOICE;
    await waitForEnd(speakCard(card, false, first), 3000);
    if (token !== cont.token) return;
    await wait(1400 + card.frase.length * 45);
    if ($("contPortuguese").checked && ptVoice()) { await speakPortuguese(card.traducao); await wait(500); }
    if (token !== cont.token) return;
    await waitForEnd(speakCard(card, false, second), 3000);
    await wait(1600 + card.frase.length * 45);
    if (token !== cont.token) return;
    if (!cont.paused) cont.i++;
  }
  if (token === cont.token) {
    setWidth($("contBar"), 100);
    fill($("contCard"), h("p", {class: "answer", text: "Fim da lista."}), h("p", {class: "muted", text: cont.list.length + " frases ouvidas e repetidas."}));
    progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
    saveProgress();
  }
}
function toggleContinuousPause() {
  cont.paused = !cont.paused;
  $("contPause").textContent = cont.paused ? "Continuar" : "Pausar";
  if (cont.paused) stopAudio();
}
function skipContinuous() { stopAudio(); cont.i = Math.min(cont.list.length, cont.i + 1); const token = ++cont.token; cont.paused = false; $("contPause").textContent = "Pausar"; continuousLoop(token); }
