"use strict";
/* Treino de artigos (der, die, das): você produz o substantivo com o artigo e o plural (“der Tisch, die Tische”), digitando
   ou falando (Whisper, só no PC); nada de escolher entre opções. Cada substantivo tem revisão espaçada própria em caixas
   (ART_DAYS) e, depois da resposta, o app mostra o atalho pela terminação quando existe (ART_RULES) ou a palavra da qual
   a composta herda o artigo. Ordem das novas: substantivos das frases que você já estudou, os do Menschen até a sua lição,
   o resto do A1 e depois o A2 intercalado com o grupo médico. Progresso em progress.practice.artigos (sincroniza). */
const ART_DAYS = [0, 1, 3, 7, 14, 30, 60, 120];
const ART_SOLID = 4, ART_NEW_PER_DAY = 8, ART_RUN_MAX = 20;
/* Atalhos pela terminação. `sure` = vale sempre nas palavras do treino; senão é “quase sempre” (as exceções aparecem). */
const ART_RULES = [
  {re: /ung$/, art: "die", sure: true, txt: "-ung"}, {re: /heit$/, art: "die", sure: true, txt: "-heit"}, {re: /keit$/, art: "die", sure: true, txt: "-keit"},
  {re: /schaft$/, art: "die", sure: true, txt: "-schaft"}, {re: /[st]ion$/, art: "die", sure: true, txt: "-ion"}, {re: /tät$/, art: "die", sure: true, txt: "-tät"},
  {re: /in$/, art: "die", sure: true, txt: "-in (mulher: Ärztin, Freundin)", plural: /innen$/},
  {re: /chen$/, art: "das", sure: true, txt: "-chen (diminutivo)", not: /[aou]chen$/}, {re: /lein$/, art: "das", sure: true, txt: "-lein (diminutivo)"},
  {re: /ling$/, art: "der", sure: true, txt: "-ling"}, {re: /ismus$/, art: "der", sure: true, txt: "-ismus"},
  {re: /(ist|ent|ant)$/, art: "der", sure: true, txt: "-ist, -ent, -ant (pessoas: Tourist, Patient)", plural: /en$/, not: /ment$/},
  {re: /(ie|ei)$/, art: "die", txt: "-ie, -ei (Therapie, Bäckerei)"}, {re: /(ik|ur|enz|anz)$/, art: "die", txt: "-ik, -ur, -enz (Musik, Kultur)"},
  {re: /e$/, art: "die", txt: "-e", note: " (cerca de 9 em 10)", not: /ee$/}, {re: /(ium|eum|um)$/, art: "das", txt: "-um (Studium, Museum)", not: /aum$/},
  {re: /ment$/, art: "das", txt: "-ment (Medikament)"}, {re: /nis$/, art: "das", txt: "-nis (Ergebnis)"}, {re: /o$/, art: "das", txt: "-o (Auto, Foto, Büro)"},
  {re: /or$/, art: "der", txt: "-or (Motor, Doktor)"}
];
const ART_DER_GROUPS = [
  [/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)$/, "dias da semana são der"],
  [/^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)$/, "meses são der"],
  [/^(Frühling|Sommer|Herbst|Winter)$/, "estações do ano são der"],
  [/^(Regen|Schnee|Wind|Nebel|Hagel)$/, "fenômenos do tempo costumam ser der"],
  [/^(Norden|Süden|Osten|Westen)$/, "pontos cardeais são der"]
];
/* Parecem compostas, mas não são (Antwort não vem de das Wort): sem a dica da última parte. */
const ART_NOT_COMPOUND = new Set(["Antwort", "Ausweis", "Schalter", "Gegenteil", "Schwein"]);
const art = {queue: [], i: 0, item: null, answered: false, result: null, stats: null, clip: null, busy: false};

