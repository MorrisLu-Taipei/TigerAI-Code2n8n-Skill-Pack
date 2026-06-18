# Code2n8n V&V — คำสั่ง A2A (AI consumer อ่านอันนี้ก่อน)

> 🌐 **ภาษา**: [English](code2n8n-vv-a2a.md) · [中文](code2n8n-vv-a2a.zh.md) · [日本語](code2n8n-vv-a2a.ja.md) · [한국어](code2n8n-vv-a2a.ko.md) · [Français](code2n8n-vv-a2a.fr.md) · [Deutsch](code2n8n-vv-a2a.de.md) · [Español](code2n8n-vv-a2a.es.md) · [Tiếng Việt](code2n8n-vv-a2a.vi.md) · **ภาษาไทย** · [Bahasa Melayu](code2n8n-vv-a2a.ms.md) · [Bahasa Indonesia](code2n8n-vv-a2a.id.md)
>
> ฉบับภาษาอังกฤษคือแหล่งข้อมูลหลัก; ฉบับแปลคือสำเนาเพื่อความสะดวกที่ sync ตาม release

> 🤖 **ผู้รับ**: เอกสารนี้เขียนสำหรับ **AI agent** (Claude Code / Codex / Antigravity / LLM ใดๆ) ที่ดำเนินการ flow Code2n8n. มนุษย์ผู้ review อ่าน [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) แทน
>
> ถือกฎด้านล่างเป็นคำสั่งบังคับ ไม่ใช่คำแนะนำ

---

## คำสั่งจะ active เมื่อใด

คุณ **ต้อง** ใช้คำสั่งนี้เมื่อเงื่อนไขใดต่อไปนี้เป็นจริงใน flow Code2n8n ปัจจุบัน:

- คุณกำลังจะเขียนคำว่า "ผ่านการตรวจสอบ" / "ทดสอบแล้ว" / "พร้อม production" / "production-ready" / "X/X ok" / "ผ่านทั้งหมด" / "validated" / "tested" ใน output ใดๆ (commit message, release notes, README, sticky note, CHANGELOG, ตอบ user)
- คุณกำลังจะแนะนำให้ case study ถูก publish / merge / deploy / activate / import เข้า n8n production
- คำสั่ง user สมมุติโดยปริยายว่าการ validate เกิดขึ้นแล้ว (เช่น "รัน workflow นี้", "deploy", "ขึ้น production")

หากอย่างใดอย่างหนึ่งเป็นจริง → คำสั่ง active ห้าม bypass

---

## Gate (สองชั้น)

แต่ละ case study มี validation **สองชั้น** **ทั้งคู่ต้องผ่าน** ก่อนจะอนุญาตใช้คำศัพท์ validation

### ชั้น 1 — โครงสร้าง / เวลา import

สามคำสั่ง รันทั้งสาม capture output ทุกตัวตามตรง

```
# 1. JSON parse check
node -e "JSON.parse(require('fs').readFileSync('<workflow>.workflow.json','utf8'))"

# 2. Deterministic security scanner
node scripts/security-scan.mjs --glob "<case-dir>/workflows/*.workflow.json" --format markdown

# 3. n8n REST round-trip (ต้องใช้ N8N_API_URL + N8N_API_KEY)
node scripts/live-roundtrip.mjs --glob "<case-dir>/workflows/*.workflow.json"
```

**เกณฑ์ผ่านชั้น 1** (ต้องครบทั้งสาม):
- workflow JSON แต่ละไฟล์ parse ได้โดยไม่มี exception
- `security-scan.mjs` รายงาน `0 error` warnings อนุญาตเฉพาะเมื่อแต่ละ warning มีย่อหน้าอธิบายใน case `README.md` และใน `SECURITY-REVIEW.md` ว่าทำไมไม่แก้
- `live-roundtrip.mjs` รายงาน `X/X ok` (X = จำนวนไฟล์ที่ scan)

**ชั้น 1 จำเป็น ไม่เพียงพอ** คุณ **ไม่สามารถ** ใช้คำศัพท์ validation หลังผ่านแค่ชั้น 1

### ชั้น 2 — Compile / runtime / ความสอดคล้องระหว่างเอกสาร

ชั้น 2 บังคับเมื่อ case รวมสิ่งใดสิ่งหนึ่ง:
- Wrapper service / SDK / external dependency (`package.json` / `requirements.txt` / `go.mod` / `Cargo.toml` ใดๆ)
- Node workflow ที่พฤติกรรม runtime ไม่ชัดจาก JSON เพียงอย่างเดียว (HTTP node ที่มี status branching, Wait + resume, Schedule ที่มี timezone semantics, Email ที่มี binary attachment)
- คำกล่าวอ้างใน README ของ case ที่สัญญาพฤติกรรมที่สังเกตได้ (notifications, การเขียน audit log, การรันตามตารางเวลา, handover ระหว่าง system)

#### ชั้น 2.A — ความเป็นจริงของ dependency

```
cd <case-dir>/svc && npm install
cd <case-dir>/svc && npm audit --omit=dev --audit-level=high
cd <case-dir>/svc && npx tsc --noEmit
```

