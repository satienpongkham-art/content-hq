/* Content HQ บน GitHub Pages: จำลอง window.claude.use() ให้ทำงานกับ Apps Script API
   sample → Claude API (คีย์ของเจ้าของ เก็บใน Script Properties)
   db     → แท็บ HQ_Store ใน Google Sheet
   user   → "me"
   mcp    → อ่าน HQ_Leads / HQ_Summary
   ทุกคำขอต้องมีรหัส HQ_PIN ที่ตั้งไว้ฝั่ง Google (ไม่อยู่ในโค้ดนี้) */
(function () {
  "use strict";
  const API = "https://script.google.com/macros/s/AKfycbxOSY_YQXOQ5crGogdm68_IdH-wnbw6AyX-fvTdbsAZI8bf0loixvYYk0mWztXpTodW/exec";
  const KEY = "hq-pin";
  const store = { get: (s, k) => { try { return s.getItem(k); } catch (e) { return null; } }, set: (s, k, v) => { try { s.setItem(k, v); } catch (e) {} }, del: (s, k) => { try { s.removeItem(k); } catch (e) {} } };
  let pin = store.get(localStorage, KEY) || store.get(sessionStorage, KEY) || "";
  let readyResolve; const ready = new Promise((r) => (readyResolve = r));

  async function call(action, body) {
    let res;
    try { res = await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ action, pin }, body || {})) }); }
    catch (e) { throw { message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่", code: "network" }; }
    let j; try { j = await res.json(); } catch (e) {
      // Google บางครั้งตอบเป็นหน้าเว็บชั่วคราว (หลัง deploy / คนใช้พร้อมกัน) → ลองใหม่อัตโนมัติ
      const tries = (body && body._try) || 0;
      if (tries < 3 && !["add", "ai", "lead"].includes(action)) { await new Promise((r) => setTimeout(r, 1200 * (tries + 1))); return call(action, Object.assign({}, body, { _try: tries + 1 })); }
      throw { message: "เซิร์ฟเวอร์ไม่ตอบ ลองรีเฟรชหน้าอีกครั้ง", code: "bad_response" };
    }
    if (!j.ok) {
      if (j.error === "bad_pin") { lock(); throw { message: "รหัสไม่ถูกต้อง", code: "bad_pin" }; }
      throw { message: j.error || "เกิดข้อผิดพลาด", code: j.error || "error" };
    }
    return j;
  }

  // ---------- PIN overlay ----------
  const css = `.pin-ov{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:16px;background:radial-gradient(1200px 600px at 20% 0%,#2a3a8f 0%,transparent 60%),radial-gradient(900px 500px at 100% 100%,#4b2f8f 0%,transparent 55%),#0b1030;font-family:Sarabun,system-ui,sans-serif;color:#eef1ff}
.pin-card{box-sizing:border-box;width:min(360px,100%);display:grid;gap:14px;padding:28px 24px;border-radius:24px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 20px 60px rgba(0,0,0,.35);text-align:center}
.pin-card h1{font-family:Prompt,sans-serif;font-size:22px;margin:0}.pin-card p{margin:0;color:#b8c0ea;font-size:14px}
.pin-card input[type=password]{box-sizing:border-box;width:100%;font:inherit;font-size:22px;letter-spacing:.3em;text-align:center;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.25);color:#fff;outline:0}
.pin-card input[type=password]:focus{border-color:#8fa3ff;box-shadow:0 0 0 3px rgba(143,163,255,.3)}
.pin-card button{font:inherit;font-family:Prompt,sans-serif;font-size:16px;font-weight:600;padding:12px;border:0;border-radius:14px;cursor:pointer;color:#0b1030;background:linear-gradient(135deg,#8fa3ff,#c095ff 60%,#62e2c6)}
.pin-card button:disabled{opacity:.6;cursor:wait}.pin-card label{display:flex;gap:8px;justify-content:center;align-items:center;font-size:14px;color:#b8c0ea}
.pin-err{color:#ffb4c6!important;min-height:1.2em}
.pin-lock{position:fixed;right:12px;bottom:12px;z-index:40;font:inherit;font-size:13px;padding:6px 12px;border-radius:99px;border:1px solid rgba(255,255,255,.2);background:rgba(11,16,48,.7);color:#dfe4ff;cursor:pointer;backdrop-filter:blur(8px)}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  let ov = null;
  function showLogin(msg) {
    if (ov) { ov.querySelector(".pin-err").textContent = msg || ""; return; }
    ov = document.createElement("div"); ov.className = "pin-ov";
    ov.innerHTML = `<form class="pin-card" autocomplete="off"><h1>Content HQ การเงิน</h1><p>ใส่รหัสผ่านเพื่อเข้าใช้งาน</p>
      <input type="password" id="pin-in" inputmode="numeric" aria-label="รหัสผ่าน" required>
      <label for="pin-keep"><input type="checkbox" id="pin-keep" checked> จำในเครื่องนี้</label>
      <button type="submit" id="pin-go">เข้าใช้งาน</button><p class="pin-err" role="alert">${msg || ""}</p></form>`;
    document.body.appendChild(ov);
    const inp = ov.querySelector("#pin-in"), btn = ov.querySelector("#pin-go"), err = ov.querySelector(".pin-err");
    setTimeout(() => inp.focus(), 50);
    ov.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault(); btn.disabled = true; err.textContent = "กำลังตรวจรหัส…"; pin = inp.value.trim();
      try {
        const j = await call("login");
        store.set(ov.querySelector("#pin-keep").checked ? localStorage : sessionStorage, KEY, pin);
        unlocked(j);
      } catch (x) { err.textContent = x.message; btn.disabled = false; inp.select(); }
    });
  }
  function unlocked(j) {
    if (ov) { ov.remove(); ov = null; }
    if (!document.querySelector(".pin-lock")) {
      const b = document.createElement("button"); b.className = "pin-lock"; b.type = "button"; b.textContent = "🔒 ล็อก";
      b.addEventListener("click", () => { lock(); location.reload(); });
      document.body.appendChild(b);
    }
    if (j && j.ai === false) setTimeout(() => { const bn = document.getElementById("banner"); if (bn) { bn.textContent = "ยังไม่ได้ตั้งค่า ANTHROPIC_KEY ใน Apps Script ปุ่มให้ AI เขียนจะยังใช้ไม่ได้ (บันทึกงาน/FHC/Lead ใช้ได้ปกติ)"; bn.hidden = false; } }, 800);
    if (j) emitCost(j.cost);
    readyResolve();
  }
  function lock() { pin = ""; store.del(localStorage, KEY); store.del(sessionStorage, KEY); }

  function boot() {
    if (!pin) return showLogin();
    call("login").then(unlocked).catch((x) => showLogin(x.code === "bad_pin" ? "" : x.message));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  // ---------- db (Firestore-like subset) ----------
  const subs = new Set(); let writeQ = Promise.resolve();
  const queue = (fn) => (writeQ = writeQ.then(fn, fn));
  function snapDoc(id, data) { return { id, exists: data != null, data: () => (data == null ? undefined : JSON.parse(JSON.stringify(data))) }; }
  async function refresh(col) { await Promise.all([...subs].filter((s) => !col || s.col === col).map((s) => s.run())); }
  function query(col, order, lim) {
    return {
      orderBy: (f, dir) => query(col, { f, dir: dir || "asc" }, lim),
      limit: (n) => query(col, order, n),
      add: async (data) => { const j = await queue(() => call("add", { collection: col, data })); refresh(col); return { id: j.id }; },
      doc: (id) => docRef(col, id),
      get: async () => snapList(await call("list", { collection: col })),
      onSnapshot(cb, onErr) {
        const s = { col, run: async () => { try { cb(snapList(await call("list", { collection: col }))); } catch (e) { if (onErr) onErr(e); } } };
        subs.add(s); s.run(); return () => subs.delete(s);
      },
    };
    function snapList(j) {
      let docs = (j.docs || []).map((d) => snapDoc(d.id, d.data));
      if (order) docs.sort((a, b) => { const x = a.data()[order.f], y = b.data()[order.f]; const c = x > y ? 1 : x < y ? -1 : 0; return order.dir === "desc" ? -c : c; });
      if (lim) docs = docs.slice(0, lim);
      return { docs, size: docs.length, empty: !docs.length };
    }
  }
  function docRef(col, id) {
    return {
      id,
      get: async () => snapDoc(id, (await call("get", { collection: col, id })).doc),
      set: async (data) => { await queue(() => call("set", { collection: col, id, data })); refresh(col); },
      update: async (patch) => { await queue(async () => { const cur = (await call("get", { collection: col, id })).doc || {}; return call("set", { collection: col, id, data: Object.assign(cur, patch) }); }); refresh(col); },
      delete: async () => { await queue(() => call("del", { collection: col, id })); refresh(col); },
      onSnapshot(cb, onErr) {
        const s = { col, run: async () => { try { cb(snapDoc(id, (await call("get", { collection: col, id })).doc)); } catch (e) { if (onErr) onErr(e); } } };
        subs.add(s); s.run(); return () => subs.delete(s);
      },
    };
  }
  const db = { collection: (path) => query(path) };

  // ---------- mcp (leads) ----------
  const watchers = new Set();
  const mcp = {
    watchTool(server, tool, args, cb, opts) {
      const w = { run: async () => { try { const j = await call("leads"); cb({ type: "result", result: { payload: { fileContent: j.text } } }); } catch (e) { cb({ type: "error", error: { code: e.message || e.code } }); } } };
      watchers.add(w); w.run();
      const t = setInterval(() => { if (!document.hidden) w.run(); }, 60000);
      return () => { clearInterval(t); watchers.delete(w); };
    },
    invalidate: async () => { await Promise.all([...watchers].map((w) => w.run())); },
  };

  // ---------- real-time: รีเฟรชเมื่อกลับมาที่แท็บ + ทุก 2 นาที ----------
  const syncAll = () => { refresh(); watchers.forEach((w) => w.run()); };
  document.addEventListener("visibilitychange", () => { if (!document.hidden && pin) syncAll(); });
  setInterval(() => { if (!document.hidden && pin) refresh(); }, 120000);

  // ---------- sample (AI) ----------
  const emitCost = (c) => { if (c) window.dispatchEvent(new CustomEvent("hq-cost", { detail: c })); };
  // AI: เรียก Claude API ตรงจากเบราว์เซอร์แบบสตรีม (คีย์อยู่ในหน่วยความจำเท่านั้น ไม่เก็บลงเครื่อง)
  let aiCfg = null;
  async function getCfg() { if (!aiCfg) aiCfg = await call("aikey"); emitCost(aiCfg.cost); return aiCfg; }
  async function streamOnce(body, key, onDelta) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify(Object.assign({}, body, { stream: true })),
    }).catch(() => { throw { message: "เชื่อมต่อ Claude ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่", code: "network" }; });
    if (!res.ok) { let m = ""; try { const j = await res.json(); m = (j.error && j.error.message) || ""; } catch (e) {} throw { message: "Claude API " + res.status + ": " + m.slice(0, 200), code: "api_" + res.status, status: res.status, raw: m }; }
    const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "";
    const blocks = [], usage = {}; let stop = "";
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = chunk.split("\n").find((l) => l.startsWith("data:")); if (!line) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
        if (ev.type === "message_start" && ev.message && ev.message.usage) Object.assign(usage, ev.message.usage);
        else if (ev.type === "content_block_start") { const b = Object.assign({}, ev.content_block); if (b.type === "tool_use" || b.type === "server_tool_use") b._json = ""; blocks[ev.index] = b; }
        else if (ev.type === "content_block_delta") {
          const b = blocks[ev.index]; if (!b) continue;
          if (ev.delta.type === "text_delta") { b.text = (b.text || "") + ev.delta.text; onDelta(blocks); }
          else if (ev.delta.type === "input_json_delta") { b._json += ev.delta.partial_json; onDelta(blocks); }
        } else if (ev.type === "content_block_stop") { const b = blocks[ev.index]; if (b && b._json != null) { try { b.input = b._json ? JSON.parse(b._json) : {}; } catch (e) { b.input = {}; } } }
        else if (ev.type === "message_delta") { if (ev.usage) Object.assign(usage, ev.usage); if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason; }
        else if (ev.type === "error") throw { message: "Claude API: " + ((ev.error && ev.error.message) || "error"), code: "stream_error" };
      }
    }
    return { blocks: blocks.filter(Boolean), usage, stop };
  }
  async function sample(prompt, opts) {
    const o = opts || {}, cfg = await getCfg();
    const model = o.tier === "fast" ? cfg.models.fast : cfg.models.default;
    let search = !!o.search, text0 = String(prompt);
    const run = async () => {
      const tools = [];
      if (search) tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 3 });
      let p = text0;
      if (o.json) {
        tools.push({ name: "respond", description: "ส่งคำตอบสุดท้าย เป็นข้อมูลตามรูปแบบ JSON ที่กำหนดในคำสั่ง ใส่ทุกฟิลด์ที่กำหนดไว้ที่ระดับบนสุดของ input", input_schema: { type: "object", additionalProperties: true } });
        p += search ? "\n\nค้นเว็บเท่าที่จำเป็น (ไม่เกิน 3 ครั้ง) แล้วส่งคำตอบสุดท้ายด้วยเครื่องมือ respond เท่านั้น" : "\n\nต้องส่งคำตอบด้วยเครื่องมือ respond เท่านั้น ห้ามตอบเป็นข้อความ";
      }
      const body = { model, max_tokens: Math.min(o.maxTokens || 4000, 12000), messages: [{ role: "user", content: p }] };
      if (tools.length) body.tools = tools;
      let out = null, text = "", live = "";
      const sources = [], seen = {};
      for (let turn = 0; turn < 4; turn++) {
        const r = await streamOnce(body, cfg.key, (bl) => {
          if (!o.onText) return;
          live = text + bl.filter(Boolean).map((b) => b.text || b._json || "").join("");
          try { o.onText({ text: live }); } catch (e) {}
        });
        // usage → บันทึกค่าใช้จ่ายรายเดือนที่ฝั่ง Google (ไม่รอผล)
        call("usage", { model, usage: r.usage }).then((j) => emitCost(j.cost), () => {});
        r.blocks.forEach((b) => {
          if (b.type === "tool_use" && b.name === "respond") out = b.input;
          if (b.type === "text") text += b.text || "";
          if (b.type === "web_search_tool_result" && Array.isArray(b.content)) b.content.forEach((x) => { if (x.url && !seen[x.url] && sources.length < 8) { seen[x.url] = 1; sources.push({ title: x.title || x.url, url: x.url }); } });
        });
        const clean = r.blocks.map((b) => { const c = Object.assign({}, b); delete c._json; return c; });
        if (r.stop === "pause_turn") { body.messages = [body.messages[0], { role: "assistant", content: clean }]; continue; }
        if (o.json && !out && turn === 0 && r.stop === "end_turn" && !/\{[\s\S]*\}/.test(text)) {
          body.messages = [body.messages[0], { role: "assistant", content: clean }, { role: "user", content: "ส่งคำตอบสุดท้ายด้วยเครื่องมือ respond ตอนนี้เลย" }]; continue;
        }
        if (!out && !text.trim()) throw { message: r.stop === "max_tokens" ? "คำตอบยาวเกินกำหนด ลองใหม่อีกครั้ง" : "AI ไม่ได้ส่งคำตอบ ลองใหม่อีกครั้ง", code: "empty" };
        break;
      }
      if (out && Object.keys(out).length === 1) { const v = out[Object.keys(out)[0]]; if (v && typeof v === "object" && !Array.isArray(v)) out = v; else if (typeof v === "string") { try { const w = JSON.parse(v); if (w && typeof w === "object") out = w; } catch (e) {} } }
      return { text: out ? JSON.stringify(out) : text, model, sources };
    };
    try { return await run(); }
    catch (e) {
      if (search && e && e.status === 400 && /web_search|web search|tools\./i.test(e.raw || "")) { search = false; text0 += "\n(ค้นเว็บไม่ได้ในครั้งนี้ ให้ระบุใน sources_note ว่าต้องเช็กข้อมูลอะไร)"; return run(); }
      if (e && (e.status === 401 || e.status === 403)) aiCfg = null;
      throw e;
    }
  }
  const user = { id: async () => "me", name: async () => "Satienpong" };

  // ---------- ติดตั้งเป็นแอป (PWA) ----------
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); installEvt = e;
    ready.then(() => {
      if (document.querySelector(".pin-install")) return;
      const b = document.createElement("button"); b.className = "pin-install"; b.type = "button"; b.textContent = "📲 ติดตั้งแอป";
      b.addEventListener("click", async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (x) {} installEvt = null; b.remove(); });
      document.body.appendChild(b);
    });
  });
  window.addEventListener("appinstalled", () => { const b = document.querySelector(".pin-install"); if (b) b.remove(); });

  window.HQ_GITHUB = true;
  window.HQ_API = async (action, body) => { await ready; return call(action, body); };
  window.claude = {
    use: async (cap) => { await ready; return { sample, db, user, mcp }[cap] || null; },
  };
})();
