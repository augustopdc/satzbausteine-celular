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
/* Temporadas (23/11/2026): cada pessoa vive uma história em 8 capítulos encadeados. O capítulo só avança quando a conversa
   teve 4 falas suas ou mais (pessoaAdvanceArc); acabada a temporada, voltam as novidades soltas (hooks). O recado de voz
   (voiceLineDe) aparece na Hoje e no topo da aba Pessoas (pessoaPendingNote). Textos escritos pelo Claude: revisar com o tutor. */
const PESSOA_ARCS = {
  tarek: [
    ["Tarek saiu do plantão e mandou um áudio", "Na? Ich komme gerade aus dem Nachtdienst. Wir haben einen neuen Assistenzarzt auf der Intensiv, und der weiß alles besser.",
      "A new young resident, Dr. Felix Kramer, started on your ICU. He is arrogant and does not listen to the nurses. Tell Luiz about him and ask what he would do with such a colleague."],
    ["Tarek conta o que aconteceu na noite passada", "Erinnerst du dich an den neuen Arzt? Heute Nacht hat er eine falsche Dosis aufgeschrieben, und ich habe es zum Glück gemerkt.",
      "Last night the new resident Felix wrote a wrong dose in an order (keep it vague: no drug names, no numbers); you noticed it in time and nothing happened. Now he is friendlier to you. Ask Luiz how mistakes are handled where he works."],
    ["Tarek recebeu uma proposta de emprego", "Stell dir vor: Ein Krankenhaus in Hamburg hat mir eine Stelle angeboten. Mehr Geld, weniger Nachtdienste.",
      "A hospital in Hamburg offered you a job: better pay, fewer night shifts. You are excited but unsure. Ask Luiz what is important for him in a job."],
    ["Tarek não consegue decidir", "Ich kann nicht schlafen. Hamburg oder Leipzig? Meine Mutter ist total dagegen.",
      "You cannot decide about Hamburg. Your mother is strongly against the move because she wants you near the family. Ask Luiz how his family feels about his move to Germany."],
    ["Tarek visitou o hospital em Hamburgo", "Ich war in Hamburg und habe mir die Station angeschaut. Schön, aber alles ist so groß und fremd.",
      "You visited the hospital in Hamburg: modern, but big and anonymous, and you missed your team. You got lost in the parking garage (a funny detail). Ask Luiz how he imagines his first day in a German hospital."],
    ["Tarek tem uma surpresa", "Unser neuer Arzt, Felix, hat mich gefragt, ob ich bleibe. Er sagt, ohne mich ist die Station verloren!",
      "The once arrogant resident Felix asked you to stay; he says the ward needs you. Your boss also offered you a role as Praxisanleiter (you would train new nurses). You are flattered. Ask Luiz what he thinks."],
    ["Tarek precisa de um conselho", "Ich habe eine Liste gemacht: Pro und Contra. Aber die Liste hilft mir nicht.",
      "You wrote a list of pros and cons, but it does not help. Ask Luiz to help you decide; listen to his arguments and react to each one."],
    ["Tarek decidiu", "Ich habe mich entschieden: Ich bleibe in Leipzig! Und wenn du nach Deutschland kommst, zeige ich dir die Stadt.",
      "Season finale: you decided to stay in Leipzig and to train new nurses. Thank Luiz for his advice and invite him to visit Leipzig when he arrives in Germany (the Cospudener See and the best Döner in town). Ask when he thinks he will come."]],
  gerda: [
    ["Gerda ouviu passos à noite", "Na, mein Lieber. Ich muss dir was erzählen: Über mir wohnt niemand, aber ich höre nachts Schritte.",
      "The flat above yours has been empty for months, but for three nights you have heard footsteps there around midnight. You are a bit scared and very curious. Ask Luiz what he would do."],
    ["Gerda falou com o zelador", "Ich habe den Hausmeister gefragt. Er sagt, die Wohnung ist leer. Aber gestern Nacht habe ich es wieder gehört.",
      "The caretaker says nobody lives there and nobody has a key. But last night you heard the steps again, and something like quiet music. Ask Luiz, half joking, if he believes in ghosts."],
    ["Gerda achou uma caixa no sótão", "Herr Brandt und ich waren auf dem Dachboden. Da steht eine alte Kiste mit dem Namen Lindemann.",
      "You and your neighbour Herr Brandt went up to the attic and found an old wooden box with the name Lindemann and old photos of a ship. Ask Luiz what he thinks is in the box."],
    ["Gerda abriu a caixa", "In der Kiste waren Briefe und eine alte Schiffsuhr. Die Briefe sind von 1962!",
      "In the box: love letters from 1962 and an old ship's clock. A sailor called Karl Lindemann lived in the flat above many years ago. You are moved. Ask Luiz about an old family story he knows."],
    ["Gerda bateu no teto", "Ich habe die Schritte wieder gehört. Diesmal habe ich geklopft, und es war plötzlich ganz still.",
      "You heard the steps again, knocked on the ceiling with a broom, and it was suddenly completely silent. Your cat Matrose stared at the ceiling all night. Ask Luiz if he is a brave person."],
    ["Gerda descobriu quem tem a chave", "Weißt du, wer einen Schlüssel hat? Der Enkel von Herrn Lindemann! Er heißt Jonas und ist Student.",
      "You found out that the grandson of Karl Lindemann, a student called Jonas, still has a key. The family wants to sell the flat. Ask Luiz what he thinks Jonas does there at night."],
    ["Gerda tem um plano para esta noite", "Herr Brandt und ich warten heute Nacht im Treppenhaus. Mit Tee und einer Taschenlampe!",
      "Tonight you and Herr Brandt will wait in the stairwell with tea and a torch to see who comes. You are excited like a child. Ask Luiz for a good plan."],
    ["Gerda resolveu o mistério", "Das Rätsel ist gelöst! Jonas übt nachts Saxophon, weil seine WG zu klein ist. Jetzt spielt er mit Herrn Brandt zusammen.",
      "Season finale: mystery solved. Jonas practises the saxophone at night in the empty flat because his shared flat is too small. Now he and Herr Brandt play music together on Sundays, and you gave Jonas his grandfather's letters. Laugh about it with Luiz and ask what music he likes."]],
  lotte: [
    ["Lotte está em pânico na padaria", "Hilfe! Ich habe eine riesige Bestellung für eine Hochzeit, und Udo geht heute nicht auf!",
      "You got a huge order: 300 bread rolls and a big bread for a wedding on Saturday. And today your sourdough Udo does not rise. You are panicking in a funny way. Ask Luiz for advice to stay calm."],
    ["Lotte leu uma crítica no jornal", "In der Zeitung steht eine Kritik über meine Bäckerei. Ohne Namen! Mein Brot ist angeblich zu sauer.",
      "An anonymous review in the local newspaper says your bread is too sour and too expensive. You are hurt and want to know who wrote it. Ask Luiz how he deals with criticism."],
    ["Lotte conta como foi o casamento", "Udo ist wieder fit! Die Hochzeit war super, alle wollten das Rezept.",
      "Udo recovered and the wedding was a success; everybody wanted the recipe. But you still think about the anonymous review. Ask Luiz about the best party he has been to."],
    ["Lotte desconfia de alguém", "Ich glaube, ich weiß, wer die Kritik geschrieben hat: der Bäcker gegenüber. Er hat mich so komisch angeschaut.",
      "You suspect the baker across the street, Herr Vogt, wrote the review: he looked at you strangely. You are not sure. Ask Luiz if you should talk to him or ignore it."],
    ["Lotte teve uma ideia maluca", "Ich hatte eine verrückte Idee: eine Nachtbäckerei am Samstag. Brot um Mitternacht, frisch aus dem Ofen!",
      "You have a crazy idea: a night bakery on Saturday evenings, fresh bread at midnight, with music. Ask Luiz if people in Brazil would come to something like that."],
    ["Lotte descobriu quem escreveu a crítica", "Ich habe mit Herrn Vogt gesprochen. Er hat die Kritik nicht geschrieben. Es war meine Mitbewohnerin!",
      "You talked to Herr Vogt: it was not him. Your flatmate Mia wrote the review as a bad joke, because you always say she eats your bread. You are angry and laughing at the same time. Ask Luiz what he would do."],
    ["Lotte está nervosa com sábado", "Am Samstag ist die erste Nachtbäckerei! Ich habe Angst, dass niemand kommt.",
      "The first night bakery is this Saturday. Mia helps you to make up for the review, Herr Vogt brings coffee. You are nervous that nobody will come. Ask Luiz how to invite people."],
    ["Lotte conta como foi a noite", "Es war unglaublich! Um Mitternacht stand eine Schlange bis zur Straßenbahn. Udo ist jetzt berühmt!",
      "Season finale: the night bakery was a big success, with a queue to the tram stop, and this time the newspaper wrote a good article. Udo is famous now. Celebrate with Luiz and ask if he will come to the night bakery when he lives in Germany."]],
  kalle: [
    ["Kalle está parado na estrada", "Kalle hier. Unser Tourbus ist auf der Autobahn kaputtgegangen, und heute Abend ist das Konzert!",
      "The tour van broke down on the motorway near Kassel; the concert is tonight in Hanover. You are waiting for the breakdown service and joking about it. Ask Luiz what he would do."],
    ["Kalle conta a briga na banda", "Wir haben es geschafft, aber jetzt streiten sich der Gitarrist und die Sängerin. Wie im Kindergarten!",
      "You made it to the concert, but now the guitarist Bodo and the singer Jenny are fighting about who is the star. You find it childish. Ask Luiz how he deals with big egos at work."],
    ["Kalle recebeu uma má notícia", "Jenny will die Band verlassen. Ohne Sängerin keine Tour. Super.",
      "The singer Jenny says she wants to leave the band after the tour. You are worried but pretend to be cool. Ask Luiz if he has ever had to calm down two people."],
    ["Kalle tem uma ideia", "Ich habe mit beiden geredet. Sie hören mir zu, weil ich der Älteste bin, haha.",
      "You talked to both, and they listen to you because you are the oldest. Your idea: a live recording at the last concert in Oberhausen, so the tour ends well. Ask Luiz what he thinks."],
    ["Kalle está correndo contra o tempo", "Die Plattenfirma findet die Idee gut. Aber wir haben nur zwei Wochen Zeit!",
      "The record label likes the live album idea, but you only have two weeks to prepare all the technology. You are stressed and drink far too much coffee. Ask Luiz how he handles stress before a big day."],
    ["Kalle enfrenta uma catástrofe", "Katastrophe: Ein Mischpult ist kaputt. Das Ersatzteil kommt erst in zehn Tagen.",
      "A mixing desk broke and the spare part takes ten days. You need a plan B. Ask Luiz for a creative idea and react to his ideas with humour."],
    ["Kalle grava amanhã", "Morgen ist die Aufnahme. Ich habe ein altes Pult von einem Freund. Daumen drücken!",
      "Tomorrow is the recording. You borrowed an old mixing desk from a friend and are not sure it works. Bodo and Jenny are friends again. Ask Luiz what he does on the evening before something important."],
    ["Kalle conta como foi a gravação", "Es hat geklappt! In der letzten Minute ging das Pult wieder, und das Publikum hat getobt!",
      "Season finale: the live recording worked. The old desk failed one minute before the start, you fixed it with tape, and the audience went crazy. Jenny stays in the band. Celebrate and promise Luiz a copy of the album; ask what concert he would like to see in Germany."]],
  wendt: [
    ["Dra. Wendt reclama da Krankenkasse", "Guten Tag, Herr Caspechaque. Die Krankenkasse hat eine neue Prüfung angekündigt. Schon wieder Formulare!",
      "The health insurance (Krankenkasse) announced a new audit of your practice's documentation. You are annoyed by the bureaucracy. Ask Luiz how documentation works in Brazil."],
    ["Dra. Wendt atendeu um caso curioso", "Heute hatte ich einen interessanten Fall. Ein Patient hatte Fieber nach einer Reise nach Brasilien.",
      "A patient came back from a trip to Brazil with fever and joint pain; you thought of dengue and sent him for tests (no results yet). Ask Luiz how often he sees dengue and what he looks for."],
    ["Dra. Wendt recebeu os exames", "Die Tests sind da: Es war Dengue. Ich habe an Sie gedacht, Herr Caspechaque!",
      "The tests confirmed dengue and the patient is better. You were proud you thought of it. Ask Luiz which other tropical diseases a German doctor should know."],
    ["Dra. Wendt passou pela fiscalização", "Die Prüfung der Krankenkasse war heute. Drei Stunden! Aber alles war in Ordnung.",
      "The insurance audit took three hours, but everything was fine. You are relieved and tired, and you start thinking about who will take over your practice in a few years. Ask Luiz what kind of work he wants in Germany."],
    ["Dra. Wendt conversou com a filha", "Ich habe mit meiner Tochter gesprochen. Sie will die Praxis nicht übernehmen. Sie ist Architektin.",
      "Your daughter, an architect, does not want to take over the practice. You are a little sad but you understand. Ask Luiz what his family thinks about him being a doctor."],
    ["Dra. Wendt recebeu uma candidata", "Eine junge Ärztin hat sich bei mir vorgestellt. Sehr nett, aber sie will nur Teilzeit arbeiten.",
      "A young doctor, Dr. Selin Aydin, applied. She is nice but wants to work part-time. You think about sharing the practice between two doctors. Ask Luiz what he thinks about part-time work for doctors."],
    ["Dra. Wendt tem um plano", "Ich habe eine Idee: eine Gemeinschaftspraxis. Zwei Ärzte, eine Praxis. Was halten Sie davon?",
      "Your plan: a group practice (Gemeinschaftspraxis) with Dr. Aydin. You know Luiz wants internal medicine in a hospital, so you only mention it with a smile. Ask about his plans for Germany."],
    ["Dra. Wendt decidiu o futuro do consultório", "Es ist entschieden: Frau Dr. Aydin steigt nächstes Jahr ein. Und für Sie habe ich einen Kontakt in einer Klinik in Bochum.",
      "Season finale: Dr. Aydin joins the practice next year, and you will slowly retire and play more cello. You have a contact in the internal medicine department of a hospital in Bochum and offer to introduce Luiz when he is in Germany. Ask how his German and his Approbation plans are going."]]};
