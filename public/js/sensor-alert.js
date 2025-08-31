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
        this.alertConfig = this.loadAlertConfig();
        this.individualSensorConfigs = this.loadIndividualSensorConfigs();
        this.initAudio();
        this.createAlertOverlay();
    }

    /**
     * 獲取預設的警報配置
     */
    getDefaultAlertConfig() {
        return {
            temperature: {
                min: 15,
                max: 35,
                warning: { min: 10, max: 40 },
                danger: { min: 5, max: 45 },
                critical: { min: 0, max: 50 }
            },
            humidity: {
                min: 40,
                max: 80,
                warning: { min: 30, max: 90 },
                danger: { min: 20, max: 95 },
                critical: { min: 10, max: 100 }
            },
            co2: {
                min: 300,
                max: 1000,
                warning: { min: 200, max: 1500 },
                danger: { min: 100, max: 2000 },
                critical: { min: 50, max: 3000 }
            },
            water: {
                min: 0,
                max: 100,
                warning: { min: 0, max: 100 },
                danger: { min: 0, max: 100 },
                critical: { min: 0, max: 100 }
            },
            pressure: {
                min: 900,
                max: 1100,
                warning: { min: 850, max: 1150 },
                danger: { min: 800, max: 1200 },
                critical: { min: 750, max: 1250 }
            },
            wind: {
                min: 0,
                max: 20,
                warning: { min: 0, max: 30 },
                danger: { min: 0, max: 40 },
                critical: { min: 0, max: 50 }
            }
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
     * 創建警報覆蓋層
     */
    createAlertOverlay() {
        if (document.getElementById('alert-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'alert-overlay';
        overlay.className = 'alert-overlay';
        overlay.innerHTML = `
            <div class="alert-overlay-content">
                <div>🚨 感測器異常警報 🚨</div>
                <div style="font-size: 24px; margin-top: 20px;" id="alert-message"></div>
            </div>
        `;
        document.body.appendChild(overlay);
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

        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            return { isAbnormal: false, level: 'normal', message: '' };
        }

        let level = 'normal';
        let message = '';

        // 檢查是否為臨界值
        if (numValue <= config.critical.min || numValue >= config.critical.max) {
            level = 'critical';
            message = `感測器 ${sensorId} ${valueType}數值 ${numValue}${unit} 超出臨界範圍！`;
        }
        // 檢查是否為危險值
        else if (numValue <= config.danger.min || numValue >= config.danger.max) {
            level = 'danger';
            message = `感測器 ${sensorId} ${valueType}數值 ${numValue}${unit} 超出危險範圍！`;
        }
        // 檢查是否為警告值
        else if (numValue <= config.warning.min || numValue >= config.warning.max) {
            level = 'warning';
            message = `感測器 ${sensorId} ${valueType}數值 ${numValue}${unit} 超出警告範圍！`;
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

        // 顯示全螢幕警報（僅限臨界等級）
        if (alertInfo.level === 'critical') {
            this.showFullScreenAlert(alertInfo);
        }

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
     * 顯示全螢幕警報
     * @param {object} alertInfo - 警報資訊
     */
    showFullScreenAlert(alertInfo) {
        const overlay = document.getElementById('alert-overlay');
        const messageElement = document.getElementById('alert-message');
        
        if (overlay && messageElement) {
            messageElement.textContent = alertInfo.message;
            overlay.classList.add('show');

            // 3秒後自動隱藏
            setTimeout(() => {
                overlay.classList.remove('show');
            }, 3000);
        }
    }

    /**
     * 記錄警報
     * @param {object} alertInfo - 警報資訊
     */
    logAlert(alertInfo) {
        const timestamp = new Date().toLocaleString('zh-TW');
        console.log(`🚨 [${timestamp}] ${alertInfo.level.toUpperCase()} 警報: ${alertInfo.message}`);
        
        // 可以發送到伺服器記錄
        this.sendAlertToServer(alertInfo);
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
     * 載入警報配置
     * @returns {object} 警報配置
     */
    loadAlertConfig() {
        try {
            const savedConfig = localStorage.getItem('sensorAlertConfig');
            if (savedConfig) {
                console.log('📥 從本地儲存載入警報配置');
                return { ...this.getDefaultAlertConfig(), ...JSON.parse(savedConfig) };
            }
        } catch (error) {
            console.warn('⚠️ 載入警報配置失敗，使用預設配置:', error);
        }
        return this.getDefaultAlertConfig();
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
     * 更新警報配置
     * @param {object} newConfig - 新的警報配置
     */
    updateAlertConfig(newConfig) {
        this.alertConfig = { ...this.alertConfig, ...newConfig };
        // 儲存到本地儲存
        try {
            localStorage.setItem('sensorAlertConfig', JSON.stringify(this.alertConfig));
            console.log('🔧 警報配置已更新並儲存:', this.alertConfig);
        } catch (error) {
            console.error('❌ 儲存警報配置失敗:', error);
        }
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
}

// 創建全域警報系統實例
window.sensorAlertSystem = new SensorAlertSystem();

// 導出供其他模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SensorAlertSystem;
}
