/* ===== 洋柿子的工作台 · 前端逻辑 ===== */
const $ = (s) => document.querySelector(s);
const state = { token: null, email: null, data: null };
let currentPage = 'home';

/* ---------- 工具 ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmtDate(s) {
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ---------- 接口 ---------- */
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}
async function saveData() {
  try { await api('PUT', '/api/data', state.data); }
  catch (e) { alert('保存失败：' + e.message); }
}

/* ---------- 认证 ---------- */
let authMode = 'login';
$('.auth-tab').forEach((t) => t.addEventListener('click', () => {
  authMode = t.dataset.mode;
  $('.auth-tab').forEach((x) => x.classList.toggle('active', x === t));
  $('#authBtn').textContent = authMode === 'login' ? '登录' : '注册并进入';
  $('#authMsg').textContent = '';
}));
$('#authBtn').addEventListener('click', async () => {
  const email = $('#email').value.trim();
  const password = $('#password').value;
  $('#authMsg').textContent = '';
  if (!email || !password) { $('#authMsg').textContent = '请填写邮箱和密码'; return; }
  try {
    const r = authMode === 'login'
      ? await api('POST', '/api/login', { email, password })
      : await api('POST', '/api/register', { email, password });
    state.token = r.token; state.email = r.email;
    localStorage.setItem('yfq_token', r.token);
    await loadData();
    enterApp();
  } catch (e) { $('#authMsg').textContent = e.message; }
});
$('#logoutBtn').addEventListener('click', () => {
  state.token = null; localStorage.removeItem('yfq_token');
  $('#app').classList.add('hidden'); $('#auth').classList.remove('hidden');
});

async function loadData() {
  state.data = await api('GET', '/api/data');
}
function enterApp() {
  $('#auth').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#userEmail').textContent = state.email;
  showPage('home');
}

/* ---------- 导航 ---------- */
$('#nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-item');
  if (!btn) return;
  showPage(btn.dataset.page);
});
function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  const view = $('#view');
  if (page === 'home') renderHome(view);
  else if (page === 'plans') renderPlans(view);
  else if (page === 'english') renderEnglish(view);
  else if (page === 'sports') renderSports(view);
  else if (page === 'news') renderNews(view);
}

/* ---------- 首页 ---------- */
function renderHome(view) {
  const t = today();
  const plans = (state.data.plans[t] || []);
  const done = plans.filter((p) => p.done).length;
  const en = state.data.english, sp = state.data.sports;
  view.innerHTML = `
    <div class="page-head">
      <h2 class="page-title">🍅 嗨，洋柿子</h2>
      <p class="page-sub">${t} · 今天也要元气满满呀</p>
    </div>
    <div class="home-grid">
      <div class="stat green" data-go="plans">
        <div class="emoji">📋</div><div class="num">${done}/${plans.length || 0}</div><div class="label">今日计划完成</div>
      </div>
      <div class="stat pink" data-go="english">
        <div class="emoji">📚</div><div class="num">${en.streak}</div><div class="label">英语连续打卡(天)</div>
      </div>
      <div class="stat blue" data-go="sports">
        <div class="emoji">🏃</div><div class="num">${sp.streak}</div><div class="label">运动连续打卡(天)</div>
      </div>
      <div class="stat clay" data-go="news">
        <div class="emoji">📰</div><div class="num">实时</div><div class="label">每日热点新闻</div>
      </div>
    </div>`;
  view.querySelectorAll('.stat').forEach((s) => s.addEventListener('click', () => showPage(s.dataset.go)));
}

/* ---------- 每日计划 ---------- */
function genRandomPlans() {
  const pool = window.CONTENT.planTemplates.slice();
  const n = Math.random() < 0.5 ? 1 : 2;
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push({ id: uid(), text: pool.splice(idx, 1)[0], done: false });
  }
  return out;
}
function renderPlans(view) {
  const t = today();
  if (!state.data.plans[t]) { state.data.plans[t] = genRandomPlans(); saveData(); }
  const plans = state.data.plans[t];
  const done = plans.filter((p) => p.done).length;
  const pct = plans.length ? Math.round((done / plans.length) * 100) : 0;
  view.innerHTML = `
    <div class="page-head">
      <h2 class="page-title">📋 每日计划</h2>
      <p class="page-sub">${t} · 小目标，慢慢完成</p>
    </div>
    <div class="card">
      <div class="plans-head">
        <div class="card-title">今日进度 ${done}/${plans.length}</div>
        <button class="btn-soft" id="regen">🎲 换一批</button>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="add-row">
        <input id="newPlan" placeholder="添加一条自己的计划…" />
        <button class="btn-primary" style="width:auto;padding:11px 18px" id="addPlan">添加</button>
      </div>
      <div id="planList"></div>
    </div>`;
  const list = $('#planList');
  if (!plans.length) list.innerHTML = '<div class="empty">还没有计划，点“换一批”或自己加一条吧～</div>';
  plans.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'plan-item' + (p.done ? ' done' : '');
    el.innerHTML = `<button class="chk">${p.done ? '✓' : ''}</button><span class="txt">${escapeHtml(p.text)}</span><button class="del">🗑</button>`;
    el.querySelector('.chk').onclick = () => { p.done = !p.done; el.classList.toggle('done', p.done); el.querySelector('.chk').textContent = p.done ? '✓' : ''; updatePlanProgress(); saveData(); };
    el.querySelector('.del').onclick = () => { state.data.plans[t] = plans.filter((x) => x.id !== p.id); renderPlans(view); saveData(); };
    list.appendChild(el);
  });
  $('#addPlan').onclick = () => {
    const v = $('#newPlan').value.trim(); if (!v) return;
    plans.push({ id: uid(), text: v, done: false }); $('#newPlan').value = ''; renderPlans(view); saveData();
  };
  $('#newPlan').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#addPlan').click(); });
  $('#regen').onclick = () => { state.data.plans[t] = genRandomPlans(); renderPlans(view); saveData(); };
  function updatePlanProgress() {
    const d = plans.filter((p) => p.done).length;
    $('.progress-fill').style.width = plans.length ? (d / plans.length * 100) + '%' : '0%';
  }
}

