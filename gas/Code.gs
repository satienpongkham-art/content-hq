/**
 * Backend ของ FHC · Financial Health Check + Content HQ (เว็บอยู่บน GitHub Pages)
 * Google Sheet = ฐานข้อมูล, Apps Script = API, LINE/อีเมล = แจ้งเตือน
 */
/** GET /exec → สถานะ API (หน้าเว็บจริงอยู่บน GitHub Pages) */
function doGet() {
  return json_({ ok: true, service: 'FHC + Content HQ API', time: fmtTime_(new Date()) });
}

function clip_(v, n) { return String(v == null ? '' : v).slice(0, n || 500); }

/* =====================================================================
 * Google Form แบบมีคะแนน (Quiz) — รัน createFhcForm() ครั้งเดียว
 * ===================================================================== */
const LINE_ID = 'superzerrrr';
const HEALTH_Q = 'ถ้าต้องนอนโรงพยาบาล วงเงินค่ารักษาสูงสุดที่คุณมีคือเท่าไหร่';
const HEALTH_HELP = 'ถ้ามีหลายสิทธิ์ ให้เลือกข้อที่คุ้มครองสูงที่สุด';
const HEALTH_OPTS = ['ไม่มีสิทธิ์อะไรเลย', 'มีแค่ประกันสังคม / บัตรทอง', 'ประกันกลุ่มบริษัท หรือประกันสุขภาพที่ซื้อเอง วงเงินรวมต่ำกว่า 1 ล้านบาท/ปี', 'วงเงินรวม 1 ล้านบาท/ปีขึ้นไป หรือสวัสดิการข้าราชการ'];

function createFhcForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = FormApp.create('เช็กสุขภาพการเงินฟรี ใน 1 นาที');
  form.setDescription('กดเลือกคำตอบที่ใกล้เคียงที่สุด ไม่ต้องพิมพ์ตัวเลข ส่งแล้วกด "ดูคะแนน" เพื่อรู้คะแนนเต็ม 100 พร้อมคำแนะนำทีละข้อ\n\nผลประเมินเบื้องต้นด้วยเกณฑ์ทั่วไป ไม่ใช่คำแนะนำการลงทุน')
    .setIsQuiz(true)
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(true)
    .setProgressBar(true)
    .setConfirmationMessage('ขอบคุณที่เช็กสุขภาพการเงินนะครับ 😊 กด "ดูคะแนน" เพื่อดูผลและคำแนะนำ\nอยากให้ช่วยวางแผนต่อแบบละเอียด ทักมาที่ LINE: ' + LINE_ID + ' ได้เลย ฟรีครับ');

  const fb = (t) => FormApp.createFeedback().setText(t).build();
  // ข้อไม่คิดคะแนน
  form.addTextItem().setTitle('ชื่อเล่น').setHelpText('ไม่บังคับ');
  const mcPlain = (title, help, opts) => {
    const it = form.addMultipleChoiceItem().setTitle(title).setRequired(true);
    if (help) it.setHelpText(help);
    it.setChoices(opts.map((o) => it.createChoice(o)));
    return it;
  };
  mcPlain('มีคนที่พึ่งพารายได้ของคุณกี่คน', 'พ่อแม่ ลูก หรือคู่สมรสที่คุณช่วยดูแลค่าใช้จ่าย', ['ไม่มี', '1 คน', '2 คน', '3 คนขึ้นไป']);
  mcPlain('รายได้หลักของคุณเป็นแบบไหน', null, ['เงินเดือนประจำอย่างเดียว', 'ไม่แน่นอนอย่างเดียว (ฟรีแลนซ์ ค้าขาย เจ้าของกิจการ)', 'มีทั้งเงินเดือนและรายได้เสริม']);
  mcPlain('รายได้ต่อเดือนประมาณเท่าไหร่', 'หลังหักภาษีและประกันสังคม', ['ต่ำกว่า 15,000', '15,000–25,000', '25,000–40,000', '40,000–70,000', '70,000 ขึ้นไป']);

  // ข้อคิดคะแนน (รวม 100)
  const mcScored = (title, help, opts, good, points, tipGood, tipBad) => {
    const it = form.addMultipleChoiceItem().setTitle(title).setRequired(true);
    if (help) it.setHelpText(help);
    it.setChoices(opts.map((o, i) => it.createChoice(o, good.indexOf(i) >= 0)))
      .setPoints(points)
      .setFeedbackForCorrect(fb(tipGood))
      .setFeedbackForIncorrect(fb(tipBad));
  };
  mcScored('ถ้ารายได้หยุดวันนี้ เงินสดที่มีอยู่ได้กี่เดือน', null,
    ['ไม่ถึง 1 เดือน', '1–3 เดือน', '3–6 เดือน', '6–12 เดือน', 'มากกว่า 1 ปี'], [2, 3, 4], 20,
    'เยี่ยม! มีเงินสำรองฉุกเฉินพอแล้ว แยกบัญชีไว้ไม่ให้ปนกับเงินใช้',
    'ควรมีเงินสำรองฉุกเฉิน 3–6 เดือนของค่าใช้จ่าย (รายได้ไม่แน่นอนควร 6–12 เดือน) เริ่มจากตั้งโอนอัตโนมัติวันเงินเดือนออก');
  mcScored('ค่าผ่อนหนี้ทุกก้อนรวมกัน คิดเป็นเท่าไหร่ของรายได้', 'บ้าน รถ บัตร สินเชื่อ ผ่อนของ',
    ['ไม่มีหนี้', 'ไม่ถึง 20%', '20–40%', '40–60%', 'มากกว่า 60%'], [0, 1, 2], 20,
    'ภาระหนี้อยู่ในเกณฑ์ปลอดภัย (ไม่เกิน 35–40% ของรายได้)',
    'ค่าผ่อนเกิน 40% ของรายได้ถือว่าตึงมือ ลองเรียงหนี้ตามดอกเบี้ย แล้วคุยเรื่องรีไฟแนนซ์หรือรวมหนี้');
  mcScored('มีหนี้บัตรเครดิต หรือสินเชื่อส่วนบุคคลไหม', null,
    ['ไม่มี', 'มีนิดหน่อย จ่ายเต็มทุกเดือน', 'มีและจ่ายแค่ขั้นต่ำ'], [0, 1], 10,
    'ดีมาก หนี้ดอกเบี้ยสูงเป็นสิ่งที่ควรเลี่ยงที่สุด',
    'หนี้บัตร/สินเชื่อส่วนบุคคลดอกเบี้ยสูง 16–25% ต่อปี ควรโปะก้อนนี้ก่อนและหยุดก่อหนี้ใหม่');
  mcScored('จ่ายค่ากินอยู่และผ่อนหนี้แล้ว เงินเหลือแค่ไหน', null,
    ['ไม่พอใช้ ต้องยืมหรือรูดบัตร', 'เหลือนิดหน่อย (ไม่ถึง 10%)', 'เหลือ 10–20%', 'เหลือ 20–30%', 'เหลือมากกว่า 30%'], [2, 3, 4], 10,
    'กระแสเงินสดเป็นบวก มีพื้นที่ให้ออมและลงทุน',
    'ลองจดรายจ่าย 30 วันเพื่อหาจุดรั่ว แล้วใช้สูตร 50/30/20 เป็นแนวทาง');
  mcScored('ออมหรือลงทุนทุกเดือนไหม', null,
    ['ยังไม่ได้ออม', 'ไม่ถึง 5%', '5–10%', '10–20%', 'มากกว่า 20%'], [3, 4], 15,
    'ออมได้ตามเกณฑ์ 10–20% ขึ้นไปแล้ว รักษาไว้',
    'ตั้งเป้าออมก่อนใช้อย่างน้อย 10% ของรายได้ ทันทีที่เงินเข้า');
  mcScored(HEALTH_Q, HEALTH_HELP, HEALTH_OPTS, [3], 10,
    'ความคุ้มครองค่ารักษาอยู่ในระดับดี',
    'ค่ารักษาโรงพยาบาลเอกชนเมื่อป่วยหนักอาจถึงหลักแสน–ล้าน ควรมีวงเงินผู้ป่วยในอย่างน้อย 1 ล้านบาท/ปี');
  mcScored('ถ้าเกิดเรื่องไม่คาดฝันกับคุณ ทุนประกันชีวิตที่มีพอไหม', 'สำหรับปิดหนี้และดูแลคนข้างหลัง',
    ['ไม่มีใครต้องดูแลและไม่มีหนี้', 'พอปิดหนี้และดูแลครอบครัวได้ 5 ปีขึ้นไป', 'พอปิดหนี้ แต่ไม่พอดูแลครอบครัว', 'ไม่พอ / ไม่มีประกันชีวิต', 'ไม่แน่ใจ'], [0, 1], 15,
    'ครอบครัวได้รับการปกป้องแล้ว',
    'ทุนประกันชีวิตควรครอบคลุมหนี้ทั้งหมด + ค่าใช้จ่ายของคนที่ต้องดูแลหลายปี ลองให้ที่ปรึกษาช่วยคำนวณทุนที่เหมาะสม');

  form.addTextItem().setTitle('ช่องทางให้ติดต่อกลับ (LINE ID หรือเบอร์โทร)').setHelpText('ไม่บังคับ ถ้าอยากให้ที่ปรึกษาช่วยดูผลและวางแผนต่อแบบฟรี');
  const consent = form.addCheckboxItem().setTitle('ความยินยอม').setRequired(true);
  consent.setChoices([consent.createChoice('ยินยอมให้ที่ปรึกษาเก็บคำตอบนี้ เพื่อติดต่อกลับเรื่องการวางแผนการเงิน (PDPA)')]);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'onFhcSubmit').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onFhcSubmit').forForm(form).onFormSubmit().create();

  const url = form.getPublishedUrl();
  let short = url;
  try { short = form.shortenFormUrl(url); } catch (e) {}
  PropertiesService.getScriptProperties().setProperties({ FORM_ID: form.getId(), FORM_URL: short });
  Logger.log('FORM_URL=' + short);
  Logger.log('EDIT_URL=' + form.getEditUrl());
  return short;
}