// ---------- Dados ----------
function artData() {
  const p = progress.practice || (progress.practice = {});
  if (!p.artigos) p.artigos = {items: {}, intro: {}};
  return p.artigos;
}
function sanitizeArtigos(src) {
  const out = {items: {}, intro: {}};
  if (!src || typeof src !== "object") return out;
  for (const [k, s] of Object.entries(src.items || {})) {
    if (!/^[A-ZÄÖÜ][\p{L}-]{1,40}$/u.test(k) || !s || typeof s !== "object") continue;
    const b = Math.max(0, Math.min(ART_DAYS.length - 1, Math.round(Number(s.b) || 0))), n = Math.max(0, Math.round(Number(s.n) || 0));
    const w = Math.max(0, Math.min(n, Math.round(Number(s.w) || 0)));
    if (n) out.items[k] = {b, due: Number(s.due) || 0, n, w, at: Number(s.at) || 0};
  }
  for (const [d, n] of Object.entries(src.intro || {})) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number(n) > 0) out.intro[d] = Math.round(Number(n));
  return out;
}
/* Mescla: em cada substantivo vale o registro mais recente; as novas do dia, o maior número. */
function mergeArtigos(local, incoming) {
  const out = sanitizeArtigos(local), inc = sanitizeArtigos(incoming);
  for (const [k, s] of Object.entries(inc.items)) if (!out.items[k] || s.at > out.items[k].at) out.items[k] = s;
  for (const [d, n] of Object.entries(inc.intro)) out.intro[d] = Math.max(out.intro[d] || 0, n);
  return out;
}

/* Plural das listas do Menschen (“-n”, “¨-e”, “-”) a partir do singular. */
function artPluralFrom(noun, code) {
  code = String(code || "").trim();
  if (!code) return "";
  if (code === "-") return noun;
  const um = code.startsWith("¨"), end = code.replace(/^¨/, "").replace(/^-/, "");
  let base = noun;
  if (um) {
    const m = noun.match(/^(.*?)(au|a|o|u)([^aou]*)$/i);
    if (m) base = m[1] + {au: "äu", a: "ä", o: "ö", u: "ü", Au: "Äu", A: "Ä", O: "Ö", U: "Ü"}[m[2]] + m[3];
  }
  return base + end;
}
/* Todos os itens: a lista do treino + os substantivos do Menschen até a lição atual (que ainda não estão nela). */
function artItems() {
  const items = ARTIGOS.map(([a, noun, plural, pt, lvl]) => ({art: a, noun, plural, pt, lvl}));
  if (typeof MENSCHEN_LICOES !== "undefined") {
    const have = new Set(items.map(x => x.noun)), cur = typeof msCurrent === "function" ? msCurrent() : 1;
    for (const l of MENSCHEN_LICOES) {
      if (l.n > cur || !l.palavras) continue;
      for (const [de, code, pt] of l.palavras) {
        const m = de.match(/^(der|die|das) ([A-ZÄÖÜ][a-zäöüß]+)$/);
        if (!m || have.has(m[2])) continue;
        have.add(m[2]);
        items.push({art: m[1], noun: m[2], plural: artPluralFrom(m[2], code), pt, lvl: "Menschen", ms: l.n});
      }
    }
  }
  return items;
}
/* Ordem das novas: o que já apareceu nas suas frases, o Menschen da sua lição, o A1, e então A2 e médico intercalados. */
function artOrder(items = artItems()) {
  const seenText = cards.filter(c => cardProgress(c.id) && cardProgress(c.id).introducedAt).map(c => c.frase).join(" ");
  const seenWords = new Set(seenText.match(/\p{L}+/gu) || []);
  const rank = x => seenWords.has(x.noun) || (x.plural && seenWords.has(x.plural)) ? 0 : x.lvl === "Menschen" ? 1 : x.lvl === "A1" ? 2 : 3;
  const groups = [[], [], [], []];
  for (const x of items) groups[rank(x)].push(x);
  // Depois do A1: três do A2 para cada um do grupo médico.
  const a2 = groups[3].filter(x => x.lvl !== "Med"), med = groups[3].filter(x => x.lvl === "Med"), mixed = [];
  for (let i = 0, j = 0; i < a2.length || j < med.length;) {
    for (let k = 0; k < 3 && i < a2.length; k++) mixed.push(a2[i++]);
    if (j < med.length) mixed.push(med[j++]);
  }
  return [...groups[0], ...groups[1], ...groups[2], ...mixed];
}
function artStats(now = Date.now()) {
  const data = artData(), items = artItems();
  let solid = 0, learning = 0, due = 0;
  for (const x of items) {
    const s = data.items[x.noun];
    if (!s) continue;
    if (s.b >= ART_SOLID) solid++; else learning++;
    if (s.due <= now) due++;
  }
  const newLeft = Math.max(0, ART_NEW_PER_DAY - (data.intro[dateKey()] || 0));
  return {total: items.length, solid, learning, due, newLeft, unseen: items.length - solid - learning};
}
/* Rodada: vencidos (os mais atrasados primeiro) e as novas que ainda cabem hoje, até ART_RUN_MAX. */
function artQueue(now = Date.now()) {
  const data = artData(), order = artOrder();
  const due = order.filter(x => data.items[x.noun] && data.items[x.noun].due <= now).sort((a, b) => data.items[a.noun].due - data.items[b.noun].due);
  const fresh = order.filter(x => !data.items[x.noun]).slice(0, Math.max(0, ART_NEW_PER_DAY - (data.intro[dateKey()] || 0)));
  return [...due, ...fresh].slice(0, ART_RUN_MAX);
}

