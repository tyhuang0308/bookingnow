/* 共用工具與資料存取（家長頁與後台共用） */
(function () {
'use strict';
const CFG = window.BOOKING_CONFIG || {};
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const COLORS = ['#3B5BDB', '#2F9E77', '#D9822B', '#C2417A', '#7A5AF8', '#5C7080'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pad = n => String(n).padStart(2, '0');
const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const rand = (n, chars) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, x => chars[x % chars.length]).join(''); };

const U = {
  WD, ORDER, COLORS, pad, dstr, parseD,
  $: id => document.getElementById(id),
  esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  addDays: (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); },
  toMin: t => { if (!t || !/^\d{1,2}:\d{2}/.test(t)) return NaN; const [h, m] = t.split(':').map(Number); return h * 60 + m; },
  fmt: m => pad(Math.floor(m / 60)) + ':' + pad(m % 60),
  dLabel: s => { const d = parseD(s); return (d.getMonth() + 1) + '/' + d.getDate() + '（' + WD[d.getDay()] + '）'; },
  today: () => dstr(new Date()),
  color: c => /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : COLORS[5],
  num: (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; },
  rid: () => rand(16, 'abcdefghijklmnopqrstuvwxyz0123456789'),
  genCode: () => rand(8, CODE_CHARS),
  normPhone: v => String(v == null ? '' : v).replace(/[\s.]/g, ''),
  slotKey: (staffId, date, start) => staffId + '_' + date + '_' + start
};

/** 某位人員在星期 day 的所有時段（分鐘） */
U.daySlots = function (st, day) {
  const dur = Math.max(5, U.num(st.duration, 60)), buf = Math.max(0, U.num(st.buffer, 0)), out = [];
  for (const r of ((st.weekly && st.weekly[day]) || [])) {
    const s = U.toMin(r.s), e = U.toMin(r.e);
    if (!(s < e)) continue;
    for (let t = s; t + dur <= e; t += dur + buf) out.push({ start: t, end: t + dur });
  }
  return out.sort((a, b) => a.start - b.start);
};

/**
 * 共用場地：[s, e) 這段時間場地是否還有空位。
 * occupied = 當天所有已預約的時段（不分研究人員）；extras = 後台「重新開放」加開的場地時段。
 * 平常只有 1 間場地，每加開一次，該時段就多 1 間。
 */
U.roomFree = function (s, e, occupied, extras) {
  occupied = occupied || []; extras = extras || [];
  const points = [s];
  occupied.forEach(o => { points.push(o.start, o.end); });
  extras.forEach(x => { points.push(x.s, x.e); });
  return points.filter(t => t >= s && t < e).every(t => {
    const used = occupied.filter(o => o.start <= t && t < o.end).length;
    const cap = 1 + extras.filter(x => x.s <= t && t < x.e).length;
    return used < cap;
  });
};

/** 某天的時段與狀態；slots = 已被預約的時段清單（所有研究人員），rooms = 各日期加開的場地 */
U.available = function (st, date, slots, rooms) {
  if ((st.closedDates || []).includes(date)) return [];
  const cutoff = Date.now() + U.num(st.notice, 0) * 3600e3, base = parseD(date).getTime();
  const sameDay = (slots || []).filter(x => x.date === date);
  const mine = sameDay.filter(x => x.staffId === st.id);
  const extras = (rooms && rooms[date] && rooms[date].extra) || [];
  return U.daySlots(st, parseD(date).getDay()).map(sl => {
    const past = base + sl.start * 60000 < cutoff;
    const busy = mine.some(b => sl.start < b.end && b.start < sl.end) || !U.roomFree(sl.start, sl.end, sameDay, extras);
    return Object.assign({}, sl, { past, taken: busy, ok: !past && !busy });
  });
};