/* Como cada pessoa comenta um livro no clube do livro (Leitura → Conversar sobre o capítulo). */
const PESSOA_BOOK_TAKE = {
  gerda: "empathetic: you feel with the characters and talk about how they must feel",
  tarek: "dry and practical: you judge the characters' decisions with common sense",
  lotte: "playful: you joke about the characters and compare them with people you know",
  kalle: "sceptical and direct: you like to disagree with a character (or with Luiz) and you give your reasons",
  wendt: "observant and precise: you notice small details and the motives behind what people do"};
for (const p of CONV_PESSOAS) p.arc = (PESSOA_ARCS[p.id] || []).map(([teaserPt, voiceLineDe, promptEn], i) => ({ep: i + 1, teaserPt, voiceLineDe, promptEn}));
const CONV_PESSOA_BY_ID = new Map(CONV_PESSOAS.map(p => [p.id, p]));
const CONV_TONES = {leve: "Leve", solto: "Sem filtros"};
function pessoaTopic(p, extra = null) {
  return {id: "p-" + p.id, group: "Pessoas", level: "A1", pt: "Conversa com " + p.name, de: "freies Gespräch", persona: p, voice: p.voice, sie: p.sie, ...(extra || {})};
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
/* As novidades soltas andam a cada conversa (como antes); o capítulo da temporada só com 4 falas suas ou mais. */
function pessoaAfterSession(p, mineCount = 0, now = Date.now()) {
  const m = convMemory(), n = m.hooks[p.id] ? m.hooks[p.id].n : 0;
  m.hooks[p.id] = {n: n + 1, updatedAt: now};
  if (!p.arc || !p.arc.length) return;
  m.arcs = m.arcs || {};
  const st = pessoaArcState(p.id, m), next = pessoaAdvanceArc(st, mineCount, p.arc.length, now);
  if (next.ep !== st.ep) m.arcs[p.id] = next;
}
// ---------- Temporadas ----------
function pessoaArcState(pid, mem = convMemory()) {
  const a = mem && mem.arcs && mem.arcs[pid];
  return {ep: 0, heardEp: -1, heardAt: 0, updatedAt: 0, ...(a || {})};
}
/* Puro: o capítulo avança um só com 4 falas reais ou mais; conversa curta não queima o capítulo; no fim da temporada, para. */
function pessoaAdvanceArc(state, mineCount, len = 8, now = Date.now()) {
  const st = {ep: 0, heardEp: -1, heardAt: 0, updatedAt: 0, ...(state || {})};
  if (!(mineCount >= 4) || st.ep >= len) return st;
  return {...st, ep: st.ep + 1, updatedAt: now};
}
/* O capítulo atual (ou null: temporada acabou e vale o hook). */
function pessoaEpisode(p, mem = convMemory()) {
  const st = pessoaArcState(p.id, mem);
  return p.arc && st.ep < p.arc.length ? p.arc[st.ep] : null;
}
const pessoaDay = t => { const d = new Date(t); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
/* Puro: o recado da vez. No máximo um destaque por dia: depois de ouvido, ele fica até ser respondido e nenhum outro aparece
   no mesmo dia. Entre os capítulos ainda não ouvidos, vence quem está há mais tempo sem conversar (empate: a ordem da lista). */
function pessoaPendingNote(now = Date.now(), mem = convMemory(), sessions = convData().sessions) {
  const today = pessoaDay(now), info = p => {
    const st = pessoaArcState(p.id, mem), ep = p.arc && st.ep < p.arc.length ? p.arc[st.ep] : null;
    return {p, st, ep};
  };
  const heardToday = CONV_PESSOAS.map(info).find(x => x.st.heardAt && pessoaDay(x.st.heardAt) === today);
  if (heardToday) return heardToday.ep && heardToday.st.heardEp === heardToday.st.ep ? {p: heardToday.p, ep: heardToday.ep, n: heardToday.st.ep, heard: true} : null;
  const last = pid => sessions.filter(s => s.topic === "p-" + pid).reduce((m, s) => Math.max(m, s.at), 0);
  const cands = CONV_PESSOAS.map((p, i) => ({...info(p), i})).filter(x => x.ep && x.st.heardEp !== x.st.ep)
    .map(x => ({...x, days: last(x.p.id) ? (now - last(x.p.id)) / 864e5 : 1e6}))
    .sort((a, b) => b.days - a.days || a.i - b.i);
  return cands.length ? {p: cands[0].p, ep: cands[0].ep, n: cands[0].st.ep, heard: false} : null;
}
function pessoaNoteHeard(pid, now = Date.now()) {
  const m = convMemory(), st = pessoaArcState(pid, m);
  m.arcs = m.arcs || {};
  m.arcs[pid] = {...st, heardEp: st.ep, heardAt: now, updatedAt: now};
  saveProgress();
}
/* Toca o recado na voz da pessoa (fora de uma conversa, usa um tema provisório só para escolher a voz). */
async function pessoaNoteSpeak(note) {
  pessoaNoteHeard(note.p.id);
  const tmp = conv.topic ? null : pessoaTopic(note.p);
  if (tmp) conv.topic = tmp;
  try { await convSpeak(note.ep.voiceLineDe); } catch (e) { /* sem voz: o texto continua no cartão */ }
  finally { if (tmp && conv.topic === tmp) conv.topic = null; }
}
function pessoaNoteReply(note) {
  pessoaNoteHeard(note.p.id);
  stopAudio();
  if (currentView !== "conversa") showView("conversa");
  openConversaTopic(pessoaTopic(note.p, {noteLine: note.ep.voiceLineDe}));
}
/* Puro (testado): o desenho do recado como mensagem de áudio, tirado da cadência do texto: cada sílaba (grupo de vogais)
   vira um pico, a sílaba tônica provável (1ª da palavra, palavra longa mais alta) sobe, pontuação vira vale. Sempre o mesmo
   desenho para o mesmo texto; count barras entre 0,22 e 1. */
function pessoaWaveBars(text, count = 28) {
  const seq = [];
  let hsh = 2166136261;
  for (const tok of String(text || "").match(/[\p{L}\p{N}]+|[.,!?;:…–-]/gu) || []) {
    for (const ch of tok) hsh = Math.imul(hsh ^ ch.charCodeAt(0), 16777619) >>> 0;
    if (/^[.,!?;:…–-]$/.test(tok)) { seq.push(/[.!?…]/.test(tok) ? .05 : .2); continue; }
    const syl = tok.toLowerCase().match(/[aeiouyäöü]+/g) || ["x"];
    syl.forEach((_, i) => seq.push((i === 0 ? .78 : .5) + Math.min(.22, tok.length * .02) + ((hsh >> (i % 24)) & 7) / 50));
  }
  if (!seq.length) seq.push(.5);
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = i * seq.length / count, b = Math.max(a + 1, (i + 1) * seq.length / count);
    let s = 0, n = 0;
    for (let j = Math.floor(a); j < Math.ceil(b) && j < seq.length; j++) { s += seq[j]; n++; }
    const jitter = (((hsh >>> (i % 29)) ^ (i * 2654435761 >>> 0)) & 15) / 100;
    out.push(Math.round(Math.max(.22, Math.min(1, (n ? s / n : .5) + jitter - .04)) * 1000) / 1000);
  }
  return out;
}
/* Duração estimada do recado (s): ~70 ms por letra, como a voz local fala. */
function pessoaNoteSecs(text) { return Math.max(2, Math.round(String(text || "").replace(/\s+/g, "").length * .07)); }
const pessoaPlay = {raf: 0, box: null};
/* Toca o recado no player compacto: barras faladas em --accent, a atual em destaque; --wave-pct de 0 a 100%. */
function pessoaWavePlay(note, box) {
  if (pessoaPlay.box === box) { stopAudio(); if (conv.speaker) conv.speaker.cancel(); return; }
  if (pessoaPlay.box) pessoaWaveStop(pessoaPlay.box);
  pessoaPlay.box = box;
  box.classList.add("playing");
  const btn = box.querySelector(".ps-wave-btn");
  if (btn) { fill(btn, icon("stop", 16)); btn.setAttribute("aria-label", "Parar o recado"); }
  const est = pessoaNoteSecs(note.ep.voiceLineDe) * 1000, t0 = performance.now();
  let started = 0;
  pessoaNoteSpeak(note);
  const bars = [...box.querySelectorAll(".ps-bar")];
  const frame = now => {
    pessoaPlay.raf = 0;
    if (pessoaPlay.box !== box || !box.isConnected) return;
    const ap = typeof audioPlayer !== "undefined" ? audioPlayer : null, sp = conv.speaker;
    const playing = (ap && !ap.paused && !ap.ended && ap.currentTime > 0) || (sp && !sp.finished && sp.playing) || (typeof speechSynthesis !== "undefined" && speechSynthesis.speaking);
    if (playing && !started) started = now;
    let pct;
    if (ap && isFinite(ap.duration) && ap.duration > 0 && (!sp || sp.items.length <= 1) && playing) pct = ap.currentTime / ap.duration;
    else pct = started ? (now - started) / est : 0;
    pct = Math.max(0, Math.min(1, pct));
    box.style.setProperty("--wave-pct", (pct * 100).toFixed(1) + "%");
    const cur = Math.min(bars.length - 1, Math.floor(pct * bars.length));
    bars.forEach((b, i) => { b.classList.toggle("on", i < cur || pct >= 1); b.classList.toggle("now", i === cur && started && pct < 1); });
    // Acabou (ou nem começou em 6 s: sem voz).
    if ((started && !playing && now - started > 300) || (!started && now - t0 > 6000)) { pessoaWaveStop(box, true); return; }
    pessoaPlay.raf = requestAnimationFrame(frame);
  };
  pessoaPlay.raf = requestAnimationFrame(frame);
  const de = box.closest(".ps-note");
  if (de && !de.querySelector(".ps-note-de")) de.querySelector(".ps-note-text").append(h("p", {class: "ps-note-de", lang: "de", text: "„" + note.ep.voiceLineDe + "“"}));
}
function pessoaWaveStop(box, done = false) {
  if (pessoaPlay.raf) cancelAnimationFrame(pessoaPlay.raf);
  pessoaPlay.raf = 0;
  if (pessoaPlay.box === box) pessoaPlay.box = null;
  box.classList.remove("playing");
  box.style.setProperty("--wave-pct", done ? "100%" : "0%");
  box.querySelectorAll(".ps-bar").forEach(b => { b.classList.toggle("on", done); b.classList.remove("now"); });
  const btn = box.querySelector(".ps-wave-btn");
  if (btn) { fill(btn, icon("play", 16)); btn.setAttribute("aria-label", "Ouvir o recado"); }
}
/* Tocar numa barra com o áudio tocando (duração conhecida) pula para aquele ponto. */
function pessoaWaveSeek(box, i, n) {
  const ap = typeof audioPlayer !== "undefined" ? audioPlayer : null;
  if (pessoaPlay.box !== box || !ap || !isFinite(ap.duration) || !(ap.duration > 0)) return;
  ap.currentTime = ap.duration * i / n;
}
function pessoaWaveNode(note) {
  const vals = pessoaWaveBars(note.ep.voiceLineDe), secs = pessoaNoteSecs(note.ep.voiceLineDe);
  const box = h("div", {class: "ps-wave-player"});
  const bars = h("div", {class: "ps-bars", "aria-hidden": "true"},
    ...vals.map((v, i) => { const b = h("span", {class: "ps-bar", onclick: () => pessoaWaveSeek(box, i, vals.length)}); b.style.setProperty("--h", String(v)); return b; }));
  box.append(h("button", {class: "ps-wave-btn", type: "button", "aria-label": "Ouvir o recado", onclick: () => pessoaWavePlay(note, box)}, icon("play", 16)),
    bars, h("span", {class: "ps-wave-time", text: "0:" + String(secs).padStart(2, "0")}));
  box.style.setProperty("--wave-pct", "0%");
  return box;
}
/* Cartão “Recado de …” (Hoje e aba Pessoas): o resumo, o recado como mensagem de áudio e Responder. */
function pessoaNoteNode(note) {
  if (!note) return null;
  const ok = !!(conv.status ? conv.status.installed : convAvailable());
  return h("section", {class: "panel ps-note", "aria-label": "Recado de " + note.p.name},
    h("span", {class: "ps-note-ico", "aria-hidden": "true"}, icon("speech", 20)),
    h("div", {class: "ps-note-text"},
      h("p", {class: "label", text: "Recado de " + note.p.name + " · Cap. " + note.ep.ep + " de " + note.p.arc.length}),
      h("p", {class: "ps-note-teaser", text: note.ep.teaserPt}),
      pessoaWaveNode(note),
      note.heard ? h("p", {class: "ps-note-de", lang: "de", text: "„" + note.ep.voiceLineDe + "“"}) : null),
    h("div", {class: "row ps-note-act"},
      h("button", {class: "primary small", type: "button", disabled: !ok, onclick: () => pessoaNoteReply(note)}, "Responder")));
}
/* Clube do livro: a pessoa leu o mesmo capítulo e tem opinião própria (sem perguntas de escola). */
function pessoaBookLines(p, book) {
  return ["Luiz is reading the German book \"" + book.title + "\" and has just read the chapter \"" + book.chapter + "\". You read the same chapter: the two of you are a small book club.",
    "Talk about it like a friend in a book club, not like a teacher. Have your own clear opinion about the chapter or about one character (agree or disagree with what a character did), in your own way: " + (PESSOA_BOOK_TAKE[p.id] || "with your own personality") + ". Then ask what he thinks, and react to his opinion (you may disagree).",
    "No school-style comprehension questions, no quiz, and do not retell the chapter. Do not tell what happens later in the book. Chapter text, for reference only (do not read it out or quote long parts):",
    book.text];
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
function pessoaPromptLines(p, now = Date.now(), opts = {}) {
  const facts = pessoaFacts(p.id), talks = pessoaTalks(p.id), solto = settings.convTone === "solto";
  const lines = [`You are ${p.full}, ${p.age}, from ${p.city}. You talk regularly with Luiz, a Brazilian family doctor who is learning German and wants to move to Germany.${talks ? " You have talked " + talks + " times before." : " This is your first conversation."}`,
    "About you (your own life; you can tell little stories from it):", ...p.bio.map(b => "- " + b),
    "Your way of speaking: " + p.style, p.unknown,
    "Lines that sound like you (style only, never repeat them word for word): " + p.samples.map(s => "\"" + s + "\"").join(" "),
    `Use "${p.sie ? "Sie" : "du"}".`,
    ...(opts.book ? [] : pessoaNewsLines(p))];
  if (facts.length) lines.push("What Luiz told you in earlier conversations (they may be outdated: ask instead of assuming; use at most one or two of them, only when it fits):",
    ...facts.map(f => `- (${pessoaAgo(f.at, now)}) ${f.de}`));
  lines.push("If you do not know something about Luiz or the people in his life (where they live, what they do), ask him; never invent facts about them, and remember what he said in this conversation.",
    "Be a person, not an interviewer: react with your own opinion or a tiny story, and ask at most ONE question per turn (sometimes none).");
  if (solto) lines.push(p.sie
    ? "Tone: you may use dry humour, but you always stay polite and never swear."
    : "Tone: cheeky and funny. Friendly teasing is welcome, and now and then a mild swear word (Mist, verdammt, Scheiße) when it really fits. Never insult Luiz, his family, his origin or his German.");
  return lines;
}
/* A novidade de hoje: o capítulo da temporada ou, acabada a temporada, um hook solto. */
function pessoaNewsLines(p) {
  const ep = pessoaEpisode(p);
  if (!ep) return ["Your small news today (tell it in simple words when it fits, not in the first sentence): " + pessoaHook(p)];
  return ["Your life has an ongoing story (episode " + ep.ep + " of " + p.arc.length + "). Today's news, the only new event: " + ep.promptEn,
    "You may already have sent Luiz this short voice message: \"" + ep.voiceLineDe + "\". Tell the news in simple words when it fits. Never jump ahead to later events of your story and never invent the ending."];
}
/* Primeira fala: cumprimenta como quem já conhece e puxa UMA coisa (lembrança ou novidade).
   Respondendo a um recado (noteLine), ela continua do recado; no clube do livro, começa pela opinião sobre o capítulo. */
function pessoaStart(p, noteLine = null, book = null) {
  if (book) return "(Begin the conversation as " + p.name + ": greet Luiz briefly and say, in one or two short sentences, your own opinion about the chapter \"" + book.chapter + "\". Then ask what he thinks. Do not ask his name.)";
  if (noteLine) return "(Luiz is calling you back after your voice message. In the message you said: \"" + noteLine + "\". Begin as " + p.name + ": greet him briefly and continue from that news, in one or two short sentences. Do not ask his name.)";
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
  return h("article", {class: "scene-card ps-card", "data-hero": pessoaTopic(p).id},
    h("div", {class: "scene-top"}, h("span", {class: "tag", text: p.city}), p.sie ? h("span", {class: "tag", text: "Sie"}) : null),
    h("h3", {text: p.name + ", " + p.age}),
    h("p", {class: "muted small-text", text: p.job}),
    h("p", {class: "ps-sample", lang: "de", text: "„" + p.samples[0] + "“"}),
    h("p", {class: "muted small-text", text: talks ? plural(talks, "conversa", "conversas") + (nf ? " · lembra " + plural(nf, "coisa", "coisas") + " sobre você" : "") : "Ainda não conversaram"}),
    h("div", {class: "row"}, h("button", {class: "small", type: "button", disabled: !ok, onclick: e => openConversaFromCard(pessoaTopic(p), e)}, "Conversar")));
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
    pessoaNoteNode(pessoaPendingNote()),
    h("div", {class: "ps-head"}, h("h2", {text: "Pessoas"}),
      h("label", {class: "ps-tone"}, h("span", {class: "muted small-text", text: "Tom"}), tone)),
    h("p", {class: "muted small-text", text: "Cada uma tem a própria vida e lembra só do que você contou para ela. Sem filtros: mais deboche e um palavrão de vez em quando (a Dra. Wendt continua educada)."}),
    h("div", {class: "scene-grid"}, ...CONV_PESSOAS.map(pessoaCard)),
    pessoasMemoryNode());
}