/* ---------------- แจ้งเตือน + ข้อมูลสำหรับ Dashboard ---------------- */
const LEAD_SHEET = 'HQ_Leads';
const LEAD_HEADERS = ['เวลา', 'ชื่อ', 'ติดต่อ', 'คะแนน', 'ระดับ', 'Lead', 'รายได้', 'คนที่ดูแล', 'ลักษณะรายได้', 'จุดที่ควรดูแล', 'ยินยอม'];
const SHORT = [
  ['ถ้ารายได้หยุด', 'เงินสำรองฉุกเฉิน'], ['ค่าผ่อนหนี้', 'ภาระหนี้สูง'], ['มีหนี้บัตร', 'หนี้ดอกเบี้ยสูง'],
  ['จ่ายค่ากินอยู่', 'เงินเหลือน้อย'], ['ออมหรือลงทุน', 'การออม'], ['ถ้าต้องนอนโรงพยาบาล', 'ประกันสุขภาพ'], ['ถ้าเกิดเรื่องไม่คาดฝัน', 'ประกันชีวิต'], ['(เว็บ) หนี้สินต่อทรัพย์สิน', 'หนี้สินเกินทรัพย์สิน'],
];
const shortOf_ = (title) => { const m = SHORT.find((x) => title.indexOf(x[0]) === 0); return m ? m[1] : title; };
const levelOf_ = (s) => (s >= 80 ? 'แข็งแรง' : s >= 60 ? 'พอใช้' : s >= 40 ? 'ต้องดูแล' : 'วิกฤต');

function leadSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(LEAD_SHEET);
  if (!sh) {
    ss.setSpreadsheetTimeZone('Asia/Bangkok');
    sh = ss.insertSheet(LEAD_SHEET, 0);
    sh.appendRow(LEAD_HEADERS); sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, LEAD_HEADERS.length).setFontWeight('bold').setBackground('#e3ebff');
  }
  return sh;
}

/** แปลงคำตอบ 1 ชุดเป็นข้อมูลสรุป */
function summarize_(response) {
  const byTitle = {};
  response.getItemResponses().forEach((r) => { byTitle[r.getItem().getTitle()] = r.getResponse(); });
  const get = (prefix) => { const k = Object.keys(byTitle).find((t) => t.indexOf(prefix) === 0); return k ? byTitle[k] : ''; };
  let score = 0; const weak = [];
  response.getGradableItemResponses().forEach((g) => {
    const it = g.getItem(); if (!it.getType || it.getType() !== FormApp.ItemType.MULTIPLE_CHOICE) return;
    const pts = it.asMultipleChoiceItem().getPoints(); if (!pts) return;
    const sc = Number(g.getScore()) || 0; score += sc;
    if (sc < pts) weak.push(shortOf_(it.getTitle()));
  });
  const contact = String(get('ช่องทางให้ติดต่อกลับ') || '').trim();
  const lead = contact ? (score < 60 ? 'Hot' : 'Warm') : 'Cold';
  return {
    time: response.getTimestamp(), name: String(get('ชื่อเล่น') || '').trim() || 'ไม่ระบุชื่อ', contact, score, level: levelOf_(score), lead,
    income: get('รายได้ต่อเดือน'), dependents: get('มีคนที่พึ่งพา'), incomeType: get('รายได้หลัก') || get('รายได้เป็นแบบไหน'),
    weak, consent: [].concat(get('ความยินยอม') || []).length ? 'ยินยอม' : '',
  };
}

const fmtTime_ = (d) => Utilities.formatDate(new Date(d), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');

/** ใส่ lead ใหม่ไว้บนสุด (แถว 2) เพื่อให้ Dashboard เห็นรายการล่าสุดก่อน */
function writeLead_(x, append) {
  const sh = leadSheet_();
  const row = [fmtTime_(x.time), x.name, x.contact, x.score, x.level, x.lead, x.income, x.dependents, x.incomeType, x.weak.join(', '), x.consent];
  if (append) { sh.appendRow(row); return; }
  sh.insertRowAfter(1);
  sh.getRange(2, 1, 1, row.length).setValues([row]).setNumberFormat('@');
}

/** แท็บ HQ_Summary: ตัวเลขสรุปสำหรับ Dashboard ใน HQ */
function updateSummary_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = leadSheet_();
  const n = Math.max(0, sh.getLastRow() - 1);
  const rows = n ? sh.getRange(2, 1, n, LEAD_HEADERS.length).getDisplayValues() : [];
  const out = [['ตัวชี้วัด', 'ค่า']];
  const scores = rows.map((r) => Number(r[3]) || 0);
  out.push(['ทั้งหมด', rows.length]);
  out.push(['คะแนนเฉลี่ย', rows.length ? Math.round(scores.reduce((a, b) => a + b, 0) / rows.length) : 0]);
  ['Hot', 'Warm', 'Cold'].forEach((t) => out.push(['Lead:' + t, rows.filter((r) => r[5] === t).length]));
  ['แข็งแรง', 'พอใช้', 'ต้องดูแล', 'วิกฤต'].forEach((t) => out.push(['ระดับ:' + t, rows.filter((r) => r[4] === t).length]));
  SHORT.forEach((x) => out.push(['จุดอ่อน:' + x[1], rows.filter((r) => String(r[9]).indexOf(x[1]) >= 0).length]));
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
    out.push(['วัน:' + key, rows.filter((r) => String(r[0]).indexOf(key) === 0).length]);
  }
  out.push(['อัปเดต', fmtTime_(new Date())]);
  let sm = ss.getSheetByName('HQ_Summary');
  if (!sm) sm = ss.insertSheet('HQ_Summary', 0);
  sm.clearContents();
  sm.getRange(1, 1, out.length, 2).setNumberFormat('@').setValues(out.map((r) => [String(r[0]), String(r[1])]));
}

