// api/doge.js
// ✅ 强制买入修复版
import crypto from 'crypto';

// ===== 1. 环境 =====
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'REAL'; // 强制 REAL
const BASE = 'https://www.okx.com';

// ===== 2. 交易参数（放大，防止买不到）=====
const MIN_TRADE_USDT = 20;   // ✅ 最少 20 USDT，防止数量太小
const MAX_DOGE = 300;        // ✅ 最多买 300 个，防翻车

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
  const d = json.data[0];
  return {
    price: Number(d.last),
    open: Number(d.open24h)
  };
}

// ===== 6. 执行交易（核心）=====
async function executeTrade(side, price) {
  let amount = Math.floor(MIN_TRADE_USDT / price);
  amount = Math.min(amount, MAX_DOGE);

  if (amount <= 0) {
    return { success: false, error: '数量过小，无法买入' };
  }

  // ✅ DEMO 直接成功
  if (MODE === 'DEMO') {
    return {
      success: true,
      demo: true,
      side,
      price,
      amount
    };
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

    // ✅ 手动买入（强制，不走策略）
    if (action === 'buy') {
      if (activePosition) {
        return res.json({ success: false, error: '已有持仓，请先卖出' });
      }

      const result = await executeTrade('BUY', price);

      if (result.success) {
        activePosition = { price, amount: result.amount };
        return res.json({
          success: true,
          mode: MODE,
          action: 'BUY',
          message: `成功买入 ${result.amount} DOGE`,
          result
        });
      }

      // ❗ 这里一定会把错误返回给前端
      return res.json({
        success: false,
        mode: MODE,
        action: 'BUY',
        error: result.error
      });
    }

    // ✅ 手动卖出
    if (action === 'sell') {
      if (!activePosition) {
        return res.json({ success: false, error: '没有持仓可卖' });
      }

      const result = await executeTrade('SELL', price);
      if (result.success) activePosition = null;

      return res.json({
        success: result.success,
        mode: MODE,
        action: 'SELL',
        result
      });
    }

    // ✅ 状态查询
    res.json({
      success: true,
      mode: MODE,
      price,
      holding: !!activePosition
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
