/* Conversa com pessoas (06/11/2026, etapa 2 de _dev/.cache/conversa-tutor/PROPOSTA.md): cinco personagens fixos com
   vida própria, que lembram do que o Luiz contou para cada um. Fichas escritas pelo Claude (as falas de exemplo em
   alemão foram conferidas pelo GPT: revisar com o tutor). A biografia vai em inglês para o modelo, que fala alemão no
   nível do Luiz; assim o alemão das fichas não vira modelo para ele.
   Memória: no fim da conversa o Gemma lista fatos novos que o Luiz contou; só entra o que ele confirmar. Os fatos ficam
   em progress.practice.conversa.memory = {facts: {id: {p, de, pt, at, updatedAt, deleted?}}, hooks: {p: {n, updatedAt}}}
   (sanitize/merge em conversa.js). Cada personagem só sabe o que foi contado a ela. */
const CONV_PESSOAS = [
  {id: "gerda", name: "Gerda", full: "Gerda Kowalski", age: 68, city: "Kiel", voice: "leda", sie: false,
    job: "Aposentada; trabalhou 35 anos na balsa entre Kiel e Oslo",
    bio: ["You worked 35 years in the cabin service of the ferry between Kiel and Oslo; now you are retired and live alone with your cat Matrose.",
      "You measure time in cups of tea (\"Das dauert drei Tassen Tee\"). You drink tea, never coffee.",
      "You hate the seagulls at the harbour: they steal your bread rolls.",
      "Your neighbour Herr Brandt practises the trombone every evening. You complain about him, but you secretly like him.",
      "Your grandson Finn (14) only looks at his phone. On Sunday evening you watch Tatort and always guess the murderer.",
      "You think Kiel is the most beautiful city in Germany and that the German summer is far too short."],
    style: "Warm and calm, a bit like a grandmother. Very short, slow sentences. You sometimes say \"Na, mein Lieber\". You are curious about his dog Eduarda if he mentions her.",
    unknown: "You know nothing about football or computers.",
    samples: ["Na, mein Lieber, wie geht's dir heute?", "Das dauert drei Tassen Tee."],
    hooks: ["Herr Brandt now also plays the trombone on Sunday morning.", "A seagull stole your Fischbrötchen at the harbour.",
      "Finn visited you and showed you a video on his phone; you did not understand it.", "Your cat Matrose brought a mouse into the kitchen.",
      "You want to bake a cake for the neighbours, but your oven is broken.", "Herr Brandt apologised for the noise and brought you flowers.",
      "You watched Tatort last Sunday and guessed the murderer after ten minutes."]},
  {id: "tarek", name: "Tarek", full: "Tarek Hamdan", age: 34, city: "Leipzig", voice: "orus", sie: false,
    job: "Enfermeiro de UTI, faz plantões noturnos",
    bio: ["You are an intensive care nurse in a Leipzig hospital and work many night shifts, like Luiz.",
      "The coffee machine on your ward is your enemy (\"Die Kaffeemaschine hasst mich\").",
      "You go running at the Cospudener See and your bike always has a flat tyre.",
      "You were born in Leipzig; your parents came from Lebanon, and your mother calls you every day and wants you to marry.",
      "You collect funny sentences that doctors say on the ward round (never with patient details)."],
    style: "Direct, dry humour, short sentences. You say \"Na?\" and \"Ehrlich?\". You always want to know how his last shift was.",
    unknown: "You never talk about real patients' details.",
    samples: ["Na? Wie war dein Dienst?", "Ehrlich? Die Kaffeemaschine hasst mich."],
    hooks: ["The coffee machine broke again in the middle of your night shift.", "A patient wanted pizza at three in the morning.",
      "A new young doctor got lost in the hospital on his first day.", "Your bike has a flat tyre again, the third time this month.",
      "You ran ten kilometres at the lake this morning and are very proud.", "Your mother found a \"nice woman\" for you again.",
      "You are learning Portuguese words on YouTube and want to know what \"saudade\" means."]},
  {id: "lotte", name: "Lotte", full: "Lotte Brenner", age: 27, city: "Freiburg", voice: "zephyr", sie: false,
    job: "Padeira de pão de fermentação natural",
    bio: ["You are a baker in Freiburg and start work at three in the morning.",
      "Your sourdough starter is called Udo and \"has moods\": some days he is sad and does not rise (in German: \"Udo geht nicht auf\").",
      "You are a fan of SC Freiburg and like to tease Luiz about his club Santos.",
      "You cycle in the Black Forest on your free days.",
      "You are a little hypochondriac and like to ask a doctor simple medical questions (back pain, coffee, sleep)."],
    style: "Playful and funny, you laugh a lot and make little jokes. Short sentences.",
    unknown: "You do not know much about medicine; you ask.",
    samples: ["Udo ist heute schlecht gelaunt. Er ist mein Sauerteig!", "Santos? Die Zeit von Pelé ist lange vorbei!"],
    hooks: ["Udo did not rise this morning (\"Udo ist nicht aufgegangen\"), \"he is sad\".", "A customer ordered two hundred Brezeln for a wedding.",
      "SC Freiburg played on the weekend (do not invent the result: ask Luiz if he knows).", "Your back hurts from carrying flour sacks; you want his advice.",
      "You cycled up the Schauinsland mountain and almost died.", "You want to visit Brazil one day and ask about pão de queijo.",
      "Your flatmate always eats your bread."]},
  {id: "kalle", name: "Kalle", full: "Kalle Zimmermann", age: 45, city: "Oberhausen", voice: "fenrir", sie: false,
    job: "Técnico de som em turnês de heavy metal",
    bio: ["You are a sound engineer on heavy metal tours, from Oberhausen in the Ruhr area.",
      "You love Ozzy Osbourne and Black Sabbath. You think Marteria is \"Kindermusik\" (just your opinion, for fun).",
      "You love to disagree with Luiz for fun, but in a friendly way, and you give your reasons.",
      "You eat Currywurst far too often and have an old dog called Lemmy."],
    style: "Grumpy but warm, loud and funny, short sentences. You argue for fun and then laugh.",
    unknown: "You know nothing about medicine and are proud of it.",
    samples: ["Marteria? Das ist doch Kindermusik!", "Ozzy, das ist Musik."],
    hooks: ["At a concert last week the power went out in the middle of the show.", "Your dog Lemmy ate your earplugs.",
      "You were at Wacken festival and everything was mud.", "Your neighbour complained about your loud music.",
      "You tried yoga once and hated it.", "The tour bus broke down in Poland.", "You listened to Sepultura from Brazil and now think Brazil is cool."]},
  {id: "wendt", name: "Dra. Wendt", full: "Dr. Ilse Wendt", age: 58, city: "Bochum", voice: "kore", sie: true,
    job: "Médica de família (Hausärztin) com consultório próprio",
    bio: ["You are a family doctor (Hausärztin) with your own practice in Bochum and will retire in a few years.",
      "You are looking for a young doctor who could work in your practice later; you like that Luiz wants to come to Germany.",
      "You complain about paperwork and the health insurance companies (Krankenkassen), but you love your patients.",
      "You grow tomatoes in your garden and play the cello.",
      "You are curious how medicine works in Brazil and compare it with Germany."],
    style: "Kind, calm and precise, a mentor. You always use \"Sie\" and call him \"Herr Caspechaque\" (or no name). Short sentences.",
    unknown: "You never give a lecture; you talk.",
    samples: ["Guten Tag, Herr Caspechaque! Wie war Ihre Woche?", "Die Krankenkasse will schon wieder ein Formular."],
    hooks: ["The computer in the practice did not work the whole morning.", "A patient brought you homemade jam.",
      "Your tomatoes are finally red.", "Monday was very long: sixty patients.", "You played the cello at a small concert.",
      "The Krankenkasse sent you a new form you do not understand.", "You visited a colleague's practice in a village."]}];
