/* 預約後台 */
(function () {
'use strict';
const { $, esc, fmt, dLabel, today, color, num, WD, ORDER, COLORS, toMin } = U;
const store = U.createStore(true);
const S = {
  user: undefined, isAdmin: null, data: null, unsub: null, loadErr: '',
  atab: 'staff', editingId: null, draft: null, confirm: null, filter: 'all', bkMonth: null, bkDay: null,
  bkForm: null, bkDone: null, lineCode: null, person: null
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
    <div class="bk-wrap" ${S.atab === 'bookings' ? '' : 'hidden'}><div id="a-bookings" class="panel"></div>
      <!-- 受試者預約進度：點選預約紀錄的某一筆時，在旁邊顯示同一位受試者的所有預約 -->
      <aside id="pp" class="pp" role="dialog" aria-labelledby="pp-title" hidden></aside></div>
    <div id="a-accounts" class="panel" ${S.atab === 'accounts' ? '' : 'hidden'}></div>`;
  if (S.atab === 'staff') { renderStaffList(); renderEditor(); }
  if (S.atab === 'bookings') renderBookings();
  if (S.atab === 'accounts') renderAccounts();
  renderPerson();
}

/* 資料更新時只重畫不會打斷編輯的部分 */
function onData() {
  if (!$('a-staff')) { render(); return; }
  renderTop();
  if (S.atab === 'staff') { renderStaffList(); if (!S.draft) renderEditor(); else if ($('line-st')) $('line-st').innerHTML = lineStatus(S.editingId); }
  if (S.atab === 'bookings') { if (S.bkForm) readBkForm(); renderBookings(); }
  if (S.atab === 'accounts') renderAccounts();
  renderPerson();
}

/* ---------- 研究人員與時段 ---------- */
/** 開放預約到哪一天（舊資料只有「未來幾天」時換算成日期） */
function untilOf(s) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.bookUntil || '')) return s.bookUntil;
  return U.addDays(today(), Math.min(90, Math.max(1, num(s.advanceDays, 30))) - 1);
}
function leaveChips(d) {
  const items = d.closedDates.map(c => ({ d: c, all: true })).concat(d.closedTimes.map(x => Object.assign({ all: false }, x)))
    .sort((a, b) => a.d.localeCompare(b.d) || (a.all ? -1 : b.all ? 1 : toMin(a.s) - toMin(b.s)));
  if (!items.length) return '<span class="hint">沒有設定休假。可以選整天，或只選某幾個小時；休假時間內不會開放預約</span>';
  return items.map(x => x.all
    ? `<span class="cchip">${dLabel(x.d)} 整天<button type="button" data-act="ed-del-closed" data-v="${esc(x.d)}" aria-label="移除 ${dLabel(x.d)} 整天休假">×</button></span>`
    : `<span class="cchip">${dLabel(x.d)} ${esc(x.s)}–${esc(x.e)}<button type="button" data-act="ed-del-closedt" data-d="${esc(x.d)}" data-s="${esc(x.s)}" data-e="${esc(x.e)}" aria-label="移除 ${dLabel(x.d)} ${esc(x.s)} 休假">×</button></span>`).join('');
}
function lineStatus(id) {
  const n = ((S.data.lineStaff || {})[id] || []).length;
  const code = S.lineCode && S.lineCode.staffId === id ? S.lineCode.code : '';
  return `<span>${n ? `已綁定 <b>${n}</b> 個LINE帳號` : '還沒有綁定LINE帳號'}</span>
    <button type="button" class="btn ghost small" data-act="line-bind">${code ? '重新產生綁定碼' : '產生綁定碼'}</button>
    ${n ? (S.confirm === 'line-unbind' ? `<span class="confirm">解除後就收不到通知，確定？<button type="button" class="btn danger small" data-act="line-unbind">解除綁定</button><button type="button" class="btn ghost small" data-act="confirm-no">保留</button></span>` : '<button type="button" class="btn ghost small" data-act="ask" data-k="line-unbind">解除全部綁定</button>') : ''}
    ${code ? `<p class="notice" style="flex-basis:100%">請用要接收通知的LINE帳號，傳送 <b class="mono">綁定 ${esc(code)}</b> 給LINE官方帳號。每組綁定碼只能用一次，24小時內有效；同一位研究人員可以綁定多個LINE帳號</p>` : ''}`;
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
  const used = aStaff().map(s => color(s.color)), wk = () => [{ s: '09:00', e: '12:00' }, { s: '14:00', e: '18:00' }];
  return { name: '', role: '', color: COLORS.find(c => !used.includes(c)) || COLORS[0], duration: 60, buffer: 0, bookUntil: U.addDays(today(), 29), notice: 2, active: true,
    weekly: { 1: wk(), 2: wk(), 3: wk(), 4: wk(), 5: wk(), 6: [], 0: [] }, closedDates: [], closedTimes: [], calEmail: '' };
}
function cloneStaff(s) {
  const w = {}; for (const d of ORDER) w[d] = ((s.weekly && s.weekly[d]) || []).map(r => ({ s: r.s, e: r.e }));
  return { name: s.name || '', role: s.role || '', color: color(s.color), duration: num(s.duration, 60), buffer: num(s.buffer, 0), bookUntil: untilOf(s), notice: num(s.notice, 0), active: s.active !== false, weekly: w, closedDates: (s.closedDates || []).slice(), closedTimes: (s.closedTimes || []).map(x => ({ d: x.d, s: x.s, e: x.e })), calEmail: (S.data && S.data.calendars && S.data.calendars[s.id]) || '' };
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
    <fieldset class="field"><legend>代表色</legend><div class="swatches">${COLORS.map((c, i) => `<label><input type="radio" name="f-color" id="f-color-${i}" value="${c}" ${c === color(d.color) ? 'checked' : ''} aria-label="顏色 ${i + 1}"><span style="background:${c}"></span></label>`).join('')}</div></fieldset>
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
    <section><h3>休假</h3>
      <div class="closed-row">
        <input type="date" id="f-closed-new" min="${t}" aria-label="休假日期">
        <label class="switch"><input type="checkbox" id="f-closed-all" ${S.leaveAll === false ? '' : 'checked'}> 整天</label>
        <span class="range" id="f-closed-times" ${S.leaveAll === false ? '' : 'hidden'}><input type="time" id="f-closed-s" step="300" value="09:00" aria-label="休假開始"><span>–</span><input type="time" id="f-closed-e" step="300" value="12:00" aria-label="休假結束"></span>
        <button type="button" class="btn ghost small" data-act="ed-add-closed">加入休假</button>
      </div>
      <p class="err" id="closed-err" role="alert"></p>
      <div class="chips">${leaveChips(d)}</div></section>
    <section><h3>LINE通知</h3>
      ${editing ? `<p class="hint">有新預約、修改或取消時，傳LINE訊息通知這位研究人員。需先完成說明文件「LINE通知研究人員」的設定</p>
      <div class="line-st" id="line-st">${lineStatus(S.editingId)}</div>` : '<p class="hint">儲存這位研究人員後，就可以設定LINE通知</p>'}
    </section>
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
    closedTimes: d.closedTimes.filter(x => x.d >= today()).sort((a, b) => a.d.localeCompare(b.d) || toMin(a.s) - toMin(b.s)),
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

/* ---------- 預約紀錄（月曆） ---------- */
function upcoming() { const t = today(); return (S.data.bookings || []).filter(b => b.status === 'booked' && b.date >= t); }
function bookedOn(date) {
  return (S.data.bookings || []).filter(b => b.status === 'booked' && b.date === date && (S.filter === 'all' || b.staffId === S.filter))
    .sort((a, b) => a.start - b.start);
}
function extrasOn(date) { return ((S.data.rooms || {})[date] || {}).extra || []; }
function renderBookings() {
  const el = $('a-bookings'); if (!el) return;
  const t = today(), all = upcoming(), todayN = all.filter(b => b.date === t).length;
  const minM = U.adminFrom().slice(0, 7);
  if (!S.bkMonth) S.bkMonth = t.slice(0, 7);
  if (S.bkMonth < minM) S.bkMonth = minM;
  if (!S.bkDay) S.bkDay = t;
  const [y, m] = S.bkMonth.split('-').map(Number);
  const daysIn = new Date(y, m, 0).getDate(), lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const opts = aStaff().map(s => `<option value="${esc(s.id)}" ${S.filter === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const sColor = id => { const st = aStaff().find(s => s.id === id); return color(st && st.color); };

  let cal = ORDER.map(d => `<div class="bkc-wh">${WD[d]}</div>`).join('') + '<div class="bkc-out"></div>'.repeat(lead);
  for (let i = 1; i <= daysIn; i++) {
    const d = S.bkMonth + '-' + U.pad(i), list = bookedOn(d), ex = extrasOn(d).length;
    const cls = ['bkc-day', d === t ? 'is-today' : '', d < t ? 'is-past' : ''].join(' ');
    cal += `<button type="button" class="${cls}" data-act="bk-day" data-d="${d}" aria-pressed="${d === S.bkDay}" aria-label="${dLabel(d)}，${list.length} 筆預約">
      <span class="bkc-top"><span class="bkc-n">${i}</span>${list.length ? `<span class="bkc-count">${list.length}</span>` : ''}</span>
      <span class="bkc-items">${list.slice(0, 3).map(b => `<span class="bkc-item"><span class="dot" style="background:${sColor(b.staffId)}"></span><span class="mono">${fmt(b.start)}</span> ${esc(b.name)}${b.round || ''}</span>`).join('')}${list.length > 3 ? `<span class="bkc-more">還有 ${list.length - 3} 筆</span>` : ''}${ex ? '<span class="bkc-more">已加開場地</span>' : ''}</span>
    </button>`;
  }

  // 選取日期的明細
  const day = S.bkDay, list = bookedOn(day), extras = extrasOn(day);
  const covered = b => extras.some(x => x.s <= b.start && b.end <= x.e);
  let detail = `<div class="bk-day"><div class="day-actions"><h3>${dLabel(day)}${day === t ? ' · 今天' : ''}</h3>${day >= t ? '<button type="button" class="btn primary small" data-act="bf-new">＋ 新增預約</button>' : ''}</div>`;
  if (S.bkDone) detail += `<div class="bk-done" role="status"><b>已${S.bkDone.edit ? '修改' : '新增'}預約：${esc(S.bkDone.name)}　${esc(S.bkDone.staffName)} ${dLabel(S.bkDone.date)} ${fmt(S.bkDone.start)}</b>
    ${S.bkDone.code ? `<span>預約代碼 <b class="mono">${esc(S.bkDone.code)}</b>（家長可以用孩子姓名＋電話，或這組代碼查詢、修改或取消預約）</span>` : ''}
    <div><button type="button" class="btn ghost small" data-act="bf-done-close">關閉</button></div></div>`;
  if (S.bkForm) detail += bkFormHTML();
  if (!list.length) detail += '<p class="hint" style="padding-top:10px">這一天沒有預約</p>';
  else {
    detail += '<div class="tw"><table><tbody>';
    for (const b of list) {
      const st = aStaff().find(s => s.id === b.staffId), k = 'bk:' + b.id, past = day < t;
      const sync = b.calendarEventId ? '<div class="nt">已加入行事曆</div>' : (b.calendarError === 'no-access' ? '<div class="nt warn">行事曆未同步：請確認研究人員已共用行事曆</div>' : '');
      const reopenBtn = past ? '' : (covered(b)
        ? `<button type="button" class="btn ghost small" data-act="unreopen" data-d="${day}" data-s="${b.start}" data-e="${b.end}">取消加開</button>`
        : `<button type="button" class="btn ghost small" data-act="reopen" data-d="${day}" data-s="${b.start}" data-e="${b.end}">重新開放此時段</button>`);
      const sel = S.person && S.person.id === b.id ? ' class="is-sel"' : '';
      detail += `<tr data-act="person" data-id="${esc(b.id)}"${sel}><td class="tm">${fmt(b.start)}–${fmt(b.end)}</td><td class="st"><span class="dot" style="background:${color(st && st.color)}"></span> ${esc(st ? st.name : b.staffName)}</td>
        <td><button type="button" class="pname" data-act="person" data-id="${esc(b.id)}" title="查看這位受試者的所有預約">${esc(b.name)}</button>${b.round ? `<span class="tag">第${b.round}次</span>` : ''}${b.createdBy ? '<span class="tag">後台代約</span>' : ''}<div class="nt">${esc(b.phone)}${b.email ? '<br>' + esc(b.email) : ''}</div></td>
        <td><div class="nt mono">${esc(b.code || '')}</div>${sync}</td>
        <td class="ac">${S.confirm === k
          ? `<span class="confirm">取消這筆？<button type="button" class="btn danger small" data-act="bk-cancel" data-id="${esc(b.id)}">確定取消</button><button type="button" class="btn ghost small" data-act="confirm-no">保留</button></span>`
          : `<span class="acts">${reopenBtn}${past ? '' : `<button type="button" class="btn ghost small" data-act="bf-edit" data-id="${esc(b.id)}">修改</button><button type="button" class="btn ghost small" data-act="ask" data-k="${esc(k)}">取消預約</button>`}</span>`}</td></tr>`;
    }
    detail += '</tbody></table></div>';
    if (!S.person) detail += '<p class="hint" style="padding-top:10px">點選任一筆預約，可以在旁邊查看這位受試者其他次的預約日期與時段</p>';
  }
  if (extras.length) {
    detail += `<div class="extras"><p class="hint">已加開場地（這些時段其他研究人員可以再被預約）：</p>${extras.slice().sort((a, b) => a.s - b.s).map(x =>
      `<span class="cchip">${fmt(x.s)}–${fmt(x.e)}<button type="button" data-act="unreopen" data-d="${day}" data-s="${x.s}" data-e="${x.e}" aria-label="取消加開 ${fmt(x.s)}">×</button></span>`).join('')}</div>`;
  }
  detail += '</div>';

  el.innerHTML = `<div class="bk-head"><p class="stat">今天 <b>${todayN}</b> 筆 · 即將到來共 <b>${all.length}</b> 筆</p>
    <div class="topnav"><label class="field" style="flex-direction:row;align-items:center;gap:8px"><span>顯示</span><select id="a-filter"><option value="all">全部人員</option>${opts}</select></label>
    <button type="button" class="btn ghost small" data-act="export">匯出 CSV</button></div></div>
    <div class="monthbar">
      <button type="button" class="arrow" data-act="bkm" data-n="-1" ${S.bkMonth <= minM ? 'disabled' : ''} aria-label="上一個月">‹</button>
      <span class="mname">${y} 年 ${m} 月</span>
      <button type="button" class="arrow" data-act="bkm" data-n="1" aria-label="下一個月">›</button>
    </div>
    <div class="bkc">${cal}</div>
    ${detail}`;
}
/* ---------- 受試者預約進度（點選預約紀錄的某一筆時，在旁邊顯示同一位受試者的所有預約） ---------- */
/* 同一位受試者＝孩子姓名＋聯絡電話相同（忽略空格、+886 等寫法差異）；只有姓名或只有電話相同的列為「可能相關」 */
function personRel(b, p) {
  const n = U.lookupName(b.name) && U.lookupName(b.name) === U.lookupName(p.name);
  const ph = U.lookupPhone(b.phone) && U.lookupPhone(b.phone) === U.lookupPhone(p.phone);
  return n && ph ? 'same' : (n || ph) ? 'maybe' : '';
}
function openPerson(id) {
  const b = (S.data.bookings || []).find(x => x.id === id); if (!b) return;
  if (S.person && S.person.id === id) return;
  // 同一位受試者的另一筆：保留已查到的舊紀錄，只換目前選取的那一筆
  if (S.person && personRel(b, S.person) === 'same') { S.person.id = id; markSel(); renderPerson(); return; }
  const p = S.person = { id, name: b.name, phone: b.phone, email: b.email || '', hist: null, loading: true, err: '' };
  markSel(); renderPerson();
  store.personBookings(String(b.name || '').trim(), String(b.phone || '').trim())
    .then(list => { if (S.person === p) p.hist = list; })
    .catch(e => { if (S.person === p) p.err = U.errMsg(e); })
    .finally(() => { if (S.person === p) { p.loading = false; renderPerson(); } });
}
function closePerson() { S.person = null; markSel(); renderPerson(); }
function markSel() {
  document.querySelectorAll('#a-bookings tr[data-id]').forEach(tr => tr.classList.toggle('is-sel', !!S.person && tr.dataset.id === S.person.id));
}
function ppDate(d) { return (d.slice(0, 4) !== today().slice(0, 4) ? d.slice(0, 4) + '/' : '') + dLabel(d); }
function ppState(b) {
  const t = today();
  if (b.status !== 'booked') return { cls: 'no', txt: '已取消' };
  if (b.date < t) return { cls: '', txt: '已結束' };
  if (b.date === t) return { cls: 'ok', txt: '今天' };
  return { cls: 'up', txt: '即將到來' };
}
function ppItem(b, p, showWho) {
  const st = aStaff().find(s => s.id === b.staffId), stt = ppState(b);
  const meta = [esc(st ? st.name : b.staffName), b.round ? `第${esc(b.round)}次` : '', showWho ? esc(b.name) + ' · ' + esc(b.phone) : ''].filter(Boolean).join(' · ');
  const inner = `<span class="dot" style="background:${color(st && st.color)}"></span><span class="pp-when">${ppDate(b.date)} ${fmt(b.start)}–${fmt(b.end)}</span><span class="pill ${stt.cls}">${stt.txt}</span><span class="pp-meta">${meta}</span>`;
  const cls = `pp-item${b.id === p.id ? ' is-cur' : ''}${b.status !== 'booked' ? ' is-off' : ''}`;
  // 月曆有載入的日期才能點過去（後台只載入兩個月前起的紀錄）
  return b.status === 'booked' && b.date >= U.adminFrom()
    ? `<button type="button" class="${cls}" data-act="pp-go" data-id="${esc(b.id)}" data-d="${esc(b.date)}" aria-label="到 ${dLabel(b.date)} 查看這筆預約"${b.id === p.id ? ' aria-current="true"' : ''}>${inner}</button>`
    : `<div class="${cls}">${inner}</div>`;
}
function renderPerson() {
  const el = $('pp'); if (!el) return;
  const p = S.person, on = !!(p && S.data && S.user && S.isAdmin && S.atab === 'bookings');
  el.hidden = !on; document.documentElement.classList.toggle('pp-open', on);
  if (!on) { el.innerHTML = ''; return; }
  const live = S.data.bookings || [], cur = live.find(x => x.id === p.id);
  if (cur) Object.assign(p, { name: cur.name, phone: cur.phone, email: cur.email || '' });
  const m = {};
  (p.hist || []).forEach(b => { m[b.id] = b; });
  live.forEach(b => { m[b.id] = b; });
  const byTime = (a, c) => a.date.localeCompare(c.date) || a.start - c.start;
  // 已取消的預約不列出
  const all = Object.values(m).filter(b => b && b.date && b.status === 'booked');
  const mine = all.filter(b => personRel(b, p) === 'same').sort(byTime);
  const maybe = all.filter(b => personRel(b, p) === 'maybe').sort(byTime);
  const t = today();
  // 每一次評估採用的那筆預約：有未來的預約就用最近的一筆，否則用最後一次已結束的
  const picks = [1, 2, 3].map(r => {
    const list = mine.filter(b => b.status === 'booked' && Number(b.round) === r);
    const next = list.find(b => b.date >= t), last = list.filter(b => b.date < t).pop();
    return { r, list, next, pick: next || last };
  });
  const dayDiff = (a, c) => Math.round((U.parseD(c).getTime() - U.parseD(a).getTime()) / 864e5);
  const steps = picks.map(({ r, list, next, pick }, i) => {
    const cls = !pick ? 'st-none' : next ? 'st-next' : 'st-done';
    const txt = !pick ? '尚未預約' : (next ? (next.date === t ? '今天 ' : '已預約 ') : '已完成 ') + ppDate(pick.date).replace(/（.）$/, '') + (next ? ' ' + fmt(next.start) : '');
    // 和上一次評估相隔幾天（兩次都有預約時才顯示），標在兩個圓圈之間的線上
    const prev = i ? picks[i - 1].pick : null;
    let gap = '';
    if (prev && pick) {
      const n = dayDiff(prev.date, pick.date);
      gap = n > 0 ? `<span class="pp-gap" title="第${r - 1}次到第${r}次相隔 ${n} 天"><i>相隔 ${n} 天</i></span>`
        : `<span class="pp-gap bad" title="第${r}次排在第${r - 1}次之前或同一天"><i>${n === 0 ? '同一天' : '早於第' + (r - 1) + '次'}</i></span>`;
    }
    return `<li class="${cls}">${gap}<span class="pp-dot">${r}</span><span class="pp-sl">第${r}次</span><span class="pp-sd">${txt}</span>${list.length > 1 ? `<span class="pp-warn">有 ${list.length} 筆</span>` : ''}</li>`;
  }).join('');
  const note = p.loading ? '正在查詢更早的預約紀錄…'
    : p.err ? `無法查詢兩個月前的紀錄（${esc(p.err)}），目前只列出最近兩個月起的預約` : '';
  el.innerHTML = `<div class="pp-in"><div class="pp-body"><div class="pp-head"><div><p class="pp-k">受試者預約進度</p><h3 id="pp-title">${esc(p.name)}</h3><p class="hint">${esc(p.phone)}${p.email ? ' · ' + esc(p.email) : ''}</p></div>
      <button type="button" class="icon pp-x" data-act="pp-close" aria-label="關閉">×</button></div>
    <ol class="pp-steps" aria-label="評估進度">${steps}</ol>
    <div class="pp-sec">${mine.map(b => ppItem(b, p, false)).join('') || '<p class="hint">找不到這位受試者的預約</p>'}</div>
    ${maybe.length ? `<div class="pp-sec"><h4>可能相關（只有姓名或電話相同）</h4><p class="pp-note">可能是兄弟姊妹，或預約時姓名、電話填寫不一致</p>${maybe.map(b => ppItem(b, p, true)).join('')}</div>` : ''}
    ${note ? `<p class="pp-note">${note}</p>` : ''}</div></div>`;
}

/* ---------- 後台新增／修改預約 ---------- */
function adminSlots(excludeId) {
  return (S.data.bookings || []).filter(b => b.status === 'booked' && b.id !== excludeId)
    .map(b => ({ staffId: b.staffId, date: b.date, start: b.start, end: b.end, bookingId: b.id }));
}
/** 後台可選的時段：不受「最晚需提前」限制，但不能選已經過去或被佔用的時段 */
function adminChoices(st, date, excludeId) {
  if (!st || !date) return [];
  const now = Date.now(), base = U.parseD(date).getTime();
  return U.available(st, date, adminSlots(excludeId), S.data.rooms).map(x => Object.assign({}, x, { ok: !x.taken && base + x.start * 60000 > now }));
}
/** 自訂時間：檢查是否已過、是否和同一位研究人員的其他預約重疊、共用場地是否還有空位 */
function customProblem(st, date, s, e, excludeId) {
  if (!(s >= 0) || !(e > s)) return '請輸入正確的開始與結束時間，結束要晚於開始';
  if (e - s > 600) return '一次預約最長 10 小時，請確認時間是否正確';
  if (U.parseD(date).getTime() + s * 60000 <= Date.now()) return '這個時間已經過了，請選擇之後的時間';
  const sameDay = adminSlots(excludeId).filter(x => x.date === date);
  if (sameDay.some(x => x.staffId === st.id && s < x.end && x.start < e)) return '這段時間和這位研究人員的其他預約重疊了';
  const extras = (S.data.rooms && S.data.rooms[date] && S.data.rooms[date].extra) || [];
  if (!U.roomFree(s, e, sameDay, extras)) return '這段時間共用場地已經有其他預約，可以先在月曆上「重新開放此時段」再預約';
  return '';
}
function bkFormHTML() {
  const f = S.bkForm, staff = aStaff(), st = staff.find(s => s.id === f.staffId);
  const list = adminChoices(st, f.date, f.id).filter(x => U.parseD(f.date).getTime() + x.start * 60000 > Date.now());
  const toggle = `<button type="button" class="linkbtn" data-act="bf-custom">${f.custom ? '改回選擇固定時段' : '改用自訂時間'}</button>`;
  const slotsHTML = !st ? '<p class="hint">先選擇研究人員</p>' : !f.date ? '<p class="hint">先選擇日期</p>'
    : f.custom
      ? `<div class="custom-time"><label class="field"><span>開始</span><input type="time" id="bf-cs" step="300" value="${esc(f.cs || '')}"></label>
          <span class="dash">–</span>
          <label class="field"><span>結束</span><input type="time" id="bf-ce" step="300" value="${esc(f.ce || '')}"></label></div>
        <p class="hint">自訂時間不受「每週開放時段」與休假限制，但不能和其他預約或共用場地衝突</p>`
    : (!list.length ? '<p class="hint">這一天沒有可預約的固定時段，可以改用自訂時間</p>'
      : '<div class="slots">' + list.map(x => `<button type="button" class="slot" data-act="bf-slot" data-s="${x.start}" ${x.ok ? '' : 'disabled'} aria-pressed="${x.start === f.start}">${fmt(x.start)}</button>`).join('') + '</div>');
  return `<form id="bk-form" class="bk-form" novalidate>
    <h4>${f.id ? '修改預約' : '新增預約（後台代約）'}</h4>
    <div class="g2">
      <label class="field"><span>研究人員</span><select id="bf-staff"><option value="">請選擇</option>${staff.map(s => `<option value="${esc(s.id)}" ${s.id === f.staffId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field"><span>日期</span><input type="date" id="bf-date" min="${today()}" value="${esc(f.date || '')}"></label>
    </div>
    <div class="field"><span>${f.custom ? '自訂評估時間' : '時段（不受「最晚需提前」限制）'}</span>${slotsHTML}${st && f.date ? `<p class="custom-toggle">${toggle}</p>` : ''}</div>
    <div class="g2">
      <label class="field"><span>孩子姓名<b class="req">*</b></span><input type="text" id="bf-name" maxlength="40" value="${esc(f.name || '')}"></label>
      <div class="field"><span>第幾次評估<b class="req">*</b></span><div class="seg">${[1, 2, 3].map(n => `<label><input type="radio" name="bf-round" id="bf-round-${n}" value="${n}" ${Number(f.round) === n ? 'checked' : ''}><span>第${n}次</span></label>`).join('')}</div></div>
    </div>
    <div class="g2">
      <label class="field"><span>聯絡電話<b class="req">*</b></span><input type="tel" id="bf-phone" maxlength="20" value="${esc(f.phone || '')}"></label>
      <label class="field"><span>Email（選填）</span><input type="email" id="bf-email" maxlength="100" value="${esc(f.email || '')}"></label>
    </div>
    <p class="err" id="bf-err" role="alert">${esc(f.err || '')}</p>
    <div class="acts" style="justify-content:flex-start"><button type="submit" class="btn primary" id="bf-save">${f.id ? '儲存修改' : '新增預約'}</button><button type="button" class="btn ghost" data-act="bf-close">取消</button></div>
  </form>`;
}
function readBkForm() {
  const f = S.bkForm; if (!f || !$('bf-name')) return;
  f.staffId = $('bf-staff').value; f.date = $('bf-date').value;
  f.name = $('bf-name').value; f.phone = $('bf-phone').value; f.email = $('bf-email').value;
  const r = document.querySelector('input[name="bf-round"]:checked'); f.round = r ? Number(r.value) : f.round;
  if ($('bf-cs')) { f.cs = $('bf-cs').value; f.ce = $('bf-ce').value; }
}
async function saveBkForm() {
  readBkForm();
  const f = S.bkForm, st = aStaff().find(s => s.id === f.staffId), err = $('bf-err');
  const name = (f.name || '').trim(), phone = String(f.phone || '').replace(/[\s.]/g, ''), email = (f.email || '').trim().toLowerCase();
  const fail = m => { f.err = m; err.textContent = m; };
  if (!st) return fail('請選擇研究人員');
  if (!f.date) return fail('請選擇日期');
  let sl;
  if (f.custom) {
    const cs = U.toMin(f.cs), ce = U.toMin(f.ce);
    if (!f.cs || !f.ce) return fail('請輸入開始與結束時間');
    const bad = customProblem(st, f.date, cs, ce, f.id);
    if (bad) return fail(bad);
    sl = { start: cs, end: ce };
  } else {
    sl = adminChoices(st, f.date, f.id).find(x => x.start === f.start);
    if (f.start == null || !sl) return fail('請選擇時段');
    if (!sl.ok) return fail('這個時段已經被預約或已經過了，請選擇其他時段');
  }
  if (!name) return fail('請填寫孩子姓名');
  if (!(f.round >= 1 && f.round <= 3)) return fail('請選擇第幾次評估');
  if (!/^[0-9+()#-]{6,20}$/.test(phone)) return fail('請填寫正確的聯絡電話');
  if (email && !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email)) return fail('Email格式不正確，不需要可以留空');
  const btn = $('bf-save'); btn.disabled = true; btn.textContent = '儲存中…'; f.err = '';
  const sameDay = adminSlots(f.id).filter(x => x.date === f.date);
  try {
    if (!f.id) {
      const r = await store.book({ staff: st, date: f.date, start: sl.start, end: sl.end, sameDay, name, round: f.round, phone, email, note: '', createdBy: S.user.email, custom: !!f.custom });
      S.bkDone = { code: r.code, name, staffName: st.name, date: f.date, start: sl.start };
      U.toast('已新增預約，預約代碼 ' + r.code);
    } else {
      const b = (S.data.bookings || []).find(x => x.id === f.id);
      if (!b || b.status !== 'booked') throw new Error('這筆預約已經取消了');
      if (b.staffId !== st.id || b.date !== f.date || b.start !== sl.start || b.end !== sl.end) {
        await store.moveBooking({ booking: { id: b.id, staffId: b.staffId, date: b.date, start: b.start, end: b.end, slotKey: b.slotKey, code: b.code }, staff: st, date: f.date, start: sl.start, end: sl.end, sameDay, custom: !!f.custom });
      }
      if (b.name !== name || Number(b.round) !== Number(f.round) || b.phone !== phone || (b.email || '') !== email) {
        await store.updateBookingInfo(b.id, { name, round: Number(f.round), phone, email }, b.code);
      }
      S.bkDone = { edit: true, name, staffName: st.name, date: f.date, start: sl.start };
      U.toast('已修改預約');
    }
    S.bkForm = null; S.bkDay = f.date; S.bkMonth = f.date.slice(0, 7);
  } catch (e) { f.err = U.errMsg(e); }
  renderBookings();
}
function exportCSV() {
  const list = (S.data.bookings || []).slice().sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const head = ['日期', '開始', '結束', '研究人員', '孩子姓名', '第幾次評估', '電話', 'Email', '備註', '狀態', '預約代碼', '建立方式'];
  const lines = [head.map(q).join(',')].concat(list.map(b => [b.date, fmt(b.start), fmt(b.end), b.staffName, b.name, b.round || '', b.phone, b.email, b.note, b.status === 'booked' ? '已預約' : '已取消', b.code, b.createdBy ? '後台代約' : '家長預約'].map(q).join(',')));
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

/* ---------- 姓名＋電話查詢索引：替舊預約補上（每台電腦每筆只做一次） ---------- */
let lookupBusy = false;
function ensureLookups() {
  if (lookupBusy || !S.data || !store.addLookups) return;
  let done = {};
  try { done = JSON.parse(localStorage.getItem('booking-lookup-done') || '{}') || {}; } catch (e) { done = {}; }
  const todo = (S.data.bookings || []).filter(b => b.status === 'booked' && b.date >= today() && b.code && b.name && b.phone && done[b.id] !== b.name + '|' + b.phone);
  if (!todo.length) return;
  lookupBusy = true;
  store.addLookups(todo).then(() => {
    todo.forEach(b => { done[b.id] = b.name + '|' + b.phone; });
    try { localStorage.setItem('booking-lookup-done', JSON.stringify(done)); } catch (e) { /* 略過 */ }
  }).catch(() => { /* 下次開啟後台再試 */ }).finally(() => { lookupBusy = false; });
}

/* ---------- 登入流程 ---------- */
function startData() {
  if (S.unsub) S.unsub();
  S.unsub = store.subscribeAdmin(st => {
    if (!(st.got.staff && st.got.bookings && st.got.admins && st.got.calendars && st.got.rooms)) return;
    const first = !S.data;
    S.data = { staff: st.staff || [], bookings: st.bookings || [], admins: st.admins || [], calendars: st.calendars || {}, calendarsUnavailable: !!st.calendarsUnavailable, rooms: st.rooms || {}, lineStaff: st.lineStaff || {} };
    if (first) render(); else onData();
    ensureLookups();
  }, err => { S.loadErr = U.errMsg(err); if (!S.data) render(); else U.toast(S.loadErr); });
}
store.onAuth(user => {
  if (S.unsub) { S.unsub(); S.unsub = null; }
  S.user = user; S.data = null; S.isAdmin = null; S.draft = null; S.editingId = null; S.person = null;
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
    case 'atab': if (S.atab === 'staff') readEditor(); if (S.bkForm) readBkForm(); S.atab = b.dataset.v; S.confirm = null; render(); break;
    case 'ask': S.confirm = b.dataset.k; rerenderConfirm(); break;
    case 'confirm-no': S.confirm = null; rerenderConfirm(); break;
    case 'export': exportCSV(); break;
    case 'person': openPerson(b.dataset.id); break;
    case 'pp-close': closePerson(); break;
    case 'pp-go': {
      const d = b.dataset.d, id = b.dataset.id;
      if (S.bkForm) readBkForm();
      if (S.person) S.person.id = id;
      S.bkDay = d; S.bkMonth = d.slice(0, 7); S.confirm = null;
      // 有篩選研究人員時，這筆可能被藏起來，改回顯示全部人員
      const bk = (S.data.bookings || []).find(x => x.id === id);
      if (bk && S.filter !== 'all' && bk.staffId !== S.filter) S.filter = 'all';
      renderBookings(); renderPerson();
      const tr = document.querySelector(`#a-bookings tr[data-id="${CSS.escape(id)}"]`);
      if (tr) tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
      break;
    }
    case 'bkm': {
      const [y, m] = S.bkMonth.split('-').map(Number), d = new Date(y, m - 1 + Number(b.dataset.n), 1);
      S.bkMonth = d.getFullYear() + '-' + U.pad(d.getMonth() + 1); S.confirm = null; renderBookings(); break;
    }
    case 'bk-day': S.bkDay = b.dataset.d; S.confirm = null; if (S.bkForm && !S.bkForm.id) S.bkForm.date = b.dataset.d >= today() ? b.dataset.d : S.bkForm.date; renderBookings(); break;
    case 'bf-new': S.bkDone = null; S.bkForm = { staffId: S.filter !== 'all' ? S.filter : '', date: S.bkDay >= today() ? S.bkDay : today(), start: null, round: 0 }; renderBookings(); $('bk-form').scrollIntoView({ block: 'center', behavior: 'smooth' }); break;
    case 'bf-edit': {
      const bk = (S.data.bookings || []).find(x => x.id === b.dataset.id); if (!bk) break;
      S.bkDone = null; S.bkForm = { id: bk.id, staffId: bk.staffId, date: bk.date, start: bk.start, name: bk.name, round: Number(bk.round) || 0, phone: bk.phone, email: bk.email || '' };
      {
        // 不在固定時段上的預約（之前用自訂時間建立的），直接用自訂時間編輯
        const st0 = aStaff().find(s => s.id === bk.staffId);
        const onGrid = st0 && U.daySlots(st0, U.parseD(bk.date).getDay()).some(x => x.start === bk.start && x.end === bk.end);
        if (!onGrid) Object.assign(S.bkForm, { custom: true, cs: fmt(bk.start), ce: fmt(bk.end) });
      }
      renderBookings(); $('bk-form').scrollIntoView({ block: 'center', behavior: 'smooth' }); break;
    }
    case 'bf-slot': readBkForm(); S.bkForm.start = Number(b.dataset.s); S.bkForm.err = ''; renderBookings(); break;
    case 'bf-close': S.bkForm = null; renderBookings(); break;
    case 'bf-custom': {
      readBkForm(); const f = S.bkForm; f.custom = !f.custom; f.err = '';
      if (f.custom && !f.cs) {
        const st = aStaff().find(s => s.id === f.staffId), dur = st ? U.num(st.duration, 60) : 60;
        if (f.start != null) { f.cs = fmt(f.start); f.ce = fmt(Math.min(f.start + dur, 1439)); }
      }
      renderBookings(); break;
    }
    case 'bf-done-close': S.bkDone = null; renderBookings(); break;
    case 'line-bind': {
      b.disabled = true;
      try { const code = await store.createLineBind(S.editingId); S.lineCode = { staffId: S.editingId, code }; }
      catch (err) { U.toast(U.errMsg(err)); }
      if ($('line-st')) $('line-st').innerHTML = lineStatus(S.editingId); break;
    }
    case 'line-unbind':
      b.disabled = true;
      try { await store.unbindLine(S.editingId); S.confirm = null; U.toast('已解除LINE綁定'); } catch (err) { U.toast(U.errMsg(err)); }
      if ($('line-st')) $('line-st').innerHTML = lineStatus(S.editingId); break;
    case 'reopen': case 'unreopen': {
      const d = b.dataset.d, s = Number(b.dataset.s), en = Number(b.dataset.e), on = b.dataset.act === 'reopen';
      b.disabled = true;
      try { await (on ? store.reopen(d, s, en) : store.unreopen(d, s, en)); U.toast(on ? `已重新開放 ${dLabel(d)} ${fmt(s)}–${fmt(en)}，其他研究人員這段時間可以再被預約` : `已取消加開 ${dLabel(d)} ${fmt(s)}–${fmt(en)}`); }
      catch (err) { U.toast(U.errMsg(err)); }
      renderBookings(); break;
    }
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
    case 'ed-add-closed': {
      readEditor();
      const v = $('f-closed-new').value, all = $('f-closed-all').checked, er = $('closed-err');
      if (!v) { er.textContent = '請先選擇休假日期'; break; }
      if (all) {
        if (!S.draft.closedDates.includes(v)) S.draft.closedDates.push(v);
        S.draft.closedTimes = S.draft.closedTimes.filter(x => x.d !== v); // 整天休假已包含當天的部分時段
      } else {
        const s = $('f-closed-s').value, e = $('f-closed-e').value;
        if (!(toMin(s) < toMin(e))) { er.textContent = '休假的結束時間要晚於開始時間'; break; }
        if (S.draft.closedDates.includes(v)) { er.textContent = '這一天已經設定整天休假'; break; }
        if (!S.draft.closedTimes.some(x => x.d === v && x.s === s && x.e === e)) S.draft.closedTimes.push({ d: v, s, e });
      }
      renderEditor(); break;
    }
    case 'ed-del-closed': readEditor(); S.draft.closedDates = S.draft.closedDates.filter(c => c !== b.dataset.v); renderEditor(); break;
    case 'ed-del-closedt': readEditor(); S.draft.closedTimes = S.draft.closedTimes.filter(x => !(x.d === b.dataset.d && x.s === b.dataset.s && x.e === b.dataset.e)); renderEditor(); break;
    case 'ed-delete':
      b.disabled = true;
      try { const delId = S.editingId; await store.deleteStaff(delId); if (!S.data.calendarsUnavailable && (S.data.calendars || {})[delId]) await store.saveCalendar(delId, ''); S.editingId = null; S.draft = null; S.confirm = null; U.toast('已刪除人員'); }
      catch (err) { U.toast(U.errMsg(err)); }
      renderStaffList(); renderEditor(); break;
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.person) closePerson(); });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.classList && t.classList.contains('day-on')) { readEditor(); const d = t.dataset.day; if (t.checked && !S.draft.weekly[d].length) S.draft.weekly[d] = [{ s: '09:00', e: '12:00' }]; renderEditor(); return; }
  if (t.id === 'a-filter') { S.filter = t.value; renderBookings(); }
  if (t.id === 'bf-staff' || t.id === 'bf-date') { readBkForm(); S.bkForm.start = null; renderBookings(); }
  if (t.id === 'f-closed-all') { S.leaveAll = t.checked; $('f-closed-times').hidden = t.checked; }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.closest && t.closest('#ed-form')) { readEditor(); updatePreview(); $('ed-err').textContent = ''; return; }
  if (t.id === 'acct-new') $('acct-err').textContent = '';
  if (t.closest && t.closest('#bk-form') && t.id !== 'bf-date') { readBkForm(); if (S.bkForm) S.bkForm.err = ''; const er = $('bf-err'); if (er) er.textContent = ''; }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const id = e.target.id;
  if (id === 'ed-form') saveStaff();
  if (id === 'bk-form') saveBkForm();
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
