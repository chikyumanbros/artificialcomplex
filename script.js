document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    // 幅と高さの比率を1:1に近づける（正方形のグリッドになるように）
    const width = 180;
    const height = 100;
    
    // ASCII文字のセット - 単純に密度を表現
    const asciiChars = '☻▓▒░+*·';
    
    // 最小限のシミュレーションパラメータ
    const initialEntityCount = 3;  // 1から3に増加
    const maxEntities = 4000;
    const baseEnergyDecay = 0.0001;  // エネルギー消費率を調整
    const DIVISION_ENERGY_THRESHOLD = 0.7;  // 分裂閾値を上げる
    const DIVISION_PROBABILITY = 0.15;      // 分裂確率を調整
    const DIVISION_COOLDOWN = 30;          // 50から30に減少
    
    // 時間変数
    let time = 0;
    
    // UI関連の変数
    let frameCount = 0;
    let paused = false;
    let showStats = false;
    let selectedEntity = null;
    let simulationSpeed = 1.0;
    
    // グローバル変数としてシステム全体のエネルギー総量を定義
    const TOTAL_SYSTEM_ENERGY = 100;  // 100から1000に増加
    
    // エネルギー描画の安定化のための変数
    const MAX_ENERGY_HISTORY_LENGTH = 10;
    let maxEnergyHistory = [];
    
    // エネルギー描画のための固定基準値
    const ENERGY_DISPLAY_SCALE = 5.0; // 表示スケール係数
    const REFERENCE_MAX_ENERGY = TOTAL_SYSTEM_ENERGY / (180 * 100) * ENERGY_DISPLAY_SCALE; // セルあたりの理論的最大値の倍率
    const REFERENCE_MIN_ENERGY = REFERENCE_MAX_ENERGY * 0.01; // 基準値の1%を最小値として使用
    
    // Entityクラス - 抽象的な「実体」として再定義
    class Entity {
        // 静的IDカウンタ
        static nextId = 0;
        
        constructor(x, y) {
            // 一意のID
            this.id = Entity.nextId++;
            
            // 位置
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : Math.random() * height
            };
            
            // 速度
            this.velocity = {
                x: (Math.random() - 0.5) * 0.5,
                y: (Math.random() - 0.5) * 0.5
            };
            
            // エネルギーと状態（初期値を調整）
            this.energy = 0.7;  // 固定値に変更
            this.age = 0;
            this.isActive = true;
            
            // 組織劣化に関する属性を追加
            this.tissueIntegrity = 1.0;  // 組織の完全性（1.0が最大、0に近づくほど劣化）
            this.vibrationHistory = [];  // 振動履歴の詳細記録
            this.cumulativeVibrationStress = 0;  // 累積振動ストレス
            this.repairCapacity = 1.2;  // 修復能力（1.0から1.2に増加）
            
            // 内部状態の保存（記憶）
            this.memory = {
                lastPosition: {...this.position},
                recentCollisions: 0,  // 最近の衝突回数
                recentEnergyGains: [], // 最近のエネルギー獲得履歴
                adaptivePatterns: [],  // 適応的な行動パターンの記憶
                sharedMemories: []     // 他のエンティティから共有された記憶
            };

            // 内部状態に揺らぎを追加（初期安定性をさらに下げる）
            this.internalState = {
                stability: 0.7,  // 0.8から0.7に下げる
                oscillation: 0.3 // 0.2から0.3に上げる
            };

            // 振動パターンの記録と最適化
            this.vibrationMemory = {
                patterns: [],           // 過去の振動パターン
                resonanceFrequency: 0.3, // 現在の共鳴周波数
                optimalOscillation: 0.3, // 最適な振動レベル
                lastEnergyLevel: this.energy // 前回のエネルギーレベル
            };

            // 膜の物理的特性を追加
            this.membraneProperties = {
                elasticity: 0.5 + Math.random() * 0.3,  // 弾性（衝突時の反発力に影響）
                permeability: 0.3 + Math.random() * 0.4, // 透過性（エネルギー吸収率に影響）
                thickness: 0.4 + Math.random() * 0.3     // 厚さ（耐久性と移動速度に影響）
            };

            // 適応履歴を追加
            this.adaptationHistory = [];

            // 衝突回数を追加
            this.collisionCount = 0;

            // エネルギー吸収率
            this.energyAbsorptionRate = 0.1 + Math.random() * 0.1;

            // 移動特性
            this.movementProperties = {
                sensitivity: 0.3 + Math.random() * 0.4  // エネルギー勾配への感度
            };

            // エネルギー還元キューを追加
            this.energyReturnQueue = [];

            // 結合に関する属性を追加
            this.mergeState = {
                isMerged: false,           // 結合状態かどうか
                mergedWith: [],            // 結合しているエンティティのID配列
                mergeStrength: 0,          // 結合の強さ（0〜1）
                energyTransferRate: 0.05,  // エネルギー移動率
                mergeTimer: 0              // 結合してからの時間
            };
        }
        
        // 基本的な更新処理
        update(entities, environment, subjectiveTimeScale = 1.0) {
            if (!this.isActive) return;
            
            // 年齢を更新
            this.age++;
            
            // 振動ストレスに基づく組織劣化を処理
            this.processTissueDegeneration();
            
            // 結合状態の更新
            if (this.mergeState.isMerged) {
                this.updateMergedState(entities);
            }
            
            // 振動パターンを運動方向に適用（新機能）
            this.applyVibrationToMovement();
            
            // 移動処理
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
            
            // 境界処理
            this.enforceBoundaries();
            
            // ブラウン運動の追加
            this.addBrownianMotion();
            
            // エネルギー処理
            this.processEnergy(environment, subjectiveTimeScale);
            
            // 振動パターンの記録
            this.recordVibrationPattern();
            
            // 共鳴周波数に基づく振動の調整
            this.adjustVibrationToResonance();
            
            // 近接エンティティとの振動干渉を処理
            this.processProximityVibrationInterference(entities);
            
            // エネルギー勾配に応じた移動
            this.respondToEnergyGradient(environment);
            
            // 活性状態の更新（年齢制限を廃止し、組織完全性に基づく判定に変更）
            if (this.energy <= 0 || this.tissueIntegrity <= 0.05) {  // 0.1から0.05に下げる
                // 死亡時に残りのエネルギーを環境に徐々に還元
                if (this.isActive) {
                    // まず、キューに溜まっているエネルギーをすべて還元
                    while (this.energyReturnQueue.length > 0) {
                        const energyReturn = this.energyReturnQueue.shift();
                        environment.returnEnergyAt(energyReturn.position, energyReturn.amount);
                    }
                    
                    const remainingEnergy = Math.max(0, this.energy);
                    // エネルギーを複数のステップに分けて還元
                    const numSteps = 5; // 10から5に減らす
                    const energyPerStep = remainingEnergy / numSteps;
                    
                    // 周囲のセルにエネルギーを分散して還元
                    for (let i = 0; i < numSteps; i++) {
                        const angle = (Math.PI * 2 * i) / numSteps;
                        const radius = i * 0.5; // 徐々に広がる半径
                        const returnPos = {
                            x: this.position.x + Math.cos(angle) * radius,
                            y: this.position.y + Math.sin(angle) * radius
                        };
                        // エネルギー還元量を修正（全エネルギーを還元するように）
                        environment.returnEnergyAt(returnPos, energyPerStep);
                    }
                    
                    // 死亡時に記憶を環境に残す
                    this.preserveMemoryOnDeath(environment, entities);
                }
                this.isActive = false;
            }
            
            // 前回位置を記録
            this.memory.lastPosition = {...this.position};
            
            // 分裂処理を追加
            this.tryDivision(entities);
            
            // 記憶の統合と適用（一定間隔で実行）
            if (frameCount % 20 === 0) {
                this.integrateAndApplyMemories();
            }
            
            // 新しい適応パターンの生成（低確率で実行）
            if (Math.random() < 0.01) {
                this.generateAdaptivePattern();
            }
        }
        
        // 近接エンティティとの振動干渉を処理するメソッド（新規追加）
        processProximityVibrationInterference(entities) {
            // 近接範囲（膜の厚さに応じて変化）
            const proximityRange = 3 + this.membraneProperties.thickness * 2;
            
            // 近接エンティティを検出
            const nearbyEntities = entities.filter(entity => {
                if (entity === this || !entity.isActive) return false;
                
                // すでに結合しているエンティティはスキップ（別処理で対応済み）
                if (this.mergeState.isMerged && this.mergeState.mergedWith.includes(entity.id)) {
                    return false;
                }
                
                // 距離を計算
                const dx = entity.position.x - this.position.x;
                const dy = entity.position.y - this.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                return distance < proximityRange;
            });
            
            // 近接エンティティがない場合は終了
            if (nearbyEntities.length === 0) return;
            
            // 各近接エンティティとの振動干渉を処理
            for (const other of nearbyEntities) {
                // 距離に基づく干渉強度
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 距離が近いほど干渉が強い
                const distanceFactor = 1 - (distance / proximityRange);
                
                // 膜の透過性に基づく干渉強度
                const permeabilityFactor = (this.membraneProperties.permeability + other.membraneProperties.permeability) / 2;
                
                // 総合的な干渉強度
                const interferenceStrength = distanceFactor * permeabilityFactor * 0.03;
                
                // 振動レベルの弱い干渉（引き込み現象）
                if (Math.random() < interferenceStrength * 5) {
                    // 振動の共鳴度を計算
                    const resonanceLevel = 1 - Math.abs(
                        this.internalState.oscillation - other.internalState.oscillation
                    );
                    
                    // 共鳴している場合は振動が近づく、そうでない場合は離れる
                    if (resonanceLevel > 0.7) {
                        // 共鳴状態：振動が近づく
                        const oscillationDiff = other.internalState.oscillation - this.internalState.oscillation;
                        this.internalState.oscillation += oscillationDiff * interferenceStrength;
                        other.internalState.oscillation -= oscillationDiff * interferenceStrength;
                    } else {
                        // 非共鳴状態：振動が離れる
                        const oscillationDiff = other.internalState.oscillation - this.internalState.oscillation;
                        this.internalState.oscillation -= Math.sign(oscillationDiff) * interferenceStrength * 0.5;
                        other.internalState.oscillation += Math.sign(oscillationDiff) * interferenceStrength * 0.5;
                    }
                    
                    // 振動履歴に干渉イベントを記録
                    this.vibrationHistory.push({
                        level: this.internalState.oscillation,
                        source: 'proximityInterference',
                        timestamp: time,
                        distance: distance,
                        intensity: interferenceStrength
                    });
                }
                
                // 共鳴周波数の弱い干渉
                if (Math.random() < interferenceStrength * 3) {
                    const freqDiff = other.vibrationMemory.resonanceFrequency - this.vibrationMemory.resonanceFrequency;
                    this.vibrationMemory.resonanceFrequency += freqDiff * interferenceStrength * 0.5;
                    other.vibrationMemory.resonanceFrequency -= freqDiff * interferenceStrength * 0.5;
                }
            }
        }
        
        // エネルギー処理を膜の特性に基づいて更新
        processEnergy(environment, subjectiveTimeScale = 1.0) {
            // 膜の厚さに基づいてエネルギー消費を調整（厚い膜はより多くのエネルギーを消費）
            const thicknessConsumptionFactor = 0.8 + this.membraneProperties.thickness * 0.4;
            const consumedEnergy = baseEnergyDecay * subjectiveTimeScale * thicknessConsumptionFactor;
            this.energy -= consumedEnergy;
            
            // 消費エネルギーを還元キューに追加（全量を還元）
            this.queueEnergyReturn(this.position, consumedEnergy, 5);
            
            // 膜の透過性に基づいてエネルギー獲得率を調整
            const baseGainRate = 0.01 * (0.5 + this.membraneProperties.permeability);
            const gainedEnergy = environment.getEnergyAt(this.position, time, baseGainRate);
            
            // エネルギー上限を超える場合は、超過分を環境に還元
            const newEnergy = this.energy + gainedEnergy;
            if (newEnergy > 1.0) {
                const excessEnergy = newEnergy - 1.0;
                this.energy = 1.0;
                // 超過分を環境に還元
                environment.returnEnergyAt(this.position, excessEnergy);
            } else {
                this.energy = newEnergy;
            }
            
            // エネルギー獲得履歴を記録
            this.memory.recentEnergyGains.push(gainedEnergy);
            if (this.memory.recentEnergyGains.length > 10) {
                this.memory.recentEnergyGains.shift();
            }
            
            // キューに溜まったエネルギーの段階的還元
            this.processEnergyReturnQueue(environment);
        }
        
        // エネルギー還元をキューに追加
        queueEnergyReturn(position, amount, steps) {
            // ステップ数を減らす（元のステップ数の半分程度に）
            const reducedSteps = Math.max(1, Math.floor(steps / 2));
            const energyPerStep = amount / reducedSteps;
            
            for (let i = 0; i < reducedSteps; i++) {
                this.energyReturnQueue.push({
                    position: {...position},
                    amount: energyPerStep
                });
            }
        }

        // キューに溜まったエネルギーの処理（複数処理に変更）
        processEnergyReturnQueue(environment) {
            // 1フレームあたり最大5つのエネルギー還元を処理
            const maxProcessPerFrame = 5;
            let processCount = 0;
            
            while (this.energyReturnQueue.length > 0 && processCount < maxProcessPerFrame) {
                const energyReturn = this.energyReturnQueue.shift();
                environment.returnEnergyAt(energyReturn.position, energyReturn.amount);
                processCount++;
            }
        }

        // 衝突時のエネルギー還元を更新
        handleCollision(other, environment) {
            // エネルギー消費（衝突によるエネルギーロス）
            const energyLoss = 0.001 * Math.min(this.energy, other.energy);
            this.energy -= energyLoss;
            other.energy -= energyLoss;
            
            // 衝突による内部振動の増加（より強い影響）
            const collisionImpact = Math.sqrt(
                this.velocity.x * this.velocity.x + 
                this.velocity.y * this.velocity.y
            ) * 0.8; // 0.5から0.8に増加
            
            // 内部状態の更新
            this.internalState.oscillation += collisionImpact;
            other.internalState.oscillation += collisionImpact * 0.7; // 相手にも振動が伝播
            this.internalState.stability -= collisionImpact * 0.2;
            other.internalState.stability -= collisionImpact * 0.15; // 相手の安定性も低下
            
            // 振動の干渉効果を追加
            this.interferenceVibration(other, collisionImpact);
            
            // 衝突による組織ダメージ（ダメージ係数を0.05から0.025に、0.03から0.015に減少）
            const tissueImpact = collisionImpact * (1 - this.membraneProperties.elasticity);
            this.tissueIntegrity = Math.max(0, this.tissueIntegrity - tissueImpact * 0.025);
            other.tissueIntegrity = Math.max(0, other.tissueIntegrity - tissueImpact * 0.015);
            
            // 失われたエネルギーを段階的に還元（全量を還元）
            const totalLoss = energyLoss * 2;
            this.queueEnergyReturn(this.position, totalLoss, 4); // 8から4に減らす
            
            // 衝突回数を記録
            this.memory.recentCollisions++;
            this.collisionCount++;
            other.collisionCount++;
            
            // 記憶の共有（確率ではなく条件に基づいて発生）
            // 以下の条件で記憶共有が発生:
            // 1. 衝突の強度が一定以上
            // 2. 両方のエンティティが一定以上のエネルギーを持っている
            // 3. 振動パターンの共鳴が発生している
            const collisionStrength = collisionImpact;
            const energyThreshold = 0.4;
            const resonanceThreshold = 0.7;
            
            // 振動パターンの共鳴度を計算
            const resonanceLevel = 1 - Math.abs(
                this.internalState.oscillation - other.internalState.oscillation
            );
            
            // 共有条件の評価
            const sharingConditionsMet = 
                collisionStrength > 0.2 && // 衝突が十分に強い
                this.energy > energyThreshold && 
                other.energy > energyThreshold && // 両方が十分なエネルギーを持つ
                resonanceLevel > resonanceThreshold; // 振動パターンが共鳴している
                
            if (sharingConditionsMet) {
                this.shareMemories(other);
                
                // 共鳴が特に強い場合は双方向の記憶共有
                if (resonanceLevel > 0.85) {
                    other.shareMemories(this);
                }
                
                // 結合条件の評価（条件を緩和）
                // 1. 膜の透過性の条件を緩和
                // 2. 振動パターンの共鳴の条件を緩和
                // 3. エネルギー条件も緩和
                const mergeConditionsMet = 
                    this.membraneProperties.permeability > 0.4 && 
                    other.membraneProperties.permeability > 0.4 &&
                    resonanceLevel > 0.6 &&
                    this.energy > 0.3 && 
                    other.energy > 0.3;
                
                // すでに結合状態のエンティティとも結合可能に（最大5つまで）
                const canMergeThis = !this.mergeState.isMerged || this.mergeState.mergedWith.length < 5;
                const canMergeOther = !other.mergeState.isMerged || other.mergeState.mergedWith.length < 5;
                
                // 同じグループに属していない場合のみ結合を許可
                const notAlreadyMerged = !this.mergeState.mergedWith.includes(other.id) && 
                                        !other.mergeState.mergedWith.includes(this.id);
                
                // 結合確率を上げる（50%の確率で結合を試みる）
                if (mergeConditionsMet && canMergeThis && canMergeOther && notAlreadyMerged && Math.random() < 0.5) {
                    this.mergeWith(other);
                }
            }
            
            // 膜の特性を衝突に基づいて調整
            this.adjustMembraneProperties();
        }
        
        // 膜の特性を環境条件に応じて自己調整するメソッド
        adjustMembraneProperties() {
            let adaptationOccurred = false;
            let adaptationDescription = "";
            
            // 衝突頻度に基づいて弾性を調整
            if (this.memory.recentCollisions > 3) {
                // 衝突が多い場合は弾性を上げる（より反発しやすくする）
                const oldElasticity = this.membraneProperties.elasticity;
                this.membraneProperties.elasticity = Math.min(
                    0.9, 
                    this.membraneProperties.elasticity + 0.02
                );
                // 同時に厚さも増す（防御的反応）
                const oldThickness = this.membraneProperties.thickness;
                this.membraneProperties.thickness = Math.min(
                    0.8, 
                    this.membraneProperties.thickness + 0.01
                );
                
                if (Math.abs(this.membraneProperties.elasticity - oldElasticity) > 0.01 ||
                    Math.abs(this.membraneProperties.thickness - oldThickness) > 0.01) {
                    adaptationOccurred = true;
                    adaptationDescription = "Increased membrane elasticity and thickness due to frequent collisions";
                }
            } else {
                // 衝突が少ない場合は弾性を下げる（エネルギー効率のため）
                const oldElasticity = this.membraneProperties.elasticity;
                this.membraneProperties.elasticity = Math.max(
                    0.3, 
                    this.membraneProperties.elasticity - 0.01
                );
                
                if (Math.abs(this.membraneProperties.elasticity - oldElasticity) > 0.01) {
                    adaptationOccurred = true;
                    adaptationDescription = "Decreased membrane elasticity due to low collision frequency";
                }
            }
            
            // エネルギーレベルに基づいて透過性を調整
            if (this.energy < 0.3) {
                // エネルギーが低い場合は透過性を上げる（より多くのエネルギーを吸収）
                const oldPermeability = this.membraneProperties.permeability;
                this.membraneProperties.permeability = Math.min(
                    0.9, 
                    this.membraneProperties.permeability + 0.02
                );
                
                if (Math.abs(this.membraneProperties.permeability - oldPermeability) > 0.01) {
                    adaptationOccurred = true;
                    adaptationDescription = "Increased membrane permeability to absorb more energy";
                }
            } else if (this.energy > 0.8) {
                // エネルギーが高い場合は透過性を下げる（エネルギー保持のため）
                const oldPermeability = this.membraneProperties.permeability;
                this.membraneProperties.permeability = Math.max(
                    0.2, 
                    this.membraneProperties.permeability - 0.01
                );
                
                if (Math.abs(this.membraneProperties.permeability - oldPermeability) > 0.01) {
                    adaptationOccurred = true;
                    adaptationDescription = "Decreased membrane permeability to conserve energy";
                }
            }
            
            // 適応履歴を更新
            if (adaptationOccurred) {
                this.adaptationHistory.push({
                    age: this.age,
                    description: adaptationDescription
                });
                
                // 履歴サイズを制限
                if (this.adaptationHistory.length > 20) {
                    this.adaptationHistory.shift();
                }
                
                // 衝突回数を更新
                this.collisionCount += this.memory.recentCollisions;
            }
            
            // 定期的に衝突カウンターをリセット
            if (frameCount % 30 === 0) {
                this.memory.recentCollisions = 0;
            }
        }
        
        // ブラウン運動による揺らぎを更新
        addBrownianMotion() {
            // 内部振動が強いほどブラウン運動も強くなる
            const baseStrength = 0.01 * (1 - this.energy * 0.5);
            const oscillationFactor = 1.0 + this.internalState.oscillation;
            const brownianStrength = baseStrength * oscillationFactor;
            
            return {
                x: (Math.random() - 0.5) * brownianStrength,
                y: (Math.random() - 0.5) * brownianStrength
            };
        }
        
        // 境界処理
        enforceBoundaries() {
            const margin = 5;
            const boundaryForce = 0.05;
            
            // X軸の境界
            if (this.position.x < margin) {
                this.velocity.x += boundaryForce;
            } else if (this.position.x > width - margin) {
                this.velocity.x -= boundaryForce;
            }
            
            // Y軸の境界
            if (this.position.y < margin) {
                this.velocity.y += boundaryForce;
            } else if (this.position.y > height - margin) {
                this.velocity.y -= boundaryForce;
            }
        }
        
        // エンティティと結合するメソッド
        mergeWith(other) {
            // 両方のエンティティを結合状態にする
            this.mergeState.isMerged = true;
            other.mergeState.isMerged = true;
            
            // お互いのIDを記録
            this.mergeState.mergedWith.push(other.id);
            other.mergeState.mergedWith.push(this.id);
            
            // 結合の強さを設定（膜の透過性と弾性に基づく）
            const baseStrength = 0.3; // 基本的な結合強度を追加（0から0.3に）
            const permeabilityFactor = (this.membraneProperties.permeability + other.membraneProperties.permeability) / 2;
            const elasticityFactor = (this.membraneProperties.elasticity + other.membraneProperties.elasticity) / 4; // 弾性も考慮
            const mergeStrength = baseStrength + permeabilityFactor + elasticityFactor;
            
            this.mergeState.mergeStrength = Math.max(this.mergeState.mergeStrength, mergeStrength);
            other.mergeState.mergeStrength = Math.max(other.mergeState.mergeStrength, mergeStrength);
            
            // エネルギー移動率を設定（より高い値に）
            const transferRate = mergeStrength * 0.2; // 0.15から0.2に増加
            this.mergeState.energyTransferRate = Math.max(this.mergeState.energyTransferRate, transferRate);
            other.mergeState.energyTransferRate = Math.max(other.mergeState.energyTransferRate, transferRate);
            
            // 速度を平均化して同調させる（既存の結合グループがある場合は考慮）
            let thisGroupSize = this.mergeState.mergedWith.length;
            let otherGroupSize = other.mergeState.mergedWith.length;
            
            // 重み付き平均で新しい速度を計算
            const weightThis = thisGroupSize / (thisGroupSize + otherGroupSize);
            const weightOther = otherGroupSize / (thisGroupSize + otherGroupSize);
            
            const newVelocityX = this.velocity.x * weightThis + other.velocity.x * weightOther;
            const newVelocityY = this.velocity.y * weightThis + other.velocity.y * weightOther;
            
            // 新しい速度を適用
            this.velocity.x = newVelocityX;
            this.velocity.y = newVelocityY;
            other.velocity.x = newVelocityX;
            other.velocity.y = newVelocityY;
            
            // 結合タイマーをリセット
            this.mergeState.mergeTimer = 0;
            other.mergeState.mergeTimer = 0;
            
            // 結合時に少しエネルギーを共有（初期均衡を促進）
            const initialEnergyShare = Math.abs(this.energy - other.energy) * 0.3;
            if (this.energy > other.energy) {
                this.energy -= initialEnergyShare;
                other.energy += initialEnergyShare;
            } else {
                this.energy += initialEnergyShare;
                other.energy -= initialEnergyShare;
            }
            
            // 結合グループ内の他のエンティティとも間接的に結合
            // （これにより結合の伝播が起こり、より大きな集団が形成される）
            this.propagateMergeConnection(other);
        }
        
        // 結合を伝播させるメソッド（新規追加）
        propagateMergeConnection(other) {
            // このエンティティの結合グループ内の全エンティティを取得
            const thisGroup = entities.filter(entity => 
                entity !== this && 
                entity.isActive && 
                this.mergeState.mergedWith.includes(entity.id)
            );
            
            // 相手の結合グループ内の全エンティティを取得
            const otherGroup = entities.filter(entity => 
                entity !== other && 
                entity.isActive && 
                other.mergeState.mergedWith.includes(entity.id)
            );
            
            // このエンティティのグループと相手のグループを相互に結合
            for (const entityA of thisGroup) {
                for (const entityB of otherGroup) {
                    // すでに結合していない場合のみ
                    if (!entityA.mergeState.mergedWith.includes(entityB.id)) {
                        entityA.mergeState.mergedWith.push(entityB.id);
                        entityB.mergeState.mergedWith.push(entityA.id);
                    }
                }
            }
        }
        
        // 結合状態を更新するメソッド（拡張版）
        updateMergedState(entities) {
            // 結合タイマーを更新
            this.mergeState.mergeTimer++;
            
            // 結合しているエンティティを取得
            const mergedEntities = entities.filter(entity => 
                this.mergeState.mergedWith.includes(entity.id) && entity.isActive
            );
            
            // 結合しているエンティティがいなくなった場合、結合状態を解除
            if (mergedEntities.length === 0) {
                this.separateFromAll();
                return;
            }
            
            // 集団の中心点を計算
            let centerX = this.position.x;
            let centerY = this.position.y;
            
            for (const other of mergedEntities) {
                centerX += other.position.x;
                centerY += other.position.y;
            }
            
            centerX /= (mergedEntities.length + 1);
            centerY /= (mergedEntities.length + 1);
            
            // 集団の中心に向かう弱い力を追加（集団の凝集性を高める）
            const cohesionStrength = 0.001 * this.mergeState.mergeStrength;
            const dx = centerX - this.position.x;
            const dy = centerY - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                this.velocity.x += (dx / distance) * cohesionStrength;
                this.velocity.y += (dy / distance) * cohesionStrength;
            }
            
            // 各結合エンティティとのエネルギー共有
            for (const other of mergedEntities) {
                this.shareEnergyWith(other);
                
                // 結合エンティティとの距離を保つ
                this.maintainMergeDistance(other);
                
                // 一定時間経過または条件変化で結合解除の判定
                if (this.shouldSeparate(other)) {
                    this.separateFrom(other);
                }
                
                // 振動の同期（結合状態では振動が同期する傾向がある）
                this.synchronizeVibrations(other);
            }
            
            // 集団としての動きの同調性を高める（時間経過とともに増加）
            if (this.mergeState.mergeTimer % 10 === 0 && mergedEntities.length > 0) {
                this.synchronizeGroupMovement(mergedEntities);
            }
            
            // 集団全体の振動パターンの同期（定期的に実行）
            if (this.mergeState.mergeTimer % 15 === 0 && mergedEntities.length > 0) {
                this.synchronizeGroupVibrations(mergedEntities);
            }
        }
        
        // 振動を同期させるメソッド（新規追加）
        synchronizeVibrations(other) {
            // 結合の強さに基づく同期強度
            const syncStrength = this.mergeState.mergeStrength * 0.05;
            
            // 振動レベルの同期（引き込み現象）
            const oscillationDiff = other.internalState.oscillation - this.internalState.oscillation;
            this.internalState.oscillation += oscillationDiff * syncStrength;
            other.internalState.oscillation -= oscillationDiff * syncStrength;
            
            // 共鳴周波数の同期
            const freqDiff = other.vibrationMemory.resonanceFrequency - this.vibrationMemory.resonanceFrequency;
            this.vibrationMemory.resonanceFrequency += freqDiff * syncStrength;
            other.vibrationMemory.resonanceFrequency -= freqDiff * syncStrength;
            
            // 最適振動レベルの同期
            const optimalDiff = other.vibrationMemory.optimalOscillation - this.vibrationMemory.optimalOscillation;
            this.vibrationMemory.optimalOscillation += optimalDiff * syncStrength;
            other.vibrationMemory.optimalOscillation -= optimalDiff * syncStrength;
            
            // 結合時間が長いほど同期が強まる
            const timeBonus = Math.min(this.mergeState.mergeTimer / 500, 0.5);
            
            // 振動パターンの交換（時間経過とともに確率上昇）
            if (Math.random() < syncStrength + timeBonus) {
                // 互いのパターンを交換
                if (this.vibrationMemory.patterns.length > 0 && other.vibrationMemory.patterns.length > 0) {
                    const myIndex = Math.floor(Math.random() * this.vibrationMemory.patterns.length);
                    const otherIndex = Math.floor(Math.random() * other.vibrationMemory.patterns.length);
                    
                    const myPattern = this.vibrationMemory.patterns[myIndex];
                    const otherPattern = other.vibrationMemory.patterns[otherIndex];
                    
                    // パターンのコピーを交換
                    this.vibrationMemory.patterns.push({...otherPattern, timestamp: time});
                    other.vibrationMemory.patterns.push({...myPattern, timestamp: time});
                    
                    // パターン数の制限
                    if (this.vibrationMemory.patterns.length > 10) {
                        this.vibrationMemory.patterns.shift();
                    }
                    if (other.vibrationMemory.patterns.length > 10) {
                        other.vibrationMemory.patterns.shift();
                    }
                }
            }
        }
        
        // 集団全体の振動を同期させるメソッド（新規追加）
        synchronizeGroupVibrations(mergedEntities) {
            // 集団の平均振動レベルを計算
            let avgOscillation = this.internalState.oscillation;
            let avgFrequency = this.vibrationMemory.resonanceFrequency;
            let avgOptimal = this.vibrationMemory.optimalOscillation;
            
            for (const other of mergedEntities) {
                avgOscillation += other.internalState.oscillation;
                avgFrequency += other.vibrationMemory.resonanceFrequency;
                avgOptimal += other.vibrationMemory.optimalOscillation;
            }
            
            avgOscillation /= (mergedEntities.length + 1);
            avgFrequency /= (mergedEntities.length + 1);
            avgOptimal /= (mergedEntities.length + 1);
            
            // 同期強度（結合時間が長いほど強くなる）
            const syncFactor = Math.min(this.mergeState.mergeTimer / 300, 0.7) * this.mergeState.mergeStrength;
            
            // 自分の振動を集団の平均に近づける
            this.internalState.oscillation = this.internalState.oscillation * (1 - syncFactor) + avgOscillation * syncFactor;
            this.vibrationMemory.resonanceFrequency = this.vibrationMemory.resonanceFrequency * (1 - syncFactor) + avgFrequency * syncFactor;
            this.vibrationMemory.optimalOscillation = this.vibrationMemory.optimalOscillation * (1 - syncFactor) + avgOptimal * syncFactor;
            
            // 集団全体の振動パターンを生成
            if (Math.random() < syncFactor * 0.3) {
                // 全パターンを収集
                let allPatterns = [...this.vibrationMemory.patterns];
                for (const other of mergedEntities) {
                    allPatterns = allPatterns.concat(other.vibrationMemory.patterns);
                }
                
                if (allPatterns.length > 0) {
                    // 最も成功したパターンを選択
                    allPatterns.sort((a, b) => (b.successRate || 0) - (a.successRate || 0));
                    const bestPattern = allPatterns[0];
                    
                    // 集団共有パターンを生成
                    const groupPattern = {
                        ...bestPattern,
                        source: 'group',
                        timestamp: time,
                        groupSize: mergedEntities.length + 1
                    };
                    
                    // 全メンバーに共有
                    this.vibrationMemory.patterns.push(groupPattern);
                    if (this.vibrationMemory.patterns.length > 10) {
                        this.vibrationMemory.patterns.shift();
                    }
                    
                    for (const other of mergedEntities) {
                        other.vibrationMemory.patterns.push({...groupPattern});
                        if (other.vibrationMemory.patterns.length > 10) {
                            other.vibrationMemory.patterns.shift();
                        }
                    }
                }
            }
            
            // 振動履歴に同期イベントを記録
            this.vibrationHistory.push({
                level: this.internalState.oscillation,
                source: 'groupSync',
                timestamp: time,
                groupSize: mergedEntities.length + 1
            });
        }
        
        // エネルギーを共有するメソッド
        shareEnergyWith(other) {
            // エネルギー差に基づいて移動量を計算
            const energyDiff = this.energy - other.energy;
            const transferAmount = energyDiff * this.mergeState.energyTransferRate;
            
            // エネルギーを移動（高いほうから低いほうへ）
            if (energyDiff > 0) {
                this.energy -= transferAmount;
                other.energy += transferAmount;
            } else if (energyDiff < 0) {
                this.energy -= transferAmount; // 負の値なので実際は加算
                other.energy += transferAmount; // 負の値なので実際は減算
            }
        }
        
        // 結合エンティティとの距離を保つメソッド
        maintainMergeDistance(other) {
            const dx = other.position.x - this.position.x;
            const dy = other.position.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 理想的な距離（膜の厚さに基づく）
            const idealDistance = (this.membraneProperties.thickness + other.membraneProperties.thickness) * 1.8; // 2.0から1.8に減少
            
            // 距離が理想より離れすぎている場合、近づける（許容範囲を狭く）
            if (distance > idealDistance * 1.3) { // 1.5から1.3に減少
                const force = 0.015 * this.mergeState.mergeStrength; // 0.01から0.015に増加
                this.velocity.x += (dx / distance) * force;
                this.velocity.y += (dy / distance) * force;
                other.velocity.x -= (dx / distance) * force;
                other.velocity.y -= (dy / distance) * force;
            } 
            // 距離が理想より近すぎる場合、離す（許容範囲を狭く）
            else if (distance < idealDistance * 0.7) { // 0.5から0.7に増加
                const force = 0.012 * this.mergeState.mergeStrength; // 0.01から0.012に増加
                this.velocity.x -= (dx / distance) * force;
                this.velocity.y -= (dy / distance) * force;
                other.velocity.x += (dx / distance) * force;
                other.velocity.y += (dy / distance) * force;
            }
            // 理想的な距離に近い場合、速度を少し減衰させて安定化（新機能）
            else {
                const stabilizationFactor = 0.98;
                this.velocity.x *= stabilizationFactor;
                this.velocity.y *= stabilizationFactor;
                other.velocity.x *= stabilizationFactor;
                other.velocity.y *= stabilizationFactor;
            }
        }
        
        // 結合解除の条件を判定するメソッド（分離確率を下げる）
        shouldSeparate(other) {
            // 一定時間経過で解除確率が上昇（時間をさらに延長）
            const timeFactor = Math.min(this.mergeState.mergeTimer / 1200, 1); // 600から1200に増加
            
            // エネルギー差が小さくなると解除確率が上昇（条件をさらに厳しく）
            const energyDiff = Math.abs(this.energy - other.energy);
            const energyFactor = 1 - Math.min(energyDiff / 0.9, 1); // 0.7から0.9に増加
            
            // 振動パターンの共鳴度が低下すると解除確率が上昇（条件をさらに厳しく）
            const resonanceLevel = 1 - Math.abs(
                this.internalState.oscillation - other.internalState.oscillation
            );
            const resonanceFactor = 1 - resonanceLevel;
            
            // 総合的な解除確率（全体的に確率をさらに下げる）
            const separationProbability = 
                (timeFactor * 0.2) + // 0.3から0.2に減少
                (energyFactor * 0.15) + // 0.2から0.15に減少
                (resonanceFactor * 0.15); // 0.2から0.15に減少
            
            // ランダムに判定（確率をさらに大幅に下げる）
            return Math.random() < separationProbability * 0.005; // 最大でも0.5%の確率に減少（0.02から0.005に）
        }
        
        // 特定のエンティティとの結合を解除するメソッド
        separateFrom(other) {
            // 結合リストから削除
            this.mergeState.mergedWith = this.mergeState.mergedWith.filter(id => id !== other.id);
            other.mergeState.mergedWith = other.mergeState.mergedWith.filter(id => id !== this.id);
            
            // 結合しているエンティティがいなくなった場合、結合状態を完全に解除
            if (this.mergeState.mergedWith.length === 0) {
                this.mergeState.isMerged = false;
                this.mergeState.mergeStrength = 0;
                this.mergeState.energyTransferRate = 0.05;
                this.mergeState.mergeTimer = 0;
            }
            
            if (other.mergeState.mergedWith.length === 0) {
                other.mergeState.isMerged = false;
                other.mergeState.mergeStrength = 0;
                other.mergeState.energyTransferRate = 0.05;
                other.mergeState.mergeTimer = 0;
            }
            
            // 分離時に少し反発力を加える
            const dx = other.position.x - this.position.x;
            const dy = other.position.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                const repulsionForce = 0.05;
                this.velocity.x -= (dx / distance) * repulsionForce;
                this.velocity.y -= (dy / distance) * repulsionForce;
                other.velocity.x += (dx / distance) * repulsionForce;
                other.velocity.y += (dy / distance) * repulsionForce;
            }
        }
        
        // すべてのエンティティとの結合を解除するメソッド
        separateFromAll() {
            this.mergeState.isMerged = false;
            this.mergeState.mergedWith = [];
            this.mergeState.mergeStrength = 0;
            this.mergeState.energyTransferRate = 0.05;
            this.mergeState.mergeTimer = 0;
        }

        // 分裂を試みるメソッドを更新
        tryDivision(entities) {
            // エネルギーによる構造の不安定化
            const energyStress = this.energy / DIVISION_ENERGY_THRESHOLD;
            this.internalState.stability -= 0.015 * energyStress;

            // ブラウン運動による内部振動の蓄積を復活
            const brownianImpact = Math.sqrt(
                this.velocity.x * this.velocity.x + 
                this.velocity.y * this.velocity.y
            );
            this.internalState.oscillation += brownianImpact * 0.15;

            // 振動が臨界点を超えた場合、確率的に分裂
            const criticalOscillation = 0.5;
            if (this.internalState.oscillation > criticalOscillation && 
                this.energy >= DIVISION_ENERGY_THRESHOLD) {
                
                // 分裂の試行（不安定性と振動に比例した確率）
                const divisionChance = 
                    (1.0 - this.internalState.stability) * 0.4 + 
                    (this.internalState.oscillation - criticalOscillation) * 0.3;
                
                if (Math.random() < divisionChance && entities.length < maxEntities) {
                    // 分裂実行
                    this.divide(entities);
                    
                    // 分裂後の状態リセット（振動の一部は残す）
                    this.internalState.stability = 0.8;
                    this.internalState.oscillation *= 0.3; // 振動の30%を保持
                }
            }

            // 安定性の自然回復（振動が強いほど回復が遅い）
            const stabilityRecovery = 0.000005 / (1 + this.internalState.oscillation);
            this.internalState.stability = Math.min(1.0, 
                this.internalState.stability + stabilityRecovery);
            
            // 振動の自然減衰（エネルギーが高いほど減衰が遅い）
            const oscillationDecay = 0.999 - (this.energy * 0.001);
            this.internalState.oscillation *= oscillationDecay;
        }

        // 分裂処理を独立したメソッドとして実装
        divide(entities) {
            // エネルギー分配（より均等に）
            const splitRatio = 0.6;  // 固定の分割比率に変更
            const parentEnergy = this.energy * splitRatio;
            const childEnergy = this.energy * (1 - splitRatio);
            
            this.energy = parentEnergy;

            // 新しいエンティティの作成（より近い位置に）
            const offspring = new Entity(
                this.position.x + (Math.random() - 0.5) * 1,
                this.position.y + (Math.random() - 0.5) * 1
            );
            
            // 基本的な属性の初期化
            // エネルギー上限を超えた場合は環境に還元
            if (childEnergy > 1.0) {
                offspring.energy = 1.0;
                // 余剰エネルギーを環境に還元
                const excessEnergy = childEnergy - 1.0;
                environment.returnEnergyAt(offspring.position, excessEnergy);
            } else {
                offspring.energy = childEnergy;
            }
            offspring.age = 0;
            
            // 速度を新しく初期化（ランダムな方向）
            offspring.velocity = {
                x: (Math.random() - 0.5) * 0.5,
                y: (Math.random() - 0.5) * 0.5
            };
            
            // 内部状態を新しく初期化（親の振動特性を部分的に継承）
            offspring.internalState = {
                stability: 0.7,
                oscillation: this.internalState.oscillation * (0.9 + Math.random() * 0.2)
            };
            
            // 振動パターンの記憶を初期化（親の最適振動を部分的に継承）
            offspring.vibrationMemory = {
                patterns: [],
                resonanceFrequency: this.vibrationMemory.resonanceFrequency * (0.9 + Math.random() * 0.2),
                optimalOscillation: this.vibrationMemory.optimalOscillation * (0.9 + Math.random() * 0.2),
                lastEnergyLevel: offspring.energy
            };
            
            // メモリを新しく初期化（親の記憶を部分的に継承）
            offspring.memory = {
                lastPosition: {...offspring.position},
                recentCollisions: 0,
                recentEnergyGains: [],
                adaptivePatterns: this.memory.adaptivePatterns.length > 0 
                    ? this.memory.adaptivePatterns
                        .filter(pattern => pattern.successRate > 0.6) // 成功率の高いパターンのみ継承
                        .map(pattern => ({
                            ...pattern,
                            strength: pattern.strength * 0.8, // 継承時に強度を少し弱める
                            inherited: true
                        }))
                    : [],
                sharedMemories: []
            };
            
            // 膜の特性を親から継承（わずかな変異を加える）
            offspring.membraneProperties = {
                elasticity: this.membraneProperties.elasticity * (0.9 + Math.random() * 0.2),
                permeability: this.membraneProperties.permeability * (0.9 + Math.random() * 0.2),
                thickness: this.membraneProperties.thickness * (0.9 + Math.random() * 0.2)
            };
            
            // エネルギー還元キューを新しく初期化
            offspring.energyReturnQueue = [];
            
            // 組織完全性の継承（親の状態に応じて変化）
            const integrityInheritanceFactor = 0.8 + (this.tissueIntegrity * 0.2);
            offspring.tissueIntegrity = this.tissueIntegrity * integrityInheritanceFactor;
            
            // 修復能力の継承（わずかな変異を加える）
            offspring.repairCapacity = this.repairCapacity * (0.9 + Math.random() * 0.2);
            
            // 累積振動ストレスは新規エンティティなのでゼロから開始
            offspring.cumulativeVibrationStress = 0;
            offspring.vibrationHistory = [];
            
            entities.push(offspring);
        }

        // エネルギー勾配に対する応答（走化性）
        respondToEnergyGradient(environment) {
            // 周囲のエネルギーレベルをサンプリング
            const samples = [];
            const sampleRadius = 3;
            
            // 8方向のエネルギーをサンプリング
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                const sampleX = this.position.x + Math.cos(angle) * sampleRadius;
                const sampleY = this.position.y + Math.sin(angle) * sampleRadius;
                
                const x = Math.floor(sampleX);
                const y = Math.floor(sampleY);
                
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const idx = y * width + x;
                    samples.push({
                        angle: angle,
                        energy: environment.energyField[idx].energy,
                        x: sampleX,
                        y: sampleY
                    });
                }
            }
            
            // サンプルが十分にある場合
            if (samples.length > 3) {
                // エネルギーレベルでソート
                samples.sort((a, b) => b.energy - a.energy);
                
                // 最もエネルギーが高い方向と現在位置のエネルギー差を計算
                const currentX = Math.floor(this.position.x);
                const currentY = Math.floor(this.position.y);
                const currentIdx = currentY * width + currentX;
                const currentEnergy = environment.energyField[currentIdx].energy;
                
                const bestSample = samples[0];
                const energyDifference = bestSample.energy - currentEnergy;
                
                // エネルギー差が十分にある場合のみ方向を調整
                if (energyDifference > 0.05) {
                    // 膜の透過性に基づいて感度を調整（透過性が高いほど勾配に敏感）
                    const sensitivityFactor = 0.05 * (0.5 + this.membraneProperties.permeability);
                    
                    // エネルギーレベルに応じて応答強度を調整（エネルギーが低いほど強く反応）
                    const energyResponseFactor = 0.5 + (1.0 - Math.min(1.0, this.energy)) * 0.5;
                    
                    // 最終的な応答強度
                    const responseStrength = sensitivityFactor * energyResponseFactor;
                    
                    // 高エネルギー方向への移動ベクトルを計算
                    const moveX = bestSample.x - this.position.x;
                    const moveY = bestSample.y - this.position.y;
                    const moveDist = Math.sqrt(moveX * moveX + moveY * moveY) || 0.1;
                    
                    // 正規化して応答強度を掛ける
                    const normX = moveX / moveDist * responseStrength;
                    const normY = moveY / moveDist * responseStrength;
                    
                    // 速度に加える
                    this.velocity.x += normX;
                    this.velocity.y += normY;
                }
            }
        }

        // 振動パターンを記録
        recordVibrationPattern() {
            // 現在の振動状態を記録
            const currentPattern = {
                oscillation: this.internalState.oscillation,
                energy: this.energy,
                timestamp: time,
                energyDelta: this.energy - this.vibrationMemory.lastEnergyLevel,
                // 運動情報を追加
                velocity: {
                    x: this.velocity.x,
                    y: this.velocity.y
                },
                position: {
                    x: this.position.x,
                    y: this.position.y
                }
            };
            
            this.vibrationMemory.patterns.push(currentPattern);
            
            // 記録サイズを制限
            if (this.vibrationMemory.patterns.length > 20) {
                this.vibrationMemory.patterns.shift();
            }
            
            // 振動履歴を更新
            this.vibrationHistory.push(this.internalState.oscillation);
            if (this.vibrationHistory.length > 30) {
                this.vibrationHistory.shift();
            }
            
            // 現在のエネルギーレベルを記録
            this.vibrationMemory.lastEnergyLevel = this.energy;
            
            // 一定間隔で最適な振動周波数を見つける
            if (frameCount % 30 === 0) {
                this.findOptimalResonanceFrequency();
            }
            
            // 振動による組織ストレスを記録
            const vibrationStress = this.internalState.oscillation * 0.01;
            this.cumulativeVibrationStress += vibrationStress;
        }

        // 最適な共鳴周波数を見つける
        findOptimalResonanceFrequency() {
            if (this.vibrationMemory.patterns.length < 5) return;
            
            // エネルギー獲得が最も高かった振動状態を見つける
            let bestOscillation = this.internalState.oscillation;
            let maxEnergyGain = -Infinity;
            
            // 運動成功率の評価用変数
            let bestMovementScore = -Infinity;
            let bestMovementOscillation = this.internalState.oscillation;
            
            // 過去のパターンを分析
            for (let i = 1; i < this.vibrationMemory.patterns.length; i++) {
                const pattern = this.vibrationMemory.patterns[i];
                const prevPattern = this.vibrationMemory.patterns[i-1];
                
                // エネルギー増加量が正の場合のみ考慮
                if (pattern.energyDelta > 0) {
                    // 振動レベルとエネルギー獲得の関係を評価
                    const effectiveGain = pattern.energyDelta / 
                        (0.1 + Math.abs(pattern.oscillation - this.vibrationMemory.resonanceFrequency));
                    
                    if (effectiveGain > maxEnergyGain) {
                        maxEnergyGain = effectiveGain;
                        bestOscillation = pattern.oscillation;
                    }
                }
                
                // 運動の成功率を評価
                // 意図した方向への移動が実現できたかを評価
                if (prevPattern && pattern) {
                    // 前回の速度ベクトル
                    const prevVX = prevPattern.velocity.x;
                    const prevVY = prevPattern.velocity.y;
                    
                    // 実際の移動ベクトル
                    const actualMoveX = pattern.position.x - prevPattern.position.x;
                    const actualMoveY = pattern.position.y - prevPattern.position.y;
                    
                    // 意図した方向と実際の移動方向の一致度を計算
                    const dotProduct = prevVX * actualMoveX + prevVY * actualMoveY;
                    const prevMagnitude = Math.sqrt(prevVX * prevVX + prevVY * prevVY) || 0.001;
                    const actualMagnitude = Math.sqrt(actualMoveX * actualMoveX + actualMoveY * actualMoveY) || 0.001;
                    
                    // コサイン類似度（-1から1の範囲、1が完全一致）
                    const directionMatch = dotProduct / (prevMagnitude * actualMagnitude);
                    
                    // 移動距離も考慮したスコア
                    const movementScore = directionMatch * actualMagnitude;
                    
                    // エネルギー効率も考慮（少ないエネルギー消費で多く移動できた場合に高評価）
                    const energyEfficiency = actualMagnitude / (0.01 + Math.abs(pattern.energyDelta));
                    const combinedScore = movementScore * (1 + energyEfficiency);
                    
                    if (combinedScore > bestMovementScore) {
                        bestMovementScore = combinedScore;
                        bestMovementOscillation = pattern.oscillation;
                    }
                }
            }
            
            // 最適な振動状態に少しずつ近づける（急激な変化を避ける）
            if (maxEnergyGain > 0) {
                // エネルギー獲得と運動成功率の両方を考慮して最適振動を決定
                const energyWeight = 0.6;  // エネルギー獲得の重み
                const movementWeight = 0.4; // 運動成功率の重み
                
                // 両方のスコアが有効な場合は重み付け平均を使用
                if (bestMovementScore > 0) {
                    const weightedOscillation = 
                        bestOscillation * energyWeight + 
                        bestMovementOscillation * movementWeight;
                    
                    this.vibrationMemory.optimalOscillation = 
                        0.8 * this.vibrationMemory.optimalOscillation + 
                        0.2 * weightedOscillation;
                } else {
                    // 運動スコアが無効な場合はエネルギーのみで判断
                    this.vibrationMemory.optimalOscillation = 
                        0.8 * this.vibrationMemory.optimalOscillation + 
                        0.2 * bestOscillation;
                }
            }
        }

        // 共鳴周波数に基づいて振動を調整
        adjustVibrationToResonance() {
            // エネルギーレベルが低い場合は、より積極的に最適振動に近づける
            const adaptationRate = this.energy < 0.3 ? 0.03 : 0.01;
            
            // 現在の振動を最適な共鳴周波数に近づける
            if (this.internalState.oscillation < this.vibrationMemory.optimalOscillation) {
                this.internalState.oscillation += adaptationRate;
            } else if (this.internalState.oscillation > this.vibrationMemory.optimalOscillation) {
                this.internalState.oscillation -= adaptationRate;
            }
            
            // 振動の範囲を制限
            this.internalState.oscillation = Math.max(0.1, Math.min(0.9, this.internalState.oscillation));
        }
        
        // 記憶共有メソッド
        shareMemories(other) {
            // 自分の適応パターンから成功率の高いものを選択
            const successfulPatterns = this.memory.adaptivePatterns
                .filter(pattern => pattern.successRate > 0.7);
                
            if (successfulPatterns.length > 0) {
                // 相手の状態に最も関連性の高いパターンを選択
                const relevantPatterns = successfulPatterns
                    .map(pattern => {
                        // 相手の現在の状態との関連性を評価
                        const relevance = this.evaluatePatternRelevanceForOther(pattern, other);
                        return { pattern, relevance };
                    })
                    .filter(item => item.relevance > 0.6) // 関連性が高いもののみ
                    .sort((a, b) => b.relevance - a.relevance) // 関連性の高い順にソート
                    .slice(0, 2); // 最大2つまで共有
                
                // 関連性の高いパターンを共有
                relevantPatterns.forEach(({ pattern, relevance }) => {
                    // 共有時に変異を加える（関連性が高いほど変異が少ない）
                    const mutationFactor = 1 - relevance; // 関連性が高いほど変異が少ない
                    
                    const sharedPattern = {
                        ...pattern,
                        strength: pattern.strength * (1 - mutationFactor * 0.3), // 関連性が高いほど強度を保持
                        shared: true,
                        sourceId: this.id,
                        sharedAt: time,
                        relevanceScore: relevance
                    };
                    
                    // 既に同様のパターンを持っていないか確認
                    const existingPatternIndex = other.memory.sharedMemories
                        .findIndex(p => p.type === pattern.type);
                        
                    if (existingPatternIndex >= 0) {
                        // 既存のパターンと統合（より成功率の高い方を優先）
                        const existingPattern = other.memory.sharedMemories[existingPatternIndex];
                        if (sharedPattern.successRate > existingPattern.successRate) {
                            other.memory.sharedMemories[existingPatternIndex] = sharedPattern;
                        }
                    } else {
                        // 新しいパターンとして追加
                        other.memory.sharedMemories.push(sharedPattern);
                    }
                });
            }
        }
        
        // 他のエンティティに対するパターンの関連性評価
        evaluatePatternRelevanceForOther(pattern, other) {
            // 他のエンティティの現在の状況
            const otherConditions = {
                energy: other.energy,
                oscillation: other.internalState.oscillation,
                stability: other.internalState.stability,
                collisions: other.memory.recentCollisions
            };
            
            // 基本スコア
            let relevanceScore = 0.5;
            
            // 条件の類似性を評価
            const energySimilarity = 1 - Math.abs(
                otherConditions.energy - pattern.conditions.energy
            );
            relevanceScore += energySimilarity * 0.3;
            
            const oscillationSimilarity = 1 - Math.abs(
                otherConditions.oscillation - pattern.conditions.oscillation
            );
            relevanceScore += oscillationSimilarity * 0.2;
            
            // 膜特性の類似性（パターンタイプが膜関連の場合）
            if (pattern.type === 'membrane') {
                const membraneSimilarity = 1 - (
                    Math.abs(other.membraneProperties.permeability - this.membraneProperties.permeability) +
                    Math.abs(other.membraneProperties.elasticity - this.membraneProperties.elasticity)
                ) / 2;
                
                relevanceScore += membraneSimilarity * 0.2;
            }
            
            // 移動特性の類似性（パターンタイプが移動関連の場合）
            if (pattern.type === 'movement') {
                const velocitySimilarity = 1 - (
                    Math.abs(other.velocity.x - this.velocity.x) +
                    Math.abs(other.velocity.y - this.velocity.y)
                ) / 2;
                
                relevanceScore += velocitySimilarity * 0.2;
            }
            
            return Math.max(0, Math.min(1, relevanceScore));
        }
        
        // 記憶の統合と適用
        integrateAndApplyMemories() {
            // 共有された記憶を評価し、自分の適応パターンに統合
            if (this.memory.sharedMemories.length > 0) {
                // 古い共有記憶を削除（一定時間経過したもの）
                this.memory.sharedMemories = this.memory.sharedMemories
                    .filter(memory => time - memory.sharedAt < 500);
                
                // 現在の状態を取得
                const currentState = {
                    energy: this.energy,
                    oscillation: this.internalState.oscillation,
                    stability: this.internalState.stability,
                    membraneProperties: { ...this.membraneProperties },
                    recentCollisions: this.memory.recentCollisions,
                    recentEnergyGains: [...this.memory.recentEnergyGains]
                };
                
                // 共有記憶を評価して適応パターンに統合
                this.memory.sharedMemories.forEach(sharedMemory => {
                    // 自分の環境条件と照らし合わせて評価
                    const relevanceScore = this.evaluateMemoryRelevance(sharedMemory);
                    
                    // 統合の必要性を判断
                    const needsIntegration = this.determineIntegrationNeed(sharedMemory, currentState);
                    
                    if (relevanceScore > 0.6 && needsIntegration) { // 関連性が高く、統合が必要な場合のみ
                        // 既存のパターンと統合または新規追加
                        const existingPatternIndex = this.memory.adaptivePatterns
                            .findIndex(p => p.type === sharedMemory.type);
                            
                        if (existingPatternIndex >= 0) {
                            // 既存パターンと統合（加重平均）
                            const existingPattern = this.memory.adaptivePatterns[existingPatternIndex];
                            
                            // 統合の重みを決定（既存パターンの成功率と共有記憶の関連性に基づく）
                            const existingWeight = existingPattern.successRate * 0.7;
                            const sharedWeight = sharedMemory.relevanceScore * 0.3;
                            const totalWeight = existingWeight + sharedWeight;
                            
                            this.memory.adaptivePatterns[existingPatternIndex] = {
                                ...existingPattern,
                                parameters: this.blendParameters(
                                    existingPattern.parameters, 
                                    sharedMemory.parameters,
                                    existingWeight / totalWeight, 
                                    sharedWeight / totalWeight
                                ),
                                successRate: (existingPattern.successRate * existingWeight + 
                                             sharedMemory.successRate * sharedWeight) / totalWeight,
                                integrated: true,
                                integrationHistory: [
                                    ...(existingPattern.integrationHistory || []),
                                    {
                                        sourceId: sharedMemory.sourceId,
                                        time: time,
                                        relevance: sharedMemory.relevanceScore
                                    }
                                ]
                            };
                        } else {
                            // 新規パターンとして追加（関連性に応じた強度で）
                            this.memory.adaptivePatterns.push({
                                ...sharedMemory,
                                strength: sharedMemory.strength * sharedMemory.relevanceScore,
                                integrated: true,
                                lastUsed: time,
                                integrationHistory: [{
                                    sourceId: sharedMemory.sourceId,
                                    time: time,
                                    relevance: sharedMemory.relevanceScore
                                }]
                            });
                        }
                    }
                });
            }
            
            // 適応パターンの適用（現在の状況に応じて）
            this.applyAdaptivePatterns();
        }
        
        // 統合の必要性を判断
        determineIntegrationNeed(sharedMemory, currentState) {
            // 1. 現在のエネルギー状態が低下している場合は新しい戦略が必要
            const energyDeficit = currentState.energy < 0.4;
            
            // 2. 最近のエネルギー獲得が少ない場合
            const recentEnergyGainTotal = currentState.recentEnergyGains.reduce((sum, gain) => sum + gain, 0);
            const lowEnergyGain = recentEnergyGainTotal < 0.03;
            
            // 3. 共有されたパターンの成功率が自分の既存パターンより高い場合
            const hasHigherSuccessRate = this.memory.adaptivePatterns.every(pattern => 
                pattern.type !== sharedMemory.type || sharedMemory.successRate > pattern.successRate
            );
            
            // 4. 同じタイプのパターンを持っていない場合
            const isNewPatternType = !this.memory.adaptivePatterns.some(pattern => 
                pattern.type === sharedMemory.type
            );
            
            // 5. 環境条件が変化している場合（振動状態の変化）
            const environmentChanged = Math.abs(
                this.internalState.oscillation - this.vibrationMemory.optimalOscillation
            ) > 0.2;
            
            // 統合の必要性を総合的に判断
            return (energyDeficit && lowEnergyGain) || // エネルギー状態が悪い
                   hasHigherSuccessRate || // より成功率の高いパターン
                   isNewPatternType || // 新しいタイプのパターン
                   environmentChanged; // 環境変化への対応
        }
        
        // 記憶の関連性評価
        evaluateMemoryRelevance(memory) {
            // 環境条件との一致度を評価
            let relevanceScore = 0.5; // 基本スコア
            
            // エネルギー状態の類似性
            const energySimilarity = 1 - Math.abs(this.energy - memory.environmentConditions.energy);
            relevanceScore += energySimilarity * 0.2;
            
            // 振動状態の類似性
            const oscillationSimilarity = 1 - Math.abs(
                this.internalState.oscillation - memory.environmentConditions.oscillation
            );
            relevanceScore += oscillationSimilarity * 0.2;
            
            // 衝突頻度の類似性
            const collisionSimilarity = 1 - Math.abs(
                this.memory.recentCollisions - memory.environmentConditions.collisions
            ) / 5; // 最大5回の差で正規化
            relevanceScore += collisionSimilarity * 0.1;
            
            return Math.max(0, Math.min(1, relevanceScore));
        }
        
        // パラメータのブレンド
        blendParameters(params1, params2, weight1, weight2) {
            const result = {};
            
            // 両方のパラメータに存在するキーをブレンド
            Object.keys(params1).forEach(key => {
                if (typeof params1[key] === 'number' && typeof params2[key] === 'number') {
                    result[key] = params1[key] * weight1 + params2[key] * weight2;
                } else {
                    result[key] = params1[key]; // 数値でない場合は単純にコピー
                }
            });
            
            return result;
        }
        
        // 新しい適応パターンの生成
        generateAdaptivePattern() {
            // 適応パターンの生成
            // 現在の状態と過去の成功パターンに基づいて新しいパターンを生成
            
            // 1. 振動パターン
            if (Math.random() < 0.4) {
                const baseOscillation = this.vibrationMemory.optimalOscillation;
                // 少しランダム性を加えて探索を促進
                const targetOscillation = baseOscillation + (Math.random() - 0.5) * 0.1;
                
                return {
                    type: 'vibration',
                    parameters: {
                        targetOscillation: Math.max(0.1, Math.min(0.9, targetOscillation))
                    },
                    creationTime: time,
                    successRate: 0,
                    usageCount: 0
                };
            }
            
            // 2. 膜特性の適応パターン
            if (Math.random() < 0.3) {
                // 現在のエネルギーレベルに応じた膜特性の調整
                let targetPermeability, targetElasticity;
                
                if (this.energy < 0.3) {
                    // エネルギーが低い場合：透過性を上げてエネルギー吸収を促進
                    targetPermeability = this.membraneProperties.permeability + Math.random() * 0.2;
                    targetElasticity = this.membraneProperties.elasticity - Math.random() * 0.1;
                } else {
                    // エネルギーが十分ある場合：弾性を上げて衝突時のエネルギー損失を減らす
                    targetPermeability = this.membraneProperties.permeability - Math.random() * 0.1;
                    targetElasticity = this.membraneProperties.elasticity + Math.random() * 0.2;
                }
                
                return {
                    type: 'membrane',
                    parameters: {
                        permeability: Math.max(0.1, Math.min(0.9, targetPermeability)),
                        elasticity: Math.max(0.1, Math.min(0.9, targetElasticity))
                    },
                    creationTime: time,
                    successRate: 0,
                    usageCount: 0
                };
            }
            
            // 3. 運動パターンの適応（確率を上げて優先度を高める）
            if (Math.random() < 0.5) {
                // 現在の振動レベルに基づいた運動パターンの生成
                const oscillationLevel = this.internalState.oscillation;
                
                // 振動レベルに基づいて異なる運動パターンを生成
                let velocityX, velocityY;
                
                if (oscillationLevel < 0.3) {
                    // 低振動：直線的な動き
                    const angle = Math.random() * Math.PI * 2;
                    velocityX = Math.cos(angle) * 0.1;
                    velocityY = Math.sin(angle) * 0.1;
                } else if (oscillationLevel < 0.6) {
                    // 中振動：波状の動き
                    const baseAngle = Math.random() * Math.PI * 2;
                    const waveStrength = 0.05 + Math.random() * 0.1;
                    velocityX = Math.cos(baseAngle) * waveStrength;
                    velocityY = Math.sin(baseAngle) * waveStrength;
                } else {
                    // 高振動：より複雑な動き（螺旋や急な方向転換）
                    const spiralFactor = 0.1 + Math.random() * 0.2;
                    velocityX = (Math.random() - 0.5) * spiralFactor;
                    velocityY = (Math.random() - 0.5) * spiralFactor;
                }
                
                // 現在のエネルギー状態に基づいて運動強度を調整
                const energyFactor = 0.5 + this.energy * 0.5;
                velocityX *= energyFactor;
                velocityY *= energyFactor;
                
                return {
                    type: 'movement',
                    parameters: {
                        velocityX: velocityX,
                        velocityY: velocityY,
                        oscillationBased: true,
                        targetOscillation: oscillationLevel
                    },
                    creationTime: time,
                    successRate: 0,
                    usageCount: 0
                };
            }
            
            // 4. 振動-運動連動パターン（新しいタイプ）
            if (Math.random() < 0.3) {
                // 振動と運動を連動させる特殊なパターン
                const baseFrequency = 0.2 + Math.random() * 0.6; // 基本周波数
                const amplitude = 0.05 + Math.random() * 0.15;   // 振幅
                const phaseShift = Math.random() * Math.PI * 2;  // 位相シフト
                
                return {
                    type: 'vibration-movement',
                    parameters: {
                        frequency: baseFrequency,
                        amplitude: amplitude,
                        phaseShift: phaseShift,
                        directionBias: Math.random() < 0.5 ? 'clockwise' : 'counterclockwise'
                    },
                    creationTime: time,
                    successRate: 0,
                    usageCount: 0
                };
            }
            
            // デフォルトでは現在の状態を維持するパターンを返す
            return {
                type: 'maintain',
                parameters: {
                    oscillation: this.internalState.oscillation
                },
                creationTime: time,
                successRate: 0,
                usageCount: 0
            };
        }
        
        // パターンの淘汰
        pruneAdaptivePatterns() {
            // パターンを評価基準でソート（複数の基準を考慮）
            this.memory.adaptivePatterns.sort((a, b) => {
                // 1. 成功率（高いほど良い）
                const successRateDiff = b.successRate - a.successRate;
                
                // 2. 最近使用されたか（最近使われたほど良い）
                const recencyDiff = (b.lastUsed || 0) - (a.lastUsed || 0);
                
                // 3. 使用頻度（多いほど良い）
                const usageCountDiff = (b.usageCount || 0) - (a.usageCount || 0);
                
                // 4. 強度（高いほど良い）
                const strengthDiff = (b.strength || 0) - (a.strength || 0);
                
                // 複合スコアを計算（各要素に重み付け）
                return (
                    successRateDiff * 0.4 + 
                    recencyDiff * 0.0001 + // 時間は大きな数値なので小さな重みを付ける
                    usageCountDiff * 0.3 + 
                    strengthDiff * 0.3
                );
            });
            
            // 最も評価の低いパターンを削除
            this.memory.adaptivePatterns.pop();
        }
        
        // 適応パターンの適用
        applyAdaptivePatterns() {
            // 現在の状況に最も適したパターンを選択
            const currentConditions = {
                energy: this.energy,
                oscillation: this.internalState.oscillation,
                stability: this.internalState.stability,
                collisions: this.memory.recentCollisions
            };
            
            // 現在の状況に応じたパターン選択戦略
            let patternSelectionStrategy;
            
            if (this.energy < 0.3) {
                // エネルギーが低い場合：エネルギー獲得を優先
                patternSelectionStrategy = 'energy_gain';
            } else if (this.memory.recentCollisions > 3) {
                // 衝突が多い場合：防御を優先
                patternSelectionStrategy = 'defense';
            } else if (this.energy > 0.8) {
                // エネルギーが高い場合：探索を優先
                patternSelectionStrategy = 'exploration';
            } else {
                // 通常状態：バランスを優先
                patternSelectionStrategy = 'balanced';
            }
            
            // 戦略に基づいてパターンを評価
            const evaluatedPatterns = this.memory.adaptivePatterns.map(pattern => {
                let strategicValue = 0;
                
                switch (patternSelectionStrategy) {
                    case 'energy_gain':
                        // エネルギー獲得に関連するパターンを優先
                        if (pattern.type === 'membrane' && pattern.parameters.permeability > 0.6) {
                            strategicValue += 0.3; // 透過性の高い膜パターンを優先
                        }
                        break;
                        
                    case 'defense':
                        // 防御に関連するパターンを優先
                        if (pattern.type === 'membrane' && pattern.parameters.thickness > 0.6) {
                            strategicValue += 0.3; // 厚い膜パターンを優先
                        }
                        break;
                        
                    case 'exploration':
                        // 探索に関連するパターンを優先
                        if (pattern.type === 'movement') {
                            strategicValue += 0.3; // 移動パターンを優先
                        }
                        break;
                        
                    case 'balanced':
                        // バランスの取れたパターンを優先
                        strategicValue += 0.1; // すべてのパターンに小さなボーナス
                        break;
                }
                
                // 基本的な関連性評価
                const baseRelevance = this.evaluatePatternRelevance(pattern, currentConditions);
                
                // 総合評価（基本関連性 + 戦略的価値 + 成功率の影響）
                const totalRelevance = baseRelevance * 0.6 + strategicValue + pattern.successRate * 0.2;
                
                return { pattern, relevance: totalRelevance };
            });
            
            // 関連性でソートして最適なパターンを選択
            evaluatedPatterns.sort((a, b) => b.relevance - a.relevance);
            
            // 関連性が十分高いパターンを適用
            if (evaluatedPatterns.length > 0 && evaluatedPatterns[0].relevance > 0.6) {
                const bestPattern = evaluatedPatterns[0].pattern;
                this.applyPattern(bestPattern);
                
                // パターンの使用を記録
                bestPattern.lastUsed = time;
                bestPattern.usageCount = (bestPattern.usageCount || 0) + 1;
                
                // 成功率の更新（エネルギー変化に基づく）
                const initialEnergy = this.energy;
                const initialState = {
                    energy: this.energy,
                    oscillation: this.internalState.oscillation,
                    position: {...this.position}
                };
                
                // 30フレーム後に成功率を評価するためのコールバックを設定
                setTimeout(() => {
                    // 複数の成功指標を評価
                    const energyChange = this.energy - initialEnergy;
                    const positionChange = Math.sqrt(
                        Math.pow(this.position.x - initialState.position.x, 2) +
                        Math.pow(this.position.y - initialState.position.y, 2)
                    );
                    
                    // パターンタイプに応じた成功評価
                    let success = false;
                    
                    switch (bestPattern.type) {
                        case 'vibration':
                            // 振動パターンはエネルギー変化で評価
                            success = energyChange > 0;
                            break;
                            
                        case 'membrane':
                            // 膜パターンはエネルギー保持で評価
                            success = this.energy >= initialEnergy * 0.95;
                            break;
                            
                        case 'movement':
                            // 移動パターンは位置変化で評価
                            success = positionChange > 0.5;
                            break;
                    }
                    
                    // 成功率の更新（加重平均）
                    bestPattern.successRate = bestPattern.successRate * 0.9 + (success ? 0.1 : 0);
                    
                    // 成功した場合、パターンの強度を増加
                    if (success) {
                        bestPattern.strength = Math.min(1.0, bestPattern.strength * 1.05);
                    } else {
                        // 失敗した場合、わずかに強度を減少
                        bestPattern.strength = Math.max(0.1, bestPattern.strength * 0.98);
                    }
                    
                    // 成功/失敗履歴を記録
                    bestPattern.outcomeHistory = bestPattern.outcomeHistory || [];
                    bestPattern.outcomeHistory.push({
                        time: time,
                        success: success,
                        energyChange: energyChange,
                        conditions: { ...currentConditions }
                    });
                    
                    // 履歴サイズを制限
                    if (bestPattern.outcomeHistory.length > 10) {
                        bestPattern.outcomeHistory.shift();
                    }
                }, 30);
            }
        }
        
        // パターンの関連性評価
        evaluatePatternRelevance(pattern, currentConditions) {
            // パターンの適用条件と現在の状況の一致度を評価
            let relevanceScore = 0.5; // 基本スコア
            
            // 条件の類似性を評価
            const energySimilarity = 1 - Math.abs(
                currentConditions.energy - pattern.conditions.energy
            );
            relevanceScore += energySimilarity * 0.3;
            
            const oscillationSimilarity = 1 - Math.abs(
                currentConditions.oscillation - pattern.conditions.oscillation
            );
            relevanceScore += oscillationSimilarity * 0.2;
            
            return Math.max(0, Math.min(1, relevanceScore));
        }
        
        // パターンの適用
        applyPattern(pattern) {
            switch (pattern.type) {
                case 'vibration':
                    // 振動パターンの適用
                    this.internalState.oscillation = 
                        this.internalState.oscillation * 0.7 + pattern.parameters.targetOscillation * 0.3;
                    break;
                    
                case 'membrane':
                    // 膜特性の調整
                    this.membraneProperties.permeability = 
                        this.membraneProperties.permeability * 0.8 + pattern.parameters.permeability * 0.2;
                    this.membraneProperties.elasticity = 
                        this.membraneProperties.elasticity * 0.8 + pattern.parameters.elasticity * 0.2;
                    break;
                    
                case 'movement':
                    // 運動パターンの適用
                    this.velocity.x += pattern.parameters.velocityX * 0.1;
                    this.velocity.y += pattern.parameters.velocityY * 0.1;
                    
                    // 振動ベースの運動パターンの場合、振動レベルも調整
                    if (pattern.parameters.oscillationBased) {
                        this.internalState.oscillation = 
                            this.internalState.oscillation * 0.8 + pattern.parameters.targetOscillation * 0.2;
                    }
                    break;
                    
                case 'vibration-movement':
                    // 振動と運動を連動させる特殊なパターン
                    const { frequency, amplitude, phaseShift, directionBias } = pattern.parameters;
                    
                    // 時間に基づく位相計算
                    const phase = (time * frequency + phaseShift) % (Math.PI * 2);
                    
                    // 振動の調整
                    const oscillationAdjustment = Math.sin(phase) * 0.1;
                    this.internalState.oscillation += oscillationAdjustment;
                    this.internalState.oscillation = Math.max(0.1, Math.min(0.9, this.internalState.oscillation));
                    
                    // 運動方向の調整
                    let dirX, dirY;
                    
                    if (directionBias === 'clockwise') {
                        // 時計回りの螺旋運動
                        dirX = Math.cos(phase) * amplitude;
                        dirY = Math.sin(phase) * amplitude;
                    } else {
                        // 反時計回りの螺旋運動
                        dirX = Math.sin(phase) * amplitude;
                        dirY = Math.cos(phase) * amplitude;
                    }
                    
                    // 現在の速度に加算
                    this.velocity.x += dirX;
                    this.velocity.y += dirY;
                    
                    // 速度の上限を設定
                    const maxSpeed = 0.5;
                    const currentSpeed = Math.sqrt(
                        this.velocity.x * this.velocity.x + 
                        this.velocity.y * this.velocity.y
                    );
                    
                    if (currentSpeed > maxSpeed) {
                        this.velocity.x = (this.velocity.x / currentSpeed) * maxSpeed;
                        this.velocity.y = (this.velocity.y / currentSpeed) * maxSpeed;
                    }
                    break;
                    
                case 'maintain':
                    // 現在の状態を維持
                    break;
            }
        }
        
        // 現在のパラメータを取得（パターンタイプに基づいて）
        getCurrentParameters(patternType) {
            switch (patternType) {
                case 'vibration':
                    return {
                        targetOscillation: this.internalState.oscillation
                    };
                case 'membrane':
                    return {
                        permeability: this.membraneProperties.permeability,
                        elasticity: this.membraneProperties.elasticity,
                        thickness: this.membraneProperties.thickness
                    };
                case 'movement':
                    return {
                        velocityX: this.velocity.x,
                        velocityY: this.velocity.y
                    };
                default:
                    return {};
            }
        }
        
        // 振動ストレスに基づく組織劣化処理
        processTissueDegeneration() {
            // 現在の振動レベルを記録
            const currentVibration = this.internalState.oscillation;
            this.vibrationHistory.push({
                time: this.age,
                level: currentVibration,
                energy: this.energy
            });
            
            // 履歴サイズを制限
            if (this.vibrationHistory.length > 100) {
                this.vibrationHistory.shift();
            }
            
            // 振動ストレスの計算
            // 1. 振動の強度に比例
            // 2. エネルギーが低いほど影響が大きい
            const vibrationStress = currentVibration * (1.2 - this.energy);
            
            // 累積振動ストレスの更新
            this.cumulativeVibrationStress += vibrationStress;
            
            // 修復能力の経時的低下（0.0001から0.00005に減少させて緩やかに）
            this.repairCapacity = Math.max(0.3, this.repairCapacity - 0.00005);
            
            // 組織の自己修復（エネルギーが高いほど効果的）（0.0005から0.0015に増加）
            const repairAmount = 0.0015 * this.energy * this.repairCapacity;
            
            // 組織完全性の更新（劣化と修復のバランス）
            const degenerationRate = 0.001 * (this.cumulativeVibrationStress / 100);
            this.tissueIntegrity = Math.max(0, 
                this.tissueIntegrity + repairAmount - degenerationRate
            );
            
            // 組織完全性に応じたエネルギー効率の低下
            const efficiencyFactor = 0.5 + (this.tissueIntegrity * 0.5);
            
            // 膜特性の劣化
            if (this.tissueIntegrity < 0.7) {
                // 組織完全性が低下すると膜特性も劣化
                const degradationFactor = 1 - ((0.7 - this.tissueIntegrity) * 0.3);
                this.membraneProperties.permeability *= degradationFactor;
                this.membraneProperties.elasticity *= degradationFactor;
            }
        }
        
        // 死亡時の記憶保存メソッド
        preserveMemoryOnDeath(environment, entities) {
            // 成功率の高い記憶パターンのみを保存
            const valuablePatterns = this.memory.adaptivePatterns
                .filter(pattern => pattern.successRate > 0.8)
                .slice(0, 3); // 最大3つまで
                
            if (valuablePatterns.length > 0) {
                // 周囲のエンティティに記憶を残す
                const radius = 5; // 影響範囲
                
                entities.forEach(entity => {
                    if (entity !== this && entity.isActive) {
                        // 距離を計算
                        const distance = Math.sqrt(
                            Math.pow(entity.position.x - this.position.x, 2) +
                            Math.pow(entity.position.y - this.position.y, 2)
                        );
                        
                        // 範囲内のエンティティに記憶を残す
                        if (distance < radius) {
                            // 距離に応じた強度で記憶を共有
                            const strengthFactor = 1 - (distance / radius);
                            
                            valuablePatterns.forEach(pattern => {
                                const memoryTrace = {
                                    ...pattern,
                                    strength: pattern.strength * strengthFactor * 0.7,
                                    source: "deathMemory",
                                    sourceId: this.id,
                                    sharedAt: time,
                                    relevanceScore: 0.7
                                };
                                
                                entity.memory.sharedMemories.push(memoryTrace);
                            });
                        }
                    }
                });
            }
        }

        // 振動の干渉効果を処理するメソッド（新規追加）
        interferenceVibration(other, collisionImpact) {
            // 振動パターンの取得
            const myVibrationPatterns = this.vibrationMemory.patterns;
            const otherVibrationPatterns = other.vibrationMemory.patterns;
            
            // 振動の共鳴度を計算
            const resonanceLevel = 1 - Math.abs(
                this.internalState.oscillation - other.internalState.oscillation
            );
            
            // 衝突の強さと共鳴度に基づく干渉強度
            const interferenceStrength = collisionImpact * resonanceLevel * 0.5;
            
            // 振動周波数の相互影響
            const myFreq = this.vibrationMemory.resonanceFrequency;
            const otherFreq = other.vibrationMemory.resonanceFrequency;
            
            // 周波数の調整（干渉による変化）
            // 共鳴している場合は周波数が近づく、そうでない場合は離れる
            if (resonanceLevel > 0.7) {
                // 共鳴状態：周波数が近づく（引き込み現象）
                const freqDiff = otherFreq - myFreq;
                this.vibrationMemory.resonanceFrequency += freqDiff * interferenceStrength * 0.2;
                other.vibrationMemory.resonanceFrequency -= freqDiff * interferenceStrength * 0.2;
            } else {
                // 非共鳴状態：周波数が離れる（反発現象）
                const freqDiff = otherFreq - myFreq;
                this.vibrationMemory.resonanceFrequency -= Math.sign(freqDiff) * interferenceStrength * 0.1;
                other.vibrationMemory.resonanceFrequency += Math.sign(freqDiff) * interferenceStrength * 0.1;
            }
            
            // 振動パターンの交換と融合
            if (myVibrationPatterns.length > 0 && otherVibrationPatterns.length > 0 && resonanceLevel > 0.5) {
                // 互いのパターンからランダムに選択
                const myPattern = myVibrationPatterns[Math.floor(Math.random() * myVibrationPatterns.length)];
                const otherPattern = otherVibrationPatterns[Math.floor(Math.random() * otherVibrationPatterns.length)];
                
                // パターンの融合（重み付き平均）
                const fusedPattern = {
                    amplitude: myPattern.amplitude * 0.7 + otherPattern.amplitude * 0.3,
                    frequency: myPattern.frequency * 0.7 + otherPattern.frequency * 0.3,
                    phase: (myPattern.phase + otherPattern.phase) / 2,
                    duration: Math.max(myPattern.duration, otherPattern.duration),
                    timestamp: time
                };
                
                // 一定確率で融合パターンを追加
                if (Math.random() < interferenceStrength) {
                    this.vibrationMemory.patterns.push(fusedPattern);
                    // パターン数の制限
                    if (this.vibrationMemory.patterns.length > 10) {
                        this.vibrationMemory.patterns.shift(); // 古いパターンを削除
                    }
                }
            }
            
            // 振動の最適レベルも相互に影響
            const optimalDiff = other.vibrationMemory.optimalOscillation - this.vibrationMemory.optimalOscillation;
            this.vibrationMemory.optimalOscillation += optimalDiff * interferenceStrength * 0.1;
            other.vibrationMemory.optimalOscillation -= optimalDiff * interferenceStrength * 0.1;
            
            // 振動履歴に干渉イベントを記録
            this.vibrationHistory.push({
                level: this.internalState.oscillation,
                source: 'interference',
                timestamp: time,
                intensity: interferenceStrength
            });
            
            other.vibrationHistory.push({
                level: other.internalState.oscillation,
                source: 'interference',
                timestamp: time,
                intensity: interferenceStrength
            });
        }

        // 集団の動きを同調させるメソッド（新規追加）
        synchronizeGroupMovement(mergedEntities) {
            // 全体の平均速度を計算
            let avgVX = this.velocity.x;
            let avgVY = this.velocity.y;
            
            for (const other of mergedEntities) {
                avgVX += other.velocity.x;
                avgVY += other.velocity.y;
            }
            
            avgVX /= (mergedEntities.length + 1);
            avgVY /= (mergedEntities.length + 1);
            
            // 同調度合いを計算（結合時間が長いほど強く同調）
            const syncFactor = Math.min(this.mergeState.mergeTimer / 200, 0.8);
            
            // 自分の速度を平均に近づける
            this.velocity.x = this.velocity.x * (1 - syncFactor) + avgVX * syncFactor;
            this.velocity.y = this.velocity.y * (1 - syncFactor) + avgVY * syncFactor;
        }

        // 新しいメソッド: 振動パターンを運動方向に適用
        applyVibrationToMovement() {
            // 振動レベルに基づいて運動方向を変化させる
            const oscillationLevel = this.internalState.oscillation;
            
            // 振動が強いほど方向変化が大きくなる
            const directionChangeStrength = oscillationLevel * 0.2;
            
            // 振動パターンに基づく方向変化
            // 振動の周期性を利用して正弦波パターンで方向を変える
            const vibrationPhase = (time * oscillationLevel) % (Math.PI * 2);
            const directionX = Math.cos(vibrationPhase) * directionChangeStrength;
            const directionY = Math.sin(vibrationPhase) * directionChangeStrength;
            
            // 現在の速度ベクトルの大きさを保存
            const currentSpeed = Math.sqrt(
                this.velocity.x * this.velocity.x + 
                this.velocity.y * this.velocity.y
            ) || 0.01; // ゼロ除算を避ける
            
            // 新しい方向ベクトルを計算
            const newDirectionX = this.velocity.x + directionX;
            const newDirectionY = this.velocity.y + directionY;
            
            // 新しい方向ベクトルの長さを計算
            const newDirectionLength = Math.sqrt(
                newDirectionX * newDirectionX + 
                newDirectionY * newDirectionY
            ) || 0.01;
            
            // 元の速度の大きさを保ちながら方向を変更
            this.velocity.x = (newDirectionX / newDirectionLength) * currentSpeed;
            this.velocity.y = (newDirectionY / newDirectionLength) * currentSpeed;
            
            // 振動が強すぎる場合、ランダムな方向転換を追加（カオス的な動き）
            if (oscillationLevel > 0.7 && Math.random() < oscillationLevel * 0.3) {
                const randomAngle = Math.random() * Math.PI * 2;
                const randomStrength = oscillationLevel * 0.1;
                
                this.velocity.x += Math.cos(randomAngle) * randomStrength;
                this.velocity.y += Math.sin(randomAngle) * randomStrength;
            }
            
            // 振動が最適値に近いほど、直進性が高まる効果を追加
            const optimalOscillation = this.vibrationMemory.optimalOscillation;
            const oscillationDifference = Math.abs(oscillationLevel - optimalOscillation);
            
            if (oscillationDifference < 0.1) {
                // 最適振動に近い場合、現在の方向をわずかに強化
                const stabilizationFactor = 1.0 + (0.1 - oscillationDifference);
                this.velocity.x *= stabilizationFactor;
                this.velocity.y *= stabilizationFactor;
            }
            
            // 速度の上限を設定
            const maxSpeed = 0.5;
            const currentSpeedAfter = Math.sqrt(
                this.velocity.x * this.velocity.x + 
                this.velocity.y * this.velocity.y
            );
            
            if (currentSpeedAfter > maxSpeed) {
                this.velocity.x = (this.velocity.x / currentSpeedAfter) * maxSpeed;
                this.velocity.y = (this.velocity.y / currentSpeedAfter) * maxSpeed;
            }
        }
    }
    
    // 環境クラス - エネルギー場や環境条件を提供
    class Environment {
        constructor() {
            // 環境のノイズシード
            this.seedX = Math.random() * 1000;
            this.seedY = Math.random() * 1000;
            
            // 環境エネルギーフィールドの初期化
            this.energyField = Array(width * height).fill().map(() => ({
                energy: 0,
                weight: 0
            }));
            
            // 初期エネルギー分布の設定
            this.redistributeEnergy();
        }
        
        // エネルギーの再分配
        redistributeEnergy() {
            let totalEntityEnergy = 0;
            for (const entity of entities) {
                if (entity && entity.isActive) {
                    totalEntityEnergy += entity.energy || 0;
                }
            }
            
            // 残りのエネルギーを環境に分配
            const environmentEnergy = Math.max(0, TOTAL_SYSTEM_ENERGY - totalEntityEnergy);
            this.initializeEnergyField(environmentEnergy);
        }

        // 環境エネルギーフィールドの初期化
        initializeEnergyField(totalEnvironmentEnergy) {
            let totalDistributionWeight = 0;
            
            // 初期分布の重みを計算
            for (let i = 0; i < this.energyField.length; i++) {
                const x = i % width;
                const y = Math.floor(i / width);
                
                // より複雑なエネルギー分布パターン
                const nx = (x * 0.1 + this.seedX);
                const ny = (y * 0.1 + this.seedY);
                const weight = (
                    Math.sin(nx) * Math.sin(ny) + 
                    Math.sin(nx * 0.5) * Math.sin(ny * 0.5) + 
                    1
                ) / 3;  // 0～1の範囲
                
                this.energyField[i] = {
                    energy: 0,
                    weight: weight
                };
                
                totalDistributionWeight += weight;
            }
            
            // 重みに基づいてエネルギーを分配
            for (let i = 0; i < this.energyField.length; i++) {
                this.energyField[i].energy = 
                    (this.energyField[i].weight / totalDistributionWeight) * totalEnvironmentEnergy;
            }
        }

        // エネルギーの拡散処理を追加
        diffuseEnergy() {
            const diffusionRate = 0.05; // 拡散率を0.1から0.05に減少させて、より緩やかな拡散に
            const newField = this.energyField.map(cell => ({ ...cell }));
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    const currentEnergy = this.energyField[idx].energy;
                    
                    // 拡散するエネルギー量
                    const diffusionAmount = currentEnergy * diffusionRate;
                    
                    // 隣接セルへの拡散
                    const neighbors = this.getNeighborIndices(x, y);
                    const diffusionPerNeighbor = diffusionAmount / neighbors.length;
                    
                    // エネルギーの移動
                    newField[idx].energy -= diffusionAmount;
                    for (const neighborIdx of neighbors) {
                        newField[neighborIdx].energy += diffusionPerNeighbor;
                    }
                }
            }
            
            this.energyField = newField;
        }

        // 隣接セルのインデックスを取得
        getNeighborIndices(x, y) {
            const neighbors = [];
            const directions = [
                [-1, 0], [1, 0], [0, -1], [0, 1],  // 上下左右
                [-1, -1], [-1, 1], [1, -1], [1, 1]  // 斜め方向（左上、左下、右上、右下）
            ];
            
            for (const [dx, dy] of directions) {
                const newX = x + dx;
                const newY = y + dy;
                if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
                    neighbors.push(newY * width + newX);
                }
            }
            
            return neighbors;
        }

        // エネルギー取得の改善
        getEnergyAt(position, time, amount) {
            const x = Math.floor(position.x);
            const y = Math.floor(position.y);
            
            if (x < 0 || x >= width || y < 0 || y >= height) return 0;
            
            const idx = y * width + x;
            const availableEnergy = this.energyField[idx].energy;
            const extractedEnergy = Math.min(amount, availableEnergy);
            
            // エネルギー抽出
            this.energyField[idx].energy -= extractedEnergy;
            
            return extractedEnergy;
        }

        // エネルギーを環境に戻す
        returnEnergyAt(position, amount) {
            const x = Math.floor(position.x);
            const y = Math.floor(position.y);
            
            // 境界外の場合は最も近い有効な位置に還元
            const validX = Math.max(0, Math.min(width - 1, x));
            const validY = Math.max(0, Math.min(height - 1, y));
            
            const idx = validY * width + validX;
            this.energyField[idx].energy += amount;
        }
    }
    
    // エンティティと環境の初期化
    const entities = [];
    
    // コロニー状の初期配置を行う関数
    function createInitialColony() {
        // 初期コロニーの中心位置
        const centerX = width / 2;
        const centerY = height / 2;
        
        // 初期エンティティにより多くのエネルギーを与える
        for (let i = 0; i < initialEntityCount; i++) {
            const entity = new Entity(centerX, centerY);
            entity.energy = 0.8;  // 初期エネルギーを増加
            entities.push(entity);
        }
    }
    
    // 初期コロニーの作成
    createInitialColony();
    
    // 環境の初期化（エンティティの後に行う）
    const environment = new Environment();
    
    // Z-bufferの初期化（表示用）
    function initZBuffer() {
        const buffer = [];
        for (let i = 0; i < width * height; i++) {
            buffer.push({
                char: ' ',
                depth: Infinity,
                color: ''
            });
        }
        return buffer;
    }
    
    // エンティティの色を計算
    function getEntityColor(entity) {
        // エネルギーレベルに基づいて色を生成
        const energyLevel = entity.energy;
        
        // 膜の特性に基づいて色を調整
        const elasticityFactor = entity.membraneProperties ? entity.membraneProperties.elasticity : 0.5;
        const permeabilityFactor = entity.membraneProperties ? entity.membraneProperties.permeability : 0.3;
        const thicknessFactor = entity.membraneProperties ? entity.membraneProperties.thickness : 0.4;
        
        // 振動レベルを色に反映
        const oscillationFactor = entity.internalState ? entity.internalState.oscillation : 0.3;
        
        // 結合状態を色に反映
        if (entity.mergeState && entity.mergeState.isMerged) {
            // 結合状態のエンティティは特別な色で表示
            // 結合の強さに応じて色を変化させる
            const mergeStrength = entity.mergeState.mergeStrength;
            
            // 結合状態は青緑系の色で表現
            const r = Math.floor(50 + mergeStrength * 50);
            const g = Math.floor(180 + mergeStrength * 40);
            const b = Math.floor(200 + mergeStrength * 55);
            
            // 結合状態は少し透明度を上げる
            const alpha = 0.85 + mergeStrength * 0.15;
            
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        
        // 通常状態の色の計算
        // 落ち着いた色の基本色を設定
        const baseR = 100;
        const baseG = 140;
        const baseB = 180;
        
        // 基本色の計算（エネルギーレベルと膜特性を反映）
        const r = Math.floor(baseR + energyLevel * 100 + elasticityFactor * 30);
        const g = Math.floor(baseG + (1 - energyLevel) * 60 + permeabilityFactor * 30);
        const b = Math.floor(baseB + oscillationFactor * 40 + thicknessFactor * 30);
        
        // エネルギーレベルと膜の厚さに基づいて透明度を調整
        const alpha = 0.8 + energyLevel * 0.2;
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    // フレームの描画
    function render() {
        // 現在の実時間を取得
        const realTime = performance.now() / 1000;  // 秒単位の実時間
        
        // フレームカウンターを増加
        frameCount++;
        
        // 一時停止中なら更新しない
        if (!paused) {
            // エンティティの更新
            for (let i = entities.length - 1; i >= 0; i--) {
                const entity = entities[i];
                if (!entity || !entity.isActive) {
                    entities.splice(i, 1);
                    continue;
                }
                
                // 主観的時間スケールを計算して更新（シミュレーション速度も反映）
                entity.update(entities, environment, calculateSubjectiveTime(entity, realTime) * simulationSpeed);
            }
            
            // 環境エネルギーの拡散（シミュレーション速度に応じて）
            if (frameCount % Math.max(1, Math.round(3 / simulationSpeed)) === 0) {  // 頻度を増加（5から3に）
                environment.diffuseEnergy();
            }

            // システム全体のエネルギーバランスをモニタリング（より頻繁に）
            if (frameCount % 50 === 0) {  // 100から50に変更
                let totalEnergy = 0;
                let entityEnergy = 0;
                let environmentEnergy = 0;
                let queuedEnergy = 0;
                
                // エンティティのエネルギー
                for (const entity of entities) {
                    if (entity && entity.isActive) {
                        entityEnergy += entity.energy;
                        
                        // キューに溜まっているエネルギーも計算
                        for (const queueItem of entity.energyReturnQueue) {
                            queuedEnergy += queueItem.amount;
                        }
                    }
                }
                
                // 環境のエネルギー
                for (const cell of environment.energyField) {
                    if (cell) {
                        environmentEnergy += cell.energy;
                    }
                }
                
                totalEnergy = entityEnergy + environmentEnergy + queuedEnergy;
                
                // エネルギー保存則の検証（デバッグ用）
                console.log(`Time: ${time}, Total Energy: ${totalEnergy.toFixed(3)}, Target: ${TOTAL_SYSTEM_ENERGY}, Diff: ${(totalEnergy - TOTAL_SYSTEM_ENERGY).toFixed(3)}`);
                console.log(`Entity: ${entityEnergy.toFixed(3)}, Environment: ${environmentEnergy.toFixed(3)}, Queued: ${queuedEnergy.toFixed(3)}`);
                
                // エネルギーの差が大きい場合は警告
                if (Math.abs(totalEnergy - TOTAL_SYSTEM_ENERGY) > 1.0) {
                    console.warn(`エネルギー保存則の違反を検出: ${(totalEnergy - TOTAL_SYSTEM_ENERGY).toFixed(3)}`);
                }
            }
        }
        
        // シミュレーションメトリクスの収集（一時停止中も収集）
        collectSimulationData();
        
        // 統計グラフの更新
        if (showStats && frameCount % 30 === 0) {
            updateStatsDisplay();
        }
        
        // エネルギー分布の描画
        let output = '';
        
        // 現在のフレームでの最大エネルギー値を計算
        let currentMaxEnergy = 0;
        for (let i = 0; i < environment.energyField.length; i++) {
            currentMaxEnergy = Math.max(currentMaxEnergy, environment.energyField[i].energy);
        }
        
        // 最大エネルギー値の履歴を更新
        maxEnergyHistory.push(currentMaxEnergy);
        if (maxEnergyHistory.length > MAX_ENERGY_HISTORY_LENGTH) {
            maxEnergyHistory.shift();
        }
        
        // 過去数フレームの最大値を使用（デバッグ用）
        let dynamicMaxEnergy = Math.max(...maxEnergyHistory);
        
        // 固定の基準値を使用
        // 最小エネルギー値も固定
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const energyLevel = environment.energyField[index].energy;
                
                // エネルギーレベルに基づいて色を生成（固定基準値を使用）
                const normalizedEnergy = (energyLevel - REFERENCE_MIN_ENERGY) / (REFERENCE_MAX_ENERGY - REFERENCE_MIN_ENERGY);
                const intensity = Math.max(0, Math.min(normalizedEnergy, 1));
                
                // 色の計算方法を調整（より安定した表示のために）
                // 対数スケールを使用して低エネルギー領域の視認性を向上
                const logIntensity = Math.log(intensity * 9 + 1) / Math.log(10); // log10(intensity * 9 + 1)
                
                // 落ち着いた色の設定
                const baseColor = 40; // 暗めのベース色
                // 落ち着いた青系の色を生成（エネルギーレベルに応じて）
                const r = Math.floor(baseColor + logIntensity * (100 - baseColor));
                const g = Math.floor(baseColor + logIntensity * (130 - baseColor));
                const b = Math.floor(baseColor + logIntensity * (180 - baseColor));
                
                // エンティティの存在チェック
                let hasEntity = false;
                for (const entity of entities) {
                    if (Math.floor(entity.position.x) === x && Math.floor(entity.position.y) === y) {
                        hasEntity = true;
                        break;
                    }
                }
                
                if (hasEntity) {
                    // エンティティが存在する場合はエネルギーレベルに応じた文字と色で表示
                    const entity = entities.find(e => Math.floor(e.position.x) === x && Math.floor(e.position.y) === y);
                    if (entity) {
                        const charIndex = Math.min(Math.max(0, Math.floor(entity.energy * (asciiChars.length - 1))), asciiChars.length - 1);
                        const displayChar = asciiChars[charIndex];
                        output += `<span style="color: ${getEntityColor(entity)}">${displayChar}</span>`;
                    } else {
                        output += `<span>·</span>`;
                    }
                } else {
                    // エネルギーレベルに応じた色で表示（背景色も設定、よりコントラストを強く）
                    const bgR = Math.floor(r * 0.6);  // 背景色は前景色の60%の明るさ
                    const bgG = Math.floor(g * 0.6);
                    const bgB = Math.floor(b * 0.6);
                    output += `<span style="color: rgb(${r},${g},${b}); background-color: rgb(${bgR},${bgG},${bgB})">░</span>`;
                }
            }
            output += '<br>';
        }
        
        canvas.innerHTML = output;
        
        // 次のフレーム
        time++;
        
        // 10FPSに制限
        setTimeout(() => {
            requestAnimationFrame(render);
        }, 33); // 100ms = 10FPS
    }
    
    // エンティティごとの主観的時間を計算 - 昼夜サイクル要素なし
    function calculateSubjectiveTime(entity, realTime) {
        // エネルギーレベルに基づく時間スケール
        const baseFactor = 0.5 + entity.energy * 0.5;
        
        // 実時間変動要素
        const timeGapFactor = Math.sin(realTime * 0.1) * 0.2 + 1.0;
        
        return baseFactor * timeGapFactor;
    }
    
    // シミュレーション開始
    render();
    
    // ウィンドウサイズ変更時の処理
    window.addEventListener('resize', () => {
        // フォントサイズを調整（正方形のグリッドになるように）
        const fontWidth = Math.floor(window.innerWidth / width);
        const fontHeight = Math.floor(window.innerHeight / height);
        const fontSize = Math.min(fontWidth, fontHeight);
        canvas.style.fontSize = `${fontSize}px`;
    });
    
    // 初期フォントサイズ設定
    const fontWidth = Math.floor(window.innerWidth / width);
    const fontHeight = Math.floor(window.innerHeight / height);
    const fontSize = Math.min(fontWidth, fontHeight);
    canvas.style.fontSize = `${fontSize}px`;

    // シミュレーションデータの収集と分析
    let simulationData = {
        timestamps: [],
        populationSize: [],
        averageEnergy: [],
        environmentalEnergy: [],
        experimentMetadata: {
            name: "Simple Life Simulation",
            description: "Basic energy-based life simulation",
            startTime: new Date().toISOString()
        }
    };
    
    function collectSimulationData() {
        // 定期的なデータ収集（例：100フレームごと）
        if (frameCount % 100 !== 0) return;
        
        const currentTime = performance.now() / 1000;
        simulationData.timestamps.push(currentTime);
        simulationData.populationSize.push(entities.length);
        
        // 平均エネルギー計算
        const totalEnergy = entities.reduce((sum, entity) => sum + entity.energy, 0);
        const avgEnergy = entities.length > 0 ? totalEnergy / entities.length : 0;
        simulationData.averageEnergy.push(avgEnergy);
        
        // 環境エネルギーの記録
        const totalEnvironmentalEnergy = calculateTotalEnvironmentalEnergy();
        simulationData.environmentalEnergy.push(totalEnvironmentalEnergy);
        
        // データが多すぎる場合は古いデータを削除
        const maxDataPoints = 1000;
        if (simulationData.timestamps.length > maxDataPoints) {
            for (const key in simulationData) {
                if (Array.isArray(simulationData[key])) {
                    simulationData[key] = simulationData[key].slice(-maxDataPoints);
                }
            }
        }
    }
    
    function calculateTotalEnvironmentalEnergy() {
        // 環境のエネルギー総量を計算
        let totalEnergy = 0;
        for (const cell of environment.energyField) {
            if (cell) {
                totalEnergy += cell.energy;
            }
        }
        return totalEnergy;
    }
    
    // データのエクスポート機能
    function exportSimulationData() {
        // メタデータを最新情報に更新
        simulationData.experimentMetadata.endTime = new Date().toISOString();
        simulationData.experimentMetadata.duration = (new Date() - new Date(simulationData.experimentMetadata.startTime)) / 1000; // 秒単位
        simulationData.experimentMetadata.finalPopulation = entities.length;
        
        // 現在のシミュレーションパラメータを記録
        simulationData.experimentMetadata.parameters = {
            ...simulationData.experimentMetadata.parameters,
            currentPopulation: entities.length,
            simulationTime: performance.now() / 1000,
            frameCount: frameCount
        };
        
        const dataStr = JSON.stringify(simulationData, null, 2); // 整形JSONで出力
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const experimentName = simulationData.experimentMetadata.name.replace(/\s+/g, '_').toLowerCase();
        const exportFileDefaultName = `alife_exp_${experimentName}_${new Date().toISOString().replace(/:/g, '-')}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }
    
    // データのインポート機能
    function importSimulationData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    // 基本的な検証
                    if (!importedData.experimentMetadata || !importedData.timestamps) {
                        alert('無効な実験データファイルです');
                        return;
                    }
                    
                    // データをインポート
                    simulationData = importedData;
                    
                    // UI更新
                    if (showStats) {
                        updateStatsDisplay();
                    }
                    
                    alert(`実験データ "${simulationData.experimentMetadata.name}" をインポートしました`);
                } catch (error) {
                    alert('データのインポートに失敗しました: ' + error.message);
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }

    // Initialize UI when simulation starts
    window.addEventListener('load', function() {
        initializeUI();
    });

    // UI初期化
    function initializeUI() {
        // Control panel
        const controlPanel = document.createElement('div');
        controlPanel.id = 'control-panel';
        controlPanel.style.position = 'absolute';
        controlPanel.style.top = '10px';
        controlPanel.style.right = '10px';
        controlPanel.style.backgroundColor = 'rgba(52, 73, 94, 0.9)'; // 暗めの青灰色に変更
        controlPanel.style.padding = '10px';
        controlPanel.style.borderRadius = '5px';
        controlPanel.style.color = 'white';
        controlPanel.style.fontFamily = 'monospace';
        controlPanel.style.zIndex = '1000';
        
        // Controls section
        const controlsSection = document.createElement('div');
        controlsSection.innerHTML = '<h4>Controls</h4>';
        
        // Pause/Resume button
        const pauseButton = document.createElement('button');
        pauseButton.textContent = 'Pause';
        pauseButton.onclick = function() {
            paused = !paused;
            pauseButton.textContent = paused ? 'Resume' : 'Pause';
        };
        controlsSection.appendChild(pauseButton);
        
        // Speed control
        const speedLabel = document.createElement('div');
        speedLabel.textContent = 'Speed: 1.0x';
        speedLabel.style.marginTop = '10px';
        
        const speedSlider = document.createElement('input');
        speedSlider.type = 'range';
        speedSlider.min = '0.1';
        speedSlider.max = '5.0';
        speedSlider.step = '0.1';
        speedSlider.value = '1.0';
        speedSlider.style.width = '100%';
        speedSlider.oninput = function() {
            simulationSpeed = parseFloat(this.value);
            speedLabel.textContent = `Speed: ${simulationSpeed.toFixed(1)}x`;
        };
        
        controlsSection.appendChild(speedLabel);
        controlsSection.appendChild(speedSlider);
        
        // Add entity button
        const addEntityButton = document.createElement('button');
        addEntityButton.textContent = 'Add Entity';
        addEntityButton.style.marginTop = '10px';
        addEntityButton.onclick = function() {
            const x = Math.random() * width;
            const y = Math.random() * height;
            entities.push(new Entity(x, y));
        };
        controlsSection.appendChild(addEntityButton);
        
        // Stats toggle
        const statsToggle = document.createElement('button');
        statsToggle.textContent = 'Show Stats';
        statsToggle.style.marginTop = '10px';
        statsToggle.onclick = function() {
            showStats = !showStats;
            statsToggle.textContent = showStats ? 'Hide Stats' : 'Show Stats';
            
            // 統計パネルの表示/非表示を切り替え
            const statsPanel = document.getElementById('stats-panel');
            if (statsPanel) {
                if (showStats) {
                    updateStatsDisplay();
                    statsPanel.style.display = 'block';
                } else {
                    statsPanel.style.display = 'none';
                }
            }
        };
        controlsSection.appendChild(statsToggle);
        
        // Add sections to control panel
        controlPanel.appendChild(controlsSection);
        
        // Stats panel
        const statsPanel = document.createElement('div');
        statsPanel.id = 'stats-panel';
        statsPanel.style.position = 'absolute';
        statsPanel.style.top = '10px';
        statsPanel.style.left = '10px';
        statsPanel.style.backgroundColor = 'rgba(52, 73, 94, 0.9)'; // 暗めの青灰色に変更
        statsPanel.style.padding = '10px';
        statsPanel.style.borderRadius = '5px';
        statsPanel.style.color = 'white';
        statsPanel.style.fontFamily = 'monospace';
        statsPanel.style.display = 'none';
        statsPanel.style.zIndex = '1000';
        
        // Add panels to document
        document.body.appendChild(controlPanel);
        document.body.appendChild(statsPanel);
    }
    
    function updateStatsDisplay() {
        // 統計パネルを取得
        const statsPanel = document.getElementById('stats-panel');
        if (!statsPanel) return;
        
        // showStatsがfalseの場合は非表示にして終了
        if (!showStats) {
            statsPanel.style.display = 'none';
            return;
        }
        
        // Get latest stats data (max 100 points)
        const dataPoints = Math.min(simulationData.timestamps.length, 100);
        const timestamps = simulationData.timestamps.slice(-dataPoints);
        const populations = simulationData.populationSize.slice(-dataPoints);
        const energyData = simulationData.averageEnergy.slice(-dataPoints);
        
        // Clear previous content
        statsPanel.innerHTML = '<h3 style="color: #3498db;">Simulation Stats</h3>';
        statsPanel.style.display = 'block';
        
        // Create basic stats display
        const statsInfo = document.createElement('div');
        statsInfo.innerHTML = `
            <p>Time: ${time}</p>
            <p>Entities: ${entities.length}</p>
            <p>Average Energy: ${simulationData.averageEnergy.length > 0 ? 
                simulationData.averageEnergy[simulationData.averageEnergy.length - 1].toFixed(3) : 'N/A'}</p>
        `;
        statsPanel.appendChild(statsInfo);
        
        // Create population graph
        const populationGraph = document.createElement('canvas');
        populationGraph.id = 'population-graph';
        populationGraph.width = 280;
        populationGraph.height = 120;
        
        const populationTitle = document.createElement('h4');
        populationTitle.textContent = 'Population';
        populationTitle.style.color = '#3498db';
        statsPanel.appendChild(populationTitle);
        statsPanel.appendChild(populationGraph);
        
        // Create energy graph
        const energyGraph = document.createElement('canvas');
        energyGraph.id = 'energy-graph';
        energyGraph.width = 280;
        energyGraph.height = 120;
        
        const energyTitle = document.createElement('h4');
        energyTitle.textContent = 'Energy';
        energyTitle.style.color = '#3498db';
        statsPanel.appendChild(energyTitle);
        statsPanel.appendChild(energyGraph);
        
        // Draw graphs
        drawGraph('population-graph', timestamps, populations, 'Population', 'rgb(46, 204, 113)'); // 緑色に変更
        drawGraph('energy-graph', timestamps, energyData, 'Energy', 'rgb(231, 76, 60)'); // 赤色に変更
    }
    
    function drawGraph(canvasId, xData, yData, label, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background
        ctx.fillStyle = 'rgba(52, 73, 94, 0.7)'; // 暗めの青灰色に変更
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Axis
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.stroke();
        
        if (yData.length < 2) return;
        
        // Draw data if available
        const maxY = Math.max(...yData) * 1.1 || 1; // Prevent division by zero
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < yData.length; i++) {
            const x = (i / (yData.length - 1)) * canvas.width;
            const y = canvas.height - (yData[i] / maxY) * canvas.height;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // Labels and current value
        ctx.fillStyle = 'white';
        ctx.font = '12px monospace';
        ctx.fillText(`${label}: ${yData[yData.length - 1].toFixed(2)}`, 5, 15);
        ctx.fillText(`Max: ${maxY.toFixed(2)}`, 5, 30);
    }
    
    function updateEntityDetails(entity) {
        if (!entity) return;
        
        const detailsDiv = document.getElementById('entity-details');
        detailsDiv.innerHTML = `
            <h3>エンティティ #${entity.id}</h3>
            <div class="detail-row">
                <div class="detail-label">エネルギー:</div>
                <div class="detail-value">${(entity.energy * 100).toFixed(1)}%</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">年齢:</div>
                <div class="detail-value">${Math.floor(entity.age)} フレーム</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">組織完全性:</div>
                <div class="detail-value">${(entity.tissueIntegrity * 100).toFixed(1)}%</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">振動ストレス:</div>
                <div class="detail-value">${entity.cumulativeVibrationStress.toFixed(2)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">振動レベル:</div>
                <div class="detail-value">${(entity.internalState.oscillation * 100).toFixed(1)}%</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">安定性:</div>
                <div class="detail-value">${(entity.internalState.stability * 100).toFixed(1)}%</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">膜透過性:</div>
                <div class="detail-value">${(entity.membraneProperties.permeability * 100).toFixed(1)}%</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">膜弾性:</div>
                <div class="detail-value">${(entity.membraneProperties.elasticity * 100).toFixed(1)}%</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">膜厚さ:</div>
                <div class="detail-value">${(entity.membraneProperties.thickness * 100).toFixed(1)}%</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">記憶パターン:</div>
                <div class="detail-value">${entity.memory.adaptivePatterns.length}個</div>
            </div>
            <button onclick="showGenomeDetails(selectedEntity)" class="detail-button">詳細表示</button>
        `;
        
        // 振動グラフの描画
        drawVibrationGraph();
    }
    
    // 組織完全性の色を取得
    function getTissueIntegrityColor(integrity) {
        if (integrity > 0.8) return '#4CAF50'; // 健全 - 緑
        if (integrity > 0.5) return '#FFC107'; // 中程度の劣化 - 黄色
        if (integrity > 0.3) return '#FF9800'; // 重度の劣化 - オレンジ
        return '#F44336'; // 危険な劣化 - 赤
    }
    
    // 修復能力の色を取得
    function getRepairCapacityColor(capacity) {
        if (capacity > 0.8) return '#2196F3'; // 高い - 青
        if (capacity > 0.5) return '#03A9F4'; // 中程度 - 水色
        if (capacity > 0.3) return '#00BCD4'; // 低い - 薄い青緑
        return '#B0BEC5'; // 非常に低い - グレー
    }
    
    // エネルギーの色を取得
    function getEnergyColor(energy) {
        if (energy > 0.7) return '#4CAF50'; // 高エネルギー - 緑
        if (energy > 0.4) return '#FFC107'; // 中エネルギー - 黄色
        if (energy > 0.2) return '#FF9800'; // 低エネルギー - オレンジ
        return '#F44336'; // 危険なエネルギー - 赤
    }
    
    // 振動レベルの色を取得
    function getOscillationColor(oscillation) {
        if (oscillation < 0.3) return '#4CAF50'; // 低振動 - 緑
        if (oscillation < 0.6) return '#FFC107'; // 中振動 - 黄色
        if (oscillation < 0.8) return '#FF9800'; // 高振動 - オレンジ
        return '#F44336'; // 危険な振動 - 赤
    }
    
    // 安定性の色を取得
    function getStabilityColor(stability) {
        if (stability > 0.8) return '#4CAF50'; // 高安定 - 緑
        if (stability > 0.5) return '#FFC107'; // 中安定 - 黄色
        if (stability > 0.3) return '#FF9800'; // 低安定 - オレンジ
        return '#F44336'; // 不安定 - 赤
    }
    
    function drawVibrationGraph() {
        if (!selectedEntity) return;
        
        const canvas = document.getElementById('vibration-graph');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // キャンバスをクリア
        ctx.clearRect(0, 0, width, height);
        
        // 背景を描画
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, width, height);
        
        // グリッドを描画
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        
        // 横線
        for (let i = 0; i <= 5; i++) {
            const y = height - (height * (i / 5));
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // 縦線
        for (let i = 0; i <= 10; i++) {
            const x = width * (i / 10);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // 振動履歴データを取得
        const vibrationData = selectedEntity.vibrationHistory;
        if (vibrationData.length < 2) return;
        
        // 振動レベルの折れ線グラフを描画
        ctx.strokeStyle = '#2196F3'; // 青色
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const dataLength = Math.min(vibrationData.length, 100);
        const step = width / (dataLength - 1);
        
        for (let i = 0; i < dataLength; i++) {
            const x = i * step;
            const y = height - (vibrationData[vibrationData.length - dataLength + i].level * height);
            
            if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
        }
        
                ctx.stroke();
                
        // 組織完全性の折れ線グラフを描画（過去の値は保存されていないので現在の値のみ表示）
        ctx.strokeStyle = '#4CAF50'; // 緑色
        ctx.lineWidth = 2;
                ctx.beginPath();
        
        const integrityY = height - (selectedEntity.tissueIntegrity * height);
        ctx.moveTo(0, integrityY);
        ctx.lineTo(width, integrityY);
        
                ctx.stroke();
                
        // 凡例を描画
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.fillText('振動レベル', 10, 15);
        ctx.fillText('組織完全性', 10, 30);
        
        // 凡例の色を表示
        ctx.fillStyle = '#2196F3';
        ctx.fillRect(80, 7, 20, 10);
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(80, 22, 20, 10);
    }
    
    function showGenomeDetails(entity) {
        if (!entity) return;
        
        const detailsDiv = document.getElementById('genome-details');
        detailsDiv.style.display = 'block';
        
        let html = `
            <h3>エンティティ #${entity.id} の詳細情報</h3>
            <div class="tab-container">
                <div class="tab active" onclick="switchTab(event, 'memory-tab')">記憶パターン</div>
                <div class="tab" onclick="switchTab(event, 'vibration-tab')">振動履歴</div>
                <div class="tab" onclick="switchTab(event, 'tissue-tab')">組織状態</div>
            </div>
            
            <div id="memory-tab" class="tab-content active">
                <h4>適応的記憶パターン (${entity.memory.adaptivePatterns.length}個)</h4>
                <div class="memory-list">
        `;
        
        // 記憶パターンの表示
        if (entity.memory.adaptivePatterns.length > 0) {
            entity.memory.adaptivePatterns.forEach((pattern, index) => {
                const successRateColor = getSuccessRateColor(pattern.successRate);
                html += `
                    <div class="memory-item">
                        <div class="memory-header">
                            <span class="memory-type">${getPatternTypeName(pattern.type)}</span>
                            <span class="memory-success" style="color: ${successRateColor}">成功率: ${(pattern.successRate * 100).toFixed(1)}%</span>
                        </div>
                        <div class="memory-details">
                            <div>強度: ${(pattern.strength * 100).toFixed(1)}%</div>
                            <div>使用回数: ${pattern.usageCount || 0}回</div>
                            <div>作成時期: ${Math.floor(pattern.createdAt || 0)}フレーム</div>
                            ${pattern.inherited ? '<div class="inherited-tag">継承</div>' : ''}
                            ${pattern.integrated ? '<div class="integrated-tag">統合</div>' : ''}
                        </div>
                    </div>
                `;
            });
        } else {
            html += '<div class="empty-message">記憶パターンはありません</div>';
        }
        
        html += `
                </div>
                
                <h4>共有記憶 (${entity.memory.sharedMemories.length}個)</h4>
                <div class="memory-list">
        `;
        
        // 共有記憶の表示
        if (entity.memory.sharedMemories.length > 0) {
            entity.memory.sharedMemories.forEach((memory, index) => {
                const relevanceColor = getRelevanceColor(memory.relevanceScore || 0.5);
                html += `
                    <div class="memory-item shared">
                        <div class="memory-header">
                            <span class="memory-type">${getPatternTypeName(memory.type)}</span>
                            <span class="memory-relevance" style="color: ${relevanceColor}">関連性: ${((memory.relevanceScore || 0.5) * 100).toFixed(1)}%</span>
                        </div>
                        <div class="memory-details">
                            <div>成功率: ${(memory.successRate * 100).toFixed(1)}%</div>
                            <div>強度: ${(memory.strength * 100).toFixed(1)}%</div>
                            <div>共有元: #${memory.sourceId}</div>
                            <div>共有時期: ${Math.floor(memory.sharedAt || 0)}フレーム</div>
                        </div>
                    </div>
                `;
            });
        } else {
            html += '<div class="empty-message">共有記憶はありません</div>';
        }
        
        html += `
                </div>
            </div>
            
            <div id="vibration-tab" class="tab-content">
                <h4>振動履歴</h4>
                <canvas id="detailed-vibration-graph" width="400" height="200"></canvas>
                <div class="vibration-stats">
                    <div>現在の振動レベル: ${(entity.internalState.oscillation * 100).toFixed(1)}%</div>
                    <div>累積振動ストレス: ${entity.cumulativeVibrationStress.toFixed(2)}</div>
                    <div>最適振動レベル: ${(entity.vibrationMemory.optimalOscillation * 100).toFixed(1)}%</div>
                </div>
            </div>
            
            <div id="tissue-tab" class="tab-content">
                <h4>組織状態</h4>
                <div class="tissue-stats">
                    <div class="stat-row">
                        <div class="stat-label">組織完全性:</div>
                        <div class="stat-value">
                            <div class="progress-bar large">
                                <div class="progress-fill" style="width: ${entity.tissueIntegrity * 100}%; background-color: ${getTissueIntegrityColor(entity.tissueIntegrity)}"></div>
                            </div>
                            ${(entity.tissueIntegrity * 100).toFixed(1)}%
                        </div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-label">修復能力:</div>
                        <div class="stat-value">
                            <div class="progress-bar large">
                                <div class="progress-fill" style="width: ${entity.repairCapacity * 100}%; background-color: ${getRepairCapacityColor(entity.repairCapacity)}"></div>
                            </div>
                            ${(entity.repairCapacity * 100).toFixed(1)}%
                        </div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-label">膜の健全性:</div>
                        <div class="stat-value">
                            <div class="progress-bar large">
                                <div class="progress-fill" style="width: ${calculateMembraneHealth(entity) * 100}%; background-color: ${getMembraneHealthColor(calculateMembraneHealth(entity))}"></div>
                            </div>
                            ${(calculateMembraneHealth(entity) * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>
                <div class="tissue-description">
                    <h5>組織状態の説明</h5>
                    <p>${getTissueStateDescription(entity)}</p>
                </div>
            </div>
            
            <button onclick="closeGenomeDetails()" class="close-button">閉じる</button>
        `;
        
        detailsDiv.innerHTML = html;
        
        // 詳細な振動グラフを描画
        setTimeout(() => {
            drawDetailedVibrationGraph(entity);
        }, 100);
    }
    
    // 膜の健全性を計算
    function calculateMembraneHealth(entity) {
        const permeabilityHealth = entity.membraneProperties.permeability / 1.0;
        const elasticityHealth = entity.membraneProperties.elasticity / 1.0;
        const thicknessHealth = entity.membraneProperties.thickness / 1.0;
        
        return (permeabilityHealth + elasticityHealth + thicknessHealth) / 3;
    }
    
    // 膜の健全性の色を取得
    function getMembraneHealthColor(health) {
        if (health > 0.8) return '#4CAF50'; // 健全 - 緑
        if (health > 0.6) return '#8BC34A'; // やや健全 - 薄緑
        if (health > 0.4) return '#FFC107'; // 中程度 - 黄色
        if (health > 0.2) return '#FF9800'; // 劣化 - オレンジ
        return '#F44336'; // 重度の劣化 - 赤
    }
    
    // 組織状態の説明を取得
    function getTissueStateDescription(entity) {
        const integrity = entity.tissueIntegrity;
        const repair = entity.repairCapacity;
        const stress = entity.cumulativeVibrationStress;
        
        if (integrity > 0.9) {
            return "組織は非常に健全な状態です。細胞膜の完全性が高く、外部からのストレスに対する耐性があります。";
        } else if (integrity > 0.7) {
            return "組織は健全な状態ですが、わずかな劣化の兆候が見られます。修復能力が高いため、現状では問題ありません。";
        } else if (integrity > 0.5) {
            if (repair > 0.7) {
                return "組織に中程度の劣化が見られますが、高い修復能力によって安定した状態を維持しています。";
            } else {
                return "組織に中程度の劣化が見られ、修復能力も低下しています。今後の振動ストレスに注意が必要です。";
            }
        } else if (integrity > 0.3) {
            if (stress > 50) {
                return "組織に重度の劣化が見られます。累積振動ストレスが高く、膜機能の低下が進行しています。生存が危ぶまれる状態です。";
            } else {
                return "組織に重度の劣化が見られますが、振動ストレスは比較的低いため、適切な環境下では回復の可能性があります。";
            }
        } else {
            return "組織は危機的な劣化状態にあります。膜機能がほぼ失われており、生存の可能性は非常に低いです。";
        }
    }
    
    // 詳細な振動グラフを描画
    function drawDetailedVibrationGraph(entity) {
        const canvas = document.getElementById('detailed-vibration-graph');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // キャンバスをクリア
        ctx.clearRect(0, 0, width, height);
        
        // 背景を描画
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, width, height);
        
        // グリッドを描画
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        
        // 横線
        for (let i = 0; i <= 5; i++) {
            const y = height - (height * (i / 5));
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            
            // 目盛りラベル
            ctx.fillStyle = '#888';
            ctx.font = '10px Arial';
            ctx.fillText((i * 0.2).toFixed(1), 5, y - 5);
        }
        
        // 振動履歴データを取得
        const vibrationData = entity.vibrationHistory;
        if (vibrationData.length < 2) return;
        
        // 振動レベルの折れ線グラフを描画
        ctx.strokeStyle = '#2196F3'; // 青色
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const dataLength = Math.min(vibrationData.length, 100);
        const step = width / (dataLength - 1);
        
        for (let i = 0; i < dataLength; i++) {
            const x = i * step;
            const y = height - (vibrationData[vibrationData.length - dataLength + i].level * height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // エネルギーレベルの折れ線グラフを描画
        ctx.strokeStyle = '#FF9800'; // オレンジ色
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < dataLength; i++) {
            const x = i * step;
            const y = height - (vibrationData[vibrationData.length - dataLength + i].energy * height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
        } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // 最適振動レベルの水平線を描画
        ctx.strokeStyle = '#4CAF50'; // 緑色
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]); // 点線
        ctx.beginPath();
        
        const optimalY = height - (entity.vibrationMemory.optimalOscillation * height);
        ctx.moveTo(0, optimalY);
        ctx.lineTo(width, optimalY);
        
        ctx.stroke();
        ctx.setLineDash([]); // 点線をリセット
        
        // 凡例を描画
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.fillText('振動レベル', 10, 15);
        ctx.fillText('エネルギー', 10, 30);
        ctx.fillText('最適振動', 10, 45);
        
        // 凡例の色を表示
        ctx.fillStyle = '#2196F3';
        ctx.fillRect(80, 7, 20, 10);
        ctx.fillStyle = '#FF9800';
        ctx.fillRect(80, 22, 20, 10);
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(80, 37, 20, 10);
    }
    
    // パターンタイプの名前を取得
    function getPatternTypeName(type) {
        switch (type) {
            case 'vibration': return '振動パターン';
            case 'membrane': return '膜パターン';
            case 'movement': return '移動パターン';
            default: return 'その他';
        }
    }
    
    // 成功率の色を取得
    function getSuccessRateColor(rate) {
        if (rate > 0.8) return '#4CAF50'; // 高成功率 - 緑
        if (rate > 0.6) return '#8BC34A'; // やや高い成功率 - 薄緑
        if (rate > 0.4) return '#FFC107'; // 中程度の成功率 - 黄色
        if (rate > 0.2) return '#FF9800'; // 低い成功率 - オレンジ
        return '#F44336'; // 非常に低い成功率 - 赤
    }
    
    // 関連性の色を取得
    function getRelevanceColor(relevance) {
        if (relevance > 0.8) return '#4CAF50'; // 高関連性 - 緑
        if (relevance > 0.6) return '#8BC34A'; // やや高い関連性 - 薄緑
        if (relevance > 0.4) return '#FFC107'; // 中程度の関連性 - 黄色
        return '#FF9800'; // 低い関連性 - オレンジ
    }
    
    // タブの切り替え
    function switchTab(event, tabId) {
        // すべてのタブコンテンツを非表示
        const tabContents = document.getElementsByClassName('tab-content');
        for (let i = 0; i < tabContents.length; i++) {
            tabContents[i].classList.remove('active');
        }
        
        // すべてのタブを非アクティブ
        const tabs = document.getElementsByClassName('tab');
        for (let i = 0; i < tabs.length; i++) {
            tabs[i].classList.remove('active');
        }
        
        // クリックされたタブをアクティブに
        event.currentTarget.classList.add('active');
        
        // 対応するコンテンツを表示
        document.getElementById(tabId).classList.add('active');
        
        // 振動タブが選択された場合、グラフを再描画
        if (tabId === 'vibration-tab') {
            setTimeout(() => {
                drawDetailedVibrationGraph(selectedEntity);
            }, 10);
        }
    }
    
    // 詳細表示を閉じる
    function closeGenomeDetails() {
        document.getElementById('genome-details').style.display = 'none';
    }
}); 