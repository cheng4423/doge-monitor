// api/doge.js
// ✅ 最终稳定版（解决所有历史报错）
import crypto from 'crypto';

// ===== 1. 环境 =====
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'REAL';
const BASE = 'https://www.okx.com';

// ===== 2. 交易参数（✅ 关键修复）=====
// OKX DOGE 现货最小下单数量 = 10 DOGE
const MIN_DOGE = 10;
const TRADE_USDT = 25; // 提高金额，确保大于最小数量

// ===== 3. 持仓状态 =====
let activePosition = null;

// ===== 4. 签名 =====
function sign(ts, method, path, body = '') {
  return crypto.createHmac('sha256', SECRET).update(ts + method + path + body).digest('base64');
}

// ===== 5. 获取行情（✅ 防 HTML 返回）=====
async function getMarketData() {
  try {
    const res = await fetch(`${BASE}/api/v5/market/ticker?instId=DOGE-USDT`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const text = await res.text();

    // ✅ 如果返回的不是 JSON（比如 HTML 风控页）
    if (!text.startsWith('{')) {
      throw new Error('OKX 返回非 JSON（可能被风控）');
    }

    const json = JSON.parse(text);

    if (json.code !== '0') {
      throw new Error(json.msg);
    }

    const price = Number(json.data[0].last);
    if (isNaN(price) || price <= 0) {
      throw new Error('价格无效');
    }

    return { price };
  } catch (err) {
    throw new Error('获取行情失败: ' + err.message);
  }
}

// ===== 6. 执行交易 =====
async function executeTrade(side, price) {
  let amount = Math.floor(TRADE_USDT / price);

  // ✅ 强制满足 OKX 最小数量
  if (amount < MIN_DOGE) {
    amount = MIN_DOGE;
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

    // ✅ 手动买入（强制）
    if (action === 'buy') {
      if (activePosition) {
        return res.json({ success: false, error: '已有持仓，请先卖出' });
      }

      const { price } = await getMarketData();
      const result = await executeTrade('BUY', price);

      if (result.success) {
        activePosition = { price, amount: result.amount };
        return res.json({
          success: true,
          action: 'BUY',
          message: `成功买入 ${result.amount} DOGE`
        });
      }

      return res.json({ success: false, error: result.error });
    }

    // ✅ 手动卖出
    if (action === 'sell') {
      if (!activePosition) {
        return res.json({ success: false, error: '没有持仓' });
      }

      const { price } = await getMarketData();
      const result = await executeTrade('SELL', price);
      if (result.success) activePosition = null;

      return res.json({ success: result.success, action: 'SELL', error: result.error });
    }

    // ✅ 状态
    const { price } = await getMarketData();
    res.json({ success: true, price, holding: !!activePosition });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
