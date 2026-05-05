// api/doge.js
import crypto from 'crypto';

/* ========= 环境配置 ========= */
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const BASE = 'https://www.okx.com';

/* ========= 交易参数 ========= */
const MIN_DOGE = 10;       // OKX 最小下单数量
const BUFFER_RATIO = 0.95; // 使用 95% 余额，留 5% 手续费缓冲
const TAKE_PROFIT = 0.03;  // 3% 止盈
const STOP_LOSS = -0.02;   // 2% 止损

/* ========= OKX 签名 ========= */
function sign(ts, method, path, body = '') {
  const prehash = ts + method + path + (body || '');
  return crypto.createHmac('sha256', SECRET)
    .update(prehash)
    .digest('base64');
}

/* ========= API 请求 ========= */
async function okxRequest(method, path, body = '') {
  if (!API_KEY || !SECRET || !PASSPHRASE) {
    throw new Error('❌ OKX API Key / Secret / Passphrase 未配置');
  }

  const ts = new Date().toISOString();
  const headers = {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': API_KEY,
    'OK-ACCESS-SIGN': sign(ts, method, path, body),
    'OK-ACCESS-TIMESTAMP': ts,
    'OK-ACCESS-PASSPHRASE': PASSPHRASE
  };

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: method === 'POST' ? body : undefined
  });

  return res.json();
}

/* ========= 获取价格 ========= */
async function getMarketPrice() {
  const json = await okxRequest('GET', '/api/v5/market/ticker?instId=DOGE-USDT');
  if (json.code !== '0') throw new Error(json.msg);
  return Number(json.data[0].last);
}

/* ========= 获取余额 ========= */
async function getAvailableBalance(ccy) {
  const json = await okxRequest('GET', `/api/v5/account/balance?ccy=${ccy}`);
  if (json.code !== '0') return 0;
  return Number(json.data[0]?.details?.[0]?.availBal || 0);
}

/* ========= 真实持仓 ========= */
async function getRealPosition() {
  const json = await okxRequest('GET', '/api/v5/account/positions?instId=DOGE-USDT');
  if (json.code !== '0') return null;
  const pos = json.data.find(p => Number(p.pos) > 0);
  return pos ? { amount: Number(pos.pos), avgPrice: Number(pos.avgPx) } : null;
}

/* ========= ✅ 动态计算下单数量 ========= */
async function calculateTradeAmount(side, price) {
  if (side === 'BUY') {
    // 获取 USDT 余额
    const usdtBalance = await getAvailableBalance('USDT');
    if (usdtBalance <= 0) {
      throw new Error(`❌ USDT 余额不足 (当前: ${usdtBalance.toFixed(2)} USDT)`);
    }
    
    // 留 5% 做手续费缓冲
    const usableUSDT = usdtBalance * BUFFER_RATIO;
    
    // 计算可买数量
    let amount = Math.floor(usableUSDT / price);
    
    // 检查是否满足最小数量
    if (amount < MIN_DOGE) {
      const minRequired = MIN_DOGE * price;
      if (usdtBalance >= minRequired) {
        amount = MIN_DOGE; // 刚好够买最小数量
      } else {
        throw new Error(`❌ 余额不足，至少需要 ${minRequired.toFixed(2)} USDT (当前: ${usdtBalance.toFixed(2)} USDT)`);
      }
    }
    
    return { 
      amount, 
      cost: amount * price,
      usdtBalance 
    };
    
  } else {
    // SELL: 卖出全部 DOGE
    const dogeBalance = await getAvailableBalance('DOGE');
    if (dogeBalance < MIN_DOGE) {
      throw new Error(`❌ DOGE 余额不足 (当前: ${dogeBalance} DOGE)`);
    }
    
    return { 
      amount: Math.floor(dogeBalance), 
      cost: 0,
      dogeBalance 
    };
  }
}