// ---------- Conferir a resposta ----------
function artNorm(w) { return String(w || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-zé]/g, ""); }
/* Lê “der Tisch, die Tische” (digitado ou falado). Artigo errado = erro; uma letra trocada no substantivo é tolerada. */
function artCheck(item, text) {
  const t = String(text || "").split(/[\s,;.!?/]+/).map(artNorm).filter(Boolean);
  const arts = ["der", "die", "das"];
  const i0 = t.findIndex(w => arts.includes(w));
  const said = i0 >= 0 ? t[i0] : "";
  const near = (a, b) => a === b || (a.length > 3 && similarity(a, b) >= .8);
  const noun = artNorm(item.noun), plural = artNorm(item.plural);
  const nounAt = t.findIndex((w, k) => k > i0 && near(w, noun));
  const nounOk = nounAt >= 0;
  // O plural é conferido letra por letra (Tisch × Tische, Vater × Väter: a diferença é justamente o que se treina).
  let pluralOk = null;
  if (item.plural) {
    const rest = (nounAt >= 0 ? t.slice(nounAt + 1) : []).filter(w => !arts.includes(w));
    pluralOk = rest.some(w => w === plural);
  }
  return {artOk: said === item.art, said, nounOk, pluralOk, ok: said === item.art && nounOk};
}
/* Atalho que explica o artigo: grupo (dias, meses…), composta (o artigo vem da última parte) ou terminação. */
function artRule(item, items = artItems()) {
  for (const [re, txt] of ART_DER_GROUPS) if (re.test(item.noun)) return {txt: "Os " + txt + ".", fits: item.art === "der"};
  const lower = item.noun.toLowerCase();
  const tail = ART_NOT_COMPOUND.has(item.noun) ? null : items.filter(x => x.noun !== item.noun && x.noun.length >= 4 && lower.endsWith(x.noun.toLowerCase()) && lower.length - x.noun.length >= 3)
    .sort((a, b) => b.noun.length - a.noun.length)[0];
  if (tail) return {txt: "Palavra composta: o artigo vem da última parte (" + tail.art + " " + tail.noun + ").", fits: tail.art === item.art, compound: true};
  for (const r of ART_RULES) {
    if (!r.re.test(lower) || (r.not && r.not.test(lower)) || (r.plural && !r.plural.test(item.plural || ""))) continue;
    const fits = r.art === item.art;
    return {txt: fits ? "Palavras em " + r.txt + " são " + (r.sure ? "sempre " : "quase sempre ") + r.art + (r.note || "") + "." : "Exceção: palavras em " + r.txt + " costumam ser " + r.art + ", mas esta é " + item.art + ".", fits};
  }
  return null;
}
/* Grava o resultado: acertou o artigo e o substantivo → sobe uma caixa (plural errado segura na mesma); errou → volta ao começo. */
function artRecord(item, r, now = Date.now()) {
  const data = artData(), prev = data.items[item.noun];
  if (!prev) data.intro[dateKey()] = (data.intro[dateKey()] || 0) + 1;
  const s = prev ? {...prev} : {b: 0, due: 0, n: 0, w: 0, at: 0};
  s.n++;
  if (!r.ok) { s.w++; s.b = 0; s.due = now + 10 * 60000; }
  else {
    s.b = r.pluralOk === false ? Math.max(1, s.b) : Math.min(ART_DAYS.length - 1, s.b + 1);
    s.due = now + Math.max(1, ART_DAYS[s.b]) * 864e5 - 3600e3;
  }
  s.at = now;
  data.items[item.noun] = s;
  saveProgress();
}

/* Duas palavras com a mesma tradução (o trem: Zug e Bahn): a pergunta mostra a primeira letra para não haver dúvida. */
function artSenses(pt) { return String(pt).replace(/\([^)]*\)/g, "").split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean); }
let artSenseCount = null;
function artNeedsHint(x) {
  if (!artSenseCount) {
    artSenseCount = new Map();
    for (const y of artItems()) for (const s of new Set(artSenses(y.pt))) artSenseCount.set(s, (artSenseCount.get(s) || 0) + 1);
  }
  return artSenses(x.pt).some(s => artSenseCount.get(s) > 1);
}

