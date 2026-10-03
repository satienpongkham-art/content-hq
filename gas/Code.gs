/**
 * ฟอร์มเช็กสุขภาพการเงิน: Google Apps Script Web App + Google Sheet
 * วิธีติดตั้ง: ดู README ส่วน "ตั้งค่าฟอร์มลูกค้าบน Google"
 */
const SHEET_NAME = 'Leads';
const NOTIFY_EMAIL = true; // ส่งอีเมลแจ้งเจ้าของชีตเมื่อมีลูกค้าส่งผลเข้ามา
const HEADERS = ['เวลา', 'ชื่อ', 'ช่องทางติดต่อ', 'คะแนน', 'ระดับ', 'โหมด',
  'เงินสำรอง', 'DSR', 'หนี้บริโภค', 'การออม', 'หนี้/ทรัพย์สิน', 'ประกันชีวิต', 'สุขภาพ',
  'จุดที่ควรดูแล', 'เป้าหมาย', 'ยินยอม', 'สถานะ', 'ข้อมูลดิบ (JSON)'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('เช็กสุขภาพการเงินฟรี')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#ffe4ec');
  }
  return sh;
}

function clip_(v, n) { return String(v == null ? '' : v).slice(0, n || 500); }

/** เรียกจากหน้าเว็บผ่าน google.script.run.submitLead(payload) */
function submitLead(p) {
  if (!p || p.consent !== true) throw new Error('ต้องได้รับความยินยอมก่อนบันทึก');
  const contact = clip_(p.contact, 120).trim();
  if (!contact) throw new Error('ไม่มีช่องทางติดต่อ');
  const score = Math.max(0, Math.min(100, Number(p.score) || 0));
  const m = Array.isArray(p.metrics) ? p.metrics : [];
  const val = (i) => (m[i] ? clip_(m[i].value, 60) : '');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet_().appendRow([
      new Date(), clip_(p.name, 80), contact, score, clip_(p.level, 20), clip_(p.mode, 20),
      val(0), val(1), val(2), val(3), val(4), val(5), val(6),
      (Array.isArray(p.risks) ? p.risks : []).map((t) => clip_(t, 200)).join(' / '),
      clip_(p.goal, 300), 'ยินยอม', 'ใหม่', clip_(JSON.stringify(p.input || {}), 4000),
    ]);
  } finally { lock.releaseLock(); }
  if (NOTIFY_EMAIL) {
    try {
      const to = Session.getEffectiveUser().getEmail();
      if (to) MailApp.sendEmail(to, 'มีลูกค้าส่งผลเช็กสุขภาพการเงิน: ' + clip_(p.name || contact, 60) + ' (' + score + '/100)',
        'ชื่อ: ' + clip_(p.name, 80) + '\nติดต่อ: ' + contact + '\nคะแนน: ' + score + ' (' + clip_(p.level, 20) + ')\nจุดที่ควรดูแล:\n- ' +
        (Array.isArray(p.risks) ? p.risks.map((t) => clip_(t, 200)).join('\n- ') : '') + '\n\nเปิดชีต: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
    } catch (e) { /* ไม่ให้การส่งอีเมลล้มทำให้ลูกค้าส่งไม่สำเร็จ */ }
  }
  return { ok: true };
}

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
  ['จ่ายค่ากินอยู่', 'เงินเหลือน้อย'], ['ออมหรือลงทุน', 'การออม'], ['ถ้าต้องนอนโรงพยาบาล', 'ประกันสุขภาพ'], ['ถ้าเกิดเรื่องไม่คาดฝัน', 'ประกันชีวิต'],
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
