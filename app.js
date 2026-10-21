"use strict";
/* Satzbausteine · lógica do aplicativo.
   Carregados antes: fsrs.js (FSRS), catalog*.js (frases) e audio-index.js (áudios embutidos). */

const APP_VERSION = "1.8.0";
const BUNDLED_VERSION = "1.2.0+638f2ca0+med125+fach+ankunft+nw520+moldes+nw2a867";
const KEY_PROGRESS = "satzbausteine.progress.v1";
const KEY_SETTINGS = "satzbausteine.settings.v1";
const KEY_CATALOG_FALLBACK = "satzbausteine.catalog.v1";
const KEY_CATALOG_VERSION = "satzbausteine.catalogVersion";
const KEY_THEME = "satzbausteine.theme";
const KEY_AUTO_BACKUP = "satzbausteine.lastAutoBackup";
const KEY_LAST_SYNC = "satzbausteine.lastSync";
const DB_NAME = "satzbausteine.catalog";
const DATA_DB_NAME = "satzbausteine.data";
const REQUIRED_TAGS = ["Funktion", "Register", "Niveau", "Prio", "Modus", "Schicht", "Quelle", "Bezug"];
const BUNDLED_CARDS = [
  ...(typeof FRASES !== "undefined" ? FRASES : []),
  ...(typeof FRASES_MEDIZIN !== "undefined" ? FRASES_MEDIZIN : []),
  ...(typeof FRASES_FACH !== "undefined" ? FRASES_FACH : []),
  ...(typeof FRASES_ANKUNFT !== "undefined" ? FRASES_ANKUNFT : []),
  ...(typeof FRASES_NICOSWEG !== "undefined" ? FRASES_NICOSWEG : []),
  ...(typeof FRASES_NICOSWEG_A2 !== "undefined" ? FRASES_NICOSWEG_A2 : [])
];

const REF_GROUPS = [
  {title: "QECR · interação, produção e mediação", items: [
    ["GER_Interlocutor", "Compreender interlocutor"], ["GER_Conversa", "Conversação"], ["GER_DiscussaoInformal", "Discussão informal"],
    ["GER_DiscussaoFormal", "Discussão formal/reuniões"], ["GER_Cooperacao", "Cooperação orientada a objetivos"], ["GER_Servicos", "Obter bens e serviços"],
    ["GER_Informacoes", "Troca de informações"], ["GER_Entrevista", "Entrevistar e ser entrevistado"], ["GER_Telefone", "Telecomunicações"],
    ["GER_Correspondencia", "Correspondência"], ["GER_Notas", "Notas, mensagens e formulários"], ["GER_OnlineConversa", "Discussão online"],
    ["GER_OnlineTarefa", "Transações/colaboração online"], ["GER_Turno", "Tomada de turno"], ["GER_Cooperar", "Estratégia de cooperação"],
    ["GER_Clarificar", "Pedir esclarecimento"], ["GER_Experiencia", "Monólogo: experiência"], ["GER_DarInformacao", "Monólogo: dar informação"],
    ["GER_Argumentar", "Monólogo: defender posição"], ["GER_Vortrag", "Falar ao público"], ["GER_Compensar", "Compensação"],
    ["GER_Reparar", "Monitoramento e reparo"], ["GER_Registro", "Adequação sociolinguística"], ["GER_MediarInfoOral", "Transmitir informação específica: oral"],
    ["GER_MediarInfoEscrita", "Transmitir informação específica: escrita"], ["GER_MediarTextoOral", "Resumir e comentar texto: oral"],
    ["GER_MediarTextoEscrita", "Resumir e comentar texto: escrita"], ["GER_InteracaoGeralOral", "Interação oral geral"],
    ["GER_InteracaoGeralEscrita", "Interação escrita geral"], ["GER_RelatorioEnsaio", "Produção escrita: relatório/ensaio"]]},
  {title: "Profile deutsch · Sprachhandlungen", items: [
    ["PD1", "Informationsaustausch"], ["PD2", "Bewertung, Kommentar"], ["PD3", "Gefühlsausdruck"], ["PD4", "Handlungsregulierung"],
    ["PD5", "Soziale Konventionen"], ["PD6", "Redeorganisation und Verständigungssicherung"]]},
  {title: "Tarefas de prova", items: [
    ["Goethe_S1", "Fórum (~150 palavras, mínimo 150 no modelo)"], ["Goethe_S2", "Mensagem (~100 palavras, mínimo 100 no modelo)"],
    ["Goethe_M1", "Vortrag (~4 min)"], ["Goethe_M2", "Diskussion (~5 min)"], ["telc_Mail_Info", "E-mail pedido de informação (≥150 palavras, 30 min)"],
    ["telc_Mail_Beschwerde", "E-mail reclamação (≥150 palavras, 30 min)"], ["telc_Kennenlernen", "Conhecer o par (sem nota)"],
    ["telc_M1", "Experiência (~1,5 min + perguntas)"], ["telc_M2", "Discussão (resumo de texto + troca)"], ["telc_M3", "Planejar em conjunto"]]},
  {title: "Fachsprachprüfung · alemão médico", items: [
    ["FSP_Anamnese", "Anamnese (Arzt-Patienten-Gespräch)"], ["FSP_Aufklaerung", "Esclarecimento ao paciente (Aufklärung)"],
    ["FSP_Dokumentation", "Documentação e Arztbrief"], ["FSP_Fallvorstellung", "Arzt-Arzt-Gespräch e apresentação de caso"],
    ["FSP_Fachbegriffe", "Termos técnicos ↔ linguagem leiga"]]},
  {title: "Vida na Alemanha", items: [["Ankunft", "Chegada: burocracia, moradia, banco e Approbation"]]},
  {title: "Curso", items: [["NicosWeg", "Nicos Weg A1 e A2 (Deutsche Welle) + Wortlisten A1 e A2 do Goethe"]]}
];
const REF_LABELS = new Map(REF_GROUPS.flatMap(g => g.items));

// ---------- Rótulos em português ----------
const REGISTER_CHIPS = {
  du: ["du", "informal"], Sie: ["Sie", "formal"], ihr: ["ihr", "plural informal"],
  neutro: ["neutro", "sem tratamento marcado"], escrito: ["escrito", "texto escrito"]
};
const THEME_LABELS = {
  Alltag: "Dia a dia", Arbeit: "Trabalho", Freundschaft: "Amizade", Bildung: "Educação", Behoerde: "Repartições", Kultur: "Cultura",
  Wohnen: "Moradia", Dienstleistung: "Serviços", Reisen: "Viagens", Medien: "Mídia", Gesundheit: "Saúde", Technologie: "Tecnologia",
  Telefon: "Telefone", Mobilitaet: "Mobilidade", Versicherung: "Seguros", Konsum: "Consumo", Geld: "Dinheiro", Umwelt: "Meio ambiente",
  Ernaehrung: "Alimentação", Gleichstellung: "Igualdade", Migration: "Migração", Nachbarn: "Vizinhos", Ehrenamt: "Voluntariado",
  Sport: "Esporte", Medizin: "Medicina (FSP)", Fachbegriffe: "Termos médicos", Ankunft: "Chegada na Alemanha", Meine: "Minhas frases", NicosWeg: "Reforço · Nicos Weg"
};
const MEDICAL_THEMES = new Set(["Medizin", "Fachbegriffe"]);
const FEATURED_THEMES = ["Meine", "NicosWeg", "Medizin", "Fachbegriffe", "Ankunft"];
const TAG_VALUE_LABELS = {
  Register: {Sie: "Sie · formal", du: "du · informal", neutral: "Neutro", formell: "Formal (escrito)", umgangssprachlich: "Coloquial", ihr: "ihr · plural"},
  Modus: {Produktion: "Produção", Verstehen: "Compreensão"},
  Schicht: {1: "K1 · base", 2: "K2 · intermediária", 3: "K3 · avançada"},
  Prio: {1: "Prioridade 1", 2: "Prioridade 2", 3: "Prioridade 3"},
  Quelle: {Kernliste: "Lista principal", Medizin: "Módulo médico", Ankunft: "Módulo chegada", Meine: "Minhas frases", NicosWeg: "Reforço Nicos Weg"},
  Thema: THEME_LABELS
};
const FUNCTION_FIXES = {
  NaoSaber: "Não saber", NaoGostar: "Não gostar", Duvida: "Dúvida", Alivio: "Alívio", Tedio: "Tédio", Esperanca: "Esperança",
  Indiferenca: "Indiferença", Condolencias: "Condolências", Importancia: "Importância", PontosFortesFracos: "Pontos fortes e fracos",
  CartaAbertura: "Carta: abertura", CartaFecho: "Carta: fecho", TelefoneAbertura: "Telefone: abertura", TelefoneFecho: "Telefone: fecho",
  ElogiarSocial: "Elogiar (social)", Eigene: "Frase própria"
};
const THEME_NAMES = {"Wohnen": "moradia", "Behoerde": "Bürgeramt", "Arbeit": "emprego", "Gesundheit": "paciente", "Umwelt": "plástico", "Reisen": "viagem", "Medien": "redes", "Konsum": "consumo", "Ernaehrung": "alimentação e trabalho", "Bildung": "estudos", "Freundschaft": "amizades e vida social", "Versicherung": "seguro", "Gleichstellung": "igualdade de direitos", "Migration": "migração e integração", "Sport": "esportes e atividade física", "Kultur": "livros", "Technologie": "tecnologia e IA", "Mobilitaet": "trânsito", "Geld": "banco", "Ehrenamt": "voluntariado", "Telefon": "telefonema", "Dienstleistung": "compras", "Nachbarn": "vizinhos e convivência", "Alltag": "rotina", "Medizin": "plantão no hospital", "Fachbegriffe": "explicar termos médicos a um paciente", "Ankunft": "primeiras semanas na Alemanha", "NicosWeg": "o dia a dia (curso Nicos Weg)"};
const FILTER_KEYS = [["Schicht", "Camada"], ["Prio", "Prioridade"], ["Modus", "Modo"], ["Niveau", "Nível"], ["Thema", "Tema"], ["Register", "Registro"], ["Funktion", "Função"], ["Bezug", "Referência"]];

// ---------- Estado ----------
const $ = id => document.getElementById(id);
const all = selector => Array.from(document.querySelectorAll(selector));
const GRADES = ["again", "hard", "good", "easy"];
const GRADE_LABELS = {again: "Errei", hard: "Difícil", good: "Bom", easy: "Fácil"};
const GRADE_NUM = {again: 1, hard: 2, good: 3, easy: 4};
const LEECH_LAPSES = 3;
/* IDs de cartão: catálogo (K1-0001…) e “Minhas frases” (M-…). */
const CARD_ID = /^(K[123]-\d{4,}|M-[a-z0-9]{6,20})$/;

let db = null, dataDb = null, cards = [], byId = new Map(), currentView = "home";
const tagIndex = new Map(), searchIndex = new Map();
let progress = emptyProgress();
let settings = {newLimit: 6, reviewLimit: "", newOrder: "priority", voice: "", rate: .9, retention: .9, theme: "auto", typing: false,
  welcomeDismissed: false, audioSource: "neural", alternateVoices: true, medShare: 0, plan: null, fsrsWeights: null, fsrsInfo: null, readingGoal: 60,
  presentNew: true, levelGate: true, nwChapter: 7, germanSituations: false, genderColors: true, showRubric: "auto", achieved: [], sceneShowOther: true, sceneHelp: "auto",
  convVoice: "charon", convShowText: true, convAutoSend: false, convHandsFree: false, convCheck: "equilibrado"};
const session = {mode: "production", active: false, leech: false, label: "", queue: [], steps: new Map(), card: null, step: "produce", cardVoice: "", revealed: false,
  done: 0, failed: 0, fresh: 0, grades: {}, startedAt: 0, shownAt: 0, undo: [], extraNew: 0, extraReviews: 0, extraReviewsDay: "", speech: "idle", dictation: false, diktat: null};
let templateCard = null, templateVariation = 0, activationCards = [], activationRound = 0;
let catalogPage = 0, examLinkedPage = 0, activeExam = null, examCompleted = false;
let timerEnd = 0, timerLeft = 0, timerTicker = null, timerRunning = false;
let recorder = null, recordPlace = null, voices = [];
let filters = {session: {}, catalog: {}};
let desktopInfo = null, autoBackupTimer = null, optimizerWorker = null;

function emptyProgress() { return {version: 3, cards: {}, days: {}, reviewDays: {}, dayStats: {}, errorStats: {}, practice: {scenes: {}, pron: {}}, schedule: defaultSchedule(), mine: {items: {}}, lastBackupAt: 0}; }

// ---------- DOM ----------
function applyStyle(el, css) {
  for (const decl of String(css).split(";")) {
    const i = decl.indexOf(":");
    if (i > 0) el.style.setProperty(decl.slice(0, i).trim(), decl.slice(i + 1).trim());
  }
}
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (typeof props === "string") el.className = props;
  else if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = String(value);
      else if (key === "style") applyStyle(el, value);
      else if (key === "dataset") Object.assign(el.dataset, value);
      else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
      else if (key in el && typeof el[key] === "boolean") el[key] = !!value;
      else if (key === "value") el.value = value;
      else el.setAttribute(key, value === true ? "" : value);
    }
  }
  for (const child of children.flat()) if (child != null && child !== false) el.append(child instanceof Node ? child : String(child));
  return el;
}
/* replaceChildren sem transformar null/false em texto. */
function fill(el, ...nodes) { el.replaceChildren(...nodes.flat().filter(n => n != null && n !== false)); return el; }
function node(tag, className, value) { return h(tag, className || null, value === undefined ? null : String(value)); }
function setWidth(el, pct) { el.style.width = Math.max(0, Math.min(100, pct)) + "%"; }

const ICONS = {
  volume: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  slow: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l-3.5-4"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.3 1.8 1.2 2.8 2.3 3.1C11 9 11 6 12 3z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M8 7h7"/>',
  today: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/>',
  skipBack: '<path d="M18 5.5v13L9 12z" fill="currentColor"/><path d="M6 5v14"/>',
  skipFwd: '<path d="M6 5.5v13L15 12z" fill="currentColor"/><path d="M18 5v14"/>',
  pen: '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6l-3.9.9.9-3.9z"/>',
  notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12.5 8h3M12.5 12h3"/>',
  bookOpen: '<path d="M12 7v13"/><path d="M3 5.5a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3 3 3 0 0 1 3-3h5a1 1 0 0 1 1 1V17a1 1 0 0 1-1 1h-6a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4a1 1 0 0 1-1-1z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  pin: '<path d="M9 3h6l-1 6 3 3H7l3-3z"/><path d="M12 12v9"/>',
  repeat: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
  puzzle: '<path d="M10 4h4v2.5a1.5 1.5 0 0 0 3 0V4h3v6h-2.5a1.5 1.5 0 0 0 0 3H20v7h-6v-2.5a1.5 1.5 0 0 0-3 0V20H4v-7h2.5a1.5 1.5 0 0 0 0-3H4V4z"/>',
  speech: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M17 6.5a4 4 0 0 1 0 5M19.5 4a7.5 7.5 0 0 1 0 10"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2.5 21.5z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  lineHeight: '<path d="M11 6h9M11 12h9M11 18h9"/><path d="M5.5 4v16M3 6.5 5.5 4 8 6.5M3 17.5 5.5 20 8 17.5"/>'
};
/* Ícone + texto como filhos de h(): h("button", null, iconText("play", "Tocar")). */
function iconText(name, text, size = 16) { return [icon(name, size), text]; }
function icon(name, size = 20) {
  const tpl = document.createElement("template");
  tpl.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  return tpl.content.firstChild;
}

// ---------- Avisos e registro de erros ----------
function toast(message, kind = "info", timeout) {
  const box = $("toasts");
  if (!box || !message) return;
  const wait = timeout ?? (kind === "error" ? 9000 : 4500);
  const same = [...box.children].find(t => t.dataset.msg === message);
  if (same) { clearTimeout(same.timer); same.timer = setTimeout(same.dismiss, wait); return; }
  const item = h("div", {class: "toast " + kind, role: kind === "error" ? "alert" : "status", dataset: {msg: message}});
  const dismiss = () => { clearTimeout(item.timer); item.classList.remove("in"); setTimeout(() => item.remove(), 300); };
  item.dismiss = dismiss;
  item.append(h("span", {class: "toast-ico"}, icon(kind === "error" ? "alert" : kind === "success" ? "check" : "info", 15)),
    h("span", {class: "toast-text", text: message}), h("button", {class: "toast-x", "aria-label": "Fechar aviso", onclick: dismiss}, "×"));
  box.append(item);
  requestAnimationFrame(() => item.classList.add("in"));
  item.timer = setTimeout(dismiss, wait);
  while (box.children.length > 2) box.firstChild.remove();
}
function setStatus(message, kind) {
  const status = $("status");
  if (status) status.textContent = message || "";
  if (message) toast(message, kind === "error" ? "error" : kind === "success" ? "success" : "info");
}
function reportError(kind, message, stack) {
  try { if (window.satzDesktop) window.satzDesktop.logError(kind + ": " + String(message).slice(0, 2000) + (stack ? "\n" + String(stack).slice(0, 4000) : "")); }
  catch (e) { /* sem registro disponível */ }
}
window.addEventListener("error", e => reportError("erro", e.message, e.error && e.error.stack));
window.addEventListener("unhandledrejection", e => reportError("promessa", (e.reason && e.reason.message) || e.reason, e.reason && e.reason.stack));

// ---------- Datas ----------
const DAY_MS = 86400000;
function dateKey(d = new Date()) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function dateAfter(days) { const d = new Date(); d.setDate(d.getDate() + days); return dateKey(d); }
function monthsAfter(months) { const d = new Date(); d.setMonth(d.getMonth() + months); return dateKey(d); }
function dayStart(key) { return new Date(key + "T00:00:00").getTime(); }
function addDays(ts, days) { const d = new Date(ts); d.setDate(d.getDate() + days); return d.getTime(); }
function calendarDays(from, to) { return Math.round((dayStart(dateKey(new Date(to))) - dayStart(dateKey(new Date(from)))) / DAY_MS); }
function daysUntil(key) { return key ? calendarDays(Date.now(), dayStart(key)) : 0; }
function formatDate(key, opts = {day: "numeric", month: "short", year: "numeric"}) { return key ? new Date(key + "T12:00:00").toLocaleDateString("pt-BR", opts) : "—"; }
function relativeDay(ts) {
  const diff = calendarDays(Date.now(), ts);
  if (diff <= 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff < 31) return "em " + diff + " d";
  if (diff < 365) return "em " + Math.round(diff / 30.4) + " meses";
  return "em " + (diff / 365).toLocaleString("pt-BR", {maximumFractionDigits: 1}) + " anos";
}
function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60), rest = s % 60;
  if (m < 60) return m + " min" + (rest && m < 10 ? " " + rest + " s" : "");
  return Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") + " min";
}

// ---------- Armazenamento simples (configurações) ----------
function safeRead(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}
function safeWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { setStatus("Não foi possível salvar os dados. Exporte um backup e confira o espaço em disco.", "error"); return false; }
}
/* Configurações que valem em todos os aparelhos (vão junto na sincronização pelo GitHub). Tema, voz e afins ficam em cada um.
   `syncAt` só muda quando uma destas muda: assim, trocar o tema no PC não “ganha” de um capítulo novo marcado no celular. */
const SYNCED_SETTINGS = ["newLimit", "reviewLimit", "newOrder", "retention", "medShare", "nwChapter", "levelGate", "mineReview", "plan", "fsrsWeights", "fsrsInfo", "readingGoal"];
function syncedSettings(s = settings) { const out = {}; for (const k of SYNCED_SETTINGS) if (s[k] !== undefined) out[k] = s[k]; return out; }
// Valores de fábrica (lidos antes de init carregar as configurações salvas): um aparelho novo não “ganha” do outro.
const SYNCED_DEFAULT = JSON.stringify(syncedSettings());
function saveSettings() {
  const key = JSON.stringify(syncedSettings());
  if (key !== settings.syncKey) { settings.syncKey = key; settings.syncAt = key === SYNCED_DEFAULT && !settings.syncAt ? 0 : Date.now(); }
  return safeWrite(KEY_SETTINGS, settings);
}

