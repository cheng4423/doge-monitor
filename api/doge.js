require('dotenv').config();
const ccxt = require('ccxt');
const WebSocket = require('ws');
const express = require('express');
const path = require('path');

console.log('🚀 正在启动 DOGE 量化交易机器人...');
console.log('🔐 交易所: OKX (欧易)');

// 1. 验证环境变量
if (!process.env.OKX_API_KEY || !process.env.OKX_API_SECRET || !process.env.OKX_PASSPHRASE) {
    console.error('❌ 错误: 请在 .env 文件中配置 OKX API 密钥！');
    console.error('   需要: OKX_API_KEY, OKX_API_SECRET, OKX_PASSPHRASE');
    process.exit(1);
}

// 2. 创建 OKX 交易所实例
const exchange = new ccxt.okx({
    apiKey: process.env.OKX_API_KEY,
    secret: process.env.OKX_API_SECRET,
    password: process.env.OKX_PASSPHRASE,
    enableRateLimit: true,
    options: {
        defaultType: 'spot', // 现货交易
    },
});

// 3. 创建 Express 服务器
const app = express();
const PORT = process.env.PORT || 3000;

// 静态文件服务（让 index.html 可以访问）
app.use(express.static(path.join(__dirname, 'public'))); // 假设你把前端文件放在 public 文件夹
// 如果没有 public 文件夹，直接用下面这行：
app.use(express.static(__dirname));

// 4. 获取账户余额和行情的 API
app.get('/api/data', async (req, res) => {
    try {
        const balance = await exchange.fetchBalance();
        const ticker = await exchange.fetchTicker('DOGE/USDT');
        
        res.json({
            balance: balance,
            ticker: ticker,
            timestamp: new Date().toLocaleTimeString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. 启动服务器
app.listen(PORT, () => {
    console.log(`🌐 前端访问地址: http://localhost:${PORT}`);
    console.log(`✅ 机器人已启动，正在监听交易信号...`);
});

// 6. 简单的 WebSocket 连接示例（可选）
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('🔌 WebSocket 客户端已连接');
    
    // 每 2 秒推送一次数据
    const interval = setInterval(async () => {
        try {
            const ticker = await exchange.fetchTicker('DOGE/USDT');
            ws.send(JSON.stringify({
                type: 'ticker',
                data: ticker
            }));
        } catch (error) {
            console.error('WebSocket 推送失败:', error);
        }
    }, 2000);
    
    ws.on('close', () => {
        console.log('🔌 WebSocket 客户端已断开');
        clearInterval(interval);
    });
});
