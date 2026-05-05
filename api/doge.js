// ================= 主 JavaScript 文件 =================
// 保存为: app.js
// 或者在HTML中直接引用

// ================= 全局变量 =================
let price = 0.15;
let holding = false;
let buyPrice = 0;
let buyAmount = 0;
let profit = 0;
let todayProfit = 0;
let totalProfit = 0;
let win = 0, lose = 0;
let aiOn = false;
let aiTimer = null;
let aiStartTime = 0;
let refreshTimer = null;
let tradeCount = 0;

// 欧意账户数据
let accountData = {
    usdtBalance: 0,
    dogeBalance: 0,
    holding: false,
    avgPrice: 0,
    totalValue: 0
};

// 盈利统计
let stats = {
    floatingPnl: 0,
    pnlPercent: 0,
    tradesToday: 0,
    totalTrades: 0
};

// 交易历史
let tradeHistory = [];

// ================= OKX API 配置 =================
const OKX_API = {
    baseURL: 'https://www.okx.com',
    endpoints: {
        ticker: '/api/v5/market/ticker?instId=DOGE-USDT',
        balance: '/api/v5/account/balance',
        position: '/api/v5/account/positions?instId=DOGE-USDT',
        kline: '/api/v5/market/candles?instId=DOGE-USDT&bar=1m&limit=20'
    }
};

// ================= 模拟数据（如果没有API Key） =================
function getMockPrice() {
    // 模拟真实价格波动
    const change = (Math.random() - 0.5) * 0.002;
    price = Math.max(0.13, Math.min(0.17, price + change));
    return price;
}

function getMockAccountData() {
    return {
        usdtBalance: 100 + Math.random() * 50,
        dogeBalance: holding ? buyAmount : 0,
        holding: holding,
        avgPrice: holding ? buyPrice : 0
    };
}

// ================= 获取实时价格 =================
async function getRealTimePrice() {
    try {
        // 尝试从OKX获取真实价格
        const response = await fetch('/api/price'); // 你的后端代理
        if (response.ok) {
            const data = await response.json();
            if (data.price) {
                price = data.price;
                return price;
            }
        }
    } catch (error) {
        console.log('使用模拟价格');
    }
    
    // 如果失败，使用模拟价格
    return getMockPrice();
}

// ================= 获取账户余额 =================
async function getAccountBalance() {
    try {
        const response = await fetch('/api/balance');
        if (response.ok) {
            const data = await response.json();
            if (data.usdtBalance !== undefined && data.dogeBalance !== undefined) {
                accountData.usdtBalance = data.usdtBalance;
                accountData.dogeBalance = data.dogeBalance;
                accountData.holding = data.holding || false;
                accountData.avgPrice = data.avgPrice || 0;
                return true;
            }
        }
    } catch (error) {
        console.log('使用模拟账户数据');
    }
    
    // 如果失败，使用模拟数据
    const mockData = getMockAccountData();
    Object.assign(accountData, mockData);
    return true;
}

// ================= AI量子评分算法 =================
function calculateAIScore() {
    let score = 70; // 基础分
    
    // 1. 价格趋势分析
    if (tradeHistory.length >= 5) {
        const recentPrices = tradeHistory.slice(-5).map(t => t.price);
        const trend = (recentPrices[recentPrices.length-1] - recentPrices[0]) / recentPrices[0];
        
        if (trend > 0.01) score += 15;      // 上涨趋势
        else if (trend < -0.01) score -= 10; // 下跌趋势
    }
    
    // 2. 持仓状态影响
    if (holding) {
        const profitPercent = ((price - buyPrice) / buyPrice) * 100;
        if (profitPercent >= 1) score += 5;   // 盈利中
        else if (profitPercent <= -1) score -= 8; // 亏损中
    }
    
    // 3. 交易量热度（模拟）
    const volumeFactor = Math.random() * 20 - 10;
    score += volumeFactor;
    
    // 限制在10-100之间
    return Math.max(10, Math.min(100, Math.round(score)));
}

// ================= 更新AI评分显示 =================
function updateAIScore() {
    const score = calculateAIScore();
    
    // 更新显示
    document.getElementById('score').textContent = score;
    document.getElementById('scoreBar').style.width = score + '%';
    
    // 更新建议文字
    const suggestEl = document.getElementById('suggest');
    if (score <= 10) {
        suggestEl.textContent = '❌ 不建议买入';
        suggestEl.className = 'red';
    } else if (score >= 90) {
        suggestEl.textContent = '🚀 强力买入信号';
        suggestEl.className = 'purple';
    } else if (score >= 60) {
        suggestEl.textContent = '✅ 建议买入';
        suggestEl.className = 'green';
    } else {
        suggestEl.textContent = '⏸ 观望';
        suggestEl.className = '';
    }
    
    return score;
}

