const THEME_TOKENS_REMOTE = "https://lmbreuer.github.io/con-raumplan/theme-tokens.css";
const localThemeHost = location.hostname === "127.0.0.1" || location.hostname === "localhost";
const themeTokens = document.createElement("link");
themeTokens.rel = "stylesheet";
themeTokens.href = localThemeHost ? `${location.protocol}//${location.hostname}:8001/theme-tokens.css` : THEME_TOKENS_REMOTE;
themeTokens.addEventListener("error", () => {
  if (themeTokens.href !== THEME_TOKENS_REMOTE) themeTokens.href = THEME_TOKENS_REMOTE;
}, { once: true });
document.head.appendChild(themeTokens);

try {
  const saved = localStorage.getItem("raumplan-theme");
  const initial = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", initial);
} catch {}
