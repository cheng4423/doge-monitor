// api/doge.js - 高频微利交易策略 (Vercel Serverless)
// 策略：买入后，价格上涨0.5%即卖出，扣除手续费后仍有利可图。

import crypto from 'crypto';

// ================= 配置区域 =================
const API_KEY = process.env.OKX_API_KEY;
const SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_PASSPHRASE;

// 核心交易参数
const CONFIG = {
    SYMBOL: 'DOGE-USDT',
    TRADE_AMOUNT_USDT: 1,           // 每单固定投入 1 USDT
    TARGET_PROFIT_PERCENT: 0.005,   // 目标利润率 0.5% (千分之五)
    FEE_RATE: 0.001,                // 假设手续费率 0.1% (买卖双边，共0.2%)
    // 注意：实际手续费需根据你的VIP等级确认
    MAX_RETRY: 3
};

// 简易内存存储 (记录持仓和目标价)
// 注意：Vercel Serverless 是无状态的，重启后数据会丢失。
// 生产环境应使用 Vercel KV (Redis) 或 Database 来存储状态。
let currentPosition = null; // 格式: { buyPrice: 0.123, targetSellPrice: 0.12361, buyOrderId: 'xxx', buyTime: '2024-...' }

// ================= 工具函数 =================
function generateSignature(timestamp, method, path, body = '') {
    const message = timestamp + method + path + body;
    return crypto.createHmac('sha256', SECRET).update(message).digest('base64');
}

async function callOKX(method, path, body = null) {
    const timestamp = new Date().toISOString();
    const headers = {
        'OK-ACCESS-KEY': API_KEY,
        'OK-ACCESS-SIGN': generateSignature(timestamp, method, path, body),
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': PASSPHRASE,
        'Content-Type': 'application/json'
    };

    const options = { method, headers };
    if (body) options.body = body;

    const response = await fetch(`https://www.okx.com${path}`, options);
    const data = await response.json();
    
    if (data.code !== '0') {
        throw new Error(`OKX API Error [${data.code}]: ${data.msg}`);
    }
    return data.data;
}

// 计算目标卖出价 (包含手续费缓冲)
function calculateTargetSellPrice(buyPrice) {
    // 买入成本 = 买入价 * (1 + 手续费率)
    const costPrice = buyPrice * (1 + CONFIG.FEE_RATE);
    // 目标卖出价 = 成本价 * (1 + 目标利润率 + 手续费率)
    // 这样确保卖出后，扣除手续费，净利润率约为 TARGET_PROFIT_PERCENT
    const targetPrice = costPrice * (1 + CONFIG.TARGET_PROFIT_PERCENT + CONFIG.FEE_RATE);
    return targetPrice;
}

// 计算实际净利润率
function calculateNetProfit(buyPrice, sellPrice) {
    const cost = buyPrice * (1 + CONFIG.FEE_RATE);
    const revenue = sellPrice * (1 - CONFIG.FEE_RATE);
    return ((revenue - cost) / cost) * 100;
}