function lineText_(x) {
  const tag = { Hot: '🔥 Hot Lead', Warm: '🌤 Warm Lead', Cold: '❄️ Cold' }[x.lead];
  return [
    '📋 มีคนเช็กสุขภาพการเงิน', tag, '',
    '👤 ' + x.name + (x.contact ? '\n📞 ' + x.contact : '\n📞 ไม่ได้ฝากช่องทางติดต่อ'),
    '📊 คะแนน ' + x.score + '/100 (' + x.level + ')',
    '💰 รายได้ ' + (x.income || '-') + ' · ดูแล ' + (x.dependents || '-'),
    x.weak.length ? '⚠️ ควรดูแล: ' + x.weak.join(', ') : '✅ ผ่านทุกด้าน',
    '', 'ดูทั้งหมด: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  ].join('\n');
}

function pushLine_(text) {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('LINE_TOKEN'), to = p.getProperty('LINE_USER_ID');
  if (!token || !to) return 'ยังไม่ได้ตั้งค่า LINE_TOKEN / LINE_USER_ID';
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ to: to, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  });
  return res.getResponseCode() + ' ' + res.getContentText().slice(0, 200);
}

/** ทำงานทุกครั้งที่มีคนส่งฟอร์ม */
function onFhcSubmit(e) {
  const x = summarize_(e.response);
  try { writeLead_(x); updateSummary_(); } catch (err) { console.error(err); }
  const text = lineText_(x);
  try { console.log('LINE', pushLine_(text)); } catch (err) { console.error(err); }
  try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'มีคนเช็กสุขภาพการเงิน: ' + x.name + ' (' + x.score + '/100) ' + x.lead, text); } catch (err) { console.error(err); }
}

/** สร้างแท็บ HQ_Leads ใหม่จากคำตอบทั้งหมดที่มีอยู่ */
function rebuildLeads() {
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('FORM_ID'));
  const sh = leadSheet_();
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, LEAD_HEADERS.length).clearContent();
  form.getResponses().reverse().forEach((r) => writeLead_(summarize_(r), true));
  updateSummary_();
  Logger.log('rows=' + form.getResponses().length);
}

/** ทดสอบส่ง LINE */
function testLine() {
  Logger.log(pushLine_('✅ ทดสอบแจ้งเตือนจากฟอร์มเช็กสุขภาพการเงิน ถ้าเห็นข้อความนี้แปลว่าเชื่อมสำเร็จแล้ว'));
}

/** แก้ฟอร์มที่สร้างไปแล้ว: ทำให้ทุกข้อตอบได้ข้อเดียวชัดเจน */
function fixFhcForm() {
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('FORM_ID'));
  const items = form.getItems();
  const find = (prefix) => items.find((it) => it.getTitle().indexOf(prefix) === 0);
  const inc = find('รายได้เป็นแบบไหน') || find('รายได้หลักของคุณ');
  if (inc) {
    const mc = inc.asMultipleChoiceItem();
    mc.setTitle('รายได้หลักของคุณเป็นแบบไหน')
      .setChoices(['เงินเดือนประจำอย่างเดียว', 'ไม่แน่นอนอย่างเดียว (ฟรีแลนซ์ ค้าขาย เจ้าของกิจการ)', 'มีทั้งเงินเดือนและรายได้เสริม'].map((o) => mc.createChoice(o)));
  }
  const h = find('ถ้าต้องนอนโรงพยาบาล');
  if (h) {
    const mc = h.asMultipleChoiceItem();
    mc.setTitle(HEALTH_Q).setHelpText(HEALTH_HELP)
      .setChoices(HEALTH_OPTS.map((o, i) => mc.createChoice(o, i === 3)));
  }
  const life = find('ถ้าเกิดเรื่องไม่คาดฝัน');
  if (life) life.setHelpText('สำหรับปิดหนี้และดูแลคนข้างหลัง เลือกข้อที่ตรงที่สุดข้อเดียว');
  form.setDescription('กดเลือกคำตอบที่ใกล้เคียงที่สุดข้อละ 1 คำตอบ ไม่ต้องพิมพ์ตัวเลข ส่งแล้วกด "ดูคะแนน" เพื่อรู้คะแนนเต็ม 100 พร้อมคำแนะนำทีละข้อ\n\nผลประเมินเบื้องต้นด้วยเกณฑ์ทั่วไป ไม่ใช่คำแนะนำการลงทุน');
  Logger.log('fixed');
}

