// api/doge.js
// ⚠️ 实盘自动交易系统 - 连接欧易
import crypto from 'crypto';

// 环境变量（在Vercel中设置）
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const TRADE_MODE = process.env.TRADE_MODE || 'DEMO'; // DEMO 或 REAL
const BASE = 'https://www.okx.com';

// 🎯 交易参数（按你的要求：每单盈利1元）
const TRADE_AMOUNT = 10;       // 每次10 USDT
const TARGET_PROFIT = 0.02;    // 目标盈利率2%（约0.2元）
const STOP_LOSS = 0.01;        // 止损1%
const FEE_RATE = 0.001;        // 手续费0.1%

// 全局状态
let activePosition = null;     // 当前持仓
let tradeHistory = [];         // 交易记录

// 🔐 欧易签名
function sign(timestamp, method, path, body = '') {
  const message = timestamp + method + path + body;
  return crypto.createHmac('sha256', SECRET).update(message).digest('base64');
}

// 📈 获取欧易实时数据
async function getMarketData() {
  const response = await fetch(`${BASE}/api/v5/market/ticker?instId=DOGE-USDT`);
  const data = await response.json();
  
  if (data.code !== '0') throw new Error(data.msg);
  
  const ticker = data.data[0];
  return {
    price: parseFloat(ticker.last),
    open: parseFloat(ticker.open24h),
    high: parseFloat(ticker.high24h),
    low: parseFloat(ticker.low24h),
    vol: parseFloat(ticker.vol24h)
  };
}

// 🧠 AI量化分析
async function analyzeSignal() {
  const data = await getMarketData();
  const change = ((data.price - data.open) / data.open) * 100;
  
  let action = 'HOLD';
  let reason = '';
  let confidence = 0;
  
  // 策略1：跌抄底
  if (change <= -1.5) {
    action = 'BUY';
    confidence = 75;
    reason = `下跌 ${change.toFixed(2)}%，AI判定超卖`;
  }
  // 策略2：涨止盈
  else if (change >= 2.0) {
    action = 'SELL';
    confidence = 70;
    reason = `上涨 ${change.toFixed(2)}%，建议止盈`;
  }
  // 策略3：持仓检查
  else if (activePosition) {
    const profit = (data.price - activePosition.price) / activePosition.price;
    
    if (profit >= TARGET_PROFIT) {
      action = 'SELL';
      reason = `达到止盈 ${(profit*100).toFixed(2)}%`;
    } else if (profit <= -STOP_LOSS) {
      action = 'SELL';
      reason = `触发止损 ${(profit*100).toFixed(2)}%`;
    } else {
      action = 'HOLD';
      reason = `持仓中，浮动 ${(profit*100).toFixed(2)}%`;
    }
  }
  // 策略4：横盘观望
  else {
    action = 'HOLD';
    reason = `波动 ${change.toFixed(2)}%，等待机会`;
  }
  
  return {
    action,
    reason,
    confidence,
    price: data.price,
    change: change.toFixed(2)
  };
}

// 💰 执行交易
async function executeTrade(side, price, amount) {
  if (TRADE_MODE === 'DEMO') {
    return {
      success: true,
      demo: true,
      orderId: `DEMO_${Date.now()}`,
      side,
      price: price.toFixed(6),
      amount: amount.toFixed(0)
    };
  }
  
  const timestamp = new Date().toISOString();
  const path = '/api/v5/trade/order';
  const body = JSON.stringify({
    instId: 'DOGE-USDT',
    tdMode: 'cash',
    side: side.toLowerCase(),
    ordType: 'market',
    sz: Math.floor(amount).toString()
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
    
    if (data.code === '0') {
      return {
        success: true,
        orderId: data.data[0].ordId,
        side,
        price: price.toFixed(6),
        amount: amount.toFixed(0)
      };
    } else {
      return { success: false, error: data.msg };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 🎯 主函数
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  const { action = 'analyze' } = req.query;
  
  try {
    if (action === 'analyze') {
      // 获取分析信号
      const signal = await analyzeSignal();
      
      res.status(200).json({
        success: true,
        mode: TRADE_MODE,
        ...signal,
        hasPosition: !!activePosition,
        position: activePosition
      });
      
    } else if (action === 'buy') {
      // 手动买入
      const signal = await analyzeSignal();
      const amount = (TRADE_AMOUNT / signal.price).toFixed(0);
      
      const result = await executeTrade('BUY', signal.price, amount);
      
      if (result.success) {
        activePosition = {
          price: signal.price,
          amount: parseFloat(amount),
          time: Date.now()
        };
      }
      
      res.status(200).json({
        success: result.success,
        mode: TRADE_MODE,
        action: 'BUY',
        result,
        position: activePosition
      });
      
    } else if (action === 'sell') {
      // 手动卖出
      if (!activePosition) {
        return res.status(400).json({ success: false, error: '无持仓' });
      }
      
      const data = await getMarketData();
      const result = await executeTrade('SELL', data.price, activePosition.amount);
      
      if (result.success) {
        activePosition = null;
      }
      
      res.status(200).json({
        success: result.success,
        mode: TRADE_MODE,
        action: 'SELL',
        result
      });
      
    } else if (action === 'auto') {
      // 自动交易
      const signal = await analyzeSignal();
      let result = null;
      
      if (signal.action === 'BUY' && !activePosition) {
        const amount = (TRADE_AMOUNT / signal.price).toFixed(0);
        result = await executeTrade('BUY', signal.price, amount);
        
        if (result.success) {
          activePosition = {
            price: signal.price,
            amount: parseFloat(amount),
            time: Date.now()
          };
        }
      } 
      else if (signal.action === 'SELL' && activePosition) {
        result = await executeTrade('SELL', signal.price, activePosition.amount);
        
        if (result.success) {
          const profit = (signal.price - activePosition.price) * activePosition.amount;
          tradeHistory.push({
            buy: activePosition.price,
            sell: signal.price,
            profit: profit.toFixed(4),
            time: Date.now()
          });
          activePosition = null;
        }
      }
      
      res.status(200).json({
        success: true,
        mode: TRADE_MODE,
        action: signal.action,
        reason: signal.reason,
        result
      });
      
    } else {
      res.status(400).json({ success: false, error: '未知操作' });
    }
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      mode: TRADE_MODE
    });
  }
}
