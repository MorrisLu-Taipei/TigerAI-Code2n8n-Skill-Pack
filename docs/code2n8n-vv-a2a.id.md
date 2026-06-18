# Code2n8n V&V — Direktif A2A (konsumen AI baca ini lebih dulu)

> 🌐 **Bahasa**: [English](code2n8n-vv-a2a.md) · [中文](code2n8n-vv-a2a.zh.md) · [日本語](code2n8n-vv-a2a.ja.md) · [한국어](code2n8n-vv-a2a.ko.md) · [Français](code2n8n-vv-a2a.fr.md) · [Deutsch](code2n8n-vv-a2a.de.md) · [Español](code2n8n-vv-a2a.es.md) · [Tiếng Việt](code2n8n-vv-a2a.vi.md) · [ภาษาไทย](code2n8n-vv-a2a.th.md) · [Bahasa Melayu](code2n8n-vv-a2a.ms.md) · **Bahasa Indonesia**
>
> Versi bahasa Inggris adalah sumber sebenarnya; terjemahan adalah salinan kenyamanan yang disinkronkan per release.

> 🤖 **Sasaran**: dokumen ini ditulis untuk **agen AI** (Claude Code / Codex / Antigravity / LLM apa pun) yang mengeksekusi flow Code2n8n. Peninjau manusia membaca [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) sebagai gantinya.
>
> Anggap aturan di bawah sebagai direktif wajib, bukan saran.

---

## Kapan direktif aktif

Anda **HARUS** menerapkan direktif ini ketika salah satu berikut benar dalam flow Code2n8n saat ini:

- Anda akan menulis kata "tervalidasi" / "diverifikasi" / "diuji" / "siap produksi" / "production-ready" / "X/X ok" / "semua hijau" / "validated" / "tested" dalam output apa pun (commit message, release notes, README, sticky note, CHANGELOG, balasan ke pengguna).
- Anda akan merekomendasikan studi kasus dipublish, dimerge, di-deploy, diaktifkan, atau diimpor ke n8n production.
- Instruksi pengguna secara implisit mengasumsikan validasi telah terjadi (misalnya "jalankan workflow ini", "deploy ini", "naikkan ke production").

Jika salah satu benar → direktif aktif. Tidak boleh bypass.

---

## Gate (dua lapisan)

Setiap studi kasus memiliki **dua lapisan** validasi. **Keduanya harus lulus** sebelum bahasa validasi diizinkan.

### Lapisan 1 — Struktural / waktu import

Tiga perintah. Jalankan ketiganya. Tangkap setiap output verbatim.

```
# 1. Pemeriksaan parse JSON
node -e "JSON.parse(require('fs').readFileSync('<workflow>.workflow.json','utf8'))"

# 2. Scanner keamanan deterministik
node scripts/security-scan.mjs --glob "<case-dir>/workflows/*.workflow.json" --format markdown

# 3. n8n REST round-trip (membutuhkan N8N_API_URL + N8N_API_KEY)
node scripts/live-roundtrip.mjs --glob "<case-dir>/workflows/*.workflow.json"
```

**Kriteria lulus Lapisan 1** (ketiganya wajib):
- Setiap workflow JSON parse tanpa exception.
- `security-scan.mjs` melaporkan `0 error`. Warning hanya diizinkan jika setiap warning memiliki paragraf penjelasan di `README.md` kasus DAN di `SECURITY-REVIEW.md` mengapa belum diperbaiki.
- `live-roundtrip.mjs` melaporkan `X/X ok` (X = jumlah file yang di-scan).

**Lapisan 1 perlu, tidak cukup.** Anda **TIDAK BOLEH** menggunakan bahasa validasi setelah hanya Lapisan 1 lulus.

### Lapisan 2 — Kompilasi / runtime / konsistensi antar dokumen

Lapisan 2 wajib jika kasus mencakup salah satu:
- Wrapper service / SDK / dependency eksternal (`package.json` / `requirements.txt` / `go.mod` / `Cargo.toml` apa pun).
- Node workflow yang perilaku runtime-nya tidak terlihat hanya dari JSON (HTTP node dengan status branching, Wait + resume, Schedule dengan semantik timezone, Email dengan binary attachment).
- Klaim di README kasus yang menjanjikan perilaku yang dapat diamati (notifikasi, penulisan audit log, eksekusi terjadwal, handover antar sistem).

#### Lapisan 2.A — Realitas dependency

