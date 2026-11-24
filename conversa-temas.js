/* Temas e situações da Conversa (11/11/2026, pedido do usuário: “pouquíssimos temas e situações, dá para expandir bem mais”).
   Escritos pelo Claude: revisar com o tutor. Cada um tem a categoria (cat) e a frase de abertura (abre) que aparece no cartão,
   na letra de livro — é só uma amostra do tom; a abertura de verdade é gerada na hora. Carregado logo depois de conversa.js
   (CONV_TOPICS é de lá). Situações com papel feminino levam voice (Kore no Google e no Live; Kerstin na voz local). */
const CONV_CATS = {
  "Temas": [["voce", "Sobre você", "user"], ["dia", "Dia a dia", "today"], ["lazer", "Lazer e gostos", "ball"],
    ["trabalho", "Trabalho e estudo", "briefcase"], ["mundo", "Brasil e Alemanha", "globe"], ["opiniao", "Dar opinião", "scale"]],
  "Situações": [["comprar", "Compras e comida", "cart"], ["cidade", "Cidade e transporte", "train"], ["casa", "Casa e vizinhos", "home"],
    ["servicos", "Serviços e imprevistos", "key"], ["saude", "Saúde, como paciente", "heart"], ["hospital", "No hospital, com colegas", "hospital"],
    ["social", "Gente e convites", "users"]]};

// Os 19 que já existiam: categoria e frase de abertura.
const CONV_TOPIC_META = {
  vorstellen: ["voce", "Erzähl mal ein bisschen von dir!"],
  familie: ["voce", "Hast du Geschwister?"],
  deutsch: ["voce", "Warum lernst du eigentlich Deutsch?"],
  tag: ["dia", "Wie sieht dein Tag normalerweise aus?"],
  essen: ["dia", "Was isst du am liebsten?"],
  wohnen: ["dia", "Wohnst du in einer Wohnung oder in einem Haus?"],
  wochenende: ["dia", "Und, was hast du am Wochenende gemacht?"],
  wetter: ["dia", "Wie ist das Wetter heute bei dir?"],
  freizeit: ["lazer", "Was machst du gern in deiner Freizeit?"],
  urlaub: ["lazer", "Wo warst du zuletzt im Urlaub?"],
  arbeit: ["trabalho", "Wie war dein letzter Dienst?"],
  stadt: ["mundo", "Was ist in Brasilien ganz anders als in Deutschland?"],
  frei: ["livre", "Worüber möchtest du heute sprechen?"],
  baeckerei: ["comprar", "Guten Morgen! Was darf es sein?", "kore"],
  restaurant: ["comprar", "Guten Abend! Haben Sie reserviert?"],
  weg: ["cidade", "Ja, bitte? Kann ich Ihnen helfen?", "kore"],
  termin: ["saude", "Praxis Dr. Berger, guten Tag!", "kore"],
  wohnung: ["casa", "Kommen Sie rein! Hier ist gleich die Küche."],
  buergeramt: ["servicos", "Guten Tag. Was kann ich für Sie tun?"]};

