"use strict";
/* Plantão na Innere (23/11/2026, pedido em _dev/.cache/PEDIDO-FUNCIONALIDADES.md, etapa 3): casos de clínica médica em
   etapas. O Gemma só faz o paciente (fala leiga, só os fatos da lista, nunca diz o diagnóstico nem resultado de exame).
   Tudo o que conta é por regra: fatos descobertos (fspFound), exames pedidos em alemão (innereMatchOrders), hipótese
   (innereGuess) e passagem de plantão para o Oberarzt (innereCheckUebergabe). Nada vai para o treino de cartões.
   Casos e falas escritos pelo Claude: revisar com o tutor.
   Carregado depois de missoes.js e antes de app.js; usa o estado e as funções da Conversa só quando chamado. */

/* Categorias de exame: id, rótulo em português, nome em alemão. */
const INNERE_EXAMES = [
  ["vital", "Sinais vitais", "Vitalparameter"],
  ["ku", "Exame físico", "Körperliche Untersuchung"],
  ["labor", "Laboratório", "Labor"],
  ["ekg", "ECG", "EKG"],
  ["bild", "Imagem ou endoscopia", "Bildgebung"]];

/* Cada caso: fatos no formato da FSP [id, área, rótulo pt, fala do paciente]; exames sem dizer o nome da doença;
   relevantes = o que de fato está indicado; uebergabeRules = regex sobre o texto sem trema (wasNorm). */
