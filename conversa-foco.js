/* O ponto da conversa (11/11/2026, pedido do usuário: o resumo antigo era “um turbilhão de informação”, não dizia o que
   melhorar, e criar cartão ali era inútil porque ele já tem coisa demais para revisar).
   Em vez de listar tudo: UM ponto por conversa, escolhido por regra (o erro que se repete nas últimas conversas pesa mais),
   um treino de 1 minuto falando, que abre sozinho (a frase dele corrigida + 2 com a mesma regra) e a cobrança na próxima
   conversa: a parceira puxa, sem avisar, uma situação que pede o ponto, e o app confere por regra se ele acertou.
   Os outros erros ficam recolhidos numa linha cada; microfone e estilo saem do resumo (ficam no balão de cada fala).
   Sem botão de cartão: o que se repete já entra sozinho na Aula de hoje da Gramática (sessions[].errors). */
const FOCO_PAST_DAYS = 30;   // erros das últimas conversas que contam para “você errou isso N vezes”
const FOCO_ACTIVE_DAYS = 14; // depois disso a parceira para de cobrar
const FOCO_DONE_HITS = 3;    // acertou 3 vezes (sem errar desde o último erro): ponto resolvido

const focoReal = e => e && e.certo && e.tipo !== "microfone" && convBare(e.certo) !== convBare(e.errado);
/* Chave de um erro: o tópico de gramática (por regra, gramErrTopics) ou, sem tópico, a forma certa. */
function focoKey(e) { const t = convErrTopic(e); return t ? "t:" + t : "f:" + convBare(e.certo); }
/* Escolhe o ponto entre os erros desta conversa: o que mais se repete (aqui e nas conversas dos últimos 30 dias);
   empate → o de gramática com tópico, depois o primeiro. Pura (testada). */
function focoPick(errors, sessions, now = Date.now(), keyOf = focoKey) {
  const cands = (errors || []).filter(focoReal);
  if (!cands.length) return null;
  const since = now - FOCO_PAST_DAYS * 864e5, past = {}, here = {};
  for (const s of sessions || []) if (s && s.at >= since) for (const e of s.errors || []) if (focoReal(e)) { const k = keyOf(e); past[k] = (past[k] || 0) + 1; }
  for (const e of cands) { const k = keyOf(e); here[k] = (here[k] || 0) + 1; }
  let best = null;
  cands.forEach((e, i) => {
    const k = keyOf(e), score = (past[k] || 0) * 2 + here[k] + (k.startsWith("t:") ? .5 : 0) + (e.tipo === "vocabulario" ? -.25 : 0) - i * .01;
    if (!best || score > best.score) best = {e, key: k, score, times: (past[k] || 0) + here[k]};
  });
  return {e: best.e, key: best.key, topic: best.key.startsWith("t:") ? best.key.slice(2) : "", times: best.times};
}
/* A frase inteira dele, errada e corrigida (o erro do Gemma às vezes é só um pedaço: “im Donnerstag”). */
function focoSentences(e, line) {
  const wrong = convClean(line || e.errado);
  if (!line) return {wrong, right: convClean(e.certo)};
  const i = wrong.toLowerCase().indexOf(String(e.errado).toLowerCase());
  return {wrong, right: i < 0 ? convClean(e.certo) : wrong.slice(0, i) + e.certo + wrong.slice(i + e.errado.length)};
}
/* Os 3 itens do treino: a frase dele corrigida + 2 frases com a mesma regra (da ficha do tópico; senão o exemplo do Gemma). */
function focoDrill(f) {
  const items = [{kind: "fix", cue: f.wrong, target: f.right}];
  const ficha = f.topic && typeof fichaOf === "function" ? fichaOf(f.topic) : null;
  const pool = ficha && Array.isArray(ficha.treino) ? ficha.treino.filter(([, de]) => convBare(de) !== convBare(f.right)) : [];
  // Ordem fixa por dia: dá variedade sem sortear a cada clique.
  const start = pool.length ? (Math.floor(Date.now() / 864e5) * 3) % pool.length : 0;
  for (let k = 0; k < Math.min(2, pool.length); k++) { const [pt, de] = pool[(start + k) % pool.length]; items.push({kind: "say", cue: pt, target: de}); }
  if (items.length < 3 && f.exemplo && convBare(f.exemplo) !== convBare(f.right)) items.push({kind: "say", cue: f.exemplo_pt || "(diga em alemão)", target: f.exemplo});
  return items;
}