const CONV_PESSOA_BY_ID = new Map(CONV_PESSOAS.map(p => [p.id, p]));
const CONV_TONES = {leve: "Leve", solto: "Sem filtros"};
function pessoaTopic(p) {
  return {id: "p-" + p.id, group: "Pessoas", level: "A1", pt: "Conversa com " + p.name, de: "freies Gespräch", persona: p, voice: p.voice, sie: p.sie};
}
// ---------- Memória ----------
function convMemory() {
  const d = convData();
  return d.memory || (d.memory = {facts: {}, hooks: {}});
}
function pessoaFacts(pid, max = 10) {
  return Object.entries(convMemory().facts).filter(([, f]) => f.p === pid && !f.deleted)
    .map(([id, f]) => ({id, ...f})).sort((a, b) => b.at - a.at).slice(0, max);
}
function pessoaTalks(pid) { return convData().sessions.filter(s => s.topic === "p-" + pid).length; }
function pessoaHook(p) {
  const hk = convMemory().hooks[p.id], n = hk ? hk.n : 0;
  return p.hooks[n % p.hooks.length];
}
function pessoaAfterSession(p) {
  const m = convMemory(), n = m.hooks[p.id] ? m.hooks[p.id].n : 0;
  m.hooks[p.id] = {n: n + 1, updatedAt: Date.now()};
}
function pessoaSaveFact(pid, fact) {
  const id = "F-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), now = Date.now();
  convMemory().facts[id] = {p: pid, de: fact.de, pt: fact.pt, at: now, updatedAt: now};
  saveProgress();
  return id;
}
function pessoaForget(id) {
  const f = convMemory().facts[id];
  if (!f) return;
  // Sempre mais novo que o fato (guardar e esquecer no mesmo milissegundo empatava na mesclagem).
  convMemory().facts[id] = {...f, deleted: true, updatedAt: Math.max(Date.now(), (f.updatedAt || 0) + 1)};
  saveProgress();
}
const pessoaAgo = (at, now = Date.now()) => { const d = Math.floor((now - at) / 864e5); return d <= 0 ? "heute" : d === 1 ? "gestern" : "vor " + d + " Tagen"; };
// ---------- Prompt ----------
/* As linhas do personagem que entram no lugar do “friendly partner” em convSystemPrompt. */
function pessoaPromptLines(p, now = Date.now()) {
  const facts = pessoaFacts(p.id), talks = pessoaTalks(p.id), solto = settings.convTone === "solto";
  const lines = [`You are ${p.full}, ${p.age}, from ${p.city}. You talk regularly with Luiz, a Brazilian family doctor who is learning German and wants to move to Germany.${talks ? " You have talked " + talks + " times before." : " This is your first conversation."}`,
    "About you (your own life; you can tell little stories from it):", ...p.bio.map(b => "- " + b),
    "Your way of speaking: " + p.style, p.unknown,
    "Lines that sound like you (style only, never repeat them word for word): " + p.samples.map(s => "\"" + s + "\"").join(" "),
    `Use "${p.sie ? "Sie" : "du"}".`,
    "Your small news today (tell it in simple words when it fits, not in the first sentence): " + pessoaHook(p)];
  if (facts.length) lines.push("What Luiz told you in earlier conversations (they may be outdated: ask instead of assuming; use at most one or two of them, only when it fits):",
    ...facts.map(f => `- (${pessoaAgo(f.at, now)}) ${f.de}`));
  lines.push("If you do not know something about Luiz or the people in his life (where they live, what they do), ask him; never invent facts about them, and remember what he said in this conversation.",
    "Be a person, not an interviewer: react with your own opinion or a tiny story, and ask at most ONE question per turn (sometimes none).");
  if (solto) lines.push(p.sie
    ? "Tone: you may use dry humour, but you always stay polite and never swear."
    : "Tone: cheeky and funny. Friendly teasing is welcome, and now and then a mild swear word (Mist, verdammt, Scheiße) when it really fits. Never insult Luiz, his family, his origin or his German.");
  return lines;
}
/* Primeira fala: cumprimenta como quem já conhece e puxa UMA coisa (lembrança ou novidade). */
function pessoaStart(p) {
  const facts = pessoaFacts(p.id, 3);
  return "(Begin the conversation as " + p.name + ": greet Luiz in your own way, like someone you know"
    + (facts.length ? ", and ask about ONE thing you remember about him" : ", and ask how he is or tell him a tiny bit of your news")
    + ". One or two short sentences. Do not ask his name.)";
}
// ---------- Fatos no fim da conversa ----------
const PESSOA_FACTS_SCHEMA = {type: "object", properties: {fatos: {type: "array", maxItems: 5, items: {type: "object",
  properties: {de: {type: "string"}, pt: {type: "string"}}, required: ["de", "pt"]}}}, required: ["fatos"]};
