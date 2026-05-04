// api/doge.js
// ✅ 最终修复版 - 解决 toFixed 报错 & 无法买入
import crypto from 'crypto';

// ===== 1. 环境配置（Vercel 后台设置）=====
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'DEMO'; // 默认 DEMO
const BASE = 'https://www.okx.com';

// ===== 2. 交易参数 =====
const TRADE_AMOUNT_USDT = 10;   // 每次10 USDT
const BUY_CHANGE = -0.3;         // 跌0.3%就买（容易触发测试）
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

  // 有持仓：看止盈止损
  if (activePosition) {
    const profit = (price - activePosition.price) / activePosition.price;
    if (profit >= SELL_TARGET) {
      action = 'SELL';
      reason = `止盈 ${(profit * 100).toFixed(2)}%`;
    } else if (profit <= -STOP_LOSS) {
      action = 'SELL';
      reason = `止损 ${(profit * 100).toFixed(2)}%`;
    }
  } 
  // 无持仓：看买入机会
  else if (change <= BUY_CHANGE) {
    action = 'BUY';
    reason = `跌幅 ${change.toFixed(2)}%，触发买入`;
  }

  return { action, reason, price, change };
}

// ===== 7. 执行交易（核心修复）=====
async function executeTrade(side, price) {
  // ✅ 修复1：强制转为数字
  const numPrice = Number(price);
  
  // ✅ 修复2：欧易 DOGE 现货必须是正整数
  // 计算能买多少个 DOGE（向下取整，避免小数报错）
  const amount = Math.floor(TRADE_AMOUNT_USDT / numPrice);

  // 防御性检查：如果钱太少买不到1个，直接返回失败
  if (amount <= 0) {
    return { success: false, error: '金额太小，无法购买至少1个DOGE' };
  }

  // ✅ DEMO 模式（模拟盘）
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

  // ✅ 实盘模式
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

  const res = await fetch(BASE + path, { method: 'POST', headers, body });
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
    const signal = await analyzeSignal();

    // 手动/自动 买入
    if ((action === 'buy' || action === 'auto') && signal.action === 'BUY' && !activePosition) {
      const result = await executeTrade('BUY', signal.price);
      if (result.success) {
        activePosition = { price: signal.price, amount: result.amount };
      }
      return res.json({ success: result.success, mode: MODE, action: 'BUY', result });
    }

    // 手动/自动 卖出
    if ((action === 'sell' || action === 'auto') && signal.action === 'SELL' && activePosition) {
      const result = await executeTrade('SELL', signal.price);
      if (result.success) {
        activePosition = null;
      }
      return res.json({ success: result.success, mode: MODE, action: 'SELL', result });
    }

    // 仅分析
    res.json({ success: true, mode: MODE, ...signal });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