/* ---------- 四级英语 ---------- */
function renderEnglish(view) {
  const en = state.data.english;
  const t = today();
  const checkedToday = en.last === t;
  view.innerHTML = `
    <div class="page-head">
      <h2 class="page-title">📚 四级英语学习</h2>
      <p class="page-sub">打卡不停，词汇和语法天天见</p>
    </div>
    <div class="checkin">
      <div class="streak">🔥 ${en.streak} 天</div>
      <div style="color:var(--muted);font-size:13px;margin:4px 0 12px">连续打卡</div>
      <button class="btn-primary" id="enCheck" ${checkedToday ? 'disabled style="opacity:.6"' : ''}>
        ${checkedToday ? '✅ 今天已打卡' : '今日打卡'}
      </button>
    </div>
    <div class="tabs">
      <button class="tab active" data-t="word">单词</button>
      <button class="tab" data-t="grammar">语法</button>
    </div>
    <div id="enBody"></div>`;
  $('#enCheck').onclick = () => {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    en.streak = (en.last === y) ? en.streak + 1 : 1;
    en.last = t; saveData(); renderEnglish(view);
  };
  const tabs = view.querySelectorAll('.tab');
  tabs.forEach((tb) => tb.onclick = () => { tabs.forEach((x) => x.classList.toggle('active', x === tb)); renderEnBody(tb.dataset.t); });
  function renderEnBody(kind) {
    const body = $('#enBody');
    if (kind === 'grammar') {
      const g = window.CONTENT.grammar[dayOfYear() % window.CONTENT.grammar.length];
      const fav = en.favGrammar.includes(g.title);
      body.innerHTML = `<div class="grammar-card"><div class="w" style="font-weight:700;margin-bottom:8px">${escapeHtml(g.title)}</div><div>${escapeHtml(g.body)}</div>
        <button class="btn-soft" id="favG" style="margin-top:12px">${fav ? '⭐ 已收藏' : '☆ 收藏'}</button></div>`;
      $('#favG').onclick = () => {
        if (en.favGrammar.includes(g.title)) en.favGrammar = en.favGrammar.filter((x) => x !== g.title);
        else en.favGrammar.push(g.title);
        saveData(); renderEnBody('grammar');
      };
    } else {
      const words = window.CONTENT.words;
      const start = (dayOfYear() * 3) % words.length;
      let html = '';
      for (let i = 0; i < 6; i++) {
        const wd = words[(start + i) % words.length];
        const mastered = en.mastered.includes(wd.w);
        html += `<div class="word-card">
          <div><span class="w">${escapeHtml(wd.w)}</span><span class="ph">${escapeHtml(wd.ph)}</span> ${mastered ? '<span class="tag-mastered">✓ 已掌握</span>' : ''}</div>
          <div class="mean">${escapeHtml(wd.mean)}</div>
          <div class="ex">${escapeHtml(wd.ex)}</div>
          <button class="btn-soft" data-w="${escapeHtml(wd.w)}" style="margin-top:8px">${mastered ? '取消掌握' : '标记掌握'}</button>
        </div>`;
      }
      body.innerHTML = html;
      body.querySelectorAll('button[data-w]').forEach((b) => b.onclick = () => {
        const w = b.dataset.w;
        if (en.mastered.includes(w)) en.mastered = en.mastered.filter((x) => x !== w);
        else en.mastered.push(w);
        saveData(); renderEnBody('word');
      });
    }
  }
  renderEnBody('word');
}

