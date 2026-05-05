// api/doge.js
import crypto from 'crypto';

/* ========= 1️⃣ 环境 ========= */
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'REAL';
const BASE = 'https://www.okx.com';

/* ========= 2️⃣ 风控参数 ========= */
const MIN_USDT = 20;
const MIN_DOGE = 10;
const TAKE_PROFIT = 0.03;
const STOP_LOSS = -0.02;

/* ========= 3️⃣ OKX 签名 ========= */
function sign(ts, method, path, body = '') {
  const msg = ts + method + path + body;
  return crypto.createHmac('sha256', SECRET).update(msg).digest('base64');
}

/* ========= 4️⃣ 请求封装 ========= */
async function okxRequest(method, path, body = '') {
  const ts = new Date().toISOString();
  const headers = {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': API_KEY,
    'OK-ACCESS-SIGN': sign(ts, method, path, body),
    'OK-ACCESS-TIMESTAMP': ts,
    'OK-ACCESS-PASSPHRASE': PASSPHRASE
  };

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: method === 'POST' ? body : undefined
  });

  return res.json();
}

/* ========= 5️⃣ 行情 ========= */
async function getMarketPrice() {
  const json = await okxRequest('GET', '/api/v5/market/ticker?instId=DOGE-USDT');
  if (json.code !== '0') throw new Error(json.msg);
  return Number(json.data[0].last);
}

/* ========= 6️⃣ 现货余额 ========= */
async function getSpotBalance(ccy) {
  const json = await okxRequest('GET', `/api/v5/account/balance?ccy=${ccy}`);
  if (json.code !== '0') return 0;
  return Number(json.data[0].details[0]?.availBal || 0);
}

/* ========= 7️⃣ ✅ 真实持仓（关键） ========= */
async function getRealPosition() {
  const json = await okxRequest('GET', '/api/v5/account/positions?instId=DOGE-USDT');
  if (json.code !== '0') return null;

  const pos = json.data.find(p => Number(p.pos) > 0);
  if (!pos) return null;

  return {
    amount: Number(pos.pos),
    avgPrice: Number(pos.avgPx)
  };
}

/* ========= 8️⃣ 下单 ========= */
async function executeTrade(side) {
  const price = await getMarketPrice();
  let amount = Math.floor(MIN_USDT / price);
  if (amount < MIN_DOGE) amount = MIN_DOGE;

  if (side === 'SELL') {
    const pos = await getRealPosition();
    if (!pos) return { success: false, error: '无持仓' };
    amount = Math.min(amount, Math.floor(pos.amount));
  }

  const body = JSON.stringify({
    instId: 'DOGE-USDT',
    tdMode: 'cash',
    side: side.toLowerCase(),
    ordType: 'market',
    sz: String(amount)
  });

  const res = await okxRequest('POST', '/api/v5/trade/order', body);
  if (res.code === '0') return { success: true, amount };
  return { success: false, error: res.msg };
}

/* ========= 9️⃣ 自动止盈止损 ========= */
async function checkAutoTrade() {
  const pos = await getRealPosition();
  if (!pos) return;

  const currentPrice = await getMarketPrice();
  const pnl = (currentPrice - pos.avgPrice) / pos.avgPrice;

  if (pnl >= TAKE_PROFIT || pnl <= STOP_LOSS) {
    await executeTrade('SELL');
  }
}

/* ========= 🔟 HTTP 入口 ========= */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action } = req.query;
    const pos = await getRealPosition();
    const holding = !!pos;

    if (action === 'buy') {
      if (holding) return res.json({ success: false, error: '已有持仓' });
      return res.json(await executeTrade('BUY'));
    }

    if (action === 'sell') {
      if (!holding) return res.json({ success: false, error: '无持仓' });
      return res.json(await executeTrade('SELL'));
    }

    await checkAutoTrade();

    const price = await getMarketPrice();
    res.json({ success: true, price, holding });

  } catch (err) {
    res.status(200).json({ success: false, error: err.message });
  }
}