// ---------- Guardado no progresso (sincroniza) ----------
function sanitizeFoco(f) {
  if (!f || typeof f !== "object" || !f.key) return null;
  const str = (v, n) => String(v == null ? "" : v).slice(0, n), num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  return {key: str(f.key, 120), topic: str(f.topic, 40), regra: str(f.regra, 200), errado: str(f.errado, 300), certo: str(f.certo, 300),
    wrong: str(f.wrong, 400), right: str(f.right, 400), porque: str(f.porque, 500), exemplo: str(f.exemplo, 300), exemplo_pt: str(f.exemplo_pt, 300),
    times: Math.max(1, Math.round(num(f.times))), at: num(f.at), updatedAt: num(f.updatedAt), trained: Math.max(0, Math.round(num(f.trained))),
    hits: Math.max(0, Math.round(num(f.hits))), misses: Math.max(0, Math.round(num(f.misses))), done: !!f.done,
    seen: (Array.isArray(f.seen) ? f.seen : []).filter(s => s && num(s.at) > 0).slice(-10).map(s => ({at: num(s.at), hit: Math.max(0, Math.round(num(s.hit))), miss: Math.max(0, Math.round(num(s.miss)))}))};
}
function focoData() { return convData().foco || null; }
function focoActive(now = Date.now()) {
  const f = focoData();
  return f && !f.done && now - f.at < FOCO_ACTIVE_DAYS * 864e5 ? f : null;
}

// ---------- Na conversa: a parceira cobra, o app confere ----------
/* Linha a mais nas instruções da parceira (Conversa normal e ao vivo). */
function focoPromptLines() {
  const f = focoActive();
  if (!f) return [];
  return [`Luiz is currently working on this point: "${f.regra || f.certo}" (correct example: "${f.right || f.certo}"). Once or twice in this conversation, at a natural moment, ask him something whose natural answer needs exactly this structure. Never tell him it is practice, never explain grammar, never correct him about it yourself.`];
}
/* Depois da correção de cada fala dele: acertou o ponto (usou a estrutura e não errou nela) ou errou nele. */
function focoObserve(turn) {
  const f = focoActive();
  if (!f || !turn || !turn.check || turn.check.state === "checking" || turn.focoSeen) return;
  turn.focoSeen = true;
  const obs = conv.foco || (conv.foco = {hit: 0, miss: 0});
  const miss = (turn.check.errors || []).some(e => focoReal(e) && focoKey(e) === f.key);
  if (miss) { obs.miss++; return; }
  const t = f.topic && typeof GRAMMAR_BY_ID !== "undefined" ? GRAMMAR_BY_ID.get(f.topic) : null;
  const card = {frase: turn.de, alvo: "", situacao: "", tags: "", traducao: ""};
  let uses = convBare(turn.de).includes(convBare(f.certo)) && convBare(f.certo).split(" ").length >= 1;
  if (!uses && t && typeof t.detect === "function") { try { uses = !!t.detect(card); } catch (e) { uses = false; } }
  if (uses) obs.hit++;
}
/* No fim da conversa: o resultado do ponto que estava sendo cobrado. */
function focoSettle() {
  const f = focoActive(), obs = conv.foco;
  conv.foco = null;
  if (!f) return null;
  const r = {regra: f.regra || f.certo, hit: obs ? obs.hit : 0, miss: obs ? obs.miss : 0};
  f.seen.push({at: Date.now(), hit: r.hit, miss: r.miss});
  f.seen = f.seen.slice(-10);
  if (r.miss) f.hits = 0; else f.hits += r.hit;
  f.misses += r.miss;
  if (f.hits >= FOCO_DONE_HITS) { f.done = true; r.done = true; }
  f.updatedAt = Date.now();
  return r;
}
/* Novo ponto a partir dos erros desta conversa (o anterior, se continuar errado, volta a ganhar por repetir). */
function focoSet(errors, sessions) {
  const p = focoPick(errors, sessions);
  if (!p) return null;
  const {wrong, right} = focoSentences(p.e, convLineWith(p.e.errado));
  const t = p.topic && GRAMMAR_BY_ID.get(p.topic);
  const now = Date.now(), old = focoData();
  const same = old && old.key === p.key && !old.done;
  const f = sanitizeFoco({key: p.key, topic: p.topic, regra: p.e.regra || (t ? t.title : ""), errado: p.e.errado, certo: p.e.certo, wrong, right,
    porque: p.e.explicacao, exemplo: p.e.exemplo, exemplo_pt: p.e.exemplo_pt, times: p.times, at: now, updatedAt: now,
    trained: same ? old.trained : 0, hits: 0, misses: same ? old.misses : 0, seen: same ? old.seen : []});
  convData().foco = f;
  return f;
}