let toastTimer;
U.toast = function (msg) {
  const t = U.$('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
};

U.errMsg = function (e) {
  if (!e) return '發生錯誤，請再試一次。';
  if (e.code === 'permission-denied') return '沒有權限執行這個動作，請重新整理頁面後再試一次。';
  if (e.code === 'unavailable' || e.code === 'deadline-exceeded') return '連線不穩定，請檢查網路後再試一次。';
  if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return '登入視窗已關閉，請再按一次登入。';
  if (e.code === 'auth/popup-blocked') return '瀏覽器擋住了登入視窗，請允許此網站開啟彈出式視窗後再試一次。';
  if (e.code === 'auth/unauthorized-domain') return '這個網址還沒加入 Firebase 的「已授權網域」，請依照設定說明加入。';
  if (e.code === 'failed-precondition') return '資料庫還沒建立完成，請確認 Firestore 已建立。';
  return e.message || '發生錯誤，請再試一次。';
};

/** 後台讀取資料的起始日：兩個月前的 1 號（月曆可往回看兩個月） */
U.adminFrom = function () { const d = new Date(); return dstr(new Date(d.getFullYear(), d.getMonth() - 2, 1)); };

U.isDemo = !(CFG.firebase && CFG.firebase.apiKey && CFG.firebase.projectId);

/* ================= Firebase ================= */
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res;
    s.onerror = () => rej(new Error('無法載入 Firebase，請檢查網路後重新整理。'));
    document.head.appendChild(s);
  });
}
async function bootFirebase(needAuth) {
  await loadScript(SDK + 'firebase-app-compat.js');
  await loadScript(SDK + 'firebase-firestore-compat.js');
  if (needAuth) await loadScript(SDK + 'firebase-auth-compat.js');
  if (!firebase.apps.length) firebase.initializeApp(CFG.firebase);
  return { db: firebase.firestore(), auth: needAuth ? firebase.auth() : null, FV: firebase.firestore.FieldValue };
}