/** แชร์ชีตให้บัญชี Google Drive ที่เชื่อมกับ Claude (ดูอย่างเดียว) + สร้างข้อมูล Dashboard */
const HQ_VIEWER = 'teamgrowwithuss@gmail.com';
function setupDashboard() {
  SpreadsheetApp.getActiveSpreadsheet().setSpreadsheetTimeZone('Asia/Bangkok');
  SpreadsheetApp.getActiveSpreadsheet().addViewer(HQ_VIEWER);
  rebuildLeads();
  Logger.log('shared with ' + HQ_VIEWER);
}

/* =====================================================================
 * API สำหรับเว็บบน GitHub Pages
 *  - ฟอร์มสาธารณะ: POST {action:'lead', ...}  → บันทึก HQ_Leads + แจ้ง LINE + อีเมล
 *  - Content HQ (ต้องมีรหัส HQ_PIN): store / leads / ai
 * Script Properties ที่ต้องตั้งเอง: HQ_PIN, ANTHROPIC_KEY (ไม่บังคับ: CLAUDE_MODEL)
 * ===================================================================== */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
const prop_ = (k) => PropertiesService.getScriptProperties().getProperty(k);

function doPost(e) {
  let req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
  try {
    if (req.action === 'lead') return json_(apiLead_(req));
    if (req.action === 'ping') return json_({ ok: true });
    if (!checkPin_(req.pin)) return json_({ ok: false, error: 'bad_pin' });
    switch (req.action) {
      case 'login': try { ensureTriggers_(); } catch (err) { console.error(err); } return json_({ ok: true, ai: !!prop_('ANTHROPIC_KEY'), cost: usageMonth_() });
      case 'list': return json_({ ok: true, docs: storeList_(req.collection) });
      case 'get': return json_({ ok: true, doc: storeGet_(req.collection, req.id) });
      case 'set': storeSet_(req.collection, req.id, req.data); return json_({ ok: true });
      case 'add': return json_({ ok: true, id: storeSet_(req.collection, null, req.data) });
      case 'del': storeDel_(req.collection, req.id); return json_({ ok: true });
      case 'leads': return json_({ ok: true, text: leadsMarkdown_() });
      case 'ai': return json_(apiAi_(req));
      default: return json_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message || err).slice(0, 300) });
  }
}

/** รหัสผ่าน HQ + กันเดารหัส (ผิดเกิน 10 ครั้ง/15 นาที = ล็อก) */
function checkPin_(pin) {
  const real = prop_('HQ_PIN');
  if (!real) throw new Error('ยังไม่ได้ตั้งค่า HQ_PIN ใน Script Properties');
  const c = CacheService.getScriptCache(), fails = Number(c.get('pinfail') || 0);
  if (fails >= 10) throw new Error('ใส่รหัสผิดหลายครั้ง รอ 15 นาทีแล้วลองใหม่');
  if (String(pin || '') === real) return true;
  c.put('pinfail', String(fails + 1), 900);
  return false;
}

/** ฟอร์มสาธารณะส่งผลเข้ามา */
function apiLead_(p) {
  if (p.hp) return { ok: true }; // honeypot: บอทกรอกช่องซ่อน
  if (p.consent !== true) return { ok: false, error: 'ต้องติ๊กยินยอมก่อนส่ง' };
  const contact = clip_(p.contact, 120).trim();
  if (!contact) return { ok: false, error: 'ไม่มีช่องทางติดต่อ' };
  const c = CacheService.getScriptCache();
  const minute = Number(c.get('lead_min') || 0), day = Number(c.get('lead_day') || 0);
  if (minute >= 15 || day >= 300) return { ok: false, error: 'มีคนส่งเยอะเกินไป ลองใหม่อีกสักครู่ หรือส่งทาง LINE แทน' };
  c.put('lead_min', String(minute + 1), 60); c.put('lead_day', String(day + 1), 86400);
  const score = Math.max(0, Math.min(100, Math.round(Number(p.score) || 0)));
  const x = {
    time: new Date(), name: clip_(p.name, 60).trim() || 'ไม่ระบุชื่อ', contact, score, level: levelOf_(score),
    lead: score < 60 ? 'Hot' : 'Warm',
    income: clip_(p.income, 40), dependents: clip_(p.dependents, 20), incomeType: clip_(p.incomeType, 60),
    weak: (Array.isArray(p.weak) ? p.weak : []).slice(0, 8).map((t) => clip_(t, 40)),
    consent: 'ยินยอม (เว็บ' + (p.mode ? ' · ' + clip_(p.mode, 10) : '') + ')',
  };
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try { writeLead_(x); updateSummary_(); } finally { lock.releaseLock(); }
  const text = lineText_(x) + (p.goal ? '\n🎯 เป้าหมาย: ' + clip_(p.goal, 200) : '');
  try { console.log('LINE', pushLine_(text)); } catch (err) { console.error(err); }
  try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'มีคนเช็กสุขภาพการเงิน (เว็บ): ' + x.name + ' (' + x.score + '/100) ' + x.lead, text); } catch (err) { console.error(err); }
  return { ok: true };
}

