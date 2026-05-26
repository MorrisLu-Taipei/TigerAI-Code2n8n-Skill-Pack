// Generator for the 4 approach-C admin workflows.
// Embeds the single-file dashboard HTML safely (JSON.stringify handles escaping).
// Run: node admin/_build_admin.mjs   (writes the 4 *.workflow.json beside it)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const DIR = dirname(fileURLToPath(import.meta.url));

const SB = { supabaseApi: { id: 'REPLACE_SUPABASE_CRED_ID', name: 'Supabase account' } };

// ---------- shared helpers ----------
function wf(name, nodes, connections) {
  return { name, nodes, connections, settings: { executionOrder: 'v1' }, active: false, pinData: {} };
}
function tokenGate(idPrefix, webhookName, x, y) {
  // IF node comparing X-Admin-Token header to env LINECS_ADMIN_TOKEN
  return {
    parameters: {
      conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [ { id: 't', leftValue: `={{ ($('${webhookName}').item.json.headers || {})['x-admin-token'] }}`, rightValue: '={{ $env.LINECS_ADMIN_TOKEN }}', operator: { type: 'string', operation: 'equals' } } ],
        combinator: 'and' }, options: {}
    },
    id: idPrefix + '-auth', name: 'Check admin token', type: 'n8n-nodes-base.if', typeVersion: 2, position: [x, y]
  };
}
function respond401(idPrefix, x, y) {
  return { parameters: { respondWith: 'text', responseBody: 'Unauthorized', options: { responseCode: 401 } },
    id: idPrefix + '-401', name: 'Respond 401', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [x, y] };
}