const CONV_TOPICS_NEW = [
  // ---- Temas: sobre você ----
  {id: "kindheit", cat: "voce", level: "A2", pt: "Minha infância", de: "die Kindheit: wo und wie Luiz aufgewachsen ist", abre: "Wo bist du aufgewachsen?"},
  {id: "freunde", cat: "voce", level: "A1", pt: "Amigos", de: "Freunde und Freundschaft", abre: "Triffst du oft deine Freunde?"},
  {id: "haustier", cat: "voce", level: "A1", pt: "Bichos de estimação", de: "Haustiere (Luiz hat einen Hund)", abre: "Hast du ein Haustier?"},
  {id: "plaene", cat: "voce", level: "A2", pt: "Planos para o futuro", de: "Pläne und Träume für die Zukunft", abre: "Was möchtest du in fünf Jahren machen?"},
  {id: "sprachen", cat: "voce", level: "A2", pt: "Línguas que eu falo", de: "Sprachen: welche Sprachen Luiz spricht und wie er sie lernt", abre: "Welche Sprachen sprichst du?"},
  {id: "charakter", cat: "voce", level: "B1", pt: "Como eu sou", de: "Charakter und Persönlichkeit", abre: "Wie würden deine Freunde dich beschreiben?"},
  // ---- Temas: dia a dia ----
  {id: "kochen", cat: "dia", level: "A1", pt: "Cozinhar", de: "Kochen: was Luiz kocht, einfache Rezepte", abre: "Kochst du gern?"},
  {id: "einkaufen", cat: "dia", level: "A1", pt: "Fazer compras", de: "Einkaufen: Supermarkt, Markt, online", abre: "Wo kaufst du normalerweise ein?"},
  {id: "haushalt", cat: "dia", level: "A2", pt: "Tarefas de casa", de: "Hausarbeit: putzen, waschen, aufräumen", abre: "Wer putzt bei euch die Wohnung?"},
  {id: "schlaf", cat: "dia", level: "A2", pt: "Sono e cansaço", de: "Schlafen und Müdigkeit, besonders nach Nachtdiensten", abre: "Wie viele Stunden schläfst du normalerweise?"},
  {id: "verkehr", cat: "dia", level: "A2", pt: "Transporte na cidade", de: "Verkehr in der Stadt: Auto, Bus, Fahrrad", abre: "Wie kommst du zur Arbeit?"},
  {id: "kleidung", cat: "dia", level: "A2", pt: "Roupas e estilo", de: "Kleidung und Mode", abre: "Was ziehst du am liebsten an?"},
  {id: "handy", cat: "dia", level: "A2", pt: "Celular e internet", de: "das Handy und das Internet im Alltag", abre: "Wie lange bist du am Tag am Handy?"},
  // ---- Temas: lazer e gostos ----
  {id: "sport", cat: "lazer", level: "A1", pt: "Esporte", de: "Sport und Fitness", abre: "Machst du Sport?"},
  {id: "fussball", cat: "lazer", level: "A1", pt: "Futebol", de: "Fußball: Lieblingsverein, Spiele, die Bundesliga", abre: "Für welchen Verein bist du?"},
  {id: "musik", cat: "lazer", level: "A1", pt: "Música", de: "Musik: Lieblingsbands und Konzerte", abre: "Was für Musik hörst du gern?"},
  {id: "serien", cat: "lazer", level: "A2", pt: "Séries e filmes", de: "Serien und Filme", abre: "Welche Serie schaust du gerade?"},
  {id: "spiele", cat: "lazer", level: "A2", pt: "Jogos de tabuleiro", de: "Brettspiele und Spieleabende", abre: "Spielst du gern Brettspiele?"},
  {id: "feste", cat: "lazer", level: "A2", pt: "Festas e aniversários", de: "Feste und Geburtstage feiern", abre: "Wie feierst du deinen Geburtstag?"},
  {id: "buecher", cat: "lazer", level: "A2", pt: "Livros e leitura", de: "Bücher und Lesen", abre: "Was liest du gerade?"},
  {id: "natur", cat: "lazer", level: "A2", pt: "Natureza e passeios", de: "Natur, Wandern und Ausflüge", abre: "Bist du gern in der Natur?"},
  // ---- Temas: trabalho e estudo ----
  {id: "dienst", cat: "trabalho", level: "A2", pt: "Plantões", de: "Nachtdienste: wie es ist, die ganze Nacht im Krankenhaus zu arbeiten", abre: "Wie ist es, die ganze Nacht zu arbeiten?"},
  {id: "studium", cat: "trabalho", level: "A2", pt: "A faculdade de medicina", de: "das Medizinstudium in Brasilien", abre: "Wie lange hast du Medizin studiert?"},
  {id: "kollegen", cat: "trabalho", level: "A2", pt: "Colegas de trabalho", de: "Kollegen und Teamarbeit", abre: "Wie ist die Stimmung in deinem Team?"},
  {id: "approbation", cat: "trabalho", level: "B1", pt: "O caminho até a Approbation", de: "die Approbation in Deutschland: Sprachprüfungen, Fachsprachprüfung, Bewerbung", abre: "Wie weit bist du schon mit der Approbation?"},
  {id: "harter_tag", cat: "trabalho", level: "B1", pt: "Um dia difícil no trabalho", de: "ein anstrengender Arbeitstag: was passiert ist und wie Luiz damit umgeht", abre: "Du siehst müde aus. War heute viel los?"},
  // ---- Temas: Brasil e Alemanha ----
  {id: "heimatstadt", cat: "mundo", level: "A1", pt: "Minha cidade", de: "Luiz' Stadt in Brasilien", abre: "Wie ist deine Stadt so?"},
  {id: "brasilessen", cat: "mundo", level: "A2", pt: "Comida brasileira", de: "brasilianisches Essen erklären", abre: "Was ist ein typisch brasilianisches Gericht?"},
  {id: "umzug", cat: "mundo", level: "A2", pt: "A mudança para a Alemanha", de: "der Umzug nach Deutschland: Vorbereitung, Sorgen, Vorfreude", abre: "Wann willst du nach Deutschland ziehen?"},
  {id: "staedte", cat: "mundo", level: "A2", pt: "Cidades alemãs", de: "deutsche Städte: wo Luiz gern wohnen würde", abre: "In welcher Stadt möchtest du wohnen?"},
  {id: "kultur", cat: "mundo", level: "B1", pt: "Diferenças culturais", de: "kulturelle Unterschiede: Pünktlichkeit, Direktheit, Freundschaft", abre: "Was überrascht dich an den Deutschen?"},
  // ---- Temas: dar opinião (B1) ----
  {id: "social_media", cat: "opiniao", level: "B1", pt: "Redes sociais", de: "soziale Medien: Vor- und Nachteile", abre: "Was hältst du von Instagram und TikTok?"},
  {id: "gesund", cat: "opiniao", level: "B1", pt: "Viver de forma saudável", de: "gesund leben: Ernährung, Bewegung, Stress", abre: "Lebst du eigentlich gesund?"},
  {id: "umwelt", cat: "opiniao", level: "B1", pt: "Meio ambiente", de: "Umweltschutz im Alltag", abre: "Was machst du für die Umwelt?"},
  {id: "stadt_land", cat: "opiniao", level: "B1", pt: "Cidade ou interior?", de: "Stadt oder Land: wo lebt man besser?", abre: "Lebst du lieber in der Stadt oder auf dem Land?"},
  {id: "ki", cat: "opiniao", level: "B1", pt: "Inteligência artificial", de: "künstliche Intelligenz im Alltag und in der Medizin", abre: "Benutzt du KI bei der Arbeit?"},
  {id: "balance", cat: "opiniao", level: "B1", pt: "Trabalho e vida pessoal", de: "Arbeit und Freizeit: wie viel Arbeit ist zu viel?", abre: "Arbeitest du zu viel?"},

  // ---- Situações: compras e comida ----
  {id: "supermarkt", cat: "comprar", level: "A1", pt: "No supermercado", role: "eine Mitarbeiterin im Supermarkt", rolePt: "Funcionária", setting: "Luiz sucht ein paar Produkte und fragt, wo sie sind.", sie: true, luizStarts: true, voice: "kore", abre: "Ja, bitte? Suchen Sie etwas?"},
  {id: "markt", cat: "comprar", level: "A1", pt: "Na feira", role: "ein Verkäufer am Obst- und Gemüsestand auf dem Wochenmarkt", rolePt: "Feirante", setting: "Luiz kauft Obst und Gemüse für die Woche.", sie: true, abre: "Probieren Sie mal, die Erdbeeren sind ganz frisch!"},
  {id: "cafe", cat: "comprar", level: "A1", pt: "No café", role: "eine Kellnerin in einem Café", rolePt: "Garçonete", setting: "Luiz bestellt Kaffee und Kuchen und bezahlt am Ende.", sie: true, voice: "kore", abre: "Hallo! Was möchten Sie trinken?"},
  {id: "jacke", cat: "comprar", level: "A2", pt: "Comprar roupa", role: "eine Verkäuferin in einem Bekleidungsgeschäft", rolePt: "Vendedora", setting: "Luiz sucht eine Winterjacke in seiner Größe und probiert sie an.", sie: true, voice: "kore", abre: "Suchen Sie etwas Bestimmtes?"},
  {id: "umtausch", cat: "comprar", level: "A2", pt: "Trocar um produto", role: "ein Mitarbeiter an der Kasse eines Elektronikgeschäfts", rolePt: "Atendente", setting: "Luiz bringt Kopfhörer zurück, die nicht funktionieren. Er möchte neue oder sein Geld zurück.", sie: true, luizStarts: true, abre: "Guten Tag, was kann ich für Sie tun?"},
  {id: "pizza", cat: "comprar", level: "A2", pt: "Pedir pizza por telefone", role: "ein Mitarbeiter eines Pizza-Lieferdienstes am Telefon", rolePt: "Atendente", setting: "Luiz bestellt Pizza nach Hause und gibt seine Adresse an.", sie: true, abre: "Pizzeria Bella, guten Abend!"},
  // ---- Situações: cidade e transporte ----
  {id: "fahrkarte", cat: "cidade", level: "A1", pt: "Comprar passagem de trem", role: "eine Mitarbeiterin im Reisezentrum am Bahnhof", rolePt: "Atendente da estação", setting: "Luiz möchte eine Fahrkarte nach Hamburg kaufen.", sie: true, voice: "kore", abre: "Guten Tag! Wohin möchten Sie fahren?"},
  {id: "verspaetung", cat: "cidade", level: "A2", pt: "Trem atrasado", role: "ein Zugbegleiter im Zug", rolePt: "Fiscal do trem", setting: "Der Zug hat Verspätung. Luiz verpasst vielleicht seinen Anschluss und fragt, was er machen soll.", sie: true, abre: "Die Fahrkarten, bitte!"},
  {id: "taxi", cat: "cidade", level: "A1", pt: "No táxi", role: "ein Taxifahrer", rolePt: "Taxista", setting: "Luiz fährt mit dem Taxi zum Krankenhaus.", sie: true, abre: "Guten Abend! Wohin soll es gehen?"},
  {id: "post", cat: "cidade", level: "A2", pt: "Nos correios", role: "eine Mitarbeiterin in der Postfiliale", rolePt: "Atendente", setting: "Luiz möchte ein Paket nach Brasilien schicken.", sie: true, voice: "kore", abre: "Der Nächste, bitte!"},
  {id: "fahrrad", cat: "cidade", level: "A2", pt: "Oficina de bicicleta", role: "ein Mechaniker in einer Fahrradwerkstatt", rolePt: "Mecânico", setting: "Das Fahrrad von Luiz hat einen Platten, und die Bremse funktioniert nicht gut.", sie: true, abre: "Hallo! Was ist denn mit dem Fahrrad los?"},
  // ---- Situações: casa e vizinhos ----
  {id: "nachbar", cat: "casa", level: "A2", pt: "Vizinha barulhenta", role: "eine Nachbarin aus der Wohnung über Luiz", rolePt: "Vizinha", setting: "Es ist 23 Uhr und oben ist es sehr laut. Luiz klingelt und spricht höflich mit ihr.", sie: true, luizStarts: true, voice: "kore", abre: "Ja? Oh, hallo!"},
  {id: "heizung", cat: "casa", level: "A2", pt: "Aquecimento quebrado", role: "der Hausmeister des Wohnhauses am Telefon", rolePt: "Zelador", setting: "Die Heizung in Luiz' Wohnung funktioniert nicht, und es ist kalt. Luiz ruft an.", sie: true, luizStarts: true, abre: "Hausmeister, guten Tag."},
  {id: "wg", cat: "casa", level: "A2", pt: "Entrevista numa república", role: "eine Studentin, die einen Mitbewohner für ihre WG sucht", rolePt: "Moradora", setting: "Luiz besichtigt ein Zimmer in einer WG und stellt sich vor.", sie: false, voice: "kore", abre: "Hi, komm rein! Willst du einen Tee?"},
  {id: "paket", cat: "casa", level: "A1", pt: "Pacote no vizinho", role: "ein älterer Nachbar", rolePt: "Vizinho", setting: "Der Paketbote hat ein Paket für Luiz beim Nachbarn abgegeben. Luiz klingelt und holt es ab.", sie: true, luizStarts: true, abre: "Ah, Sie sind der neue Nachbar, oder?"},
  {id: "internet", cat: "casa", level: "A2", pt: "Internet sem funcionar", role: "ein Mitarbeiter der Hotline eines Internetanbieters", rolePt: "Suporte técnico", setting: "Seit zwei Tagen funktioniert das Internet nicht. Luiz ruft die Hotline an.", sie: true, abre: "Kundenservice, guten Tag. Wie kann ich Ihnen helfen?"},
  // ---- Situações: serviços e imprevistos ----
  {id: "friseur", cat: "servicos", level: "A1", pt: "No cabeleireiro", role: "eine Friseurin", rolePt: "Cabeleireira", setting: "Luiz möchte sich die Haare schneiden lassen.", sie: true, voice: "kore", abre: "Hallo! Wie hätten Sie es gern?"},
  {id: "fitness", cat: "servicos", level: "A2", pt: "Matrícula na academia", role: "ein Mitarbeiter im Fitnessstudio", rolePt: "Atendente da academia", setting: "Luiz möchte Mitglied werden und fragt nach Preisen, Vertrag und Öffnungszeiten.", sie: false, abre: "Hi! Willst du dich anmelden?"},
  {id: "schluessel", cat: "servicos", level: "A2", pt: "Fiquei trancado do lado de fora", role: "ein Mitarbeiter vom Schlüsseldienst am Telefon", rolePt: "Chaveiro", setting: "Luiz hat sich ausgesperrt, der Schlüssel liegt in der Wohnung.", sie: true, luizStarts: true, abre: "Schlüsseldienst, guten Abend."},
  {id: "mietauto", cat: "servicos", level: "A2", pt: "Alugar um carro", role: "eine Mitarbeiterin bei einer Autovermietung", rolePt: "Atendente", setting: "Luiz möchte für das Wochenende ein Auto mieten.", sie: true, voice: "kore", abre: "Guten Tag! Haben Sie reserviert?"},
  {id: "polizei", cat: "servicos", level: "B1", pt: "Registrar um furto", role: "ein Polizist auf der Polizeiwache", rolePt: "Policial", setting: "Luiz' Fahrrad wurde gestohlen, und er möchte eine Anzeige machen.", sie: true, luizStarts: true, abre: "Guten Tag. Worum geht es?"},
  // ---- Situações: saúde, como paciente ----
  {id: "apotheke", cat: "saude", level: "A1", pt: "Na farmácia", role: "eine Apothekerin", rolePt: "Farmacêutica", setting: "Luiz hat Halsschmerzen und möchte etwas ohne Rezept.", sie: true, voice: "kore", abre: "Guten Tag, was kann ich für Sie tun?"},
  {id: "zahnarzt", cat: "saude", level: "A2", pt: "No dentista", role: "eine Zahnärztin", rolePt: "Dentista", setting: "Luiz hat seit drei Tagen Zahnschmerzen.", sie: true, voice: "kore", abre: "Was führt Sie zu mir?"},
  {id: "praxis_anruf", cat: "saude", level: "A2", pt: "Ligar para o consultório", role: "die Medizinische Fachangestellte am Empfang einer Hausarztpraxis, am Telefon", rolePt: "Recepcionista do consultório", setting: "Luiz ruft in der Praxis an: Er braucht ein neues Rezept für seine Allergietabletten und möchte wissen, ob seine Blutwerte schon da sind.", sie: true, luizStarts: true, voice: "kore", abre: "Praxis Dr. Albers, guten Tag."},
  {id: "krank", cat: "saude", level: "A2", pt: "Avisar que está doente", role: "die Oberärztin von Luiz am Telefon", rolePt: "Chefe (Oberärztin)", setting: "Luiz hat Fieber und kann heute nicht zum Dienst kommen. Er ruft an.", sie: true, luizStarts: true, voice: "kore", abre: "Innere, Schneider?"},
  // ---- Situações: no hospital, com colegas ----
  {id: "erster_tag", cat: "hospital", level: "A2", pt: "Primeiro dia no hospital", role: "eine Assistenzärztin, die Luiz am ersten Tag alles zeigt", rolePt: "Colega (residente)", setting: "Erster Arbeitstag auf der Station: Sie zeigt ihm alles und erklärt den Ablauf.", sie: false, voice: "kore", abre: "Hallo, du bist der Neue, oder? Ich bin Jana."},
  {id: "dienst_tauschen", cat: "hospital", level: "A2", pt: "Trocar plantão", role: "ein Kollege, Assistenzarzt", rolePt: "Colega", setting: "Luiz möchte seinen Dienst am Samstag mit ihm tauschen.", sie: false, luizStarts: true, abre: "Hey, was gibt's?"},
  {id: "kantine", cat: "hospital", level: "A2", pt: "No refeitório", role: "eine Pflegekraft aus dem Team in der Mittagspause", rolePt: "Enfermeira do time", setting: "Smalltalk in der Kantine: Arbeit, Wochenende, Pläne.", sie: false, voice: "kore", abre: "Ist hier noch frei?"},
  {id: "uebergabe", cat: "hospital", level: "B1", pt: "Passagem de plantão", role: "eine Kollegin, die nach dem Nachtdienst übernimmt", rolePt: "Colega do próximo turno", setting: "Morgens nach dem Nachtdienst übergibt Luiz kurz zwei Patienten.", sie: false, voice: "kore", abre: "Morgen! Wie war die Nacht? Gibt es was Wichtiges?"},
  {id: "dienst_anruf", cat: "hospital", level: "B1", pt: "Passar um caso por telefone no plantão", role: "der Oberarzt der Inneren im Hintergrunddienst, nachts zu Hause am Telefon", rolePt: "Oberarzt de sobreaviso", setting: "Nachtdienst: Ein Patient auf Station hat plötzlich Fieber und einen niedrigen Blutdruck. Luiz ruft den Oberarzt an, stellt den Fall kurz vor und fragt, was er tun soll. Ask him short practical questions (vital signs, lab values, what he has already done) and agree on a plan.", sie: true, luizStarts: true, abre: "Ja, Hoffmann? Was gibt's?"},
  {id: "urlaub_chef", cat: "hospital", level: "B1", pt: "Pedir férias ao chefe", role: "der Oberarzt", rolePt: "Chefe (Oberarzt)", setting: "Luiz möchte im Dezember zwei Wochen Urlaub, um nach Brasilien zu fliegen.", sie: true, luizStarts: true, abre: "Kommen Sie rein. Was gibt's?"},
  // ---- Situações: gente e convites ----
  {id: "einladung", cat: "social", level: "A1", pt: "Convidar para jantar", role: "eine Kollegin aus dem Deutschkurs", rolePt: "Colega do curso", setting: "Luiz lädt sie für Samstag zum Essen ein, und sie machen eine Uhrzeit aus.", sie: false, luizStarts: true, voice: "kore", abre: "Hallo Luiz! Na, wie geht's?"},
  {id: "party", cat: "social", level: "A2", pt: "Numa festa", role: "ein Gast auf einer Geburtstagsparty, den Luiz nicht kennt", rolePt: "Convidado", setting: "Luiz lernt auf einer Party jemanden kennen.", sie: false, abre: "Hi! Woher kennst du Max?"},
  {id: "tandem", cat: "social", level: "A2", pt: "Tandem de idiomas", role: "eine Deutsche, die Portugiesisch lernt (Sprachtandem)", rolePt: "Parceira de tandem", setting: "Erstes Treffen im Café: Sie stellen sich vor und planen, wie sie zusammen lernen.", sie: false, voice: "kore", abre: "Hallo! Schön, dass es geklappt hat!"},
  {id: "zu_spaet", cat: "social", level: "A2", pt: "Chegar atrasado", role: "ein Freund, der im Restaurant schon zwanzig Minuten wartet", rolePt: "Amigo", setting: "Luiz kommt zu spät und entschuldigt sich.", sie: false, luizStarts: true, abre: "Da bist du ja endlich!"},
  {id: "verein", cat: "social", level: "A2", pt: "Entrar num time de futebol", role: "der Trainer einer Hobby-Fußballmannschaft", rolePt: "Treinador", setting: "Luiz möchte in der Mannschaft mitspielen und fragt nach Training und Kosten.", sie: false, luizStarts: true, abre: "Hallo! Willst du mitspielen?"}
];

