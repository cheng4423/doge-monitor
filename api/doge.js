// api/doge.js
// ✅ 中文修复版（解决 undefined / 英文显示）
import crypto from 'crypto';

// ===== 1. 环境配置 =====
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'DEMO';
const BASE = 'https://www.okx.com';

// ===== 2. 交易参数 =====
const TRADE_AMOUNT_USDT = 10;
const BUY_CHANGE = -0.3;
const SELL_TARGET = 0.01;
const STOP_LOSS = 0.005;

// ===== 3. 状态 =====
let activePosition = null;

// ===== 4. 签名 =====
function sign(timestamp, method, path, body = '') {
  return crypto
    .createHmac('sha256', SECRET)
    .update(timestamp + method + path + body)
    .digest('base64');
}

// ===== 5. 获取行情 =====
async function getMarketData() {
  const res = await fetch(`${BASE}/api/v5/market/ticker?instId=DOGE-USDT`);
  const json = await res.json();
  if (json.code !== '0') throw new Error('获取行情失败');
  const t = json.data[0];
  return {
    price: Number(t.last),
    open: Number(t.open24h)
  };
}

// ===== 6. AI 策略（✅ 中文 + 防 undefined）=====
async function analyzeSignal() {
  const { price, open } = await getMarketData();
  const change = ((price - open) / open) * 100;

  let action = 'HOLD';
  let reason = '波动正常，AI 选择观望';
  let confidence = 0;

  if (activePosition) {
    const profit = (price - activePosition.price) / activePosition.price;
    if (profit >= SELL_TARGET) {
      action = 'SELL';
      reason = `达到止盈 ${(profit * 100).toFixed(2)}%`;
      confidence = 80;
    } else if (profit <= -STOP_LOSS) {
      action = 'SELL';
      reason = `触发止损 ${(profit * 100).toFixed(2)}%`;
      confidence = 85;
    } else {
      reason = `持仓中，浮动 ${(profit * 100).toFixed(2)}%`;
      confidence = 50;
    }
  } else if (change <= BUY_CHANGE) {
    action = 'BUY';
    reason = `下跌 ${change.toFixed(2)}%，AI 判定为买入机会`;
    confidence = 75;
  }

  return {
    action,
    reason,
    confidence,
    price,
    change: Number(change.toFixed(2))
  };
}

// ===== 7. 执行交易 =====
async function executeTrade(side, price) {
  const numPrice = Number(price);
  const amount = Math.floor(TRADE_AMOUNT_USDT / numPrice);

  if (amount <= 0) {
    return { success: false, error: '金额太小，无法购买' };
  }

  if (MODE === 'DEMO') {
    return {
      success: true,
      demo: true,
      side,
      price: numPrice.toFixed(6),
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

// ===== 8. 主入口 =====
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { action } = req.query;
    const signal = await analyzeSignal();

    // ✅ 默认：防止 undefined
    if (signal.confidence === undefined) signal.confidence = 0;
    if (signal.reason === undefined) signal.reason = 'AI 分析中...';

    if (action === 'buy' && signal.action === 'BUY' && !activePosition) {
      const result = await executeTrade('BUY', signal.price);
      if (result.success) activePosition = { price: signal.price, amount: result.amount };
      return res.json({ success: result.success, mode: MODE, action: 'BUY', result });
    }

    if (action === 'sell' && signal.action === 'SELL' && activePosition) {
      const result = await executeTrade('SELL', signal.price);
      if (result.success) activePosition = null;
      return res.json({ success: result.success, mode: MODE, action: 'SELL', result });
    }

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
      return res.json({ success: true, mode: MODE, action: signal.action, reason: signal.reason, confidence: signal.confidence });
    }

    res.json({
      success: true,
      mode: MODE,
      action: signal.action,
      reason: signal.reason,
      confidence: signal.confidence
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || '系统错误'
    });
  }
}