// ---------- Progresso no IndexedDB (um registro por frase + histórico de revisões) ----------
const dirtyCards = new Set(), revlogAdds = [], revlogDeletes = [];
let dirtyAll = false, flushTimer = null, flushing = null;
// Se a leitura do progresso falhar, nada é gravado nesta sessão: gravar o estado vazio apagaria os dados.
let progressReadFailed = false;
const PROGRESS_READ_MSG = "Não consegui ler o seu progresso salvo. Para não apagar nada, o app não vai gravar nesta sessão: feche e abra de novo. Se continuar, restaure um backup (Configurações).";
function hasAnyProgress(p = progress) {
  if (!p) return false;
  const practice = p.practice || {};
  return Object.keys(p.cards || {}).length > 0 || Object.keys(p.days || {}).length > 0 || Object.keys((p.mine || {}).items || {}).length > 0
    || Object.keys(practice.scenes || {}).length > 0 || Object.keys(practice.pron || {}).length > 0
    || ((practice.conversa || {}).sessions || []).length > 0 || ((practice.f432 || {}).sessions || []).length > 0 || Object.keys((practice.reading || {}).days || {}).length > 0
    || Object.keys((practice.gram || {}).topics || {}).length > 0 || Object.keys((practice.bookWords || {}).items || {}).length > 0 || Object.keys((practice.escrita || {}).texts || {}).length > 0 || !!(p.schedule && p.schedule.updatedAt);
}
function idb(req) { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
function openDataDB() {
  return new Promise(resolve => {
    if (!("indexedDB" in window)) { resolve(null); return; }
    let req;
    try { req = indexedDB.open(DATA_DB_NAME, 1); } catch (e) { resolve(null); return; }
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("cards")) d.createObjectStore("cards", {keyPath: "id"});
      if (!d.objectStoreNames.contains("revlog")) d.createObjectStore("revlog", {keyPath: "id"});
      if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", {keyPath: "key"});
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}
async function loadProgressFromDB() {
  const tx = dataDb.transaction(["cards", "meta"], "readonly");
  const [rows, found] = await Promise.all([idb(tx.objectStore("cards").getAll()), idb(tx.objectStore("meta").get("progress"))]);
  // Banco realmente vazio: null. Frases sem o registro geral (gravação interrompida) ainda são progresso.
  if (!found && !rows.length) return null;
  const meta = found || {};
  const raw = {cards: {}, days: meta.days, reviewDays: meta.reviewDays, dayStats: meta.dayStats, errorStats: meta.errorStats, practice: meta.practice, schedule: meta.schedule, mine: meta.mine, lastBackupAt: meta.lastBackupAt};
  for (const row of rows) { const {id, ...rest} = row; raw.cards[id] = rest; }
  return sanitizeProgress(raw);
}
function saveProgress(ids) {
  if (ids === "all") dirtyAll = true;
  else if (ids) for (const id of [].concat(ids)) dirtyCards.add(id);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushProgress, 250);
  scheduleAutoBackup();
}
async function flushProgress() {
  clearTimeout(flushTimer);
  if (progressReadFailed) { setStatus(PROGRESS_READ_MSG, "error"); return false; }
  while (flushing) await flushing;
  if (!dataDb) {
    dirtyCards.clear(); dirtyAll = false; revlogAdds.length = 0; revlogDeletes.length = 0;
    return safeWrite(KEY_PROGRESS, progress);
  }
  const everything = dirtyAll, ids = everything ? Object.keys(progress.cards) : [...dirtyCards];
  const adds = revlogAdds.splice(0), dels = revlogDeletes.splice(0);
  dirtyAll = false;
  dirtyCards.clear();
  flushing = new Promise(resolve => {
    try {
      const tx = dataDb.transaction(["cards", "revlog", "meta"], "readwrite");
      const store = tx.objectStore("cards"), log = tx.objectStore("revlog");
      if (everything) store.clear();
      for (const id of ids) { const rec = progress.cards[id]; if (rec) store.put({id, ...rec}); else if (!everything) store.delete(id); }
      for (const entry of adds) log.put(entry);
      for (const id of dels) log.delete(id);
      tx.objectStore("meta").put({key: "progress", days: progress.days, reviewDays: progress.reviewDays, dayStats: progress.dayStats,
        errorStats: progress.errorStats || {}, practice: progress.practice || {scenes: {}, pron: {}}, schedule: progress.schedule || defaultSchedule(), mine: progress.mine || {items: {}}, lastBackupAt: progress.lastBackupAt || 0});
      tx.oncomplete = () => resolve(true);
      const fail = () => {
        ids.forEach(id => dirtyCards.add(id));
        if (everything) dirtyAll = true;
        revlogAdds.unshift(...adds);
        revlogDeletes.unshift(...dels);
        setStatus("Não foi possível salvar o progresso agora. Ele continua na memória; tente exportar um backup.", "error");
        resolve(false);
      };
      tx.onerror = fail;
      tx.onabort = fail;
    } catch (e) { reportError("salvar", e.message, e.stack); resolve(false); }
  });
  const ok = await flushing;
  flushing = null;
  return ok;
}
async function readRevlog() {
  if (!dataDb) return [];
  await flushProgress();
  return idb(dataDb.transaction("revlog", "readonly").objectStore("revlog").getAll());
}
function sanitizeRevlog(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(r => r && typeof r === "object" && CARD_ID.test(r.cardId) && ["production", "listening"].includes(r.mode)
    && [1, 2, 3, 4].includes(Number(r.g)) && Number.isFinite(Number(r.ts)) && typeof r.id === "string" && r.id.length < 80)
    .map(r => ({id: r.id, cardId: r.cardId, mode: r.mode, g: Number(r.g), ts: Number(r.ts), ms: Math.max(0, Number(r.ms) || 0)}));
}

// ---------- Tags ----------
function parseTags(tags) {
  const map = {};
  for (const t of tags.trim().split(/\s+/)) {
    const i = t.indexOf("::");
    if (i < 1) continue;
    const key = t.slice(0, i);
    (map[key] || (map[key] = [])).push(t.slice(i + 2));
  }
  return map;
}
function tagsOf(card) {
  let entry = tagIndex.get(card.id);
  if (!entry || entry.src !== card.tags) { entry = {src: card.tags, map: parseTags(card.tags)}; tagIndex.set(card.id, entry); }
  return entry.map;
}
function tagValues(card, key) { return tagsOf(card)[key] || []; }
function tag(card, key) { return tagValues(card, key)[0] || ""; }
function hasTag(card, key, value) { return tagValues(card, key).includes(value); }
function isMedical(card) { return tagValues(card, "Thema").some(t => MEDICAL_THEMES.has(t)); }
function functionLabel(value) {
  if (FUNCTION_FIXES[value]) return FUNCTION_FIXES[value];
  const words = value.replace(/([a-z])([A-Z])/g, "$1 $2");
  return (words.charAt(0) + words.slice(1).toLowerCase()).replace(/cao\b/g, "ção").replace(/coes\b/g, "ções").replace(/ao\b/g, "ão");
}
function tagLabel(key, value) {
  if (key === "Funktion") return functionLabel(value);
  if (key === "Bezug") return REF_LABELS.get(value) || value;
  return (TAG_VALUE_LABELS[key] && TAG_VALUE_LABELS[key][value]) || value;
}
function splitSituation(text) {
  const m = text.match(/^\[(du|Sie|ihr|neutro|escrito)\]\s*/);
  return m ? {reg: m[1], text: text.slice(m[0].length)} : {reg: "", text};
}
function regChip(reg) {
  if (!reg || !REGISTER_CHIPS[reg]) return null;
  const [label, hint] = REGISTER_CHIPS[reg];
  return h("span", {class: "reg reg-" + reg, title: hint}, label, h("small", null, "· " + hint));
}
function normalizeSearch(text) { return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("de").replace(/ß/g, "ss"); }

// ---------- Progresso por card ----------
function modeProgress(id, mode) { return (progress.cards[id] || {})[mode] || null; }
function cardProgress(id) { return progress.cards[id] || null; }
function studied(card) {
  const p = cardProgress(card.id);
  return !!(p && ((p.production && p.production.lastGrade !== "again") || (p.listening && p.listening.lastGrade !== "again")));
}
function isLeech(card, mode) {
  const p = cardProgress(card.id);
  if (!p) return false;
  return (mode ? [mode] : ["production", "listening"]).some(m => p[m] && (p[m].lapses || 0) >= LEECH_LAPSES);
}
function cardStatus(card) {
  const p = cardProgress(card.id);
  const records = p ? [p.production, p.listening].filter(Boolean) : [];
  if (!records.length) return {key: "new", label: "Nova"};
  if (isLeech(card)) return {key: "leech", label: "Difícil"};
  if (!records.some(r => r.lastGrade !== "again")) return {key: "learning", label: "Aprendendo"};
  return {key: "learned", label: "Revisão " + relativeDay(Math.min(...records.map(r => r.due)))};
}
function introducedToday() {
  let n = 0;
  const today = dateKey();
  for (const p of Object.values(progress.cards)) if (p && p.introducedAt && dateKey(new Date(p.introducedAt)) === today) n++;
  return n;
}

// ---------- Agendamento (FSRS) ----------
function currentWeights() { return FSRS.validWeights(settings.fsrsWeights) ? settings.fsrsWeights : FSRS.DEFAULT_W; }
function easeFromDifficulty(d) { return Math.round((1.3 + (10 - d) * 1.9 / 9) * 100) / 100; }
function scheduleAll(prev, now) {
  const w = currentWeights();
  const hasState = !!(prev && prev.stability > 0 && Number.isFinite(prev.lastReviewed));
  const elapsed = hasState ? Math.max(0, calendarDays(prev.lastReviewed, now)) : 0;
  const state = hasState ? {s: prev.stability, d: prev.difficulty} : null;
  const out = {};
  for (const grade of GRADES) {
    const g = GRADE_NUM[grade], next = FSRS.step(w, state, g, elapsed);
    out[grade] = {stability: next.s, difficulty: next.d, interval: g === 1 ? 0 : FSRS.interval(next.s, settings.retention)};
  }
  out.hard.interval = Math.min(out.hard.interval, out.good.interval);
  out.good.interval = Math.max(out.good.interval, out.hard.interval + 1);
  out.easy.interval = Math.max(out.easy.interval, out.good.interval + 1);
  for (const grade of GRADES) out[grade].due = grade === "again" ? now + 60000 : addDays(now, out[grade].interval);
  return out;
}
function formatInterval(days) {
  if (!days) return "< 1 min";
  if (days < 31) return days + " d";
  if (days < 365) { const m = days / 30.4; return m.toLocaleString("pt-BR", {maximumFractionDigits: m < 10 ? 1 : 0}) + (m < 2 ? " mês" : " meses"); }
  const y = days / 365;
  return y.toLocaleString("pt-BR", {maximumFractionDigits: 1}) + (y < 2 ? " ano" : " anos");
}

// ---------- Catálogo ----------
function normalizeCard(row) { return {id: row[0].trim(), situacao: row[1].trim(), frase: row[2].trim(), audio: row[3].trim(), traducao: row[4].trim(), molde: row[5].trim(), alvo: row[6].trim(), tags: row[7].trim()}; }
function parseTSV(text, fileName) {
  const rows = [], errors = [], lines = text.replace(/^﻿/, "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], where = fileName + ":" + (i + 1);
    if (!line.trim() || line.startsWith("#")) continue;
    const row = line.split("\t");
    if (row.length !== 8) { errors.push(where + " tem " + row.length + " colunas; esperadas 8."); continue; }
    const card = normalizeCard(row);
    if (!/^K[123]-\d{4,}$/.test(card.id)) { errors.push(where + " tem ID inválido."); continue; }
    if (!card.situacao || !card.frase || !card.traducao) { errors.push(where + " tem campos essenciais vazios."); continue; }
    if (!/^\[(du|Sie|ihr|neutro|escrito)\]/.test(card.situacao)) { errors.push(where + " precisa começar com [du], [Sie], [ihr], [neutro] ou [escrito]."); continue; }
    const tags = parseTags(card.tags), missing = REQUIRED_TAGS.filter(k => !(tags[k] || []).length);
    if (missing.length) { errors.push(where + " sem tags: " + missing.join(", ") + "."); continue; }
    const first = k => (tags[k] || [])[0];
    if (!["Produktion", "Verstehen"].includes(first("Modus")) || !["1", "2", "3"].includes(first("Prio")) || !["1", "2", "3"].includes(first("Schicht")) || !["A1", "A2", "B1", "B2"].includes(first("Niveau"))) {
      errors.push(where + " tem valor inválido em Modus, Prio, Schicht ou Niveau."); continue;
    }
    rows.push(card);
  }
  return {rows, errors};
}
function openCatalogDB() {
  return new Promise(resolve => {
    if (!("indexedDB" in window)) { resolve(null); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { resolve(null); return; }
    req.onupgradeneeded = () => { const d = req.result; if (!d.objectStoreNames.contains("cards")) d.createObjectStore("cards", {keyPath: "id"}); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}
function readCatalog() {
  return new Promise(resolve => {
    if (!db) { resolve(safeRead(KEY_CATALOG_FALLBACK, [])); return; }
    const req = db.transaction("cards", "readonly").objectStore("cards").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}
function writeCatalog(rows) {
  return new Promise((resolve, reject) => {
    if (!db) {
      const merged = new Map(cards.map(c => [c.id, c]));
      rows.forEach(c => merged.set(c.id, c));
      if (safeWrite(KEY_CATALOG_FALLBACK, Array.from(merged.values()))) resolve(); else reject(new Error("Limite do armazenamento local."));
      return;
    }
    try {
      const tx = db.transaction("cards", "readwrite"), store = tx.objectStore("cards");
      rows.forEach(c => store.put(c));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Falha ao salvar catálogo."));
      tx.onabort = () => reject(tx.error || new Error("Importação interrompida."));
    } catch (e) { reject(e); }
  });
}
function refreshCards() {
  cards.sort((a, b) => a.id.localeCompare(b.id, "en", {numeric: true}));
  byId = new Map(cards.map(c => [c.id, c]));
  searchIndex.clear();
  for (const c of cards) searchIndex.set(c.id, normalizeSearch([c.id, c.situacao, c.frase, c.traducao, c.molde, c.alvo].join(" \u0001 ")));
  $("importCount").textContent = cards.length.toLocaleString("pt-BR") + " frases no catálogo";
}
async function importTSV(files) {
  if (!files.length) return;
  const parsed = [], errors = [], seen = new Set();
  for (const f of files) {
    let data;
    try { data = await f.text(); } catch (e) { errors.push("Não consegui ler " + f.name + "."); continue; }
    const result = parseTSV(data, f.name);
    errors.push(...result.errors);
    for (const c of result.rows) {
      if (seen.has(c.id)) errors.push("ID repetido entre os arquivos selecionados: " + c.id + ".");
      seen.add(c.id);
      parsed.push(c);
    }
  }
  if (errors.length) { setStatus("Importação cancelada. " + errors.slice(0, 3).join(" ") + (errors.length > 3 ? " Mais " + (errors.length - 3) + " erro(s)." : ""), "error"); return; }
  if (!parsed.length) { setStatus("Nenhuma frase encontrada nos arquivos.", "error"); return; }
  const oldCount = parsed.filter(c => byId.has(c.id)).length;
  try {
    await writeCatalog(parsed);
    const merged = new Map(cards.map(c => [c.id, c]));
    parsed.forEach(c => merged.set(c.id, c));
    cards = Array.from(merged.values());
    refreshCards();
    refreshAll();
    setStatus("Importadas " + parsed.length + " frases: " + (parsed.length - oldCount) + " novas e " + oldCount + " atualizadas. Progresso preservado.", "success");
  } catch (e) { setStatus("Falha ao salvar os lotes: " + e.message, "error"); }
}

// ---------- Navegação ----------
const VIEWS = ["home", "hub", "practice", "scenes", "conversa", "minhas", "pron", "reading", "escrita", "plan", "template", "activation", "exam", "catalog", "grammar", "coverage", "settings"];
function showView(view) {
  if (!VIEWS.includes(view)) return;
  if (session.active && view !== "practice") endSession();
  if (!$("contPlayer").hidden && view !== "practice") stopContinuous();
  if (speedOpen() && view !== "practice") stopSpeedRound();
  if (currentView === "reading" && view !== "reading") { saveBookPosition(); stopReadingAudio(); }
  if (currentView === "scenes" && view !== "scenes") { scene.token++; if (scene.clip) { scene.clip.stop(); scene.clip = null; } }
  if (currentView === "conversa" && view !== "conversa") convLeave();
  if (currentView !== view) stopAudio();
  currentView = view;
  all(".view").forEach(e => { e.hidden = e.id !== "view-" + view; e.classList.remove("vt"); });
  updateNav(view);
  if (view === "home") renderHome();
  if (view === "hub") renderHub();
  if (view === "practice") renderPracticeSetup();
  if (view === "plan") { renderPlan(); tutorRender(); }
  if (view === "scenes") renderScenes();
  if (view === "conversa") renderConversa();
  if (view === "minhas") renderMinhas();
  if (view === "pron") renderPron();
  if (view === "escrita") renderEscrita();
  if (view === "reading") renderReading();
  else if (typeof rdApplyFocus === "function") rdApplyFocus();
  if (view === "grammar") renderGrammar();
  if (view === "catalog") renderCatalog();
  if (view === "coverage") renderCoverage();
  if (view === "template") renderTemplateCount();
  if (view === "settings") renderSettings();
  window.scrollTo({top: 0});
}

// ---------- Início ----------
function countDue(mode) {
  const end = dayStart(dateAfter(1));
  let n = 0;
  for (const [id, p] of Object.entries(progress.cards)) {
    const r = p && p[mode];
    if (!r || r.due >= end) continue;
    const c = byId.get(id);
    if (!c || (mode === "production" && tag(c, "Modus") !== "Produktion")) continue;
    n++;
  }
  return n;
}
function newAvailableToday(plan = dayPlan()) {
  const left = Math.max(0, plan.newLimit - introducedToday());
  let unseen = 0;
  for (const c of cards) {
    if (unseen >= left) break;
    if (!progress.cards[c.id] && tag(c, "Modus") === "Produktion") unseen++;
  }
  return Math.min(left, unseen);
}
function pendingToday() { const t = todayLoad(); return t.dueProd + t.dueListen + t.fresh; }
/* Sequência: dias de plantão e pós-plantão sem estudo não quebram a sequência (nem contam). */
function streak() {
  let count = 0;
  const d = new Date();
  if (!progress.days[dateKey(d)]) d.setDate(d.getDate() - 1);
  for (let guard = 0; guard < 3650; guard++, d.setDate(d.getDate() - 1)) {
    const key = dateKey(d);
    if (progress.days[key]) count++;
    else if (!isRestDay(key)) break;
  }
  return count;
}
function bestStreak() {
  const keys = Object.keys(progress.days).filter(k => progress.days[k] > 0).sort();
  if (!keys.length) return 0;
  let best = 0, run = 0;
  const today = dateKey();
  for (let key = keys[0], i = 0; key <= today && i < 7300; key = shiftKey(key, 1), i++) {
    if (progress.days[key] > 0) best = Math.max(best, ++run);
    else if (!isRestDay(key)) run = 0;
  }
  return best;
}
function averageSeconds() {
  let reviews = 0, ms = 0;
  for (const s of Object.values(progress.dayStats || {})) { reviews += s.reviews || 0; ms += s.ms || 0; }
  return reviews >= 10 ? Math.min(60, Math.max(5, ms / reviews / 1000)) : 12;
}
function accuracy30() {
  let reviews = 0, again = 0;
  for (let i = 0; i < 30; i++) { const s = (progress.dayStats || {})[dateAfter(-i)]; if (s) { reviews += s.reviews || 0; again += s.again || 0; } }
  return {reviews, pct: reviews ? Math.round((reviews - again) / reviews * 100) : null};
}
function forecastCounts(days) {
  const counts = new Array(days).fill(0), todayStart = dayStart(dateKey());
  for (const p of Object.values(progress.cards)) {
    for (const mode of ["production", "listening"]) {
      const r = p && p[mode];
      if (!r) continue;
      const offset = Math.max(0, Math.floor((dayStart(dateKey(new Date(r.due))) - todayStart) / DAY_MS));
      if (offset < days) counts[offset]++;
    }
  }
  return counts;
}
function statTile(iconName, label, value, sub, tone) {
  return h("div", {class: "stat" + (tone ? " " + tone : "")},
    h("span", {class: "stat-icon"}, icon(iconName)),
    h("div", null, h("span", {class: "stat-label", text: label}), h("b", {text: value}), sub ? h("small", {text: sub}) : null));
}
function renderHome() {
  const load = todayLoad(), {dueProd, fresh} = load;
  renderShiftToday(load);
  renderHoje(load);
  const goal = nextCando();
  $("heroGoal").textContent = goal ? "Próxima meta: " + goal.text.toLowerCase() + " (" + Math.round(goal.pct * 100) + "%)" : "";
  const st = streak(), learned = cards.filter(studied).length;
  $("homeLearned").textContent = learned.toLocaleString("pt-BR") + (learned === 1 ? " frase" : " frases") + (cards.length ? " · " + (learned / cards.length * 100).toLocaleString("pt-BR", {maximumFractionDigits: 1}) + "% do catálogo" : "");
  for (const [target, key] of [["layerMetrics", "Schicht"], ["priorityMetrics", "Prio"]]) {
    const rows = [];
    for (let n = 1; n <= 3; n++) {
      const subset = cards.filter(c => tag(c, key) === String(n)), done = subset.filter(studied).length;
      rows.push(progressRow(key === "Schicht" ? "K" + n + (n === 1 ? " · base" : n === 2 ? " · intermediária" : " · avançada") : "Prioridade " + n, done, subset.length));
    }
    $(target).replaceChildren(...rows);
  }
  renderHeatmap();
  renderForecast();
  renderBackupReminder();
  const totalReviews = Object.values(progress.days).reduce((a, b) => a + Number(b || 0), 0);
  $("welcome").hidden = !!settings.welcomeDismissed || totalReviews > 0;
  updateNavBadges(dueProd + fresh, st);
}
const EXT_BACKUP_STALE = 3 * DAY_MS;
/* No computador, o aviso só aparece quando a cópia em outro disco falta, falha ou está velha; no navegador, lembra de exportar. */
function renderBackupReminder() {
  const show = (text, ext) => {
    $("backupReminder").hidden = !text;
    $("backupReminderText").textContent = text || "";
    $("reminderExport").hidden = !!ext;
    $("reminderExtChoose").hidden = !ext;
  };
  if (!hasAnyProgress() || progressReadFailed) { show(""); return; }
  if (window.satzDesktop && desktopInfo) {
    const ext = desktopInfo.extBackup || {};
    if (!ext.dir) { show("Seu backup automático só existe neste disco. Escolha uma pasta em outro disco (D: ou HD externo) para ele sobreviver a uma formatação.", true); return; }
    if (ext.error || !ext.available) { show("Não consegui copiar o backup para " + ext.dir + (ext.error ? " (" + ext.error.replace(/\.$/, "") + ")" : "") + ". Confira se o disco está conectado.", true); return; }
    // A cópia é feita logo depois de cada estudo; só avisa se houve estudo depois da última cópia e ela já tem dias.
    const lastStudy = Math.max(0, ...Object.keys(progress.days).map(d => dayStart(d)));
    show(lastStudy > ext.last && Date.now() - ext.last > EXT_BACKUP_STALE ? "A última cópia em outro disco é de " + new Date(ext.last).toLocaleDateString("pt-BR") + ". Abra as Configurações e use “Copiar agora”." : "", true);
    return;
  }
  const firstDay = Object.keys(progress.days).sort()[0];
  const last = Number(progress.lastBackupAt || 0) || (firstDay ? dayStart(firstDay) : Date.now());
  show(Date.now() - last < 7 * DAY_MS ? "" : "Lembrete semanal: exporte seu progresso e guarde uma cópia fora deste computador.");
}
async function chooseExtBackup() {
  const info = await window.satzDesktop.chooseExtBackupDir();
  if (!info) return;
  desktopInfo.extBackup = info;
  await flushAutoBackup();
  renderDesktopSettings();
  renderBackupReminder();
  const ext = desktopInfo.extBackup || {};
  if (ext.error) setStatus("A pasta foi escolhida, mas a cópia falhou: " + ext.error, "error");
  else setStatus(hasAnyProgress() ? "Cópia feita em " + ext.dir + ". Daqui para frente, ela é atualizada a cada estudo." : "Pasta escolhida: " + ext.dir + ". A primeira cópia sai depois do seu próximo estudo.", "success");
}

// ---------- Restaurar ao abrir vazio ----------
let restoreCandidate = null;
async function offerRestore() {
  restoreCandidate = null;
  $("restoreOffer").hidden = true;
  if (!window.satzDesktop || progressReadFailed || hasAnyProgress()) return;
  let list = [];
  try { list = await window.satzDesktop.findBackups(); } catch (e) { reportError("procurar backups", e.message, e.stack); return; }
  for (const b of list) {
    // Confere o conteúdo antes de oferecer: um arquivo ilegível ou vazio passa para o próximo.
    try {
      const parsed = JSON.parse(await window.satzDesktop.readBackup(b.id));
      const p = sanitizeProgress(parsed.progress || parsed);
      if (!hasAnyProgress(p)) continue;
      restoreCandidate = {...b, parsed, studied: Object.keys(p.cards).length};
      break;
    } catch (e) { continue; }
  }
  if (!restoreCandidate) return;
  const c = restoreCandidate;
  $("restoreOfferText").textContent = "O app abriu sem progresso, mas encontrei um backup de " + new Date(c.savedAt).toLocaleString("pt-BR")
    + " (" + c.studied.toLocaleString("pt-BR") + " frases estudadas) em " + c.dir + ". Quer restaurar?";
  $("restoreOffer").hidden = false;
}
async function restoreFromOffer() {
  const c = restoreCandidate;
  if (!c) return;
  $("restoreOffer").hidden = true;
  restoreCandidate = null;
  try {
    const n = await mergeIncoming(c.parsed, {settings: true});
    refreshAll();
    setStatus("Progresso restaurado do backup de " + new Date(c.savedAt).toLocaleDateString("pt-BR") + ": " + n.toLocaleString("pt-BR") + " frases.", "success");
  } catch (e) { setStatus("Não foi possível restaurar: " + e.message, "error"); }
}
function updateNavBadges(pending, st) {
  const badge = $("navDue");
  badge.textContent = pending > 99 ? "99+" : pending;
  badge.hidden = !pending;
  const hubBadge = $("navDueHub");
  if (hubBadge) { hubBadge.textContent = badge.textContent; hubBadge.hidden = !pending; }
  $("streakMini").textContent = st + (st === 1 ? " dia" : " dias");
}
function progressRow(label, done, total) {
  const bar = h("span");
  setWidth(bar, total ? done / total * 100 : 0);
  return h("div", {class: "progress-row"},
    h("span", {class: "pr-label", text: label}),
    h("span", {class: "pr-value", text: done.toLocaleString("pt-BR") + " / " + total.toLocaleString("pt-BR")}),
    h("div", {class: "track", role: "img", "aria-label": Math.round(total ? done / total * 100 : 0) + "%"}, bar));
}
function renderHeatmap() {
  const box = $("heatmap"), weeks = 26, today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - (weeks - 1) * 7);
  const cells = [];
  let max = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const v = d > today ? -1 : Number(progress.days[dateKey(d)] || 0);
    cells.push([d, v]);
    max = Math.max(max, v);
  }
  box.replaceChildren(...cells.map(([d, v]) => {
    const level = v < 0 ? "future" : v === 0 ? 0 : Math.min(4, Math.ceil(v / Math.max(4, max) * 4));
    const shift = v < 0 ? "normal" : dayType(dateKey(d));
    const label = v < 0 ? "" : (v || "Nenhuma") + " atividade" + (v === 1 ? "" : "s") + " · " + d.toLocaleDateString("pt-BR", {weekday: "short", day: "numeric", month: "short"})
      + (shift !== "normal" ? " · " + SHIFT_LABELS[shift].toLowerCase() : "");
    return h("span", {class: "hm l" + level + (v === 0 && (shift === "plantao" || shift === "pos") ? " hm-plantao" : ""), title: label || null});
  }));
  const active = cells.filter(([, v]) => v > 0).length;
  $("heatmapInfo").textContent = active ? active + (active === 1 ? " dia" : " dias") + " com estudo nas últimas " + weeks + " semanas" : "Seus dias de estudo aparecerão aqui.";
}
function renderForecast() {
  const counts = forecastCounts(7), max = Math.max(1, ...counts);
  $("forecast").replaceChildren(...counts.map((n, i) => {
    const d = new Date(dateAfter(i) + "T12:00:00"), bar = h("i");
    bar.style.height = Math.max(3, n / max * 100) + "%";
    return h("div", {class: "bar-col" + (i === 0 ? " today" : "")},
      h("b", {text: n}), bar,
      h("span", {text: i === 0 ? "Hoje" : d.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}));
  }));
}

// ---------- Meu plano ----------
function planSettings() {
  const p = settings.plan && typeof settings.plan === "object" ? settings.plan : {};
  const plan = {move: p.move || monthsAfter(24), b1: p.b1 || monthsAfter(10), b2: p.b2 || monthsAfter(16), fsp: p.fsp || monthsAfter(27)};
  if (!settings.plan || Object.keys(plan).some(k => plan[k] !== p[k])) { settings.plan = plan; saveSettings(); }
  return plan;
}
function planNumbers() {
  const plan = planSettings();
  const production = cards.filter(c => tag(c, "Modus") === "Produktion");
  const unseen = production.filter(c => !cardProgress(c.id) || !cardProgress(c.id).introducedAt);
  const generalUnseen = unseen.filter(c => !isMedical(c)).length, medUnseen = unseen.filter(isMedical).length;
  // Só contam os dias em que entram frases novas (plantão e pós-plantão valem 0; folga vale mais).
  const dGeneral = Math.max(1, studyWeightUntil(plan.b2)), dMed = Math.max(1, studyWeightUntil(plan.fsp));
  const needGeneral = generalUnseen ? Math.ceil(generalUnseen / dGeneral) : 0;
  const needMed = medUnseen ? Math.ceil(medUnseen / dMed) : 0;
  let recentFresh = 0;
  for (let i = 0; i < 14; i++) recentFresh += ((progress.dayStats || {})[dateAfter(-i)] || {}).fresh || 0;
  const pace = recentFresh / 14, limit = Math.max(0, Number(settings.newLimit) || 0);
  const finishDays = daysToFinish(unseen.length, limit);
  return {plan, production: production.length, unseen: unseen.length, generalUnseen, medUnseen, needGeneral, needMed, need: needGeneral + needMed, pace, limit, finishDays};
}
function renderPlan() {
  const n = planNumbers(), plan = n.plan;
  for (const k of ["move", "b1", "b2", "fsp"]) $("plan-" + k).value = plan[k];
  $("planMedShare").value = Math.round((Number(settings.medShare) || 0) * 100);
  $("planMedShareValue").textContent = Math.round((Number(settings.medShare) || 0) * 100) + "%";
  const onTrack = n.limit >= n.need;
  const finish = Number.isFinite(n.finishDays) ? formatDate(dateAfter(n.finishDays), {month: "long", year: "numeric"}) : "—";
  const perDay = scheduleActive() ? " por dia comum" : " por dia";
  $("planSummary").replaceChildren(
    statTile("target", "Novas por dia necessárias", n.need ? String(n.need) : "0", n.need ? n.needGeneral + " gerais até o B2 + " + n.needMed + " médicas até a FSP" + (scheduleActive() ? " (por dia comum; a escala já está descontada)" : "") : "Catálogo inteiro já iniciado", onTrack ? "" : "warm"),
    statTile("today", "Seu limite atual", n.limit + perDay, "Média real nos últimos 14 dias: " + n.pace.toLocaleString("pt-BR", {maximumFractionDigits: 1})),
    statTile("book", "Frases ainda não vistas", n.unseen.toLocaleString("pt-BR"), n.generalUnseen.toLocaleString("pt-BR") + " gerais · " + n.medUnseen.toLocaleString("pt-BR") + " médicas"),
    statTile("flame", "No ritmo atual, termina em", finish, onTrack ? "Dentro do plano" : "Atrás do plano: aumente as novas por dia", onTrack ? "" : "warm"));
  $("planApply").hidden = n.limit === n.need || !n.need;
  $("planApply").textContent = "Usar " + n.need + " novas" + perDay;
  renderTimeline(plan);
  renderSchedule();
  const open = unlockedLevels();
  const levels = ["A1", "A2", "B1", "B2"].map(lv => {
    const subset = cards.filter(c => tag(c, "Niveau") === lv && !isMedical(c) && !nwLocked(c));
    return progressRow("Nível " + lv + (settings.levelGate ? (open.has(lv) ? "" : " · bloqueado") : ""), subset.filter(studied).length, subset.length);
  });
  const med = cards.filter(isMedical);
  levels.push(progressRow("Alemão médico (FSP)", med.filter(studied).length, med.length));
  $("planLevels").replaceChildren(...levels);
  renderNicosWeg();
  renderCando();
  renderDiagnosis();
  renderDiktatStats();
}
function renderNicosWeg() {
  const select = $("nwChapter");
  if (!select.options.length) {
    const opts = names => names.map((name, i) => {
      const n = names === NW2_CHAPTERS ? NW_A2_BASE + i : i;
      return h("option", {value: String(n), text: (i ? "Capítulo " + i : "Início") + " · " + name});
    });
    select.append(h("optgroup", {label: "Nicos Weg A1"}, ...opts(NW_CHAPTERS)), h("optgroup", {label: "Nicos Weg A2"}, ...opts(NW2_CHAPTERS)));
  }
  select.value = String(Number.isFinite(Number(settings.nwChapter)) ? settings.nwChapter : 18);
  const nw = cards.filter(c => nwChapter(c) !== null);
  const open = nw.filter(c => !nwLocked(c)), seen = open.filter(c => cardProgress(c.id) && cardProgress(c.id).introducedAt).length;
  const later = nw.length - open.length;
  $("nwInfo").textContent = open.length + " frases liberadas, " + seen + " já apresentadas" + (later ? " · " + later + " esperam os próximos capítulos." : " · todos os capítulos liberados.");
}
function renderTimeline(plan) {
  const today = dateKey(), points = [["Hoje", today, "now"], ["B1", plan.b1, "b1"], ["Certificado B2", plan.b2, "b2"], ["Mudança", plan.move, "move"], ["FSP", plan.fsp, "fsp"]]
    .filter(p => p[1]).sort((a, b) => a[1].localeCompare(b[1]));
  const start = dayStart(points[0][1]), end = dayStart(points[points.length - 1][1]), span = Math.max(1, end - start);
  const line = h("div", {class: "tl-line"});
  const fill = h("div", {class: "tl-fill"});
  setWidth(fill, (dayStart(today) - start) / span * 100);
  line.append(fill);
  // Rótulos a menos de ~110 px um do outro alternam em cima/embaixo (16% numa tela larga, bem mais no celular).
  const minGap = Math.max(16, 11000 / Math.max(240, $("planTimeline").clientWidth || 900));
  let prevPos = -100, flipped = false;
  for (const [label, key, cls] of points) {
    const pos = (dayStart(key) - start) / span * 100;
    flipped = pos - prevPos < minGap ? !flipped : false;
    const mark = h("div", {class: "tl-mark tl-" + cls + (flipped ? " tl-flip" : "")}, h("i"), h("b", {text: label}), h("span", {text: formatDate(key, {month: "short", year: "numeric"})}));
    mark.style.left = pos + "%";
    line.append(mark);
    prevPos = pos;
  }
  $("planTimeline").replaceChildren(line);
}

// ---------- Filtros ----------
function buildFilters(kind) {
  const box = $(kind + "Filters");
  box.replaceChildren();
  for (const [key, label] of FILTER_KEYS) {
    const id = kind + "Filter" + key;
    const values = [...new Set(cards.flatMap(c => tagValues(c, key)))].sort((a, b) => tagLabel(key, a).localeCompare(tagLabel(key, b), "pt-BR", {numeric: true}));
    const select = h("select", {id}, new Option("Todos", ""), values.map(v => new Option(tagLabel(key, v), v)));
    select.value = filters[kind][key] || "";
    select.addEventListener("change", () => {
      filters[kind][key] = select.value;
      if (kind === "catalog") { catalogPage = 0; renderCatalog(); }
      else renderPracticeSetup();
    });
    box.append(h("div", {class: "field"}, h("label", {for: id, text: label}), select));
  }
}
function syncFilterSelects(kind) {
  for (const [key] of FILTER_KEYS) { const s = $(kind + "Filter" + key); if (s) s.value = filters[kind][key] || ""; }
}
function activeFilterCount(kind) { return Object.values(filters[kind]).filter(Boolean).length; }
function matches(card, selected) { for (const [key, val] of Object.entries(selected)) if (val && !hasTag(card, key, val)) return false; return true; }
function themeChips(kind, onChange) {
  const counts = new Map();
  for (const c of cards) for (const t of tagValues(c, "Thema")) counts.set(t, (counts.get(t) || 0) + 1);
  const rank = t => { const i = FEATURED_THEMES.indexOf(t); return i < 0 ? 99 : i; };
  const themes = [...counts.keys()].sort((a, b) => rank(a) - rank(b) || counts.get(b) - counts.get(a));
  const current = filters[kind].Thema || "";
  const chip = (value, label) => h("button", {class: "chip" + (FEATURED_THEMES.includes(value) ? " chip-featured" : ""), "aria-pressed": String(current === value), onclick: () => {
    filters[kind].Thema = value; syncFilterSelects(kind); onChange();
  }}, label);
  return [chip("", "Todos"), ...themes.map(t => chip(t, tagLabel("Thema", t)))];
}

// ---------- Treino: fila ----------
function sortNew(a, b) {
  const aLayer = Number(tag(a, "Schicht")), bLayer = Number(tag(b, "Schicht")), aPrio = Number(tag(a, "Prio")), bPrio = Number(tag(b, "Prio"));
  const byIdOrder = a.id.localeCompare(b.id, "en", {numeric: true});
  if (settings.newOrder === "priority") return aPrio - bPrio || aLayer - bLayer || byIdOrder;
  if (settings.newOrder === "id") return byIdOrder;
  return aLayer - bLayer || aPrio - bPrio || byIdOrder;
}
/* Modos: produção, escuta e ditado (escuta em que você escreve a frase exata; usa o agendamento da escuta). */
function setSessionMode(mode) {
  const dictation = mode === "dictation", real = dictation ? "listening" : mode;
  if (session.active && (real !== session.mode || dictation !== !!session.dictation)) endSession();
  session.mode = real;
  session.dictation = dictation;
  $("modeProduction").setAttribute("aria-pressed", String(real === "production"));
  $("modeListening").setAttribute("aria-pressed", String(real === "listening" && !dictation));
  $("modeDictation").setAttribute("aria-pressed", String(dictation));
  $("typingTitle").textContent = "Responder digitando";
  $("typingHint").textContent = "Compara sua resposta palavra por palavra. Aceita ae/oe/ue/ss no lugar de ä/ö/ü/ß.";
  if (currentView === "practice") renderPracticeSetup();
}
function buildSessionQueue() {
  const mode = session.mode;
  const eligible = cards.filter(c => (mode === "listening" || tag(c, "Modus") === "Produktion") && matches(c, filters.session));
  const due = [], known = [], unseen = [], endOfToday = dayStart(dateAfter(1));
  for (const c of eligible) {
    const p = modeProgress(c.id, mode);
    if (p) { if (p.due < endOfToday) due.push(c); }
    else if (cardProgress(c.id) && cardProgress(c.id).introducedAt) known.push(c);
    else unseen.push(c);
  }
  // Com teto no dia (plantão, acúmulo pós-plantão ou limite de revisões), vêm primeiro as de menor chance de lembrar.
  const plan = dayPlan(), reviewLimit = reviewsLeftToday(plan);
  const now = Date.now();
  if (due.length > reviewLimit) due.sort((a, b) => retrievabilityNow(modeProgress(a.id, mode), now) - retrievabilityNow(modeProgress(b.id, mode), now));
  else due.sort((a, b) => modeProgress(a.id, mode).due - modeProgress(b.id, mode).due);
  known.sort(sortNew);
  if (plan.type === "plantao" || plan.type === "pos") known.length = 0;
  const newLimit = mode === "production" ? Math.max(0, freshLimitToday(plan) + session.extraNew - introducedToday()) : 0;
  // Progressão por nível: sem filtro de nível ou tema, as novas vêm só dos níveis já abertos.
  const allowed = orderNew(unseen, settings.levelGate && !filters.session.Niveau && !filters.session.Thema);
  let fresh;
  const share = Math.min(.5, Math.max(0, Number(settings.medShare) || 0));
  if (share && !filters.session.Thema && newLimit) {
    const med = unseen.filter(isMedical), general = allowed.filter(c => !isMedical(c));
    const nMed = Math.min(med.length, Math.round(newLimit * share));
    fresh = [...general.slice(0, newLimit - nMed), ...med.slice(0, nMed)];
    if (fresh.length < newLimit) fresh.push(...med.slice(nMed, nMed + newLimit - fresh.length));
  } else fresh = allowed.slice(0, newLimit);
  return {due: due.slice(0, reviewLimit).map(c => c.id), known: known.map(c => c.id), fresh: fresh.map(c => c.id), unseenLeft: allowed.length,
    held: Math.max(0, due.length - reviewLimit), plan};
}
/* Ordem das frases novas (a fila do treino e o áudio guardado no celular usam a mesma): próprias primeiro, depois o reforço
   do Nicos Weg na ordem do curso, depois o resto. Ordena `unseen` e tira dele os capítulos futuros; devolve as permitidas. */
function orderNew(unseen, gated) {
  const nwRank = c => { const ch = nwChapter(c); return ch === null ? 99 : ch; };
  unseen.sort((a, b) => isMine(b) - isMine(a) || nwRank(a) - nwRank(b) || sortNew(a, b));
  for (let i = unseen.length - 1; i >= 0; i--) if (nwLocked(unseen[i])) unseen.splice(i, 1);
  const open = gated ? unlockedLevels() : null;
  // O reforço do curso já liberado pelo capítulo (“Estou no capítulo”) não espera a progressão por nível.
  return open ? unseen.filter(c => isMine(c) || nwChapter(c) !== null || open.has(tag(c, "Niveau"))) : unseen;
}
/* Em plantão e pós-plantão, a sessão vazia não puxa frases novas sozinha. */
function restrictedToday(plan = dayPlan()) { return plan.type === "plantao" || plan.type === "pos"; }
function addExtraReviews(n) {
  if (session.extraReviewsDay !== dateKey()) { session.extraReviewsDay = dateKey(); session.extraReviews = 0; }
  session.extraReviews += n;
}
function leechCards(mode) {
  return cards.filter(c => (mode === "listening" || tag(c, "Modus") === "Produktion") && isLeech(c, mode))
    .sort((a, b) => (modeProgress(b.id, mode).lapses || 0) - (modeProgress(a.id, mode).lapses || 0));
}
function renderPracticeSetup() {
  $("themeChips").replaceChildren(...themeChips("session", renderPracticeSetup));
  const n = activeFilterCount("session");
  $("sessionFilterCount").textContent = n ? n + (n === 1 ? " ativo" : " ativos") : "";
  $("sessionFilterCount").hidden = !n;
  $("typingMode").checked = !!settings.typing;
  $("typingRow").hidden = session.mode !== "production";
  $("presentNew").checked = settings.presentNew !== false;
  $("presentRow").hidden = session.mode !== "production";
  $("dictationInfo").hidden = !session.dictation;
  $("speedStart").hidden = session.mode !== "production";
  const leeches = leechCards(session.mode);
  $("leechBox").hidden = !leeches.length;
  $("leechButton").textContent = "Treinar frases difíceis (" + leeches.length + ")";
  $("levelInfo").textContent = settings.levelGate ? levelSummary().text : "Progressão por nível desligada: as novas seguem só a ordem de prioridade.";
  const q = buildSessionQueue(), total = q.due.length + q.known.length + q.fresh.length;
  const parts = [];
  if (q.due.length) parts.push(q.due.length + (q.due.length === 1 ? " revisão" : " revisões"));
  if (q.known.length) parts.push(q.known.length + " em aprendizado");
  if (q.fresh.length) parts.push(q.fresh.length + (q.fresh.length === 1 ? " nova" : " novas"));
  const shift = q.plan.type !== "normal" || q.plan.recovery ? (q.plan.recovery && q.plan.type === "normal" ? "Depois do plantão" : SHIFT_LABELS[q.plan.type]) + " · " : "";
  $("sessionPreview").textContent = shift + (total ? "Esta sessão: " + parts.join(" · ") + " · cerca de " + Math.max(1, Math.ceil(total * averageSeconds() / 60)) + " min" : "Nada pendente com esses filtros hoje.")
    + (q.held ? " · " + q.held + (q.held === 1 ? " revisão fica" : " revisões ficam") + " para os próximos dias" : "");
  $("startSession").textContent = total ? "Iniciar sessão" : (session.mode === "production" && q.unseenLeft && !restrictedToday(q.plan) ? "Estudar mais 5 novas" : "Iniciar sessão");
}
/* Etapa inicial de cada cartão na escada: apresentar (nova) → lacuna (primeira tentativa ou reaprender) → produzir. */
function initialStep(id) {
  if (session.mode !== "production") return "produce";
  const card = byId.get(id), p = modeProgress(id, "production"), introduced = cardProgress(id) && cardProgress(id).introducedAt;
  const cloze = card && clozeParts(card) ? "cloze" : "produce";
  if (!p && !introduced) return settings.presentNew !== false ? "present" : cloze;
  if (!p) return cloze;
  return p.lastGrade === "again" ? cloze : "produce";
}
function startSession(options = {}) {
  if (!cards.length) { setStatus("O catálogo está vazio. Importe um lote em Configurações.", "error"); return; }
  let queue;
  session.leech = !!options.leech;
  session.label = options.label || "";
  if (options.custom) queue = options.custom.filter(id => byId.has(id));
  else if (session.leech) queue = leechCards(session.mode).slice(0, 20).map(c => c.id);
  else {
    let q = buildSessionQueue();
    if (!q.due.length && !q.known.length && !q.fresh.length && session.mode === "production" && q.unseenLeft && !restrictedToday(q.plan)) { session.extraNew += 5; q = buildSessionQueue(); }
    queue = [...q.due, ...q.known, ...q.fresh];
  }
  $("sessionDone").hidden = true;
  $("contPlayer").hidden = true;
  if (!queue.length) { showSessionEmpty(options.custom || session.leech ? null : dayPlan()); return; }
  Object.assign(session, {active: true, queue, steps: new Map(queue.map(id => [id, initialStep(id)])), card: null, revealed: false, done: 0, failed: 0, fresh: 0,
    grades: {again: 0, hard: 0, good: 0, easy: 0}, startedAt: Date.now(), undo: [], diktat: null, gapPick: new Map()});
  document.body.classList.add("focus");
  $("focusBar").hidden = false;
  $("sessionStage").hidden = false;
  $("sessionKind").textContent = session.label || (session.leech ? "Frases difíceis" : session.mode === "production" ? "Produção" : session.dictation ? "Ditado" : "Escuta");
  window.scrollTo({top: 0});
  renderSessionCard();
}
/* Ditado fora da fila do dia: frases já estudadas, das menos revisadas na escuta para as mais revisadas. */
function startExtraDictation() {
  const pool = cards.filter(c => cardProgress(c.id) && cardProgress(c.id).introducedAt && matches(c, filters.session));
  if (!pool.length) { setStatus("Estude algumas frases no treino de produção antes do ditado extra.", "error"); return; }
  const ids = shuffled(pool).sort((a, b) => ((modeProgress(a.id, "listening") || {}).reviews || 0) - ((modeProgress(b.id, "listening") || {}).reviews || 0)).slice(0, 10).map(c => c.id);
  startSession({custom: ids, label: "Ditado extra"});
}
function showSessionEmpty(plan) {
  const other = session.mode === "production" ? "listening" : "production";
  const held = plan ? buildSessionQueue().held : 0;
  if (plan && (restrictedToday(plan) || held)) {
    fill($("sessionDone"),
      h("div", {class: "summary-icon"}, icon("check", 30)),
      h("h2", {text: held ? (plan.type === "plantao" ? "Meta do plantão cumprida" : "Meta de hoje cumprida") : "Sessão em dia"}),
      h("p", {class: "muted", text: held
        ? held + (held === 1 ? " revisão ficou" : " revisões ficaram") + " para os próximos dias, começando pelas mais urgentes. " + (plan.type === "plantao" ? "Bom plantão!" : "Descanse.")
        : "Nada urgente hoje. " + (plan.type === "plantao" ? "Bom plantão!" : "Aproveite para descansar.")}),
      h("div", {class: "row center"},
        held ? h("button", {class: "primary", onclick: () => { addExtraReviews(10); startSession(); }}, "Fazer mais 10 revisões") : null,
        session.mode === "production" ? h("button", {onclick: () => { session.extraNew += 5; startSession(); }}, "Estudar 5 novas mesmo assim") : null,
        h("button", {onclick: () => showView("home")}, "Voltar ao início")));
    $("sessionDone").hidden = false;
    return;
  }
  fill($("sessionDone"),
    h("div", {class: "summary-icon"}, icon("check", 30)),
    h("h2", {text: "Sessão em dia"}),
    h("p", {class: "muted", text: "Não há cartões pendentes com esses filtros hoje."}),
    h("div", {class: "row center"},
      session.dictation ? h("button", {class: "primary", onclick: startExtraDictation}, "Ditar 10 frases já estudadas") : null,
      h("button", {class: session.dictation ? "" : "primary", onclick: () => { setSessionMode(other); startSession(); }}, other === "listening" ? "Treinar escuta" : "Treinar produção"),
      h("button", {onclick: () => showView("scenes")}, "Praticar uma cena"),
      h("button", {onclick: () => showView("template")}, "Praticar um molde")));
  $("sessionDone").hidden = false;
}

// ---------- Treino: cartão ----------
function situationNodes(card) {
  const {text} = splitSituation(card.situacao), de = germanSituation(card);
  if (!de) return [card.tags.includes("Thema::Fachbegriffe") ? genderize(text) : text];
  const pt = h("span", {class: "sit-pt", hidden: true, text: text});
  return [h("span", {lang: "de", text: de}), " ", h("button", {class: "quiet small sit-toggle", type: "button", onclick: e => { pt.hidden = !pt.hidden; e.currentTarget.textContent = pt.hidden ? "ver em português" : "ocultar"; }}, "ver em português"), pt];
}
function renderSessionCard() {
  const id = session.queue[0];
  const card = byId.get(id) || null;
  if (!card) { session.queue.shift(); if (session.queue.length) renderSessionCard(); else finishSession(); return; }
  session.card = card;
  session.revealed = false;
  session.shownAt = Date.now();
  session.step = session.steps.get(card.id) || "produce";
  if (session.step === "cloze" && !clozeParts(card)) session.step = "produce";
  const listening = session.mode === "listening", present = session.step === "present", cloze = session.step === "cloze";
  const typing = (session.dictation || (!!settings.typing && !listening)) && !present;
  session.cardVoice = voiceForSession(card);
  const {reg} = splitSituation(card.situacao);
  const prev = modeProgress(card.id, session.mode);
  $("cardRegister").replaceChildren(listening ? h("span", {class: "reg reg-listen"}, "Escuta" + (session.cardVoice ? " · " + voiceLabel(session.cardVoice) : "")) : regChip(reg) || "");
  $("cardBadges").replaceChildren(...[
    "K" + tag(card, "Schicht"), tag(card, "Niveau"), tagLabel("Thema", tag(card, "Thema")), tag(card, "Modus") === "Verstehen" ? "Compreensão" : ""
  ].filter(v => v && v !== "K").map(v => h("span", {class: "tag", text: v})));
  const state = present ? ["new", "Nova · conheça"] : cloze ? ["learning", prev ? "Reaprender · lacuna" : "Lacuna"] : !prev ? ["new", "Nova"]
    : isLeech(card, session.mode) ? ["leech", "Difícil"] : prev.lastGrade === "again" ? ["learning", "Reaprender"] : ["review", "Revisão"];
  $("cardState").className = "state s-" + state[0];
  $("cardState").textContent = state[1];
  if (listening) $("cardPrompt").textContent = session.dictation ? "Ouça e escreva exatamente o que ouviu: maiúsculas, ä, ö, ü e ß contam." : "Ouça e tente entender antes de revelar.";
  else fill($("cardPrompt"), ...situationNodes(card));
  $("cardPrompt").classList.toggle("listen-prompt", listening);
  $("clozeBox").hidden = !cloze;
  if (cloze) fill($("clozeBox"), h("span", {class: "cloze-label", text: "Complete e diga a frase inteira:"}), h("p", {class: "cloze-text", lang: "de"}, ...moldNodes(clozeParts(card).display)));
  $("listenPad").hidden = !listening;
  $("typingBox").hidden = !typing;
  const input = $("typingInput");
  input.value = "";
  input.readOnly = false;
  $("umlautKeys").hidden = !typing;
  input.placeholder = listening ? "Escreva o que ouviu e pressione Enter · Ctrl+Espaço repete" : cloze ? "Digite o que falta (ou a frase inteira) e pressione Enter" : "Escreva em alemão e pressione Enter";
  $("typingDiff").hidden = true;
  $("shadowPanel").hidden = true;
  $("cardAnswerBox").hidden = true;
  $("gradeRow").hidden = true;
  $("rubric").hidden = true;
  $("reasonRow").hidden = true;
  $("presentActions").hidden = !present;
  $("revealCard").hidden = present;
  $("shadowButton").hidden = true;
  setSpeechState(present || session.dictation ? "hidden" : "idle");
  const total = session.done + session.queue.length;
  $("cardCounter").textContent = (session.done + 1) + " de " + total;
  setWidth($("sessionBar"), total ? session.done / total * 100 : 0);
  $("undoRating").disabled = !session.undo.length;
  const flash = $("flashCard");
  flash.classList.remove("enter");
  void flash.offsetWidth;
  flash.classList.add("enter");
  if (present) showAnswer(card, null);
  if (typing) input.focus(); else flash.focus({preventScroll: true});
  if (listening || present) speakSession();
  const next = byId.get(session.queue[1]);
  if (next) preloadCard(next, voiceForSession(next, true));
}
function escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
const PT_SHORT = new Set(["em", "da", "de", "do", "no", "na", "se", "um", "ao", "as", "os", "ou", "eu", "tu", "me", "te", "já", "é", "e", "o", "a", "só", "há", "lá"]);
const PT_STOP = new Set(["com", "sem", "para", "por", "que", "não", "uma", "uns", "dos", "das", "nos", "nas", "pelo", "pela", "como", "mais", "muito", "após", "antes", "depois", "quando", "isso", "esse", "essa", "este", "esta", "aqui", "verbo", "forma", "fim", "primeira", "posição", "dativo", "acusativo", "genitivo", "nominativo", "plural", "singular", "feminino", "masculino", "neutro", "rege", "pede", "infinitivo", "particípio", "separável", "modo", "tempo", "sujeito", "objeto", "artigo", "formal", "informal", "termo", "leigo", "técnico"]);
function targetWords(card) {
  const words = new Set();
  for (const w of (card.alvo || "").match(/[\p{L}]+/gu) || []) {
    const lower = w.toLocaleLowerCase("de");
    if (lower.length < 2 || PT_SHORT.has(lower) || PT_STOP.has(lower)) continue;
    words.add(lower);
  }
  return words;
}
function answerNodes(card) {
  if (card.tags.includes("Thema::Fachbegriffe")) return genderize(card.frase);
  const text = card.frase, len = text.length;
  const slot = new Array(len).fill(false), target = new Array(len).fill(false), gender = new Array(len).fill("");
  const re = moldRegex(card), m = re && text.match(re);
  if (m && m.indices) for (let i = 1; i < m.length; i++) { const [s, e] = m.indices[i] || []; if (s != null) for (let k = s; k < e; k++) slot[k] = true; }
  const words = targetWords(card);
  if (words.size) for (const w of text.matchAll(/[\p{L}]+/gu)) if (words.has(w[0].toLocaleLowerCase("de"))) for (let k = w.index; k < w.index + w[0].length; k++) target[k] = true;
  const g = genderFromTarget(card);
  if (g) for (const w of text.matchAll(new RegExp("(?:\\b(?:der|die|das|dem|den|des|ein|eine|einen|einem|einer)\\s+)?" + escapeRegExp(g.word), "gu"))) for (let k = w.index; k < w.index + w[0].length; k++) gender[k] = g.cls;
  const out = [];
  let i = 0;
  while (i < len) {
    let j = i;
    while (j < len && slot[j] === slot[i] && target[j] === target[i] && gender[j] === gender[i]) j++;
    const piece = text.slice(i, j);
    let el = piece;
    if (gender[i]) el = h("span", {class: "gender " + gender[i]}, piece);
    else if (target[i]) el = h("mark", null, piece);
    if (slot[i]) el = h("span", {class: "slot"}, el);
    out.push(el);
    i = j;
  }
  return out;
}
function moldNodes(molde) {
  const parts = molde.split("___"), out = [];
  parts.forEach((p, i) => { out.push(p); if (i < parts.length - 1) out.push(h("span", {class: "blank", "aria-label": "lacuna"})); });
  return out;
}
function normWord(w) {
  return w.toLocaleLowerCase("de").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^\p{L}\p{N}]/gu, "");
}
function similarity(a, b) {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({length: n + 1}, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}
function wordsMatch(a, b) { return a === b || (a.length >= 5 && b.length >= 4 && similarity(a, b) >= .8); }
function wordDiff(expected, typed) {
  const a = expected.split(/\s+/).filter(w => normWord(w)), b = typed.split(/\s+/).filter(w => normWord(w));
  const A = a.map(normWord), B = b.map(normWord);
  const dp = Array.from({length: a.length + 1}, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = wordsMatch(A[i], B[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0, near = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && wordsMatch(A[i], B[j])) {
      if (A[i] === B[j]) ops.push(["eq", a[i], b[j]]); else { ops.push(["near", a[i], b[j]]); near++; }
      i++; j++;
    } else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) { ops.push(["del", b[j]]); j++; }
    else { ops.push(["ins", a[i]]); i++; }
  }
  return {ops, correct: dp[0][0], near, total: a.length};
}
/* Na lacuna, uma resposta curta é comparada só com o que falta; uma resposta longa, com a frase inteira. */
function expectedAnswer(card, typed) {
  if (session.step !== "cloze") return card.frase;
  const parts = clozeParts(card);
  if (!parts) return card.frase;
  const missing = parts.fillers.join(" "), typedWords = typed.split(/\s+/).filter(Boolean).length;
  return typedWords <= missing.split(/\s+/).length + 2 ? missing : card.frase;
}
function renderAnswerDiff(typed, source) {
  const box = $("typingDiff");
  $("typingInput").readOnly = true;
  $("umlautKeys").hidden = true;
  const heard = source === "voice";
  if (!typed) { fill(box, h("p", {class: "muted", text: heard ? "Não consegui entender a gravação. Tente falar mais perto do microfone." : "Você não digitou uma resposta."})); box.hidden = false; return; }
  if (session.dictation && !heard) { renderDiktatDiff(box, session.card.frase, typed); return; }
  const {ops, correct, total} = wordDiff(heard ? session.card.frase : expectedAnswer(session.card, typed), typed);
  const perfect = correct === total && !ops.some(o => o[0] === "del" || o[0] === "near");
  const line = h("p", {class: "diff-line", lang: "de"});
  ops.forEach(([type, word, got], k) => {
    if (k) line.append(" ");
    if (type === "eq") line.append(word);
    else if (type === "near") line.append(h("span", {class: "near", title: (heard ? "O app ouviu: " : "Você escreveu: ") + got}, word));
    else line.append(h(type, {title: type === "ins" ? "faltou" : "não está na frase do catálogo"}, word));
  });
  fill(box,
    h("div", {class: "diff-head"}, h("span", {text: heard ? "O app ouviu" : "Sua resposta"}), h("span", {class: "diff-score " + (perfect ? "ok" : "partial"), text: perfect ? "Idêntica" : correct + " de " + total + " palavras"})),
    heard ? h("p", {class: "heard", lang: "de", text: "“" + typed + "”"}) : null,
    line,
    perfect ? null : h("p", {class: "diff-note", text: heard
      ? "A transcrição automática é só uma dica: ela pode errar termos técnicos. Outra formulação natural também vale."
      : "Outra formulação natural também pode estar certa. Avalie o sentido, não só as palavras."}));
  box.hidden = false;
}
/* Mostra a resposta completa (usada ao revelar e na apresentação de frases novas). */
function showAnswer(card, answer) {
  if (answer && answer.source === "voice") renderAnswerDiff(answer.text, "voice");
  else if (answer && answer.source === "typed") renderAnswerDiff(answer.text, "typed");
  $("cardAnswer").replaceChildren(...answerNodes(card));
  $("cardTranslation").textContent = card.traducao;
  $("moldRow").hidden = !card.molde;
  $("cardMold").replaceChildren(...(card.molde ? moldNodes(card.molde) : []));
  $("targetRow").hidden = !card.alvo;
  $("cardTarget").textContent = card.alvo;
  if (session.mode === "listening" || session.step === "present" && germanSituation(card)) {
    const {reg, text} = splitSituation(card.situacao);
    $("cardSituation").replaceChildren(regChip(reg) || "", " ", text);
    $("situationRow").hidden = false;
  } else $("situationRow").hidden = true;
  fill($("cardErro"), mineErrorNode(card));
  fill($("grammarChips"), ...grammarChips(card));
  $("genderLegend").hidden = !(settings.genderColors && (card.tags.includes("Thema::Fachbegriffe") || genderFromTarget(card)));
  $("cardAnswerBox").hidden = false;
}
function revealCard(answer) {
  const card = session.card;
  if (!card || session.revealed || session.step === "present") return;
  session.revealed = true;
  const typed = !$("typingBox").hidden ? {source: "typed", text: $("typingInput").value.trim()} : null;
  showAnswer(card, answer && answer.source === "voice" ? answer : typed);
  const preview = scheduleAll(modeProgress(card.id, session.mode), Date.now());
  for (const g of GRADES) $("ivl-" + g).textContent = formatInterval(preview[g].interval);
  renderReasonChips();
  $("reasonRow").hidden = false;
  $("gradeRow").hidden = false;
  $("rubric").hidden = !showRubric();
  $("revealCard").hidden = true;
  $("shadowButton").hidden = !(usesNeural(card) && canRecord());
  setSpeechState("hidden");
  $("flashCard").focus({preventScroll: true});
  if (session.mode === "production" && !(answer && answer.source === "voice")) speakSession();
}
/* Depois de conhecer a frase nova: ela volta daqui a pouco para o primeiro teste (lacuna ou frase inteira). */
function continuePresentation(skip = false) {
  const card = session.card;
  if (!card || session.step !== "present") return;
  const now = Date.now(), day = dateKey(), record = progress.cards[card.id] || {};
  if (!record.introducedAt) {
    record.introducedAt = now;
    progress.cards[card.id] = record;
    progress.dayStats = progress.dayStats || {};
    const stats = progress.dayStats[day] || (progress.dayStats[day] = {reviews: 0, again: 0, fresh: 0, ms: 0});
    stats.fresh++;
    session.fresh++;
    saveProgress([card.id]);
  }
  session.steps.set(card.id, skip ? "produce" : (clozeParts(card) ? "cloze" : "produce"));
  session.queue.shift();
  session.queue.splice(Math.min(skip ? 5 : 3, session.queue.length), 0, card.id);
  session.done++;
  renderSessionCard();
}
function rateCard(grade) {
  const card = session.card;
  if (!card || !session.revealed || !GRADES.includes(grade)) return;
  const id = card.id, mode = session.mode, now = Date.now(), day = dateKey();
  progress.dayStats = progress.dayStats || {};
  progress.reviewDays = progress.reviewDays || {};
  const logId = now + "-" + id + "-" + mode;
  const why = grade === "again" || grade === "hard" ? selectedReasons() : [];
  session.undo.push({id, day, logId, record: progress.cards[id] ? JSON.stringify(progress.cards[id]) : null, days: progress.days[day], reviewDays: progress.reviewDays[day],
    dayStats: progress.dayStats[day] ? {...progress.dayStats[day]} : null, errorStats: {...(progress.errorStats || {})}, steps: new Map(session.steps),
    queue: session.queue.slice(), done: session.done, failed: session.failed, fresh: session.fresh, grades: {...session.grades}});
  if (session.undo.length > 30) session.undo.shift();
  const record = progress.cards[id] || {}, prev = record[mode] || null;
  const next = scheduleAll(prev, now)[grade];
  const isFresh = !record.introducedAt;
  const ms = Math.min(60000, Math.max(0, now - session.shownAt));
  if (isFresh) record.introducedAt = now;
  record[mode] = {interval: next.interval, ease: easeFromDifficulty(next.difficulty), stability: next.stability, difficulty: next.difficulty, due: next.due, lastGrade: grade,
    reviews: Number(prev?.reviews || 0) + 1, lapses: Number(prev?.lapses || 0) + (grade === "again" && prev && prev.lastGrade !== "again" ? 1 : 0), lastReviewed: now};
  if (why.length) recordReasons(record[mode], why); else if (prev && prev.why && grade !== "again") record[mode].why = prev.why;
  progress.cards[id] = record;
  progress.days[day] = Number(progress.days[day] || 0) + 1;
  if (prev) progress.reviewDays[day] = Number(progress.reviewDays[day] || 0) + 1;
  const stats = progress.dayStats[day] || (progress.dayStats[day] = {reviews: 0, again: 0, fresh: 0, ms: 0});
  stats.reviews++;
  if (grade === "again") stats.again++;
  if (isFresh) stats.fresh++;
  stats.ms += ms;
  revlogAdds.push({id: logId, cardId: id, mode, g: GRADE_NUM[grade], ts: now, ms, ...(why.length ? {why} : {})});
  saveProgress([id]);
  session.grades[grade]++;
  if (isFresh) session.fresh++;
  session.queue.shift();
  session.done++;
  if (grade === "again") {
    session.failed++;
    session.steps.set(id, mode === "production" && clozeParts(card) ? "cloze" : "produce");
    session.queue.splice(Math.min(2, session.queue.length), 0, id);
  } else session.steps.set(id, "produce");
  if (grade !== "again" && !prev) checkAchievements();
  if (session.queue.length) renderSessionCard(); else finishSession();
}
function undoRating() {
  const u = session.undo.pop();
  if (!u || !session.active) return;
  if (u.record) progress.cards[u.id] = JSON.parse(u.record); else delete progress.cards[u.id];
  const restore = (obj, value) => { if (value == null) delete obj[u.day]; else obj[u.day] = value; };
  restore(progress.days, u.days);
  restore(progress.reviewDays, u.reviewDays);
  restore(progress.dayStats, u.dayStats);
  progress.errorStats = u.errorStats;
  const pending = revlogAdds.findIndex(r => r.id === u.logId);
  if (pending >= 0) revlogAdds.splice(pending, 1); else revlogDeletes.push(u.logId);
  Object.assign(session, {queue: u.queue, steps: u.steps, done: u.done, failed: u.failed, fresh: u.fresh, grades: u.grades});
  saveProgress([u.id]);
  renderSessionCard();
  toast("Última avaliação desfeita.");
}
function exitFocus() {
  session.active = false;
  session.card = null;
  // Fim do treino: sincroniza com o GitHub e, no celular, guarda o áudio do que vence nos próximos dias.
  if (typeof cloudSyncSoon === "function") cloudSyncSoon();
  if (typeof offlinePrefetchSoon === "function") offlinePrefetchSoon();
  if (session.clip) { session.clip.stop(); session.clip = null; }
  document.body.classList.remove("focus");
  $("focusBar").hidden = true;
  $("sessionStage").hidden = true;
  stopAudio();
}
function endSession() {
  if (!session.active) return;
  if (session.done) finishSession();
  else { exitFocus(); renderPracticeSetup(); }
}
function finishSession() {
  exitFocus();
  const reviews = GRADES.reduce((a, g) => a + (session.grades[g] || 0), 0);
  const pct = reviews ? Math.round((reviews - (session.grades.again || 0)) / reviews * 100) : 0;
  const tomorrow = forecastCounts(2)[1];
  const dist = h("div", {class: "dist", role: "img", "aria-label": GRADES.map(g => GRADE_LABELS[g] + ": " + (session.grades[g] || 0)).join(", ")},
    ...GRADES.filter(g => session.grades[g]).map(g => h("span", {class: "d-" + g, style: "flex:" + session.grades[g], title: GRADE_LABELS[g] + ": " + session.grades[g]})));
  const box = $("sessionDone");
  fill(box,
    h("div", {class: "summary-icon"}, icon("check", 30)),
    h("h2", {text: session.leech ? "Frases difíceis revisadas" : "Sessão concluída"}),
    h("p", {class: "muted", text: streak() > 1 ? "Sequência de " + streak() + " dias. Continue amanhã!" : "Bom trabalho. Volte amanhã para manter o ritmo."}),
    h("div", {class: "summary-stats"},
      h("div", null, h("b", {text: reviews}), h("span", {text: "avaliações"})),
      h("div", null, h("b", {text: pct + "%"}), h("span", {text: "de acerto"})),
      h("div", null, h("b", {text: formatDuration((Date.now() - session.startedAt) / 1000)}), h("span", {text: "de treino"})),
      h("div", null, h("b", {text: session.fresh}), h("span", {text: session.fresh === 1 ? "frase nova" : "frases novas"}))),
    reviews ? dist : null,
    reviews ? h("div", {class: "dist-legend"}, ...GRADES.map(g => h("span", null, h("i", {class: "d-" + g}), GRADE_LABELS[g] + " " + (session.grades[g] || 0)))) : null,
    diktatSessionNode(),
    h("p", {class: "muted", text: tomorrow ? "Amanhã: " + tomorrow + (tomorrow === 1 ? " revisão prevista." : " revisões previstas.") : "Nenhuma revisão prevista para amanhã."}),
    h("div", {class: "row center"},
      h("button", {class: "primary", onclick: () => startSession()}, "Outra sessão"),
      h("button", {onclick: () => showView("home")}, "Voltar ao início")));
  box.hidden = false;
  window.scrollTo({top: 0});
  renderPracticeSetup();
  renderHome();
  flushAll();
}

// ---------- Microfone: clipes curtos ----------
function canRecord() { return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder); }
async function startClip(maxMs) {
  if (recorder && recorder.state === "recording") { setStatus("Pare a gravação atual antes de começar outra.", "error"); return null; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio: true}); }
  catch (e) { setStatus("Acesso ao microfone negado ou indisponível. Verifique o microfone nas configurações de privacidade do Windows.", "error"); return null; }
  const mr = new MediaRecorder(stream), chunks = [];
  let resolveDone;
  const done = new Promise(r => { resolveDone = r; });
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); resolveDone(new Blob(chunks, {type: mr.mimeType || "audio/webm"})); };
  mr.start();
  const timer = setTimeout(() => { if (mr.state === "recording") mr.stop(); }, maxMs);
  return {done, stop() { clearTimeout(timer); if (mr.state === "recording") mr.stop(); return done; }};
}
async function blobToWav16k(blob) {
  const ctx = new AudioContext();
  let audio;
  try { audio = await ctx.decodeAudioData(await blob.arrayBuffer()); } finally { ctx.close(); }
  const frames = Math.max(1, Math.ceil(audio.duration * 16000));
  const off = new OfflineAudioContext(1, frames, 16000), src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  const data = (await off.startRendering()).getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + data.length * 2));
  const text = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, 36 + data.length * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true);
  return view.buffer;
}
function speechAvailable() { return !!(window.satzDesktop && desktopInfo && desktopInfo.speech && desktopInfo.speech.available) && canRecord(); }
async function transcribeBlob(blob, long) {
  const wav = await blobToWav16k(blob);
  const result = await window.satzDesktop.transcribe(wav, {long: !!long});
  return (result && result.text || "").trim();
}

