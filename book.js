/* 家長預約頁 */
(function () {
'use strict';
const { $, esc, fmt, dLabel, today, color, num, WD, ORDER, addDays, parseD } = U;
const store = U.createStore(false);
const S = {
  pub: { settings: {}, staff: [], slots: [] }, loaded: false, loadErr: '',
  sel: { staffId: null, date: null, start: null }, form: { name: '', phone: '', email: '', note: '' },
  done: null, busy: false, device: [], found: null, confirm: null
};

const activeStaff = () => S.pub.staff.filter(s => s.active !== false && s.name).sort((a, b) => num(a.order, 0) - num(b.order, 0));
const selStaff = () => activeStaff().find(s => s.id === S.sel.staffId) || null;
const avail = (st, date) => U.available(st, date, S.pub.slots);

/* 這台裝置預約過的代碼 */
function loadDevice() { try { S.device = (JSON.parse(localStorage.getItem('booking-mine') || '[]') || []).filter(b => b && b.code && b.date >= today()); } catch (e) { S.device = []; } }
function saveDevice() { try { localStorage.setItem('booking-mine', JSON.stringify(S.device.slice(-10))); } catch (e) { /* 略過 */ } }

function renderHeader() {
  const s = S.pub.settings || {};
  $('biz-title').textContent = s.title || '線上預約';
  if (!U.isDemo) document.title = s.title || '線上預約';
  $('biz-sub').textContent = s.intro || '選擇服務人員、日期與時段，填寫聯絡資料即可完成預約。';
  const b = $('banner');
  if (U.isDemo) {
    b.hidden = false;
    b.innerHTML = '<b>預覽模式</b>：還沒填入 Firebase 設定，人員與預約都是範例，只存在這個瀏覽器。後台在另一個網址 <a href="admin.html">admin.html</a>（這行說明只在預覽模式出現，正式網站的家長頁沒有通往後台的連結）。';
  } else b.hidden = true;
}

function renderStaffCards() {
  const el = $('b-staff');
  if (S.loadErr && !S.pub.staff.length) { el.innerHTML = `<div class="notice"><p>暫時無法載入預約資料。${esc(S.loadErr)}</p><div><button type="button" class="btn ghost small" data-act="reload">重新載入</button></div></div>`; return; }
  if (!S.loaded) { el.innerHTML = '<p class="hint">正在載入可預約的時段…</p>'; return; }
  const list = activeStaff();
  if (S.sel.staffId && !list.some(s => s.id === S.sel.staffId)) S.sel = { staffId: null, date: null, start: null };
  if (!list.length) { el.innerHTML = '<p class="hint">目前沒有開放預約的服務人員。</p>'; return; }
  el.innerHTML = list.map(s => `<button type="button" class="staff-card" data-act="pick-staff" data-id="${esc(s.id)}" aria-pressed="${s.id === S.sel.staffId}">
    <span class="dot" style="background:${color(s.color)}"></span><span class="nm">${esc(s.name)}</span>
    <span class="du">${num(s.duration, 60)}<br>分鐘</span>${s.role ? `<span class="rl">${esc(s.role)}</span>` : ''}</button>`).join('');
}

function renderDates() {
  const el = $('b-dates'), st = selStaff();
  if (!st) { el.innerHTML = '<p class="hint">先選擇服務人員。</p>'; return; }
  const t = today(), adv = Math.min(90, Math.max(1, num(st.advanceDays, 30))), end = addDays(t, adv - 1);
  const first = addDays(t, -((parseD(t).getDay() + 6) % 7)), last = addDays(end, (7 - parseD(end).getDay()) % 7);
  let html = '<p class="caption">可預約 <b>' + dLabel(t) + '</b> 至 <b>' + dLabel(end) + '</b></p><div class="cal">' + ORDER.map(d => `<div class="wh">${WD[d]}</div>`).join('');
  for (let d = first; d <= last; d = addDays(d, 1)) {
    if (d < t || d > end) { html += '<div class="out"></div>'; continue; }
    const n = avail(st, d).filter(x => x.ok).length, dd = parseD(d);
    const lab = (dd.getDate() === 1 || d === t) ? (dd.getMonth() + 1) + '/' + dd.getDate() : dd.getDate();
    html += `<button type="button" class="day" data-act="pick-date" data-d="${d}" ${n ? '' : 'disabled'} aria-pressed="${d === S.sel.date}" aria-label="${dLabel(d)}，${n} 個空檔"><span class="dn">${lab}</span><span class="dc">${n ? n + ' 段' : '—'}</span></button>`;
  }
  el.innerHTML = html + '</div>';
}

function renderTimes() {
  const el = $('b-times'), st = selStaff(), date = S.sel.date;
  if (!st || !date) { el.innerHTML = '<p class="hint">選好人員與日期後，這裡會列出可預約的時段。</p>'; return; }
  const list = avail(st, date).filter(x => !x.past);
  if (S.sel.start != null && !list.some(x => x.ok && x.start === S.sel.start)) {
    S.sel.start = null;
    if (!S.busy) { renderForm(); U.toast('你選的時段剛被別人預約了，請重新選擇。'); }
  }
  if (!list.length) { el.innerHTML = `<p class="caption"><b>${dLabel(date)}</b></p><p class="hint">這一天沒有可預約的時段，請換一天。</p>`; return; }
  const open = list.filter(x => x.ok).length;
  el.innerHTML = `<p class="caption"><b>${dLabel(date)}</b> · 每段 ${num(st.duration, 60)} 分鐘 · 尚有 ${open} 段空檔</p><div class="slots">` +
    list.map(x => `<button type="button" class="slot" data-act="pick-time" data-s="${x.start}" ${x.ok ? '' : 'disabled'} aria-pressed="${x.start === S.sel.start}" aria-label="${fmt(x.start)} 到 ${fmt(x.end)}${x.ok ? '' : '，已被預約'}"><span class="t">${fmt(x.start)}</span><span class="e">${x.ok ? '至 ' + fmt(x.end) : '已約滿'}</span></button>`).join('') + '</div>';
}

function renderForm() {
  const el = $('b-form'), st = selStaff(), contact = (S.pub.settings || {}).contact;
  if (S.done) {
    const d = S.done;
    el.innerHTML = `<div class="success" role="status"><h3>預約成功</h3>
      <p><b>${esc(d.staffName)}</b>　<span class="when">${dLabel(d.date)} ${fmt(d.start)}–${fmt(d.end)}</span></p>
      <p>預約代碼</p><p class="code">${esc(d.code)}</p>
      <p class="hint">請截圖或記下這組代碼。需要取消時，到下方「查詢或取消預約」輸入代碼即可。</p>
      <div><button type="button" class="btn ghost small" data-act="again">再預約一個時段</button></div></div>`;
    return;
  }
  if (!st || !S.sel.date || S.sel.start == null) {
    el.innerHTML = '<p class="hint">選擇時段後填寫聯絡資料。</p>' + (contact ? `<div class="notice" style="margin-top:12px"><p>有問題可以聯絡我們：</p><p class="contact">${esc(contact)}</p></div>` : '');
    return;
  }
  const end = S.sel.start + num(st.duration, 60);
  el.innerHTML = `<form id="book-form" class="form" novalidate>
    <div class="summary"><span class="dot" style="background:${color(st.color)}"></span><b>${esc(st.name)}</b><span class="when">${dLabel(S.sel.date)} ${fmt(S.sel.start)}–${fmt(end)}</span></div>
    <div class="g2">
      <label class="field"><span>姓名</span><input type="text" id="c-name" data-cf="name" autocomplete="name" maxlength="40" value="${esc(S.form.name)}"></label>
      <label class="field"><span>聯絡電話</span><input type="tel" id="c-phone" data-cf="phone" autocomplete="tel" maxlength="20" value="${esc(S.form.phone)}"></label>
    </div>
    <label class="field"><span>Email（選填）</span><input type="email" id="c-email" data-cf="email" autocomplete="email" maxlength="100" value="${esc(S.form.email)}"></label>
    <label class="field"><span>備註（選填）</span><textarea id="c-note" data-cf="note" maxlength="500" placeholder="想先讓我們知道的事，例如孩子的年齡、想討論的狀況">${esc(S.form.note)}</textarea></label>
    <p class="err" id="c-err" role="alert"></p>
    <div><button type="submit" class="btn primary" id="c-submit">確認預約</button></div>
  </form>`;
}

async function submitBooking() {
  const st = selStaff(), err = $('c-err'), btn = $('c-submit');
  const f = { name: S.form.name.trim(), phone: U.normPhone(S.form.phone), email: S.form.email.trim(), note: S.form.note.trim() };
  if (!f.name) { err.textContent = '請填寫姓名。'; $('c-name').focus(); return; }
  if (!/^[0-9+()#-]{6,20}$/.test(f.phone)) { err.textContent = '請填寫正確的聯絡電話（數字，可含 + 或 -）。'; $('c-phone').focus(); return; }
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) { err.textContent = 'Email 格式看起來不對，不需要可以留空。'; $('c-email').focus(); return; }
  const sl = st && avail(st, S.sel.date).find(x => x.start === S.sel.start);
  if (!sl || !sl.ok) { err.textContent = '這個時段剛被預約走了，請選擇其他時段。'; renderTimes(); return; }
  err.textContent = ''; btn.disabled = true; btn.textContent = '送出中…'; S.busy = true;
  try {
    const r = await store.book({ staff: st, date: S.sel.date, start: sl.start, end: sl.end, name: f.name, phone: f.phone, email: f.email, note: f.note });
    S.busy = false; S.done = r; S.sel.start = null; S.form.note = '';
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
    : `<button type="button" class="btn ghost small" data-act="ask" data-k="${esc(k)}">取消預約</button>`;
}
function row(b, extra) {
  return `<div class="bitem"><span class="when">${dLabel(b.date)} ${fmt(b.start)}–${fmt(b.end)}</span><span class="who">${esc(b.staffName)}</span>${extra}</div>`;
}
function renderDevice() {
  const el = $('b-device');
  const list = S.device.filter(b => b.date >= today()).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  if (!list.length) { el.innerHTML = '<p class="hint">輸入預約成功時拿到的 8 碼預約代碼，就能查看或取消預約。</p>'; return; }
  el.innerHTML = '<p class="hint" style="margin-bottom:4px">你在這台裝置上預約的時段：</p><div class="blist">' +
    list.map(b => row(b, `<span class="mono hint">${esc(b.code)}</span>` + cancelControls('dev:' + b.code, 'cancel', `data-code="${esc(b.code)}"`))).join('') +
    '</div><p class="hint" style="margin-top:10px">也可以輸入代碼查詢其他預約：</p>';
}
function renderLookup() {
  const el = $('b-lookup'), b = S.found;
  if (!b) { el.innerHTML = ''; return; }
  const pill = b.status === 'booked' ? '<span class="pill ok">已預約</span>' : '<span class="pill no">已取消</span>';
  const canCancel = b.status === 'booked' && b.date >= today();
  el.innerHTML = '<div class="blist">' + row(b, pill + (canCancel ? cancelControls('found', 'cancel', `data-code="${esc(b.code)}"`) : '')) + '</div>';
}
async function cancel(code, btn) {
  btn.disabled = true;
  try {
    await store.cancelByCode(code);
    U.toast('已取消預約 ' + code);
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
      if (S.sel.staffId !== b.dataset.id) S.sel = { staffId: b.dataset.id, date: null, start: null };
      S.done = null; renderStaffCards(); renderDates(); renderTimes(); renderForm(); break;
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
  S.pub = { settings: st.settings || {}, staff: st.staff || [], slots: st.slots || [] };
  S.loaded = !!(st.got.staff && st.got.slots); S.loadErr = '';
  renderHeader(); renderStaffCards(); renderDates(); renderTimes();
  if (!S.done && !S.busy && S.sel.start == null) renderForm();
}, err => { S.loaded = true; S.loadErr = U.errMsg(err); renderStaffCards(); });

// 確認這台裝置記得的預約是否仍有效（例如被老師取消）
S.device.forEach(d => {
  store.getTicket(d.code).then(t => {
    if (t.status !== 'booked') { S.device = S.device.filter(x => x.code !== d.code); saveDevice(); renderDevice(); }
  }).catch(err => {
    if (err && /找不到/.test(err.message || '')) { S.device = S.device.filter(x => x.code !== d.code); saveDevice(); renderDevice(); }
  });
});
})();