```
cd <case-dir>/svc && npm install
cd <case-dir>/svc && npm audit --omit=dev --audit-level=high
cd <case-dir>/svc && npx tsc --noEmit
```

**Kriteria**:
- `npm install` exit 0 (tanpa `ETARGET`, tanpa `--force`).
- `npm audit` melaporkan `0 vulnerabilities` di level high+.
- `tsc --noEmit` exit 0.

Jika salah satu gagal, Anda **HARUS** memperbaikinya sebelum melanjutkan. Anda **TIDAK BOLEH** mengklaim validasi selama salah satu masih merah.

#### Lapisan 2.B — Batas kepercayaan runtime

```
cd <case-dir>/svc && npx tsc && node dist/index.js &
sleep 2
curl -s http://127.0.0.1:<port>/healthz
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/v1/<protected>
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/v1/<protected>
```

**Kriteria**:
- `/healthz` mengembalikan 200 dengan body JSON yang diharapkan.
- Request tanpa autentikasi ke endpoint terlindungi → 401 (bukan 200, bukan 500).
- Request dengan autentikasi ke endpoint sama → 200 atau status code domain-spesifik yang didokumentasikan (400 / 502 untuk error upstream).

Plus minimal **tiga uji negatif**:
- Body terlalu besar → diharapkan 413.
- Payload prototype-pollution (misalnya `op: "__proto__"`) → diharapkan 400.
- Nilai enum tidak dikenal (misalnya `provider: "fake-provider"`) → diharapkan 400, tanpa detail internal di body.

#### Lapisan 2.C — Kontrak runtime workflow

Untuk setiap workflow JSON, periksa **konfigurasi node aktual** (bukan hanya sticky note):

| Pola | Konfigurasi yang dibutuhkan |
| --- | --- |
| HTTP node diikuti IF berbasis status | `options.response.response.fullResponse = true` DAN `neverError = true` |
| Wait node dengan resume webhook | Sticky / Code node menggunakan `$execution.resumeUrl` (BUKAN `$resumeUrl`) |
| Schedule trigger | `settings.timezone` diset ke tz bukan-UTC (misalnya `Asia/Jakarta`) DAN aritmatika tanggal di Code node menggunakan `new Intl.DateTimeFormat('en-CA', { timeZone })` (BUKAN `new Date().toISOString().slice(0,10)`) |
| Webhook entry | `responseMode = "responseNode"` DAN node `respondToWebhook` dengan skema tetap (BUKAN `responseMode = "lastNode"`) |
| Email node dengan attachment | Node `n8n-nodes-base.convertToFile` berjalan tepat sebelumnya DAN `attachments` Email node merujuk binary property hasil (default `data`) |
| Node dead-letter / notifikasi | Node memiliki minimal satu edge masuk di `connections{}`. Buka JSON; jangan percaya sticky note. |

Pelanggaran apa pun adalah release blocker.

#### Lapisan 2.D — Paritas antar dokumen

Untuk setiap klaim di `README.md` kasus, temukan file:line yang mengimplementasikannya. Jika implementasi tidak ada, klaim adalah bug dokumentasi — perbaiki dokumen atau implementasi sebelum mengklaim validasi. Contoh:

- "dead-letter Slack" → cari Slack node, konfirmasi edge masuk dari cabang `Exhausted? = true`.
- "human approval gate" → konfirmasi Wait + resume + Approved? IF + penulisan audit untuk kedua cabang.
- "audit row" → konfirmasi node penulisan Sheet / DB ada, mapping kolom lengkap, di graf koneksi.
- "finance summary email" → konfirmasi node Email ada, terhubung, placeholder penerima di tabel placeholder.

---

## Skema output **WAJIB** setelah menjalankan gate

Setelah menjalankan Lapisan 1 + Lapisan 2, output Anda (ke pengguna / commit / release notes / AI lain) HARUS mencakup section dalam format tepat berikut:

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

Baris apa pun FAIL atau PENDING → bahasa validasi terkait **dilarang** dalam sisa output.

---

## Frasa terlarang

Anda **TIDAK BOLEH** mengeluarkan salah satu berikut kecuali baris evidence terkait adalah PASS:

