function estimateTargetRange(eligible, peakRsvps = 0) {
  const step = eligible >= 40 ? 5 : 1;
  let high = step === 1 ? eligible : Math.max(step, Math.floor(eligible / step) * step);
  let low = Math.max(step, Math.ceil((eligible * .85) / step) * step);
  low = Math.max(low, peakRsvps);
  if (low > high) high = low;
  return { low, high };
}
function peakUniqueRsvps(sessions, buckets) {
  const bySlot = new Map();
  for (const session of sessions) {
    if (capacityFormat(session.game_id) !== "capacity") continue;
    const date = dayKey.format(new Date(session.start_time));
    const hour = hourOf(session.start_time);
    const bucket = buckets.find(item => hour >= item.start_hour && hour < item.end_hour);
    const key = `${date}|${bucket?.label || "Unsortiert"}`;
    if (!bySlot.has(key)) bySlot.set(key, new Set());
    for (const userId of session.rsvps || []) bySlot.get(key).add(userId);
  }
  return Math.max(0, ...[...bySlot.values()].map(users => users.size));
}
function targetSourceLabel() {
  const en = document.documentElement.lang === "en";
  if (activeTargetSource === "manual") return en ? "· manual" : "· manuell";
  if (activeTargetSource === "access") return en
    ? `· estimated from ${eligibleTargetCount} event access grants`
    : `· geschätzt aus ${eligibleTargetCount} Event-Freischaltungen`;
  return en ? "· standard" : "· Standard";
}
function updateTargetMeta() {
  const source = document.getElementById("targetSourceSummary");
  const note = document.getElementById("targetEstimateNote");
  const reset = document.getElementById("targetConfigReset");
  if (source) source.textContent = targetSourceLabel();
  const en = document.documentElement.lang === "en";
  if (reset) reset.textContent = en ? "Redetect target" : "Ziel neu ermitteln";
  const cloudHeading = document.getElementById("cloudHeading");
  const cloudHint = document.getElementById("cloudHint");
  const cloud = document.getElementById("cloud");
  if (cloudHeading) cloudHeading.textContent = en ? "Word cloud from session descriptions" : "Wortwolke aus den Rundenbeschreibungen";
  if (cloudHint) cloudHint.textContent = en
    ? "Hover over a word to see its frequency and share; click it for random excerpts in context."
    : "Mit der Maus über ein Wort fahren zeigt Häufigkeit und Anteil; ein Klick öffnet zufällige Ausschnitte im Kontext.";
  if (cloud) cloud.setAttribute("aria-label", en ? "Interactive word cloud" : "Interaktive Wortwolke");
  if (!note) return;
  if (activeTargetSource === "access") {
    note.textContent = en
      ? `Automatically estimated from ${eligibleTargetCount} event access grants (about 85–100%).${peakTargetRsvps ? ` Current peak slot demand: ${peakTargetRsvps} unique RSVPs.` : ""}`
      : `Automatisch aus ${eligibleTargetCount} Event-Freischaltungen geschätzt (ca. 85–100 %).${peakTargetRsvps ? ` Bisher höchste Slot-Nachfrage: ${peakTargetRsvps} eindeutige RSVPs.` : ""}`;
  } else if (activeTargetSource === "manual") {
    note.textContent = en ? "Manually configured target range." : "Manuell eingestellter Zielkorridor.";
  } else {
    note.textContent = en ? "No usable event access data; the configured default is used." : "Keine nutzbaren Event-Freischaltungen; der konfigurierte Standard wird verwendet.";
  }
}
window.addEventListener("uilanguagechange", updateTargetMeta);

const isEnglish = () => document.documentElement.lang === "en";
const locale = () => isEnglish() ? "en-GB" : "de-AT";
const formatTime = value => new Intl.DateTimeFormat(locale(), { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const translateSlotPart = value => {
  if (!isEnglish()) return value;
  return ({ Vormittag:"Morning", Nachmittag:"Afternoon", Abend:"Evening", Unsortiert:"Unsorted" })[value] || value;
};
const dayKey = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourOf = t => parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(t)), 10);

