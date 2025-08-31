/**
 * 感測器數值異常檢測和警報系統
 * 功能：
 * 1. 檢測感測器數值是否超出正常範圍
 * 2. 根據異常程度顯示不同的視覺警告
 * 3. 播放警報聲
 * 4. 顯示全螢幕警報覆蓋層
 */

class SensorAlertSystem {
    constructor() {
        this.alertAudio = null;
        this.isAlertPlaying = false;
        this.alertQueue = [];
        this.alertConfig = this.getDefaultAlertConfig();
        this.individualSensorConfigs = this.loadIndividualSensorConfigs();
        this.sensorLastUpdate = new Map(); // 追蹤感測器最後更新時間
        this.offlineTimers = new Map(); // 離線檢測計時器
        this.offlineThreshold = 30000; // 30秒離線閾值
        this.alertLog = []; // 警報記錄
        this.maxLogEntries = 50; // 最大記錄數量
        this.initAudio();
        this.startOfflineMonitoring();
        this.initAlertLogUI();
    }

    /**
     * 獲取預設的警報配置
     */
    getDefaultAlertConfig() {
        return {
            temperature: {
                normal: { min: 15, max: 35 },
                warning: { offset: 5 },   // ±5°C 警告
                danger: { offset: 10 },   // ±10°C 危險
                critical: { offset: 15 }  // ±15°C 臨界
            },
            humidity: {
                normal: { min: 40, max: 80 },
                warning: { offset: 10 },  // ±10% 警告
                danger: { offset: 20 },   // ±20% 危險
                critical: { offset: 30 }  // ±30% 臨界
            },
            co2: {
                normal: { min: 300, max: 1000 },
                warning: { offset: 200 },  // ±200ppm 警告
                danger: { offset: 500 },   // ±500ppm 危險
                critical: { offset: 1000 } // ±1000ppm 臨界
            },
            water: {
                normal: { min: 0, max: 100 },
                warning: { offset: 5 },   // ±5% 警告
                danger: { offset: 10 },   // ±10% 危險
                critical: { offset: 20 }  // ±20% 臨界
            },
            pressure: {
                normal: { min: 900, max: 1100 },
                warning: { offset: 50 },  // ±50hPa 警告
                danger: { offset: 100 },  // ±100hPa 危險
                critical: { offset: 150 } // ±150hPa 臨界
            },
            wind: {
                normal: { min: 0, max: 20 },
                warning: { offset: 5 },   // ±5 m/s 警告
                danger: { offset: 10 },   // ±10 m/s 危險
                critical: { offset: 20 }  // ±20 m/s 臨界
            }
        };
    }

    /**
     * 轉換舊格式配置為新格式
     * @param {object} config - 配置對象
     * @returns {object} 標準化的配置對象
     */
    normalizeConfig(config) {
        // 如果已經是新格式，直接返回
        if (config.normal && config.warning && config.warning.offset !== undefined) {
            return config;
        }
        
        // 轉換舊格式為新格式
        if (config.min !== undefined && config.max !== undefined) {
            // 舊格式：{ min, max, warning: {min, max}, danger: {min, max}, critical: {min, max} }
            return {
                normal: { 
                    min: config.min, 
                    max: config.max 
                },
                warning: { 
                    offset: config.warning ? Math.max(
                        Math.abs(config.warning.min - config.min),
                        Math.abs(config.warning.max - config.max)
                    ) : 5 
                },
                danger: { 
                    offset: config.danger ? Math.max(
                        Math.abs(config.danger.min - config.min),
                        Math.abs(config.danger.max - config.max)
                    ) : 10 
                },
                critical: { 
                    offset: config.critical ? Math.max(
                        Math.abs(config.critical.min - config.min),
                        Math.abs(config.critical.max - config.max)
                    ) : 20 
                }
            };
        }
        
        // 如果格式不明，返回預設配置
        console.warn('未知的配置格式，使用預設配置:', config);
        return {
            normal: { min: 0, max: 100 },
            warning: { offset: 5 },
            danger: { offset: 10 },
            critical: { offset: 20 }
        };
    }