const INNERE_CASOS = [
  {id: "lungenembolie", level: "A2", tituloPt: "Falta de ar de repente", de: "eine Lungenembolie", pt: "embolia pulmonar",
    keys: ["lungenembol", "lungenarterienembol", "embolie"], nome: "Frau Lorenz", idade: 54, artigo: "die Patientin", voz: "kore",
    queixa: "Ich bekomme plötzlich so schlecht Luft.",
    fatos: [
      ["inicio", "aktuell", "Início súbito", "Es hat heute Morgen ganz plötzlich angefangen, beim Aufstehen."],
      ["dor", "aktuell", "Dor ao respirar", "Wenn ich tief einatme, sticht es rechts in der Brust."],
      ["viagem", "aktuell", "Viagem longa", "Ich bin gestern mit dem Bus aus Kroatien gekommen, sechzehn Stunden."],
      ["perna", "aktuell", "Panturrilha inchada", "Mein linkes Bein ist seit gestern dick, und die Wade tut weh."],
      ["negados", "aktuell", "Sem febre nem tosse", "Ich habe kein Fieber und keinen Husten."],
      ["hormonio", "medikamente", "Hormônios", "Ich nehme Hormone gegen die Beschwerden in den Wechseljahren."],
      ["fumo", "noxen", "Fuma", "Ich rauche ungefähr zehn Zigaretten am Tag."],
      ["antes", "vorerkrankungen", "Sem doenças", "Sonst bin ich gesund, ich war noch nie im Krankenhaus."]],
    exames: {
      vital: ["RR 105/70 mmHg", "HF 118/min", "Temp 37,2 °C", "SpO2 89 % (Raumluft)", "AF 26/min"],
      ku: ["Lunge: vesikuläres Atemgeräusch beidseits, keine Rasselgeräusche.", "Linke Wade geschwollen und druckschmerzhaft, Umfang 3 cm mehr als rechts."],
      labor: ["D-Dimere deutlich erhöht (4,2 mg/l)", "Troponin leicht erhöht", "CRP und Leukozyten normal"],
      ekg: ["Sinustachykardie 118/min, SIQIII-Typ, keine ST-Hebungen."],
      bild: ["Kompressionssonographie linkes Bein: Thrombus in der V. poplitea.", "Röntgen-Thorax: ohne Befund."]},
    relevantes: ["vital", "ku", "labor", "bild"],
    uebergabeRules: {
      quadro: /atemnot|luftnot|dyspnoe|kurzatmig|schlecht luft|brustschmerz|thoraxschmerz/,
      achado: /d-?dimer|thromb|wade|bein|tachykard|sattigung|spo2|\b89\b|siqiii|s1q3/,
      conduta: /\bct\b|angio|antikoag|heparin|sauerstoff|\bo2\b|monitor|intensiv|lyse|aufnahme|aufnehmen/}},
  {id: "herzinsuffizienz", level: "A2", tituloPt: "Cada vez mais falta de ar", de: "eine dekompensierte Herzinsuffizienz", pt: "insuficiência cardíaca descompensada",
    keys: ["herzinsuff", "herzschwach", "dekompens", "herzversag"], nome: "Herr Hahn", idade: 76, artigo: "der Patient", voz: "charon",
    queixa: "Ich bekomme seit zwei Wochen immer schlechter Luft.",
    fatos: [
      ["piora", "aktuell", "Piora aos poucos", "Erst nur beim Treppensteigen, jetzt schon beim Anziehen."],
      ["ortopneia", "aktuell", "Ortopneia", "Nachts brauche ich drei Kissen, sonst bekomme ich keine Luft."],
      ["edema", "aktuell", "Pernas inchadas", "Meine Füße und Knöchel sind ganz dick, die Schuhe passen nicht mehr."],
      ["peso", "vegetativ", "Ganhou peso", "Ich habe in zwei Wochen vier Kilo zugenommen."],
      ["noite", "vegetativ", "Urina à noite", "Nachts muss ich drei- oder viermal zur Toilette."],
      ["diuretico", "medikamente", "Parou o diurético", "Die Wassertabletten habe ich vor drei Wochen weggelassen, ich musste immer so oft auf die Toilette."],
      ["infarto", "vorerkrankungen", "Infarto antigo", "Vor sechs Jahren hatte ich einen Herzinfarkt."],
      ["social", "sozial", "Mora com a esposa", "Ich wohne mit meiner Frau, sie macht sich große Sorgen."]],
    exames: {
      vital: ["RR 150/90 mmHg", "HF 96/min, unregelmäßig", "Temp 36,8 °C", "SpO2 91 %", "AF 22/min"],
      ku: ["Lunge: feuchte Rasselgeräusche basal beidseits.", "Beinödeme beidseits bis zur Mitte des Unterschenkels, gestaute Halsvenen."],
      labor: ["NT-proBNP stark erhöht (6800 pg/ml)", "Kreatinin leicht erhöht (1,4 mg/dl)", "Natrium 133 mmol/l"],
      ekg: ["Vorhofflimmern, Frequenz um 95/min, alte Q-Zacken in II, III und aVF."],
      bild: ["Röntgen-Thorax: vergrößertes Herz, Stauungszeichen, kleine Pleuraergüsse beidseits."]},
    relevantes: ["vital", "ku", "labor", "bild"],
    uebergabeRules: {
      quadro: /atemnot|luftnot|dyspnoe|odem|beine|geschwollen|kissen/,
      achado: /rassel|odem|bnp|stauung|herz (ist )?vergrossert|erguss|halsvenen|zugenommen|kilo|vorhofflimmern/,
      conduta: /diuret|furosemid|wassertablette|entwasser|sauerstoff|aufnahme|aufnehmen|\becho|gewicht|bilanz/}},
  {id: "pyelonephritis", level: "A2", tituloPt: "Febre alta e dor nas costas", de: "eine Pyelonephritis", pt: "pielonefrite",
    keys: ["pyelonephr", "nierenbeckenentz", "nierenentzund", "urosepsis", "niereninfekt"], nome: "Frau Krüger", idade: 38, artigo: "die Patientin", voz: "aoede",
    queixa: "Ich habe hohes Fieber und Schmerzen im Rücken.",
    fatos: [
      ["febre", "aktuell", "Febre com calafrios", "Seit gestern Abend habe ich Fieber, fast 40 Grad, und Schüttelfrost."],
      ["dor", "aktuell", "Dor lombar à direita", "Es tut rechts hinten im Rücken weh, unter den Rippen."],
      ["disuria", "aktuell", "Ardência na semana passada", "Letzte Woche hat es beim Wasserlassen gebrannt, und ich musste ständig auf die Toilette."],
      ["nausea", "aktuell", "Enjoo", "Mir ist übel, ich habe einmal erbrochen."],
      ["gravidez", "gyn", "Não está grávida", "Ich bin nicht schwanger, meine Regel war vor zwei Wochen."],
      ["antes", "vorerkrankungen", "Cistites antes", "Ich hatte schon öfter Blasenentzündungen."],
      ["alergia", "allergien", "Alergia a penicilina", "Ich bin allergisch gegen Penicillin."]],
    exames: {
      vital: ["RR 110/70 mmHg", "HF 108/min", "Temp 39,4 °C", "SpO2 97 %", "AF 18/min"],
      ku: ["Klopfschmerz über dem rechten Nierenlager.", "Bauch weich, leichter Druckschmerz im rechten Unterbauch, keine Abwehrspannung."],
      labor: ["Leukozyten 16.800/µl, CRP 180 mg/l", "Kreatinin normal", "Urin-Stix: Leukozyten +++, Nitrit positiv"],
      ekg: ["Sinustachykardie, sonst unauffällig."],
      bild: ["Sonographie der Nieren: rechte Niere etwas vergrößert, kein Harnstau, keine Steine."]},
    relevantes: ["vital", "ku", "labor", "bild"],
    uebergabeRules: {
      quadro: /fieber|schuttelfrost|flanke|rucken|nierenlager/,
      achado: /klopfschmerz|nierenlager|leukozyt|\bcrp\b|nitrit|urin|stix/,
      conduta: /antibio|kultur|infusion|flussigkeit|aufnahme|aufnehmen|ceftriax|cipro|allerg|penicillin/}},
  {id: "pankreatitis", level: "B1", tituloPt: "Dor forte no alto da barriga", de: "eine akute Pankreatitis", pt: "pancreatite aguda",
    keys: ["pankreatit", "bauchspeicheldrusenentz", "bauchspeicheldruse"], nome: "Herr Schäfer", idade: 49, artigo: "der Patient", voz: "fenrir",
    queixa: "Ich habe furchtbare Schmerzen im Oberbauch.",
    fatos: [
      ["inicio", "aktuell", "Começou depois de uma festa", "Es hat gestern Nacht angefangen, nach einer Geburtstagsfeier."],
      ["irradia", "aktuell", "Dor em faixa até as costas", "Der Schmerz zieht wie ein Gürtel bis in den Rücken."],
      ["forte", "aktuell", "Muito forte", "Auf einer Skala von null bis zehn ist es eine Neun."],
      ["vomito", "aktuell", "Vômitos", "Ich muss immer wieder erbrechen, aber das hilft nicht."],
      ["posicao", "aktuell", "Melhora inclinado para frente", "Wenn ich mich nach vorne beuge, ist es ein bisschen besser."],
      ["alcool", "noxen", "Álcool", "Ich trinke jeden Abend drei, vier Bier, am Wochenende mehr."],
      ["calculo", "vorerkrankungen", "Pedras na vesícula", "Vor einem Jahr hat ein Arzt Steine in der Gallenblase gefunden."]],
    exames: {
      vital: ["RR 100/60 mmHg", "HF 112/min", "Temp 38,1 °C", "SpO2 95 %", "AF 22/min"],
      ku: ["Oberbauch stark druckschmerzhaft, gummiartige Bauchdecke, spärliche Darmgeräusche.", "Kein Ikterus, keine Abwehrspannung im Unterbauch."],
      labor: ["Lipase stark erhöht (1850 U/l)", "Leukozyten 14.200/µl, CRP 60 mg/l", "GGT und Bilirubin leicht erhöht, Triglyzeride normal"],
      ekg: ["Sinustachykardie, keine Zeichen einer Ischämie."],
      bild: ["Sonographie Abdomen: Bauchspeicheldrüse geschwollen und unscharf, Gallensteine, Gallengang nicht erweitert."]},
    relevantes: ["vital", "ku", "labor", "ekg", "bild"],
    uebergabeRules: {
      quadro: /oberbauch|epigastr|bauchschmerz|gurtel|rucken/,
      achado: /lipase|druckschmerz|gallenstein|galle|\bcrp\b|leukozyt|geschwollen/,
      conduta: /flussigkeit|infusion|volumen|schmerzmittel|analges|nuchtern|aufnahme|aufnehmen|ercp|monitor/}},
  {id: "hyperthyreose", level: "A2", tituloPt: "Coração disparado", de: "eine Schilddrüsenüberfunktion (Hyperthyreose)", pt: "hipertireoidismo",
    keys: ["hyperthyre", "schilddrusenuberfunk", "uberfunktion", "basedow", "thyreotox"], nome: "Frau Neumann", idade: 31, artigo: "die Patientin", voz: "leda",
    queixa: "Mein Herz rast ständig, auch in Ruhe.",
    fatos: [
      ["palpit", "aktuell", "Palpitações", "Seit ein paar Wochen klopft mein Herz schnell und unregelmäßig."],
      ["peso", "vegetativ", "Perda de peso", "Ich habe sechs Kilo abgenommen, obwohl ich viel esse."],
      ["tremor", "aktuell", "Tremor", "Meine Hände zittern, ich kann kaum noch schreiben."],
      ["calor", "aktuell", "Muito calor", "Mir ist immer zu warm, und ich schwitze viel."],
      ["sono", "vegetativ", "Sono ruim e nervosismo", "Ich schlafe schlecht und bin sehr nervös."],
      ["fezes", "vegetativ", "Intestino solto", "Ich muss öfter auf die Toilette, der Stuhl ist weich."],
      ["familia", "familie", "Mãe com tireoide", "Meine Mutter hat auch etwas mit der Schilddrüse."]],
    exames: {
      vital: ["RR 140/70 mmHg", "HF 132/min, unregelmäßig", "Temp 37,6 °C", "SpO2 98 %", "AF 18/min"],
      ku: ["Feinschlägiger Tremor der Hände, warme und feuchte Haut.", "Schilddrüse diffus vergrößert, nicht schmerzhaft; die Augen stehen leicht hervor."],
      labor: ["TSH stark erniedrigt (unter 0,01 mU/l)", "fT3 und fT4 deutlich erhöht", "TSH-Rezeptor-Antikörper (TRAK) positiv"],
      ekg: ["Tachykardes Vorhofflimmern, Frequenz um 130/min."],
      bild: ["Sonographie der Schilddrüse: vergrößert, echoarm, stark durchblutet."]},
    relevantes: ["vital", "ku", "labor", "ekg"],
    uebergabeRules: {
      quadro: /herzrasen|herzklopf|palpit|tachykard|abgenommen|zitter|tremor/,
      achado: /\btsh\b|\bft3|\bft4|vorhofflimmern|tremor|schilddruse (ist )?vergrossert|struma|trak/,
      conduta: /betablock|propranolol|metoprolol|thyreostat|thiamazol|carbimazol|antikoag|endokrin|aufnahme|aufnehmen|monitor/}},
  {id: "pneumonie", level: "A2", tituloPt: "Tosse e febre alta", de: "eine Lungenentzündung (Pneumonie)", pt: "pneumonia",
    keys: ["pneumon", "lungenentzund"], nome: "Herr Richter", idade: 67, artigo: "der Patient", voz: "puck",
    queixa: "Ich huste seit vier Tagen und habe hohes Fieber.",
    fatos: [
      ["tosse", "aktuell", "Tosse com catarro", "Beim Husten kommt gelber, dicker Schleim."],
      ["febre", "aktuell", "Febre alta", "Gestern Abend hatte ich 39 Grad und Schüttelfrost."],
      ["dor", "aktuell", "Dor ao respirar", "Links tut es in der Brust weh, wenn ich tief einatme oder huste."],
      ["dispneia", "aktuell", "Falta de ar", "Beim Gehen bekomme ich schlechter Luft als sonst."],
      ["diabetes", "vorerkrankungen", "Diabetes", "Ich habe Zucker, ich nehme Tabletten dafür."],
      ["fumo", "noxen", "Ex-fumante", "Ich habe zwanzig Jahre geraucht, aber seit fünf Jahren nicht mehr."],
      ["contato", "sozial", "Neto resfriado", "Mein Enkel war letzte Woche erkältet."]],
    exames: {
      vital: ["RR 125/75 mmHg", "HF 104/min", "Temp 39,0 °C", "SpO2 92 %", "AF 24/min"],
      ku: ["Lunge: feinblasige Rasselgeräusche und Bronchialatmen links basal.", "Klopfschall links basal gedämpft."],
      labor: ["Leukozyten 17.500/µl, CRP 210 mg/l", "Procalcitonin erhöht", "Blutzucker 230 mg/dl"],
      ekg: ["Sinustachykardie 104/min, sonst unauffällig."],
      bild: ["Röntgen-Thorax: Verschattung im linken Unterlappen."]},
    relevantes: ["vital", "ku", "labor", "bild"],
    uebergabeRules: {
      quadro: /husten|fieber|auswurf|schleim/,
      achado: /rassel|verschattung|\bcrp\b|leukozyt|sattigung|spo2|\b92\b|unterlappen|gedampft|dampfung/,
      conduta: /antibio|amoxi|ampicillin|sauerstoff|blutkultur|aufnahme|aufnehmen|curb|inhal/}},
  {id: "ketoazidose", level: "B1", tituloPt: "Sede o tempo todo", de: "eine diabetische Ketoazidose", pt: "cetoacidose diabética",
    keys: ["ketoazid", "ketoacid", "uberzucker", "diabetisches koma", "diabetische entgleis", "entgleister diabetes", "ketose"], nome: "Frau Wolf", idade: 22, artigo: "die Patientin", voz: "zephyr",
    queixa: "Ich habe die ganze Zeit Durst, und mir ist so übel.",
    fatos: [
      ["sede", "aktuell", "Sede intensa", "Ich trinke fünf, sechs Liter am Tag und habe trotzdem Durst."],
      ["urina", "vegetativ", "Urina muito", "Ich muss ständig auf die Toilette, auch nachts."],
      ["peso", "vegetativ", "Perda de peso", "In einem Monat habe ich acht Kilo abgenommen."],
      ["dor", "aktuell", "Dor na barriga e vômitos", "Mein Bauch tut überall weh, und ich habe zweimal erbrochen."],
      ["cansaco", "aktuell", "Cansaço extremo", "Ich bin so müde, ich kann kaum aufstehen."],
      ["respira", "aktuell", "Respira rápido e fundo", "Ich atme so schnell und tief, das ist komisch."],
      ["familia", "familie", "Irmão com diabetes", "Mein Bruder hat Diabetes, er spritzt Insulin."],
      ["remedios", "medikamente", "Sem remédios", "Ich nehme keine Medikamente, nur die Pille."]],
    exames: {
      vital: ["RR 100/60 mmHg", "HF 120/min", "Temp 36,9 °C", "SpO2 99 %", "AF 30/min, tiefe Atmung"],
      ku: ["Trockene Schleimhäute, stehende Hautfalten, Azetongeruch in der Atemluft.", "Bauch diffus druckschmerzhaft, aber weich."],
      labor: ["Blutzucker 520 mg/dl", "Blutgas: pH 7,12, Bikarbonat 9 mmol/l", "Ketone in Blut und Urin stark positiv, Kalium 5,6 mmol/l"],
      ekg: ["Sinustachykardie, hohe spitze T-Wellen."],
      bild: ["Sonographie Abdomen: unauffällig."]},
    relevantes: ["vital", "ku", "labor", "ekg"],
    uebergabeRules: {
      quadro: /durst|trinkt|wasserlassen|toilette|abgenommen|bauchschmerz|erbrech/,
      achado: /zucker|glukose|\bph\b|bikarbonat|keton|azeton|blutgas|kalium|\b520\b/,
      conduta: /insulin|flussigkeit|infusion|kochsalz|kalium|intensiv|aufnahme|aufnehmen|monitor/}},
  {id: "ulkus", level: "A2", tituloPt: "Queimação no estômago há semanas", de: "ein blutendes Magengeschwür (Ulkus)", pt: "úlcera péptica com sangramento",
    keys: ["ulkus", "ulcus", "magengeschwur", "geschwur", "magenblutung", "gi-blutung", "gastrointestinale blutung"], nome: "Herr Lehmann", idade: 63, artigo: "der Patient", voz: "charon",
    queixa: "Mein Magen brennt seit Wochen.",
    fatos: [
      ["queimacao", "aktuell", "Queimação no alto da barriga", "Das Brennen ist oben im Bauch, vor allem, wenn ich nichts gegessen habe."],
      ["ibuprofeno", "medikamente", "Ibuprofeno todo dia", "Für mein Knie nehme ich jeden Tag Ibuprofen, manchmal dreimal."],
      ["fezes", "vegetativ", "Fezes pretas", "Seit zwei Tagen ist mein Stuhl ganz schwarz, wie Teer."],
      ["tontura", "aktuell", "Tontura ao levantar", "Heute Morgen ist mir beim Aufstehen schwindelig geworden."],
      ["palidez", "aktuell", "Cansaço e palidez", "Ich bin schnell müde, und meine Frau sagt, ich bin ganz blass."],
      ["habitos", "noxen", "Fumo e vinho", "Ich rauche und trinke abends ein, zwei Gläser Wein."],
      ["joelho", "vorerkrankungen", "Artrose no joelho", "Ich habe Arthrose im rechten Knie."]],
    exames: {
      vital: ["RR 100/65 mmHg (im Stehen 85/55)", "HF 110/min", "Temp 36,7 °C", "SpO2 97 %", "AF 18/min"],
      ku: ["Blasse Haut und Schleimhäute, Oberbauch druckschmerzhaft.", "Rektale Untersuchung: schwarzer, teerartiger Stuhl am Fingerling."],
      labor: ["Hämoglobin 7,9 g/dl (vor einem Jahr 14 g/dl)", "Harnstoff erhöht, Kreatinin normal", "Gerinnung normal"],
      ekg: ["Sinustachykardie 110/min, sonst unauffällig."],
      bild: ["Gastroskopie: Ulkus im Bulbus duodeni mit sichtbarem Gefäßstumpf."]},
    relevantes: ["vital", "ku", "labor", "bild"],
    uebergabeRules: {
      quadro: /oberbauch|magen|brennen|schwarz|teer|schwindel/,
      achado: /hamoglobin|\bhb\b|anamie|teerstuhl|schwarz|tachykard|blutdruck|ibuprofen|\bnsar/,
      conduta: /gastroskop|endoskop|spiegelung|\bppi\b|pantoprazol|omeprazol|transfus|blutkonserv|zugang|infusion|absetzen|aufnahme|aufnehmen/}}];
