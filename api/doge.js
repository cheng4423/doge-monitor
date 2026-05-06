// api/doge.js - 全能实盘交易大脑 (Vercel Serverless)

import crypto from 'crypto';

// =================配置区域=================
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_PASSPHRASE;

// 交易参数 (可在前端请求时动态修改)
const CONFIG = {
    SYMBOL: 'DOGE-USDT',      // 交易对
    TRADE_AMOUNT_USDT: 1,     // 每单固定花 1 USDT (防止重仓)
    MAX_DAILY_ORDERS: 3,      // 每天最多 3 单
    STOP_LOSS_PERCENT: 0.95,  // 止损：跌 5% 卖出
    TAKE_PROFIT_PERCENT: 1.05 // 止盈：涨 5% 卖出
};

// 全局状态 (简单防刷)
let dailyOrderCount = 0;
let lastDate = new Date().toDateString();

// =================核心签名函数=================
function generateSignature(timestamp, method, path, body = '') {
    const message = timestamp + method + path + body;
    return crypto.createHmac('sha256', SECRET).update(message).digest('base64');
}

// =================OKX 请求封装=================
async function callOKX(method, path, body = null) {
    const timestamp = new Date().toISOString();
    const headers = {
        'OK-ACCESS-KEY': API_KEY,
        'OK-ACCESS-SIGN': generateSignature(timestamp, method, path, body),
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': PASSPHRASE,
        'Content-Type': 'application/json'
    };

    const response = await fetch(`https://www.okx.com${path}`, {
        method,
        headers,
        body
    });
    
    const data = await response.json();
    if (data.code !== '0') {
        throw new Error(`OKX Error: ${data.msg} (Code: ${data.code})`);
    }
    return data.data;
}

// =================AI 评分算法=================
function calculateAIScore(currentPrice, history) {
    // 简单的量化模型：基于波动率和趋势
    // 这里模拟一个 0-100 的分数，实际应用中可以接入更复杂的模型
    const change = (currentPrice - (history[0] || currentPrice)) / currentPrice * 100;
    const volatility = Math.abs(change);
    
    let score = 50; // 基准分
    
    // 趋势加分
    if (change > 0) score += 20;
    // 波动大加分（机会多）
    if (volatility > 1) score += 20;
    // 波动太小减分（没行情）
    if (volatility < 0.2) score -= 10;
    
    return Math.min(100, Math.max(0, score));
}

// =================止损/止盈检查=================
async function checkStopLossTakeProfit() {
    try {
        // 1. 获取账户持仓
        const positions = await callOKX('GET', '/api/v5/account/positions');
        const dogePos = positions.find(p => p.instId === CONFIG.SYMBOL && parseFloat(p.pos) > 0);
        
        if (dogePos) {
            const avgCost = parseFloat(dogePos.avgPx);
            const markPrice = parseFloat(dogePos.markPx);
            
            // 计算盈亏比例
            const profitRatio = markPrice / avgCost;
            
            console.log(`持仓检查: 成本 ${avgCost}, 现价 ${markPrice}, 盈亏比 ${profitRatio.toFixed(4)}`);
            
            // 触发止损
            if (profitRatio <= CONFIG.STOP_LOSS_PERCENT) {
                console.log("🚨 触发止损！");
                await closePosition(dogePos.pos);
                return { action: 'STOP_LOSS', price: markPrice };
            }
            
            // 触发止盈
            if (profitRatio >= CONFIG.TAKE_PROFIT_PERCENT) {
                console.log("🎉 触发止盈！");
                await closePosition(dogePos.pos);
                return { action: 'TAKE_PROFIT', price: markPrice };
            }
        }
        return { action: 'HOLD' };
    } catch (err) {
        console.error("风控检查失败:", err);
        return { action: 'ERROR', error: err.message };
    }
}

// =================平仓函数=================
async function closePosition(posSize) {
    const body = JSON.stringify({
        instId: CONFIG.SYMBOL,
        tdMode: 'cash',
        side: 'sell',
        ordType: 'market',
        sz: posSize // 平掉全部
    });
    return await callOKX('POST', '/api/v5/trade/order', body);
}

// =================主接口 (API)=================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 1. 每日单量重置
    const today = new Date().toDateString();
    if (today !== lastDate) {
        dailyOrderCount = 0;
        lastDate = today;
        console.log("🔄 新的一天，订单计数重置");
    }

    // 2. 处理前端请求
    if (req.method === 'POST' && req.url.includes('/ai-trade')) {
        try {
            const { action, live } = req.body;
            
            // --- A. AI 评分请求 ---
            if (action === 'score') {
                const ticker = await callOKX('GET', `/api/v5/market/ticker?instId=${CONFIG.SYMBOL}`);
                const price = parseFloat(ticker[0].last);
                
                // 模拟获取历史数据计算 (实际项目中应查数据库)
                const score = calculateAIScore(price, [price * 0.99, price * 1.01]);
                
                return res.status(200).json({ score, price });
            }
            
            // --- B. 执行交易请求 ---
            if (action === 'execute' && live) {
                // 风控检查
                const riskCheck = await checkStopLossTakeProfit();
                if (riskCheck.action !== 'HOLD') {
                    return res.status(200).json({ status: 'RISK_ACTION', action: riskCheck.action });
                }

                // 限单检查
                if (dailyOrderCount >= CONFIG.MAX_DAILY_ORDERS) {
                    return res.status(200).json({ status: 'LIMIT_REACHED', message: `今日已达 ${CONFIG.MAX_DAILY_ORDERS} 单上限` });
                }

                // 获取当前价格
                const ticker = await callOKX('GET', `/api/v5/market/ticker?instId=${CONFIG.SYMBOL}`);
                const currentPrice = parseFloat(ticker[0].last);

                // 执行市价买入
                const body = JSON.stringify({
                    instId: CONFIG.SYMBOL,
                    tdMode: 'cash',
                    side: 'buy',
                    ordType: 'market',
                    sz: CONFIG.TRADE_AMOUNT_USDT.toString() // 按金额买 (OKX 现货支持)
                });

                const result = await callOKX('POST', '/api/v5/trade/order', body);
                dailyOrderCount++; // 成功下单，计数+1
                
                console.log(`✅ 执行买入: ${CONFIG.TRADE_AMOUNT_USDT} USDT, 订单ID: ${result[0].ordId}`);
                
                return res.status(200).json({ 
                    status: 'SUCCESS', 
                    orderId: result[0].ordId,
                    count: dailyOrderCount,
                    price: currentPrice
                });
            }
            
            return res.status(400).json({ error: 'Invalid action' });
            
        } catch (error) {
            console.error("Handler Error:", error);
            return res.status(500).json({ error: error.message });
        }
    }
    
    res.status(404).send('Not Found');
}