// =====================================================================
// 1) admin-ui  — GET /linecs-admin  → serve dashboard.html
// =====================================================================
const DASHBOARD = `<!DOCTYPE html><html lang='zh-Hant'><head><meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'><title>LINE-CS Admin</title>
<style>
body{font-family:system-ui,'Noto Sans TC',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:1rem;max-width:900px;margin-inline:auto}
h2{border-bottom:1px solid #334155;padding-bottom:.3rem;margin-top:1.6rem}
input,textarea,select{width:100%;box-sizing:border-box;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:.5rem;margin:.15rem 0 .6rem}
button{background:#2563eb;color:#fff;border:0;border-radius:6px;padding:.5rem 1rem;cursor:pointer;font-size:.9rem}
button.sec{background:#475569}
table{width:100%;border-collapse:collapse;font-size:.88rem}
td,th{border-bottom:1px solid #334155;padding:.4rem;text-align:left}
.row{display:flex;gap:.6rem;flex-wrap:wrap}.row>div{flex:1;min-width:180px}
.hide{display:none}label{font-size:.82rem;color:#94a3b8}.msg{color:#34d399;font-size:.85rem}
.note{color:#64748b;font-size:.78rem;margin:.2rem 0 1rem}
</style></head><body>
<h1>LINE AI 客服 — 管理台</h1>
<p class='note'>approach C：本頁由 n8n Webhook 直接吐出（Respond to Webhook，text/html）。資料 API 也是 n8n webhook。參考來源：scorpioliu0953/ai_customer_service。</p>
<div id='gate'>
  <h2>登入</h2>
  <label>Admin Token（對應 n8n env LINECS_ADMIN_TOKEN）</label>
  <input id='tok' type='password' placeholder='輸入管理 token'>
  <button onclick='login()'>進入</button>
</div>
<div id='app' class='hide'>
  <h2>設定 Settings</h2>
  <div class='row'>
    <div><label>AI 啟用</label><select id='is_ai_enabled'><option value='true'>是</option><option value='false'>否</option></select></div>
    <div><label>使用模型</label><select id='active_ai'><option value='gpt'>GPT</option><option value='gemini'>Gemini</option></select></div>
  </div>
  <label>System Prompt</label><textarea id='system_prompt' rows='3'></textarea>
  <label>參考文字 reference_text</label><textarea id='reference_text' rows='2'></textarea>
  <div class='row'>
    <div><label>GPT model</label><input id='gpt_model_name'></div>
    <div><label>GPT api key</label><input id='gpt_api_key' type='password'></div>
  </div>
  <div class='row'>
    <div><label>Gemini model</label><input id='gemini_model_name'></div>
    <div><label>Gemini api key</label><input id='gemini_api_key' type='password'></div>
  </div>
  <label>轉真人關鍵字（逗號分隔）</label><input id='handover_keywords'>
  <div class='row'>
    <div><label>逾時(分)</label><input id='handover_timeout_minutes'></div>
    <div><label>專員 userIds（逗號分隔）</label><input id='agent_user_ids'></div>
  </div>
  <div class='row'>
    <div><label>LINE channel access token</label><input id='line_channel_access_token' type='password'></div>
    <div><label>LINE channel secret</label><input id='line_channel_secret' type='password'></div>
  </div>
  <button onclick='saveSettings()'>儲存設定</button> <span id='smsg' class='msg'></span>

  <h2>用戶 Users <button class='sec' onclick='loadUsers()'>刷新</button></h2>
  <table><thead><tr><th>userId</th><th>暱稱</th><th>真人模式</th><th>最後互動</th><th>動作</th></tr></thead><tbody id='users'></tbody></table>

  <h2>知識庫 Knowledge base</h2>
  <p class='note'>上傳後請把回傳的 URL 填到上方（或由 api-kb 自動回填 settings.reference_file_url）。</p>
  <input id='kbfile' type='file'>
  <button onclick='uploadKb()'>上傳</button> <span id='kbmsg' class='msg'></span>
</div>
<script>
var P=location.pathname;
function ep(name){return location.origin+P.replace(/linecs-admin$/, 'linecs-admin-'+name)}
var TOK=sessionStorage.linecsTok||'';
function H(){return {'Content-Type':'application/json','X-Admin-Token':TOK}}
function login(){TOK=document.getElementById('tok').value;sessionStorage.linecsTok=TOK;loadSettings()}
var FIELDS=['system_prompt','reference_text','gpt_model_name','gpt_api_key','gemini_model_name','gemini_api_key','handover_keywords','agent_user_ids','line_channel_access_token','line_channel_secret'];
function loadSettings(){
  fetch(ep('settings'),{headers:H()}).then(function(r){
    if(r.status===401){alert('Token 錯誤');return null}
    return r.json();
  }).then(function(s){
    if(!s)return;
    document.getElementById('gate').classList.add('hide');
    document.getElementById('app').classList.remove('hide');
    FIELDS.forEach(function(k){var el=document.getElementById(k);if(el)el.value=s[k]||''});
    document.getElementById('is_ai_enabled').value=String(s.is_ai_enabled);
    document.getElementById('active_ai').value=s.active_ai||'gpt';
    document.getElementById('handover_timeout_minutes').value=s.handover_timeout_minutes||30;
    loadUsers();
  });
}
function saveSettings(){
  var b={};FIELDS.forEach(function(k){b[k]=document.getElementById(k).value});
  b.active_ai=document.getElementById('active_ai').value;
  b.is_ai_enabled=document.getElementById('is_ai_enabled').value==='true';
  b.handover_timeout_minutes=parseInt(document.getElementById('handover_timeout_minutes').value||'30',10);
  fetch(ep('settings-save'),{method:'POST',headers:H(),body:JSON.stringify(b)}).then(function(r){
    document.getElementById('smsg').textContent=r.ok?'已儲存 ✓':'失敗';
  });
}
function loadUsers(){
  fetch(ep('users'),{headers:H()}).then(function(r){return r.json()}).then(function(rows){
    var tb=document.getElementById('users');tb.innerHTML='';
    (rows||[]).forEach(function(u){
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+(u.line_user_id||'')+'</td><td>'+(u.nickname||'')+'</td><td>'+(u.is_human_mode?'是':'')+'</td><td>'+(u.last_human_interaction||'')+'</td>';
      var td=document.createElement('td');var btn=document.createElement('button');
      btn.textContent=u.is_human_mode?'放回 AI':'接手';btn.className='sec';
      btn.onclick=function(){takeover(u.line_user_id,!u.is_human_mode)};
      td.appendChild(btn);tr.appendChild(td);tb.appendChild(tr);
    });
  });
}
function takeover(id,human){
  fetch(ep('takeover'),{method:'POST',headers:H(),body:JSON.stringify({line_user_id:id,is_human_mode:human})}).then(loadUsers);
}
function uploadKb(){
  var f=document.getElementById('kbfile').files[0];if(!f){alert('請先選檔');return}
  var fd=new FormData();fd.append('file',f);
  fetch(ep('kb'),{method:'POST',headers:{'X-Admin-Token':TOK},body:fd}).then(function(r){return r.json()}).then(function(j){
    document.getElementById('kbmsg').textContent=j&&j.url?('已上傳 ✓ '+j.url):'失敗';
  });
}
if(TOK)loadSettings();
</script></body></html>`;

