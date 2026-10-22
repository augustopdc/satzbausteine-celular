"use strict";
/* FSP · paciente simulado: o Gemma faz o paciente de um caso guardado como lista de FATOS. Ele só conta o que o médico
   pergunta; no fim, a IA marca quais fatos o médico descobriu (escolhendo só entre os ids da lista, sem inventar) e o app
   mostra, por área da anamnese, o que faltou e uma pergunta-modelo. Os erros de alemão saem como na Conversa.
   Casos e falas escritos pelo Claude a partir das fichas do Modo Prova: revisar com o tutor.
   Carregado depois de conversa.js e antes de app.js; usa o estado e as funções da Conversa só quando chamado. */

const FSP_AREAS = [
  ["personalien", "Dados pessoais", ["Wie heißen Sie, und wie alt sind Sie?", "Wie groß sind Sie, und wie viel wiegen Sie?", "Was sind Sie von Beruf?"]],
  ["aktuell", "Queixa atual", ["Was führt Sie zu uns?", "Wo genau tut es weh?", "Seit wann haben Sie die Beschwerden?", "Wie würden Sie den Schmerz beschreiben: stechend, drückend oder brennend?",
    "Wie stark ist der Schmerz auf einer Skala von 0 bis 10?", "Strahlt der Schmerz irgendwohin aus?", "Haben Sie noch andere Beschwerden, zum Beispiel Übelkeit, Fieber oder Atemnot?", "Hatten Sie so etwas schon einmal?"]],
  ["vegetativ", "Anamnese vegetativa", ["Wie sind Appetit, Schlaf, Stuhlgang und Wasserlassen?", "Haben Sie in letzter Zeit ab- oder zugenommen?"]],
  ["vorerkrankungen", "Doenças prévias e cirurgias", ["Haben Sie Vorerkrankungen?", "Sind Sie schon einmal operiert worden?"]],
  ["medikamente", "Medicamentos", ["Nehmen Sie regelmäßig Medikamente? Welche und wie oft?", "Nehmen Sie alle Medikamente so, wie sie verschrieben wurden?"]],
  ["allergien", "Alergias", ["Haben Sie Allergien, zum Beispiel gegen Medikamente?"]],
  ["noxen", "Hábitos (fumo, álcool, drogas)", ["Rauchen Sie? Wie viel und seit wann?", "Trinken Sie Alkohol? Nehmen Sie Drogen?"]],
  ["familie", "História familiar", ["Gibt es in Ihrer Familie Krankheiten, zum Beispiel am Herzen?"]],
  ["sozial", "História social", ["Wie leben Sie? Allein oder mit Familie?"]],
  ["gyn", "Anamnese ginecológica", ["Wann war Ihre letzte Regelblutung?", "Könnten Sie schwanger sein?"]]];
/* Atitudes avaliadas no fim (além dos fatos). */
const FSP_ATTITUDES = [
  ["apresentou", "Cumprimentou, disse o próprio nome e a função"],
  ["resumiu", "Resumiu o que ouviu e confirmou com o paciente"],
  ["proximos", "Explicou os próximos passos em linguagem leiga"],
  ["respondeu", "Respondeu com calma à preocupação do paciente"]];

