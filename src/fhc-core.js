/* Financial Health Check — shared core (calculation + form UI)
 * ใช้ร่วมกันทั้งหน้า HQ (claude.ai) และหน้าสาธารณะ (GitHub Pages)
 * ไม่มีการส่งข้อมูลออกจากเครื่อง: ทุกอย่างคำนวณใน browser
 */
(function (global) {
  "use strict";

  const DEBT_TYPES = [
    { v: "home", t: "บ้าน/คอนโด", consumer: false },
    { v: "car", t: "รถยนต์", consumer: false },
    { v: "card", t: "บัตรเครดิต", consumer: true },
    { v: "personal", t: "สินเชื่อส่วนบุคคล/บัตรกดเงินสด", consumer: true },
    { v: "installment", t: "ผ่อนสินค้า 0%/ผ่อนของ", consumer: true },
    { v: "business", t: "หนี้ธุรกิจ", consumer: false },
    { v: "other", t: "อื่น ๆ", consumer: true },
  ];

  const WELFARE = [
    { v: "none", t: "ไม่มีสวัสดิการรักษา" },
    { v: "basic", t: "ประกันสังคม / บัตรทอง" },
    { v: "gov", t: "สวัสดิการข้าราชการ / รัฐวิสาหกิจ" },
    { v: "corp", t: "ประกันกลุ่มจากบริษัท" },
  ];

  const n = (x) => {
    const v = parseFloat(String(x ?? "").replace(/,/g, ""));
    return isFinite(v) && v > 0 ? v : 0;
  };

  /** คำนวณผลจากข้อมูลดิบ คืนค่า {metrics, score, level, risks, plan, gap} */
  function calculate(input) {
    const d = input || {};
    const income = n(d.income);
    const expense = n(d.expense);
    const saving = n(d.saving);
    const liquid = n(d.liquid);
    const invest = n(d.invest);
    const otherAssets = n(d.otherAssets);
    const lifeCover = n(d.lifeCover);
    const healthLimit = n(d.healthLimit);
    const ciCover = n(d.ciCover);
    const dependents = Math.round(n(d.dependents));
    const freelance = !!d.freelance;
    const debts = (d.debts || []).map((x) => ({
      type: x.type || "other",
      balance: n(x.balance),
      payment: n(x.payment),
      rate: n(x.rate),
    }));

    const debtTotal = debts.reduce((s, x) => s + x.balance, 0);
    const payTotal = debts.reduce((s, x) => s + x.payment, 0);
    const consumerPay = debts
      .filter((x) => (DEBT_TYPES.find((t) => t.v === x.type) || {}).consumer)
      .reduce((s, x) => s + x.payment, 0);
    const assets = liquid + invest + otherAssets;
    const netWorth = assets - debtTotal;

    const efTarget = freelance ? 6 : 3;
    const efMonths = expense > 0 ? liquid / expense : liquid > 0 ? 99 : 0;
    const dsr = income > 0 ? payTotal / income : payTotal > 0 ? 1 : 0;
    const consumerRatio = income > 0 ? consumerPay / income : consumerPay > 0 ? 1 : 0;
    const savingRatio = income > 0 ? saving / income : 0;
    const debtToAsset = assets > 0 ? debtTotal / assets : debtTotal > 0 ? 9 : 0;
    const cashflow = income - expense - payTotal - saving;

    // ทุนประกันชีวิตที่ควรมี (Need-based แบบย่อ)
    const lifeNeed =
      debtTotal +
      (dependents > 0 ? expense * 12 * Math.min(10, 3 + dependents * 2) : 0) +
      (dependents > 0 || debtTotal > 0 ? 100000 : 0);
    const lifeRatio = lifeNeed > 0 ? lifeCover / lifeNeed : 1;
    const welfare = d.welfare || "none";

    // ---------- คะแนน (รวม 100) ----------
    const sEF =
      efMonths >= efTarget * 2 ? 20 : efMonths >= efTarget ? 16 : efMonths >= efTarget / 2 ? 9 : efMonths >= 0.5 ? 4 : 0;
    const sDSR = dsr <= 0.25 ? 20 : dsr <= 0.35 ? 15 : dsr <= 0.45 ? 8 : dsr <= 0.6 ? 3 : 0;
    const sCons = consumerRatio <= 0.1 ? 10 : consumerRatio <= 0.2 ? 6 : consumerRatio <= 0.3 ? 2 : 0;
    const sSave = savingRatio >= 0.2 ? 15 : savingRatio >= 0.1 ? 11 : savingRatio >= 0.05 ? 6 : savingRatio > 0 ? 2 : 0;
    const sDA = debtToAsset <= 0.3 ? 10 : debtToAsset <= 0.5 ? 7 : debtToAsset <= 0.8 ? 3 : 0;
    const sLife = Math.round(Math.min(1, lifeRatio) * 15);
    const welfareBase = welfare === "gov" ? 6 : welfare === "corp" ? 4 : welfare === "basic" ? 3 : 0;
    const sHealth = Math.min(
      10,
      healthLimit >= 1000000 ? 10 : healthLimit >= 500000 ? 7 + (ciCover > 0 ? 1 : 0) : healthLimit > 0 ? 4 + (ciCover > 0 ? 1 : 0) : welfareBase + (ciCover > 0 ? 2 : 0)
    );
    const score = sEF + sDSR + sCons + sSave + sDA + sLife + sHealth;
    const level =
      score >= 80 ? { key: "good", t: "แข็งแรง" } : score >= 60 ? { key: "ok", t: "พอใช้" } : score >= 40 ? { key: "warn", t: "ต้องดูแล" } : { key: "bad", t: "วิกฤต" };

    const st = (got, max) => (got >= max * 0.75 ? "good" : got >= max * 0.4 ? "warn" : "bad");
    const pct = (v) => (v * 100).toFixed(0) + "%";
    const metrics = [
      { id: "ef", short: "สำรองฉุกเฉิน", name: "เงินสำรองฉุกเฉิน", value: efMonths >= 99 ? "—" : efMonths.toFixed(1) + " เดือน", target: `${efTarget}–${efTarget * 2} เดือน`, formula: "สินทรัพย์สภาพคล่อง ÷ ค่าใช้จ่ายต่อเดือน", score: sEF, max: 20, status: st(sEF, 20) },
      { id: "dsr", short: "หนี้/รายได้", name: "ภาระหนี้ต่อรายได้ (DSR)", value: pct(dsr), target: "ไม่เกิน 35–40%", formula: "ค่างวดหนี้ทั้งหมด ÷ รายได้", score: sDSR, max: 20, status: st(sDSR, 20) },
      { id: "cons", short: "หนี้บริโภค", name: "หนี้บริโภคต่อรายได้", value: pct(consumerRatio), target: "ไม่เกิน 15–20%", formula: "ค่างวดบัตร/สินเชื่อส่วนบุคคล/ผ่อนของ ÷ รายได้", score: sCons, max: 10, status: st(sCons, 10) },
      { id: "save", short: "การออม", name: "อัตราการออมและลงทุน", value: pct(savingRatio), target: "10–20% ขึ้นไป", formula: "เงินออม+ลงทุนต่อเดือน ÷ รายได้", score: sSave, max: 15, status: st(sSave, 15) },
      { id: "da", short: "หนี้/ทรัพย์สิน", name: "หนี้สินต่อทรัพย์สิน", value: assets > 0 ? pct(debtToAsset) : debtTotal > 0 ? "ไม่มีทรัพย์สิน" : "0%", target: "ต่ำกว่า 50%", formula: "หนี้สินรวม ÷ ทรัพย์สินรวม", score: sDA, max: 10, status: st(sDA, 10) },
      { id: "life", short: "ประกันชีวิต", name: "ความคุ้มครองชีวิต", value: lifeNeed > 0 ? pct(Math.min(lifeRatio, 9.99)) + " ของที่ควรมี" : "ยังไม่มีภาระที่ต้องคุ้มครอง", target: lifeNeed > 0 ? "ทุนอย่างน้อย " + fmt(lifeNeed) + " บาท" : "—", formula: "ทุนประกันชีวิต ÷ (หนี้ + ค่าใช้จ่ายผู้ที่ต้องดูแล + ค่าใช้จ่ายสุดท้าย)", score: sLife, max: 15, status: st(sLife, 15) },
      { id: "health", short: "สุขภาพ", name: "ความคุ้มครองสุขภาพ", value: healthLimit > 0 ? fmt(healthLimit) + " บาท/ปี" : (WELFARE.find((w) => w.v === welfare) || {}).t, target: "ผู้ป่วยใน 1 ล้านบาท/ปีขึ้นไป + โรคร้ายแรง", formula: "วงเงินค่ารักษาเทียบค่ารักษาโรงพยาบาลเอกชนปัจจุบัน", score: sHealth, max: 10, status: st(sHealth, 10) },
    ];

    // ---------- จุดเสี่ยง ----------
    const risks = [];
    if (cashflow < 0) risks.push({ w: 100, t: `กระแสเงินสดติดลบ ${fmt(-cashflow)} บาท/เดือน (รายจ่าย+หนี้+ออม มากกว่ารายได้)` });
    if (efMonths < efTarget) risks.push({ w: 90 - efMonths * 10, t: `เงินสำรองมีแค่ ${efMonths.toFixed(1)} เดือน ถ้ารายได้หยุดจะอยู่ได้ไม่ถึง ${efTarget} เดือน` });
    if (dsr > 0.4) risks.push({ w: 80 + dsr * 20, t: `ค่างวดหนี้กินรายได้ ${pct(dsr)} สูงเกินเกณฑ์ 40%` });
    const highRate = debts.filter((x) => x.rate >= 15 && x.balance > 0);
    if (highRate.length) risks.push({ w: 75, t: `มีหนี้ดอกเบี้ยสูง (≥15%/ปี) ${highRate.length} ก้อน รวม ${fmt(highRate.reduce((s, x) => s + x.balance, 0))} บาท` });
    if (lifeNeed > 0 && lifeRatio < 0.6) risks.push({ w: 70, t: `ทุนประกันชีวิตขาดอีกประมาณ ${fmt(lifeNeed - lifeCover)} บาท หากเกิดเหตุไม่คาดฝัน ครอบครัวต้องรับภาระแทน` });
    if (healthLimit < 500000 && welfare !== "gov") risks.push({ w: 65, t: "วงเงินค่ารักษาอาจไม่พอค่ารักษาโรงพยาบาลเอกชนหากป่วยหนัก" });
    if (savingRatio < 0.1) risks.push({ w: 55, t: `ออมได้ ${pct(savingRatio)} ของรายได้ ต่ำกว่าเกณฑ์ 10%` });
    if (netWorth < 0) risks.push({ w: 60, t: `ความมั่งคั่งสุทธิติดลบ ${fmt(-netWorth)} บาท` });
    risks.sort((a, b) => b.w - a.w);

    // ---------- แผน 30/90/365 ----------
    const plan = { d30: [], d90: [], d365: [] };
    plan.d30.push("จดรายรับรายจ่ายทุกวัน 30 วัน เพื่อหาจุดรั่ว");
    if (cashflow < 0) plan.d30.push(`ตัดค่าใช้จ่ายไม่จำเป็นอย่างน้อย ${fmt(-cashflow)} บาท/เดือน ให้กระแสเงินสดกลับมาเป็นบวก`);
    if (efMonths < efTarget) plan.d30.push(`แยกบัญชีเงินสำรองฉุกเฉิน ตั้งโอนอัตโนมัติวันเงินเดือนออก (เป้าหมาย ${fmt(expense * efTarget)} บาท)`);
    if (highRate.length) plan.d30.push("หยุดก่อหนี้บริโภคใหม่ และจ่ายหนี้ดอกเบี้ยสูงมากกว่าขั้นต่ำ");
    if (debts.length > 1) plan.d90.push("เรียงหนี้ตามดอกเบี้ย (Avalanche) หรือยอดน้อยสุด (Snowball) แล้วโปะทีละก้อน");
    if (dsr > 0.4) plan.d90.push("ติดต่อเจ้าหนี้เรื่องปรับโครงสร้าง/รวมหนี้/รีไฟแนนซ์ ให้ค่างวดต่ำกว่า 40% ของรายได้");
    if (healthLimit < 1000000 && welfare !== "gov") plan.d90.push("ทบทวนประกันสุขภาพให้วงเงินผู้ป่วยในเพียงพอ ก่อนอายุและสุขภาพเปลี่ยน");
    if (lifeNeed > 0 && lifeRatio < 1) plan.d90.push(`ปิดช่องว่างทุนประกันชีวิต ${fmt(Math.max(0, lifeNeed - lifeCover))} บาท ด้วยแบบที่เบี้ยเหมาะกับงบ`);
    if (savingRatio < 0.1) plan.d90.push("ตั้งออมก่อนใช้ อย่างน้อย 10% ของรายได้ ทันทีที่เงินเข้า");
    plan.d365.push("เงินสำรองฉุกเฉินครบตามเป้า และเริ่มลงทุนสม่ำเสมอ (DCA) ตามความเสี่ยงที่รับได้");
    plan.d365.push("ใช้สิทธิลดหย่อนภาษีให้ครบ (ประกันชีวิต ประกันสุขภาพ กองทุนลดหย่อนภาษี)");
    plan.d365.push("ทำ Financial Health Check ซ้ำทุก 6–12 เดือน");

    return {
      totals: { income, expense, saving, payTotal, debtTotal, assets, netWorth, cashflow, lifeNeed, lifeCover },
      metrics,
      score,
      level,
      risks: risks.slice(0, 3).map((r) => r.t),
      allRisks: risks.map((r) => r.t),
      plan,
      gap: { life: Math.max(0, lifeNeed - lifeCover), healthOk: healthLimit >= 1000000 || welfare === "gov" },
    };
  }

  function fmt(v) {
    return Math.round(v).toLocaleString("th-TH");
  }

  /** ข้อความสรุปสำหรับส่ง LINE (ไม่ใช้ AI) */
  function lineSummary(input, r, opts) {
    const o = opts || {};
    const L = [];
    L.push(`📋 ผลเช็กสุขภาพการเงิน${input.name ? " ของ " + input.name : ""}`);
    L.push(`คะแนน ${r.score}/100 ระดับ: ${r.level.t}`);
    L.push("");
    r.metrics.forEach((m) => L.push(`${m.status === "good" ? "🟢" : m.status === "warn" ? "🟡" : "🔴"} ${m.name}: ${m.value}`));
    if (r.risks.length) {
      L.push("");
      L.push("⚠️ จุดที่ควรดูแลก่อน");
      r.risks.forEach((t, i) => L.push(`${i + 1}. ${t}`));
    }
    L.push("");
    L.push(o.footer || "ผลประเมินเบื้องต้นเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน");
    return L.join("\n");
  }


  /** กราฟเรดาร์ 7 ด้าน (SVG string) opt: {size, grid, stroke, fill, text, dot} */
  function radarSVG(metrics, opt) {
    const o = Object.assign({ size: 300, grid: "currentColor", stroke: "currentColor", fill: "currentColor", text: "currentColor", dot: "currentColor" }, opt || {});
    const S = o.size, cx = S / 2, cy = S / 2, R = S * 0.32, N = metrics.length;
    const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / N; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    let g = "";
    [0.25, 0.5, 0.75, 1].forEach((k) => {
      g += `<polygon points="${metrics.map((_, i) => pt(i, R * k).join(",")).join(" ")}" fill="none" stroke="${o.grid}" stroke-opacity="${k === 1 ? 0.5 : 0.22}" stroke-width="1"/>`;
    });
    metrics.forEach((_, i) => { const [x, y] = pt(i, R); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${o.grid}" stroke-opacity="0.22"/>`; });
    const vals = metrics.map((m, i) => pt(i, R * Math.max(0.04, m.score / m.max)));
    g += `<polygon points="${vals.map((p) => p.join(",")).join(" ")}" fill="${o.fill}" fill-opacity="0.28" stroke="${o.stroke}" stroke-width="2" stroke-linejoin="round"/>`;
    vals.forEach((p) => (g += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${o.dot}"/>`));
    metrics.forEach((m, i) => {
      const [x, y] = pt(i, R + S * 0.1);
      const anchor = Math.abs(x - cx) < 4 ? "middle" : x > cx ? "start" : "end";
      g += `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${S * 0.04}" fill="${o.text}">${m.short}</text>`;
      g += `<text x="${x}" y="${y + S * 0.048}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${S * 0.034}" fill="${o.text}" fill-opacity="0.6">${m.score}/${m.max}</text>`;
    });
    return `<svg viewBox="${-S * 0.12} 0 ${S * 1.24} ${S}" width="100%" role="img" aria-label="กราฟเรดาร์สุขภาพการเงิน 7 ด้าน">${g}</svg>`;
  }


  // ---------------- QUICK MODE (tap-only) ----------------
  const QUICK = [
    { k: "age", q: "อายุเท่าไหร่", opts: [["ต่ำกว่า 25", 22], ["25–34", 30], ["35–44", 40], ["45–54", 50], ["55 ขึ้นไป", 58]] },
    { k: "dependents", q: "มีคนที่พึ่งพารายได้ของคุณกี่คน", hint: "พ่อแม่ ลูก หรือคู่สมรสที่คุณช่วยดูแลค่าใช้จ่าย", opts: [["ไม่มี", 0], ["1 คน", 1], ["2 คน", 2], ["3 คนขึ้นไป", 3]] },
    { k: "freelance", q: "รายได้เป็นแบบไหน", opts: [["เงินเดือนประจำ", false], ["ไม่แน่นอน", true, "ฟรีแลนซ์ ค้าขาย เจ้าของกิจการ"]] },
    { k: "income", q: "รายได้ต่อเดือนประมาณเท่าไหร่", hint: "หลังหักภาษีและประกันสังคม", opts: [["ต่ำกว่า 15,000", 12000], ["15,000–25,000", 20000], ["25,000–40,000", 32000], ["40,000–70,000", 55000], ["70,000 ขึ้นไป", 90000]] },
    { k: "debtLoad", q: "ค่าผ่อนหนี้ทุกก้อนรวมกัน คิดเป็นเท่าไหร่ของรายได้", hint: "บ้าน รถ บัตร สินเชื่อ ผ่อนของ", opts: [["ไม่มีหนี้", 0], ["ไม่ถึง 20%", 0.15], ["20–40%", 0.3], ["40–60%", 0.5], ["มากกว่า 60%", 0.65]] },
    { k: "consumer", q: "มีหนี้บัตรเครดิต หรือสินเชื่อส่วนบุคคลไหม", opts: [["ไม่มี", 0], ["มีนิดหน่อย", 0.4], ["เป็นหนี้ส่วนใหญ่", 0.85]], skipIf: (a) => a.debtLoad === 0 },
    { k: "left", q: "จ่ายค่ากินอยู่และผ่อนหนี้แล้ว เงินเหลือแค่ไหน", opts: [["ไม่พอใช้", -0.05, "ต้องยืมหรือรูดบัตร"], ["เหลือนิดหน่อย", 0.05, "ไม่ถึง 10%"], ["เหลือ 10–20%", 0.15], ["เหลือ 20–30%", 0.25], ["เหลือมากกว่า 30%", 0.35]] },
    { k: "save", q: "ออมหรือลงทุนทุกเดือนไหม", opts: [["ยังไม่ได้ออม", 0], ["ไม่ถึง 5%", 0.03], ["5–10%", 0.08], ["10–20%", 0.15], ["มากกว่า 20%", 0.25]] },
    { k: "ef", q: "ถ้ารายได้หยุดวันนี้ เงินสดที่มีอยู่ได้กี่เดือน", opts: [["ไม่ถึง 1 เดือน", 0.5], ["1–3 เดือน", 2], ["3–6 เดือน", 4.5], ["6–12 เดือน", 8], ["มากกว่า 1 ปี", 14]] },
    { k: "assets", q: "มีทรัพย์สินอื่นรวมกันประมาณเท่าไหร่", hint: "บ้าน รถ ที่ดิน หุ้น กองทุน ทอง", opts: [["แทบไม่มี", 0], ["ไม่ถึง 5 แสน", 250000], ["5 แสน–2 ล้าน", 1200000], ["2–5 ล้าน", 3500000], ["มากกว่า 5 ล้าน", 7000000]] },
    { k: "health", q: "ถ้าต้องนอนโรงพยาบาล ใช้สิทธิ์อะไร", opts: [["ไม่มีเลย", "none"], ["ประกันสังคม / บัตรทอง", "basic"], ["ประกันกลุ่มของบริษัท", "corp"], ["สวัสดิการข้าราชการ", "gov"], ["ประกันสุขภาพที่ซื้อเอง ต่ำกว่า 1 ล้าน", "own-low"], ["ประกันสุขภาพที่ซื้อเอง 1 ล้านขึ้นไป", "own-high"]] },
    { k: "life", q: "ทุนประกันชีวิตรวมประมาณเท่าไหร่", opts: [["ไม่มี / ไม่แน่ใจ", 0], ["ไม่ถึง 5 แสน", 300000], ["5 แสน–1 ล้าน", 750000], ["1–3 ล้าน", 2000000], ["มากกว่า 3 ล้าน", 4000000]] },
  ];

  /** แปลงคำตอบโหมดด่วนเป็นข้อมูลตัวเลขโดยประมาณ */
  function quickToInput(a) {
    const income = a.income || 0;
    const pay = income * (a.debtLoad || 0);
    const consumerPay = pay * (a.debtLoad ? a.consumer || 0 : 0);
    const otherPay = pay - consumerPay;
    const outflow = income * (1 - (a.left ?? 0.1));
    const expense = Math.max(income * 0.2, outflow - pay);
    const debts = [];
    if (consumerPay > 0) debts.push({ type: "card", balance: Math.round(consumerPay * 24), payment: Math.round(consumerPay), rate: 18 });
    if (otherPay > 0) debts.push({ type: "car", balance: Math.round(otherPay * 60), payment: Math.round(otherPay), rate: 5 });
    const h = a.health || "basic";
    return {
      name: a.name || "", age: a.age || 0, dependents: a.dependents || 0, freelance: !!a.freelance,
      income: Math.round(income), expense: Math.round(expense), saving: Math.round(income * (a.save || 0)),
      debts, liquid: Math.round(expense * (a.ef ?? 1)), invest: 0, otherAssets: a.assets || 0,
      lifeCover: a.life || 0,
      healthLimit: h === "own-high" ? 1500000 : h === "own-low" ? 400000 : 0,
      ciCover: 0, welfare: h.startsWith("own") ? "basic" : h,
      goal: a.goal || "", consent: !!a.consent, quick: true,
    };
  }

  /**
   * wizard(el, {mode, onDone(input, answers), consentText, startName})
   * แสดงทีละคำถาม แตะแล้วไปข้อถัดไปอัตโนมัติ
   */
  function wizard(el, opts) {
    const o = opts || {};
    let a = Object.assign({}, o.answers || {});
    const list = () => QUICK.filter((q) => !(q.skipIf && q.skipIf(a)));
    let i = 0;
    const total = () => list().length + 1;
    function frame(inner, idx) {
      const pct = Math.round((idx / total()) * 100);
      return `<div class="wz">
        <div class="wz-top"><span class="wz-count">${idx < total() - 1 ? `ข้อ ${idx + 1} จาก ${total() - 1}` : "ขั้นสุดท้าย"}</span><div class="wz-bar"><i style="width:${pct}%"></i></div></div>
        <div class="wz-card">${inner}</div>
        <div class="wz-nav">${idx > 0 ? '<button type="button" class="wz-back">← ย้อนกลับ</button>' : "<span></span>"}${o.onDetail ? '<button type="button" class="wz-detail">กรอกตัวเลขจริงแทน</button>' : ""}</div>
      </div>`;
    }
    function render() {
      const L = list();
      if (i < L.length) {
        const q = L[i];
        el.innerHTML = frame(`<p class="wz-q">${esc(q.q)}</p>${q.hint ? `<p class="wz-hint">${esc(q.hint)}</p>` : ""}
          <div class="wz-opts">${q.opts.map((op, j) => `<button type="button" class="wz-opt" data-j="${j}" aria-pressed="${a[q.k] !== undefined && a[q.k] === op[1]}"><span>${esc(op[0])}</span>${op[2] ? `<small>${esc(op[2])}</small>` : ""}</button>`).join("")}</div>`, i);
        el.querySelectorAll(".wz-opt").forEach((b) => b.addEventListener("click", () => {
          a[q.k] = q.opts[+b.dataset.j][1];
          el.querySelectorAll(".wz-opt").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          setTimeout(() => { i++; render(); }, 220);
        }));
      } else {
        el.innerHTML = frame(`<p class="wz-q">เกือบเสร็จแล้ว</p>
          <label class="wz-field" for="wz-name"><span>${o.mode === "owner" ? "ชื่อเล่นลูกค้า" : "อยากให้เรียกว่าอะไร (ไม่บังคับ)"}</span><input id="wz-name" type="text" value="${esc(a.name || "")}" placeholder="เช่น มิว" autocomplete="off"></label>
          <label class="wz-consent" for="wz-consent"><input id="wz-consent" type="checkbox" ${a.consent ? "checked" : ""}><span>${esc(o.consentText || "เข้าใจแล้วว่าเป็นการประเมินเบื้องต้น")}</span></label>
          <p class="wz-err" hidden>ติ๊กช่องด้านบนก่อนดูผลนะ</p>
          <button type="button" class="wz-go">ดูผลเลย</button>`, L.length);
        el.querySelector(".wz-go").addEventListener("click", () => {
          a.name = el.querySelector("#wz-name").value.trim();
          a.consent = el.querySelector("#wz-consent").checked;
          if (!a.consent) { el.querySelector(".wz-err").hidden = false; return; }
          o.onDone && o.onDone(quickToInput(a), a);
        });
      }
      const bk = el.querySelector(".wz-back"); if (bk) bk.addEventListener("click", () => { i = Math.max(0, i - 1); render(); });
      const dt = el.querySelector(".wz-detail"); if (dt) dt.addEventListener("click", () => o.onDetail(quickToInput(a), a));
    }
    render();
    return { reset(ans) { a = Object.assign({}, ans || {}); i = 0; render(); }, get answers() { return a; } };
  }

  // ---------------- UI ----------------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function field(id, label, opts) {
    const o = opts || {};
    const hint = o.hint ? `<small class="fhc-hint">${esc(o.hint)}</small>` : "";
    return `<label class="fhc-field" for="${id}"><span>${esc(label)}</span>
      <input id="${id}" name="${id}" inputmode="${o.text ? "text" : "decimal"}" ${o.text ? 'type="text"' : 'type="text" data-num="1"'} placeholder="${esc(o.ph || (o.text ? "" : "0"))}" autocomplete="off">${hint}</label>`;
  }

  function formHTML(mode) {
    const owner = mode === "owner";
    return `
    <form class="fhc-form" id="fhc-form" novalidate>
      <fieldset class="fhc-set"><legend>ข้อมูลพื้นฐาน</legend>
        <div class="fhc-grid">
          ${field("fhc-name", owner ? "ชื่อเล่นลูกค้า" : "ชื่อเล่น (ไม่บังคับ)", { text: true, ph: "เช่น พี่นก" })}
          ${field("fhc-age", "อายุ (ปี)", { ph: "30" })}
          ${field("fhc-dependents", "จำนวนคนที่ต้องดูแล", { ph: "0", hint: "พ่อแม่ ลูก คู่สมรสที่พึ่งพารายได้คุณ" })}
          <label class="fhc-field fhc-check" for="fhc-freelance"><input id="fhc-freelance" name="fhc-freelance" type="checkbox"><span>รายได้ไม่แน่นอน (ฟรีแลนซ์/ค้าขาย/เจ้าของกิจการ)</span></label>
        </div>
      </fieldset>
      <fieldset class="fhc-set"><legend>รายรับ-รายจ่ายต่อเดือน (บาท)</legend>
        <div class="fhc-grid">
          ${field("fhc-income", "รายได้รวมต่อเดือน (หลังหักภาษี/ประกันสังคม)")}
          ${field("fhc-expense", "ค่าใช้จ่ายต่อเดือน (ไม่รวมค่างวดหนี้)", { hint: "ค่ากิน ค่าเดินทาง ค่าเช่า ค่าน้ำไฟ ฯลฯ" })}
          ${field("fhc-saving", "เงินออม+ลงทุนต่อเดือน")}
        </div>
      </fieldset>
      <fieldset class="fhc-set"><legend>หนี้สิน</legend>
        <div class="fhc-debts" id="fhc-debts"></div>
        <button type="button" class="fhc-btn-ghost" id="fhc-add-debt">+ เพิ่มหนี้</button>
      </fieldset>
      <fieldset class="fhc-set"><legend>ทรัพย์สิน (บาท)</legend>
        <div class="fhc-grid">
          ${field("fhc-liquid", "เงินสด/เงินฝาก (ถอนได้ทันที)")}
          ${field("fhc-invest", "เงินลงทุน (หุ้น กองทุน ทอง ฯลฯ)")}
          ${field("fhc-otherAssets", "ทรัพย์สินอื่น (บ้าน รถ ที่ดิน)", { hint: "มูลค่าตลาดโดยประมาณ" })}
        </div>
      </fieldset>
      <fieldset class="fhc-set"><legend>ความคุ้มครองที่มีอยู่</legend>
        <div class="fhc-grid">
          ${field("fhc-lifeCover", "ทุนประกันชีวิตรวม (บาท)")}
          ${field("fhc-healthLimit", "วงเงินค่ารักษาผู้ป่วยใน ต่อปี (บาท)")}
          ${field("fhc-ciCover", "ทุนประกันโรคร้ายแรง (บาท)")}
          <label class="fhc-field" for="fhc-welfare"><span>สวัสดิการรักษาพยาบาล</span>
            <select id="fhc-welfare" name="fhc-welfare">${WELFARE.map((w) => `<option value="${w.v}">${w.t}</option>`).join("")}</select></label>
        </div>
      </fieldset>
      <fieldset class="fhc-set"><legend>เป้าหมายการเงิน</legend>
        <label class="fhc-field" for="fhc-goal"><span>อยากให้การเงินเป็นแบบไหนใน 1–5 ปี</span>
          <textarea id="fhc-goal" name="fhc-goal" rows="2" placeholder="เช่น ปลดหนี้บัตรให้หมด มีเงินสำรอง 6 เดือน ซื้อคอนโด"></textarea></label>
      </fieldset>
      <label class="fhc-consent" for="fhc-consent"><input id="fhc-consent" name="fhc-consent" type="checkbox">
        <span>${owner ? "ลูกค้ายินยอมให้เก็บข้อมูลนี้เพื่อใช้วางแผนการเงิน (PDPA)" : "ฉันเข้าใจว่าผลนี้เป็นการประเมินเบื้องต้น ข้อมูลคำนวณในเครื่องของฉันเท่านั้น ไม่ถูกส่งไปที่ใดจนกว่าฉันจะกดส่งเอง"}</span></label>
      <div class="fhc-actions">
        <button type="submit" class="fhc-btn">ดูผลสุขภาพการเงิน</button>
        <button type="button" class="fhc-btn-ghost" id="fhc-sample">ลองกรอกตัวอย่าง</button>
        <button type="button" class="fhc-btn-ghost" id="fhc-reset">ล้างข้อมูล</button>
      </div>
      <p class="fhc-err" id="fhc-err" role="alert" hidden></p>
    </form>
    <section class="fhc-result" id="fhc-result" hidden aria-live="polite"></section>`;
  }

  function debtRow(i, d) {
    const x = d || {};
    return `<div class="fhc-debt" data-i="${i}">
      <label class="fhc-field" for="fhc-dt-${i}"><span>ประเภท</span><select id="fhc-dt-${i}">${DEBT_TYPES.map((t) => `<option value="${t.v}" ${x.type === t.v ? "selected" : ""}>${t.t}</option>`).join("")}</select></label>
      <label class="fhc-field" for="fhc-db-${i}"><span>ยอดคงเหลือ</span><input id="fhc-db-${i}" type="text" inputmode="decimal" data-num="1" value="${esc(x.balance || "")}" placeholder="0"></label>
      <label class="fhc-field" for="fhc-dp-${i}"><span>ค่างวด/เดือน</span><input id="fhc-dp-${i}" type="text" inputmode="decimal" data-num="1" value="${esc(x.payment || "")}" placeholder="0"></label>
      <label class="fhc-field" for="fhc-dr-${i}"><span>ดอกเบี้ย %/ปี</span><input id="fhc-dr-${i}" type="text" inputmode="decimal" value="${esc(x.rate || "")}" placeholder="0"></label>
      <button type="button" class="fhc-x" aria-label="ลบหนี้รายการนี้" data-del="${i}">×</button>
    </div>`;
  }

  const SAMPLE = {
    name: "ตัวอย่าง: มิว", age: 28, dependents: 1, freelance: false,
    income: 32000, expense: 17000, saving: 2000,
    debts: [ { type: "car", balance: 380000, payment: 8200, rate: 3 }, { type: "card", balance: 45000, payment: 2500, rate: 16 } ],
    liquid: 25000, invest: 15000, otherAssets: 450000,
    lifeCover: 200000, healthLimit: 0, ciCover: 0, welfare: "basic",
    goal: "ปลดหนี้บัตร มีเงินสำรอง 6 เดือน",
  };

  function resultHTML(input, r, mode) {
    const statusT = { good: "ดี", warn: "ควรปรับ", bad: "เสี่ยง" };
    const ring = Math.max(0, Math.min(100, r.score));
    return `
      <div class="fhc-top">
      <div class="fhc-score fhc-lv-${r.level.key}">
        <div class="fhc-gauge" style="--p:${ring}"><div><b>${r.score}</b><span>/100</span></div></div>
        <div class="fhc-score-txt">
          <p class="fhc-eyebrow">คะแนนสุขภาพการเงิน${input.name ? " · " + esc(input.name) : ""}</p>
          <h3>ระดับ: ${r.level.t}</h3>
          <p>กระแสเงินสดคงเหลือ <b class="fhc-num">${fmt(r.totals.cashflow)}</b> บาท/เดือน · ความมั่งคั่งสุทธิ <b class="fhc-num">${fmt(r.totals.netWorth)}</b> บาท</p>
        </div>
      </div>
      <div class="fhc-radar">${radarSVG(r.metrics)}</div>
      </div>
      <div class="fhc-table-wrap"><table class="fhc-table">
        <thead><tr><th>ด้าน</th><th>ผลของคุณ</th><th>เกณฑ์</th><th>คะแนน</th></tr></thead>
        <tbody>${r.metrics.map((m) => `<tr><td><span class="fhc-pill fhc-${m.status}">${statusT[m.status]}</span> ${esc(m.name)}<small>${esc(m.formula)}</small></td><td class="fhc-num">${esc(m.value)}</td><td>${esc(m.target)}</td><td class="fhc-num">${m.score}/${m.max}</td></tr>`).join("")}</tbody>
      </table></div>
      ${r.risks.length ? `<div class="fhc-block"><h4>3 จุดที่ควรดูแลก่อน</h4><ol>${r.risks.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></div>` : `<div class="fhc-block"><h4>ไม่พบจุดเสี่ยงสำคัญ</h4><p>รักษาวินัยนี้ไว้ และทบทวนทุก 6–12 เดือน</p></div>`}
      <div class="fhc-plan">
        <div><h4>30 วัน</h4><ul>${r.plan.d30.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
        <div><h4>90 วัน</h4><ul>${r.plan.d90.map((t) => `<li>${esc(t)}</li>`).join("") || "<li>รักษาแผนเดิม</li>"}</ul></div>
        <div><h4>1 ปี</h4><ul>${r.plan.d365.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
      </div>
      <p class="fhc-disclaimer">ผลประเมินเบื้องต้นเพื่อการศึกษา ใช้เกณฑ์ทั่วไป ไม่ใช่คำแนะนำการลงทุน ควรปรึกษาผู้เชี่ยวชาญก่อนตัดสินใจ</p>
      <div class="fhc-actions" id="fhc-result-actions"></div>`;
  }

  /**
   * mount(el, {mode:"owner"|"public", onResult(input,result), actions:[{id,label,primary,onClick(input,result,btn)}], initial})
   */
  function mount(el, opts) {
    const o = opts || {};
    el.innerHTML = formHTML(o.mode);
    const form = el.querySelector("#fhc-form");
    const debtsEl = el.querySelector("#fhc-debts");
    const resEl = el.querySelector("#fhc-result");
    const errEl = el.querySelector("#fhc-err");
    let debtCount = 0;
    let last = null;

    function addDebt(d) { debtsEl.insertAdjacentHTML("beforeend", debtRow(debtCount++, d)); }
    function setVal(id, v) { const f = el.querySelector("#fhc-" + id); if (!f) return; if (f.type === "checkbox") f.checked = !!v; else f.value = f.dataset.num && n(v) ? n(v).toLocaleString("en-US") : (v ?? ""); }
    function fill(d) {
      ["name", "age", "dependents", "income", "expense", "saving", "liquid", "invest", "otherAssets", "lifeCover", "healthLimit", "ciCover", "goal"].forEach((k) => setVal(k, d[k]));
      setVal("freelance", d.freelance); setVal("welfare", d.welfare || "none"); setVal("consent", d.consent);
      debtsEl.innerHTML = ""; debtCount = 0;
      (d.debts && d.debts.length ? d.debts : [{}]).forEach(addDebt);
    }
    function read() {
      const g = (id) => { const f = el.querySelector("#fhc-" + id); return f ? (f.type === "checkbox" ? f.checked : f.value.trim()) : ""; };
      const debts = [...debtsEl.querySelectorAll(".fhc-debt")].map((row) => {
        const i = row.dataset.i;
        return { type: el.querySelector("#fhc-dt-" + i).value, balance: n(el.querySelector("#fhc-db-" + i).value), payment: n(el.querySelector("#fhc-dp-" + i).value), rate: n(el.querySelector("#fhc-dr-" + i).value) };
      }).filter((x) => x.balance || x.payment);
      const out = { name: g("name"), age: n(g("age")), dependents: n(g("dependents")), freelance: g("freelance"), welfare: g("welfare"), goal: g("goal"), consent: g("consent"), debts };
      ["income", "expense", "saving", "liquid", "invest", "otherAssets", "lifeCover", "healthLimit", "ciCover"].forEach((k) => (out[k] = n(g(k))));
      return out;
    }
    function show(input) {
      const r = calculate(input);
      last = { input, result: r };
      resEl.innerHTML = resultHTML(input, r, o.mode);
      resEl.hidden = false;
      const act = resEl.querySelector("#fhc-result-actions");
      (o.actions || []).forEach((a) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = a.primary ? "fhc-btn" : "fhc-btn-ghost"; b.textContent = a.label; b.id = "fhc-act-" + a.id;
        b.addEventListener("click", () => a.onClick(last.input, last.result, b));
        act.appendChild(b);
      });
      if (o.onResult) o.onResult(input, r, resEl);
      resEl.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }

    // format numbers with commas while typing
    el.addEventListener("blur", (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.num && t.value) { const v = n(t.value); t.value = v ? v.toLocaleString("en-US") : ""; }
    }, true);
    el.querySelector("#fhc-add-debt").addEventListener("click", () => addDebt());
    debtsEl.addEventListener("click", (e) => { const i = e.target.dataset && e.target.dataset.del; if (i != null) e.target.closest(".fhc-debt").remove(); });
    el.querySelector("#fhc-sample").addEventListener("click", () => fill(SAMPLE));
    el.querySelector("#fhc-reset").addEventListener("click", () => { fill({}); resEl.hidden = true; errEl.hidden = true; });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = read();
      const miss = [];
      if (!d.income) miss.push("รายได้ต่อเดือน");
      if (!d.expense) miss.push("ค่าใช้จ่ายต่อเดือน");
      if (!d.consent) miss.push("ช่องยืนยันด้านล่าง");
      if (miss.length) { errEl.textContent = "กรุณากรอก: " + miss.join(", "); errEl.hidden = false; return; }
      errEl.hidden = true;
      if (o.onSubmit) { o.onSubmit(d); return; }
      show(d);
    });

    fill(o.initial || {});
    return { fill, read, show, get last() { return last; } };
  }

  global.FHC = { calculate, lineSummary, radarSVG, mount, wizard, quickToInput, QUICK, fmt, DEBT_TYPES, WELFARE, SAMPLE };
})(typeof window !== "undefined" ? window : globalThis);
