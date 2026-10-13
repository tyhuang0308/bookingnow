/* 預約後台 */
(function () {
'use strict';
const { $, esc, fmt, dLabel, today, color, num, WD, ORDER, COLORS, toMin } = U;
const store = U.createStore(true);
const S = {
  user: undefined, isAdmin: null, data: null, unsub: null, loadErr: '',
  atab: 'staff', editingId: null, draft: null, confirm: null, filter: 'all'
};
const aStaff = () => ((S.data && S.data.staff) || []).filter(s => s.name).sort((a, b) => num(a.order, 0) - num(b.order, 0));
const GLOGO = '<svg class="gmark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

/* ---------- 外框 ---------- */
function renderTop() {
  const nav = $('topnav');
  if (S.user && S.isAdmin) {
    nav.innerHTML = `<span class="me">${esc(S.user.email)}</span><a class="btn ghost small" href="./" target="_blank" rel="noopener">開啟家長預約頁面</a><button type="button" class="btn ghost small" data-act="logout">登出</button>`;
  } else if (S.user) {
    nav.innerHTML = `<button type="button" class="btn ghost small" data-act="logout">登出</button>`;
  } else nav.innerHTML = '';
  const b = $('banner');
  if (U.isDemo) { b.hidden = false; b.innerHTML = '<b>預覽模式</b>：還沒填入Firebase設定，按「使用Google帳號登入」會直接以範例帳號進入。資料只存在這個瀏覽器，可以和 <a href="./">家長預約頁面</a> 互相看到'; }
  else b.hidden = true;
}

function render() {
  renderTop();
  const root = $('root');
  if (S.user === undefined) { root.innerHTML = '<p class="hint">載入中…</p>'; return; }
  if (!S.user) {
    root.innerHTML = `<div class="panel login">
      <h2>研究人員登入</h2>
      <p class="hint">使用你的Google帳號登入。只有被加入「研究人員帳號」名單的帳號可以進入後台</p>
      <div><button type="button" class="btn ghost" data-act="login">${GLOGO}使用 Google 帳號登入</button></div>
      <p class="err" id="a-err" role="alert">${esc(S.loadErr)}</p></div>`;
    return;
  }
  if (S.isAdmin === null) { root.innerHTML = '<p class="hint">確認權限中…</p>'; return; }
  if (!S.isAdmin) {
    root.innerHTML = `<div class="panel login">
      <h2>這個帳號還不能使用後台</h2>
      <p>你目前登入的是 <b class="mono">${esc(S.user.email)}</b>。</p>
      <p class="hint">請已經能登入後台的研究人員，到「研究人員帳號」把這個Email加入，再重新整理這一頁面</p>
      <div><button type="button" class="btn ghost" data-act="logout">登出，換一個帳號</button></div></div>`;
    return;
  }
  if (!S.data) { root.innerHTML = S.loadErr ? `<div class="notice"><p>無法載入資料：${esc(S.loadErr)}</p></div>` : '<p class="hint">載入資料中…</p>'; return; }
  const tab = (v, label) => `<button type="button" role="tab" data-act="atab" data-v="${v}" aria-selected="${S.atab === v}">${label}</button>`;
  root.innerHTML = `<div class="tabs" role="tablist">${tab('staff', '研究人員與時段')}${tab('bookings', '預約紀錄')}${tab('accounts', '研究人員帳號')}</div>
    <div class="tabgap"></div>
    <div id="a-staff" class="admin-grid" ${S.atab === 'staff' ? '' : 'hidden'}><aside class="panel" id="a-list"></aside><section class="panel" id="a-editor"></section></div>
    <div id="a-bookings" class="panel" ${S.atab === 'bookings' ? '' : 'hidden'}></div>
    <div id="a-accounts" class="panel" ${S.atab === 'accounts' ? '' : 'hidden'}></div>`;
  if (S.atab === 'staff') { renderStaffList(); renderEditor(); }
  if (S.atab === 'bookings') renderBookings();
  if (S.atab === 'accounts') renderAccounts();
}

/* 資料更新時只重畫不會打斷編輯的部分 */
function onData() {
  if (!$('a-staff')) { render(); return; }
  renderTop();
  if (S.atab === 'staff') { renderStaffList(); if (!S.draft) renderEditor(); }
  if (S.atab === 'bookings') renderBookings();
  if (S.atab === 'accounts') renderAccounts();
}

/* ---------- 研究人員與時段 ---------- */
/** 開放預約到哪一天（舊資料只有「未來幾天」時換算成日期） */
function untilOf(s) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.bookUntil || '')) return s.bookUntil;
  return U.addDays(today(), Math.min(90, Math.max(1, num(s.advanceDays, 30))) - 1);
}
function shortDate(s) { const d = U.parseD(s); return (d.getMonth() + 1) + '/' + d.getDate(); }
function staffMeta(s) {
  const days = ORDER.filter(d => (s.weekly && s.weekly[d] || []).length).map(d => WD[d]).join('');
  const until = untilOf(s);
  return `${num(s.duration, 60)} 分 · ${days ? '週' + days : '尚未設定時段'} · ${until < today() ? '已停止開放' : '開放至 ' + shortDate(until)}`;
}
function renderStaffList() {
  const el = $('a-list'); if (!el) return;
  el.innerHTML = `<button type="button" class="btn primary" style="width:100%" data-act="ed-new">＋ 新增研究人員</button>
  <div class="slist">${aStaff().map(s => `<button type="button" class="sitem" data-act="ed-open" data-id="${esc(s.id)}" aria-current="${s.id === S.editingId}">
    <span class="dot" style="background:${color(s.color)}"></span><span class="nm">${esc(s.name)}${s.active === false ? '<span class="tag">暫停</span>' : ''}</span><span class="mt">${esc(staffMeta(s))}</span></button>`).join('') || '<p class="hint" style="padding:8px 4px">還沒有人員。</p>'}</div>`;
}
function blankDraft() {
  const used = aStaff().map(s => s.color), wk = () => [{ s: '09:00', e: '12:00' }, { s: '14:00', e: '18:00' }];
  return { name: '', role: '', color: COLORS.find(c => !used.includes(c)) || COLORS[0], duration: 60, buffer: 0, bookUntil: U.addDays(today(), 29), notice: 2, active: true,
    weekly: { 1: wk(), 2: wk(), 3: wk(), 4: wk(), 5: wk(), 6: [], 0: [] }, closedDates: [], calEmail: '' };
}
function cloneStaff(s) {
  const w = {}; for (const d of ORDER) w[d] = ((s.weekly && s.weekly[d]) || []).map(r => ({ s: r.s, e: r.e }));
  return { name: s.name || '', role: s.role || '', color: color(s.color), duration: num(s.duration, 60), buffer: num(s.buffer, 0), bookUntil: untilOf(s), notice: num(s.notice, 0), active: s.active !== false, weekly: w, closedDates: (s.closedDates || []).slice(), calEmail: (S.data && S.data.calendars && S.data.calendars[s.id]) || '' };
}
function renderEditor() {
  const el = $('a-editor'), d = S.draft; if (!el) return;
  if (!d) {
    el.innerHTML = aStaff().length
      ? '<div class="empty"><h2>選擇一位研究人員</h2><p>從左側清單點選研究人員，就能修改其每週開放的時段、時長和休假日</p></div>'
      : '<div class="empty"><h2>新增第一位研究人員</h2><p>每位研究人員都有自己的每週可預約時段、時長與休假日</p><button type="button" class="btn primary" data-act="ed-new">＋ 新增研究人員</button></div>';
    return;
  }
  const editing = !!S.editingId, t = today();
  const fut = editing ? (S.data.bookings || []).filter(b => b.staffId === S.editingId && b.status === 'booked' && b.date >= t).length : 0;
  el.innerHTML = `<form id="ed-form" class="editor" novalidate>
    <h2>${editing ? '編輯 ' + esc(d.name || '研究人員') : '新增研究人員'}</h2>
    <div class="g2">
      <label class="field"><span>姓名</span><input type="text" id="f-name" maxlength="40" value="${esc(d.name)}"></label>
      <label class="field"><span>職稱／說明</span><input type="text" id="f-role" maxlength="60" value="${esc(d.role)}"></label>
    </div>
    <label class="field"><span>Google行事曆ID（選填，家長預約後會自動加入這個行事曆）</span>
      <input type="text" id="f-cal" list="cal-opts" maxlength="200" value="${esc(d.calEmail || '')}" placeholder="researcher@gmail.com" autocomplete="off" spellcheck="false" ${S.data.calendarsUnavailable ? 'disabled' : ''}>
      <datalist id="cal-opts">${(S.data.admins || []).map(e => `<option value="${esc(e)}"></option>`).join('')}</datalist></label>
    <p class="hint">主要行事曆請填Gmail；其他行事曆請到Google日曆「設定」→ 點選該行事曆 →「整合日曆」，複製「日曆ID」。研究人員需先把這個行事曆共用給網站擁有者，權限選「變更活動」</p>
    ${S.data.calendarsUnavailable ? '<p class="warn">要設定行事曆帳號，請先依說明更新Firebase的資料庫安全規則</p>' : ''}
    <fieldset class="field"><legend>代表色</legend><div class="swatches">${COLORS.map((c, i) => `<label><input type="radio" name="f-color" id="f-color-${i}" value="${c}" ${c === d.color ? 'checked' : ''} aria-label="顏色 ${i + 1}"><span style="background:${c}"></span></label>`).join('')}</div></fieldset>
    <div>
      <div class="g4">
        <label class="field"><span>每段時長</span><span class="unit"><input type="number" id="f-dur" min="5" max="480" step="5" value="${d.duration}"><em>分鐘</em></span></label>
        <label class="field"><span>段與段間隔</span><span class="unit"><input type="number" id="f-buf" min="0" max="240" step="5" value="${d.buffer}"><em>分鐘</em></span></label>
        <label class="field"><span>開放預約到</span><input type="date" id="f-until" min="${t}" value="${esc(d.bookUntil || '')}"></label>
        <label class="field"><span>最晚需提前</span><span class="unit"><input type="number" id="f-notice" min="0" max="168" value="${d.notice}"><em>小時</em></span></label>
      </div>
      <div class="quick" style="margin-top:8px">常用時長：${[30, 40, 45, 50, 60, 90].map(v => `<button type="button" class="chip" data-act="ed-dur" data-v="${v}" aria-pressed="${d.duration === v}">${v}</button>`).join('')}</div>
    </div>
    <label class="switch"><input type="checkbox" id="f-active" ${d.active ? 'checked' : ''}> 開放家長預約這位研究人員</label>
    <section><h3>每週開放時段</h3><div class="week">${ORDER.map(day => {
      const rs = d.weekly[day] || [], on = rs.length > 0;
      return `<div class="wrow ${on ? '' : 'off'}"><label class="wday"><input type="checkbox" class="day-on" id="f-day-${day}" data-day="${day}" ${on ? 'checked' : ''}>週${WD[day]}</label><div class="ranges">${on ? rs.map((r, i) => `<div class="range"><input type="time" id="f-r-${day}-${i}-s" data-day="${day}" data-k="s" step="300" value="${esc(r.s)}" aria-label="週${WD[day]}第 ${i + 1} 段開始"><span>–</span><input type="time" id="f-r-${day}-${i}-e" data-day="${day}" data-k="e" step="300" value="${esc(r.e)}" aria-label="週${WD[day]}第 ${i + 1} 段結束"><button type="button" class="icon" data-act="ed-del-range" data-day="${day}" data-i="${i}" aria-label="刪除這段">×</button></div>`).join('') + `<button type="button" class="linkbtn" data-act="ed-add-range" data-day="${day}">＋ 加一段</button>` : '<span class="hint">不開放</span>'}</div></div>`;
    }).join('')}</div></section>
    <section><h3>休假日</h3><div class="closed-row"><input type="date" id="f-closed-new" min="${t}"><button type="button" class="btn ghost small" data-act="ed-add-closed">加入休假日</button></div>
      <div class="chips">${d.closedDates.length ? d.closedDates.slice().sort().map(c => `<span class="cchip">${dLabel(c)}<button type="button" data-act="ed-del-closed" data-v="${esc(c)}" aria-label="移除 ${dLabel(c)}">×</button></span>`).join('') : '<span class="hint">沒有設定休假日。休假日當天不會開放預約。</span>'}</div></section>
    <section><h3>時段預覽</h3><div id="ed-preview"></div></section>
    <p class="err" id="ed-err" role="alert"></p>
    <div class="actions">
      <button type="submit" class="btn primary" id="ed-save">儲存</button>
      <button type="button" class="btn ghost" data-act="ed-close">取消</button>
      <span class="sp"></span>
      ${editing ? (S.confirm === 'del-staff'
        ? `<span class="confirm">${fut ? '這位人員還有 ' + fut + ' 筆未來預約，刪除後家長看不到他，但預約紀錄會保留。' : ''}確定刪除？<button type="button" class="btn danger small" data-act="ed-delete">刪除</button><button type="button" class="btn ghost small" data-act="confirm-no">保留</button></span>`
        : '<button type="button" class="btn ghost small" data-act="ask" data-k="del-staff">刪除這位人員</button>') : ''}
    </div>
  </form>`;
  updatePreview();
}
function readEditor() {
  const d = S.draft; if (!d || !$('f-name')) return;
  d.name = $('f-name').value; d.role = $('f-role').value; d.calEmail = $('f-cal').value.trim().toLowerCase(); d.bookUntil = $('f-until').value;
  const c = document.querySelector('input[name="f-color"]:checked'); if (c) d.color = c.value;
  d.duration = num($('f-dur').value, 0); d.buffer = num($('f-buf').value, 0); d.notice = num($('f-notice').value, 0);
  d.active = $('f-active').checked;
  for (const day of ORDER) {
    if (!$('f-day-' + day).checked) { d.weekly[day] = []; continue; }
    const ss = [...document.querySelectorAll(`#ed-form input[data-day="${day}"][data-k="s"]`)], es = [...document.querySelectorAll(`#ed-form input[data-day="${day}"][data-k="e"]`)];
    d.weekly[day] = ss.map((s, i) => ({ s: s.value, e: es[i] ? es[i].value : '' }));
  }
}
function problems(d) {
  const out = [];
  if (!(d.duration >= 5 && d.duration <= 480)) out.push('每段時長請填5到480分鐘');
  for (const day of ORDER) (d.weekly[day] || []).forEach((r, i) => {
    const s = toMin(r.s), e = toMin(r.e);
    if (isNaN(s) || isNaN(e)) out.push(`週${WD[day]}第${i + 1}段的時間還沒填完整`);
    else if (e <= s) out.push(`週${WD[day]}第${i + 1}段的結束時間要晚於開始時間`);
    else if (d.duration >= 5 && e - s < d.duration) out.push(`週${WD[day]}第${i + 1}段（${r.s}–${r.e}）比一段時長還短，排不進任何時段`);
  });
  return out;
}
function updatePreview() {
  const el = $('ed-preview'), d = S.draft; if (!el || !d) return;
  const probs = problems(d), per = ORDER.map(day => ({ day, sl: d.duration >= 5 ? U.daySlots(d, day) : [] }));
  const total = per.reduce((a, p) => a + p.sl.length, 0);
  let lo = 24 * 60, hi = 0; per.forEach(p => p.sl.forEach(x => { lo = Math.min(lo, x.start); hi = Math.max(hi, x.end); }));
  if (hi <= lo) { lo = 8 * 60; hi = 18 * 60; }
  lo = Math.floor(lo / 60) * 60; hi = Math.ceil(hi / 60) * 60;
  const span = hi - lo, stepH = span > 600 ? 3 : span > 360 ? 2 : 1;
  let axis = ''; for (let h = lo; h <= hi; h += stepH * 60) axis += `<span style="left:${(h - lo) / span * 100}%">${fmt(h)}</span>`;
  const col = color(d.color);
  el.innerHTML = `<p class="wk-total">每週共 <b>${total}</b> 個可預約時段 · 每段 ${d.duration || '—'} 分鐘${d.buffer ? `，段間隔 ${d.buffer} 分鐘` : ''}</p>
  <div class="wk"><div class="wk-row"><span></span><div class="axis">${axis}</div><span></span></div>
  ${per.map(p => `<div class="wk-row"><span class="lb">週${WD[p.day]}</span><div class="track">${p.sl.map(x => `<span class="blk" title="${fmt(x.start)}–${fmt(x.end)}" style="left:${(x.start - lo) / span * 100}%;width:calc(${(x.end - x.start) / span * 100}% - 2px);background:${col}"></span>`).join('')}</div><span class="ct">${p.sl.length || '—'}</span></div>`).join('')}</div>
  ${probs.map(p => `<p class="warn">${esc(p)}</p>`).join('')}`;
  document.querySelectorAll('[data-act="ed-dur"]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === d.duration)));
}
async function saveStaff() {
  readEditor(); const d = S.draft, err = $('ed-err');
  const name = d.name.trim();
  if (!name) { err.textContent = '請填寫研究人員姓名。'; $('f-name').focus(); return; }
  const probs = problems(d).filter(p => !p.includes('排不進'));
  if (probs.length) { err.textContent = probs[0]; return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.bookUntil || '')) { err.textContent = '請選擇開放預約到哪一天'; $('f-until').focus(); return; }
  if (d.bookUntil < today()) { err.textContent = '開放預約的日期不能早於今天'; $('f-until').focus(); return; }
  if (d.bookUntil > U.addDays(today(), 730)) { err.textContent = '開放預約的日期最多只能設定到兩年內'; $('f-until').focus(); return; }
  if (d.calEmail && !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(d.calEmail)) { err.textContent = 'Google行事曆ID格式不正確，請填Gmail或從Google日曆設定複製的日曆ID'; $('f-cal').focus(); return; }
  const id = S.editingId || U.rid();
  const ex = aStaff().find(s => s.id === id);
  const weekly = {};
  for (const day of ORDER) weekly[day] = (d.weekly[day] || []).filter(r => toMin(r.s) < toMin(r.e)).map(r => ({ s: r.s, e: r.e })).sort((a, b) => toMin(a.s) - toMin(b.s));
  const data = {
    name, role: d.role.trim().slice(0, 60), color: color(d.color),
    duration: Math.round(d.duration), buffer: Math.max(0, Math.round(d.buffer)),
    bookUntil: d.bookUntil, notice: Math.max(0, Math.round(d.notice)),
    active: !!d.active, weekly, closedDates: d.closedDates.filter(c => c >= today()).sort(),
    order: ex ? num(ex.order, Date.now()) : Date.now(), updatedAt: Date.now()
  };
  const btn = $('ed-save'); btn.disabled = true; btn.textContent = '儲存中…';
  try {
    await store.saveStaff(id, data);
    const calEmail = d.calEmail || '';
    if (!S.data.calendarsUnavailable && calEmail !== ((S.data.calendars || {})[id] || '')) await store.saveCalendar(id, calEmail);
    S.editingId = id; S.draft = Object.assign(cloneStaff(data), { calEmail }); S.confirm = null; U.toast('已儲存 ' + name);
    renderStaffList(); renderEditor();
  } catch (e) { btn.disabled = false; btn.textContent = '儲存'; err.textContent = U.errMsg(e); }
}