// ---------- No resumo ----------
function focoResultNode(r) {
  if (!r) return null;
  const text = r.hit + r.miss === 0 ? "não apareceu nesta conversa."
    : r.miss === 0 ? "você acertou " + plural(r.hit, "vez", "vezes") + (r.done ? ". Ponto resolvido!" : ".")
    : "acertou " + r.hit + ", errou " + r.miss + ".";
  return h("p", {class: "foco-last" + (r.miss === 0 && r.hit ? " ok" : "")}, h("span", {class: "ce-k", text: "Ponto da última vez"}), h("b", {text: r.regra}), " · " + text);
}
function focoCardNode(f) {
  const [said, fix] = convDiffPair({errado: f.errado, certo: f.certo});
  const t = f.topic && GRAMMAR_BY_ID.get(f.topic);
  const why = String(f.porque || "").split(/(?<=[.!?])\s+/)[0];
  const area = h("div", {class: "foco-drill"});
  const card = h("section", {class: "foco-card"},
    h("p", {class: "ce-k", text: "O seu ponto de hoje"}),
    h("h4", {text: f.regra || (t ? t.title : "Correção")}),
    h("p", {class: "ce-de foco-pair", lang: "de"}, h("span", {class: "ce-said"}, ...said), " → ", h("span", {class: "ce-fix"}, ...fix), " ", convSpeakBtn(f.right || f.certo, "Ouvir a frase certa")),
    f.times >= 2 ? h("p", {class: "foco-times", text: "Você errou isso " + f.times + " vezes nas últimas conversas."}) : null,
    why ? h("p", {class: "ce-why", text: why}) : null,
    convFichaNode(f.topic, t),
    h("p", {class: "muted small-text", text: "Treino de 1 minuto: 3 frases em voz alta. Na próxima conversa, " + convName() + " vai puxar esse ponto."}),
    area);
  // O treino abre sozinho no fim da conversa (pedido do usuário, 11/11/2026).
  focoDrillRun(f, area);
  return card;
}
/* Os outros erros: uma linha cada, recolhidos. */
function focoOthersNode(errors, f) {
  const rest = errors.filter(e => focoReal(e) && !(f && e.errado === f.errado && e.certo === f.certo));
  if (!rest.length) return null;
  return h("details", {class: "foco-others"},
    h("summary", null, "Mais " + plural(rest.length, "coisa", "coisas"), icon("chevron", 14)),
    h("ul", null, ...rest.map(e => { const [said, fix] = convDiffPair(e); return h("li", {lang: "de"}, h("span", {class: "ce-said"}, ...said), " → ", h("span", {class: "ce-fix"}, ...fix)); })));
}

// ---------- Treinar agora ----------
function focoDrillRun(f, area) {
  const items = focoDrill(f);
  let k = 0, hits = 0;
  const show = () => {
    if (k >= items.length) {
      f.trained++; f.updatedAt = Date.now(); saveProgress();
      fill(area, h("p", {class: "foco-done", text: "Pronto: " + hits + " de " + items.length + " certas. Na próxima conversa, " + convName() + " vai puxar esse ponto, sem avisar."}));
      return;
    }
    const it = items[k], out = h("div", {class: "foco-out"}), input = h("input", {type: "text", lang: "de", placeholder: "Ou escreva aqui e aperte Enter", "aria-label": "Sua resposta em alemão", autocomplete: "off"});
    let answered = false, clip = null;
    const next = h("button", {class: "small", type: "button", hidden: true, onclick: () => { k++; show(); }}, k + 1 < items.length ? "Próxima" : "Terminar");
    const judge = said => {
      if (answered) return;
      const {line, pct} = diffLine(it.target, said || "");
      const ok = pct >= .85;
      if (ok) { answered = true; hits++; }
      fill(out, h("p", {class: ok ? "foco-ok" : "foco-miss", text: ok ? "Certo!" : said ? "Quase. Ouça e diga de novo:" : "A frase certa:"}), line,
        h("p", {class: "ce-de", lang: "de"}, it.target, " ", convSpeakBtn(it.target, "Ouvir")));
      if (!ok && !said) answered = true;
      next.hidden = false;
      if (ok) next.focus();
    };
    const mic = speechAvailable() ? h("button", {class: "small", type: "button"}, icon("mic", 16), "Falar") : null;
    if (mic) mic.addEventListener("click", async () => {
      if (clip) { mic.disabled = true; const blob = await clip.stop(); clip = null; mic.replaceChildren(icon("mic", 16), "Transcrevendo…");
        let said = ""; try { said = convDedupeHeard(await transcribeBlob(blob, false, {fast: true})); } catch (e) { said = ""; }
        mic.disabled = false; mic.replaceChildren(icon("mic", 16), "Falar de novo"); if (said) input.value = said; judge(said); return; }
      stopAudio();
      clip = await startClip(10000);
      if (clip) mic.replaceChildren(icon("stop", 16), "Parar");
    });
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (answered) next.click(); else judge(input.value.trim()); } });
    fill(area,
      h("p", {class: "ce-k", text: "Frase " + (k + 1) + " de " + items.length}),
      it.kind === "fix" ? h("p", null, "Você disse ", h("span", {class: "foco-cue", lang: "de", text: "„" + it.cue + "“"}), ". Diga do jeito certo.") : h("p", null, "Diga em alemão: ", h("b", {text: it.cue})),
      h("div", {class: "row"}, mic, h("button", {class: "quiet small", type: "button", onclick: () => judge("")}, "Ver a resposta")),
      input, out, next);
    (mic || input).focus();
  };
  show();
}
