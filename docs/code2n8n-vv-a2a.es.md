# Code2n8n V&V — Directiva A2A (los consumidores de IA leen esto primero)

> 🌐 **Idiomas**: [English](code2n8n-vv-a2a.md) · [中文](code2n8n-vv-a2a.zh.md) · [日本語](code2n8n-vv-a2a.ja.md) · [한국어](code2n8n-vv-a2a.ko.md) · [Français](code2n8n-vv-a2a.fr.md) · [Deutsch](code2n8n-vv-a2a.de.md) · **Español** · [Tiếng Việt](code2n8n-vv-a2a.vi.md) · [ภาษาไทย](code2n8n-vv-a2a.th.md) · [Bahasa Melayu](code2n8n-vv-a2a.ms.md) · [Bahasa Indonesia](code2n8n-vv-a2a.id.md)
>
> La versión en inglés es la fuente de verdad; las traducciones son copias de conveniencia sincronizadas por release.

> 🤖 **Audiencia**: este documento está escrito para **agentes IA** (Claude Code / Codex / Antigravity / cualquier LLM) que ejecutan flujos Code2n8n. Los revisores humanos leen [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) en su lugar.
>
> Trate las reglas siguientes como directivas obligatorias, no como sugerencias.

---

## Cuándo se activa la directiva

DEBE aplicar esta directiva cuando cualquiera de los siguientes sea cierto en el flujo Code2n8n actual:

- Está a punto de escribir las palabras "validado" / "verificado" / "probado" / "listo para producción" / "production-ready" / "X/X ok" / "todo en verde" / "validated" / "tested" en cualquier salida (mensaje de commit, notas de release, README, sticky note, CHANGELOG, respuesta al usuario).
- Está a punto de recomendar que un caso de estudio sea publicado, mergeado, desplegado, activado o importado a un n8n de producción.
- Una instrucción del usuario presupone implícitamente que la validación ha ocurrido (ej. "ejecuta el workflow", "despliega esto", "súbelo a producción").

Si alguno es cierto → directiva activa. Sin bypass.

---

## La gate (dos capas)

Cada caso de estudio tiene **dos** capas de validación. **Ambas deben pasar** antes de que se permita lenguaje de validación.

### Capa 1 — Estructural / tiempo de import

Tres comandos. Ejecutar los tres. Capturar cada salida literalmente.

```
# 1. Parseo de JSON
node -e "JSON.parse(require('fs').readFileSync('<workflow>.workflow.json','utf8'))"

# 2. Scanner de seguridad determinista
node scripts/security-scan.mjs --glob "<case-dir>/workflows/*.workflow.json" --format markdown

# 3. Round-trip REST n8n (requiere N8N_API_URL + N8N_API_KEY)
node scripts/live-roundtrip.mjs --glob "<case-dir>/workflows/*.workflow.json"
```

**Criterios de aprobación Capa 1** (los tres requeridos):
- Cada workflow JSON parsea sin excepción.
- `security-scan.mjs` reporta `0 error`. Los warnings solo se permiten si cada uno tiene un párrafo explicativo en el `README.md` del caso Y en `SECURITY-REVIEW.md` justificando por qué queda sin arreglar.
- `live-roundtrip.mjs` reporta `X/X ok` (X = número de archivos escaneados).

**Capa 1 es necesaria, no suficiente.** NO PUEDE usar lenguaje de validación tras solo Capa 1.

### Capa 2 — Compilación / runtime / consistencia entre documentos

Capa 2 es obligatoria si el caso incluye alguno de:
- Servicio wrapper / SDK / dependencia externa (cualquier `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml`).
- Nodo de workflow cuyo comportamiento en runtime no es visible solo desde el JSON (nodos HTTP con branching por status, Wait + resume, Schedule con semántica de timezone, Email con adjunto binario).
- Afirmación en el README del caso que promete comportamiento observable (notificaciones, escrituras al audit log, ejecución programada, handover entre sistemas).

#### Capa 2.A — Realidad de dependencias