const CONV_PHONE_IDS = new Set(["termin", "pizza", "heizung", "internet", "schluessel", "krank", "praxis_anruf", "dienst_anruf"]);
(function convTopicsExpand() {
  for (const t of CONV_TOPICS) {
    const m = CONV_TOPIC_META[t.id];
    if (!m) continue;
    t.cat = m[0]; t.abre = m[1];
    if (m[2] && !t.voice) t.voice = m[2];
  }
  // Situações ao telefone: a voz dela pode ganhar a “linha” (conversa.js, convPhoneRoute).
  for (const t of [...CONV_TOPICS, ...CONV_TOPICS_NEW]) if (CONV_PHONE_IDS.has(t.id)) t.phone = true;
  // Situação sem campo “de” usa o próprio cenário no prompt (convSystemPrompt olha role/setting); tema novo usa “de”.
  for (const t of CONV_TOPICS_NEW) if (!CONV_TOPICS.some(x => x.id === t.id)) CONV_TOPICS.push({...t, group: t.role ? "Situações" : "Temas"});
})();

// ---------- Tela: navegar pelos temas e situações ----------
const convBrowse = {cat: {}, q: {}, sug: {}};
function convCatsOf(group) { return CONV_CATS[group] || []; }
function convTopicDone() {
  const n = {};
  for (const s of convData().sessions) n[s.topic] = (n[s.topic] || 0) + 1;
  return n;
}
/* Sugestões: ainda não feitas, no seu nível; “Outra sugestão” passa para a próxima da lista. */
function convSuggestions(list, done) {
  const level = convLevel(), at = t => LEVELS.indexOf(t.level) <= LEVELS.indexOf(level);
  const a = list.filter(t => !done[t.id] && at(t)), b = list.filter(t => !done[t.id] && !at(t)), c = list.filter(t => done[t.id] && at(t));
  return [...a, ...b, ...c].length ? [...a, ...b, ...c] : list;
}
const convBare2 = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function convTopicMatches(t, q) {
  if (!q) return true;
  const hay = convBare2([t.pt, t.de, t.abre, t.rolePt, t.setting].join(" "));
  return convBare2(q).split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
function convTopicCard(t, done, ok) {
  const n = done[t.id] || 0;
  return h("button", {class: "ct-card", type: "button", disabled: !ok, "data-topic": t.id, onclick: () => openConversa(t.id)},
    h("span", {class: "ct-meta"}, h("span", {class: "ct-level", text: t.level}), t.role ? h("span", {class: "ct-reg", text: t.sie ? "Sie" : "du"}) : null,
      n ? h("span", {class: "ct-done", title: plural(n, "conversa feita", "conversas feitas")}, icon("check", 14), String(n)) : null),
    h("span", {class: "ct-quote", lang: "de", text: t.abre || t.de}),
    h("span", {class: "ct-title", text: t.pt}),
    t.rolePt ? h("span", {class: "ct-with", text: "Com: " + t.rolePt.toLowerCase()}) : null);
}
/* Um painel (Temas ou Situações): sugestão em destaque, filtros por categoria, busca e as categorias em grade. */
function convBrowser(group) {
  const ok = !!(conv.status && conv.status.installed) || (typeof liveOn === "function" && liveOn());
  const list = CONV_TOPICS.filter(t => t.group === group), done = convTopicDone(), cats = convCatsOf(group);
  const sugs = convSuggestions(list, done), sug = sugs[(convBrowse.sug[group] || 0) % sugs.length];
  const root = h("div", {class: "ct-browser"});
  const hero = h("section", {class: "ct-hero"},
    h("div", {class: "ct-hero-body"},
      h("p", {class: "ct-hero-k", text: group === "Temas" ? "Sugestão para hoje" : "Situação sugerida"}),
      h("p", {class: "ct-hero-quote", lang: "de", text: sug.abre || sug.de}),
      h("h3", {class: "ct-hero-title", text: sug.pt}),
      h("p", {class: "ct-hero-sub", text: [sug.level, sug.role ? (sug.sie ? "você trata por Sie" : "você trata por du") + " · com " + sug.rolePt.toLowerCase() : "", sug.luizStarts ? "você começa a conversa" : ""].filter(Boolean).join(" · ")})),
    h("div", {class: "ct-hero-act"},
      h("button", {class: "primary", type: "button", disabled: !ok, onclick: () => openConversa(sug.id)}, icon("chat", 18), "Começar a conversa"),
      sugs.length > 1 ? h("button", {class: "quiet small", type: "button", onclick: () => { convBrowse.sug[group] = (convBrowse.sug[group] || 0) + 1; renderConvSetup(); }}, "Outra sugestão") : null));
  const cur = convBrowse.cat[group] || "all";
  const search = h("input", {type: "search", class: "ct-search", placeholder: group === "Temas" ? "Procurar tema" : "Procurar situação", "aria-label": "Procurar", value: convBrowse.q[group] || ""});
  const chips = h("div", {class: "ct-chips", role: "group", "aria-label": "Categorias"},
    ...[["all", "Tudo", null], ...cats].map(([id, label, ic]) => h("button", {type: "button", class: "ct-chip", "aria-pressed": String(id === cur),
      onclick: () => { convBrowse.cat[group] = id; renderConvSetup(); }}, ic ? icon(ic, 15) : null, label)));
  const sections = cats.filter(([id]) => cur === "all" || id === cur).map(([id, label, ic]) => {
    const items = list.filter(t => t.cat === id);
    return h("section", {class: "ct-sec", "data-cat": id},
      h("header", {class: "ct-sec-head"}, h("span", {class: "ct-sec-icon"}, icon(ic, 18)), h("h2", {text: label}), h("span", {class: "ct-count", text: String(items.length)})),
      h("div", {class: "ct-grid"}, ...items.map(t => convTopicCard(t, done, ok))));
  });
  const empty = h("p", {class: "ct-empty", hidden: true});
  const applySearch = () => {
    const q = search.value.trim();
    convBrowse.q[group] = q;
    let any = 0;
    for (const sec of sections) {
      let n = 0;
      for (const card of sec.querySelectorAll(".ct-card")) { const t = CONV_TOPICS.find(x => x.id === card.dataset.topic); const show = convTopicMatches(t, q); card.hidden = !show; n += show; }
      sec.hidden = !n; any += n;
    }
    empty.hidden = !!any;
    empty.textContent = "Nada com “" + q + "”. Tente outra palavra, em português ou em alemão.";
    hero.hidden = !!q;
  };
  search.addEventListener("input", applySearch);
  fill(root, hero, h("div", {class: "ct-toolbar"}, chips, search), ...sections, empty);
  if (search.value) applySearch();
  return root;
}
/* Conversa livre: uma faixa só, no fim dos temas. */
function convFreeNode() {
  const t = CONV_TOPICS.find(x => x.id === "frei");
  if (!t) return null;
  const ok = !!(conv.status && conv.status.installed) || (typeof liveOn === "function" && liveOn());
  return h("button", {class: "ct-free", type: "button", disabled: !ok, onclick: () => openConversa("frei")},
    h("span", {class: "ct-quote", lang: "de", text: t.abre}), h("span", {class: "ct-title", text: "Conversa livre: você escolhe o assunto"}));
}