const adminUi = wf('LINE-CS / Admin / UI (approach C)', [
  { parameters: { httpMethod: 'GET', path: 'linecs-admin', responseMode: 'responseNode', options: {} },
    id: 'ui-wh', name: 'GET /linecs-admin', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-600, 0], webhookId: 'linecs-admin-ui' },
  { parameters: { content: 'Admin UI (approach C) — serves the single-file dashboard via Respond to Webhook (text/html). The page calls sibling webhooks linecs-admin-settings / -settings-save / -users / -takeover / -kb. Parent project ports scorpioliu0953/ai_customer_service; this admin layer = approach C from FRONTEND-SDD.md. Set n8n env LINECS_ADMIN_TOKEN — every data API checks header X-Admin-Token against it.',
    height: 280, width: 460, color: 4 },
    id: 'ui-note', name: 'Notes', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-600, 160] },
  { parameters: { jsCode: 'return [{ json: { html: ' + JSON.stringify(DASHBOARD) + ' } }];' },
    id: 'ui-html', name: 'Build dashboard.html', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-360, 0] },
  { parameters: { respondWith: 'text', responseBody: '={{ $json.html }}',
      options: { responseHeaders: { entries: [ { name: 'Content-Type', value: 'text/html; charset=utf-8' } ] } } },
    id: 'ui-resp', name: 'Respond HTML', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [-120, 0] }
], {
  'GET /linecs-admin': { main: [[{ node: 'Build dashboard.html', type: 'main', index: 0 }]] },
  'Build dashboard.html': { main: [[{ node: 'Respond HTML', type: 'main', index: 0 }]] }
});

// =====================================================================
// 2) api-settings — GET load + POST save (2 webhook triggers)
// =====================================================================
const SETTINGS_COLS = ['is_ai_enabled','active_ai','gpt_api_key','gpt_model_name','gemini_api_key','gemini_model_name','system_prompt','reference_text','handover_keywords','handover_timeout_minutes','agent_user_ids','line_channel_access_token','line_channel_secret'];
const apiSettings = wf('LINE-CS / Admin / API settings', [
  // --- GET load ---
  { parameters: { httpMethod: 'GET', path: 'linecs-admin-settings', responseMode: 'responseNode', options: {} },
    id: 'set-get-wh', name: 'GET settings', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-700, -120], webhookId: 'linecs-admin-settings-get' },
  tokenGate('setget', 'GET settings', -460, -120),
  respond401('setget', -220, -40),
  { parameters: { resource: 'row', operation: 'getAll', tableId: 'settings', returnAll: false, limit: 1 },
    id: 'set-get-db', name: 'Read settings', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [-220, -200], credentials: SB },
  { parameters: { respondWith: 'text', responseBody: '={{ JSON.stringify($json) }}',
      options: { responseHeaders: { entries: [ { name: 'Content-Type', value: 'application/json' } ] } } },
    id: 'set-get-resp', name: 'Respond settings', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [20, -200] },
  // --- POST save ---
  { parameters: { httpMethod: 'POST', path: 'linecs-admin-settings-save', responseMode: 'responseNode', options: {} },
    id: 'set-save-wh', name: 'POST settings-save', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-700, 220], webhookId: 'linecs-admin-settings-save' },
  tokenGate('setsave', 'POST settings-save', -460, 220),
  respond401('setsave', -220, 320),
  { parameters: { resource: 'row', operation: 'getAll', tableId: 'settings', returnAll: false, limit: 1 },
    id: 'set-save-id', name: 'Get settings id', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [-220, 160], credentials: SB },
  { parameters: { resource: 'row', operation: 'update', tableId: 'settings',
      filters: { conditions: [ { keyName: 'id', condition: 'eq', keyValue: '={{ $json.id }}' } ] },
      dataToSend: 'defineBelow',
      fieldsUi: { fieldValues: SETTINGS_COLS.map(c => ({ fieldId: c, fieldValue: `={{ $('POST settings-save').item.json.body['${c}'] }}` })) } },
    id: 'set-save-db', name: 'Update settings', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [20, 160], credentials: SB },
  { parameters: { respondWith: 'text', responseBody: 'OK', options: { responseHeaders: { entries: [ { name: 'Content-Type', value: 'application/json' } ] } } },
    id: 'set-save-resp', name: 'Respond saved', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [260, 160] }
], {
  'GET settings': { main: [[{ node: 'Check admin token', type: 'main', index: 0 }]] },
  'Check admin token': { main: [[{ node: 'Read settings', type: 'main', index: 0 }], [{ node: 'Respond 401', type: 'main', index: 0 }]] },
  'Read settings': { main: [[{ node: 'Respond settings', type: 'main', index: 0 }]] },
  'POST settings-save': { main: [[{ node: 'Check admin token1', type: 'main', index: 0 }]] },
  'Check admin token1': { main: [[{ node: 'Get settings id', type: 'main', index: 0 }], [{ node: 'Respond 4011', type: 'main', index: 0 }]] },
  'Get settings id': { main: [[{ node: 'Update settings', type: 'main', index: 0 }]] },
  'Update settings': { main: [[{ node: 'Respond saved', type: 'main', index: 0 }]] }
});
// fix duplicate node names/ids for the second branch's auth + 401
apiSettings.nodes.find(n => n.id === 'setsave-auth').name = 'Check admin token1';
apiSettings.nodes.find(n => n.id === 'setsave-401').name = 'Respond 4011';

