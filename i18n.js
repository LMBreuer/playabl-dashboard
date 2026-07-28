const UI_LANGUAGE_KEY = "playabl-dashboard-language";
const UI_COPY = {
  de: {
    skip: "Zum Inhalt springen", nav: "Ansicht, Event und Ziel wählen", overview: "Übersicht", calendar: "Kalender",
    community: "Community", event: "Event wechseln", setup: "Setup", language: "Sprache wählen", targetSetting:"Ziel-Plätze pro Slot", slotsSetting:"Slots",
    setupTitle:"Dashboard-Setup", setupIntro:"Passe Zielkorridor und Zeitfenster für dieses Event an. Die Slot-Einstellung bleibt lokal in diesem Browser.",
    setupClose:"Dialog schließen", setupTargetTitle:"Ziel-Plätze pro Slot", setupFrom:"Von", setupTo:"Bis", setupMin:"Ziel von", setupMax:"Ziel bis",
    setupSlotsTitle:"Slot-Zeiten", setupAdd:"+ Slot hinzufügen", setupResetSlots:"Slots neu ermitteln", setupCancel:"Abbrechen", setupSave:"Setup speichern",
    setupName:"Name", setupRemove:"Slot entfernen", setupInvalidTarget:"Bitte gültige Ziel-Werte angeben (von ≤ bis).", setupInvalidSlots:"Bitte mindestens einen gültigen Slot angeben.",
    infoOpen: "Informationen zu Zielplätzen und Slots", infoClose: "Informationen schließen",
    infoTitle: "Wie funktionieren Zielplätze und Slots?",
    infoIntro: "Hintergrund zur Auswertung, automatischen Erkennung und lokalen Konfiguration.",
    infoTargetTitle: "Ziel-Plätze pro Slot",
    infoTargetText: "Der Zielkorridor beschreibt, wie viele Personen in jedem Zeitfenster durch angebotene Runden untergebracht werden sollen. Wenn Playabl Event-Freischaltungen bereitstellt, schätzt das Dashboard daraus automatisch einen Korridor von ungefähr 85–100 Prozent und rundet ihn sinnvoll. Sobald RSVPs vorhanden sind, dient die höchste eindeutige Nachfrage eines Slots zusätzlich als Untergrenze. Manuelle Werte haben Vorrang; „Ziel neu ermitteln“ stellt die automatische Schätzung wieder her.",
    infoCountText: "<strong>Gezählt werden Spielplätze plus anbietende Person</strong> pro Session. Der Zielwert verändert keine Daten auf Playabl; er steuert ausschließlich die Darstellung und Berechnung in diesem Dashboard.",
    infoSourcesTitle: "Woher kommen die Slots?",
    infoSourceManual: "<strong>Manuelle Einstellung:</strong> Eine im Setup gespeicherte Konfiguration hat immer Vorrang.",
    infoSourcePlan: "<strong>Con-Raumplan:</strong> Ist das Event mit einer Raumplanung verbunden, werden deren Zeitfenster übernommen.",
    infoSourceAuto: "<strong>Automatische Erkennung:</strong> Ohne diese Quellen untersucht das Dashboard beim ersten Laden die Startzeiten aller Sessions.",
    infoSourceFallback: "<strong>Fallback:</strong> Reichen die Daten für eine verlässliche Schätzung nicht aus, gilt Vormittag 0–14 Uhr und Nachmittag 14–24 Uhr.",
    infoDetectionTitle: "Wie funktioniert die automatische Erkennung?",
    infoDetectionText: "Nahe beieinanderliegende Startzeiten werden zu Gruppen zusammengefasst. Eine größere zeitliche Lücke deutet auf einen neuen Slot hin. Aus der Lage dieser Gruppen entstehen Bezeichnungen wie Vormittag, Nachmittag oder Abend sowie passende Grenzen zwischen den Zeitfenstern.",
    infoDetectionStable: "Die Schätzung wird nur einmal angelegt. Danach bleibt sie stabil, auch wenn später neue Sessions dazukommen. Im Setup kann sie jederzeit geprüft und korrigiert werden.",
    infoStorageTitle: "Speicherung und erneute Ermittlung",
    infoStorageText: "Manuell eingestellte oder automatisch erkannte Slots werden nur lokal in diesem Browser gespeichert. Sie verändern weder Playabl noch die Con-Raumplanung. <strong>„Slots neu ermitteln“</strong> entfernt die lokale Slot-Konfiguration und führt die Quellenlogik erneut aus: Raumplanung, automatische Erkennung und zuletzt der Standard-Fallback. Der Zielkorridor bleibt dabei unverändert."
  },
  en: {
    skip: "Skip to content", nav: "Choose view, event and target", overview: "Overview", calendar: "Calendar",
    community: "Community", event: "Change event", setup: "Setup", language: "Choose language", targetSetting:"Target capacity per slot", slotsSetting:"Slots",
    setupTitle:"Dashboard setup", setupIntro:"Adjust the target range and time windows for this event. Slot settings remain local to this browser.",
    setupClose:"Close dialog", setupTargetTitle:"Target capacity per slot", setupFrom:"From", setupTo:"To", setupMin:"Target from", setupMax:"Target to",
    setupSlotsTitle:"Slot times", setupAdd:"+ Add slot", setupResetSlots:"Redetect slots", setupCancel:"Cancel", setupSave:"Save setup",
    setupName:"Name", setupRemove:"Remove slot", setupInvalidTarget:"Enter a valid target range (from ≤ to).", setupInvalidSlots:"Enter at least one valid slot.",
    infoOpen: "Information about target capacity and slots", infoClose: "Close information",
    infoTitle: "How do target capacity and slots work?",
    infoIntro: "Background on the analysis, automatic detection, and local configuration.",
    infoTargetTitle: "Target capacity per slot",
    infoTargetText: "The target range describes how many people should be accommodated by the sessions offered in each time window. When Playabl provides event access data, the dashboard automatically estimates a range of roughly 85–100 percent and rounds it sensibly. Once RSVPs exist, the highest unique demand in any slot also acts as a lower bound. Manual values take priority; “Redetect target” restores the automatic estimate.",
    infoCountText: "<strong>Capacity includes player seats plus the person running the session</strong> for every session. The target does not change any data on Playabl; it is used only for the dashboard’s display and calculations.",
    infoSourcesTitle: "Where do the slots come from?",
    infoSourceManual: "<strong>Manual configuration:</strong> A configuration saved in Setup always takes priority.",
    infoSourcePlan: "<strong>Con room plan:</strong> If the event is linked to a room plan, its time windows are used.",
    infoSourceAuto: "<strong>Automatic detection:</strong> Without either source, the dashboard examines all session start times when the event is loaded for the first time.",
    infoSourceFallback: "<strong>Fallback:</strong> If there is not enough data for a reliable estimate, the defaults are Morning 0–14 and Afternoon 14–24.",
    infoDetectionTitle: "How does automatic detection work?",
    infoDetectionText: "Start times that are close together are grouped. A larger gap indicates the beginning of a new slot. The positions of these groups produce labels such as Morning, Afternoon, or Evening, together with suitable boundaries between the time windows.",
    infoDetectionStable: "The estimate is created only once. It then remains stable even when more sessions are added later. It can be reviewed and corrected in Setup at any time.",
    infoStorageTitle: "Storage and redetection",
    infoStorageText: "Manually configured or automatically detected slots are stored only in this browser. They do not change Playabl or the con room plan. <strong>“Redetect slots”</strong> removes the local slot configuration and runs the source logic again: room plan, automatic detection, and finally the standard fallback. The target range remains unchanged."
  }
};
function applyLanguage(language) {
  const key = UI_COPY[language] ? language : "de";
  const copy = UI_COPY[key];
  document.documentElement.lang = key;
  try { localStorage.setItem(UI_LANGUAGE_KEY, key); } catch {}
  document.querySelectorAll("[data-language]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.language === key)));
  document.querySelector(".skip-link").textContent = copy.skip;
  document.querySelector(".language-switch").setAttribute("aria-label", copy.language);
  document.querySelector(".controls").setAttribute("aria-label", copy.nav);
  document.getElementById("tabOverview").textContent = copy.overview;
  document.getElementById("tabCalendar").textContent = copy.calendar;
  document.querySelector("label[for='communitySelect']").textContent = copy.community;
  document.querySelector("label[for='eventSelect']").textContent = copy.event;
  document.getElementById("slotConfigOpen").textContent = copy.setup;
  document.getElementById("slotConfigTitle").textContent = copy.setupTitle;
  document.getElementById("slotConfigIntro").textContent = copy.setupIntro;
  document.getElementById("slotConfigClose").setAttribute("aria-label", copy.setupClose);
  document.getElementById("setupTargetTitle").textContent = copy.setupTargetTitle;
  document.getElementById("targetMinLabel").textContent = copy.setupFrom;
  document.getElementById("zielMin").setAttribute("aria-label", copy.setupMin);
  document.getElementById("targetMaxLabel").textContent = copy.setupTo;
  document.getElementById("zielMax").setAttribute("aria-label", copy.setupMax);
  document.getElementById("setupSlotsTitle").textContent = copy.setupSlotsTitle;
  document.getElementById("slotConfigAdd").textContent = copy.setupAdd;
  document.getElementById("slotConfigReset").textContent = copy.setupResetSlots;
  document.getElementById("slotConfigCancel").textContent = copy.setupCancel;
  document.getElementById("slotConfigSave").textContent = copy.setupSave;
  document.querySelectorAll("[data-slot-name-copy]").forEach(element => { element.textContent = copy.setupName; });
  document.querySelectorAll("[data-slot-from-copy]").forEach(element => { element.textContent = copy.setupFrom; });
  document.querySelectorAll("[data-slot-to-copy]").forEach(element => { element.textContent = copy.setupTo; });
  document.querySelectorAll("[data-slot-remove]").forEach(element => { element.setAttribute("aria-label", copy.setupRemove); });
  const settingLabels = document.querySelectorAll(".setting-summary-label");
  if (settingLabels[0]) settingLabels[0].textContent = copy.targetSetting;
  if (settingLabels[1]) settingLabels[1].textContent = copy.slotsSetting;
  document.getElementById("settingsInfoOpen").setAttribute("aria-label", copy.infoOpen);
  document.getElementById("settingsInfoClose").setAttribute("aria-label", copy.infoClose);
  document.getElementById("settingsInfoTitle").textContent = copy.infoTitle;
  document.getElementById("settingsInfoIntro").textContent = copy.infoIntro;
  document.getElementById("settingsInfoTargetTitle").textContent = copy.infoTargetTitle;
  document.getElementById("settingsInfoTargetText").textContent = copy.infoTargetText;
  document.getElementById("settingsInfoCountText").innerHTML = copy.infoCountText;
  document.getElementById("settingsInfoSourcesTitle").textContent = copy.infoSourcesTitle;
  document.getElementById("settingsInfoSourceManual").innerHTML = copy.infoSourceManual;
  document.getElementById("settingsInfoSourcePlan").innerHTML = copy.infoSourcePlan;
  document.getElementById("settingsInfoSourceAuto").innerHTML = copy.infoSourceAuto;
  document.getElementById("settingsInfoSourceFallback").innerHTML = copy.infoSourceFallback;
  document.getElementById("settingsInfoDetectionTitle").textContent = copy.infoDetectionTitle;
  document.getElementById("settingsInfoDetectionText").textContent = copy.infoDetectionText;
  document.getElementById("settingsInfoDetectionStable").textContent = copy.infoDetectionStable;
  document.getElementById("settingsInfoStorageTitle").textContent = copy.infoStorageTitle;
  document.getElementById("settingsInfoStorageText").innerHTML = copy.infoStorageText;
  const germanContent = ["app","calView","status","rsvpBanner","pageSub","credits","slotsSummary","slotsSourceSummary"];
  for (const id of germanContent) {
    const element = document.getElementById(id);
    if (!element) continue;
    if (key === "en") element.setAttribute("lang", "de");
    else element.removeAttribute("lang");
  }
  document.querySelector(".dashboard-eyebrow")?.toggleAttribute("lang", key === "en");
  if (key === "en") document.querySelector(".dashboard-eyebrow")?.setAttribute("lang", "de");
  document.querySelectorAll(".theme-switch-group").forEach(renderThemeSwitch);
  renderContrastAidSwitch();
  renderArtCaption();
  window.dispatchEvent(new CustomEvent("uilanguagechange", { detail:{ language:key } }));
}
document.querySelector(".language-switch").addEventListener("click", event => {
  const button = event.target.closest("button[data-language]");
  if (button) applyLanguage(button.dataset.language);
});
try { applyLanguage(localStorage.getItem(UI_LANGUAGE_KEY) || "de"); } catch { applyLanguage("de"); }