// ================= 更新价格显示 =================
async function updatePriceDisplay() {
    const currentPrice = await getRealTimePrice();
    
    // 更新价格显示
    document.getElementById('price').textContent = currentPrice.toFixed(5) + ' USDT';
    
    // 计算价格变化
    if (tradeHistory.length > 0) {
        const prevPrice = tradeHistory[tradeHistory.length-1].price;
        const changePercent = ((currentPrice - prevPrice) / prevPrice * 100).toFixed(2);
        
        const changeEl = document.getElementById('change');
        changeEl.textContent = (changePercent >= 0 ? '+' : '') + changePercent + '%';
        changeEl.style.color = changePercent >= 0 ? 'var(--green)' : 'var(--red)';
    }
    
    // 记录价格历史
    tradeHistory.push({
        time: new Date(),
        price: currentPrice
    });
    
    // 只保留最近100条记录
    if (tradeHistory.length > 100) {
        tradeHistory.shift();
    }
    
    return currentPrice;
}

// ================= 更新账户余额显示 =================
async function updateBalanceDisplay() {
    await getAccountBalance();
    
    // 更新余额显示
    document.getElementById('usdtBalance').textContent = accountData.usdtBalance.toFixed(2) + ' USDT';
    document.getElementById('dogeBalance').textContent = accountData.dogeBalance.toFixed(2) + ' DOGE';
    
    // 计算总资产
    const totalValue = accountData.usdtBalance + (accountData.dogeBalance * price);
    accountData.totalValue = totalValue;
    
    // 更新持仓状态
    updateHoldingStatus();
    
    // 更新盈亏
    updateProfitDisplay();
}

// ================= 更新持仓状态 =================
function updateHoldingStatus() {
    const statusEl = document.getElementById('holdingStatus');
    if (accountData.holding && accountData.dogeBalance > 0) {
        statusEl.textContent = `持仓中 (${accountData.dogeBalance.toFixed(2)} DOGE)`;
        statusEl.style.color = 'var(--green)';
    } else {
        statusEl.textContent = '空仓';
        statusEl.style.color = 'var(--yellow)';
    }
}

// ================= 更新盈亏显示 =================
function updateProfitDisplay() {
    if (accountData.holding && accountData.avgPrice > 0) {
        stats.floatingPnl = (price - accountData.avgPrice) * accountData.dogeBalance;
        stats.pnlPercent = ((price - accountData.avgPrice) / accountData.avgPrice * 100);
        
        const pnlClass = stats.floatingPnl >= 0 ? 'green' : 'red';
        document.getElementById('floatingPnl').textContent = (stats.floatingPnl >= 0 ? '+' : '') + stats.floatingPnl.toFixed(2) + ' USDT';
        document.getElementById('floatingPnl').className = 'stat-value ' + pnlClass;
        document.getElementById('pnlPercent').textContent = (stats.pnlPercent >= 0 ? '+' : '') + stats.pnlPercent.toFixed(2) + '%';
        document.getElementById('pnlPercent').className = 'stat-value ' + pnlClass;
    } else {
        document.getElementById('floatingPnl').textContent = '+0.00 USDT';
        document.getElementById('floatingPnl').className = 'stat-value green';
        document.getElementById('pnlPercent').textContent = '0.00%';
        document.getElementById('pnlPercent').className = 'stat-value green';
    }
    
    // 更新盈利统计
    document.getElementById('todayProfit').textContent = todayProfit.toFixed(2) + ' USDT';
    document.getElementById('totalProfit').textContent = totalProfit.toFixed(2) + ' USDT';
    document.getElementById('profit').textContent = totalProfit.toFixed(2) + ' USDT';
    
    // 更新胜率
    updateWinRate();
}

// ================= 更新胜率 =================
function updateWinRate() {
    const winRate = win + lose > 0 ? ((win / (win + lose)) * 100).toFixed(1) : 0;
    document.getElementById('winRate').textContent = winRate + '%';
    document.getElementById('winCount').textContent = win;
    document.getElementById('loseCount').textContent = lose;
    document.getElementById('tradeCount').textContent = stats.totalTrades;
}

