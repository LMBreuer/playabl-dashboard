const THEMES_REMOTE = "https://lmbreuer.github.io/con-raumplan/themes.css";
const localThemeHost = location.hostname === "127.0.0.1" || location.hostname === "localhost";
const themes = document.createElement("link");
themes.rel = "stylesheet";
themes.href = localThemeHost ? `${location.protocol}//${location.hostname}:8001/themes.css` : THEMES_REMOTE;
themes.addEventListener("error", () => {
  if (themes.href !== THEMES_REMOTE) themes.href = THEMES_REMOTE;
}, { once: true });
document.head.appendChild(themes);

try {
  const saved = localStorage.getItem("raumplan-theme");
  const initial = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", initial);
} catch {}
