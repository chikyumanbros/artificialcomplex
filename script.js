document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    // 幅と高さの比率を1:1に近づける（正方形のグリッドになるように）
    const width = 90;
    const height = 50;
    
    // ASCII文字のセット - 単純に密度を表現
    const asciiChars = '☻☻░+*·';
    
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
            
            // 内部状態の保存（記憶）
            this.memory = {
                lastPosition: {...this.position}
            };

            // 内部状態に揺らぎを追加（初期安定性をさらに下げる）
            this.internalState = {
                stability: 0.7,  // 0.8から0.7に下げる
                oscillation: 0.3 // 0.2から0.3に上げる
            };

            // エネルギー還元キューを追加
            this.energyReturnQueue = [];
        }
        
        // 基本的な更新処理
        update(entities, environment, subjectiveTimeScale = 1.0) {
            if (!this.isActive) return;
            
            // 年齢の更新
            this.age += subjectiveTimeScale;
            
            // エネルギー処理
            this.processEnergy(environment, subjectiveTimeScale);
            
            // 速度の更新
            const brownian = this.addBrownianMotion();
            this.velocity.x += brownian.x;
            this.velocity.y += brownian.y;
            
            // 速度の減衰
            const friction = Math.pow(0.95, subjectiveTimeScale);
            this.velocity.x *= friction;
            this.velocity.y *= friction;
            
            // 位置の更新
            this.position.x += this.velocity.x * subjectiveTimeScale;
            this.position.y += this.velocity.y * subjectiveTimeScale;
            
            // エンティティ同士の衝突判定と反発
            for (const other of entities) {
                if (other !== this && other.isActive) {
                    // 同じマスにいるかチェック
                    const dx = Math.floor(other.position.x) - Math.floor(this.position.x);
                    const dy = Math.floor(other.position.y) - Math.floor(this.position.y);
                    
                    if (dx === 0 && dy === 0) {
                        // 反発力を計算（より自然な反発のため、実際の位置の差を使用）
                        const exactDx = other.position.x - this.position.x;
                        const exactDy = other.position.y - this.position.y;
                        const distance = Math.sqrt(exactDx * exactDx + exactDy * exactDy) || 0.1;
                        
                        // 反発の強さ（エネルギーレベルに応じて変化）
                        const repulsionStrength = 0.1 * (this.energy + other.energy);
                        
                        // 反発方向の単位ベクトル
                        const nx = exactDx / distance;
                        const ny = exactDy / distance;
                        
                        // 反発による速度変化
                        this.velocity.x -= nx * repulsionStrength;
                        this.velocity.y -= ny * repulsionStrength;
                        other.velocity.x += nx * repulsionStrength;
                        other.velocity.y += ny * repulsionStrength;
                        
                        // 衝突処理
                        this.handleCollision(other, environment);
                    }
                }
            }
            
            // 境界処理
            this.enforceBoundaries();
            
            // 活性状態の更新
            if (this.energy <= 0 || this.age > 500) {
                // 死亡時に残りのエネルギーを環境に徐々に還元
                if (this.isActive) {
                    const remainingEnergy = Math.max(0, this.energy);
                    // エネルギーを複数のステップに分けて還元
                    const numSteps = 10;
                    const energyPerStep = remainingEnergy / numSteps;
                    
                    // 周囲のセルにエネルギーを分散して還元
                    for (let i = 0; i < numSteps; i++) {
                        const angle = (Math.PI * 2 * i) / numSteps;
                        const radius = i * 0.5; // 徐々に広がる半径
                        const returnPos = {
                            x: this.position.x + Math.cos(angle) * radius,
                            y: this.position.y + Math.sin(angle) * radius
                        };
                        environment.returnEnergyAt(returnPos, energyPerStep * 0.1); // エネルギー還元量を10%に抑制
                    }
                }
                this.isActive = false;
            }
            
            // 前回位置を記録
            this.memory.lastPosition = {...this.position};
            
            // 分裂処理を追加
            this.tryDivision(entities);
        }
        
        // エネルギー処理
        processEnergy(environment, subjectiveTimeScale = 1.0) {
            // 基本的なエネルギー消費
            const consumedEnergy = baseEnergyDecay * subjectiveTimeScale;
            this.energy -= consumedEnergy;
            
            // 消費エネルギーを還元キューに追加
            this.queueEnergyReturn(this.position, consumedEnergy, 5);
            
            // 環境からのエネルギー獲得（時間スケールから独立）
            const baseGainRate = 0.01;  // 基本獲得率
            const gainedEnergy = environment.getEnergyAt(this.position, time, baseGainRate);
            this.energy += gainedEnergy;
            
            // エネルギー上限を設定
            this.energy = Math.min(this.energy, 1.0);

            // キューに溜まったエネルギーの段階的還元
            this.processEnergyReturnQueue(environment);
        }
        
        // エネルギー還元をキューに追加
        queueEnergyReturn(position, amount, steps) {
            const energyPerStep = amount / steps;
            for (let i = 0; i < steps; i++) {
                this.energyReturnQueue.push({
                    position: {...position},
                    amount: energyPerStep
                });
            }
        }

        // キューに溜まったエネルギーの処理
        processEnergyReturnQueue(environment) {
            if (this.energyReturnQueue.length > 0) {
                const energyReturn = this.energyReturnQueue.shift();
                environment.returnEnergyAt(energyReturn.position, energyReturn.amount);
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
            
            // 失われたエネルギーを段階的に還元
            const totalLoss = energyLoss * 2;
            this.queueEnergyReturn(this.position, totalLoss, 8);
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
            offspring.energy = childEnergy;
            offspring.age = 0;
            
            // 速度を新しく初期化（ランダムな方向）
            offspring.velocity = {
                x: (Math.random() - 0.5) * 0.5,
                y: (Math.random() - 0.5) * 0.5
            };
            
            // 内部状態を新しく初期化
            offspring.internalState = {
                stability: 0.7,
                oscillation: 0.3
            };
            
            // メモリを新しく初期化
            offspring.memory = {
                lastPosition: {...offspring.position}
            };
            
            // エネルギー還元キューを新しく初期化
            offspring.energyReturnQueue = [];
            
            entities.push(offspring);
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
            const diffusionRate = 0.1; // 拡散率
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
                [-1, 0], [1, 0], [0, -1], [0, 1]  // 上下左右
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
            
            if (x < 0 || x >= width || y < 0 || y >= height) return;
            
            const idx = y * width + x;
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
        const r = Math.floor(180 + energyLevel * 75);
        const g = Math.floor(180 + (1 - energyLevel) * 75);
        const b = Math.floor(180 + Math.sin(entity.id * 0.1) * 75); // IDに基づくランダムな青色成分
        
        // エネルギーレベルに基づいて透明度を調整
        const alpha = 0.7 + energyLevel * 0.3;
        
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
            if (frameCount % Math.max(1, Math.round(5 / simulationSpeed)) === 0) {  // 頻度を増加（10から5に）
                environment.diffuseEnergy();
            }

            // エネルギーの再分配（定期的に）を削除
            // 代わりに、システム全体のエネルギーバランスをモニタリング
            if (frameCount % 100 === 0) {
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
                
                // エネルギー保存則の検証（デバッグ用）
                console.log(`Time: ${time}, Total Energy: ${totalEnergy.toFixed(3)}, Target: ${TOTAL_SYSTEM_ENERGY}`);
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
        let maxEnergy = 0;
        for (let i = 0; i < environment.energyField.length; i++) {
            maxEnergy = Math.max(maxEnergy, environment.energyField[i].energy);
        }
        // 最小エネルギー値も設定（暗すぎる部分を防ぐ）
        const minEnergy = maxEnergy * 0.1;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const energyLevel = environment.energyField[index].energy;
                
                // エネルギーレベルに基づいて色を生成（より明確な階調表現）
                const normalizedEnergy = (energyLevel - minEnergy) / (maxEnergy - minEnergy);
                const intensity = Math.max(0, Math.min(normalizedEnergy, 1));
                
                // 基本色の設定（暗い部分でも視認性を確保）
                const baseColor = 30;
                // より鮮やかな色の生成（エネルギーレベルに応じて）
                const r = Math.floor(baseColor + intensity * (255 - baseColor));
                const g = Math.floor(baseColor + intensity * (180 - baseColor));
                const b = Math.floor(baseColor + intensity * (100 - baseColor));
                
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
                    const bgR = Math.floor(r * 0.4);  // 背景色は前景色の40%の明るさ
                    const bgG = Math.floor(g * 0.4);
                    const bgB = Math.floor(b * 0.4);
                    output += `<span style="color: rgb(${r},${g},${b}); background-color: rgb(${bgR},${bgG},${bgB})">░</span>`;
                }
            }
            output += '<br>';
        }
        
        canvas.innerHTML = output;
        
        // 次のフレーム
        time++;
        
        // 環境のエネルギー拡散
        environment.diffuseEnergy();
        
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
        controlPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
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
            if (showStats) {
                updateStatsDisplay();
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
        statsPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
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
        if (!showStats) return;
        
        // Get latest stats data (max 100 points)
        const dataPoints = Math.min(simulationData.timestamps.length, 100);
        const timestamps = simulationData.timestamps.slice(-dataPoints);
        const populations = simulationData.populationSize.slice(-dataPoints);
        const energyData = simulationData.averageEnergy.slice(-dataPoints);
        
        // Stats panel
        const statsPanel = document.getElementById('stats-panel');
        if (!statsPanel) return;
        
        // Clear previous content
        statsPanel.innerHTML = '<h3>Simulation Stats</h3>';
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
        
        statsPanel.appendChild(document.createElement('h4')).textContent = 'Population';
        statsPanel.appendChild(populationGraph);
        
        // Create energy graph
        const energyGraph = document.createElement('canvas');
        energyGraph.id = 'energy-graph';
        energyGraph.width = 280;
        energyGraph.height = 120;
        
        statsPanel.appendChild(document.createElement('h4')).textContent = 'Energy';
        statsPanel.appendChild(energyGraph);
        
        // Draw graphs
        drawGraph('population-graph', timestamps, populations, 'Population', 'rgb(0, 200, 0)');
        drawGraph('energy-graph', timestamps, energyData, 'Energy', 'rgb(255, 165, 0)');
    }
    
    function drawGraph(canvasId, xData, yData, label, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
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
        const detailsDiv = document.getElementById('entity-details');
        detailsDiv.innerHTML = `
            <h4>Entity #${entity.id}</h4>
            <table style="width:100%; border-collapse:collapse;">
                <tr><td>Energy:</td><td>${entity.energy.toFixed(3)}</td></tr>
                <tr><td>Age:</td><td>${entity.age.toFixed(0)}</td></tr>
                <tr><td>Position:</td><td>(${entity.position.x.toFixed(1)}, ${entity.position.y.toFixed(1)})</td></tr>
                <tr><td>Velocity:</td><td>(${entity.velocity.x.toFixed(2)}, ${entity.velocity.y.toFixed(2)})</td></tr>
            </table>
            
            <h5>Memory</h5>
            <table style="width:100%; border-collapse:collapse;">
                <tr><td>Last Position:</td><td>(${entity.memory.lastPosition.x.toFixed(1)}, ${entity.memory.lastPosition.y.toFixed(1)})</td></tr>
            </table>
        `;
        
        // View Details button
        const detailsButton = document.createElement('button');
        detailsButton.textContent = 'View Details';
        detailsButton.style.marginTop = '10px';
        detailsButton.onclick = function() {
            showGenomeDetails(entity);
        };
        detailsDiv.appendChild(detailsButton);
    }
    
    function showGenomeDetails(entity) {
        // Modal window
        const modal = document.createElement('div');
        modal.className = 'genome-modal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        modal.style.padding = '20px';
        modal.style.borderRadius = '5px';
        modal.style.color = '#fff';
        modal.style.maxWidth = '80%';
        modal.style.maxHeight = '80%';
        modal.style.overflow = 'auto';
        modal.style.zIndex = '1000';
        
        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '10px';
        closeButton.style.padding = '5px 10px';
        closeButton.style.backgroundColor = '#333';
        closeButton.style.color = '#fff';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '3px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => document.body.removeChild(modal);
        
        modal.appendChild(closeButton);
        
        // Title
        const title = document.createElement('h3');
        title.textContent = `Entity #${entity.id} Details`;
        title.style.marginTop = '0';
        modal.appendChild(title);
        
        // Basic info
        const basicInfo = document.createElement('div');
        basicInfo.innerHTML = `
            <p>Energy: ${entity.energy.toFixed(3)}</p>
            <p>Age: ${entity.age.toFixed(1)}</p>
            <p>Position: (${entity.position.x.toFixed(1)}, ${entity.position.y.toFixed(1)})</p>
        `;
        modal.appendChild(basicInfo);
        
        // Genome section
        const genomeSequenceDiv = document.createElement('div');
        genomeSequenceDiv.innerHTML = '<h4>Simplified Entity Information</h4>';
        
        // 簡略化された情報を表示
        genomeSequenceDiv.innerHTML += `
            <p>This entity is a simple life form that consumes energy from the environment.</p>
            <p>It moves randomly with Brownian motion, influenced by its energy level.</p>
            <p>Higher energy levels result in more controlled movement.</p>
        `;
        
        modal.appendChild(genomeSequenceDiv);
        
        document.body.appendChild(modal);
    }
    
    function applyExperimentPreset(presetName) {
        // Update experiment metadata
        simulationData.experimentMetadata.name = presetName;
        simulationData.experimentMetadata.startTime = new Date().toISOString();
        simulationData.experimentMetadata.parameters = {};
        
        switch(presetName) {
            case 'high-energy':
                environment.initializeEnergyField(10000);
                Entity.MUTATION_RATE = 0.01;
                simulationData.experimentMetadata.description = "Evolution in high energy environment";
                simulationData.experimentMetadata.parameters = {
                    environmentalEnergy: 10000,
                    mutationRate: 0.01,
                    cooperationBoost: 1.0,
                    competitionPenalty: 1.0
                };
                break;
            case 'low-energy':
                environment.initializeEnergyField(1000);
                Entity.MUTATION_RATE = 0.01;
                simulationData.experimentMetadata.description = "Survival competition in low energy environment";
                simulationData.experimentMetadata.parameters = {
                    environmentalEnergy: 1000,
                    mutationRate: 0.01,
                    cooperationBoost: 1.0,
                    competitionPenalty: 1.0
                };
                break;
            case 'high-mutation':
                environment.initializeEnergyField(5000);
                Entity.MUTATION_RATE = 0.05;
                document.querySelector('#control-panel input[type="range"]').value = '0.05';
                simulationData.experimentMetadata.description = "Genetic diversity in high mutation environment";
                simulationData.experimentMetadata.parameters = {
                    environmentalEnergy: 5000,
                    mutationRate: 0.05,
                    cooperationBoost: 1.0,
                    competitionPenalty: 1.0
                };
                break;
            case 'cooperative':
                environment.initializeEnergyField(3000);
                Entity.COOPERATION_BOOST = 2.0;
                Entity.COMPETITION_PENALTY = 0.5;
                simulationData.experimentMetadata.description = "Social evolution in cooperative environment";
                simulationData.experimentMetadata.parameters = {
                    environmentalEnergy: 3000,
                    mutationRate: 0.01,
                    cooperationBoost: 2.0,
                    competitionPenalty: 0.5
                };
                break;
            case 'competitive':
                environment.initializeEnergyField(3000);
                Entity.COOPERATION_BOOST = 0.5;
                Entity.COMPETITION_PENALTY = 2.0;
                simulationData.experimentMetadata.description = "Adaptation in competitive environment";
                simulationData.experimentMetadata.parameters = {
                    environmentalEnergy: 3000,
                    mutationRate: 0.01,
                    cooperationBoost: 0.5,
                    competitionPenalty: 2.0
                };
                break;
            default:
                // Default settings
                environment.initializeEnergyField(5000);
                Entity.MUTATION_RATE = 0.01;
                Entity.COOPERATION_BOOST = 1.0;
                Entity.COMPETITION_PENALTY = 1.0;
                simulationData.experimentMetadata.description = "Standard evolution experiment";
                simulationData.experimentMetadata.parameters = {
                    environmentalEnergy: 5000,
                    mutationRate: 0.01,
                    cooperationBoost: 1.0,
                    competitionPenalty: 1.0
                };
        }
        
        // Reset existing data
        resetSimulationData();
        
        // Update UI
        if (document.getElementById('control-panel')) {
            const nameInput = document.querySelector('#control-panel input[type="text"]');
            if (nameInput) nameInput.value = simulationData.experimentMetadata.name;
        }
    }
    
    function resetSimulationData() {
        // Preserve timestamp and experiment metadata
        const metadata = { ...simulationData.experimentMetadata };
        simulationData = {
            timestamps: [],
            populationSize: [],
            averageEnergy: [],
            environmentalEnergy: [],
            experimentMetadata: metadata
        };
    }
    
    // New function to update species data visualization
    function updateSpeciesDisplay() {
        const speciesContainer = document.getElementById('species-container');
        if (!speciesContainer) return;
        
        // Get latest speciation data
        const speciationData = simulationData.geneticAnalytics.speciation;
        if (speciationData.length === 0) {
            speciesContainer.innerHTML = '<p>No species data available yet</p>';
            return;
        }
        
        const latestData = speciationData[speciationData.length - 1];
        
        // Create species distribution chart
        const canvas = document.getElementById('species-chart');
        if (!canvas) {
            // Create canvas if it doesn't exist
            const newCanvas = document.createElement('canvas');
            newCanvas.id = 'species-chart';
            newCanvas.width = 280;
            newCanvas.height = 200;
            speciesContainer.appendChild(newCanvas);
        }
        
        // Draw pie chart for species distribution
        drawSpeciesDistribution('species-chart', latestData.distribution);
        
        // Display species metrics
        const metricsDiv = document.getElementById('species-metrics') || document.createElement('div');
        metricsDiv.id = 'species-metrics';
        
        metricsDiv.innerHTML = `
            <h5>Species Metrics</h5>
            <table style="width:100%; border-collapse:collapse;">
                <tr><td>Number of Species:</td><td>${latestData.speciesCount}</td></tr>
                <tr><td>Largest Species Size:</td><td>${Math.max(...latestData.distribution)}</td></tr>
                <tr><td>Shannon Diversity:</td><td>${calculateShannonDiversity(latestData.distribution).toFixed(3)}</td></tr>
            </table>
        `;
        
        if (!document.getElementById('species-metrics')) {
            speciesContainer.appendChild(metricsDiv);
        }
    }
    
    // Function to draw species distribution pie chart
    function drawSpeciesDistribution(canvasId, distribution) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Skip if no data
        if (distribution.length === 0) {
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText('No species data', canvas.width/2, canvas.height/2);
            return;
        }
        
        // Title
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('Species Distribution', canvas.width/2, 20);
        
        // Draw pie chart
        const total = distribution.reduce((sum, count) => sum + count, 0);
        const radius = Math.min(canvas.width, canvas.height) * 0.4;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 + 10;
        
        let startAngle = 0;
        const colors = [
            'rgb(255, 99, 132)',
            'rgb(54, 162, 235)',
            'rgb(255, 206, 86)',
            'rgb(75, 192, 192)',
            'rgb(153, 102, 255)',
            'rgb(255, 159, 64)',
            'rgb(199, 199, 199)'
        ];
        
        // Draw each segment
        distribution.forEach((count, index) => {
            const sliceAngle = (count / total) * Math.PI * 2;
            const color = colors[index % colors.length];
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fill();
            
            // Label if slice is big enough
            if (sliceAngle > 0.2) {
                const labelAngle = startAngle + sliceAngle / 2;
                const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
                const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
                
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${Math.round(count / total * 100)}%`, labelX, labelY);
            }
            
            startAngle += sliceAngle;
        });
        
        // Legend
        const legendY = centerY + radius + 20;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        distribution.forEach((count, index) => {
            if (index < 5) { // Show only top 5 species in legend
                const color = colors[index % colors.length];
                const x = 10;
                const y = legendY + index * 20;
                
                ctx.fillStyle = color;
                ctx.fillRect(x, y, 15, 15);
                
                ctx.fillStyle = 'white';
                ctx.fillText(`Species ${index+1}: ${count}`, x + 20, y + 7);
            }
        });
        
        // If more than 5 species, show "Others"
        if (distribution.length > 5) {
            const x = 10;
            const y = legendY + 5 * 20;
            
            ctx.fillStyle = 'white';
            ctx.fillText(`+ ${distribution.length - 5} more species`, x, y + 7);
        }
    }
    
    // Function to update gene frequency visualization
    function updateGeneFrequencyDisplay() {
        const genesContainer = document.getElementById('genes-container');
        if (!genesContainer) return;
        
        // Get latest dominant genes data
        const dominantGenesData = simulationData.geneticAnalytics.dominantGenes;
        if (dominantGenesData.length === 0) {
            genesContainer.innerHTML = '<p>No gene frequency data available yet</p>';
            return;
        }
        
        const latestData = dominantGenesData[dominantGenesData.length - 1];
        
        // Display top genes
        const topGenesDiv = document.createElement('div');
        topGenesDiv.innerHTML = '<h5>Dominant Gene Sequences</h5>';
        
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginBottom = '15px';
        
        // Table header
        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th>Sequence</th><th>Count</th><th>Frequency</th></tr>';
        table.appendChild(thead);
        
        // Table body
        const tbody = document.createElement('tbody');
        latestData.dominantGenes.forEach(gene => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><code>${gene.sequence}</code></td>
                <td>${gene.count}</td>
                <td>${(gene.frequency * 100).toFixed(1)}%</td>
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        topGenesDiv.appendChild(table);
        
        // Clear and update container
        genesContainer.innerHTML = '';
        genesContainer.appendChild(topGenesDiv);
        
        // Add gene frequency over time chart
        const chartDiv = document.createElement('div');
        chartDiv.innerHTML = '<h5>Gene Frequency Evolution</h5>';
        
        const canvas = document.createElement('canvas');
        canvas.id = 'gene-frequency-chart';
        canvas.width = 280;
        canvas.height = 180;
        chartDiv.appendChild(canvas);
        
        genesContainer.appendChild(chartDiv);
        
        // Draw gene frequency evolution if we have enough data points
        if (dominantGenesData.length > 1) {
            drawGeneFrequencyEvolution('gene-frequency-chart', dominantGenesData);
        } else {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText('Not enough data points yet', canvas.width/2, canvas.height/2);
        }
    }
    
    // Function to draw gene frequency evolution
    function drawGeneFrequencyEvolution(canvasId, dominantGenesData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Get data for top 3 genes currently
        const latestData = dominantGenesData[dominantGenesData.length - 1];
        const topGenes = latestData.dominantGenes.slice(0, 3).map(g => g.sequence);
        
        // Collect frequency data over time for these genes
        const geneData = {};
        topGenes.forEach(gene => {
            geneData[gene] = [];
        });
        
        // Limit to last 10 data points to avoid clutter
        const dataPoints = dominantGenesData.slice(-10);
        
        // Extract timestamps
        const timestamps = dataPoints.map(d => d.timestamp);
        
        // For each timestamp, find frequencies of our top genes
        dataPoints.forEach(point => {
            topGenes.forEach(gene => {
                const found = point.dominantGenes.find(g => g.sequence === gene);
                geneData[gene].push(found ? found.frequency : 0);
            });
        });
        
        // Draw axes
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(30, 20);
        ctx.lineTo(30, canvas.height - 30);
        ctx.lineTo(canvas.width - 20, canvas.height - 30);
        ctx.stroke();
        
        // Y-axis label
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.translate(15, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('Frequency', 0, 0);
        ctx.restore();
        
        // X-axis label
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('Time', canvas.width / 2, canvas.height - 10);
        
        // Draw lines for each gene
        const colors = ['rgb(255, 99, 132)', 'rgb(54, 162, 235)', 'rgb(255, 206, 86)'];
        
        Object.entries(geneData).forEach(([gene, frequencies], index) => {
            if (frequencies.length < 2) return;
            
            const color = colors[index % colors.length];
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            // Plot points
            for (let i = 0; i < frequencies.length; i++) {
                const x = 30 + ((canvas.width - 50) / (frequencies.length - 1)) * i;
                const y = (canvas.height - 30) - ((canvas.height - 50) * frequencies[i]);
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.stroke();
            
            // Legend
            ctx.fillStyle = color;
            ctx.fillRect(canvas.width - 100, 30 + index * 20, 10, 10);
            
            // Truncate gene sequence if too long
            const displayGene = gene.length > 8 ? gene.substring(0, 8) + '...' : gene;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'left';
            ctx.fillText(displayGene, canvas.width - 85, 35 + index * 20);
        });
    }
    
    // Shannon diversity index calculation for species distribution
    function calculateShannonDiversity(distribution) {
        const total = distribution.reduce((sum, count) => sum + count, 0);
        if (total === 0) return 0;
        
        return -distribution.reduce((sum, count) => {
            if (count === 0) return sum;
            const proportion = count / total;
            return sum + (proportion * Math.log(proportion));
        }, 0);
    }
}); 