// ================= 核心交易函数 =================
async function checkAndExecuteTradingCycle() {
    let logs = [];
    const addLog = (msg) => {
        const time = new Date().toLocaleTimeString();
        logs.push(`[${time}] ${msg}`);
        console.log(msg); // 同时在Vercel日志中输出
    };

    try {
        // 1. 获取当前市场价格
        const tickerData = await callOKX('GET', `/api/v5/market/ticker?instId=${CONFIG.SYMBOL}`);
        const currentPrice = parseFloat(tickerData[0].last);
        addLog(`当前价格: ${currentPrice.toFixed(6)} USDT`);

        // 2. 检查是否有持仓需要平仓
        if (currentPosition) {
            const { buyPrice, targetSellPrice } = currentPosition;
            const netProfitPercent = calculateNetProfit(buyPrice, currentPrice);
            
            addLog(`持仓中 - 买入价: ${buyPrice.toFixed(6)}, 目标价: ${targetSellPrice.toFixed(6)}`);
            addLog(`当前浮动盈亏: ${netProfitPercent.toFixed(4)}%`);

            if (currentPrice >= targetSellPrice) {
                addLog(`🎯 达到目标价！开始平仓...`);
                
                // 执行市价卖出
                const sellOrder = {
                    instId: CONFIG.SYMBOL,
                    tdMode: 'cash',
                    side: 'sell',
                    ordType: 'market',
                    sz: (CONFIG.TRADE_AMOUNT_USDT / buyPrice).toFixed(0) // 计算DOGE数量，取整
                };

                const sellResult = await callOKX('POST', '/api/v5/trade/order', JSON.stringify(sellOrder));
                addLog(`✅ 卖出订单成功! 订单ID: ${sellResult[0].ordId}`);

                // 计算并记录最终利润
                const finalProfitPercent = calculateNetProfit(buyPrice, currentPrice);
                addLog(`💰 本轮交易完成! 净利润率: ~${finalProfitPercent.toFixed(4)}%`);

                // 清空持仓状态
                currentPosition = null;
                return { 
                    action: 'SELL', 
                    buyPrice, 
                    sellPrice: currentPrice, 
                    profitPercent: finalProfitPercent,
                    logs 
                };
            } else {
                addLog(`⏳ 未达目标价，继续持有...`);
                return { action: 'HOLD', currentPrice, targetSellPrice, logs };
            }
        } 
        // 3. 没有持仓，执行买入
        else {
            addLog(`无持仓，执行新一轮买入...`);
            
            const buyOrder = {
                instId: CONFIG.SYMBOL,
                tdMode: 'cash',
                side: 'buy',
                ordType: 'market',
                sz: CONFIG.TRADE_AMOUNT_USDT.toString() // OKX现货支持按USDT金额买入
            };

            const buyResult = await callOKX('POST', '/api/v5/trade/order', JSON.stringify(buyOrder));
            addLog(`✅ 买入订单成功! 订单ID: ${buyResult[0].ordId}, 成交均价: ${buyResult[0].avgPx}`);
            
            const executedBuyPrice = parseFloat(buyResult[0].avgPx) || currentPrice;
            const targetSellPrice = calculateTargetSellPrice(executedBuyPrice);
            
            // 记录新持仓
            currentPosition = {
                buyPrice: executedBuyPrice,
                targetSellPrice: targetSellPrice,
                buyOrderId: buyResult[0].ordId,
                buyTime: new Date().toISOString()
            };

            addLog(`📈 新持仓建立 - 买入价: ${executedBuyPrice.toFixed(6)}, 目标卖出价: ${targetSellPrice.toFixed(6)} (涨幅需达 ${CONFIG.TARGET_PROFIT_PERCENT*100}% 以上)`);
            return { action: 'BUY', buyPrice: executedBuyPrice, targetSellPrice, logs };
        }

    } catch (error) {
        addLog(`❌ 交易周期执行失败: ${error.message}`);
        return { action: 'ERROR', error: error.message, logs };
    }
}

// ================= 主接口处理器 =================
export default async function handler(req, res) {
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 只处理POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { action } = req.body || {};

        if (action === 'run') {
            // 执行一次完整的“检查-买入/卖出”循环
            const result = await checkAndExecuteTradingCycle();
            return res.status(200).json(result);

        } else if (action === 'status') {
            // 返回当前状态
            const tickerData = await callOKX('GET', `/api/v5/market/ticker?instId=${CONFIG.SYMBOL}`);
            const currentPrice = parseFloat(tickerData[0].last);
            
            let statusInfo = {
                currentPrice,
                hasPosition: !!currentPosition,
                config: CONFIG
            };

            if (currentPosition) {
                const { buyPrice, targetSellPrice, buyTime } = currentPosition;
                const profitNeeded = ((targetSellPrice - currentPrice) / currentPrice * 100).toFixed(4);
                const currentProfit = calculateNetProfit(buyPrice, currentPrice);
                
                statusInfo.position = {
                    buyPrice,
                    targetSellPrice,
                    buyTime,
                    currentProfitPercent: currentProfit,
                    profitNeededPercent: profitNeeded
                };
            }

            return res.status(200).json(statusInfo);

        } else if (action === 'reset') {
            // 强制重置状态 (用于测试或紧急情况)
            currentPosition = null;
            return res.status(200).json({ message: '持仓状态已重置' });

        } else {
            return res.status(400).json({ error: '未知的action参数。可选: run, status, reset' });
        }

    } catch (error) {
        console.error('API Handler Error:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
}
