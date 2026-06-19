#!/usr/bin/env node
// v1.0.1 SEC-019 self-enforcement — Pack 吃自己狗糧
//
// 對 Pack 自家 user-facing docs 跑 A2A directive forbidden-phrases regex。
// 每命中一個受限字眼 → 檢查同檔案更早位置（同檔案 30 行內）是否有 evidence
// marker。沒有 → fail PR / 本機 commit。
//
// 規則來源：
// - docs/code2n8n-vv-a2a.md（V&V A2A directive，11 國語言）
// - docs/external-dependency-security-a2a.md（external-dep A2A directive，中英）
// - skills/tigerai/code2n8n-pipeline/SKILL.md §1.6 lexical schema-before-claim rule
//
// Exit:
//   0 = 所有命中字眼前都有 evidence marker
//   1 = 至少一個命中字眼前沒 evidence marker → 違反 §1.6

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ----------------------------------------------------------------------------
// Forbidden phrases — 受限字眼清單（直接從 A2A directives 複製）
// ----------------------------------------------------------------------------

const FORBIDDEN = [
  // V&V A2A
  /\bvalidated\b/gi,
  /\bverified\b/gi,
  /\btested\b/gi,
  /\bproduction-ready\b/gi,
  // Chinese
  /驗證/g,
  /驗證通過/g,
  /已驗證/g,
  /可上線/g,
  /正式可用/g,
  // external-dep A2A
  /safe to merge/gi,
  /合併沒問題/g,
  /可以推上/g,
  /\baudited\b/gi,
  /稽核完成/g,
  /no vulnerabilities/gi,
  /沒有漏洞/g,
  /\b0\s*CVEs\b/gi,
  /clean SCA/gi,
  /cleared for production/gi,
  /通過上線審查/g,
];

// ----------------------------------------------------------------------------
// Evidence markers — 同檔案更早位置出現任一即視為有 evidence
// ----------------------------------------------------------------------------

const EVIDENCE_MARKERS = [
  /## .*[Ee]vidence/,                          // ## V&V evidence / ## Evidence schema 等
  /[Ee]vidence schema/,                        // 句中提到 evidence schema
  /[Pp]ath B verified/,                        // 引用 Path B verified
  /tracked-as\s+v\d+\.\d+/,                    // tracked-as v0.X
  /tests\/v\d+(?:\.\d+)?-[\w-]+report/,        // 連結到 tests/v0.40-...report
  /SEC-\d{3}/,                                 // 引用 SEC entry
  /SECURITY-REVIEW\.md/,                       // 連結到 SECURITY-REVIEW
  /\bPASS\s*\/\s*FAIL\b/,                      // PASS/FAIL evidence row
  /\b(?:PASS|FAIL|PARTIAL|PENDING)\b/,         // status word（弱 evidence，但夠）
  /per\s+A2A\s+directive/i,                    // 引用 A2A directive
  /依.*A2A\s*directive/,                       // 中文引用
  /依\s*§1\.6/,                                // 引用 §1.6
  /per\s+§1\.6/i,                              // 引用 §1.6 英文
];

const EVIDENCE_LOOKBACK_LINES = 30;            // 命中字眼前往回看 30 行

// ----------------------------------------------------------------------------
// File scope — 掃哪些 / 排除哪些
// ----------------------------------------------------------------------------

// 自動排除（因為這些檔案就是 A2A directive / SEC report / claims index，
// 本身會列出受限字眼以供讀者學習）：
const EXEMPT_PATHS = [
  /docs\/.*-a2a(?:\.zh)?\.md$/,                // A2A directive 本體
  /docs\/code2n8n-vv-a2a/,                     // V&V A2A 同上
  /docs\/v1-claims-and-evidence\.md$/,         // claims & evidence index
  /examples\/.*\/SECURITY-REVIEW\.md$/,        // SEC entry 報告
  /examples\/.*\/tests\/.*report\.md$/,        // test 報告
  /examples\/.*\/tests\/.*briefing\.md$/,      // briefing 文件
  /examples\/.*\/REFLECTION\.md$/,             // reflection 文件
  /examples\/.*\/docs\/.*matrix.*\.md$/,       // matrix 文件
  /examples\/.*\/docs\/.*coverage.*\.md$/,     // coverage 文件
  /skills\/.*\/SKILL\.md$/,                    // SKILL files 自己會解釋規則
  /scripts\/.*\.mjs$/,                         // scripts（不該 scan 程式碼）
  /scripts\/.*\.sh$/,                          //
  /CHANGELOG\.md$/,                            // CHANGELOG 每節 release 有自己的 evidence section
  /tests\/REPORT-.*\.md$/,                     // 全域報告
];