// =====================================================================
// 3) api-users — GET list + POST takeover
// =====================================================================
const apiUsers = wf('LINE-CS / Admin / API users', [
  { parameters: { httpMethod: 'GET', path: 'linecs-admin-users', responseMode: 'responseNode', options: {} },
    id: 'usr-get-wh', name: 'GET users', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-700, -120], webhookId: 'linecs-admin-users' },
  tokenGate('usrget', 'GET users', -460, -120),
  respond401('usrget', -220, -40),
  { parameters: { resource: 'row', operation: 'getAll', tableId: 'user_states', returnAll: false, limit: 50 },
    id: 'usr-get-db', name: 'Read user_states', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [-220, -200], credentials: SB },
  { parameters: { respondWith: 'text', responseBody: '={{ JSON.stringify($input.all().map(i => i.json)) }}',
      options: { responseHeaders: { entries: [ { name: 'Content-Type', value: 'application/json' } ] } } },
    id: 'usr-get-resp', name: 'Respond users', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [20, -200] },
  { parameters: { httpMethod: 'POST', path: 'linecs-admin-takeover', responseMode: 'responseNode', options: {} },
    id: 'usr-tk-wh', name: 'POST takeover', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-700, 220], webhookId: 'linecs-admin-takeover' },
  tokenGate('usrtk', 'POST takeover', -460, 220),
  respond401('usrtk', -220, 320),
  { parameters: { resource: 'row', operation: 'update', tableId: 'user_states',
      filters: { conditions: [ { keyName: 'line_user_id', condition: 'eq', keyValue: "={{ $('POST takeover').item.json.body.line_user_id }}" } ] },
      dataToSend: 'defineBelow',
      fieldsUi: { fieldValues: [ { fieldId: 'is_human_mode', fieldValue: "={{ $('POST takeover').item.json.body.is_human_mode }}" }, { fieldId: 'last_human_interaction', fieldValue: '={{ new Date().toISOString() }}' } ] } },
    id: 'usr-tk-db', name: 'Update user_states', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [-220, 160], credentials: SB },
  { parameters: { respondWith: 'text', responseBody: 'OK', options: { responseHeaders: { entries: [ { name: 'Content-Type', value: 'application/json' } ] } } },
    id: 'usr-tk-resp', name: 'Respond takeover', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [20, 160] }
], {
  'GET users': { main: [[{ node: 'Check admin token', type: 'main', index: 0 }]] },
  'Check admin token': { main: [[{ node: 'Read user_states', type: 'main', index: 0 }], [{ node: 'Respond 401', type: 'main', index: 0 }]] },
  'Read user_states': { main: [[{ node: 'Respond users', type: 'main', index: 0 }]] },
  'POST takeover': { main: [[{ node: 'Check admin token1', type: 'main', index: 0 }]] },
  'Check admin token1': { main: [[{ node: 'Update user_states', type: 'main', index: 0 }], [{ node: 'Respond 4011', type: 'main', index: 0 }]] },
  'Update user_states': { main: [[{ node: 'Respond takeover', type: 'main', index: 0 }]] }
});
apiUsers.nodes.find(n => n.id === 'usrtk-auth').name = 'Check admin token1';
apiUsers.nodes.find(n => n.id === 'usrtk-401').name = 'Respond 4011';

