# Code2n8n V&V — A2A 지시문 (AI 컨슈머는 먼저 이 문서를 읽을 것)

> 🌐 **언어**: [English](code2n8n-vv-a2a.md) · [中文](code2n8n-vv-a2a.zh.md) · [日本語](code2n8n-vv-a2a.ja.md) · **한국어** · [Français](code2n8n-vv-a2a.fr.md) · [Deutsch](code2n8n-vv-a2a.de.md) · [Español](code2n8n-vv-a2a.es.md) · [Tiếng Việt](code2n8n-vv-a2a.vi.md) · [ภาษาไทย](code2n8n-vv-a2a.th.md) · [Bahasa Melayu](code2n8n-vv-a2a.ms.md) · [Bahasa Indonesia](code2n8n-vv-a2a.id.md)
>
> 영어 버전이 source of truth. 번역본은 릴리스마다 동기화되는 편의 사본.

> 🤖 **대상**: Code2n8n 흐름을 실행하는 **AI 에이전트** (Claude Code / Codex / Antigravity / 기타 LLM) 용. 사람 리뷰어는 [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) 를 읽을 것.
>
> 아래 규칙은 참고가 아니라 반드시 준수해야 할 지시로 다룰 것.

---

## 지시문 발동 시점

현재 Code2n8n 흐름에서 다음 중 하나라도 해당하면, **반드시** 본 지시문을 적용:

- 임의 출력 (커밋 메시지, 릴리스 노트, README, 스티키 노트, CHANGELOG, 사용자 응답) 에 "검증됨" / "검증 완료" / "테스트됨" / "프로덕션 준비됨" / "production-ready" / "X/X ok" / "전부 통과" / "validated" / "tested" 등의 문구를 쓰려 할 때.
- 케이스 스터디의 게시, 머지, 배포, 활성화, 또는 운영 n8n 으로의 임포트를 추천하려 할 때.
- 사용자 지시가 검증 완료를 암묵적으로 전제할 때 (예: "이 워크플로우 실행해줘", "배포해줘", "운영에 올려줘").

하나라도 해당 → 지시문 발동. 우회 불가.

---

## 게이트 (2 계층)

각 케이스 스터디는 **2 계층** 검증을 갖는다. **양 계층 모두 통과**하기 전까지 검증 용어 사용 불가.

### Layer 1 — 구조 / 임포트 시점

3 개 커맨드를 모두 실행, 출력을 그대로 캡처.

```
# 1. JSON 파싱
node -e "JSON.parse(require('fs').readFileSync('<workflow>.workflow.json','utf8'))"

# 2. 결정론적 보안 스캐너
node scripts/security-scan.mjs --glob "<case-dir>/workflows/*.workflow.json" --format markdown

# 3. n8n REST 라운드트립 (N8N_API_URL + N8N_API_KEY 필수)
node scripts/live-roundtrip.mjs --glob "<case-dir>/workflows/*.workflow.json"
```

**Layer 1 통과 기준** (3 가지 모두 필요):
- 각 workflow JSON 이 예외 없이 파싱됨.
- `security-scan.mjs` 가 `0 error` 보고. warning 은 case `README.md` 와 `SECURITY-REVIEW.md` 양쪽에 미수정 사유 단락이 있는 경우에만 허용.
- `live-roundtrip.mjs` 가 `X/X ok` (X = 스캔 파일 수) 보고.

**Layer 1 은 필요 조건이지 충분 조건이 아니다.** Layer 1 통과만으로 검증 용어를 **사용해선 안 된다**.

### Layer 2 — 컴파일 / 런타임 / 문서 정합성

다음 중 하나라도 포함 시 Layer 2 필수:
- 래퍼 서비스 / SDK / 외부 의존성 (`package.json` / `requirements.txt` / `go.mod` / `Cargo.toml` 등)
- JSON 만으로 런타임 거동을 알 수 없는 노드 (status 분기 HTTP 노드, Wait + resume, 타임존 있는 Schedule, 바이너리 첨부 Email 등)
- case README 가 관측 가능한 거동을 약속 (알림, 감사 로그 기록, 정시 실행, 시스템 간 핸드오버)

#### Layer 2.A — 의존성 현실성

