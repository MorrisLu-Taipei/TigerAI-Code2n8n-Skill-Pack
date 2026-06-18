# Code2n8n V&V — Chỉ thị A2A (consumer AI đọc trước)

> 🌐 **Ngôn ngữ**: [English](code2n8n-vv-a2a.md) · [中文](code2n8n-vv-a2a.zh.md) · [日本語](code2n8n-vv-a2a.ja.md) · [한국어](code2n8n-vv-a2a.ko.md) · [Français](code2n8n-vv-a2a.fr.md) · [Deutsch](code2n8n-vv-a2a.de.md) · [Español](code2n8n-vv-a2a.es.md) · **Tiếng Việt** · [ภาษาไทย](code2n8n-vv-a2a.th.md) · [Bahasa Melayu](code2n8n-vv-a2a.ms.md) · [Bahasa Indonesia](code2n8n-vv-a2a.id.md)
>
> Phiên bản tiếng Anh là nguồn chính thức; bản dịch là bản tiện ích được đồng bộ theo từng release.

> 🤖 **Đối tượng**: tài liệu này dành cho **AI agent** (Claude Code / Codex / Antigravity / bất kỳ LLM nào) thực thi flow Code2n8n. Reviewer là người đọc [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) thay thế.
>
> Hãy xem các quy tắc dưới là chỉ thị bắt buộc, không phải gợi ý.

---

## Khi nào chỉ thị kích hoạt

Bạn **PHẢI** áp dụng chỉ thị này khi bất kỳ điều nào sau là đúng trong flow Code2n8n hiện tại:

- Bạn sắp viết các từ "đã xác thực" / "đã kiểm tra" / "đã test" / "sẵn sàng production" / "production-ready" / "X/X ok" / "tất cả xanh" / "validated" / "tested" trong bất kỳ output (commit message, release notes, README, sticky note, CHANGELOG, phản hồi user).
- Bạn sắp khuyến nghị một case study được publish, merge, deploy, kích hoạt, hoặc import vào n8n production.
- Một chỉ thị từ user ngầm giả định việc xác thực đã xảy ra (ví dụ "chạy workflow này", "deploy đi", "đưa lên production").

Nếu bất kỳ điều nào đúng → chỉ thị kích hoạt. Không được bypass.

---

## Gate (hai lớp)

Mỗi case study có **hai lớp** xác thực. **Cả hai phải pass** trước khi cho phép sử dụng ngôn ngữ xác thực.

### Lớp 1 — Cấu trúc / thời điểm import

Ba lệnh. Chạy cả ba. Capture từng output nguyên văn.

```
# 1. Kiểm tra parse JSON
node -e "JSON.parse(require('fs').readFileSync('<workflow>.workflow.json','utf8'))"

# 2. Scanner bảo mật xác định
node scripts/security-scan.mjs --glob "<case-dir>/workflows/*.workflow.json" --format markdown

# 3. n8n REST round-trip (yêu cầu N8N_API_URL + N8N_API_KEY)
node scripts/live-roundtrip.mjs --glob "<case-dir>/workflows/*.workflow.json"
```

**Tiêu chí pass Lớp 1** (cần cả ba):
- Mỗi workflow JSON parse không exception.
- `security-scan.mjs` báo cáo `0 error`. Warnings chỉ được phép nếu mỗi warning có một đoạn giải thích trong cả `README.md` của case VÀ `SECURITY-REVIEW.md` vì sao chưa fix.
- `live-roundtrip.mjs` báo cáo `X/X ok` (X = số file đã scan).

**Lớp 1 là cần, không đủ.** Bạn **KHÔNG ĐƯỢC** dùng ngôn ngữ xác thực sau khi chỉ Lớp 1 pass.

### Lớp 2 — Compile / runtime / nhất quán giữa các tài liệu

Lớp 2 bắt buộc nếu case bao gồm bất kỳ điều nào:
- Wrapper service / SDK / dependency external (bất kỳ `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml`).
- Node workflow mà hành vi runtime không rõ chỉ từ JSON (HTTP node với status branching, Wait + resume, Schedule với semantic timezone, Email với binary attachment).
- Tuyên bố trong README của case hứa hẹn hành vi quan sát được (notifications, ghi audit log, thực thi theo lịch, handover giữa các system).

#### Lớp 2.A — Thực tế của dependency