const INNERE_BY_ID = new Map(INNERE_CASOS.map(c => [c.id, c]));

// ---------- Regras (puras, testadas em _dev/tests/plantao-clinico.test.cjs) ----------
const innereNorm = s => (typeof wasNorm === "function" ? wasNorm(s) : String(s || "").toLowerCase()).replace(/[„“”"]/g, " ");
const INNERE_ORDER_RE = {
  vital: /vital|blutdruck|\brr\b|\bpuls\b|herzfrequenz|\bhf\b|temperatur|fieber messen|sattigung|sauerstoffsattigung|spo2|atemfrequenz/,
  ku: /korperlich\w*\s+untersuch|\buntersuch(e|en|t)\b|abhor|abhorch|abtast|auskult|palpier|perkut|abklopf|\bku\b|rektal|\b(hore|horen)\b[^.?!]*\b(lunge|herz)\b|\b(lunge|herz)\b[^.?!]*\b(hore|horen)\b|\b(taste|tasten)\b[^.?!]*\bbauch|\bbauch\b[^.?!]*\b(taste|tasten)\b|\b(schaue|schauen|sehe|sehen)\b[^.?!]*\b(beine?|haut|augen|hals)\b/,
  labor: /\blabor|\bblut(bild|abnahme|werte?|untersuchung|gas|zucker|test)|blut abnehmen|blut nehmen|\bcrp\b|d-?dimer|leukozyt|elektrolyt|kreatinin|lipase|troponin|\btsh\b|\bft3|\bft4|hamoglobin|\bhb\b|\bbga\b|urin(stix|untersuchung|probe|test)|\bstix\b|keton|glukose|\bbnp\b|gerinnung|procalcitonin|harnstoff|kalium|natrium|\bpct\b/,
  ekg: /\bekg\b|elektrokardiogramm|herzstromkurve/,
  bild: /rontgen|\brx\b|thorax-?bild|ultraschall|sonograph|\bsono\b|\bct\b|computertomo|\bmrt\b|doppler|\becho(kardiograph\w*)?\b|bildgebung|gastroskop|magenspiegelung|endoskop|kompressionsson/};
/* Puro: quais categorias de exame o texto pede (em alemão, sem trema), na ordem de INNERE_EXAMES. */
function innereMatchOrders(text) {
  const t = innereNorm(text);
  return INNERE_EXAMES.map(([id]) => id).filter(id => INNERE_ORDER_RE[id].test(t));
}
/* Puro: a fala do chat é um pedido (e não uma pergunta ao paciente, como "Brennt es beim Urin?")? */
function innereOrderIntent(text) {
  return /\b(mochte|mochten|machen|mache|nehme|nehmen|abnehmen|bestimme|bestimmen|bestelle|brauche|brauchen|untersuche|untersuchen|messe|messen|schicke|schicken|veranlass\w*|anordnen|ordne)\b/.test(innereNorm(text));
}
/* Puro: a hipótese. ok = disse este caso; many = listou 3 ou mais diagnósticos (chute); named = o caso que reconheceu. */
function innereGuess(text, caso) {
  const t = innereNorm(text), hits = INNERE_CASOS.filter(c => c.keys.some(k => t.includes(k)));
  const many = hits.length >= 3;
  return {ok: !many && hits.includes(caso), many, named: hits.includes(caso) ? caso.id : hits.length ? hits[0].id : null};
}
/* Puro: a passagem para o Oberarzt tem quem é o paciente / o achado principal / a hipótese ou o próximo passo? */
function innereCheckUebergabe(text, caso) {
  const t = innereNorm(text), r = caso.uebergabeRules;
  const out = {quadro: r.quadro.test(t), achado: r.achado.test(t), conduta: r.conduta.test(t) || innereGuess(text, caso).ok};
  out.n = [out.quadro, out.achado, out.conduta].filter(Boolean).length;
  out.frases = String(text || "").split(/[.!?]+/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 3).length;
  return out;
}
/* Puro: os exames pedidos contra os indicados. */
function innereExamReview(caso, asked) {
  const set = new Set(asked), rel = caso.relevantes;
  return {got: rel.filter(x => set.has(x)), missing: rel.filter(x => !set.has(x)), extra: [...set].filter(x => !rel.includes(x))};
}
function innerePick(rand = Math.random, sessions = convData().sessions) {
  const done = new Set(sessions.filter(s => s.innere && s.innere.solved).map(s => s.innere.id));
  const last = [...sessions].reverse().find(s => s.innere);
  let pool = INNERE_CASOS.filter(c => !done.has(c.id) && (!last || c.id !== last.innere.id));
  if (!pool.length) pool = INNERE_CASOS.filter(c => !last || c.id !== last.innere.id);
  return pool[Math.floor(rand() * pool.length)] || INNERE_CASOS[0];
}
function innereTopic(caso) {
  return {id: "innere-" + caso.id, group: "Plantão", level: caso.level, pt: "Plantão na Innere · " + caso.tituloPt, role: caso.artigo + " " + caso.nome, rolePt: caso.nome,
    sie: true, voice: caso.voz, innere: caso};
}
function innerePrompt(topic, level) {
  const c = topic.innere, female = c.artigo === "die Patientin";
  return [`You are ${c.nome}, ${c.idade} years old, ${female ? "a female" : "a male"} patient who came at night to the emergency department of the internal medicine (Innere Medizin) of a German hospital. Luiz, a Brazilian doctor who is learning German (level ${level}), is the doctor on night duty.`,
    "You do NOT know what illness you have. These are the ONLY facts about you. Never invent other symptoms, illnesses, medicines or numbers. If he asks about something that is not in the list, say it is normal, you do not have it, or you do not know:",
    ...c.fatos.map(f => "- " + f[3]),
    "Rules:",
    `- Your first turn: greet the doctor and say only your main complaint ("${c.queixa}").`,
    "- Answer ONLY what he asks, in 1 or 2 short sentences. Never tell facts he has not asked about. If he asks a general question (\"Haben Sie noch andere Beschwerden?\"), tell only one more fact.",
    "- Speak like a normal patient with everyday words, never medical terms, and never name an illness yourself.",
    "- If he says he wants to examine you, take blood, do an ECG, an X-ray or an ultrasound, agree briefly (for example \"Ja, natürlich.\"). You NEVER know or say any results: the results come from the hospital, not from you.",
    "- If he tells you what you have, you cannot know if it is right: react briefly (for example \"Ist das gefährlich?\") and answer his next question.",
    "- Use \"Sie\" with the doctor. Do not correct his German and do not explain grammar. If you do not understand him, say \"Wie bitte?\".",
    "- Speak ONLY German. " + (CONV_LEVEL_RULES[level] || CONV_LEVEL_RULES.A1).replace(/at most \d( or \d)? (short )?sentences per turn/, "at most 2 short sentences per turn"),
    "- Luiz's messages are transcribed speech: ignore capitalization and punctuation.",
    "- No emojis, no English, no Portuguese, no lists, no markdown."].join("\n");
}
const INNERE_START = "(The doctor comes to you. Greet him and say only your main complaint, in one or two short sentences.)";

// ---------- Monitor de beira de leito (24/11/2026, visual de assinatura, etapa 2) ----------
/* Puro (testado): sinais vitais e ritmo tirados dos textos do caso (exames.vital e exames.ekg), com alertas por regra. */
function innereParseVitals(caso) {
  const ex = (caso && caso.exames) || {}, vit = (ex.vital || []).join(" | "), ekg = (ex.ekg || []).join(" ");
  const num = re => { const m = vit.match(re); return m ? m[1] : null; };
  const rr = num(/RR\s+(\d{2,3}\/\d{2,3})/), hf = Number(num(/HF\s+(\d{2,3})/)) || null;
  const temp = num(/Temp\s+(\d{2}(?:,\d)?)/), spo2 = Number(num(/SpO2\s+(\d{2,3})/)) || null, af = Number(num(/AF\s+(\d{1,2})/)) || null;
  const sys = rr ? Number(rr.split("/")[0]) : null, tempN = temp ? parseFloat(temp.replace(",", ".")) : null;
  const rhythm = /Vorhofflimmern/i.test(ekg) ? "afib" : hf && hf >= 100 ? "tachy" : "normal";
  const ekgHf = Number((ekg.match(/(\d{2,3})\/min/) || [])[1]) || null;
  return {rr, sys, hf, ekgHf, temp, spo2, af, rhythm,
    alerts: {spo2Low: spo2 != null && spo2 < 94, hfHigh: hf != null && hf >= 100, tempHigh: tempN != null && tempN >= 38, rrLow: sys != null && sys <= 100, afHigh: af != null && af > 20}};
}
/* Puro (testado): etiqueta de alteração de uma linha do laboratório, como num LIS (↑↑ muito alto, ↑ alto, ↓ baixo, + positivo). */
function innereLabFlag(line) {
  const t = String(line || "").toLowerCase();
  if (/(stark|deutlich)\s+erh(ö|oe)ht/.test(t)) return "↑↑";
  if (/erniedrigt/.test(t)) return "↓";
  if (/erh(ö|oe)ht/.test(t)) return "↑";
  if (/\+\+\+|positiv/.test(t)) return "+";
  return "";
}
/* Puro (testado): tira de ECG em SVG (600 × 64, 4 s). P-QRS-T limpo no ritmo sinusal; na fibrilação atrial, intervalos R-R
   irregulares, sem onda P e com tremor fibrilatório na linha de base. Devolve o caminho e a posição de cada batimento. */
const INNERE_ECG = {w: 600, h: 64, secs: 4, base: 38};
function innereEcgPath(rhythm = "normal", hf = 75) {
  const {w, h: H, secs, base} = INNERE_ECG, pps = w / secs, rate = Math.max(40, Math.min(180, Number(hf) || 75)), rr = 60 / rate;
  const beats = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let t = .22; t < secs + rr; ) {
    beats.push(t);
    t += rhythm === "afib" ? rr * (.62 + rnd() * .8) : rr;
  }
  const bump = (t, c, wd, amp) => { const u = (t - c) / wd; return Math.abs(u) < 1 ? amp * Math.cos(u * Math.PI / 2) ** 2 : 0; };
  const yAt = t => {
    let y = 0;
    for (const b of beats) {
      const d = t - b;
      if (d < -.3 || d > .45) continue;
      if (rhythm !== "afib") y += bump(t, b - .16, .05, -4);
      // QRS: Q pequeno, R alto e S, em ~70 ms.
      if (d > -.03 && d <= -.012) y += (d + .03) / .018 * 3;
      else if (d > -.012 && d <= .004) y += 3 - (d + .012) / .016 * 30;
      else if (d > .004 && d <= .022) y += -27 + (d - .004) / .018 * 35;
      else if (d > .022 && d <= .04) y += 8 - (d - .022) / .018 * 8;
      y += bump(t, b + .24, .09, -6.5);
    }
    if (rhythm === "afib") y += .9 * Math.sin(t * 2 * Math.PI * 6.3) + .6 * Math.sin(t * 2 * Math.PI * 9.1 + 1);
    return base + y;
  };
  const pts = [];
  for (let x = 0; x <= w; x += 1.5) pts.push(x.toFixed(1) + " " + yAt(x / pps).toFixed(1));
  return {d: "M" + pts.join(" L"), beats: beats.filter(b => b <= secs).map(b => Math.round(b * pps * 10) / 10), width: w, height: H, secs};
}
function innereMonitorNode(c, st) {
  const has = id => st.orders.has(id);
  if (!has("vital") && !has("ekg")) return h("div", {class: "in-monitor waiting", role: "note"}, h("span", {class: "in-mon-dot", "aria-hidden": "true"}),
    h("span", {text: "Monitor aguardando aferição — peça os sinais vitais ou o ECG em alemão."}));
  const v = innereParseVitals(c), A = v.alerts, showV = has("vital");
  const cell = (cls, label, unit, val, alert, arrow) => h("div", {class: "in-mon-cell " + cls + (showV && alert ? " alert" : "")},
    h("span", {class: "in-mon-l", text: label}), h("b", {class: "in-mon-v", text: showV && val != null ? String(val) : "—"}),
    h("span", {class: "in-mon-u"}, unit, showV && alert ? h("span", {class: "in-mon-flag", "aria-label": arrow === "↓" ? "baixo" : "alto", text: " " + arrow}) : null));
  const ekg = has("ekg") ? innereEcgPath(v.rhythm, v.ekgHf || v.hf || 75) : null;
  const svgNS = "http://www.w3.org/2000/svg", strip = h("div", {class: "in-ecg" + (ekg ? "" : " off"), role: "img",
    "aria-label": ekg ? "ECG: " + {afib: "fibrilação atrial, R-R irregular", tachy: "taquicardia sinusal", normal: "ritmo sinusal"}[v.rhythm] : "ECG ainda não pedido"});
  if (ekg && typeof document.createElementNS === "function") {
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + ekg.width + " " + ekg.height);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", ekg.d);
    path.setAttribute("class", "in-ecg-line");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    svg.append(path);
    strip.append(svg, h("span", {class: "in-ecg-sweep", "aria-hidden": "true"}));
    strip.style.setProperty("--sweep", ekg.secs + "s");
  } else strip.append(h("span", {class: "in-ecg-hint", text: "ECG: peça em alemão"}));
  return h("div", {class: "in-monitor", "data-rhythm": ekg ? v.rhythm : "none"},
    h("div", {class: "in-mon-top"}, h("span", {class: "in-mon-name", text: "Monitor · Notaufnahme"}),
      ekg ? h("span", {class: "in-mon-rhythm", lang: "de", text: {afib: "VHF", tachy: "Sinustachy", normal: "Sinusrhythmus"}[v.rhythm]}) : null),
    strip,
    h("div", {class: "in-mon-grid"},
      cell("hf", "HF", "/min", v.hf, A.hfHigh, "↑"),
      cell("spo2", "SpO2", "%", v.spo2, A.spo2Low, "↓"),
      cell("rr", "RR", "mmHg", v.rr, A.rrLow, "↓"),
      cell("temp", "Temp", "°C", v.temp, A.tempHigh, "↑"),
      cell("af", "AF", "/min", v.af, A.afHigh, "↑")));
}

