<script>
    // ================= 全局变量 =================
    let chart = null;
    let chartData = [];
    let isTrading = false;
    let aiTimer = null;
    let isAIRunning = false;
    let refreshInterval = null;
    let lastData = null;
    let aiStartTime = null;
    
    // API地址 - 自动检测环境
    const API_BASE = window.location.hostname.includes('localhost') 
        ? 'http://localhost:3000'  // 本地开发
        : '';                      // 线上部署

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
            const response = await fetch(`${API_BASE}/api/doge`);
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

    // ================= 获取量化状态 =================
    async function fetchQuantStatus() {
        try {
            const response = await fetch(`${API_BASE}/api/doge?action=quant_status`);
            if (!response.ok) return { running: false };
            return await response.json();
        } catch (error) {
            return { running: false };
        }
    }

    // ================= 更新UI界面 =================
    function updateUI(data) {
        if (!data) {
            // 没有数据时显示占位符
            document.getElementById('currentPrice').textContent = '--';
            document.getElementById('priceChange').textContent = '--';
            document.getElementById('usdtBalance').textContent = '--';
            document.getElementById('dogeBalance').textContent = '--';
            document.getElementById('holdingStatus').textContent = '--';
            document.getElementById('avgPrice').textContent = '--';
            document.getElementById('floatingPnl').textContent = '--';
            document.getElementById('pnlPercent').textContent = '--';
            document.getElementById('tradeStatus').textContent = '连接失败';
            document.getElementById('tradeStatus').style.color = 'var(--accent-red)';
            return;
        }

        if (data.success === false) {
            const errorMsg = data?.error || '获取数据失败';
            addLog(`数据错误: ${errorMsg}`, 'error');
            document.getElementById('tradeStatus').textContent = errorMsg;
            document.getElementById('tradeStatus').style.color = 'var(--accent-red)';
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
            avgPriceEl.textContent = data.avgPrice ? data.avgPrice.toFixed(5) + ' USDT' : '--';
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
        
        // 更新AI量化状态
        if (data.quantEnabled !== undefined) {
            updateAIStatus(data.quantEnabled);
        }
        
        // 更新按钮状态
        updateButtonState(data);
        
        // 更新图表
        updateChart(data.price);
        
        // 更新交易状态
        document.getElementById('tradeStatus').textContent = '数据已更新';
        document.getElementById('tradeStatus').style.color = 'var(--accent-green)';
    }

    // ================= 更新AI量化状态 =================
    function updateAIStatus(isRunning) {
        isAIRunning = isRunning;
        const startBtn = document.getElementById('aiStartBtn');
        const stopBtn = document.getElementById('aiStopBtn');
        const statusText = document.getElementById('aiStatus');
        
        if (startBtn && stopBtn && statusText) {
            if (isRunning) {
                startBtn.disabled = true;
                stopBtn.disabled = false;
                statusText.textContent = '状态: 运行中';
                statusText.style.color = 'var(--accent-green)';
            } else {
                startBtn.disabled = false;
                stopBtn.disabled = true;
                statusText.textContent = '状态: 已停止';
                statusText.style.color = 'var(--text-secondary)';
            }
        }
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
        
        if (!buyBtn || !sellBtn) return;
        
        // 获取交易数量
        const tradeAmount = parseInt(amountInput.value) || 10;
        const tradeCost = tradeAmount * data.price;
        
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

    // ================= 添加日志 =================
    function addLog(message, type = 'info') {
        const logContainer = document.getElementById('logContainer');
        if (!logContainer) return;
        
        const now = new Date();
        const time = now.toLocaleTimeString();
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        let className = 'log-info';
        if (type === 'success') {
            className = 'log-success';
        } else if (type === 'error') {
            className = 'log-error';
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
            
            // ✅ 调用后端交易接口 - 修正了参数格式
            const response = await fetch(`${API_BASE}/api/doge?action=${side}`);
            const data = await response.json();
            
            if (data.success) {
                addLog(`✅ ${side === 'buy' ? '买入' : '卖出'}成功`, 'success');
                if (data.amount) {
                    addLog(`数量: ${data.amount} DOGE, 价格: ${data.price} USDT`, 'success');
                }
                statusEl.textContent = `${side === 'buy' ? '买入' : '卖出'}成功`;
                statusEl.style.color = 'var(--accent-green)';
                
                // 立即刷新数据
                await refreshData();
            } else {
                addLog(`❌ 交易失败: ${data.error}`, 'error');
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
    async function startAI() {
        if (isAIRunning) {
            addLog('AI量化已在运行中', 'info');
            return;
        }
        
        try {
            addLog('启动AI量化交易...', 'info');
            
            const response = await fetch(`${API_BASE}/api/doge?action=quant_start`);
            const data = await response.json();
            
            if (data.success) {
                isAIRunning = true;
                aiStartTime = Date.now();
                
                // 更新UI状态
                updateAIStatus(true);
                
                addLog('🚀 AI量化交易已启动', 'success');
                addLog('策略: 趋势跟踪 + 动态止盈止损', 'info');
                
                // 启动AI交易循环
                aiTimer = setInterval(runAIStrategy, 10000);
                
                alert('✅ AI量化交易已启动！');
            } else {
                addLog(`启动失败: ${data.error || '未知错误'}`, 'error');
                alert('❌ 启动失败: ' + (data.error || '未知错误'));
            }
        } catch (error) {
            addLog(`启动失败: ${error.message}`, 'error');
            alert('❌ 网络错误: ' + error.message);
        }
    }
    
    async function stopAI() {
        if (!isAIRunning) {
            addLog('AI量化未运行', 'info');
            return;
        }
        
        try {
            addLog('停止AI量化交易...', 'info');
            
            const response = await fetch(`${API_BASE}/api/doge?action=quant_stop`);
            const data = await response.json();
            
            if (data.success) {
                isAIRunning = false;
                clearInterval(aiTimer);
                
                // 更新UI状态
                updateAIStatus(false);
                
                const runtime = aiStartTime ? Math.floor((Date.now() - aiStartTime) / 1000) : 0;
                addLog(`⏹️ AI量化已停止, 运行时长: ${runtime}秒`, 'info');
                
                alert('⏹️ AI量化交易已停止');
            } else {
                addLog(`停止失败: ${data.error || '未知错误'}`, 'error');
                alert('❌ 停止失败: ' + (data.error || '未知错误'));
            }
        } catch (error) {
            addLog(`停止失败: ${error.message}`, 'error');
            alert('❌ 网络错误: ' + error.message);
        }
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
        
        // 首次加载数据
        refreshData();
        
        // 设置定时刷新
        refreshInterval = setInterval(refreshData, 3000);
        
        // 检查AI量化状态
        fetchQuantStatus().then(data => {
            if (data.running) {
                isAIRunning = true;
                updateAIStatus(true);
                addLog('检测到AI量化正在运行', 'info');
                aiTimer = setInterval(runAIStrategy, 10000);
            }
        });
        
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
        
        // 添加快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                refreshData();
                addLog('手动刷新数据', 'info');
            }
        });
    });

    // 导出函数到全局
    window.executeManualTrade = executeManualTrade;
    window.startAI = startAI;
    window.stopAI = stopAI;
</script>
