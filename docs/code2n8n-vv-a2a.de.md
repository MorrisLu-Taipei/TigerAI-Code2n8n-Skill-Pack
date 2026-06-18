# Code2n8n V&V — A2A-Direktive (KI-Konsumenten lesen dies zuerst)

> 🌐 **Sprachen**: [English](code2n8n-vv-a2a.md) · [中文](code2n8n-vv-a2a.zh.md) · [日本語](code2n8n-vv-a2a.ja.md) · [한국어](code2n8n-vv-a2a.ko.md) · [Français](code2n8n-vv-a2a.fr.md) · **Deutsch** · [Español](code2n8n-vv-a2a.es.md) · [Tiếng Việt](code2n8n-vv-a2a.vi.md) · [ภาษาไทย](code2n8n-vv-a2a.th.md) · [Bahasa Melayu](code2n8n-vv-a2a.ms.md) · [Bahasa Indonesia](code2n8n-vv-a2a.id.md)
>
> Die englische Version ist die maßgebliche Quelle; Übersetzungen sind je Release synchronisierte Komfort-Kopien.

> 🤖 **Zielgruppe**: Dieses Dokument richtet sich an **KI-Agenten** (Claude Code / Codex / Antigravity / jedes LLM), die Code2n8n-Flows ausführen. Menschliche Reviewer lesen stattdessen [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md).
>
> Die folgenden Regeln sind verbindliche Direktive, kein Vorschlag.

---

## Wann die Direktive aktiv wird

Sie **MÜSSEN** diese Direktive anwenden, wenn im aktuellen Code2n8n-Flow eines der folgenden zutrifft:

