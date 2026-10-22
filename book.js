/* 家長預約頁 */
(function () {
'use strict';
const { $, esc, fmt, dLabel, today, color, num, WD, ORDER, addDays, parseD } = U;
const store = U.createStore(false);
const S = {
  pub: { staff: [], slots: [], rooms: {} }, loaded: false, loadErr: '',
  sel: { staffId: null, date: null, start: null }, month: null, form: { name: '', round: '', phone: '', email: '', note: '' },
  done: null, busy: false, device: [], found: null, confirm: null, moving: null
};

const activeStaff = () => S.pub.staff.filter(s => s.active !== false && s.name).sort((a, b) => num(a.order, 0) - num(b.order, 0));
const selStaff = () => activeStaff().find(s => s.id === S.sel.staffId) || null;
// 修改預約時，原本這筆預約佔用的時段要視為空的
const pubSlots = () => S.moving ? S.pub.slots.filter(x => x.bookingId !== S.moving.bookingId) : S.pub.slots;
const avail = (st, date) => U.available(st, date, pubSlots(), S.pub.rooms);

/* 這台裝置預約過的代碼 */
function loadDevice() { try { S.device = (JSON.parse(localStorage.getItem('booking-mine') || '[]') || []).filter(b => b && b.code && b.date >= today()); } catch (e) { S.device = []; } }
function saveDevice() { try { localStorage.setItem('booking-mine', JSON.stringify(S.device.slice(-10))); } catch (e) { /* 略過 */ } }

const TITLE = '成大兒童敘事研究預約系統';
const INTRO = '選擇研究人員、日期與時段即可預約';

function renderHeader() {
  $('biz-title').textContent = TITLE;
  $('biz-sub').textContent = INTRO;
  const b = $('banner');
  if (U.isDemo) {
    b.hidden = false;
    b.innerHTML = '<b>預覽模式</b>：還沒填入 Firebase 設定，人員與預約都是範例，只存在這個瀏覽器。後台在另一個網址 <a href="admin.html">admin.html</a>（這行說明只在預覽模式出現，正式網站的家長頁沒有通往後台的連結）';
  } else b.hidden = true;
}

function renderStaffCards() {
  const el = $('b-staff');
  if (S.loadErr && !S.pub.staff.length) { el.innerHTML = `<div class="notice"><p>暫時無法載入預約資料${esc(S.loadErr)}</p><div><button type="button" class="btn ghost small" data-act="reload">重新載入</button></div></div>`; return; }
  if (!S.loaded) { el.innerHTML = '<p class="hint">正在載入可預約的時段…</p>'; return; }
  const list = activeStaff();
  if (S.sel.staffId && !list.some(s => s.id === S.sel.staffId)) S.sel = { staffId: null, date: null, start: null };
  if (!list.length) { el.innerHTML = '<p class="hint">目前沒有開放預約的研究人員</p>'; return; }
  el.innerHTML = list.map(s => `<button type="button" class="staff-card" data-act="pick-staff" data-id="${esc(s.id)}" aria-pressed="${s.id === S.sel.staffId}">
    <span class="dot" style="background:${color(s.color)}"></span><span class="nm">${esc(s.name)}</span>
    ${s.role ? `<span class="rl">${esc(s.role)}</span>` : ''}</button>`).join('');
}

function renderDates() {
  const el = $('b-dates'), st = selStaff();
  if (!st) { el.innerHTML = '<p class="hint">先選擇研究人員</p>'; return; }
  const t = today(), end = /^\d{4}-\d{2}-\d{2}$/.test(st.bookUntil || '')
    ? st.bookUntil
    : addDays(t, Math.min(90, Math.max(1, num(st.advanceDays, 30))) - 1);
  if (end < t) { el.innerHTML = '<p class="hint">這位研究人員目前沒有開放預約的日期</p>'; return; }
  const minM = t.slice(0, 7), maxM = end.slice(0, 7);
  if (!S.month || S.month < minM) S.month = minM;
  if (S.month > maxM) S.month = maxM;
  const [y, m] = S.month.split('-').map(Number);
  const daysIn = new Date(y, m, 0).getDate(), lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  let html = `<p class="caption">可預約 <b>${dLabel(t)}</b> 至 <b>${dLabel(end)}</b></p>
    <div class="monthbar">
      <button type="button" class="arrow" data-act="month" data-n="-1" ${S.month <= minM ? 'disabled' : ''} aria-label="上一個月">‹</button>
      <span class="mname" aria-live="polite">${y} 年 ${m} 月</span>
      <button type="button" class="arrow" data-act="month" data-n="1" ${S.month >= maxM ? 'disabled' : ''} aria-label="下一個月">›</button>
    </div>
    <div class="cal">` + ORDER.map(d => `<div class="wh">${WD[d]}</div>`).join('') + '<div class="out"></div>'.repeat(lead);
  for (let i = 1; i <= daysIn; i++) {
    const d = S.month + '-' + U.pad(i);
    const inRange = d >= t && d <= end;
    const n = inRange ? avail(st, d).filter(x => x.ok).length : 0;
    html += `<button type="button" class="day" data-act="pick-date" data-d="${d}" ${n ? '' : 'disabled'} aria-pressed="${d === S.sel.date}" aria-label="${dLabel(d)}，${n} 個空檔"><span class="dn">${i}</span><span class="dc">${n ? n + ' 段' : (inRange ? '—' : '&nbsp;')}</span></button>`;
  }
  el.innerHTML = html + '</div>';
}

function renderTimes() {
  const el = $('b-times'), st = selStaff(), date = S.sel.date;
  if (!st || !date) { el.innerHTML = '<p class="hint">選擇研究人員與日期後，這裡會列出可預約的時段</p>'; return; }
  const list = avail(st, date).filter(x => !x.past);
  if (S.sel.start != null && !list.some(x => x.ok && x.start === S.sel.start)) {
    S.sel.start = null;
    if (!S.busy) { renderForm(); U.toast('你選的時段剛被別人預約了，請重新選擇'); }
  }
  if (!list.length) { el.innerHTML = `<p class="caption"><b>${dLabel(date)}</b></p><p class="hint">這一天沒有可預約的時段，請換一天</p>`; return; }
  el.innerHTML = `<p class="caption"><b>${dLabel(date)}</b></p><div class="slots">` +
    list.map(x => `<button type="button" class="slot" data-act="pick-time" data-s="${x.start}" ${x.ok ? '' : 'disabled'} aria-pressed="${x.start === S.sel.start}" aria-label="${fmt(x.start)} 開始${x.ok ? '' : '，已被預約'}">${fmt(x.start)}</button>`).join('') + '</div>';
}

function renderForm() {
  const el = $('b-form'), st = selStaff();
  if (S.done) {
    const d = S.done;
    el.innerHTML = `<div class="success" role="status"><h3>${d.moved ? '修改成功' : '預約成功'}</h3>
      ${d.moved && d.from ? `<p class="hint">原本：${esc(d.from.staffName)} ${dLabel(d.from.date)} ${fmt(d.from.start)}</p>` : ''}
      <p>${d.moved ? '新的時段：' : ''}<b>${esc(d.staffName)}</b>　<span class="when">${dLabel(d.date)} ${fmt(d.start)}</span></p>
      <p>預約代碼${d.moved ? '（不變）' : ''}</p><p class="code">${esc(d.code)}</p>
      <p class="hint">請截圖或記下此預約代碼。需要查詢、修改或取消時，可至下方「查詢、修改或取消預約」輸入預約代碼即可</p>
      <div><button type="button" class="btn ghost small" data-act="again">再預約一個時段</button></div></div>`;
    return;
  }
  if (S.moving) {
    if (!st || !S.sel.date || S.sel.start == null) { el.innerHTML = '<p class="hint">選擇新的時段後，按「確認修改」即可，聯絡資料不用重新填寫</p>'; return; }
    el.innerHTML = `<form id="move-form" class="form" novalidate>
      <p class="hint">原本：${esc(S.moving.staffName)} ${dLabel(S.moving.date)} ${fmt(S.moving.start)}</p>
      <div class="summary"><span class="dot" style="background:${color(st.color)}"></span><b>${esc(st.name)}</b><span class="when">${dLabel(S.sel.date)} ${fmt(S.sel.start)}</span></div>
      <p class="err" id="c-err" role="alert"></p>
      <div class="acts" style="justify-content:flex-start"><button type="submit" class="btn primary" id="c-submit">確認修改</button><button type="button" class="btn ghost" data-act="move-cancel">取消修改</button></div>
    </form>`;
    return;
  }
  if (!st || !S.sel.date || S.sel.start == null) {
    el.innerHTML = '<p class="hint">選擇時段後，填寫聯絡資料</p>';
    return;
  }
  el.innerHTML = `<form id="book-form" class="form" novalidate>
    <div class="summary"><span class="dot" style="background:${color(st.color)}"></span><b>${esc(st.name)}</b><span class="when">${dLabel(S.sel.date)} ${fmt(S.sel.start)}</span></div>
    <div class="g2">
      <label class="field"><span>孩子姓名<b class="req" aria-hidden="true">*</b></span><input type="text" id="c-name" data-cf="name" autocomplete="off" maxlength="40" required value="${esc(S.form.name)}"></label>
      <div class="field"><span id="c-round-label">第幾次評估<b class="req" aria-hidden="true">*</b></span>
        <div class="seg" role="radiogroup" aria-labelledby="c-round-label">${[1, 2, 3].map(n => `<label><input type="radio" name="c-round" id="c-round-${n}" data-cf="round" value="${n}" ${String(S.form.round) === String(n) ? 'checked' : ''}><span>第${n}次</span></label>`).join('')}</div></div>
    </div>
    <div class="g2">
      <label class="field"><span>聯絡電話<b class="req" aria-hidden="true">*</b></span><input type="tel" id="c-phone" data-cf="phone" autocomplete="tel" inputmode="tel" maxlength="20" placeholder="0912345678" required value="${esc(S.form.phone)}"></label>
      <label class="field"><span>Email<b class="req" aria-hidden="true">*</b></span><input type="email" id="c-email" data-cf="email" autocomplete="email" maxlength="100" placeholder="name@gmail.com" required value="${esc(S.form.email)}"></label>
    </div>
    <p class="hint"><b class="req">*</b> 為必填</p>
    <p class="err" id="c-err" role="alert"></p>
    <div><button type="submit" class="btn primary" id="c-submit">確認預約</button></div>
  </form>`;
}

/* 台灣手機：09 開頭 10 碼（可輸入 +886 9…、空格或 -），格式正確時回傳 09xxxxxxxx */
function mobile(v) {
  let d = String(v || '').replace(/[\s\-().]/g, '');
  if (/^\+?886/.test(d)) d = '0' + d.replace(/^\+?886/, '');
  return /^09\d{8}$/.test(d) ? d : '';
}
/* 只接受 Gmail 與 Yahoo 信箱 */
const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@(?:gmail\.com|yahoo\.com(?:\.tw)?)$/;

async function submitBooking() {
  const st = selStaff(), err = $('c-err'), btn = $('c-submit');
  const f = { name: S.form.name.trim(), round: Number(S.form.round) || 0, phone: mobile(S.form.phone), email: S.form.email.trim().toLowerCase(), note: '' };
  if (!f.name) { err.textContent = '請填寫孩子姓名。'; $('c-name').focus(); return; }
  if (!(f.round >= 1 && f.round <= 3)) { err.textContent = '請選擇第幾次評估'; $('c-round-1').focus(); return; }
  if (!S.form.phone.trim()) { err.textContent = '請填寫聯絡電話。'; $('c-phone').focus(); return; }
  if (!f.phone) { err.textContent = '聯絡電話格式錯誤，請輸入09開頭的10碼手機號碼，例如0912345678'; $('c-phone').focus(); return; }
  if (!f.email) { err.textContent = '請填寫 Email。'; $('c-email').focus(); return; }
  if (!EMAIL_RE.test(f.email)) { err.textContent = 'Email格式錯誤，請輸入Gmail或Yahoo信箱，例如name@gmail.com、name@yahoo.com.tw'; $('c-email').focus(); return; }
  const sl = st && avail(st, S.sel.date).find(x => x.start === S.sel.start);
  if (!sl || !sl.ok) { err.textContent = '這個時段剛被預約走了，請選擇其他時段。'; renderTimes(); return; }
  err.textContent = ''; btn.disabled = true; btn.textContent = '送出中…'; S.busy = true;
  try {
    const r = await store.book({ staff: st, date: S.sel.date, start: sl.start, end: sl.end, sameDay: S.pub.slots.filter(x => x.date === S.sel.date), name: f.name, round: f.round, phone: f.phone, email: f.email, note: f.note });
    S.busy = false; S.done = r; S.sel.start = null; S.form.note = ''; S.form.round = '';
    S.device.push({ code: r.code, staffName: r.staffName, date: r.date, start: r.start, end: r.end }); saveDevice();
    renderForm(); renderTimes(); renderDates(); renderDevice();
    $('b-form').scrollIntoView({ block: 'center', behavior: 'smooth' });
  } catch (e) {
    S.busy = false; btn.disabled = false; btn.textContent = '確認預約'; err.textContent = U.errMsg(e);
  }
}

/* 查詢與取消 */
function cancelControls(k, act, attrs) {
  return S.confirm === k
    ? `<span class="confirm">確定要取消？<button type="button" class="btn danger small" data-act="${act}" ${attrs}>取消預約</button><button type="button" class="btn ghost small" data-act="confirm-no">保留</button></span>`
    : `<span class="acts"><button type="button" class="btn ghost small" data-act="move" ${attrs}>修改</button><button type="button" class="btn ghost small" data-act="ask" data-k="${esc(k)}">取消預約</button></span>`;
}
function renderMoving() {
  const el = $('b-moving'); if (!el) return;
  const m = S.moving;
  if (!m) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `<div><b>正在修改預約 <span class="mono">${esc(m.code)}</span></b>
    <p class="hint">原本：${esc(m.staffName)} ${dLabel(m.date)} ${fmt(m.start)}。請在下方重新選擇研究人員、日期與時段，再按「確認修改」</p></div>
    <button type="button" class="btn ghost small" data-act="move-cancel">取消修改</button>`;
}
async function startMove(code, btn) {
  if (btn) btn.disabled = true;
  try {
    const t = await store.getTicket(code);
    if (t.status !== 'booked') { U.toast('這筆預約已經取消了，無法修改'); return; }
    if (t.date < today()) { U.toast('這筆預約的日期已經過了，無法修改'); return; }
    S.moving = t; S.done = null; S.confirm = null;
    const ok = activeStaff().some(s => s.id === t.staffId);
    S.sel = { staffId: ok ? t.staffId : null, date: ok ? t.date : null, start: null };
    S.month = t.date.slice(0, 7);
    renderMoving(); renderStaffCards(); renderDates(); renderTimes(); renderForm(); renderDevice(); renderLookup();
    $('b-moving').scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch (e) { U.toast(U.errMsg(e)); }
  finally { if (btn) btn.disabled = false; }
}
function stopMove() {
  S.moving = null; S.sel.start = null;
  renderMoving(); renderDates(); renderTimes(); renderForm();
}
async function submitMove() {
  const st = selStaff(), err = $('c-err'), btn = $('c-submit'), m = S.moving;
  if (st.id === m.staffId && S.sel.date === m.date && S.sel.start === m.start) { err.textContent = '這就是原本的時段，請選擇其他時段'; return; }
  const sl = avail(st, S.sel.date).find(x => x.start === S.sel.start);
  if (!sl || !sl.ok) { err.textContent = '這個時段剛被預約走了，請選擇其他時段。'; renderTimes(); return; }
  err.textContent = ''; btn.disabled = true; btn.textContent = '修改中…'; S.busy = true;
  try {
    const r = await store.moveBooking({ code: m.code, staff: st, date: S.sel.date, start: sl.start, end: sl.end, sameDay: pubSlots().filter(x => x.date === S.sel.date) });
    S.busy = false;
    S.done = Object.assign({}, r, { code: m.code, moved: true, from: { staffName: m.staffName, date: m.date, start: m.start } });
    S.device = S.device.filter(x => x.code !== m.code).concat([{ code: m.code, staffName: r.staffName, date: r.date, start: r.start, end: r.end }]); saveDevice();
    if (S.found && S.found.code === m.code) S.found = Object.assign({}, S.found, r, { code: m.code });
    S.moving = null; S.sel.start = null;
    renderMoving(); renderForm(); renderTimes(); renderDates(); renderDevice(); renderLookup();
    U.toast('已修改預約');
    $('b-form').scrollIntoView({ block: 'center', behavior: 'smooth' });
  } catch (e) {
    S.busy = false; btn.disabled = false; btn.textContent = '確認修改'; err.textContent = U.errMsg(e);
  }
}
function row(b, extra) {
  return `<div class="bitem"><span class="when">${dLabel(b.date)} ${fmt(b.start)}</span><span class="who">${esc(b.staffName)}</span>${extra}</div>`;
}
function renderDevice() {
  const el = $('b-device');
  const list = S.device.filter(b => b.date >= today()).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  if (!list.length) { el.innerHTML = '<p class="hint">輸入預約成功時拿到的預約代碼，即可查看、修改或取消預約</p>'; return; }
  el.innerHTML = '<p class="hint" style="margin-bottom:4px">你在這台裝置上預約的時段：</p><div class="blist">' +
    list.map(b => row(b, `<span class="mono hint">${esc(b.code)}</span>` + cancelControls('dev:' + b.code, 'cancel', `data-code="${esc(b.code)}"`))).join('') +
    '</div><p class="hint" style="margin-top:10px">也可以輸入預約代碼查詢其他預約：</p>';
}
function renderLookup() {
  const el = $('b-lookup'), b = S.found;
  if (!b) { el.innerHTML = ''; return; }
  const pill = b.status === 'booked' ? '' : '<span class="pill no">已取消</span>';
  const canCancel = b.status === 'booked' && b.date >= today();
  el.innerHTML = '<div class="blist">' + row(b, pill + (canCancel ? cancelControls('found', 'cancel', `data-code="${esc(b.code)}"`) : '')) + '</div>';
}
async function cancel(code, btn) {
  btn.disabled = true;
  try {
    await store.cancelByCode(code);
    U.toast('已取消預約 ' + code);
    if (S.moving && S.moving.code === code) stopMove();
    if (S.found && S.found.code === code) S.found.status = 'cancelled';
    S.device = S.device.filter(x => x.code !== code); saveDevice();
  } catch (e) {
    const m = U.errMsg(e); U.toast(m);
    if (m.includes('已經取消')) { S.device = S.device.filter(x => x.code !== code); saveDevice(); }
  }
  S.confirm = null; renderDevice(); renderLookup();
}

/* 事件 */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  switch (b.dataset.act) {
    case 'reload': location.reload(); break;
    case 'pick-staff':
      if (S.sel.staffId !== b.dataset.id) { S.sel = { staffId: b.dataset.id, date: null, start: null }; S.month = null; }
      S.done = null; renderStaffCards(); renderDates(); renderTimes(); renderForm(); break;
    case 'month': {
      const [y, m] = S.month.split('-').map(Number), d = new Date(y, m - 1 + Number(b.dataset.n), 1);
      S.month = d.getFullYear() + '-' + U.pad(d.getMonth() + 1); renderDates(); break;
    }
    case 'pick-date': S.sel.date = b.dataset.d; S.sel.start = null; S.done = null; renderDates(); renderTimes(); renderForm(); break;
    case 'pick-time': {
      S.sel.start = Number(b.dataset.s); S.done = null; renderTimes(); renderForm();
      const n = $('c-name'); if (n && window.matchMedia('(max-width:820px)').matches) n.scrollIntoView({ block: 'center', behavior: 'smooth' });
      break;
    }
    case 'again': S.done = null; renderForm(); break;
    case 'ask': S.confirm = b.dataset.k; renderDevice(); renderLookup(); break;
    case 'confirm-no': S.confirm = null; renderDevice(); renderLookup(); break;
    case 'cancel': cancel(b.dataset.code, b); break;
    case 'move': startMove(b.dataset.code, b); break;
    case 'move-cancel': stopMove(); break;
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.cf) { S.form[t.dataset.cf] = t.value; const er = $('c-err'); if (er) er.textContent = ''; }
  if (t.id === 'l-code') $('l-err').textContent = '';
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.id === 'book-form') submitBooking();
  if (e.target.id === 'move-form') submitMove();
  if (e.target.id === 'lookup-form') {
    const code = $('l-code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), btn = $('l-submit');
    if (code.length !== 8) { $('l-err').textContent = '預約代碼是 8 碼英文與數字，請再確認一次。'; return; }
    btn.disabled = true;
    try { S.found = await store.getTicket(code); S.confirm = null; $('l-err').textContent = ''; }
    catch (err) { S.found = null; $('l-err').textContent = U.errMsg(err); }
    btn.disabled = false; renderLookup();
  }
});

/* 啟動 */
loadDevice();
renderHeader(); renderDevice();
store.subscribePublic(st => {
  S.pub = { staff: st.staff || [], slots: st.slots || [], rooms: st.rooms || {} };
  S.loaded = !!(st.got.staff && st.got.slots && st.got.rooms); S.loadErr = '';
  renderStaffCards(); renderDates(); renderTimes();
  if (!S.done && !S.busy && S.sel.start == null) renderForm();
}, err => { S.loaded = true; S.loadErr = U.errMsg(err); renderStaffCards(); });

// 確認這台裝置記得的預約是否仍有效（例如被研究人員取消）
S.device.forEach(d => {
  store.getTicket(d.code).then(t => {
    if (t.status !== 'booked') { S.device = S.device.filter(x => x.code !== d.code); saveDevice(); renderDevice(); }
  }).catch(err => {
    if (err && /找不到/.test(err.message || '')) { S.device = S.device.filter(x => x.code !== d.code); saveDevice(); renderDevice(); }
  });
});
})();