const localSlotKey = `playabl-dashboard-slot-buckets:${EVENT}`;
const localSlotSourceKey = `playabl-dashboard-slot-source:${EVENT}`;
let activeSlotBuckets = [];
let activeSlotSource = "";
function loadLocalSlotBuckets() {
  try {
    const rows = JSON.parse(localStorage.getItem(localSlotKey) || "[]");
    return Array.isArray(rows) ? rows.filter(b => b && b.label && Number.isFinite(+b.start_hour) && Number.isFinite(+b.end_hour) && +b.start_hour < +b.end_hour)
      .map(b => ({ label:String(b.label), start_hour:+b.start_hour, end_hour:+b.end_hour })) : [];
  } catch { return []; }
}
function sessionStartMinute(session) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone:TZ, hour:"2-digit", minute:"2-digit", hour12:false
  }).formatToParts(new Date(session.start_time));
  const hour = +(parts.find(part => part.type === "hour")?.value || 0) % 24;
  const minute = +(parts.find(part => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}
function inferSlotBuckets(sessions) {
  const starts = sessions.filter(session => capacityFormat(session.game_id) === "capacity")
    .map(sessionStartMinute).filter(Number.isFinite).sort((a, b) => a - b);
  if (starts.length < 4) return [];

  const clusterWithGap = gap => {
    const clusters = [];
    for (const minute of starts) {
      const current = clusters[clusters.length - 1];
      if (!current || minute - current[current.length - 1] >= gap) clusters.push([minute]);
      else current.push(minute);
    }
    return clusters;
  };
  let clusters = clusterWithGap(120);
  if (clusters.length > 4) clusters = clusterWithGap(180);
  if (clusters.length < 2 || clusters.length > 4) return [];

  // Sehr kleine Gruppen in der Nähe eines größeren Clusters sind meist
  // Ausreißer und keine eigenen Programm-Slots.
  const tinyLimit = Math.max(1, Math.ceil(starts.length * .04));
  for (let i = clusters.length - 1; i >= 0; i--) {
    if (clusters.length <= 2 || clusters[i].length > tinyLimit) continue;
    const prevGap = i > 0 ? clusters[i][0] - clusters[i - 1][clusters[i - 1].length - 1] : Infinity;
    const nextGap = i < clusters.length - 1 ? clusters[i + 1][0] - clusters[i][clusters[i].length - 1] : Infinity;
    if (Math.min(prevGap, nextGap) > 240) continue;
    const neighbor = prevGap <= nextGap ? i - 1 : i + 1;
    clusters[neighbor].push(...clusters[i]);
    clusters[neighbor].sort((a, b) => a - b);
    clusters.splice(i, 1);
  }
  if (clusters.length < 2) return [];

  const baseNames = clusters.map(cluster => {
    const center = cluster[Math.floor(cluster.length / 2)];
    return center < 12 * 60 ? "Vormittag" : center < 17 * 60 ? "Nachmittag" : "Abend";
  });
  const names = baseNames.map((name, index) =>
    baseNames.indexOf(name) === index && baseNames.lastIndexOf(name) === index ? name : `Slot ${index + 1}`);
  const boundaries = clusters.slice(1).map(cluster => Math.max(1, Math.min(23, Math.floor(cluster[0] / 60))));
  if (new Set(boundaries).size !== boundaries.length) return [];
  return clusters.map((cluster, index) => ({
    label:names[index],
    start_hour:index === 0 ? 0 : boundaries[index - 1],
    end_hour:index === clusters.length - 1 ? 24 : boundaries[index]
  }));
}
function slotConfigRow(bucket = { label:"", start_hour:9, end_hour:13 }) {
  const copy = UI_COPY[document.documentElement.lang] || UI_COPY.de;
  return `<div class="slot-config-row"><label><span data-slot-name-copy>${copy.setupName}</span><input data-slot-label value="${bucket.label.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}" required></label><label><span data-slot-from-copy>${copy.setupFrom}</span><input data-slot-start type="number" min="0" max="23" value="${bucket.start_hour}" required></label><label><span data-slot-to-copy>${copy.setupTo}</span><input data-slot-end type="number" min="1" max="24" value="${bucket.end_hour}" required></label><button type="button" data-slot-remove aria-label="${copy.setupRemove}">×</button></div>`;
}
function openSlotConfig() {
  const shown = activeSlotBuckets.length ? activeSlotBuckets : [{ label:"Vormittag", start_hour:0, end_hour:14 }, { label:"Nachmittag", start_hour:14, end_hour:24 }];
  document.getElementById("slotConfigRows").innerHTML = shown
    .map(bucket => slotConfigRow({ ...bucket, label:translateSlotPart(bucket.label) }))
    .join("");
  document.getElementById("zielMin").value = LO;
  document.getElementById("zielMax").value = HI;
  const dialog = document.getElementById("slotConfigDlg");
  clearSlotDrag();
  dialog.style.left = "50%";
  dialog.style.right = "auto";
  dialog.style.top = "50%";
  dialog.style.bottom = "auto";
  dialog.style.transform = "translate(-50%,-50%)";
  dialog.showModal();
}

const slotDialog = document.getElementById("slotConfigDlg");
const slotDialogHandle = slotDialog.querySelector(".slot-config-header");
let slotDrag = null;
function clearSlotDrag() {
  if (slotDrag && slotDialogHandle.hasPointerCapture(slotDrag.pointerId)) slotDialogHandle.releasePointerCapture(slotDrag.pointerId);
  slotDrag = null;
}
slotDialogHandle.addEventListener("pointerdown", event => {
  if (event.pointerType === "touch" || event.target.closest("button")) return;
  const rect = slotDialog.getBoundingClientRect();
  slotDialog.style.left = rect.left + "px";
  slotDialog.style.top = rect.top + "px";
  slotDialog.style.transform = "none";
  slotDrag = { pointerId:event.pointerId, dx:event.clientX - rect.left, dy:event.clientY - rect.top };
  slotDialogHandle.setPointerCapture(event.pointerId);
});
slotDialogHandle.addEventListener("pointermove", event => {
  if (!slotDrag || event.pointerId !== slotDrag.pointerId) return;
  const margin = 12;
  const rect = slotDialog.getBoundingClientRect();
  const left = Math.min(innerWidth - rect.width - margin, Math.max(margin, event.clientX - slotDrag.dx));
  const top = Math.min(innerHeight - rect.height - margin, Math.max(margin, event.clientY - slotDrag.dy));
  slotDialog.style.left = left + "px";
  slotDialog.style.top = top + "px";
});
function stopSlotDrag(event) {
  if (!slotDrag || event.pointerId !== slotDrag.pointerId) return;
  slotDrag = null;
  if (slotDialogHandle.hasPointerCapture(event.pointerId)) slotDialogHandle.releasePointerCapture(event.pointerId);
}
slotDialogHandle.addEventListener("pointerup", stopSlotDrag);
slotDialogHandle.addEventListener("pointercancel", stopSlotDrag);
slotDialogHandle.addEventListener("lostpointercapture", () => { slotDrag = null; });
slotDialog.addEventListener("close", clearSlotDrag);

const infoDialog = document.getElementById("settingsInfoDlg");
const infoDialogHandle = infoDialog.querySelector(".slot-config-header");
let infoDrag = null;
function clearInfoDrag() {
  if (infoDrag && infoDialogHandle.hasPointerCapture(infoDrag.pointerId)) infoDialogHandle.releasePointerCapture(infoDrag.pointerId);
  infoDrag = null;
}
function openInfoDialog() {
  clearInfoDrag();
  infoDialog.style.inset = "50% auto auto 50%";
  infoDialog.style.transform = "translate(-50%,-50%)";
  infoDialog.showModal();
}
document.getElementById("settingsInfoOpen").addEventListener("click", openInfoDialog);
document.getElementById("settingsInfoClose").addEventListener("click", () => infoDialog.close());
infoDialogHandle.addEventListener("pointerdown", event => {
  if (event.pointerType === "touch" || event.target.closest("button")) return;
  const rect = infoDialog.getBoundingClientRect();
  infoDialog.style.inset = `${rect.top}px auto auto ${rect.left}px`;
  infoDialog.style.transform = "none";
  infoDrag = { pointerId:event.pointerId, dx:event.clientX - rect.left, dy:event.clientY - rect.top };
  infoDialogHandle.setPointerCapture(event.pointerId);
});
infoDialogHandle.addEventListener("pointermove", event => {
  if (!infoDrag || event.pointerId !== infoDrag.pointerId) return;
  const margin = 12;
  const rect = infoDialog.getBoundingClientRect();
  infoDialog.style.left = Math.min(innerWidth - rect.width - margin, Math.max(margin, event.clientX - infoDrag.dx)) + "px";
  infoDialog.style.top = Math.min(innerHeight - rect.height - margin, Math.max(margin, event.clientY - infoDrag.dy)) + "px";
});
function stopInfoDrag(event) {
  if (!infoDrag || event.pointerId !== infoDrag.pointerId) return;
  infoDrag = null;
  if (infoDialogHandle.hasPointerCapture(event.pointerId)) infoDialogHandle.releasePointerCapture(event.pointerId);
}
infoDialogHandle.addEventListener("pointerup", stopInfoDrag);
infoDialogHandle.addEventListener("pointercancel", stopInfoDrag);
infoDialogHandle.addEventListener("lostpointercapture", () => { infoDrag = null; });
infoDialog.addEventListener("close", clearInfoDrag);

const wordContextDialog = document.getElementById("wordContextDlg");
const wordContextHandle = wordContextDialog.querySelector(".slot-config-header");
let wordContextDrag = null;
let activeWordContext = null;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
})[char]);
function wordContextSnippet(text, word) {
  const lower = text.toLocaleLowerCase();
  const index = lower.indexOf(word.toLocaleLowerCase());
  if (index < 0) return escapeHtml(text.slice(0, 210));
  let start = Math.max(0, index - 90);
  let end = Math.min(text.length, index + word.length + 125);
  if (start) {
    const nextSpace = text.indexOf(" ", start);
    if (nextSpace > -1 && nextSpace < index) start = nextSpace + 1;
  }
  if (end < text.length) {
    const previousSpace = text.lastIndexOf(" ", end);
    if (previousSpace > index) end = previousSpace;
  }
  const before = escapeHtml(text.slice(start, index));
  const match = escapeHtml(text.slice(index, index + word.length));
  const after = escapeHtml(text.slice(index + word.length, end));
  return `${start ? "…" : ""}${before}<mark>${match}</mark>${after}${end < text.length ? "…" : ""}`;
}
function renderWordContexts() {
  if (!activeWordContext) return;
  const en = document.documentElement.lang === "en";
  const refresh = document.getElementById("wordContextRefresh");
  if (activeWordContext.type === "system") {
    const { name, matches, family } = activeWordContext;
    document.getElementById("wordContextTitle").textContent = en ? `Games using “${name}”` : `Spiele mit „${name}“`;
    document.getElementById("wordContextIntro").textContent = family
      ? (en ? "Sessions whose system, title, or description mentions this system family." : "Runden, die diese Systemfamilie im Systemfeld, Titel oder in der Beschreibung erwähnen.")
      : (en ? "Sessions that use this entry in their system field." : "Runden, die diesen Eintrag im Systemfeld verwenden.");
    document.getElementById("wordContextMeta").textContent = en
      ? `${matches.length} ${matches.length === 1 ? "session" : "sessions"}.`
      : `${matches.length} ${matches.length === 1 ? "Runde" : "Runden"}.`;
    refresh.hidden = true;
    document.getElementById("wordContextClose").setAttribute("aria-label", en ? "Close game list" : "Spieleliste schließen");
    document.getElementById("wordContextList").innerHTML = matches.map(game =>
      `<article class="word-context-quote"><p><a href="https://app.playabl.io/games/${game.id}" target="_blank" rel="noopener">${escapeHtml(game.title)}</a></p><footer>${escapeHtml(game.system || (en ? "No system specified" : "Kein System angegeben"))}</footer></article>`
    ).join("");
    return;
  }
  const { word, n, matches, total } = activeWordContext;
  const percent = Math.round(matches.length / Math.max(1, total) * 100);
  document.getElementById("wordContextTitle").textContent = en ? `“${word}” in context` : `„${word}“ im Kontext`;
  document.getElementById("wordContextIntro").textContent = en
    ? "Random excerpts from the descriptions in which the word appears."
    : "Zufällige Ausschnitte aus Beschreibungen, in denen das Wort vorkommt.";
  document.getElementById("wordContextMeta").textContent = en
    ? `${n} mentions across ${matches.length} of ${total} sessions (${percent}%).`
    : `${n} Nennungen in ${matches.length} von ${total} Runden (${percent} %).`;
  refresh.hidden = false;
  refresh.textContent = en ? "Different excerpts" : "Andere Ausschnitte";
  document.getElementById("wordContextClose").setAttribute("aria-label", en ? "Close context" : "Kontext schließen");
  const shuffled = [...matches].sort(() => Math.random() - .5).slice(0, 3);
  document.getElementById("wordContextList").innerHTML = shuffled.map(({ game, text }) =>
    `<blockquote class="word-context-quote"><p>${wordContextSnippet(text, word)}</p><footer>— <a href="https://app.playabl.io/games/${game.id}" target="_blank" rel="noopener">${escapeHtml(game.title)}</a></footer></blockquote>`
  ).join("");
}
function openWordContext(context) {
  activeWordContext = context;
  renderWordContexts();
  wordContextDrag = null;
  wordContextDialog.style.inset = "50% auto auto 50%";
  wordContextDialog.style.transform = "translate(-50%,-50%)";
  wordContextDialog.showModal();
}
document.getElementById("wordContextClose").addEventListener("click", () => wordContextDialog.close());
document.getElementById("wordContextRefresh").addEventListener("click", renderWordContexts);
window.addEventListener("uilanguagechange", () => {
  if (wordContextDialog.open) renderWordContexts();
});
wordContextHandle.addEventListener("pointerdown", event => {
  if (event.pointerType === "touch" || event.target.closest("button")) return;
  const rect = wordContextDialog.getBoundingClientRect();
  wordContextDialog.style.inset = `${rect.top}px auto auto ${rect.left}px`;
  wordContextDialog.style.transform = "none";
  wordContextDrag = { pointerId:event.pointerId, dx:event.clientX - rect.left, dy:event.clientY - rect.top };
  wordContextHandle.setPointerCapture(event.pointerId);
});
wordContextHandle.addEventListener("pointermove", event => {
  if (!wordContextDrag || event.pointerId !== wordContextDrag.pointerId) return;
  const margin = 12;
  const rect = wordContextDialog.getBoundingClientRect();
  wordContextDialog.style.left = Math.min(innerWidth - rect.width - margin, Math.max(margin, event.clientX - wordContextDrag.dx)) + "px";
  wordContextDialog.style.top = Math.min(innerHeight - rect.height - margin, Math.max(margin, event.clientY - wordContextDrag.dy)) + "px";
});
function stopWordContextDrag(event) {
  if (!wordContextDrag || event.pointerId !== wordContextDrag.pointerId) return;
  wordContextDrag = null;
  if (wordContextHandle.hasPointerCapture(event.pointerId)) wordContextHandle.releasePointerCapture(event.pointerId);
}
wordContextHandle.addEventListener("pointerup", stopWordContextDrag);
wordContextHandle.addEventListener("pointercancel", stopWordContextDrag);
wordContextHandle.addEventListener("lostpointercapture", () => { wordContextDrag = null; });
wordContextDialog.addEventListener("close", () => { wordContextDrag = null; });

const sectionInfoDialog = document.getElementById("sectionInfoDlg");
const sectionInfoHandle = sectionInfoDialog.querySelector(".slot-config-header");
let sectionInfoEntries = {};
let activeSectionInfoKey = "";
let sectionInfoDrag = null;
function renderSectionInfo() {
  const entry = sectionInfoEntries[activeSectionInfoKey];
  if (!entry) return;
  const en = document.documentElement.lang === "en";
  const content = typeof entry === "function" ? entry(en) : entry;
  document.getElementById("sectionInfoTitle").textContent = content.title;
  document.getElementById("sectionInfoIntro").textContent = content.intro;
  document.getElementById("sectionInfoContent").innerHTML = content.html;
  document.getElementById("sectionInfoClose").setAttribute("aria-label", en ? "Close information" : "Information schließen");
}
function openSectionInfo(key) {
  if (!sectionInfoEntries[key]) return;
  activeSectionInfoKey = key;
  renderSectionInfo();
  sectionInfoDrag = null;
  sectionInfoDialog.style.inset = "50% auto auto 50%";
  sectionInfoDialog.style.transform = "translate(-50%,-50%)";
  sectionInfoDialog.showModal();
}
document.addEventListener("click", event => {
  const button = event.target.closest("[data-section-info]");
  if (button) openSectionInfo(button.dataset.sectionInfo);
});
document.getElementById("sectionInfoClose").addEventListener("click", () => sectionInfoDialog.close());
window.addEventListener("uilanguagechange", () => {
  if (sectionInfoDialog.open) renderSectionInfo();
});
sectionInfoHandle.addEventListener("pointerdown", event => {
  if (event.pointerType === "touch" || event.target.closest("button")) return;
  const rect = sectionInfoDialog.getBoundingClientRect();
  sectionInfoDialog.style.inset = `${rect.top}px auto auto ${rect.left}px`;
  sectionInfoDialog.style.transform = "none";
  sectionInfoDrag = { pointerId:event.pointerId, dx:event.clientX - rect.left, dy:event.clientY - rect.top };
  sectionInfoHandle.setPointerCapture(event.pointerId);
});
sectionInfoHandle.addEventListener("pointermove", event => {
  if (!sectionInfoDrag || event.pointerId !== sectionInfoDrag.pointerId) return;
  const margin = 12;
  const rect = sectionInfoDialog.getBoundingClientRect();
  sectionInfoDialog.style.left = Math.min(innerWidth - rect.width - margin, Math.max(margin, event.clientX - sectionInfoDrag.dx)) + "px";
  sectionInfoDialog.style.top = Math.min(innerHeight - rect.height - margin, Math.max(margin, event.clientY - sectionInfoDrag.dy)) + "px";
});
function stopSectionInfoDrag(event) {
  if (!sectionInfoDrag || event.pointerId !== sectionInfoDrag.pointerId) return;
  sectionInfoDrag = null;
  if (sectionInfoHandle.hasPointerCapture(event.pointerId)) sectionInfoHandle.releasePointerCapture(event.pointerId);
}
sectionInfoHandle.addEventListener("pointerup", stopSectionInfoDrag);
sectionInfoHandle.addEventListener("pointercancel", stopSectionInfoDrag);
sectionInfoHandle.addEventListener("lostpointercapture", () => { sectionInfoDrag = null; });
sectionInfoDialog.addEventListener("close", () => { sectionInfoDrag = null; });

