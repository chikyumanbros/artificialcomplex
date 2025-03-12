document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    // 幅と高さの比率を1:1に近づける（正方形のグリッドになるように）
    const width = 300;
    const height = 120;
    
    // ASCII文字のセット（生命体の状態を表現）
    const asciiChars = '█▓▒░+*·';
    
    // ライフシミュレーションのパラメータ
    const initialLifeCount = 100;
    const maxLifeforms = 400;
    const energyDecayRate = 0.001;
    const reproductionThreshold = 0.6;
    const reproductionCost = 0.15;
    const mutationRate = 0.1;
    const foodGenerationRate = 0.05;  // 0.08から0.05に減少（食物生成を少し減らす、代わりに捕食が栄養源になる）
    const maxAge = 1000;
    
    // 捕食関連のパラメータ
    const predationRange = 5;  // 捕食可能な距離
    const predationEnergyGain = 0.6;  // 捕食で得られるエネルギーの割合
    const predationSuccessRate = 0.7;  // 捕食の成功率（捕食者のサイズと被食者のサイズの比率に影響される）
    
    // アニメーションの状態
    let time = 0;
    
    // 生命体クラス
    class Lifeform {
        constructor(x, y, z, energy, dna = null) {
            // 位置
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : Math.random() * height,
                z: z !== undefined ? z : Math.random() * 20 - 10
            };
            
            // 速度（移動方向と速さ）
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.1 + Math.random() * 0.3;
            this.velocity = {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed,
                z: (Math.random() - 0.5) * speed * 0.5
            };
            
            // 加速度
            this.acceleration = { x: 0, y: 0, z: 0 };
            
            // 生命体の特性
            this.dna = dna || {
                // 基本的な特性
                speed: 0.5 + Math.random() * 0.5,
                efficiency: 0.7 + Math.random() * 0.4,
                perception: 0.6 + Math.random() * 0.6,
                foodAttraction: 0.8 + Math.random() * 0.8,
                socialBehavior: Math.random() * 2 - 1,
                reproductionRate: 0.3 + Math.random() * 0.7,
                predatory: Math.random(),
                size: 0.3 + Math.random() * 0.7,
                
                // Boidの動きに関する特性
                separationWeight: 0.5 + Math.random() * 0.5,
                alignmentWeight: 0.3 + Math.random() * 0.4,
                cohesionWeight: 0.2 + Math.random() * 0.3,
                
                // 新しい特性
                // 環境適応性（深さに対する適応）
                depthPreference: Math.random() * 20 - 10,  // 好みの深さ
                depthTolerance: 0.3 + Math.random() * 0.7, // 深さの許容範囲
                
                // 特殊能力
                regenerationRate: Math.random() * 0.1,     // エネルギー自然回復率
                toxicity: Math.random() * 0.5,            // 捕食されにくさ
                
                // 繁殖戦略
                offspringCount: 1 + Math.floor(Math.random() * 3),  // 一度に産む子の数
                parentalCare: Math.random(),              // 子育ての度合い（エネルギー分配）
                
                // 特殊な行動パターン
                nocturnality: Math.random(),              // 夜行性度合い
                territoriality: Math.random()             // 縄張り意識の強さ
            };
            
            // 生命体の状態
            this.energy = energy !== undefined ? energy : 0.8 + Math.random() * 0.2;
            this.age = 0;
            this.isDead = false;
            this.lastReproductionTime = 0;  // 最後に繁殖した時間
            
            // 捕食関連の状態
            this.lastPredationTime = 0;  // 最後に捕食した時間
            this.lastPredationAttemptTime = 0;  // 最後に捕食を試みた時間
            this.isPredator = this.dna.predatory > 0.6;  // 捕食性向が0.6以上なら捕食者
            
            // 生命体の色（DNAに基づく）
            // 捕食者は赤系、被食者は青系
            this.baseHue = this.isPredator ? 
                0 + Math.floor(this.dna.predatory * 60) :  // 赤〜黄色
                180 + Math.floor((1 - this.dna.predatory) * 60);  // 青〜シアン
        }
        
        // 食物を探す
        seekFood(foods) {
            let steering = { x: 0, y: 0, z: 0 };
            let closestDist = Infinity;
            let closestFood = null;
            
            // 知覚範囲を計算
            const perceptionRadius = 20 * this.dna.perception;
            
            for (const food of foods) {
                const dx = food.position.x - this.position.x;
                const dy = food.position.y - this.position.y;
                const dz = food.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < perceptionRadius && distance < closestDist) {
                    closestDist = distance;
                    closestFood = food;
                }
            }
            
            if (closestFood) {
                // 最も近い食物に向かうベクトル
                steering.x = closestFood.position.x - this.position.x;
                steering.y = closestFood.position.y - this.position.y;
                steering.z = closestFood.position.z - this.position.z;
                
                // ベクトルの正規化
                const magnitude = Math.sqrt(
                    steering.x * steering.x + 
                    steering.y * steering.y + 
                    steering.z * steering.z
                );
                
                if (magnitude > 0) {
                    steering.x = (steering.x / magnitude) * this.dna.speed;
                    steering.y = (steering.y / magnitude) * this.dna.speed;
                    steering.z = (steering.z / magnitude) * this.dna.speed;
                }
                
                // 食物への引力を適用
                steering.x *= this.dna.foodAttraction;
                steering.y *= this.dna.foodAttraction;
                steering.z *= this.dna.foodAttraction;
            }
            
            return steering;
        }
        
        // 他の生命体との相互作用（捕食を含む）
        interact(lifeforms) {
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
                        
                        // 獲物からエネルギーを得る
                        const gainedEnergy = closestPrey.energy * predationEnergyGain;
                        this.energy += gainedEnergy;
                        this.energy = Math.min(this.energy, 1.0);  // エネルギー上限
                        
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
            
            return steering;
        }
        
        // 境界を超えないようにする力
        checkBoundaries() {
            const margin = 2;
            let force = { x: 0, y: 0, z: 0 };
            const boundaryForce = 0.05;
            
            if (this.position.x < margin) {
                force.x = boundaryForce;
            } else if (this.position.x > width - margin) {
                force.x = -boundaryForce;
            }
            
            if (this.position.y < margin) {
                force.y = boundaryForce;
            } else if (this.position.y > height - margin) {
                force.y = -boundaryForce;
            }
            
            if (this.position.z < -10) {
                force.z = boundaryForce;
            } else if (this.position.z > 10) {
                force.z = -boundaryForce;
            }
            
            return force;
        }
        
        // 生命体の更新
        update(lifeforms, foods) {
            if (this.isDead) return;
            
            // 年齢を増加
            this.age++;
            
            // 時間による影響（昼夜サイクル）
            const dayPhase = (time % 240) / 240; // 0-1の周期
            const isNight = dayPhase > 0.5;
            const activityMultiplier = isNight ?
                (this.dna.nocturnality) :        // 夜行性の生物は夜に活発
                (1 - this.dna.nocturnality);     // 昼行性の生物は昼に活発
            
            // 深さに基づくストレス計算
            const depthStress = Math.abs(this.position.z - this.dna.depthPreference) / 
                (10 * this.dna.depthTolerance);
            
            // エネルギー消費（効率と活動時間帯に基づく）
            this.energy -= energyDecayRate * 
                (1 - this.dna.efficiency * 0.5) * 
                activityMultiplier * 
                (1 + depthStress);
            
            // 自然回復
            this.energy += this.dna.regenerationRate * (1 - depthStress);
            this.energy = Math.min(this.energy, 1.0);
            
            // 食物を探す力
            const foodSeeking = this.seekFood(foods);
            
            // 他の生命体との相互作用
            const interaction = this.interact(lifeforms);
            
            // 境界チェック
            const boundaries = this.checkBoundaries();
            
            // 縄張り行動の追加
            const territory = this.defendTerritory(lifeforms);
            
            // 力を適用（縄張り行動を含む）
            this.acceleration.x += (foodSeeking.x + interaction.x + boundaries.x + territory.x) * activityMultiplier;
            this.acceleration.y += (foodSeeking.y + interaction.y + boundaries.y + territory.y) * activityMultiplier;
            this.acceleration.z += (foodSeeking.z + interaction.z + boundaries.z + territory.z) * activityMultiplier;
            
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
                    this.velocity.x = (this.velocity.x / speed) * maxSpeed;
                    this.velocity.y = (this.velocity.y / speed) * maxSpeed;
                    this.velocity.z = (this.velocity.z / speed) * maxSpeed;
            }
            
            // 位置を更新
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
            this.position.z += this.velocity.z;
            
            // 加速度をリセット
            this.acceleration.x = 0;
            this.acceleration.y = 0;
            this.acceleration.z = 0;
            
            // 食物との衝突判定と摂取
            this.eatFood(foods);
            
            // 繁殖判定
            if (this.energy > reproductionThreshold && Math.random() < this.dna.reproductionRate * 0.05) {
                this.reproduce(lifeforms);
            }
            
            // 死亡判定
            if (this.energy <= 0 || this.age >= maxAge) {
                this.isDead = true;
            }
        }
        
        // 食物を食べる
        eatFood(foods) {
            const eatDistance = 4;  // 3から4に増加（食物をさらに食べやすくする）
            
            for (let i = foods.length - 1; i >= 0; i--) {
                const food = foods[i];
                const dx = this.position.x - food.position.x;
                const dy = this.position.y - food.position.y;
                const dz = this.position.z - food.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < eatDistance) {
                    // 食物を摂取してエネルギーを得る
                    this.energy += food.energy;
                    this.energy = Math.min(this.energy, 1.0); // エネルギー上限
                    
                    // 食物を削除
                    foods.splice(i, 1);
                }
            }
        }
        
        // 縄張り防衛の行動を追加
        defendTerritory(lifeforms) {
            if (this.dna.territoriality < 0.2) return { x: 0, y: 0, z: 0 };
            
            let force = { x: 0, y: 0, z: 0 };
            let count = 0;
            
            const territoryRadius = 10 * this.dna.territoriality;
            
            for (const other of lifeforms) {
                if (other === this || other.isDead) continue;
                
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const dz = other.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < territoryRadius) {
                    // 縄張り内の他の生物を追い払う
                    force.x -= dx * this.dna.territoriality;
                    force.y -= dy * this.dna.territoriality;
                    force.z -= dz * this.dna.territoriality;
                    count++;
                }
            }
            
            if (count > 0) {
                force.x /= count;
                force.y /= count;
                force.z /= count;
            }
            
            return force;
        }
        
        // 繁殖
        reproduce(lifeforms) {
            if (lifeforms.length >= maxLifeforms) return;
            if (time - this.lastReproductionTime < 50) return;
            
            this.lastReproductionTime = time;
            
            // 親のエネルギー消費（子育ての度合いに応じて）
            const parentalInvestment = reproductionCost * (1 + this.dna.parentalCare);
            this.energy -= parentalInvestment;
            
            // 複数の子孫を生成
            const offspringCount = this.dna.offspringCount;
            const energyPerChild = (parentalInvestment * this.dna.parentalCare) / offspringCount;
            
            for (let i = 0; i < offspringCount; i++) {
                // 子孫のDNAを作成（突然変異を含む）
                const childDna = {};
                for (const [key, value] of Object.entries(this.dna)) {
                    // 各特性に突然変異を適用
                    const mutation = (Math.random() * 2 - 1) * mutationRate;
                    // 特性に応じて突然変異の影響を調整
                    const mutationScale = key === 'predatory' || key === 'nocturnality' ? 0.5 : 1.0;
                    childDna[key] = value + mutation * mutationScale;
                    
                    // 値を適切な範囲に制限
                    if (key === 'socialBehavior' || key === 'territoriality') {
                        childDna[key] = Math.max(-1.0, Math.min(1.0, childDna[key]));
                    } else if (key === 'predatory' || key === 'nocturnality' || key === 'parentalCare') {
                        childDna[key] = Math.max(0.0, Math.min(1.0, childDna[key]));
                    } else if (key === 'offspringCount') {
                        childDna[key] = Math.max(1, Math.min(5, Math.round(childDna[key])));
                    } else {
                        childDna[key] = Math.max(0.1, Math.min(1.5, childDna[key]));
                    }
                }
                
                // 子孫を生成
                const offsetDistance = 2 + this.dna.parentalCare * 3;
                const offsetX = (Math.random() - 0.5) * offsetDistance;
                const offsetY = (Math.random() - 0.5) * offsetDistance;
                const offsetZ = (Math.random() - 0.5) * offsetDistance;
                
                const child = new Lifeform(
                    this.position.x + offsetX,
                    this.position.y + offsetY,
                    this.position.z + offsetZ,
                    0.3 + energyPerChild, // 親からのエネルギー分配を反映
                    childDna
                );
                
                lifeforms.push(child);
            }
        }
    }
    
    // 食物クラスを植物クラスに変更
    class Plant {
        constructor(x, y, z, energy) {
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : Math.random() * height,
                z: z !== undefined ? z : Math.random() * 20 - 10
            };
            this.energy = energy !== undefined ? energy : 0.3;
            this.age = 0;
            this.maxAge = 800 + Math.floor(Math.random() * 400);
            this.size = 0.1; // 植物の大きさ（成長する）
            this.maxSize = 0.3 + Math.random() * 0.4; // 最大サイズは個体によって異なる
            this.reproductionThreshold = 0.7; // 繁殖に必要なエネルギー閾値
            this.lastReproductionTime = 0;
        }
        
        update(plants) {
            this.age++;
            
            // 光合成によるエネルギー生成（深さに応じて効率が変化）
            const depthFactor = Math.max(0, 1 - Math.abs(this.position.z) / 10);
            const photosynthesisRate = 0.002 * depthFactor;
            this.energy += photosynthesisRate;
            
            // 成長
            if (this.size < this.maxSize) {
                const growthRate = 0.0005;
                this.size += growthRate;
                this.energy -= growthRate * 0.5; // 成長にはエネルギーを消費
            }
            
            // 繁殖
            if (this.energy > this.reproductionThreshold && 
                time - this.lastReproductionTime > 100 && 
                plants.length < maxLifeforms * 2) {
                this.reproduce(plants);
            }
            
            // エネルギー消費（維持コスト）
            this.energy -= 0.0005 * this.size;
            
            // 寿命または枯死判定
            return this.age >= this.maxAge || this.energy <= 0;
        }
        
        reproduce(plants) {
            const reproductionCost = 0.3;
            this.energy -= reproductionCost;
            this.lastReproductionTime = time;
            
            // 周囲のスペースをチェック
            const spreadDistance = 5 + this.size * 10;
            const offsetX = (Math.random() - 0.5) * spreadDistance;
            const offsetY = (Math.random() - 0.5) * spreadDistance;
            const offsetZ = (Math.random() - 0.5) * 2;
            
            // 新しい植物を生成（突然変異を含む）
            const newPlant = new Plant(
                this.position.x + offsetX,
                this.position.y + offsetY,
                this.position.z + offsetZ,
                0.3
            );
            
            // 親の特性を継承（突然変異あり）
            newPlant.maxSize = this.maxSize * (0.9 + Math.random() * 0.2);
            
            plants.push(newPlant);
        }
    }
    
    // 生命体と植物の初期化
    const lifeforms = [];
    const plants = []; // foodsをplantsに変更
    
    for (let i = 0; i < initialLifeCount; i++) {
        lifeforms.push(new Lifeform());
    }
    
    for (let i = 0; i < initialLifeCount * 1.5; i++) {
        plants.push(new Plant());
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
    
    // 生命体の状態に基づいて色を計算
    function getColor(lifeform) {
        // 基本色相（捕食者か被食者かで異なる）
        const hue = lifeform.baseHue;
        
        // エネルギーレベルに基づく彩度
        const saturation = 50 + lifeform.energy * 50;
        
        // 年齢に基づく明度（若いほど明るい）
        const ageRatio = Math.min(1, lifeform.age / maxAge);
        const lightness = 70 - ageRatio * 40;
        
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
    
    // 植物の色を計算
    function getPlantColor(plant) {
        // 植物の成長度合いに応じて色相を変化
        const hue = 90 + (plant.size / plant.maxSize) * 30;
        const saturation = 60 + plant.energy * 40;
        const lightness = 30 + (plant.size / plant.maxSize) * 30;
        
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
    
    // フレームを描画
    function render() {
        const zBuffer = initZBuffer();
        
        // 植物を更新
        for (let i = plants.length - 1; i >= 0; i--) {
            if (plants[i].update(plants)) {
                // 枯死した植物の分解（栄養を残す）
                const deadPosition = { ...plants[i].position };
                const deadEnergy = plants[i].energy * plants[i].size;
                
                // 新しい植物の種を生成
                if (Math.random() < 0.3) { // 30%の確率で種を残す
                    const seedCount = 1 + Math.floor(Math.random() * 2);
                    for (let j = 0; j < seedCount; j++) {
                        const plant = new Plant(
                            deadPosition.x + (Math.random() - 0.5) * 5,
                            deadPosition.y + (Math.random() - 0.5) * 5,
                            deadPosition.z + (Math.random() - 0.5) * 2,
                            deadEnergy * 0.3
                        );
                        plants.push(plant);
                    }
                }
                
                plants.splice(i, 1);
            }
        }
        
        // 生命体を更新
        for (let i = lifeforms.length - 1; i >= 0; i--) {
            lifeforms[i].update(lifeforms, plants); // foodsをplantsに変更
            
            if (lifeforms[i].isDead) {
                // 死んだ生命体の位置に植物の種を生成
                const deadPosition = { ...lifeforms[i].position };
                const deadEnergy = lifeforms[i].energy;
                
                const seedCount = 1 + Math.floor(Math.random() * 2);
                for (let j = 0; j < seedCount; j++) {
                    const plant = new Plant(
                        deadPosition.x + (Math.random() - 0.5) * 3,
                        deadPosition.y + (Math.random() - 0.5) * 3,
                        deadPosition.z + (Math.random() - 0.5) * 2,
                        deadEnergy * 0.3
                    );
                    plants.push(plant);
                }
                
                lifeforms.splice(i, 1);
            }
        }
        
        // 植物を描画
        for (const plant of plants) {
            const projectedX = Math.floor(plant.position.x);
            const projectedY = Math.floor(plant.position.y);
            const z = plant.position.z;
            
            if (projectedX >= 0 && projectedX < width && projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                if (z < zBuffer[bufferIndex].depth) {
                    // サイズに応じて表示文字を変更
                    const sizeIndex = Math.floor(plant.size * asciiChars.length);
                    const displayChar = asciiChars[Math.min(sizeIndex, asciiChars.length - 1)];
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: z,
                        color: getPlantColor(plant)
                    };
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
                        color: getColor(lifeform)
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
}); 