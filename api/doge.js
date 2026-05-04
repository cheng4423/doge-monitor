// api/doge.js
// ✅ 防御型终极版（解决 undefined / toFixed 报错 / 无法交易）
import crypto from 'crypto';

// ===== 1. 环境 =====
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'REAL';
const BASE = 'https://www.okx.com';

// ===== 2. 交易参数 =====
const TRADE_USDT = 20; // 提高金额，防止数量太小

// ===== 3. 持仓状态 =====
let activePosition = null;

// ===== 4. 签名 =====
function sign(ts, method, path, body = '') {
  return crypto.createHmac('sha256', SECRET).update(ts + method + path + body).digest('base64');
}

// ===== 5. 获取行情（✅ 核心防御）=====
async function getMarketData() {
  try {
    const res = await fetch(`${BASE}/api/v5/market/ticker?instId=DOGE-USDT`);
    const json = await res.json();

    // ✅ 防御1：API 返回失败
    if (json.code !== '0') {
      throw new Error(`OKX Error: ${json.msg}`);
    }

    // ✅ 防御2：数据结构异常
    if (!json.data || !json.data[0] || !json.data[0].last) {
      throw new Error('行情数据为空或格式错误');
    }

    const lastPrice = Number(json.data[0].last);

    // ✅ 防御3：价格不是有效数字
    if (isNaN(lastPrice) || lastPrice <= 0) {
      throw new Error('获取到的价格无效');
    }

    return {
      price: lastPrice,
      open: Number(json.data[0].open24h) || lastPrice
    };
  } catch (err) {
    throw new Error('获取行情失败: ' + err.message);
  }
}

// ===== 6. 执行交易 =====
async function executeTrade(side, price) {
  // ✅ 确保价格是数字
  const safePrice = Number(price);
  if (isNaN(safePrice)) {
    return { success: false, error: '交易价格无效' };
  }

  // ✅ 计算数量（DOGE 必须整数）
  let amount = Math.floor(TRADE_USDT / safePrice);

  // ✅ 防止算出来是 0
  if (amount <= 0) {
    return { success: false, error: `金额太小，只能买 ${amount} 个，无法下单` };
  }

  // ✅ DEMO 模式
  if (MODE === 'DEMO') {
    return { success: true, demo: true, side, price: safePrice, amount };
  }

  // ✅ 实盘
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
        return res.json({ success: true, action: 'BUY', message: `买入成功 ${result.amount} DOGE` });
      }

      // ❗ 这里一定会把错误抛给前端
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
    // ✅ 捕获所有未知错误
    res.status(500).json({ success: false, error: err.message });
  }
}