// ---------- Prontuário (painel da sala, #convMission via missionRender) ----------
function innereState() {
  return mis.innere || (mis.innere = {orders: new Set(), manual: new Set(), tries: [], guess: null, reveal: false, ueb: null, uebText: ""});
}
function innereUnlock(ids, manual = false) {
  const st = innereState(), fresh = ids.filter(id => !st.orders.has(id));
  for (const id of ids) { st.orders.add(id); if (manual) st.manual.add(id); }
  // Só o exame que acabou de abrir ganha a entrada (deslize curto + filete); o resto fica parado.
  st.justOpened = new Set(fresh);
  if (fresh.length && typeof uiSound === "function") uiSound("stamp");
}
/* Depois de cada fala sua no chat: um pedido claro de exame já destrava o resultado. */
function innereAfterTurn(turn) {
  if (!mis.topic || !mis.topic.innere || !turn || turn.who !== "me" || !innereOrderIntent(turn.de)) return;
  innereUnlock(innereMatchOrders(turn.de));
}
function innereOrder(text) {
  const ids = innereMatchOrders(text);
  if (!convClean(text)) return;
  if (!ids.length) { toast("Não reconheci o exame. Diga em alemão, por exemplo: „Ich möchte ein EKG und ein Blutbild.“", "info"); return; }
  innereUnlock(ids);
  missionRender();
}
function innereTry(text) {
  const st = innereState(), c = mis.topic.innere;
  if (!convClean(text) || st.guess && st.guess.ok) return;
  const g = innereGuess(text, c);
  if (g.many) { toast("Escolha uma hipótese só: diga a mais provável em alemão.", "info"); return; }
  if (!g.named) { toast("Não reconheci um diagnóstico. Escreva em alemão (ex.: „Ich denke an eine Lungenentzündung.“).", "info"); return; }
  st.tries.push(text);
  st.guess = {ok: g.ok, text};
  if (g.ok) toast("Hipótese certa: " + c.pt + ".", "success");
  else if (st.tries.length >= 3) st.reveal = true;
  else toast("Não parece ser isso. Pergunte mais ou peça outro exame.", "info");
  missionRender();
}
function innereUeb(text) {
  const st = innereState();
  if (!convClean(text)) return;
  st.uebText = text;
  st.ueb = innereCheckUebergabe(text, mis.topic.innere);
  missionRender();
}
function innerePanel(box) {
  const c = mis.topic.innere, st = innereState(), found = fspFound(c, conv.turns).size;
  const order = h("input", {type: "text", lang: "de", placeholder: "Peça em alemão: Ich möchte ein EKG und ein Blutbild.", "aria-label": "Pedir exame em alemão"});
  const sendOrder = () => { innereOrder(order.value); order.value = ""; };
  order.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); sendOrder(); } });
  const just = st.justOpened || new Set();
  st.justOpened = null;
  const exam = ([id, label, de]) => {
    const open = st.orders.has(id);
    return h("article", {class: "in-exam" + (open ? " open" : "") + (open && just.has(id) && !reducedMotion() ? " just" : ""), "data-exam": id},
      h("p", {class: "in-exam-t"}, h("b", {text: label}), h("span", {class: "muted small-text", lang: "de", text: " · " + de})),
      open ? h("ul", {class: "in-exam-r", lang: "de"}, ...c.exames[id].map(x => { const f = id === "labor" ? innereLabFlag(x) : "";
        return h("li", {class: f ? "flagged" : null}, h("span", {text: x}), f ? h("span", {class: "in-flag", "aria-label": {"↑↑": "muito alto", "↑": "alto", "↓": "baixo", "+": "positivo"}[f], text: f}) : null); }))
        : h("div", {class: "row"}, h("span", {class: "muted small-text", text: "Peça em alemão para ver."}),
          h("button", {class: "quiet small", type: "button", title: "Use se você pediu de um jeito que o app não reconheceu", onclick: () => { innereUnlock([id], true); missionRender(); }}, "Destravar")));
  };
  const guess = h("input", {type: "text", lang: "de", placeholder: "Ich denke an …", "aria-label": "Hipótese diagnóstica em alemão"});
  guess.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); innereTry(guess.value); } });
  const ueb = h("textarea", {lang: "de", rows: "3", placeholder: "Ich habe eine Patientin, 54 Jahre … Sie hat … Ich denke an … und möchte …", "aria-label": "Passagem de plantão em alemão"});
  ueb.value = st.uebText || "";
  const solved = st.guess && st.guess.ok, mark = ok => h("span", {class: "in-mark" + (ok ? " ok" : "")}, ok ? icon("check", 13) : null);
  fill(box,
    innereMonitorNode(c, st),
    h("div", {class: "mis-head"},
      h("p", {class: "label", text: "Prontuário do plantão"}),
      h("p", {class: "mis-stat"}, h("b", {text: String(found)}), " de " + c.fatos.length + " dados da anamnese · " + st.orders.size + " de " + INNERE_EXAMES.length + " exames")),
    h("details", {class: "in-chart", open: true}, h("summary", {text: "Exames"}),
      h("div", {class: "row mis-guess"}, order, h("button", {class: "small", type: "button", onclick: sendOrder}, "Pedir")),
      h("div", {class: "in-exams"}, ...INNERE_EXAMES.map(exam))),
    h("details", {class: "in-chart", open: true}, h("summary", {text: "Fechar o caso"}),
      h("p", {class: "label", text: "1. Hipótese diagnóstica"}),
      solved || st.reveal ? h("p", {class: "mis-result" + (solved ? " ok" : "")}, solved ? "Certo: " : "Era ", h("b", {lang: "de", text: c.de}), " (" + c.pt + ").")
        : h("div", {class: "row mis-guess"}, guess, h("button", {class: "primary small", type: "button", onclick: () => innereTry(guess.value)}, "Conferir"),
          h("span", {class: "muted small-text", text: plural(3 - st.tries.length, "tentativa", "tentativas")}),
          h("button", {class: "quiet small", type: "button", onclick: () => { st.reveal = true; missionRender(); }}, "Desistir")),
      h("p", {class: "label", text: "2. Passagem de plantão para o Oberarzt"}),
      h("p", {class: "muted small-text", text: "Duas a quatro frases: quem é o paciente, o achado principal e a hipótese ou o próximo passo."}),
      ueb,
      h("div", {class: "row"}, h("button", {class: "small", type: "button", onclick: () => innereUeb(ueb.value)}, "Passar o caso")),
      st.ueb ? h("ul", {class: "in-ueb"},
        h("li", null, mark(st.ueb.quadro), "Quem é e o que tem"),
        h("li", null, mark(st.ueb.achado), "Achado principal"),
        h("li", null, mark(st.ueb.conduta), "Hipótese ou próximo passo")) : null));
}
function innereSessionExtra() {
  const st = innereState(), c = mis.topic.innere;
  return {innere: {id: c.id, solved: !!(st.guess && st.guess.ok), exams: st.orders.size, rel: innereExamReview(c, st.orders).got.length, ueb: st.ueb ? st.ueb.n : 0}};
}
function innereSummaryNode() {
  const st = innereState(), c = mis.topic.innere, rv = innereExamReview(c, st.orders), lab = id => (INNERE_EXAMES.find(e => e[0] === id) || [id, id])[1].toLowerCase();
  return h("div", {class: "mis-result" + (st.guess && st.guess.ok ? " ok" : "")},
    h("p", null, st.guess && st.guess.ok ? "Hipótese certa: " : "Diagnóstico: ", h("b", {lang: "de", text: c.de}), " (" + c.pt + ")."),
    h("p", {text: "Exames: pediu " + rv.got.length + " de " + c.relevantes.length + " indicados" + (rv.missing.length ? " (faltou: " + rv.missing.map(lab).join(", ") + ")" : "")
      + (rv.extra.length ? "; pediu também " + rv.extra.map(lab).join(", ") + ", que não mudava a conduta aqui." : ".")}),
    h("p", {text: st.ueb ? "Passagem de plantão: " + st.ueb.n + " de 3 partes." : "Passagem de plantão: não feita."}));
}
function innereSetupNode() {
  const sessions = convData().sessions, ok = !!(conv.status && conv.status.installed);
  const solved = new Set(sessions.filter(s => s.innere && s.innere.solved).map(s => s.innere.id));
  return h("section", {class: "scene-group"},
    ...titled("h2", "Plantão na Innere", "Você está de plantão na clínica médica: o paciente conta só o que você perguntar. Peça os exames em alemão (os resultados aparecem no prontuário), dê a hipótese e passe o caso para o Oberarzt. Tudo é conferido por regra."),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", disabled: !ok, onclick: () => openConversaTopic(innereTopic(innerePick()))}, "Atender o próximo"),
      h("span", {class: "muted small-text", text: solved.size + " de " + INNERE_CASOS.length + " casos resolvidos"})),
    h("div", {class: "scene-grid"}, ...INNERE_CASOS.map(c => h("article", {class: "scene-card", "data-hero": innereTopic(c).id},
      h("div", {class: "scene-top"}, h("span", {class: "tag", text: c.level}), solved.has(c.id) ? h("span", {class: "tag ok", text: "resolvido"}) : null),
      h("h3", {text: c.tituloPt}),
      h("p", {class: "muted small-text", text: c.nome + ", " + c.idade + " anos"}),
      h("div", {class: "row"}, h("button", {class: "small", type: "button", disabled: !ok, onclick: e => openConversaFromCard(innereTopic(c), e)}, "Atender"))))));
}