// Konfigurierte oder erkannte Slots haben Vorrang vor dem Uhrzeit-Fallback.
function groupSlots(sessions, buckets) {
  const useBuckets = buckets && buckets.length;
  const rank = new Map(useBuckets ? buckets.map((b, i) => [b.label, i]) : [["Vormittag", 0], ["Nachmittag", 1]]);
  const map = new Map();
  for (const s of sessions) {
    const d = dayKey.format(new Date(s.start_time));
    let part;
    if (useBuckets) {
      const h = hourOf(s.start_time);
      const b = buckets.find(b => h >= b.start_hour && h < b.end_hour);
      part = b ? b.label : "Unsortiert";
    } else {
      part = hourOf(s.start_time) < CUTOFF ? "Vormittag" : "Nachmittag";
    }
    const key = d + "|" + part;
    if (!map.has(key)) map.set(key, { date: d, part, dayDate:s.start_time, games: [] });
    map.get(key).games.push({
      title: s.game_id.title.replace(/\s*[\[(][^\])]*(?:3W6|Offline|Con)[^\])]*[\])]\s*/gi, "").trim() || s.game_id.title,
      url: "https://app.playabl.io/games/" + s.game_id.id,
      system: (s.game_id.system || "").trim(),
      facilitator: (s.game_id.creator_id?.username || "").trim(),
      format: capacityFormat(s.game_id),
      seats: s.participant_count + 1,  // Spielplätze + 1 anbietende Person (SL/Moderation)
      playerSeats: s.participant_count,
      rsvps: (s.rsvps || []).length,
      startTime:s.start_time,
      endTime:s.end_time
    });
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || (rank.get(a.part) ?? 99) - (rank.get(b.part) ?? 99));
}

const capacityGames = s => s.games.filter(g => g.format === "capacity");
const specialFormats = s => s.games.filter(g => g.format !== "capacity");
const seatsOf = s => capacityGames(s).reduce((x, g) => x + g.seats, 0);
const slotDay = s => new Intl.DateTimeFormat(locale(), { timeZone:TZ, weekday:"long", day:"2-digit", month:"2-digit" }).format(new Date(s.dayDate));
const slotWeekday = s => new Intl.DateTimeFormat(locale(), { timeZone:TZ, weekday:"long" }).format(new Date(s.dayDate));
const slotName = s => `${slotWeekday(s)} ${translateSlotPart(s.part)}`;
const gameSystem = g => g.system || (isEnglish() ? "No system specified" : "Kein System angegeben");
const gameFacilitator = g => g.facilitator || (isEnglish() ? "Not specified" : "Nicht angegeben");
const frei = g => Math.max(0, g.playerSeats - g.rsvps);
const formatLabel = () => isEnglish() ? "Special format" : "Sonderformat";
const formatReason = format => ({
  programme:isEnglish() ? "workshop or programme item" : "Workshop oder Programmpunkt",
  journaling:"Journaling",
  "slot-independent":isEnglish() ? "clearly runs outside fixed slots" : "läuft laut Beschreibung außerhalb fester Slots"
})[format] || (isEnglish() ? "clear special-format signal" : "eindeutiges Sonderformat-Signal");

