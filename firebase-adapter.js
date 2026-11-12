// Implements the claude.ai artifact runtime API (db / user / assets) on top of Firebase.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, OWNER_EMAIL } from "./firebase-config.js";

const configured = !Object.values(firebaseConfig).some(v => String(v).startsWith("PASTE"));
let ctx;   // {db, user, isOwner}
let starting;

function overlay(html) {
  let el = document.getElementById("fb-gate");
  if (!el) {
    el = document.createElement("div"); el.id = "fb-gate";
    el.style.cssText = "position:fixed;inset:0;z-index:999;background:#F2F0FA;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Anuphan,sans-serif;color:#2E2A47;text-align:center";
    document.body.appendChild(el);
  }
  el.innerHTML = `<div style="max-width:320px;display:flex;flex-direction:column;gap:16px;align-items:center">${html}</div>`;
  return el;
}
const hide = () => { const e = document.getElementById("fb-gate"); if (e) e.remove(); };
const btn = "border:0;border-radius:999px;padding:14px 22px;font:600 16px Anuphan,sans-serif;background:#C9C2F4;color:#2E2763;cursor:pointer";

async function start() {
  if (!configured) { overlay(`<h2 style="margin:0">ยังไม่ได้ตั้งค่า Firebase</h2><p>เปิดไฟล์ firebase-config.js แล้ววางค่าจาก Firebase Console</p>`); return new Promise(() => {}); }
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache() });
  const user = await new Promise(res => { const off = onAuthStateChanged(auth, x => { off(); res(x); }); });
  let u = user, lastErr = "";
  while (!u) {
    u = await new Promise(res => {
      const hint = lastErr.includes("unauthorized-domain") ? "โดเมนนี้ยังไม่ได้เพิ่มใน Firebase → Authentication → Settings → Authorized domains: " + location.hostname
        : lastErr.includes("popup-closed") ? "หน้าต่างล็อกอินถูกปิดก่อนเสร็จ ลองอีกครั้ง" : lastErr;
      overlay(`<h2 style="margin:0">บัญชีร้าน US → ไทย</h2>${hint ? `<p style="margin:0;color:#B8473F;font-size:14px">${hint}<br><small>${lastErr}</small></p>` : ""}<button id="fb-in" style="${btn}">เข้าสู่ระบบด้วย Google</button>`);
      document.getElementById("fb-in").onclick = async () => {
        const prov = new GoogleAuthProvider();
        try { res((await signInWithPopup(auth, prov)).user); }
        catch (e) { console.error(e); lastErr = e.code === "auth/popup-blocked" ? "เบราว์เซอร์บล็อกหน้าต่างล็อกอิน กรุณาอนุญาต pop-up ของเว็บนี้แล้วกดใหม่" : (e.code || String(e)); res(null); }
      };
    });
  }
  const email = (u.email || "").toLowerCase();
  const isOwner = email === OWNER_EMAIL.toLowerCase();
  if (!isOwner) {
    const ok = (await getDoc(doc(db, "sellers", email))).exists();
    if (!ok) {
      overlay(`<h2 style="margin:0">ยังไม่ได้รับอนุญาต</h2><p>บัญชี ${email} ยังไม่ได้ถูกเพิ่มเป็นคนขาย ส่งอีเมลนี้ให้เจ้าของร้านเพิ่มให้</p><button id="fb-out" style="${btn}">ออกจากระบบ</button>`);
      document.getElementById("fb-out").onclick = async () => { await signOut(auth); location.reload(); };
      return new Promise(() => {});
    }
  }
  hide();
  // product photos live in Firestore as small data URLs (no Storage plan needed)
  window.__photos = {};
  onSnapshot(collection(db, "photos"), s => { s.docs.forEach(d => (window.__photos[d.id] = d.data().img)); if (typeof render === "function") render(); });
  return { db, user: u, isOwner };
}
const ready = () => (starting = starting || start().then(c => (ctx = c)));

const wrapSnap = s => ({ metadata: s.metadata, docs: s.docs.map(d => ({ id: d.id, data: () => d.data() })) });
const wrapRef = ref => ({
  id: ref.id,
  async get() { const d = await getDoc(ref); return { exists: d.exists(), id: d.id, data: () => d.data() }; },
  set: v => setDoc(ref, v), update: v => updateDoc(ref, v), delete: () => deleteDoc(ref),
});

async function shrinkPhoto(blob) {
  const bmp = await createImageBitmap(blob);
  let max = 1000, q = 0.72, out = "";
  for (let i = 0; i < 8; i++) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    out = c.toDataURL("image/jpeg", q);
    if (out.length < 400000) return out;
    q = Math.max(0.4, q - 0.08); max = Math.round(max * 0.85);
  }
  throw { code: "quota_exceeded" };
}

export async function use(name) {
  const c = await ready();
  if (name === "db") return {
    collection: n => ({
      doc: id => wrapRef(id ? doc(c.db, n, id) : doc(collection(c.db, n))),
      add: async v => wrapRef(await addDoc(collection(c.db, n), v)),
      onSnapshot: (cb, err) => onSnapshot(collection(c.db, n), { includeMetadataChanges: true }, s => cb(wrapSnap(s)), err),
    }),
  };
  if (name === "user") return { isOwner: async () => c.isOwner, id: async () => c.user.uid };
  if (name === "assets") return c.isOwner ? {
    upload: async blob => {
      const img = await shrinkPhoto(blob), ref = doc(collection(c.db, "photos"));
      await setDoc(ref, { img, at: Date.now() }); window.__photos[ref.id] = img; return { id: ref.id };
    },
  } : null;
  return null;
}