    /**
     * 初始化音頻
     */
    initAudio() {
        try {
            // 創建警報音頻上下文
            this.alertAudio = new (window.AudioContext || window.webkitAudioContext)();
            console.log('🔊 警報音頻系統已初始化');
        } catch (error) {
            console.warn('⚠️ 無法初始化音頻系統:', error);
        }
    }



    /**
     * 檢查感測器數值是否異常
     * @param {string} sensorId - 感測器ID
     * @param {string} sensorType - 感測器類型
     * @param {number} value - 數值
     * @param {string} unit - 單位
     * @returns {object} 異常狀態和等級
     */
    checkSensorValue(sensorId, sensorType, value, unit = '') {
        // 更新感測器最後上線時間
        this.updateSensorLastSeen(sensorId);
        
        // 根據單位判斷數值類型
        const valueType = this.getValueTypeByUnit(unit);
        
        // 優先使用個別感測器的特定數值類型配置
        let config = this.getIndividualSensorValueConfig(sensorId, valueType);
        
        // 如果沒有個別配置，使用感測器類型的特定數值類型配置
        if (!config) {
            config = this.getValueTypeConfig(sensorType, valueType);
        }
        
        // 如果還是沒有配置，使用通用配置
        if (!config) {
            config = this.alertConfig[valueType] || this.alertConfig[sensorType];
        }
        
        if (!config) {
            return { isAbnormal: false, level: 'normal', message: '' };
        }

        // 轉換舊格式配置為新格式
        config = this.normalizeConfig(config);
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            return { isAbnormal: false, level: 'normal', message: '' };
        }

        // 更新感測器最後更新時間
        this.updateSensorLastSeen(sensorId);

        let level = 'normal';
        let message = `感測器 ${sensorId} ${valueType}數值正常`;

        // 檢查是否在正常範圍內
        if (numValue >= config.normal.min && numValue <= config.normal.max) {
            // 在正常範圍內，不需要警報
            level = 'normal';
        } else {
            // 超出正常範圍，計算偏差程度
            let deviation = 0;
            if (numValue < config.normal.min) {
                deviation = config.normal.min - numValue;
            } else if (numValue > config.normal.max) {
                deviation = numValue - config.normal.max;
            }

            // 根據偏差程度判定警報等級
            if (deviation >= config.critical.offset) {
                level = 'critical';
                message = `感測器 ${sensorId} ${valueType}數值 ${numValue}${unit} 超出正常範圍 ${deviation.toFixed(1)}${unit}，達到臨界等級！`;
            } else if (deviation >= config.danger.offset) {
                level = 'danger';
                message = `感測器 ${sensorId} ${valueType}數值 ${numValue}${unit} 超出正常範圍 ${deviation.toFixed(1)}${unit}，達到危險等級！`;
            } else if (deviation >= config.warning.offset) {
                level = 'warning';
                message = `感測器 ${sensorId} ${valueType}數值 ${numValue}${unit} 超出正常範圍 ${deviation.toFixed(1)}${unit}，達到警告等級！`;
            } else {
                level = 'normal';
                message = `感測器 ${sensorId} ${valueType}數值正常`;
            }
        }

