// api/doge.js
import crypto from 'crypto';

const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'REAL';
const BASE = 'https://www.okx.com';

const MIN_DOGE = 10;
const TRADE_USDT = 25;

let activePosition = null;

// ✅ 修复：OKX V5 正确签名格式（必须加 \n）
function sign(ts, method, path, body = '') {
  const msg = `${ts}${method}${path}\n${body}\n`;
  return crypto.createHmac('sha256', SECRET).update(msg).digest('base64');
}

async function getMarketData() {
  try {
    const res = await fetch(`${BASE}/api/v5/market/ticker?instId=DOGE-USDT`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const text = await res.text();
    if (!text.trim().startsWith('{')) throw new Error('返回非JSON，可能被风控');

    const json = JSON.parse(text);
    if (json.code !== '0') throw new Error(json.msg);

    const price = Number(json.data[0].last);
    if (isNaN(price) || price <= 0) throw new Error('价格无效');
    return { price };
  } catch (err) {
    throw new Error('获取行情失败: ' + err.message);
  }
}

async function executeTrade(side, price) {
  let amount = Math.floor(TRADE_USDT / price);
  if (amount < MIN_DOGE) amount = MIN_DOGE;

  if (MODE === 'DEMO') {
    return { success: true, demo: true, side, price, amount };
  }

  const path = '/api/v5/trade/order';
  const body = JSON.stringify({
    instId: 'DOGE-USDT',
    tdMode: 'cash',
    side: side.toLowerCase(),
    ordType: 'market',
    sz: String(amount)
  });

  const ts = new Date().toISOString();
  const headers = {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': API_KEY,
    'OK-ACCESS-SIGN': sign(ts, 'POST', path, body),
    'OK-ACCESS-TIMESTAMP': ts,
    'OK-ACCESS-PASSPHRASE': PASSPHRASE
  };

  const res = await fetch(BASE + path, { method: 'POST', headers, body });
  const data = await res.json();

  if (data.code === '0') {
    return {
      success: true,
      orderId: data.data[0]?.ordId,
      amount,
      raw: data
    };
  }
  return { success: false, error: data.msg || '下单失败', raw: data };
}

export default async function handler(req, res) {
  // ✅ 修复：支持浏览器跨域 + OPTIONS 预检
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action } = req.query;

    if (action === 'buy') {
      // 临时内存持仓，生产建议用 redis / 数据库
      if (activePosition) {
        return res.json({ success: false, error: '当前已有持仓（内存记录）' });
      }

      const { price } = await getMarketData();
      const result = await executeTrade('BUY', price);

      if (result.success) {
        activePosition = { price, amount: result.amount, time: Date.now() };
        return res.json({
          success: true,
          action: 'BUY',
          msg: `买入 ${result.amount} DOGE 成功`,
          price
        });
      }

      return res.json({ success: false, error: result.error });
    }

    if (action === 'sell') {
      if (!activePosition) {
        return res.json({ success: false, error: '暂无持仓（内存记录）' });
      }

      const { price } = await getMarketData();
      const result = await executeTrade('SELL', price);

      if (result.success) {
        activePosition = null;
        return res.json({
          success: true,
          action: 'SELL',
          msg: '卖出成功',
          price
        });
      }

      return res.json({ success: false, error: result.error });
    }

    // 默认返回行情
    const { price } = await getMarketData();
    res.json({
      success: true,
      price,
      holding: !!activePosition,
      position: activePosition
    });

  } catch (err) {
    res.status(200).json({ success: false, error: err.message });
  }
}
