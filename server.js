/**
 * 洋柿子的工作台 - 后端服务
 * 功能：账号注册/登录、云端数据同步、实时新闻代理
 * 依赖：仅 express（纯 JS，无原生模块，部署极简）
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 数据存储（JSON 文件，单人/小团队够用，部署零依赖） ----------
function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
}
function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ---------- 密码与 Token ----------
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const h = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${h}`;
}
function verifyPassword(pw, stored) {
  const [salt, h] = stored.split(':');
  const h2 = crypto.scryptSync(pw, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(h2, 'hex'));
}
function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

// 默认用户数据结构
function defaultData() {
  return {
    plans: {},          // { 'YYYY-MM-DD': [{id, text, done}] }
    english: { streak: 0, last: null, mastered: [], favGrammar: [] },
    sports: { streak: 0, last: null, goal: 3, records: [] },
  };
}

// ---------- 鉴权中间件 ----------
function auth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: '未登录' });
  const db = readDb();
  const user = Object.values(db.users).find((u) => u.token === token);
  if (!user) return res.status(401).json({ error: '登录已失效' });
  req.user = user;
  next();
}

// ---------- 账号接口 ----------
app.post('/api/register', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  const db = readDb();
  if (db.users[email]) return res.status(409).json({ error: '该邮箱已注册，请直接登录' });
  const token = newToken();
  db.users[email] = { email, pwHash: hashPassword(password), token, data: defaultData() };
  writeDb(db);
  res.json({ token, email });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const db = readDb();
  const user = db.users[email];
  if (!user || !verifyPassword(password, user.pwHash)) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }
  user.token = newToken();
  writeDb(db);
  res.json({ token: user.token, email });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ email: req.user.email });
});

// ---------- 云端数据同步 ----------
app.get('/api/data', auth, (req, res) => {
  res.json(req.user.data || defaultData());
});

app.put('/api/data', auth, (req, res) => {
  const incoming = req.body || {};
  const db = readDb();
  db.users[req.user.email].data = { ...defaultData(), ...incoming };
  writeDb(db);
  res.json({ ok: true });
});

// ---------- 实时新闻代理 ----------
// 支持第三方 API：设置环境变量 NEWS_API_KEY 后自动拉取真实新闻
// 未配置 Key 时返回精选示例，保证功能完整可用
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let buf = '';
      r.on('data', (d) => (buf += d));
      r.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sampleNews(type) {
  if (type === 'politics') {
    return [
      { title: '示例 · 国内政策热点（请配置新闻 API Key 后显示实时内容）', source: '示例源', time: new Date().toISOString(), summary: '在 .env 中填入 NEWS_API_KEY 即可获取真实政治热点新闻。' },
      { title: '示例 · 民生与法治相关动态', source: '示例源', time: new Date().toISOString(), summary: '配置 Key 后此处将展示实时更新的政治类新闻。' },
    ];
  }
  return [
    { title: '示例 · 国际热点（请配置新闻 API Key 后显示实时内容）', source: '示例源', time: new Date().toISOString(), summary: '在 .env 中填入 NEWS_API_KEY 即可获取真实国际新闻。' },
    { title: '示例 · 全球经贸与科技动态', source: '示例源', time: new Date().toISOString(), summary: '配置 Key 后此处将展示实时更新的国际类新闻。' },
  ];
}

app.get('/api/news', async (req, res) => {
  const type = req.query.type === 'politics' ? 'politics' : 'international';
  const key = process.env.NEWS_API_KEY;
  if (!key) {
    return res.json({ real: false, items: sampleNews(type) });
  }
  try {
    // 以天行数据(tianapi)为例：国际=world，国内(含政治)=guonei
    const apiType = type === 'politics' ? 'guonei' : 'world';
    const url = `https://api.tianapi.com/${apiType}/?key=${key}`;
    const json = await fetchJson(url);
    const list = (json && json.newslist) || [];
    const items = list.slice(0, 20).map((n) => ({
      title: n.title,
      source: n.source || '新闻',
      time: n.ctime ? new Date(Number(n.ctime) * 1000).toISOString() : new Date().toISOString(),
      summary: n.description || '',
    }));
    res.json({ real: true, items });
  } catch (e) {
    res.json({ real: false, items: sampleNews(type) });
  }
});

app.listen(PORT, () => {
  console.log(`🍅 洋柿子的工作台 已启动: http://localhost:${PORT}`);
});
