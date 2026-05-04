// api/doge.js
// ✅ 实盘买入修复版（解决 All operations failed）
import crypto from 'crypto';

// ===== 1. 环境 =====
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'REAL';
const BASE = 'https://www.okx.com';

// ===== 2. 交易参数（✅ 关键修复）=====
// OKX DOGE 现货最小下单数量 = 10 DOGE
const MIN_DOGE_AMOUNT = 10;
const TRADE_USDT = 20; // 至少 20 USDT，防止算出来不够 10 DOGE

// ===== 3. 持仓状态 =====
let activePosition = null;

// ===== 4. 签名 =====
function sign(ts, method, path, body = '') {
  return crypto.createHmac('sha256', SECRET).update(ts + method + path + body).digest('base64');
}

// ===== 5. 获取行情 =====
async function getMarketData() {
  const res = await fetch(`${BASE}/api/v5/market/ticker?instId=DOGE-USDT`);
  const json = await res.json();
  if (json.code !== '0') throw new Error('行情失败:' + json.msg);
  const p = Number(json.data[0].last);
  if (!p || p <= 0) throw new Error('价格无效');
  return { price: p };
}

// ===== 6. 执行交易（✅ 强制满足最小数量）=====
async function executeTrade(side, price) {
  let amount = Math.floor(TRADE_USDT / price);

  // ✅ 强制满足 OKX 最小下单量
  if (amount < MIN_DOGE_AMOUNT) {
    amount = MIN_DOGE_AMOUNT;
  }

  if (MODE === 'DEMO') {
    return { success: true, demo: true, side, price, amount };
  }

  const path = '/api/v5/trade/order';
  const body = JSON.stringify({
    instId: 'DOGE-USDT',
    tdMode: 'cash',
    side: side.toLowerCase(),
    ordType: 'market',
    sz: amount.toString()
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
    return { success: true, orderId: data.data[0].ordId, amount };
  }

  return { success: false, error: data.msg };
}

// ===== 7. 主入口 =====
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { action } = req.query;
    const { price } = await getMarketData();

    // ✅ 手动买入（强制）
    if (action === 'buy') {
      if (activePosition) {
        return res.json({ success: false, error: '已有持仓，请先卖出' });
      }

      const result = await executeTrade('BUY', price);

      if (result.success) {
        activePosition = { price, amount: result.amount };
        return res.json({
          success: true,
          action: 'BUY',
          message: `成功买入 ${result.amount} DOGE`
        });
      }

      // ✅ 这里一定会返回真实失败原因
      return res.json({ success: false, error: result.error });
    }

    // ✅ 手动卖出
    if (action === 'sell') {
      if (!activePosition) {
        return res.json({ success: false, error: '没有持仓' });
      }

      const result = await executeTrade('SELL', price);
      if (result.success) activePosition = null;
      return res.json({ success: result.success, action: 'SELL', error: result.error });
    }

    res.json({ success: true, price, holding: !!activePosition });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