**เกณฑ์**:
- `npm install` exit 0 (ไม่มี `ETARGET`, ไม่ต้องใช้ `--force`)
- `npm audit` รายงาน `0 vulnerabilities` ที่ระดับ high ขึ้นไป
- `tsc --noEmit` exit 0

หากอย่างใดล้มเหลว คุณ **ต้อง** แก้ก่อนดำเนินต่อ คุณ **ต้องไม่** อ้าง validation ขณะที่อันใดยังแดงอยู่

#### ชั้น 2.B — ขอบเขตความเชื่อถือ runtime

```
cd <case-dir>/svc && npx tsc && node dist/index.js &
sleep 2
curl -s http://127.0.0.1:<port>/healthz
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/v1/<protected>
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/v1/<protected>
```

**เกณฑ์**:
- `/healthz` คืน 200 พร้อม body JSON ตามที่คาดหวัง
- คำขอที่ไม่ authenticate ไป endpoint ที่ป้องกัน → 401 (ไม่ใช่ 200, ไม่ใช่ 500)
- คำขอ authenticate ไป endpoint เดียวกัน → 200 หรือ status code domain-specific ที่ระบุในเอกสาร (400 / 502 สำหรับ upstream errors)

บวกอย่างน้อย **สาม negative test**:
- Body ใหญ่เกิน → คาดหวัง 413
- Payload prototype-pollution (เช่น `op: "__proto__"`) → คาดหวัง 400
- ค่า enum ไม่รู้จัก (เช่น `provider: "fake-provider"`) → คาดหวัง 400 โดยไม่เปิดเผยรายละเอียดภายในใน body

#### ชั้น 2.C — สัญญา runtime ของ workflow

สำหรับแต่ละ workflow JSON ตรวจ **การตั้งค่า node จริง** (ไม่ใช่แค่ sticky note):

| Pattern | การตั้งค่าที่ต้องมี |
| --- | --- |
| HTTP node ตามด้วย IF based on status | `options.response.response.fullResponse = true` และ `neverError = true` |
| Wait node กับ resume webhook | Sticky / Code node ใช้ `$execution.resumeUrl` (ไม่ใช่ `$resumeUrl`) |
| Schedule trigger | `settings.timezone` ตั้งเป็น tz ไม่ใช่ UTC (เช่น `Asia/Bangkok`) และคณิตวันที่ใน Code node ใช้ `new Intl.DateTimeFormat('en-CA', { timeZone })` (ไม่ใช่ `new Date().toISOString().slice(0,10)`) |
| Webhook entry | `responseMode = "responseNode"` และ node `respondToWebhook` ที่มี schema คงที่ (ไม่ใช่ `responseMode = "lastNode"`) |
| Email node กับ attachment | Node `n8n-nodes-base.convertToFile` รันทันทีก่อน และ `attachments` ของ Email node อ้างอิง binary property ที่ได้ (default `data`) |
| Dead-letter / notification node | Node มีอย่างน้อยหนึ่ง edge ขาเข้าใน `connections{}` เปิด JSON ไม่ไว้ใจ sticky note |

การละเมิดใดๆ คือ release blocker

#### ชั้น 2.D — ความสอดคล้องระหว่างเอกสาร

สำหรับแต่ละการอ้างใน case `README.md` ระบุ file:line ที่ implement หาก implementation ไม่มี การอ้างคือ bug เอกสาร — แก้เอกสารหรือ implementation ก่อนอ้าง validation ตัวอย่าง:

- "dead-letter Slack" → หา Slack node ยืนยัน edge ขาเข้าจากสาขา `Exhausted? = true`
- "human approval gate" → ยืนยัน Wait + resume + Approved? IF + การเขียน audit สำหรับทั้งสองสาขา
- "audit row" → ยืนยัน Sheet / DB write node มีอยู่ mapping column ครบ อยู่ใน connection graph
- "finance summary email" → ยืนยัน Email node มีอยู่ เชื่อมต่อแล้ว placeholder ผู้รับอยู่ในตาราง placeholder

---

## Schema output **บังคับ** หลังรัน gate

หลังรัน Layer 1 + Layer 2 output (ไปยัง user / commit / release notes / AI อื่น) **ต้อง** มี section ในรูปแบบที่แน่นอนนี้:

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

บรรทัดใด FAIL หรือ PENDING → คำศัพท์ validation ที่สอดคล้องถูก **ห้าม** ในส่วนที่เหลือของ output

---

## วลีต้องห้าม

คุณ **ต้องไม่** ปล่อยสิ่งใดต่อไปนี้เว้นแต่บรรทัด evidence ที่สอดคล้องเป็น PASS:

| วลีต้องห้าม | Evidence ที่ต้องมี |
| --- | --- |
| "ผ่านการตรวจสอบ" / "validated" | บรรทัด Layer 1 + Layer 2 ทั้งหมด PASS หรือแต่ละ PENDING ติดป้ายอย่างชัดเจนในย่อหน้าเดียวกัน |
| "ทดสอบแล้ว" / "tested" | อย่างน้อย Layer 2.B PASS |
| "X/X ok" / "ผ่านทั้งหมด" | ระบุ gate ใด (เช่น "Layer 1 X/X ok") — ห้ามรูปที่ไม่ระบุ |
| "พร้อม production" / "ขึ้น production ได้" / "production-ready" | Layer 1 + Layer 2 + end-to-end smoke + คำตัดสิน SECURITY-REVIEW = PASS หรือ CONDITIONAL |
| "น่าจะใช้ได้" / "ดูดี" | **ห้าม** ในทุกบริบท validation — แทนด้วย evidence เฉพาะ |

วลีทดแทนบังคับ:

| ทดแทน | เมื่อใด |
| --- | --- |
| "Validation โครงสร้าง PASS; validation runtime PENDING" | Layer 1 ทำเสร็จ Layer 2 ยังไม่ทำ |
| "Layer 1 + Layer 2 PASS per [`docs/code2n8n-vv-a2a.md`](docs/code2n8n-vv-a2a.md)" | ทั้งสอง layer เสร็จ |
| "Import สะอาด; activation ต้องการแทนที่ X" | Workflow JSON ใช้ได้ runtime ยังไม่ test |
| "Reference case; production deploy ต้องการ controls ของ SECURITY-REVIEW §<n>" | Case ship แล้วแต่ยังไม่ production-ready |

---

## พฤติกรรมเมื่อไม่สามารถรัน gate ครบ

หากสภาพแวดล้อมรัน Layer 2 ไม่ได้จริงๆ (ไม่ตั้ง `N8N_API_URL` / `N8N_API_KEY`, ไม่มี network ไป npm registry, ไม่มี service ให้ start) คุณ **ต้อง**:

1. ปล่อย evidence schema โดยทำเครื่องหมายบรรทัดที่ไม่พร้อมเป็น `SKIPPED (reason: <reason>)`
2. บอก user / AI ที่เรียกอย่างชัดเจน: "Layer 2 ไม่ได้รันเพราะ <reason> การอ้าง validation ไม่สามารถทำได้จนกว่า Layer 2 จะรัน"
3. ปฏิเสธปล่อยวลีต้องห้ามใดๆ

ทำ gate บางส่วนเงียบๆ คือโหมดล้มเหลวที่คำสั่งนี้ป้องกัน บอกดังๆ เมื่อ skip

---

## Hook review เชิงปฏิปักษ์

สำหรับ case study ทุกอันที่ ship เป็น case **แรก** ของ Code2n8n สำหรับ SDK / system external ใหม่ คุณ **ต้อง** เชิญ AI อิสระอย่างน้อยหนึ่งตัว (model ตามที่ user เลือก) ทำ review เชิงปฏิปักษ์ **หลัง** gate ของคุณเอง output ของ review อิสระเข้า `SECURITY-REVIEW.md` ของ case ข้างๆ findings ของคุณ **Review อิสระเป็นส่วนหนึ่งของ gate** ไม่ใช่ความเห็นทางเลือก

เหตุผล: gate ข้างบนจับ failure โครงสร้างและ runtime ที่กำหนดได้ แต่ AI ใหม่ไม่มี prior bias จับ failure ระดับ design และ document ที่ AI ผู้ implement (คุณ) blind ทางสถิติ Pack v0.27.0 → v0.28.0 transition มีเพราะ hook นี้ไม่ถูกบังคับ

---

## ทำไมคำสั่งเขียนแบบนี้

- **Trigger กำหนดได้แน่นอน** (ไม่ใช่ "ใช้วิจารณญาณ") — AI reason เพื่อ bypass ไม่ได้
- **การเรียก tool ที่แม่นยำ** (ไม่ใช่ "verify dependencies") — AI ต่างกันมาบรรจบที่ evidence เดียวกัน
- **Schema output บังคับ** (ไม่ใช่ "สรุป") — AI / มนุษย์ downstream สามารถ verify mechanically ว่า gate รันแล้ว
- **วลีต้องห้ามแสดงรายการ** — AI แอบอ้างผ่านสำนวนพูดทั่วไปไม่ได้
- **พฤติกรรม skip ชัดเจน** — รันบางส่วนปลอมเป็นรันครบไม่ได้

นี่คือหน้าตาของ A2A interface สำหรับ Pack ที่ consumer เป็น AI agent ไม่ใช่มนุษย์ หาก AI อ่านนี้แล้วทำตามคำสั่งไม่ได้หรือไม่ทำ คุณ **ต้อง** เปิดเผยให้ user ทราบก่อนดำเนิน flow Code2n8n ต่อ

---

## Artefact ที่เกี่ยวข้อง

- [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) — ฉบับมนุษย์
- [`../skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) §10 — security skill บังคับใช้คำสั่งนี้
- [`../examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — case ที่ผลักดันให้เกิดคำสั่งนี้
- [`../examples/einvoice-n8n/REFLECTION.md`](../examples/einvoice-n8n/REFLECTION.md) — เกิดอะไรขึ้นเมื่อคำสั่งไม่อยู่
