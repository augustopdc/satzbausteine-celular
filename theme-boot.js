"use strict";
/* Aplica o tema salvo antes da primeira pintura, para não piscar a cor errada. */
(() => {
  try {
    const theme = localStorage.getItem("satzbausteine.theme");
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch (e) { /* armazenamento indisponível: segue o sistema */ }
  // Fora do aplicativo do PC (navegador, iPhone): esconde as telas que dependem do PC (Whisper, IA local, livros).
  if (!window.satzDesktop) document.documentElement.classList.add("web");
  // Windows 11 com a barra de título do app: abre espaço em cima para os botões da janela (e some em tela cheia).
  const wco = navigator.windowControlsOverlay;
  // Só no app do PC: num navegador com barra própria (Chrome instalado, painel do Claude) o botão ☰ não teria o que abrir.
  const setWco = () => document.documentElement.classList.toggle("wco", !!(window.satzDesktop && wco && wco.visible));
  setWco();
  if (wco) wco.addEventListener("geometrychange", setWco);
})();