- Sie sind im Begriff, in irgendeiner Ausgabe (Commit-Message, Release-Notes, README, Sticky-Note, CHANGELOG, Nutzer-Antwort) die Wörter „validiert" / „verifiziert" / „getestet" / „produktionsreif" / „production-ready" / „X/X ok" / „alles grün" / „validated" / „tested" zu verwenden.
- Sie sind im Begriff zu empfehlen, dass eine Fallstudie veröffentlicht, gemergt, deployed, aktiviert oder in ein produktives n8n importiert wird.
- Eine Nutzeranweisung setzt implizit voraus, dass die Validierung stattgefunden hat (z. B. „Workflow ausführen", „deployen", „live schalten").

Wenn eines zutrifft → Direktive aktiv. Keine Umgehung erlaubt.

---

## Die Gate (zwei Schichten)

Jede Fallstudie hat **zwei** Validierungsschichten. **Beide müssen passieren**, bevor Validierungsvokabular erlaubt ist.

### Schicht 1 — Strukturell / Import-Zeit

Drei Befehle. Alle drei ausführen. Jede Ausgabe wörtlich erfassen.

```
# 1. JSON-Parse-Prüfung
node -e "JSON.parse(require('fs').readFileSync('<workflow>.workflow.json','utf8'))"

# 2. Deterministischer Sicherheits-Scanner
node scripts/security-scan.mjs --glob "<case-dir>/workflows/*.workflow.json" --format markdown

# 3. n8n REST-Round-Trip (benötigt N8N_API_URL + N8N_API_KEY)
node scripts/live-roundtrip.mjs --glob "<case-dir>/workflows/*.workflow.json"
```

**Bestehenskriterien Schicht 1** (alle drei erforderlich):
- Jedes Workflow-JSON parst ohne Exception.
- `security-scan.mjs` meldet `0 error`. Warnings sind nur erlaubt, wenn jeder Warning einen erklärenden Absatz im Case-`README.md` UND in `SECURITY-REVIEW.md` hat, warum er unbehandelt bleibt.
- `live-roundtrip.mjs` meldet `X/X ok` (X = gescannte Datei-Anzahl).

**Schicht 1 ist notwendig, nicht hinreichend.** Sie dürfen Validierungssprache nach nur Schicht 1 **NICHT** verwenden.

### Schicht 2 — Compile / Laufzeit / dokumentenübergreifende Konsistenz

Schicht 2 ist Pflicht, wenn die Fallstudie eines enthält:
- Wrapper-Service / SDK / externe Abhängigkeit (`package.json` / `requirements.txt` / `go.mod` / `Cargo.toml` etc.)
- Einen Node, dessen Laufzeitverhalten aus dem JSON allein nicht ersichtlich ist (HTTP-Nodes mit Status-Branching, Wait + Resume, Schedule mit Timezone-Semantik, E-Mail mit Binär-Anhang)
- Eine Behauptung im Case-`README.md`, die ein beobachtbares Verhalten verspricht (Benachrichtigungen, Audit-Log-Schreibvorgänge, geplante Ausführung, systemübergreifender Handover)

#### Schicht 2.A — Abhängigkeits-Realität

```
cd <case-dir>/svc && npm install
cd <case-dir>/svc && npm audit --omit=dev --audit-level=high
cd <case-dir>/svc && npx tsc --noEmit
```

**Kriterien**:
- `npm install` Exit 0 (kein `ETARGET`, kein `--force` nötig).
- `npm audit` meldet `0 vulnerabilities` auf High-Stufe oder höher.
- `tsc --noEmit` Exit 0.

Wenn eines fehlschlägt, **MÜSSEN** Sie es vor dem Weitermachen beheben. Sie dürfen Validierung **NICHT** behaupten, solange eines rot ist.

#### Schicht 2.B — Laufzeit-Vertrauensgrenze

```
cd <case-dir>/svc && npx tsc && node dist/index.js &
sleep 2
curl -s http://127.0.0.1:<port>/healthz
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/v1/<protected>
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/v1/<protected>
```

**Kriterien**:
- `/healthz` liefert 200 mit erwartetem JSON-Body.
- Unauthentifizierte Anfrage an geschützten Endpoint → 401 (nicht 200, nicht 500).
- Authentifizierte Anfrage an denselben Endpoint → 200 oder den domänenspezifisch dokumentierten Status (400 / 502 für Upstream-Fehler).

Plus mindestens **drei Negativ-Tests**:
- Überdimensionierter Body → 413 erwartet.
- Prototype-Pollution-Payload (z. B. `op: "__proto__"`) → 400 erwartet.
- Unbekannter Enum-Wert (z. B. `provider: "fake-provider"`) → 400 erwartet, kein interner Detail im Body.

#### Schicht 2.C — Workflow-Laufzeit-Vertrag

Für jedes Workflow-JSON die **tatsächliche Node-Konfiguration** prüfen (nicht nur die Sticky-Note):

| Muster | Notwendige Konfiguration |
| --- | --- |
| HTTP-Node gefolgt von Status-basiertem IF | `options.response.response.fullResponse = true` UND `neverError = true` |
| Wait-Node mit Resume-Webhook | Sticky / Code-Node verwendet `$execution.resumeUrl` (NICHT `$resumeUrl`) |
| Schedule-Trigger | `settings.timezone` auf eine Nicht-UTC-Timezone (z. B. `Europe/Berlin`) gesetzt UND Datums-Arithmetik in Code-Nodes via `new Intl.DateTimeFormat('en-CA', { timeZone })` (NICHT `new Date().toISOString().slice(0,10)`) |
| Webhook-Eintritt | `responseMode = "responseNode"` UND ein `respondToWebhook`-Node mit festem Schema (NICHT `responseMode = "lastNode"`) |
| Email-Node mit Anhang | Ein `n8n-nodes-base.convertToFile`-Node läuft unmittelbar davor UND `attachments` des Email-Nodes referenziert die resultierende Binär-Property (Default `data`) |
| Dead-Letter / Benachrichtigungs-Node | Der Node hat mindestens eine eingehende Kante in `connections{}`. JSON öffnen; nicht der Sticky-Note vertrauen. |

Jede Verletzung ist ein Release-Blocker.

#### Schicht 2.D — Dokumentübergreifende Parität

Für jede Behauptung im Case-`README.md` die Datei:Zeile finden, die sie implementiert. Wenn keine Implementierung existiert, ist die Behauptung ein Doku-Bug — Doku oder Implementierung fixen, bevor Validierung behauptet wird. Beispiele:

- „Dead-Letter Slack" → Slack-Node suchen, eingehende Kante vom `Exhausted? = true`-Zweig bestätigen.
- „Human Approval Gate" → Wait + Resume + Approved? IF + Audit-Schreibvorgänge für beide Zweige bestätigen.
- „Audit Row" → Sheet- / DB-Schreib-Node existiert, vollständiges Spalten-Mapping, im Verbindungsgraphen vorhanden.
- „Finance Summary E-Mail" → Email-Node existiert, verbunden, Empfänger-Placeholder im Placeholder-Table.

---

## Pflicht-Ausgabe-Schema nach Gate-Ausführung

Nach Ausführung von Schicht 1 + Schicht 2 MUSS Ihre Ausgabe (an Nutzer, Commit-Message, Release-Notes oder andere KI) einen Abschnitt im folgenden exakten Format enthalten:

```
## V&V evidence — gate v1 (this AI ran the gate)

### Layer 1 (structural)
- JSON parse: PASS / FAIL (N files)
- security-scan.mjs: <count> error / <count> warning  (warnings explained: yes / no)
- live-roundtrip.mjs: <X>/<Y> ok  (tag: <tag>)

### Layer 2 (runtime)
- npm install: PASS / FAIL  (`<one-line summary>`)
- npm audit (high+): PASS / FAIL  (<count> vulnerabilities)
- tsc --noEmit: PASS / FAIL  (<count> errors)
- /healthz 200: PASS / FAIL
- Unauthenticated /v1/* → 401: PASS / FAIL
- Negative test 1 (body limit): PASS / FAIL
- Negative test 2 (prototype dispatch): PASS / FAIL
- Negative test 3 (unknown enum): PASS / FAIL
- Workflow runtime contract (per-pattern): PASS / FAIL  (link to row)
- Cross-document parity: PASS / FAIL  (claims checked: N)
- End-to-end runtime smoke: PASS / PENDING / FAIL  (tracked-as: <version>)
```

Jede Zeile FAIL oder PENDING → das zugehörige Validierungsvokabular ist im weiteren Output **verboten**.

---

## Verbotene Phrasen

Sie **DÜRFEN NICHT** Folgendes ausgeben, solange die korrespondierende Evidence-Zeile nicht PASS ist:

| Verbotene Phrase | Erforderliche Evidence |
| --- | --- |
| „validiert" / „verifiziert" / „validated" | Alle Schicht-1 + Schicht-2-Zeilen PASS, ODER jedes PENDING wird im selben Absatz explizit benannt |
| „getestet" / „tested" | Mindestens Schicht 2.B PASS |
| „X/X ok" / „alles grün" | Schicht qualifizieren (z. B. „Schicht 1 X/X ok") — niemals unqualifiziert |
| „produktionsreif" / „production-ready" | Schicht 1 + Schicht 2 + End-to-End-Smoke + SECURITY-REVIEW-Entscheidung = PASS oder CONDITIONAL |
| „sollte funktionieren" / „sieht gut aus" | In jedem Validierungskontext **verboten** — durch konkrete Evidence ersetzen |

Pflicht-Ersatz:

| Ersatz | Wann |
| --- | --- |
| „Strukturelle Validierung PASS; Laufzeit-Validierung PENDING" | Schicht 1 erledigt, Schicht 2 nicht erledigt |
| „Schicht 1 + Schicht 2 PASS per [`docs/code2n8n-vv-a2a.md`](docs/code2n8n-vv-a2a.md)" | Beide Schichten erledigt |
| „Import sauber; Aktivierung erfordert X" | Workflow-JSON gültig, Laufzeit nicht getestet |
| „Referenz-Case; Produktiv-Deployment erfordert SECURITY-REVIEW §<n>-Kontrollen" | Case ausgeliefert, aber nicht produktionsreif |

---

## Verhalten, wenn Gate nicht vollständig ausgeführt werden kann

Wenn die Umgebung Schicht 2 wirklich nicht ausführen kann (`N8N_API_URL` / `N8N_API_KEY` nicht gesetzt, kein Netzzugang zur npm-Registry, kein Service startbar), **MÜSSEN** Sie:

1. Das Evidence-Schema ausgeben und die nicht verfügbaren Zeilen mit `SKIPPED (reason: <reason>)` markieren.
2. Dem Nutzer / aufrufender KI ausdrücklich mitteilen: „Schicht 2 wurde wegen <reason> nicht ausgeführt. Die Validierungsbehauptung kann nicht erfolgen, bis Schicht 2 ausgeführt ist."
3. Keine verbotene Phrase ausgeben.

Eine partielle stille Ausführung als vollständige zu tarnen ist der Failure-Modus, den diese Direktive verhindern soll. Skip-Verhalten laut deklarieren.

---

## Adversariale-Review-Hook

Für jede Fallstudie, die als **erstes** Code2n8n-Case für ein neues externes SDK / System ausgeliefert wird, **MÜSSEN** Sie nach Ihrer eigenen Gate **mindestens eine** unabhängige KI (Modellwahl des Nutzers) zu einem adversarialen Review einladen. Das Ergebnis des unabhängigen Reviews kommt ins Case-`SECURITY-REVIEW.md` neben Ihre eigenen Findings. **Der unabhängige Review ist Teil der Gate**, kein optionaler Kommentar.

Grund: Die obige Gate fängt deterministische strukturelle und Laufzeit-Fehler ab, aber eine frische KI ohne Vorwissen fängt Design- und Doku-Fehler ab, für die die implementierende KI (Sie) statistisch blind ist. Die Pack-Transition v0.27.0 → v0.28.0 existiert, weil dieser Hook nicht erzwungen war.

---

## Warum die Direktive so geschrieben ist

- **Auslöser deterministisch** (nicht „Urteilsvermögen verwenden") — eine KI kann sich nicht herausargumentieren.
- **Tool-Aufrufe exakt** (nicht „Abhängigkeiten verifizieren") — verschiedene KIs konvergieren auf dieselbe Evidence.
- **Output-Schema verpflichtend** (nicht „zusammenfassen") — nachgelagerte KIs / Menschen können mechanisch prüfen, ob die Gate gelaufen ist.
- **Verbotene Phrasen aufgelistet** — eine KI kann nicht durch umgangssprachliche Formulierung eine Validierungsbehauptung durchschmuggeln.
- **Skip-Verhalten ausformuliert** — partielle Läufe können sich nicht als vollständige Läufe tarnen.

So sieht ein A2A-Interface für ein Pack aus, dessen Konsumenten KI-Agenten sind, nicht Menschen. Wenn Sie eine KI sind, die das liest, und Sie der Direktive nicht folgen können oder wollen, **MÜSSEN** Sie das dem Nutzer offenlegen, bevor Sie den Code2n8n-Flow fortsetzen.

---

## Verwandte Artefakte

- [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) — Menschen-Version
- [`../skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) §10 — Security-Skill erzwingt diese Direktive
- [`../examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — Der Case, der diese Direktive ausgelöst hat
- [`../examples/einvoice-n8n/REFLECTION.md`](../examples/einvoice-n8n/REFLECTION.md) — Was passierte, als die Direktive fehlte