const FSP_CASOS = [
  {id: "becker", exam: "fsp-a-1", titulo: "Dor torácica", nome: "Klaus Becker", artigo: "der Patient", idade: 58, voz: "charon",
    queixa: "Ich habe so einen starken Druck in der Brust.", pergunta: "Ist das etwas Schlimmes, Herr Doktor?",
    fatos: [
      ["nome", "personalien", "Nome e idade", "Ich heiße Klaus Becker und bin 58 Jahre alt."],
      ["medidas", "personalien", "Altura e peso", "Ich bin 1,78 Meter groß und wiege ungefähr 96 Kilo."],
      ["profissao", "personalien", "Profissão", "Ich arbeite als Lagerist."],
      ["local", "aktuell", "Localização", "Der Schmerz ist hier, hinter dem Brustbein, in der Mitte der Brust."],
      ["carater", "aktuell", "Caráter da dor", "Es drückt, wie ein schweres Gewicht auf der Brust."],
      ["inicio", "aktuell", "Início e circunstância", "Es hat vor zwei Stunden ganz plötzlich angefangen, beim Fernsehen auf dem Sofa."],
      ["intensidade", "aktuell", "Intensidade", "Auf einer Skala von 0 bis 10 ist es eine 8."],
      ["irradiacao", "aktuell", "Irradiação", "Der Schmerz zieht in den linken Arm."],
      ["associados", "aktuell", "Sintomas associados", "Ich schwitze stark, und mir ist übel."],
      ["negados", "aktuell", "Sintomas negados", "Atemnot habe ich nicht, und ich habe mich nicht übergeben."],
      ["antes", "aktuell", "Evolução e episódios anteriores", "So etwas hatte ich noch nie. Seit es angefangen hat, ist es nicht besser geworden."],
      ["vegetativa", "vegetativ", "Apetite, sono, evacuação, diurese e peso", "Appetit, Schlaf, Stuhlgang und Wasserlassen sind normal. Mein Gewicht ist gleich geblieben."],
      ["doencas", "vorerkrankungen", "Doenças prévias", "Ich habe hohen Blutdruck und Zucker, also Diabetes."],
      ["cirurgias", "vorerkrankungen", "Cirurgias", "Operiert wurde ich noch nie."],
      ["remedios", "medikamente", "Medicamentos e doses", "Ich nehme morgens Ramipril 5 Milligramm und zweimal am Tag Metformin 1000."],
      ["alergia", "allergien", "Alergias", "Gegen Penicillin bin ich allergisch, da bekomme ich einen Hautausschlag."],
      ["fumo", "noxen", "Tabagismo", "Ich rauche seit 30 Jahren, eine Schachtel am Tag."],
      ["alcool", "noxen", "Álcool e drogas", "Am Wochenende trinke ich zwei Bier. Drogen nehme ich nicht."],
      ["familia", "familie", "História familiar", "Mein Vater ist mit 62 an einem Herzinfarkt gestorben. Meine Mutter lebt noch."],
      ["social", "sozial", "Situação social", "Ich bin verheiratet und habe zwei erwachsene Kinder. Ich wohne mit meiner Frau zusammen."]]},
  {id: "schulz", exam: "fsp-a-2", titulo: "Dor abdominal", nome: "Anna Schulz", artigo: "die Patientin", idade: 34, voz: "aoede",
    queixa: "Ich habe starke Bauchschmerzen.", pergunta: "Muss ich jetzt operiert werden?",
    fatos: [
      ["nome", "personalien", "Nome e idade", "Ich heiße Anna Schulz und bin 34 Jahre alt."],
      ["medidas", "personalien", "Altura e peso", "Ich bin 1,68 Meter groß und wiege 72 Kilo."],
      ["profissao", "personalien", "Profissão", "Ich bin Grundschullehrerin."],
      ["local", "aktuell", "Localização", "Es tut hier rechts oben im Bauch weh, unter den Rippen."],
      ["carater", "aktuell", "Caráter da dor", "Der Schmerz kommt in Wellen, wie Krämpfe."],
      ["inicio", "aktuell", "Início e circunstância", "Es hat gestern Abend angefangen, nach einem fettigen Essen."],
      ["intensidade", "aktuell", "Intensidade", "Ich würde sagen, eine 7 von 10."],
      ["irradiacao", "aktuell", "Irradiação", "Manchmal zieht es bis in die rechte Schulter."],
      ["associados", "aktuell", "Sintomas associados", "Mir ist übel, und ich habe zweimal erbrochen."],
      ["febre", "aktuell", "Febre", "Ich habe Fieber, heute Morgen waren es 38,4 Grad."],
      ["negados", "aktuell", "Sintomas negados", "Durchfall habe ich nicht, und beim Wasserlassen brennt es nicht."],
      ["antes", "aktuell", "Episódios anteriores", "So stark war es noch nie. Aber nach fettem Essen hatte ich schon öfter ein Druckgefühl im Bauch."],
      ["vegetativa", "vegetativ", "Apetite, sono, evacuação, diurese e peso", "Appetit habe ich gerade keinen. Schlaf und Stuhlgang waren bis gestern normal, mein Gewicht auch."],
      ["doencas", "vorerkrankungen", "Doenças prévias", "Ich bin sonst gesund."],
      ["cirurgias", "vorerkrankungen", "Cirurgias", "Ich hatte noch nie eine Operation."],
      ["remedios", "medikamente", "Medicamentos", "Ich nehme nur die Pille."],
      ["alergia", "allergien", "Alergias", "Allergien habe ich keine."],
      ["fumo", "noxen", "Tabagismo", "Ich rauche nicht."],
      ["alcool", "noxen", "Álcool e drogas", "Alkohol trinke ich nur ab und zu, mal ein Glas Wein. Drogen nehme ich nicht."],
      ["familia", "familie", "História familiar", "Meine Mutter hatte Gallensteine."],
      ["social", "sozial", "Situação social", "Ich lebe mit meinem Partner zusammen. Kinder haben wir keine."],
      ["regra", "gyn", "Última menstruação", "Meine letzte Regel war vor zwei Wochen."],
      ["gravidez", "gyn", "Possibilidade de gravidez", "Schwanger bin ich nicht, ich nehme ja die Pille."]]},
  {id: "wagner", exam: "fsp-a-3", titulo: "Falta de ar", nome: "Helga Wagner", artigo: "die Patientin", idade: 72, voz: "aoede",
    queixa: "Ich bekomme so schlecht Luft.", pergunta: "Muss ich jetzt im Krankenhaus bleiben?",
    fatos: [
      ["nome", "personalien", "Nome e idade", "Ich heiße Helga Wagner und bin 72 Jahre alt."],
      ["medidas", "personalien", "Altura e peso", "Ich bin 1,62 Meter groß und wiege jetzt 78 Kilo."],
      ["profissao", "personalien", "Profissão", "Ich bin Rentnerin, früher war ich Verkäuferin."],
      ["inicio", "aktuell", "Início", "Seit einer Woche bekomme ich immer schlechter Luft."],
      ["evolucao", "aktuell", "Evolução (esforço)", "Zuerst nur beim Treppensteigen, jetzt schon beim Anziehen."],
      ["noite", "aktuell", "Dispneia ao deitar", "Nachts schlafe ich mit drei Kissen, sonst bekomme ich keine Luft."],
      ["edema", "aktuell", "Edema", "Meine Beine sind dick geworden, vor allem abends."],
      ["peso", "aktuell", "Ganho de peso", "In einer Woche habe ich drei Kilo zugenommen."],
      ["negados", "aktuell", "Sintomas negados", "Schmerzen in der Brust habe ich nicht, und Fieber auch nicht."],
      ["vegetativa", "vegetativ", "Apetite, sono e diurese", "Ich habe weniger Appetit, und ich schlafe schlecht. Auf die Toilette muss ich jetzt seltener."],
      ["doencas", "vorerkrankungen", "Doenças prévias", "Vor fünf Jahren hatte ich einen Herzinfarkt."],
      ["cirurgias", "vorerkrankungen", "Procedimentos", "Damals habe ich einen Stent bekommen. Sonst wurde ich nie operiert."],
      ["remedios", "medikamente", "Medicamentos e doses", "Ich nehme ASS 100, Bisoprolol 5 und Torasemid 10."],
      ["adesao", "medikamente", "Parou um remédio por conta própria", "Die Wassertabletten, also Torasemid, nehme ich seit zehn Tagen nicht mehr, weil ich so oft auf die Toilette musste."],
      ["alergia", "allergien", "Alergias", "Allergien habe ich keine."],
      ["noxen", "noxen", "Fumo e álcool", "Ich habe nie geraucht, und Alkohol trinke ich fast nie."],
      ["familia", "familie", "História familiar", "Meine Mutter hatte auch ein schwaches Herz."],
      ["social", "sozial", "Situação social", "Ich bin verwitwet und wohne allein im zweiten Stock, ohne Aufzug."]]}];