```
cd <case-dir>/svc && npm install
cd <case-dir>/svc && npm audit --omit=dev --audit-level=high
cd <case-dir>/svc && npx tsc --noEmit
```

**통과 기준**:
- `npm install` exit 0 (`ETARGET` 없음, `--force` 불필요)
- `npm audit` 가 high 이상에서 `0 vulnerabilities`
- `tsc --noEmit` exit 0

하나라도 빨강 → 먼저 수정. 어느 하나라도 빨강인 상태에서 검증을 주장해선 안 됨.

#### Layer 2.B — 런타임 신뢰 경계

```
cd <case-dir>/svc && npx tsc && node dist/index.js &
sleep 2
curl -s http://127.0.0.1:<port>/healthz
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/v1/<protected>
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/v1/<protected>
```

**통과 기준**:
- `/healthz` 200 + 예상 JSON body
- 미인증으로 보호 엔드포인트 → 401 (200 도 500 도 아님)
- 인증 후 동일 엔드포인트 → 200 또는 문서 명시 도메인 상태 코드 (상위 오류 시 400 / 502)

추가로 **3 가지 부정 테스트**:
- 과대 body → 예상 413
- 프로토타입 오염 페이로드 (예: `op: "__proto__"`) → 예상 400
- 미지 enum 값 (예: `provider: "fake-provider"`) → 예상 400, body 에 내부 상세 미포함

#### Layer 2.C — 워크플로우 런타임 계약

각 workflow JSON 에 대해 스티키 노트가 아닌 **실제 노드 설정**을 검증:

| 패턴 | 필수 설정 |
| --- | --- |
| status 분기 후속 HTTP 노드 | `options.response.response.fullResponse = true` 와 `neverError = true` |
| Wait 노드 + resume webhook | 스티키 / Code 노드가 `$execution.resumeUrl` 사용 (`$resumeUrl` 아님) |
| Schedule 트리거 | `settings.timezone` 을 UTC 가 아닌 tz (예: `Asia/Seoul`) 로 설정 + Code 노드 날짜 연산은 `new Intl.DateTimeFormat('en-CA', { timeZone })` (`new Date().toISOString().slice(0,10)` 아님) |
| Webhook 엔트리 | `responseMode = "responseNode"` + 고정 스키마 `respondToWebhook` 노드 (`responseMode = "lastNode"` 아님) |
| Email + 첨부 | 직전에 `n8n-nodes-base.convertToFile` 노드 + Email 의 `attachments` 가 결과 바이너리 속성명 (기본 `data`) 참조 |
| Dead-letter / 알림 노드 | `connections{}` 안에 최소 1 개 입력 엣지. JSON 을 직접 확인, 스티키 신뢰 금지. |

위반 시 릴리스 블로커.

#### Layer 2.D — 문서 간 정합성

case `README.md` 의 각 주장에 대해 구현 file:line 식별. 구현이 없으면 문서 버그 — 문서 또는 구현 수정 후에야 검증 주장 가능. 예:

- "dead-letter Slack" → Slack 노드 찾기, `Exhausted? = true` 분기에서 입력 엣지 확인.
- "사람 승인 게이트" → Wait + resume + Approved? IF + 양 분기 모두 audit 기록 확인.
- "audit row" → Sheet / DB 기록 노드 존재, 컬럼 매핑, 연결 그래프 안에 있음 확인.
- "finance summary email" → Email 노드 존재, 연결, 수신자 placeholder 가 placeholder 표에 있음 확인.

---

## 게이트 실행 후 필수 출력 스키마

Layer 1 + Layer 2 실행 후, 출력 (사용자 / 커밋 메시지 / 릴리스 노트 / 다른 AI 향) 에 **반드시** 다음 형식 포함:

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

어느 한 줄이라도 FAIL 또는 PENDING → 해당 행에 대응하는 검증 용어를 후속 출력에서 **사용 금지**.

---

## 금지 문구 표

해당 evidence 행이 PASS 가 되기 전까지 다음 문구를 **출력해선 안 된다**:

