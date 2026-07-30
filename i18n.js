const UI_LANGUAGE_KEY = "playabl-dashboard-language";
const UI_COPY = {
  de: {
    skip: "Zum Inhalt springen", header:"Dashboard-Kopfzeile", eyebrow: "Playabl · Spielangebot pro Slot", pageLoading:"Spielangebot pro Slot", dataLoading:"Daten werden live von Playabl geladen …", statusLoading:"Lade Daten von Playabl …", slotsLoading:"werden geladen …",
    nav: "Ansicht, Event und Ziel wählen", view:"Ansicht", activeSettings:"Aktive Einstellungen", theme:"Farbschema wählen", calendarView:"Kalender-Ansicht", overview: "Übersicht", calendar: "Kalender",
    contextTitle:"Kontext", contextIntro:"Zufällige Ausschnitte aus Rundenbeschreibungen.", contextClose:"Kontext schließen", contextRefresh:"Andere Ausschnitte", sectionInfoTitle:"Information", sectionInfoClose:"Information schließen",
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
    infoCountText: "<strong>Gezählt werden Spielplätze plus anbietende Person</strong> pro platzrelevanter Session. Journaling, Workshops und eindeutig slot-unabhängige Formate werden als Sonderformate gekennzeichnet. Sie bleiben im Kalender und in der Programmliste sichtbar, fließen aber nicht in Platzbedarf, freie Plätze oder Zielerreichung ein. Der Zielwert verändert keine Daten auf Playabl.",
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
    skip: "Skip to content", header:"Dashboard header", eyebrow: "Playabl · Session capacity per slot", pageLoading:"Session capacity per slot", dataLoading:"Data is loaded live from Playabl …", statusLoading:"Loading data from Playabl …", slotsLoading:"loading …",
    nav: "Choose view, event and target", view:"View", activeSettings:"Active settings", theme:"Choose colour scheme", calendarView:"Calendar view", overview: "Overview", calendar: "Calendar",
    contextTitle:"Context", contextIntro:"Random excerpts from session descriptions.", contextClose:"Close context", contextRefresh:"Different excerpts", sectionInfoTitle:"Information", sectionInfoClose:"Close information",
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
    infoCountText: "<strong>Capacity includes player seats plus the person running each capacity-relevant session.</strong> Journaling, workshops, and clearly slot-independent formats are marked as special formats. They remain visible in the calendar and programme list, but are excluded from demand, available-seat, and target calculations. The target does not change any data on Playabl.",
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
  document.querySelector(".dashboard-head").setAttribute("aria-label", copy.header);
  document.querySelector(".dashboard-eyebrow").firstChild.nodeValue = copy.eyebrow;
  document.querySelector(".controls-group .sr-only").textContent = copy.theme;
  document.querySelector(".language-switch").setAttribute("aria-label", copy.language);
  document.querySelector(".controls").setAttribute("aria-label", copy.nav);
  document.querySelector(".tabs").setAttribute("aria-label", copy.view);
  document.querySelector(".controls-settings").setAttribute("aria-label", copy.activeSettings);
  document.getElementById("calView").setAttribute("aria-label", copy.calendarView);
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
  document.getElementById("wordContextTitle").textContent = copy.contextTitle;
  document.getElementById("wordContextIntro").textContent = copy.contextIntro;
  document.getElementById("wordContextClose").setAttribute("aria-label", copy.contextClose);
  document.getElementById("wordContextRefresh").textContent = copy.contextRefresh;
  document.getElementById("sectionInfoTitle").textContent = copy.sectionInfoTitle;
  document.getElementById("sectionInfoClose").setAttribute("aria-label", copy.sectionInfoClose);
  if (typeof dashboardState === "undefined" || !dashboardState) {
    document.getElementById("pageTitle").textContent = copy.pageLoading;
    document.getElementById("pageSub").textContent = copy.dataLoading;
    document.getElementById("status").textContent = copy.statusLoading;
    document.getElementById("slotsSummary").textContent = copy.slotsLoading;
  }
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