// 掃哪些 — Pack 對外 user-facing docs：
const SCAN_GLOBS = [
  "README.md",
  "README.zh.md",
  "README.en.md",
  "CODE2N8N.md",
  "docs/why-code2n8n-audit-security-transparency.md",
  "docs/external-package-security-posture.md",
  "docs/socket-dev-integration.md",
  "docs/enterprise-setup.md",
  "docs/responsibility-matrix.md",
  "plugin.json",                               // description field
];

// ----------------------------------------------------------------------------
// Implementation
// ----------------------------------------------------------------------------

function scanFile(filePath) {
  let content;
  try { content = readFileSync(filePath, "utf8"); }
  catch { return { skipped: "not-found", findings: [] }; }
  const lines = content.split("\n");
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of FORBIDDEN) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(line)) !== null) {
        // Found a restricted phrase at line i. Look back EVIDENCE_LOOKBACK_LINES
        // for an evidence marker.
        const start = Math.max(0, i - EVIDENCE_LOOKBACK_LINES);
        let evidenceFound = false;
        for (let j = start; j < i; j++) {
          for (const ev of EVIDENCE_MARKERS) {
            if (ev.test(lines[j])) {
              evidenceFound = true;
              break;
            }
          }
          if (evidenceFound) break;
        }
        findings.push({
          line: i + 1,
          phrase: m[0],
          evidenceFound,
        });
        if (pattern.global) continue; else break;
      }
    }
  }
  return { findings };
}

function isExempt(path) {
  for (const re of EXEMPT_PATHS) {
    if (re.test(path)) return true;
  }
  return false;
}

const root = process.cwd();
let totalHits = 0;
let totalViolations = 0;
const report = [];

for (const rel of SCAN_GLOBS) {
  const full = join(root, rel);
  if (isExempt(rel.replace(/\\/g, "/"))) continue;
  const { skipped, findings } = scanFile(full);
  if (skipped) { continue; }
  const hits = findings.length;
  const violations = findings.filter(f => !f.evidenceFound);
  totalHits += hits;
  totalViolations += violations.length;
  if (hits > 0) {
    report.push({ file: rel, hits, violations: violations.length, findings });
  }
}

// Output
console.log("=== Pack self-scan: A2A directive forbidden-phrases (§1.6 lexical rule) ===");
console.log(`Scope: ${SCAN_GLOBS.length} files`);
console.log(`Total hits: ${totalHits}  Total violations (no evidence marker within ${EVIDENCE_LOOKBACK_LINES} lines before): ${totalViolations}`);
console.log("");
for (const r of report) {
  console.log(`=== ${r.file} ===`);
  for (const f of r.findings) {
    const tag = f.evidenceFound ? "OK " : "❌ ";
    console.log(`  ${tag} L${f.line}: ${f.phrase}${f.evidenceFound ? " (evidence marker found earlier)" : " — NO evidence marker"}`);
  }
}
console.log("");
if (totalViolations > 0) {
  console.log(`❌ ${totalViolations} violations found.`);
  console.log(`   Fix: either (a) add an evidence schema block / Pass-Fail row / SEC-NNN reference / report link earlier in the same file, OR (b) reword the phrase (e.g. "production-ready" → "production-grade methodology"; "驗證" → "structural pass" or evidence-first paragraph).`);
  console.log("");
  console.log("   See docs/external-dependency-security-a2a.md §forbidden words for the full list + evidence schema template.");
  process.exit(1);
}
console.log("✅ Pack self-scan passed — every forbidden phrase is preceded by an evidence marker.");
process.exit(0);
