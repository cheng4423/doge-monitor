// api/doge.js
// 🎯 DOGE 量化交易系统 - 欧易标准接口
import crypto from 'crypto';

// 配置
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const MODE = process.env.TRADE_MODE || 'DEMO';
const BASE = 'https://www.okx.com';

// 🎯 交易参数
const TRADE_AMOUNT = 10;           // 每单 10 USDT
const TARGET_PROFIT = 0.02;        // 目标盈利率 2%
const STOP_LOSS = 0.01;            // 止损 1%
const MAX_POSITION = 0.1;          // 最大仓位 10%
const FEE_RATE = 0.001;            // 手续费 0.1%

// 全局变量
let positions = new Map();         // 持仓记录
let tradeHistory = [];             // 交易历史
let priceHistory = [];             // 价格历史

// 🔐 欧易签名
function sign(timestamp, method, path, body = '') {
  const message = timestamp + method + path + body;
  return crypto.createHmac('sha256', SECRET).update(message).digest('base64');
}

// 📈 获取欧易标准数据
async function fetchOKXData() {
  try {
    // 1. 实时价格
    const tickerRes = await fetch(`${BASE}/api/v5/market/ticker?instId=DOGE-USDT`);
    const tickerData = await tickerRes.json();
    
    // 2. K线数据（用于分析）
    const klineRes = await fetch(`${BASE}/api/v5/market/candles?instId=DOGE-USDT&bar=1m&limit=100`);
    const klineData = await klineRes.json();
    
    // 3. 深度数据
    const depthRes = await fetch(`${BASE}/api/v5/market/books?instId=DOGE-USDT&sz=5`);
    const depthData = await depthRes.json();
    
    if (tickerData.code !== '0' || klineData.code !== '0' || depthData.code !== '0') {
      throw new Error('欧易API返回错误');
    }
    
    const ticker = tickerData.data[0];
    const klines = klineData.data;
    const depth = depthData.data[0];
    
    // 解析标准数据
    const price = parseFloat(ticker.last);
    const open = parseFloat(ticker.open24h);
    const high = parseFloat(ticker.high24h);
    const low = parseFloat(ticker.low24h);
    const vol = parseFloat(ticker.vol24h);
    const volCcy = parseFloat(ticker.volCcy24h);
    const ts = parseInt(ticker.ts);
    
    const change = ((price - open) / open) * 100;
    const changeAbs = price - open;
    
    // 计算技术指标
    const closes = klines.map(k => parseFloat(k[4])).slice(-20);
    const volumes = klines.map(k => parseFloat(k[5])).slice(-20);
    
    const ma5 = closes.slice(-5).reduce((a, b) => a + b) / 5;
    const ma10 = closes.slice(-10).reduce((a, b) => a + b) / 10;
    const avgVol = volumes.reduce((a, b) => a + b) / volumes.length;
    
    // RSI计算
    let gains = 0, losses = 0;
    for (let i = 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rsi = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
    
    return {
      // 基础数据
      price, open, high, low, vol, volCcy, ts,
      change: parseFloat(change.toFixed(2)),
      changeAbs: parseFloat(changeAbs.toFixed(6)),
      
      // 技术指标
      ma5: parseFloat(ma5.toFixed(6)),
      ma10: parseFloat(ma10.toFixed(6)),
      rsi: parseFloat(rsi.toFixed(2)),
      volumeRatio: parseFloat((vol / avgVol).toFixed(2)),
      
      // 深度数据
      bids: depth.bids.slice(0, 3),  // 买3档
      asks: depth.asks.slice(0, 3),  // 卖3档
      spread: parseFloat((parseFloat(depth.asks[0][0]) - parseFloat(depth.bids[0][0])).toFixed(6)),
      
      // K线数据
      klines: klines.slice(-10).map(k => ({
        time: parseInt(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        vol: parseFloat(k[5])
      }))
    };
    
  } catch (err) {
    console.error('获取欧易数据失败:', err);
    throw err;
  }
}

// 🧠 AI量化分析引擎
async function analyzeMarket() {
  const data = await fetchOKXData();
  
  // 保存价格历史
  priceHistory.push({
    price: data.price,
    time: Date.now(),
    ...data
  });
  if (priceHistory.length > 1000) priceHistory.shift();
  
  let signals = [];
  let confidence = 0;
  
  // 策略1: 均线策略
  if (data.price > data.ma5 && data.ma5 > data.ma10) {
    signals.push({
      name: 'MA金叉',
      score: 65,
      reason: `价格${data.price} > MA5${data.ma5} > MA10${data.ma10}`
    });
  } else if (data.price < data.ma5 && data.ma5 < data.ma10) {
    signals.push({
      name: 'MA死叉', 
      score: -60,
      reason: `价格${data.price} < MA5${data.ma5} < MA10${data.ma10}`
    });
  }
  
  // 策略2: RSI策略
  if (data.rsi < 30) {
    signals.push({
      name: 'RSI超卖',
      score: 70,
      reason: `RSI=${data.rsi} < 30，超卖反弹机会`
    });
  } else if (data.rsi > 70) {
    signals.push({
      name: 'RSI超买',
      score: -65,
      reason: `RSI=${data.rsi} > 70，超买回调风险`
    });
  }
  
  // 策略3: 量价策略
  if (data.volumeRatio > 1.5 && data.change > 0) {
    signals.push({
      name: '放量上涨',
      score: 75,
      reason: `成交量放大${data.volumeRatio}x，上涨${data.change}%`
    });
  } else if (data.volumeRatio > 1.5 && data.change < 0) {
    signals.push({
      name: '放量下跌',
      score: -70,
      reason: `成交量放大${data.volumeRatio}x，下跌${data.change}%`
    });
  }
  
  // 策略4: 突破策略
  if (data.price > data.high * 0.998) {
    signals.push({
      name: '突破前高',
      score: 80,
      reason: `接近日高${data.high}，差${((data.high - data.price) / data.price * 100).toFixed(2)}%`
    });
  } else if (data.price < data.low * 1.002) {
    signals.push({
      name: '跌破前低',
      score: -75,
      reason: `接近日低${data.low}，差${((data.price - data.low) / data.low * 100).toFixed(2)}%`
    });
  }
  
  // 策略5: 震荡策略
  if (Math.abs(data.change) < 0.5 && data.spread < 0.001) {
    signals.push({
      name: '窄幅震荡',
      score: 20,
      reason: `波动${data.change}%，价差${data.spread}，适合高抛低吸`
    });
  }
  
  // 计算综合信号
  let totalScore = 0;
  signals.forEach(s => totalScore += s.score);
  const avgScore = signals.length > 0 ? totalScore / signals.length : 0;
  
  let action = 'HOLD';
  let reason = '等待信号';
  
  if (avgScore >= 50) {
    action = 'BUY';
    confidence = Math.min(100, avgScore + 20);
    reason = `强烈买入信号，综合评分${avgScore.toFixed(1)}`;
  } else if (avgScore <= -40) {
    action = 'SELL';
    confidence = Math.min(100, -avgScore + 20);
    reason = `强烈卖出信号，综合评分${avgScore.toFixed(1)}`;
  } else {
    action = 'HOLD';
    confidence = 50 - Math.abs(avgScore);
    reason = `中性观望，综合评分${avgScore.toFixed(1)}`;
  }
  
  return {
    action,
    reason,
    confidence: Math.round(confidence),
    signals,
    data: {
      price: data.price,
      change: data.change,
      rsi: data.rsi,
      ma5: data.ma5,
      ma10: data.ma10,
      volumeRatio: data.volumeRatio
    },
    raw: data
  };
}

// 💰 执行交易
async function executeTrade(side, price, amount) {
  if (MODE === 'DEMO') {
    const orderId = `DEMO_${Date.now()}_${side}`;
    tradeHistory.push({
      orderId,
      side,
      price,
      amount,
      time: Date.now(),
      mode: 'DEMO'
    });
    return { success: true, orderId, demo: true };
  }
  
  const ts = new Date().toISOString();
  const path = '/api/v5/trade/order';
  const body = JSON.stringify({
    instId: 'DOGE-USDT',
    tdMode: 'cash',
    side: side.toLowerCase(),
    ordType: 'market',
    sz: amount.toFixed(0)
  });
  
  try {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': API_KEY,
        'OK-ACCESS-SIGN': sign(ts, 'POST', path, body),
        'OK-ACCESS-TIMESTAMP': ts,
        'OK-ACCESS-PASSPHRASE': PASSPHRASE
      },
      body
    });
    
    const data = await res.json();
    
    if (data.code === '0') {
      const order = {
        orderId: data.data[0].ordId,
        side,
        price,
        amount,
        time: Date.now(),
        mode: 'REAL'
      };
      tradeHistory.push(order);
      
      // 记录持仓
      if (side === 'BUY') {
        positions.set(order.orderId, {
          ...order,
          takeProfit: price * (1 + TARGET_PROFIT),
          stopLoss: price * (1 - STOP_LOSS)
        });
      } else {
        positions.delete(order.orderId);
      }
      
      return { success: true, ...order };
    } else {
      return { success: false, error: data.msg };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 🎯 检查持仓止盈止损
async function checkPositions() {
  const data = await fetchOKXData();
  const currentPrice = data.price;
  const actions = [];
  
  for (const [orderId, position] of positions) {
    const profitRate = (currentPrice - position.price) / position.price;
    
    if (currentPrice >= position.takeProfit) {
      actions.push({
        orderId,
        action: 'SELL',
        reason: `止盈触发: ${profitRate.toFixed(4)*100}% > ${TARGET_PROFIT*100}%`,
        price: currentPrice,
        profit: (currentPrice - position.price) * position.amount
      });
    } else if (currentPrice <= position.stopLoss) {
      actions.push({
        orderId,
        action: 'SELL',
        reason: `止损触发: ${profitRate.toFixed(4)*100}% < -${STOP_LOSS*100}%`,
        price: currentPrice,
        profit: (currentPrice - position.price) * position.amount
      });
    }
  }
  
  return actions;
}

// 📊 主函数
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  const { action = 'analyze', type = 'auto' } = req.query;
  
  try {
    if (action === 'analyze') {
      // 分析市场
      const analysis = await analyzeMarket();
      const positionActions = await checkPositions();
      
      res.status(200).json({
        success: true,
        mode: MODE,
        analysis,
        positions: Array.from(positions.values()),
        positionActions,
        priceHistory: priceHistory.slice(-50),
        stats: {
          totalTrades: tradeHistory.length,
          todayTrades: tradeHistory.filter(t => 
            Date.now() - t.time < 86400000
          ).length,
          positionsCount: positions.size
        }
      });
      
    } else if (action === 'trade') {
      // 执行交易
      const analysis = await analyzeMarket();
      
      if (type === 'auto' && analysis.action !== 'HOLD') {
        const amount = (TRADE_AMOUNT / analysis.data.price).toFixed(0);
        const result = await executeTrade(
          analysis.action, 
          analysis.data.price, 
          amount
        );
        
        res.status(200).json({
          success: result.success,
          mode: MODE,
          action: analysis.action,
          reason: analysis.reason,
          result,
          analysis
        });
      } else {
        res.status(200).json({
          success: false,
          mode: MODE,
          reason: '无交易信号',
          analysis
        });
      }
      
    } else if (action === 'history') {
      // 获取历史
      res.status(200).json({
        success: true,
        priceHistory,
        tradeHistory,
        positions: Array.from(positions.values())
      });
      
    } else if (action === 'clear') {
      // 清空数据
      positions.clear();
      tradeHistory = [];
      priceHistory = [];
      
      res.status(200).json({ success: true, message: '已清空' });
      
    } else {
      res.status(400).json({ success: false, error: '未知操作' });
    }
    
  } catch (error) {
    console.error('API错误:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      mode: MODE
    });
  }
}
