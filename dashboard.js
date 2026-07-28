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

const fmt = new Intl.DateTimeFormat("de-AT", { timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit" });
const fmtTime = new Intl.DateTimeFormat("de-AT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourOf = t => parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(t)), 10);

// Nur verwendet, wenn weder konfigurierte noch erkannte Slots vorliegen.
let slotRuleHint = `Zuordnung: Session-Start vor ${CUTOFF}:00 Uhr = Vormittag, danach = Nachmittag (Zeitzone ${TZ}).`;
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
  const starts = sessions.map(sessionStartMinute).filter(Number.isFinite).sort((a, b) => a - b);
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
  document.getElementById("slotConfigRows").innerHTML = shown.map(slotConfigRow).join("");
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
    if (!map.has(key)) map.set(key, { date: d, part, day: fmt.format(new Date(s.start_time)), games: [] });
    map.get(key).games.push({
      title: s.game_id.title.replace(/\s*[\[(][^\])]*(?:3W6|Offline|Con)[^\])]*[\])]\s*/gi, "").trim() || s.game_id.title,
      url: "https://app.playabl.io/games/" + s.game_id.id,
      system: (s.game_id.system || "").trim() || "Kein System angegeben",
      facilitator: (s.game_id.creator_id?.username || "").trim() || "Nicht angegeben",
      ws: WS_RE.test((s.game_id.system || "") + " " + s.game_id.title),
      seats: s.participant_count + 1,  // Spielplätze + 1 anbietende Person (SL/Moderation)
      playerSeats: s.participant_count,
      rsvps: (s.rsvps || []).length,
      start: fmtTime.format(new Date(s.start_time)),
      end: fmtTime.format(new Date(s.end_time))
    });
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || (rank.get(a.part) ?? 99) - (rank.get(b.part) ?? 99));
}

const reg = s => s.games.filter(g => !g.ws);
const wsOf = s => s.games.filter(g => g.ws);
const seatsOf = s => reg(s).reduce((x, g) => x + g.seats, 0);
const slotName = s => `${s.day.split(",")[0]} ${s.part}`;
const frei = g => Math.max(0, g.playerSeats - g.rsvps);

