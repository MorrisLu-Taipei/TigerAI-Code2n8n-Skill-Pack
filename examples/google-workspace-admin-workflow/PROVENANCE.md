# PROVENANCE — 逐行出處對照

> 把本 n8n 移植的每一塊保真資料，對回上游 Apps Script 的**確切行號**。
> 釘住上游 commit（不是浮動 HEAD），原作者日後改檔也不影響本表正確性。

## 上游釘選版本

- **Repo**：<https://github.com/mihozip/google-workspace-admin-project-workflow>
- **Commit SHA**：`fce2513edcda4be4513bad2f19cabba16381b4e3`
- **檔案**：`src/Code.gs`（共 1373 行）
- **直接連結格式**：`https://github.com/mihozip/google-workspace-admin-project-workflow/blob/fce2513edcda4be4513bad2f19cabba16381b4e3/src/Code.gs#L<行號>`

> 下表 `Code.gs:Lxx-Lyy` 都指這個 SHA 的行號。

---

## 1. 識別碼與檔名規則

| 本移植位置 | 上游出處 | 說明 |
| --- | --- | --- |
| `core-project-starter` → `Prepare` → `projectCode` | `Code.gs:L332-337`（`generateProjectCode`） | `年度-處室-MMddHHmmss` |
| `core-project-starter` → `Prepare` → `sanitize()` | `Code.gs:L1354-1360`（`sanitizeFileName`） | 替換 `\/:*?"<>|#%{}~&`、空白→`_`、截 180 |

## 2. 11 個專案子資料夾

| 本移植位置 | 上游出處 |
| --- | --- |
| `core-project-starter` → `Prepare` → `SUBFOLDERS[]` | `Code.gs:L339-353`（`createProjectSubFolders` 的 `folderNames`，`'00_原始公文與附件'` 在 L341、`'99_系統產生文件'` 在 L351） |

逐筆：

```
SUBFOLDERS[0]  '00_原始公文與附件'      ← Code.gs:L341
SUBFOLDERS[1]  '01_計畫書與核定資料'    ← Code.gs:L342
SUBFOLDERS[2]  '02_工作分工與會議紀錄'  ← Code.gs:L343
SUBFOLDERS[3]  '03_表單與回覆資料'      ← Code.gs:L344
SUBFOLDERS[4]  '04_經費與採購核銷'      ← Code.gs:L345
SUBFOLDERS[5]  '05_活動照片與照片說明'  ← Code.gs:L346
SUBFOLDERS[6]  '06_成果資料與成果報告'  ← Code.gs:L347
SUBFOLDERS[7]  '07_公告通知與對外文字'  ← Code.gs:L348
SUBFOLDERS[8]  '08_簡報與成果展示'      ← Code.gs:L349
SUBFOLDERS[9]  '09_檢討與下次改進'      ← Code.gs:L350
SUBFOLDERS[10] '99_系統產生文件'        ← Code.gs:L351
```

## 3. 專案紀錄 Doc — 9 段標題 + 正文

| 本移植位置 | 上游出處 |
| --- | --- |
| `core-project-starter` → `Prepare` → `docPlan[]` → `docRequests` | `Code.gs:L363-420`（`createProjectRecordDoc`） |

段落標題對應：

```
TITLE    '行政專案紀錄文件'        ← Code.gs:L371  (.setHeading(TITLE))
HEADING_1 '一、基本資料'           ← Code.gs:L373
HEADING_1 '二、重要期限'           ← Code.gs:L385
HEADING_1 '三、經費資訊'           ← Code.gs:L390
HEADING_1 '四、公文要求摘要'       ← Code.gs:L394
HEADING_1 '五、執行紀錄'           ← Code.gs:L397
HEADING_1 '六、成果資料'           ← Code.gs:L400
HEADING_1 '七、缺漏檢查'           ← Code.gs:L407
HEADING_1 '八、檢討與下次建議'     ← Code.gs:L412
HEADING_1 '九、NotebookLM 建議提問'← Code.gs:L417
```

正文 `appendKeyValue(...)` 各列 ← `Code.gs:L374-383`（基本資料）、`L386-388`（期限）、`L391-392`（經費）。`appendKeyValue` 函式本身 ← `Code.gs:L1125`。

## 4. 待辦追蹤表

| 本移植位置 | 上游出處 |
| --- | --- |
| `Prepare` → `taskHeaders[]`（12 欄） | `Code.gs:L438-451`（`createTaskTrackingSheet` 的 `headers`） |
| `Prepare` → `taskRowsArr[]`（T001–T010） | `Code.gs:L471-489`（`buildDefaultTasks`；`return [` 在 L477、T001 在 L478、T010 在 L487） |
| `Prepare` → `taskBatchUpdate` 的 `setDataValidation`（I 欄 4 選項） | `Code.gs:L1312-…`（`applyTaskValidation`，`['未開始','進行中','待確認','完成']`） |