/* ---------- 預約紀錄 ---------- */
function upcoming() { const t = today(); return (S.data.bookings || []).filter(b => b.status === 'booked' && b.date >= t); }
function renderBookings() {
  const el = $('a-bookings'); if (!el) return;
  const t = today(), all = upcoming(), todayN = all.filter(b => b.date === t).length;
  let rows = S.filter === 'all' ? all : all.filter(b => b.staffId === S.filter);
  rows = rows.slice().sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const opts = aStaff().map(s => `<option value="${esc(s.id)}" ${S.filter === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  let html = `<div class="bk-head"><p class="stat">今天 <b>${todayN}</b> 筆 · 即將到來共 <b>${all.length}</b> 筆</p>
    <div class="topnav"><label class="field" style="flex-direction:row;align-items:center;gap:8px"><span>顯示</span><select id="a-filter"><option value="all">全部人員</option>${opts}</select></label>
    <button type="button" class="btn ghost small" data-act="export">匯出 CSV</button></div></div>`;
  if (!rows.length) html += '<div class="empty"><p>目前沒有即將到來的預約。家長完成預約後會立刻出現在這裡，不需要重新整理</p></div>';
  else {
    const groups = {}; rows.forEach(x => (groups[x.date] = groups[x.date] || []).push(x));
    for (const date of Object.keys(groups)) {
      html += `<div class="bk-day"><h3>${dLabel(date)}${date === t ? ' · 今天' : ''}</h3><div class="tw"><table><tbody>`;
      for (const b of groups[date]) {
        const st = aStaff().find(s => s.id === b.staffId), k = 'bk:' + b.id;
        html += `<tr><td class="tm">${fmt(b.start)}–${fmt(b.end)}</td><td class="st"><span class="dot" style="background:${color(st && st.color)}"></span> ${esc(st ? st.name : b.staffName)}</td>
          <td><b>${esc(b.name)}</b><div class="nt">${esc(b.phone)}${b.email ? '<br>' + esc(b.email) : ''}</div></td>
          <td>${b.note ? `<div class="nt">${esc(b.note)}</div>` : ''}<div class="nt mono">${esc(b.code || '')}</div>${b.calendarEventId ? '<div class="nt">已加入行事曆</div>' : (b.calendarError === 'no-access' ? '<div class="nt warn">行事曆未同步：請確認研究人員已共用行事曆</div>' : '')}</td>
          <td class="ac">${S.confirm === k
            ? `<span class="confirm">取消這筆？<button type="button" class="btn danger small" data-act="bk-cancel" data-id="${esc(b.id)}">確定取消</button><button type="button" class="btn ghost small" data-act="confirm-no">保留</button></span>`
            : `<button type="button" class="btn ghost small" data-act="ask" data-k="${esc(k)}">取消預約</button>`}</td></tr>`;
      }
      html += '</tbody></table></div></div>';
    }
  }
  el.innerHTML = html;
}
function exportCSV() {
  const list = (S.data.bookings || []).slice().sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const head = ['日期', '開始', '結束', '研究人員', '孩子姓名', '電話', 'Email', '備註', '狀態', '預約代碼'];
  const lines = [head.map(q).join(',')].concat(list.map(b => [b.date, fmt(b.start), fmt(b.end), b.staffName, b.name, b.phone, b.email, b.note, b.status === 'booked' ? '已預約' : '已取消', b.code].map(q).join(',')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = '預約紀錄-' + today() + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  U.toast('已匯出 ' + list.length + ' 筆（最近兩週起的紀錄）');
}

/* ---------- 研究人員帳號 ---------- */
function renderAccounts() {
  const el = $('a-accounts'); if (!el) return;
  const list = (S.data.admins || []).slice().sort(), me = S.user.email;
  el.innerHTML = `<div class="settings">
    <h2 class="panel-title">研究人員帳號</h2>
    <p class="hint">加入研究人員的Google帳號，即可用其帳號登入這個後台。所有研究人員的權限都相同，可以修改全部的研究人員、時段與預約</p>
    <div class="accts">${list.length ? list.map(em => {
      const k = 'acct:' + em;
      return `<div class="acct"><span class="em">${esc(em)}</span>${em === me ? '<span class="pill ok">你</span>' : ''}
        ${S.confirm === k
          ? `<span class="confirm">${em === me ? '移除後你就不能再進入後台。' : ''}確定移除？<button type="button" class="btn danger small" data-act="acct-del" data-v="${esc(em)}">移除</button><button type="button" class="btn ghost small" data-act="confirm-no">保留</button></span>`
          : `<button type="button" class="btn ghost small" data-act="ask" data-k="${esc(k)}">移除</button>`}</div>`;
    }).join('') : '<p class="hint">還沒有加入其他研究人員</p>'}</div>
    <form id="acct-form" class="addrow" novalidate>
      <label class="field"><span>新增研究人員的Google帳號</span><input type="email" id="acct-new" placeholder="researcher@gmail.com" autocomplete="off"></label>
      <button type="submit" class="btn primary" id="acct-add">加入</button>
    </form>
    <p class="err" id="acct-err" role="alert"></p>
  </div>`;
}
async function saveAdmins(list, okMsg) {
  try { await store.saveAdmins(Array.from(new Set(list)).sort()); U.toast(okMsg); S.confirm = null; }
  catch (e) { U.toast(U.errMsg(e)); }
}

/* ---------- 登入流程 ---------- */
function startData() {
  if (S.unsub) S.unsub();
  S.unsub = store.subscribeAdmin(st => {
    if (!(st.got.staff && st.got.bookings && st.got.admins && st.got.calendars)) return;
    const first = !S.data;
    S.data = { staff: st.staff || [], bookings: st.bookings || [], admins: st.admins || [], calendars: st.calendars || {}, calendarsUnavailable: !!st.calendarsUnavailable };
    if (first) render(); else onData();
  }, err => { S.loadErr = U.errMsg(err); if (!S.data) render(); else U.toast(S.loadErr); });
}
store.onAuth(user => {
  if (S.unsub) { S.unsub(); S.unsub = null; }
  S.user = user; S.data = null; S.isAdmin = null; S.draft = null; S.editingId = null;
  render();
  if (!user) return;
  store.checkAdmin().then(ok => { S.isAdmin = ok; render(); if (ok) startData(); })
    .catch(e => { S.isAdmin = false; S.loadErr = U.errMsg(e); render(); });
});

/* ---------- 事件 ---------- */
function rerenderConfirm() {
  if (S.atab === 'staff') { readEditor(); renderEditor(); }
  else if (S.atab === 'bookings') renderBookings();
  else if (S.atab === 'accounts') renderAccounts();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  switch (b.dataset.act) {
    case 'login':
      b.disabled = true; S.loadErr = '';
      try { await store.signIn(); } catch (err) { S.loadErr = U.errMsg(err); render(); }
      break;
    case 'logout': await store.signOut(); break;
    case 'atab': if (S.atab === 'staff') readEditor(); S.atab = b.dataset.v; S.confirm = null; render(); break;
    case 'ask': S.confirm = b.dataset.k; rerenderConfirm(); break;
    case 'confirm-no': S.confirm = null; rerenderConfirm(); break;
    case 'export': exportCSV(); break;
    case 'bk-cancel': {
      const bk = (S.data.bookings || []).find(x => x.id === b.dataset.id); if (!bk) break;
      b.disabled = true;
      try { await store.cancelBooking(bk); S.confirm = null; U.toast('已取消 ' + dLabel(bk.date) + ' ' + fmt(bk.start) + ' 的預約'); }
      catch (err) { U.toast(U.errMsg(err)); }
      renderBookings(); break;
    }
    case 'acct-del': b.disabled = true; await saveAdmins((S.data.admins || []).filter(x => x !== b.dataset.v), '已移除 ' + b.dataset.v); renderAccounts(); break;
    case 'ed-new': S.editingId = null; S.draft = blankDraft(); S.confirm = null; renderStaffList(); renderEditor(); $('f-name').focus(); break;
    case 'ed-open': {
      const s = aStaff().find(x => x.id === b.dataset.id); if (!s) break;
      S.editingId = s.id; S.draft = cloneStaff(s); S.confirm = null; renderStaffList(); renderEditor();
      if (window.matchMedia('(max-width:820px)').matches) $('a-editor').scrollIntoView({ behavior: 'smooth' });
      break;
    }
    case 'ed-close': S.editingId = null; S.draft = null; S.confirm = null; renderStaffList(); renderEditor(); break;
    case 'ed-dur': readEditor(); S.draft.duration = Number(b.dataset.v); $('f-dur').value = b.dataset.v; updatePreview(); break;
    case 'ed-add-range': {
      readEditor(); const rs = S.draft.weekly[b.dataset.day], last = rs[rs.length - 1];
      const s = last && !isNaN(toMin(last.e)) ? Math.min(toMin(last.e) + 60, 22 * 60) : 9 * 60;
      rs.push({ s: fmt(s), e: fmt(Math.min(s + 180, 23 * 60 + 55)) }); renderEditor(); break;
    }
    case 'ed-del-range': readEditor(); S.draft.weekly[b.dataset.day].splice(Number(b.dataset.i), 1); renderEditor(); break;
    case 'ed-add-closed': { readEditor(); const v = $('f-closed-new').value; if (v && !S.draft.closedDates.includes(v)) S.draft.closedDates.push(v); renderEditor(); break; }
    case 'ed-del-closed': readEditor(); S.draft.closedDates = S.draft.closedDates.filter(c => c !== b.dataset.v); renderEditor(); break;
    case 'ed-delete':
      b.disabled = true;
      try { const delId = S.editingId; await store.deleteStaff(delId); if (!S.data.calendarsUnavailable && (S.data.calendars || {})[delId]) await store.saveCalendar(delId, ''); S.editingId = null; S.draft = null; S.confirm = null; U.toast('已刪除人員'); }
      catch (err) { U.toast(U.errMsg(err)); }
      renderStaffList(); renderEditor(); break;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.classList && t.classList.contains('day-on')) { readEditor(); const d = t.dataset.day; if (t.checked && !S.draft.weekly[d].length) S.draft.weekly[d] = [{ s: '09:00', e: '12:00' }]; renderEditor(); return; }
  if (t.id === 'a-filter') { S.filter = t.value; renderBookings(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.closest && t.closest('#ed-form')) { readEditor(); updatePreview(); $('ed-err').textContent = ''; return; }
  if (t.id === 'acct-new') $('acct-err').textContent = '';
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const id = e.target.id;
  if (id === 'ed-form') saveStaff();
  if (id === 'acct-form') {
    const v = $('acct-new').value.trim().toLowerCase();
    if (!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(v)) { $('acct-err').textContent = '請輸入完整的 Email，例如 researcher@gmail.com'; return; }
    if ((S.data.admins || []).includes(v)) { $('acct-err').textContent = '這個帳號已經在名單裡了。'; return; }
    $('acct-add').disabled = true;
    await saveAdmins((S.data.admins || []).concat(v), '已加入 ' + v);
    renderAccounts();
  }
});

render();
})();
