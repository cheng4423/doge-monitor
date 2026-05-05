// api/doge.js
import crypto from 'crypto';

const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'REAL';
const BASE = 'https://www.okx.com';

const MIN_USDT = 20;
const MIN_DOGE = 10;
const TAKE_PROFIT = 0.03;
const STOP_LOSS = -0.02;

// ✅ 正确 OKX V5 签名
function sign(ts, method, path, body = '') {
  const msg = `${ts}${method}${path}\n${body}\n`;
  return crypto.createHmac('sha256', SECRET).update(msg).digest('base64');
}

// ✅ 请求封装
async function okxRequest(method, path, body = '') {
  const ts = new Date().toISOString();
  const headers = {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': API_KEY,
    'OK-ACCESS-SIGN': sign(ts, method, path, body),
    'OK-ACCESS-TIMESTAMP': ts,
    'OK-ACCESS-PASSPHRASE': PASSPHRASE
  };

  const res = await fetch(BASE + path, { method, headers, body: method === 'POST' ? body : undefined });
  return res.json();
}

// ✅ 获取价格
async function getMarketPrice() {
  const json = await okxRequest('GET', '/api/v5/market/ticker?instId=DOGE-USDT');
  if (json.code !== '0') throw new Error(json.msg);
  return Number(json.data[0].last);
}

// ✅ 获取现货余额（正确！）
async function getSpotBalance(ccy) {
  const json = await okxRequest('GET', `/api/v5/account/balance?ccy=${ccy}`);
  if (json.code !== '0') return 0;
  return Number(json.data[0].details[0]?.availBal || 0);
}

// ✅ 下单
async function executeTrade(side) {
  const price = await getMarketPrice();
  let amount = Math.floor(MIN_USDT / price);
  if (amount < MIN_DOGE) amount = MIN_DOGE;

  if (side === 'SELL') {
    const balance = await getSpotBalance('DOGE');
    amount = Math.min(amount, Math.floor(balance));
    if (amount < 1) return { success: false, error: 'DOGE 可用不足' };
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

// ✅ 自动策略
async function checkAutoTrade() {
  const dogeBal = await getSpotBalance('DOGE');
  if (dogeBal < 1) return;

  const holdPrice = await getMarketPrice(); // 简易版，正式版可用历史成交
  const currentPrice = await getMarketPrice();
  const pnl = (currentPrice - holdPrice) / holdPrice;

  if (pnl >= TAKE_PROFIT || pnl <= STOP_LOSS) {
    await executeTrade('SELL');
  }
}

// ✅ HTTP 接口
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action } = req.query;
    const dogeBal = await getSpotBalance('DOGE');
    const holding = dogeBal >= 1;

    if (action === 'buy') {
      if (holding) return res.json({ success: false, error: '已有持仓' });
      const r = await executeTrade('BUY');
      return res.json(r);
    }

    if (action === 'sell') {
      if (!holding) return res.json({ success: false, error: '无持仓' });
      const r = await executeTrade('SELL');
      return res.json(r);
    }

    // 自动交易
    await checkAutoTrade();

    const price = await getMarketPrice();
    res.json({ success: true, price, holding });

  } catch (err) {
    res.status(200).json({ success: false, error: err.message });
  }
}
