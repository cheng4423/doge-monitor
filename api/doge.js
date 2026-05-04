// api/doge.js
// ✅ 最终修复版 - 解决 toFixed 报错 & 无法买卖
import crypto from 'crypto';

// ===== 1. 环境配置 =====
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'DEMO';
const BASE = 'https://www.okx.com';

// ===== 2. 交易参数 =====
const TRADE_AMOUNT_USDT = 10;   // 每次10 USDT
const BUY_CHANGE = -0.3;         // 跌0.3%就买（更容易触发测试）
const SELL_TARGET = 0.01;        // 涨1%就卖
const STOP_LOSS = 0.005;         // 跌0.5%就割

// ===== 3. 状态缓存 =====
let activePosition = null;

// ===== 4. 欧易签名 =====
function sign(timestamp, method, path, body = '') {
  return crypto.createHmac('sha256', SECRET).update(timestamp + method + path + body).digest('base64');
}

// ===== 5. 获取行情 =====
async function getMarketData() {
  const res = await fetch(`${BASE}/api/v5/market/ticker?instId=DOGE-USDT`);
  const json = await res.json();
  if (json.code !== '0') throw new Error('欧易行情失败: ' + json.msg);
  
  const t = json.data[0];
  return {
    price: Number(t.last),
    open: Number(t.open24h)
  };
}

// ===== 6. AI 策略 =====
async function analyzeSignal() {
  const { price, open } = await getMarketData();
  const change = ((price - open) / open) * 100;
  let action = 'HOLD';
  let reason = `波动 ${change.toFixed(2)}%，观望`;

  // 如果有持仓，看止盈止损
  if (activePosition) {
    const profit = (price - activePosition.price) / activePosition.price;
    if (profit >= SELL_TARGET) {
      action = 'SELL';
      reason = `止盈 ${(profit * 100).toFixed(2)}%`;
    } else if (profit <= -STOP_LOSS) {
      action = 'SELL';
      reason = `止损 ${(profit * 100).toFixed(2)}%`;
    } else {
      reason = `持仓中，浮盈 ${(profit * 100).toFixed(2)}%`;
    }
  } 
  // 如果没持仓，看买入机会
  else if (change <= BUY_CHANGE) {
    action = 'BUY';
    reason = `跌幅 ${change.toFixed(2)}%，触发买入`;
  }

  return { action, reason, price, change };
}

// ===== 7. 执行交易（修复核心）=====
async function executeTrade(side, price) {
  // ✅ 修复点1：强制转为数字，防止 toFixed 报错
  const numPrice = Number(price);
  // ✅ 修复点2：欧易 DOGE 必须是正整数
  const amount = Math.floor(TRADE_AMOUNT_USDT / numPrice); 

  if (amount <= 0) {
    return { success: false, error: '金额太小，计算出的数量为0' };
  }

  // DEMO 模式直接返回成功
  if (MODE === 'DEMO') {
    return {
      success: true,
      demo: true,
      orderId: `DEMO_${Date.now()}`,
      side,
      price: numPrice.toFixed(6),
      amount: amount
    };
  }

  // 实盘下单
  const path = '/api/v5/trade/order';
  const body = JSON.stringify({
    instId: 'DOGE-USDT',
    tdMode: 'cash',
    side: side.toLowerCase(),
    ordType: 'market',
    sz: amount.toString() // 必须是字符串
  });

  const ts = new Date().toISOString();
  const headers = {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': API_KEY,
    'OK-ACCESS-SIGN': sign(ts, 'POST', path, body),
    'OK-ACCESS-TIMESTAMP': ts,
    'OK-ACCESS-PASSPHRASE': PASSPHRASE
  };

  const res = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();

  if (data.code === '0') {
    return { success: true, orderId: data.data[0].ordId, amount };
  } else {
    return { success: false, error: data.msg };
  }
}

// ===== 8. 主入口 =====
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { action } = req.query;

    // 1. 分析信号
    const signal = await analyzeSignal();

    // 2. 执行买入
    if (action === 'buy' && signal.action === 'BUY' && !activePosition) {
      const result = await executeTrade('BUY', signal.price);
      if (result.success) {
        activePosition = { price: signal.price, amount: result.amount };
      }
      return res.json({ success: result.success, mode: MODE, action: 'BUY', result });
    }

    // 3. 执行卖出
    if (action === 'sell' && activePosition) {
      const result = await executeTrade('SELL', signal.price);
      if (result.success) {
        activePosition = null;
      }
      return res.json({ success: result.success, mode: MODE, action: 'SELL', result });
    }

    // 4. 自动交易
    if (action === 'auto') {
      let result = null;
      if (signal.action === 'BUY' && !activePosition) {
        result = await executeTrade('BUY', signal.price);
        if (result.success) activePosition = { price: signal.price, amount: result.amount };
      }
      if (signal.action === 'SELL' && activePosition) {
        result = await executeTrade('SELL', signal.price);
        if (result.success) activePosition = null;
      }
      return res.json({ success: true, mode: MODE, action: signal.action, reason: signal.reason, result });
    }

    // 5. 仅分析
    res.json({ success: true, mode: MODE, ...signal });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