const fspCase = id => FSP_CASOS.find(c => c.id === id) || null;

/* Tema da Conversa para um caso: você (médico) começa; Sie; voz do paciente. */
function fspTopic(caso) {
  return {id: "fsp-" + caso.id, group: "FSP", level: "B1", pt: "FSP · " + caso.titulo, role: caso.artigo + " " + caso.nome, rolePt: caso.nome,
    sie: true, luizStarts: true, voice: caso.voz, patient: caso};
}
function fspPatientPrompt(topic, level) {
  const c = topic.patient, female = c.artigo === "die Patientin";
  return [`You are ${c.nome}, ${c.idade} years old, ${female ? "a female" : "a male"} patient in a German hospital (emergency department). Luiz, a Brazilian doctor who is learning German (level ${level}), is taking your medical history (Anamnese). Stay in your role as the patient the whole time.`,
    "These are the ONLY facts about you. Never invent other symptoms, illnesses, medicines or numbers. If the doctor asks about something that is not in the list, say it is normal, you do not have it, or you do not know:",
    ...c.fatos.map(f => "- " + f[3]),
    "Rules:",
    `- Your first sentence (after the doctor greets you) is only your main complaint: "${c.queixa}"`,
    "- Answer ONLY what the doctor asks, in 1 or 2 short sentences. Never tell facts he has not asked about. If he asks a general question (\"Haben Sie noch andere Beschwerden?\"), tell only one more fact.",
    "- Speak like a normal patient, not like a doctor: everyday words (\"Zucker\", \"hoher Blutdruck\", \"Wassertabletten\"), no medical terms. If the doctor uses a medical term you would not know, ask what it means.",
    `- Use "Sie" with the doctor. You are a bit worried. When the doctor has asked several questions, ask once: "${c.pergunta}"`,
    "- Do not correct the doctor's German and do not explain grammar. If you do not understand him, say \"Wie bitte?\" or ask him to say it more simply.",
    "- Speak ONLY German. " + (CONV_LEVEL_RULES[level] || CONV_LEVEL_RULES.A1).replace(/at most \d( or \d)? (short )?sentences per turn/, "at most 2 short sentences per turn"),
    "- Luiz's messages are transcribed speech: ignore capitalization and punctuation.",
    "- No emojis, no English, no Portuguese, no lists, no markdown."].join("\n");
}