/* ---------- ที่เก็บข้อมูล HQ (แท็บ HQ_Store: collection | id | json | updatedAt) ---------- */
function storeSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('HQ_Store');
  if (!sh) {
    sh = ss.insertSheet('HQ_Store');
    sh.getRange(1, 1, 1, 4).setValues([['collection', 'id', 'json', 'updatedAt']]).setFontWeight('bold');
    sh.setFrozenRows(1); sh.getRange('A:D').setNumberFormat('@');
  }
  return sh;
}
function storeRows_() {
  const sh = storeSheet_(), n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, 3).getValues() : [];
}
function cleanCol_(col) {
  const s = String(col || '');
  if (!/^[\w\-\/]{1,200}$/.test(s)) throw new Error('bad collection');
  return s;
}
function storeList_(col) {
  col = cleanCol_(col);
  return storeRows_().filter((r) => r[0] === col).map((r) => { try { return { id: String(r[1]), data: JSON.parse(r[2]) }; } catch (e) { return null; } }).filter(Boolean);
}
function storeGet_(col, id) {
  col = cleanCol_(col);
  const r = storeRows_().find((x) => x[0] === col && String(x[1]) === String(id));
  return r ? JSON.parse(r[2]) : null;
}
function storeSet_(col, id, data) {
  col = cleanCol_(col);
  id = id ? clip_(id, 120) : Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  const body = JSON.stringify(data == null ? {} : data);
  if (body.length > 45000) throw new Error('ข้อมูลใหญ่เกินไป');
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sh = storeSheet_(), rows = storeRows_();
    const i = rows.findIndex((x) => x[0] === col && String(x[1]) === id);
    const row = [col, id, body, fmtTime_(new Date())];
    if (i >= 0) sh.getRange(i + 2, 1, 1, 4).setValues([row]); else sh.appendRow(row);
  } finally { lock.releaseLock(); }
  return id;
}
function storeDel_(col, id) {
  col = cleanCol_(col);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const rows = storeRows_(), i = rows.findIndex((x) => x[0] === col && String(x[1]) === String(id));
    if (i >= 0) storeSheet_().deleteRow(i + 2);
  } finally { lock.releaseLock(); }
}

/** ข้อมูล Lead ในรูปแบบตารางเดียวกับที่ HQ บน claude.ai อ่าน */
function leadsMarkdown_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const md = (name) => {
    const sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 1) return '';
    const v = sh.getRange(1, 1, Math.min(sh.getLastRow(), 501), sh.getLastColumn()).getDisplayValues();
    const line = (r) => '| ' + r.map((c) => String(c).replace(/\|/g, '/').replace(/\n/g, ' ')).join(' | ') + ' |';
    return '### Sheet Name: ' + name + '\n' + line(v[0]) + '\n|' + v[0].map(() => '---|').join('') + '\n' + v.slice(1).map(line).join('\n') + '\n';
  };
  return md('HQ_Summary') + '\n' + md('HQ_Leads');
}

