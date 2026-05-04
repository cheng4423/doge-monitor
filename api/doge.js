// api/doge.js
// ⚠️ 实盘自动交易系统（高风险！）
import crypto from 'crypto';

const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const TRADE_MODE = process.env.TRADE_MODE || 'DEMO'; // DEMO 或 REAL
const BASE = 'https://www.okx.com';

// 欧易签名
function sign(timestamp, method, path, body = '') {
  const message = timestamp + method + path + body;
  return crypto.createHmac('sha256', SECRET).update(message).digest('base64');
}

// 🧠 AI 交易策略
function getTradingSignal(price, history) {
  if (history.length < 5) return { action: 'HOLD', reason: '数据不足' };
  
  const last5 = history.slice(-5);
  const avg = last5.reduce((a,b) => a + b) / 5;
  const change = ((price - avg) / avg) * 100;
  
  if (change <= -2.5) {
    return { 
      action: 'BUY', 
      reason: `价格低于5周期均价 ${change.toFixed(2)}%，超跌反弹机会`,
      confidence: 85
    };
  }
  if (change >= 3.0) {
    return { 
      action: 'SELL', 
      reason: `价格高于5周期均价 ${change.toFixed(2)}%，获利了结`,
      confidence: 80
    };
  }
  return { action: 'HOLD', reason: '波动较小，观望', confidence: 60 };
}

// 📈 执行实盘交易
async function executeTrade(signal, price, balance) {
  if (TRADE_MODE === 'DEMO') {
    return { success: true, orderId: 'DEMO_' + Date.now(), mode: '模拟' };
  }
  
  const timestamp = new Date().toISOString();
  const path = '/api/v5/trade/order';
  
  // 仓位管理：每次下单 5%
  const usdtAmount = balance * 0.05;
  const dogeAmount = (usdtAmount / price).toFixed(0);
  
  const body = JSON.stringify({
    instId: 'DOGE-USDT',
    tdMode: 'cash',
    side: signal.action === 'BUY' ? 'buy' : 'sell',
    ordType: 'market',
    sz: dogeAmount
  });
  
  try {
    const response = await fetch(BASE + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': API_KEY,
        'OK-ACCESS-SIGN': sign(timestamp, 'POST', path, body),
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': PASSPHRASE
      },
      body
    });
    
    const data = await response.json();
    return { 
      success: data.code === '0', 
      orderId: data.data?.[0]?.ordId,
      data: data
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  const { action = 'analyze' } = req.query; // analyze 或 trade

  try {
    // 1. 获取价格
    const tickerRes = await fetch(`${BASE}/api/v5/market/ticker?instId=DOGE-USDT`);
    const tickerData = await tickerRes.json();
    const price = parseFloat(tickerData.data[0].last);
    
    // 历史数据
    if (!global.priceHistory) global.priceHistory = [];
    global.priceHistory.push(price);
    if (global.priceHistory.length > 50) global.priceHistory.shift();
    
    // 2. 🧠 AI 信号
    const signal = getTradingSignal(price, global.priceHistory);
    
    // 3. 获取余额
    const timestamp = new Date().toISOString();
    const balanceRes = await fetch(`${BASE}/api/v5/account/balance`, {
      headers: {
        'OK-ACCESS-KEY': API_KEY,
        'OK-ACCESS-SIGN': sign(timestamp, 'GET', '/api/v5/account/balance'),
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': PASSPHRASE
      }
    });
    const balanceData = await balanceRes.json();
    const usdtBalance = parseFloat(balanceData.data[0]?.details?.find(d => d.ccy === 'USDT')?.availBal || 0);
    
    // 4. 执行交易
    let tradeResult = null;
    if (action === 'trade' && signal.action !== 'HOLD') {
      tradeResult = await executeTrade(signal, price, usdtBalance);
    }
    
    res.status(200).json({
      success: true,
      mode: TRADE_MODE,
      price,
      signal: signal.action,
      reason: signal.reason,
      confidence: signal.confidence,
      balance: usdtBalance.toFixed(2),
      tradeResult,
      history: global.priceHistory.slice(-10)
    });

  } catch (error) {
    console.error('实盘错误:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      mode: TRADE_MODE
    });
  }
}