function firebaseStore(needAuth) {
  let F = null;
  const ready = bootFirebase(needAuth).then(x => { F = x; return x; });
  const docs = s => s.docs.map(d => Object.assign({}, d.data(), { id: d.id }));
  const S = {};

  S.subscribePublic = function (cb, onErr) {
    const st = { staff: [], slots: [], rooms: {}, got: {} };
    const emit = k => { st.got[k] = true; cb(st); };
    ready.then(() => {
      F.db.collection('staff').onSnapshot(s => { st.staff = docs(s); emit('staff'); }, onErr);
      F.db.collection('slots').where('date', '>=', U.today()).onSnapshot(s => { st.slots = s.docs.map(d => d.data()); emit('slots'); }, onErr);
      F.db.collection('rooms').where('date', '>=', U.today()).onSnapshot(s => { st.rooms = roomsMap(s); emit('rooms'); },
        () => { st.rooms = {}; emit('rooms'); });
    }, onErr);
  };

  S.book = async function (p) {
    await ready;
    const TAKEN = '這個時段剛被預約走了，請選擇其他時段。';
    const st = p.staff, slotKey = U.slotKey(st.id, p.date, p.start);
    const slotRef = F.db.doc('slots/' + slotKey), roomRef = F.db.doc('rooms/' + p.date);
    for (let attempt = 0; attempt < 2; attempt++) {
      const bookingRef = F.db.collection('bookings').doc(), code = U.genCode(), ts = F.FV.serverTimestamp();
      const base = { staffId: st.id, staffName: st.name, date: p.date, start: p.start, end: p.end };
      try {
        // 交易：同一天的預約會依序處理，確保同一時間的場地不會被重複預約
        await F.db.runTransaction(async tx => {
          const roomSnap = await tx.get(roomRef), slotSnap = await tx.get(slotRef);
          if (slotSnap.exists) throw new Error(TAKEN);
          const room = roomSnap.exists ? roomSnap.data() : {};
          const b = Object.assign({}, room.b || {}), extra = room.extra || [];
          const occupied = Object.keys(b).map(k => ({ start: b[k][0], end: b[k][1] }))
            .concat((p.sameDay || []).filter(x => x.bookingId && !b[x.bookingId]));
          if (!U.roomFree(p.start, p.end, occupied, extra)) throw new Error(TAKEN);
          b[bookingRef.id] = [p.start, p.end];
          tx.set(slotRef, { staffId: st.id, date: p.date, start: p.start, end: p.end, bookingId: bookingRef.id, createdAt: ts });
          tx.set(bookingRef, Object.assign({}, base, { name: p.name, phone: p.phone, email: p.email, note: p.note, status: 'booked', code, slotKey, createdAt: ts }));
          tx.set(F.db.doc('tickets/' + code), Object.assign({}, base, { bookingId: bookingRef.id, slotKey, status: 'booked' }));
          tx.set(roomRef, { date: p.date, b, last: bookingRef.id, extra });
        });
        return Object.assign({ code, status: 'booked' }, base);
      } catch (e) {
        if (e && e.message === TAKEN) throw e;
        if (e && e.code === 'aborted') throw new Error('目前預約的人較多，請再按一次「確認預約」。');
        if (!e || e.code !== 'permission-denied') throw e;
        const cur = await slotRef.get().catch(() => null);
        if (cur && cur.exists) throw new Error(TAKEN);
        if (attempt === 1) throw new Error('預約沒有送出成功，請重新整理頁面後再試一次。');
      }
    }
  };

  S.getTicket = async function (code) {
    await ready;
    const t = await F.db.doc('tickets/' + code).get();
    if (!t.exists) throw new Error('找不到這個預約代碼，請確認是否輸入正確。');
    return Object.assign({ code }, t.data());
  };

  S.cancelByCode = async function (code) {
    await ready;
    const tref = F.db.doc('tickets/' + code), t = await tref.get();
    if (!t.exists) throw new Error('找不到這個預約代碼。');
    const d = t.data();
    if (d.status !== 'booked') throw new Error('這筆預約已經取消了。');
    const batch = F.db.batch();
    batch.update(F.db.doc('bookings/' + d.bookingId), { status: 'cancelled', cancelledAt: F.FV.serverTimestamp(), cancelledBy: 'customer', proof: code });
    batch.delete(F.db.doc('slots/' + d.slotKey));
    batch.update(tref, { status: 'cancelled' });
    await releaseRoom(batch, d.date, d.bookingId);
    await batch.commit();
  };

  /* ---- 後台 ---- */
  S.onAuth = cb => { ready.then(() => F.auth.onAuthStateChanged(u => cb(u ? { email: (u.email || '').toLowerCase() } : null)), () => cb(null)); };
  S.signIn = async function () {
    await ready;
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    await F.auth.signInWithPopup(p);
  };
  S.signOut = async () => { await ready; await F.auth.signOut(); };
  S.checkAdmin = async function () {
    await ready;
    try { await F.db.doc('config/admins').get(); return true; }
    catch (e) { if (e.code === 'permission-denied') return false; throw e; }
  };
  S.subscribeAdmin = function (cb, onErr) {
    const st = { staff: [], bookings: [], admins: [], calendars: {}, calendarsUnavailable: false, rooms: {}, got: {} };
    const unsubs = []; let dead = false;
    const emit = k => { st.got[k] = true; cb(st); };
    ready.then(() => {
      if (dead) return;
      unsubs.push(F.db.collection('staff').onSnapshot(s => { st.staff = docs(s); emit('staff'); }, onErr));
      unsubs.push(F.db.collection('bookings').where('date', '>=', U.adminFrom()).onSnapshot(s => { st.bookings = docs(s); emit('bookings'); }, onErr));
      unsubs.push(F.db.collection('rooms').where('date', '>=', U.adminFrom()).onSnapshot(s => { st.rooms = roomsMap(s); emit('rooms'); },
        () => { st.rooms = {}; emit('rooms'); }));
      unsubs.push(F.db.doc('config/admins').onSnapshot(s => { st.admins = (s.exists && s.data().emails) || []; emit('admins'); }, onErr));
      // 研究人員的行事曆帳號（只有後台看得到）；安全規則還沒更新時不影響其他功能
      unsubs.push(F.db.doc('private/calendars').onSnapshot(
        s => { st.calendars = s.exists ? s.data() : {}; st.calendarsUnavailable = false; emit('calendars'); },
        () => { st.calendars = {}; st.calendarsUnavailable = true; emit('calendars'); }));
    });
    return () => { dead = true; unsubs.forEach(f => f()); };
  };
  S.saveStaff = async (id, data) => { await ready; await F.db.doc('staff/' + id).set(data); };
  S.deleteStaff = async id => { await ready; await F.db.doc('staff/' + id).delete(); };
  S.saveAdmins = async emails => { await ready; await F.db.doc('config/admins').set({ emails }); };
  S.saveCalendar = async (staffId, email) => { await ready; await F.db.doc('private/calendars').set({ [staffId]: email || F.FV.delete() }, { merge: true }); };
  S.cancelBooking = async function (b) {
    await ready;
    const batch = F.db.batch();
    batch.update(F.db.doc('bookings/' + b.id), { status: 'cancelled', cancelledAt: F.FV.serverTimestamp(), cancelledBy: 'admin' });
    if (b.code) batch.set(F.db.doc('tickets/' + b.code), { status: 'cancelled' }, { merge: true });
    if (b.slotKey) {
      const sref = F.db.doc('slots/' + b.slotKey), s = await sref.get();
      if (s.exists && s.data().bookingId === b.id) batch.delete(sref);
    }
    await releaseRoom(batch, b.date, b.id);
    await batch.commit();
  };
  /** 重新開放：在 date 的 [s, e) 加開一間場地；unreopen 則取消 */
  S.reopen = async (date, s, e) => { await ready; await F.db.doc('rooms/' + date).set({ date, extra: F.FV.arrayUnion({ s, e }) }, { merge: true }); };
  S.unreopen = async (date, s, e) => { await ready; await F.db.doc('rooms/' + date).update({ extra: F.FV.arrayRemove({ s, e }) }); };

  /** 取消預約時，把它從當天的場地紀錄移除 */
  async function releaseRoom(batch, date, bookingId) {
    const ref = F.db.doc('rooms/' + date);
    const snap = await ref.get().catch(() => null);
    if (snap && snap.exists && snap.data().b && snap.data().b[bookingId]) {
      batch.update(ref, { ['b.' + bookingId]: F.FV.delete(), last: bookingId });
    }
  }
  function roomsMap(s) { const m = {}; s.docs.forEach(d => { m[d.id] = d.data(); }); return m; }
  return S;
}