        return {
            isAbnormal: level !== 'normal',
            level: level,
            message: message,
            value: numValue,
            config: config,
            sensorId: sensorId,
            sensorType: sensorType,
            valueType: valueType,
            unit: unit
        };
    }

    /**
     * 應用異常樣式到感測器卡片
     * @param {HTMLElement} sensorCard - 感測器卡片元素
     * @param {object} alertInfo - 警報資訊
     */
    applyAlertStyle(sensorCard, alertInfo) {
        if (!sensorCard || !alertInfo.isAbnormal) return;

        // 移除舊的警告樣式
        sensorCard.classList.remove('warning', 'danger', 'critical');
        
        // 添加新的警告樣式
        if (alertInfo.level === 'critical') {
            sensorCard.classList.add('critical');
        } else if (alertInfo.level === 'danger') {
            sensorCard.classList.add('danger');
        } else if (alertInfo.level === 'warning') {
            sensorCard.classList.add('warning');
        }

        // 添加警報圖示
        this.addAlertIcon(sensorCard, alertInfo.level);

        // 應用數值樣式
        this.applyValueStyle(sensorCard, alertInfo);

        // 觸發警報
        this.triggerAlert(alertInfo);
    }

    /**
     * 添加警報圖示
     * @param {HTMLElement} sensorCard - 感測器卡片元素
     * @param {string} level - 警報等級
     */
    addAlertIcon(sensorCard, level) {
        // 移除舊的警報圖示
        const existingIcon = sensorCard.querySelector('.alert-icon');
        if (existingIcon) {
            existingIcon.remove();
        }

        // 創建新的警報圖示
        const icon = document.createElement('div');
        icon.className = `alert-icon ${level}`;
        icon.innerHTML = level === 'critical' ? '!' : '⚠';
        icon.title = `${level} 等級警報`;
        
        sensorCard.style.position = 'relative';
        sensorCard.appendChild(icon);
    }

    /**
     * 應用數值樣式
     * @param {HTMLElement} sensorCard - 感測器卡片元素
     * @param {object} alertInfo - 警報資訊
     */
    applyValueStyle(sensorCard, alertInfo) {
        const valueElements = sensorCard.querySelectorAll('.sensor-value-inline');
        valueElements.forEach(element => {
            element.classList.remove('warning', 'danger', 'critical');
            if (alertInfo.level !== 'normal') {
                element.classList.add(alertInfo.level);
            }
        });
    }

    /**
     * 觸發警報
     * @param {object} alertInfo - 警報資訊
     */
    triggerAlert(alertInfo) {
        // 添加到警報佇列
        this.alertQueue.push(alertInfo);

        // 播放警報聲
        this.playAlertSound(alertInfo.level);

        // 記錄警報
        this.logAlert(alertInfo);
    }

    /**
     * 播放警報聲
     * @param {string} level - 警報等級
     */
    async playAlertSound(level) {
        if (!this.alertAudio || this.isAlertPlaying) return;

        try {
            this.isAlertPlaying = true;

            // 根據警報等級調整音頻參數
            const frequency = level === 'critical' ? 800 : level === 'danger' ? 600 : 400;
            const duration = level === 'critical' ? 0.3 : level === 'danger' ? 0.2 : 0.1;
            const volume = level === 'critical' ? 0.8 : level === 'danger' ? 0.6 : 0.4;

            // 創建振盪器
            const oscillator = this.alertAudio.createOscillator();
            const gainNode = this.alertAudio.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.alertAudio.destination);

            // 設置音頻參數
            oscillator.frequency.setValueAtTime(frequency, this.alertAudio.currentTime);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0, this.alertAudio.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, this.alertAudio.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.alertAudio.currentTime + duration);

            // 播放音頻
            oscillator.start(this.alertAudio.currentTime);
            oscillator.stop(this.alertAudio.currentTime + duration);

            // 等待音頻播放完成
            await new Promise(resolve => setTimeout(resolve, duration * 1000));
            this.isAlertPlaying = false;

        } catch (error) {
            console.error('❌ 播放警報聲失敗:', error);
            this.isAlertPlaying = false;
        }
    }



    /**
     * 記錄警報
     * @param {object} alertInfo - 警報資訊
     */
    logAlert(alertInfo) {
        const timestamp = new Date();
        const logEntry = {
            id: Date.now() + Math.random(), // 唯一ID
            timestamp: timestamp,
            level: alertInfo.level,
            message: alertInfo.message,
            sensorId: alertInfo.sensorId || 'unknown',
            sensorType: alertInfo.sensorType || 'unknown',
            value: alertInfo.value || 'N/A',
            unit: alertInfo.unit || '',
            acknowledged: false // 是否已確認
        };

        // 添加到記錄陣列（最新的在前面）
        this.alertLog.unshift(logEntry);

        // 限制記錄數量
        if (this.alertLog.length > this.maxLogEntries) {
            this.alertLog = this.alertLog.slice(0, this.maxLogEntries);
        }

        // 控制台記錄
        console.log(`🚨 [${timestamp.toLocaleString('zh-TW')}] ${alertInfo.level.toUpperCase()} 警報: ${alertInfo.message}`);

        // 更新UI顯示
        this.updateAlertLogUI();

        // 保存到本地儲存
        this.saveAlertLog();
    }

    /**
     * 初始化警報記錄UI
     */
    initAlertLogUI() {
        // 載入保存的警報記錄
        this.loadAlertLog();
        
        // 創建浮動警報記錄按鈕
        this.createAlertLogButton();
    }

    /**
     * 創建警報記錄按鈕
     */
    createAlertLogButton() {
        // 避免重複創建
        if (document.getElementById('alert-log-btn')) return;

        const button = document.createElement('button');
        button.id = 'alert-log-btn';
        button.className = 'btn btn-outline-warning position-fixed';
        button.style.cssText = 'bottom: 20px; right: 20px; z-index: 1050; border-radius: 50%; width: 60px; height: 60px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);';
        button.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        button.title = '查看警報記錄';
        button.onclick = () => this.showAlertLogModal();

        // 添加未確認警報數量標章
        const badge = document.createElement('span');
        badge.id = 'alert-log-badge';
        badge.className = 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger';
        badge.style.display = 'none';
        button.appendChild(badge);

        document.body.appendChild(button);
    }

    /**
     * 更新警報記錄UI
     */
    updateAlertLogUI() {
        const badge = document.getElementById('alert-log-badge');
        if (badge) {
            const unacknowledgedCount = this.alertLog.filter(log => !log.acknowledged).length;
            if (unacknowledgedCount > 0) {
                badge.textContent = unacknowledgedCount > 99 ? '99+' : unacknowledgedCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    /**
     * 顯示警報記錄模態對話框
     */
    showAlertLogModal() {
        // 創建模態對話框（如果不存在）
        let modal = document.getElementById('alert-log-modal');
        if (!modal) {
            modal = this.createAlertLogModal();
        }

        // 更新模態內容
        this.updateAlertLogModalContent();

        // 顯示模態
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    /**
     * 創建警報記錄模態對話框
     */
    createAlertLogModal() {
        const modalHTML = `
            <div class="modal fade" id="alert-log-modal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle text-warning me-2"></i>
                                警報記錄
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <button class="btn btn-sm btn-success" onclick="window.sensorAlertSystem.acknowledgeAllAlerts()">
                                        <i class="fas fa-check-double me-1"></i>全部確認
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary ms-2" onclick="window.sensorAlertSystem.clearAlertLog()">
                                        <i class="fas fa-trash me-1"></i>清除記錄
                                    </button>
                                </div>
                                <small class="text-muted">最多顯示 ${this.maxLogEntries} 筆記錄</small>
                            </div>
                            <div id="alert-log-content" class="alert-log-container" style="max-height: 400px; overflow-y: auto;">
                                <!-- 警報記錄將在這裡顯示 -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        return document.getElementById('alert-log-modal');
    }

    /**
     * 更新警報記錄模態內容
     */
    updateAlertLogModalContent() {
        const container = document.getElementById('alert-log-content');
        if (!container) return;

        if (this.alertLog.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-smile fa-2x mb-2"></i>
                    <p>目前沒有警報記錄</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.alertLog.forEach(log => {
            const levelColors = {
                warning: 'warning',
                danger: 'danger', 
                critical: 'danger'
            };
            const levelIcons = {
                warning: 'exclamation-triangle',
                danger: 'exclamation-circle',
                critical: 'times-circle'
            };

            html += `
                <div class="alert alert-${levelColors[log.level] || 'secondary'} ${log.acknowledged ? 'opacity-50' : ''} mb-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-1">
                                <i class="fas fa-${levelIcons[log.level] || 'info-circle'} me-2"></i>
                                <strong class="text-uppercase">${log.level}</strong>
                                ${log.acknowledged ? '<span class="badge bg-success ms-2">已確認</span>' : ''}
                            </div>
                            <div class="mb-1">${log.message}</div>
                            <small class="text-muted">
                                <i class="fas fa-clock me-1"></i>${log.timestamp.toLocaleString('zh-TW')}
                                | <i class="fas fa-microchip me-1"></i>${log.sensorId}
                                | <i class="fas fa-chart-line me-1"></i>${log.value} ${log.unit}
                            </small>
                        </div>
                        <div class="ms-2">
                            ${!log.acknowledged ? `
                                <button class="btn btn-sm btn-outline-success" 
                                        onclick="window.sensorAlertSystem.acknowledgeAlert('${log.id}')"
                                        title="確認此警報">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * 確認單個警報
     */
    acknowledgeAlert(logId) {
        const log = this.alertLog.find(l => l.id == logId);
        if (log) {
            log.acknowledged = true;
            this.updateAlertLogModalContent();
            this.updateAlertLogUI();
            this.saveAlertLog();
        }
    }

    /**
     * 確認所有警報
     */
    acknowledgeAllAlerts() {
        this.alertLog.forEach(log => log.acknowledged = true);
        this.updateAlertLogModalContent();
        this.updateAlertLogUI();
        this.saveAlertLog();
    }

    /**
     * 清除警報記錄
     */
    clearAlertLog() {
        if (confirm('確定要清除所有警報記錄嗎？')) {
            this.alertLog = [];
            this.updateAlertLogModalContent();
            this.updateAlertLogUI();
            this.saveAlertLog();
        }
    }

    /**
     * 保存警報記錄到本地儲存
     */
    saveAlertLog() {
        try {
            localStorage.setItem('sensor_alert_log', JSON.stringify(this.alertLog));
        } catch (error) {
            console.warn('無法保存警報記錄:', error);
        }
    }

    /**
     * 從本地儲存載入警報記錄
     */
    loadAlertLog() {
        try {
            const saved = localStorage.getItem('sensor_alert_log');
            if (saved) {
                this.alertLog = JSON.parse(saved).map(log => ({
                    ...log,
                    timestamp: new Date(log.timestamp) // 轉換回Date對象
                }));
                this.updateAlertLogUI();
            }
        } catch (error) {
            console.warn('無法載入警報記錄:', error);
            this.alertLog = [];
        }
    }

    /**
     * 發送警報到伺服器
     * @param {object} alertInfo - 警報資訊
     */
    async sendAlertToServer(alertInfo) {
        try {
            const response = await fetch('/api/alerts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'sensor_alert',
                    level: alertInfo.level,
                    message: alertInfo.message,
                    sensorType: alertInfo.sensorType,
                    value: alertInfo.value,
                    timestamp: new Date().toISOString()
                })
            });

            if (response.ok) {
                console.log('✅ 警報已發送到伺服器');
            }
        } catch (error) {
            console.error('❌ 發送警報到伺服器失敗:', error);
        }
    }

    /**
     * 清除感測器卡片的警報樣式
     * @param {HTMLElement} sensorCard - 感測器卡片元素
     */
    clearAlertStyle(sensorCard) {
        if (!sensorCard) return;

        // 移除警告樣式
        sensorCard.classList.remove('warning', 'danger', 'critical');
        
        // 移除警報圖示
        const alertIcon = sensorCard.querySelector('.alert-icon');
        if (alertIcon) {
            alertIcon.remove();
        }

        // 移除數值警告樣式
        const valueElements = sensorCard.querySelectorAll('.sensor-value-inline');
        valueElements.forEach(element => {
            element.classList.remove('warning', 'danger', 'critical');
        });
    }



    /**
     * 載入個別感測器配置
     * @returns {object} 個別感測器配置
     */
    loadIndividualSensorConfigs() {
        try {
            const savedConfigs = localStorage.getItem('individualSensorConfigs');
            if (savedConfigs) {
                console.log('📥 從本地儲存載入個別感測器配置');
                return JSON.parse(savedConfigs);
            }
        } catch (error) {
            console.warn('⚠️ 載入個別感測器配置失敗:', error);
        }
        return {};
    }

    /**
     * 獲取個別感測器配置
     * @param {string} sensorId - 感測器ID
     * @returns {object|null} 感測器配置
     */
    getIndividualSensorConfig(sensorId) {
        if (!this.individualSensorConfigs) {
            this.individualSensorConfigs = this.loadIndividualSensorConfigs();
        }
        return this.individualSensorConfigs[sensorId] || null;
    }

    /**
     * 設置個別感測器配置
     * @param {string} sensorId - 感測器ID
     * @param {object} config - 感測器配置
     */
    setIndividualSensorConfig(sensorId, config) {
        if (!this.individualSensorConfigs) {
            this.individualSensorConfigs = this.loadIndividualSensorConfigs();
        }
        
        this.individualSensorConfigs[sensorId] = config;
        
        try {
            localStorage.setItem('individualSensorConfigs', JSON.stringify(this.individualSensorConfigs));
            console.log(`🔧 感測器 ${sensorId} 的個別配置已儲存`);
        } catch (error) {
            console.error('❌ 儲存個別感測器配置失敗:', error);
        }
    }

    /**
     * 刪除個別感測器配置
     * @param {string} sensorId - 感測器ID
     */
    removeIndividualSensorConfig(sensorId) {
        if (!this.individualSensorConfigs) {
            this.individualSensorConfigs = this.loadIndividualSensorConfigs();
        }
        
        delete this.individualSensorConfigs[sensorId];
        
        try {
            localStorage.setItem('individualSensorConfigs', JSON.stringify(this.individualSensorConfigs));
            console.log(`🗑️ 感測器 ${sensorId} 的個別配置已刪除`);
        } catch (error) {
            console.error('❌ 刪除個別感測器配置失敗:', error);
        }
    }

    /**
     * 根據單位判斷數值類型
     * @param {string} unit - 單位
     * @returns {string} 數值類型
     */
    getValueTypeByUnit(unit) {
        const unitMapping = {
            '℃': 'temperature',
            '°C': 'temperature',
            'C': 'temperature',
            '%': 'humidity',
            'ppm': 'co2',
            'hPa': 'pressure',
            'mbar': 'pressure',
            'Pa': 'pressure',
            'm/s': 'wind',
            'km/h': 'wind',
            'L': 'water',
            'ml': 'water',
            'lux': 'light',
            'pH': 'ph',
            'dB': 'noise'
        };
        
        return unitMapping[unit] || 'unknown';
    }

    /**
     * 獲取個別感測器的特定數值類型配置
     * @param {string} sensorId - 感測器ID
     * @param {string} valueType - 數值類型
     * @returns {object|null} 配置
     */
    getIndividualSensorValueConfig(sensorId, valueType) {
        const sensorConfig = this.getIndividualSensorConfig(sensorId);
        if (sensorConfig && sensorConfig.values && sensorConfig.values[valueType]) {
            return sensorConfig.values[valueType];
        }
        return null;
    }

    /**
     * 設置個別感測器的特定數值類型配置
     * @param {string} sensorId - 感測器ID
     * @param {string} valueType - 數值類型
     * @param {object} config - 配置
     */
    setIndividualSensorValueConfig(sensorId, valueType, config) {
        if (!this.individualSensorConfigs) {
            this.individualSensorConfigs = this.loadIndividualSensorConfigs();
        }
        
        if (!this.individualSensorConfigs[sensorId]) {
            this.individualSensorConfigs[sensorId] = { values: {} };
        }
        
        if (!this.individualSensorConfigs[sensorId].values) {
            this.individualSensorConfigs[sensorId].values = {};
        }
        
        this.individualSensorConfigs[sensorId].values[valueType] = config;
        
        try {
            localStorage.setItem('individualSensorConfigs', JSON.stringify(this.individualSensorConfigs));
            console.log(`🔧 感測器 ${sensorId} 的 ${valueType} 個別配置已儲存`);
        } catch (error) {
            console.error('❌ 儲存個別感測器數值配置失敗:', error);
        }
    }

    /**
     * 獲取感測器類型的特定數值類型配置
     * @param {string} sensorType - 感測器類型
     * @param {string} valueType - 數值類型
     * @returns {object|null} 配置
     */
    getValueTypeConfig(sensorType, valueType) {
        // 溫濕度感測器的配置映射
        if (sensorType === 'humidity' || sensorType === 'temperature') {
            if (valueType === 'temperature') {
                return this.alertConfig.temperature;
            } else if (valueType === 'humidity') {
                return this.alertConfig.humidity;
            }
        }
        
        return null;
    }



    /**
     * 獲取當前警報配置
     * @returns {object} 當前警報配置
     */
    getAlertConfig() {
        return this.alertConfig;
    }

    /**
     * 測試警報系統
     */
    testAlert() {
        console.log('🧪 測試警報系統...');
        
        // 測試警告等級
        this.triggerAlert({
            isAbnormal: true,
            level: 'warning',
            message: '測試警告警報',
            sensorType: 'temperature',
            value: 45
        });

        // 測試危險等級
        setTimeout(() => {
            this.triggerAlert({
                isAbnormal: true,
                level: 'danger',
                message: '測試危險警報',
                sensorType: 'humidity',
                value: 95
            });
        }, 2000);

        // 測試臨界等級
        setTimeout(() => {
            this.triggerAlert({
                isAbnormal: true,
                level: 'critical',
                message: '測試臨界警報',
                sensorType: 'co2',
                value: 2500
            });
        }, 4000);
    }

    /**
     * 啟動離線監控系統
     */
    startOfflineMonitoring() {
        setInterval(() => {
            this.checkAllSensorsOffline();
        }, 5000); // 每5秒檢查一次
    }

    /**
     * 更新感測器最後上線時間
     * @param {string} sensorId - 感測器ID
     */
    updateSensorLastSeen(sensorId) {
        this.sensorLastUpdate.set(sensorId, Date.now());
        
        // 清除該感測器的離線狀態
        this.clearOfflineAlert(sensorId);
    }

    /**
     * 檢查所有感測器是否離線
     */
    checkAllSensorsOffline() {
        const now = Date.now();
        
        for (const [sensorId, lastUpdate] of this.sensorLastUpdate.entries()) {
            const timeSinceUpdate = now - lastUpdate;
            
            if (timeSinceUpdate > this.offlineThreshold) {
                this.triggerOfflineAlert(sensorId, timeSinceUpdate);
            }
        }
    }

    /**
     * 觸發離線警報
     * @param {string} sensorId - 感測器ID
     * @param {number} offlineTime - 離線時間（毫秒）
     */
    triggerOfflineAlert(sensorId, offlineTime) {
        const offlineMinutes = Math.floor(offlineTime / 60000);
        const offlineSeconds = Math.floor((offlineTime % 60000) / 1000);
        
        const alertData = {
            sensorId: sensorId,
            isAbnormal: true,
            level: 'critical',
            type: 'offline',
            message: `感測器 ${sensorId} 已離線 ${offlineMinutes}分${offlineSeconds}秒`,
            offlineTime: offlineTime
        };

        // 應用離線樣式
        this.applyOfflineStyle(sensorId);
        
        // 觸發警報（但不重複播放相同感測器的離線警報）
        if (!this.isOfflineAlertActive(sensorId)) {
            this.triggerAlert(alertData);
            this.markOfflineAlertActive(sensorId);
        }
    }

    /**
     * 清除感測器的離線警報
     * @param {string} sensorId - 感測器ID
     */
    clearOfflineAlert(sensorId) {
        // 清除離線樣式
        this.clearOfflineStyle(sensorId);
        
        // 標記離線警報為非活躍
        this.markOfflineAlertInactive(sensorId);
    }

    /**
     * 應用離線樣式
     * @param {string} sensorId - 感測器ID
     */
    applyOfflineStyle(sensorId) {
        // 找到所有相關的感測器元素
        const sensorElements = document.querySelectorAll(`[data-sensor-id="${sensorId}"], [data-id="${sensorId}"]`);
        
        sensorElements.forEach(element => {
            element.classList.add('sensor-offline');
            
            // 添加離線圖示
            this.addOfflineIcon(element);
        });

        // 更新感測器列表項目（如果存在）
        const listItem = document.querySelector(`[data-sensor-id="${sensorId}"].sensor-list-item`);
        if (listItem) {
            listItem.classList.add('sensor-offline');
            
            // 更新狀態指示器
            const statusIndicator = listItem.querySelector('.alert-status-indicator');
            if (statusIndicator) {
                statusIndicator.innerHTML = '<span class="badge bg-secondary">離線</span>';
            }
        }
        
        // 安全地調用 updateSensorListItem（如果存在）
        if (typeof updateSensorListItem === 'function') {
            try {
                const sensorData = { id: sensorId, status: 'offline' };
                updateSensorListItem(sensorData);
            } catch (error) {
                console.warn('調用 updateSensorListItem 失敗:', error);
            }
        }
    }

    /**
     * 清除離線樣式
     * @param {string} sensorId - 感測器ID
     */
    clearOfflineStyle(sensorId) {
        // 找到所有相關的感測器元素
        const sensorElements = document.querySelectorAll(`[data-sensor-id="${sensorId}"], [data-id="${sensorId}"]`);
        
        sensorElements.forEach(element => {
            element.classList.remove('sensor-offline');
            
            // 移除離線圖示
            this.removeOfflineIcon(element);
        });

        // 更新感測器列表項目（如果存在）
        const listItem = document.querySelector(`[data-sensor-id="${sensorId}"].sensor-list-item`);
        if (listItem) {
            listItem.classList.remove('sensor-offline');
            
            // 清除狀態指示器
            const statusIndicator = listItem.querySelector('.alert-status-indicator');
            if (statusIndicator) {
                statusIndicator.innerHTML = '';
            }
        }
        
        // 安全地調用 updateSensorListItem（如果存在）
        if (typeof updateSensorListItem === 'function') {
            try {
                const sensorData = { id: sensorId, status: 'online' };
                updateSensorListItem(sensorData);
            } catch (error) {
                console.warn('調用 updateSensorListItem 失敗:', error);
            }
        }
    }

    /**
     * 添加離線圖示
     * @param {Element} element - 目標元素
     */
    addOfflineIcon(element) {
        if (element.querySelector('.offline-icon')) return; // 避免重複添加
        
        const offlineIcon = document.createElement('div');
        offlineIcon.className = 'offline-icon';
        offlineIcon.innerHTML = '<i class="fas fa-wifi-slash text-secondary"></i>';
        offlineIcon.title = '設備離線';
        
        element.appendChild(offlineIcon);
    }

    /**
     * 移除離線圖示
     * @param {Element} element - 目標元素
     */
    removeOfflineIcon(element) {
        const offlineIcon = element.querySelector('.offline-icon');
        if (offlineIcon) {
            offlineIcon.remove();
        }
    }

    /**
     * 檢查離線警報是否活躍
     * @param {string} sensorId - 感測器ID
     * @returns {boolean}
     */
    isOfflineAlertActive(sensorId) {
        return this.offlineTimers.has(sensorId);
    }

    /**
     * 標記離線警報為活躍
     * @param {string} sensorId - 感測器ID
     */
    markOfflineAlertActive(sensorId) {
        this.offlineTimers.set(sensorId, true);
    }

    /**
     * 標記離線警報為非活躍
     * @param {string} sensorId - 感測器ID
     */
    markOfflineAlertInactive(sensorId) {
        this.offlineTimers.delete(sensorId);
    }
}

// 創建全域警報系統實例
window.sensorAlertSystem = new SensorAlertSystem();

// 導出供其他模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SensorAlertSystem;
}
