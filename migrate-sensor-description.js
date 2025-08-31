#!/usr/bin/env node
// 感測器 description 欄位遷移腳本

const mongoose = require('mongoose');
const Farm = require('./models/Farm');

// 資料庫連接設定
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloud_dashboard';

async function migrateSensorDescription() {
    try {
        console.log('🔌 正在連接到資料庫...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 資料庫連接成功');
        
        // 取得所有場域資料
        const farms = await Farm.find({});
        console.log(`📊 找到 ${farms.length} 個場域`);
        
        let totalSensors = 0;
        let updatedSensors = 0;
        
        for (const farm of farms) {
            console.log(`\n🏭 處理場域: ${farm.name} (${farm._id})`);
            
            if (farm.sensors && farm.sensors.length > 0) {
                console.log(`   📡 場域包含 ${farm.sensors.length} 個感測器`);
                
                for (let i = 0; i < farm.sensors.length; i++) {
                    const sensor = farm.sensors[i];
                    totalSensors++;
                    
                    // 檢查感測器是否已有 description 欄位
                    if (!sensor.description || sensor.description === '') {
                        // 為沒有 description 的感測器生成預設描述
                        let defaultDescription = '';
                        
                        if (sensor.name) {
                            // 根據感測器名稱和類型生成描述
                            if (sensor.type === 'temperature') {
                                defaultDescription = `${sensor.name} - 溫度監測`;
                            } else if (sensor.type === 'humidity') {
                                defaultDescription = `${sensor.name} - 濕度監測`;
                            } else if (sensor.type === 'co2') {
                                defaultDescription = `${sensor.name} - 二氧化碳監測`;
                            } else if (sensor.type === 'pressure') {
                                defaultDescription = `${sensor.name} - 壓力監測`;
                            } else if (sensor.type === 'wind') {
                                defaultDescription = `${sensor.name} - 風速監測`;
                            } else if (sensor.type === 'water') {
                                defaultDescription = `${sensor.name} - 水量監測`;
                            } else {
                                defaultDescription = `${sensor.name} - 感測器`;
                            }
                        } else {
                            // 如果沒有名稱，使用 ID 和類型
                            defaultDescription = `感測器 ${sensor.id} (${sensor.type})`;
                        }
                        
                        // 更新感測器的 description 欄位
                        farm.sensors[i].description = defaultDescription;
                        updatedSensors++;
                        
                        console.log(`      ✅ 感測器 ${sensor.id}: "${defaultDescription}"`);
                    } else {
                        console.log(`      ℹ️  感測器 ${sensor.id}: 已有描述 "${sensor.description}"`);
                    }
                }
                
                // 儲存更新後的場域資料
                try {
                    await farm.save();
                    console.log(`   💾 場域 ${farm.name} 更新成功`);
                } catch (saveError) {
                    console.error(`   ❌ 場域 ${farm.name} 儲存失敗:`, saveError.message);
                }
            } else {
                console.log(`   ℹ️  場域沒有感測器資料`);
            }
        }
        
        console.log('\n📊 遷移完成統計:');
        console.log(`   📡 總感測器數量: ${totalSensors}`);
        console.log(`   🔄 更新感測器數量: ${updatedSensors}`);
        console.log(`   ✅ 成功處理場域數量: ${farms.length}`);
        
        // 驗證遷移結果
        console.log('\n🔍 驗證遷移結果...');
        const verificationFarms = await Farm.find({});
        let verifiedSensors = 0;
        let missingDescription = 0;
        
        for (const farm of verificationFarms) {
            if (farm.sensors) {
                for (const sensor of farm.sensors) {
                    verifiedSensors++;
                    if (!sensor.description || sensor.description === '') {
                        missingDescription++;
                        console.log(`   ⚠️  感測器 ${sensor.id} 仍然缺少 description 欄位`);
                    }
                }
            }
        }
        
        console.log(`\n📋 驗證結果:`);
        console.log(`   📡 驗證感測器數量: ${verifiedSensors}`);
        console.log(`   ✅ 有 description 的感測器: ${verifiedSensors - missingDescription}`);
        console.log(`   ⚠️  缺少 description 的感測器: ${missingDescription}`);
        
        if (missingDescription === 0) {
            console.log('\n🎉 遷移成功！所有感測器都已包含 description 欄位');
        } else {
            console.log('\n⚠️  遷移部分成功，仍有感測器缺少 description 欄位');
        }
        
    } catch (error) {
        console.error('❌ 遷移過程中發生錯誤:', error);
    } finally {
        // 關閉資料庫連接
        await mongoose.disconnect();
        console.log('\n🔌 資料庫連接已關閉');
        process.exit(0);
    }
}

// 執行遷移
console.log('🚀 開始執行感測器 description 欄位遷移...');
console.log('📝 此腳本將為所有現有感測器添加 description 欄位');
console.log('⚠️  請確保在執行前已備份資料庫');
console.log('');

// 檢查是否為手動執行
if (require.main === module) {
    migrateSensorDescription();
} else {
    module.exports = migrateSensorDescription;
}
