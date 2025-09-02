const aedes = require('aedes')();
const { createServer } = require('aedes-server-factory');
const config = require('../config');

class MQTTBroker {
    constructor() {
        this.broker = aedes;
        this.server = null;
        this.port = config.mqtt.brokerPort || 1883;
        this.isRunning = false;
    }

    // 啟動 MQTT Broker
    async start() {
        try {
            console.log('🚀 啟動 MQTT Broker...');
            
            // 創建 TCP 伺服器
            this.server = createServer(this.broker);
            
            // 設定事件監聽器
            this.setupEventHandlers();
            
            // 啟動伺服器
            return new Promise((resolve, reject) => {
                this.server.listen(this.port, (err) => {
                    if (err) {
                        console.error('❌ MQTT Broker 啟動失敗:', err);
                        reject(err);
                    } else {
                        this.isRunning = true;
                        console.log(`✅ MQTT Broker 已啟動在連接埠 ${this.port}`);
                        resolve(this);
                    }
                });
            });
        } catch (error) {
            console.error('MQTT Broker 初始化失敗:', error);
            throw error;
        }
    }

    // 設定事件處理器
    setupEventHandlers() {
        // 客戶端連接事件
        this.broker.on('client', (client) => {
            console.log(`📱 MQTT 客戶端已連接: ${client.id}`);
        });

        // 客戶端斷線事件
        this.broker.on('clientDisconnect', (client) => {
            console.log(`📱 MQTT 客戶端已斷線: ${client.id}`);
        });

        // 訂閱事件
        this.broker.on('subscribe', (subscriptions, client) => {
            console.log(`📡 客戶端 ${client.id} 訂閱主題:`, 
                subscriptions.map(sub => sub.topic).join(', '));
        });

        // 取消訂閱事件
        this.broker.on('unsubscribe', (unsubscriptions, client) => {
            console.log(`📡 客戶端 ${client.id} 取消訂閱主題:`, 
                unsubscriptions.join(', '));
        });

        // 發布事件
        this.broker.on('publish', async (packet, client) => {
            // 只記錄非系統主題的訊息
            if (packet.topic.startsWith('$SYS/')) {
                return;
            }
            
            if (client) {
                
            }
        });

        // 客戶端錯誤事件
        this.broker.on('clientError', (client, err) => {
            console.error(`❌ 客戶端 ${client.id} 錯誤:`, err);
        });

        // Broker 錯誤事件
        this.broker.on('connectionError', (client, err) => {
            console.error(`❌ 連接錯誤:`, err);
        });
    }

    // 發布訊息
    publish(topic, message, options = {}) {
        const packet = {
            cmd: 'publish',
            topic: topic,
            payload: typeof message === 'string' ? message : JSON.stringify(message),
            qos: options.qos || 0,
            retain: options.retain || false,
            dup: false
        };

        this.broker.publish(packet, (err) => {
            if (err) {
                console.error(`❌ 發布訊息到 ${topic} 失敗:`, err);
            } else {
                console.log(`✅ 已發布訊息到 ${topic}:`, packet.payload);
            }
        });
    }

    // 取得連接的客戶端
    getClients() {
        const clients = [];
        for (const [clientId, client] of this.broker.clients) {
            clients.push({
                id: clientId,
                connected: client.connected,
                subscriptions: Object.keys(client.subscriptions || {})
            });
        }
        return clients;
    }

    // 取得狀態資訊
    getStatus() {
        return {
            running: this.isRunning,
            port: this.port,
            clientsCount: this.broker.clients?.size || 0,
            clients: this.getClients()
        };
    }

    // 關閉 Broker
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    this.isRunning = false;
                    console.log('🛑 MQTT Broker 已停止');
                    resolve();
                });
            });
        }
    }

    // 設定認證（可選）
    setAuthentication(authenticateFn) {
        this.broker.authenticate = authenticateFn;
    }

    // 設定授權（可選）
    setAuthorization(authorizeFn) {
        this.broker.authorizePublish = authorizeFn;
        this.broker.authorizeSubscribe = authorizeFn;
    }
}

module.exports = new MQTTBroker();
