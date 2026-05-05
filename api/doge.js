<script>
    // ================= 全局变量 =================
    let chart = null;
    let chartData = [];
    let isTrading = false;
    let aiTimer = null;
    let isAIRunning = false;
    let refreshInterval = null;
    let lastData = null;

    // ================= 初始化图表 =================
    function initChart() {
        const chartDom = document.getElementById('priceChart');
        chart = echarts.init(chartDom);
        
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
    }

    // ================= 从后端获取数据 =================
    async function fetchBackendData() {
        try {
            const response = await fetch('/api/doge');
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('获取后端数据失败:', error);
            addLog(`获取数据失败: ${error.message}`, 'error');
            return null;
        }
    }

    // ================= 更新UI界面 =================
    function updateUI(data) {
        if (!data || data.success === false) {
            const errorMsg = data?.error || '获取数据失败';
            addLog(`数据错误: ${errorMsg}`, 'error');
            return;
        }

        // 保存最新数据
        lastData = data;
        
        // 更新价格显示
        document.getElementById('currentPrice').textContent = data.price.toFixed(5);
        
        const changeEl = document.getElementById('priceChange');
        const changePercent = data.pnlPercent || 0;
        changeEl.textContent = (changePercent >= 0 ? '+' : '') + changePercent.toFixed(2) + '%';
        changeEl.style.color = changePercent >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        
        // 更新余额显示
        document.getElementById('usdtBalance').textContent = data.usdtBalance.toFixed(2);
        document.getElementById('dogeBalance').textContent = data.dogeBalance.toFixed(2);
        
        // 更新持仓状态
        const holdingEl = document.getElementById('holdingStatus');
        const avgPriceEl = document.getElementById('avgPrice');
        
        if (data.holding) {
            holdingEl.textContent = '持仓中';
            holdingEl.style.color = 'var(--accent-green)';
            if (data.avgPrice) {
                avgPriceEl.textContent = data.avgPrice.toFixed(5);
            } else {
                avgPriceEl.textContent = '--';
            }
        } else {
            holdingEl.textContent = '空仓';
            holdingEl.style.color = 'var(--text-secondary)';
            avgPriceEl.textContent = '--';
        }
        
        // 更新盈亏显示
        const pnlEl = document.getElementById('floatingPnl');
        const pnlPercentEl = document.getElementById('pnlPercent');
        
        pnlEl.textContent = (data.pnl >= 0 ? '+' : '') + data.pnl.toFixed(2) + ' USDT';
        pnlPercentEl.textContent = (data.pnlPercent >= 0 ? '+' : '') + data.pnlPercent.toFixed(2) + '%';
        
        const pnlClass = data.pnl >= 0 ? 'profit' : 'loss';
        pnlEl.className = 'stat-value ' + pnlClass;
        pnlPercentEl.className = 'stat-value ' + pnlClass;
        
        // 更新按钮状态
        updateButtonState(data);
        
        // 更新图表
        updateChart(data.price);
    }

    // ================= 更新图表 =================
    function updateChart(price) {
        const now = Date.now();
        
        // 添加新数据点
        chartData.push([now, price]);
        
        // 只保留最近100个点
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
    }

    // ================= 更新按钮状态 =================
    function updateButtonState(data) {
        const buyBtn = document.getElementById('buyBtn');
        const sellBtn = document.getElementById('sellBtn');
        const amountInput = document.getElementById('tradeAmount');
        const tradeStatus = document.getElementById('tradeStatus');
        
        // 获取交易数量
        const tradeAmount = parseInt(amountInput.value) || 10;
        const tradeCost = tradeAmount * data.price;
        
        if (buyBtn && sellBtn) {
            // 买入按钮状态
            if (data.holding) {
                buyBtn.disabled = true;
                buyBtn.title = '已有持仓，请先卖出';
            } else if (tradeCost > data.usdtBalance) {
                buyBtn.disabled = true;
                buyBtn.title = 'USDT余额不足';
            } else if (tradeAmount < 10) {
                buyBtn.disabled = true;
                buyBtn.title = '最小交易数量 10 DOGE';
            } else {
                buyBtn.disabled = false;
                buyBtn.title = '买入 DOGE';
            }
            
            // 卖出按钮状态
            if (!data.holding) {
                sellBtn.disabled = true;
                sellBtn.title = '无持仓可卖';
            } else if (tradeAmount > data.dogeBalance) {
                sellBtn.disabled = true;
                sellBtn.title = '持仓数量不足';
            } else {
                sellBtn.disabled = false;
                sellBtn.title = '卖出 DOGE';
            }
        }
        
        // 更新交易状态提示
        if (tradeStatus) {
            if (data.holding) {
                const profitPercent = data.pnlPercent || 0;
                if (profitPercent > 0) {
                    tradeStatus.textContent = `持仓盈利 ${profitPercent.toFixed(2)}%`;
                    tradeStatus.style.color = 'var(--accent-green)';
                } else if (profitPercent < 0) {
                    tradeStatus.textContent = `持仓亏损 ${Math.abs(profitPercent).toFixed(2)}%`;
                    tradeStatus.style.color = 'var(--accent-red)';
                } else {
                    tradeStatus.textContent = '持仓中';
                    tradeStatus.style.color = 'var(--text-secondary)';
                }
            } else {
                tradeStatus.textContent = '准备交易';
                tradeStatus.style.color = 'var(--text-secondary)';
            }
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
        
        let className = 'log-message';
        if (type === 'success') {
            className = 'log-success';
        } else if (type === 'error') {
            className = 'log-error';
        } else if (type === 'info') {
            className = 'log-info';
        }
        
        logEntry.innerHTML = `<span class="log-time">[${time}]</span> <span class="${className}">${message}</span>`;
        logContainer.appendChild(logEntry);
        
        // 自动滚动到底部
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // 保持最多20条日志
        if (logContainer.children.length > 20) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }

    // ================= 手动交易 =================
    async function executeManualTrade(side) {
        if (isTrading) {
            addLog('交易进行中，请稍候...', 'info');
            return;
        }
        
        isTrading = true;
        
        const amountInput = document.getElementById('tradeAmount');
        const amount = parseInt(amountInput.value) || 10;
        const statusEl = document.getElementById('tradeStatus');
        const buyBtn = document.getElementById('buyBtn');
        const sellBtn = document.getElementById('sellBtn');
        
        // 禁用交易按钮
        if (buyBtn) buyBtn.disabled = true;
        if (sellBtn) sellBtn.disabled = true;
        
        // 验证交易数量
        if (amount < 10) {
            alert('最小交易数量为 10 DOGE');
            isTrading = false;
            if (buyBtn) buyBtn.disabled = false;
            if (sellBtn) sellBtn.disabled = false;
            return;
        }
        
        // 更新状态显示
        statusEl.innerHTML = '<span class="loading"></span> 交易处理中...';
        statusEl.style.color = 'var(--accent-yellow)';
        
        try {
            addLog(`${side === 'buy' ? '买入' : '卖出'} ${amount} DOGE 请求中...`, 'info');
            
            // ✅ 调用后端交易接口
            const response = await fetch(`/api/doge?action=${side}`);
            const data = await response.json();
            
            if (data.success) {
                addLog(`✅ ${side === 'buy' ? '买入' : '卖出'}成功: ${data.amount || amount} DOGE`, 'success');
                statusEl.textContent = `${side === 'buy' ? '买入' : '卖出'}成功`;
                statusEl.style.color = 'var(--accent-green)';
                
                // 立即刷新数据
                await refreshData();
            } else {
                addLog(`❌ ${side === 'buy' ? '买入' : '卖出'}失败: ${data.error}`, 'error');
                statusEl.textContent = data.error || '交易失败';
                statusEl.style.color = 'var(--accent-red)';
            }
            
        } catch (error) {
            addLog(`网络错误: ${error.message}`, 'error');
            statusEl.textContent = '网络错误';
            statusEl.style.color = 'var(--accent-red)';
        } finally {
            isTrading = false;
            
            // 重新启用按钮
            setTimeout(() => {
                if (lastData) {
                    updateButtonState(lastData);
                }
            }, 1000);
        }
    }

    // ================= AI量化控制 =================
    function toggleAI() {
        if (isAIRunning) {
            // 停止AI量化
            stopAI();
        } else {
            // 启动AI量化
            startAI();
        }
    }
    
    function startAI() {
        if (isAIRunning) {
            addLog('AI量化已在运行中', 'info');
            return;
        }
        
        isAIRunning = true;
        
        // 更新UI状态
        document.getElementById('aiStartBtn').disabled = true;
        document.getElementById('aiStopBtn').disabled = false;
        document.getElementById('aiStatus').textContent = '状态: 运行中';
        document.getElementById('aiStatus').style.color = 'var(--accent-green)';
        
        addLog('🚀 AI量化交易已启动', 'success');
        addLog('策略: 趋势跟踪 + 动态止盈止损', 'info');
        
        // 启动AI交易循环
        aiTimer = setInterval(runAIStrategy, 10000); // 每10秒执行一次
        
        alert('✅ AI量化交易已启动！');
    }
    
    function stopAI() {
        if (!isAIRunning) {
            addLog('AI量化未运行', 'info');
            return;
        }
        
        isAIRunning = false;
        clearInterval(aiTimer);
        
        // 更新UI状态
        document.getElementById('aiStartBtn').disabled = false;
        document.getElementById('aiStopBtn').disabled = true;
        document.getElementById('aiStatus').textContent = '状态: 已停止';
        document.getElementById('aiStatus').style.color = 'var(--text-secondary)';
        
        addLog('⏹️ AI量化已停止', 'info');
        
        alert('⏹️ AI量化交易已停止');
    }
    
    // ================= AI交易策略 =================
    async function runAIStrategy() {
        if (!isAIRunning) return;
        
        try {
            const data = await fetchBackendData();
            if (!data || !data.success) return;
            
            // 简单的AI策略
            if (data.holding) {
                // 检查止盈止损
                if (data.pnlPercent >= 3) { // 盈利3%以上
                    addLog(`AI触发止盈: 盈利 ${data.pnlPercent.toFixed(2)}%`, 'info');
                    await executeManualTrade('sell');
                } else if (data.pnlPercent <= -2) { // 亏损2%以上
                    addLog(`AI触发止损: 亏损 ${Math.abs(data.pnlPercent).toFixed(2)}%`, 'info');
                    await executeManualTrade('sell');
                }
            } else {
                // 空仓时，检查买入机会
                if (data.usdtBalance > 10) { // 有足够余额
                    addLog('AI检查买入机会...', 'info');
                    // 这里可以添加更复杂的买入逻辑
                }
            }
        } catch (error) {
            console.error('AI策略执行错误:', error);
        }
    }

    // ================= 刷新数据 =================
    async function refreshData() {
        try {
            const data = await fetchBackendData();
            updateUI(data);
        } catch (error) {
            console.error('刷新数据失败:', error);
        }
    }

    // ================= 页面初始化 =================
    document.addEventListener('DOMContentLoaded', () => {
        // 初始化图表
        initChart();
        
        // 初始化日志
        addLog('系统初始化完成', 'info');
        addLog('正在连接后端服务器...', 'info');
        
        // 首次加载数据
        refreshData();
        
        // 设置定时刷新
        refreshInterval = setInterval(refreshData, 3000); // 每3秒刷新一次
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (chart) {
                chart.resize();
            }
        });
        
        // 监听交易数量输入变化
        const amountInput = document.getElementById('tradeAmount');
        if (amountInput) {
            amountInput.addEventListener('input', () => {
                if (lastData) {
                    updateButtonState(lastData);
                }
            });
        }
    });
</script>