// ---------- Treino: falar e conferir ----------
function setSpeechState(state) {
  session.speech = state;
  const btn = $("speakCheck"), status = $("speechStatus");
  const usable = speechAvailable() && session.active && !session.revealed;
  btn.hidden = !usable || state === "hidden";
  status.hidden = btn.hidden || state === "idle";
  btn.disabled = state === "busy";
  btn.classList.toggle("danger-solid", state === "recording");
  btn.replaceChildren(icon(state === "recording" ? "stop" : "mic", 18), state === "recording" ? "Parar e conferir" : state === "busy" ? "Transcrevendo…" : "Falar e conferir", h("kbd", null, "F"));
  status.textContent = state === "recording" ? "Gravando… fale a frase em alemão (até 15 s)." : state === "busy" ? "Transcrevendo sua fala neste computador…" : "";
}
async function toggleSpeechCheck() {
  if (!speechAvailable() || !session.active || session.revealed) return;
  if (session.speech === "recording" && session.clip) { session.clip.stop(); return; }
  if (session.speech !== "idle") return;
  stopAudio();
  const clip = await startClip(15000);
  if (!clip) return;
  session.clip = clip;
  setSpeechState("recording");
  const card = session.card;
  const blob = await clip.done;
  session.clip = null;
  if (!session.active || session.card !== card) return;
  setSpeechState("busy");
  let text = "";
  try { text = await transcribeBlob(blob, false); }
  catch (e) { reportError("fala", e.message, e.stack); setStatus("Não foi possível transcrever a fala: " + e.message, "error"); setSpeechState("idle"); return; }
  if (session.active && session.card === card) revealCard({source: "voice", text});
}