// =====================================================================
// 4) api-kb — POST file upload → Supabase storage (env-based auth)
// =====================================================================
const apiKb = wf('LINE-CS / Admin / API kb-upload', [
  { parameters: { httpMethod: 'POST', path: 'linecs-admin-kb', responseMode: 'responseNode', options: { binaryData: true } },
    id: 'kb-wh', name: 'POST kb-upload', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-760, 0], webhookId: 'linecs-admin-kb' },
  { parameters: { content: 'KB upload (approach C, P2) — uploads the posted file to Supabase Storage bucket knowledge_base and returns its public URL. Uses n8n env vars (not the Supabase node credential, since this is a Storage REST call): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LINECS_ADMIN_TOKEN. File arrives as binary on the webhook (multipart); filename uses a timestamp prefix.',
    height: 300, width: 460, color: 4 },
    id: 'kb-note', name: 'Notes', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-760, 160] },
  tokenGate('kb', 'POST kb-upload', -520, 0),
  respond401('kb', -280, 120),
  { parameters: { jsCode: "const wh=$('POST kb-upload').first(); const bin=wh.binary&&(wh.binary.file||wh.binary.data); if(!bin) throw new Error('no file in upload'); const safe=(bin.fileName||'upload.bin').replace(/[^A-Za-z0-9._-]/g,'_'); const name=Date.now()+'_'+safe; return [{ json:{ name, mimeType: bin.mimeType||'application/octet-stream' }, binary:{ data: bin } }];" },
    id: 'kb-prep', name: 'Prep file', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-280, -120] },
  { parameters: { method: 'POST', url: "={{ $env.SUPABASE_URL }}/storage/v1/object/knowledge_base/{{ $json.name }}",
      sendHeaders: true, headerParameters: { parameters: [ { name: 'Authorization', value: '=Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}' }, { name: 'apikey', value: '={{ $env.SUPABASE_SERVICE_ROLE_KEY }}' }, { name: 'x-upsert', value: 'true' }, { name: 'Content-Type', value: '={{ $json.mimeType }}' } ] },
      sendBody: true, contentType: 'binaryData', inputDataFieldName: 'data', options: {} },
    id: 'kb-up', name: 'Upload to Storage', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [-40, -120] },
  { parameters: { jsCode: "const name=$('Prep file').first().json.name; const url=$env.SUPABASE_URL+'/storage/v1/object/public/knowledge_base/'+name; return [{ json:{ url } }];" },
    id: 'kb-url', name: 'Build public URL', type: 'n8n-nodes-base.code', typeVersion: 2, position: [200, -120] },
  { parameters: { respondWith: 'text', responseBody: '={{ JSON.stringify({ url: $json.url }) }}',
      options: { responseHeaders: { entries: [ { name: 'Content-Type', value: 'application/json' } ] } } },
    id: 'kb-resp', name: 'Respond url', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [440, -120] }
], {
  'POST kb-upload': { main: [[{ node: 'Check admin token', type: 'main', index: 0 }]] },
  'Check admin token': { main: [[{ node: 'Prep file', type: 'main', index: 0 }], [{ node: 'Respond 401', type: 'main', index: 0 }]] },
  'Prep file': { main: [[{ node: 'Upload to Storage', type: 'main', index: 0 }]] },
  'Upload to Storage': { main: [[{ node: 'Build public URL', type: 'main', index: 0 }]] },
  'Build public URL': { main: [[{ node: 'Respond url', type: 'main', index: 0 }]] }
});

// ---------- write ----------
const out = [
  ['admin-ui.workflow.json', adminUi],
  ['api-settings.workflow.json', apiSettings],
  ['api-users.workflow.json', apiUsers],
  ['api-kb.workflow.json', apiKb]
];
for (const [file, obj] of out) {
  writeFileSync(join(DIR, file), JSON.stringify(obj, null, 2) + '\n');
  console.log('wrote', file, '(' + obj.nodes.length + ' nodes)');
}