// ================= 模拟买入操作 =================
async function simulateBuy() {
    if (accountData.holding) {
        addLog('已有持仓，无法买入', 'info');
        return false;
    }
    
    if (accountData.usdtBalance < 10) {
        addLog('USDT余额不足', 'error');
        return false;
    }
    
    try {
        // 计算买入数量（最多用50%资金）
        const maxBuyAmount = Math.floor(accountData.usdtBalance * 0.5 / price);
        buyAmount = Math.max(10, Math.min(100, maxBuyAmount)); // 10-100 DOGE
        const cost = buyAmount * price;
        
        if (cost > accountData.usdtBalance) {
            addLog('资金不足', 'error');
            return false;
        }
        
        // 模拟买入
        buyPrice = price;
        holding = true;
        accountData.holding = true;
        accountData.dogeBalance = buyAmount;
        accountData.usdtBalance -= cost;
        accountData.avgPrice = buyPrice;
        
        // 记录交易
        const trade = {
            type: 'buy',
            amount: buyAmount,
            price: buyPrice,
            time: new Date(),
            cost: cost
        };
        tradeHistory.push(trade);
        stats.totalTrades++;
        stats.tradesToday++;
        
        addLog(`🟢 买入 ${buyAmount} DOGE @ ${buyPrice.toFixed(5)} USDT`, 'success');
        addLog(`💰 花费: ${cost.toFixed(2)} USDT`, 'info');
        
        // 更新显示
        updateBalanceDisplay();
        
        return true;
    } catch (error) {
        addLog(`买入失败: ${error.message}`, 'error');
        return false;
    }
}

// ================= 模拟卖出操作 =================
async function simulateSell() {
    if (!accountData.holding || accountData.dogeBalance <= 0) {
        addLog('无持仓可卖', 'info');
        return false;
    }
    
    try {
        const sellAmount = accountData.dogeBalance;
        const revenue = sellAmount * price;
        const cost = sellAmount * accountData.avgPrice;
        const profit = revenue - cost - 0.05; // 扣除0.05手续费
        
        // 记录盈亏
        if (profit >= 0.5) {
            win++;
            addLog(`🔥 盈利卖出: 赚 ${profit.toFixed(2)} USDT`, 'success');
        } else {
            lose++;
            addLog(`💥 亏损卖出: 亏 ${Math.abs(profit).toFixed(2)} USDT`, 'error');
        }
        
        // 更新账户
        todayProfit += profit;
        totalProfit += profit;
        holding = false;
        accountData.holding = false;
        accountData.usdtBalance += revenue;
        accountData.dogeBalance = 0;
        accountData.avgPrice = 0;
        
        // 记录交易
        const trade = {
            type: 'sell',
            amount: sellAmount,
            price: price,
            time: new Date(),
            revenue: revenue,
            profit: profit
        };
        tradeHistory.push(trade);
        stats.totalTrades++;
        stats.tradesToday++;
        
        addLog(`💰 收入: ${revenue.toFixed(2)} USDT`, 'info');
        
        // 更新显示
        updateBalanceDisplay();
        
        return true;
    } catch (error) {
        addLog(`卖出失败: ${error.message}`, 'error');
        return false;
    }
}

// ================= AI量化策略 =================
async function runAIStrategy() {
    if (!aiOn) return;
    
    // 获取当前AI评分
    const score = updateAIScore();
    
    // 策略1: 高评分且空仓 → 买入
    if (score >= 60 && !accountData.holding) {
        addLog(`AI评分 ${score}: 建议买入`, 'info');
        await simulateBuy();
    }
    // 策略2: 低评分且持仓 → 卖出
    else if (score <= 40 && accountData.holding) {
        addLog(`AI评分 ${score}: 建议卖出`, 'info');
        await simulateSell();
    }
    // 策略3: 检查盈利目标
    else if (accountData.holding) {
        const currentProfit = (price - accountData.avgPrice) * accountData.dogeBalance - 0.05;
        if (currentProfit >= 0.5) {
            addLog(`🎯 达到盈利目标: ${currentProfit.toFixed(2)} USDT`, 'success');
            await simulateSell();
        } else if (currentProfit <= -1) {
            addLog(`⚠️ 亏损扩大: ${currentProfit.toFixed(2)} USDT`, 'error');
            await simulateSell();
        }
    }
}