/* ================= 預覽模式（範例資料，只存在這個瀏覽器） ================= */
function demoStore() {
  const KEY = 'booking-demo-v6';
  const subs = new Set();
  let db = load(), user = null;
  const authSubs = new Set();
  const clone = v => JSON.parse(JSON.stringify(v));
  const later = v => new Promise(r => setTimeout(() => r(v === undefined ? undefined : clone(v)), 250));

  function seed() {
    const wk = () => [{ s: '09:00', e: '12:00' }, { s: '14:00', e: '17:00' }];
    const d = {
      v: 6,
      rooms: {},
      admins: ['teacher.chen@example.com'],
      calendars: { demolin: 'lin.researcher@gmail.com' },
      staff: [
        { id: 'demolin', name: '林老師（範例）', role: '職能治療個別課', color: COLORS[0], duration: 50, buffer: 10, bookUntil: U.addDays(U.today(), 20), notice: 12, active: true, order: 1, weekly: { 1: wk(), 2: wk(), 3: wk(), 4: wk(), 5: wk(), 6: [{ s: '09:00', e: '12:00' }], 0: [] }, closedDates: [] },
        { id: 'demochen', name: '陳老師（範例）', role: '感覺統合團體課', color: COLORS[1], duration: 90, buffer: 30, bookUntil: U.addDays(U.today(), 27), notice: 24, active: true, order: 2, weekly: { 1: [], 2: [{ s: '14:00', e: '18:00' }], 3: [], 4: [{ s: '14:00', e: '18:00' }], 5: [], 6: [{ s: '09:00', e: '13:00' }], 0: [] }, closedDates: [] }
      ],
      bookings: []
    };
    const people = [['王小明家長', '0912000111', '孩子 5 歲，想討論握筆'], ['李媽媽', '0922000222', ''], ['張爸爸', '0933000333', '第一次評估']];
    let day = U.today(), i = 0;
    while (i < 3) {
      day = U.addDays(day, 1);
      const w = parseD(day).getDay(); if (w === 0 || w === 6) continue;
      const start = [9 * 60, 10 * 60, 14 * 60][i];
      d.bookings.push({ id: 'demo' + i, code: ['K7M2QXRA', 'P3RD8NWE', 'H9TW4CJB'][i], staffId: 'demolin', staffName: '林老師（範例）', date: day, start, end: start + 50, name: people[i][0], phone: people[i][1], email: '', note: people[i][2], status: 'booked', slotKey: U.slotKey('demolin', day, start) });
      i++;
    }
    return d;
  }
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.v === 6) return v; } catch (e) { /* 無法使用瀏覽器儲存 */ }
    const s = seed(); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 略過 */ }
    return s;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* 略過 */ }
    subs.forEach(f => setTimeout(f, 0));
  }
  window.addEventListener('storage', e => { if (e.key === KEY) { db = load(); subs.forEach(f => f()); } });
  const slots = () => db.bookings.filter(b => b.status === 'booked' && b.date >= U.today()).map(b => ({ staffId: b.staffId, date: b.date, start: b.start, end: b.end, bookingId: b.id }));
  const rooms = () => db.rooms || {};
  const ticket = b => ({ code: b.code, bookingId: b.id, staffId: b.staffId, staffName: b.staffName, date: b.date, start: b.start, end: b.end, slotKey: b.slotKey, status: b.status });
  const watch = f => { subs.add(f); setTimeout(f, 0); return () => subs.delete(f); };

  const S = {};
  S.subscribePublic = cb => { watch(() => cb(clone({ staff: db.staff, slots: slots(), rooms: rooms(), got: { staff: true, slots: true, rooms: true } }))); };
  S.book = function (p) {
    const st = db.staff.find(s => s.id === p.staff.id && s.active);
    if (!st) return Promise.reject(new Error('找不到這位研究人員。'));
    const sl = U.available(st, p.date, slots(), rooms()).find(x => x.start === p.start);
    if (!sl || !sl.ok) return Promise.reject(new Error('這個時段剛被預約走了，請選擇其他時段。'));
    const b = { id: U.rid(), code: U.genCode(), staffId: st.id, staffName: st.name, date: p.date, start: sl.start, end: sl.end, name: p.name, phone: p.phone, email: p.email, note: p.note, status: 'booked', slotKey: U.slotKey(st.id, p.date, sl.start) };
    db.bookings.push(b); save();
    return later(ticket(b));
  };
  S.getTicket = code => {
    const b = db.bookings.find(x => x.code === code);
    return b ? later(ticket(b)) : Promise.reject(new Error('找不到這個預約代碼，請確認是否輸入正確。'));
  };
  S.cancelByCode = code => {
    const b = db.bookings.find(x => x.code === code);
    if (!b) return Promise.reject(new Error('找不到這個預約代碼。'));
    if (b.status !== 'booked') return Promise.reject(new Error('這筆預約已經取消了。'));
    b.status = 'cancelled'; b.cancelledBy = 'customer'; save(); return later();
  };
  S.onAuth = cb => { authSubs.add(cb); setTimeout(() => cb(user), 0); };
  S.signIn = () => { user = { email: 'you@example.com' }; authSubs.forEach(f => f(user)); return later(); };
  S.signOut = () => { user = null; authSubs.forEach(f => f(null)); return later(); };
  S.checkAdmin = () => later(true);
  S.subscribeAdmin = cb => watch(() => cb(clone({ staff: db.staff, bookings: db.bookings, admins: db.admins, calendars: db.calendars || {}, calendarsUnavailable: false, rooms: rooms(), got: { staff: true, bookings: true, admins: true, calendars: true, rooms: true } })));
  S.saveStaff = (id, data) => { const i = db.staff.findIndex(s => s.id === id); const o = Object.assign({ id }, clone(data)); if (i >= 0) db.staff[i] = o; else db.staff.push(o); save(); return later(); };
  S.deleteStaff = id => { db.staff = db.staff.filter(s => s.id !== id); save(); return later(); };
  S.saveAdmins = emails => { db.admins = emails.slice(); save(); return later(); };
  S.saveCalendar = (staffId, email) => { db.calendars = db.calendars || {}; if (email) db.calendars[staffId] = email; else delete db.calendars[staffId]; save(); return later(); };
  S.cancelBooking = b => { const x = db.bookings.find(y => y.id === b.id); if (x) { x.status = 'cancelled'; x.cancelledBy = 'admin'; } save(); return later(); };
  S.reopen = (date, s, e) => { db.rooms = db.rooms || {}; const r = db.rooms[date] = db.rooms[date] || { extra: [] }; if (!r.extra.some(x => x.s === s && x.e === e)) r.extra.push({ s, e }); save(); return later(); };
  S.unreopen = (date, s, e) => { const r = (db.rooms || {})[date]; if (r) r.extra = r.extra.filter(x => !(x.s === s && x.e === e)); save(); return later(); };
  return S;
}

U.createStore = needAuth => U.isDemo ? demoStore() : firebaseStore(needAuth);
window.U = U;
})();
