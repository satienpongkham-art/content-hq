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
    let j; try { j = await res.json(); } catch (e) { throw { message: "เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ", code: "bad_response" }; }
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
  async function sample(prompt, opts) {
    const j = await call("ai", { prompt: String(prompt), maxTokens: (opts && opts.maxTokens) || 4000 });
    if (opts && opts.onText) { try { opts.onText({ text: j.text }); } catch (e) {} }
    return { text: j.text, model: j.model };
  }
  const user = { id: async () => "me", name: async () => "Satienpong" };

  window.claude = {
    use: async (cap) => { await ready; return { sample, db, user, mcp }[cap] || null; },
  };
})();