function eventRangeText(a, b) {
  const full = new Intl.DateTimeFormat("de-AT", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
  const dayOnly = new Intl.DateTimeFormat("de-AT", { timeZone: TZ, day: "numeric" });
  const monthYear = d => new Intl.DateTimeFormat("de-AT", { timeZone: TZ, month: "numeric", year: "numeric" }).format(d);
  const dA = new Date(a), dB = new Date(b);
  if (dayOnly.format(dA) === dayOnly.format(dB) && monthYear(dA) === monthYear(dB)) return full.format(dA);
  return monthYear(dA) === monthYear(dB)
    ? `${dayOnly.format(dA)}.–${full.format(dB)}`
    : `${full.format(dA)} – ${full.format(dB)}`;
}

function applyEvent(ev, rsvpsOpen) {
  const name = ev?.title || `Playabl-Event ${EVENT}`;
  document.title = `${name} – Spielangebot pro Slot`;
  document.getElementById("pageTitle").textContent = name;
  const range = ev?.start_time && ev?.end_time ? eventRangeText(ev.start_time, ev.end_time) : "";
  document.getElementById("pageSub").innerHTML =
    `${range ? `<span class="event-date">${range}</span>` : ""}<span class="event-source">Datenquelle: <a href="${EVENT_URL}" style="color:inherit">${name} auf Playabl</a> · lädt bei jedem Öffnen live</span>`;

  const banner = document.getElementById("rsvpBanner");
  if (ev?.fixed_access_time) {
    const when = new Intl.DateTimeFormat("de-AT", { timeZone: TZ, dateStyle: "full", timeStyle: "short" }).format(new Date(ev.fixed_access_time));
    banner.hidden = false;
    if (rsvpsOpen) {
      banner.classList.add("open");
      banner.innerHTML = `✅ <strong>Anmeldung ist offen</strong> (seit ${when} Uhr) – freie Plätze siehe „Wo ist noch Platz?" und Kalender.`;
    } else {
      banner.innerHTML = `🔒 <strong>Anmeldung noch gesperrt</strong> – RSVPs öffnen am ${when} Uhr. Bis dahin zeigt die Seite das Angebot.`;
    }
  }
}

// ---------- Übersichts-Ansicht ----------
function render(slots, rsvpsOpen) {
  const app = document.getElementById("app");
  const tooltip = document.getElementById("tooltip");
  const workshops = slots.flatMap(s => wsOf(s).map(g => ({ ...g, slot: s })));
  const totalSessions = slots.reduce((a, s) => a + reg(s).length, 0);
  const totalSeats = slots.reduce((a, s) => a + seatsOf(s), 0);
  const totalRsvps = slots.reduce((a, s) => a + reg(s).reduce((x, g) => x + g.rsvps, 0), 0);
  const showBusy = rsvpsOpen || totalRsvps > 0;
  const avgSeats = totalSeats / Math.max(1, totalSessions);
  const MAX = Math.max(90, HI + 10, ...slots.map(s => seatsOf(s) + 5));
  const pct = v => (v / MAX * 100) + "%";
  const allReg = slots.flatMap(s => reg(s).map(g => ({ ...g, slot: s })));
  const freeTotal = allReg.reduce((a, g) => a + frei(g), 0);
  const sectionInfoLabel = (de, en) => document.documentElement.lang === "en" ? en : de;
  sectionInfoEntries = {
    chart: en => ({
      title:en ? "How to read the capacity chart" : "So liest du die Platzgrafik",
      intro:en ? "Meaning of segments, target band, and interactions." : "Bedeutung von Segmenten, Zielband und Interaktionen.",
      html:en
        ? `<section><h3>Sessions and capacity</h3><p>Each blue segment represents one session. Its width corresponds to the player seats plus the person running it.${showBusy ? " The lighter portion is already occupied." : ""} The dashboard includes only sessions recorded on Playabl.</p></section><section><h3>Interaction</h3><p>Hover over a segment to see its title and capacity. Clicking opens the session on Playabl; some details may require a login.</p></section><section><h3>Target range</h3><p>The grey band marks the target of ${LO}–${HI} accommodated people per slot.${workshops.length ? " Dashed outlines show additional workshop or special capacity, which is not included in the regular-session totals." : ""}</p></section>`
        : `<section><h3>Runden und Plätze</h3><p>Jedes blaue Segment steht für eine Session. Seine Breite entspricht den Spielplätzen plus der anbietenden Person.${showBusy ? " Der hellere Anteil ist bereits belegt." : ""} Das Dashboard berücksichtigt nur Runden, die auf Playabl erfasst sind.</p></section><section><h3>Interaktion</h3><p>Mouseover zeigt Titel und Kapazität. Ein Klick öffnet die Runde auf Playabl; manche Details sind dort erst nach dem Login sichtbar.</p></section><section><h3>Zielkorridor</h3><p>Das graue Band markiert das Ziel von ${LO}–${HI} untergebrachten Personen pro Slot.${workshops.length ? " Gestrichelte Umrisse zeigen zusätzliche Workshop- oder Special-Plätze; sie zählen nicht zu den regulären Runden." : ""}</p></section>`
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
        ? `<section><p>The dashboard compares the offered capacity in each slot with the lower target of ${LO}. The number shown is the remaining capacity needed to reach that value.</p>${workshops.length ? "<p>Workshops and specials provide additional capacity but are shown separately, so a slot may in practice need fewer additional regular sessions.</p>" : ""}</section>`
        : `<section><p>Das Dashboard vergleicht die angebotenen Plätze jedes Slots mit dem unteren Zielwert von ${LO}. Die angezeigte Zahl ist die noch fehlende Kapazität bis zu diesem Wert.</p>${workshops.length ? "<p>Workshops und Specials schaffen zusätzliche Plätze, werden aber getrennt dargestellt. Praktisch kann ein Slot daher weniger zusätzliche reguläre Runden benötigen.</p>" : ""}</section>`
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
      <section class="kpi bento-hero" aria-labelledby="heroKpiLabel"><div class="l" id="heroKpiLabel">Sessions gesamt</div><div class="v">${totalSessions}</div><div class="bento-hero-copy">${totalSeats} Spielplätze über ${slots.length} Slots · ø ${avgSeats.toFixed(1).replace(".", ",")} pro Runde</div><div class="bento-slot-bars" role="list" aria-label="Zielstatus der Plätze pro Slot">${slots.map(s => { const seats = seatsOf(s); const status = seats >= LO ? "Ziel erreicht" : `noch ${LO - seats} Plätze bis zum Ziel`; const label = `${slotName(s)}: ${seats} Plätze, ${status}`; return `<span role="listitem" aria-label="${escapeHtml(label)}" class="${seats >= LO ? "is-on-target" : "is-below-target"}" style="--slot-fill:${Math.min(100, seats / LO * 100)}%" title="${escapeHtml(label)}"></span>`; }).join("")}</div><div class="bento-hero-legend" aria-hidden="true">${document.documentElement.hasAttribute("data-color-aid") ? `Je Marker ein Slot · ✓ = Ziel (${LO}+) erreicht, ! = darunter` : `Je Balken ein Slot · grün = Ziel (${LO}+) erreicht, rot = darunter`}</div></section>
      <section class="bento-kpis" aria-label="Kennzahlen">
      <div class="kpi"><div class="l">Spielplätze gesamt</div><div class="v">${totalSeats}</div></div>
      ${workshops.length ? `<div class="kpi"><div class="l">Workshops &amp; Specials</div><div class="v">${workshops.length}</div></div>` : ""}
      ${showBusy ? `<div class="kpi kpi-good"><div class="l">Spielplätze noch frei</div><div class="v">${freeTotal}</div></div>` : ""}
      <div class="kpi bento-target"><div class="l">Ziel je Slot</div><div class="v">${LO}–${HI}</div></div>
      ${CONFIG.erwartete ? `<div class="kpi"><div class="l">erwartete Teilnehmende</div><div class="v">${CONFIG.erwartete}/Tag</div></div>` : ""}
      ${!showBusy && !workshops.length ? `<div class="kpi"><div class="l">Slots im Programm</div><div class="v">${slots.length}</div></div>` : ""}
    </section>
    <section class="card bento-chart">
      <div class="card-title-row"><h2 id="chartHeading">Angebotene Spielplätze pro Slot</h2><button type="button" class="section-info-button" data-section-info="chart" aria-label="${sectionInfoLabel("Erklärung zur Platzgrafik", "Explanation of the capacity chart")}"><span aria-hidden="true">i</span></button></div>
      <div class="chart" id="chart" aria-labelledby="chartHeading"></div>
      <div class="baseline-x" aria-hidden="true"><div></div><div class="xticks" id="xticks"></div></div>
    </section>
    <div class="bento-side-row">
      <div class="card bento-open">
        <div class="card-title-row"><h2>Wo ist noch Platz?</h2><button type="button" class="section-info-button" data-section-info="free" aria-label="${sectionInfoLabel("Erklärung zu freien Plätzen", "Explanation of available seats")}"><span aria-hidden="true">i</span></button></div>
        <div id="freeList"></div>
        <p class="hp-more" id="freeMore"></p>
      </div>
      <div class="card bento-needs">
        <div class="card-title-row"><h2>Wo werden noch Runden gebraucht?</h2><button type="button" class="section-info-button" data-section-info="needs" aria-label="${sectionInfoLabel("Erklärung zum Rundenbedarf", "Explanation of additional session demand")}"><span aria-hidden="true">i</span></button></div>
        <div class="needs-list" id="needsList" role="list"></div>
      </div>
    </div>
    <div class="card bento-full"><h2>Alle Sessions im Detail</h2><div id="detail"></div></div>
    ${workshops.length ? `<div class="card bento-full"><h2>Workshops &amp; Specials</h2>
      <p class="hint">Erkannt an „Workshop/Panel/Vortrag" in Titel oder System. Sie zählen oben nicht in Runden und Plätze, damit sie die Übersicht nicht verzerren.</p>
      <div id="wsList" role="list"></div></div>` : ""}
    <div class="card" id="funCard" hidden>
      <h2>Insights</h2>
      <p class="hint">Live aus allen angebotenen Runden.</p>
      <div class="facts" id="facts"></div>
      <div class="card-title-row" style="justify-content:flex-start;flex-wrap:wrap;margin:20px 0 8px">
        <h3 style="margin:0">Systeme</h3>
        <button type="button" class="section-info-button" data-section-info="systems" aria-label="${sectionInfoLabel("Erklärung zur Systemauswertung", "Explanation of the system analysis")}"><span aria-hidden="true">i</span></button>
        <select id="sysMode" class="inline-select" aria-label="Zählweise der Systeme" hidden>
          <option value="field">nur System-Feld</option>
          <option value="mentions">Systemfamilien (Erwähnungen)</option>
        </select>
      </div>
      <p class="sr-only" id="sysHint"></p>
      <div id="sysList"></div>
      <p class="hp-more" id="sysMore"></p>
      <div class="card-title-row" style="margin-top:24px"><h3 id="cloudHeading">Wortwolke aus den Rundenbeschreibungen</h3><button type="button" class="section-info-button" data-section-info="cloud" aria-label="${sectionInfoLabel("Erklärung zur Wortwolke", "Explanation of the word cloud")}"><span aria-hidden="true">i</span></button></div>
      <p class="sr-only" id="cloudHint">Mit der Maus über ein Wort fahren zeigt Häufigkeit und Anteil; ein Klick öffnet zufällige Ausschnitte im Kontext.</p>
      <div id="cloud" aria-label="Interaktive Wortwolke"></div>
      <p class="sr-only" id="cloudAlt"></p>
    </div>
    </div>`;

  const chart = document.getElementById("chart");
  for (const slot of slots) {
    const seats = seatsOf(slot);
    const rsvps = reg(slot).reduce((x, g) => x + g.rsvps, 0);
    const nWs = wsOf(slot).length;
    const row = document.createElement("div");
    row.className = "row";
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", `${slotName(slot)}: ${seats} Plätze; ${seats >= LO ? "Ziel erreicht" : `${LO - seats} Plätze fehlen bis zum Ziel`}`);
    row.innerHTML = `<div class="lbl"><b>${slotName(slot)}</b><span>${slot.date.slice(8)}.${slot.date.slice(5, 7)}. · ${reg(slot).length} Runden${nWs ? ` · +${nWs} Workshop${nWs > 1 ? "s" : ""}` : ""}${showBusy ? ` · ${rsvps + reg(slot).length} belegt` : ""}</span><span class="mstats">${seats} Plätze${LO - seats > 0 ? ` · noch +${LO - seats} bis Ziel` : " · Ziel erreicht"}</span></div>`;
    const track = document.createElement("div");
    track.className = "track";
    const band = document.createElement("div");
    band.className = "band";
    band.setAttribute("aria-hidden", "true");
    band.innerHTML = `<span class="band-label">Ziel ${LO}–${HI}</span>`;
    band.style.left = pct(LO);
    band.style.width = ((HI - LO) / MAX * 100) + "%";
    track.appendChild(band);
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.width = pct(seats);
    for (const g of reg(slot)) {
      const seg = document.createElement("a");
      seg.className = "seg";
      seg.href = g.url;
      seg.target = "_blank";
      seg.rel = "noopener";
      seg.setAttribute("aria-label",
        `${g.title}, ${slotName(slot)} ${g.start} bis ${g.end}, ${g.playerSeats} Spielplätze plus Spielleitung` +
        (showBusy ? `, ${g.rsvps} belegt, ${frei(g)} frei` : "") + ". Öffnet die Runde auf Playabl.");
      seg.style.flex = g.seats + " 0 0";
      if (showBusy) {
        const fill = document.createElement("div");
        fill.className = "fill";
        fill.style.transform = `scaleX(${Math.min(1, (g.rsvps + 1) / g.seats)})`;
        seg.appendChild(fill);
      }
      seg.addEventListener("mousemove", e => {
        tooltip.style.display = "block";
        tooltip.innerHTML = `<div class="t">${g.title}</div><div class="s">${g.start}–${g.end} · ${g.playerSeats} Spielplätze + SL/Mod${showBusy ? ` · ${g.rsvps + 1}/${g.seats} belegt · ${frei(g)} frei` : ""} · Klick öffnet die Runde</div>`;
        tooltip.style.left = Math.min(e.clientX + 14, innerWidth - tooltip.offsetWidth - 8) + "px";
        tooltip.style.top = (e.clientY + 14) + "px";
      });
      seg.addEventListener("mouseleave", () => tooltip.style.display = "none");
      bar.appendChild(seg);
    }
    track.appendChild(bar);
    const wsSeatsTotal = wsOf(slot).reduce((x, g) => x + g.seats, 0);
    if (wsSeatsTotal > 0) {
      const ghost = document.createElement("div");
      ghost.className = "ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.style.left = pct(seats);
      ghost.style.width = pct(Math.max(0, Math.min(wsSeatsTotal, MAX - seats)));
      track.appendChild(ghost);
    }
    const val = document.createElement("div");
    val.className = "val";
    val.style.left = `calc(${pct(seats)} + 8px)`;
    val.textContent = seats;
    track.appendChild(val);
    if (LO - seats > 0) {
      const gap = document.createElement("div");
      gap.className = "gap-note";
      gap.style.left = `calc(${pct(seats)} + 30px)`;
      gap.textContent = `+${LO - seats} bis Ziel` + (nWs ? ` · Workshop${nWs > 1 ? "s" : ""} (+${wsSeatsTotal} Pl.) hilft` : "");
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
    `<div class="needs-row" role="listitem" aria-label="${slotName(slot)}: ${missing ? `${missing} Plätze fehlen bis zum Ziel` : "Ziel erreicht"}">
      <span class="needs-name">${slotName(slot)}</span>
      <span class="needs-track" aria-hidden="true"><span class="needs-fill" style="width:${missing / maxMissing * 100}%"></span></span>
      <span class="needs-value">${missing ? `+${missing}` : "✓"}</span>
    </div>`).join("");

  const detail = document.getElementById("detail");
  for (const slot of slots) {
    const d = document.createElement("details");
    const rows = reg(slot).map(g => `<tr>
      <td><a href="${g.url}" target="_blank" rel="noopener" style="color:inherit">${escapeHtml(g.title)}</a></td>
      <td class="game-system">${escapeHtml(g.system)}</td>
      <td class="game-facilitator">${escapeHtml(g.facilitator)}</td>
      <td>${g.start}–${g.end} · ${g.playerSeats}+SL${showBusy ? ` · ${g.rsvps + 1}/${g.seats} belegt` : ""}</td>
    </tr>`).join("");
    d.innerHTML = `<summary>${slot.day} ${slot.part} — ${reg(slot).length} Runden, ${seatsOf(slot)} Plätze</summary><div class="tscroll"><table class="games"><caption class="sr-only">Runden am ${slot.day} ${slot.part}</caption><thead><tr><th>Session</th><th>System</th><th>SL</th><th>Zeit &amp; Plätze</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    detail.appendChild(d);
  }

  if (workshops.length) {
    document.getElementById("wsList").innerHTML = workshops.map(w =>
      `<div class="ws-row" role="listitem"><a href="${w.url}" target="_blank" rel="noopener">${w.title}</a>
       <span>${slotName(w.slot)} · ${w.start}–${w.end} · ${w.playerSeats} Plätze</span></div>`).join("");
  }

  if (showBusy) {
    const open = allReg.filter(g => frei(g) > 0).sort((a, b) => frei(b) - frei(a));
    const full = allReg.length - open.length;
    if (open.length) document.getElementById("freeList").setAttribute("role", "list");
    else document.getElementById("freeList").removeAttribute("role");
    document.getElementById("freeList").innerHTML = open.map(g =>
      `<div class="free-row" role="listitem"><a href="${g.url}" target="_blank" rel="noopener">${g.title}</a>
       <span>${slotName(g.slot)} · ${g.start}–${g.end} <span class="badge frei">${frei(g)} von ${g.playerSeats} frei</span></span></div>`).join("")
      || '<p class="hint">Aktuell sind alle Runden voll.</p>';
    document.getElementById("freeMore").textContent = full > 0 ? `${full} weitere Runden sind bereits voll.` : "";
  } else {
    document.getElementById("freeList").removeAttribute("role");
    document.getElementById("freeList").innerHTML =
      '<p class="hint">Die Anmeldung ist noch geschlossen. Freie Plätze werden hier angezeigt, sobald RSVPs geöffnet sind.</p>';
  }
}

// ---------- Kalender-Ansicht ----------
function renderCalendar(slots, rsvpsOpen) {
  const cal = document.getElementById("calView");
  const showBusy = rsvpsOpen || slots.some(s => s.games.some(g => g.rsvps > 0));
  const days = new Map();
  for (const s of slots) {
    if (!days.has(s.date)) days.set(s.date, { day: s.day, parts: {} });
    days.get(s.date).parts[s.part] = s;
  }
  const systems = [...new Map(slots.flatMap(slot => slot.games).map(game => [game.system.toLocaleLowerCase("de"), game.system])).values()]
    .sort((a, b) => a.localeCompare(b, "de", { sensitivity:"base", numeric:true }));
  const totalGames = slots.reduce((sum, slot) => sum + slot.games.length, 0);
  const card = (g, day) => `
    <a class="cal-card" data-calendar-game data-day="${escapeHtml(day)}" data-system="${escapeHtml(g.system.toLocaleLowerCase("de"))}" data-search="${escapeHtml(`${g.title} ${g.system} ${g.facilitator}`.toLocaleLowerCase("de"))}" data-free="${String(!g.ws && frei(g) > 0)}" href="${g.url}" target="_blank" rel="noopener" aria-label="${escapeHtml(`${g.title}, System ${g.system}, Spielleitung ${g.facilitator}, ${g.start} bis ${g.end}${g.ws ? ", Workshop" : `, ${g.playerSeats} Spielplätze plus Spielleitung${showBusy ? `, ${frei(g)} frei` : ""}`}`)}">
      <span class="t">${escapeHtml(g.title)}</span>
      <span class="m">${g.start}–${g.end}${g.ws ? ' <span class="badge">Workshop</span>' : ` · ${g.playerSeats}+SL${showBusy ? (frei(g) > 0 ? ` <span class="badge frei">${frei(g)} frei</span>` : ' <span class="badge voll">voll</span>') : ""}`}</span>
      <span class="m"><span>${escapeHtml(g.system)}</span><span aria-hidden="true">·</span><span>SL: ${escapeHtml(g.facilitator)}</span></span>
    </a>`;
  cal.innerHTML = `
    <section class="calendar-filters" aria-label="Kalender filtern">
      <label class="calendar-filter-field" for="calendarSearch">
        <span class="calendar-filter-label">Suche</span>
        <input class="calendar-filter-input" id="calendarSearch" type="search" autocomplete="off" placeholder="Session, System oder SL …">
      </label>
      <label class="calendar-filter-field" for="calendarSystem">
        <span class="calendar-filter-label">System</span>
        <input class="calendar-filter-input" id="calendarSystem" type="search" list="calendarSystemSuggestions" autocomplete="off" placeholder="System eingeben …">
        <datalist id="calendarSystemSuggestions">${systems.map(system => `<option value="${escapeHtml(system)}"></option>`).join("")}</datalist>
      </label>
      <div class="calendar-filter-field calendar-slot-filter">
        <span class="calendar-filter-label" id="calendarDayFilterLabel">Tag</span>
        <div class="calendar-slot-chips" role="group" aria-labelledby="calendarDayFilterLabel">
          <button type="button" class="calendar-slot-chip" data-day-filter="" aria-pressed="true">Alle Tage</button>
          ${[...days.entries()].map(([date, day]) => `<button type="button" class="calendar-slot-chip" data-day-filter="${escapeHtml(date)}" aria-pressed="false">${escapeHtml(day.day)}</button>`).join("")}
        </div>
      </div>
      <div class="calendar-filter-footer">
        ${rsvpsOpen ? `<button type="button" class="calendar-free-toggle" id="calendarFreeFilter" aria-pressed="false"><span aria-hidden="true">○</span> Nur freie Plätze</button>` : ""}
        <button type="button" class="calendar-filter-reset" id="calendarFilterReset" hidden>Filter zurücksetzen</button>
        <span class="calendar-filter-count" id="calendarFilterCount" role="status" aria-live="polite">${totalGames} Runden</span>
      </div>
    </section>
    <p class="calendar-empty" id="calendarNoResults" hidden>Keine Sessions entsprechen diesen Filtern.</p>
    <div class="calendar-bento">${[...days.entries()].map(([date, d]) => {
    const parts = Object.values(d.parts);
    return `
    <div class="card cal-day" data-calendar-day="${escapeHtml(date)}">
      <h2>${d.day}</h2>
      <div class="cal-cols" style="--calendar-columns:${Math.min(3, Math.max(1, parts.length))}">
        ${parts.map(slot => {
          const seats = seatsOf(slot);
          const free = reg(slot).reduce((sum, game) => sum + frei(game), 0);
          const missing = Math.max(0, LO - seats);
          const badge = showBusy ? `${free} frei` : (missing ? `noch +${missing} bis Ziel` : "Ziel erreicht");
          const badgeClass = showBusy || !missing ? "is-good" : "is-warn";
          return `
          <div class="cal-col" data-calendar-slot>
            <div class="cal-col-head"><h3>${slot.part}</h3><span class="cal-slot-badge ${badgeClass}">${badge}</span></div>
            ${slot.games.map(game => card(game, slot.date)).join("") || '<p class="hint">– keine Runden –</p>'}
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
    const query = searchInput.value.trim().toLocaleLowerCase("de");
    const queryTerms = query.split(/\s+/).filter(Boolean);
    const systemQuery = systemInput.value.trim().toLocaleLowerCase("de");
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
    count.textContent = visibleGames === totalGames ? `${totalGames} Runden` : `${visibleGames} von ${totalGames} Runden`;
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
  csel.appendChild(new Option("Alle Communities", ""));
  [...communities.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => csel.appendChild(new Option(name, id)));
  const current = events.find(e => String(e.id) === EVENT);
  csel.value = current?.community_id?.id || "";
  fillEventOptions();
}

function fillEventOptions() {
  const cid = document.getElementById("communitySelect").value;
  const sel = document.getElementById("eventSelect");
  const dFmt = new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const list = cid ? allEvents.filter(e => String(e.community_id?.id) === cid) : allEvents;
  sel.innerHTML = "";
  if (!list.some(e => String(e.id) === EVENT)) {
    const ph = new Option("– Event wählen –", "");
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
  games = games.filter(g => !WS_RE.test((g.system || "") + " " + g.title));
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
    { v: (seats.reduce((a, b) => a + b, 0) / seats.length).toFixed(1).replace(".", ","), l: "Personen pro Runde (ø, inkl. SL)" },
    { v: systems.size, l: "verschiedene Systeme – Vielfalt!", action:"systems" },
    { v: `${Math.round(gmless / games.length * 100)} %`, l: "der Runden kommen ohne SL aus" },
    { v: `${Math.round(xcard / games.length * 100)} %`, l: "erwähnen die X-Karte" },
    { v: biggest.participant_count + "+SL", l: `größte Runde: ${cleanTitle(biggest.title)}` },
    { v: smallest.participant_count + "+SL", l: `intimste Runde: ${cleanTitle(smallest.title)}` },
  ];
  document.getElementById("facts").innerHTML =
    facts.map(f => f.action === "systems"
      ? `<button type="button" class="fact fact-button" data-show-all-systems aria-controls="sysList" aria-expanded="false" aria-label="${escapeHtml(`${f.v} verschiedene Systeme. Vollständige Liste anzeigen.`)}"><div class="v">${f.v}</div><div class="l">${f.l}</div></button>`
      : `<div class="fact"><div class="v">${f.v}</div><div class="l">${f.l}</div></div>`).join("");

  // Feldmodus gruppiert Bezeichnungen, Nennungsmodus zählt konfigurierte Familien.
  const systemCollator = new Intl.Collator("de", { sensitivity:"base", numeric:true });
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
      ? "Zählt, in wie vielen Runden die Spielfamilie erwähnt wird – im System-Feld, Titel oder in der Beschreibung. Eine Runde kann zu mehreren Familien passen."
      : "Zählt schlicht, was im System-Feld der Runden steht (gleiche Schreibweisen zusammengefasst).";
    const list = document.getElementById("sysList");
    list.innerHTML = rows.map((s, index) =>
      `<button type="button" class="hp-row" data-system-index="${index}" aria-label="${escapeHtml(`${s.name}: ${s.n} Runden. Klick zeigt die Spiele.`)}"><span class="hp-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
       <span class="hp-track"><span class="hp-bar" style="width:${s.n / maxN * 100}%"></span></span>
       <span class="hp-n">${s.n}×</span></button>`).join("") || '<p class="hint">Keine Einträge.</p>';
    for (const button of list.querySelectorAll("[data-system-index]")) {
      const system = rows[+button.dataset.systemIndex];
      button.addEventListener("click", () => openWordContext({
        type:"system", name:system.name, matches:system.matches, family:Boolean(system.fam)
      }));
    }
    const more = document.getElementById("sysMore");
    document.querySelector("[data-show-all-systems]")?.setAttribute("aria-expanded", String(mode === "field" && showAllSystems));
    more.innerHTML = mode === "field" && singles > 0
      ? `<button type="button" class="system-more-toggle" aria-expanded="${String(showAllSystems)}">${showAllSystems ? "Weniger Systeme anzeigen" : `… plus ${singles} Systeme, die genau einmal angeboten werden. Alle anzeigen.`}</button>`
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
      "Häufigste Wörter in den Beschreibungen: " + words.slice(0, 12).map(([w, n]) => `${w} (${n}×)`).join(", ") + ".";
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
Promise.all([load(), loadGames(), loadEvent(), loadEventsList(), findRaumplanCon(EVENT)]).then(async ([sessions, games, ev, eventsList, con]) => {
  renderCredits(con);
  document.getElementById("status").textContent =
    "Stand: " + new Intl.DateTimeFormat("de-AT", { timeZone: TZ, dateStyle: "full", timeStyle: "short" }).format(new Date()) + " Uhr";
  const rsvpsOpen = !!(ev?.fixed_access_time && ev.fixed_access_time <= Date.now());
  applyEvent(ev, rsvpsOpen);
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
  if (buckets.length) {
    const origin = slotSource === "inferred"
      ? "Automatisch aus den Session-Startzeiten erkannte Slots"
      : slotSource === "manual"
        ? "Lokal definierte Slot-Zeiten"
        : "Zuordnung folgt den Zeitabschnitten der verknüpften Con-Raumplan-Con";
    slotRuleHint = `${origin}: ${buckets.map(b => `${b.label} (${b.start_hour}–${b.end_hour} Uhr)`).join(", ")} (Zeitzone ${TZ}).`;
  }
  const slots = groupSlots(sessions, buckets);
  render(slots, rsvpsOpen);
  renderCalendar(slots, rsvpsOpen);
  renderFun(games);
  fillEventsList(eventsList);
  document.getElementById("zielMin").value = LO;
  document.getElementById("zielMax").value = HI;
  document.getElementById("targetSummary").textContent = `${LO}–${HI}`;
  updateTargetMeta();
  document.getElementById("slotsSummary").textContent =
    activeSlotBuckets.map(bucket => `${bucket.label} ${bucket.start_hour}–${bucket.end_hour} Uhr`).join(" · ");
  document.getElementById("slotsSourceSummary").textContent = ({
    manual:"· manuell",
    inferred:"· automatisch erkannt",
    raumplan:"· aus der Raumplanung",
    fallback:"· Standard"
  })[slotSource] || "";
  setView(location.hash === "#kalender" ? "kalender" : "uebersicht");
}).catch(err => {
  document.getElementById("status").innerHTML =
    `<span class="err">Daten konnten nicht geladen werden (${err.message}).</span> Bitte Seite neu laden oder direkt auf <a href="${EVENT_URL}">Playabl</a> schauen.`;
});
