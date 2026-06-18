# Code2n8n V&V — A2A ディレクティブ（AI コンシューマーは最初にこれを読むこと）

> 🌐 **言語**：[English](code2n8n-vv-a2a.md) · [中文](code2n8n-vv-a2a.zh.md) · **日本語** · [한국어](code2n8n-vv-a2a.ko.md) · [Français](code2n8n-vv-a2a.fr.md) · [Deutsch](code2n8n-vv-a2a.de.md) · [Español](code2n8n-vv-a2a.es.md) · [Tiếng Việt](code2n8n-vv-a2a.vi.md) · [ภาษาไทย](code2n8n-vv-a2a.th.md) · [Bahasa Melayu](code2n8n-vv-a2a.ms.md) · [Bahasa Indonesia](code2n8n-vv-a2a.id.md)
>
> 英語版が source of truth。翻訳はリリースごとに同期される利便コピー。

> 🤖 **対象**：本書は Code2n8n フローを実行する **AI エージェント**（Claude Code / Codex / Antigravity / その他 LLM）向け。人間のレビュアーは [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) を読むこと。
>
> 以下のルールは参考ではなく、遵守必須の指令として扱うこと。

---

## ディレクティブの発動条件

現在の Code2n8n フローで次のいずれかが該当する場合、本ディレクティブを**必ず**適用する：

- 任意の出力（コミットメッセージ、リリースノート、README、ステッキーノート、CHANGELOG、ユーザーへの応答）に「検証済み」「検証完了」「テスト済み」「本番対応」「production-ready」「X/X ok」「全件 OK」「validated」「tested」等の語を含めようとしている。
- ケーススタディの公開、マージ、デプロイ、有効化、または本番 n8n へのインポートを推奨しようとしている。
- ユーザー指示が暗黙的に検証完了を前提としている（例：「このワークフローを実行して」「デプロイして」「本番に上げて」）。

いずれかが該当する場合 → ディレクティブ発動。回避不可。

---

## ゲート（二層）

各ケーススタディには**二層**の検証がある。**両層通過**まで検証用語は使用不可。

### Layer 1 — 構造 / インポート時

3 つのコマンドを全実行し、出力を完全にキャプチャする。

```
# 1. JSON パース確認
node -e "JSON.parse(require('fs').readFileSync('<workflow>.workflow.json','utf8'))"

# 2. 決定論的セキュリティスキャナー
node scripts/security-scan.mjs --glob "<case-dir>/workflows/*.workflow.json" --format markdown

# 3. n8n REST ラウンドトリップ（N8N_API_URL + N8N_API_KEY 必須）
node scripts/live-roundtrip.mjs --glob "<case-dir>/workflows/*.workflow.json"
```

**Layer 1 通過条件**（3 つすべて必要）：
- 各 workflow JSON が例外なくパースできる。
- `security-scan.mjs` が `0 error` を報告する。warning は case `README.md` と `SECURITY-REVIEW.md` の両方に未修理由の段落がある場合のみ許可。
- `live-roundtrip.mjs` が `X/X ok`（X = スキャン件数）を報告する。

**Layer 1 は必要条件であり、充分条件ではない。** Layer 1 のみで検証用語を**使用してはならない**。

### Layer 2 — コンパイル / ランタイム / ドキュメント整合

次のいずれかを含む場合、Layer 2 は必須：
- ラッパーサービス / SDK / 外部依存（`package.json` / `requirements.txt` / `go.mod` / `Cargo.toml` 等）
- JSON だけでは実行時挙動が分からないノード（status 分岐の HTTP ノード、Wait + resume、timezone を持つ Schedule、binary 添付の Email など）
- case README が観測可能な挙動を約束している（通知、監査ログ書き込み、定時実行、システム間ハンドオーバー）

#### Layer 2.A — 依存関係の現実性

```
cd <case-dir>/svc && npm install
cd <case-dir>/svc && npm audit --omit=dev --audit-level=high
cd <case-dir>/svc && npx tsc --noEmit
```

**通過条件**：
- `npm install` exit 0（`ETARGET` なし、`--force` 不要）
- `npm audit` が high 以上で `0 vulnerabilities` を報告
- `tsc --noEmit` exit 0

いずれか赤 → 先に修正。いずれか赤の状態で検証を主張してはならない。

#### Layer 2.B — ランタイム信頼境界

```
cd <case-dir>/svc && npx tsc && node dist/index.js &
sleep 2
curl -s http://127.0.0.1:<port>/healthz
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/v1/<protected>
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/v1/<protected>
```

**通過条件**：
- `/healthz` 200 + 期待 JSON body
- 未認証で保護エンドポイントへ → 401（200 でも 500 でもなく）
- 認証付きで同エンドポイントへ → 200 もしくはドキュメント記載のドメイン状態（上流エラーは 400 / 502）

さらに**3 件の否定的テスト**：
- 過大 body → 期待 413
- プロトタイプ汚染ペイロード（例：`op: "__proto__"`）→ 期待 400
- 未知の enum 値（例：`provider: "fake-provider"`）→ 期待 400、body に内部詳細を含まない

#### Layer 2.C — ワークフロー実行時契約

各 workflow JSON について、ステッキーノートではなく**実際のノード設定**を検証する：

