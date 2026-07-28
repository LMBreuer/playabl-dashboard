// Standardwerte, falls Eventdaten, URL-Parameter oder erkannte Slots fehlen.
const CONFIG = {
  eventId: 104,
  zielMin: 70,
  zielMax: 80,
  zielNotiz: "Erfahrungswert aus dem Vorjahr: 13–16 Sessions für 70–80 Personen je Slot",
  erwartete: "~90",
  cutoffStunde: 14,
  zeitzone: "Europe/Vienna",
  // Optionale Familienwertung nach Nennungen in System, Titel oder Beschreibung.
  systemFamilien: [
    "Carved from Brindlewood",
    "Powered by the Apocalypse",
    "Belonging Outside Belonging",
    "Forged in the Dark",
    "Descended from the Queen",
    "No Dice No Masters",
  ],
};

// Workshops und Specials werden getrennt von den Kapazitäten ausgewertet.
const WS_RE = /workshop|panel|vortrag/i;

const params  = new URLSearchParams(location.search);
const EVENT   = params.get("event") || String(CONFIG.eventId);
let LO        = parseInt(params.get("min") || CONFIG.zielMin, 10);
let HI        = parseInt(params.get("max") || CONFIG.zielMax, 10);
const CUTOFF  = CONFIG.cutoffStunde;
const TZ      = CONFIG.zeitzone;
const EVENT_URL = `https://app.playabl.io/events/${EVENT}/overview`;
let activeTargetSource = params.has("min") || params.has("max") ? "manual" : "fallback";
let eligibleTargetCount = null;
let peakTargetRsvps = 0;