/* ---------- 运动 ---------- */
function renderSports(view) {
  const sp = state.data.sports;
  const t = today();
  const checkedToday = sp.last === t;
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const weekCount = sp.records.filter((r) => new Date(r.date) >= weekAgo).length;
  view.innerHTML = `
    <div class="page-head">
      <h2 class="page-title">🏃 运动</h2>
      <p class="page-sub">动起来，身体会感谢你</p>
    </div>
    <div class="checkin">
      <div class="streak">🔥 ${sp.streak} 天</div>
      <div style="color:var(--muted);font-size:13px;margin:4px 0 12px">连续打卡</div>
      <button class="btn-primary" id="spCheck" ${checkedToday ? 'disabled style="opacity:.6"' : ''}>
        ${checkedToday ? '✅ 今天已打卡' : '今日打卡'}
      </button>
    </div>
    <div class="card">
      <div class="card-title">🎯 本周目标</div>
      <div class="goal-row">
        <span>每周运动</span>
        <input id="goal" type="number" min="1" max="14" value="${sp.goal}" style="width:64px;padding:8px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg);text-align:center" />
        <span>次 · 已达成 ${weekCount} 次</span>
      </div>
      <div class="progress-bar" style="margin-top:12px"><div class="progress-fill" style="width:${Math.min(100, Math.round(weekCount / sp.goal * 100))}%"></div></div>
    </div>
    <div class="card">
      <div class="card-title">➕ 记录一次运动</div>
      <div class="sport-form">
        <select id="spType">${window.CONTENT.sportTypes.map((s) => `<option>${s}</option>`).join('')}</select>
        <input id="spMin" type="number" min="1" placeholder="分钟" style="width:90px" />
        <button class="btn-primary" style="width:auto;padding:11px 18px" id="addRec">保存记录</button>
      </div>
      <div id="recList"></div>
    </div>`;
  $('#spCheck').onclick = () => {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    sp.streak = (sp.last === y) ? sp.streak + 1 : 1;
    sp.last = t; saveData(); renderSports(view);
  };
  $('#goal').onchange = () => { sp.goal = Math.max(1, parseInt($('#goal').value) || 3); saveData(); renderSports(view); };
  $('#addRec').onclick = () => {
    const type = $('#spType').value; const min = parseInt($('#spMin').value);
    if (!min || min <= 0) { alert('请输入运动分钟数'); return; }
    sp.records.unshift({ id: uid(), type, min, date: new Date().toISOString() });
    $('#spMin').value = ''; saveData(); renderSports(view);
  };
  const rl = $('#recList');
  if (!sp.records.length) rl.innerHTML = '<div class="empty">还没有运动记录，动一下试试～</div>';
  sp.records.slice(0, 12).forEach((r) => {
    const el = document.createElement('div');
    el.className = 'record-item';
    el.innerHTML = `<span class="type">${escapeHtml(r.type)}</span><span class="min">${r.min} 分钟</span><span class="date">${fmtDate(r.date)}</span>`;
    rl.appendChild(el);
  });
}

/* ---------- 新闻 ---------- */
function renderNews(view) {
  view.innerHTML = `
    <div class="page-head">
      <h2 class="page-title">📰 每日热点新闻</h2>
      <p class="page-sub">国际热点 · 政治热点 · 实时更新</p>
    </div>
    <div class="news-tabs">
      <button class="tab active" data-t="international">🌍 国际热点</button>
      <button class="tab" data-t="politics">🏛 政治热点</button>
    </div>
    <div class="refresh-row">
      <button class="btn-soft" id="refreshNews">🔄 刷新</button>
      <span id="newsBadge"></span>
    </div>
    <div id="newsList"><div class="empty">加载中…</div></div>`;
  let curType = 'international';
  const tabs = view.querySelectorAll('.tab');
  tabs.forEach((tb) => tb.onclick = () => { tabs.forEach((x) => x.classList.toggle('active', x === tb)); curType = tb.dataset.t; loadNews(curType); });
  $('#refreshNews').onclick = () => loadNews(curType);
  function loadNews(type) {
    $('#newsList').innerHTML = '<div class="empty">加载中…</div>';
    fetch(`/api/news?type=${type}`).then((r) => r.json()).then((d) => {
      $('#newsBadge').innerHTML = d.real ? '<span class="badge-real">● 实时</span>' : '<span class="badge-demo">● 示例(配置Key后实时)</span>';
      if (!d.items || !d.items.length) { $('#newsList').innerHTML = '<div class="empty">暂无内容</div>'; return; }
      $('#newsList').innerHTML = d.items.map((n) => `
        <div class="news-item">
          <div class="nt">${escapeHtml(n.title)}</div>
          <div class="nm"><span class="ns">🏷 ${escapeHtml(n.source || '新闻')}</span><span>🕒 ${fmtDate(n.time)}</span></div>
          ${n.summary ? `<div style="margin-top:8px;color:var(--muted);font-size:13px;line-height:1.6">${escapeHtml(n.summary)}</div>` : ''}
        </div>`).join('');
    }).catch(() => { $('#newsList').innerHTML = '<div class="empty">加载失败，请重试</div>'; });
  }
  loadNews(curType);
}

/* ---------- 启动 ---------- */
(async function init() {
  const tok = localStorage.getItem('yfq_token');
  if (tok) {
    try {
      state.token = tok;
      const me = await api('GET', '/api/me');
      state.email = me.email;
      await loadData();
      enterApp();
      return;
    } catch (e) { localStorage.removeItem('yfq_token'); }
  }
  $('#auth').classList.remove('hidden');
})();

// 注册 Service Worker（支持“加到主屏”当 App、离线可用）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