function eventRangeText(a, b) {
  const full = new Intl.DateTimeFormat(locale(), { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
  const dayOnly = new Intl.DateTimeFormat(locale(), { timeZone: TZ, day: "numeric" });
  const monthYear = d => new Intl.DateTimeFormat(locale(), { timeZone: TZ, month: "numeric", year: "numeric" }).format(d);
  const dA = new Date(a), dB = new Date(b);
  if (dayOnly.format(dA) === dayOnly.format(dB) && monthYear(dA) === monthYear(dB)) return full.format(dA);
  return monthYear(dA) === monthYear(dB)
    ? `${dayOnly.format(dA)}${isEnglish() ? "–" : ".–"}${full.format(dB)}`
    : `${full.format(dA)} – ${full.format(dB)}`;
}

function applyEvent(ev, rsvpsOpen) {
  const en = isEnglish();
  const name = ev?.title || `Playabl-Event ${EVENT}`;
  document.title = `${name} – ${en ? "Session capacity per slot" : "Spielangebot pro Slot"}`;
  document.getElementById("pageTitle").textContent = name;
  const range = ev?.start_time && ev?.end_time ? eventRangeText(ev.start_time, ev.end_time) : "";
  document.getElementById("pageSub").innerHTML =
    `${range ? `<span class="event-date">${range}</span>` : ""}<span class="event-source">${en ? "Data source" : "Datenquelle"}: <a href="${EVENT_URL}" style="color:inherit">${name} ${en ? "on Playabl" : "auf Playabl"}</a> · ${en ? "loaded live whenever the page opens" : "lädt bei jedem Öffnen live"}</span>`;

  const banner = document.getElementById("rsvpBanner");
  banner.classList.toggle("open", rsvpsOpen);
  if (ev?.fixed_access_time) {
    const when = new Intl.DateTimeFormat(locale(), { timeZone: TZ, dateStyle: "full", timeStyle: "short" }).format(new Date(ev.fixed_access_time));
    banner.hidden = false;
    if (rsvpsOpen) {
      banner.innerHTML = en
        ? `✅ <strong>Registration is open</strong> (since ${when}) – available seats are listed under “Where are seats still available?” and in the calendar.`
        : `✅ <strong>Anmeldung ist offen</strong> (seit ${when} Uhr) – freie Plätze siehe „Wo ist noch Platz?" und Kalender.`;
    } else {
      banner.innerHTML = en
        ? `🔒 <strong>Registration is not open yet</strong> – RSVPs open on ${when}. Until then, the dashboard shows the sessions on offer.`
        : `🔒 <strong>Anmeldung noch gesperrt</strong> – RSVPs öffnen am ${when} Uhr. Bis dahin zeigt die Seite das Angebot.`;
    }
  } else banner.hidden = true;
}

// ---------- Übersichts-Ansicht ----------
function render(slots, rsvpsOpen) {
  const en = isEnglish();
  const t = (de, english) => en ? english : de;
  const app = document.getElementById("app");
  const tooltip = document.getElementById("tooltip");
  const excludedFormats = slots.flatMap(s => specialFormats(s).map(g => ({ ...g, slot: s })));
  const totalSessions = slots.reduce((a, s) => a + s.games.length, 0);
  const capacitySessionCount = slots.reduce((a, s) => a + capacityGames(s).length, 0);
  const totalSeats = slots.reduce((a, s) => a + seatsOf(s), 0);
  const totalRsvps = slots.reduce((a, s) => a + capacityGames(s).reduce((x, g) => x + g.rsvps, 0), 0);
  const showBusy = rsvpsOpen || totalRsvps > 0;
  const avgSeats = totalSeats / Math.max(1, capacitySessionCount);
  const MAX = Math.max(90, HI + 10, ...slots.map(s => seatsOf(s) + 5));
  const pct = v => (v / MAX * 100) + "%";
  const allCapacityGames = slots.flatMap(s => capacityGames(s).map(g => ({ ...g, slot: s })));
  const freeTotal = allCapacityGames.reduce((a, g) => a + frei(g), 0);
  const expectedRaw = String(CONFIG.erwartete || "");
  const expectedApproximate = expectedRaw.startsWith("~");
  const expectedValue = expectedRaw.replace(/^~/, "");
  const expectedMarkup = `<div class="v expected-value" aria-label="${escapeHtml(t(`${expectedApproximate ? "ungefähr " : ""}${expectedValue} pro Tag`, `${expectedApproximate ? "approximately " : ""}${expectedValue} per day`))}">${expectedApproximate ? '<span class="approx-mark" aria-hidden="true">≈</span>' : ""}<span>${escapeHtml(expectedValue)}</span><span class="per-day" aria-hidden="true">/${t("Tag", "day")}</span></div>`;
  const sectionInfoLabel = t;
  sectionInfoEntries = {
    chart: en => ({
      title:en ? "How to read the capacity chart" : "So liest du die Platzgrafik",
      intro:en ? "Meaning of segments, target band, and interactions." : "Bedeutung von Segmenten, Zielband und Interaktionen.",
      html:en
        ? `<section><h3>Sessions and capacity</h3><p>Each blue segment represents a capacity-relevant session. Its width corresponds to the player seats plus the person running it.${showBusy ? " The lighter portion is already occupied." : ""}</p></section><section><h3>Interaction</h3><p>Hover over a segment to see its title and capacity. Clicking opens the session on Playabl; some details may require a login.</p></section><section><h3>Target range</h3><p>The grey band marks the target of ${LO}–${HI} accommodated people per slot.${excludedFormats.length ? " Journaling, workshops, and other slot-independent special formats remain visible in the calendar and programme list, but do not count towards this target." : ""}</p></section>`
        : `<section><h3>Runden und Plätze</h3><p>Jedes blaue Segment steht für eine platzrelevante Session. Seine Breite entspricht den Spielplätzen plus der anbietenden Person.${showBusy ? " Der hellere Anteil ist bereits belegt." : ""}</p></section><section><h3>Interaktion</h3><p>Mouseover zeigt Titel und Kapazität. Ein Klick öffnet die Runde auf Playabl; manche Details sind dort erst nach dem Login sichtbar.</p></section><section><h3>Zielkorridor</h3><p>Das graue Band markiert das Ziel von ${LO}–${HI} untergebrachten Personen pro Slot.${excludedFormats.length ? " Journaling, Workshops und andere slot-unabhängige Sonderformate bleiben im Kalender und in der Programmliste sichtbar, zählen aber nicht zu diesem Ziel." : ""}</p></section>`
    }),
    free: en => ({
      title:en ? "Where are seats still available?" : "Wo ist noch Platz?",
      intro:en ? "How the list is sorted and calculated." : "Sortierung und Berechnung der freien Plätze.",
      html:en
        ? `<section><p>Only regular sessions with available player seats are shown. They are sorted from most to fewest available seats. The person running the session is not counted as an available player seat.</p></section>`
        : `<section><p>Gezeigt werden nur reguläre Runden mit freien Spielplätzen – absteigend nach der Zahl der freien Plätze sortiert. Die anbietende Person zählt dabei nicht als freier Spielplatz.</p></section>`
    }),
    needs: en => ({
      title:en ? "Where are more sessions needed?" : "Wo werden noch Runden gebraucht?",
      intro:en ? "How the remaining demand per slot is calculated." : "Berechnung des zusätzlichen Bedarfs je Slot.",
      html:en
        ? `<section><p>The dashboard compares capacity-relevant seats in each slot with the lower target of ${LO}. Journaling, workshops, and other slot-independent special formats are deliberately excluded. They remain visible in the calendar and programme list, but do not represent seats that need a table in that slot.</p></section>`
        : `<section><p>Das Dashboard vergleicht die platzrelevanten Spielplätze jedes Slots mit dem unteren Zielwert von ${LO}. Journaling, Workshops und andere slot-unabhängige Sonderformate sind bewusst ausgenommen: Sie bleiben im Kalender und in der Programmliste sichtbar, stellen aber keine Plätze dar, für die in diesem Slot ein Spieltisch benötigt wird.</p></section>`
    }),
    specials: en => ({
      title:en ? "Special formats in this event" : "Sonderformate in diesem Event",
      intro:en ? "Visible in the programme, excluded from capacity calculations." : "Im Programm sichtbar, aus der Platzberechnung ausgenommen.",
      html:`<section><p>${en ? "These entries remain in the calendar and full programme list. The reason shown here explains why they do not affect target capacity, available seats, or additional-session demand." : "Diese Einträge bleiben im Kalender und in der vollständigen Programmliste sichtbar. Der angezeigte Grund erklärt, warum sie Zielplätze, freie Plätze und zusätzlichen Rundenbedarf nicht beeinflussen."}</p><ul class="special-format-list">${excludedFormats.map(game => `<li><a href="${game.url}" target="_blank" rel="noopener">${escapeHtml(game.title)}</a><span>${escapeHtml(slotName(game.slot))} · ${formatTime(game.startTime)}–${formatTime(game.endTime)}</span><small>${en ? "Detected as" : "Erkannt als"}: ${escapeHtml(formatReason(game.format))}</small></li>`).join("")}</ul></section>`
    }),
    systems: en => {
      const familyMode = document.getElementById("sysMode")?.value === "mentions";
      return {
        title:en ? "How are systems counted?" : "Wie werden Systeme gezählt?",
        intro:familyMode
          ? (en ? "Current mode: system-family mentions." : "Aktueller Modus: Erwähnungen von Systemfamilien.")
          : (en ? "Current mode: system field only." : "Aktueller Modus: nur das Systemfeld."),
        html:familyMode
          ? (en ? `<section><p>A system family is counted when it appears in a session’s system field, title, or description. One session can therefore match several families. Click a row to see the matching games.</p></section>` : `<section><p>Eine Systemfamilie zählt, wenn sie im Systemfeld, Titel oder in der Beschreibung einer Runde erwähnt wird. Eine Runde kann dadurch zu mehreren Familien passen. Ein Klick auf eine Zeile zeigt die zugehörigen Spiele.</p></section>`)
          : (en ? `<section><p>The list groups identical spellings from the sessions’ system field. Systems offered only once are summarized below the chart. Click a row to see its games.</p></section>` : `<section><p>Die Liste gruppiert gleiche Schreibweisen aus dem Systemfeld der Runden. Systeme, die nur einmal vorkommen, werden unter der Grafik zusammengefasst. Ein Klick auf eine Zeile zeigt die zugehörigen Spiele.</p></section>`)
      };
    },
    cloud: en => ({
      title:en ? "How does the word cloud work?" : "Wie funktioniert die Wortwolke?",
      intro:en ? "Frequency, movement, and excerpts in context." : "Häufigkeit, Bewegung und Ausschnitte im Kontext.",
      html:en
        ? `<section><p>The cloud analyses the session descriptions after common filler words have been removed. Larger words occur more often.</p><p>Hovering shows the number and share of sessions containing the word. Clicking opens random excerpts so the word can be read in context.</p></section>`
        : `<section><p>Die Wortwolke wertet die Rundenbeschreibungen aus, nachdem häufige Füllwörter entfernt wurden. Größere Wörter kommen häufiger vor.</p><p>Mouseover zeigt Anzahl und Anteil der Runden mit diesem Wort. Ein Klick öffnet zufällige Textausschnitte, damit es im Kontext gelesen werden kann.</p></section>`
    })
  };

  app.innerHTML = `
    <div class="bento-grid">
      <section class="kpi bento-hero" aria-labelledby="heroKpiLabel"><div class="l" id="heroKpiLabel">${t("Sessions gesamt", "Total sessions")}</div><div class="v">${totalSessions}</div><div class="bento-hero-copy">${t(`${capacitySessionCount} platzrelevant · ${totalSeats} Spielplätze über ${slots.length} Slots · ø ${avgSeats.toFixed(1).replace(".", ",")}`, `${capacitySessionCount} capacity-relevant · ${totalSeats} seats across ${slots.length} slots · ${avgSeats.toFixed(1)} average`)}</div><div class="bento-slot-bars" role="list" aria-label="${t("Zielstatus der Plätze pro Slot", "Capacity target status by slot")}">${slots.map(s => { const seats = seatsOf(s); const status = seats >= LO ? t("Ziel erreicht", "target reached") : t(`noch ${LO - seats} Plätze bis zum Ziel`, `${LO - seats} seats still needed to reach the target`); const label = `${slotName(s)}: ${seats} ${t("Plätze", "seats")}, ${status}`; return `<span role="listitem" aria-label="${escapeHtml(label)}" class="${seats >= LO ? "is-on-target" : "is-below-target"}" style="--slot-fill:${Math.min(100, seats / LO * 100)}%" title="${escapeHtml(label)}"></span>`; }).join("")}</div><div class="bento-hero-legend" aria-hidden="true">${document.documentElement.hasAttribute("data-color-aid") ? t(`Je Marker ein Slot · ✓ = Ziel (${LO}+) erreicht, ! = darunter`, `One marker per slot · ✓ = target (${LO}+) reached, ! = below target`) : t(`Je Balken ein Slot · grün = Ziel (${LO}+) erreicht, rot = darunter`, `One bar per slot · green = target (${LO}+) reached, red = below target`)}</div></section>
      <section class="bento-kpis" aria-label="${t("Kennzahlen", "Key figures")}">
      <div class="kpi"><div class="l">${t("Spielplätze gesamt", "Total player seats")}</div><div class="v">${totalSeats}</div></div>
      ${excludedFormats.length ? `<button type="button" class="kpi kpi-button" data-section-info="specials" aria-label="${escapeHtml(t(`${excludedFormats.length} Sonderformate. Liste und Erkennungsgründe anzeigen.`, `${excludedFormats.length} special formats. Show list and detection reasons.`))}"><span class="l">${t("Sonderformate", "Special formats")}</span><span class="v">${excludedFormats.length}</span></button>` : ""}
      ${showBusy ? `<div class="kpi kpi-good"><div class="l">${t("Spielplätze noch frei", "Player seats available")}</div><div class="v">${freeTotal}</div></div>` : ""}
      <div class="kpi bento-target"><div class="l">${t("Ziel je Slot", "Target per slot")}</div><div class="v">${LO}–${HI}</div></div>
      ${CONFIG.erwartete ? `<div class="kpi"><div class="l">${t("erwartete Teilnehmende", "expected attendees")}</div>${expectedMarkup}</div>` : ""}
      ${!showBusy && !excludedFormats.length ? `<div class="kpi"><div class="l">${t("Slots im Programm", "Slots in the schedule")}</div><div class="v">${slots.length}</div></div>` : ""}
    </section>
    <section class="card bento-chart">
      <div class="card-title-row"><h2 id="chartHeading">${t("Angebotene Spielplätze pro Slot", "Player seats offered per slot")}</h2><button type="button" class="section-info-button" data-section-info="chart" aria-label="${sectionInfoLabel("Erklärung zur Platzgrafik", "Explanation of the capacity chart")}"><span aria-hidden="true">i</span></button></div>
      <div class="chart" id="chart" aria-labelledby="chartHeading"></div>
      <div class="baseline-x" aria-hidden="true"><div></div><div class="xticks" id="xticks"></div></div>
    </section>
    <div class="bento-side-row">
      <div class="card bento-open">
        <div class="card-title-row"><h2>${t("Wo ist noch Platz?", "Where are seats still available?")}</h2><button type="button" class="section-info-button" data-section-info="free" aria-label="${sectionInfoLabel("Erklärung zu freien Plätzen", "Explanation of available seats")}"><span aria-hidden="true">i</span></button></div>
        <div id="freeList"></div>
        <p class="hp-more" id="freeMore"></p>
      </div>
      <div class="card bento-needs">
        <div class="card-title-row"><h2>${t("Wo werden noch Runden gebraucht?", "Where are more sessions needed?")}</h2><button type="button" class="section-info-button" data-section-info="needs" aria-label="${sectionInfoLabel("Erklärung zum Rundenbedarf", "Explanation of additional session demand")}"><span aria-hidden="true">i</span></button></div>
        <div class="needs-list" id="needsList" role="list"></div>
      </div>
    </div>
    <div class="card bento-full"><h2>${t("Alle Sessions im Detail", "All sessions in detail")}</h2><div id="detail"></div></div>
    <div class="card" id="funCard" hidden>
      <h2>Insights</h2>
      <p class="hint">${t("Live aus allen angebotenen Runden.", "Calculated live from all sessions on offer.")}</p>
      <div class="facts" id="facts"></div>
      <div class="card-title-row" style="justify-content:flex-start;flex-wrap:wrap;margin:20px 0 8px">
        <h3 style="margin:0">${t("Systeme", "Systems")}</h3>
        <button type="button" class="section-info-button" data-section-info="systems" aria-label="${sectionInfoLabel("Erklärung zur Systemauswertung", "Explanation of the system analysis")}"><span aria-hidden="true">i</span></button>
        <select id="sysMode" class="inline-select" aria-label="${t("Zählweise der Systeme", "System counting method")}" hidden>
          <option value="field">${t("nur System-Feld", "system field only")}</option>
          <option value="mentions">${t("Systemfamilien (Erwähnungen)", "system families (mentions)")}</option>
        </select>
      </div>
      <p class="sr-only" id="sysHint"></p>
      <div id="sysList"></div>
      <p class="hp-more" id="sysMore"></p>
      <div class="card-title-row" style="margin-top:24px"><h3 id="cloudHeading">${t("Wortwolke aus den Rundenbeschreibungen", "Word cloud from session descriptions")}</h3><button type="button" class="section-info-button" data-section-info="cloud" aria-label="${sectionInfoLabel("Erklärung zur Wortwolke", "Explanation of the word cloud")}"><span aria-hidden="true">i</span></button></div>
      <p class="sr-only" id="cloudHint">${t("Mit der Maus über ein Wort fahren zeigt Häufigkeit und Anteil; ein Klick öffnet zufällige Ausschnitte im Kontext.", "Hover over a word to see its frequency and share; click it for random excerpts in context.")}</p>
      <div id="cloud" aria-label="${t("Interaktive Wortwolke", "Interactive word cloud")}"></div>
      <p class="sr-only" id="cloudAlt"></p>
    </div>
    </div>`;

  const chart = document.getElementById("chart");
  for (const slot of slots) {
    const seats = seatsOf(slot);
    const rsvps = capacityGames(slot).reduce((x, g) => x + g.rsvps, 0);
    const nSpecial = specialFormats(slot).length;
    const row = document.createElement("div");
    row.className = "row";
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", `${slotName(slot)}: ${seats} ${t("Plätze", "seats")}; ${seats >= LO ? t("Ziel erreicht", "target reached") : t(`${LO - seats} Plätze fehlen bis zum Ziel`, `${LO - seats} seats needed to reach the target`)}`);
    row.innerHTML = `<div class="lbl"><b>${slotName(slot)}</b><span>${new Intl.DateTimeFormat(locale(), { timeZone:TZ, day:"2-digit", month:"2-digit" }).format(new Date(slot.dayDate))} · ${capacityGames(slot).length} ${t("platzrelevante Runden", "capacity-relevant sessions")}${nSpecial ? ` · +${nSpecial} ${t("weitere Formate", "other formats")}` : ""}${showBusy ? ` · ${rsvps + capacityGames(slot).length} ${t("belegt", "occupied")}` : ""}</span><span class="mstats">${seats} ${t("Plätze", "seats")}${LO - seats > 0 ? t(` · noch +${LO - seats} bis Ziel`, ` · ${LO - seats} still needed`) : t(" · Ziel erreicht", " · target reached")}</span></div>`;
    const track = document.createElement("div");
    track.className = "track";
    const band = document.createElement("div");
    band.className = "band";
    band.setAttribute("aria-hidden", "true");
    band.innerHTML = `<span class="band-label">${t("Ziel", "Target")} ${LO}–${HI}</span>`;
    band.style.left = pct(LO);
    band.style.width = ((HI - LO) / MAX * 100) + "%";
    track.appendChild(band);
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.width = pct(seats);
    for (const g of capacityGames(slot)) {
      const seg = document.createElement("a");
      seg.className = "seg";
      seg.href = g.url;
      seg.target = "_blank";
      seg.rel = "noopener";
      seg.setAttribute("aria-label",
        `${g.title}, ${slotName(slot)} ${formatTime(g.startTime)} ${t("bis", "to")} ${formatTime(g.endTime)}, ${g.playerSeats} ${t("Spielplätze plus Spielleitung", "player seats plus facilitator")}` +
        (showBusy ? `, ${g.rsvps} ${t("belegt", "occupied")}, ${frei(g)} ${t("frei", "available")}` : "") + t(". Öffnet die Runde auf Playabl.", ". Opens the session on Playabl."));
      seg.style.flex = g.seats + " 0 0";
      if (showBusy) {
        const fill = document.createElement("div");
        fill.className = "fill";
        fill.style.transform = `scaleX(${Math.min(1, (g.rsvps + 1) / g.seats)})`;
        seg.appendChild(fill);
      }
      seg.addEventListener("mousemove", e => {
        tooltip.style.display = "block";
        tooltip.innerHTML = `<div class="t">${g.title}</div><div class="s">${formatTime(g.startTime)}–${formatTime(g.endTime)} · ${g.playerSeats} ${t("Spielplätze + SL/Mod", "player seats + facilitator")}${showBusy ? ` · ${g.rsvps + 1}/${g.seats} ${t("belegt", "occupied")} · ${frei(g)} ${t("frei", "available")}` : ""} · ${t("Klick öffnet die Runde", "click to open the session")}</div>`;
        tooltip.style.left = Math.min(e.clientX + 14, innerWidth - tooltip.offsetWidth - 8) + "px";
        tooltip.style.top = (e.clientY + 14) + "px";
      });
      seg.addEventListener("mouseleave", () => tooltip.style.display = "none");
      bar.appendChild(seg);
    }
    track.appendChild(bar);
    const val = document.createElement("div");
    val.className = "val";
    val.style.left = `calc(${pct(seats)} + 8px)`;
    val.textContent = seats;
    track.appendChild(val);
    if (LO - seats > 0) {
      const gap = document.createElement("div");
      gap.className = "gap-note";
      gap.style.left = `calc(${pct(seats)} + 30px)`;
      gap.textContent = t(`+${LO - seats} bis Ziel`, `+${LO - seats} to target`);
      track.appendChild(gap);
    }
    row.appendChild(track);
    chart.appendChild(row);
  }

  const xt = document.getElementById("xticks");
  for (const v of [0, 20, 40, 60, LO, HI]) {
    const s = document.createElement("span");
    s.style.left = pct(v);
    s.textContent = v;
    xt.appendChild(s);
  }

  const needs = slots.map(slot => ({ slot, missing: Math.max(0, LO - seatsOf(slot)) }));
  const maxMissing = Math.max(1, ...needs.map(item => item.missing));
  document.getElementById("needsList").innerHTML = needs.map(({ slot, missing }) =>
    `<div class="needs-row" role="listitem" aria-label="${slotName(slot)}: ${missing ? t(`${missing} Plätze fehlen bis zum Ziel`, `${missing} seats needed to reach the target`) : t("Ziel erreicht", "target reached")}">
      <span class="needs-name">${slotName(slot)}</span>
      <span class="needs-track" aria-hidden="true"><span class="needs-fill" style="width:${missing / maxMissing * 100}%"></span></span>
      <span class="needs-value">${missing ? `+${missing}` : "✓"}</span>
    </div>`).join("");

  const detail = document.getElementById("detail");
  for (const slot of slots) {
    const d = document.createElement("details");
    const rows = slot.games.map(g => `<tr>
      <td><a href="${g.url}" target="_blank" rel="noopener" style="color:inherit">${escapeHtml(g.title)}</a>${g.format !== "capacity" ? ` <span class="badge">${escapeHtml(formatLabel(g.format))}</span>` : ""}</td>
      <td class="game-system">${escapeHtml(gameSystem(g))}</td>
      <td class="game-facilitator">${escapeHtml(gameFacilitator(g))}</td>
      <td>${formatTime(g.startTime)}–${formatTime(g.endTime)}${g.format === "capacity" ? ` · ${g.playerSeats}+${t("SL", "GM")}${showBusy ? ` · ${g.rsvps + 1}/${g.seats} ${t("belegt", "occupied")}` : ""}` : ""}</td>
    </tr>`).join("");
    d.innerHTML = `<summary>${slotDay(slot)} ${translateSlotPart(slot.part)} — ${slot.games.length} ${t("Sessions", "sessions")}, ${seatsOf(slot)} ${t("platzrelevante Plätze", "capacity-relevant seats")}</summary><div class="tscroll"><table class="games"><caption class="sr-only">${t(`Runden am ${slotDay(slot)} ${translateSlotPart(slot.part)}`, `Sessions on ${slotDay(slot)} ${translateSlotPart(slot.part)}`)}</caption><thead><tr><th>Session</th><th>System</th><th>${t("SL", "GM")}</th><th>${t("Zeit & Plätze", "Time & capacity")}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    detail.appendChild(d);
  }

  if (showBusy) {
    const open = allCapacityGames.filter(g => frei(g) > 0).sort((a, b) => frei(b) - frei(a));
    const full = allCapacityGames.length - open.length;
    if (open.length) document.getElementById("freeList").setAttribute("role", "list");
    else document.getElementById("freeList").removeAttribute("role");
    document.getElementById("freeList").innerHTML = open.map(g =>
      `<div class="free-row" role="listitem"><a href="${g.url}" target="_blank" rel="noopener">${g.title}</a>
       <span>${slotName(g.slot)} · ${formatTime(g.startTime)}–${formatTime(g.endTime)} <span class="badge frei">${t(`${frei(g)} von ${g.playerSeats} frei`, `${frei(g)} of ${g.playerSeats} available`)}</span></span></div>`).join("")
      || `<p class="hint">${t("Aktuell sind alle Runden voll.", "All sessions are currently full.")}</p>`;
    document.getElementById("freeMore").textContent = full > 0 ? t(`${full} weitere Runden sind bereits voll.`, `${full} more sessions are already full.`) : "";
  } else {
    document.getElementById("freeList").removeAttribute("role");
    document.getElementById("freeList").innerHTML =
      `<p class="hint">${t("Die Anmeldung ist noch geschlossen. Freie Plätze werden hier angezeigt, sobald RSVPs geöffnet sind.", "Registration is not open yet. Available seats will appear here once RSVPs open.")}</p>`;
  }
}

// ---------- Kalender-Ansicht ----------
function renderCalendar(slots, rsvpsOpen) {
  const en = isEnglish();
  const t = (de, english) => en ? english : de;
  const cal = document.getElementById("calView");
  const showBusy = rsvpsOpen || slots.some(s => s.games.some(g => g.rsvps > 0));
  const days = new Map();
  for (const s of slots) {
    if (!days.has(s.date)) days.set(s.date, { dayDate:s.dayDate, parts: {} });
    days.get(s.date).parts[s.part] = s;
  }
  const systems = [...new Map(slots.flatMap(slot => slot.games).map(game => [gameSystem(game).toLocaleLowerCase(locale()), gameSystem(game)])).values()]
    .sort((a, b) => a.localeCompare(b, locale(), { sensitivity:"base", numeric:true }));
  const totalGames = slots.reduce((sum, slot) => sum + slot.games.length, 0);
  const card = (g, day) => `
    <a class="cal-card${g.format !== "capacity" ? " non-capacity-card" : ""}" data-calendar-game data-day="${escapeHtml(day)}" data-system="${escapeHtml(gameSystem(g).toLocaleLowerCase(locale()))}" data-search="${escapeHtml(`${g.title} ${gameSystem(g)} ${gameFacilitator(g)} ${formatLabel(g.format)}`.toLocaleLowerCase(locale()))}" data-free="${String(g.format === "capacity" && frei(g) > 0)}" href="${g.url}" target="_blank" rel="noopener" aria-label="${escapeHtml(`${g.title}, System ${gameSystem(g)}, ${t("Spielleitung", "facilitator")} ${gameFacilitator(g)}, ${formatTime(g.startTime)} ${t("bis", "to")} ${formatTime(g.endTime)}${g.format !== "capacity" ? `, ${formatLabel(g.format)}` : `, ${g.playerSeats} ${t("Spielplätze plus Spielleitung", "player seats plus facilitator")}${showBusy ? `, ${frei(g)} ${t("frei", "available")}` : ""}`}`)}">
      <span class="t">${escapeHtml(g.title)}</span>
      <span class="m">${formatTime(g.startTime)}–${formatTime(g.endTime)}${g.format !== "capacity" ? ` <span class="badge">${escapeHtml(formatLabel(g.format))}</span>` : ` · ${g.playerSeats}+${t("SL", "GM")}${showBusy ? (frei(g) > 0 ? ` <span class="badge frei">${frei(g)} ${t("frei", "available")}</span>` : ` <span class="badge voll">${t("voll", "full")}</span>`) : ""}`}</span>
      <span class="m"><span>${escapeHtml(gameSystem(g))}</span><span aria-hidden="true">·</span><span>${t("SL", "GM")}: ${escapeHtml(gameFacilitator(g))}</span></span>
    </a>`;
  cal.innerHTML = `
    <section class="calendar-filters" aria-label="${t("Kalender filtern", "Filter calendar")}">
      <label class="calendar-filter-field" for="calendarSearch">
        <span class="calendar-filter-label">${t("Suche", "Search")}</span>
        <input class="calendar-filter-input" id="calendarSearch" type="search" autocomplete="off" placeholder="${t("Session, System oder SL …", "Session, system, or GM …")}">
      </label>
      <label class="calendar-filter-field" for="calendarSystem">
        <span class="calendar-filter-label">System</span>
        <input class="calendar-filter-input" id="calendarSystem" type="search" list="calendarSystemSuggestions" autocomplete="off" placeholder="${t("System eingeben …", "Enter a system …")}">
        <datalist id="calendarSystemSuggestions">${systems.map(system => `<option value="${escapeHtml(system)}"></option>`).join("")}</datalist>
      </label>
      <div class="calendar-filter-field calendar-slot-filter">
        <span class="calendar-filter-label" id="calendarDayFilterLabel">${t("Tag", "Day")}</span>
        <div class="calendar-slot-chips" role="group" aria-labelledby="calendarDayFilterLabel">
          <button type="button" class="calendar-slot-chip" data-day-filter="" aria-pressed="true">${t("Alle Tage", "All days")}</button>
          ${[...days.entries()].map(([date, day]) => `<button type="button" class="calendar-slot-chip" data-day-filter="${escapeHtml(date)}" aria-pressed="false">${escapeHtml(new Intl.DateTimeFormat(locale(), { timeZone:TZ, weekday:"long" }).format(new Date(day.dayDate)))}</button>`).join("")}
        </div>
      </div>
      <div class="calendar-filter-footer">
        ${rsvpsOpen ? `<button type="button" class="calendar-free-toggle" id="calendarFreeFilter" aria-pressed="false"><span aria-hidden="true">○</span> ${t("Nur freie Plätze", "Available seats only")}</button>` : ""}
        <button type="button" class="calendar-filter-reset" id="calendarFilterReset" hidden>${t("Filter zurücksetzen", "Reset filters")}</button>
        <span class="calendar-filter-count" id="calendarFilterCount" role="status" aria-live="polite">${totalGames} ${t("Runden", "sessions")}</span>
      </div>
    </section>
    <p class="calendar-empty" id="calendarNoResults" hidden>${t("Keine Sessions entsprechen diesen Filtern.", "No sessions match these filters.")}</p>
    <div class="calendar-bento">${[...days.entries()].map(([date, d]) => {
    const parts = Object.values(d.parts);
    return `
    <div class="card cal-day" data-calendar-day="${escapeHtml(date)}">
      <h2>${new Intl.DateTimeFormat(locale(), { timeZone:TZ, weekday:"long", day:"2-digit", month:"2-digit" }).format(new Date(d.dayDate))}</h2>
      <div class="cal-cols" style="--calendar-columns:${Math.min(3, Math.max(1, parts.length))}">
        ${parts.map(slot => {
          const seats = seatsOf(slot);
          const free = capacityGames(slot).reduce((sum, game) => sum + frei(game), 0);
          const missing = Math.max(0, LO - seats);
          const badge = showBusy ? t(`${free} frei`, `${free} available`) : (missing ? t(`noch +${missing} bis Ziel`, `${missing} still needed`) : t("Ziel erreicht", "Target reached"));
          const badgeClass = showBusy || !missing ? "is-good" : "is-warn";
          return `
          <div class="cal-col" data-calendar-slot>
            <div class="cal-col-head"><h3>${translateSlotPart(slot.part)}</h3><span class="cal-slot-badge ${badgeClass}">${badge}</span></div>
            ${slot.games.map(game => card(game, slot.date)).join("") || `<p class="hint">– ${t("keine Runden", "no sessions")} –</p>`}
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }).join("")}</div>`;

  const searchInput = document.getElementById("calendarSearch");
  const systemInput = document.getElementById("calendarSystem");
  const resetButton = document.getElementById("calendarFilterReset");
  const freeButton = document.getElementById("calendarFreeFilter");
  const count = document.getElementById("calendarFilterCount");
  const noResults = document.getElementById("calendarNoResults");
  let selectedDay = "";
  let freeOnly = false;
  const applyCalendarFilters = () => {
    const query = searchInput.value.trim().toLocaleLowerCase(locale());
    const queryTerms = query.split(/\s+/).filter(Boolean);
    const systemQuery = systemInput.value.trim().toLocaleLowerCase(locale());
    let visibleGames = 0;
    for (const game of cal.querySelectorAll("[data-calendar-game]")) {
      const visible = (!queryTerms.length || queryTerms.every(term => game.dataset.search.includes(term)))
        && (!systemQuery || game.dataset.system.includes(systemQuery))
        && (!selectedDay || game.dataset.day === selectedDay)
        && (!freeOnly || game.dataset.free === "true");
      game.hidden = !visible;
      if (visible) visibleGames += 1;
    }
    for (const column of cal.querySelectorAll("[data-calendar-slot]")) {
      column.hidden = !column.querySelector("[data-calendar-game]:not([hidden])");
    }
    for (const day of cal.querySelectorAll("[data-calendar-day]")) {
      day.hidden = !day.querySelector("[data-calendar-slot]:not([hidden])");
    }
    count.textContent = visibleGames === totalGames ? `${totalGames} ${t("Runden", "sessions")}` : t(`${visibleGames} von ${totalGames} Runden`, `${visibleGames} of ${totalGames} sessions`);
    noResults.hidden = visibleGames > 0;
    resetButton.hidden = !(query || systemQuery || selectedDay || freeOnly);
  };
  searchInput.addEventListener("input", applyCalendarFilters);
  systemInput.addEventListener("input", applyCalendarFilters);
  for (const chip of cal.querySelectorAll("[data-day-filter]")) {
    chip.addEventListener("click", () => {
      selectedDay = chip.dataset.dayFilter;
      cal.querySelectorAll("[data-day-filter]").forEach(button => button.setAttribute("aria-pressed", String(button === chip)));
      applyCalendarFilters();
    });
  }
  freeButton?.addEventListener("click", () => {
    freeOnly = !freeOnly;
    freeButton.setAttribute("aria-pressed", String(freeOnly));
    freeButton.querySelector("span").textContent = freeOnly ? "✓" : "○";
    applyCalendarFilters();
  });
  resetButton.addEventListener("click", () => {
    searchInput.value = "";
    systemInput.value = "";
    selectedDay = "";
    freeOnly = false;
    freeButton?.setAttribute("aria-pressed", "false");
    if (freeButton) freeButton.querySelector("span").textContent = "○";
    cal.querySelectorAll("[data-day-filter]").forEach(button => button.setAttribute("aria-pressed", String(!button.dataset.dayFilter)));
    applyCalendarFilters();
    searchInput.focus();
  });
}

// ---------- Ansicht umschalten (Übersicht/Kalender) ----------
function setView(v) {
  const cal = v === "kalender";
  document.getElementById("app").hidden = cal;
  document.getElementById("calView").hidden = !cal;
  document.getElementById("tabOverview").setAttribute("aria-pressed", String(!cal));
  document.getElementById("tabCalendar").setAttribute("aria-pressed", String(cal));
  if (location.hash !== (cal ? "#kalender" : "") ) history.replaceState(null, "", location.pathname + location.search + (cal ? "#kalender" : ""));
}
document.getElementById("tabOverview").addEventListener("click", () => setView("uebersicht"));
document.getElementById("tabCalendar").addEventListener("click", () => setView("kalender"));

// ---------- Event-Auswahl ----------
function gotoEvent(id) {
  if (!id) return;
  const p = new URLSearchParams(location.search);
  p.set("event", id);
  location.href = location.pathname + "?" + p.toString() + location.hash;
}
document.getElementById("eventSelect").addEventListener("change", e => gotoEvent(e.target.value));

let allEvents = [];
function fillEventsList(events) {
  allEvents = events;
  const csel = document.getElementById("communitySelect");
  const communities = new Map();
  for (const e of events) { const c = e.community_id; if (c?.id) communities.set(c.id, c.name || "?"); }
  csel.innerHTML = "";
  csel.appendChild(new Option(isEnglish() ? "All communities" : "Alle Communities", ""));
  [...communities.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => csel.appendChild(new Option(name, id)));
  const current = events.find(e => String(e.id) === EVENT);
  csel.value = current?.community_id?.id || "";
  fillEventOptions();
}

function fillEventOptions() {
  const cid = document.getElementById("communitySelect").value;
  const sel = document.getElementById("eventSelect");
  const dFmt = new Intl.DateTimeFormat(locale(), { day: "2-digit", month: "2-digit", year: "2-digit" });
  const list = cid ? allEvents.filter(e => String(e.community_id?.id) === cid) : allEvents;
  sel.innerHTML = "";
  if (!list.some(e => String(e.id) === EVENT)) {
    const ph = new Option(isEnglish() ? "– Choose event –" : "– Event wählen –", "");
    ph.disabled = true;
    ph.selected = true;
    sel.appendChild(ph);
  }
  for (const e of list) {
    const o = new Option(`${e.title}${e.start_time ? " (" + dFmt.format(new Date(e.start_time)) + ")" : ""}`, e.id);
    if (String(e.id) === EVENT) o.selected = true;
    sel.appendChild(o);
  }
}
document.getElementById("communitySelect").addEventListener("change", fillEventOptions);

document.getElementById("slotConfigOpen").addEventListener("click", openSlotConfig);
document.getElementById("slotConfigAdd").addEventListener("click", () => document.getElementById("slotConfigRows").insertAdjacentHTML("beforeend", slotConfigRow()));
document.getElementById("slotConfigRows").addEventListener("click", event => event.target.closest("[data-slot-remove]")?.closest(".slot-config-row")?.remove());
document.getElementById("slotConfigReset").addEventListener("click", () => {
  localStorage.removeItem(localSlotKey);
  localStorage.removeItem(localSlotSourceKey);
  location.reload();
});
document.getElementById("targetConfigReset").addEventListener("click", () => {
  const p = new URLSearchParams(location.search);
  p.set("event", EVENT);
  p.delete("min");
  p.delete("max");
  location.href = location.pathname + "?" + p.toString() + location.hash;
});
document.getElementById("slotConfigSave").addEventListener("click", () => {
  const copy = UI_COPY[document.documentElement.lang] || UI_COPY.de;
  const lo = parseInt(document.getElementById("zielMin").value, 10);
  const hi = parseInt(document.getElementById("zielMax").value, 10);
  if (!lo || !hi || lo < 1 || hi < lo) return alert(copy.setupInvalidTarget);
  const buckets = [...document.querySelectorAll(".slot-config-row")].map(row => ({
    label:row.querySelector("[data-slot-label]").value.trim(), start_hour:+row.querySelector("[data-slot-start]").value, end_hour:+row.querySelector("[data-slot-end]").value
  })).filter(b => b.label && b.start_hour >= 0 && b.end_hour <= 24 && b.start_hour < b.end_hour);
  if (!buckets.length) return alert(copy.setupInvalidSlots);
  localStorage.setItem(localSlotKey, JSON.stringify(buckets));
  localStorage.setItem(localSlotSourceKey, "manual");
  const p = new URLSearchParams(location.search);
  p.set("event", EVENT);
  p.set("min", lo);
  p.set("max", hi);
  location.href = location.pathname + "?" + p.toString() + location.hash;
});

// ---------- Insights ----------
function renderFun(games) {
  const en = isEnglish();
  const t = (de, english) => en ? english : de;
  games = games.filter(g => capacityFormat(g) === "capacity");
  if (!games.length) return;
  document.getElementById("funCard").hidden = false;
  const plain = g => (g.description || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  const cleanTitle = t => (t.replace(/\s*[\[(][^\])]*(?:3W6|Offline|Con)[^\])]*[\])]\s*/gi, "").trim() || t).slice(0, 44);

  const seats = games.map(g => g.participant_count + 1);
  const biggest = games.reduce((a, b) => b.participant_count > a.participant_count ? b : a);
  const smallest = games.reduce((a, b) => b.participant_count < a.participant_count ? b : a);
  const glRe = /gm-?less|sl-?los|spielleit(er|ungs)los|ohne\s+spielleitung|moderation:/i;
  const gmless = games.filter(g => glRe.test(g.system + " " + plain(g))).length;
  const xcard = games.filter(g => /x-?ka?rte|x-?card/i.test(plain(g))).length;
  // Freitextbezeichnungen vor der Gruppierung normalisieren.
  const cleanSys = s => (s || "?").replace(/\s*[\[(][^\])]*[\])]\s*/g, " ").replace(/\s+/g, " ").trim() || "?";
  const famNames = (CONFIG.systemFamilien || []).map(f => f.trim()).filter(Boolean);
  const famLower = famNames.map(f => f.toLowerCase());
  const systems = new Map();
  for (const g of games) {
    const s = cleanSys(g.system);
    const k = s.toLowerCase();
    const current = systems.get(k);
    systems.set(k, { name: current?.name || s, n: (current?.n || 0) + 1, matches:[...(current?.matches || []), g] });
  }
  // Der Nennungsmodus durchsucht alle beschreibenden Felder.
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const families = famNames.map(name => {
    const matches = games.filter(g => new RegExp(esc(name), "i").test((g.system || "") + " " + g.title + " " + plain(g)));
    return { name, fam:true, n:matches.length, matches };
  }).filter(f => f.n >= 2);
  const facts = [
    { v: (seats.reduce((a, b) => a + b, 0) / seats.length).toFixed(1).replace(".", en ? "." : ","), l: t("Personen pro Runde (ø, inkl. SL)", "people per session (average, including GM)") },
    { v: systems.size, l: t("verschiedene Systeme – Vielfalt!", "different systems – variety!"), action:"systems" },
    { v: `${Math.round(gmless / games.length * 100)} %`, l: t("der Runden kommen ohne SL aus", "of sessions need no GM") },
    { v: `${Math.round(xcard / games.length * 100)} %`, l: t("erwähnen die X-Karte", "mention the X-Card") },
    { v: biggest.participant_count + t("+SL", "+GM"), l: `${t("größte Runde", "largest session")}: ${cleanTitle(biggest.title)}` },
    { v: smallest.participant_count + t("+SL", "+GM"), l: `${t("intimste Runde", "smallest session")}: ${cleanTitle(smallest.title)}` },
  ];
  document.getElementById("facts").innerHTML =
    facts.map(f => f.action === "systems"
      ? `<button type="button" class="fact fact-button" data-show-all-systems aria-controls="sysList" aria-expanded="false" aria-label="${escapeHtml(t(`${f.v} verschiedene Systeme. Vollständige Liste anzeigen.`, `${f.v} different systems. Show the complete list.`))}"><div class="v">${f.v}</div><div class="l">${f.l}</div></button>`
      : `<div class="fact"><div class="v">${f.v}</div><div class="l">${f.l}</div></div>`).join("");

  // Feldmodus gruppiert Bezeichnungen, Nennungsmodus zählt konfigurierte Familien.
  const systemCollator = new Intl.Collator(locale(), { sensitivity:"base", numeric:true });
  const byCountThenName = (a, b) => b.n - a.n || systemCollator.compare(a.name, b.name);
  const ranked = [...systems.values()].sort(byCountThenName);
  const singles = ranked.filter(s => s.n === 1).length;
  let showAllSystems = false;
  const renderSysList = mode => {
    const rows = mode === "mentions"
      ? [...families].sort(byCountThenName)
      : showAllSystems ? ranked : ranked.filter(s => s.n >= 2);
    const maxN = rows.length ? rows[0].n : 1;
    document.getElementById("sysHint").textContent = mode === "mentions"
      ? t("Zählt, in wie vielen Runden die Spielfamilie erwähnt wird – im System-Feld, Titel oder in der Beschreibung. Eine Runde kann zu mehreren Familien passen.", "Counts how many sessions mention the system family in the system field, title, or description. One session can match several families.")
      : t("Zählt schlicht, was im System-Feld der Runden steht (gleiche Schreibweisen zusammengefasst).", "Counts the entries in the sessions’ system field, grouping identical spellings.");
    const list = document.getElementById("sysList");
    list.innerHTML = rows.map((s, index) =>
      `<button type="button" class="hp-row" data-system-index="${index}" aria-label="${escapeHtml(t(`${s.name}: ${s.n} Runden. Klick zeigt die Spiele.`, `${s.name}: ${s.n} sessions. Click to show the games.`))}"><span class="hp-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
       <span class="hp-track"><span class="hp-bar" style="width:${s.n / maxN * 100}%"></span></span>
       <span class="hp-n">${s.n}×</span></button>`).join("") || `<p class="hint">${t("Keine Einträge.", "No entries.")}</p>`;
    for (const button of list.querySelectorAll("[data-system-index]")) {
      const system = rows[+button.dataset.systemIndex];
      button.addEventListener("click", () => openWordContext({
        type:"system", name:system.name, matches:system.matches, family:Boolean(system.fam)
      }));
    }
    const more = document.getElementById("sysMore");
    document.querySelector("[data-show-all-systems]")?.setAttribute("aria-expanded", String(mode === "field" && showAllSystems));
    more.innerHTML = mode === "field" && singles > 0
      ? `<button type="button" class="system-more-toggle" aria-expanded="${String(showAllSystems)}">${showAllSystems ? t("Weniger Systeme anzeigen", "Show fewer systems") : t(`… plus ${singles} Systeme, die genau einmal angeboten werden. Alle anzeigen.`, `… plus ${singles} systems offered exactly once. Show all.`)}</button>`
      : "";
    more.querySelector(".system-more-toggle")?.addEventListener("click", () => {
      showAllSystems = !showAllSystems;
      renderSysList("field");
    });
  };
  const modeSel = document.getElementById("sysMode");
  if (families.length) {
    modeSel.hidden = false;
    modeSel.onchange = () => {
      showAllSystems = false;
      renderSysList(modeSel.value);
    };
  }
  renderSysList("field");
  document.querySelector("[data-show-all-systems]")?.addEventListener("click", () => {
    showAllSystems = true;
    modeSel.value = "field";
    renderSysList("field");
    document.getElementById("sysList").scrollIntoView({
      behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block:"start"
    });
  });

  const stop = new Set(("und oder aber auch noch dann wird werden wurde kann können könnt muss müssen darf dürfen soll sollen " +
    "der die das den dem des ein eine einen einem einer eines ist sind war waren sein seine seinem seiner ihr ihre ihrem ihren " +
    "wir ihr sie es ich du man uns euch mich dich sich nicht kein keine nur mehr sehr auf aus bei mit von zu zum zur nach vor über " +
    "unter durch für gegen ohne um an am im in dass wie als wenn weil ob was wer wo alle allen alles jede jeder jedes dieser diese " +
    "dieses etwas eher habe hat haben hatte gibt geht dabei dazu damit dafür darauf dort hier schon noch mal so ganz gut the and " +
    "for with you your are was were will this that not but can have has from they them our its all one two new more most other " +
    "some their there where which while who whom about into over such play game games player players playing " +
    "spiel spiele spielen spielt gespielt runde runden charaktere charakter figuren regeln system beschreibung link publisher " +
    "safety tools tool lines veils veil karte card open door policy ort offline con wien spielleitung moderation setting genre " +
    "stichwörter sprache deutsch englisch english hinweise warnungen voraussetzungen erfahrung equipment technik keine discord " +
    "https http www com net org itch drivethrurpg gerne zwei drei vier fünf pro per etc " +
    "offline-runde innen unser unsere unserer unserem unseren eure euer immer viel viele vielen selbst wäre würde werdet " +
    "dieser diesem diesen jeweils sowie bzw ggf inkl nötig notwendig hilfreich benötigt wird " +
    "verwendete verwendet kommen wollen sondern zwischen spiels spieler spielerinnen beginn teil willkommen " +
    "spielmaterial characters x-karte x-card mitbringen bringe stelle gestellt").split(/\s+/));
  const descriptions = games.map(game => ({ game, text:plain(game).replace(/\s+/g, " ").trim() }));
  const counts = new Map();
  for (const { text } of descriptions) {
    for (const w of text.toLowerCase().match(/[a-zäöüßæéè][a-zäöüßæéè'-]{3,}/g) || []) {
      if (!stop.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  const words = [...counts.entries()].filter(w => w[1] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 45);
  if (words.length) {
    const wMax = words[0][1], wMin = words[words.length - 1][1];
    const shuffled = words.map(([w, n], i) => ({ w, n, key: (i * 2654435761 >>> 8) % 1000 })).sort((a, b) => a.key - b.key);
    const cloud = document.getElementById("cloud");
    cloud.innerHTML = shuffled.map(({ w, n }, index) => {
      const t = wMax === wMin ? 0.5 : (Math.sqrt(n) - Math.sqrt(wMin)) / (Math.sqrt(wMax) - Math.sqrt(wMin));
      const size = (0.72 + t * 1.5).toFixed(2);
      const cls = "c" + (w.length + n) % 4;
      const weight = t > 0.55 ? 700 : 400;
      const motionKey = [...w].reduce((sum, char) => sum + char.charCodeAt(0), n * 17);
      const x = 2 + motionKey % 7;
      const y = 1 + (motionKey >> 2) % 5;
      const rotate = ((motionKey % 5) - 2) * .35;
      return `<button type="button" class="${cls}" data-cloud-word="${escapeHtml(w)}" style="font-size:${size}rem;font-weight:${weight};--cloud-x-start:${(-x * .45).toFixed(2)}px;--cloud-y-start:${(-y * .45).toFixed(2)}px;--cloud-rotate-start:${(-rotate * .45).toFixed(2)}deg;--cloud-x:${x}px;--cloud-y:${y}px;--cloud-rotate:${rotate}deg;--cloud-duration:${6 + motionKey % 6}s;--cloud-delay:${-(index % 7)}s">${escapeHtml(w)}</button>`;
    }).join(" ");
    for (const button of cloud.querySelectorAll("[data-cloud-word]")) {
      const word = button.dataset.cloudWord;
      const n = counts.get(word) || 0;
      const matcher = new RegExp(`(^|[^a-zäöüßæéè'-])${esc(word)}(?=$|[^a-zäöüßæéè'-])`, "i");
      const matches = descriptions.filter(item => matcher.test(item.text));
      const percent = Math.round(matches.length / Math.max(1, games.length) * 100);
      const hoverText = () => document.documentElement.lang === "en"
        ? `${n} mentions · ${matches.length} of ${games.length} sessions (${percent}%) · click for context`
        : `${n} Nennungen · ${matches.length} von ${games.length} Runden (${percent} %) · Klick für Kontext`;
      button.setAttribute("aria-label", `${word}: ${hoverText()}`);
      button.addEventListener("mousemove", event => {
        const tooltip = document.getElementById("tooltip");
        tooltip.style.display = "block";
        tooltip.innerHTML = `<div class="t">${escapeHtml(word)}</div><div class="s">${hoverText()}</div>`;
        tooltip.style.left = Math.min(event.clientX + 14, innerWidth - tooltip.offsetWidth - 8) + "px";
        tooltip.style.top = Math.min(event.clientY + 14, innerHeight - tooltip.offsetHeight - 8) + "px";
      });
      button.addEventListener("mouseleave", () => document.getElementById("tooltip").style.display = "none");
      button.addEventListener("focus", () => button.setAttribute("aria-label", `${word}: ${hoverText()}`));
      button.addEventListener("click", () => {
        document.getElementById("tooltip").style.display = "none";
        openWordContext({ word, n, matches, total:games.length });
      });
    }
    document.getElementById("cloudAlt").textContent =
      t("Häufigste Wörter in den Beschreibungen: ", "Most frequent words in the descriptions: ") + words.slice(0, 12).map(([w, n]) => `${w} (${n}×)`).join(", ") + ".";
  }
}

// ---------- Credits & Cross-Link zum Raumplan ----------
const RAUMPLAN_URL = "https://lmbreuer.github.io/con-raumplan/";
const RAUMPLAN_SUPABASE = "https://wgnbcebakabkzjonslfi.supabase.co";
const RAUMPLAN_ANON = "sb_publishable_H87YdUgB35PR37LL-efOkA_ShJxVIaq";
async function findRaumplanCon(eventId) {
  try {
    const r = await fetch(`${RAUMPLAN_SUPABASE}/rest/v1/cons?select=id,slug&playabl_event_id=eq.${eventId}&limit=1`,
      { headers: { apikey: RAUMPLAN_ANON, Authorization: "Bearer " + RAUMPLAN_ANON } });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] || null;
  } catch { return null; }
}
// Aktive Slots aus dem verknüpften Raumplan lesen.
async function findSlotBuckets(conId) {
  try {
    const r = await fetch(`${RAUMPLAN_SUPABASE}/rest/v1/slot_buckets?select=label,start_hour,end_hour&con_id=eq.${conId}&active=eq.true&order=sort`,
      { headers: { apikey: RAUMPLAN_ANON, Authorization: "Bearer " + RAUMPLAN_ANON } });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}
let activeCreditsCon = null;
function renderCredits(con = activeCreditsCon) {
  activeCreditsCon = con;
  const en = document.documentElement.lang === "en";
  const slug = con?.slug || null;
  const raumplanLink = slug ? `${RAUMPLAN_URL}plan.html?con=${encodeURIComponent(slug)}` : RAUMPLAN_URL;
  document.getElementById("credits").innerHTML = `
    <span>Playabl Dashboard</span>
    <span aria-hidden="true">·</span>
    <a href="https://playabl.io" target="_blank" rel="noopener" style="color:inherit">${en ? "Data source: Playabl" : "Datenquelle: Playabl"}</a>
    <span aria-hidden="true">·</span>
    <a href="${raumplanLink}" style="color:inherit">${en ? `Con room plan${slug ? " for this event" : ""}` : `Con-Raumplan${slug ? " für dieses Event" : ""}`}</a>
    <span aria-hidden="true">·</span>
    <a href="impressum.html" style="color:inherit">${en ? "Legal notice" : "Impressum"}</a>`;
}
window.addEventListener("uilanguagechange", () => renderCredits());

// ---------- Start ----------
let dashboardState = null;
function renderLoadedDashboard() {
  if (!dashboardState) return;
  const { slots, rsvpsOpen, ev, eventsList, con, slotSource } = dashboardState;
  const en = isEnglish();
  renderCredits(con);
  document.getElementById("status").textContent =
    (en ? "Updated: " : "Stand: ") +
    new Intl.DateTimeFormat(locale(), { timeZone: TZ, dateStyle: "full", timeStyle: "short" }).format(new Date()) +
    (en ? "" : " Uhr");
  applyEvent(ev, rsvpsOpen);
  render(slots, rsvpsOpen);
  renderCalendar(slots, rsvpsOpen);
  renderFun(dashboardState.games);
  fillEventsList(eventsList);
  document.getElementById("zielMin").value = LO;
  document.getElementById("zielMax").value = HI;
  document.getElementById("targetSummary").textContent = `${LO}–${HI}`;
  updateTargetMeta();
  document.getElementById("slotsSummary").textContent =
    activeSlotBuckets.map(bucket => `${translateSlotPart(bucket.label)} ${bucket.start_hour}–${bucket.end_hour} ${en ? "h" : "Uhr"}`).join(" · ");
  document.getElementById("slotsSourceSummary").textContent = (en ? {
    manual:"· manual",
    inferred:"· detected automatically",
    raumplan:"· from the room plan",
    fallback:"· default"
  } : {
    manual:"· manuell",
    inferred:"· automatisch erkannt",
    raumplan:"· aus der Raumplanung",
    fallback:"· Standard"
  })[slotSource] || "";
  setView(location.hash === "#kalender" ? "kalender" : "uebersicht");
}
window.addEventListener("uilanguagechange", renderLoadedDashboard);

Promise.all([load(), loadGames(), loadEvent(), loadEventsList(), findRaumplanCon(EVENT)]).then(async ([sessions, games, ev, eventsList, con]) => {
  const rsvpsOpen = !!(ev?.fixed_access_time && ev.fixed_access_time <= Date.now());
  if (activeTargetSource !== "manual") eligibleTargetCount = await loadEligibleTargetCount(ev?.event_access_levels);
  const remoteBuckets = con ? await findSlotBuckets(con.id) : [];
  const localBuckets = loadLocalSlotBuckets();
  const storedSlotSource = localStorage.getItem(localSlotSourceKey) || (localBuckets.length ? "manual" : "");
  const manualBuckets = storedSlotSource === "manual" ? localBuckets : [];
  const rememberedInference = storedSlotSource === "inferred" ? localBuckets : [];
  let buckets = manualBuckets.length ? manualBuckets : remoteBuckets.length ? remoteBuckets : rememberedInference;
  let slotSource = manualBuckets.length
    ? "manual"
    : remoteBuckets.length ? "raumplan" : rememberedInference.length ? "inferred" : "";
  if (!buckets.length) {
    const inferredBuckets = inferSlotBuckets(sessions);
    if (inferredBuckets.length) {
      buckets = inferredBuckets;
      slotSource = "inferred";
      localStorage.setItem(localSlotKey, JSON.stringify(inferredBuckets));
      localStorage.setItem(localSlotSourceKey, slotSource);
    } else {
      slotSource = "fallback";
    }
  }
  activeSlotBuckets = buckets.length ? buckets : [
    { label:"Vormittag", start_hour:0, end_hour:CUTOFF },
    { label:"Nachmittag", start_hour:CUTOFF, end_hour:24 }
  ];
  activeSlotSource = slotSource;
  if (activeTargetSource !== "manual" && eligibleTargetCount) {
    peakTargetRsvps = peakUniqueRsvps(sessions, activeSlotBuckets);
    const estimate = estimateTargetRange(eligibleTargetCount, peakTargetRsvps);
    LO = estimate.low;
    HI = estimate.high;
    activeTargetSource = "access";
  }
  const slots = groupSlots(sessions, buckets);
  dashboardState = { slots, games, rsvpsOpen, ev, eventsList, con, slotSource };
  renderLoadedDashboard();
}).catch(err => {
  document.getElementById("status").innerHTML = isEnglish()
    ? `<span class="err">Data could not be loaded (${err.message}).</span> Reload the page or view the event directly on <a href="${EVENT_URL}">Playabl</a>.`
    : `<span class="err">Daten konnten nicht geladen werden (${err.message}).</span> Bitte Seite neu laden oder direkt auf <a href="${EVENT_URL}">Playabl</a> schauen.`;
});