// ---------- Tela ----------
function artGenderSpan(a, word) { return h("span", {class: "gender " + {der: "g-der", die: "g-die", das: "g-das"}[a]}, a + " " + word); }
function renderArtigos() {
  const box = $("artigosRoot");
  if (!box) return;
  if (art.item) return artItemView(box);
  if (art.stats) return artSummary(box);
  const s = artStats(), q = artQueue();
  const data = artData();
  const hard = artItems().filter(x => data.items[x.noun] && data.items[x.noun].w).sort((a, b) => data.items[b.noun].w - data.items[a.noun].w).slice(0, 6);
  fill(box,
    h("div", {class: "panel art-hero"},
      h("div", {class: "art-today"}, h("b", {text: q.length.toLocaleString("pt-BR")}), h("span", {text: "para hoje"})),
      h("p", {class: "muted small-text", text: s.due + " para revisar · " + s.newLeft + " novas · " + s.learning + " em treino · " + s.solid + " firmes"}),
      h("p", {class: "muted small-text", text: "Escreva ou fale o artigo e o plural: “der Tisch, die Tische”."}),
      h("button", {class: "primary", type: "button", disabled: !q.length, onclick: artStart}, q.length ? iconText("play", "Começar (" + q.length + ")") : "Nada para hoje: volte amanhã")),
    hard.length ? h("div", {class: "panel"}, h("h3", {text: "Os que mais te enganam"}),
      h("p", {class: "art-hard"}, ...hard.flatMap((x, k) => [k ? " · " : "", artGenderSpan(x.art, x.noun)]))) : null,
    h("details", {class: "panel art-rules-box"}, h("summary", {text: "Atalhos pela terminação"}), h("p", {class: "muted small-text", text: "Valem para a grande maioria das palavras; as exceções aparecem no treino quando você chega nelas. Palavra composta herda o artigo da última parte: die Haltestelle (die Stelle), der Bahnhof (der Hof)."}),
      h("div", {class: "art-rules"}, ...[["die", "-ung, -heit, -keit, -schaft, -ion, -tät, -in (mulher)", "quase sempre: -e, -ie, -ei, -ik, -ur"],
        ["das", "-chen, -lein (diminutivos)", "quase sempre: -um, -ment, -nis, -o"],
        ["der", "-ling, -ismus, -ist/-ent/-ant (pessoas), dias, meses, estações", "quase sempre: -or"]].map(([a, sure, most]) =>
        h("div", {class: "art-rule"}, artGenderSpan(a, ""), h("p", null, h("b", {text: "Sempre: "}), sure), h("p", {class: "muted", text: most}))))));
}
function artStart() {
  const queue = artQueue();
  if (!queue.length) return;
  Object.assign(art, {queue, i: 0, item: queue[0], answered: false, result: null, stats: {ok: 0, total: 0, plural: 0, missed: []}});
  renderArtigos();
  setTimeout(() => { const el = $("artInput"); if (el) el.focus(); }, 30);
}
function artItemView(box) {
  const x = art.item, r = art.result;
  const input = h("input", {id: "artInput", type: "text", lang: "de", autocomplete: "off", spellcheck: "false", placeholder: "der … , die …", readonly: art.answered, value: art.answered ? art.typed : null});
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); art.answered ? artNext() : artSubmit(input.value); } });
  const voice = speechAvailable();
  const mic = voice && !art.answered ? h("button", {id: "artMic", type: "button", class: art.clip ? "danger-solid" : "", disabled: art.busy, onclick: artVoice},
    icon(art.clip ? "stop" : "mic", 18), art.clip ? "Parar e conferir" : art.busy ? "Transcrevendo…" : "Falar") : null;
  const head = h("div", {class: "art-progress"}, h("span", {text: (art.i + 1) + " de " + art.queue.length}),
    h("button", {class: "quiet small", type: "button", onclick: artQuit}, "Sair"));
  const prompt = h("div", {class: "panel art-card"},
    h("p", {class: "art-pt", text: x.pt}),
    h("p", {class: "muted small-text", text: (x.plural ? "com o artigo e o plural" : "com o artigo (esta palavra não costuma ter plural)") + (artNeedsHint(x) ? " · começa com " + x.noun[0] + "…" : "")}),
    h("div", {class: "art-answer"}, input, art.answered ? null : h("button", {class: "primary", type: "button", onclick: () => artSubmit(input.value)}, "Conferir", h("kbd", null, "Enter")), mic),
    art.answered ? null : h("button", {class: "quiet small", type: "button", onclick: () => artSubmit("")}, "Não sei"),
    r ? artFeedback(x, r) : null);
  fill(box, head, prompt);
  if (art.answered) setTimeout(() => { const n = $("artNext"); if (n) n.focus(); }, 30);
}
function artFeedback(x, r) {
  const rule = artRule(x);
  const status = r.ok ? (r.pluralOk === false ? ["warn", "Artigo certo. Confira o plural."] : ["ok", "Certo!"]) : ["no", r.said && r.said !== x.art ? "É " + x.art + ", não " + r.said + "." : r.said ? "Artigo certo, mas confira a palavra." : "Esta é a resposta:"];
  return h("div", {class: "art-feedback " + status[0]},
    h("p", {class: "art-status", text: status[1]}),
    h("p", {class: "art-solution", lang: "de"}, artGenderSpan(x.art, x.noun), x.plural ? [" · ", h("span", {class: "gender g-pl"}, "die " + x.plural)] : null),
    r.heard ? h("p", {class: "muted small-text", text: "Você disse: " + r.heard}) : null,
    rule ? h("p", {class: "art-rule-hint" + (rule.fits ? "" : " exception")}, icon("info", 16), h("span", {text: rule.txt})) : null,
    h("div", {class: "row"},
      h("button", {id: "artNext", class: "primary", type: "button", onclick: artNext}, art.i + 1 < art.queue.length ? "Próximo" : "Ver resultado", h("kbd", null, "Enter")),
      h("button", {class: "small", type: "button", onclick: () => speak(x.art + " " + x.noun + (x.plural ? ", die " + x.plural : ""))}, iconText("volume", "Ouvir"))));
}
function artSubmit(text, heard) {
  if (art.answered || !art.item) return;
  const r = artCheck(art.item, text);
  if (heard != null) r.heard = heard;
  art.result = r;
  art.typed = text;
  art.answered = true;
  artRecord(art.item, r);
  art.stats.total++;
  if (r.ok) art.stats.ok++; else { art.stats.missed.push(art.item); if (!art.queue.slice(art.i + 1).includes(art.item)) art.queue.push(art.item); }
  if (r.ok && r.pluralOk === false) art.stats.plural++;
  if (typeof uiSound === "function" && r.ok && r.pluralOk !== false) uiSound("ok");
  renderArtigos();
}
async function artVoice() {
  if (art.clip) { art.clip.stop(); return; }
  if (art.busy || art.answered) return;
  stopAudio();
  const clip = await startClip(6000);
  if (!clip) return;
  art.clip = clip;
  renderArtigos();
  const item = art.item, blob = await clip.done;
  art.clip = null;
  if (art.item !== item) return;
  art.busy = true;
  renderArtigos();
  let text = "";
  try { text = await transcribeBlob(blob, false); }
  catch (e) { setStatus("Não foi possível transcrever a fala: " + e.message, "error"); }
  art.busy = false;
  if (art.item !== item) return;
  if (!text) { renderArtigos(); setStatus("Não ouvi nada. Tente de novo ou digite.", "info"); return; }
  artSubmit(text, text);
}
function artNext() {
  if (art.i + 1 >= art.queue.length) { art.item = null; renderArtigos(); return; }
  art.i++;
  Object.assign(art, {item: art.queue[art.i], answered: false, result: null});
  renderArtigos();
  setTimeout(() => { const el = $("artInput"); if (el) el.focus(); }, 30);
}
function artQuit() { if (art.clip) art.clip.stop(); Object.assign(art, {item: null, stats: null, queue: [], clip: null}); renderArtigos(); }
function artSummary(box) {
  const st = art.stats;
  const missed = [...new Map(st.missed.map(x => [x.noun, x])).values()];
  fill(box, h("div", {class: "panel art-hero"},
    h("h2", {text: st.ok + " de " + st.total + " certos"}),
    st.plural ? h("p", {class: "muted", text: plural(st.plural, "plural para conferir", "plurais para conferir") + " (o artigo estava certo)."}) : null,
    missed.length ? [h("p", {text: "Voltam amanhã:"}), h("p", {class: "art-hard"}, ...missed.flatMap((x, k) => [k ? " · " : "", artGenderSpan(x.art, x.noun)]))] : h("p", {text: "Nenhum erro nesta rodada."}),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => { art.stats = null; renderArtigos(); }}, "Voltar"))));
}