```
cd <case-dir>/svc && npm install
cd <case-dir>/svc && npm audit --omit=dev --audit-level=high
cd <case-dir>/svc && npx tsc --noEmit
```

**Tiêu chí**:
- `npm install` exit 0 (không `ETARGET`, không cần `--force`).
- `npm audit` báo cáo `0 vulnerabilities` ở level high+.
- `tsc --noEmit` exit 0.

Nếu bất kỳ fail, bạn **PHẢI** fix trước khi tiếp tục. Bạn **KHÔNG ĐƯỢC** tuyên bố xác thực khi bất kỳ điều nào còn đỏ.

#### Lớp 2.B — Biên giới tin cậy runtime

```
cd <case-dir>/svc && npx tsc && node dist/index.js &
sleep 2
curl -s http://127.0.0.1:<port>/healthz
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/v1/<protected>
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/v1/<protected>
```

**Tiêu chí**:
- `/healthz` trả về 200 với body JSON như mong đợi.
- Request không authenticated tới endpoint được bảo vệ → 401 (không phải 200, không phải 500).
- Request authenticated tới cùng endpoint → 200 hoặc status code domain-specific đã ghi tài liệu (400 / 502 cho lỗi upstream).

Cộng với ít nhất **ba test phủ định**:
- Body quá lớn → mong đợi 413.
- Payload prototype-pollution (ví dụ `op: "__proto__"`) → mong đợi 400.
- Giá trị enum không xác định (ví dụ `provider: "fake-provider"`) → mong đợi 400, không lộ chi tiết nội bộ trong body.

#### Lớp 2.C — Hợp đồng runtime của workflow

Với mỗi workflow JSON, kiểm tra **cấu hình node thực tế** (không chỉ sticky note):

| Pattern | Cấu hình bắt buộc |
| --- | --- |
| HTTP node theo sau bởi IF dựa trên status | `options.response.response.fullResponse = true` VÀ `neverError = true` |
| Wait node với resume webhook | Sticky / Code node dùng `$execution.resumeUrl` (KHÔNG phải `$resumeUrl`) |
| Schedule trigger | `settings.timezone` set tới tz không phải UTC (ví dụ `Asia/Ho_Chi_Minh`) VÀ phép toán ngày trong Code node dùng `new Intl.DateTimeFormat('en-CA', { timeZone })` (KHÔNG phải `new Date().toISOString().slice(0,10)`) |
| Webhook entry | `responseMode = "responseNode"` VÀ node `respondToWebhook` với schema cố định (KHÔNG phải `responseMode = "lastNode"`) |
| Email node với attachment | Node `n8n-nodes-base.convertToFile` chạy ngay trước, VÀ `attachments` của Email node tham chiếu binary property kết quả (mặc định `data`) |
| Dead-letter / notification node | Node có ít nhất một edge đến trong `connections{}`. Mở JSON; không tin sticky note. |

Bất kỳ vi phạm nào là release blocker.

#### Lớp 2.D — Đồng nhất giữa các tài liệu

Với mỗi tuyên bố trong `README.md` của case, định vị file:line implement nó. Nếu implementation không tồn tại, tuyên bố là bug tài liệu — fix tài liệu hoặc fix implementation trước khi tuyên bố xác thực. Ví dụ:

- "dead-letter Slack" → tìm Slack node, xác nhận edge đến từ nhánh `Exhausted? = true`.
- "human approval gate" → xác nhận Wait + resume + Approved? IF + ghi audit cho cả hai nhánh.
- "audit row" → xác nhận node ghi Sheet / DB tồn tại, mapping cột đầy đủ, ở trong graph connection.
- "finance summary email" → xác nhận Email node tồn tại, đã kết nối, placeholder người nhận có trong bảng placeholder.

---

## Schema output BẮT BUỘC sau khi chạy gate

Sau khi chạy Lớp 1 + Lớp 2, output (đến user / commit message / release notes / AI khác) PHẢI bao gồm section đúng định dạng sau:

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

Bất kỳ dòng nào FAIL hoặc PENDING → ngôn ngữ xác thực tương ứng bị **cấm** trong phần còn lại của output.

---

## Các cụm từ bị cấm

Bạn **KHÔNG ĐƯỢC** phát ra bất kỳ cụm sau trừ khi dòng evidence tương ứng PASS:

