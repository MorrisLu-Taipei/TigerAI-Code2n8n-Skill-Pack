# Code2n8n V&V — Arahan A2A (pengguna AI baca ini dahulu)

> 🌐 **Bahasa**: [English](code2n8n-vv-a2a.md) · [中文](code2n8n-vv-a2a.zh.md) · [日本語](code2n8n-vv-a2a.ja.md) · [한국어](code2n8n-vv-a2a.ko.md) · [Français](code2n8n-vv-a2a.fr.md) · [Deutsch](code2n8n-vv-a2a.de.md) · [Español](code2n8n-vv-a2a.es.md) · [Tiếng Việt](code2n8n-vv-a2a.vi.md) · [ภาษาไทย](code2n8n-vv-a2a.th.md) · **Bahasa Melayu** · [Bahasa Indonesia](code2n8n-vv-a2a.id.md)
>
> Versi bahasa Inggeris adalah sumber sebenar; terjemahan adalah salinan kemudahan yang diselaraskan setiap release.

> 🤖 **Sasaran**: dokumen ini ditulis untuk **agen AI** (Claude Code / Codex / Antigravity / mana-mana LLM) yang melaksanakan aliran Code2n8n. Pengulas manusia baca [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) sebagai gantinya.
>
> Anggap peraturan di bawah sebagai arahan wajib, bukan cadangan.

---

## Bila arahan diaktifkan

Anda **MESTI** terapkan arahan ini apabila mana-mana berikut benar dalam aliran Code2n8n semasa:

- Anda akan menulis perkataan "disahkan" / "diuji" / "sedia untuk pengeluaran" / "production-ready" / "X/X ok" / "semua hijau" / "validated" / "tested" dalam mana-mana output (mesej commit, nota release, README, sticky note, CHANGELOG, jawapan kepada pengguna).
- Anda akan mengesyorkan kajian kes diterbitkan, dimerge, di-deploy, diaktifkan, atau diimport ke n8n production.
- Arahan pengguna secara tersirat mengandaikan pengesahan telah berlaku (cth. "jalankan workflow ini", "deploy ini", "naikkan ke production").

Jika mana-mana benar → arahan aktif. Tiada bypass.

---

## Gate (dua lapisan)

Setiap kajian kes mempunyai **dua lapisan** pengesahan. **Kedua-duanya mesti lulus** sebelum bahasa pengesahan dibenarkan.

### Lapisan 1 — Strukturan / masa import

Tiga arahan. Jalankan ketiga-tiga. Tangkap setiap output kata demi kata.

```
# 1. Pemeriksaan parse JSON
node -e "JSON.parse(require('fs').readFileSync('<workflow>.workflow.json','utf8'))"

# 2. Pengimbas keselamatan deterministik
node scripts/security-scan.mjs --glob "<case-dir>/workflows/*.workflow.json" --format markdown

# 3. n8n REST round-trip (memerlukan N8N_API_URL + N8N_API_KEY)
node scripts/live-roundtrip.mjs --glob "<case-dir>/workflows/*.workflow.json"
```

**Kriteria lulus Lapisan 1** (ketiga-tiga diperlukan):
- Setiap workflow JSON parse tanpa exception.
- `security-scan.mjs` melaporkan `0 error`. Warning hanya dibenarkan jika setiap warning ada perenggan penjelasan dalam `README.md` kes DAN dalam `SECURITY-REVIEW.md` mengapa ia tinggal tidak diperbaiki.
- `live-roundtrip.mjs` melaporkan `X/X ok` (X = bilangan fail yang diimbas).

**Lapisan 1 perlu, tidak mencukupi.** Anda **TIDAK BOLEH** gunakan bahasa pengesahan selepas hanya Lapisan 1 lulus.

### Lapisan 2 — Kompilasi / runtime / ketekalan antara dokumen

Lapisan 2 wajib jika kes termasuk mana-mana:
- Wrapper service / SDK / kebergantungan luaran (mana-mana `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml`).
- Nod workflow yang tingkah laku runtimenya tidak jelas dari JSON sahaja (HTTP node dengan status branching, Wait + resume, Schedule dengan semantik timezone, Email dengan lampiran binari).
- Dakwaan dalam README kes yang menjanjikan tingkah laku boleh diperhatikan (notifikasi, penulisan audit log, pelaksanaan berjadual, handover antara sistem).

#### Lapisan 2.A — Realiti kebergantungan