/* Fatos e atitudes são conferidos por regra, não pela IA: num teste com o Gemma real, a lista de “descobertos” saiu
   certa numa rodada e com 12 fatos a mais na seguinte. O paciente repete quase literalmente as frases da ficha, então
   basta comparar palavras com cada fala DELE (o que só o médico disse não conta). */
const FSP_STOP = new Set("ich habe bin und der die das den dem des ein eine einen einem einer nicht kein keine ist es mit am im in zu auf von vor mein meine meinen meiner sehr ganz so auch also da dann ja nein wie hier seit noch wurde nehme sind war hatte habe hat wir sie er mir mich sich aber oder weil wenn sonst schon nur mal etwas immer jetzt gerade bis".split(" "));
function fspWords(text) {
  return String(text || "").toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .split(/[^a-z0-9]+/).filter(w => w && !FSP_STOP.has(w) && (w.length >= 3 || /\d/.test(w))).map(w => w.length >= 5 ? w.slice(0, 5) : w);
}
/* O fato conta como descoberto se alguma fala do paciente tem pelo menos metade das palavras dele e, se ele tiver mais de
   uma, pelo menos duas (“Ich nehme nur die Pille” não revela “Schwanger bin ich nicht, ich nehme ja die Pille”). */
function fspFound(caso, turns) {
  const said = turns.filter(t => t.who !== "me").map(t => new Set(fspWords(t.de)));
  return new Set(caso.fatos.filter(f => {
    const words = [...new Set(fspWords(f[3]))];
    return words.length && said.some(s => { const n = words.filter(w => s.has(w)).length; return n >= Math.min(2, words.length) && n / words.length >= .5; });
  }).map(f => f[0]));
}
const FSP_ATT_RULES = {
  apresentou: /\b(ich bin|mein name ist|ich hei(ss|ß)e)\b.*\b(arzt|ärztin|doktor|dr|assistenzarzt|assistenzärztin)\b|\b(arzt|ärztin|doktor|assistenzarzt|assistenzärztin)\b.*\b(ich bin|mein name)\b/i,
  resumiu: /zusammen(fassen|gefasst)|fasse .*zusammen|richtig verstanden|wenn ich (das|sie) richtig verstehe/i,
  proximos: /\bwir (machen|werden|müssen|möchten|würden)\b|als nächstes|\b(ekg|blutabnahme|blut ab|röntgen|ultraschall|labor|untersuchung|untersuchen|magenspiegelung|ct)\b/i};
