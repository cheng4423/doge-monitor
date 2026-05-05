<script>
    // ================= 全局变量 =================
    let chart = null;
    let chartData = [];
    let isTrading = false;
    let aiTimer = null;
    let isAIRunning = false;
    let aiStartTime = 0;
    let currentPrice = 0.15;
    let lastUpdateTime = 0;
    let lastTradePrice = 0.15;

    // 账户数据
    let accountData = {
        usdtBalance: 100.00,
        dogeBalance: 0.00,
        holding: false,
        avgPrice: 0.00,
        totalCost: 0.00,
        positionCount: 0
    };

    // 交易统计
    let tradeStats = {
        todayProfit: 0.00,
        totalProfit: 0.00,
        tradeCount: 0,
        winCount: 0,
        lossCount: 0
    };

    // AI信心指数历史
    let confidenceHistory = [];

    // ================= 初始化图表 =================
    function initChart() {
        const chartDom = document.getElementById('priceChart');
        if (!chartDom) return;
        
        chart = echarts.init(chartDom);
        
        // 生成初始数据
        const now = Date.now();
        chartData = [];
        for (let i = 0; i < 100; i++) {
            const time = now - (100 - i) * 60000;
            const price = 0.15 + (Math.random() - 0.5) * 0.01;
            chartData.push([time, price]);
        }
        
        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(17, 24, 39, 0.9)',
                borderColor: '#374151',
                textStyle: { color: '#e5e7eb' },
                formatter: function (params) {
                    const date = new Date(params[0].value[0]);
                    return `${date.toLocaleTimeString()}<br/>价格: ${params[0].value[1].toFixed(5)} USDT`;
                }
            },
            grid: { 
                left: '3%', 
                right: '4%', 
                bottom: '3%', 
                top: '3%' 
            },
            xAxis: {
                type: 'time',
                splitLine: { show: false },
                axisLine: { lineStyle: { color: '#374151' } },
                axisLabel: { 
                    color: '#6b7280', 
                    fontSize: 10 
                }
            },
            yAxis: {
                type: 'value',
                scale: true,
                splitLine: {
                    show: true,
                    lineStyle: { 
                        color: '#374151', 
                        type: 'dashed',
                        opacity: 0.3
                    }
                },
                axisLine: { lineStyle: { color: '#374151' } },
                axisLabel: { 
                    color: '#6b7280', 
                    fontSize: 10 
                }
            },
            series: [{
                name: 'DOGE/USDT',
                type: 'line',
                data: chartData,
                smooth: true,
                symbol: 'none',
                lineStyle: { 
                    color: '#3b82f6', 
                    width: 2 
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                        { offset: 1, color: 'rgba(59, 130, 246, 0)' }
                    ])
                }
            }]
        };
        
        chart.setOption(option);
        updateChart();
    }

    // ================= 更新图表 =================
    function updateChart() {
        const now = Date.now();
        if (now - lastUpdateTime < 2000) return; // 2秒限流
        
        lastUpdateTime = now;
        
        // 计算价格变化
        let priceChange = 0;
        if (chartData.length > 0) {
            const lastPrice = chartData[chartData.length - 1][1];
            const trend = Math.random() > 0.5 ? 1 : -1;
            const volatility = 0.001 + (Math.random() * 0.002);
            
            // AI信心指数影响价格变化
            const confidence = getCurrentConfidence();
            let confidenceFactor = 1.0;
            
            if (confidence >= 80) {
                confidenceFactor = 1.2; // 高信心时波动增大
            } else if (confidence <= 40) {
                confidenceFactor = 0.8; // 低信心时波动减小
            }
            
            priceChange = trend * volatility * confidenceFactor;
            currentPrice = Math.max(0.13, Math.min(0.17, lastPrice + priceChange));
        } else {
            currentPrice = 0.15;
        }
        
        // 添加新数据点
        chartData.push([now, currentPrice]);
        if (chartData.length > 100) {
            chartData.shift();
        }
        
        // 更新图表
        if (chart) {
            chart.setOption({
                series: [{
                    data: chartData
                }]
            });
        }
        
        // 更新价格显示
        updatePriceDisplay();
        
        // 更新时间
        updateTimeDisplay();
        
        // 更新交易成本估算
        updateTradeCost();
        
        // 更新盈亏
        updateProfitLoss();
        
        // 更新AI信心指数
        updateAIConfidence();
    }

    // ================= 更新价格显示 =================
    function updatePriceDisplay() {
        const priceEl = document.getElementById('currentPrice');
        const changeEl = document.getElementById('priceChange');
        
        if (chartData.length > 1) {
            const prevPrice = chartData[chartData.length - 2][1];
            const changePercent = ((currentPrice - prevPrice) / prevPrice * 100).toFixed(2);
            
            priceEl.textContent = currentPrice.toFixed(5);
            changeEl.textContent = (changePercent >= 0 ? '+' : '') + changePercent + '%';
            changeEl.style.color = changePercent >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
            
            // 保存最新价格
            lastTradePrice = currentPrice;
        } else {
            priceEl.textContent = currentPrice.toFixed(5);
            changeEl.textContent = '0.00%';
        }
    }

    // ================= 更新时间显示 =================
    function updateTimeDisplay() {
        const timeStr = new Date().toLocaleTimeString();
        document.getElementById('chartUpdateTime').textContent = timeStr;
    }

    // ================= 更新交易成本 =================
    function updateTradeCost() {
        const amountInput = document.getElementById('tradeAmount');
        const amount = parseFloat(amountInput.value) || 10;
        const cost = amount * currentPrice;
        
        const costElement = document.getElementById('tradeCost');
        if (costElement) {
            costElement.textContent = '成本: ' + cost.toFixed(2) + ' USDT';
        }
    }

    // ================= 更新余额显示 =================
    function updateBalance() {
        // 更新USDT余额
        const usdtBalanceEl = document.getElementById('usdtBalance');
        if (usdtBalanceEl) {
            usdtBalanceEl.textContent = accountData.usdtBalance.toFixed(2);
        }
        
        // 更新DOGE余额
        const dogeBalanceEl = document.getElementById('dogeBalance');
        if (dogeBalanceEl) {
            dogeBalanceEl.textContent = accountData.dogeBalance.toFixed(2);
        }
        
        // 计算总资产估值
        const totalValue = accountData.usdtBalance + (accountData.dogeBalance * currentPrice);
        const totalValueEl = document.getElementById('totalValue');
        if (totalValueEl) {
            totalValueEl.textContent = totalValue.toFixed(2) + ' USDT';
        }
        
        // 更新持仓状态
        updatePositionStatus();
        
        // 更新交易按钮状态
        updateTradeButtons();
    }

    // ================= 更新持仓状态 =================
    function updatePositionStatus() {
        const holdingEl = document.getElementById('holdingStatus');
        const avgPriceEl = document.getElementById('avgPrice');
        
        if (accountData.holding && accountData.dogeBalance > 0) {
            holdingEl.textContent = '持仓中';
            holdingEl.style.color = 'var(--accent-green)';
            avgPriceEl.textContent = accountData.avgPrice.toFixed(5) + ' USDT';
        } else {
            holdingEl.textContent = '空仓';
            holdingEl.style.color = 'var(--text-secondary)';
            avgPriceEl.textContent = '--';
        }
    }

    // ================= 更新交易按钮状态 =================
    function updateTradeButtons() {
        const buyBtn = document.getElementById('buyBtn');
        const sellBtn = document.getElementById('sellBtn');
        const tradeAmount = parseFloat(document.getElementById('tradeAmount').value) || 10;
        const tradeCost = tradeAmount * currentPrice;
        
        if (accountData.holding) {
            // 已有持仓
            buyBtn.disabled = true;
            buyBtn.title = '已有持仓，请先卖出';
            sellBtn.disabled = false;
        } else {
            // 空仓状态
            buyBtn.disabled = accountData.usdtBalance < tradeCost;
            if (buyBtn.disabled) {
                buyBtn.title = 'USDT余额不足';
            } else {
                buyBtn.title = '买入 DOGE';
            }
            sellBtn.disabled = true;
            sellBtn.title = '无持仓可卖';
        }
        
        // 检查最小交易数量
        if (tradeAmount < 10) {
            buyBtn.disabled = true;
            buyBtn.title = '最小交易数量为 10 DOGE';
        }
    }

    // ================= 更新盈亏统计 =================
    function updateProfitLoss() {
        // 计算浮动盈亏
        let floatingPnl = 0;
        let pnlPercent = 0;
        
        if (accountData.holding && accountData.dogeBalance > 0 && accountData.avgPrice > 0) {
            floatingPnl = (currentPrice - accountData.avgPrice) * accountData.dogeBalance;
            pnlPercent = (currentPrice - accountData.avgPrice) / accountData.avgPrice * 100;
        }
        
        // 更新浮动盈亏显示
        const floatingPnlEl = document.getElementById('floatingPnl');
        if (floatingPnlEl) {
            floatingPnlEl.textContent = floatingPnl.toFixed(2) + ' USDT';
            floatingPnlEl.className = 'pnl-value ' + (floatingPnl >= 0 ? 'profit' : 'loss');
        }
        
        // 更新盈亏比例显示
        const pnlPercentEl = document.getElementById('pnlPercent');
        if (pnlPercentEl) {
            pnlPercentEl.textContent = (pnlPercent >= 0 ? '+' : '') + pnlPercent.toFixed(2) + '%';
            pnlPercentEl.className = 'pnl-value ' + (pnlPercent >= 0 ? 'profit' : 'loss');
        }
        
        // 更新今日盈亏
        const todayPnlEl = document.getElementById('todayPnl');
        if (todayPnlEl) {
            todayPnlEl.textContent = tradeStats.todayProfit.toFixed(2) + ' USDT';
            todayPnlEl.className = 'pnl-value ' + (tradeStats.todayProfit >= 0 ? 'profit' : 'loss');
        }
        
        // 更新总盈亏
        const totalPnlEl = document.getElementById('totalPnl');
        if (totalPnlEl) {
            totalPnlEl.textContent = tradeStats.totalProfit.toFixed(2) + ' USDT';
            totalPnlEl.className = 'pnl-value ' + (tradeStats.totalProfit >= 0 ? 'profit' : 'loss');
        }
        
        // 更新交易状态
        updateTradeStatus();
    }

    // ================= 更新交易状态 =================
    function updateTradeStatus() {
        const statusEl = document.getElementById('tradeStatus');
        if (!statusEl) return;
        
        if (accountData.holding) {
            const profit = (currentPrice - accountData.avgPrice) * accountData.dogeBalance;
            if (profit > 0) {
                statusEl.textContent = '持仓盈利中';
                statusEl.style.color = 'var(--accent-green)';
            } else if (profit < 0) {
                statusEl.textContent = '持仓亏损中';
                statusEl.style.color = 'var(--accent-red)';
            } else {
                statusEl.textContent = '持仓中';
                statusEl.style.color = 'var(--text-secondary)';
            }
        } else {
            statusEl.textContent = '准备交易';
            statusEl.style.color = 'var(--text-secondary)';
        }
    }

    // ================= 添加日志 =================
    function addLog(message, type = 'info') {
        const logContainer = document.getElementById('logContainer');
        if (!logContainer) return;
        
        const now = new Date();
        const time = now.toLocaleTimeString();
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        let logClass = 'log-message';
        if (type === 'buy') {
            logClass += ' log-buy';
        } else if (type === 'sell') {
            logClass += ' log-sell';
        } else if (type === 'info') {
            logClass += ' log-info';
        } else if (type === 'success') {
            logClass += ' log-buy'; // 用绿色表示成功
        } else if (type === 'error') {
            logClass += ' log-sell'; // 用红色表示错误
        }
        
        logEntry.innerHTML = `<span class="log-time">[${time}]</span> <span class="${logClass}">${message}</span>`;
        logContainer.appendChild(logEntry);
        
        // 自动滚动到底部
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // 保持最多20条日志
        if (logContainer.children.length > 20) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }

    // ================= 手动交易 =================
    async function manualTrade(action) {
        if (isTrading) {
            addLog('交易进行中，请稍候...', 'info');
            return;
        }
        
        isTrading = true;
        
        const amountInput = document.getElementById('tradeAmount');
        const amount = parseFloat(amountInput.value) || 10;
        const statusEl = document.getElementById('tradeStatus');
        
        // 验证交易数量
        if (amount < 10) {
            alert('最小交易数量为 10 DOGE');
            isTrading = false;
            return;
        }
        
        if (action === 'buy') {
            await executeBuy(amount, statusEl);
        } else if (action === 'sell') {
            await executeSell(amount, statusEl);
        }
        
        isTrading = false;
    }

    // ================= 执行买入 =================
    async function executeBuy(amount, statusEl) {
        const cost = amount * currentPrice;
        
        // 检查余额
        if (cost > accountData.usdtBalance) {
            statusEl.textContent = 'USDT余额不足';
            statusEl.style.color = 'var(--accent-red)';
            addLog(`买入失败: 需要 ${cost.toFixed(2)} USDT, 余额 ${accountData.usdtBalance.toFixed(2)} USDT`, 'error');
            return;
        }
        
        // 检查是否已有持仓
        if (accountData.holding) {
            statusEl.textContent = '已有持仓，请先卖出';
            statusEl.style.color = 'var(--accent-red)';
            addLog('已有持仓，无法再次买入', 'error');
            return;
        }
        
        // 执行买入
        try {
            // 模拟网络延迟
            statusEl.textContent = '买入处理中...';
            statusEl.style.color = 'var(--accent-yellow)';
            
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // 更新账户数据
            const oldUsdtBalance = accountData.usdtBalance;
            const oldDogeBalance = accountData.dogeBalance;
            
            accountData.usdtBalance -= cost;
            accountData.dogeBalance += amount;
            accountData.holding = true;
            accountData.avgPrice = currentPrice;
            accountData.totalCost = cost;
            accountData.positionCount = 1;
            
            // 更新交易统计
            tradeStats.tradeCount++;
            
            // 更新日志
            addLog(`买入 ${amount} DOGE @ ${currentPrice.toFixed(5)} USDT`, 'buy');
            addLog(`USDT: ${oldUsdtBalance.toFixed(2)} → ${accountData.usdtBalance.toFixed(2)}`, 'info');
            addLog(`DOGE: ${oldDogeBalance.toFixed(2)} → ${accountData.dogeBalance.toFixed(2)}`, 'info');
            
            statusEl.textContent = '买入成功';
            statusEl.style.color = 'var(--accent-green)';
            
            // 更新界面
            updateBalance();
            updateProfitLoss();
            
        } catch (error) {
            statusEl.textContent = '买入失败';
            statusEl.style.color = 'var(--accent-red)';
            addLog('买入失败: ' + error.message, 'error');
        }
    }

    // ================= 执行卖出 =================
    async function executeSell(amount, statusEl) {
        // 检查持仓
        if (!accountData.holding || accountData.dogeBalance <= 0) {
            statusEl.textContent = '无持仓可卖';
            statusEl.style.color = 'var(--accent-red)';
            addLog('卖出失败: 无持仓', 'error');
            return;
        }
        
        if (amount > accountData.dogeBalance) {
            statusEl.textContent = '持仓数量不足';
            statusEl.style.color = 'var(--accent-red)';
            addLog(`卖出失败: 持仓 ${accountData.dogeBalance.toFixed(2)} DOGE, 尝试卖出 ${amount} DOGE`, 'error');
            return;
        }
        
        // 执行卖出
        try {
            statusEl.textContent = '卖出处理中...';
            statusEl.style.color = 'var(--accent-yellow)';
            
            await new Promise(resolve => setTimeout(resolve, 800));
            
            const oldUsdtBalance = accountData.usdtBalance;
            const oldDogeBalance = accountData.dogeBalance;
            
            // 计算收益
            const revenue = amount * currentPrice;
            const cost = amount * accountData.avgPrice;
            const profit = revenue - cost;
            
            // 更新账户数据
            accountData.usdtBalance += revenue;
            accountData.dogeBalance -= amount;
            
            // 更新持仓状态
            if (accountData.dogeBalance <= 0) {
                accountData.holding = false;
                accountData.avgPrice = 0;
                accountData.totalCost = 0;
                accountData.positionCount = 0;
            } else {
                // 部分卖出，重新计算平均成本
                accountData.totalCost -= cost;
            }
            
            // 更新交易统计
            tradeStats.tradeCount++;
            tradeStats.totalProfit += profit;
            tradeStats.todayProfit += profit;
            
            if (profit > 0) {
                tradeStats.winCount++;
            } else if (profit < 0) {
                tradeStats.lossCount++;
            }
            
            // 更新日志
            addLog(`卖出 ${amount} DOGE @ ${currentPrice.toFixed(5)} USDT`, 'sell');
            addLog(`收益: ${profit.toFixed(2)} USDT (${((profit/cost)*100).toFixed(2)}%)`, profit > 0 ? 'success' : 'error');
            addLog(`USDT: ${oldUsdtBalance.toFixed(2)} → ${accountData.usdtBalance.toFixed(2)}`, 'info');
            addLog(`DOGE: ${oldDogeBalance.toFixed(2)} → ${accountData.dogeBalance.toFixed(2)}`, 'info');
            
            statusEl.textContent = '卖出成功';
            statusEl.style.color = 'var(--accent-green)';
            
            // 更新界面
            updateBalance();
            updateProfitLoss();
            
        } catch (error) {
            statusEl.textContent = '卖出失败';
            statusEl.style.color = 'var(--accent-red)';
            addLog('卖出失败: ' + error.message, 'error');
        }
    }

    // ================= AI量化控制 =================
    function startAI() {
        if (isAIRunning) {
            addLog('AI量化已在运行中', 'info');
            alert('⚠️ AI量化已经在运行中');
            return;
        }
        
        isAIRunning = true;
        aiStartTime = Date.now();
        
        // 更新UI状态
        document.getElementById('aiStatusDot').className = 'status-dot status-running';
        document.getElementById('aiStatusText').textContent = 'AI量化运行中';
        document.getElementById('aiStatusText').style.color = 'var(--accent-green)';
        document.getElementById('aiStartBtn').disabled = true;
        document.getElementById('aiStopBtn').disabled = false;
        
        addLog('🚀 AI量化交易已启动', 'success');
        addLog('开始监控市场行情...', 'info');
        addLog('策略: 趋势跟踪 + 动态止盈止损', 'info');
        
        // 启动AI交易循环
        aiTimer = setInterval(runAIStrategy, 10000); // 每10秒执行一次
        
        // 更新运行时间
        updateAITime();
        
        alert('✅ AI量化交易已启动！\n系统将自动监控价格并执行交易');
    }

    function stopAI() {
        if (!isAIRunning) {
            addLog('AI量化未运行', 'info');
            alert('⚠️ AI量化未运行');
            return;
        }
        
        isAIRunning = false;
        clearInterval(aiTimer);
        
        // 更新UI状态
        document.getElementById('aiStatusDot').className = 'status-dot status-stopped';
        document.getElementById('aiStatusText').textContent = 'AI量化已停止';
        document.getElementById('aiStatusText').style.color = 'var(--accent-red)';
        document.getElementById('aiStartBtn').disabled = false;
        document.getElementById('aiStopBtn').disabled = true;
        
        const runtime = Math.floor((Date.now() - aiStartTime) / 1000);
        const minutes = Math.floor(runtime / 60);
        const seconds = runtime % 60;
        
        addLog(`⏹️ AI量化已停止`, 'info');
        addLog(`运行时长: ${minutes}分${seconds}秒`, 'info');
        addLog(`交易次数: ${tradeStats.tradeCount}次`, 'info');
        
        if (tradeStats.tradeCount > 0) {
            const winRate = (tradeStats.winCount / tradeStats.tradeCount * 100).toFixed(1);
            addLog(`胜率: ${winRate}%`, 'info');
        }
        
        alert('⏹️ AI量化交易已停止\n运行时长: ' + minutes + '分' + seconds + '秒');
    }

    function updateAITime() {
        if (!isAIRunning) return;
        
        const runtime = Math.floor((Date.now() - aiStartTime) / 1000);
        const minutes = Math.floor(runtime / 60);
        const seconds = runtime % 60;
        
        document.getElementById('aiRuntime').textContent = `运行: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // 继续更新时间
        setTimeout(updateAITime, 1000);
    }

    // ================= 获取当前信心指数 =================
    function getCurrentConfidence() {
        if (confidenceHistory.length === 0) {
            return 70; // 默认值
        }
        
        // 计算最近5个信心指数的平均值
        const recentConfidence = confidenceHistory.slice(-5);
        const sum = recentConfidence.reduce((a, b) => a + b, 0);
        return Math.round(sum / recentConfidence.length);
    }

    // ================= 更新AI信心指数 =================
    function updateAIConfidence() {
        // 基于价格趋势计算信心指数
        let confidence = 70; // 基础值
        
        if (chartData.length >= 10) {
            const recentPrices = chartData.slice(-10).map(item => item[1]);
            const oldestPrice = recentPrices[0];
            const latestPrice = recentPrices[recentPrices.length - 1];
            const priceChange = ((latestPrice - oldestPrice) / oldestPrice) * 100;
            
            // 价格趋势影响
            if (priceChange > 0.5) {
                confidence += 15; // 上涨趋势
            } else if (priceChange > 0.2) {
                confidence += 8;
            } else if (priceChange < -0.5) {
                confidence -= 15; // 下跌趋势
            } else if (priceChange < -0.2) {
                confidence -= 8;
            }
            
            // 持仓状态影响
            if (accountData.holding) {
                const currentProfit = (currentPrice - accountData.avgPrice) / accountData.avgPrice * 100;
                if (currentProfit > 1) {
                    confidence += 5; // 持仓盈利
                } else if (currentProfit < -1) {
                    confidence -= 5; // 持仓亏损
                }
            }
            
            // 交易量影响（模拟）
            const volumeFactor = Math.random() * 20 - 10; // -10 到 +10
            confidence += volumeFactor;
            
            // 限制范围
            confidence = Math.max(20, Math.min(95, confidence));
        }
        
        // 保存信心历史
        confidenceHistory.push(confidence);
        if (confidenceHistory.length > 20) {
            confidenceHistory.shift();
        }
        
        // 更新显示
        const confidenceValue = Math.round(confidence);
        document.getElementById('aiConfidenceValue').textContent = confidenceValue + '%';
        document.getElementById('confidenceValue').textContent = confidenceValue + '%';
        
        const confidenceBar = document.getElementById('confidenceBar');
        if (confidenceBar) {
            confidenceBar.style.width = confidenceValue + '%';
            
            // 根据信心值设置颜色
            if (confidenceValue >= 80) {
                confidenceBar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
            } else if (confidenceValue >= 60) {
                confidenceBar.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
            } else {
                confidenceBar.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
            }
        }
        
        return confidence;
    }

    // ================= AI交易策略 =================
    function runAIStrategy() {
        if (!isAIRunning) return;
        
        const confidence = getCurrentConfidence();
        
        // AI决策逻辑
        if (confidence >= 80) {
            // 高信心，考虑买入
            if (!accountData.holding && accountData.usdtBalance > 5) {
                const buyAmount = calculateAITradeAmount('buy');
                simulateAITrade('buy', buyAmount, confidence);
            } else if (accountData.holding) {
                // 检查是否应该加仓
                const currentProfit = (currentPrice - accountData.avgPrice) / accountData.avgPrice * 100;
                if (currentProfit < -1 && accountData.usdtBalance > 10) {
                    const addAmount = calculateAITradeAmount('buy');
                    simulateAITrade('buy', addAmount, confidence);
                }
            }
        } else if (confidence <= 40) {
            // 低信心，考虑卖出
            if (accountData.holding && accountData.dogeBalance > 0) {
                const sellAmount = calculateAITradeAmount('sell');
                simulateAITrade('sell', sellAmount, confidence);
            }
        } else {
            // 中等信心，观望
            addLog(`AI观望中 (信心: ${confidence}%)`, 'info');
        }
        
        // 检查止盈止损
        checkStopLossTakeProfit();
    }

    // ================= 计算AI交易数量 =================
    function calculateAITradeAmount(action) {
        if (action === 'buy') {
            const maxAmount = Math.floor(accountData.usdtBalance / currentPrice * 0.2); // 最多使用20%余额
            return Math.max(10, Math.min(50, maxAmount)); // 10-50 DOGE
        } else {
            if (!accountData.holding) return 0;
            const sellRatio = confidenceHistory.length > 0 ? 
                Math.max(0.1, Math.min(1.0, (100 - getCurrentConfidence()) / 100)) : 0.5;
            return Math.max(10, Math.floor(accountData.dogeBalance * sellRatio));
        }
    }

    // ================= 模拟AI交易 =================
    function simulateAITrade(action, amount, confidence) {
        if (isTrading) return;
        
        isTrading = true;
        
        setTimeout(() => {
            if (action === 'buy') {
                const cost = amount * currentPrice;
                if (cost <= accountData.usdtBalance) {
                    addLog(`🤖 AI买入 ${amount} DOGE (信心: ${confidence}%)`, 'buy');
                    // 模拟买入
                    accountData.usdtBalance -= cost;
                    accountData.dogeBalance += amount;
                    accountData.holding = true;
                    
                    if (accountData.avgPrice === 0) {
                        accountData.avgPrice = currentPrice;
                        accountData.totalCost = cost;
                    } else {
                        const totalAmount = accountData.dogeBalance;
                        const totalCost = accountData.totalCost + cost;
                        accountData.avgPrice = totalCost / totalAmount;
                        accountData.totalCost = totalCost;
                    }
                    
                    accountData.positionCount++;
                    tradeStats.tradeCount++;
                    
                    updateBalance();
                    updateProfitLoss();
                }
            } else if (action === 'sell') {
                if (accountData.dogeBalance >= amount) {
                    addLog(`🤖 AI卖出 ${amount} DOGE (信心: ${confidence}%)`, 'sell');
                    
                    const revenue = amount * currentPrice;
                    const cost = amount * accountData.avgPrice;
                    const profit = revenue - cost;
                    
                    // 模拟卖出
                    accountData.usdtBalance += revenue;
                    accountData.dogeBalance -= amount;
                    
                    if (accountData.dogeBalance <= 0) {
                        accountData.holding = false;
                        accountData.avgPrice = 0;
                        accountData.totalCost = 0;
                        accountData.positionCount = 0;
                    } else {
                        accountData.totalCost -= cost;
                    }
                    
                    tradeStats.tradeCount++;
                    tradeStats.totalProfit += profit;
                    tradeStats.todayProfit += profit;
                    
                    if (profit > 0) {
                        tradeStats.winCount++;
                    } else if (profit < 0) {
                        tradeStats.lossCount++;
                    }
                    
                    updateBalance();
                    updateProfitLoss();
                }
            }
            
            isTrading = false;
        }, 1000);
    }

    // ================= 检查止盈止损 =================
    function checkStopLossTakeProfit() {
        if (!accountData.holding || accountData.avgPrice <= 0) return;
        
        const profitPercent = (currentPrice - accountData.avgPrice) / accountData.avgPrice * 100;
        
        // 止盈：盈利3%
        if (profitPercent >= 3) {
            const sellAmount = Math.floor(accountData.dogeBalance * 0.5); // 卖出50%
            if (sellAmount >= 10) {
                addLog(`⚠️ 触发止盈 (盈利 ${profitPercent.toFixed(1)}%)`, 'sell');
                simulateAITrade('sell', sellAmount, 30);
            }
        }
        // 止损：亏损2%
        else if (profitPercent <= -2) {
            const sellAmount = Math.floor(accountData.dogeBalance * 0.5); // 卖出50%
            if (sellAmount >= 10) {
                addLog(`⚠️ 触发止损 (亏损 ${Math.abs(profitPercent).toFixed(1)}%)`, 'sell');
                simulateAITrade('sell', sellAmount, 20);
            }
        }
    }

    // ================= 事件监听器 =================
    function setupEventListeners() {
        // 监听交易数量输入
        const amountInput = document.getElementById('tradeAmount');
        if (amountInput) {
            amountInput.addEventListener('input', function() {
                updateTradeCost();
                updateTradeButtons();
            });
        }
        
        // 监听最大按钮点击
        const maxBtn = document.querySelector('.max-btn');
        if (maxBtn) {
            maxBtn.addEventListener('click', setMaxAmount);
        }
    }

    // ================= 设置最大交易数量 =================
    function setMaxAmount() {
        if (!accountData.holding) {
            // 计算最大可买入数量
            const maxBuy = Math.floor(accountData.usdtBalance / currentPrice);
            document.getElementById('tradeAmount').value = Math.max(10, maxBuy);
        } else {
            // 卖出所有持仓
            document.getElementById('tradeAmount').value = accountData.dogeBalance;
        }
        updateTradeCost();
        updateTradeButtons();
    }

    // ================= 页面初始化 =================
    document.addEventListener('DOMContentLoaded', function() {
        // 初始化图表
        initChart();
        
        // 设置事件监听
        setupEventListeners();
        
        // 初始更新
        updateBalance();
        updateProfitLoss();
        updateTradeCost();
        updateTradeButtons();
        updateAIConfidence();
        
        // 添加初始化日志
        addLog('系统初始化完成', 'info');
        addLog('当前价格: ' + currentPrice.toFixed(5) + ' USDT', 'info');
        addLog('USDT余额: ' + accountData.usdtBalance.toFixed(2), 'info');
        
        // 启动价格更新循环
        setInterval(updateChart, 2000);
        
        // 窗口大小变化时重绘图表
        window.addEventListener('resize', function() {
            if (chart) {