// ---------- Treino: shadowing ----------
async function shadowing() {
  const card = session.card;
  if (!card || !session.revealed || !usesNeural(card) || session.clip) return;
  const btn = $("shadowButton");
  const clip = await startClip(20000);
  if (!clip) return;
  session.clip = clip;
  const label = btn.querySelector(".label");
  btn.disabled = true;
  label.textContent = "Repita junto…";
  const player = speakSession();
  await new Promise(resolve => {
    if (!player) { setTimeout(resolve, 4000); return; }
    const finish = () => { player.removeEventListener("ended", finish); setTimeout(resolve, 900); };
    player.addEventListener("ended", finish);
    setTimeout(resolve, 20000);
  });
  const blob = await clip.stop();
  session.clip = null;
  btn.disabled = false;
  label.textContent = "Shadowing";
  if (session.card !== card) return;
  const url = URL.createObjectURL(blob);
  const mine = h("audio", {controls: true, src: url});
  $("shadowPanel").replaceChildren(
    h("div", {class: "shadow-head"}, h("b", {text: "Compare"}), h("span", {class: "muted small-text", text: "Ouça o original e a sua versão. Repare no ritmo e na melodia."})),
    h("div", {class: "row"}, h("button", {class: "small", onclick: () => speakSession()}, icon("volume", 16), "Original"), mine));
  $("shadowPanel").hidden = false;
  mine.play().catch(() => {});
}

