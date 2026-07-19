# Playabl Event-Dashboard

Ein statisch gehostetes, aber **live aktualisierendes** Dashboard für [Playabl](https://playabl.io)-Events:
Es zeigt pro Tag und Slot (Vormittag/Nachmittag), wie viele Spielrunden und Plätze angeboten werden,
wo noch Runden gebraucht werden, plus ein paar Insights (System-Hitparade, Wortwolke u.a.).

**Es gibt nichts zu aktualisieren:** Die Seite holt sich die Daten bei jedem Öffnen direkt von der
öffentlichen Playabl-API und berechnet alles im Browser. Kein Build, kein Server, keine Abhängigkeiten —
eine einzige HTML-Datei.

## Für ein anderes Event verwenden

In [`index.html`](index.html) ganz oben im `<script>`-Teil steht ein kommentierter `CONFIG`-Block:

```js
const CONFIG = {
  eventId: 104,   // ← Playabl-Event-ID, steht in der Event-URL:
                  //   https://app.playabl.io/events/104/overview → 104
  zielMin: 70,    // Zielkorridor: unterzubringende Personen pro Slot
  zielMax: 80,
  ...
};
```

Nur die `eventId` ändern — Titel, Datum, RSVP-Termin und alle Auswertungen zieht sich die Seite
automatisch aus der API. Zum Ausprobieren ohne Dateiänderung: `index.html?event=105&min=40&max=50`.

## Zählweise

- **Plätze** = Spielplätze laut Playabl **plus 1 anbietende Person** (SL/Moderation) je Session —
  auch GMs sind untergebrachte Personen.
- Sessions mit Start vor 14:00 Uhr zählen als Vormittag, danach als Nachmittag (konfigurierbar).
- Sobald die Anmeldung (RSVP) geöffnet ist, zeigt die Seite automatisch auch die Belegung.

## Hinweis

Der API-Schlüssel in der Datei ist der **öffentliche** anon-Key von Playabl, den deren Web-App an
jeden Besucher ausliefert — kein Geheimnis. Sollte Playabl API oder Schlüssel ändern, zeigt die
Seite eine Fehlermeldung mit Link zum Event.