/* ========= 执行交易 ========= */
async function executeTrade(side) {
  try {
    const price = await getMarketPrice();
    const { amount, cost, usdtBalance, dogeBalance } = await calculateTradeAmount(side, price);
    
    console.log(`交易信息: ${side} ${amount} DOGE, 价格: ${price}, 成本: ${cost}`);
    
    if (amount <= 0) {
      return { success: false, error: '计算数量失败' };
    }
    
    const body = JSON.stringify({
      instId: 'DOGE-USDT',
      tdMode: 'cash',
      side: side.toLowerCase(),
      ordType: 'market',
      sz: String(amount)
    });
    
    const res = await okxRequest('POST', '/api/v5/trade/order', body);
    
    if (res.code === '0') {
      return { 
        success: true, 
        amount,
        price,
        cost,
        orderId: res.data[0]?.ordId
      };
    }
    
    // 错误处理
    if (res.msg?.includes('key') || res.msg?.includes('permission')) {
      return { success: false, error: '❌ API 无交易权限 (请检查 OKX API 权限)' };
    }
    if (res.msg?.includes('size') || res.msg?.includes('minimum')) {
      return { success: false, error: '❌ 下单数量过小' };
    }
    
    return { success: false, error: `❌ 交易失败: ${res.msg || '未知错误'}` };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/* ========= AI 信心指数 ========= */
async function calculateAIConfidence() {
  try {
    const klineRes = await okxRequest('GET', '/api/v5/market/candles?instId=DOGE-USDT&bar=1m&limit=30');
    if (klineRes.code !== '0') return 70;
    
    const klines = klineRes.data;
    const prices = klines.map(k => parseFloat(k[4]));
    const latestPrice = prices[prices.length - 1];
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const priceTrend = (latestPrice - avgPrice) / avgPrice;
    
    const volumes = klines.map(k => parseFloat(k[5]));
    const latestVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeRatio = latestVolume / avgVolume;
    
    let confidence = 70;
    
    // 价格趋势
    if (priceTrend > 0.01) confidence += 8;
    else if (priceTrend > 0.002) confidence += 4;
    else if (priceTrend < -0.01) confidence -= 8;
    else if (priceTrend < -0.002) confidence -= 4;
    
    // 成交量
    if (volumeRatio > 1.5) confidence += 10;
    else if (volumeRatio > 1.2) confidence += 6;
    else if (volumeRatio < 0.8) confidence -= 5;
    
    return Math.max(30, Math.min(95, Math.round(confidence)));
  } catch (err) {
    return 70;
  }
}

/* ========= 止盈止损 ========= */
async function checkAutoTrade() {
  const pos = await getRealPosition();
  if (!pos) return;
  
  const price = await getMarketPrice();
  const pnl = (price - pos.avgPrice) / pos.avgPrice;
  
  if (pnl >= TAKE_PROFIT || pnl <= STOP_LOSS) {
    console.log(`触发止盈止损: 盈亏 ${(pnl*100).toFixed(2)}%`);
    await executeTrade('SELL');
  }
}

/* ========= HTTP 接口 ========= */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(204).end();
  
  try {
    const { action } = req.query;
    const price = await getMarketPrice();
    const pos = await getRealPosition();
    const aiConfidence = await calculateAIConfidence();
    
    // 获取实时余额
    const usdtBalance = await getAvailableBalance('USDT');
    const dogeBalance = await getAvailableBalance('DOGE');
    
    // 手动交易
    if (action === 'buy') {
      if (pos) {
        return res.json({ 
          success: false, 
          error: '已有持仓，请先卖出后再买入',
          holding: true 
        });
      }
      return res.json(await executeTrade('BUY'));
    }
    
    if (action === 'sell') {
      if (!pos) {
        return res.json({ 
          success: false, 
          error: '暂无持仓，无法卖出',
          holding: false 
        });
      }
      return res.json(await executeTrade('SELL'));
    }
    
    // 自动止盈止损
    await checkAutoTrade();
    
    // 计算盈亏
    let pnl = 0, pnlPercent = 0;
    if (pos) {
      pnl = (price - pos.avgPrice) * pos.amount;
      pnlPercent = ((price - pos.avgPrice) / pos.avgPrice) * 100;
    }
    
    // 返回完整数据
    res.json({
      success: true,
      price: Number(price.toFixed(5)),
      holding: !!pos,
      aiConfidence,
      pnl: Number(pnl.toFixed(2)),
      pnlPercent: Number(pnlPercent.toFixed(2)),
      usdtBalance: Number(usdtBalance.toFixed(2)),
      dogeBalance: Number(dogeBalance.toFixed(2)),
      canBuy: usdtBalance > 0,
      timestamp: Date.now()
    });
    
  } catch (err) {
    res.status(200).json({ 
      success: false, 
      error: err.message 
    });
  }
}
