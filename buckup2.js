document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    // 幅と高さの比率を1:1に近づける（正方形のグリッドになるように）
    const width = 160;
    const height = 90;
    
    // ASCII文字のセット - 単純に密度を表現
    const asciiChars = '▓▒░+*·';
    
    // 最小限のシミュレーションパラメータ
    const initialEntityCount = 1;
    const maxEntities = 400;
    const baseEnergyDecay = 0.0005;  // エネルギー消費を抑制
    const DIVISION_ENERGY_THRESHOLD = 0.6;  // 分裂に必要なエネルギー閾値を0.8から0.6に減少
    const DIVISION_PROBABILITY = 0.1;      // 分裂確率を0.05から0.1に増加
    const DIVISION_COOLDOWN = 50;          // 分裂後のクールダウン期間を150から50に短縮
    
    // 時間変数
    let time = 0;
    
    // グローバル変数としてシステム全体のエネルギー総量を定義
    const TOTAL_SYSTEM_ENERGY = 2000;  // 任意の単位
    
    // Entityクラス - 抽象的な「実体」として再定義
    class Entity {
        constructor(x, y, attributes = null) {
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
            
            // 基本属性 - より抽象的なパラメータへ
            this.attributes = attributes || {
                // センサー感度 - 環境変化の検知能力
                sensorSensitivity: Math.random(),
                
                // エネルギー変換率 - 環境からエネルギーを得る効率
                energyConversion: Math.random(),
                
                // 運動効率 - 動くためのエネルギー効率
                movementEfficiency: Math.random(),
                
                // 反応速度 - 環境変化への対応速度
                responseRate: Math.random(),
                
                // 構造強度 - 物理的耐久性
                structuralIntegrity: Math.random()
            };
            
            // エネルギーと状態
            this.energy = 0.5 + Math.random() * 0.5;
            this.age = 0;
            this.isActive = true;
            this.density = 0.1 + Math.random() * 0.9; // 密度（表示サイズに影響）
            
            // 新しい情報交換関連の属性を追加
            this.signals = {
                presence: 0.5 + Math.random() * 0.5,  // 存在のシグナル強度
                boundary: 0.3 + Math.random() * 0.7   // 境界のシグナル強度
            };
            
            // 内部状態の保存（記憶）
            this.memory = {
                signalGradients: {},     // 各シグナルタイプの勾配
                lastPosition: {...this.position},  // 前回の位置
                signalHistory: {},        // シグナル履歴
                sensedEntities: []        // 検知した実体を記憶
            };
            
            // Entityクラスに追加する属性
            this.wonder = {
                curiosity: Math.random(),  // 好奇心の強さ
                explorationMap: {},        // 探索済みの領域を記録
                noveltyThreshold: 0.3 + Math.random() * 0.4,  // 新奇性の閾値
                lastNoveltyEncounter: 0    // 最後に新奇なものに遭遇した時間
            };
            
            // Entityクラスのコンストラクタ内に追加
            this.genome = {
                // メタデータ
                meta: {
                    version: 1,                    // 遺伝子構造のバージョン
                    creationTime: time,           // 作成時刻
                    parentId: null,               // 親のID（分裂/複製時に設定）
                    mutations: [],                // 変異履歴
                    generation: 0                 // 世代数
                },
                
                // コア遺伝子（基本属性を制御）
                core: {
                    sequence: this.generateCoreGenome(), // 常に新しいコア遺伝子を生成
                    expression: null              // デコード後の属性値
                },
                
                // 制御遺伝子（遺伝子発現の制御）
                regulatory: {
                    // 発現制御配列
                    promoters: this.generatePromoters(),     // 発現を促進
                    inhibitors: this.generateInhibitors(),   // 発現を抑制
                    
                    // 環境応答配列
                    environmentalResponses: this.generateEnvironmentalResponses(),
                    
                    // 相互作用制御配列
                    interactionControls: this.generateInteractionControls()
                },
                
                // 防御遺伝子（免疫系と防御機構）
                defense: {
                    // パターン認識配列
                    patternRecognition: this.generatePatternRecognition(),
                    
                    // 免疫応答配列
                    immuneResponse: this.generateImmuneResponse(),
                    
                    // 修復機構配列
                    repair: this.generateRepairSequence()
                },
                
                // 行動遺伝子（行動パターンの制御）
                behavior: {
                    // 基本行動パターン
                    movement: this.generateMovementPattern(),
                    
                    // 社会的行動パターン
                    social: this.generateSocialPattern(),
                    
                    // 探索行動パターン
                    exploration: this.generateExplorationPattern()
                }
            };
            
            // Entityクラスに追加する新しい属性
            this.communication = {
                // 発信関連
                transmission: {
                    energy: 0,          // 発信するエネルギー量
                    geneSequence: null, // 発信する遺伝子配列
                    signals: {          // 各種シグナル
                        presence: 0,    // 存在シグナル
                        boundary: 0,    // 境界シグナル
                        geneShare: 0    // 遺伝子共有意思
                    }
                },
                
                // 受信関連
                reception: {
                    buffer: [],        // 受信バッファ
                    threshold: 0.3,    // 受信閾値
                    filters: {         // 受信フィルター
                        energy: true,
                        genes: true,
                        signals: true
                    }
                },
                
                // メモリ関連
                memory: {
                    geneArchive: [],   // 受信した遺伝子のアーカイブ
                    interactions: [],   // 相互作用履歴
                    successRate: {}    // 交換成功率の記録
                },
                
                // ブロックリスト
                blocking: {
                    // ブロックリスト
                    blockedEntities: new Map(),  // key: entityId, value: {reason: string, timestamp: number}
                    
                    // ブロック条件
                    conditions: {
                        // エネルギー搾取検知
                        energyTheft: {
                            threshold: 0.3,        // エネルギー搾取の閾値
                            duration: 200          // ブロック継続時間
                        },
                        
                        // 有害な遺伝子検知
                        harmfulGenes: {
                            threshold: -0.2,       // 有害度の閾値
                            duration: 300          // ブロック継続時間
                        },
                        
                        // スパムシグナル検知
                        signalSpam: {
                            threshold: 10,         // 単位時間あたりの最大シグナル数
                            duration: 100          // ブロック継続時間
                        }
                    },
                    
                    // 免疫記憶
                    immunity: {
                        patterns: new Map(),      // 有害パターンの記憶
                        threshold: 0.7            // 免疫反応の閾値
                    }
                }
            };
        }
        
        // 既存のinteractメソッドを維持しながら、情報交換の概念を追加
        interact(entities, environment) {
            let forces = { x: 0, y: 0 };
            
            // 他の実体を感知
            this.senseEntities(entities);
            
            // boidモデルによる力を計算
            const boidForces = this.calculateBoidForces();
            forces.x += boidForces.x;
            forces.y += boidForces.y;
            
            // エネルギー交換を実行
            this.exchangeEnergy(entities);
            
            // 他の実体への反応
            const entityForces = this.reactToEntities();
            forces.x += entityForces.x;
            forces.y += entityForces.y;
            
            // 境界処理
            this.enforceBoundaries(forces);
            
            return forces;
        }
        
        // boidモデルの力を計算
        calculateBoidForces() {
            if (!this.memory.sensedEntities || this.memory.sensedEntities.length === 0) {
                return { x: 0, y: 0 };
            }

            const forces = { x: 0, y: 0 };
            const cohesion = { x: 0, y: 0 };
            const alignment = { x: 0, y: 0 };
            const separation = { x: 0, y: 0 };
            
            let totalWeight = 0;
            let separationCount = 0;

            for (const sensed of this.memory.sensedEntities) {
                const other = sensed.entity;
                const similarity = this.calculateGeneticSimilarity(other);
                
                // 遺伝的類似度が高いほど強く影響
                const weight = Math.pow(similarity, 2);
                
                // 結合（中心に向かう力）
                cohesion.x += other.position.x * weight;
                cohesion.y += other.position.y * weight;
                
                // 整列（同じ方向に向かう力）
                alignment.x += other.velocity.x * weight;
                alignment.y += other.velocity.y * weight;
                
                // 分離（近すぎる個体から離れる力）
                if (sensed.distance < 5) {
                    const repulsionStrength = (5 - sensed.distance) / 5;
                    separation.x += sensed.direction.x * repulsionStrength;
                    separation.y += sensed.direction.y * repulsionStrength;
                    separationCount++;
                }
                
                totalWeight += weight;
            }

            // 結合力の正規化と適用
            if (totalWeight > 0) {
                const cohesionStrength = 0.01;
                forces.x += (cohesion.x / totalWeight - this.position.x) * cohesionStrength;
                forces.y += (cohesion.y / totalWeight - this.position.y) * cohesionStrength;
                
                // 整列力の正規化と適用
                const alignmentStrength = 0.05;
                forces.x += (alignment.x / totalWeight) * alignmentStrength;
                forces.y += (alignment.y / totalWeight) * alignmentStrength;
            }

            // 分離力の適用
            if (separationCount > 0) {
                const separationStrength = 0.1;
                forces.x -= separation.x * separationStrength / separationCount;
                forces.y -= separation.y * separationStrength / separationCount;
            }

            return forces;
        }
        
        // 新しいシグナル受信メソッド
        receiveSignal(sourcePosition, signalType, intensity) {
            const dx = sourcePosition.x - this.position.x;
            const dy = sourcePosition.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 距離による減衰
            const attenuatedIntensity = intensity / (1 + distance * distance);
            
            // シグナル履歴の初期化
            if (!this.memory.signalHistory[signalType]) {
                this.memory.signalHistory[signalType] = [];
            }
            
            // シグナルと方向の記録
            this.memory.signalHistory[signalType].push({
                intensity: attenuatedIntensity,
                direction: {
                    x: dx / Math.max(0.001, distance),
                    y: dy / Math.max(0.001, distance)
                },
                time: time
            });
            
            // 古いシグナルの削除（メモリ制限）
            const memoryDuration = 10; // 記憶する時間
            this.memory.signalHistory[signalType] = 
                this.memory.signalHistory[signalType].filter(s => time - s.time < memoryDuration);
            
            // シグナル勾配の更新
            this.updateSignalGradient(signalType);
        }
        
        // シグナル勾配の更新
        updateSignalGradient(signalType) {
            if (!this.memory.signalHistory[signalType] || 
                this.memory.signalHistory[signalType].length === 0) {
                return;
            }
            
            let gradX = 0, gradY = 0, totalIntensity = 0;
            
            for (const signal of this.memory.signalHistory[signalType]) {
                gradX += signal.direction.x * signal.intensity;
                gradY += signal.direction.y * signal.intensity;
                totalIntensity += signal.intensity;
            }
            
            // 勾配の正規化
            this.memory.signalGradients[signalType] = {
                x: totalIntensity > 0 ? gradX / totalIntensity : 0,
                y: totalIntensity > 0 ? gradY / totalIntensity : 0,
                intensity: totalIntensity / this.memory.signalHistory[signalType].length
            };
        }
        
        // シグナル勾配に基づく力の計算
        processSignalGradients() {
            const forces = { x: 0, y: 0 };
            
            // 存在シグナルへの反応（混雑回避）
            if (this.memory.signalGradients.presence) {
                const grad = this.memory.signalGradients.presence;
                const repulsionStrength = 0.01 * this.attributes.responseRate;
                
                forces.x -= grad.x * repulsionStrength * grad.intensity;
                forces.y -= grad.y * repulsionStrength * grad.intensity;
            }
            
            // 境界シグナルへの反応
            if (this.memory.signalGradients.boundary) {
                const grad = this.memory.signalGradients.boundary;
                const boundaryStrength = 0.02 * this.signals.boundary;
                
                // 強い境界からは離れる
                if (grad.intensity > this.signals.boundary) {
                    forces.x -= grad.x * boundaryStrength;
                    forces.y -= grad.y * boundaryStrength;
                }
            }
            
            return forces;
        }
        
        // 揺らぎの追加
        addBrownianMotion() {
            // エネルギーレベルと相関する揺らぎの強さ
            const brownianStrength = 0.01 * (1 - this.energy * 0.5);
            
            return {
                x: (Math.random() - 0.5) * brownianStrength,
                y: (Math.random() - 0.5) * brownianStrength
            };
        }
        
        // エネルギー処理のメソッドを追加
        processEnergy(environment, subjectiveTimeScale = 1.0) {
            // 基本的なエネルギー消費
            const baseCost = baseEnergyDecay * (1 - this.attributes.movementEfficiency * 0.5) * subjectiveTimeScale;
            this.energy -= baseCost;
            
            // 消費したエネルギーを環境に戻す（熱として）
            environment.returnEnergyAt(this.position, baseCost);
            
            // シグナル処理によるエネルギー消費を最小化
            const signalProcessingCost = 0.00005 * 
                Object.keys(this.memory.signalHistory).reduce((sum, key) => 
                    sum + this.memory.signalHistory[key].length, 0) * subjectiveTimeScale;
            
            this.energy -= signalProcessingCost;
            environment.returnEnergyAt(this.position, signalProcessingCost);
            
            // 環境からのエネルギー獲得（最大獲得可能量を計算）
            const maxExtractableEnergy = 0.02 * this.attributes.energyConversion * subjectiveTimeScale;
            
            // 環境から実際にエネルギーを取得（利用可能量に制限される）
            const gainedEnergy = environment.getEnergyAt(this.position, time, maxExtractableEnergy);
            this.energy += gainedEnergy;
            
            // エネルギー上限
            this.energy = Math.min(this.energy, 1.0);
        }
        
        // 既存のupdateメソッドに統合
        update(entities, environment, subjectiveTimeScale = 1.0) {
            if (!this.isActive) return;
            
            // 年齢の更新
            this.age += subjectiveTimeScale;
            
            // エネルギー処理
            this.processEnergy(environment, subjectiveTimeScale);
            
            // 相互作用による力
            const forces = this.interact(entities, environment);
            
            // ワンダーモジュールによる力を追加
            const wonderForces = this.processWonder(environment);
            forces.x += wonderForces.x;
            forces.y += wonderForces.y;
            
            // ブラウン運動による揺らぎ
            const brownian = this.addBrownianMotion();
            
            // 速度の更新（物理的力＋情報的力＋揺らぎ）
            this.velocity.x += forces.x * subjectiveTimeScale + brownian.x;
            this.velocity.y += forces.y * subjectiveTimeScale + brownian.y;
            
            // 速度の減衰
            const friction = 0.95;
            this.velocity.x *= Math.pow(friction, subjectiveTimeScale);
            this.velocity.y *= Math.pow(friction, subjectiveTimeScale);
            
            // 位置の更新
            this.position.x += this.velocity.x * subjectiveTimeScale;
            this.position.y += this.velocity.y * subjectiveTimeScale;
            
            // シグナル強度の更新
            this.signals.presence = 0.3 + this.energy * 0.7;  // エネルギーが高いほど存在感が強い
            this.signals.boundary = Math.min(1.0, 0.2 + this.density * 0.8);  // 密度が高いほど境界が強い
            
            // 繁殖判定
            if (this.energy > DIVISION_ENERGY_THRESHOLD && Math.random() < DIVISION_PROBABILITY * subjectiveTimeScale) {
                this.divide(entities);
            }
            
            // 活性状態の更新
            if (this.energy <= 0 || this.age > 1000) {
                // 死亡時に残りのエネルギーを環境に戻す
                environment.returnEnergyAt(this.position, this.energy);
                this.energy = 0;
                this.isActive = false;
            }
            
            // 前回位置を記録
            this.memory.lastPosition = {...this.position};
        }
        
        // 境界処理のメソッドを追加
        enforceBoundaries(forces) {
            const margin = 5;
            const boundaryForce = 0.05;
            
            // X軸の境界
            if (this.position.x < margin) {
                forces.x += boundaryForce;
            } else if (this.position.x > width - margin) {
                forces.x -= boundaryForce;
            }
            
            // Y軸の境界
            if (this.position.y < margin) {
                forces.y += boundaryForce;
            } else if (this.position.y > height - margin) {
                forces.y -= boundaryForce;
            }
        }
        
        // 分裂（複製）メソッドを修正
        divide(entities) {
            if (entities.length >= maxEntities) return;
            
            // 分裂によるエネルギーを均等に分配
            const splitEnergy = this.energy * 0.3;  // エネルギー消費を0.5から0.3に減少
            this.energy = this.energy - splitEnergy;  // 親は70%のエネルギーを保持
            
            // 親の近くにランダムな位置を設定
            const offset = 2;
            const childX = this.position.x + (Math.random() - 0.5) * offset;
            const childY = this.position.y + (Math.random() - 0.5) * offset;
            
            // 新しいエンティティを作成
            const child = new Entity(
                childX,
                childY,
                this.attributes
            );
            
            // 子エンティティの遺伝子を設定（新しい遺伝子構造に対応）
            child.genome = {
                meta: {
                    version: this.genome.meta.version,
                    creationTime: time,
                    parentId: this.genome.meta.id,
                    mutations: [],
                    generation: this.genome.meta.generation + 1
                },
                core: {
                    sequence: this.mutateGenome([...this.genome.core.sequence]),
                    expression: null
                },
                regulatory: {
                    promoters: {...this.genome.regulatory.promoters},
                    inhibitors: {...this.genome.regulatory.inhibitors},
                    environmentalResponses: {...this.genome.regulatory.environmentalResponses},
                    interactionControls: {...this.genome.regulatory.interactionControls}
                },
                defense: {
                    patternRecognition: {...this.genome.defense.patternRecognition},
                    immuneResponse: {...this.genome.defense.immuneResponse},
                    repair: {...this.genome.defense.repair}
                },
                behavior: {
                    movement: {...this.genome.behavior.movement},
                    social: {...this.genome.behavior.social},
                    exploration: {...this.genome.behavior.exploration}
                }
            };
            
            // 子エンティティの初期エネルギーを設定
            child.energy = splitEnergy;
            
            // シグナル値も遺伝子から生成
            child.signals = {
                presence: 0.3 + child.attributes.responseRate * 0.7,
                boundary: 0.2 + child.attributes.structuralIntegrity * 0.8
            };
            
            // 親の速度を基にした初期速度
            child.velocity = {
                x: this.velocity.x * 0.8 + (Math.random() - 0.5) * 0.2,
                y: this.velocity.y * 0.8 + (Math.random() - 0.5) * 0.2
            };
            
            // エンティティリストに追加
            entities.push(child);
        }
        
        // 新しいメソッド: ワンダーモジュールの処理
        processWonder(environment) {
            const forces = { x: 0, y: 0, z: 0 };
            
            // 1. 未探索領域への引力
            const currentCell = `${Math.floor(this.position.x)},${Math.floor(this.position.y)}`;
            this.wonder.explorationMap[currentCell] = (this.wonder.explorationMap[currentCell] || 0) + 1;
            
            // 周囲のセルの探索状況を確認
            const radius = 5;
            let leastExploredDir = { x: 0, y: 0, z: 0 };
            let minExplorationCount = Infinity;
            let equallyLeastExploredDirs = [];
            
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    const cell = `${Math.floor(this.position.x + dx)},${Math.floor(this.position.y + dy)}`;
                    const explorationCount = this.wonder.explorationMap[cell] || 0;
                    
                    if (explorationCount < minExplorationCount) {
                        minExplorationCount = explorationCount;
                        equallyLeastExploredDirs = [{ 
                            x: dx / Math.max(1, Math.abs(dx)) || 0, 
                            y: dy / Math.max(1, Math.abs(dy)) || 0,
                            z: 0
                        }];
                    } else if (explorationCount === minExplorationCount) {
                        // 同じ訪問回数の場合、候補に追加
                        equallyLeastExploredDirs.push({ 
                            x: dx / Math.max(1, Math.abs(dx)) || 0, 
                            y: dy / Math.max(1, Math.abs(dy)) || 0,
                            z: 0
                        });
                    }
                }
            }
            
            // 同じ訪問回数の候補からランダムに選択
            if (equallyLeastExploredDirs.length > 0) {
                const randomIndex = Math.floor(Math.random() * equallyLeastExploredDirs.length);
                leastExploredDir = equallyLeastExploredDirs[randomIndex];
            }
            
            // 未探索領域への引力を計算
            const explorationStrength = 0.02 * this.wonder.curiosity;
            forces.x += leastExploredDir.x * explorationStrength;
            forces.y += leastExploredDir.y * explorationStrength;
            
            // 2. 環境の変化への反応
            // 環境エネルギーの勾配を検出し、変化が大きい方向に引き寄せられる
            const cellSize = 1;
            const energyHere = environment.getEnergyAt(this.position, time, 0);
            
            const directions = [
                {dx: cellSize, dy: 0, dz: 0},
                {dx: -cellSize, dy: 0, dz: 0},
                {dx: 0, dy: cellSize, dz: 0},
                {dx: 0, dy: -cellSize, dz: 0}
            ];
            
            let maxGradient = 0;
            let gradientDir = { x: 0, y: 0, z: 0 };
            
            for (const dir of directions) {
                const checkPos = {
                    x: this.position.x + dir.dx,
                    y: this.position.y + dir.dy,
                    z: this.position.z + dir.dz
                };
                
                const energyThere = environment.getEnergyAt(checkPos, time, 0);
                const gradient = Math.abs(energyThere - energyHere);
                
                if (gradient > maxGradient) {
                    maxGradient = gradient;
                    gradientDir = { x: dir.dx, y: dir.dy, z: dir.dz };
                }
            }
            
            // 変化が閾値を超えた場合、その方向に引き寄せられる
            if (maxGradient > this.wonder.noveltyThreshold) {
                const noveltyStrength = 0.03 * this.wonder.curiosity;
                forces.x += gradientDir.x * noveltyStrength;
                forces.y += gradientDir.y * noveltyStrength;
                this.wonder.lastNoveltyEncounter = time;
            }
            
            // 長時間新奇なものに遭遇していない場合、ランダム探索を強化
            const timeSinceNovelty = time - this.wonder.lastNoveltyEncounter;
            if (timeSinceNovelty > 50) {
                const randomExplorationStrength = 0.01 * Math.min(5, timeSinceNovelty / 10);
                forces.x += (Math.random() - 0.5) * randomExplorationStrength;
                forces.y += (Math.random() - 0.5) * randomExplorationStrength;
            }
            
            return forces;
        }
        
        // Entityクラスに追加するメソッド
        senseEntities(entities) {
            const sensedEntities = [];
            
            for (const other of entities) {
                if (other === this || !other.isActive) continue;
                
                // 距離の計算
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // センサー感度に基づく検知範囲
                const detectionRange = 15 * this.attributes.sensorSensitivity;
                
                if (distance < detectionRange) {
                    // 他者のエネルギー情報を含めて記録
                    sensedEntities.push({
                        entity: other,
                        distance: distance,
                        direction: {
                            x: dx / Math.max(0.001, distance),
                            y: dy / Math.max(0.001, distance)
                        },
                        perceivedEnergy: other.energy * (1 - distance / detectionRange) // 距離による減衰
                    });
                }
            }
            
            // 検知した実体を記憶に保存
            this.memory.sensedEntities = sensedEntities;
            
            return sensedEntities;
        }
        
        // エネルギー交換メソッドの修正
        exchangeEnergy(entities) {
            if (!this.memory.sensedEntities || this.memory.sensedEntities.length === 0) return;
            
            // エネルギー交換の総量（この実体が交換できる最大量）
            const maxExchangeAmount = 0.05 * this.energy;
            
            // 各検知実体との交換を試みる
            for (const sensed of this.memory.sensedEntities) {
                const other = sensed.entity;
                
                // 遺伝的類似度を計算
                const similarity = this.calculateGeneticSimilarity(other);
                
                // エネルギー状態の差異
                const energyDiff = this.energy - other.energy;
                const efficiencyDiff = this.attributes.energyConversion - other.attributes.energyConversion;
                
                // 基本的な相互作用の強さ（-1から1の範囲）
                // 類似度が高いほど、エネルギー差に基づく自然な均衡化が起きやすい
                const baseInteraction = -Math.sign(energyDiff) * similarity;
                
                // 効率差による影響（効率の良い方が得をする傾向）
                const efficiencyEffect = Math.sign(efficiencyDiff) * Math.abs(efficiencyDiff) * (1 - similarity);
                
                // 最終的な交換方向の決定
                const exchangeDirection = baseInteraction + efficiencyEffect;
                
                // 距離による減衰
                const distanceFactor = 1 - sensed.distance / (15 * this.attributes.sensorSensitivity);
                
                // 実際の交換量を計算
                const exchangeAmount = maxExchangeAmount * exchangeDirection * distanceFactor;
                
                // 相互作用タイプの判定（事後的な分類）
                const interactionType = this.classifyInteraction(exchangeDirection, similarity, efficiencyDiff);
                
                // エネルギー交換の実行
                if (exchangeAmount > 0) {
                    const actualGain = Math.min(exchangeAmount, other.energy * 0.2);
                    this.energy += actualGain;
                    other.energy -= actualGain;
                    
                    // 相互作用の記憶
                    this.recordInteraction(interactionType, 'gain', other, actualGain, similarity);
                } else if (exchangeAmount < 0) {
                    const actualLoss = Math.min(-exchangeAmount, this.energy * 0.2);
                    this.energy -= actualLoss;
                    other.energy += actualLoss;
                    
                    // 相互作用の記憶
                    this.recordInteraction(interactionType, 'give', other, actualLoss, similarity);
                }
            }
        }
        
        // 相互作用の記録
        recordInteraction(type, direction, target, details) {
            this.communication.memory.interactions.push({
                type: type,
                direction: direction,
                target: target,
                details: details,
                timestamp: time,
                success: true
            });
            
            // 成功率の更新
            const key = `${type}_${direction}`;
            if (!this.communication.memory.successRate[key]) {
                this.communication.memory.successRate[key] = {
                    success: 0,
                    total: 0
                };
            }
            
            this.communication.memory.successRate[key].total++;
            this.communication.memory.successRate[key].success++;
        }
        
        // 相互作用の事後的な分類（観察のため）
        classifyInteraction(exchangeDirection, similarity, efficiencyDiff) {
            // 交換の方向と強さから相互作用を分類
            const absExchange = Math.abs(exchangeDirection);
            
            if (absExchange < 0.1) {
                return 'neutral';  // ほとんど相互作用なし
            } else if (similarity > 0.6 && Math.sign(exchangeDirection) === -Math.sign(efficiencyDiff)) {
                return 'cooperation';  // 効率差を補完するような交換
            } else if (Math.sign(exchangeDirection) === Math.sign(efficiencyDiff)) {
                return 'parasitism';  // 効率差を拡大するような交換
            } else {
                return 'competition';  // その他の競争的な交換
            }
        }
        
        // 遺伝的類似度を計算
        calculateGeneticSimilarity(other) {
            if (!this.genome || !other.genome || !this.genome.core || !other.genome.core) return 0;
            
            const mySequence = this.genome.core.sequence;
            const otherSequence = other.genome.core.sequence;
            
            if (!mySequence || !otherSequence) return 0;
            
            // コア遺伝子の類似度（基本属性）
            const coreSimilarity = this.calculateSegmentSimilarity(
                mySequence,
                otherSequence
            );
            
            // 制御遺伝子の類似度
            const regulatorySimilarity = this.calculateRegulatorySimilarity(
                this.genome.regulatory,
                other.genome.regulatory
            );
            
            // 防御遺伝子の類似度
            const defenseSimilarity = this.calculateDefenseSimilarity(
                this.genome.defense,
                other.genome.defense
            );
            
            // 行動遺伝子の類似度
            const behaviorSimilarity = this.calculateBehaviorSimilarity(
                this.genome.behavior,
                other.genome.behavior
            );
            
            // 重み付けされた総合的な類似度
            return (
                coreSimilarity * 0.4 +          // コア遺伝子の重要性を高く
                regulatorySimilarity * 0.2 +    // 制御遺伝子
                defenseSimilarity * 0.2 +       // 防御遺伝子
                behaviorSimilarity * 0.2        // 行動遺伝子
            );
        }
        
        // 制御遺伝子の類似度を計算
        calculateRegulatorySimilarity(myRegulatory, otherRegulatory) {
            if (!myRegulatory || !otherRegulatory) return 0;
            
            const promoterSimilarity = this.calculateObjectSimilarity(
                myRegulatory.promoters,
                otherRegulatory.promoters
            );
            
            const inhibitorSimilarity = this.calculateObjectSimilarity(
                myRegulatory.inhibitors,
                otherRegulatory.inhibitors
            );
            
            const environmentalSimilarity = this.calculateObjectSimilarity(
                myRegulatory.environmentalResponses,
                otherRegulatory.environmentalResponses
            );
            
            const interactionSimilarity = this.calculateObjectSimilarity(
                myRegulatory.interactionControls,
                otherRegulatory.interactionControls
            );
            
            return (
                promoterSimilarity * 0.25 +
                inhibitorSimilarity * 0.25 +
                environmentalSimilarity * 0.25 +
                interactionSimilarity * 0.25
            );
        }
        
        // 防御遺伝子の類似度を計算
        calculateDefenseSimilarity(myDefense, otherDefense) {
            if (!myDefense || !otherDefense) return 0;
            
            const patternSimilarity = this.calculateObjectSimilarity(
                myDefense.patternRecognition,
                otherDefense.patternRecognition
            );
            
            const immuneSimilarity = this.calculateObjectSimilarity(
                myDefense.immuneResponse,
                otherDefense.immuneResponse
            );
            
            const repairSimilarity = this.calculateObjectSimilarity(
                myDefense.repair,
                otherDefense.repair
            );
            
            return (
                patternSimilarity * 0.4 +
                immuneSimilarity * 0.4 +
                repairSimilarity * 0.2
            );
        }
        
        // 行動遺伝子の類似度を計算
        calculateBehaviorSimilarity(myBehavior, otherBehavior) {
            if (!myBehavior || !otherBehavior) return 0;
            
            const movementSimilarity = this.calculateObjectSimilarity(
                myBehavior.movement,
                otherBehavior.movement
            );
            
            const socialSimilarity = this.calculateObjectSimilarity(
                myBehavior.social,
                otherBehavior.social
            );
            
            const explorationSimilarity = this.calculateObjectSimilarity(
                myBehavior.exploration,
                otherBehavior.exploration
            );
            
            return (
                movementSimilarity * 0.3 +
                socialSimilarity * 0.4 +
                explorationSimilarity * 0.3
            );
        }
        
        // オブジェクト内の配列の類似度を計算するヘルパーメソッド
        calculateObjectSimilarity(obj1, obj2) {
            if (!obj1 || !obj2) return 0;
            
            const keys = Object.keys(obj1);
            if (keys.length === 0) return 0;
            
            let totalSimilarity = 0;
            for (const key of keys) {
                if (obj1[key] && obj2[key]) {
                    totalSimilarity += this.calculateSegmentSimilarity(obj1[key], obj2[key]);
                }
            }
            
            return totalSimilarity / keys.length;
        }
        
        // 配列セグメント間の類似度を計算（既存のメソッド）
        calculateSegmentSimilarity(segment1, segment2) {
            if (!Array.isArray(segment1) || !Array.isArray(segment2)) return 0;
            
            const minLength = Math.min(segment1.length, segment2.length);
            let matchCount = 0;
            
            for (let i = 0; i < minLength; i++) {
                if (segment1[i] === segment2[i]) {
                    matchCount++;
                }
            }
            
            return matchCount / minLength;
        }
        
        // Entityクラスに追加するメソッド
        reactToEntities() {
            if (!this.memory.sensedEntities || this.memory.sensedEntities.length === 0) return { x: 0, y: 0 };
            
            const forces = { x: 0, y: 0 };
            
            // 過去の相互作用の記憶を分析
            const recentInteractions = (this.memory.interactions || [])
                .filter(i => time - i.time < 50); // 最近の相互作用のみ考慮
            
            // 各実体に対する態度を決定
            for (const sensed of this.memory.sensedEntities) {
                const other = sensed.entity;
                
                // この実体との過去の相互作用
                const interactionsWithThis = recentInteractions
                    .filter(i => i.target === other);
                
                // 過去の相互作用に基づく態度（-1: 回避、0: 中立、1: 接近）
                let attitude = 0;
                
                if (interactionsWithThis.length > 0) {
                    // 得たエネルギーと失ったエネルギーの合計
                    const gainedEnergy = interactionsWithThis
                        .filter(i => i.type === 'gain')
                        .reduce((sum, i) => sum + i.amount, 0);
                        
                    const lostEnergy = interactionsWithThis
                        .filter(i => i.type === 'give')
                        .reduce((sum, i) => sum + i.amount, 0);
                        
                    // 純利益に基づく態度
                    const netGain = gainedEnergy - lostEnergy;
                    attitude = netGain > 0 ? 1 : (netGain < 0 ? -1 : 0);
                } else {
                    // 過去の相互作用がない場合、エネルギーレベルに基づく判断
                    attitude = this.energy < 0.3 ? 1 : (sensed.perceivedEnergy > this.energy ? -1 : 0);
                }
                
                // 態度に基づく力の計算
                const forceMagnitude = 0.02 * this.attributes.responseRate;
                
                if (attitude > 0) {
                    // 接近（捕食または協力の可能性）
                    forces.x += sensed.direction.x * forceMagnitude;
                    forces.y += sensed.direction.y * forceMagnitude;
                } else if (attitude < 0) {
                    // 回避（危険または競争相手）
                    forces.x -= sensed.direction.x * forceMagnitude;
                    forces.y -= sensed.direction.y * forceMagnitude;
                }
            }
            
            return forces;
        }
        
        // バイナリ遺伝子を生成するメソッド
        generateRandomGenome() {
            const genomeLength = 120; // 各属性に24ビット割り当て（5属性 × 24ビット）
            const sequence = [];
            
            for (let i = 0; i < genomeLength; i++) {
                sequence.push(Math.random() < 0.5 ? 0 : 1);
            }
            
            return sequence;
        }
        
        // 属性をバイナリ遺伝子にエンコードするメソッド
        encodeAttributes(attributes) {
            const sequence = [];
            const attributeKeys = [
                'sensorSensitivity', 
                'energyConversion', 
                'movementEfficiency', 
                'responseRate', 
                'structuralIntegrity'
            ];
            
            // 各属性を24ビットのバイナリに変換
            for (const key of attributeKeys) {
                const value = attributes[key];
                const binaryValue = this.valueToBinary(value, 24);
                sequence.push(...binaryValue);
            }
            
            return sequence;
        }
        
        // 数値を指定ビット数のバイナリ配列に変換
        valueToBinary(value, bits) {
            const binaryArray = [];
            // 0-1の値を0-2^bits-1の整数に変換
            const intValue = Math.floor(value * ((1 << bits) - 1));
            
            for (let i = 0; i < bits; i++) {
                binaryArray.push((intValue >> i) & 1);
            }
            
            return binaryArray;
        }
        
        // バイナリ遺伝子を属性にデコードするメソッド
        decodeGenome(sequence) {
            const attributes = {};
            const attributeKeys = [
                'sensorSensitivity', 
                'energyConversion', 
                'movementEfficiency', 
                'responseRate', 
                'structuralIntegrity'
            ];
            
            // 各24ビットのセグメントを属性値にデコード
            for (let i = 0; i < attributeKeys.length; i++) {
                const start = i * 24;
                const segment = sequence.slice(start, start + 24);
                
                // 遺伝子が機能しているかチェック（例：特定のパターンが必要）
                const isFunctional = this.checkGeneFunctionality(segment);
                
                if (isFunctional) {
                    attributes[attributeKeys[i]] = this.binaryToValue(segment);
                } else {
                    // 機能していない場合は最小値を設定
                    attributes[attributeKeys[i]] = 0.01;
                }
            }
            
            return attributes;
        }
        
        // バイナリ配列を0-1の値に変換
        binaryToValue(binaryArray) {
            let intValue = 0;
            
            for (let i = 0; i < binaryArray.length; i++) {
                intValue |= binaryArray[i] << i;
            }
            
            // 整数値を0-1の範囲に正規化
            return intValue / ((1 << binaryArray.length) - 1);
        }
        
        // 遺伝子が機能しているかをチェック
        checkGeneFunctionality(segment) {
            // 例：開始コドンと終了コドンが正しいかチェック
            const startCodon = segment.slice(0, 3).join('');
            const endCodon = segment.slice(segment.length - 3).join('');
            
            // 開始コドンが"101"で終了コドンが"010"の場合に機能すると仮定
            return startCodon === "101" && endCodon === "010";
            
            // より複雑な条件も可能:
            // - 特定のパターンが必要
            // - 特定の位置のビットが特定の値である必要がある
            // - パリティチェックが成功する必要がある
        }
        
        // 遺伝子の変異を処理するメソッド
        mutateGenome(sequence) {
            const mutatedSequence = [...sequence];
            const genomeLength = sequence.length;
            
            // 1. 点変異（ビットフリップ）- 低確率で各ビットが反転
            for (let i = 0; i < genomeLength; i++) {
                if (Math.random() < 0.005) { // 0.5%の確率で変異
                    mutatedSequence[i] = 1 - mutatedSequence[i]; // 0→1, 1→0
                }
            }
            
            // 2. 挿入変異 - 低確率で新しいビットが挿入される
            if (Math.random() < 0.02 && genomeLength < 200) { // 2%の確率、最大長を制限
                const position = Math.floor(Math.random() * genomeLength);
                const newBit = Math.random() < 0.5 ? 0 : 1;
                mutatedSequence.splice(position, 0, newBit);
                // 長さを調整（最後のビットを削除）
                if (mutatedSequence.length > genomeLength) {
                    mutatedSequence.pop();
                }
            }
            
            // 3. 欠失変異 - 低確率でビットが削除される
            if (Math.random() < 0.02 && genomeLength > 60) { // 2%の確率、最小長を保証
                const position = Math.floor(Math.random() * genomeLength);
                mutatedSequence.splice(position, 1);
                // 長さを調整（末尾にランダムなビットを追加）
                if (mutatedSequence.length < genomeLength) {
                    mutatedSequence.push(Math.random() < 0.5 ? 0 : 1);
                }
            }
            
            // 4. 逆位変異 - 低確率で一部の配列が反転する
            if (Math.random() < 0.01) { // 1%の確率
                const length = Math.floor(Math.random() * 10) + 2; // 2-11ビットの長さ
                const start = Math.floor(Math.random() * (genomeLength - length));
                const segment = mutatedSequence.slice(start, start + length);
                segment.reverse();
                for (let i = 0; i < length; i++) {
                    mutatedSequence[start + i] = segment[i];
                }
            }
            
            // 5. 重複変異 - 低確率で一部の配列が複製される
            if (Math.random() < 0.01 && genomeLength < 180) { // 1%の確率、最大長を制限
                const length = Math.floor(Math.random() * 8) + 2; // 2-9ビットの長さ
                const start = Math.floor(Math.random() * (genomeLength - length));
                const segment = mutatedSequence.slice(start, start + length);
                const insertPosition = Math.floor(Math.random() * genomeLength);
                
                // 複製したセグメントを挿入
                mutatedSequence.splice(insertPosition, 0, ...segment);
                
                // 長さを調整（末尾から超過分を削除）
                if (mutatedSequence.length > genomeLength) {
                    mutatedSequence.splice(genomeLength, mutatedSequence.length - genomeLength);
                }
            }
            
            return mutatedSequence;
        }

        // エネルギー発信
        transmitEnergy(targetEntity, amount) {
            if (this.energy < amount) return false;
            
            this.communication.transmission.energy = amount;
            const success = targetEntity.receiveEnergy(this, amount);
            
            if (success) {
                this.energy -= amount;
                this.recordInteraction('energy', 'transmit', targetEntity, amount);
            }
            
            return success;
        }

        // 遺伝子情報の発信
        transmitGenes(targetEntity, geneType = 'full') {
            let geneSequence;
            
            switch(geneType) {
                case 'full':
                    geneSequence = this.genome.sequence;
                    break;
                case 'partial':
                    // ランダムな部分配列を選択
                    const start = Math.floor(Math.random() * this.genome.sequence.length / 2);
                    const length = Math.floor(Math.random() * (this.genome.sequence.length - start));
                    geneSequence = this.genome.sequence.slice(start, start + length);
                    break;
                case 'compressed':
                    geneSequence = this.compressGenes(this.genome.sequence);
                    break;
            }

            this.communication.transmission.geneSequence = geneSequence;
            const success = targetEntity.receiveGenes(this, geneSequence, geneType);
            
            if (success) {
                this.recordInteraction('genes', 'transmit', targetEntity, geneType);
            }
            
            return success;
        }

        // シグナルの発信
        transmitSignals() {
            const signals = {
                presence: 0.3 + this.energy * 0.7,
                boundary: Math.min(1.0, 0.2 + this.density * 0.8),
                geneShare: this.calculateGeneShareWillingness()
            };
            
            this.communication.transmission.signals = signals;
            return signals;
        }

        // 遺伝子共有意思の計算
        calculateGeneShareWillingness() {
            // エネルギー状態、年齢、過去の成功率などから計算
            const energyFactor = this.energy > 0.7 ? 0.8 : 0.2;
            const ageFactor = Math.min(1.0, this.age / 500);
            const successRate = this.getInteractionSuccessRate('genes');
            
            return (energyFactor + ageFactor + successRate) / 3;
        }

        // エネルギー受信
        receiveEnergy(sourceEntity, amount) {
            if (!this.communication.reception.filters.energy) return false;
            
            // 受入判断
            const willAccept = this.evaluateEnergyReception(sourceEntity, amount);
            
            if (willAccept) {
                this.energy += amount;
                this.recordInteraction('energy', 'receive', sourceEntity, amount);
                return true;
            }
            
            return false;
        }

        // 遺伝子情報の受信
        receiveGenes(sourceEntity, geneSequence, geneType) {
            if (!this.communication.reception.filters.genes) return false;
            
            // 受入判断
            const willAccept = this.evaluateGeneReception(sourceEntity, geneSequence);
            
            if (willAccept) {
                // 遺伝子の保存とポテンシャルな組み込み
                this.communication.memory.geneArchive.push({
                    source: sourceEntity,
                    sequence: geneSequence,
                    type: geneType,
                    timestamp: time,
                    potentialValue: this.evaluateGenePotential(geneSequence)
                });
                
                this.recordInteraction('genes', 'receive', sourceEntity, geneType);
                
                // 一定確率で遺伝子の組み込みを試行
                if (Math.random() < this.calculateGeneIntegrationProbability()) {
                    this.integrateReceivedGenes();
                }
                
                return true;
            }
            
            return false;
        }

        // シグナルの受信
        receiveSignals(sourceEntity, signals) {
            if (!this.communication.reception.filters.signals) return false;
            
            // シグナル強度の距離減衰を計算
            const distance = this.calculateDistance(sourceEntity);
            const attenuatedSignals = this.attenuateSignals(signals, distance);
            
            // バッファに追加
            this.communication.reception.buffer.push({
                source: sourceEntity,
                signals: attenuatedSignals,
                timestamp: time
            });
            
            return true;
        }

            // 受信した遺伝子の統合を試行
    integrateReceivedGenes() {
        const recentGenes = this.communication.memory.geneArchive
            .filter(g => time - g.timestamp < 100)
            .sort((a, b) => b.potentialValue - a.potentialValue);
        
        if (recentGenes.length === 0) return;
        
        const targetGene = recentGenes[0];
        const integrationSuccess = Math.random() < 
            (targetGene.potentialValue * this.attributes.sensorSensitivity);
        
        if (integrationSuccess) {
            // 遺伝子の部分的な組み込み
            const newSequence = this.integrateGeneSequence(
                this.genome.sequence,
                targetGene.sequence
            );
            
            // 新しい遺伝子の評価と適用
            const newAttributes = this.decodeGenome(newSequence);
            if (this.evaluateNewAttributes(newAttributes)) {
                this.genome.sequence = newSequence;
                this.attributes = newAttributes;
            }
        }
    }

    // 遺伝子配列の統合
    integrateGeneSequence(currentSequence, newSequence) {
        // ランダムな統合ポイントの選択
        const integrationPoint = Math.floor(Math.random() * currentSequence.length);
        const integrationLength = Math.min(
            newSequence.length,
            currentSequence.length - integrationPoint
        );
        
        // 新しい配列の作成
        const resultSequence = [...currentSequence];
        for (let i = 0; i < integrationLength; i++) {
            if (Math.random() < 0.5) { // 50%の確率で各ビットを統合
                resultSequence[integrationPoint + i] = newSequence[i];
            }
        }
        
        return resultSequence;
    }

    // 遺伝子のポテンシャル評価
    evaluateGenePotential(sequence) {
        const attributes = this.decodeGenome(sequence);
        let potential = 0;
        
        // 各属性の改善度を評価
        for (const key in attributes) {
            const improvement = attributes[key] - this.attributes[key];
            potential += improvement > 0 ? improvement : 0;
        }
        
        return Math.min(1.0, potential / Object.keys(attributes).length);
    }

        // 遺伝子の新しい属性評価
        evaluateNewAttributes(newAttributes) {
            // 実装が必要
            return true; // 仮実装
        }

        // シグナルの距離減衰を計算
        calculateDistance(sourceEntity) {
            const dx = this.position.x - sourceEntity.position.x;
            const dy = this.position.y - sourceEntity.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance;
        }

        // シグナルの減衰を計算
        attenuateSignals(signals, distance) {
            const attenuatedSignals = {
                presence: signals.presence * (1 - distance / 15),
                boundary: signals.boundary * (1 - distance / 15),
                geneShare: signals.geneShare * (1 - distance / 15)
            };
            return attenuatedSignals;
        }

        // 遺伝子の統合確率を計算
        calculateGeneIntegrationProbability() {
            // 実装が必要
            return 0.5; // 仮実装
        }

        // 相互作用成功率の取得
        getInteractionSuccessRate(type) {
            const transmitKey = `${type}_transmit`;
            const receiveKey = `${type}_receive`;
            
            const transmitRate = this.communication.memory.successRate[transmitKey];
            const receiveRate = this.communication.memory.successRate[receiveKey];
            
            if (!transmitRate || !receiveRate) return 0;
            
            const totalSuccess = transmitRate.success + receiveRate.success;
            const totalAttempts = transmitRate.total + receiveRate.total;
            
            return totalAttempts > 0 ? totalSuccess / totalAttempts : 0;
        }

        // ブロック判定と管理のメソッド
        isBlocked(sourceEntity) {
            const blockInfo = this.communication.blocking.blockedEntities.get(sourceEntity.id);
            if (!blockInfo) return false;
            
            // ブロック期間が終了していれば解除
            if (time - blockInfo.timestamp > this.communication.blocking.conditions[blockInfo.reason].duration) {
                this.communication.blocking.blockedEntities.delete(sourceEntity.id);
                return false;
            }
            
            return true;
        }

        // エネルギー搾取の検知
        detectEnergyTheft(sourceEntity, amount) {
            const recentInteractions = this.communication.memory.interactions
                .filter(i => i.target === sourceEntity && i.type === 'energy' && 
                        time - i.timestamp < 100);
            
            let netEnergyLoss = 0;
            for (const interaction of recentInteractions) {
                if (interaction.direction === 'give') {
                    netEnergyLoss += interaction.details;
                } else {
                    netEnergyLoss -= interaction.details;
                }
            }
            
            // 搾取判定
            if (netEnergyLoss > this.communication.blocking.conditions.energyTheft.threshold) {
                this.blockEntity(sourceEntity, 'energyTheft');
                return true;
            }
            
            return false;
        }

        // 有害な遺伝子の検知
        detectHarmfulGenes(sourceEntity, geneSequence) {
            // 遺伝子の評価
            const potentialImpact = this.evaluateGenePotential(geneSequence);
            
            // 有害判定
            if (potentialImpact < this.communication.blocking.conditions.harmfulGenes.threshold) {
                // 有害パターンを記憶
                this.recordHarmfulPattern(geneSequence);
                this.blockEntity(sourceEntity, 'harmfulGenes');
                return true;
            }
            
            return false;
        }

        // シグナルスパムの検知
        detectSignalSpam(sourceEntity) {
            const recentSignals = this.communication.reception.buffer
                .filter(s => s.source === sourceEntity && 
                        time - s.timestamp < 50).length;
            
            if (recentSignals > this.communication.blocking.conditions.signalSpam.threshold) {
                this.blockEntity(sourceEntity, 'signalSpam');
                return true;
            }
            
            return false;
        }

        // 有害パターンの記録と免疫記憶
        recordHarmfulPattern(geneSequence) {
            const pattern = this.extractPattern(geneSequence);
            const currentCount = this.communication.blocking.immunity.patterns.get(pattern) || 0;
            this.communication.blocking.immunity.patterns.set(pattern, currentCount + 1);
        }

        // 遺伝子パターンの抽出（特徴的な部分配列の抽出）
        extractPattern(geneSequence) {
            // 単純化のため、最初の24ビットを特徴として使用
            return geneSequence.slice(0, 24).join('');
        }

        // エンティティのブロック
        blockEntity(entity, reason) {
            this.communication.blocking.blockedEntities.set(entity.id, {
                reason: reason,
                timestamp: time
            });
            
            // ブロックイベントの記録
            this.recordInteraction('block', reason, entity, null);
        }

        // 受信メソッドの修正（既存のreceiveEnergyメソッドを更新）
        receiveEnergy(sourceEntity, amount) {
            // ブロック確認
            if (this.isBlocked(sourceEntity)) return false;
            
            // エネルギー搾取の検知
            if (this.detectEnergyTheft(sourceEntity, amount)) return false;
            
            // 既存の処理を継続
            if (!this.communication.reception.filters.energy) return false;
            
            const willAccept = this.evaluateEnergyReception(sourceEntity, amount);
            if (willAccept) {
                this.energy += amount;
                this.recordInteraction('energy', 'receive', sourceEntity, amount);
                return true;
            }
            
            return false;
        }

        // 遺伝子受信の修正（既存のreceiveGenesメソッドを更新）
        receiveGenes(sourceEntity, geneSequence, geneType) {
            // ブロック確認
            if (this.isBlocked(sourceEntity)) return false;
            
            // 有害遺伝子の検知
            if (this.detectHarmfulGenes(sourceEntity, geneSequence)) return false;
            
            // 免疫チェック
            const pattern = this.extractPattern(geneSequence);
            const immunityCount = this.communication.blocking.immunity.patterns.get(pattern) || 0;
            if (immunityCount > this.communication.blocking.immunity.threshold) {
                this.blockEntity(sourceEntity, 'harmfulGenes');
                return false;
            }
            
            // 既存の処理を継続
            // ... 以下既存のコード ...
        }

        // シグナル受信の修正（既存のreceiveSignalsメソッドを更新）
        receiveSignals(sourceEntity, signals) {
            // ブロック確認
            if (this.isBlocked(sourceEntity)) return false;
            
            // スパム検知
            if (this.detectSignalSpam(sourceEntity)) return false;
            
            // 既存の処理を継続
            // ... 以下既存のコード ...
        }

        // 新しい遺伝子生成メソッド群
        generateCoreGenome() {
            const sequence = new Array(120);
            
            // 開始コドン
            sequence[0] = 1; sequence[1] = 0; sequence[2] = 1;
            
            // 属性エンコード領域（各属性24ビット）
            for (let i = 3; i < 117; i++) {
                // より多くの1を生成して明るい色になるようにする
                sequence[i] = Math.random() < 0.7 ? 1 : 0;
            }
            
            // 終了コドン
            sequence[117] = 0; sequence[118] = 1; sequence[119] = 0;
            
            return sequence;
        }

        // プロモーター配列の生成
        generatePromoters() {
            return {
                energy: this.generateRegulatorSequence(16),     // エネルギー代謝制御
                growth: this.generateRegulatorSequence(16),     // 成長制御
                repair: this.generateRegulatorSequence(16)      // 修復制御
            };
        }

        // 抑制配列の生成
        generateInhibitors() {
            return {
                energy: this.generateRegulatorSequence(16),     // エネルギー制限
                division: this.generateRegulatorSequence(16),   // 分裂制限
                mutation: this.generateRegulatorSequence(16)    // 変異制限
            };
        }

        // 環境応答配列の生成
        generateEnvironmentalResponses() {
            return {
                stress: this.generateRegulatorSequence(24),     // ストレス応答
                resources: this.generateRegulatorSequence(24),  // 資源応答
                density: this.generateRegulatorSequence(24)     // 密度応答
            };
        }

        // 相互作用制御配列の生成
        generateInteractionControls() {
            return {
                cooperation: this.generateRegulatorSequence(24),  // 協力行動制御
                competition: this.generateRegulatorSequence(24),  // 競争行動制御
                defense: this.generateRegulatorSequence(24)       // 防御行動制御
            };
        }

        // パターン認識配列の生成
        generatePatternRecognition() {
            return {
                self: this.generateRegulatorSequence(32),       // 自己認識
                harmful: this.generateRegulatorSequence(32),    // 有害パターン認識
                beneficial: this.generateRegulatorSequence(32)  // 有益パターン認識
            };
        }

        // 免疫応答配列の生成
        generateImmuneResponse() {
            return {
                memory: this.generateRegulatorSequence(32),     // 免疫記憶
                response: this.generateRegulatorSequence(32),   // 応答パターン
                adaptation: this.generateRegulatorSequence(32)  // 適応パターン
            };
        }

        // 修復配列の生成
        generateRepairSequence() {
            return {
                errorCorrection: this.generateRegulatorSequence(24),  // エラー訂正
                damage: this.generateRegulatorSequence(24),           // ダメージ修復
                mutation: this.generateRegulatorSequence(24)          // 変異修復
            };
        }

        // 行動パターン配列の生成
        generateMovementPattern() {
            return {
                base: this.generateRegulatorSequence(24),       // 基本移動
                avoidance: this.generateRegulatorSequence(24),  // 回避行動
                approach: this.generateRegulatorSequence(24)    // 接近行動
            };
        }

        // 社会的行動パターン配列の生成
        generateSocialPattern() {
            return {
                grouping: this.generateRegulatorSequence(24),   // 群れ行動
                sharing: this.generateRegulatorSequence(24),    // 共有行動
                signaling: this.generateRegulatorSequence(24)   // シグナル行動
            };
        }

        // 探索パターン配列の生成
        generateExplorationPattern() {
            return {
                curiosity: this.generateRegulatorSequence(24),  // 好奇心行動
                memory: this.generateRegulatorSequence(24),     // 記憶ベース探索
                risk: this.generateRegulatorSequence(24)        // リスク評価
            };
        }

        // 制御配列生成のヘルパーメソッド
        generateRegulatorSequence(length) {
            const sequence = new Array(length);
            
            // 制御配列の特徴的なパターンを生成
            for (let i = 0; i < length; i++) {
                // パターンベースの生成（単純なランダムよりも構造化）
                if (i % 4 === 0) {
                    sequence[i] = 1;  // 制御ポイントをマーク
                } else if (i % 4 === 1) {
                    sequence[i] = Math.random() < 0.7 ? 1 : 0;  // 高確率で1
                } else if (i % 4 === 2) {
                    sequence[i] = Math.random() < 0.3 ? 1 : 0;  // 低確率で1
                } else {
                    sequence[i] = Math.random() < 0.5 ? 1 : 0;  // ランダム
                }
            }
            
            return sequence;
        }

        // Entityクラスに追加する記憶伝達のメソッド

        // 記憶の発信
        transmitMemory(targetEntity, memoryType = 'experience') {
            // 発信する記憶データの準備
            let memoryData;
            
            switch(memoryType) {
                case 'experience':
                    memoryData = {
                        interactions: this.communication.memory.interactions.slice(-10), // 最近の10件
                        signalHistory: this.memory.signalHistory,
                        explorationMap: this.wonder.explorationMap
                    };
                    break;
                    
                case 'immune':
                    memoryData = {
                        harmfulPatterns: Array.from(this.communication.blocking.immunity.patterns),
                        blockedEntities: Array.from(this.communication.blocking.blockedEntities)
                    };
                    break;
                    
                case 'learning':
                    memoryData = {
                        successfulStrategies: this.communication.memory.successRate,
                        environmentalKnowledge: this.memory.signalGradients
                    };
                    break;
            }

            // 記憶データを通信システムに設定
            this.communication.transmission.memory = {
                type: memoryType,
                data: memoryData,
                timestamp: time,
                source: this
            };

            // 記憶の発信を試行
            const success = targetEntity.receiveMemory(this, memoryData, memoryType);
            
            if (success) {
                this.recordInteraction('memory', 'transmit', targetEntity, memoryType);
            }
            
            return success;
        }

        // 記憶の受信
        receiveMemory(sourceEntity, memoryData, memoryType) {
            // ブロックされたエンティティからの記憶は受け取らない
            if (this.isBlocked(sourceEntity)) return false;
            
            // 受信フィルターのチェック
            if (!this.communication.reception.filters.memory) return false;
            
            // 記憶の評価（有害な記憶や誤った情報を防ぐ）
            const memoryTrust = this.evaluateMemoryTrust(sourceEntity, memoryData);
            if (memoryTrust < this.communication.reception.threshold) return false;

            // 記憶の種類に応じた処理
            switch(memoryType) {
                case 'experience':
                    // 経験の統合
                    this.integrateExperience(memoryData);
                    break;
                    
                case 'immune':
                    // 免疫記憶の統合
                    this.integrateImmuneMemory(memoryData);
                    break;
                    
                case 'learning':
                    // 学習内容の統合
                    this.integrateLearning(memoryData);
                    break;
            }

            // 記憶の受信を記録
            this.recordInteraction('memory', 'receive', sourceEntity, memoryType);
            
            return true;
        }

        // 記憶の信頼性評価
        evaluateMemoryTrust(sourceEntity, memoryData) {
            let trustScore = 0;
            
            // 過去の相互作用履歴からの信頼度
            const pastInteractions = this.communication.memory.interactions
                .filter(i => i.target === sourceEntity);
            
            if (pastInteractions.length > 0) {
                const successfulInteractions = pastInteractions
                    .filter(i => i.success).length;
                trustScore += successfulInteractions / pastInteractions.length;
            }
            
            // 遺伝的類似度による信頼度
            const geneticSimilarity = this.calculateGeneticSimilarity(sourceEntity);
            trustScore += geneticSimilarity * 0.3;
            
            // データの一貫性チェック
            const consistencyScore = this.checkMemoryConsistency(memoryData);
            trustScore += consistencyScore * 0.3;
            
            return trustScore / 1.6; // 0-1の範囲に正規化
        }

        // 経験の統合
        integrateExperience(memoryData) {
            // 相互作用履歴の統合
            for (const interaction of memoryData.interactions) {
                if (!this.communication.memory.interactions.some(
                    i => i.timestamp === interaction.timestamp
                )) {
                    this.communication.memory.interactions.push({
                        ...interaction,
                        isInherited: true
                    });
                }
            }
            
            // 探索マップの統合
            for (const [cell, value] of Object.entries(memoryData.explorationMap)) {
                if (!this.wonder.explorationMap[cell]) {
                    this.wonder.explorationMap[cell] = value * 0.8; // 間接的な経験は割引
                }
            }
        }

        // 免疫記憶の統合
        integrateImmuneMemory(memoryData) {
            // 有害パターンの統合
            for (const [pattern, count] of memoryData.harmfulPatterns) {
                const currentCount = this.communication.blocking.immunity.patterns.get(pattern) || 0;
                this.communication.blocking.immunity.patterns.set(
                    pattern,
                    Math.max(currentCount, count * 0.7) // 間接的な経験は割引
                );
            }
        }

        // 学習内容の統合
        integrateLearning(memoryData) {
            // 成功率の統合
            for (const [key, rate] of Object.entries(memoryData.successfulStrategies)) {
                if (!this.communication.memory.successRate[key]) {
                    this.communication.memory.successRate[key] = {
                        success: rate.success * 0.7, // 間接的な経験は割引
                        total: rate.total
                    };
                }
            }
            
            // 環境知識の統合
            for (const [type, gradient] of Object.entries(memoryData.environmentalKnowledge)) {
                if (!this.memory.signalGradients[type]) {
                    this.memory.signalGradients[type] = {
                        ...gradient,
                        intensity: gradient.intensity * 0.8 // 間接的な経験は割引
                    };
                }
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
                
                // 単純なノイズ関数でエネルギー分布の重みを決定
                const nx = (x * 0.05 + this.seedX);
                const ny = (y * 0.05 + this.seedY);
                // より対称的な分布を生成
                const weight = (Math.sin(nx) * Math.sin(ny) + 1) / 2;  // 0～1の範囲
                
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
        
        // 指定位置でのエネルギー量を取得し、その分環境から減少させる
        getEnergyAt(position, time, amount) {
            const x = Math.floor(position.x);
            const y = Math.floor(position.y);
            
            // 範囲外チェック
            if (x < 0 || x >= width || y < 0 || y >= height) return 0;
            
            const index = y * width + x;
            const availableEnergy = this.energyField[index].energy;
            
            // 要求量と利用可能量の小さい方を取得
            const extractedEnergy = Math.min(amount, availableEnergy);
            
            // 環境からエネルギーを減少
            this.energyField[index].energy -= extractedEnergy;
            
            return extractedEnergy;
        }
        
        // エネルギーを環境に戻す
        returnEnergyAt(position, amount) {
            if (!position || typeof amount !== 'number') return;
            
            const x = Math.floor(position.x);
            const y = Math.floor(position.y);
            
            // 範囲外チェック
            if (x < 0 || x >= width || y < 0 || y >= height) return;
            
            const index = y * width + x;
            if (!this.energyField[index]) {
                this.energyField[index] = { energy: 0, weight: 0 };
            }
            
            this.energyField[index].energy += amount;
        }
        
        // エネルギーの拡散（各フレームで呼び出す）
        diffuseEnergy() {
            const diffusionRate = 0.05;
            const newField = [...this.energyField];
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const index = y * width + x;
                    const currentEnergy = this.energyField[index].energy;
                    
                    // 拡散するエネルギー量
                    const diffusionAmount = currentEnergy * diffusionRate;
                    
                    // 自身は拡散分減少
                    newField[index].energy -= diffusionAmount;
                    
                    // 隣接セルに拡散（4方向）
                    const directions = [
                        {dx: 1, dy: 0}, {dx: -1, dy: 0},
                        {dx: 0, dy: 1}, {dx: 0, dy: -1}
                    ];
                    
                    for (const dir of directions) {
                        const nx = x + dir.dx;
                        const ny = y + dir.dy;
                        
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const neighborIndex = ny * width + nx;
                            newField[neighborIndex].energy += diffusionAmount / 4;
                        }
                    }
                }
            }
            
            this.energyField = newField;
        }
    }
    
    // エンティティと環境の初期化
    const entities = [];
    const environment = new Environment();
    
    // コロニー状の初期配置を行う関数
    function createInitialColony() {
        // コロニーの中心位置（画面中央）
        const centerX = width * 0.5;
        const centerY = height * 0.5;
        
        // コロニーのサイズ
        const colonyRadius = 5;
        
        // 大腸菌型の初期生命の属性
        const bacterialAttributes = {
            sensorSensitivity: 0.7,     // より高い感度
            energyConversion: 0.8,      // 高いエネルギー変換効率
            movementEfficiency: 0.7,    // 効率的な運動能力
            responseRate: 0.6,          // より高い応答性
            structuralIntegrity: 0.8    // より高い構造強度
        };
        
        // 密集度を調整しながらエンティティを配置
        for (let i = 0; i < initialEntityCount; i++) {
            // 極座標でランダムな位置を生成
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * colonyRadius;
            
            // 極座標から直交座標に変換
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius;
            
            // 最終位置の計算
            const x = centerX + offsetX;
            const y = centerY + offsetY;
            
            // エンティティの作成と追加
            entities.push(new Entity(x, y, null, bacterialAttributes));
        }
    }
    
    // 初期コロニーの作成
    createInitialColony();
    
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
        if (!entity.genome || !entity.genome.core || !entity.genome.core.sequence) {
            // フォールバックの色をより明るく
            return `rgba(230, 230, 230, ${0.7 + entity.energy * 0.3})`;
        }
        
        // コア遺伝子配列から色を生成
        const sequence = entity.genome.core.sequence;
        const segmentLength = Math.floor(sequence.length / 3);
        
        // RGBの各要素に配列を分割
        const rSegment = sequence.slice(0, segmentLength);
        const gSegment = sequence.slice(segmentLength, segmentLength * 2);
        const bSegment = sequence.slice(segmentLength * 2, segmentLength * 3);
        
        // バイナリ配列を色値に変換（より鮮やかな色になるように調整）
        const r = Math.floor(180 + entity.binaryToValue(rSegment) * 75); // 180-255の範囲
        const g = Math.floor(180 + entity.binaryToValue(gSegment) * 75); // 180-255の範囲
        const b = Math.floor(180 + entity.binaryToValue(bSegment) * 75); // 180-255の範囲
        
        // 不透明度を上げて、より見やすく
        const alpha = 0.8 + entity.energy * 0.2; // 最小0.8、最大1.0
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    // フレームの描画
    function render() {
        // 現在の実時間を取得
        const realTime = performance.now() / 1000;  // 秒単位の実時間
        
        // エンティティの更新
        for (let i = entities.length - 1; i >= 0; i--) {
            const entity = entities[i];
            if (!entity || !entity.isActive) {
                entities.splice(i, 1);
                continue;
            }
            
            // 各エンティティの主観的時間スケールを計算
            const subjectiveTimeScale = calculateSubjectiveTime(entity, realTime);
            
            // 主観的時間スケールを使用してエンティティを更新
            entity.update(entities, environment, subjectiveTimeScale);
        }
        
        // エンティティの描画
        let output = '';
        const displayBuffer = Array(width * height).fill(null).map(() => ({
            char: ' ',
            color: ''
        }));
        
        for (const entity of entities) {
            if (!entity || !entity.isActive) continue;
            
            const projectedX = Math.floor(entity.position.x);
            const projectedY = Math.floor(entity.position.y);
            
            if (projectedX >= 0 && projectedX < width && projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                // 密度とエネルギーに基づく文字選択
                const charIndex = Math.floor((entity.density * entity.energy) * (asciiChars.length - 1));
                const displayChar = asciiChars[Math.min(Math.max(0, charIndex), asciiChars.length - 1)];
                
                displayBuffer[bufferIndex] = {
                    char: displayChar,
                    color: getEntityColor(entity)
                };
            }
        }
        
        // バッファから文字列を生成して描画
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const cell = displayBuffer[index];
                if (cell.char !== ' ') {
                    output += `<span style="color:${cell.color}">${cell.char}</span>`;
                } else {
                    output += '&nbsp;';
                }
            }
            output += '<br>';
        }
        
        canvas.innerHTML = output;
        
        // 次のフレーム
        time++;
        
        // 環境のエネルギー拡散
        environment.diffuseEnergy();
        
        // エネルギー保存の検証（デバッグ用）
        if (time % 100 === 0) {
            let totalEnergy = 0;
            
            // エンティティのエネルギー
            for (const entity of entities) {
                if (entity && entity.isActive) {
                    totalEnergy += entity.energy;
                }
            }
            
            // 環境のエネルギー
            for (const cell of environment.energyField) {
                if (cell) {
                    totalEnergy += cell.energy;
                }
            }
            
            console.log(`Time: ${time}, Total Energy: ${totalEnergy}, Target: ${TOTAL_SYSTEM_ENERGY}`);
        }
        
        // 10FPSに制限
        setTimeout(() => {
            requestAnimationFrame(render);
        }, 33); // 100ms = 10FPS
    }
    
    // エンティティごとの主観的時間を計算 - 昼夜サイクル要素なし
    function calculateSubjectiveTime(entity, realTime) {
        // エネルギーレベルに基づく時間スケールの変化
        const energyTimeFactor = 0.5 + entity.energy;
        
        // 属性に基づく時間知覚の違い
        const perceptionFactor = entity.attributes.sensorSensitivity * 0.5 + 0.5;
        
        // 実時間と内部時間のギャップに基づく係数
        const timeGapFactor = Math.sin(realTime * 0.1) * 0.2 + 1.0;
        
        // 最終的な主観的時間スケール
        return energyTimeFactor * perceptionFactor * timeGapFactor;
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
}); 