// ---------- Molde ----------
function templateCards() { return cards.filter(c => tag(c, "Modus") === "Produktion" && c.molde.includes("___")); }
function renderTemplateCount() { $("templateCount").textContent = templateCards().length.toLocaleString("pt-BR") + " moldes disponíveis"; }
function nextTemplate() {
  const eligible = templateCards();
  if (!eligible.length) { setStatus("Ainda não há frases com molde no catálogo.", "error"); return; }
  const alternatives = eligible.length > 1 ? eligible.filter(c => c.id !== templateCard?.id) : eligible;
  templateCard = alternatives[Math.floor(Math.random() * alternatives.length)];
  templateVariation = 0;
  const {reg, text} = splitSituation(templateCard.situacao);
  $("templateStage").hidden = false;
  $("templateReg").replaceChildren(regChip(reg) || "");
  $("templateText").replaceChildren(...moldNodes(templateCard.molde));
  $("templateContext").textContent = text;
  $("markVariation").disabled = false;
  $("templateExample").hidden = true;
  renderVariations();
}
function renderVariations() {
  $("variationDots").replaceChildren(...[0, 1, 2].map(i => h("span", {class: "vdot" + (i < templateVariation ? " on" : "")})));
  $("variationCount").textContent = templateVariation + " de 3 variações faladas";
}
function markVariation() {
  if (!templateCard) return;
  templateVariation = Math.min(3, templateVariation + 1);
  renderVariations();
  if (templateVariation === 3) {
    $("markVariation").disabled = true;
    showTemplateExample("Três variações concluídas. Compare com a frase do catálogo ou sorteie outro molde.");
    progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
    saveProgress();
    renderHome();
  }
}
function showTemplateExample(lead) {
  if (!templateCard) return;
  const box = $("templateExample");
  fill(box,
    typeof lead === "string" ? h("p", {class: "muted", text: lead}) : null,
    h("div", {class: "example-row"},
      h("div", null, h("p", {class: "example-de", lang: "de", text: templateCard.frase}), h("p", {class: "muted", text: templateCard.traducao})),
      h("button", {class: "icon-btn", title: "Ouvir", "aria-label": "Ouvir a frase", onclick: () => speakCard(templateCard)}, icon("volume"))));
  box.hidden = false;
}