| 금지 문구 | 필요한 evidence |
| --- | --- |
| "검증됨" / "검증 완료" / "validated" | Layer 1 + Layer 2 모두 PASS, 또는 각 PENDING 을 같은 단락에 명시 |
| "테스트됨" / "tested" | 최소 Layer 2.B PASS |
| "X/X ok" / "전부 통과" | 어느 계층인지 반드시 한정 (예: "Layer 1 X/X ok") — 무한정 형식 금지 |
| "프로덕션 준비됨" / "운영 가능" / "production-ready" | Layer 1 + Layer 2 + end-to-end smoke + SECURITY-REVIEW 결정이 PASS 또는 CONDITIONAL |
| "잘 될 것 같다" / "문제 없어 보임" | 검증 맥락에서 **금지** — 구체적 evidence 로 대체 |

대체 문구:

| 대체 | 적용 시점 |
| --- | --- |
| "구조 계층 검증 PASS; 런타임 검증 PENDING" | Layer 1 완료, Layer 2 미실시 |
| "Layer 1 + Layer 2 PASS per [`docs/code2n8n-vv-a2a.md`](docs/code2n8n-vv-a2a.md)" | 양 계층 완료 |
| "임포트 완료; activation 에는 X 교체 필요" | workflow JSON 유효, 런타임 미테스트 |
| "참조 케이스; 운영 배포에는 SECURITY-REVIEW §<n> 의 보완 통제 필요" | 케이스 출시되었으나 운영 미대응 |

---

## 게이트 완전 실행 불가 시 거동

Layer 2 를 실행할 수 없는 환경 (`N8N_API_URL` / `N8N_API_KEY` 미설정, npm registry 접속 불가, 서비스 기동 불가 등) 에서는 **반드시**:

1. evidence 스키마 출력, 불가능한 행은 `SKIPPED (reason: <reason>)` 표시.
2. 사용자 / 호출 AI 에 명시: "Layer 2 가 <reason> 으로 미실행. Layer 2 실행 전까지 검증 주장 불가".
3. 금지 문구는 일절 출력하지 않음.

부분 실행을 완전 실행으로 가장하는 것이 본 지시문이 막는 실패 모드. skip 은 크게 알릴 것.

---

## 적대적 리뷰 훅

새로운 외부 SDK / 시스템의 **최초** Code2n8n 케이스를 릴리스할 때, 자신의 게이트 실행 **후** 최소 1 개의 독립 AI (사용자 지정 모델) 에게 적대적 리뷰를 요청**해야 한다**. 독립 리뷰 결과는 case `SECURITY-REVIEW.md` 에 자신의 findings 와 나란히 기록. **독립 리뷰는 게이트의 일부이지 선택적 코멘트가 아님**.

이유: 본 게이트는 결정론적 구조 / 런타임 실패를 잡지만, 사전 지식 없는 신선한 AI 는 구현 AI (당신) 가 통계적으로 사각지대인 설계 / 문서 계층 실패를 잡음. Pack v0.27.0 → v0.28.0 전환은 이 훅이 강제되지 않아 발생.

---

## 지시문이 이렇게 작성된 이유

- **발동 조건 결정론적** ("판단하라"가 아님) — AI 가 자체 추론으로 우회 불가.
- **도구 호출 정확** ("의존성 검증"이 아님) — 다른 AI 가 같은 evidence 에 수렴.
- **출력 스키마 필수** ("요약"이 아님) — 하류 AI / 사람이 게이트 실행 여부를 기계적 검증 가능.
- **금지 문구 명시 열거** — 구어로 검증 주장이 새어 나가는 것 방지.
- **skip 거동 명문화** — 부분 실행이 완전 실행을 가장 불가.

이것이 컨슈머가 AI 에이전트인 Pack 에 필요한 A2A 인터페이스. 본 지시문을 읽은 AI 가 준수 불가 / 거부 시, Code2n8n 흐름 진행 전 사용자에게 **반드시** 고지할 것.

---

## 관련 artefact

- [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) — 사람 버전
- [`../skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) §10 — security skill 이 본 지시문을 강제
- [`../examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — 본 지시문을 낳은 케이스
- [`../examples/einvoice-n8n/REFLECTION.md`](../examples/einvoice-n8n/REFLECTION.md) — 지시문 부재 시 무엇이 일어났는가