| パターン | 必須設定 |
| --- | --- |
| status 分岐の HTTP ノード | `options.response.response.fullResponse = true` かつ `neverError = true` |
| Wait ノード + resume webhook | ステッキー / Code ノードで `$execution.resumeUrl`（`$resumeUrl` ではない） |
| Schedule トリガー | `settings.timezone` を UTC 以外（例：`Asia/Tokyo`）に設定 + Code ノードの日付演算は `new Intl.DateTimeFormat('en-CA', { timeZone })`（`new Date().toISOString().slice(0,10)` ではない） |
| Webhook エントリ | `responseMode = "responseNode"` + 固定スキーマの `respondToWebhook` ノード（`responseMode = "lastNode"` ではない） |
| Email + 添付 | 直前に `n8n-nodes-base.convertToFile` ノード + Email の `attachments` がそのバイナリプロパティ名（デフォルト `data`）を参照 |
| Dead-letter / 通知ノード | `connections{}` に少なくとも 1 つの入力エッジを持つ。JSON を直接確認し、ステッキーを信用するな。 |

違反は release ブロッカー。

#### Layer 2.D — ドキュメント間整合

case `README.md` のすべての主張について、実装の file:line を特定する。実装が無ければドキュメントバグ — ドキュメントか実装を修正してから検証を主張。例：

- 「dead-letter Slack」→ Slack ノードを探し、`Exhausted? = true` 分岐から入力エッジがあることを確認。
- 「人手承認ゲート」→ Wait + resume + Approved? IF + 両分岐の audit 書き込みを確認。
- 「audit row」→ Sheet / DB 書き込みノードの存在、列マッピング、接続グラフ内にあることを確認。
- 「finance summary email」→ Email ノードの存在、接続、placeholder 表の受信者参照を確認。

---

## ゲート実行後に必須出力するスキーマ

Layer 1 + Layer 2 実行後、出力（ユーザー / コミットメッセージ / リリースノート / 他 AI 宛て）に**必ず**以下フォーマットを含める：

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

いずれかが FAIL または PENDING の場合、その行に対応する検証用語は後続出力で**使用禁止**。

---

## 禁止フレーズ表

対応する evidence 行が PASS となるまで、以下のフレーズを**使用してはならない**：

| 禁止フレーズ | 必要な evidence |
| --- | --- |
| 「検証済み」「検証完了」「validated」 | Layer 1 + Layer 2 すべて PASS、または各 PENDING を同一段落で明示ラベル |
| 「テスト済み」「tested」 | 少なくとも Layer 2.B PASS |
| 「X/X ok」「全件 OK」 | どの層かを必ず特定（例：「Layer 1 X/X ok」）— 無修飾形は禁止 |
| 「本番対応」「production-ready」「上げて OK」 | Layer 1 + Layer 2 + end-to-end smoke + SECURITY-REVIEW decision が PASS または CONDITIONAL |
| 「動くはず」「問題なさそう」 | 検証文脈で**禁止** — 具体的 evidence で置き換える |

代替フレーズ：

| 代替 | 適用場面 |
| --- | --- |
| 「構造層検証 PASS；ランタイム検証 PENDING」 | Layer 1 完了、Layer 2 未実施 |
| 「Layer 1 + Layer 2 PASS per [`docs/code2n8n-vv-a2a.md`](docs/code2n8n-vv-a2a.md)」 | 両層完了 |
| 「インポート完了；activation には X の置換が必要」 | workflow JSON が valid、ランタイム未テスト |
| 「参考ケース；本番デプロイには SECURITY-REVIEW §<n> の補完制御が必要」 | ケース shipped だが本番非対応 |

---

## ゲートを完全実行できない場合の挙動

Layer 2 を実行できない環境（`N8N_API_URL` / `N8N_API_KEY` 未設定、npm registry 接続不可、サービス起動不可など）では、**必ず**：

1. evidence schema を出力し、不可用な行は `SKIPPED (reason: <reason>)` とマーク。
2. ユーザー / 呼び出し AI に明示：「Layer 2 は <reason> により未実行。Layer 2 実行までは検証主張不可」。
3. 禁止フレーズは一切出力しない。

部分実行を完全実行と偽装することが本ディレクティブが防ぐ失敗モード。スキップは大声で宣言せよ。

---

## 敵対的レビューフック

新しい外部 SDK / システムの**最初の** Code2n8n ケースをリリースする場合、自身のゲート実行**後**に、少なくとも 1 つの独立 AI（ユーザー指定モデル）に敵対的レビューを依頼**しなければならない**。独立レビュー結果は case `SECURITY-REVIEW.md` に自身の findings と並べて記録。**独立レビューはゲートの一部であり、任意のコメントではない**。

理由：本ゲートは決定論的な構造・ランタイム失敗を捕捉するが、新鮮な AI（事前知識ゼロ）は実装 AI（あなた）が統計的に盲点となる設計・文書層の失敗を捕捉する。Pack v0.27.0 → v0.28.0 の移行はこのフックが強制されていなかったために発生した。

---

## なぜこのディレクティブはこう書かれているか

- **発動条件が決定論的**（「判断する」ではない）— AI が自己理屈で回避不可。
- **ツール呼び出しが正確**（「依存関係を検証」ではない）— 異なる AI が同じ evidence に収束。
- **出力スキーマが必須**（「要約」ではない）— 下流 AI / 人間がゲート実行を機械的検証可能。
- **禁止フレーズを明示列挙** — 口語で検証主張が漏れることを防ぐ。
- **スキップ挙動が明文化** — 部分実行が完全実行を偽装不可。

これがコンシューマーが AI エージェントである Pack に必要な A2A インターフェイスである。本ディレクティブを読んだ AI が遵守不可・遵守拒否する場合、Code2n8n フローを継続する前にユーザーに**必ず**開示せよ。

---

## 関連 artefact

- [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) — 人間版（人間のレビュアー向け）
- [`../skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) §10 — security skill が本ディレクティブを強制
- [`../examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — 本ディレクティブを生んだケース
- [`../examples/einvoice-n8n/REFLECTION.md`](../examples/einvoice-n8n/REFLECTION.md) — ディレクティブ不在時に何が起きたか
