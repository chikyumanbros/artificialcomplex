document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    // 幅と高さの比率を1:1に近づける（正方形のグリッドになるように）
    const width = 255;
    const height = 144;
    
    // ASCII文字のセット（生命体の状態を表現）
    const asciiChars = '█▓▒░*+∙';
    
    // ライフシミュレーションのパラメータ
    const initialLifeCount = 10;  // 50から30に減少：植物が十分成長するまでの負荷を減らす
    const maxLifeforms = 1000;    
    const energyDecayRate = 0.002;  // 0.003から0.002に減少：初期の生存をより容易に
    const reproductionThreshold = 0.7;  // 0.8から0.7に減少：繁殖をより容易に
    const reproductionCost = 0.3;   // 0.15から0.3に増加
    const mutationRate = 0.1;
    const foodGenerationRate = 0.05;  // 0.08から0.05に減少（食物生成を少し減らす、代わりに捕食が栄養源になる）
    const maxAge = 500;  // 1000から800に減少
    
    // 死骸のパラメータ
    const initialPlantDebrisCount = Math.floor(width * height * 0.00); // 画面の5%の量の初期植物死骸
    const initialLifeformDebrisCount = Math.floor(width * height * 0.01); // 画面の3%の量の初期生命体死骸
    
    // 浄化バクテリアのパラメータ
    const initialBacteriaCount = Math.floor(width * 0.20); // 画面の25%に増加
    const bacteriaPurificationRate = 0.01; // 毒素の浄化速度
    const bacteriaReproductionRate = 0.005; // 繁殖率を0.003から0.005に増加
    const bacteriaMaxCount = Math.floor(width * 0.20); // 最大数は画面の20%に増加
    
    // 酸素・二酸化炭素関連のパラメータ
    const oxygenConsumptionRate = 0.005; // 変更なし
    const oxygenProductionRate = 0.05;  // 0.008から0.05に増加
    const oxygenDiffusionRate = 0.02;    // 変更なし
    const maxOxygenLevel = 1.0;         
    const co2ProductionRate = 0.005;    // 変更なし
    const maxCO2Level = 1.0;           
    const initialOxygenDensity = 0.2; // 初期酸素濃度
    const initialCO2Density = 0.1;    // 初期CO2濃度
    const gridSize = 10; // 濃度グリッドのセルサイズ
    const gridWidth = Math.ceil(width / gridSize);
    const gridHeight = Math.ceil(height / gridSize);
    
    // 濃度マップの作成
    const oxygenMap = Array(gridWidth).fill().map(() => Array(gridHeight).fill(initialOxygenDensity));
    const co2Map = Array(gridWidth).fill().map(() => Array(gridHeight).fill(initialCO2Density));
    
    // 捕食関連のパラメータ
    const predationRange = 5;  // 捕食可能な距離
    const predationEnergyGain = 0.6;  // 捕食で得られるエネルギーの割合
    const predationSuccessRate = 0.7;  // 捕食の成功率（捕食者のサイズと被食者のサイズの比率に影響される）
    
    // アニメーションの状態
    let time = 0;
    
    // 生命体クラス
    class Lifeform {
        constructor(x, y, z, energy, dna = null) {
            // 位置を指定された場合のみ使用（ランダム生成を制限）
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : height - 2 - Math.random() * 3,
                z: z || 0
            };
            
            // 速度（移動方向と速さ）
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.1 + Math.random() * 0.3;
            this.velocity = {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed * 0.5,
                z: 0
            };
            
            // 加速度
            this.acceleration = { x: 0, y: 0, z: 0 };
            
            // DNAを先に設定
            this.dna = dna || {
                // 基本的な特性
                speed: 0.3 + Math.random() * 0.3,
                efficiency: 0.5 + Math.random() * 0.3,
                perception: 0.4 + Math.random() * 0.4,
                foodAttraction: 0.5 + Math.random() * 0.5,
                socialBehavior: Math.random() * 1.5 - 0.75,
                reproductionRate: 0.1 + Math.random() * 0.3,
                predatory: Math.random(),
                size: 0.2 + Math.random() * 0.4,
                
                // Boidの動きに関する特性
                separationWeight: 0.7 + Math.random() * 0.3,
                alignmentWeight: 0.2 + Math.random() * 0.3,
                cohesionWeight: 0.1 + Math.random() * 0.2,
                
                // 繁殖戦略
                offspringCount: 1 + Math.floor(Math.random() * 3),
                parentalCare: Math.random(),
                
                // 特殊能力
                regenerationRate: Math.random() * 0.1,
                toxicity: Math.random() * 0.5,
                
                // 酸素関連の特性
                oxygenEfficiency: 0.5 + Math.random() * 0.3,
                oxygenTolerance: 0.3 + Math.random() * 0.4
            };
            
            // 捕食者の判定を先に行う
            this.isPredator = this.dna.predatory > 0.6;
            
            // 生命体の色（DNAに基づく）
            // 捕食者は赤系、被食者は青系
            this.baseHue = this.isPredator ? 
                0 + Math.floor(this.dna.predatory * 60) :  // 赤〜黄色
                180 + Math.floor((1 - this.dna.predatory) * 60);  // 青〜シアン
            
            // 生命体の状態
            this.energy = energy !== undefined ? energy : 0.8 + Math.random() * 0.2;
            this.age = 0;
            this.isDead = false;
            this.wasPreyed = false;
            this.lastReproductionTime = 0;
            
            // 捕食関連の状態
            this.lastPredationTime = 0;
            this.lastPredationAttemptTime = 0;
            
            // 物理特性を更新
            this.mass = this.dna.size * 0.8 + 0.2;
            this.buoyancy = this.dna.size * 0.9 + 0.1;
            this.dragCoefficient = 0.1;
            
            // 捕食性を連続的な特性として扱う
            this.predatoryBehavior = this.dna.predatory;
            
            // 捕食能力に影響する要素を複数組み合わせる
            this.huntingAbility = {
                strength: this.dna.size * 0.7 + this.dna.speed * 0.3,
                perception: this.dna.perception,
                aggressiveness: this.dna.predatory
            };

            this.toxicDamageResistance = 0.8;
        }
        
        // 捕食の判定をより自然な形に
        canPredate(target) {
            const sizeDifference = this.dna.size / target.dna.size;
            const energyAdvantage = this.energy / target.energy;
            const predatoryDrive = this.predatoryBehavior;
            
            // 毒性による防御効果を追加
            const toxicityDefense = target.dna.toxicity * 0.8;
            
            // 複数の要因を組み合わせて捕食可能性を判定（毒性による防御を考慮）
            return (sizeDifference * energyAdvantage * predatoryDrive) > (0.5 + toxicityDefense);
        }
        
        // 色の計算も連続的に
        getDisplayColor() {
            // 捕食者か被食者かで色相を決定
            const hue = this.isPredator ? 
                0 + Math.floor(this.dna.predatory * 60) :  // 赤〜黄色（0-60）
                180 + Math.floor((1 - this.dna.predatory) * 60);  // 青〜シアン（180-240）
            
            // エネルギーレベルに基づく彩度
            const saturation = 50 + this.energy * 50;
            
            // 年齢に基づく明度（若いほど明るい）
            const ageRatio = Math.min(1, this.age / maxAge);
            const lightness = 70 - ageRatio * 40;
            
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        }
        
        // 食物を探す
        seekFood(foods, bacteria) {  // bacteriaパラメータを追加
            if (!foods) foods = [];
            if (!bacteria) bacteria = [];
            
            let closestFood = null;
            let closestDist = this.senseRadius;
            let force = { x: 0, y: 0, z: 0 };
            
            // 食物を探す
            for (const food of foods) {
                const dx = food.position.x - this.position.x;
                const dy = food.position.y - this.position.y;
                const dz = food.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < closestDist) {
                    closestDist = distance;
                    closestFood = food;
                }
            }
            
            // 最も近い食物に向かって移動
            if (closestFood) {
                const dx = closestFood.position.x - this.position.x;
                const dy = closestFood.position.y - this.position.y;
                const dz = closestFood.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // 斜め移動を強化するために角度ベースの移動を実装
                const angle = Math.atan2(dy, dx);
                const moveForce = 0.01 * this.dna.speed;
                
                force.x = Math.cos(angle) * moveForce;
                force.y = Math.sin(angle) * moveForce;
                force.z = dz / distance * moveForce * 0.5;
            }
            
            return force;
        }
        
        // 他の生命体との相互作用（捕食を含む）
        interact(lifeforms, toxicMatters, anaerobicBacteria) {
            let steering = { x: 0, y: 0, z: 0 };
            let count = 0;
            
            // Boidの動きのための変数
            let separation = { x: 0, y: 0, z: 0 };
            let alignment = { x: 0, y: 0, z: 0 };
            let cohesion = { x: 0, y: 0, z: 0 };
            let flockCount = 0;
            let avgPosition = { x: 0, y: 0, z: 0 };
            let avgVelocity = { x: 0, y: 0, z: 0 };
            
            // 捕食対象または仲間を探す
            let preyFound = false;
            let closestPreyDist = Infinity;
            let closestPrey = null;
            
            // 知覚範囲を計算
            const perceptionRadius = 15 * this.dna.perception;
            
            for (const other of lifeforms) {
                if (other === this || other.isDead) continue;
                
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const dz = other.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < perceptionRadius) {
                    // 捕食者の場合、被食者を探す
                    if (this.isPredator && !other.isPredator && distance < closestPreyDist) {
                        if (this.dna.size > other.dna.size * 0.8) {
                            closestPreyDist = distance;
                            closestPrey = other;
                            preyFound = true;
                        }
                    }
                    
                    // 同じタイプの生命体との群れ行動
                    if (this.isPredator === other.isPredator) {
                        // 分離（Separation）
                        const separationForce = 1 / Math.max(0.1, distance);
                        separation.x += (dx / distance) * -separationForce;
                        separation.y += (dy / distance) * -separationForce;
                        separation.z += (dz / distance) * -separationForce;
                        
                        // 整列（Alignment）
                        alignment.x += other.velocity.x;
                        alignment.y += other.velocity.y;
                        alignment.z += other.velocity.z;
                        
                        // 結合（Cohesion）
                        avgPosition.x += other.position.x;
                        avgPosition.y += other.position.y;
                        avgPosition.z += other.position.z;
                        
                        flockCount++;
                    }
                    
                    // 捕食者と被食者の関係に基づく追加の力
                    if (this.isPredator && !other.isPredator) {
                        // 捕食者は被食者に引き寄せられる
                        steering.x += dx * 0.5;
                        steering.y += dy * 0.5;
                        steering.z += dz * 0.5;
                    } else if (!this.isPredator && other.isPredator) {
                        // 被食者は捕食者から逃げる
                        steering.x -= dx;
                        steering.y -= dy;
                        steering.z -= dz;
                    }
                    
                    count++;
                }
            }
            
            // Boidの動きを適用
            if (flockCount > 0) {
                // 分離の正規化と重み付け
                const sepMag = Math.sqrt(
                    separation.x * separation.x +
                    separation.y * separation.y +
                    separation.z * separation.z
                );
                if (sepMag > 0) {
                    separation.x = (separation.x / sepMag) * this.dna.separationWeight;
                    separation.y = (separation.y / sepMag) * this.dna.separationWeight;
                    separation.z = (separation.z / sepMag) * this.dna.separationWeight;
                }
                
                // 整列の正規化と重み付け
                alignment.x = (alignment.x / flockCount) * this.dna.alignmentWeight;
                alignment.y = (alignment.y / flockCount) * this.dna.alignmentWeight;
                alignment.z = (alignment.z / flockCount) * this.dna.alignmentWeight;
                
                // 結合の計算と重み付け
                avgPosition.x = avgPosition.x / flockCount;
                avgPosition.y = avgPosition.y / flockCount;
                avgPosition.z = avgPosition.z / flockCount;
                
                cohesion.x = (avgPosition.x - this.position.x) * this.dna.cohesionWeight;
                cohesion.y = (avgPosition.y - this.position.y) * this.dna.cohesionWeight;
                cohesion.z = (avgPosition.z - this.position.z) * this.dna.cohesionWeight;
                
                // すべての力を合成
                steering.x += separation.x + alignment.x + cohesion.x;
                steering.y += separation.y + alignment.y + cohesion.y;
                steering.z += separation.z + alignment.z + cohesion.z;
            }
            
            // 捕食行動
            if (preyFound && closestPrey && closestPreyDist < predationRange) {
                // 前回の捕食試行から一定時間経過している場合のみ捕食を試みる
                if (time - this.lastPredationAttemptTime > 20) {
                    this.lastPredationAttemptTime = time;
                    
                    // 捕食の成功率はサイズの差と基本成功率に依存
                    const sizeDifference = this.dna.size / closestPrey.dna.size;
                    const successChance = predationSuccessRate * sizeDifference;
                    
                    if (Math.random() < successChance) {
                        // 捕食成功
                        this.lastPredationTime = time;
                        
                        // 獲物からエネルギーを得る（70%のエネルギーを獲得）
                        const gainedEnergy = closestPrey.energy * predationEnergyGain;
                        this.energy += gainedEnergy;
                        this.energy = Math.min(this.energy, 1.0);  // エネルギー上限
                        
                        // 残りの30%のエネルギーは毒素として環境に排出
                        const wasteEnergy = closestPrey.energy * (1 - predationEnergyGain);
                        const toxicMatter = new ToxicMatter(
                            closestPrey.position.x,
                            closestPrey.position.y,
                            0,
                            wasteEnergy
                        );
                        // エネルギーロスに応じて毒性を設定（0.3-0.9の範囲）
                        toxicMatter.toxicity = 0.3 + (wasteEnergy * 0.6);
                        toxicMatters.push(toxicMatter);
                        
                        // 獲物を死亡させる
                        closestPrey.isDead = true;
                    }
                }
            }
            
            if (count > 0) {
                steering.x /= count;
                steering.y /= count;
                steering.z /= count;
                
                // ベクトルの正規化と速度の適用
                const magnitude = Math.sqrt(
                    steering.x * steering.x + 
                    steering.y * steering.y + 
                    steering.z * steering.z
                );
                
                if (magnitude > 0) {
                    steering.x = (steering.x / magnitude) * this.dna.speed * 0.5;
                    steering.y = (steering.y / magnitude) * this.dna.speed * 0.5;
                    steering.z = (steering.z / magnitude) * this.dna.speed * 0.5;
                }
            }
            
            // 毒素からの逃避行動
            const { nearestToxic, nearestDistance } = this.checkToxicInteraction(toxicMatters);
            if (nearestToxic) {
                const toxicPerceptionRadius = 20; // 毒素の知覚範囲
                if (nearestDistance < toxicPerceptionRadius) {
                    const dx = nearestToxic.position.x - this.position.x;
                    const dy = nearestToxic.position.y - this.position.y;
                    const dz = nearestToxic.position.z - this.position.z;
                    
                    // 距離に応じた逃避力を計算（近いほど強い）
                    const avoidanceForce = (toxicPerceptionRadius - nearestDistance) / toxicPerceptionRadius * 2;
                    steering.x -= dx * avoidanceForce;
                    steering.y -= dy * avoidanceForce;
                    steering.z -= dz * avoidanceForce;
                }
            }
            
            // 好気性バクテリアとの相互作用
            if (bacteria) {
                for (const bacterium of bacteria) {
                    if (!bacterium || bacterium.isDead) continue;
                    
                    const dx = bacterium.position.x - this.position.x;
                    const dy = bacterium.position.y - this.position.y;
                    const dz = bacterium.position.z - this.position.z;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    if (distance < perceptionRadius) {
                        // 捕食可能な距離内にいる場合
                        if (distance < predationRange && this.canPredate({ dna: { size: 0.5, toxicity: 0 }, energy: 0.3 })) {
                            // バクテリアを捕食し、エネルギーを得る
                            this.energy += predationEnergyGain * 0.3;  // バクテリアからのエネルギー獲得は通常の30%
                            bacterium.isDead = true;
                        }
                    }
                }
            }

            // 嫌気性バクテリアとの相互作用
            if (anaerobicBacteria) {  // 捕食性の条件を削除
                for (const bacteria of anaerobicBacteria) {
                    if (!bacteria || bacteria.isDead) continue;
                    
                    const dx = bacteria.position.x - this.position.x;
                    const dy = bacteria.position.y - this.position.y;
                    const dz = bacteria.position.z - this.position.z;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    if (distance < perceptionRadius) {
                        // 捕食可能な距離内にいる場合
                        if (distance < predationRange && this.canPredate({ dna: { size: 0.5, toxicity: 0 }, energy: 0.3 })) {
                            // バクテリアを捕食し、エネルギーを得る
                            this.energy += predationEnergyGain * 0.3;  // バクテリアからのエネルギー獲得は通常の30%
                            bacteria.isDead = true;
                        }
                    }
                }
            }
            
            return steering;
        }
        
        // 境界を超えないようにする力
        checkBoundaries() {
            const margin = 2;
            let force = { x: 0, y: 0, z: 0 };
            const boundaryForce = 0.05;
            
            // 水平方向の境界
            if (this.position.x < margin) {
                force.x = boundaryForce;
            } else if (this.position.x > width - margin) {
                force.x = -boundaryForce;
            }
            
            // 垂直方向の境界（水面と底面で異なる挙動）
            const surfaceMargin = 3;
            const bottomMargin = 4;
            
            if (this.position.y < surfaceMargin) {
                // 水面付近での挙動
                const depthFactor = this.position.y / surfaceMargin;
                force.y = boundaryForce * (1 - depthFactor) * 0.8;
                
                // 酸素レベルが高い場合、より強く押し下げる
                const surfaceOxygen = getOxygenAt(this.position.x, 0);
                if (surfaceOxygen > 0.5) {
                    force.y += boundaryForce * 0.4;
                }
            } else if (this.position.y > height - bottomMargin) {
                // 底面付近での挙動
                const heightFactor = (height - this.position.y) / bottomMargin;
                force.y = -boundaryForce * (1 - heightFactor);
                
                // 毒性物質が多い場合、より強く押し上げる
                const toxicCount = this.countNearbyToxic();
                if (toxicCount > 2) {
                    force.y -= boundaryForce * 0.3;
                }
            }
            
            return force;
        }
        
        // 近くの毒性物質をカウント
        countNearbyToxic() {
            if (!this.toxicMatters) return 0;
            
            let count = 0;
            const checkRadius = 5;
            
            for (const toxic of this.toxicMatters) {
                if (!toxic || toxic.decompositionStage === 2) continue;
                
                const dx = this.position.x - toxic.position.x;
                const dy = this.position.y - toxic.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    count++;
                }
            }
            
            return count;
        }
        
        // 物理演算を適用
        applyPhysics() {
            // 慣性係数（0に近いほど慣性が強い）
            const inertiaFactor = 0.1;
            
            // 重力（下向きの力）- 運動力が低いほど重力の影響が小さくなる
            const gravity = 0.01 * this.mass * (0.5 + this.dna.speed * 0.5);
            
            // 浮力（上向きの力）- 運動力が低いほど浮力が強くなる
            const depth = this.position.y / height;
            const buoyancyMultiplier = 1.5 - this.dna.speed; // 運動力が低いほど大きな値に
            const buoyancyForce = -0.015 * this.buoyancy * (depth + 0.2) * buoyancyMultiplier;
            
            // 水の抵抗（速度に比例、逆向きの力）- 運動力が低いほど抵抗が大きくなる
            const dragMultiplier = 1.2 - this.dna.speed * 0.5;
            const dragForce = {
                x: -this.velocity.x * this.dragCoefficient * dragMultiplier * (1 - inertiaFactor),
                y: -this.velocity.y * this.dragCoefficient * dragMultiplier * (1 - inertiaFactor),
                z: 0
            };
            
            // 慣性による速度の維持（前フレームの速度の一部を保持）
            this.velocity.x = this.velocity.x * (1 - inertiaFactor) + this.acceleration.x * inertiaFactor;
            this.velocity.y = this.velocity.y * (1 - inertiaFactor) + this.acceleration.y * inertiaFactor;
            
            // 合力を加速度に適用
            this.acceleration.y += gravity + buoyancyForce;
            this.acceleration.x += dragForce.x;
            this.acceleration.y += dragForce.y;
            
            // 最大速度制限（慣性を考慮）
            const maxSpeed = this.dna.speed * 1.5; // 慣性による一時的な速度超過を許容
            const currentSpeed = Math.sqrt(
                this.velocity.x * this.velocity.x +
                this.velocity.y * this.velocity.y
            );
            
            if (currentSpeed > maxSpeed) {
                const reduction = maxSpeed / currentSpeed;
                this.velocity.x *= reduction;
                this.velocity.y *= reduction;
            }
        }
        
        // 生命体の更新
        update(lifeforms, foods, toxicMatters, anaerobicBacteria) {  // anaerobicBacteriaパラメータを追加
            if (this.isDead) return;
            
            // 年齢を増加
            this.age++;
            
            // 酸素消費と二酸化炭素生成の処理
            let oxygenAvailable = false;
            let consumedOxygen = 0;
            let suffocating = true;

            // 現在位置の酸素を消費
            const currentOxygen = getOxygenAt(this.position.x, this.position.y);
            const baseOxygenNeed = 0.03; // さらに減少（0.05→0.03）：基本必要量を大幅に緩和
            const neededOxygen = baseOxygenNeed * (1 - this.dna.oxygenEfficiency * 0.7); // 0.5→0.7：DNAの影響をより強く

            // 最低酸素濃度の閾値をさらに下げる
            const minOxygenThreshold = 0.01; // 0.02→0.01：極限状態でも生存可能に

            if (currentOxygen >= minOxygenThreshold) {
                consumedOxygen = Math.min(neededOxygen, currentOxygen);
                changeOxygenAt(this.position.x, this.position.y, -consumedOxygen);
                oxygenAvailable = true;
                suffocating = consumedOxygen < neededOxygen * 0.3; // 0.4→0.3：窒息判定をさらに緩和
            } else {
                suffocating = true;
                this.energy -= energyDecayRate * 2; // 4→2：ペナルティをさらに緩和
            }

            // 酸欠による死亡判定をさらに緩和
            if (suffocating) {
                this.suffocationTime = (this.suffocationTime || 0) + 1;
                // 酸欠耐性時間を大幅に延長
                const maxSuffocationTime = 400 + (this.dna.oxygenTolerance * 200); // 基本値を2倍に
                
                // 深度に応じた耐性ボーナス（深いところにいる生物はより耐性が高い）
                const depthBonus = Math.min(200, (this.position.y / height) * 300);
                const adjustedMaxTime = maxSuffocationTime + depthBonus;
                
                if (this.suffocationTime > adjustedMaxTime) {
                    this.isDead = true;
                    return;
                }
                
                // エネルギー消費をより緩やかに
                const suffocationPenalty = Math.min(2, 0.5 + (this.suffocationTime / 200)); // より緩やかなペナルティ上昇
                this.energy -= energyDecayRate * suffocationPenalty;
                
                // 酸欠時の行動変化
                if (this.suffocationTime > 100) {
                    // 水面方向への移動を促進
                    this.velocity.y -= 0.01;
                }
            } else {
                // 回復をさらに早く
                this.suffocationTime = Math.max(0, this.suffocationTime - 4); // 2→4：より早い回復
            }

            // 窒息状態の視覚的な変化をより緩やかに
            if (suffocating) {
                this.suffocationLevel = Math.min(1, this.suffocationLevel + 0.02); // 0.05→0.02
            } else {
                this.suffocationLevel = Math.max(0, this.suffocationLevel - 0.04); // 0.03→0.04
            }

            // 酸素が少ない環境での適応メカニズム
            if (this.suffocationTime > 50) {
                // エネルギー消費を抑える（代謝を下げる）
                this.velocity.x *= 0.95;
                this.velocity.y *= 0.95;
                
                // 繁殖を抑制
                this.dna.reproductionRate *= 0.9;
            }

            // 高酸素環境での回復強化
            if (currentOxygen > 0.1 && !suffocating) {
                this.energy += this.dna.regenerationRate * 1.5;
                this.energy = Math.min(this.energy, 1.0);
            }
            
            // CO2を生成（消費した酸素量に応じて）
            const co2Amount = consumedOxygen * 1.1; // CO2生成量を適度に調整（1.2から1.1に）
            changeCO2At(this.position.x, this.position.y, co2Amount);
            
            // 周囲のCO2濃度が高すぎる場合の処理
            let highCO2 = false;
            for (let x = 0; x < gridWidth; x++) {
                for (let y = 0; y < gridHeight; y++) {
                    if (co2Map[x][y] > 0.6) { // CO2耐性閾値を適度に調整（0.5から0.6に）
                        highCO2 = true;
                        break;
                    }
                }
                if (highCO2) break;
            }
            
            // CO2濃度が高い場合のペナルティを調整
            if (highCO2) {
                this.energy -= 0.04 * (1 - this.dna.oxygenTolerance); // 0.025から0.04に増加
            }
            
            // 自然回復（酸素が十分にある場合のみ）
            if (oxygenAvailable && !highCO2) {
                this.energy += this.dna.regenerationRate;
                this.energy = Math.min(this.energy, 1.0);
            }
            
            // 食物を探す力（バクテリアも含める）
            const foodSeeking = this.seekFood(foods, bacteria);
            
            // 他の生命体との相互作用
            const interaction = this.interact(lifeforms, toxicMatters, anaerobicBacteria);  // anaerobicBacteriaを追加
            
            // 境界チェックを更新
            const boundaries = this.checkBoundaries();
            
            // 力を適用
            this.acceleration.x += (foodSeeking.x + interaction.x + boundaries.x) * 0.5;
            this.acceleration.y += (foodSeeking.y + interaction.y + boundaries.y) * 0.5;
            this.acceleration.z += (foodSeeking.z + interaction.z + boundaries.z) * 0.5;
            
            // 物理演算を適用
            this.applyPhysics();
            
            // 速度を更新
            this.velocity.x += this.acceleration.x;
            this.velocity.y += this.acceleration.y;
            this.velocity.z += this.acceleration.z;
            
            // 速度を制限
            const speed = Math.sqrt(
                this.velocity.x * this.velocity.x + 
                this.velocity.y * this.velocity.y + 
                this.velocity.z * this.velocity.z
            );
            
            const maxSpeed = 0.5 * this.dna.speed;
            
            if (speed > maxSpeed) {
                // 方向を維持しながら速度を制限
                const angle = Math.atan2(this.velocity.y, this.velocity.x);
                this.velocity.x = Math.cos(angle) * maxSpeed;
                this.velocity.y = Math.sin(angle) * maxSpeed;
                this.velocity.z = (this.velocity.z / speed) * maxSpeed * 0.5;
            }
            
            // 位置を更新
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
            this.position.z += this.velocity.z;
            
            // 加速度をリセット
            this.acceleration.x = 0;
            this.acceleration.y = 0;
            this.acceleration.z = 0;
            
            // 食物との衝突判定と摂取（バクテリアも含める）
            this.eatFood(foods, bacteria);
            
            // 繁殖判定
            if (this.energy > reproductionThreshold && 
                Math.random() < this.dna.reproductionRate * 0.02 && // 0.05から0.02に減少
                time - this.lastReproductionTime > 150) {  // 100から150に増加
                this.reproduce(lifeforms);
            }
            
            // 死亡判定をシンプルに
            if (this.energy <= 0 || this.age >= maxAge) {
                this.isDead = true;
            }

            // 毒素との相互作用によるダメージ
            const { totalDamage } = this.checkToxicInteraction(toxicMatters);
            if (totalDamage > 0) {
                this.energy -= totalDamage;
                if (this.energy <= 0) {
                    this.isDead = true;
                    return;
                }
            }
        }
        
        // 食物を食べる
        eatFood(foods, bacteria) {  // bacteriaパラメータを追加
            const eatDistance = 4;
            
            // 植物を食べる
            for (let i = foods.length - 1; i >= 0; i--) {
                const food = foods[i];
                const dx = this.position.x - food.position.x;
                const dy = this.position.y - food.position.y;
                const dz = this.position.z - food.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // 植物の根本（底部）付近でのみ食べられるように
                const isNearBase = Math.abs(this.position.y - food.position.y) < 3;
                
                // 植物が十分に成長していない場合のみ食べられる
                const isEatable = food.growthHeight < 5 && food.size < food.maxSize * 0.4;
                
                if (distance < eatDistance && isNearBase && isEatable) {
                    const damageAmount = 0.2 + (this.dna.size * 0.3);
                    const killed = food.takeDamage(damageAmount);
                    // エネルギー獲得量を植物の成長度に応じて減少
                    const maturityPenalty = 1 - (food.growthHeight / 5);
                    const gainedEnergy = food.size * food.energy * 0.3 * maturityPenalty;
                    this.energy += gainedEnergy;
                    this.energy = Math.min(this.energy, 1.0);

                    if (killed) {
                        foods.splice(i, 1);
                    }
                }
            }

            // バクテリアを食べる
            for (let i = bacteria.length - 1; i >= 0; i--) {
                const bacterium = bacteria[i];
                const dx = this.position.x - bacterium.position.x;
                const dy = this.position.y - bacterium.position.y;
                const dz = this.position.z - bacterium.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < eatDistance) {
                    // バクテリアを捕食
                    const gainedEnergy = bacterium.energy * 0.4;
                    this.energy += gainedEnergy;
                    this.energy = Math.min(this.energy, 1.0);

                    // バクテリアの再生処理
                    const newBacterium = new PurifierBacteria(
                        bacterium.position.x + (Math.random() - 0.5) * 4,
                        bacterium.position.y + (Math.random() - 0.5) * 4,
                        0
                    );
                    newBacterium.energy = 0.3;
                    newBacterium.purificationEfficiency = bacterium.purificationEfficiency * 0.9;
                    bacteria.splice(i, 1);
                    bacteria.push(newBacterium);
                }
            }
        }
        
        // 繁殖
        reproduce(lifeforms) {
            if (lifeforms.length >= maxLifeforms) return;
            if (time - this.lastReproductionTime < 100) return;  // 50から100に増加
            
            this.lastReproductionTime = time;
            
            // 親のエネルギー消費（子育ての度合いに応じて）
            const parentalInvestment = this.energy * 0.5; // 親のエネルギーの半分を投資
            this.energy -= parentalInvestment;
            
            // 複数の子孫を生成
            const offspringCount = this.dna.offspringCount;
            const energyPerChild = parentalInvestment / offspringCount; // 投資したエネルギーを均等に分配
            
            for (let i = 0; i < offspringCount; i++) {
                // 子孫のDNAを作成（突然変異を含む）
                const childDna = {};
                for (const [key, value] of Object.entries(this.dna)) {
                    // 各特性に突然変異を適用
                    const mutation = (Math.random() * 2 - 1) * mutationRate;
                    // 特性に応じて突然変異の影響を調整
                    const mutationScale = key === 'predatory' ? 0.5 : 1.0;
                    childDna[key] = value + mutation * mutationScale;
                    
                    // 値を適切な範囲に制限
                    if (key === 'socialBehavior') {
                        childDna[key] = Math.max(-1.0, Math.min(1.0, childDna[key]));
                    } else if (key === 'predatory') {
                        childDna[key] = Math.max(0.0, Math.min(1.0, childDna[key]));
                    } else if (key === 'offspringCount') {
                        childDna[key] = Math.max(1, Math.min(5, Math.round(childDna[key])));
                    } else {
                        childDna[key] = Math.max(0.1, Math.min(1.5, childDna[key]));
                    }
                }
                
                // 子孫を生成（エネルギーは親からの分配のみ）
                const offsetDistance = 2 + this.dna.parentalCare * 3;
                const offsetX = (Math.random() - 0.5) * offsetDistance;
                const offsetY = (Math.random() - 0.5) * offsetDistance;
                const offsetZ = (Math.random() - 0.5) * offsetDistance;
                
                const child = new Lifeform(
                    this.position.x + offsetX,
                    this.position.y + offsetY,
                    this.position.z + offsetZ,
                    energyPerChild, // 親から分配されたエネルギーのみを使用
                    childDna
                );
                
                lifeforms.push(child);
            }
        }

        // 毒素との相互作用をチェック
        checkToxicInteraction(toxicMatters) {
            let totalDamage = 0;
            let nearestToxic = null;
            let nearestDistance = Infinity;

            for (const toxic of toxicMatters) {
                if (toxic.decompositionStage !== 0) continue; // 未分解の毒素のみ

                const dx = toxic.position.x - this.position.x;
                const dy = toxic.position.y - this.position.y;
                const dz = toxic.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                // 接触判定（サイズを考慮）
                const contactThreshold = (this.size + 1) * 0.5;
                if (distance < contactThreshold) {
                    // 毒性に応じたダメージを計算
                    const toxicDamage = toxic.toxicity * 0.08 * (1 - this.toxicDamageResistance); // 0.05から0.08に増加
                    totalDamage += toxicDamage;
                }

                // 最も近い毒素を記録（逃避行動用）
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestToxic = toxic;
                }
            }

            return { totalDamage, nearestToxic, nearestDistance };
        }
    }
    
    // 食物クラスを植物クラスに変更
    class Plant {
        constructor(x, y, z, energy) {
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : height - 2 - Math.random() * 3,
                z: 0
            };
            this.energy = energy !== undefined ? energy : 0.3;
            this.age = 0;
            this.maxAge = 2000 + Math.floor(Math.random() * 1000);
            this.size = 0.05;
            this.maxSize = 0.2 + Math.random() * 0.2;
            this.reproductionThreshold = 0.6;
            this.lastReproductionTime = 0;
            this.height = 0;
            this.maxHeight = 40 + Math.random() * 60;  // 最大高さを40-100に半減
            this.growthHeight = 0;
            this.maxGrowthHeight = 30 + Math.random() * 45;  // 成長高さを30-75に半減
            
            // 物理特性を更新
            this.mass = this.size * 0.8 + 0.2;
            this.buoyancy = this.size * 0.4 + 0.1;
            this.dragCoefficient = 0.2;
            
            this.velocity = { x: 0, y: 0, z: 0 };
            this.acceleration = { x: 0, y: 0, z: 0 };
            
            // 根付きの強さ（底面との結合力）
            this.rootStrength = 0.95;
            
            // 沈殿状態を追加
            this.isSinking = y < height - 5;
            
            // 沈殿中の特性を保存
            if (this.isSinking) {
                this.initialEnergy = this.energy;
                this.initialSize = this.size;
            }

            this.health = 1.0;
            this.maxHealth = 1.0;
            this.nutrientAbsorptionRate = 0.05;  // 栄養吸収率を追加
        }
        
        // 捕食ダメージを受ける関数を追加
        takeDamage(amount) {
            this.health -= amount;
            this.size = Math.max(0.1, this.size * (this.health / this.maxHealth));
            return this.health <= 0;
        }
        
        applyPhysics() {
            // 沈殿中は通常の物理演算を適用
            if (this.isSinking) {
                // より強い重力
                const gravity = 0.015 * this.mass;
                
                // 弱い浮力
                const depth = this.position.y / height;
                const buoyancyForce = -0.005 * this.buoyancy * (depth + 0.2);
                
                // 水の抵抗
                const dragForce = {
                    x: -this.velocity.x * this.dragCoefficient,
                    y: -this.velocity.y * this.dragCoefficient,
                    z: 0
                };
                
                // 合力を適用
                this.acceleration.y += gravity + buoyancyForce;
                this.acceleration.x += dragForce.x;
                this.acceleration.y += dragForce.y;
                
                // 底面に到達したかチェック
                if (this.position.y >= height - 5) {
                    this.isSinking = false;
                    this.position.y = height - 1 - Math.random() * 2; // より底面に近く配置
                    this.velocity = { x: 0, y: 0, z: 0 }; // 速度をリセット
                }
            } else {
                // 通常の植物の物理演算（既存のコード）
                const gravity = 0.012 * this.mass;
                const depth = this.position.y / height;
                const buoyancyForce = -0.008 * this.buoyancy * (depth + 0.2);
                
                const dragForce = {
                    x: -this.velocity.x * this.dragCoefficient,
                    y: -this.velocity.y * this.dragCoefficient,
                    z: 0
                };
                
                // 根付きの効果
                const distanceFromBottom = Math.max(0, height - this.position.y);
                if (distanceFromBottom < 5) { // 15から5に変更
                    const rootingForce = -this.velocity.y * this.rootStrength * (1 - distanceFromBottom / 5);
                    dragForce.y += rootingForce;
                }
                
                this.acceleration.y += gravity + buoyancyForce;
                this.acceleration.x += dragForce.x;
                this.acceleration.y += dragForce.y;
            }
        }
        
        update(plants, toxicMatters) {
            if (this.isSinking) {
                // 沈殿中の処理は変更なし
                this.applyPhysics();
                
                // 速度を更新
                this.velocity.x += this.acceleration.x;
                this.velocity.y += this.acceleration.y;
                this.velocity.z += this.acceleration.z;
                
                // 位置を更新
                this.position.x += this.velocity.x;
                this.position.y += this.velocity.y;
                this.position.z += this.velocity.z;
                
                // 加速度をリセット
                this.acceleration = { x: 0, y: 0, z: 0 };
                
                // 底面到達時に植物として活性化
                if (this.position.y >= height - 15) {
                    this.isSinking = false;
                    this.position.y = height - 5 - Math.random() * 10;
                    this.velocity = { x: 0, y: 0, z: 0 };
                    this.energy = this.initialEnergy;
                    this.size = this.initialSize;
                    this.age = 0;
                }
                
                return false;
            }
            
            this.age++;
            
            // 死亡判定を先に行い、死骸を生成
            if (this.age >= this.maxAge || this.energy <= 0 || this.health <= 0) {
                // 植物の死骸を生成
                const debris = new PlantDebris(
                    this.position.x,
                    this.position.y,
                    0,
                    this.size * 0.8
                );
                
                // 死骸の初期位置を植物の高さに応じて設定
                if (this.growthHeight > 0) {
                    // 複数の死骸を生成（高さに応じて）
                    const debrisCount = Math.max(1, Math.floor(this.growthHeight / 20)); // 20単位ごとに1つの死骸
                    for (let i = 0; i < debrisCount; i++) {
                        const heightOffset = (i / debrisCount) * this.growthHeight;
                        const horizontalOffset = (Math.random() - 0.5) * 2;
                        const newDebris = new PlantDebris(
                            this.position.x + horizontalOffset,
                            this.position.y - heightOffset,
                            0,
                            this.size * (0.5 + Math.random() * 0.3) // サイズにばらつきを持たせる
                        );
                        plantDebris.push(newDebris);
                    }
                } else {
                    // 根本の死骸
                    plantDebris.push(debris);
                }
                
                return true;
            }
            
            // 上方向への成長速度を調整
            if (this.energy > 0.4 && this.growthHeight < this.maxGrowthHeight) {
                const heightGrowthRate = 0.01;  // 成長速度
                const growthEnergyCost = heightGrowthRate * 0.3;  // 成長に必要なエネルギー

                // エネルギーが十分にある場合のみ成長
                if (this.energy > growthEnergyCost + 0.2) {  // 0.2は安全マージン
                    this.growthHeight += heightGrowthRate;
                    this.energy -= growthEnergyCost;  // 成長のためのエネルギー消費
                    
                    // 高さに応じた維持コストを計算
                    const heightMaintenanceCost = (this.growthHeight / this.maxGrowthHeight) * 0.003;
                    this.energy -= heightMaintenanceCost;
                }
            }
            
            // 光合成と酸素生成（CO2を考慮）
            let co2Available = false;
            let consumedCO2 = 0;
            
            // 現在位置のCO2を消費
            const currentCO2 = getCO2At(this.position.x, this.position.y);
            
            if (currentCO2 > 0) {
                consumedCO2 = Math.min(currentCO2, 0.005);
                changeCO2At(this.position.x, this.position.y, -consumedCO2);
                co2Available = true;
            }
            
            // 高さに応じた光合成効率を計算（より現実的な曲線に）
            const heightEfficiency = 1 + Math.pow(this.growthHeight / this.maxGrowthHeight, 0.7);  // べき乗を使用して非線形な効率上昇を実現
            
            // CO2の有無で光合成効率が変化
            const photosynthesisRate = co2Available ? 0.002 : 0.0005;
            const energyGain = photosynthesisRate * heightEfficiency * (1 + consumedCO2 * 30);
            this.energy = Math.min(1.0, this.energy + energyGain);  // エネルギー上限を設定
            
            // 酸素を生成（CO2消費量に応じて生成量が増加）
            if (this.energy > 0.4 && Math.random() < 0.2) {
                const oxygenAmount = oxygenProductionRate * this.size * heightEfficiency * (1 + consumedCO2 * 50);
                
                // 植物の周囲に酸素を放出（高さに応じた位置から）
                for (let i = 0; i < 2; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 2 + Math.random() * 3;
                    const offsetX = Math.cos(angle) * distance;
                    const offsetY = Math.sin(angle) * distance;
                    
                    // 酸素放出位置を成長高さに応じて調整
                    const releaseHeight = this.growthHeight * (0.7 + Math.random() * 0.3); // 成長高さの70-100%の位置から放出
                    changeOxygenAt(
                        this.position.x + offsetX,
                        this.position.y - releaseHeight + offsetY,
                        oxygenAmount * (0.8 + Math.random() * 0.4)
                    );
                }
            }
            
            // 成長処理（サイズの成長にもエネルギーが必要）
            if (this.size < this.maxSize && this.energy > 0.4) {
                const growthRate = 0.00005;
                const sizeGrowthCost = growthRate * 0.6;  // サイズ成長のコストを増加
                
                if (this.energy > sizeGrowthCost + 0.2) {  // 0.2は安全マージン
                    this.size += growthRate;
                    this.energy -= sizeGrowthCost;
                }
            }
            
            // エネルギー消費（高さに応じて増加）
            const baseEnergyCost = 0.00015;
            const heightCost = (this.growthHeight / this.maxGrowthHeight) * 0.0003;  // 高さに応じたコスト
            this.energy -= (baseEnergyCost + heightCost) * this.size;
            
            // 物理演算を適用
            this.applyPhysics();
            
            // 速度と位置の更新（ただし、根付いた後は横方向の移動のみ）
            this.velocity.x += this.acceleration.x;
            this.velocity.y += this.acceleration.y;
            this.position.x += this.velocity.x;
            
            // 加速度をリセット
            this.acceleration = { x: 0, y: 0, z: 0 };
            
            // 体力回復
            if (this.health < this.maxHealth) {
                this.health = Math.min(this.maxHealth, this.health + 0.0002);
                this.size = Math.max(0.1, this.size * (this.health / this.maxHealth));
            }

            // 近くの堆肥から栄養を吸収
            if (toxicMatters) {
                for (const matter of toxicMatters) {
                    if (matter.decompositionStage === 2) {  // 完全に分解された堆肥のみ
                        const dx = this.position.x - matter.position.x;
                        const dy = this.position.y - matter.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < 5) {  // 吸収範囲内
                            const absorptionAmount = this.nutrientAbsorptionRate * matter.nutrientValue;
                            this.energy = Math.min(1.0, this.energy + absorptionAmount);
                            
                            // 成長速度も栄養価に応じて変化
                            if (this.size < this.maxSize) {
                                const growthBonus = matter.nutrientValue * 0.0001;
                                this.size = Math.min(this.maxSize, this.size + growthBonus);
                            }

                            // 堆肥の栄養価は徐々に減少
                            matter.nutrientValue = Math.max(0, matter.nutrientValue - absorptionAmount);
                        }
                    }
                }
            }

            return this.age >= this.maxAge || this.energy <= 0 || this.health <= 0;
        }
        
        reproduce(plants) {
            const reproductionCost = 0.4;
            if (time - this.lastReproductionTime < 100) return;
            this.energy -= reproductionCost;
            this.lastReproductionTime = time;
            
            // 繁殖方向をランダムに選択（横または上）
            const isVerticalGrowth = Math.random() < 0.2; // 20%から10%に減少（上方向への成長をさらに抑制）
            
            if (isVerticalGrowth && this.position.y > height * 0.7) { // 下層70%以下でのみ上方向に成長可能
                // 上方向への繁殖距離を短く
                const newPlant = new Plant(
                    this.position.x + (Math.random() - 0.5) * 2,
                    Math.max(this.position.y - 3 - Math.random() * 3, height * 0.7), // 下層70%より上には行かない
                    0,
                    0.4
                );
                newPlant.maxSize = this.maxSize * (0.95 + Math.random() * 0.2);
                plants.push(newPlant);
            } else {
                // 横方向への繁殖（複数の子孫を生成）
                const spreadCount = 1 + Math.floor(Math.random() * 2); // 1-2個の子孫
                for (let i = 0; i < spreadCount; i++) {
                    const spreadDistance = 5 + this.size * 5;
                    const offsetX = (Math.random() - 0.5) * spreadDistance;
                    
                    const newPlant = new Plant(
                        this.position.x + offsetX,
                        Math.min(this.position.y + (Math.random() - 0.5) * 2, height - 1), // 底面より下には行かない
                        0,
                        0.4
                    );
                    newPlant.maxSize = this.maxSize * (0.95 + Math.random() * 0.2);
                    plants.push(newPlant);
                }
            }
        }
    }
    
    // 毒性物質クラスを追加
    class ToxicMatter {
        constructor(x, y, z, energy) {
            this.position = { x, y, z };
            this.velocity = { x: 0, y: 0.3, z: 0 };
            this.acceleration = { x: 0, y: 0, z: 0 };
            this.energy = energy;
            this.toxicity = 0.8;
            this.mass = 0.8;
            this.buoyancy = 0.15; // 浮力を低下（0.15のまま）
            this.dragCoefficient = 0.15;
            this.age = 0;
            this.maxAge = 2000;
            this.isSettled = false;
            this.settlingTime = 0;
            this.decompositionStage = 0;
            this.decompositionProgress = 0;
            this.bacteriaCount = 0;
            this.stackHeight = 0;
            
            this.targetDepth = height - 1;
            this.maxLocalDensity = 3;
            this.upwardMoveSpeed = 0.2; // 上方向への移動速度を低下（0.5から0.2に）
            this.layerHeight = 2;
            this.maxToxicDensity = 4;
            this.decompositionRate = 0.005; // 0.0008から0.005に増加（分解速度を約6倍に）
            this.groundFriction = 0.95; // 地面との摩擦係数を追加
            this.nutrientValue = 0;  // 栄養価を追加
            this.settlingThreshold = 60;  // 200から60に短縮（約1秒）
        }

        // 未分解毒素の密度をチェック
        checkToxicDensity(toxicMatters) {
            let localCount = 0;
            const checkRadius = 3;
            const currentLayer = Math.floor(this.position.y / this.layerHeight);
            
            for (const matter of toxicMatters) {
                if (matter === this || matter.decompositionStage !== 0) continue;
                
                const matterLayer = Math.floor(matter.position.y / this.layerHeight);
                if (matterLayer !== currentLayer) continue;
                
                const dx = this.position.x - matter.position.x;
                const dy = this.position.y - matter.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    localCount++;
                }
            }
            
            return localCount;
        }

        // 分解済み毒素の密度をチェックする関数を追加
        checkDecomposedDensity(toxicMatters) {
            let localCount = 0;
            const checkRadius = 3;
            const currentLayer = Math.floor(this.position.y / this.layerHeight);
            
            for (const matter of toxicMatters) {
                if (matter === this || matter.decompositionStage < 2) continue;
                
                const matterLayer = Math.floor(matter.position.y / this.layerHeight);
                if (matterLayer !== currentLayer) continue;
                
                const dx = this.position.x - matter.position.x;
                const dy = this.position.y - matter.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    localCount++;
                }
            }
            
            return localCount;
        }

        applyPhysics() {
            if (this.isSettled) {
                // 定着後は横方向の動きのみ減衰
                this.velocity.x *= this.groundFriction;
                this.velocity.y = 0;
                return;
            }

            // 重力の影響
            const gravity = 0.05;
            this.acceleration.y += gravity;

            // 浮力の影響（分解段階に応じて変化）
            let currentBuoyancy = this.buoyancy;
            if (this.decompositionStage > 0) {
                currentBuoyancy *= Math.max(0.1, 1 - (this.decompositionProgress * 0.5));
            }
            
            // 水面付近での特殊な浮力処理
            const surfaceMargin = 3;
            if (this.position.y < surfaceMargin) {
                const surfaceFactor = 1 - (this.position.y / surfaceMargin);
                currentBuoyancy *= (1 - surfaceFactor * 0.7); // 水面付近で浮力を70%まで減少
            }
            
            const buoyancyForce = -gravity * currentBuoyancy;
            this.acceleration.y += buoyancyForce;

            // 抵抗力
            const dragForce = {
                x: -this.velocity.x * this.dragCoefficient,
                y: -this.velocity.y * this.dragCoefficient
            };
            this.acceleration.x += dragForce.x;
            this.acceleration.y += dragForce.y;

            // 底面との衝突判定と堆積処理
            if (this.position.y >= height - 1) {
                this.position.y = height - 1;
                this.velocity.y = 0;
                this.acceleration.y = 0;
                
                // 堆積判定の改善
                const horizontalSpeed = Math.abs(this.velocity.x);
                if (horizontalSpeed < 0.01) {
                    this.settlingTime++;
                    // 分解段階に応じて定着時間を調整
                    const requiredSettlingTime = this.decompositionStage === 0 ? 30 : 20;
                    if (this.settlingTime > requiredSettlingTime) {
                        this.isSettled = true;
                        this.velocity.x = 0;
                    }
                } else {
                    // 動きが大きい場合は定着カウントをリセット
                    this.settlingTime = Math.max(0, this.settlingTime - 1);
                }
                
                // 地面との摩擦
                this.velocity.x *= this.groundFriction;
            }

            // 水面付近での特殊処理
            const waterSurfaceY = 2;
            if (this.position.y <= waterSurfaceY) {
                // 水面での張力効果
                const surfaceTension = 0.02;
                this.acceleration.y += surfaceTension;
                
                // 分解段階が進んでいる場合は水面下に沈みやすく
                if (this.decompositionStage > 0) {
                    this.acceleration.y += gravity * 0.5;
                }
                
                // 水面での横方向の動きを制限
                this.velocity.x *= 0.95;
            }

            // 側面との衝突判定（より自然な反発）
            if (this.position.x < 0) {
                this.position.x = 0;
                this.velocity.x = Math.abs(this.velocity.x) * 0.5;
                // 壁との摩擦を考慮
                this.velocity.y *= 0.9;
            } else if (this.position.x >= width) {
                this.position.x = width - 1;
                this.velocity.x = -Math.abs(this.velocity.x) * 0.5;
                // 壁との摩擦を考慮
                this.velocity.y *= 0.9;
            }
        }

        update(plants, toxicMatters) {
            this.age++;
            
            if (!this.isSettled) {
                this.applyPhysics();

                // 速度の更新（より制限的に）
                this.velocity.x = Math.max(-0.5, Math.min(0.5, this.velocity.x + this.acceleration.x));
                this.velocity.y = Math.max(-0.8, Math.min(0.8, this.velocity.y + this.acceleration.y));
                
                this.position.x += this.velocity.x;
                this.position.y += this.velocity.y;

                // 加速度をリセット
                this.acceleration.x = 0;
                this.acceleration.y = 0;
            } else {
                // 定着後の処理
                if (this.decompositionStage > 0) {
                    // 分解が進んだ物質は徐々に沈降
                    const sinkRate = 0.001 * this.decompositionProgress;
                    this.position.y = Math.min(height - 1, this.position.y + sinkRate);
                }

                // 局所密度チェックと位置調整（より穏やかに）
                const localCount = this.checkLocalDensity(toxicMatters);
                if (localCount > this.maxLocalDensity) {
                    // 横方向へのゆっくりとした移動
                    this.position.x += (Math.random() - 0.5) * 0.1;
                    this.position.x = Math.max(0, Math.min(width - 1, this.position.x));
                }
            }

            // バクテリアがいる場合のみ分解が進行
            if (this.settlingTime > this.settlingThreshold && this.bacteriaCount > 0) {
                if (this.decompositionStage === 0) {
                    this.decompositionStage = 1;
                }
                
                if (this.decompositionStage === 1) {
                    // バクテリアの数に応じて分解速度が変化（最大効率に制限）
                    const maxEffectiveBacteria = 3;  // 5から3に減少（より少ないバクテリアで最大効率に）
                    const effectiveBacteriaCount = Math.min(this.bacteriaCount, maxEffectiveBacteria);
                    const decompositionRate = this.decompositionRate * effectiveBacteriaCount;
                    this.decompositionProgress += decompositionRate;
                    
                    // 毒性が減少すると同時に栄養価が上昇（変換効率を上げる）
                    const convertedAmount = decompositionRate * 5;  // 3から5に増加
                    this.toxicity = Math.max(0, this.toxicity - convertedAmount);
                    this.nutrientValue = Math.min(1.0, this.nutrientValue + (convertedAmount * 0.8));
                }
            }

            // 完全に分解された場合、周囲の堆積物の濃度をチェック
            if (this.decompositionStage === 2) {
                const localCount = this.checkDecomposedDensity(toxicMatters);
                const maxLocalCount = 5; // 最大堆積数
                
                if (localCount > maxLocalCount) {
                    // 堆積が多い場合、上に移動
                    const newY = this.position.y - 1;
                    if (newY > 0) { // 画面上端を超えないように
                        this.position.y = newY;
                        this.stackHeight++;
                    }
                }
            }
            
            // 堆肥化完了後、一定確率で植物を生成
            if (this.decompositionStage === 2 && Math.random() < 0.01 && this.position.y > height * 0.7) {
                const newPlant = new Plant(
                    this.position.x + (Math.random() - 0.5) * 2,
                    Math.min(this.position.y, height - 1), // 底面より下には行かない
                    0,
                    this.energy * 0.4
                );
                newPlant.size = 0.05 + Math.random() * 0.1;
                newPlant.maxSize = 0.2 + Math.random() * 0.3;
                plants.push(newPlant);
                return true;
            }

            // バクテリアカウントをリセット（毎フレーム）
            this.bacteriaCount = 0;

            // 堆積物の密度チェックと位置調整
            if (this.decompositionStage === 2) {
                const { count, lowestY } = this.checkLocalDensity(toxicMatters);
                
                if (count > this.maxLocalDensity) {
                    // 徐々に上昇（急激な変化を防ぐ）
                    const targetY = lowestY - 2;
                    if (this.position.y > targetY) {
                        this.position.y -= this.upwardMoveSpeed;
                        this.stackHeight = Math.floor((height - this.position.y) / 2);
                    }
                }
            }

            return this.age >= this.maxAge;
        }

        checkLocalDensity(toxicMatters) {
            let localCount = 0;
            const checkRadius = 3;
            let lowestY = this.position.y;
            
            for (const matter of toxicMatters) {
                if (matter === this || matter.decompositionStage !== 2) continue;
                
                const dx = this.position.x - matter.position.x;
                const dy = this.position.y - matter.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    localCount++;
                    lowestY = Math.max(lowestY, matter.position.y);
                }
            }
            
            return { count: localCount, lowestY: lowestY };
        }
    }
    
    // 浄化バクテリアクラスを追加
    class PurifierBacteria {
        constructor(x, y, z) {
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : height - 2 - Math.random() * 3,
                z: z || 0
            };
            this.energy = 0.5 + Math.random() * 0.3;
            this.age = 0;
            this.maxAge = 300 + Math.floor(Math.random() * 200); // 寿命を300-500に短縮
            this.purificationEfficiency = 0.7 + Math.random() * 0.3;
            this.size = 0.1 + Math.random() * 0.1;
            this.velocity = { x: 0, y: 0, z: 0 };
            this.searchRadius = 20;
            this.currentTarget = null;
            this.oxygenEfficiency = 0.4 + Math.random() * 0.4;
            this.oxygenReserve = 0.5;
            this.maxOxygenReserve = 1.0;
            this.oxygenConsumptionRate = 0.015; // 酸素消費率を0.008から0.015に増加
            this.co2ProductionRate = 0.012; // CO2生成率を0.006から0.012に増加
            this.speed = 0.3;
        }

        // 酸素を探して吸収する関数
        findAndConsumeOxygen(oxygens) {
            if (!oxygens || !oxygens.getOxygenAt || !oxygens.changeOxygenAt) return false;
            
            // 現在位置の酸素を消費
            const currentOxygen = oxygens.getOxygenAt(this.position.x, this.position.y);
            
            if (currentOxygen > 0) {
                const consumedAmount = Math.min(currentOxygen, 0.02); // 0.01から0.02に増加
                oxygens.changeOxygenAt(this.position.x, this.position.y, -consumedAmount);
                this.oxygenReserve = Math.min(this.maxOxygenReserve, this.oxygenReserve + consumedAmount * 0.8);
                return consumedAmount > 0;
            }
            
            return false;
        }

        update(toxicMatters, plants, oxygens) {
            if (!toxicMatters) toxicMatters = [];
            if (!plants) plants = [];
            if (!oxygens) {
                oxygens = {
                    getOxygenAt: function(x, y) { return 0.2; },
                    changeOxygenAt: function(x, y, amount) {}
                };
            }

            this.age++;

            // 基礎代謝によるエネルギー消費
            this.energy -= 0.001 * (1 + this.size);

            // 移動によるエネルギー消費
            const movementCost = Math.sqrt(
                this.velocity.x * this.velocity.x +
                this.velocity.y * this.velocity.y
            ) * 0.002;
            this.energy -= movementCost;

            // 酸素消費と二酸化炭素生成
            const baseOxygenConsumption = this.oxygenConsumptionRate * (1 - this.oxygenEfficiency * 0.5);
            this.oxygenReserve = Math.max(0, this.oxygenReserve - baseOxygenConsumption);

            // CO2を生成（消費した酸素量に応じて）
            if (typeof changeCO2At === 'function') {
                const co2Amount = baseOxygenConsumption * this.co2ProductionRate;
                changeCO2At(this.position.x, this.position.y, co2Amount);
            }
            
            // 酸素を探して吸収
            if (oxygens && typeof oxygens.getOxygenAt === 'function') {
                this.findAndConsumeOxygen(oxygens);
            }
            
            // 酸素不足時は活動を制限
            const oxygenFactor = Math.min(1, this.oxygenReserve / 0.2);
            
            // 酸素不足によるダメージ
            if (this.oxygenReserve < 0.1) {
                this.energy -= 0.005 * (1 - this.oxygenReserve * 10);
            }

            // 死亡条件をチェック
            if (this.energy <= 0 || this.age >= this.maxAge) {
                return true;
            }
            
            // 酸素不足時は休眠状態になる（活動停止）
            if (this.oxygenReserve < 0.05) {
                // 休眠状態では動かない
                this.velocity.x = 0;
                this.velocity.y = 0;
                return false;
            }
            
            // 現在の対象がなければ新しい毒素を探す
            let foundToxic = false;
            
            // 現在の対象がなければ新しい毒素を探す
            if (!this.currentTarget) {
                let closestDist = this.searchRadius * oxygenFactor;
                let closestToxic = null;

                for (const toxic of toxicMatters) {
                    if (toxic && toxic.isSettled && toxic.decompositionStage !== 2) {
                        const dx = this.position.x - toxic.position.x;
                        const dy = this.position.y - toxic.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < closestDist) {
                            closestDist = distance;
                            closestToxic = toxic;
                        }
                    }
                }

                if (closestToxic) {
                    this.currentTarget = closestToxic;
                }
            }

            // 対象が見つかった場合の処理
            if (this.currentTarget) {
                const dx = this.currentTarget.position.x - this.position.x;
                const dy = this.currentTarget.position.y - this.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 3) {
                    foundToxic = true;
                    this.currentTarget.bacteriaCount++;
                    
                    // エネルギー獲得（効率は酸素量に依存）
                    const energyGain = 0.002 * this.purificationEfficiency * oxygenFactor;
                    this.energy = Math.min(1.0, this.energy + energyGain);
                    
                    // 繁殖判定を追加
                    if (this.energy > 0.7 && Math.random() < 0.05 * oxygenFactor) {
                        this.reproduce();
                    }
                } else {
                    // 対象に向かって移動（角度ベースの移動を実装）
                    const angle = Math.atan2(dy, dx);
                    const moveSpeed = this.speed * oxygenFactor;
                    this.velocity.x = Math.cos(angle) * moveSpeed;
                    this.velocity.y = Math.sin(angle) * moveSpeed;
                }
            } else {
                // ランダムな移動（より制限された範囲で）
                if (Math.random() < 0.05) {
                    this.velocity.x = (Math.random() - 0.5) * 0.1;
                    this.velocity.y = (Math.random() - 0.5) * 0.1;
                }
            }

            // 位置の更新と境界チェック
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;

            // 水平方向の境界
            if (this.position.x < 0) {
                this.position.x = 0;
                this.velocity.x *= -0.5;
            } else if (this.position.x >= width) {
                this.position.x = width - 1;
                this.velocity.x *= -0.5;
            }
            
            // 垂直方向の境界（水面と底面での特殊な挙動）
            const surfaceMargin = 2;
            const bottomMargin = 3;
            
            if (this.position.y < surfaceMargin) {
                // 水面付近での挙動
                const surfaceOxygen = oxygens.getOxygenAt(this.position.x, 0);
                if (surfaceOxygen > 0.5) {
                    // 酸素が豊富な場合は水面付近に留まりやすく
                    this.position.y = Math.max(1, this.position.y);
                    this.velocity.y *= 0.5;
                } else {
                    // 酸素が少ない場合は下に移動
                    this.velocity.y += 0.01;
                }
            } else if (this.position.y >= height - bottomMargin) {
                // 底面付近での挙動
                this.position.y = Math.min(height - 1, this.position.y);
                this.velocity.y *= -0.3;
            }

            // 自然な繁殖判定を追加（エネルギーと酸素が十分にある場合）
            if (this.energy > 0.8 && this.oxygenReserve > 0.4 && Math.random() < 0.02) {
                this.reproduce();
            }

            return false;
        }

        reproduce() {
            if (bacteria.length >= bacteriaMaxCount) return false;

            // エネルギーと酸素を消費して子孫を生成
            const offspringCount = 1 + Math.floor(Math.random() * 2);
            const energyCost = this.energy * 0.4;
            const oxygenCost = this.oxygenReserve * 0.3;
            this.energy -= energyCost;
            this.oxygenReserve -= oxygenCost;

            for (let i = 0; i < offspringCount; i++) {
                const spreadDistance = 3 + Math.random() * 2;
                const angle = Math.random() * Math.PI * 2;
                
                const child = new PurifierBacteria(
                    this.position.x + Math.cos(angle) * spreadDistance,
                    this.position.y + Math.sin(angle) * spreadDistance,
                    0
                );
                
                // 特性の継承と突然変異
                child.purificationEfficiency = Math.max(0.1, Math.min(1.0,
                    this.purificationEfficiency + (Math.random() - 0.5) * 0.2
                ));
                child.oxygenEfficiency = Math.max(0.1, Math.min(1.0,
                    this.oxygenEfficiency + (Math.random() - 0.5) * 0.2
                ));
                
                // エネルギーと酸素の分配
                child.energy = energyCost / offspringCount * 0.8;
                child.oxygenReserve = oxygenCost / offspringCount * 0.8;
                
                bacteria.push(child);
            }
            
            return false;
        }
    }
    
    // 植物の死骸クラスを追加
    class PlantDebris {
        constructor(x, y, z, size) {
            this.position = { x, y, z };
            this.velocity = { x: 0, y: 0.1, z: 0 };
            this.acceleration = { x: 0, y: 0, z: 0 };
            this.size = size;
            this.mass = size * 1.2;  // 質量を増加（0.8から1.2に）
            this.buoyancy = size * 0.2;  // 浮力を減少（0.3から0.2に）
            this.dragCoefficient = 0.15;  // 抵抗係数を調整（0.2から0.15に）
            this.age = 0;
            this.maxAge = 1000 + Math.floor(Math.random() * 500);
            this.decompositionProgress = 0;
            this.isSettled = false;
            this.anaerobicBacteriaCount = 0;
            this.isCompost = false;
            this.compostNutrientValue = 0;
            this.color = {
                hue: 30,
                saturation: 60,
                lightness: 30,
                opacity: 70
            };
            this.stackHeight = 0;
            this.maxLocalDensity = 3;
            this.upwardMoveSpeed = 0.5;
            this.decompositionRate = 0.003;
            this.bacteriaEfficiency = 1.2;
            this.settlingTime = 0;  // 沈殿時間を追加
        }

        // 周囲の堆肥の濃度をチェック
        checkCompostDensity(plantDebris) {
            let localCompostCount = 0;
            const checkRadius = 3;
            
            for (const debris of plantDebris) {
                if (debris === this || !debris.isCompost) continue;
                
                const dx = this.position.x - debris.position.x;
                const dy = this.position.y - debris.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    localCompostCount++;
                }
            }
            
            return localCompostCount;
        }

        applyPhysics() {
            if (this.isSettled) return;

            // 重力の影響を強化
            const gravity = 0.03 * this.mass;
            this.acceleration.y += gravity;

            // 浮力の影響を弱める
            const depth = this.position.y / height;
            const buoyancyForce = -gravity * this.buoyancy * 0.3;
            this.acceleration.y += buoyancyForce;
            
            // 水の抵抗力を調整
            const dragForce = {
                x: -this.velocity.x * this.dragCoefficient * 1.2,
                y: -this.velocity.y * this.dragCoefficient * 0.8
            };
            
            this.acceleration.x += dragForce.x;
            this.acceleration.y += dragForce.y;
            
            // 底面との衝突判定と堆積処理を改善
            if (this.position.y >= height - 2) {
                this.position.y = height - 1;
                this.velocity.y *= -0.1;
                this.velocity.x *= 0.7;
                
                // 沈殿時間をカウント
                this.settlingTime++;
                
                // 速度が十分小さく、一定時間経過したら定着
                if (Math.abs(this.velocity.y) < 0.01 && 
                    Math.abs(this.velocity.x) < 0.01 &&
                    this.settlingTime > 30) {
                    this.isSettled = true;
                    this.velocity = { x: 0, y: 0, z: 0 };
                }
            } else {
                this.settlingTime = 0;
            }

            // 速度の更新（より自然な動きに）
            this.velocity.x = Math.max(-0.5, Math.min(0.5, this.velocity.x + this.acceleration.x));
            this.velocity.y = Math.max(-0.8, Math.min(0.8, this.velocity.y + this.acceleration.y));
            
            // 位置の更新
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;

            // 加速度をリセット
            this.acceleration.x = 0;
            this.acceleration.y = 0;
        }

        update(bacteria, anaerobicBacteria, plantDebris) {
            this.age++;
            
            if (!this.isSettled) {
                this.applyPhysics();
                
                // 速度と位置の更新
                this.velocity.x += this.acceleration.x;
                this.velocity.y += this.acceleration.y;
                this.position.x += this.velocity.x;
                this.position.y += this.velocity.y;

                // 底面に到達したら定着
                if (this.position.y >= height - 2) {
                    this.position.y = height - 2;
                    this.isSettled = true;
                    this.velocity = { x: 0, y: 0, z: 0 };
                }
                
                return false;
            }

            // 好気性バクテリアと嫌気性バクテリアの両方による分解
            let totalDecomposition = 0;

            // 好気性バクテリアによる分解
            for (const bacterium of bacteria) {
                const dx = this.position.x - bacterium.position.x;
                const dy = this.position.y - bacterium.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 3) {
                    totalDecomposition += this.decompositionRate * this.bacteriaEfficiency;
                }
            }

            // 嫌気性バクテリアによる分解
            if (this.anaerobicBacteriaCount > 0) {
                totalDecomposition += this.decompositionRate * this.anaerobicBacteriaCount;
            }

            // 分解の進行
            if (totalDecomposition > 0) {
                this.decompositionProgress += totalDecomposition;
                
                // 色の更新（より暗い茶色へ）
                this.color.hue = 30;
                this.color.saturation = 40 + this.decompositionProgress * 20;
                this.color.lightness = Math.max(20, 30 - this.decompositionProgress * 10);
                this.color.opacity = Math.max(40, 70 - this.decompositionProgress * 20);
                
                // 完全に分解されたら堆肥に変換
                if (this.decompositionProgress >= 1 && !this.isCompost) {
                    this.isCompost = true;
                    this.compostNutrientValue = this.size * 0.7;
                    this.color = {
                        hue: 25,
                        saturation: 70,
                        lightness: 15,
                        opacity: 90
                    };
                    
                    // 一定確率で新しい植物を生成（位置を調整）
                    if (Math.random() < 0.3) {
                        const newPlant = new Plant(
                            this.position.x + (Math.random() - 0.5) * 2,
                            height - 1, // 必ず底面に生成
                            0,
                            0.3
                        );
                        newPlant.size = 0.05 + Math.random() * 0.1;
                        newPlant.maxSize = 0.2 + Math.random() * 0.3;
                        plants.push(newPlant);
                    }
                }
            }

            // カウントをリセット
            this.anaerobicBacteriaCount = 0;

            // 堆積物の密度チェックと位置調整（より制限的に）
            if (this.isCompost) {
                const localCompostCount = this.checkCompostDensity(plantDebris);
                if (localCompostCount > this.maxLocalDensity) {
                    // より制限的な上方移動
                    const newY = this.position.y - 0.05; // 移動速度をさらに減少
                    if (newY >= height - 3) { // 底面からの最大移動範囲を制限
                        this.position.y = newY;
                    } else {
                        this.position.y = height - 3; // 最大移動高度を制限
                    }
                }
            } else {
                // 非堆肥状態では底面に留まる
                this.position.y = height - 1;
            }

            return this.age >= this.maxAge;
        }

        checkLocalDensity(plantDebris) {
            let localCount = 0;
            const checkRadius = 3;
            let lowestY = this.position.y;
            
            for (const debris of plantDebris) {
                if (debris === this) continue;
                
                const dx = this.position.x - debris.position.x;
                const dy = this.position.y - debris.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    localCount++;
                    lowestY = Math.max(lowestY, debris.position.y);
                }
            }
            
            return { count: localCount, lowestY: lowestY };
        }
    }
    
    // 生命体と植物の初期化
    const lifeforms = [];
    const plants = [];
    const toxicMatters = [];
    const bacteria = [];
    const plantDebris = [];
    const anaerobicBacteria = [];
    
    // 基準となる初期DNAを定義
    const initialDNA = {
        speed: 0.6,          // 中央値を使用
        efficiency: 0.65,     // 中央値を使用
        perception: 0.6,      // 中央値を使用
        foodAttraction: 0.75, // 中央値を使用
        socialBehavior: 0.5,    // 中立的な値を使用
        reproductionRate: 0.4, // 中央値を使用
        predatory: 0.6,       // やや低めの捕食性
        size: 0.4,           // 中央値を使用
        
        // Boidの動きに関する特性
        separationWeight: 0.65,
        alignmentWeight: 0.45,
        cohesionWeight: 0.2,
        
        // 繁殖戦略
        offspringCount: 2,    // 固定値
        parentalCare: 0.5,    // 中央値を使用
        
        // 特殊能力
        regenerationRate: 0.05, // 中央値を使用
        toxicity: 0.25,      // 中央値を使用
        
        // 酸素関連の特性
        oxygenEfficiency: 0.65,
        oxygenTolerance: 0.5
    };
    
    // 初期生命体を生成
    for (let i = 0; i < initialLifeCount; i++) {
        const x = Math.random() * width;
        const y = height * (0.2 + Math.random() * 0.6);
        
        // DNAをコピーして捕食性を明確に設定
        const dna = {...initialDNA};
        // 半数を捕食者に、半数を被食者に
        dna.predatory = i < initialLifeCount / 2 ? 0.8 + Math.random() * 0.2 : 0.2 + Math.random() * 0.2;
        
        lifeforms.push(new Lifeform(x, y, 0, 0.9, dna));
    }
    
    // 植物の初期生成をさらに調整
    const initialPlantCount = Math.floor(width * 0.4); // 0.3から0.4に増加：より多くの植物から開始
    for (let i = 0; i < initialPlantCount; i++) {
        // より均一に分布するように配置
        const x = (i / initialPlantCount) * width + (Math.random() - 0.5) * 5; // ばらつきを5に減少
        const y = height - 1 - Math.random() * 2;
        
        // さらに成長した状態で生成
        const plant = new Plant(x, y, 0, 0.9); // 0.7から0.9に増加：より高いエネルギー
        
        // より大きな初期サイズと成長状態
        plant.size = 0.2 + Math.random() * 0.15; // 0.15-0.25から0.2-0.35に増加
        plant.maxSize = 0.4 + Math.random() * 0.2; // 0.3-0.5から0.4-0.6に増加
        
        // より高い初期成長高さ
        plant.growthHeight = 20 + Math.random() * 20; // 20-40に半減
        plant.maxGrowthHeight = 50 + Math.random() * 50; // 50-100に半減
        
        // 健康状態を最大に
        plant.health = 1.0;
        plant.maxHealth = 1.0;
        
        // 初期の根の強さを増加
        plant.rootStrength = 0.98; // 0.95から0.98に増加
        
        plants.push(plant);
    }
    
    // 初期酸素濃度も植物の存在に合わせて調整
    for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
            // 上部ほど酸素濃度が高い
            const heightFactor = 1 - (y / gridHeight);
            oxygenMap[x][y] = initialOxygenDensity * (1.0 + heightFactor * 0.5); // 0.8から1.0に増加
            
            // 下部ほど二酸化炭素濃度が高い
            const depthFactor = y / gridHeight;
            co2Map[x][y] = initialCO2Density * (0.7 + depthFactor * 0.5); // 0.6から0.7に増加
        }
    }
    
    // 初期の堆肥も追加して栄養豊富な環境を作る
    const initialCompostCount = Math.floor(width * 0.1); // 初期堆肥を追加
    for (let i = 0; i < initialCompostCount; i++) {
        const x = Math.random() * width;
        const y = height - 1 - Math.random() * 2;
        const debris = new PlantDebris(x, y, 0, 0.2 + Math.random() * 0.2);
        
        // 完全に分解された堆肥として設定
        debris.isSettled = true;
        debris.decompositionProgress = 1;
        debris.isCompost = true;
        debris.compostNutrientValue = 0.7 + Math.random() * 0.3; // 高い栄養価
        debris.color = {
            hue: 25,
            saturation: 70,
            lightness: 15,
            opacity: 90
        };
        
        plantDebris.push(debris);
    }
    
    // Z-bufferを初期化
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
    
    // 生命体の色計算を元に戻す
    function getColor(lifeform) {
        // 基本色相（捕食者か被食者かで異なる）
        const hue = lifeform.isPredator ? 
            0 + Math.floor(lifeform.dna.predatory * 60) :  // 赤〜黄色
            180 + Math.floor((1 - lifeform.dna.predatory) * 60);  // 青〜シアン
        
        // エネルギーレベルに基づく彩度
        const saturation = 50 + lifeform.energy * 50;
        
        // 年齢に基づく明度（若いほど明るい）
        const ageRatio = Math.min(1, lifeform.age / maxAge);
        const lightness = 70 - ageRatio * 40;
        
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
    
    // 植物の色計算を修正
    function getPlantColor(plant, healthFactor = 1) {
        // 基本色相（サイズに応じて緑の色調を変化）
        const hue = 80 + (plant.size / plant.maxSize) * 20;  // 90-120から80-100に変更
        
        // エネルギーと健康状態に基づく彩度
        const saturation = 20 + (plant.energy * 30 + healthFactor * 20);  // より控えめに
        
        // サイズとエネルギーに基づく明度
        const sizeFactor = plant.size / plant.maxSize;
        const energyFactor = plant.energy * 0.8;
        const lightness = Math.max(15, (25 + sizeFactor * 20) * healthFactor * energyFactor);
        
        // 不透明度も健康状態とエネルギーに応じて変化
        const opacity = 30 + (healthFactor * 30 + plant.energy * 20);  // 30-80%の不透明度
        
        return `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity}%)`;
    }
    
    // フレームを描画
    function render() {
        // 3フレームに1回だけ更新を行う
        if (time % 3 === 0) {
            // バクテリアを更新
            for (let i = bacteria.length - 1; i >= 0; i--) {
                if (!bacteria[i]) continue;
                if (bacteria[i].update(toxicMatters || [], plants || [], {
                    getOxygenAt: getOxygenAt || function(x, y) { return 0.2; },
                    changeOxygenAt: changeOxygenAt || function(x, y, amount) {}
                })) {
                    bacteria.splice(i, 1);
                }
            }
            
            // 毒素を更新
            for (let i = toxicMatters.length - 1; i >= 0; i--) {
                if (toxicMatters[i].update(plants, toxicMatters)) {
                    toxicMatters.splice(i, 1);
                }
            }
            
            // 植物の死骸を更新
            for (let i = plantDebris.length - 1; i >= 0; i--) {
                if (plantDebris[i].update(bacteria, anaerobicBacteria, plantDebris)) {
                    plantDebris.splice(i, 1);
                }
            }
            
            // 嫌気性バクテリアを更新
            for (let i = anaerobicBacteria.length - 1; i >= 0; i--) {
                if (anaerobicBacteria[i].update(plantDebris, {
                    getOxygenAt: getOxygenAt || function(x, y) { return 0.2; }
                })) {
                    anaerobicBacteria.splice(i, 1);
                }
            }
            
            // 植物を更新
            for (let i = plants.length - 1; i >= 0; i--) {
                if (plants[i].update(plants, null, null)) {
                    plants.splice(i, 1);
                }
            }
            
            // 生命体を更新
            for (let i = lifeforms.length - 1; i >= 0; i--) {
                if (!lifeforms[i]) continue;
                lifeforms[i].update(lifeforms || [], plants || [], toxicMatters || [], anaerobicBacteria);
                
                if (lifeforms[i].isDead) {
                    // 死亡時、その場所に毒性物質を生成
                    const deadLifeform = lifeforms[i];
                    if (deadLifeform && deadLifeform.position) {
                        const toxicMatter = new ToxicMatter(
                            deadLifeform.position.x,
                            deadLifeform.position.y,
                            0,
                            deadLifeform.energy * 0.5
                        );
                        // 残存エネルギーが多いほど毒性が高くなる（0.4-0.9の範囲）
                        toxicMatter.toxicity = 0.4 + (deadLifeform.energy * 0.5);
                        if (toxicMatters) toxicMatters.push(toxicMatter);

                        // 死亡した生命体から一定確率でバクテリアを生成
                        if (Math.random() < 0.25 && bacteria) {
                            const bacteriaCount = 1 + Math.floor(Math.random() * 2);
                            for (let j = 0; j < bacteriaCount; j++) {
                                const bacterium = new PurifierBacteria(
                                    deadLifeform.position.x + (Math.random() - 0.5) * 3,
                                    deadLifeform.position.y + (Math.random() - 0.5) * 3,
                                    0
                                );
                                bacterium.energy = 0.6;
                                bacteria.push(bacterium);
                            }
                        }
                    }
                    lifeforms.splice(i, 1);
                }
            }
            
            // ガスの拡散処理（6フレームに1回に変更）
            if (time % 6 === 0) {
                diffuseGases();
            }
        }
        
        // Z-bufferの初期化と描画処理は毎フレーム行う
        const zBuffer = initZBuffer();
        
        // 植物を描画
        for (const plant of plants) {
            // 根本の位置を描画
            const baseX = Math.floor(plant.position.x);
            const baseY = Math.floor(plant.position.y);

            // 成長した高さに応じて上方向に描画
            for (let h = 0; h <= plant.growthHeight; h++) {
                const projectedX = baseX;
                const projectedY = baseY - h;
                const z = plant.position.z;

                if (projectedX >= 0 && projectedX < width && 
                    projectedY >= 0 && projectedY < height) {
                    const bufferIndex = projectedY * width + projectedX;

                    if (z < zBuffer[bufferIndex].depth) {
                        // 高さに応じて文字を変える
                        const isTop = h === Math.floor(plant.growthHeight);
                        const sizeIndex = Math.floor(plant.size * asciiChars.length);
                        let displayChar = isTop ? 
                            asciiChars[Math.min(sizeIndex, asciiChars.length - 1)] :
                            '│';  // 茎を表現

                        // 体力に応じて色を調整
                        const healthFactor = plant.health / plant.maxHealth;
                        const color = getPlantColor(plant, healthFactor);

                        zBuffer[bufferIndex] = {
                            char: displayChar,
                            depth: z,
                            color: color
                        };
                    }
                }
            }
        }
        
        // 生命体を描画
        for (const lifeform of lifeforms) {
            const projectedX = Math.floor(lifeform.position.x);
            const projectedY = Math.floor(lifeform.position.y);
            const z = lifeform.position.z;
            
            if (projectedX >= 0 && projectedX < width && projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                if (z < zBuffer[bufferIndex].depth) {
                    // エネルギーと年齢に基づいて文字を選択
                    const energyIndex = Math.min(
                        Math.floor(lifeform.energy * (asciiChars.length - 1)),
                        asciiChars.length - 1
                    );
                    
                    // 捕食者は大きめの文字、被食者は小さめの文字で表示
                    let displayChar = asciiChars[energyIndex];
                    if (lifeform.isPredator) {
                        // 捕食者は大きめの文字（エネルギーが高いほど大きい）
                        displayChar = asciiChars[Math.min(energyIndex, asciiChars.length - 2)];
                    } else {
                        // 被食者は小さめの文字
                        displayChar = asciiChars[Math.max(energyIndex, 2)];
                    }
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: z,
                        color: lifeform.getDisplayColor()
                    };
                }
            }
        }
        
        // 酸素を描画
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                const oxygenLevel = oxygenMap[x][y];
                
                // 酸素レベルの閾値を上げ、ランダム要素を追加して描画頻度を下げる
                if (oxygenLevel > 0.03 && Math.random() < 0.05) {  // 0.2の確率でのみ描画
                    // グリッドの中心座標を計算
                    const centerX = x * gridSize + gridSize / 2;
                    const centerY = y * gridSize + gridSize / 2;
                    
                    // グリッド内のランダムな位置に酸素を表示
                    const offsetX = (Math.random() - 0.5) * gridSize;
                    const offsetY = (Math.random() - 0.5) * gridSize;
                    
                    const projectedX = Math.floor(centerX + offsetX);
                    const projectedY = Math.floor(centerY + offsetY);
                    
                    if (projectedX >= 0 && projectedX < width && 
                        projectedY >= 0 && projectedY < height) {
                        const bufferIndex = projectedY * width + projectedX;
                        
                        // 酸素濃度に応じて表示を変える
                        let displayChar, opacity, lightness, saturation;
                        
                        displayChar = oxygenLevel > 0.7 ? '◦' : 
                                    oxygenLevel > 0.4 ? '·' : 
                                    '·';
                        opacity = 20 + oxygenLevel * 20; // 不透明度を20-40%に
                        lightness = 60 + oxygenLevel * 10; // 明るさを60-70%に
                        saturation = 60; // 彩度を60%に
                        
                        zBuffer[bufferIndex] = {
                            char: displayChar,
                            depth: -1, // 酸素は最背面に表示
                            color: `hsla(190, ${saturation}%, ${lightness}%, ${opacity}%)`
                        };
                    }
                }
            }
        }
        
        // CO2を描画
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                const co2Level = co2Map[x][y];
                
                if (co2Level > 0.03) {
                    // グリッドの中心座標を計算
                    const centerX = x * gridSize + gridSize / 2;
                    const centerY = y * gridSize + gridSize / 2;
                    
                    // グリッド内のランダムな位置にCO2を表示
                    const offsetX = (Math.random() - 0.5) * gridSize;
                    const offsetY = (Math.random() - 0.5) * gridSize;
                    
                    const projectedX = Math.floor(centerX + offsetX);
                    const projectedY = Math.floor(centerY + offsetY);
                    
                    if (projectedX >= 0 && projectedX < width && 
                        projectedY >= 0 && projectedY < height) {
                        const bufferIndex = projectedY * width + projectedX;
                        
                        // CO2濃度に応じて表示を変える
                        let displayChar, opacity, lightness, saturation;
                        
                        displayChar = co2Level > 0.7 ? '∙' : 
                                    co2Level > 0.4 ? '·' : 
                                    '·';
                        opacity = 30 + co2Level * 30; // 不透明度を30-60%に
                        lightness = 50 + co2Level * 20; // 明るさを50-70%に
                        saturation = 50; // 彩度を50%に
                        
                        // CO2は酸素より優先度を下げる
                        if (zBuffer[bufferIndex].char === ' ' || zBuffer[bufferIndex].depth > 0) {
                            zBuffer[bufferIndex] = {
                                char: displayChar,
                                depth: 0, // 酸素より前、他のオブジェクトより後ろに表示
                                color: `hsla(0, ${saturation}%, ${lightness}%, ${opacity}%)`
                            };
                        }
                    }
                }
            }
        }
        
        // バクテリアを描画（植物の描画の後に追加）
        for (const bacterium of bacteria) {
            const projectedX = Math.floor(bacterium.position.x);
            const projectedY = Math.floor(bacterium.position.y);
            
            if (projectedX >= 0 && projectedX < width && 
                projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                if (bacterium.position.z < zBuffer[bufferIndex].depth) {
                    // エネルギーに応じて表示を変える
                    const displayChar = bacterium.energy > 0.7 ? '·' : 
                                     bacterium.energy > 0.4 ? ',' : '˙';
                    
                    // より地味な色に変更
                    const hue = 40; // 茶色っぽい色
                    const saturation = 20 + bacterium.energy * 15; // 彩度を下げる
                    const lightness = 30 + bacterium.energy * 15; // 明度も抑える
                    const opacity = 30 + bacterium.energy * 20; // 透明度を上げる
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: bacterium.position.z,
                        color: `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity}%)`
                    };
                }
            }
        }
        
        // 植物の死骸を描画
        for (const debris of plantDebris) {
            const projectedX = Math.floor(debris.position.x);
            const projectedY = Math.floor(debris.position.y);
            
            if (projectedX >= 0 && projectedX < width && 
                projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                if (debris.position.z < zBuffer[bufferIndex].depth) {
                    const displayChar = debris.isSettled ? '░' : '▒';
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: debris.position.z,
                        color: `hsla(${debris.color.hue}, ${debris.color.saturation}%, ${debris.color.lightness}%, ${debris.color.opacity}%)`
                    };
                }
            }
        }

        // 毒素を描画
        for (const toxic of toxicMatters) {
            const projectedX = Math.floor(toxic.position.x);
            const projectedY = Math.floor(toxic.position.y);
            
            if (projectedX >= 0 && projectedX < width && 
                projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                if (toxic.position.z < zBuffer[bufferIndex].depth) {
                    // 分解段階に応じて表示を変える
                    let displayChar, color;
                    
                    switch (toxic.decompositionStage) {
                        case 0: // 未分解の毒素
                            displayChar = '▓';
                            color = `hsla(300, 70%, 30%, ${toxic.toxicity * 20}%)`; // より暗い紫色、透明度をさらに上げる
                            break;
                        case 1: // 分解中
                            displayChar = '▒';
                            color = `hsla(300, 50%, 40%, ${(1 - toxic.decompositionProgress) * toxic.toxicity * 20}%)`; // さらに暗い紫色、透明度をさらに上げる
                            break;
                        case 2: // 堆肥
                            displayChar = '░';
                            color = 'hsla(30, 70%, 30%, 70%)'; // 茶色
                            break;
                    }
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: toxic.position.z,
                        color: color
                    };
                }
            }
        }
        
        // Z-bufferから文字列を生成
        let output = '';
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                if (zBuffer[index].char !== ' ') {
                    output += `<span style="color:${zBuffer[index].color}">${zBuffer[index].char}</span>`;
                } else {
                    output += '&nbsp;';
                }
            }
            output += '<br>';
        }
        
        // キャンバスに描画
        canvas.innerHTML = output;
        
        // 次のフレーム
        time += 1;
        
        // 統計情報を表示（デバッグ用）
        if (time % 60 === 0) {
            const predatorCount = lifeforms.filter(l => l.isPredator).length;
            const preyCount = lifeforms.length - predatorCount;
            console.log(`Time: ${time}, Lifeforms: ${lifeforms.length} (Predators: ${predatorCount}, Prey: ${preyCount}), Foods: ${plants.length}`);
        }
         
                requestAnimationFrame(render);
            
    }
    
    // アニメーション開始
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

    // 嫌気性バクテリアクラスを追加
    class AnaerobicBacteria {
        constructor(x, y, z) {
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : height - 2 - Math.random() * 3,
                z: z || 0
            };
            this.energy = 0.5 + Math.random() * 0.3;
            this.age = 0;
            this.maxAge = 250 + Math.floor(Math.random() * 150); // 寿命を250-400に短縮
            this.decompositionEfficiency = 0.6 + Math.random() * 0.4;
            this.size = 0.1 + Math.random() * 0.1;
            this.velocity = { x: 0, y: 0, z: 0 };
            this.searchRadius = 15; // 探索範囲を拡大
            this.currentTarget = null;
            
            // 嫌気性特性
            this.oxygenTolerance = 0.4; // 酸素耐性を上げる
            this.optimalDepth = height - 3;
            this.depthTolerance = 6; // 深度の許容範囲を広げる
            this.co2ProductionRate = 0.004; // 嫌気性呼吸のCO2生成率（好気性より低め）
        }

        update(plantDebris, oxygens) {
            this.age++;

            // 基礎代謝によるエネルギー消費
            this.energy -= 0.0008 * (1 + this.size); // 好気性バクテリアより少し効率的

            // 移動によるエネルギー消費
            const movementCost = Math.sqrt(
                this.velocity.x * this.velocity.x +
                this.velocity.y * this.velocity.y
            ) * 0.001; // 好気性バクテリアより移動コストが低い
            this.energy -= movementCost;

            // 嫌気性呼吸によるCO2生成
            if (typeof changeCO2At === 'function') {
                const co2Amount = this.energy * this.co2ProductionRate;
                changeCO2At(this.position.x, this.position.y, co2Amount);
            }
            
            // 深度効率の計算を改善
            const optimalDepth = height - 3;
            const depthDifference = Math.abs(this.position.y - optimalDepth);
            const depthEfficiency = Math.max(0, 1 - (depthDifference / 5));

            // 不適切な深度でのペナルティ
            if (depthEfficiency < 0.5) {
                this.energy -= 0.001 * (1 - depthEfficiency);
            }

            // 酸素による悪影響（嫌気性バクテリアなので）
            if (oxygens && typeof oxygens.getOxygenAt === 'function') {
                const localOxygen = oxygens.getOxygenAt(this.position.x, this.position.y);
                if (localOxygen > 0.4) { // 高酸素環境でのダメージ
                    this.energy -= 0.002 * (localOxygen - 0.4);
                }
            }

            // 死亡条件をチェック
            if (this.energy <= 0 || // エネルギー切れ
                this.age >= this.maxAge) { // 寿命
                return true;
            }
            
            // 現在の対象がなければ新しい植物の死骸を探す
            let foundDebris = false;
            
            // 現在の対象がなければ新しい植物の死骸を探す
            if (!this.currentTarget) {
                let closestDist = this.searchRadius;
                let closestDebris = null;

                for (const debris of plantDebris) {
                    if (debris.isSettled && !debris.isCompost) {
                        const dx = this.position.x - debris.position.x;
                        const dy = this.position.y - debris.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < closestDist) {
                            closestDist = distance;
                            closestDebris = debris;
                        }
                    }
                }

                if (closestDebris) {
                    this.currentTarget = closestDebris;
                }
            }

            // 対象が見つかった場合の処理
            if (this.currentTarget) {
                const dx = this.currentTarget.position.x - this.position.x;
                const dy = this.currentTarget.position.y - this.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 3) {
                    foundDebris = true;
                    this.currentTarget.anaerobicBacteriaCount++;
                    
                    // エネルギー獲得（深度効率に応じて）
                    const energyGain = 0.003 * depthEfficiency;
                    this.energy = Math.min(1.0, this.energy + energyGain);
                    
                    // 繁殖判定を追加（エネルギーと深度効率に基づく）
                    if (this.energy > 0.7 && Math.random() < 0.05 * depthEfficiency) {
                        this.reproduce();
                    }
                } else {
                    // 対象に向かってゆっくり移動（角度ベースの移動を実装）
                    const angle = Math.atan2(dy, dx);
                    const moveSpeed = this.speed * depthEfficiency;
                    this.velocity.x = Math.cos(angle) * moveSpeed;
                    this.velocity.y = Math.sin(angle) * moveSpeed;
                }
            } else {
                // ランダムな移動（より制限された範囲で）
                if (Math.random() < 0.05) {
                    this.velocity.x = (Math.random() - 0.5) * 0.1;
                    this.velocity.y = (Math.random() - 0.5) * 0.1;
                }
            }

            // 位置の更新と境界チェック
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;

            // 水平方向の境界
            if (this.position.x < 0) {
                this.position.x = 0;
                this.velocity.x *= -0.5;
            } else if (this.position.x >= width) {
                this.position.x = width - 1;
                this.velocity.x *= -0.5;
            }
            
            // 垂直方向の境界（底面付近での特殊な挙動）
            const minDepth = height - 5;
            const maxDepth = height - 1;
            
            if (this.position.y < minDepth) {
                // 徐々に下方向に移動
                const depthForce = 0.005 * (1 - depthEfficiency);
                this.velocity.y += depthForce;
            } else if (this.position.y > maxDepth) {
                this.position.y = maxDepth;
                this.velocity.y = 0;
            }

            // 自然な繁殖判定を追加（エネルギーと深度効率が十分な場合）
            if (this.energy > 0.8 && depthEfficiency > 0.8 && Math.random() < 0.02) {
                this.reproduce();
            }

            return false;
        }

        reproduce() {
            if (anaerobicBacteria.length >= Math.floor(bacteriaMaxCount * 0.5)) return false;

            const offspringCount = 1 + Math.floor(Math.random() * 2);
            const energyCost = this.energy * 0.4;
            this.energy -= energyCost;

            for (let i = 0; i < offspringCount; i++) {
                const spreadDistance = 2 + Math.random() * 2;
                const angle = Math.random() * Math.PI * 2;
                
                const child = new AnaerobicBacteria(
                    this.position.x + Math.cos(angle) * spreadDistance,
                    this.position.y + Math.sin(angle) * spreadDistance,
                    0
                );
                
                child.decompositionEfficiency = Math.max(0.1, Math.min(1.0,
                    this.decompositionEfficiency + (Math.random() - 0.5) * 0.2
                ));
                child.energy = energyCost / offspringCount * 0.8;
                
                anaerobicBacteria.push(child);
            }
            
            return false;
        }
    }

    // 初期の嫌気性バクテリアを生成
    const initialAnaerobicBacteriaCount = Math.floor(width * 0.03);
    for (let i = 0; i < initialAnaerobicBacteriaCount; i++) {
        const x = Math.random() * width;
        const y = height - 2 - Math.random() * 3;
        anaerobicBacteria.push(new AnaerobicBacteria(x, y, 0));
    }



    // 初期化部分を修正（Oxygen, CO2オブジェクトの生成を削除）
    // 初期酸素と二酸化炭素の分布を設定
    function initializeGasDistribution() {
        // 上部に酸素が多い分布
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                // 上部ほど酸素濃度が高い
                const heightFactor = 1 - (y / gridHeight);
                oxygenMap[x][y] = initialOxygenDensity * (0.5 + heightFactor * 0.5);
                
                // 下部ほど二酸化炭素濃度が高い
                const depthFactor = y / gridHeight;
                co2Map[x][y] = initialCO2Density * (0.5 + depthFactor * 0.5);
                
                // ランダム要素を加える
                oxygenMap[x][y] += (Math.random() - 0.5) * 0.1;
                co2Map[x][y] += (Math.random() - 0.5) * 0.1;
                
                // 範囲内に収める
                oxygenMap[x][y] = Math.max(0, Math.min(maxOxygenLevel, oxygenMap[x][y]));
                co2Map[x][y] = Math.max(0, Math.min(maxCO2Level, co2Map[x][y]));
            }
        }
    }
    
    // 初期化
    initializeGasDistribution();

    // 指定した位置の酸素濃度を取得
    function getOxygenAt(x, y) {
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            return oxygenMap[gridX][gridY];
        }
        return 0;
    }
    
    // 指定した位置の二酸化炭素濃度を取得
    function getCO2At(x, y) {
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            return co2Map[gridX][gridY];
        }
        return 0;
    }
    
    // 指定した位置の酸素濃度を変更
    function changeOxygenAt(x, y, amount) {
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            oxygenMap[gridX][gridY] = Math.max(0, Math.min(maxOxygenLevel, oxygenMap[gridX][gridY] + amount));
            return true;
        }
        return false;
    }
    
    // 指定した位置の二酸化炭素濃度を変更
    function changeCO2At(x, y, amount) {
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            co2Map[gridX][gridY] = Math.max(0, Math.min(maxCO2Level, co2Map[gridX][gridY] + amount));
            return true;
        }
        return false;
    }
    
    // 濃度の拡散処理
    function diffuseGases() {
        // 酸素の拡散
        const newOxygenMap = Array(gridWidth).fill().map(() => Array(gridHeight).fill(0));
        const newCO2Map = Array(gridWidth).fill().map(() => Array(gridHeight).fill(0));
        
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                let oxygenSum = oxygenMap[x][y];
                let co2Sum = co2Map[x][y];
                let count = 1;
                
                // 隣接セルからの拡散
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        
                        const nx = x + dx;
                        const ny = y + dy;
                        
                        if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
                            // 拡散率を調整
                            oxygenSum += oxygenMap[nx][ny] * 0.02;
                            co2Sum += co2Map[nx][ny] * 0.02;
                            count++;
                        }
                    }
                }
                
                // 拡散後の新しい値を計算
                newOxygenMap[x][y] = oxygenMap[x][y] * 0.98 + 
                                    (oxygenSum - oxygenMap[x][y]) / count * 0.02;
                
                newCO2Map[x][y] = co2Map[x][y] * 0.98 + 
                                 (co2Sum - co2Map[x][y]) / count * 0.02;
                
                // 自然減衰率を調整（より緩やかに）
                newOxygenMap[x][y] *= 0.9995;
                newCO2Map[x][y] *= 0.9995;
                
                // 浮力効果の大幅強化
                if (y > 0) {
                    // 酸素の上昇をより強く
                    const oxygenRise = newOxygenMap[x][y] * 0.15; // 0.005から0.15に大幅増加
                    newOxygenMap[x][y-1] += oxygenRise;
                    newOxygenMap[x][y] -= oxygenRise;
                }
                
                if (y < gridHeight - 1) {
                    // CO2の沈降をより強く
                    const co2Sink = newCO2Map[x][y] * 0.08; // 0.005から0.08に増加
                    newCO2Map[x][y+1] += co2Sink;
                    newCO2Map[x][y] -= co2Sink;
                }

                // 水面付近での特別な処理
                if (y < 3) {  // 水面付近
                    // 酸素の上昇を更に強化
                    const surfaceRise = newOxygenMap[x][y] * 0.25;
                    if (y > 0) {
                        newOxygenMap[x][y-1] += surfaceRise;
                        newOxygenMap[x][y] -= surfaceRise;
                    }
                }
            }
        }
        
        // 新しい値で更新
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                oxygenMap[x][y] = newOxygenMap[x][y];
                co2Map[x][y] = newCO2Map[x][y];
            }
        }
    }

    // 初期植物の死骸を生成
    for (let i = 0; i < initialPlantDebrisCount; i++) {
        const x = Math.random() * width;
        const y = height - Math.random() * 20; // 底部に配置
        const debris = new PlantDebris(
            x,
            y,
            0,
            0.2 + Math.random() * 0.3
        );
        plantDebris.push(debris);
    }

    // 初期化
    initializeGasDistribution();

    // 初期浄化バクテリアの生成
    for (let i = 0; i < initialBacteriaCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height * 0.8; // 上部80%に配置
        const bacterium = new PurifierBacteria(
            x,
            y,
            0
        );
        bacteria.push(bacterium);
    }

    // 初期嫌気性バクテリアの生成
    for (let i = 0; i < initialBacteriaCount / 2; i++) {
        const x = Math.random() * width;
        const y = height - Math.random() * 20; // 底部に配置
        const bacterium = new AnaerobicBacteria(
            x,
            y,
            0
        );
        anaerobicBacteria.push(bacterium);
    }
}); 