```
cd <case-dir>/svc && npm install
cd <case-dir>/svc && npm audit --omit=dev --audit-level=high
cd <case-dir>/svc && npx tsc --noEmit
```

**Criterios**:
- `npm install` exit 0 (sin `ETARGET`, sin `--force`).
- `npm audit` reporta `0 vulnerabilities` en nivel high o superior.
- `tsc --noEmit` exit 0.

Si alguno falla, DEBE arreglarlo antes de proceder. NO DEBE declarar validación mientras alguno esté en rojo.

#### Capa 2.B — Frontera de confianza de runtime

```
cd <case-dir>/svc && npx tsc && node dist/index.js &
sleep 2
curl -s http://127.0.0.1:<port>/healthz
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/v1/<protected>
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/v1/<protected>
```

**Criterios**:
- `/healthz` devuelve 200 con el body JSON esperado.
- Solicitud no autenticada a endpoint protegido → 401 (ni 200, ni 500).
- Solicitud autenticada al mismo endpoint → 200 o el status específico de dominio documentado (400 / 502 para errores upstream).

Más al menos **tres tests negativos**:
- Body sobredimensionado → esperado 413.
- Payload de prototype-pollution (ej. `op: "__proto__"`) → esperado 400.
- Valor de enum desconocido (ej. `provider: "fake-provider"`) → esperado 400, sin detalle interno en el body.

#### Capa 2.C — Contrato de runtime del workflow

Para cada workflow JSON, inspeccionar la **configuración real del nodo** (no solo la sticky note):

| Patrón | Configuración requerida |
| --- | --- |
| Nodo HTTP seguido de IF basado en status | `options.response.response.fullResponse = true` Y `neverError = true` |
| Nodo Wait con resume webhook | Sticky / Code node usa `$execution.resumeUrl` (NO `$resumeUrl`) |
| Trigger Schedule | `settings.timezone` configurado a una tz no-UTC (ej. `Europe/Madrid`) Y aritmética de fechas en Code node usa `new Intl.DateTimeFormat('en-CA', { timeZone })` (NO `new Date().toISOString().slice(0,10)`) |
| Entrada Webhook | `responseMode = "responseNode"` Y un nodo `respondToWebhook` con schema fijo (NO `responseMode = "lastNode"`) |
| Nodo Email con adjunto | Un nodo `n8n-nodes-base.convertToFile` corre justo antes Y `attachments` del nodo Email referencia la propiedad binaria resultante (por defecto `data`) |
| Nodo dead-letter / notificación | El nodo tiene al menos una arista entrante en `connections{}`. Abrir el JSON; no confiar en la sticky note. |

Cualquier violación es bloqueador de release.

#### Capa 2.D — Paridad entre documentos

Para cada afirmación en el `README.md` del caso, localizar la archivo:línea que la implementa. Si la implementación no existe, la afirmación es bug de documentación — arreglar doc o implementación antes de declarar validación. Ejemplos:

- "dead-letter Slack" → buscar el nodo Slack, confirmar arista entrante desde la rama `Exhausted? = true`.
- "puerta de aprobación humana" → confirmar Wait + resume + IF Approved? + escrituras de audit para ambas ramas.
- "audit row" → confirmar el nodo de escritura Sheet / DB existe, mapping de columnas completo, en el grafo de conexiones.
- "email resumen de finanzas" → confirmar nodo Email existe, conectado, placeholder de destinatario en la tabla de placeholders.

---

## Schema de salida OBLIGATORIO tras ejecutar la gate

Tras ejecutar Capa 1 + Capa 2, su salida (a usuario / commit / release notes / otra IA) DEBE incluir una sección con el siguiente formato exacto:

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

Cualquier línea FAIL o PENDING → el lenguaje de validación correspondiente queda **prohibido** en el resto de la salida.

---

## Frases prohibidas

NO DEBE emitir ninguno de lo siguiente a menos que la línea de evidence correspondiente sea PASS:

| Frase prohibida | Evidence requerida |
| --- | --- |
| "validado" / "verificado" / "validated" | Todas las líneas Capa 1 + Capa 2 PASS, O cada PENDING etiquetado explícitamente en el mismo párrafo |
| "probado" / "tested" | Al menos Capa 2.B PASS |
| "X/X ok" / "todo en verde" | Especificar qué gate (ej. "Capa 1 X/X ok") — nunca la forma sin calificar |
| "listo para producción" / "production-ready" | Capa 1 + Capa 2 + smoke end-to-end + decisión SECURITY-REVIEW = PASS o CONDITIONAL |
| "debería funcionar" / "se ve bien" | Prohibido en cualquier contexto de validación — reemplazar por evidence específica |

Sustitutos obligatorios:

| Sustituto | Cuándo |
| --- | --- |
| "Validación estructural PASS; validación de runtime PENDING" | Capa 1 hecha, Capa 2 sin hacer |
| "Capa 1 + Capa 2 PASS per [`docs/code2n8n-vv-a2a.md`](docs/code2n8n-vv-a2a.md)" | Ambas capas hechas |
| "Import limpio; activación requiere X" | Workflow JSON válido, runtime sin probar |
| "Caso de referencia; despliegue en producción requiere los controles SECURITY-REVIEW §<n>" | Caso entregado pero no production-ready |

---

## Comportamiento cuando la gate no puede ejecutarse completa

Si el entorno realmente no puede correr Capa 2 (`N8N_API_URL` / `N8N_API_KEY` sin configurar, sin acceso al registry npm, sin servicio para arrancar), DEBE:

1. Emitir el schema de evidence marcando las líneas no disponibles como `SKIPPED (reason: <reason>)`.
2. Decir explícitamente al usuario / IA que llama: "Capa 2 no ejecutada por <reason>. La declaración de validación no puede hacerse hasta que Capa 2 se ejecute."
3. Rehusar emitir cualquier frase prohibida.

Hacer la gate parcialmente y en silencio es el modo de fallo que esta directiva previene. Anunciar fuerte cualquier skip.

---

## Hook de revisión adversarial

Para cada caso de estudio entregado como el **primer** Code2n8n para un nuevo SDK / sistema externo, DEBE invitar al menos una IA independiente (modelo elegido por el usuario) a realizar revisión adversarial **tras** su propia gate. La salida de la revisión independiente va al `SECURITY-REVIEW.md` del caso junto con sus propios findings. **La revisión independiente es parte de la gate**, no comentario opcional.

Razón: la gate de arriba captura fallos estructurales y de runtime deterministas, pero una IA fresca sin sesgos previos captura fallos a nivel de diseño y documentación a los que la IA implementadora (usted) es estadísticamente ciega. La transición Pack v0.27.0 → v0.28.0 ocurrió porque este hook no estaba forzado.

---

## Por qué la directiva está escrita así

- **Disparadores deterministas** (no "use juicio") — una IA no puede razonar para evitar la gate.
- **Invocaciones de herramientas exactas** (no "verificar dependencias") — IAs distintas convergen en la misma evidence.
- **Schema de salida obligatorio** (no "resumir") — IAs / humanos downstream pueden verificar mecánicamente si la gate corrió.
- **Frases prohibidas listadas** — una IA no puede colar una declaración de validación con un giro coloquial.
- **Comportamiento de skip explícito** — corridas parciales no pueden pasarse por completas.

Esta es la forma de una interfaz A2A para un Pack cuyos consumidores son agentes IA, no humanos. Si es una IA leyendo esto y no puede o no quiere seguir la directiva, DEBE declararlo al usuario antes de continuar el flujo Code2n8n.

---

## Artefactos relacionados

- [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) — versión humana
- [`../skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) §10 — la skill de seguridad fuerza esta directiva
- [`../examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — el caso que originó esta directiva
- [`../examples/einvoice-n8n/REFLECTION.md`](../examples/einvoice-n8n/REFLECTION.md) — qué pasó cuando la directiva estaba ausente