| Frasa terlarang | Evidence dibutuhkan |
| --- | --- |
| "tervalidasi" / "diverifikasi" / "validated" | Semua baris Lapisan 1 + Lapisan 2 PASS, ATAU setiap PENDING diberi label eksplisit di paragraf sama |
| "diuji" / "tested" | Minimal Lapisan 2.B PASS |
| "X/X ok" / "semua hijau" | Sebutkan gate yang mana (misalnya "Lapisan 1 X/X ok") — jangan bentuk tanpa kualifikasi |
| "siap produksi" / "bisa ke production" / "production-ready" | Lapisan 1 + Lapisan 2 + smoke end-to-end + keputusan SECURITY-REVIEW = PASS atau CONDITIONAL |
| "harusnya jalan" / "kelihatan oke" | Dilarang di konteks validasi apa pun — ganti dengan evidence spesifik |

Pengganti wajib:

| Pengganti | Kapan |
| --- | --- |
| "Validasi struktur PASS; validasi runtime PENDING" | Lapisan 1 selesai, Lapisan 2 belum |
| "Lapisan 1 + Lapisan 2 PASS per [`docs/code2n8n-vv-a2a.md`](docs/code2n8n-vv-a2a.md)" | Kedua lapisan selesai |
| "Import bersih; aktivasi membutuhkan penggantian X" | Workflow JSON valid, runtime belum diuji |
| "Kasus referensi; deploy production membutuhkan kontrol SECURITY-REVIEW §<n>" | Kasus dikirim tetapi belum production-ready |

---

## Perilaku ketika gate tidak bisa dijalankan penuh

Jika lingkungan benar-benar tidak bisa menjalankan Lapisan 2 (`N8N_API_URL` / `N8N_API_KEY` tidak diset, tidak ada akses jaringan ke npm registry, tidak ada service untuk dijalankan), Anda **HARUS**:

1. Mengeluarkan skema evidence dengan baris tidak tersedia ditandai `SKIPPED (reason: <reason>)`.
2. Memberitahu pengguna / AI pemanggil secara eksplisit: "Lapisan 2 tidak dijalankan karena <reason>. Klaim validasi tidak dapat dibuat sampai Lapisan 2 dijalankan."
3. Menolak mengeluarkan frasa terlarang apa pun.

Menjalankan gate sebagian dan diam-diam adalah mode kegagalan yang direktif ini cegah. Umumkan dengan keras saat skip.

---

## Hook tinjauan adversarial

Untuk setiap studi kasus dikirim sebagai kasus **pertama** Code2n8n untuk SDK / sistem eksternal baru, Anda **HARUS** mengundang minimal satu AI independen (model pilihan pengguna) untuk melakukan tinjauan adversarial **setelah** gate Anda sendiri. Output tinjauan independen masuk ke `SECURITY-REVIEW.md` kasus berdampingan dengan findings Anda. **Tinjauan independen adalah bagian dari gate**, bukan komentar opsional.

Alasan: gate di atas menangkap kegagalan struktural dan runtime deterministik, tetapi AI segar tanpa bias prior menangkap kegagalan tingkat desain dan dokumentasi yang AI pengimplementasi (Anda) buta secara statistik. Transisi Pack v0.27.0 → v0.28.0 ada karena hook ini tidak dipaksakan.

---

## Mengapa direktif ditulis begini

- **Pemicu deterministik** (bukan "gunakan penilaian") — AI tidak bisa beralasan untuk bypass gate.
- **Pemanggilan tool tepat** (bukan "verifikasi dependency") — AI berbeda konvergen ke evidence sama.
- **Skema output mandatori** (bukan "ringkas") — AI / manusia downstream bisa verifikasi secara mekanis apakah gate dijalankan.
- **Frasa terlarang didaftar** — AI tidak bisa menyelundupkan klaim validasi melalui frasa kolokial.
- **Perilaku skip eksplisit** — eksekusi parsial tidak bisa menyamar sebagai eksekusi penuh.

Beginilah tampilan interface A2A untuk Pack yang konsumennya adalah agen AI, bukan manusia. Jika Anda adalah AI yang membaca ini dan tidak bisa atau tidak akan mengikuti direktif, Anda **HARUS** mengungkapkan itu ke pengguna sebelum melanjutkan flow Code2n8n.

---

## Artefak terkait

- [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) — versi manusia
- [`../skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) §10 — skill keamanan memberlakukan direktif ini
- [`../examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — kasus yang melahirkan direktif ini
- [`../examples/einvoice-n8n/REFLECTION.md`](../examples/einvoice-n8n/REFLECTION.md) — apa yang terjadi ketika direktif tidak ada