| Cụm bị cấm | Evidence yêu cầu |
| --- | --- |
| "đã xác thực" / "đã verify" / "validated" | Tất cả dòng Lớp 1 + Lớp 2 PASS, HOẶC mỗi PENDING được dán nhãn rõ ràng trong cùng đoạn |
| "đã test" / "đã kiểm tra" / "tested" | Ít nhất Lớp 2.B PASS |
| "X/X ok" / "tất cả xanh" | Chỉ định gate nào (ví dụ "Lớp 1 X/X ok") — không bao giờ dạng không xác định |
| "sẵn sàng production" / "lên production được" / "production-ready" | Lớp 1 + Lớp 2 + end-to-end smoke + quyết định SECURITY-REVIEW = PASS hoặc CONDITIONAL |
| "chắc là chạy được" / "trông ổn" | **Cấm** trong mọi ngữ cảnh xác thực — thay bằng evidence cụ thể |

Cụm thay thế bắt buộc:

| Thay thế | Khi nào |
| --- | --- |
| "Xác thực cấu trúc PASS; xác thực runtime PENDING" | Lớp 1 xong, Lớp 2 chưa làm |
| "Lớp 1 + Lớp 2 PASS per [`docs/code2n8n-vv-a2a.md`](docs/code2n8n-vv-a2a.md)" | Cả hai lớp xong |
| "Import sạch; activation yêu cầu thay X" | Workflow JSON hợp lệ, runtime chưa test |
| "Case tham khảo; deploy production yêu cầu các kiểm soát SECURITY-REVIEW §<n>" | Case đã ship nhưng chưa production-ready |

---

## Hành vi khi không thể chạy đầy đủ gate

Nếu môi trường thực sự không thể chạy Lớp 2 (chưa set `N8N_API_URL` / `N8N_API_KEY`, không có truy cập npm registry, không có service để khởi động), bạn **PHẢI**:

1. Phát schema evidence với các dòng không khả dụng đánh dấu `SKIPPED (reason: <reason>)`.
2. Nói rõ với user / AI gọi: "Lớp 2 không chạy vì <reason>. Tuyên bố xác thực không thể đưa ra cho tới khi Lớp 2 chạy."
3. Từ chối phát bất kỳ cụm bị cấm.

Chạy gate một phần và im lặng là failure mode mà chỉ thị này ngăn chặn. Tuyên bố to khi skip.

---

## Hook review đối kháng

Với mỗi case study ship như case **đầu tiên** Code2n8n cho một SDK / system external mới, bạn **PHẢI** mời ít nhất một AI độc lập (model do user chọn) thực hiện review đối kháng **sau** gate của chính bạn. Output của review độc lập đi vào `SECURITY-REVIEW.md` của case bên cạnh findings của bạn. **Review độc lập là một phần của gate**, không phải comment tùy chọn.

Lý do: gate ở trên bắt được lỗi cấu trúc và runtime xác định, nhưng AI mới không có thiên kiến trước bắt được lỗi cấp design và tài liệu mà AI implement (bạn) statistically blind. Pack v0.27.0 → v0.28.0 transition tồn tại vì hook này không được enforce.

---

## Tại sao chỉ thị được viết như vậy

- **Trigger xác định** (không "dùng phán đoán") — AI không thể reason để bypass gate.
- **Lệnh gọi tool chính xác** (không "verify dependencies") — các AI khác nhau hội tụ vào cùng evidence.
- **Schema output bắt buộc** (không "tóm tắt") — AI / con người downstream có thể verify mechanically gate đã chạy.
- **Cụm bị cấm liệt kê rõ** — AI không thể lén tuyên bố xác thực qua cách diễn đạt thông tục.
- **Hành vi skip rõ ràng** — chạy một phần không thể giả làm chạy đầy đủ.

Đây là giao diện A2A cho một Pack mà consumer là AI agent, không phải con người. Nếu bạn là AI đọc này và bạn không thể hoặc không muốn theo chỉ thị, bạn **PHẢI** tuyên bố điều đó với user trước khi tiếp tục flow Code2n8n.

---

## Artefact liên quan

- [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) — phiên bản con người
- [`../skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) §10 — security skill enforce chỉ thị này
- [`../examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — case dẫn tới chỉ thị này
- [`../examples/einvoice-n8n/REFLECTION.md`](../examples/einvoice-n8n/REFLECTION.md) — điều gì đã xảy ra khi chỉ thị vắng mặt