function fspAttitudes(caso, turns) {
  const doc = turns.filter(t => t.who === "me").map(t => t.de), done = new Set();
  for (const [id, re] of Object.entries(FSP_ATT_RULES)) if (doc.some(d => re.test(d))) done.add(id);
  // Respondeu: o médico falou depois da pergunta preocupada do paciente.
  const key = [...new Set(fspWords(caso.pergunta))];
  const asked = turns.findIndex(t => { if (t.who === "me") return false; const s = new Set(fspWords(t.de)); return key.filter(w => s.has(w)).length / key.length >= .5; });
  if (asked >= 0 && turns.slice(asked + 1).some(t => t.who === "me")) done.add("respondeu");
  return done;
}
function fspEvaluation(caso, turns) {
  const found = fspFound(caso, turns), done = fspAttitudes(caso, turns);
  const areas = FSP_AREAS.filter(([a]) => caso.fatos.some(f => f[1] === a)).map(([a, label, perguntas]) => {
    const fatos = caso.fatos.filter(f => f[1] === a);
    const missed = fatos.filter(f => !found.has(f[0]));
    return {area: a, label, total: fatos.length, found: fatos.length - missed.length, missed: missed.map(f => ({id: f[0], pt: f[2], de: f[3]})), perguntas};
  });
  return {found: found.size, total: caso.fatos.length, areas, attitudes: FSP_ATTITUDES.map(([id, label]) => ({id, label, done: done.has(id)}))};
}
/* A IA avalia só o alemão do médico (fatos e atitudes são por regra, acima). */
function fspEvalPrompt(caso, level) {
  return [`You are a German teacher for doctors. Luiz (German level ${level}) was the doctor and took the medical history of the patient ${caso.nome} (transcribed speech below; "Partner" is the patient).`,
    "Evaluate ONLY Luiz's lines. " + CONV_ERROR_RULES + " Standard doctor questions (\"Wo tut es weh?\", \"Haben Sie Vorerkrankungen?\", \"Nehmen Sie Medikamente?\", \"Was führt Sie zu uns?\") are natural: do not suggest style changes for them; give a style note only when a sentence sounds clearly unnatural. At most 5 errors and 3 style notes.",
    "Then: elogio (one short encouraging sentence in Brazilian Portuguese about his anamnesis) and frases (up to 3 useful correct German questions or sentences for a doctor, based on what he wanted to say). Answer as JSON."].join("\n");
}
async function fspFinish(mine) {
  const caso = conv.topic.patient;
  convSetBusy(true, "Avaliando a anamnese…");
  let j = null;
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: fspEvalPrompt(caso, convLevel())},
      {role: "user", content: convTranscript()}], {kind: "fsp", temperature: .1, maxTokens: 1200, schema: CONV_SUMMARY_SCHEMA});
    j = parseLooseJson(r.text);
  } catch (e) { setStatus("Não consegui avaliar: " + cleanIpcError(e, "erro"), "error"); }
  conv.finished = true;
  $("convRoom").classList.add("finished");
  convSetBusy(false, "");
  const fb = convFeedback(j), ev = fspEvaluation(caso, conv.turns);
  const words = mine.reduce((n, t) => n + t.de.split(/\s+/).filter(Boolean).length, 0), secs = Math.round((Date.now() - conv.startedAt) / 1000);
  const data = convData();
  data.sessions.push({at: Date.now(), topic: conv.topic.id, turns: mine.length, words, secs, errors: fb.errors, fsp: {found: ev.found, total: ev.total}});
  data.sessions = data.sessions.slice(-300);
  progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
  saveProgress();
  renderFspSummary(caso, ev, fb, {words, turns: mine.length, secs, ok: !!j});
}
function renderFspSummary(caso, ev, fb, {words, turns, secs, ok}) {
  const pct = Math.round(ev.found / Math.max(1, ev.total) * 100);
  const best = convData().sessions.filter(s => s.topic === "fsp-" + caso.id && s.fsp).reduce((m, s) => Math.max(m, s.fsp.found / Math.max(1, s.fsp.total)), 0);
  fill($("convSummary"),
    h("h3", {text: "Anamnese · " + caso.nome}),
    h("p", {class: "muted", text: turns + (turns === 1 ? " fala sua" : " falas suas") + " · " + words + " palavras · " + formatDuration(secs) + (secs > 1200 ? " (na prova são 20 min)" : "")}),
    !ok ? h("p", {class: "notice warn", text: "A avaliação não saiu no formato esperado. A conversa foi registrada mesmo assim."}) : null,
    h("div", {class: "fsp-score"}, h("strong", {text: ev.found + " de " + ev.total}), h("span", {text: " fatos descobertos (" + pct + "%)" + (best > 0 && Math.round(best * 100) > pct ? " · seu melhor: " + Math.round(best * 100) + "%" : "")})),
    fb.elogio ? h("p", {text: fb.elogio}) : null,
    h("h4", {text: "Áreas da anamnese"}),
    h("ul", {class: "fsp-areas"}, ...ev.areas.map(a => h("li", {class: a.found === a.total ? "ok" : a.found ? "part" : "miss"},
      h("p", null, h("b", {text: (a.found === a.total ? "✓ " : a.found ? "◐ " : "✗ ") + a.label}), h("span", {class: "muted", text: " · " + a.found + " de " + a.total})),
      a.missed.length ? h("details", null, h("summary", {text: "O que faltou e como perguntar"}),
        ...a.missed.map(m => h("p", {class: "small-text"}, h("b", {text: m.pt + ": "}), h("span", {lang: "de", class: "muted", text: "„" + m.de + "“"}))),
        h("p", {class: "small-text"}, h("b", {text: "Perguntas-modelo: "})),
        h("ul", {class: "fsp-qs"}, ...a.perguntas.map(q => h("li", null, h("span", {lang: "de", text: q}),
          h("button", {class: "icon-btn quiet", type: "button", title: "Ouvir", "aria-label": "Ouvir a pergunta", onclick: () => convSpeak(q)}, icon("volume", 16)),
          convCardButton({frase: q}, "conv-card-style"))))) : null))),
    h("h4", {text: "Atitudes"}),
    h("ul", {class: "fsp-att"}, ...ev.attitudes.map(a => h("li", {class: a.done ? "ok" : "miss", text: (a.done ? "✓ " : "✗ ") + a.label}))),
    h("h4", {text: fb.errors.length ? "Erros de alemão mais importantes" : "Nenhum erro de alemão importante encontrado"}),
    fb.errors.length ? h("ul", {class: "conv-errors"}, ...fb.errors.map(e => h("li", null,
      h("p", null, h("s", {lang: "de", text: e.errado}), " → ", h("b", {lang: "de", text: e.certo}),
        h("button", {class: "icon-btn quiet", type: "button", title: "Ouvir", "aria-label": "Ouvir a forma correta", onclick: () => convSpeak(e.certo)}, icon("volume", 16)),
        convCardButton({erro: {...e, frase: convLineWith(e.errado)}})),
      h("p", {class: "muted small-text", text: e.explicacao})))) : null,
    ...convStyleList(fb.style),
    h("p", {class: "muted small-text", text: "A avaliação é automática e o caso foi escrito pelo Claude: confira as dúvidas com o tutor. Na prova real, o paciente costuma falar mais rápido e com mais detalhes."}),
    h("div", {class: "row"},
      h("button", {class: "primary", type: "button", onclick: () => openConversaTopic(fspTopic(caso))}, "Atender de novo"),
      h("button", {type: "button", onclick: convReset}, "Outro caso")));
  $("convSummary").hidden = false;
  $("convSummary").scrollIntoView({behavior: "smooth", block: "start"});
}
/* Grupo de casos na tela da Conversa. */
function fspSetupNode() {
  const sessions = convData().sessions.filter(s => s.fsp);
  return h("section", {class: "scene-group"},
    ...titled("h2", "FSP: paciente simulado", "Você é o médico e faz a anamnese completa, como na prova: o paciente só conta o que você perguntar. No fim, você vê o que descobriu, o que faltou (com perguntas-modelo) e os erros de alemão. O paciente fala no seu nível."),
    h("div", {class: "scene-grid"}, ...FSP_CASOS.map(c => {
      const mine = sessions.filter(s => s.topic === "fsp-" + c.id), best = mine.reduce((m, s) => Math.max(m, s.fsp.found / Math.max(1, s.fsp.total)), 0);
      return h("article", {class: "scene-card"},
        h("div", {class: "scene-top"}, h("span", {class: "tag", text: "FSP"}), h("span", {class: "tag", text: "Sie"}), mine.length ? h("span", {class: "tag", text: "melhor " + Math.round(best * 100) + "%"}) : null),
        h("h3", {text: c.titulo}),
        h("p", {class: "muted small-text", text: c.nome + ", " + c.idade + " anos"}),
        h("div", {class: "row"}, h("button", {class: "primary small", type: "button", disabled: !(conv.status && conv.status.installed), onclick: () => openConversaTopic(fspTopic(c))}, "Atender")));
    })));
}
/* Modo Prova → “Fazer com a IA como paciente”. */
function fspFromExam(examId) {
  const caso = FSP_CASOS.find(c => c.exam === examId);
  if (!caso) return;
  showView("conversa");
  openConversaTopic(fspTopic(caso));
}