// ---------- Ativação ----------
function shuffled(items) { const a = items.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function startActivation() {
  const learned = cards.filter(c => tag(c, "Modus") === "Produktion" && modeProgress(c.id, "production") && modeProgress(c.id, "production").lastGrade !== "again");
  if (learned.length < 10) { setStatus("A ativação precisa de 10 frases de produção já acertadas. Você tem " + learned.length + ".", "error"); return; }
  activationRound++;
  const themeCounts = new Map();
  for (const c of learned) for (const t of tagValues(c, "Thema")) themeCounts.set(t, (themeCounts.get(t) || 0) + 1);
  const topics = [...themeCounts.entries()].filter(([, n]) => n >= 10).sort((a, b) => b[1] - a[1]);
  let theme;
  if (topics.length) { theme = topics[Math.floor(Math.random() * Math.min(5, topics.length))][0]; activationCards = shuffled(learned.filter(c => hasTag(c, "Thema", theme))).slice(0, 10); }
  else { activationCards = shuffled(learned).slice(0, 10); theme = "Alltag"; }
  const frame = topics.length ? "Descreva uma situação desse tema, compare opções e explique como reagiria a uma pergunta ou problema." : "Imagine uma semana na Alemanha: reúna situações de moradia, trabalho, serviços e lazer em um monólogo livre.";
  $("activationTheme").textContent = "Tema: " + (topics.length ? (THEME_NAMES[theme] || theme) : "uma semana na Alemanha");
  $("activationFrame").textContent = frame;
  $("activationList").replaceChildren(...activationCards.map(catalogItem));
  $("activationStage").hidden = false;
  $("copyActivation").hidden = false;
  $("finishActivation").disabled = false;
  buildRecorder("activationRecorder");
}
async function copyActivation() {
  if (!activationCards.length) return;
  const txt = "Ativação semanal · " + $("activationTheme").textContent + ". " + $("activationFrame").textContent + "\n\n" + activationCards.map(c => c.id + " · " + c.frase + " — " + c.traducao).join("\n");
  try { await navigator.clipboard.writeText(txt); setStatus("Lista copiada para levar ao tutor.", "success"); }
  catch (e) {
    const t = h("textarea");
    t.value = txt;
    document.body.append(t);
    t.select();
    const copied = document.execCommand("copy");
    t.remove();
    setStatus(copied ? "Lista copiada para levar ao tutor." : "Não foi possível copiar; selecione a lista manualmente.", copied ? "success" : "error");
  }
}
function finishActivation() {
  if (!activationCards.length || $("finishActivation").disabled) return;
  $("finishActivation").disabled = true;
  progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
  saveProgress();
  renderHome();
  setStatus("Ativação registrada. Leve a lista ao tutor e use as frases livremente.", "success");
}

// ---------- Modo Prova ----------
const CHECKS = {
  vortrag: ["Abri e anunciei o tema", "Organizei a apresentação", "Mostrei alternativas", "Detalhei uma alternativa", "Comparei vantagens e desvantagens", "Avaliei e concluí", "Respondi a uma pergunta", "Formulei uma pergunta ao parceiro"],
  goetheTalk: ["Apresentei uma posição", "Justifiquei com exemplo", "Reagi ao argumento do parceiro", "Concordei ou discordei com nuance", "Pedi ou ofereci esclarecimento", "Resumi minha posição no fim"],
  kennenlernen: ["Apresentei-me brevemente", "Expliquei por que aprendo alemão", "Mencionei interesses", "Contei como me preparei", "Fiz uma pergunta ao parceiro"],
  experience: ["Situei a experiência no tempo e lugar", "Narrei os acontecimentos em sequência", "Descrevi pessoas ou aspectos concretos", "Avaliei a experiência", "Fiz uma pergunta de acompanhamento", "Respondi a uma pergunta de acompanhamento"],
  telcTalk: ["Resumi o texto com minhas palavras", "Relacionei o tema a uma experiência", "Argumentei e reagi ao parceiro", "Pedi esclarecimento quando necessário", "Propus solução ou meio-termo", "Concluí minha posição"],
  planning: ["Abri o planejamento", "Propus opções", "Perguntei e reagi à opinião do parceiro", "Negociei data, local e orçamento", "Distribuí tarefas", "Confirmei o acordo final"],
  forum: ["Introduzi o tema e minha posição", "Fundamentei com motivos", "Apresentei vantagens e desvantagens", "Dei exemplo", "Propus medida ou solução", "Usei conectivos com naturalidade", "Concluí sem empilhar fórmulas"],
  message: ["Usei saudação e despedida adequadas", "Expliquei motivo e contexto", "Fiz pedido ou proposta com cortesia", "Mantive registro consistente", "Liguei os pontos com clareza"],
  info: ["Incluí assunto, saudação e despedida", "Expliquei por que escrevo", "Cobri os três pontos-guia", "Fiz perguntas indiretas educadas", "Liguei os pontos em parágrafos", "Mantive registro semiformal ou formal"],
  complaint: ["Incluí assunto, saudação e despedida", "Descrevi o problema concretamente", "Cobri os três pontos-guia", "Expressei insatisfação com firmeza e cortesia", "Pedi providência ou solução", "Liguei os pontos em parágrafos"],
  anamnese: ["Cumprimentei, apresentei-me e expliquei o objetivo", "Confirmei nome, idade, altura e peso", "Explorei a queixa principal: local, início, caráter, intensidade e irradiação", "Perguntei o que piora, o que alivia e os sintomas associados", "Perguntei antecedentes, cirurgias, medicamentos e alergias", "Perguntei tabagismo, álcool e drogas", "Perguntei história familiar e social", "Fiz a anamnese vegetativa (apetite, peso, sono, evacuação, diurese)", "Resumi e confirmei com o paciente", "Expliquei os próximos passos em linguagem leiga", "Evitei jargão técnico com o paciente"],
  documentation: ["Dados do paciente e motivo da consulta", "Queixa principal com cronologia", "Sintomas associados e negados", "Antecedentes, medicação e alergias", "Hábitos e história social e familiar", "Suspeita diagnóstica e diagnósticos diferenciais", "Conduta diagnóstica e terapêutica planejada", "Terminologia técnica e estilo nominal corretos"],
  caseReport: ["Apresentei paciente, idade e motivo da consulta", "Descrevi a queixa principal com termos técnicos", "Relatei antecedentes, medicação, alergias e hábitos", "Formulei a suspeita diagnóstica com justificativa", "Citei diagnósticos diferenciais", "Propus exames complementares", "Propus terapia inicial", "Respondi às perguntas com segurança", "Admiti incerteza de forma profissional quando necessário"],
  consent: ["Expliquei o motivo do exame", "Descrevi o procedimento passo a passo em linguagem leiga", "Expliquei o preparo (jejum, medicamentos)", "Mencionei riscos frequentes e riscos graves raros", "Citei alternativas", "Verifiquei a compreensão e as dúvidas", "Mencionei o termo de consentimento"]
};
const FSP_BECKER = "Klaus Becker, 58 Jahre, 1,78 m, 96 kg, Lagerist. Seit zwei Stunden drückender Schmerz hinter dem Brustbein mit Ausstrahlung in den linken Arm, Beginn in Ruhe beim Fernsehen, Stärke 8/10, dazu Schweißausbruch und Übelkeit. Vorerkrankungen: arterielle Hypertonie, Diabetes mellitus Typ 2. Medikamente: Ramipril 5 mg, Metformin 1000 mg. Allergie: Penicillin (Hautausschlag). Raucher seit 30 Jahren, eine Schachtel pro Tag; am Wochenende zwei Bier. Vater mit 62 Jahren an Herzinfarkt verstorben. Verheiratet, zwei erwachsene Kinder.";
const FSP_SCHULZ = "Anna Schulz, 34 Jahre, 1,68 m, 72 kg, Grundschullehrerin. Seit gestern Abend nach einem fettigen Essen krampfartige Schmerzen im rechten Oberbauch mit Ausstrahlung in die rechte Schulter, Stärke 7/10, Übelkeit, zweimal Erbrechen, Fieber bis 38,4 °C. Keine Vorerkrankungen, keine Operationen. Medikamente: orale Kontrazeption. Keine Allergien. Nichtraucherin, Alkohol gelegentlich. Mutter mit Gallensteinen. Lebt mit ihrem Partner. Letzte Regelblutung vor zwei Wochen.";
const FSP_WAGNER = "Helga Wagner, 72 Jahre, Rentnerin, früher Verkäuferin. Seit einer Woche zunehmende Atemnot, zuerst beim Treppensteigen, jetzt schon beim Anziehen; nachts schläft sie mit drei Kissen. Geschwollene Beine, drei Kilo Gewichtszunahme. Herzinfarkt vor fünf Jahren. Medikamente: ASS 100 mg, Bisoprolol 5 mg, Torasemid 10 mg — Torasemid vor zehn Tagen selbst abgesetzt, weil sie so oft auf die Toilette musste. Keine Allergien. Nie geraucht. Verwitwet, lebt allein im zweiten Stock ohne Aufzug.";
const EXAMS = [
  {id: "g-v-1", kind: "vortrag", type: "oral", ref: "Goethe_M1", seconds: 240, title: "Goethe · Vortrag · mobilidade urbana", prompt: "Bereiten Sie einen kurzen Vortrag vor: Wie kann man sich in einer Stadt ohne eigenes Auto bewegen? Stellen Sie verschiedene Möglichkeiten vor, erläutern Sie eine genauer und wägen Sie Vor- und Nachteile ab. Schließen Sie mit Ihrer Einschätzung.", question: "Welche Möglichkeit wäre für jemanden mit wechselnden Arbeitszeiten am besten? Antworten Sie frei und stellen Sie anschließend eine Frage zum Vortrag Ihres Partners."},
  {id: "g-v-2", kind: "vortrag", type: "oral", ref: "Goethe_M1", seconds: 240, title: "Goethe · Vortrag · alimentação no trabalho", prompt: "Halten Sie einen kurzen Vortrag über gesunde Ernährung während eines langen Arbeitstags. Nennen Sie mehrere Möglichkeiten, beschreiben Sie eine genauer, vergleichen Sie Vor- und Nachteile und ziehen Sie ein Fazit.", question: "Wie lässt sich diese Gewohnheit beibehalten, wenn sich der Dienstplan jede Woche ändert? Antworten Sie und stellen Sie Ihrem Partner eine Frage zu seinem Vortrag."},
  {id: "g-d-1", kind: "goetheTalk", type: "oral", ref: "Goethe_M2", seconds: 300, title: "Goethe · Diskussion · pagamentos digitais", prompt: "Diskutieren Sie mit einem Partner: Sollten kleine Geschäfte weiterhin Bargeld annehmen? Begründen Sie Ihre Meinung, reagieren Sie auf Gegenargumente und versuchen Sie, am Ende eine differenzierte Position zu formulieren.", support: "Position des Partners: Digitale Zahlungen machen den Alltag leichter; Bargeld scheint überflüssig."},
  {id: "g-d-2", kind: "goetheTalk", type: "oral", ref: "Goethe_M2", seconds: 300, title: "Goethe · Diskussion · inteligência artificial", prompt: "Diskutieren Sie: Sollte eine Schule Lernenden erlauben, KI-Werkzeuge für Hausaufgaben zu verwenden? Vergleichen Sie Chancen und Risiken und reagieren Sie auf den Partner.", support: "Position des Partners: Ohne ein klares Verbot lernt niemand mehr, selbstständig zu schreiben."},
  {id: "g-f-1", kind: "forum", type: "written", ref: "Goethe_S1", seconds: 1800, words: 150, title: "Goethe · fórum · minimalismo", prompt: "Schreiben Sie einen Forumsbeitrag über die Frage, ob weniger Besitz den Alltag erleichtert. Stellen Sie Ihre Meinung dar, nennen Sie Gründe, wägen Sie Vor- und Nachteile ab und schlagen Sie eine praktische Idee vor."},
  {id: "g-f-2", kind: "forum", type: "written", ref: "Goethe_S1", seconds: 1800, words: 150, title: "Goethe · fórum · redes sociais", prompt: "Schreiben Sie einen Forumsbeitrag: Können soziale Netzwerke Freundschaften stärken? Begründen Sie Ihre Meinung, bringen Sie Beispiele ein, besprechen Sie Gegenargumente und schließen Sie mit einem Vorschlag."},
  {id: "g-n-1", kind: "message", type: "written", ref: "Goethe_S2", seconds: 1200, words: 100, title: "Goethe · mensagem · escala de trabalho", prompt: "Sie können an einer angekündigten Fortbildung wegen einer Änderung Ihres Dienstplans nicht teilnehmen. Schreiben Sie Ihrer Vorgesetzten eine höfliche Nachricht: Erklären Sie die Situation, zeigen Sie Verständnis und schlagen Sie eine Lösung vor."},
  {id: "g-n-2", kind: "message", type: "written", ref: "Goethe_S2", seconds: 1200, words: 100, title: "Goethe · mensagem · moradia", prompt: "In Ihrer Wohnung funktioniert die Heizung seit gestern nicht richtig. Schreiben Sie der Hausverwaltung eine höfliche Nachricht: Beschreiben Sie das Problem, erklären Sie die Dringlichkeit und bitten Sie um einen Termin."},
  {id: "t-k-1", kind: "kennenlernen", type: "oral", ref: "telc_Kennenlernen", seconds: 90, title: "telc · conhecer o parceiro · aquecimento sem nota", prompt: "Stellen Sie sich kurz vor. Erzählen Sie, warum Sie Deutsch lernen, was Sie in Ihrer Freizeit gern machen und wie Sie sich auf die Prüfung vorbereitet haben. Stellen Sie Ihrem Partner anschließend eine Frage."},
  {id: "t-e-1", kind: "experience", type: "oral", ref: "telc_M1", seconds: 90, title: "telc · experiências · filme", prompt: "Erzählen Sie von einem Film, der Sie lange beschäftigt hat. Wann und mit wem haben Sie ihn gesehen? Was war besonders und würden Sie ihn empfehlen?", question: "Was hätten Sie am Ende des Films verändert? Antworten Sie und stellen Sie Ihrem Partner danach eine Frage."},
  {id: "t-e-2", kind: "experience", type: "oral", ref: "telc_M1", seconds: 90, title: "telc · experiências · viagem", prompt: "Berichten Sie von einer Reise, bei der etwas anders lief als geplant. Beschreiben Sie Ort, Ablauf, Ihre Reaktion und das, was Sie daraus gelernt haben.", question: "Würden Sie diese Reise noch einmal machen? Antworten Sie und stellen Sie danach eine Nachfrage."},
  {id: "t-e-3", kind: "experience", type: "oral", ref: "telc_M1", seconds: 90, title: "telc · experiências · noite de jogos", prompt: "Erzählen Sie von einem Spieleabend, an den Sie sich gern erinnern. Beschreiben Sie die Menschen, den Ablauf und Ihre Bewertung.", question: "Wie haben Sie die anderen Menschen kennengelernt? Antworten Sie und fragen Sie danach nach der Erfahrung Ihres Partners."},
  {id: "t-e-4", kind: "experience", type: "oral", ref: "telc_M1", seconds: 90, title: "telc · experiências · livro", prompt: "Erzählen Sie von einem Buch, das Sie gern gelesen haben. Beschreiben Sie das Thema, eine wichtige Figur und was Ihnen daran gefallen oder nicht gefallen hat.", question: "Wem würden Sie dieses Buch empfehlen? Antworten Sie und stellen Sie Ihrem Partner eine Frage."},
  {id: "t-e-5", kind: "experience", type: "oral", ref: "telc_M1", seconds: 90, title: "telc · experiências · música", prompt: "Berichten Sie von einem Konzert oder einer musikalischen Veranstaltung. Wann und wo fand sie statt? Beschreiben Sie die Stimmung und Ihre eigene Reaktion.", question: "Würden Sie noch einmal zu einer ähnlichen Veranstaltung gehen? Fragen Sie danach Ihren Partner nach seiner Erfahrung."},
  {id: "t-e-6", kind: "experience", type: "oral", ref: "telc_M1", seconds: 90, title: "telc · experiências · esporte", prompt: "Erzählen Sie von einem Sportereignis, das Sie erlebt oder verfolgt haben. Beschreiben Sie den Ablauf und erklären Sie, warum es Ihnen in Erinnerung geblieben ist.", question: "Was war für Sie spannender: das Ergebnis oder die gemeinsame Erfahrung? Stellen Sie Ihrem Partner danach eine Frage."},
  {id: "t-e-7", kind: "experience", type: "oral", ref: "telc_M1", seconds: 90, title: "telc · experiências · pessoa importante", prompt: "Erzählen Sie von einer Person, die Sie positiv beeinflusst hat. Beschreiben Sie eine konkrete Begegnung und erklären Sie, was Sie daraus mitgenommen haben.", question: "Welche Eigenschaft dieser Person schätzen Sie besonders? Antworten Sie und fragen Sie Ihren Partner nach einer wichtigen Person."},
  {id: "t-e-8", kind: "experience", type: "oral", ref: "telc_M1", seconds: 90, title: "telc · experiências · momento marcante", prompt: "Berichten Sie von einer Erfahrung, die Ihre Sicht auf ein Thema verändert hat. Beschreiben Sie die Situation, Ihre damalige Reaktion und Ihre heutige Einschätzung.", question: "Würden Sie heute genauso handeln? Antworten Sie und stellen Sie Ihrem Partner eine Frage zu seiner Erfahrung."},
  {id: "t-d-1", kind: "telcTalk", type: "oral", ref: "telc_M2", seconds: 300, title: "telc · discussão · embalagens", prompt: "Fassen Sie den kurzen Text zusammen und diskutieren Sie mit einem Partner. Bringen Sie eigene Erfahrungen ein, reagieren Sie auf seine Argumente und schlagen Sie eine Lösung vor.", support: "Texto original de treino (cenário fictício): In einer Wohnanlage soll der kleine Laden im Erdgeschoss Produkte ohne Verpackung anbieten. Einige Bewohner freuen sich über weniger Müll und wollen eigene Behälter mitbringen. Andere haben wenig Zeit und befürchten höhere Preise. Die Ladenbesitzerin überlegt deshalb, nur einen Teil des Sortiments umzustellen. Ein Bewohner schlägt vor, zuerst drei Monate lang zu testen, welche Produkte tatsächlich gekauft werden. Danach könnte die Hausgemeinschaft gemeinsam entscheiden, ob das Angebot erweitert wird."},
  {id: "t-d-2", kind: "telcTalk", type: "oral", ref: "telc_M2", seconds: 300, title: "telc · discussão · trabalho remoto", prompt: "Fassen Sie den kurzen Text zusammen und diskutieren Sie. Reagieren Sie auf den Partner, nennen Sie Erfahrungen und suchen Sie einen Mittelweg.", support: "Texto original de treino (cenário fictício): Ein kleines Unternehmen möchte seine Beschäftigten an drei Tagen pro Woche von zu Hause arbeiten lassen. Manche begrüßen die ruhigere Umgebung und den kürzeren Arbeitsweg. Andere vermissen den direkten Austausch und finden es schwierig, nach Feierabend abzuschalten. Die Leitung denkt über gemeinsame Bürotage und klare Zeiten für Besprechungen nach. Noch ist offen, ob dieselben Regeln für alle Abteilungen sinnvoll sind. Vor einer Entscheidung sollen die Beschäftigten ihre Erfahrungen schildern und Vorschläge machen."},
  {id: "t-p-1", kind: "planning", type: "oral", ref: "telc_M3", seconds: 300, title: "telc · planejamento · evento de bairro", prompt: "Planen Sie mit einem Partner einen kleinen Nachbarschaftsabend für neu zugezogene Menschen. Klären Sie Termin, Ort, Budget, Programm, Einladungen und Aufgabenverteilung.", support: "Ihr Partner schlägt ein teures Restaurant vor. Sie bevorzugen eine günstigere Lösung und handeln einen Kompromiss aus."},
  {id: "t-p-2", kind: "planning", type: "oral", ref: "telc_M3", seconds: 300, title: "telc · planejamento · visita cultural", prompt: "Organisieren Sie mit einem Partner einen gemeinsamen Besuch für Ihre Lerngruppe. Wählen Sie ein Ziel, besprechen Sie Anreise, Kosten, Zeitplan und wer welche Aufgabe übernimmt.", support: "Einige Personen in der Gruppe sind in ihrer Mobilität eingeschränkt. Finden Sie gemeinsam einen passenden Plan."},
  {id: "t-i-1", kind: "info", type: "written", ref: "telc_Mail_Info", seconds: 1800, words: 150, title: "telc · e-mail · curso de idiomas", prompt: "Sie interessieren sich für einen Abendkurs in Ihrer neuen Stadt. Schreiben Sie eine E-Mail an die Sprachschule. Fragen Sie nach Einstufung, Unterrichtszeiten und Möglichkeiten, versäumte Termine nachzuholen. Erklären Sie kurz Ihre Situation."},
  {id: "t-i-2", kind: "info", type: "written", ref: "telc_Mail_Info", seconds: 1800, words: 150, title: "telc · e-mail · moradia compartilhada", prompt: "Eine Anzeige für ein Zimmer in einer Wohngemeinschaft passt zu Ihrer Situation. Schreiben Sie der Kontaktperson. Fragen Sie nach Nebenkosten, Einzugstermin und Regeln für gemeinsame Räume. Stellen Sie sich kurz vor."},
  {id: "t-b-1", kind: "complaint", type: "written", ref: "telc_Mail_Beschwerde", seconds: 1800, words: 150, title: "telc · e-mail · viagem", prompt: "Nach einer gebuchten Zugreise mussten Sie wegen einer kurzfristigen Änderung einen anderen Anschluss nehmen und zusätzliche Kosten tragen. Schreiben Sie dem Anbieter. Beschreiben Sie Buchung und Problem, erklären Sie die Folgen und fordern Sie eine angemessene Lösung."},
  {id: "t-b-2", kind: "complaint", type: "written", ref: "telc_Mail_Beschwerde", seconds: 1800, words: 150, title: "telc · e-mail · serviço", prompt: "Ein bezahlter Reparaturdienst kam deutlich später als vereinbart und konnte das Problem nicht beheben. Schreiben Sie dem Unternehmen. Nennen Sie Termin und Leistung, schildern Sie die Folgen und bitten Sie um eine konkrete Nachbesserung oder Erstattung."},
  {id: "fsp-a-1", kind: "anamnese", type: "oral", ref: "FSP_Anamnese", seconds: 1200, title: "FSP · Anamnese · dor torácica", prompt: "Führen Sie ein vollständiges Anamnesegespräch. Erheben Sie die aktuelle Anamnese, Vorerkrankungen, Medikation, Allergien, Noxen, Familien- und Sozialanamnese sowie die vegetative Anamnese. Fassen Sie am Ende zusammen und erklären Sie das weitere Vorgehen in laienverständlicher Sprache.", support: "Rolle für den Tutor (Patient): " + FSP_BECKER, question: "Der Patient fragt: „Ist das etwas Schlimmes, Herr Doktor?“ Antworten Sie ehrlich, einfühlsam und laienverständlich."},
  {id: "fsp-a-2", kind: "anamnese", type: "oral", ref: "FSP_Anamnese", seconds: 1200, title: "FSP · Anamnese · dor abdominal", prompt: "Führen Sie ein vollständiges Anamnesegespräch mit der Patientin. Denken Sie auch an die gynäkologische Anamnese. Fassen Sie am Ende zusammen und erklären Sie das weitere Vorgehen.", support: "Rolle für den Tutor (Patientin): " + FSP_SCHULZ, question: "Die Patientin fragt: „Muss ich jetzt operiert werden?“ Antworten Sie ehrlich und verständlich, ohne eine sichere Diagnose vorwegzunehmen."},
  {id: "fsp-a-3", kind: "anamnese", type: "oral", ref: "FSP_Anamnese", seconds: 1200, title: "FSP · Anamnese · falta de ar", prompt: "Führen Sie ein vollständiges Anamnesegespräch mit der Patientin. Klären Sie besonders die Medikamenteneinnahme und die häusliche Situation.", support: "Rolle für den Tutor (Patientin): " + FSP_WAGNER, question: "Die Patientin sagt: „Die Wassertabletten nehme ich nicht mehr, ich muss ja ständig aufs Klo.“ Reagieren Sie verständnisvoll und erklären Sie, warum das Medikament wichtig ist."},
  {id: "fsp-u-1", kind: "consent", type: "oral", ref: "FSP_Aufklaerung", seconds: 600, title: "FSP · Aufklärung · endoscopia digestiva alta", prompt: "Klären Sie den Patienten laienverständlich über eine Magenspiegelung (Gastroskopie) auf: Grund, Ablauf, Vorbereitung, Risiken und Alternativen. Prüfen Sie am Ende, ob er alles verstanden hat.", support: "Patient: Mehmet Yilmaz, 45 Jahre, seit sechs Wochen Oberbauchschmerzen nach dem Essen, Verdacht auf ein Magengeschwür. Nimmt wegen Rückenschmerzen regelmäßig Ibuprofen. Hat Angst vor dem Würgereiz.", question: "Der Patient fragt: „Und wenn ich die Untersuchung nicht machen möchte?“ Antworten Sie respektvoll und erklären Sie die Folgen."},
  {id: "fsp-d-1", kind: "documentation", type: "written", ref: "FSP_Dokumentation", seconds: 1200, words: 150, title: "FSP · documentação · dor torácica", prompt: "Verfassen Sie auf Grundlage der Informationen eine strukturierte schriftliche Anamnese im medizinischen Fachstil: Personalien, aktuelle Anamnese, Vorerkrankungen, Medikation, Allergien, Noxen, Familien- und Sozialanamnese, Verdachtsdiagnose, Differenzialdiagnosen und geplantes Vorgehen.", support: "Informationen: " + FSP_BECKER},
  {id: "fsp-d-2", kind: "documentation", type: "written", ref: "FSP_Dokumentation", seconds: 1200, words: 150, title: "FSP · documentação · dor abdominal", prompt: "Dokumentieren Sie den Fall schriftlich im medizinischen Fachstil mit Verdachtsdiagnose, Differenzialdiagnosen und geplanter Diagnostik und Therapie.", support: "Informationen: " + FSP_SCHULZ},
  {id: "fsp-f-1", kind: "caseReport", type: "oral", ref: "FSP_Fallvorstellung", seconds: 1200, title: "FSP · apresentação de caso · dor torácica", prompt: "Stellen Sie Ihrer Oberärztin den Fall vor: Personalien, Leitsymptom, relevante Anamnese, Verdachtsdiagnose, Differenzialdiagnosen, geplante Diagnostik und Therapie. Beantworten Sie anschließend ihre Rückfragen.", support: "Fall: " + FSP_BECKER, question: "Die Oberärztin fragt: „Warum haben Sie an eine Aortendissektion gedacht, und wie würden Sie sie ausschließen?“"},
  {id: "fsp-f-2", kind: "caseReport", type: "oral", ref: "FSP_Fallvorstellung", seconds: 1200, title: "FSP · apresentação de caso · insuficiência cardíaca", prompt: "Stellen Sie Ihrem Oberarzt die Patientin vor und begründen Sie Ihre Verdachtsdiagnose. Schlagen Sie Diagnostik und Therapie vor und gehen Sie auf die Entlassungsplanung ein.", support: "Fall: " + FSP_WAGNER, question: "Der Oberarzt fragt: „Was ist die wahrscheinlichste Ursache der Dekompensation, und was ändern Sie an der Medikation?“"}
];
const EXAM_GROUPS = [["Goethe B2", "Goethe"], ["telc Deutsch B2", "telc"], ["Fachsprachprüfung (medicina)", "FSP"]];
function populateExams() {
  const sel = $("examSelect");
  sel.replaceChildren(...EXAM_GROUPS.map(([label, prefix]) => {
    const group = h("optgroup", {label});
    EXAMS.filter(e => e.ref.startsWith(prefix)).forEach(e => group.append(new Option(e.title, e.id)));
    return group;
  }));
}
function formatTime(seconds) { const s = Math.max(0, Math.ceil(seconds)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
function paintTimer() {
  $("examTimer").textContent = formatTime(timerLeft);
  setWidth($("examTimerBar"), activeExam ? timerLeft / activeExam.seconds * 100 : 0);
  $("examTimerWrap").classList.toggle("low", !!activeExam && timerLeft <= Math.min(60, activeExam.seconds * .15));
}
function stopTimer() { clearInterval(timerTicker); timerTicker = null; timerRunning = false; $("timerStart").hidden = false; $("timerPause").hidden = true; }
function updateTimer() { if (!timerRunning) return; timerLeft = Math.max(0, (timerEnd - Date.now()) / 1000); paintTimer(); if (timerLeft <= 0) { stopTimer(); finishExam(true); } }
function startTimer() { if (!activeExam || timerRunning || timerLeft <= 0) return; timerRunning = true; timerEnd = Date.now() + timerLeft * 1000; $("timerStart").hidden = true; $("timerPause").hidden = false; timerTicker = setInterval(updateTimer, 250); }
function pauseTimer() { if (!timerRunning) return; timerLeft = Math.max(0, (timerEnd - Date.now()) / 1000); stopTimer(); paintTimer(); }
function resetTimer() { if (!activeExam) return; stopTimer(); timerLeft = activeExam.seconds; paintTimer(); }
function loadExam() {
  const chosen = EXAMS.find(e => e.id === $("examSelect").value);
  if (!chosen) return;
  activeExam = chosen;
  examCompleted = false;
  $("finishExam").disabled = false;
  resetTimer();
  $("examStage").hidden = false;
  $("examResult").hidden = true;
  $("examMeta").textContent = (chosen.type === "oral" ? "Oral" : "Escrita") + " · " + (chosen.seconds / 60).toLocaleString("pt-BR") + " min · " + (REF_LABELS.get(chosen.ref) || chosen.ref);
  $("examTitle").textContent = chosen.title;
  $("examPrompt").textContent = chosen.prompt;
  $("examSupport").hidden = !chosen.support;
  $("examSupport").textContent = chosen.support || "";
  // Anamnese da FSP com caso estruturado: a IA local pode fazer o paciente (só no PC, com a parceira instalada).
  $("examAiPatient").hidden = !(typeof FSP_CASOS !== "undefined" && FSP_CASOS.some(c => c.exam === chosen.id) && convAvailable());
  $("examOral").hidden = chosen.type !== "oral";
  $("examWritten").hidden = chosen.type !== "written";
  if (chosen.type === "oral") buildRecorder("examRecorder");
  else { $("examWriting").value = safeRead("satzbausteine.examDraft." + chosen.id, ""); countExamWords(); }
  $("examStage").scrollIntoView({behavior: "smooth", block: "start"});
}
function wordCount(text) { return (text.trim().match(/\S+/g) || []).length; }
function countExamWords() {
  if (!activeExam) return;
  const count = wordCount($("examWriting").value), target = activeExam.words || 0;
  $("examWords").textContent = count + " palavras · " + (count >= target ? "meta alcançada" : "faltam " + (target - count) + " para a meta de " + target);
  $("examWords").classList.toggle("ok", count >= target);
}
function renderExamLinked() {
  if (!activeExam) return;
  const linked = cards.filter(c => hasTag(c, "Bezug", activeExam.ref));
  $("examLinkedCount").textContent = linked.length + " frases ligadas a " + (REF_LABELS.get(activeExam.ref) || activeExam.ref);
  const limit = (examLinkedPage + 1) * 50;
  $("examLinked").replaceChildren(...linked.slice(0, limit).map(catalogItem));
  $("moreExamLinked").hidden = linked.length <= limit;
}
function finishExam(byTime = false) {
  if (!activeExam || $("examStage").hidden || examCompleted) return;
  examCompleted = true;
  $("finishExam").disabled = true;
  stopTimer();
  if (recorder && recordPlace === "examRecorder" && recorder.state === "recording") recorder.stop();
  $("examResult").hidden = false;
  const type = activeExam.type, count = type === "written" ? wordCount($("examWriting").value) : 0;
  $("examOutcome").textContent = (byTime ? "Tempo esgotado. " : "") + (type === "written" ? "Você escreveu " + count + " palavras; mínimo: " + activeExam.words + "." : "Ouça sua gravação e avalie estrutura, interação, registro e clareza.");
  const q = $("examQuestion");
  q.replaceChildren();
  q.hidden = !activeExam.question;
  if (activeExam.question) {
    q.append(h("strong", {text: "Pergunta de acompanhamento"}), h("p", {lang: "de", text: activeExam.question}), h("div", {id: "examFollowupRecorder"}));
    buildRecorder("examFollowupRecorder");
  }
  const list = h("ul", {class: "checklist"});
  const total = CHECKS[activeExam.kind].length, score = $("examScore");
  const update = () => { const n = list.querySelectorAll("input:checked").length; score.textContent = n + " de " + total + " itens cumpridos"; };
  for (const item of CHECKS[activeExam.kind]) {
    const input = h("input", {type: "checkbox", onchange: update});
    list.append(h("li", null, h("label", null, input, h("span", {text: item}))));
  }
  $("examChecklist").replaceChildren(list);
  update();
  examLinkedPage = 0;
  renderExamLinked();
  progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
  saveProgress();
  renderHome();
  $("examResult").scrollIntoView({behavior: "smooth", block: "start"});
}

// ---------- Lista de frases ----------
function catalogItem(card) {
  const {reg, text} = splitSituation(card.situacao), st = cardStatus(card);
  const tags = h("div", {class: "tagline"}, ...[
    "K" + tag(card, "Schicht"), tagLabel("Prio", tag(card, "Prio")), tag(card, "Niveau"), tagLabel("Modus", tag(card, "Modus")), tagLabel("Thema", tag(card, "Thema"))
  ].filter(v => v && v !== "K").map(v => h("span", {class: "tag", text: v})));
  return h("article", {class: "item"},
    h("div", {class: "item-main"},
      h("div", {class: "item-top"}, regChip(reg), h("span", {class: "item-id", text: card.id}), h("span", {class: "status s-" + st.key, text: st.label})),
      h("p", {class: "item-de", lang: "de", text: card.frase}),
      h("p", {class: "item-pt", text: card.traducao}),
      h("p", {class: "item-sit", text: text}),
      tags),
    h("button", {class: "icon-btn", title: "Ouvir", "aria-label": "Ouvir: " + card.frase, onclick: () => speakCard(card)}, icon("volume")));
}
function filteredCatalog() {
  const q = normalizeSearch($("searchCards").value.trim()), onlyLeech = $("catalogLeeches").getAttribute("aria-pressed") === "true";
  return cards.filter(c => matches(c, filters.catalog) && (!q || searchIndex.get(c.id).includes(q)) && (!onlyLeech || isLeech(c)));
}
function renderCatalog() {
  $("catalogThemeChips").replaceChildren(...themeChips("catalog", () => { catalogPage = 0; renderCatalog(); }));
  const n = activeFilterCount("catalog");
  $("catalogFilterCount").textContent = n ? n + (n === 1 ? " ativo" : " ativos") : "";
  $("catalogFilterCount").hidden = !n;
  const leechTotal = cards.filter(c => isLeech(c)).length;
  $("catalogLeeches").hidden = !leechTotal;
  $("catalogLeeches").textContent = "Só difíceis (" + leechTotal + ")";
  const filtered = filteredCatalog();
  $("catalogCount").textContent = filtered.length.toLocaleString("pt-BR") + " de " + cards.length.toLocaleString("pt-BR") + " frases";
  $("exportAnkiFiltered").textContent = "Exportar " + filtered.length.toLocaleString("pt-BR") + " para o Anki";
  $("exportAnkiFiltered").disabled = !filtered.length;
  const limit = (catalogPage + 1) * 60, frag = document.createDocumentFragment();
  filtered.slice(0, limit).forEach(c => frag.append(catalogItem(c)));
  $("catalogList").replaceChildren(frag);
  if (!filtered.length) $("catalogList").append(h("p", {class: "empty", text: "Nenhuma frase encontrada. Tente outra busca ou limpe os filtros."}));
  $("moreCatalog").hidden = filtered.length <= limit;
}

// ---------- Cobertura ----------
function renderCoverage() {
  const box = $("coverageContent");
  box.replaceChildren();
  const known = new Set(REF_GROUPS.flatMap(g => g.items.map(x => x[0])));
  const extra = [...new Set(cards.flatMap(c => tagValues(c, "Bezug")))].filter(x => !known.has(x)).sort();
  const groups = extra.length ? [...REF_GROUPS, {title: "Outras referências presentes nos lotes", items: extra.map(x => [x, x])}] : REF_GROUPS;
  for (const group of groups) {
    const body = h("tbody");
    for (const [code, label] of group.items) {
      const subset = cards.filter(c => hasTag(c, "Bezug", code)), learned = subset.filter(studied).length, bar = h("span");
      setWidth(bar, subset.length ? learned / subset.length * 100 : 0);
      body.append(h("tr", null,
        h("td", null, h("span", {text: label}), h("small", {class: "code", text: code})),
        h("td", {text: subset.length}),
        h("td", {text: learned}),
        h("td", {class: "bar-cell"}, h("div", {class: "track"}, bar))));
    }
    box.append(h("section", {class: "panel"},
      h("h2", {text: group.title}),
      h("div", {class: "scroll"}, h("table", {class: "coverage-table"},
        h("thead", null, h("tr", null, h("th", {text: "Referência"}), h("th", {text: "Frases"}), h("th", {text: "Aprendidas"}), h("th", {text: "Progresso"}))),
        body))));
  }
}

// ---------- Gravação (ativação e prova) ----------
const recordings = new Map();
function recordingKey(id) {
  if (id === "activationRecorder") return id + "::" + activationRound;
  if (id === "examRecorder" || id === "examFollowupRecorder") return id + "::" + (activeExam?.id || "");
  return id;
}
function hasUnsavedRecordings() { for (const r of recordings.values()) if (!r.saved) return true; return false; }
function buildRecorder(id) {
  const box = $(id);
  if (!box) return;
  const start = h("button", {class: "primary", onclick: () => startRecording(id)}, icon("mic", 18), "Gravar voz");
  const stop = h("button", {class: "danger-solid", hidden: true, onclick: stopRecording}, icon("stop", 16), "Parar gravação");
  const label = h("span", {class: "muted small-text", text: "A gravação fica no aplicativo até você baixá-la."});
  const audio = h("audio", {controls: true, hidden: true});
  const download = h("button", {hidden: true, onclick: () => downloadRecording(id)}, icon("download", 18), "Baixar gravação");
  const transcribe = h("button", {hidden: true, onclick: () => transcribeRecording(id)}, icon("text", 18), "Transcrever");
  const transcript = h("div", {class: "transcript", hidden: true, lang: "de"});
  box.replaceChildren(h("div", {class: "recorder"}, h("div", {class: "row"}, start, stop, label), audio, h("div", {class: "row"}, download, transcribe), transcript));
  box._controls = {start, stop, label, audio, download, transcribe, transcript};
  renderRecorder(id);
}
function renderRecorder(id) {
  const box = $(id);
  if (!box || !box._controls) return;
  const c = box._controls, record = recordings.get(recordingKey(id)), recording = !!(recorder && recordPlace === id && recorder.state === "recording");
  c.start.hidden = recording;
  c.stop.hidden = !recording;
  c.label.className = recording ? "recording small-text" : "muted small-text";
  c.label.textContent = recording ? "Gravando…" : record && !record.saved ? "Gravação ainda não baixada." : "A gravação fica no aplicativo até você baixá-la.";
  c.audio.hidden = !record;
  c.download.hidden = !record;
  c.transcribe.hidden = !record || !speechAvailable();
  if (record && c.audio.src !== record.url) c.audio.src = record.url;
  if (record && record.transcript) { c.transcript.hidden = false; c.transcript.replaceChildren(h("b", {text: "Transcrição automática"}), h("p", {text: record.transcript})); }
  else c.transcript.hidden = true;
}
async function startRecording(id) {
  if (recorder && recorder.state === "recording") { setStatus("Pare a gravação atual antes de começar outra.", "error"); return; }
  if (!canRecord()) { setStatus("A gravação por microfone não está disponível neste computador.", "error"); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    const localRecorder = new MediaRecorder(stream), chunks = [], key = recordingKey(id);
    recorder = localRecorder;
    recordPlace = id;
    localRecorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    localRecorder.onstop = () => {
      const mime = localRecorder.mimeType || "audio/webm", blob = new Blob(chunks, {type: mime}), old = recordings.get(key);
      if (old) URL.revokeObjectURL(old.url);
      recordings.set(key, {url: URL.createObjectURL(blob), blob, saved: false});
      stream.getTracks().forEach(t => t.stop());
      if (recorder === localRecorder) { recorder = null; recordPlace = null; }
      renderRecorder(id);
      setStatus("Gravação pronta para ouvir e baixar.", "success");
    };
    localRecorder.onerror = () => setStatus("A gravação falhou. Tente novamente.", "error");
    localRecorder.start();
    renderRecorder(id);
  } catch (e) { setStatus("Acesso ao microfone negado ou indisponível. Verifique o microfone nas configurações de privacidade do Windows.", "error"); }
}
function stopRecording() { if (recorder && recorder.state === "recording") recorder.stop(); }
function downloadRecording(id) {
  const record = recordings.get(recordingKey(id));
  if (!record) return;
  const ext = record.blob.type.includes("mp4") ? "m4a" : record.blob.type.includes("ogg") ? "ogg" : "webm";
  const a = h("a", {href: record.url, download: "satzbausteine-" + id + "-" + dateKey() + "." + ext});
  document.body.append(a);
  a.click();
  a.remove();
  record.saved = true;
  renderRecorder(id);
}
async function transcribeRecording(id) {
  const record = recordings.get(recordingKey(id)), box = $(id);
  if (!record || !box || !box._controls) return;
  const btn = box._controls.transcribe;
  btn.disabled = true;
  btn.lastChild.textContent = "Transcrevendo… (pode levar alguns minutos)";
  try { record.transcript = await transcribeBlob(record.blob, true) || "(nada reconhecido)"; }
  catch (e) { reportError("transcrição", e.message, e.stack); setStatus("Não foi possível transcrever: " + e.message, "error"); }
  btn.disabled = false;
  btn.lastChild.textContent = "Transcrever";
  renderRecorder(id);
}

// ---------- Áudio ----------
const AUDIO_VOICES = (() => {
  const idx = typeof AUDIO_INDEX !== "undefined" ? AUDIO_INDEX : null, out = {};
  if (idx && idx.voices) for (const [key, v] of Object.entries(idx.voices)) out[key] = {label: v.label, dir: v.dir, ids: new Set(v.ids || [])};
  else if (idx && Array.isArray(idx.ids)) out.florian = {label: idx.voice || "Florian", dir: "audio", ids: new Set(idx.ids)};
  return out;
})();
const PRIMARY_VOICE = Object.keys(AUDIO_VOICES)[0] || "";
const NEURAL_AUDIO = PRIMARY_VOICE ? AUDIO_VOICES[PRIMARY_VOICE].ids : new Set();
const audioCache = new Map();
let audioPlayer = null;
function voiceLabel(voice) { return (AUDIO_VOICES[voice] || {}).label || ""; }
function usesNeural(card) { return settings.audioSource !== "system" && !!card && NEURAL_AUDIO.has(card.id); }
function voiceForSession(card, peek) {
  if (!usesNeural(card)) return "";
  if (session.mode === "listening" && settings.alternateVoices) {
    const options = Object.keys(AUDIO_VOICES).filter(v => AUDIO_VOICES[v].ids.has(card.id));
    if (options.length > 1) {
      let hash = 0;
      for (const ch of card.id + dateKey()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      return options[hash % options.length];
    }
  }
  return PRIMARY_VOICE;
}
function audioUrl(card, voice) { const v = AUDIO_VOICES[voice] && AUDIO_VOICES[voice].ids.has(card.id) ? voice : PRIMARY_VOICE; return AUDIO_VOICES[v].dir + "/" + card.id + ".mp3"; }
function cachedPlayer(url) {
  let player = audioCache.get(url);
  if (!player) {
    player = new Audio();
    player.preload = "auto";
    player.src = url;
    audioCache.set(url, player);
    while (audioCache.size > 6) { const oldest = audioCache.keys().next().value; if (audioCache.get(oldest) === audioPlayer) break; audioCache.delete(oldest); }
  }
  return player;
}
function preloadCard(card, voice) { if (usesNeural(card)) cachedPlayer(audioUrl(card, voice || PRIMARY_VOICE)); }
function stopAudio() {
  if (audioPlayer) audioPlayer.pause();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
function speakSession(slow = false) { return session.card ? speakCard(session.card, slow, session.cardVoice) : null; }
function speakCard(card, slow = false, voice) {
  if (!card) return null;
  if (!usesNeural(card)) { if (isMine(card)) mineSpeak(card.frase, slow); else speak(card.frase, slow); return null; }
  stopAudio();
  const player = cachedPlayer(audioUrl(card, voice || PRIMARY_VOICE)), rate = (Number(settings.rate) || .9) * (slow ? .75 : 1);
  audioPlayer = player;
  player.onerror = () => speak(card.frase, slow);
  try { player.currentTime = 0; } catch (e) { /* ainda carregando */ }
  player.defaultPlaybackRate = rate;
  player.playbackRate = rate;
  player.play().catch(e => { if (e.name !== "AbortError") speak(card.frase, slow); });
  return player;
}
function renderVoices() {
  const select = $("voiceSelect");
  if (!select) return;
  select.replaceChildren();
  if (!("speechSynthesis" in window)) {
    select.append(new Option("Síntese de voz indisponível", ""));
    $("voiceWarning").hidden = !!NEURAL_AUDIO.size;
    return;
  }
  voices = window.speechSynthesis.getVoices().filter(v => /^de(?:-|_)/i.test(v.lang) && v.localService);
  if (!voices.length) { select.append(new Option("Nenhuma voz alemã disponível", "")); $("voiceWarning").hidden = NEURAL_AUDIO.size > 0 && settings.audioSource !== "system"; return; }
  $("voiceWarning").hidden = true;
  voices.forEach(v => select.append(new Option(v.name.replace(/^Microsoft /, "") + " (" + v.lang + ")", v.voiceURI)));
  if (settings.voice && voices.some(v => v.voiceURI === settings.voice)) select.value = settings.voice;
  else { select.value = voices[0].voiceURI; settings.voice = select.value; saveSettings(); }
}
function speak(text, slow = false) {
  if (audioPlayer) audioPlayer.pause();
  if (!("speechSynthesis" in window)) { setStatus("Síntese de voz indisponível neste computador.", "error"); return; }
  const utterance = new SpeechSynthesisUtterance(text.replace(/<[^>]*>/g, ""));
  utterance.lang = "de-DE";
  utterance.rate = (Number(settings.rate) || .9) * (slow ? .7 : 1);
  const voice = voices.find(v => v.voiceURI === settings.voice);
  if (voice) utterance.voice = voice;
  else if (!voices.length && !speak.warned) { speak.warned = true; setStatus("Esta frase não tem áudio gravado e o Windows não tem voz alemã. Veja Configurações → Áudio."); }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// ---------- Backup, sincronização e importação ----------
function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob), a = h("a", {href: url, download: name});
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function backupPayload(withSettings = true) {
  await flushProgress();
  return {version: 3, app: APP_VERSION, exportedAt: new Date().toISOString(), progress, revlog: await readRevlog(), settings: withSettings ? settings : undefined};
}
async function exportProgress() {
  progress.lastBackupAt = Date.now();
  saveProgress();
  const payload = await backupPayload();
  downloadBlob("satzbausteine-progresso-" + dateKey() + ".json", new Blob([JSON.stringify(payload)], {type: "application/json;charset=utf-8"}));
  renderHome();
  renderSettings();
  setStatus("Backup do progresso exportado, com o histórico de revisões.", "success");
}
function scheduleAutoBackup() {
  if (!window.satzDesktop) return;
  clearTimeout(autoBackupTimer);
  autoBackupTimer = setTimeout(flushAutoBackup, 8000);
}
async function flushAutoBackup() {
  clearTimeout(autoBackupTimer);
  // Qualquer atividade conta (cenas, conversa, minhas frases…); só não se salva um backup vazio ou de uma leitura que falhou.
  if (!window.satzDesktop || progressReadFailed || !hasAnyProgress()) return null;
  try {
    const result = await window.satzDesktop.saveAutoBackup(JSON.stringify(await backupPayload()));
    safeWrite(KEY_AUTO_BACKUP, result.savedAt);
    const ext = result.external || {};
    if (desktopInfo && ext.dir) desktopInfo.extBackup = {dir: ext.dir, available: ext.ok, last: ext.ok ? result.savedAt : (desktopInfo.extBackup || {}).last || 0, error: ext.error || ""};
    if (currentView === "settings") renderDesktopSettings();
    if (currentView === "home") renderBackupReminder();
    return result.savedAt;
  } catch (e) { reportError("backup", e.message, e.stack); return null; }
}
async function syncNow(quiet = true) {
  if (!window.satzDesktop || !desktopInfo || !desktopInfo.sync || !desktopInfo.sync.dir) return false;
  // Com a leitura local falhando, escrever na pasta sincronizada espalharia um progresso incompleto.
  if (progressReadFailed) { if (!quiet) setStatus(PROGRESS_READ_MSG, "error"); return false; }
  try {
    const text = await window.satzDesktop.syncRead();
    if (text) { const parsed = JSON.parse(text); await mergeIncoming(parsed, {settings: false}); }
    await window.satzDesktop.syncWrite(JSON.stringify(await backupPayload(false)));
    safeWrite(KEY_LAST_SYNC, Date.now());
    if (!quiet) setStatus("Progresso sincronizado com a pasta escolhida.", "success");
    if (currentView === "settings") renderDesktopSettings();
    return true;
  } catch (e) {
    reportError("sincronização", e.message, e.stack);
    if (!quiet) setStatus("Não foi possível sincronizar: " + e.message, "error");
    return false;
  }
}
async function flushAll() {
  await flushProgress();
  await syncNow(true);
  return flushAutoBackup();
}
function sanitizeProgress(source) {
  if (!source || typeof source !== "object" || !source.cards || typeof source.cards !== "object") throw new Error("JSON sem progresso de cards.");
  const result = emptyProgress();
  result.lastBackupAt = Number(source.lastBackupAt) || 0;
  for (const [id, p] of Object.entries(source.cards)) {
    if (!CARD_ID.test(id) || !p || typeof p !== "object") continue;
    const item = {};
    if (Number.isFinite(Number(p.introducedAt))) item.introducedAt = Number(p.introducedAt);
    for (const mode of ["production", "listening"]) {
      const x = p[mode];
      if (!x || typeof x !== "object") continue;
      const due = Number(x.due), last = Number(x.lastReviewed);
      if (!Number.isFinite(due) || !Number.isFinite(last)) continue;
      const interval = Math.max(0, Number(x.interval) || 0), ease = Math.min(3.2, Math.max(1.3, Number(x.ease) || 2.5));
      let stability = Number(x.stability), difficulty = Number(x.difficulty);
      if (!(stability > 0)) stability = interval > 0 ? interval : 0.4;
      if (!(difficulty >= 1 && difficulty <= 10)) difficulty = FSRS.clampD(10 - (ease - 1.3) * 9 / 1.9);
      item[mode] = {interval, ease, stability: FSRS.clampS(stability), difficulty, due,
        lastGrade: GRADES.includes(x.lastGrade) ? x.lastGrade : "good", reviews: Math.max(0, Number(x.reviews) || 0), lapses: Math.max(0, Number(x.lapses) || 0), lastReviewed: last};
      if (Array.isArray(x.why)) item[mode].why = x.why.filter(r => typeof r === "string" && r.length < 20).slice(0, 7);
    }
    result.cards[id] = item;
  }
  for (const key of ["days", "reviewDays"]) {
    if (source[key] && typeof source[key] === "object") for (const [day, n] of Object.entries(source[key])) if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Number(n))) result[key][day] = Math.max(0, Number(n));
  }
  if (source.dayStats && typeof source.dayStats === "object") {
    for (const [day, s] of Object.entries(source.dayStats)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !s || typeof s !== "object") continue;
      result.dayStats[day] = {reviews: Math.max(0, Number(s.reviews) || 0), again: Math.max(0, Number(s.again) || 0), fresh: Math.max(0, Number(s.fresh) || 0), ms: Math.max(0, Number(s.ms) || 0)};
    }
  }
  if (source.errorStats && typeof source.errorStats === "object") {
    for (const [reason, n] of Object.entries(source.errorStats)) if (/^[a-z]{2,15}$/.test(reason) && Number.isFinite(Number(n))) result.errorStats[reason] = Math.max(0, Number(n));
  }
  const practice = source.practice && typeof source.practice === "object" ? source.practice : {};
  for (const [id, s] of Object.entries(practice.scenes || {})) {
    if (/^c\d{2,}$/.test(id) && s && typeof s === "object") result.practice.scenes[id] = {best: Math.min(1, Math.max(0, Number(s.best) || 0)), last: Math.min(1, Math.max(0, Number(s.last) || 0)), plays: Math.max(0, Number(s.plays) || 0), at: Number(s.at) || 0};
  }
  for (const [id, v] of Object.entries(practice.pron || {})) if (/^[a-z]{1,10}$/.test(id) && Number.isFinite(Number(v))) result.practice.pron[id] = Math.min(1, Math.max(0, Number(v)));
  if (practice.diktat) result.practice.diktat = sanitizeDiktat(practice.diktat);
  if (practice.speed) result.practice.speed = sanitizeSpeed(practice.speed);
  if (practice.conversa) result.practice.conversa = sanitizeConversa(practice.conversa);
  if (practice.f432) result.practice.f432 = sanitizeF432(practice.f432);
  if (practice.reading) result.practice.reading = sanitizeReadingLog(practice.reading);
  if (practice.gram) result.practice.gram = sanitizeGram(practice.gram);
  if (practice.bookWords) result.practice.bookWords = sanitizeBookWords(practice.bookWords);
  if (practice.escrita) result.practice.escrita = sanitizeEscrita(practice.escrita);
  result.schedule = sanitizeSchedule(source.schedule);
  result.mine = sanitizeMine(source.mine);
  return result;
}
function applyImportedSettings(s) {
  if (!s || typeof s !== "object") return;
  if (Number.isInteger(Number(s.newLimit))) settings.newLimit = Math.max(0, Math.min(100, Number(s.newLimit)));
  if (s.reviewLimit === "" || Number.isInteger(Number(s.reviewLimit))) settings.reviewLimit = s.reviewLimit === "" ? "" : Math.max(0, Number(s.reviewLimit));
  if (["layer", "priority", "id"].includes(s.newOrder)) settings.newOrder = s.newOrder;
  if (Number(s.rate) >= .6 && Number(s.rate) <= 1.3) settings.rate = Number(s.rate);
  if (Number(s.retention) >= .8 && Number(s.retention) <= .97) settings.retention = Number(s.retention);
  if (["auto", "light", "dark"].includes(s.theme)) settings.theme = s.theme;
  if (typeof s.voice === "string") settings.voice = s.voice;
  if (typeof s.typing === "boolean") settings.typing = s.typing;
  if (["neural", "system"].includes(s.audioSource)) settings.audioSource = s.audioSource;
  if (typeof s.alternateVoices === "boolean") settings.alternateVoices = s.alternateVoices;
  if (Number(s.medShare) >= 0 && Number(s.medShare) <= .5) settings.medShare = Number(s.medShare);
  if ([15, 30, 60, 90, 120, 180].includes(Number(s.readingGoal))) settings.readingGoal = Number(s.readingGoal);
  if (Number.isInteger(Number(s.nwChapter)) && Number(s.nwChapter) >= 0 && Number(s.nwChapter) <= 37) settings.nwChapter = Number(s.nwChapter);
  if (typeof s.levelGate === "boolean") settings.levelGate = s.levelGate;
  if (typeof s.mineReview === "boolean") settings.mineReview = s.mineReview;
  if (["charon", "aoede", "system"].includes(s.convVoice)) settings.convVoice = s.convVoice;
  if (["curto", "classico"].includes(s.f432Mode)) settings.f432Mode = s.f432Mode;
  if (s.plan && typeof s.plan === "object") {
    const plan = {};
    for (const k of ["move", "b1", "b2", "fsp"]) if (/^\d{4}-\d{2}-\d{2}$/.test(s.plan[k] || "")) plan[k] = s.plan[k];
    settings.plan = {...(settings.plan || {}), ...plan};
  }
  if (FSRS.validWeights(s.fsrsWeights)) { settings.fsrsWeights = s.fsrsWeights.slice(); settings.fsrsInfo = s.fsrsInfo && typeof s.fsrsInfo === "object" ? s.fsrsInfo : null; }
  saveSettings();
}
async function mergeIncoming(parsed, {settings: withSettings}) {
  const incoming = sanitizeProgress(parsed.progress || parsed), changed = [];
  for (const [id, p] of Object.entries(incoming.cards)) {
    const old = progress.cards[id] || {}, merged = {...old};
    let touched = !progress.cards[id];
    if (p.introducedAt && (!old.introducedAt || p.introducedAt < old.introducedAt)) { merged.introducedAt = p.introducedAt; touched = true; }
    for (const mode of ["production", "listening"]) if (p[mode] && (!old[mode] || p[mode].lastReviewed > old[mode].lastReviewed)) { merged[mode] = p[mode]; touched = true; }
    if (touched) { progress.cards[id] = merged; changed.push(id); }
  }
  for (const key of ["days", "reviewDays"]) {
    progress[key] = progress[key] || {};
    for (const [day, n] of Object.entries(incoming[key])) progress[key][day] = Math.max(Number(progress[key][day] || 0), n);
  }
  progress.dayStats = progress.dayStats || {};
  for (const [day, s] of Object.entries(incoming.dayStats)) {
    const old = progress.dayStats[day] || {};
    progress.dayStats[day] = {reviews: Math.max(old.reviews || 0, s.reviews), again: Math.max(old.again || 0, s.again), fresh: Math.max(old.fresh || 0, s.fresh), ms: Math.max(old.ms || 0, s.ms)};
  }
  progress.lastBackupAt = Math.max(Number(progress.lastBackupAt || 0), incoming.lastBackupAt);
  progress.errorStats = progress.errorStats || {};
  for (const [reason, n] of Object.entries(incoming.errorStats)) progress.errorStats[reason] = Math.max(progress.errorStats[reason] || 0, n);
  progress.practice = progress.practice || {scenes: {}, pron: {}};
  progress.practice.scenes = progress.practice.scenes || {};
  progress.practice.pron = progress.practice.pron || {};
  for (const [id, s] of Object.entries(incoming.practice.scenes)) {
    const old = progress.practice.scenes[id];
    if (!old || s.best > old.best || s.at > old.at) progress.practice.scenes[id] = {best: Math.max(s.best, old ? old.best : 0), last: s.at >= (old ? old.at : 0) ? s.last : old.last, plays: Math.max(s.plays, old ? old.plays : 0), at: Math.max(s.at, old ? old.at : 0)};
  }
  for (const [id, v] of Object.entries(incoming.practice.pron)) progress.practice.pron[id] = Math.max(progress.practice.pron[id] || 0, v);
  if (incoming.practice.diktat) progress.practice.diktat = mergeDiktat(progress.practice.diktat, incoming.practice.diktat);
  if (incoming.practice.speed) progress.practice.speed = mergeSpeed(progress.practice.speed, incoming.practice.speed);
  if (incoming.practice.conversa) progress.practice.conversa = mergeConversa(progress.practice.conversa, incoming.practice.conversa);
  if (incoming.practice.f432) progress.practice.f432 = mergeF432(progress.practice.f432, incoming.practice.f432);
  if (incoming.practice.reading) progress.practice.reading = mergeReadingLog(progress.practice.reading, incoming.practice.reading);
  if (incoming.practice.gram) progress.practice.gram = mergeGram(progress.practice.gram, incoming.practice.gram);
  if (incoming.practice.bookWords) progress.practice.bookWords = mergeBookWords(progress.practice.bookWords, incoming.practice.bookWords);
  if (incoming.practice.escrita) progress.practice.escrita = mergeEscrita(progress.practice.escrita, incoming.practice.escrita);
  if (incoming.schedule.updatedAt > ((progress.schedule || {}).updatedAt || 0)) progress.schedule = incoming.schedule;
  progress.mine = mergeMine(progress.mine, incoming.mine);
  applyMine();
  revlogAdds.push(...sanitizeRevlog(parsed.revlog));
  if (withSettings) { applyImportedSettings(parsed.settings); applyTheme(); }
  saveProgress(changed);
  await flushProgress();
  if (changed.length && !session.active) refreshAll();
  if (incoming.practice.escrita && typeof escritaAfterMerge === "function") escritaAfterMerge();
  return changed.length;
}
async function importProgress(file) {
  if (!file) return;
  let parsed;
  try { parsed = JSON.parse(await file.text()); } catch (e) { setStatus("O arquivo não é um JSON válido.", "error"); return; }
  // Restaurar um backup é a saída quando a leitura falhou: a partir daqui, o que está na memória é o backup.
  if (progressReadFailed) progressReadFailed = false;
  try {
    const n = await mergeIncoming(parsed, {settings: true});
    refreshAll();
    setStatus("Progresso importado e mesclado: " + n + " frases atualizadas.", "success");
  } catch (e) { setStatus("Não foi possível importar: " + e.message, "error"); }
}
function exportAnki(list) {
  if (!list.length) return;
  const clean = v => String(v || "").replace(/[\t\r\n]+/g, " ").trim();
  const lines = ["#separator:tab", "#html:false", "#tags column:7", "#columns:Situação\tFrase\tTradução\tMolde\tFoco\tID\tTags"];
  for (const c of list) lines.push([c.situacao, c.frase, c.traducao, c.molde, c.alvo, c.id, "Satzbausteine " + c.tags].map(clean).join("\t"));
  downloadBlob("satzbausteine-anki-" + dateKey() + ".txt", new Blob([lines.join("\n") + "\n"], {type: "text/plain;charset=utf-8"}));
  setStatus(list.length.toLocaleString("pt-BR") + " frases exportadas para o Anki (só texto). O baralho com áudio está em Configurações → Catálogo.", "success");
}

// ---------- Otimizador FSRS ----------
async function optimizerSequences() {
  const log = (await readRevlog()).sort((a, b) => a.ts - b.ts), groups = new Map();
  for (const r of log) {
    const key = r.cardId + "|" + r.mode;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const sequences = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    sequences.push(list.map((r, i) => ({g: r.g, elapsed: i ? Math.max(0, calendarDays(list[i - 1].ts, r.ts)) : 0})));
  }
  const terms = sequences.reduce((n, seq) => n + seq.slice(1).filter(r => r.elapsed > 0).length, 0);
  return {sequences, terms, total: log.length};
}
const OPTIMIZER_MIN_TERMS = 300;
async function renderOptimizer() {
  const info = settings.fsrsInfo;
  const custom = FSRS.validWeights(settings.fsrsWeights);
  const {terms, total} = await optimizerSequences();
  $("optStatus").textContent = (custom && info
    ? "Parâmetros personalizados desde " + new Date(info.date).toLocaleDateString("pt-BR") + " (ajustados com " + info.terms.toLocaleString("pt-BR") + " revisões; erro de previsão " + info.lossDefault.toFixed(3) + " → " + info.lossOptimized.toFixed(3) + ")."
    : "Usando os parâmetros padrão do FSRS.")
    + " Histórico: " + total.toLocaleString("pt-BR") + " avaliações, " + terms.toLocaleString("pt-BR") + " com intervalo de pelo menos um dia"
    + (terms < OPTIMIZER_MIN_TERMS ? " (o ajuste precisa de " + OPTIMIZER_MIN_TERMS + ")." : ".");
  $("optRun").disabled = terms < OPTIMIZER_MIN_TERMS || !!optimizerWorker;
  $("optReset").hidden = !custom;
}
async function runOptimizer() {
  if (optimizerWorker) return;
  const {sequences, terms} = await optimizerSequences();
  if (terms < OPTIMIZER_MIN_TERMS) return;
  $("optRun").disabled = true;
  $("optProgress").hidden = false;
  setWidth($("optBar"), 0);
  optimizerWorker = new Worker("optimizer-worker.js");
  optimizerWorker.onmessage = e => {
    const msg = e.data;
    if (msg.type === "progress") { setWidth($("optBar"), msg.value * 100); return; }
    optimizerWorker.terminate();
    optimizerWorker = null;
    $("optProgress").hidden = true;
    if (msg.type === "error") { reportError("otimizador", msg.message); setStatus("O ajuste falhou: " + msg.message, "error"); renderOptimizer(); return; }
    const r = msg.result;
    if (FSRS.validWeights(r.weights) && r.lossOptimized < r.lossDefault - 0.0005) {
      settings.fsrsWeights = r.weights;
      settings.fsrsInfo = {date: Date.now(), terms, lossDefault: r.lossDefault, lossOptimized: r.lossOptimized};
      saveSettings();
      setStatus("Pronto! O agendamento agora usa parâmetros ajustados à sua memória.", "success");
    } else setStatus("Os parâmetros padrão já descrevem bem a sua memória. Nada foi alterado.", "info");
    renderOptimizer();
  };
  optimizerWorker.onerror = e => {
    if (optimizerWorker) optimizerWorker.terminate();
    optimizerWorker = null;
    $("optProgress").hidden = true;
    reportError("otimizador", e.message);
    setStatus("O ajuste falhou.", "error");
    renderOptimizer();
  };
  optimizerWorker.postMessage({sequences});
}
function resetOptimizer() {
  settings.fsrsWeights = null;
  settings.fsrsInfo = null;
  saveSettings();
  renderOptimizer();
  setStatus("Parâmetros padrão do FSRS restaurados.", "success");
}

// ---------- Configurações e tema ----------
function renderDesktopSettings() {
  const panel = $("desktopPanel");
  if (!window.satzDesktop || !desktopInfo) { panel.hidden = true; return; }
  panel.hidden = false;
  const prefs = desktopInfo.prefs || {};
  $("reminderEnabled").checked = !!(prefs.reminder && prefs.reminder.enabled);
  $("reminderTime").value = (prefs.reminder && prefs.reminder.time) || "19:00";
  $("reminderTime").disabled = !$("reminderEnabled").checked;
  $("trayMode").checked = !!prefs.tray;
  $("openAtLogin").checked = !!prefs.openAtLogin;
  const last = Number(safeRead(KEY_AUTO_BACKUP, 0));
  $("autoBackupText").textContent = (last ? "Última cópia automática: " + new Date(last).toLocaleString("pt-BR") + "." : "A primeira cópia automática será feita após sua próxima avaliação.")
    + (desktopInfo.backupDir ? " Pasta: " + desktopInfo.backupDir : "");
  const ext = desktopInfo.extBackup || {};
  $("extBackupText").textContent = !ext.dir
    ? "Desligada. O backup acima fica no mesmo disco do Windows: se ele for formatado, as cópias se perdem. Escolha uma pasta em outro disco (D:, HD externo) ou no OneDrive."
    : ext.error || !ext.available
      ? "Não consegui gravar em " + ext.dir + (ext.error ? ": " + ext.error.replace(/\.$/, "") : " (disco ou pasta indisponível)") + "."
      : "Copiando para " + ext.dir + (ext.last ? " · última cópia " + new Date(ext.last).toLocaleString("pt-BR") : " · a primeira cópia sai depois do próximo estudo") + ". Guarda as últimas 30 cópias diárias e uma de cada mês.";
  $("extBackupInfo").classList.toggle("warn", !ext.dir || !!ext.error || !ext.available);
  $("extBackupChoose").textContent = ext.dir ? "Trocar pasta" : "Escolher pasta";
  $("extBackupOpen").hidden = !ext.dir || !ext.available;
  $("extBackupNow").hidden = !ext.dir || !hasAnyProgress();
  $("extBackupClear").hidden = !ext.dir;
  const sync = desktopInfo.sync || {}, lastSync = Number(safeRead(KEY_LAST_SYNC, 0));
  $("syncStatus").textContent = sync.dir
    ? "Sincronizando com: " + sync.dir + (lastSync ? " · última vez " + new Date(lastSync).toLocaleString("pt-BR") : "")
    : "Desligada. Escolha uma pasta sincronizada (por exemplo, dentro do OneDrive) para manter vários computadores iguais.";
  $("syncClear").hidden = !sync.dir;
  $("syncNow").hidden = !sync.dir;
  const speech = desktopInfo.speech || {};
  $("speechInfo").textContent = speech.available
    ? "Conferência de fala offline ativa (Whisper " + (speech.model || "") + "). No treino de produção, use “Falar e conferir” ou a tecla F. Tudo roda neste computador."
    : "Conferência de fala indisponível: arquivos do Whisper não encontrados na pasta resources\\whisper.";
  $("whisperModelRow").hidden = !(speech.available && speech.precise);
  $("whisperModel").value = speech.mode === "precise" ? "precise" : "fast";
}
function renderSettings() {
  if (typeof renderOffline === "function") renderOffline();
  if (typeof renderCloud === "function") renderCloud();
  $("newLimit").value = settings.newLimit;
  $("reviewLimit").value = settings.reviewLimit;
  $("newOrder").value = settings.newOrder;
  $("retention").value = String(settings.retention);
  $("themeSelect").value = settings.theme;
  $("speechRate").value = settings.rate;
  $("speechRateValue").textContent = Number(settings.rate).toLocaleString("pt-BR") + "×";
  $("storageInfo").textContent = "Último backup exportado: " + (progress.lastBackupAt ? new Date(progress.lastBackupAt).toLocaleString("pt-BR") : "ainda não exportado") + "."
    + (dataDb ? "" : " Atenção: banco de dados indisponível, usando armazenamento simples.");
  $("audioSource").value = settings.audioSource === "system" || !NEURAL_AUDIO.size ? "system" : "neural";
  $("audioSource").disabled = !NEURAL_AUDIO.size;
  const voiceNames = Object.values(AUDIO_VOICES).map(v => v.label);
  $("audioSourceInfo").textContent = NEURAL_AUDIO.size
    ? NEURAL_AUDIO.size.toLocaleString("pt-BR") + " frases com áudio neural embutido (" + voiceNames.join(" e ") + "). Frases importadas depois usam a voz do Windows."
    : "Áudio neural não encontrado nesta instalação; usando a voz do Windows.";
  $("alternateVoices").checked = !!settings.alternateVoices;
  $("setLevelGate").checked = !!settings.levelGate;
  $("setPresentNew").checked = settings.presentNew !== false;
  $("setGermanSituations").checked = !!settings.germanSituations;
  $("setGenderColors").checked = !!settings.genderColors;
  $("setRubric").value = settings.showRubric || "auto";
  $("alternateRow").hidden = Object.keys(AUDIO_VOICES).length < 2;
  $("ankiDeckRow").hidden = !window.satzDesktop;
  renderDesktopSettings();
  renderConvSettings();
  renderOptimizer();
  renderVoices();
}
function applyTheme() {
  const t = ["light", "dark"].includes(settings.theme) ? settings.theme : "auto";
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY_THEME, t); } catch (e) { /* sem armazenamento */ }
  const labels = {auto: "Tema automático", light: "Tema claro", dark: "Tema escuro"};
  const btn = $("themeToggle");
  btn.replaceChildren(icon(t === "auto" ? "auto" : t === "light" ? "sun" : "moon"));
  btn.title = labels[t] + " (clique para alternar)";
  btn.setAttribute("aria-label", labels[t] + ". Alternar tema");
  if (window.satzDesktop) window.satzDesktop.setTheme(t).catch(() => {});
  syncTitleBar();
}
/* Cor da barra de título do Windows igual à do menu lateral (claro, escuro ou automático). */
function syncTitleBar() {
  if (!window.satzDesktop || !window.satzDesktop.setTitleBar) return;
  requestAnimationFrame(() => {
    const cs = getComputedStyle(document.documentElement);
    window.satzDesktop.setTitleBar(cs.getPropertyValue("--sidebar-bg").trim(), cs.getPropertyValue("--ink-2").trim()).catch(() => {});
  });
}
function cycleTheme() {
  const order = ["auto", "light", "dark"];
  settings.theme = order[(order.indexOf(settings.theme) + 1) % order.length];
  saveSettings();
  applyTheme();
  if (currentView === "settings") $("themeSelect").value = settings.theme;
}
async function saveDesktopPrefs() {
  if (!window.satzDesktop) return;
  const prefs = {reminder: {enabled: $("reminderEnabled").checked, time: $("reminderTime").value || "19:00"}, tray: $("trayMode").checked, openAtLogin: $("openAtLogin").checked};
  try { desktopInfo.prefs = await window.satzDesktop.setDesktopPrefs(prefs); }
  catch (e) { setStatus("Não foi possível salvar essa preferência: " + e.message, "error"); }
  renderDesktopSettings();
}
function refreshAll() {
  buildFilters("session");
  buildFilters("catalog");
  renderHome();
  if (currentView === "practice" && !session.active) renderPracticeSetup();
  if (currentView === "plan") renderPlan();
  if (currentView === "catalog") renderCatalog();
  if (currentView === "coverage") renderCoverage();
  if (currentView === "template") renderTemplateCount();
  if (currentView === "settings") renderSettings();
}