// ================= 更新AI运行时间 =================
function updateAITime() {
    if (!aiOn) return;
    
    const runtime = Math.floor((Date.now() - aiStartTime) / 1000);
    const hours = Math.floor(runtime / 3600);
    const minutes = Math.floor((runtime % 3600) / 60);
    const seconds = runtime % 60;
    
    document.getElementById('aiRuntime').textContent = 
        `运行: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    setTimeout(updateAITime, 1000);
}

// ================= 启动AI量化 =================
function startAI() {
    if (aiOn) {
        addLog('AI已在运行中', 'info');
        return;
    }
    
    aiOn = true;
    aiStartTime = Date.now();
    
    // 更新按钮状态
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    document.getElementById('startText').innerHTML = '<span class="loading"></span>运行中';
    document.getElementById('aiStatus').textContent = '状态: 运行中';
    document.getElementById('aiStatus').style.color = 'var(--green)';
    
    addLog('🚀 AI量化交易已启动', 'success');
    addLog('策略: 高评分买入, 低评分卖出, 盈利≥0.5元自动止盈', 'info');
    addLog('目标: 24小时滚雪球，持续盈利', 'info');
    
    // 启动AI循环
    aiTimer = setInterval(runAIStrategy, 10000); // 每10秒执行一次
    
    // 开始计时
    updateAITime();
    
    // 显示启动提示
    showNotification('AI量化交易已启动', 'success');
}

// ================= 停止AI量化 =================
function stopAI() {
    if (!aiOn) {
        addLog('AI未运行', 'info');
        return;
    }
    
    aiOn = false;
    clearInterval(aiTimer);
    
    // 更新按钮状态
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('startText').textContent = '🚀 启动 AI 量化交易';
    document.getElementById('aiStatus').textContent = '状态: 已停止';
    document.getElementById('aiStatus').style.color = 'var(--red)';
    
    const runtime = Math.floor((Date.now() - aiStartTime) / 1000);
    const hours = Math.floor(runtime / 3600);
    const minutes = Math.floor((runtime % 3600) / 60);
    const seconds = runtime % 60;
    
    addLog(`⏹️ AI量化已停止, 运行时长: ${hours}时${minutes}分${seconds}秒`, 'info');
    addLog(`📊 累计盈利: ${totalProfit.toFixed(2)} USDT`, 'info');
    
    // 显示停止提示
    showNotification('AI量化交易已停止', 'info');
}

// ================= 手动交易控制 =================
function manualBuy() {
    if (aiOn) {
        addLog('AI运行中，请先停止AI交易', 'warning');
        return;
    }
    simulateBuy();
}

function manualSell() {
    if (aiOn) {
        addLog('AI运行中，请先停止AI交易', 'warning');
        return;
    }
    simulateSell();
}

// ================= 日志系统 =================
function addLog(message, type = 'info') {
    const logContainer = document.getElementById('log');
    if (!logContainer) return;
    
    const now = new Date();
    const time = now.toLocaleTimeString();
    
    const logLine = document.createElement('div');
    logLine.className = 'log-line';
    
    let color = '#94a3b8'; // 默认灰色
    if (type === 'success') color = 'var(--green)';
    if (type === 'error') color = 'var(--red)';
    if (type === 'warning') color = 'var(--yellow)';
    if (type === 'info') color = 'var(--blue)';
    
    logLine.innerHTML = `<span style="color:#64748b">[${time}]</span> <span style="color:${color}">${message}</span>`;
    logContainer.appendChild(logLine);
    
    // 自动滚动到底部
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // 保持最多50条日志
    if (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// ================= 通知系统 =================
function showNotification(message, type = 'info') {
    // 创建一个通知元素
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: var(--card);
        color: white;
        border-radius: 8px;
        border-left: 4px solid ${type === 'success' ? 'var(--green)' : 'var(--blue)'};
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 3秒后移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ================= 页面初始化 =================
async function initializeApp() {
    addLog('🚀 DOGE AI量化交易系统启动', 'success');
    addLog('正在初始化...', 'info');
    
    // 初始加载数据
    await updatePriceDisplay();
    await updateBalanceDisplay();
    updateAIScore();
    
    addLog('系统初始化完成', 'success');
    addLog(`当前价格: ${price.toFixed(5)} USDT`, 'info');
    addLog(`账户余额: ${accountData.usdtBalance.toFixed(2)} USDT`, 'info');
    
    // 启动定时刷新
    refreshTimer = setInterval(async () => {
        await updatePriceDisplay();
        await updateBalanceDisplay();
    }, 3000); // 每3秒刷新
    
    // 添加样式动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // 添加快捷键
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'q') {
            e.preventDefault();
            if (aiOn) stopAI();
            else startAI();
        }
        if (e.key === 'F5') {
            e.preventDefault();
            location.reload();
        }
    });
}

// ================= 导出全局函数 =================
window.startAI = startAI;
window.stopAI = stopAI;
window.manualBuy = manualBuy;
window.manualSell = manualSell;
window.initializeApp = initializeApp;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializeApp);