/* ---------- AI (Claude API ด้วยคีย์ของคุณเอง) ---------- */
// ราคาโดยประมาณ (USD ต่อ 1 ล้าน token) ใช้คำนวณค่าใช้จ่ายคร่าว ๆ เท่านั้น
const PRICE_ = { haiku: [1, 5], sonnet: [3, 15], opus: [5, 25] };
const USD_THB = 33;
function claudeModel_(tier) {
  const fam = tier === 'fast' ? 'haiku' : 'sonnet';
  const fixed = prop_(fam === 'haiku' ? 'CLAUDE_MODEL_FAST' : 'CLAUDE_MODEL'); if (fixed) return fixed;
  const c = CacheService.getScriptCache(), hit = c.get('claude_model_' + fam); if (hit) return hit;
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/models?limit=100', {
    muteHttpExceptions: true, headers: { 'x-api-key': prop_('ANTHROPIC_KEY'), 'anthropic-version': '2023-06-01' },
  });
  if (res.getResponseCode() !== 200) throw new Error('อ่านรายชื่อโมเดลไม่ได้ (' + res.getResponseCode() + ') ตรวจ ANTHROPIC_KEY');
  const list = JSON.parse(res.getContentText()).data || []; // เรียงจากใหม่ไปเก่า
  const pick = list.find((m) => new RegExp(fam, 'i').test(m.id)) || list.find((m) => /sonnet/i.test(m.id)) || list[0];
  if (!pick) throw new Error('ไม่พบโมเดลที่ใช้ได้');
  c.put('claude_model_' + fam, pick.id, 21600);
  return pick.id;
}
function monthKey_() { return 'usage_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM'); }
function usageMonth_() {
  let u = {}; try { u = JSON.parse(prop_(monthKey_()) || '{}'); } catch (e) {}
  return { usd: u.usd || 0, thb: Math.round((u.usd || 0) * USD_THB * 100) / 100, calls: u.calls || 0, searches: u.searches || 0 };
}
function addUsage_(model, usage) {
  const fam = /haiku/i.test(model) ? 'haiku' : /opus/i.test(model) ? 'opus' : 'sonnet', pr = PRICE_[fam];
  const inTok = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25 + (usage.cache_read_input_tokens || 0) * 0.1;
  const searches = (usage.server_tool_use && usage.server_tool_use.web_search_requests) || 0;
  const usd = inTok * pr[0] / 1e6 + (usage.output_tokens || 0) * pr[1] / 1e6 + searches * 0.01;
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    let u = {}; try { u = JSON.parse(prop_(monthKey_()) || '{}'); } catch (e) {}
    u.usd = (u.usd || 0) + usd; u.calls = (u.calls || 0) + 1; u.searches = (u.searches || 0) + searches;
    PropertiesService.getScriptProperties().setProperty(monthKey_(), JSON.stringify(u));
  } finally { lock.releaseLock(); }
}
function apiAi_(req) {
  const key = prop_('ANTHROPIC_KEY');
  if (!key) return { ok: false, error: 'ยังไม่ได้ตั้งค่า ANTHROPIC_KEY ใน Script Properties' };
  let prompt = clip_(req.prompt, 60000);
  if (!prompt) return { ok: false, error: 'ไม่มีคำสั่ง' };
  const model = claudeModel_(req.tier);
  const tools = [];
  if (req.search) tools.push({ type: req._wsv || 'web_search_20260209', name: 'web_search', max_uses: 3 });
  if (req.json) {
    tools.push({ name: 'respond', description: 'ส่งคำตอบสุดท้าย เป็นข้อมูลตามรูปแบบ JSON ที่กำหนดในคำสั่ง ใส่ทุกฟิลด์ที่กำหนดไว้ที่ระดับบนสุดของ input', input_schema: { type: 'object', additionalProperties: true } });
    prompt += req.search
      ? '\n\nค้นเว็บเท่าที่จำเป็น (ไม่เกิน 3 ครั้ง) เพื่อยืนยันข้อมูลล่าสุด แล้วส่งคำตอบสุดท้ายด้วยเครื่องมือ respond เท่านั้น'
      : '\n\nต้องส่งคำตอบด้วยเครื่องมือ respond เท่านั้น ห้ามตอบเป็นข้อความ';
  }
  const body = { model: model, max_tokens: Math.min(Number(req.maxTokens) || 4000, 12000), messages: [{ role: 'user', content: prompt }] };
  if (tools.length) body.tools = tools;
  const sources = [], seen = {};
  let out = null, text = '', lastStop = '';
  for (let turn = 0; turn < 4; turn++) {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, payload: JSON.stringify(body),
    });
    const code = res.getResponseCode(), r = JSON.parse(res.getContentText() || '{}');
    if (code !== 200) {
      if (code === 404) CacheService.getScriptCache().removeAll(['claude_model_haiku', 'claude_model_sonnet']);
      const msg = (r.error && r.error.message) || '';
      if (req.search && /web_search|web search|tools\./i.test(msg)) {
        if (!req._wsv) return apiAi_(Object.assign({}, req, { _wsv: 'web_search_20250305' })); // ลองเวอร์ชันเครื่องมือเก่า
        const r2 = apiAi_(Object.assign({}, req, { search: false, prompt: req.prompt + '\n(ค้นเว็บไม่ได้ในครั้งนี้ ให้ระบุใน sources_note ว่าต้องเช็กข้อมูลอะไร)' }));
        r2.searchError = msg.slice(0, 300); return r2;
      }
      return { ok: false, error: 'Claude API ' + code + ': ' + msg.slice(0, 200) };
    }
    if (r.usage) addUsage_(model, r.usage);
    lastStop = r.stop_reason || '';
    (r.content || []).forEach((b) => {
      if (b.type === 'tool_use' && b.name === 'respond') out = b.input;
      if (b.type === 'text') text += b.text;
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach((x) => { if (x.url && !seen[x.url] && sources.length < 8) { seen[x.url] = 1; sources.push({ title: x.title || x.url, url: x.url }); } });
    });
    if (r.stop_reason === 'pause_turn') { body.messages = [body.messages[0], { role: 'assistant', content: r.content }]; continue; }
    if (req.json && !out && turn === 0 && r.stop_reason === 'end_turn' && !/\{[\s\S]*\}/.test(text)) { // ค้นเสร็จแต่ยังไม่ส่ง respond → บังคับส่ง
      body.messages = [body.messages[0], { role: 'assistant', content: r.content }, { role: 'user', content: 'ส่งคำตอบสุดท้ายด้วยเครื่องมือ respond ตอนนี้เลย' }];
      continue;
    }
    break;
  }
  if (out && Object.keys(out).length === 1 && out[Object.keys(out)[0]] && typeof out[Object.keys(out)[0]] === 'object' && !Array.isArray(out[Object.keys(out)[0]])) out = out[Object.keys(out)[0]]; // ห่อไว้ใน {result:{...}}
  if (out && Object.keys(out).length === 1 && typeof out[Object.keys(out)[0]] === 'string') { // บางครั้งห่อ JSON เป็นข้อความ
    try { const inner = JSON.parse(out[Object.keys(out)[0]]); if (inner && typeof inner === 'object') out = inner; } catch (e) {}
  }
  if (!out && !text.trim()) return { ok: false, error: lastStop === 'max_tokens' ? 'คำตอบยาวเกินกำหนด ลองใหม่อีกครั้ง' : 'AI ไม่ได้ส่งคำตอบ ลองใหม่อีกครั้ง' };
  return { ok: true, text: out ? JSON.stringify(out) : text, model: model, sources: sources, stop: lastStop, cost: usageMonth_() };
}