## 5. 成果檢核表

| 本移植位置 | 上游出處 |
| --- | --- |
| `Prepare` → `checklistHeaders[]`（6 欄） | `Code.gs:L500-…`（`createResultChecklistSheet` 的 `headers`） |
| `Prepare` → `checklistRowsArr[]`（10 列） | `Code.gs:L512-521`（`'原始公文'` 在 L512、`'檢討與下次改進'` 在 L521） |
| `Prepare` → `checklistBatchUpdate` 的 `setDataValidation`（C 欄 5 選項） | `applyChecklistValidation`（`['待整理','進行中','已完成','不需要','需人工確認']`） |

## 6. Calendar 提醒事件

| 本移植位置 | 上游出處 |
| --- | --- |
| `Prepare` → `calendarEventSpecs[]` | `Code.gs:L539-600`（`createCalendarReminders`） |

逐筆：

```
【活動日】…          ← Code.gs:L555
【成果期限】…        ← Code.gs:L564
【成果前7天提醒】…   ← Code.gs:L574  (offsetDate -7)
【經費核銷期限】…    ← Code.gs:L584
【經費前7天提醒】…   ← Code.gs:L594  (offsetDate -7)
```

事件 description 區塊 ← `buildCalendarDescription`（`Code.gs` 內，活動日/期限說明 8 行）。

## 7. 提醒偏移天數

| 本移植位置 | 上游出處 |
| --- | --- |
| `core-milestone` → `Prepare` → `parseReminderOptions()` 的 map | `Code.gs:L1021-1031`（`{'當天提醒':0,'前1天提醒':-1,'前3天提醒':-3,'前7天提醒':-7,'前14天提醒':-14}`，map 在 L1026-1030） |
| Milestone 表單 `提醒設定` 5 選項 | `Code.gs:L196-201`（`createMilestoneForm` 的 `setChoiceValues`） |

## 8. 日期類型 → 任務階段對照

| 本移植位置 | 上游出處 |
| --- | --- |
| `core-milestone` → `Prepare` → `determineStage()` | `Code.gs:L1000-1018`（`determineTaskStageByDateType`） |
| Milestone 表單 `日期類型` 14 選項 | `Code.gs:L175-189`（`createMilestoneForm` 的 `setChoiceValues`） |

## 9. Sheet 標題列（建表時硬編）

| 本移植位置 | 上游出處 |
| --- | --- |
| `core-setup` → 行政專案總控表 20 欄 header | `Code.gs:L1151-1174`（`getControlSheetHeaders`） |
| `core-setup` → 專案階段日期紀錄 17 欄 header | `Code.gs:L1176-1204`（`getMilestoneRecordHeaders`） |

## 10. 表單欄位

| 本移植位置 | 上游出處 |
| --- | --- |
| `entry-n8n-form/entry-project-starter` → Form Trigger `formFields`（19 欄） | `Code.gs:L114-156`（`createProjectStarterForm`） |
| `entry-n8n-form/entry-milestone` → Form Trigger `formFields`（11 欄） | `Code.gs:L160-220`（`createMilestoneForm`） |

## 11. 流程函式（非資料，行為對照）

| 上游函式 | 行 | 本移植 |
| --- | --- | --- |
| `setupAdminWorkflow` | L40-110 附近 | `core-setup.workflow.json` 全部 |
| `onFormSubmit` | L266-300 附近 | `core-project-starter.workflow.json` 全部 |
| `onMilestoneFormSubmit` | L860-950 附近 | `core-milestone.workflow.json` 全部 |
| `findProjectByCode` | — | core-milestone `Lookup project in 總控表` + `Resolve project` |
| `getSpreadsheetIdFromUrl` | — | core-milestone `Resolve project`（inline） |

> 完整函式層對照另見 [docs/field-mapping.md](docs/field-mapping.md)。本檔聚焦「逐筆資料 → 行號」。

---

## English

This file pins every preserved data item in the n8n port back to the **exact line** in the upstream Apps Script, frozen at commit `fce2513edcda4be4513bad2f19cabba16381b4e3` (`src/Code.gs`, 1373 lines). Use `…/blob/fce2513…/src/Code.gs#L<n>` to open any cited line. The 11 subfolders, 9 Doc headings, T001–T010 default tasks, 10 checklist rows, 5 reminder offsets, 14 date-type→stage rules, and all sheet headers are mapped row-by-row. Function-level behavioural mapping lives in `docs/field-mapping.md`; this file is the line-level data provenance.