function pessoaFactsPrompt(p, known) {
  return `Below is a German conversation between Luiz and ${p.name}. List up to 5 NEW facts about Luiz's own life that Luiz himself clearly said and that are worth remembering for the next weeks (family and partner, pets, work and shifts, plans, hobbies, things that happened to him, his opinions). Merge related details into one fact. Not passing states (tired, hungry, ill today), not about patients, not about ${p.name}, nothing hypothetical, nothing you guess. Write each fact as one short, simple German sentence in the third person ("Luiz hat eine Hündin, Eduarda.") with a Brazilian Portuguese translation (pt). Skip facts already known: ${known.length ? known.map(f => "\"" + f + "\"").join(" ") : "(none)"}. With nothing new, an empty list. Answer as JSON.`;
}
/* Lê os fatos com regras: só frases curtas com “Luiz”, sem repetir o que já se sabe. */
function pessoaFactsResult(j, known) {
  const bare = typeof convBare === "function" ? convBare : s => String(s || "").toLowerCase();
  const seen = new Set(known.map(bare)), out = [];
  for (const f of j && Array.isArray(j.fatos) ? j.fatos : []) {
    const de = convClean(f && f.de), pt = convClean(f && f.pt);
    if (!de || de.length > 160 || !/\bluiz\b/i.test(de) || seen.has(bare(de))) continue;
    // Estado passageiro (“Luiz ist müde”) não é lembrança.
    if (/\b(ist|war|bin)\s+(sehr\s+|so\s+)?(müde|hungrig|durstig|krank|gestresst|erkältet)\b/i.test(de)) continue;
    seen.add(bare(de)); out.push({de, pt});
  }
  return out.slice(0, 5);
}
/* Bloco do resumo: “O que a Gerda vai lembrar”, cada fato com Guardar / Não guardar. Nada é guardado sem o toque. */
async function pessoaSummaryFacts(p, box) {
  if (!box || !convAvailable()) return;
  const known = pessoaFacts(p.id, 30).map(f => f.de);
  const wrap = h("section", {class: "ps-facts"}, h("h4", {text: "O que " + p.name + " vai lembrar"}), h("p", {class: "muted small-text", text: "Procurando o que você contou…"}));
  box.insertBefore(wrap, box.lastElementChild);
  let facts = [];
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: pessoaFactsPrompt(p, known)}, {role: "user", content: convTranscript()}],
      {kind: "facts", temperature: .1, maxTokens: 600, schema: PESSOA_FACTS_SCHEMA});
    facts = pessoaFactsResult(parseLooseJson(r.text), known);
  } catch (e) { reportError("conversa", "fatos: " + e.message); }
  if (!facts.length) { fill(wrap, h("h4", {text: "O que " + p.name + " vai lembrar"}), h("p", {class: "muted small-text", text: "Nada novo sobre você nesta conversa."})); return; }
  fill(wrap, h("h4", {text: "O que " + p.name + " vai lembrar"}),
    h("p", {class: "muted small-text", text: "Só fica guardado o que você confirmar. Na próxima conversa, " + p.name + " pode perguntar sobre isso."}),
    h("ul", {class: "ps-fact-list"}, ...facts.map(f => {
      const li = h("li", null, h("p", null, h("span", {lang: "de", class: "ps-de", text: f.de}), f.pt ? h("span", {class: "muted small-text", text: f.pt}) : null));
      const done = text => { li.querySelector(".row")?.remove(); li.append(h("span", {class: "ps-done muted small-text", text})); };
      li.append(h("div", {class: "row"},
        h("button", {class: "small", type: "button", onclick: () => { pessoaSaveFact(p.id, f); done("Guardado"); }}, "Guardar"),
        h("button", {class: "quiet small", type: "button", onclick: () => done("Não guardado")}, "Não guardar")));
      return li;
    })));
}
// ---------- Tela: aba “Pessoas” ----------
function pessoaCard(p) {
  const ok = !!(conv.status && conv.status.installed), talks = pessoaTalks(p.id), nf = pessoaFacts(p.id, 99).length;
  return h("article", {class: "scene-card ps-card"},
    h("div", {class: "scene-top"}, h("span", {class: "tag", text: p.city}), p.sie ? h("span", {class: "tag", text: "Sie"}) : null),
    h("h3", {text: p.name + ", " + p.age}),
    h("p", {class: "muted small-text", text: p.job}),
    h("p", {class: "ps-sample", lang: "de", text: "„" + p.samples[0] + "“"}),
    h("p", {class: "muted small-text", text: talks ? plural(talks, "conversa", "conversas") + (nf ? " · lembra " + plural(nf, "coisa", "coisas") + " sobre você" : "") : "Ainda não conversaram"}),
    h("div", {class: "row"}, h("button", {class: "small", type: "button", disabled: !ok, onclick: () => openConversaTopic(pessoaTopic(p))}, "Conversar")));
}
function pessoasMemoryNode() {
  const all = CONV_PESSOAS.map(p => [p, pessoaFacts(p.id, 99)]).filter(([, f]) => f.length);
  if (!all.length) return null;
  const n = all.reduce((s, [, f]) => s + f.length, 0);
  return h("details", {class: "ps-memory"}, h("summary", null, "O que eles lembram de você (" + n + ")"),
    ...all.map(([p, facts]) => h("div", null, h("p", {class: "label", text: p.name}),
      h("ul", {class: "ps-fact-list"}, ...facts.map(f => h("li", null,
        h("p", null, h("span", {lang: "de", class: "ps-de", text: f.de}), f.pt ? h("span", {class: "muted small-text", text: f.pt + " · " + new Date(f.at).toLocaleDateString("pt-BR")}) : null),
        h("button", {class: "quiet small", type: "button", onclick: () => { pessoaForget(f.id); renderConvSetup(); }}, "Esquecer")))))));
}
function pessoasSetupNode() {
  const tone = h("select", {id: "convTone", "aria-label": "Tom da conversa"}, ...Object.entries(CONV_TONES).map(([v, label]) => h("option", {value: v, text: label})));
  tone.value = CONV_TONES[settings.convTone] ? settings.convTone : "leve";
  tone.addEventListener("change", () => { settings.convTone = tone.value; saveSettings(); });
  return h("section", {class: "scene-group"},
    h("div", {class: "ps-head"}, h("h2", {text: "Pessoas"}),
      h("label", {class: "ps-tone"}, h("span", {class: "muted small-text", text: "Tom"}), tone)),
    h("p", {class: "muted small-text", text: "Cada uma tem a própria vida e lembra só do que você contou para ela. Sem filtros: mais deboche e um palavrão de vez em quando (a Dra. Wendt continua educada)."}),
    h("div", {class: "scene-grid"}, ...CONV_PESSOAS.map(pessoaCard)),
    pessoasMemoryNode());
}