/* ---------- LINE สรุปเช้า 08:00 ---------- */
function ensureTriggers_() {
  if (ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === 'morningBrief')) return;
  ScriptApp.newTrigger('morningBrief').timeBased().atHour(8).nearMinute(0).everyDays(1).inTimezone('Asia/Bangkok').create();
}
function mondayOf_(iso) {
  const d = new Date(iso + 'T12:00:00+07:00'), wd = (d.getUTCDay() + 6) % 7;
  return Utilities.formatDate(new Date(d.getTime() - wd * 86400000), 'Asia/Bangkok', 'yyyy-MM-dd');
}
function morningBrief() {
  const tz = 'Asia/Bangkok', now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd'), yest = Utilities.formatDate(new Date(now.getTime() - 86400000), tz, 'yyyy-MM-dd');
  const thDay = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][new Date(today + 'T12:00:00+07:00').getUTCDay()];
  const L = ['☀️ สรุปเช้าวัน' + thDay + ' ' + today, ''];
  let day = null, plan = null;
  try { day = storeGet_('data/users/me/days/items', today); } catch (e) {}
  try { plan = storeGet_('data/users/me/plans/items', mondayOf_(today)); } catch (e) {}
  const pd = plan && Array.isArray(plan.days) ? plan.days.find((x) => x.date === today) : null;
  L.push('🎬 TikTok: ' + ((day && day.tiktok && day.tiktok.title) || (pd && pd.tiktok && pd.tiktok.title) || 'ยังไม่มีหัวข้อ เปิด HQ กดสร้างสคริปต์'));
  ['11:00', '17:00', '19:30'].forEach((t, i) => {
    const sl = day && day.slots && day.slots['s' + (i + 1)];
    const name = (sl && sl.output && sl.output.product) || (sl && sl.input && sl.input.name) || (pd && pd.sp && pd.sp[i] && pd.sp[i].product) || '-';
    L.push('🛒 ' + t + ' ' + name + (sl && sl.posted ? ' ✅' : ''));
  });
  if (pd && pd.ic) L.push('📚 IC: ' + pd.ic);
  const sh = leadSheet_(), n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, Math.min(n, 300), LEAD_HEADERS.length).getDisplayValues() : [];
  const fresh = rows.filter((r) => r[0].indexOf(yest) === 0 || r[0].indexOf(today) === 0);
  L.push('', '👥 Lead ใหม่ตั้งแต่เมื่อวาน: ' + fresh.length + ' คน');
  fresh.slice(0, 5).forEach((r) => L.push('• ' + r[1] + ' ' + r[3] + '/100 ' + r[5] + (r[2] ? ' · ' + r[2] : '')));
  let fu = [];
  try { fu = storeList_('data/users/me/leadmeta/items').map((d) => d.data).filter((m) => m.follow && m.follow <= today && ['ปิดการขาย', 'ไม่สนใจ'].indexOf(m.status) < 0); } catch (e) {}
  if (fu.length) { L.push('', '📞 ต้องติดตามวันนี้: ' + fu.length + ' คน'); fu.slice(0, 5).forEach((m) => L.push('• ' + (m.name || '-') + ' (' + (m.status || 'ใหม่') + ')' + (m.note ? ' — ' + m.note : ''))); }
  let wrong = 0; try { wrong = storeList_('data/users/me/icwrong/items').length; } catch (e) {}
  if (wrong) L.push('', '📝 ข้อสอบ IC ที่ต้องทบทวน: ' + wrong + ' ข้อ');
  L.push('', 'เปิด HQ: https://satienpongkham-art.github.io/content-hq/hq/');
  console.log(pushLine_(L.join('\n')));
}