```
cd <case-dir>/svc && npm install
cd <case-dir>/svc && npm audit --omit=dev --audit-level=high
cd <case-dir>/svc && npx tsc --noEmit
```

**Kriteria**:
- `npm install` exit 0 (tiada `ETARGET`, tiada `--force`).
- `npm audit` melaporkan `0 vulnerabilities` pada tahap high+.
- `tsc --noEmit` exit 0.

Jika mana-mana gagal, anda **MESTI** baikinya sebelum diteruskan. Anda **TIDAK BOLEH** mendakwa pengesahan sementara mana-mana masih merah.

#### Lapisan 2.B — Sempadan kepercayaan runtime

```
cd <case-dir>/svc && npx tsc && node dist/index.js &
sleep 2
curl -s http://127.0.0.1:<port>/healthz
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/v1/<protected>
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/v1/<protected>
```

**Kriteria**:
- `/healthz` mengembalikan 200 dengan body JSON yang dijangkakan.
- Permintaan tanpa pengesahan ke endpoint dilindungi → 401 (bukan 200, bukan 500).
- Permintaan dengan pengesahan ke endpoint sama → 200 atau status code khusus domain yang didokumentasikan (400 / 502 untuk error upstream).

Tambah sekurang-kurangnya **tiga ujian negatif**:
- Body terlalu besar → dijangka 413.
- Payload prototype-pollution (cth. `op: "__proto__"`) → dijangka 400.
- Nilai enum tidak diketahui (cth. `provider: "fake-provider"`) → dijangka 400, tiada butiran dalaman dalam body.

#### Lapisan 2.C — Kontrak runtime workflow

Untuk setiap workflow JSON, periksa **konfigurasi nod sebenar** (bukan sticky note sahaja):

| Corak | Konfigurasi diperlukan |
| --- | --- |
| HTTP node diikuti IF berdasarkan status | `options.response.response.fullResponse = true` DAN `neverError = true` |
| Wait node dengan resume webhook | Sticky / Code node guna `$execution.resumeUrl` (BUKAN `$resumeUrl`) |
| Schedule trigger | `settings.timezone` ditetapkan kepada tz bukan-UTC (cth. `Asia/Kuala_Lumpur`) DAN aritmetik tarikh dalam Code node guna `new Intl.DateTimeFormat('en-CA', { timeZone })` (BUKAN `new Date().toISOString().slice(0,10)`) |
| Webhook entry | `responseMode = "responseNode"` DAN node `respondToWebhook` dengan skema tetap (BUKAN `responseMode = "lastNode"`) |
| Email node dengan lampiran | Node `n8n-nodes-base.convertToFile` berjalan sebelumnya DAN `attachments` Email node merujuk binary property hasil (lalai `data`) |
| Node dead-letter / notifikasi | Node mempunyai sekurang-kurangnya satu edge masuk dalam `connections{}`. Buka JSON; jangan percaya sticky note. |

Sebarang pelanggaran adalah penghalang release.

#### Lapisan 2.D — Pariti antara dokumen

Untuk setiap dakwaan dalam `README.md` kes, lokasikan file:line yang melaksanakannya. Jika pelaksanaan tidak wujud, dakwaan adalah bug dokumentasi — perbaiki dokumen atau pelaksanaan sebelum mendakwa pengesahan. Contoh:

- "dead-letter Slack" → cari Slack node, sahkan edge masuk dari cabang `Exhausted? = true`.
- "human approval gate" → sahkan Wait + resume + Approved? IF + penulisan audit untuk kedua-dua cabang.
- "audit row" → sahkan node penulisan Sheet / DB wujud, pemetaan lajur lengkap, dalam graf sambungan.
- "finance summary email" → sahkan node Email wujud, disambungkan, placeholder penerima dalam jadual placeholder.

---

## Skema output **WAJIB** selepas menjalankan gate

Selepas menjalankan Lapisan 1 + Lapisan 2, output anda (kepada pengguna / commit / release notes / AI lain) MESTI termasuk section dalam format tepat berikut:

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

Sebarang baris FAIL atau PENDING → bahasa pengesahan yang sepadan **dilarang** dalam baki output.

---

## Frasa dilarang

Anda **TIDAK BOLEH** mengeluarkan mana-mana yang berikut melainkan baris evidence yang sepadan adalah PASS:

| Frasa dilarang | Evidence diperlukan |
| --- | --- |
| "disahkan" / "validated" | Semua baris Lapisan 1 + Lapisan 2 PASS, ATAU setiap PENDING dilabel secara eksplisit dalam perenggan sama |
| "diuji" / "tested" | Sekurang-kurangnya Lapisan 2.B PASS |
| "X/X ok" / "semua hijau" | Nyatakan gate yang mana (cth. "Lapisan 1 X/X ok") — jangan bentuk tanpa kelayakan |
| "sedia untuk pengeluaran" / "boleh ke production" / "production-ready" | Lapisan 1 + Lapisan 2 + smoke end-to-end + keputusan SECURITY-REVIEW = PASS atau CONDITIONAL |
| "patut berjalan" / "nampak ok" | Dilarang dalam mana-mana konteks pengesahan — gantikan dengan evidence khusus |

Pengganti wajib:

| Pengganti | Bila |
| --- | --- |
| "Pengesahan struktur PASS; pengesahan runtime PENDING" | Lapisan 1 selesai, Lapisan 2 tidak selesai |
| "Lapisan 1 + Lapisan 2 PASS per [`docs/code2n8n-vv-a2a.md`](docs/code2n8n-vv-a2a.md)" | Kedua-dua lapisan selesai |
| "Import bersih; pengaktifan memerlukan gantian X" | Workflow JSON sah, runtime belum diuji |
| "Kes rujukan; deployment production memerlukan kawalan SECURITY-REVIEW §<n>" | Kes dihantar tetapi belum production-ready |

---

## Tingkah laku apabila gate tidak boleh dilarikan sepenuhnya

Jika persekitaran benar-benar tidak boleh menjalankan Lapisan 2 (`N8N_API_URL` / `N8N_API_KEY` tidak diset, tiada capaian rangkaian ke npm registry, tiada perkhidmatan untuk dimulakan), anda **MESTI**:

1. Keluarkan skema evidence dengan baris tidak tersedia ditandakan `SKIPPED (reason: <reason>)`.
2. Beritahu pengguna / AI yang memanggil secara jelas: "Lapisan 2 tidak dilarikan kerana <reason>. Dakwaan pengesahan tidak boleh dibuat sehingga Lapisan 2 dilarikan."
3. Tolak mengeluarkan sebarang frasa dilarang.

Menjalankan gate sebahagian dan senyap adalah mod kegagalan yang arahan ini cegah. Isytihar kuat apabila skip.

---

## Hook semakan adversarial

Untuk setiap kajian kes dihantar sebagai kes **pertama** Code2n8n untuk SDK / sistem luaran baru, anda **MESTI** menjemput sekurang-kurangnya satu AI bebas (model pilihan pengguna) untuk melaksanakan semakan adversarial **selepas** gate anda sendiri. Output semakan bebas masuk ke `SECURITY-REVIEW.md` kes bersama findings anda sendiri. **Semakan bebas adalah sebahagian gate**, bukan komen pilihan.

Sebab: gate di atas menangkap kegagalan struktur dan runtime deterministik, tetapi AI segar tanpa bias prior menangkap kegagalan peringkat reka bentuk dan dokumentasi yang AI pelaksana (anda) buta secara statistik. Peralihan Pack v0.27.0 → v0.28.0 wujud kerana hook ini tidak dipaksa.

---

## Mengapa arahan ditulis begini

- **Pencetus deterministik** (bukan "guna pertimbangan") — AI tidak boleh berhujah untuk pintas gate.
- **Panggilan tool tepat** (bukan "sahkan kebergantungan") — AI berbeza menumpu kepada evidence sama.
- **Skema output mandatori** (bukan "ringkaskan") — AI / manusia hiliran boleh sahkan secara mekanikal sama ada gate dijalankan.
- **Frasa dilarang disenaraikan** — AI tidak boleh selitkan dakwaan pengesahan melalui frasa kolokial.
- **Tingkah laku skip eksplisit** — lariak separa tidak boleh menyamar sebagai larian penuh.

Beginilah rupa interface A2A untuk Pack yang penggunanya adalah agen AI, bukan manusia. Jika anda adalah AI yang membaca ini dan anda tidak boleh atau tidak akan ikut arahan, anda **MESTI** dedahkan itu kepada pengguna sebelum meneruskan aliran Code2n8n.

---

## Artefak berkaitan

- [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) — versi manusia
- [`../skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) §10 — skill keselamatan menguatkuasakan arahan ini
- [`../examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — kes yang melahirkan arahan ini
- [`../examples/einvoice-n8n/REFLECTION.md`](../examples/einvoice-n8n/REFLECTION.md) — apa berlaku bila arahan tidak ada