// ---------- Eventos ----------
function bindEvents() {
  initNav();
  $("themeToggle").addEventListener("click", cycleTheme);
  $("appMenuBtn").addEventListener("click", () => { if (window.satzDesktop && window.satzDesktop.appMenu) window.satzDesktop.appMenu().catch(() => {}); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncTitleBar);
  $("tsvInput").addEventListener("change", async e => { await importTSV(Array.from(e.target.files)); e.target.value = ""; });
  $("homeProduction").addEventListener("click", () => { showView("practice"); setSessionMode("production"); startSession(); });
  $("homeListening").addEventListener("click", () => { showView("practice"); setSessionMode("listening"); startSession(); });
  $("dismissWelcome").addEventListener("click", () => { settings.welcomeDismissed = true; saveSettings(); $("welcome").hidden = true; });
  $("reminderExport").addEventListener("click", exportProgress);
  $("modeProduction").addEventListener("click", () => setSessionMode("production"));
  $("modeListening").addEventListener("click", () => setSessionMode("listening"));
  $("typingMode").addEventListener("change", e => { settings.typing = e.target.checked; saveSettings(); });
  $("presentNew").addEventListener("change", e => { settings.presentNew = e.target.checked; saveSettings(); });
  $("presentContinue").addEventListener("click", () => continuePresentation(false));
  $("presentSkip").addEventListener("click", () => continuePresentation(true));
  $("grammarDialogClose").addEventListener("click", () => $("grammarDialog").close());
  $("grammarDialog").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  $("contStart").addEventListener("click", startContinuous);
  $("contPause").addEventListener("click", toggleContinuousPause);
  $("contNext").addEventListener("click", skipContinuous);
  $("contStop").addEventListener("click", stopContinuous);
  $("sceneBack").addEventListener("click", closeScene);
  $("sceneSpeak").addEventListener("click", sceneSpeechCheck);
  $("sceneReveal").addEventListener("click", () => revealSceneLine());
  $("sceneOk").addEventListener("click", () => gradeSceneLine(true));
  $("sceneMiss").addEventListener("click", () => gradeSceneLine(false));
  $("sceneShowOther").addEventListener("change", e => { settings.sceneShowOther = e.target.checked; saveSettings(); });
  $("sceneHelp").addEventListener("change", e => { settings.sceneHelp = e.target.value; saveSettings(); setSceneHelp(); });
  for (const [id, key] of [["setLevelGate", "levelGate"], ["setPresentNew", "presentNew"], ["setGermanSituations", "germanSituations"], ["setGenderColors", "genderColors"]]) {
    $(id).addEventListener("change", e => { settings[key] = e.target.checked; saveSettings(); });
  }
  $("setRubric").addEventListener("change", e => { settings.showRubric = e.target.value; saveSettings(); });
  $("clearSessionFilters").addEventListener("click", () => { filters.session = {}; syncFilterSelects("session"); renderPracticeSetup(); });
  $("startSession").addEventListener("click", () => startSession());
  $("leechButton").addEventListener("click", () => startSession({leech: true}));
  $("stopSession").addEventListener("click", endSession);
  $("undoRating").addEventListener("click", undoRating);
  $("revealCard").addEventListener("click", () => revealCard());
  $("speakCheck").addEventListener("click", toggleSpeechCheck);
  $("shadowButton").addEventListener("click", shadowing);
  $("playAudio").addEventListener("click", () => speakSession());
  $("playSlow").addEventListener("click", () => speakSession(true));
  $("bigPlay").addEventListener("click", () => speakSession());
  $("answerPlay").addEventListener("click", () => speakSession());
  $("typingInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); revealCard(); }
    else if (e.ctrlKey && e.code === "Space") { e.preventDefault(); speakSession(e.shiftKey); }
  });
  $("modeDictation").addEventListener("click", () => setSessionMode("dictation"));
  $("speedStart").addEventListener("click", () => startSpeedRound());
  $("speedStop").addEventListener("click", () => { if (speed.active && speed.results.length) finishSpeedRound(); else stopSpeedRound(); });
  bindUmlautKeys();
  bindReading();
  bindConversa();
  all("[data-grade]").forEach(b => b.addEventListener("click", () => rateCard(b.dataset.grade)));
  $("sessionStage").addEventListener("click", e => { const b = e.target.closest("button"); if (b && e.detail > 0 && session.active) $("flashCard").focus({preventScroll: true}); });
  for (const k of ["move", "b1", "b2", "fsp"]) $("plan-" + k).addEventListener("change", e => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return;
    settings.plan = {...planSettings(), [k]: e.target.value};
    saveSettings();
    renderPlan();
  });
  $("planMedShare").addEventListener("input", e => { settings.medShare = Number(e.target.value) / 100; $("planMedShareValue").textContent = e.target.value + "%"; saveSettings(); });
  $("planMedShare").addEventListener("change", renderPlan);
  $("nwChapter").addEventListener("change", e => { settings.nwChapter = Number(e.target.value); saveSettings(); renderPlan(); });
  bindScheduleEvents();
  $("heroScene").addEventListener("click", () => showView("scenes"));
  $("heroExam").addEventListener("click", () => showView("exam"));
  $("planApply").addEventListener("click", () => { settings.newLimit = Math.min(100, planNumbers().need); saveSettings(); renderPlan(); renderHome(); setStatus("Frases novas por dia ajustadas para " + settings.newLimit + ".", "success"); });
  $("nextTemplate").addEventListener("click", nextTemplate);
  $("markVariation").addEventListener("click", markVariation);
  $("showTemplateExample").addEventListener("click", showTemplateExample);
  $("startActivation").addEventListener("click", startActivation);
  $("copyActivation").addEventListener("click", copyActivation);
  $("finishActivation").addEventListener("click", finishActivation);
  $("loadExam").addEventListener("click", loadExam);
  $("timerStart").addEventListener("click", startTimer);
  $("timerPause").addEventListener("click", pauseTimer);
  $("timerReset").addEventListener("click", resetTimer);
  $("finishExam").addEventListener("click", () => finishExam(false));
  $("examWriting").addEventListener("input", () => { countExamWords(); if (activeExam) safeWrite("satzbausteine.examDraft." + activeExam.id, $("examWriting").value); });
  $("moreExamLinked").addEventListener("click", () => { examLinkedPage++; renderExamLinked(); });
  let searchDebounce;
  $("searchCards").addEventListener("input", () => { clearTimeout(searchDebounce); searchDebounce = setTimeout(() => { catalogPage = 0; renderCatalog(); }, 140); });
  $("moreCatalog").addEventListener("click", () => { catalogPage++; renderCatalog(); });
  $("catalogLeeches").addEventListener("click", e => { e.currentTarget.setAttribute("aria-pressed", String(e.currentTarget.getAttribute("aria-pressed") !== "true")); catalogPage = 0; renderCatalog(); });
  $("clearCatalogFilters").addEventListener("click", () => { filters.catalog = {}; $("searchCards").value = ""; $("catalogLeeches").setAttribute("aria-pressed", "false"); syncFilterSelects("catalog"); catalogPage = 0; renderCatalog(); });
  $("exportAnkiFiltered").addEventListener("click", () => exportAnki(filteredCatalog()));
  $("exportAnkiAll").addEventListener("click", () => exportAnki(cards));
  $("newLimit").addEventListener("change", e => { settings.newLimit = Math.max(0, Math.min(100, Number(e.target.value) || 0)); saveSettings(); renderSettings(); renderHome(); });
  $("reviewLimit").addEventListener("change", e => { settings.reviewLimit = e.target.value === "" ? "" : Math.max(0, Math.min(10000, Number(e.target.value) || 0)); saveSettings(); renderSettings(); });
  $("newOrder").addEventListener("change", e => { settings.newOrder = e.target.value; saveSettings(); });
  $("retention").addEventListener("change", e => { settings.retention = Number(e.target.value); saveSettings(); });
  $("optRun").addEventListener("click", runOptimizer);
  $("optReset").addEventListener("click", resetOptimizer);
  $("themeSelect").addEventListener("change", e => { settings.theme = e.target.value; saveSettings(); applyTheme(); });
  $("whisperModel").addEventListener("change", async e => {
    try { desktopInfo.speech = await window.satzDesktop.setWhisperModel(e.target.value); } catch (err) { setStatus("Não foi possível trocar o modelo de transcrição.", "error"); }
    renderDesktopSettings();
  });
  $("audioSource").addEventListener("change", e => { settings.audioSource = e.target.value; saveSettings(); renderSettings(); });
  $("alternateVoices").addEventListener("change", e => { settings.alternateVoices = e.target.checked; saveSettings(); });
  $("voiceSelect").addEventListener("change", e => { settings.voice = e.target.value; saveSettings(); });
  $("speechRate").addEventListener("input", e => { settings.rate = Number(e.target.value); $("speechRateValue").textContent = settings.rate.toLocaleString("pt-BR") + "×"; saveSettings(); });
  $("testVoice").addEventListener("click", () => { const sample = byId.get("K3-9001"); if (usesNeural(sample)) speakCard(sample); else speak("Guten Tag! Ich bin Ihre deutsche Stimme. Eins, zwei, drei."); });
  $("exportProgress").addEventListener("click", exportProgress);
  $("progressInput").addEventListener("change", async e => { await importProgress(e.target.files[0]); e.target.value = ""; });
  $("openBackups").addEventListener("click", () => window.satzDesktop?.openPath("backups"));
  $("examAiPatientBtn").addEventListener("click", () => { if (activeExam) fspFromExam(activeExam.id); });
  $("extBackupChoose").addEventListener("click", chooseExtBackup);
  $("reminderExtChoose").addEventListener("click", chooseExtBackup);
  $("extBackupOpen").addEventListener("click", () => window.satzDesktop?.openPath("extBackups"));
  $("extBackupNow").addEventListener("click", async () => {
    await flushAutoBackup();
    const ext = (desktopInfo && desktopInfo.extBackup) || {};
    setStatus(ext.error || !ext.available ? "A cópia em outro disco falhou: " + (ext.error || "pasta indisponível") : "Cópia feita em " + ext.dir + ".", ext.error || !ext.available ? "error" : "success");
  });
  $("extBackupClear").addEventListener("click", async () => {
    desktopInfo.extBackup = await window.satzDesktop.clearExtBackupDir();
    renderDesktopSettings();
    renderBackupReminder();
  });
  $("restoreYes").addEventListener("click", restoreFromOffer);
  $("restoreNo").addEventListener("click", () => { $("restoreOffer").hidden = true; });
  $("openAppFolder").addEventListener("click", () => window.satzDesktop?.openPath("app"));
  $("openLogs").addEventListener("click", () => window.satzDesktop?.openPath("logs"));
  for (const id of ["reminderEnabled", "reminderTime", "trayMode", "openAtLogin"]) $(id).addEventListener("change", saveDesktopPrefs);
  $("syncChoose").addEventListener("click", async () => {
    const dir = await window.satzDesktop.chooseSyncDir();
    if (!dir) return;
    desktopInfo.sync = {dir};
    renderDesktopSettings();
    await syncNow(false);
  });
  $("syncClear").addEventListener("click", async () => { await window.satzDesktop.clearSyncDir(); desktopInfo.sync = {dir: ""}; renderDesktopSettings(); });
  $("syncNow").addEventListener("click", () => syncNow(false));
  window.addEventListener("beforeunload", e => { if (hasUnsavedRecordings()) { e.preventDefault(); e.returnValue = ""; } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushProgress(); });
  document.addEventListener("keydown", onKeyDown);
}
function onKeyDown(e) {
  const t = e.target;
  if ($("grammarDialog").open) return;
  if (e.key === "Escape" && session.active) { e.preventDefault(); endSession(); return; }
  // Esc pausa a escuta das mãos livres mesmo com o cursor na caixa de texto da conversa.
  if (e.key === "Escape" && currentView === "conversa" && conv.clip) { e.preventDefault(); conv.handsFreePaused = true; conv.clip.stop(); return; }
  if (t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
  if (e.altKey || e.metaKey || e.ctrlKey && currentView !== "practice") return;
  if (currentView === "reading") { if (!(t.tagName === "BUTTON" && (e.code === "Space" || e.key === "Enter"))) readingKey(e); return; }
  if (currentView === "conversa") { if (!(t.tagName === "BUTTON" && (e.code === "Space" || e.key === "Enter"))) convKey(e); return; }
  if (currentView === "practice" && speedOpen()) { if (!(t.tagName === "BUTTON" && (e.code === "Space" || e.key === "Enter"))) speedKey(e); return; }
  if (currentView === "scenes" && !$("scenePlayer").hidden && t.tagName !== "BUTTON") { sceneKey(e); return; }
  if (currentView === "pron") { if (t.tagName !== "BUTTON" || /^[12]$/.test(e.key)) pronKey(e); return; }
  if (currentView === "grammar") { if (t.tagName !== "BUTTON" || /^[1-9]$/.test(e.key) || e.key === "Backspace") exKey(e); return; }
  if (!session.active || !session.card || currentView !== "practice") return;
  const key = e.key.toLowerCase();
  if (e.ctrlKey) { if (key === "z") { e.preventDefault(); undoRating(); } return; }
  const onButton = t.tagName === "BUTTON";
  if (session.step === "present") {
    if ((e.code === "Space" || e.key === "Enter") && !onButton) { e.preventDefault(); continuePresentation(false); }
    else if (key === "k") { e.preventDefault(); continuePresentation(true); }
    else if (key === "r") { e.preventDefault(); speakSession(); }
    else if (key === "d") { e.preventDefault(); speakSession(true); }
    return;
  }
  if (e.code === "Space" || e.key === "Enter") {
    if (onButton) return;
    e.preventDefault();
    if (!session.revealed) revealCard(); else rateCard("good");
  } else if (/^[1-4]$/.test(e.key)) {
    e.preventDefault();
    if (session.revealed) rateCard(GRADES[Number(e.key) - 1]);
  } else if (key === "r") { e.preventDefault(); speakSession(); }
  else if (key === "d") { e.preventDefault(); speakSession(true); }
  else if (key === "z") { e.preventDefault(); undoRating(); }
  else if (key === "f") { e.preventDefault(); toggleSpeechCheck(); }
  else if (key === "s") { e.preventDefault(); shadowing(); }
}

// ---------- Início do app ----------
async function loadProgress() {
  dataDb = await openDataDB();
  const legacy = safeRead(KEY_PROGRESS, null);
  if (dataDb) {
    let loaded = null, failed = null;
    // Uma segunda tentativa cobre travas passageiras do IndexedDB; se falhar de novo, não grava nada.
    for (let attempt = 0; attempt < 2; attempt++) {
      try { loaded = await loadProgressFromDB(); failed = null; break; }
      catch (e) { failed = e; if (!attempt) await new Promise(r => setTimeout(r, 500)); }
    }
    if (failed) {
      reportError("carregar", failed.message, failed.stack);
      progressReadFailed = true;
      setStatus(PROGRESS_READ_MSG, "error");
      return;
    }
    if (loaded) { progress = loaded; return; }
    if (legacy) {
      // Cópia antiga ilegível: não grava por cima nem a apaga.
      try { progress = sanitizeProgress(legacy); } catch (e) { progressReadFailed = true; setStatus(PROGRESS_READ_MSG, "error"); return; }
    }
    dirtyAll = true;
    if (await flushProgress() && legacy) { try { localStorage.removeItem(KEY_PROGRESS); } catch (e) { /* mantém a cópia antiga */ } }
    return;
  }
  if (legacy) {
    try { progress = sanitizeProgress(legacy); } catch (e) { progressReadFailed = true; setStatus(PROGRESS_READ_MSG, "error"); }
  }
}
async function init() {
  const savedSettings = safeRead(KEY_SETTINGS, null);
  if (savedSettings && typeof savedSettings === "object") settings = {...settings, ...savedSettings};
  applyTheme();
  await loadProgress();
  db = await openCatalogDB();
  cards = await readCatalog();
  if (!Array.isArray(cards)) cards = [];
  if (BUNDLED_CARDS.length && safeRead(KEY_CATALOG_VERSION, "") !== BUNDLED_VERSION) {
    try {
      await writeCatalog(BUNDLED_CARDS);
      const merged = new Map(cards.map(c => [c.id, c]));
      BUNDLED_CARDS.forEach(c => merged.set(c.id, c));
      cards = Array.from(merged.values());
      safeWrite(KEY_CATALOG_VERSION, BUNDLED_VERSION);
    } catch (e) { setStatus("Não foi possível armazenar as frases embutidas.", "error"); }
  }
  if (!cards.length && BUNDLED_CARDS.length) cards = BUNDLED_CARDS.slice();
  cards = cards.filter(c => !isMine(c)).concat(mineCards());
  refreshCards();
  populateExams();
  bindEvents();
  if ("speechSynthesis" in window) {
    renderVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", renderVoices);
    setTimeout(renderVoices, 600);
  }
  $("appVersion").textContent = "Versão " + APP_VERSION;
  if (window.satzDesktop) {
    try { desktopInfo = await window.satzDesktop.info(); } catch (e) { desktopInfo = null; }
    if (desktopInfo && desktopInfo.sync && desktopInfo.sync.dir) await syncNow(true);
  }
  refreshAll();
  setSessionMode("production");
  showView("home");
  // GitHub em paralelo: se trouxer progresso, o aviso de restauração some sozinho.
  if (typeof cloudSync === "function") cloudSync({force: true});
  // Textos da Escrita que ficaram sem correção (o app fechou no meio, ou vieram do celular sem sincronização nova).
  if (typeof escritaPump === "function") setTimeout(escritaPump, 6000);
  await offerRestore();
}
init().then(() => { document.documentElement.dataset.ready = "true"; }).catch(e => {
  document.documentElement.dataset.ready = "true";
  window.satzStartupError = e.message;
  reportError("inicialização", e.message, e.stack);
  setStatus("Não foi possível iniciar: " + e.message, "error");
});
