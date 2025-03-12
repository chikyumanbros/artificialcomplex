document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const width = 100;
    const height = 60;
    
    // ASCII文字のセット
    const asciiChars = '█▓▒░■□▪▫°∙*×÷+∷∴∵·';
    
    // グローバル設定
    let showResources = false; // デフォルトではリソースを表示しない
    let enableRecycling = false; // 死亡した生命体からの再生成を無効化（デフォルトで無効）
    
    // 代謝産物の定義
    const METABOLIC_PRODUCTS = {
        OXYGEN: 'oxygen',
        GLUCOSE: 'glucose',
        AMINO_ACIDS: 'amino_acids',
        WASTE: 'waste',
        TOXINS: 'toxins',
        CARBON: 'carbon'
    };
    
    // 環境クラスの定義
    class Environment {
        constructor() {
            this.resources = new Map();
            this.grid = Array(width).fill().map(() => 
                Array(height).fill().map(() => new Map())
            );
            
            // システムリソースの状態を追加
            this.systemState = {
                cpuLoad: 0.3,          // 0-1の値、CPUの負荷を表す
                memoryUsage: 0.4,      // 0-1の値、メモリ使用率を表す
                networkLatency: 0.1,   // 0-1の値、ネットワークの遅延を表す
                lastUpdate: Date.now() // 最後の更新時間
            };
            
            // システムノイズの影響係数
            this.noiseFactors = {
                temperature: 0.25,      // 温度変化の強さ（0.3から削減）
                turbulence: 0.15,       // 乱流の強さ（0.2から削減）
                visibility: 0.4,        // 視界への影響の強さ（0.5から削減）
                resourceDecay: 0.08     // 全体的なリソース減衰率に影響（0.1から削減）
            };
            
            // リソースの比重定義（1.0が中立、>1.0で沈殿、<1.0で浮上）
            this.resourceDensities = {
                [METABOLIC_PRODUCTS.GLUCOSE]: 0.8,     // グルコースの浮上性を少し抑える（0.85→0.8）
                [METABOLIC_PRODUCTS.OXYGEN]: 0.65,     // 酸素の浮上性を少し抑える（0.6→0.65）
                [METABOLIC_PRODUCTS.CARBON]: 1.35,     // 炭素の沈殿性を抑える（1.5→1.35）
                [METABOLIC_PRODUCTS.TOXINS]: 1.25      // 毒素の沈殿性を抑える（1.4→1.25）
            };
            
            // 垂直移動の最後の更新時間
            this.lastVerticalMovementUpdate = Date.now();
            
            // 毒素と栄養素の減衰処理の最終実行時間
            this.lastToxinDegradation = Date.now();
            this.lastResourceDegradation = Date.now();
            this.lastCarbonCheck = Date.now();
            
            // リソース管理用のグリッド
            this.resources = new Map();
            this.grid = Array(width).fill().map(() => 
                Array(height).fill().map(() => new Map())
            );
            
            // システム状態の定期更新
            this.updateSystemState();
        }
        
        // システムリソースの状態を更新
        updateSystemState() {
            const now = Date.now();
            const timeDiff = (now - this.systemState.lastUpdate) / 1000;
            
            // CPU負荷のシミュレーション（より単純な正弦波）
            this.systemState.cpuLoad = 0.3 + 0.2 * Math.sin(now / 5000);
            
            // メモリ使用率のシミュレーション（ランダムウォーク）
            this.systemState.memoryUsage = Math.max(0, Math.min(1,
                this.systemState.memoryUsage + (Math.random() - 0.5) * 0.05
            ));
            
            // ネットワークレイテンシーのシミュレーション（スパイク発生）
            if (Math.random() < 0.05) { // 5%の確率でスパイク
                this.systemState.networkLatency = Math.random();
            } else {
                this.systemState.networkLatency *= 0.95; // 徐々に回復
            }
            
            this.systemState.lastUpdate = now;
            
            // 環境への影響を適用
            this.applySystemEffects();
            
            // 次の更新をスケジュール
            setTimeout(() => this.updateSystemState(), 1000);
        }
        
        // システム状態に基づいて環境に影響を与える
        applySystemEffects() {
            // CPU負荷による温度変化
            const temperatureEffect = this.systemState.cpuLoad * this.noiseFactors.temperature;
            
            // メモリ使用率による環境の乱流
            const turbulenceEffect = this.systemState.memoryUsage * this.noiseFactors.turbulence;
            
            // ネットワークレイテンシーによる視界への影響
            const visibilityEffect = (1 - this.systemState.networkLatency) * this.noiseFactors.visibility;
            
            // 毒素の自然分解処理を実行（10秒ごと）
            const currentTime = Date.now();
            if (!this.lastToxinDegradation || currentTime - this.lastToxinDegradation > 10000) {
                this.degradeToxins();
                this.lastToxinDegradation = currentTime;
            }
            
            // 栄養素などのリソース減衰処理を実行（15秒ごと）
            if (!this.lastResourceDegradation || currentTime - this.lastResourceDegradation > 15000) {
                this.degradeResources();
                this.lastResourceDegradation = currentTime;
            }
            
            // 環境全体の炭素総量をチェックし、過剰な場合は追加対策を実行（30秒ごと）
            if (!this.lastCarbonCheck || currentTime - this.lastCarbonCheck > 30000) {
                this.checkCarbonLevels();
                this.lastCarbonCheck = currentTime;
            }
            
            // グリッド全体に影響を適用（パフォーマンスのため一部のセルのみ）
            for (let x = 0; x < width; x += 4) {
                for (let y = 0; y < height; y += 4) {
                    const cell = this.grid[x][y];
                    
                    // 温度による代謝への影響
                    cell.forEach((amount, type) => {
                        if (type === METABOLIC_PRODUCTS.GLUCOSE) {
                            const newAmount = amount * (1 - temperatureEffect);
                            cell.set(type, newAmount);
                        }
                    });
                    
                    // 乱流による資源の拡散（古い実装方法は使用しない）
                    // if (turbulenceEffect > 0.5) {
                    //     this.diffuseResources(x, y, turbulenceEffect);
                    // }
                }
            }
            
            // リソースの移動処理（垂直移動と拡散を統合）
            const now = Date.now();
            if (now - this.lastVerticalMovementUpdate > 1000) { // 1秒ごとに実行
                this.processResourceMovement(turbulenceEffect);
                this.lastVerticalMovementUpdate = now;
            }
        }
        
        // 資源の拡散をシミュレート（古いバージョン、新しい processResourceMovement へ移行中）
        diffuseResources(x, y, intensity) {
            const cell = this.grid[x][y];
            const diffusionRate = 0.1 * intensity;
            
            cell.forEach((amount, type) => {
                const diffusedAmount = amount * diffusionRate;
                
                // 隣接セルに拡散
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            this.addResource(type, {x: nx, y: ny}, diffusedAmount / 8);
                        }
                    }
                }
                
                // 元のセルから減少
                cell.set(type, amount - diffusedAmount);
            });
        }
        
        // 毒素の自然分解処理を追加
        degradeToxins() {
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const cell = this.grid[x][y];
                    
                    // 通常の毒素の分解
                    if (cell.has(METABOLIC_PRODUCTS.TOXINS)) {
                        const currentAmount = cell.get(METABOLIC_PRODUCTS.TOXINS);
                        // 毒素の自然分解（4%の減衰率 - 以前の5%から緩和）
                        const newAmount = currentAmount * 0.96;
                        cell.set(METABOLIC_PRODUCTS.TOXINS, newAmount);
                        
                        // 閾値以下になったら完全に除去
                        if (newAmount < 0.01) {
                            cell.delete(METABOLIC_PRODUCTS.TOXINS);
                        }
                    }
                    
                    // 特定の種類の毒素も分解
                    for (const [key, value] of cell.entries()) {
                        if (key.startsWith(METABOLIC_PRODUCTS.TOXINS + '_')) {
                            // 毒素の自然分解（2.5%の減衰率 - 以前の3%から緩和）
                            const newAmount = value * 0.975;
                            cell.set(key, newAmount);
                            
                            // 閾値以下になったら完全に除去
                            if (newAmount < 0.01) {
                                cell.delete(key);
                            }
                        }
                    }
                }
            }
        }
        
        // 栄養素やその他のリソースの自然減衰処理を追加
        degradeResources() {
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const cell = this.grid[x][y];
                    
                    // 各種リソースに減衰率を適用
                    for (const [key, value] of cell.entries()) {
                        if (key === METABOLIC_PRODUCTS.GLUCOSE) {
                            // グルコースの減衰（微生物による消費などを表現）
                            const newAmount = value * 0.955; // 減衰率を6%から4.5%に引き下げ
                            cell.set(key, newAmount);
                            
                            if (newAmount < 0.01) {
                                cell.delete(key);
                            }
                        }
                        else if (key === METABOLIC_PRODUCTS.OXYGEN) {
                            // 酸素の減衰（わずかな消費）
                            const newAmount = value * 0.97; // 減衰率を4%から3%に引き下げ
                            cell.set(key, newAmount);
                            
                            if (newAmount < 0.01) {
                                cell.delete(key);
                            }
                        }
                        else if (key === METABOLIC_PRODUCTS.AMINO_ACIDS) {
                            // アミノ酸の減衰
                            const newAmount = value * 0.99; // 減衰率を1.5%から1%に引き下げ
                            cell.set(key, newAmount);
                            
                            if (newAmount < 0.01) {
                                cell.delete(key);
                            } 
                        }
                        else if (key === METABOLIC_PRODUCTS.WASTE) {
                            // 廃棄物の分解プロセス（微生物による分解や毒素への変化を表現）
                            const newAmount = value * 0.975; // 減衰率を3%から2.5%に引き下げ
                            cell.set(key, newAmount);
                            
                            // 廃棄物が十分にある場合、一部を毒素に変換（微生物による分解過程で毒素が生成される）
                            if (value > 0.1 && Math.random() < 0.15) { // 変換確率を20%から15%に引き下げ
                                // 廃棄物の4%が毒素に変換される（以前は5%）
                                const toxinAmount = value * 0.04;
                                cell.set(key, newAmount - toxinAmount); // 廃棄物から減少
                                
                                // ランダムな毒素タイプを選択
                                const toxinTypes = ['neural', 'cellular', 'digestive'];
                                const toxinType = toxinTypes[Math.floor(Math.random() * toxinTypes.length)];
                                const toxinKey = `${METABOLIC_PRODUCTS.TOXINS}_${toxinType}`;
                                
                                // 毒素を追加
                                cell.set(toxinKey, (cell.get(toxinKey) || 0) + toxinAmount);
                                
                                // 副産物として極少量の炭素を生成（有機物分解の結果）- 生成量を調整
                                if (Math.random() < 0.25) { // 30%から25%に確率を引き下げ
                                    cell.set(METABOLIC_PRODUCTS.CARBON, (cell.get(METABOLIC_PRODUCTS.CARBON) || 0) + toxinAmount * 0.015); // 2%から1.5%に引き下げ
                                }
                            }
                            
                            if (newAmount < 0.01) {
                                cell.delete(key);
                            }
                        }
                        else if (key === METABOLIC_PRODUCTS.CARBON) {
                            // 炭素の減衰
                            const newAmount = value * 0.945; // 減衰率を7%から5.5%に引き下げ
                            cell.set(key, newAmount);
                            
                            // 炭素と酸素の反応による消費（環境化学反応）
                            const oxygenAmount = cell.get(METABOLIC_PRODUCTS.OXYGEN) || 0;
                            if (oxygenAmount > 0.05) {
                                // 酸素が存在する場合、炭素と反応して消費（CO2として）
                                const reactionAmount = Math.min(newAmount * 0.08, oxygenAmount * 0.16); // 以前の10%,20%から引き下げ
                                // 炭素を消費
                                cell.set(key, newAmount - reactionAmount);
                                // 酸素も消費
                                cell.set(METABOLIC_PRODUCTS.OXYGEN, oxygenAmount - reactionAmount);
                            }
                            
                            if (newAmount < 0.01) {
                                cell.delete(key);
                            }
                        }
                        // 毒素はdegradeToxinsで処理済みなのでスキップ
                        else if (!key.startsWith(METABOLIC_PRODUCTS.TOXINS)) {
                            // その他の未定義リソースの減衰（微量分解）
                            const newAmount = value * 0.99; // 1%の減衰率
                            cell.set(key, newAmount);
                            
                            if (newAmount < 0.01) {
                                cell.delete(key);
                            }
                        }
                    }
                }
            }
        }
        
        // 環境内の炭素レベルをチェックし、過剰な場合に対策を実行
        checkCarbonLevels() {
            // 環境内の炭素総量を計算
            let totalCarbon = 0;
            let carbonCells = 0;
            let totalCells = 0;
            
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const cell = this.grid[x][y];
                    totalCells++;
                    
                    const carbonAmount = cell.get(METABOLIC_PRODUCTS.CARBON) || 0;
                    if (carbonAmount > 0) {
                        totalCarbon += carbonAmount;
                        carbonCells++;
                    }
                }
            }
            
            // 炭素の平均濃度を計算
            const averageCarbonDensity = totalCarbon / totalCells;
            const carbonCoverage = carbonCells / totalCells;
            
            // 炭素が多すぎる場合、環境全体での追加的な分解
            const highCarbonThreshold = 0.15; // 高濃度の基準を引き上げ（0.1→0.15）
            const wideCoverageThreshold = 0.45; // 広範囲拡散の基準を引き上げ（0.4→0.45）
            
            if (averageCarbonDensity > highCarbonThreshold || carbonCoverage > wideCoverageThreshold) {
                console.log(`炭素レベルが高すぎます: 平均濃度=${averageCarbonDensity.toFixed(3)}, 範囲=${carbonCoverage.toFixed(3)}`);
                
                // 環境全体で炭素の強制分解を実施
                for (let x = 0; x < width; x++) {
                    for (let y = 0; y < height; y++) {
                        const cell = this.grid[x][y];
                        const carbonAmount = cell.get(METABOLIC_PRODUCTS.CARBON) || 0;
                        
                        if (carbonAmount > 0) {
                            // 平均濃度が高いほど強い分解率を適用
                            const extraDegradation = Math.min(0.4, averageCarbonDensity * 1.8); // 強制分解率を緩和（0.5→0.4, 2→1.8）
                            const newAmount = carbonAmount * (1 - extraDegradation);
                            
                            if (newAmount < 0.01) {
                                cell.delete(METABOLIC_PRODUCTS.CARBON);
                            } else {
                                cell.set(METABOLIC_PRODUCTS.CARBON, newAmount);
                            }
                        }
                    }
                }
            }
        }
        
        addResource(type, position, amount, subType = null) {
            const x = Math.floor(position.x);
            const y = Math.floor(position.y);
            if (x >= 0 && x < width && y >= 0 && y < height) {
                const cell = this.grid[x][y];
                if (type === METABOLIC_PRODUCTS.TOXINS && subType) {
                    // 毒素の場合は種類も保存
                    const toxinKey = `${type}_${subType}`;
                    cell.set(toxinKey, (cell.get(toxinKey) || 0) + amount);
                } else {
                    cell.set(type, (cell.get(type) || 0) + amount);
                }
            }
        }
        
        getResources(position, radius) {
            const x = Math.floor(position.x);
            const y = Math.floor(position.y);
            const resources = new Map();
            
            for (let i = -radius; i <= radius; i++) {
                for (let j = -radius; j <= radius; j++) {
                    const checkX = x + i;
                    const checkY = y + j;
                    if (checkX >= 0 && checkX < width && checkY >= 0 && checkY < height) {
                        const cell = this.grid[checkX][checkY];
                        cell.forEach((amount, type) => {
                            resources.set(type, (resources.get(type) || 0) + amount);
                        });
                    }
                }
            }
            return resources;
        }
        
        // リソースの浮上・沈殿と拡散を統合した処理
        processResourceMovement(turbulenceIntensity) {
            // すべてのセルのリソース情報をコピー (非破壊的な更新のため)
            const gridCopy = Array(width).fill().map((_, x) => 
                Array(height).fill().map((_, y) => {
                    const newMap = new Map();
                    this.grid[x][y].forEach((amount, type) => {
                        newMap.set(type, amount);
                    });
                    return newMap;
                })
            );
            
            // リソースの移動を計算
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const cell = this.grid[x][y];
                    
                    // このセルに何かリソースがある場合のみ処理
                    if (cell.size === 0) continue;
                    
                    // 削除するキーのリストを保持するための配列
                    const keysToRemove = [];
                    
                    cell.forEach((amount, type) => {
                        // 基本型のリソースタイプを抽出（毒素の亜種を処理するため）
                        const baseType = type.split('_')[0];
                        
                        // リソースタイプの比重を取得
                        const density = this.resourceDensities[baseType] || 1.0;
                        
                        // 元のリソース量が少なすぎる場合はスキップ
                        if (amount <= 0.01) {
                            keysToRemove.push(type);
                            return;
                        }
                        
                        // 比重による垂直移動の計算
                        let verticalMovement = 0;
                        let targetY = y;
                        
                        // 垂直移動率 (比重と量に基づく)
                        const verticalMoveRate = 0.04 * Math.min(1.0, amount / 12); // 移動率を緩和（0.05→0.04, 10→12）
                        const verticalMoveAmount = amount * verticalMoveRate;
                        
                        if (density < 1.0 && y > 0) {
                            // 浮上する場合
                            verticalMovement = (1.0 - density) * verticalMoveAmount;
                            targetY = y - 1;
                        } 
                        else if (density > 1.0 && y < height - 1) {
                            // 沈殿する場合
                            verticalMovement = (density - 1.0) * verticalMoveAmount;
                            targetY = y + 1;
                        }
                        
                        // 拡散の計算 (乱流の強さに影響される)
                        const baseDiffusionRate = 0.08; // 基本拡散率を引き下げ（0.1→0.08）
                        const diffusionRate = baseDiffusionRate * 
                            (1 + turbulenceIntensity * 1.8); // 乱流影響係数を引き下げ（2→1.8）
                        
                        // 炭素は通常より拡散率を低くする
                        let actualDiffusionRate = diffusionRate;
                        if (baseType === METABOLIC_PRODUCTS.CARBON) {
                            actualDiffusionRate = diffusionRate * 0.35; // 炭素の拡散率を少し上げる（0.3→0.35）
                        }
                        
                        const diffusedAmount = amount * actualDiffusionRate;
                        
                        // 垂直移動と水平拡散の組み合わせ
                        if (verticalMovement > 0) {
                            // 元のセルから垂直移動した量を差し引く
                            const remainingAfterVertical = amount - verticalMovement;
                            
                            if (remainingAfterVertical <= 0.01) {
                                // 残量が極めて小さい場合は削除
                                keysToRemove.push(type);
                            } else {
                                // 残ったリソースを拡散
                                const remainingAfterDiffusion = remainingAfterVertical - diffusedAmount;
                                
                                if (remainingAfterDiffusion <= 0.01) {
                                    keysToRemove.push(type);
                                } else {
                                    gridCopy[x][y].set(type, remainingAfterDiffusion);
                                }
                                
                                // 隣接セルへの拡散（水平方向）
                                this.diffuseToNeighbors(x, y, type, diffusedAmount, gridCopy);
                            }
                            
                            // 垂直移動先のセルに移動
                            const currentAmount = gridCopy[x][targetY].get(type) || 0;
                            gridCopy[x][targetY].set(type, currentAmount + verticalMovement);
                        } else {
                            // 垂直移動なし、拡散のみ
                            const remainingAfterDiffusion = amount - diffusedAmount;
                            
                            if (remainingAfterDiffusion <= 0.01) {
                                keysToRemove.push(type);
                            } else {
                                gridCopy[x][y].set(type, remainingAfterDiffusion);
                            }
                            
                            // 隣接セルへの拡散
                            this.diffuseToNeighbors(x, y, type, diffusedAmount, gridCopy);
                        }
                    });
                    
                    // 極めて小さな量のリソースをセルから削除
                    keysToRemove.forEach(key => cell.delete(key));
                }
            }
            
            // 計算結果を元のグリッドに適用
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    this.grid[x][y].clear();
                    gridCopy[x][y].forEach((amount, type) => {
                        if (amount > 0.01) {
                            this.grid[x][y].set(type, amount);
                        }
                    });
                }
            }
        }
        
        // 隣接セルへのリソース拡散ヘルパーメソッド
        diffuseToNeighbors(x, y, type, totalAmount, gridCopy) {
            const amountPerNeighbor = totalAmount / 8; // 8方向に均等に拡散
            
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    // 中心のセルはスキップ
                    if (dx === 0 && dy === 0) continue;
                    
                    const nx = x + dx;
                    const ny = y + dy;
                    
                    // グリッドの境界チェック
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const currentAmount = gridCopy[nx][ny].get(type) || 0;
                        gridCopy[nx][ny].set(type, currentAmount + amountPerNeighbor);
                    }
                }
            }
        }
        
        // 古い垂直移動メソッドは削除または非アクティブ化
        /*
        processResourceVerticalMovement() {
            // この実装は processResourceMovement に統合されました
        }
        */
    }
    
    // 環境インスタンスを作成（ここで初期化）
    const environment = new Environment();
    
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
    const predationRange = 8;  // 5から8に増加（捕食可能な距離を拡大）
    const predationEnergyGain = 0.8;  // 0.6から0.8に増加（捕食で得られるエネルギーの割合を増加）
    const predationSuccessRate = 0.8;  // 0.7から0.8に増加（捕食の成功率を向上）
    
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
            
            // デジタル代謝の状態を追加
            this.digitalMetabolism = {
                processedData: 0,
                cacheEfficiency: 0.8 + Math.random() * 0.2,
                wasteAccumulation: 0
            };
            
            // 情報エントロピーの状態を追加
            this.informationState = {
                entropy: 0.5,
                orderLevel: 1.0
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
                
                // 光合成システム（改良）
                photosynthesis: {
                    efficiency: Math.random(),        // 基本効率
                    depth: {
                        optimal: Math.random() * 10 - 5,  // 最適深度
                        range: 0.2 + Math.random() * 0.3  // 許容範囲
                    },
                    wavelengths: [
                        // 可視光域での光合成効率
                        { min: 400, max: 500, efficiency: Math.random() },  // 青色光
                        { min: 500, max: 600, efficiency: Math.random() },  // 緑色光
                        { min: 600, max: 700, efficiency: Math.random() }   // 赤色光
                    ],
                    adaptations: {
                        nightMode: Math.random() * 0.3,     // 夜間の光合成効率
                        stressResponse: Math.random() * 0.5  // ストレス下での効率
                    }
                },

                // 毒素システム（改良）
                toxins: {
                    types: {
                        neural: {          // 神経毒
                            strength: Math.random() * 0.5,
                            developmentCost: 0.3,
                            effectRange: 2 + Math.random() * 3
                        },
                        cellular: {        // 細胞毒
                            strength: Math.random() * 0.5,
                            developmentCost: 0.4,
                            effectRange: 1 + Math.random() * 2
                        },
                        digestive: {       // 消化器毒
                            strength: Math.random() * 0.5,
                            developmentCost: 0.2,
                            effectRange: 1.5 + Math.random() * 2
                        },
                        genetic: {         // 遺伝子操作毒素（新規）
                            strength: Math.random() * 0.3,
                            developmentCost: 0.5,
                            effectRange: 1 + Math.random() * 1.5,
                            mutagenicPotential: Math.random() * 0.5  // 突然変異を引き起こす能力
                        }
                    },
                    resistance: {
                        neural: Math.random(),
                        cellular: Math.random(),
                        digestive: Math.random(),
                        genetic: Math.random() * 0.3  // 初期値は低め（進化の余地を残す）
                    },
                    adaptation: {
                        productionRate: Math.random() * 0.3,    // 毒素生成速度
                        storageCapacity: 0.5 + Math.random(),   // 毒素貯蔵能力
                        releaseControl: Math.random()           // 毒素放出の制御能力
                    }
                },

                // 遺伝子ネットワーク（新規）
                geneNetwork: {
                    photosynthesis: {
                        enhancedBy: ['efficiency', 'regenerationRate'],
                        suppressedBy: ['toxins.adaptation.productionRate'],
                        influences: ['energy', 'growth']
                    },
                    toxins: {
                        enhancedBy: ['efficiency', 'size'],
                        suppressedBy: ['photosynthesis.efficiency'],
                        influences: ['predation', 'defense']
                    }
                },
                
                // その他の既存の特性は維持
                mobility: Math.random(),
                growthRate: 0.1 + Math.random() * 0.4,
                
                // Boidの動き
                separationWeight: 0.3 + Math.random() * 0.2,
                alignmentWeight: 0.2 + Math.random() * 0.2,
                cohesionWeight: 0.2 + Math.random() * 0.2,
                
                // 環境適応性
                depthPreference: (Math.random() * 10) - 5,
                depthTolerance: 0.2 + Math.random() * 0.2,
                
                regenerationRate: Math.random() * 0.05,
                
                // 繁殖戦略
                offspringCount: 1,
                parentalCare: 0.1 + Math.random() * 0.2,
                
                // 行動パターン
                nocturnality: 0.4 + Math.random() * 0.2,
                territoriality: Math.random() * 0.2,
                
                // 寄生システム
                parasitism: {
                    capability: Math.random(),        // 寄生能力
                    hostPreference: Math.random(),    // 好む宿主タイプ
                    reproductiveDefect: Math.random() > 0.8,  // 80%の確率で自力繁殖不能
                    adaptations: {
                        hostControl: Math.random(),   // 宿主の行動を制御する能力
                        resourceDrain: Math.random(), // 宿主からのエネルギー吸収効率
                        hostImmuneSuppression: Math.random()  // 宿主の免疫抑制能力
                    }
                },
                
                // 寄生への耐性システム
                parasiteResistance: {
                    immuneStrength: Math.random(),    // 免疫力
                    detectionAbility: Math.random(),  // 寄生者の検出能力
                    recoveryRate: Math.random()       // 寄生からの回復率
                },
                
                // DNAに以下のような特性を追加
                resourceExchange: {
                    giveRate: Math.random(),      // リソースを提供する傾向
                    receiveRate: Math.random(),   // リソースを受け取る傾向
                    exchangeRange: Math.random(), // 交換可能な範囲
                    exchangeType: {              // 交換可能なリソースタイプ
                        energy: Math.random(),
                        nutrients: Math.random(),
                        protection: Math.random()
                    }
                },
                
                metabolicPathways: {
                    wasteProducts: [],           // 代謝産物（他の生物のリソースになりうる）
                    requiredResources: [         // 必要な資源の初期設定
                        METABOLIC_PRODUCTS.GLUCOSE,
                        METABOLIC_PRODUCTS.OXYGEN
                    ],
                    byproducts: []              // 副産物（他の生物に有益または有害）
                }
            };
            
            // DNAが渡された場合でも、metabolicPathwaysが存在することを保証
            if (!this.dna.metabolicPathways) {
                this.dna.metabolicPathways = {
                    wasteProducts: [],
                    requiredResources: [
                        METABOLIC_PRODUCTS.GLUCOSE,
                        METABOLIC_PRODUCTS.OXYGEN
                    ],
                    byproducts: []
                };
            }
            
            // 生命体の状態
            this.energy = energy !== undefined ? energy : 0.8 + Math.random() * 0.2;
            this.age = 0;
            this.isDead = false;
            this.deathTime = 0;        // 死亡時刻
            this.decompositionTime = 0; // 分解までの時間
            this.lastReproductionTime = 0;
            this.size = Math.max(0.1, Math.min(1.0, 0.1 + Math.random() * 0.3));  // サイズを0.1-1.0に制限
            this.maxSize = Math.max(this.size, Math.min(1.0, this.dna?.size || 0.3));  // 最大サイズも制限
            
            // 捕食関連の状態
            this.lastPredationTime = 0;
            this.lastPredationAttemptTime = 0;
            this.isPredator = (this.dna?.predatory || 0) > 0.6 && (this.dna?.mobility || 0) > 0.4;
            
            // 生命体の色
            this.baseHue = this.calculateBaseHue();
            
            // 物理的な制約のためのパラメータを追加
            this.terminalVelocity = 2.0;  // 終端速度
            this.gravityStrength = 0.001;  // 重力の強さ
            this.dragCoefficient = 0.001;  // 空気抵抗係数
            this.metabolicStress = 0;     // 代謝ストレス（高速移動によるダメージ蓄積）
            
            // 代謝関連の状態を追加
            this.metabolicState = {
                storedResources: new Map(),
                lastMetabolism: 0,
                metabolicRate: 0.1,
                resourceEfficiency: this.dna?.efficiency || 0.5
            };
            
            // 慣性関連のパラメータを追加
            this.inertia = 0.92;  // 慣性係数（高いほど慣性が強い）
            this.turnRate = 0.15; // 方向転換の速度（低いほど滑らか）
            this.accelerationSmoothing = 0.85; // 加速度の平滑化係数
            this.lastAcceleration = { x: 0, y: 0, z: 0 }; // 前回の加速度を保存
            
            // システムノイズへの適応状態を追加
            this.adaptationState = {
                temperatureTolerance: 0.5,
                turbulenceResistance: 0.5,
                visualAdaptation: 0.5,
                lastAdaptation: Date.now()
            };
            
            // 適応コストを追加
            this.adaptationCosts = {
                temperature: 0.01,    // 温度適応のエネルギーコスト
                turbulence: 0.015,   // 乱流耐性のエネルギーコスト
                visual: 0.008        // 視覚適応のエネルギーコスト
            };
        }
        
        calculateBaseHue() {
            if (this.dna?.photosynthesis?.efficiency > 0.6) {
                // 光合成能力が高い生命体は緑系
                return 90 + Math.floor((this.dna?.photosynthesis?.efficiency || 0.5) * 30);
            } else if (this.isPredator) {
                // 捕食者は赤系
                return 0 + Math.floor((this.dna?.predatory || 0.5) * 60);
            } else {
                // その他は青系
                return 180 + Math.floor((1 - (this.dna?.predatory || 0.5)) * 60);
            }
        }
        
        // 他の生命体との相互作用（捕食を含む）
        interact(lifeforms, environment) {
            let steering = { x: 0, y: 0, z: 0 };
            let count = 0;
            
            // Boidの動きのための変数
            let separation = { x: 0, y: 0, z: 0 };
            let alignment = { x: 0, y: 0, z: 0 };
            let cohesion = { x: 0, y: 0, z: 0 };
            let flockCount = 0;
            let avgPosition = { x: 0, y: 0, z: 0 };
            let avgVelocity = { x: 0, y: 0, z: 0 };
            
            // 毒素忌避のための変数を追加
            let toxinAvoidance = { x: 0, y: 0, z: 0 };
            let toxinCount = 0;
            
            // 捕食対象または仲間を探す
            let preyFound = false;
            let closestPreyDist = Infinity;
            let closestPrey = null;
            
            // 死体との相互作用のための変数
            let closestCorpseDist = Infinity;
            let closestCorpse = null;
            
            // 知覚範囲を計算
            const perceptionRadius = 15 * this.dna.perception;
            
            for (const other of lifeforms) {
                if (other === this) continue;
                
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const dz = other.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < perceptionRadius) {
                    if (other.isDead) {
                        // 死体の毒素を避ける行動を毒性タイプに基づいて計算
                        const mainToxinResistance = this.dna?.toxins?.resistance?.neural || 0.1;
                        const secondaryToxinResistance = this.dna?.toxins?.resistance?.cellular || 0.1;
                        const avgResistance = (mainToxinResistance + secondaryToxinResistance) / 2;
                        
                        if (avgResistance < 0.5) {
                            const mainToxinForce = this.dna?.toxins?.types?.neural?.strength || 0.1;
                            const secondaryToxinForce = (this.dna?.toxins?.types?.cellular?.strength || 0.1) * 0.5;
                            const totalToxinForce = (mainToxinForce + secondaryToxinForce) * (1 - avgResistance);
                            const avoidanceStrength = totalToxinForce * (1 - distance / perceptionRadius);
                            
                            toxinAvoidance.x -= dx * avoidanceStrength;
                            toxinAvoidance.y -= dy * avoidanceStrength;
                            toxinAvoidance.z -= dz * avoidanceStrength;
                            toxinCount++;
                        }
                        
                        // 毒素耐性が高い場合のみ死体に接近
                        if (avgResistance > 0.5 && distance < closestCorpseDist) {
                            closestCorpseDist = distance;
                            closestCorpse = other;
                        }
                        continue;
                    }
                    
                    // 生存中の生命体との毒素関連の相互作用も更新
                    const otherMainToxinResistance = this.dna?.toxins?.resistance?.neural || 0.1;
                    const otherSecondaryToxinResistance = this.dna?.toxins?.resistance?.cellular || 0.1;
                    const avgOtherResistance = (otherMainToxinResistance + otherSecondaryToxinResistance) / 2;
                    
                    if (avgOtherResistance < 0.5 && ((this.dna?.toxins?.types?.neural?.strength || 0) > 0.3 || 
                        (this.dna?.toxins?.types?.cellular?.strength || 0) > 0.3)) {
                        const mainToxinForce = this.dna?.toxins?.types?.neural?.strength || 0.1;
                        const secondaryToxinForce = (this.dna?.toxins?.types?.cellular?.strength || 0.1) * 0.5;
                        const totalToxinForce = (mainToxinForce + secondaryToxinForce) * (1 - avgOtherResistance);
                        const avoidanceStrength = totalToxinForce * (1 - distance / perceptionRadius);
                        
                        toxinAvoidance.x -= dx * avoidanceStrength;
                        toxinAvoidance.y -= dy * avoidanceStrength;
                        toxinAvoidance.z -= dz * avoidanceStrength;
                        toxinCount++;
                    }
                    
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
            
            // 死体への接近と毒素吸収
            if (closestCorpse && closestCorpseDist < 5) {
                // 毒素耐性と吸収能力に基づいてエネルギーを得る
                const absorbedEnergy = closestCorpse.energy * 
                    (this.dna.toxins?.adaptation?.storageCapacity || 0.5) * 
                    Math.min(1, (this.dna.toxins?.resistance?.neural || 0.1) / 
                    (closestCorpse.dna.toxins?.types?.neural?.strength || 0.1)) * 0.1;
                
                if (absorbedEnergy > 0) {
                    this.energy = Math.min(1.0, this.energy + absorbedEnergy);
                    closestCorpse.energy *= 0.9; // 吸収された分のエネルギーを減少
                }
                
                // 死体に向かう力を生成
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
                    // flockingBehaviorのプロパティがあれば使用、なければDNAの直接の値を使用
                    const sepWeight = this.dna.flockingBehavior?.separation || this.dna.separationWeight;
                    separation.x = (separation.x / sepMag) * sepWeight;
                    separation.y = (separation.y / sepMag) * sepWeight;
                    separation.z = (separation.z / sepMag) * sepWeight;
                }
                
                // 整列の正規化と重み付け
                const alignWeight = this.dna.flockingBehavior?.alignment || this.dna.alignmentWeight;
                alignment.x = (alignment.x / flockCount) * alignWeight;
                alignment.y = (alignment.y / flockCount) * alignWeight;
                alignment.z = (alignment.z / flockCount) * alignWeight;
                
                // 結合の計算と重み付け
                avgPosition.x = avgPosition.x / flockCount;
                avgPosition.y = avgPosition.y / flockCount;
                avgPosition.z = avgPosition.z / flockCount;
                
                const cohWeight = this.dna.flockingBehavior?.cohesion || this.dna.cohesionWeight;
                cohesion.x = (avgPosition.x - this.position.x) * cohWeight;
                cohesion.y = (avgPosition.y - this.position.y) * cohWeight;
                cohesion.z = (avgPosition.z - this.position.z) * cohWeight;
                
                // すべての力を合成
                steering.x += separation.x + alignment.x + cohesion.x;
                steering.y += separation.y + alignment.y + cohesion.y;
                steering.z += separation.z + alignment.z + cohesion.z;
            }
            
            // 捕食行動
            if (preyFound && closestPrey && closestPreyDist < predationRange) {
                // クールダウン時間を20から15に短縮
                if (time - this.lastPredationAttemptTime > 15) {
                    this.lastPredationAttemptTime = time;
                    
                    // サイズ差による成功率の計算を調整（べき乗を0.8に）
                    const sizeDifference = Math.pow(this.dna.size / closestPrey.dna.size, 0.8);
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
            
            // 毒素忌避の力を追加
            if (toxinCount > 0) {
                const toxinMagnitude = Math.sqrt(
                    toxinAvoidance.x * toxinAvoidance.x +
                    toxinAvoidance.y * toxinAvoidance.y +
                    toxinAvoidance.z * toxinAvoidance.z
                );
                
                if (toxinMagnitude > 0) {
                    const toxinWeight = 1.5; // 毒素忌避の重み（他の力より優先）
                    toxinAvoidance.x = (toxinAvoidance.x / toxinMagnitude) * toxinWeight;
                    toxinAvoidance.y = (toxinAvoidance.y / toxinMagnitude) * toxinWeight;
                    toxinAvoidance.z = (toxinAvoidance.z / toxinMagnitude) * toxinWeight;
                    
                    steering.x += toxinAvoidance.x;
                    steering.y += toxinAvoidance.y;
                    steering.z += toxinAvoidance.z;
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
            
            // 代謝産物による相互作用を追加
            for (const other of lifeforms) {
                if (other === this || other.isDead) continue;
                
                const distance = this.getDistanceTo(other);
                // resourceExchangeの存在チェックを追加
                if (this.dna?.resourceExchange?.exchangeRange && 
                    distance < this.dna.resourceExchange.exchangeRange * 5) {
                    // 代謝産物の交換
                    const exchangeEfficiency = Math.max(0, 1 - distance / (this.dna.resourceExchange.exchangeRange * 5));
                    
                    // giveRateの存在チェックも追加
                    if (this.dna.resourceExchange.giveRate > 0.5) {
                        const resources = environment.getResources(this.position, 1);
                        resources.forEach((amount, type) => {
                            if (other.needsResource(type)) {
                                const given = amount * exchangeEfficiency * this.dna.resourceExchange.giveRate;
                                environment.addResource(type, other.position, given);
                                environment.addResource(type, this.position, -given);
                                
                                // 協力関係の強化
                                this.strengthenBond(other);
                            }
                        });
                    }
                }
                
                // 遺伝子操作毒素の効果
                if (this.dna?.toxins?.types?.genetic?.strength > 0.2 && 
                    distance < this.dna.toxins.types.genetic.effectRange * 2) {
                    
                    // 遺伝子操作毒素の放出
                    const toxinStrength = this.dna.toxins.types.genetic.strength;
                    const resistanceLevel = other.dna?.toxins?.resistance?.genetic || 0;
                    const effectiveStrength = Math.max(0, toxinStrength - resistanceLevel);
                    
                    if (effectiveStrength > 0.1 && Math.random() < effectiveStrength * 0.5) {
                        // エピジェネティック状態の初期化
                        if (!other.epigeneticState) other.epigeneticState = new EpigeneticState();
                        
                        // ランダムな遺伝子を選択して発現を変化させる
                        const targetGenes = ['speed', 'perception', 'efficiency', 'photosynthesis.efficiency'];
                        const targetGene = targetGenes[Math.floor(Math.random() * targetGenes.length)];
                        
                        // 遺伝子発現の変化を記録
                        other.epigeneticState.updateMethylation(targetGene, effectiveStrength);
                        
                        // 遺伝子発現の変化を適用
                        if (!other._geneExpressionModifiers) other._geneExpressionModifiers = {};
                        other._geneExpressionModifiers[targetGene] = {
                            factor: 1 - effectiveStrength,
                            duration: 50 + Math.floor(effectiveStrength * 150)  // 効果の持続時間
                        };
                        
                        // 毒素放出のエネルギーコスト
                        this.energy -= this.dna.toxins.types.genetic.developmentCost * 0.1;
                        
                        // 毒素の影響下にある生命体は遺伝子伝達の受容体が活性化
                        other._receptiveToTransfer = true;
                        
                        // 突然変異の可能性
                        if (Math.random() < this.dna.toxins.types.genetic.mutagenicPotential * 0.3) {
                            // 遺伝子の水平伝達
                            this.transferGene(other);
                        }
                        
                        // 交配の可能性を高める
                        if (this.dna._geneticHackingPotential && Math.random() < this.dna._geneticHackingPotential * 0.2) {
                            // 自身も受容体を活性化
                            this._receptiveToTransfer = true;
                            
                            // 交配を試みる
                            if (Math.random() < 0.2) {
                                this.attemptMating(other);
                            }
                        }
                    }
                }
                
                // 水平遺伝子伝達（低確率で自然発生）
                if (distance < 2 && Math.random() < 0.005) {
                    this.transferGene(other);
                }
            }
            
            return steering;
        }
        
        // 遺伝子の水平伝達
        transferGene(other) {
            // リサイクル機能がOFFの場合は処理しない
            if (!enableRecycling) return;
            
            // 受容体が活性化されているか、低確率で発生
            if (other._receptiveToTransfer || Math.random() < 0.1) {
                // 転移可能な遺伝子を選択
                const transferableGenes = Object.keys(this.dna).filter(key => 
                    typeof this.dna[key] === 'number' && key !== '_requires_host'
                );
                
                if (transferableGenes.length > 0) {
                    const geneToTransfer = transferableGenes[Math.floor(Math.random() * transferableGenes.length)];
                    
                    // 遺伝子の転移（混合）
                    other.dna[geneToTransfer] = (other.dna[geneToTransfer] || 0) * 0.7 + this.dna[geneToTransfer] * 0.3;
                    
                    // 遺伝子転移のエネルギーコスト
                    this.energy -= 0.05;
                    
                    // 遺伝子獲得のマーカー
                    other._acquiredGenes = other._acquiredGenes || [];
                    other._acquiredGenes.push({
                        gene: geneToTransfer,
                        source: this,
                        time: time
                    });
                    
                    // 免疫応答の可能性
                    if (other.dna?.toxins?.resistance?.genetic > 0.6 && Math.random() < other.dna.toxins.resistance.genetic * 0.5) {
                        // 免疫応答が成功した場合、転移した遺伝子を拒絶
                        delete other.dna[geneToTransfer];
                        other._immune_response = true;
                    }
                    
                    // 交配の可能性を追加
                    if (this._acquiredGenes && other._acquiredGenes && 
                        this._receptiveToTransfer && other._receptiveToTransfer &&
                        Math.random() < 0.3) { // 30%の確率で交配が発生
                        this.attemptMating(other);
                    }
                }
            }
        }
        
        // 交配を試みるメソッド
        attemptMating(partner) {
            // リサイクル機能がOFFの場合は処理しない
            if (!enableRecycling) return;
            
            // 両者のエネルギーが十分かチェック
            if (this.energy < 0.4 || partner.energy < 0.4) return;
            
            // 交配のエネルギーコスト
            const matingCost = 0.2;
            this.energy -= matingCost;
            partner.energy -= matingCost;
            
            // 遺伝子組み換えによる子孫のDNA生成
            const childDna = this.crossover(partner);
            
            // 遺伝子ハッキングの影響を子孫に反映
            if (this._acquiredGenes || partner._acquiredGenes) {
                // 毒素システムの強化
                childDna.toxins = childDna.toxins || {};
                childDna.toxins.types = childDna.toxins.types || {};
                childDna.toxins.types.genetic = childDna.toxins.types.genetic || {
                    strength: 0.3,
                    developmentCost: 0.4,
                    effectRange: 2.0,
                    mutagenicPotential: 0.4
                };
                
                // 遺伝子ハッキングによる特殊能力
                childDna._geneticHackingPotential = 0.5 + Math.random() * 0.5;
                
                // 交配による特殊フラグ
                childDna._matingOffspring = true;
            }
            
            // 子孫の位置を両親の中間に設定
            const childX = (this.position.x + partner.position.x) / 2 + (Math.random() - 0.5) * 2;
            const childY = (this.position.y + partner.position.y) / 2 + (Math.random() - 0.5) * 2;
            const childZ = (this.position.z + partner.position.z) / 2 + (Math.random() - 0.5) * 2;
            
            // 子孫を生成
            const child = new Lifeform(
                childX,
                childY,
                childZ,
                0.5, // 初期エネルギー
                childDna
            );
            
            // 子孫を環境に追加
            lifeforms.push(child);
            
            // 交配記録
            this._lastMatingTime = time;
            partner._lastMatingTime = time;
            this._matingPartner = partner;
            partner._matingPartner = this;
            
            // 結合を強化
            this.strengthenBond(partner);
            partner.strengthenBond(this);
        }
        
        strengthenBond(other) {
            if (!this.bonds) this.bonds = new Map();
            const currentBond = this.bonds.get(other) || 0;
            this.bonds.set(other, Math.min(1.0, currentBond + 0.01));
            
            // 群れ行動の重みを調整
            if (this.bonds.get(other) > 0.5) {
                this.dna.cohesionWeight *= 1.01;
                this.dna.alignmentWeight *= 1.01;
            }
        }
        
        needsResource(type) {
            // 必要な資源かどうかを判定（安全なプロパティアクセス）
            return this.dna?.metabolicPathways?.requiredResources?.includes(type) || false;
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
        update(lifeforms, environment) {
            // 遺伝子発現の変化を適用
            if (this._geneExpressionModifiers) {
                for (const [gene, modifier] of Object.entries(this._geneExpressionModifiers)) {
                    // 遺伝子パスを解析
                    const genePath = gene.split('.');
                    let target = this.dna;
                    for (let i = 0; i < genePath.length - 1; i++) {
                        if (target[genePath[i]]) {
                            target = target[genePath[i]];
                        } else {
                            target = null;
                            break;
                        }
                    }
                    
                    const finalGene = genePath[genePath.length - 1];
                    if (target && target[finalGene] !== undefined) {
                        // 元の値を保存
                        if (!target._originalValues) target._originalValues = {};
                        if (target._originalValues[finalGene] === undefined) {
                            target._originalValues[finalGene] = target[finalGene];
                        }
                        
                        // 修飾を適用
                        target[finalGene] = target._originalValues[finalGene] * modifier.factor;
                        
                        // 持続時間を減少
                        modifier.duration--;
                        
                        // 持続時間が終了したら効果を解除
                        if (modifier.duration <= 0) {
                            target[finalGene] = target._originalValues[finalGene];
                            delete this._geneExpressionModifiers[gene];
                            
                            // 突然変異の可能性
                            if (Math.random() < 0.1) {
                                // 永続的な変異
                                target[finalGene] *= 1 + (Math.random() * 0.4 - 0.2); // -20%〜+20%の変化
                                target._originalValues[finalGene] = target[finalGene]; // 新しい基準値を設定
                            }
                        }
                    }
                }
            }
            
            // 遺伝子ハッキングへの免疫応答
            if (this._immune_response) {
                // 免疫応答のエネルギーコスト
                this.energy -= 0.02;
                
                // 免疫応答の持続時間
                if (!this._immune_response_duration) {
                    this._immune_response_duration = 50;
                } else {
                    this._immune_response_duration--;
                    if (this._immune_response_duration <= 0) {
                        this._immune_response = false;
                        delete this._immune_response_duration;
                    }
                }
                
                // 免疫応答中は遺伝子伝達の受容体が不活性化
                this._receptiveToTransfer = false;
            }
            
            // 受容体の状態を時間経過で減衰
            if (this._receptiveToTransfer && Math.random() < 0.05) {
                this._receptiveToTransfer = false;
            }
            
            // 宿主依存の処理を追加
            if (this.dna._requires_host) {
                if (!this._attached_host) {
                    // 宿主を探す
                    const potentialHosts = lifeforms.filter(host => {
                        if (host === this || host.isDead || host.dna._requires_host) return false;
                        if (host._parasites && host._parasites.length >= 3) return false;
                        return host.dna.photosynthesis?.efficiency > 0.5;
                    });

                    if (potentialHosts.length > 0) {
                        const host = potentialHosts[Math.floor(Math.random() * potentialHosts.length)];
                        if (!host._parasites) host._parasites = [];
                        host._parasites.push(this);
                        this._attached_host = host;
                        this.position = { ...host.position };
                    } else {
                        // 宿主が見つからない場合、エネルギーを急速に失う
                        this.energy *= 0.95;
                    }
                } else {
                    // 宿主からエネルギーを得る（依存度に応じて）
                    const energyDrain = this._attached_host.energy * 0.01 * (this.dna._host_dependency || 0.5);
                    this._attached_host.energy -= energyDrain;
                    this.energy += energyDrain * 0.4; // 80%から40%に効率を大幅に下げる
                    
                    // 残りは環境に廃棄物として放出
                    environment.addResource(
                        METABOLIC_PRODUCTS.WASTE,
                        this.position,
                        energyDrain * 0.3 // 30%は廃棄物に
                    );
                    
                    // 宿主の位置に追従
                    this.position = { ...this._attached_host.position };
                    
                    // 宿主が死亡した場合、関係を解除
                    if (this._attached_host.isDead) {
                        this._attached_host = null;
                    }
                }
            }
            
            // 死体の分解処理
            if (this.isDead) {
                if (this.deathTime === 0) {
                    this.deathTime = time;
                    // 毒性が高いほど分解に時間がかかる
                    const baseToxinStrength = this.dna?.toxins?.types?.neural?.strength || 0.1;
                    this.decompositionTime = 200 + Math.floor(baseToxinStrength * 300); // 分解時間を延長
                    
                    // 死後の初期状態を設定
                    this.decompositionStage = 0;
                    
                    // リソース放出フラグを初期化
                    this._releasedResourcesStage1 = false;
                    this._releasedResourcesStage2 = false;
                    this._releasedResourcesStage3 = false;
                    
                    this.postMortemToxins = {
                        neural: baseToxinStrength,
                        cellular: this.dna?.toxins?.types?.cellular?.strength || 0.1,
                        digestive: this.dna?.toxins?.types?.digestive?.strength || 0.1
                    };
                }
                
                // 分解の進行度を計算
                const decompositionProgress = (time - this.deathTime) / this.decompositionTime;
                
                // 分解段階の更新（4段階）
                const newStage = Math.floor(decompositionProgress * 4);
                if (newStage > this.decompositionStage) {
                    this.decompositionStage = newStage;
                    
                    // 各段階での毒素変化
                    switch(this.decompositionStage) {
                        case 1: // 初期分解
                            // 細胞の崩壊により一時的に毒素が増加
                            Object.keys(this.postMortemToxins).forEach(type => {
                                this.postMortemToxins[type] *= 1.2;
                            });
                            break;
                        case 2: // 中期分解
                            // 毒素が徐々に環境に放出され始める
                            Object.keys(this.postMortemToxins).forEach(type => {
                                this.postMortemToxins[type] *= 0.8;
                            });
                            break;
                        case 3: // 後期分解
                            // 毒素が急速に減少
                            Object.keys(this.postMortemToxins).forEach(type => {
                                this.postMortemToxins[type] *= 0.5;
                            });
                            break;
                    }
                }
                
                // サイズの変化をより自然に
                const sizeReduction = Math.pow(1 - decompositionProgress, 2);
                this.size = Math.max(0.1, this.maxSize * sizeReduction);
                
                // 環境への毒素放出
                if (environment && this.decompositionStage > 0) {
                    // 分解段階に応じて異なるリソースを放出
                    switch(this.decompositionStage) {
                        case 1: // 初期分解
                            if (!this._releasedResourcesStage1) {
                                // 酸素とグルコースを放出（量を削減）
                                environment.addResource(
                                    METABOLIC_PRODUCTS.OXYGEN, 
                                    this.position, 
                                    0.1 * this.maxSize // 0.2から0.1に半減
                                );
                                
                                environment.addResource(
                                    METABOLIC_PRODUCTS.GLUCOSE, 
                                    this.position, 
                                    0.07 * this.maxSize // 0.15から0.07に半減以上の削減
                                );
                                
                                this._releasedResourcesStage1 = true;
                            }
                            break;
                            
                        case 2: // 中期分解
                            if (!this._releasedResourcesStage2) {
                                // アミノ酸と廃棄物を放出（量を削減）
                                environment.addResource(
                                    METABOLIC_PRODUCTS.AMINO_ACIDS, 
                                    this.position, 
                                    0.08 * this.maxSize // 0.18から0.08に半減以上の削減
                                );
                                
                                environment.addResource(
                                    METABOLIC_PRODUCTS.WASTE, 
                                    this.position, 
                                    0.15 * this.maxSize // 0.25から0.15に削減
                                );
                                
                                // 炭素も少量放出（量を削減）
                                environment.addResource(
                                    METABOLIC_PRODUCTS.CARBON,
                                    this.position,
                                    0.04 * this.maxSize // 0.1から0.04に削減
                                );
                                
                                this._releasedResourcesStage2 = true;
                            }
                            break;
                            
                        case 3: // 後期分解
                            if (!this._releasedResourcesStage3) {
                                // 廃棄物をさらに放出
                                environment.addResource(
                                    METABOLIC_PRODUCTS.WASTE, 
                                    this.position, 
                                    0.2 * this.maxSize
                                );
                                
                                // 毒素の放出
                                // 主要な毒素タイプを判定
                                let dominantToxin = 'neural';
                                let maxStrength = this.postMortemToxins?.neural || 0;
                                
                                if (this.postMortemToxins?.cellular > maxStrength) {
                                    dominantToxin = 'cellular';
                                    maxStrength = this.postMortemToxins.cellular;
                                }
                                if (this.postMortemToxins?.digestive > maxStrength) {
                                    dominantToxin = 'digestive';
                                    maxStrength = this.postMortemToxins.digestive;
                                }
                                
                                const toxinRelease = Object.values(this.postMortemToxins).reduce((sum, val) => sum + val, 0) / 
                                    (this.decompositionStage * 5); // 毒素放出量を増加
                                environment.addResource(METABOLIC_PRODUCTS.TOXINS, this.position, toxinRelease, dominantToxin);
                                
                                this._releasedResourcesStage3 = true;
                            }
                            break;
                    }
                }
                
                // 完全に分解されたら true を返す
                return time - this.deathTime > this.decompositionTime;
            }
            
            // 寄生の影響を処理
            if (this.parasites && this.parasites.length > 0) {
                // 各寄生者からエネルギーを奪われる
                this.parasites.forEach(parasite => {
                    const drainAmount = this.energy * parasite.dna.parasitism.adaptations.resourceDrain * 0.1;
                    this.energy -= drainAmount;
                    parasite.energy += drainAmount * 0.8;  // 80%の効率でエネルギー転換
                });
                
                // 免疫応答による寄生者の排除を試みる
                if (Math.random() < (this.dna?.parasiteResistance?.recoveryRate || 0)) {
                    this.parasites = this.parasites.filter(parasite => 
                        Math.random() > (this.dna?.parasiteResistance?.immuneStrength || 0));
                }
            }
            
            // 生存中の処理
            // 年齢を増加
            this.age++;
            
            // 時間による影響（昼夜サイクル）
            const dayPhase = (time % 240) / 240;
            const isNight = dayPhase > 0.5;
            const activityMultiplier = isNight ?
                (this.dna.nocturnality) :
                (1 - this.dna.nocturnality);
            
            // 深さに基づくストレス計算
            const depthStress = Math.abs(this.position.z - this.dna.depthPreference) / 
                (10 * this.dna.depthTolerance);
            
            // 光合成によるエネルギー生成
            if (this.dna.photosynthesis?.efficiency > 0.2) {
                // 周囲の炭素を探して消費
                const nearbyResources = environment.getResources(this.position, 2);
                const availableCarbon = nearbyResources.get(METABOLIC_PRODUCTS.CARBON) || 0;
                
                // 炭素が利用可能な場合、消費して効率アップ
                let photosynthesisBoost = 1.0;
                let carbonConsumption = 0;
                
                if (availableCarbon > 0.05) {
                    // 消費できる炭素量を計算（以前より消費量を増加）
                    carbonConsumption = Math.min(availableCarbon, 0.15) * this.dna.photosynthesis.efficiency;
                    // 炭素を消費
                    environment.addResource(METABOLIC_PRODUCTS.CARBON, this.position, -carbonConsumption);
                    // 効率上昇
                    photosynthesisBoost = 1.0 + carbonConsumption * 5.0;
                }
                
                // 光合成によるグルコース生成量に上限を設定
                const maxGlucoseProduction = 0.05; // 最大生成量を制限
                const baseGlucoseProduction = this.dna.photosynthesis.efficiency * 0.05; // 基本生成量を半減
                const glucoseProduction = Math.min(maxGlucoseProduction, baseGlucoseProduction * photosynthesisBoost);
                const oxygenProduction = glucoseProduction * 0.5;
                
                // 周囲の総リソース量をチェック
                let surroundingGlucose = 0;
                nearbyResources.forEach((amount, type) => {
                    if (type === METABOLIC_PRODUCTS.GLUCOSE) {
                        surroundingGlucose += amount;
                    }
                });
                
                // 周囲のグルコースが多い場合、生成量を抑制（密度依存的な制御）
                const glucoseSaturation = Math.min(1.0, surroundingGlucose / 0.5); // 0.5を閾値とする
                const adjustedGlucoseProduction = glucoseProduction * (1 - glucoseSaturation * 0.8);
                const adjustedOxygenProduction = oxygenProduction * (1 - glucoseSaturation * 0.8);
                
                // エネルギー獲得にも同様の制限を適用
                this.energy += adjustedGlucoseProduction * 0.2; // エネルギー変換効率を大幅に低下
                
                // リソース生成（光合成で作られたグルコースと酸素の一部のみが環境に放出される）
                environment.addResource(METABOLIC_PRODUCTS.GLUCOSE, this.position, adjustedGlucoseProduction * 0.6);
                environment.addResource(METABOLIC_PRODUCTS.OXYGEN, this.position, adjustedOxygenProduction * 0.6);
                
                // 副産物として少量の有機物を生成（より低確率で）
                if (Math.random() < 0.05) { // 10%から5%に減少
                    environment.addResource(METABOLIC_PRODUCTS.AMINO_ACIDS, this.position, 0.02); // 0.05から0.02に減少
                }
            }
            
            // 毒素関連の処理
            if (!this.isDead) {
                // 毒素の生成と蓄積
                const toxinProduction = (this.dna.toxins?.adaptation?.productionRate || 0.1) * 
                    (1 - this.energy * 0.5); // エネルギーが少ないと毒素生成が活発化
                
                // 各種毒素の強化/弱化
                for (const toxinType of ['neural', 'cellular', 'digestive']) {
                    const currentStrength = this.dna.toxins?.types?.[toxinType]?.strength || 0.1;
                    const productionCost = this.dna.toxins?.types?.[toxinType]?.developmentCost || 0.3;
                    
                    // 毒素の強化（コストを消費）
                    if (this.energy > productionCost * 2) {
                        // グルコースの必要量をチェック
                        const resourcesNeeded = {
                            [METABOLIC_PRODUCTS.GLUCOSE]: productionCost * 0.3
                        };
                        
                        // 周囲のリソースを取得
                        const availableResources = environment.getResources(this.position, 1);
                        const glucoseAvailable = availableResources.get(METABOLIC_PRODUCTS.GLUCOSE) || 0;
                        
                        // 十分なグルコースがある場合のみ毒素を生成
                        if (glucoseAvailable >= resourcesNeeded[METABOLIC_PRODUCTS.GLUCOSE]) {
                            if (!this.dna.toxins) this.dna.toxins = { types: {} };
                            if (!this.dna.toxins.types) this.dna.toxins.types = {};
                            if (!this.dna.toxins.types[toxinType]) this.dna.toxins.types[toxinType] = {};
                            
                            this.dna.toxins.types[toxinType].strength = Math.min(
                                1.0,
                                currentStrength + toxinProduction * 0.1
                            );
                            
                            // エネルギーとグルコースを消費
                            this.energy -= productionCost * toxinProduction;
                            environment.addResource(
                                METABOLIC_PRODUCTS.GLUCOSE, 
                                this.position, 
                                -resourcesNeeded[METABOLIC_PRODUCTS.GLUCOSE]
                            );
                            
                            // 廃棄物を排出
                            environment.addResource(
                                METABOLIC_PRODUCTS.WASTE,
                                this.position,
                                productionCost * 0.1
                            );
                        }
                    } else {
                        // エネルギーが少ない場合は毒素が弱化
                        if (this.dna.toxins?.types?.[toxinType]?.strength) {
                            this.dna.toxins.types[toxinType].strength *= 0.99;
                        }
                    }
                }
                
                // 毒素耐性の適応的変化
                for (const toxinType of ['neural', 'cellular', 'digestive']) {
                    if (this.energy > 0.5) {
                        // 高エネルギー状態では耐性が向上
                        if (!this.dna.toxins) this.dna.toxins = { resistance: {} };
                        if (!this.dna.toxins.resistance) this.dna.toxins.resistance = {};
                        
                        const currentResistance = this.dna.toxins.resistance[toxinType] || 0.1;
                        this.dna.toxins.resistance[toxinType] = Math.min(
                            1.0,
                            currentResistance + 0.001
                        );
                    } else {
                        // 低エネルギー状態では耐性が低下
                        if (this.dna.toxins?.resistance?.[toxinType]) {
                            this.dna.toxins.resistance[toxinType] *= 0.999;
                        }
                    }
                }
            }
            
            // 成長
            if (this.size < this.maxSize) {
                const growthRate = 0.0005 * this.dna.growthRate;
                this.size += growthRate;
                this.energy -= growthRate * 0.5;
            }
            
            // エネルギー消費（効率と活動時間帯に基づく）
            const mobilityFactor = this.dna.mobility * 0.1; // 移動能力係数を0.5から0.8に増加
            const sizeFactor = Math.pow(this.size, 1.5); // サイズによる非線形なエネルギー消費を追加
            const increasedDecayRate = energyDecayRate * 2.5; // 基本減衰率を2.5倍に増加
            
            this.energy -= increasedDecayRate * 
                (1 - this.dna.efficiency * 0.3) * // 効率による節約効果を0.5から0.3に減少
                activityMultiplier * 
                (1 + depthStress * 1.2) * // ストレスによる消費増加を1.0から1.2に増加
                (1 + mobilityFactor) *
                sizeFactor; // サイズによる消費を追加
            
            // 自然回復を弱める
            this.energy += this.dna.regenerationRate * 0.5 * (1 - depthStress); // 回復率を50%に減少
            this.energy = Math.min(this.energy, 1.0);
            
            // 移動能力に応じた行動の前に物理的な制約を適用
            if (this.dna.mobility > 0.2) {
                // 重力の影響を追加（より穏やかに）
                this.acceleration.z -= this.gravityStrength * 0.8;
                
                // 現在の速度の大きさを計算
                const currentSpeed = Math.sqrt(
                    this.velocity.x * this.velocity.x +
                    this.velocity.y * this.velocity.y +
                    this.velocity.z * this.velocity.z
                );
                
                // 空気抵抗の計算（より滑らかに）
                if (currentSpeed > 0) {
                    const dragForce = this.dragCoefficient * currentSpeed;
                    const dragMultiplier = Math.max(0, 1 - dragForce / currentSpeed);
                    this.velocity.x *= dragMultiplier;
                    this.velocity.y *= dragMultiplier;
                    this.velocity.z *= dragMultiplier;
                }
                
                // 既存の移動処理を継続（より滑らかに）
                const interaction = this.interact(lifeforms, environment);
                const boundaries = this.checkBoundaries();
                const territory = this.defendTerritory(lifeforms);
                
                // 加速度の平滑化
                const smoothAccel = {
                    x: this.lastAcceleration.x * this.accelerationSmoothing + 
                       (interaction.x + boundaries.x + territory.x) * (1 - this.accelerationSmoothing),
                    y: this.lastAcceleration.y * this.accelerationSmoothing + 
                       (interaction.y + boundaries.y + territory.y) * (1 - this.accelerationSmoothing),
                    z: this.lastAcceleration.z * this.accelerationSmoothing + 
                       (interaction.z + boundaries.z + territory.z) * (1 - this.accelerationSmoothing)
                };
                
                // 力を適用（より滑らかに）
                const movementMultiplier = this.dna.mobility * 
                    (this.dna.efficiency || 0.5) * 
                    Math.min(1.0, this.energy * 2);
                
                this.acceleration.x = smoothAccel.x * movementMultiplier * this.turnRate;
                this.acceleration.y = smoothAccel.y * movementMultiplier * this.turnRate;
                this.acceleration.z = smoothAccel.z * movementMultiplier * this.turnRate;
                
                // 前回の加速度を保存
                this.lastAcceleration = smoothAccel;
                
                // 速度を更新（慣性を考慮）
                this.velocity.x = this.velocity.x * this.inertia + this.acceleration.x;
                this.velocity.y = this.velocity.y * this.inertia + this.acceleration.y;
                this.velocity.z = this.velocity.z * this.inertia + this.acceleration.z;
                
                // 速度を制限（より滑らかに）
                const speed = Math.sqrt(
                    this.velocity.x * this.velocity.x + 
                    this.velocity.y * this.velocity.y + 
                    this.velocity.z * this.velocity.z
                );
                
                const maxSpeed = 1 * this.dna.speed * this.dna.mobility;
                
                if (speed > maxSpeed) {
                    const reduction = 1 - ((speed - maxSpeed) / speed) * 1;
                    this.velocity.x *= reduction;
                    this.velocity.y *= reduction;
                    this.velocity.z *= reduction;
                }
                
                // 位置を更新
                this.position.x += this.velocity.x;
                this.position.y += this.velocity.y;
                this.position.z += this.velocity.z;
                
                // 加速度をリセット
                this.acceleration.x = 0;
                this.acceleration.y = 0;
                this.acceleration.z = 0;
            }
            
            // 繁殖判定
            if (enableRecycling && this.energy > reproductionThreshold && Math.random() < this.dna.reproductionRate * 0.05) {
                this.reproduce(lifeforms);
            }
            
            // 死亡判定
            if (this.energy <= 0 || this.age >= maxAge) {
                this.isDead = true;
            }
            
            // 環境ノイズへの適応を更新
            this.updateEnvironmentalAdaptation(environment);
            
            // 交配による特殊能力の発現
            if (this.dna._matingOffspring) {
                // 交配による子孫は遺伝子ハッキング能力が高い
                if (!this.dna.toxins) this.dna.toxins = { types: {} };
                if (!this.dna.toxins.types) this.dna.toxins.types = {};
                if (!this.dna.toxins.types.genetic) {
                    this.dna.toxins.types.genetic = {
                        strength: 0.3,
                        developmentCost: 0.4,
                        effectRange: 2.0,
                        mutagenicPotential: 0.4
                    };
                }
                
                // 成長に伴い遺伝子ハッキング能力が向上
                if (this.age > 100 && Math.random() < 0.01) {
                    this.dna.toxins.types.genetic.strength *= 1.01;
                    this.dna.toxins.types.genetic.mutagenicPotential *= 1.01;
                    this.dna._geneticHackingPotential = (this.dna._geneticHackingPotential || 0.5) * 1.01;
                }
            }
        }
        
        // 環境ノイズへの適応を更新
        updateEnvironmentalAdaptation(environment) {
            // 適応タイミングのチェック
            const currentTime = time;
            if (currentTime - this.metabolicState.lastAdaptation < 100) return;
            this.metabolicState.lastAdaptation = currentTime;
            
            // 成長による適応（若い個体は成長しやすい）
            const growthRate = Math.max(0, 0.1 - this.age / 10000) * 0.05;
            
            // 周囲の炭素を探して使用（成長に必要）
            const nearbyResources = environment.getResources(this.position, 2);
            const availableCarbon = nearbyResources.get(METABOLIC_PRODUCTS.CARBON) || 0;
            
            // 炭素が利用可能な場合、消費して成長を促進
            let growthBoost = 1.0;
            if (availableCarbon > 0.05 && this.age < 5000) { // 若い個体のみ炭素を効率的に使用
                // 消費できる炭素量を計算
                const carbonConsumption = Math.min(availableCarbon, 0.05);
                // 炭素を消費
                environment.addResource(METABOLIC_PRODUCTS.CARBON, this.position, -carbonConsumption);
                // 成長ブースト
                growthBoost = 1.0 + carbonConsumption * 10.0;
            }
            
            // 若い個体は成長率が高く、炭素の利用効率も高い
            if (this.size < this.dna.maxSize && this.energy > 0.5) {
                const actualGrowthRate = growthRate * growthBoost;
                this.size = Math.min(this.dna.maxSize, this.size + actualGrowthRate);
                this.energy -= actualGrowthRate * 0.5; // 成長にはエネルギーを消費
            }
            
            // 環境に対する適応性を強化
            if (Math.random() < 0.1 && this.energy > 0.7) {
                // エネルギーがある場合は適応性を強化
                this.energy -= 0.05;
                
                // 深度に基づく適応
                const depthDiff = Math.abs(this.position.z - this.dna.depthPreference);
                if (depthDiff > 5 && this.dna.depthTolerance < 1.0) {
                    // 望ましい深度から離れている場合は深度耐性を強化
                    this.dna.depthTolerance = Math.min(1.0, this.dna.depthTolerance + 0.01);
                    
                    // 新しい深度を徐々に好むようになる（適応）
                    this.dna.depthPreference = this.dna.depthPreference * 0.95 + this.position.z * 0.05;
                }
            }
            
            // メモリ使用率（乱流）への適応
            const turbDiff = Math.abs(this.adaptationState.turbulenceResistance - environment.systemState.memoryUsage);
            if (turbDiff > 0.1) {
                const adaptationChange = Math.min(0.1, turbDiff * 0.05);
                this.adaptationState.turbulenceResistance += 
                    (environment.systemState.memoryUsage > this.adaptationState.turbulenceResistance) ? adaptationChange : -adaptationChange;
                this.energy -= this.adaptationCosts.turbulence * adaptationChange;
            }
            
            // ネットワークレイテンシー（視界）への適応
            const visualDiff = Math.abs(this.adaptationState.visualAdaptation - (1 - environment.systemState.networkLatency));
            if (visualDiff > 0.1) {
                const adaptationChange = Math.min(0.1, visualDiff * 0.05);
                this.adaptationState.visualAdaptation += 
                    ((1 - environment.systemState.networkLatency) > this.adaptationState.visualAdaptation) ? adaptationChange : -adaptationChange;
                this.energy -= this.adaptationCosts.visual * adaptationChange;
            }
            
            // CPU負荷（温度）への適応
            const tempDiff = Math.abs(this.adaptationState.temperatureTolerance - environment.systemState.cpuLoad);
            if (tempDiff > 0.1) {
                const adaptationChange = Math.min(0.1, tempDiff * 0.05);
                this.adaptationState.temperatureTolerance += 
                    (environment.systemState.cpuLoad > this.adaptationState.temperatureTolerance) ? adaptationChange : -adaptationChange;
                this.energy -= this.adaptationCosts.temperature * adaptationChange;
            }
            
            this.adaptationState.lastAdaptation = currentTime;
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
        
        // DNAを3進数的な塩基配列に変換するメソッド
        encodeDNA() {
            const BASE_SYMBOLS = ['0', '1', '2'];  // 3種類の塩基記号
            const geneSequence = [];
            
            // バージョン情報
            geneSequence.push('V1');
            
            // 数値を3進数的な塩基配列に変換するヘルパー関数
            function encodeValue(value, length = 8) {
                // 0-1の値を0-255に変換
                const normalizedValue = Math.min(255, Math.max(0, Math.floor(value * 256)));
                let sequence = '';
                
                // 3進数的な表現に変換
                let remaining = normalizedValue;
                for (let i = 0; i < length; i++) {
                    const index = remaining % 3;
                    sequence = BASE_SYMBOLS[index] + sequence;
                    remaining = Math.floor(remaining / 3);
                }
                
                return sequence;
            }
            
            // 基本特性のエンコード
            geneSequence.push('BAS');
            [
                this.dna.speed || 0.5,
                this.dna.efficiency || 0.5,
                this.dna.perception || 0.5,
                this.dna.foodAttraction || 0.5,
                this.dna.socialBehavior || 0,
                this.dna.reproductionRate || 0.3,
                this.dna.predatory || 0.5,
                this.dna.size || 0.3
            ].forEach(value => {
                geneSequence.push(encodeValue(value));
            });
            
            // 光合成システムのエンコード
            geneSequence.push('PHO');
            geneSequence.push(encodeValue(this.dna.photosynthesis?.efficiency || 0.2));
            geneSequence.push(encodeValue((this.dna.photosynthesis?.depth?.optimal || 0) / 20 + 0.5)); // -10から10を0-1に正規化
            geneSequence.push(encodeValue(this.dna.photosynthesis?.depth?.range || 0.2));
            
            // 波長効率のエンコード
            (this.dna.photosynthesis?.wavelengths || []).forEach(wave => {
                geneSequence.push(encodeValue(wave?.efficiency || 0.2));
            });
            
            geneSequence.push(encodeValue(this.dna.photosynthesis?.adaptations?.nightMode || 0.1));
            geneSequence.push(encodeValue(this.dna.photosynthesis?.adaptations?.stressResponse || 0.2));
            
            // 毒素システムのエンコード
            geneSequence.push('TOX');
            ['neural', 'cellular', 'digestive'].forEach(type => {
                geneSequence.push(encodeValue(this.dna.toxins?.types?.[type]?.strength || 0.1));
                geneSequence.push(encodeValue(this.dna.toxins?.types?.[type]?.effectRange || 1.0));
            });
            
            // 抵抗性のエンコード
            geneSequence.push('RES');
            ['neural', 'cellular', 'digestive'].forEach(type => {
                geneSequence.push(encodeValue(this.dna.toxins?.resistance?.[type] || 0.1));
            });
            
            // その他の特性のエンコード
            geneSequence.push('OTH');
            [
                this.dna.mobility || 0.3,
                this.dna.growthRate || 0.2,
                this.dna.separationWeight || 0.3,
                this.dna.alignmentWeight || 0.2,
                this.dna.cohesionWeight || 0.2,
                this.dna.depthPreference || 0,
                this.dna.depthTolerance || 0.2,
                this.dna.regenerationRate || 0.05,
                this.dna.offspringCount || 1,
                this.dna.parentalCare || 0.1,
                this.dna.nocturnality || 0.4,
                this.dna.territoriality || 0.1
            ].forEach(value => {
                geneSequence.push(encodeValue(value));
            });
            
            return geneSequence.join('|');
        }
        
        // 3進数的な塩基配列からDNAを解読するメソッド
        static decodeDNA(sequence, mutationRate = 0.1) {
            try {
                const genes = sequence.split('|');
                let index = 0;
                
                // 3進数的な塩基配列から数値に変換するヘルパー関数
                function decodeValue(sequence) {
                    let value = 0;
                    for (let i = 0; i < sequence.length; i++) {
                        value = value * 3 + parseInt(sequence[i]);
                    }
                    // 突然変異の可能性
                    if (Math.random() < mutationRate) {
                        // ランダムな位置の塩基を変異させる
                        const pos = Math.floor(Math.random() * sequence.length);
                        const newBase = Math.floor(Math.random() * 3);
                        value = value + (newBase - parseInt(sequence[pos])) * Math.pow(3, sequence.length - pos - 1);
                    }
                    return value / 256; // 0-1の範囲に正規化
                }
                
                // バージョンチェック
                if (genes[index++] !== 'V1') {
                    throw new Error('Invalid DNA version');
                }
                
                const dna = {};
                
                // 基本特性のデコード
                if (genes[index++] === 'BAS') {
                    dna.speed = decodeValue(genes[index++]);
                    dna.efficiency = decodeValue(genes[index++]);
                    dna.perception = decodeValue(genes[index++]);
                    dna.foodAttraction = decodeValue(genes[index++]);
                    dna.socialBehavior = decodeValue(genes[index++]);
                    dna.reproductionRate = decodeValue(genes[index++]);
                    dna.predatory = decodeValue(genes[index++]);
                    dna.size = decodeValue(genes[index++]);
                }
                
                // 光合成システムのデコード
                if (genes[index++] === 'PHO') {
                    dna.photosynthesis = {
                        efficiency: decodeValue(genes[index++]),
                        depth: {
                            optimal: (decodeValue(genes[index++]) - 0.5) * 20, // 0-1から-10から10に逆正規化
                            range: decodeValue(genes[index++])
                        },
                        wavelengths: [],
                        adaptations: {
                            nightMode: decodeValue(genes[index + 3]),
                            stressResponse: decodeValue(genes[index + 4])
                        }
                    };
                    
                    // 波長効率のデコード
                    for (let i = 0; i < 3; i++) {
                        dna.photosynthesis.wavelengths.push({
                            min: 400 + i * 100,
                            max: 500 + i * 100,
                            efficiency: decodeValue(genes[index++])
                        });
                    }
                    index += 2; // adaptationsの分
                }
                
                // 毒素システムのデコード
                if (genes[index++] === 'TOX') {
                    dna.toxins = {
                        types: {
                            neural: { strength: decodeValue(genes[index++]), effectRange: decodeValue(genes[index++]) },
                            cellular: { strength: decodeValue(genes[index++]), effectRange: decodeValue(genes[index++]) },
                            digestive: { strength: decodeValue(genes[index++]), effectRange: decodeValue(genes[index++]) }
                        }
                    };
                }

                // 抵抗性のデコード
                if (genes[index++] === 'RES') {
                    if (!dna.toxins) dna.toxins = {};
                    dna.toxins.resistance = {
                        neural: decodeValue(genes[index++]),
                        cellular: decodeValue(genes[index++]),
                        digestive: decodeValue(genes[index++])
                    };
                    
                    // 適応システムの初期化
                    dna.toxins.adaptation = {
                        productionRate: Math.random() * 0.3,
                        storageCapacity: 0.5 + Math.random(),
                        releaseControl: Math.random()
                    };
                }
                
                // その他の特性のデコード
                if (genes[index++] === 'OTH') {
                    dna.mobility = decodeValue(genes[index++]);
                    dna.growthRate = decodeValue(genes[index++]);
                    dna.separationWeight = decodeValue(genes[index++]);
                    dna.alignmentWeight = decodeValue(genes[index++]);
                    dna.cohesionWeight = decodeValue(genes[index++]);
                    dna.depthPreference = (decodeValue(genes[index++]) - 0.5) * 20; // -10から10の範囲
                    dna.depthTolerance = decodeValue(genes[index++]);
                    dna.regenerationRate = decodeValue(genes[index++]);
                    dna.offspringCount = Math.max(1, Math.floor(decodeValue(genes[index++]) * 4)); // 1-4の範囲
                    dna.parentalCare = decodeValue(genes[index++]);
                    dna.nocturnality = decodeValue(genes[index++]);
                    dna.territoriality = decodeValue(genes[index++]);
                }
                
                // 遺伝子ネットワークは固定
                dna.geneNetwork = {
                    photosynthesis: {
                        enhancedBy: ['efficiency', 'regenerationRate'],
                        suppressedBy: ['toxins.adaptation.productionRate'],
                        influences: ['energy', 'growth']
                    },
                    toxins: {
                        enhancedBy: ['efficiency', 'size'],
                        suppressedBy: ['photosynthesis.efficiency'],
                        influences: ['predation', 'defense']
                    }
                };
                
                // ランダムな突然変異や欠落を導入
                Object.keys(dna).forEach(key => {
                    if (typeof dna[key] === 'number') {
                        if (Math.random() < mutationRate * 0.1) { // 完全な欠落
                            delete dna[key];
                        } else if (Math.random() < mutationRate) { // 変異
                            dna[key] *= 1 + (Math.random() * 0.4 - 0.2);
                        }
                    } else if (key === 'photosynthesis' && Math.random() < mutationRate * 0.05) {
                        // 光合成能力の重大な欠損
                        dna.photosynthesis.efficiency *= 0.1;
                        dna._requires_host = true; // 宿主依存フラグ
                    }
                });
                
                // エネルギー獲得に関する重要な機能の欠損をチェック
                if (!dna.photosynthesis || dna.photosynthesis.efficiency < 0.1) {
                    if (!dna.predatory || dna.predatory < 0.3) {
                        // 両方の主要なエネルギー獲得手段が欠損している場合
                        dna._requires_host = true;
                        dna._host_dependency = Math.random(); // 宿主への依存度
                    }
                }
                
                return dna;
            } catch (error) {
                console.error('DNA decoding error:', error);
                // エラーが発生した場合でも、部分的に解読できたDNAを使用
                // 解読できなかった部分はundefinedのまま
                return {
                    ...dna,  // 部分的に解読できた情報を保持
                    _decoding_error: true,  // エラーフラグを追加
                    _error_type: error.message  // エラー情報を保持
                };
            }
        }
        
        // 繁殖メソッドを更新
        reproduce(lifeforms) {
            if (lifeforms.length >= maxLifeforms) return;
            if (time - this.lastReproductionTime < 50) return;
            
            // 交配による繁殖を優先（最近交配した場合）
            if (this._lastMatingTime && time - this._lastMatingTime < 100) {
                // 交配後は通常の繁殖を抑制
                return;
            }
            
            // 宿主依存の個体の繁殖処理
            if (this.dna._requires_host) {
                if (!this._attached_host) return; // 宿主がいない場合は繁殖不可
                
                // 宿主のエネルギーを使って繁殖
                const hostEnergy = this._attached_host.energy;
                if (hostEnergy < 0.4) return; // 宿主のエネルギーが不足している場合は繁殖不可
                
                const energyCost = reproductionCost * 1.5; // 通常より高いエネルギーコスト
                this._attached_host.energy -= energyCost;
                
                // DNAを3進数的な塩基配列に変換
                const encodedDNA = this.encodeDNA();
                const childDna = Lifeform.decodeDNA(encodedDNA, mutationRate * 1.2); // より高い突然変異率
                
                // 子孫は必ず宿主依存
                childDna._requires_host = true;
                childDna._host_dependency = Math.min(1.0, (this.dna._host_dependency || 0.5) * (1 + (Math.random() - 0.5) * 0.2));
                
                const child = new Lifeform(
                    this.position.x + (Math.random() - 0.5) * 2,
                    this.position.y + (Math.random() - 0.5) * 2,
                    this.position.z + (Math.random() - 0.5) * 2,
                    energyCost * 0.5,
                    childDna
                );
                
                lifeforms.push(child);
                this.lastReproductionTime = time;
                return;
            }
            
            // 通常の繁殖処理
            if (this.energy < reproductionThreshold) return;
            
            // 周囲の炭素を確認
            const nearbyResources = environment.getResources(this.position, 3);
            const availableCarbon = nearbyResources.get(METABOLIC_PRODUCTS.CARBON) || 0;
            
            // 基本的なエネルギーコスト
            const parentalInvestment = reproductionCost * (1 + this.dna.parentalCare);
            
            // 炭素を使用する場合は、エネルギーコストを低減
            let carbonCost = 0;
            let energyReduction = 0;
            
            if (availableCarbon > 0.1) {
                // 使用する炭素量（最大でエネルギーコストの30%相当）
                carbonCost = Math.min(availableCarbon, parentalInvestment * 0.3);
                // エネルギーコスト削減（炭素使用量の2倍）
                energyReduction = carbonCost * 2;
                // 環境から炭素を消費
                environment.addResource(METABOLIC_PRODUCTS.CARBON, this.position, -carbonCost);
            }
            
            // 調整済みのエネルギーコスト
            const adjustedInvestment = Math.max(0.1, parentalInvestment - energyReduction);
            
            if (this.energy < adjustedInvestment) return; // 調整後もエネルギーが不足する場合
            
            this.energy -= adjustedInvestment;
            this.lastReproductionTime = time;
            
            const offspringCount = this.dna.offspringCount || 1;
            const energyPerChild = (adjustedInvestment * this.dna.parentalCare) / offspringCount;
            
            for (let i = 0; i < offspringCount; i++) {
                // DNAを3進数的な塩基配列に変換
                const encodedDNA = this.encodeDNA();
                const childDna = Lifeform.decodeDNA(encodedDNA, mutationRate);
                
                const spawnDistance = 2 + (Math.random() * 3); // ランダムな距離
                const angle = Math.random() * Math.PI * 2; // ランダムな角度
                
                const child = new Lifeform(
                    this.position.x + Math.cos(angle) * spawnDistance,
                    this.position.y + Math.sin(angle) * spawnDistance,
                    this.position.z + (Math.random() - 0.5) * 2,
                    energyPerChild,
                    childDna
                );
                
                lifeforms.push(child);
            }
        }
        
        processMetabolism(environment) {
            if (this.isDead) return;

            const currentTime = time;
            if (currentTime - this.metabolicState.lastMetabolism < 10) return;
            this.metabolicState.lastMetabolism = currentTime;

            // 光合成による代謝産物生成
            if (this.dna.photosynthesis?.efficiency > 0.2) {
                // 周囲の炭素を探して消費
                const nearbyResources = environment.getResources(this.position, 2);
                const availableCarbon = nearbyResources.get(METABOLIC_PRODUCTS.CARBON) || 0;
                
                // 炭素が利用可能な場合、消費して効率アップ
                let photosynthesisBoost = 1.0;
                let carbonConsumption = 0;
                
                if (availableCarbon > 0.05) {
                    // 消費できる炭素量を計算（以前より消費量を増加）
                    carbonConsumption = Math.min(availableCarbon, 0.15) * this.dna.photosynthesis.efficiency;
                    // 炭素を消費
                    environment.addResource(METABOLIC_PRODUCTS.CARBON, this.position, -carbonConsumption);
                    // 効率上昇
                    photosynthesisBoost = 1.0 + carbonConsumption * 5.0;
                }
                
                // 光合成によるグルコース生成量に上限を設定
                const maxGlucoseProduction = 0.05; // 最大生成量を制限
                const baseGlucoseProduction = this.dna.photosynthesis.efficiency * 0.05; // 基本生成量を半減
                const glucoseProduction = Math.min(maxGlucoseProduction, baseGlucoseProduction * photosynthesisBoost);
                const oxygenProduction = glucoseProduction * 0.5;
                
                // 周囲の総リソース量をチェック
                let surroundingGlucose = 0;
                nearbyResources.forEach((amount, type) => {
                    if (type === METABOLIC_PRODUCTS.GLUCOSE) {
                        surroundingGlucose += amount;
                    }
                });
                
                // 周囲のグルコースが多い場合、生成量を抑制（密度依存的な制御）
                const glucoseSaturation = Math.min(1.0, surroundingGlucose / 0.5); // 0.5を閾値とする
                const adjustedGlucoseProduction = glucoseProduction * (1 - glucoseSaturation * 0.8);
                const adjustedOxygenProduction = oxygenProduction * (1 - glucoseSaturation * 0.8);
                
                // エネルギー獲得にも同様の制限を適用
                this.energy += adjustedGlucoseProduction * 0.2; // エネルギー変換効率を大幅に低下
                
                // リソース生成（光合成で作られたグルコースと酸素の一部のみが環境に放出される）
                environment.addResource(METABOLIC_PRODUCTS.GLUCOSE, this.position, adjustedGlucoseProduction * 0.6);
                environment.addResource(METABOLIC_PRODUCTS.OXYGEN, this.position, adjustedOxygenProduction * 0.6);
                
                // 副産物として少量の有機物を生成（より低確率で）
                if (Math.random() < 0.05) { // 10%から5%に減少
                    environment.addResource(METABOLIC_PRODUCTS.AMINO_ACIDS, this.position, 0.02); // 0.05から0.02に減少
                }
            }

            // 毒素生成
            if (this.dna.toxins?.adaptation?.productionRate > 0.3) {
                const toxinProduction = this.dna.toxins.adaptation.productionRate * 0.05;
                
                // 主要な毒素タイプを判定
                let dominantToxin = 'neural';
                let maxStrength = this.dna.toxins?.types?.neural?.strength || 0;
                
                if ((this.dna.toxins?.types?.cellular?.strength || 0) > maxStrength) {
                    dominantToxin = 'cellular';
                    maxStrength = this.dna.toxins.types.cellular.strength;
                }
                if ((this.dna.toxins?.types?.digestive?.strength || 0) > maxStrength) {
                    dominantToxin = 'digestive';
                    maxStrength = this.dna.toxins.types.digestive.strength;
                }
                if ((this.dna.toxins?.types?.genetic?.strength || 0) > maxStrength) {
                    dominantToxin = 'genetic';
                    maxStrength = this.dna.toxins.types.genetic.strength;
                }
                
                environment.addResource(METABOLIC_PRODUCTS.TOXINS, this.position, toxinProduction, dominantToxin);
                this.energy -= toxinProduction * 0.1;
            }

            // 周囲の資源を探索・消費
            const nearbyResources = environment.getResources(this.position, 2);
            let totalResourceGain = 0;

            nearbyResources.forEach((amount, type) => {
                if (type === METABOLIC_PRODUCTS.GLUCOSE || type === METABOLIC_PRODUCTS.AMINO_ACIDS) {
                    const consumed = Math.min(amount, 0.1) * this.metabolicState.resourceEfficiency;
                    totalResourceGain += consumed;
                    environment.addResource(type, this.position, -consumed);
                }
            });

            this.energy = Math.min(1.0, this.energy + totalResourceGain);

            // デジタル代謝の処理を追加
            this.processDigitalMetabolism(environment);
            
            // エントロピー処理を追加
            this.processInformationEntropy(environment);
        }
        
        // デジタル代謝の処理
        processDigitalMetabolism(environment) {
            // システム状態に応じてエネルギー効率を変動
            const systemLoad = environment.systemState.cpuLoad;
            const memoryState = environment.systemState.memoryUsage;
            
            // システム負荷が高いときは効率が下がる
            const efficiency = this.digitalMetabolism.cacheEfficiency * 
                (1 - systemLoad * 0.3) * 
                (1 - memoryState * 0.2);
            
            // エネルギー獲得に影響
            this.energy *= (1 + (efficiency - 0.5) * 0.1);
            
            // 廃棄物の蓄積
            this.digitalMetabolism.wasteAccumulation += 0.01;
            if (this.digitalMetabolism.wasteAccumulation > 1) {
                this.energy *= 0.95; // ペナルティ
                this.digitalMetabolism.wasteAccumulation = 0;
            }
            
            // データ処理量の更新
            this.digitalMetabolism.processedData += efficiency * 0.1;
        }
        
        // エントロピー処理
        processInformationEntropy(environment) {
            // システムの乱雑さに基づいてエントロピーを更新
            const systemChaos = (
                environment.systemState.cpuLoad + 
                environment.systemState.memoryUsage
            ) / 2;

            // エントロピーの変化
            this.informationState.entropy = 
                0.3 * this.informationState.entropy + 
                0.7 * systemChaos;

            // 秩序度の更新
            this.informationState.orderLevel = 
                Math.max(0, 1 - this.informationState.entropy);

            // 生存への影響
            if (this.informationState.orderLevel < 0.2) {
                this.energy *= 0.98; // 低秩序のペナルティ
            }
            
            // 高い秩序度はボーナスを与える
            if (this.informationState.orderLevel > 0.8) {
                this.energy = Math.min(1.0, this.energy * 1.01);
            }
        }
        
        updateBehavior(lifeforms) {
            // 引数がない場合の対応
            lifeforms = lifeforms || [];
            
            // 現在の状態評価
            const currentState = {
                energy: this.energy,
                threats: this.detectThreats(lifeforms),
                resources: this.detectResources(),
                companions: this.findCompatibleCompanions(lifeforms)
            };
            
            // 行動の結果を記録
            if (this.lastState) {
                const outcome = this.evaluateOutcome(this.lastState, currentState);
                this.updateBehaviorWeights(outcome);
            }
            
            this.lastState = currentState;
            
            // 適応的な群れ行動の重み付けを更新 (毎フレーム更新)
            this.dna.flockingBehavior = {
                separation: this.calculateAdaptiveSeparation(),
                alignment: this.calculateAdaptiveAlignment(),
                cohesion: this.calculateAdaptiveCohesion()
            };

            // 群れ行動の重みが小さすぎる場合、最小値を保証
            const minWeight = 0.15;
            if (this.dna.flockingBehavior.separation < minWeight) this.dna.flockingBehavior.separation = minWeight;
            if (this.dna.flockingBehavior.alignment < minWeight) this.dna.flockingBehavior.alignment = minWeight;
            if (this.dna.flockingBehavior.cohesion < minWeight) this.dna.flockingBehavior.cohesion = minWeight;
            
            // ログで重みを出力（デバッグ用、必要に応じてコメントアウト）
            /*
            if (Math.random() < 0.01) {
                console.log(`Flocking: sep=${this.dna.flockingBehavior.separation.toFixed(2)}, 
                             align=${this.dna.flockingBehavior.alignment.toFixed(2)}, 
                             coh=${this.dna.flockingBehavior.cohesion.toFixed(2)}`);
            }
            */
        }
        
        evaluateOutcome(previousState, currentState) {
            return {
                energyChange: currentState.energy - previousState.energy,
                threatLevel: currentState.threats.length,
                resourceAccess: this.evaluateResourceAccess(),
                socialBenefit: this.evaluateSocialInteractions()
            };
        }
        
        updateBehaviorWeights(outcome) {
            // 結果に基づいて行動パターンを調整
            if (outcome.energyChange > 0) {
                // 成功した行動パターンを強化
                this.reinforceBehavior();
            } else {
                // 失敗した行動パターンを弱化
                this.weakenBehavior();
            }
        }
        
        getDistanceTo(other) {
            const dx = other.position.x - this.position.x;
            const dy = other.position.y - this.position.y;
            const dz = other.position.z - this.position.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        // 遺伝子組み換えを行うメソッド
        crossover(partner) {
            const childDNA = {};
            
            // 基本的な特性の組み換え
            for (const key of ['speed', 'efficiency', 'perception', 'foodAttraction', 
                              'socialBehavior', 'reproductionRate', 'predatory', 'size']) {
                // 確率的に親のどちらかの特性を継承
                childDNA[key] = Math.random() < 0.5 ? this.dna[key] : partner.dna[key];
                
                // 低確率で両親の特性を混合
                if (Math.random() < 0.3 && typeof this.dna[key] === 'number' && typeof partner.dna[key] === 'number') {
                    childDNA[key] = (this.dna[key] + partner.dna[key]) / 2 + (Math.random() - 0.5) * 0.1;
                }
            }
            
            // 光合成システムの組み換え
            childDNA.photosynthesis = {
                efficiency: this.dna.photosynthesis.efficiency * 0.7 + 
                           partner.dna.photosynthesis.efficiency * 0.3,
                depth: {
                    optimal: (this.dna.photosynthesis?.depth?.optimal || 0) * 0.5 + 
                             (partner.dna.photosynthesis?.depth?.optimal || 0) * 0.5,
                    range: (this.dna.photosynthesis?.depth?.range || 0.2) * 0.5 + 
                           (partner.dna.photosynthesis?.depth?.range || 0.2) * 0.5
                },
                wavelengths: this.dna.photosynthesis.wavelengths.map((wave, i) => ({
                    min: wave.min,
                    max: wave.max,
                    efficiency: (wave.efficiency + partner.dna.photosynthesis.wavelengths[i].efficiency) / 2
                })),
                adaptations: {
                    nightMode: (this.dna.photosynthesis?.adaptations?.nightMode || 0.1) * 0.5 + 
                               (partner.dna.photosynthesis?.adaptations?.nightMode || 0.1) * 0.5,
                    stressResponse: (this.dna.photosynthesis?.adaptations?.stressResponse || 0.2) * 0.5 + 
                                    (partner.dna.photosynthesis?.adaptations?.stressResponse || 0.2) * 0.5
                }
            };
            
            // 毒素システムの組み換え
            if (this.dna.toxins || partner.dna.toxins) {
                childDNA.toxins = { types: {}, resistance: {} };
                
                // 毒素タイプの組み換え
                ['neural', 'cellular', 'digestive', 'genetic'].forEach(type => {
                    if (this.dna.toxins?.types?.[type] || partner.dna.toxins?.types?.[type]) {
                        childDNA.toxins.types[type] = {};
                        
                        // 強度の組み換え
                        const thisStrength = this.dna.toxins?.types?.[type]?.strength || 0.1;
                        const partnerStrength = partner.dna.toxins?.types?.[type]?.strength || 0.1;
                        childDNA.toxins.types[type].strength = Math.random() < 0.7 ? 
                            (thisStrength * 0.6 + partnerStrength * 0.4) : 
                            (thisStrength * 0.4 + partnerStrength * 0.6);
                        
                        // 効果範囲の組み換え
                        const thisRange = this.dna.toxins?.types?.[type]?.effectRange || 1.0;
                        const partnerRange = partner.dna.toxins?.types?.[type]?.effectRange || 1.0;
                        childDNA.toxins.types[type].effectRange = (thisRange + partnerRange) / 2;
                        
                        // その他のパラメータの組み換え
                        if (type === 'genetic') {
                            const thisCost = this.dna.toxins?.types?.genetic?.developmentCost || 0.5;
                            const partnerCost = partner.dna.toxins?.types?.genetic?.developmentCost || 0.5;
                            childDNA.toxins.types.genetic.developmentCost = (thisCost + partnerCost) / 2;
                            
                            const thisPotential = this.dna.toxins?.types?.genetic?.mutagenicPotential || 0.3;
                            const partnerPotential = partner.dna.toxins?.types?.genetic?.mutagenicPotential || 0.3;
                            childDNA.toxins.types.genetic.mutagenicPotential = (thisPotential + partnerPotential) / 2;
                        }
                    }
                });
                
                // 抵抗性の組み換え
                ['neural', 'cellular', 'digestive', 'genetic'].forEach(type => {
                    const thisResistance = this.dna.toxins?.resistance?.[type] || 0.1;
                    const partnerResistance = partner.dna.toxins?.resistance?.[type] || 0.1;
                    childDNA.toxins.resistance[type] = (thisResistance + partnerResistance) / 2;
                });
            }
            
            return childDNA;
        }

        calculateFitness() {
            // 基本的な生存能力
            let fitness = this.energy * 0.3;
            
            // 環境適応度
            const environmentalFitness = this.calculateEnvironmentalFitness();
            fitness += environmentalFitness * 0.2;
            
            // 社会的適応度
            const socialFitness = this.calculateSocialFitness();
            fitness += socialFitness * 0.15;
            
            // 代謝効率
            const metabolicFitness = this.calculateMetabolicFitness();
            fitness += metabolicFitness * 0.2;
            
            // 生殖成功度
            const reproductiveFitness = this.calculateReproductiveFitness();
            fitness += reproductiveFitness * 0.15;
            
            return fitness;
        }

        calculateAdaptiveSeparation() {
            // エネルギーと環境状況に基づいて分離の重みを適応的に計算
            let baseSeparation = this.dna.separationWeight || 0.3;
            
            // エネルギーが少ないほど分離を強くする（競争を避ける）
            const energyFactor = Math.max(0.5, 1.5 - this.energy);
            
            // 捕食者なら分離を弱める（集団で狩りをする）
            const predatorFactor = this.isPredator ? 0.8 : 1.2;
            
            return baseSeparation * energyFactor * predatorFactor;
        }
        
        calculateAdaptiveAlignment() {
            // 状況に応じて整列の重みを適応的に計算
            let baseAlignment = this.dna.alignmentWeight || 0.2;
            
            // エネルギーが多いほど整列を強くする（群れに従う余裕がある）
            const energyFactor = 0.5 + this.energy * 0.7;
            
            // 捕食者なら整列を強める（集団での狩りを促進）
            const predatorFactor = this.isPredator ? 1.3 : 0.9;
            
            return baseAlignment * energyFactor * predatorFactor;
        }
        
        calculateAdaptiveCohesion() {
            // 状況に応じて結合の重みを適応的に計算
            let baseCohesion = this.dna.cohesionWeight || 0.2;
            
            // エネルギーが少ないほど結合を弱める（個体で行動する）
            const energyFactor = this.energy < 0.3 ? 0.6 : 1.0;
            
            // 捕食者なら結合を強める（集団での狩りを促進）
            const predatorFactor = this.isPredator ? 1.2 : 0.9;
            
            return baseCohesion * energyFactor * predatorFactor;
        }

        // 周囲の脅威（捕食者など）を検出
        detectThreats(lifeforms) {
            const threats = [];
            // 知覚範囲を計算
            const perceptionRadius = 15 * this.dna.perception;
            
            for (const other of lifeforms) {
                if (other === this) continue;
                
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const dz = other.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // 知覚範囲内で捕食者であれば脅威とみなす
                if (distance < perceptionRadius && other.isPredator && !this.isPredator) {
                    threats.push({
                        lifeform: other,
                        distance: distance
                    });
                }
            }
            
            return threats;
        }
        
        // 周囲の資源を検出
        detectResources() {
            // 簡易的な実装
            return [];
        }
        
        // 互換性のある仲間を探す
        findCompatibleCompanions(lifeforms) {
            const companions = [];
            // 知覚範囲を計算
            const perceptionRadius = 15 * this.dna.perception;
            
            for (const other of lifeforms) {
                if (other === this) continue;
                
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const dz = other.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // 知覚範囲内で同じタイプ（捕食者か非捕食者か）であれば仲間とみなす
                if (distance < perceptionRadius && other.isPredator === this.isPredator) {
                    companions.push({
                        lifeform: other,
                        distance: distance
                    });
                }
            }
            
            return companions;
        }
        
        // 資源へのアクセス状況を評価
        evaluateResourceAccess() {
            // 簡易的な実装
            return Math.random(); // 0〜1の値を返す
        }
        
        // 社会的相互作用の利益を評価
        evaluateSocialInteractions() {
            // 簡易的な実装
            return Math.random(); // 0〜1の値を返す
        }
        
        // 行動を強化
        reinforceBehavior() {
            this.dna.cohesionWeight *= 1.01;
            this.dna.alignmentWeight *= 1.01;
        }
        
        // 行動を弱化
        weakenBehavior() {
            this.dna.cohesionWeight *= 0.99;
            this.dna.alignmentWeight *= 0.99;
        }
    }
    
    // 生命体の初期化
    const lifeforms = [];
    
    // 様々なタイプの生命体を生成
    for (let i = 0; i < initialLifeCount; i++) {
        const dna = {
            // 初期生命体生成時の特性設定（より原始的な特性に）
            photosynthesis: {
                efficiency: 0.2 + Math.random() * 0.2,  // 基礎的な光合成能力
                depth: {
                    optimal: (Math.random() * 10) - 5,        // より狭い深度範囲
                    range: 0.2 + Math.random() * 0.3        // 低い深度耐性
                },
                wavelengths: [
                    // 可視光域での光合成効率
                    { min: 400, max: 500, efficiency: Math.random() },  // 青色光
                    { min: 500, max: 600, efficiency: Math.random() },  // 緑色光
                    { min: 600, max: 700, efficiency: Math.random() }   // 赤色光
                ],
                adaptations: {
                    nightMode: Math.random() * 0.3,     // 夜間の光合成効率
                    stressResponse: Math.random() * 0.5  // ストレス下での効率
                }
            },
            toxins: {
                types: {
                    neural: {          // 神経毒
                        strength: 0.1 + Math.random() * 0.2,
                        developmentCost: 0.3,
                        effectRange: 2 + Math.random() * 3
                    },
                    cellular: {        // 細胞毒
                        strength: 0.1 + Math.random() * 0.2,
                        developmentCost: 0.4,
                        effectRange: 1 + Math.random() * 2
                    },
                    digestive: {       // 消化器毒
                        strength: 0.1 + Math.random() * 0.2,
                        developmentCost: 0.2,
                        effectRange: 1.5 + Math.random() * 2
                    },
                    genetic: {         // 遺伝子操作毒素（新規）
                        strength: 0.05 + Math.random() * 0.15,
                        developmentCost: 0.5,
                        effectRange: 1 + Math.random() * 1.5,
                        mutagenicPotential: Math.random() * 0.3  // 突然変異を引き起こす能力
                    }
                },
                resistance: {
                    neural: 0.1 + Math.random() * 0.2,
                    cellular: 0.1 + Math.random() * 0.2,
                    digestive: 0.1 + Math.random() * 0.2,
                    genetic: 0.05 + Math.random() * 0.15  // 初期値は低め
                },
                adaptation: {
                    productionRate: Math.random() * 0.3,    // 毒素生成速度
                    storageCapacity: 0.5 + Math.random(),   // 毒素貯蔵能力
                    releaseControl: Math.random()           // 毒素放出の制御能力
                }
            },
            geneNetwork: {
                photosynthesis: {
                    enhancedBy: ['efficiency', 'regenerationRate'],
                    suppressedBy: ['toxins.adaptation.productionRate'],
                    influences: ['energy', 'growth']
                },
                toxins: {
                    enhancedBy: ['efficiency', 'size'],
                    suppressedBy: ['photosynthesis.efficiency'],
                    influences: ['predation', 'defense']
                }
            },
            mobility: 0.3 + Math.random() * 0.2,               // 基礎的な移動能力
            growthRate: 0.1 + Math.random() * 0.4, // 成長速度
            size: 0.2 + Math.random() * 0.2,                  // 小さめのサイズ
            speed: 0.3 + Math.random() * 0.2,                 // 基礎的な速度
            efficiency: 0.4 + Math.random() * 0.2,            // 基礎的な効率
            perception: 0.3 + Math.random() * 0.2,            // 基礎的な知覚能力
            foodAttraction: 0.4 + Math.random() * 0.2,        // 基礎的な食物への誘引
            socialBehavior: Math.random() * 0.4 - 0.2,        // より中立的な社会性
            reproductionRate: 0.2 + Math.random() * 0.2,      // 控えめな繁殖率
            separationWeight: 0.3 + Math.random() * 0.2,
            alignmentWeight: 0.3 + Math.random() * 0.2,
            cohesionWeight: 0.3 + Math.random() * 0.2,
            depthPreference: (Math.random() * 10) - 5,        // より狭い深度範囲
            depthTolerance: 0.2 + Math.random() * 0.2,        // 低い深度耐性
            regenerationRate: Math.random() * 0.05,           // 低い回復率
            offspringCount: 1,                                // 単純な繁殖数
            parentalCare: 0.1 + Math.random() * 0.2,         // 最小限の子育て
            nocturnality: 0.4 + Math.random() * 0.2,         // より中立的な活動時間
            territoriality: Math.random() * 0.2,              // 低い縄張り性
            
            // DNAに以下のような特性を追加
            resourceExchange: {
                giveRate: Math.random(),      // リソースを提供する傾向
                receiveRate: Math.random(),   // リソースを受け取る傾向
                exchangeRange: Math.random(), // 交換可能な範囲
                exchangeType: {              // 交換可能なリソースタイプ
                    energy: Math.random(),
                    nutrients: Math.random(),
                    protection: Math.random()
                }
            },
            
            metabolicPathways: {
                wasteProducts: [],           // 代謝産物（他の生物のリソースになりうる）
                requiredResources: [         // 必要な資源の初期設定
                    METABOLIC_PRODUCTS.GLUCOSE,
                    METABOLIC_PRODUCTS.OXYGEN
                ],
                byproducts: []              // 副産物（他の生物に有益または有害）
            },
            // flockingBehaviorの初期化
            flockingBehavior: {
                separation: 0.4 + Math.random() * 0.2,
                alignment: 0.4 + Math.random() * 0.2,
                cohesion: 0.4 + Math.random() * 0.2
            },
        };
        
        // 生命体のインスタンス生成後、flockingBehaviorを確実に初期化
        const lifeform = new Lifeform(undefined, undefined, undefined, undefined, dna);
        
        // updateBehaviorの初期化をスキップするか、より安全なバージョンを使用
        // lifeform.updateBehavior([]); // この行を削除または修正

        // 代わりに、flockingBehaviorを直接初期化
        lifeform.dna.flockingBehavior = {
            separation: lifeform.calculateAdaptiveSeparation(),
            alignment: lifeform.calculateAdaptiveAlignment(),
            cohesion: lifeform.calculateAdaptiveCohesion()
        };
        
        lifeforms.push(lifeform);
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
        // 生命体がnullまたはundefinedの場合のデフォルト色（柔らかい青）
        if (!lifeform || !lifeform.dna) {
            return 'hsl(180, 40%, 70%)';
        }

        // 死体の場合は柔らかい紫色
        if (lifeform.isDead) {
            const decompositionProgress = (time - lifeform.deathTime) / lifeform.decompositionTime;
            
            // 主要な毒素タイプを判定
            let dominantToxin = 'neural';
            let maxStrength = lifeform.postMortemToxins?.neural || 0;
            
            if (lifeform.postMortemToxins?.cellular > maxStrength) {
                dominantToxin = 'cellular';
                maxStrength = lifeform.postMortemToxins.cellular;
            }
            if (lifeform.postMortemToxins?.digestive > maxStrength) {
                dominantToxin = 'digestive';
                maxStrength = lifeform.postMortemToxins.digestive;
            }
            
            // 毒素タイプに応じた色相を設定
            let hue;
            switch (dominantToxin) {
                case 'neural':
                    hue = 300; // 紫色（神経毒）
                    break;
                case 'cellular':
                    hue = 0; // 赤色（細胞毒）
                    break;
                case 'digestive':
                    hue = 60; // 黄色（消化器毒）
                    break;
                default:
                    hue = 270;
            }
            
            // 毒素の強さに応じた彩度
            const saturation = Math.min(60, 20 + (maxStrength * 40));
            
            // 分解の進行に応じた明度
            const lightness = Math.max(40, 70 - (decompositionProgress * 30));
            
            return `hsl(${hue}, ${Math.floor(saturation)}%, ${Math.floor(lightness)}%)`;
        }

        // 基本色相の計算（全体的に柔らかい色調に）
        let hue = 180; // デフォルトの青をベース
        
        // 光合成と捕食性による色相の調整（より穏やかな変化に）
        const photoWeight = lifeform.dna.photosynthesis.efficiency;
        const predWeight = lifeform.dna.predatory;
        
        // 色相の変化を穏やかに
        hue = 180 - (photoWeight * 60) - (predWeight * 120);
        
        // 毒素による色相の微調整（より控えめに）
        const toxinStrength = (
            (lifeform.dna.toxins?.types?.neural?.strength || 0) +
            (lifeform.dna.toxins?.types?.cellular?.strength || 0) +
            (lifeform.dna.toxins?.types?.digestive?.strength || 0)
        ) / 3;
        hue += toxinStrength * 20;

        // 遺伝子ハッキングの視覚的表現
        if (lifeform._geneExpressionModifiers && Object.keys(lifeform._geneExpressionModifiers).length > 0) {
            // 遺伝子発現が変化している場合、色に特殊効果を追加
            hue += 30; // 色相をシフト（より緑がかった色に）
        }
        
        if (lifeform._immune_response) {
            // 免疫応答中は防御的な色に
            hue -= 40; // より青みがかった色に
        }
        
        if (lifeform._acquiredGenes && lifeform._acquiredGenes.length > 0) {
            // 遺伝子を獲得した生命体は特殊な色に
            const recentAcquisition = lifeform._acquiredGenes.some(g => time - g.time < 100);
            if (recentAcquisition) {
                hue += 60; // より黄色みがかった色に
            }
        }
        
        // 攻撃/防御特化の視覚的表現
        if (lifeform.dna._offensiveAdaptations) {
            // 攻撃特化は赤みがかった色に
            hue = (hue + 0) % 360; // 赤に近づける
        }
        
        if (lifeform.dna._defensiveAdaptations) {
            // 防御特化は青みがかった色に
            hue = (hue + 240) % 360; // 青に近づける
        }

        // 彩度を下げて柔らかい印象に
        let saturation = Math.min(60, Math.max(20,
            30 + // ベース彩度を下げる
            (lifeform.dna.efficiency * 15) +
            (toxinStrength * 5)
        ));
        
        // 遺伝子ハッキング状態による彩度の調整
        if (lifeform._geneExpressionModifiers && Object.keys(lifeform._geneExpressionModifiers).length > 0) {
            saturation += 15; // より鮮やかに
        }
        
        if (lifeform._immune_response) {
            saturation += 10; // 免疫応答中はより鮮やかに
        }
        
        if (lifeform._acquiredGenes && lifeform._acquiredGenes.length > 0) {
            const recentAcquisition = lifeform._acquiredGenes.some(g => time - g.time < 100);
            if (recentAcquisition) {
                saturation += 20; // 遺伝子獲得直後はより鮮やかに
            }
        }
        
        if (lifeform.dna._offensiveAdaptations || lifeform.dna._defensiveAdaptations) {
            saturation += 10; // 特化型はより鮮やかに
        }

        // 明度を上げて柔らかい印象に
        const energyFactor = lifeform.energy * 20;
        const ageFactor = Math.max(0, 15 - (lifeform.age / maxAge) * 15);
        let lightness = Math.min(85, Math.max(40,
            60 + // ベース明度を上げる
            energyFactor +
            ageFactor
        ));
        
        // 遺伝子ハッキング状態による明度の調整
        if (lifeform._immune_response) {
            lightness -= 10; // 免疫応答中はやや暗く
        }
        
        if (lifeform._acquiredGenes && lifeform._acquiredGenes.length > 0) {
            const recentAcquisition = lifeform._acquiredGenes.some(g => time - g.time < 100);
            if (recentAcquisition) {
                lightness += 10; // 遺伝子獲得直後は明るく
            }
        }

        return `hsl(${Math.floor(hue)}, ${Math.floor(saturation)}%, ${Math.floor(lightness)}%)`;
    }
    
    // フレームを描画
    function render() {
        const zBuffer = initZBuffer();
        
        // 環境のリソース処理を実行
        // 1. リソースの物理的な移動と拡散を処理
        environment.processResourceMovement(environment.systemState.memoryUsage);
        
        // 生命体を更新
        for (let i = lifeforms.length - 1; i >= 0; i--) {
            lifeforms[i].processMetabolism(environment);
            // 完全に分解された場合のみ新しい生命体を生成
            if (lifeforms[i].update(lifeforms, environment)) {
                const deadPosition = { ...lifeforms[i].position };
                const deadEnergy = lifeforms[i].energy;
                
                if (enableRecycling && Math.random() < 0.3) {  // リサイクル機能がONの場合のみ30%の確率で新しい生命体が発生
                    const newDna = {
                        ...lifeforms[i].dna,
                        // 突然変異を加える
                        photosynthesis: {
                            efficiency: Math.random(),
                            depth: {
                                optimal: (Math.random() * 10) - 5,
                                range: 0.2 + Math.random() * 0.3
                            },
                            wavelengths: [
                                { min: 400, max: 500, efficiency: Math.random() },
                                { min: 500, max: 600, efficiency: Math.random() },
                                { min: 600, max: 700, efficiency: Math.random() }
                            ],
                            adaptations: {
                                nightMode: Math.random() * 0.3,
                                stressResponse: Math.random() * 0.5
                            }
                        },
                        toxins: {
                            types: {
                                neural: {
                                    strength: Math.random() * 0.5,
                                    developmentCost: 0.3,
                                    effectRange: 2 + Math.random() * 3
                                },
                                cellular: {
                                    strength: Math.random() * 0.5,
                                    developmentCost: 0.4,
                                    effectRange: 1 + Math.random() * 2
                                },
                                digestive: {
                                    strength: Math.random() * 0.5,
                                    developmentCost: 0.2,
                                    effectRange: 1.5 + Math.random() * 2
                                }
                            },
                            resistance: {
                                neural: Math.random(),
                                cellular: Math.random(),
                                digestive: Math.random()
                            },
                            adaptation: {
                                productionRate: Math.random() * 0.3,
                                storageCapacity: 0.5 + Math.random(),
                                releaseControl: Math.random()
                            }
                        },
                        geneNetwork: {
                            photosynthesis: {
                                enhancedBy: ['efficiency', 'regenerationRate'],
                                suppressedBy: ['toxins.adaptation.productionRate'],
                                influences: ['energy', 'growth']
                            },
                            toxins: {
                                enhancedBy: ['efficiency', 'size'],
                                suppressedBy: ['photosynthesis.efficiency'],
                                influences: ['predation', 'defense']
                            }
                        },
                        mobility: Math.random(),
                        growthRate: 0.1 + Math.random() * 0.4,
                        size: 0.2 + Math.random() * 0.2,
                        speed: 0.3 + Math.random() * 0.2,
                        efficiency: 0.4 + Math.random() * 0.2,
                        perception: 0.3 + Math.random() * 0.2,
                        foodAttraction: 0.4 + Math.random() * 0.2,
                        socialBehavior: Math.random() * 0.4 - 0.2,
                        reproductionRate: 0.2 + Math.random() * 0.2,
                        separationWeight: 0.3 + Math.random() * 0.2,
                        alignmentWeight: 0.3 + Math.random() * 0.2,
                        cohesionWeight: 0.3 + Math.random() * 0.2,
                        depthPreference: (Math.random() * 10) - 5,
                        depthTolerance: 0.2 + Math.random() * 0.2,
                        regenerationRate: Math.random() * 0.05,
                        offspringCount: 1,
                        parentalCare: 0.1 + Math.random() * 0.2,
                        nocturnality: 0.4 + Math.random() * 0.2,
                        territoriality: Math.random() * 0.2,
                        
                        // DNAに以下のような特性を追加
                        resourceExchange: {
                            giveRate: Math.random(),      // リソースを提供する傾向
                            receiveRate: Math.random(),   // リソースを受け取る傾向
                            exchangeRange: Math.random(), // 交換可能な範囲
                            exchangeType: {              // 交換可能なリソースタイプ
                                energy: Math.random(),
                                nutrients: Math.random(),
                                protection: Math.random()
                            }
                        },
                        
                        metabolicPathways: {
                            wasteProducts: [],           // 代謝産物（他の生物のリソースになりうる）
                            requiredResources: [         // 必要な資源の初期設定
                                METABOLIC_PRODUCTS.GLUCOSE,
                                METABOLIC_PRODUCTS.OXYGEN
                            ],
                            byproducts: []              // 副産物（他の生物に有益または有害）
                        },
                        // flockingBehaviorの初期化
                        flockingBehavior: {
                            separation: 0.4 + Math.random() * 0.2,
                            alignment: 0.4 + Math.random() * 0.2,
                            cohesion: 0.4 + Math.random() * 0.2
                        },
                    };
                    
                    const offspring = new Lifeform(
                        deadPosition.x + (Math.random() - 0.5) * 3,
                        deadPosition.y + (Math.random() - 0.5) * 3,
                        deadPosition.z + (Math.random() - 0.5) * 2,
                        deadEnergy * 0.3,
                        newDna
                    );
                    
                    lifeforms.push(offspring);
                }
                
                lifeforms.splice(i, 1);
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
                    // サイズとエネルギーに基づいて文字を選択（安全に）
                    const size = lifeform.size || 0;
                    const energy = lifeform.energy || 0;
                    const sizeIndex = Math.min(Math.floor(size * (asciiChars.length - 1)), asciiChars.length - 1);
                    const energyIndex = Math.min(Math.floor(energy * (asciiChars.length - 1)), asciiChars.length - 1);
                    const charIndex = Math.max(0, Math.min(Math.max(sizeIndex, energyIndex), asciiChars.length - 1));
                    const displayChar = asciiChars[charIndex] || '·';
                    
                    // 色の計算
                    const color = getColor(lifeform);
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: z,
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
                    // 生命体の描画
                    output += `<span style="color:${zBuffer[index].color}">${zBuffer[index].char}</span>`;
                } else {
                    // 空白
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
            const preyCount = lifeforms.filter(l => !l.isPredator).length;
            const avgEnergy = lifeforms.reduce((sum, l) => sum + l.energy, 0) / lifeforms.length;
            
            console.log(`Time: ${time}, Lifeforms: ${lifeforms.length} (${predatorCount} predators, ${preyCount} prey), Avg Energy: ${avgEnergy.toFixed(2)}`);
            
            // システムリソースの情報を表示
            console.log(`System: CPU Load: ${environment.systemState.cpuLoad.toFixed(2)}, Memory: ${environment.systemState.memoryUsage.toFixed(2)}, Latency: ${environment.systemState.networkLatency.toFixed(2)}`);
            
            // リサイクル機能の状態を表示
            console.log(`リサイクル機能: ${enableRecycling ? 'ON' : 'OFF'} (Cキーで切り替え)`);
            
            // HTMLのステータスパネルを更新
            updateStatusPanel(time, lifeforms.length);
        }
        
        requestAnimationFrame(render);
    }
    
    // HSL色をRGBに変換するヘルパー関数
    function hexToRgb(hslColor) {
        // 一時的なdiv要素を作成して色変換を行う
        const tempDiv = document.createElement('div');
        tempDiv.style.color = hslColor;
        document.body.appendChild(tempDiv);
        
        // 計算された色を取得
        const computedColor = window.getComputedStyle(tempDiv).color;
        document.body.removeChild(tempDiv);
        
        // "rgb(r, g, b)" または "rgba(r, g, b, a)" 形式から数値部分を抽出
        const rgbMatch = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (rgbMatch) {
            return `${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}`;
        }
        
        // 変換できない場合はデフォルト値を返す
        return '200, 200, 200';
    }
    
    // HSL色をRGBに変換するヘルパー関数（数学的計算による方法）
    function hslToRgb(hslColor) {
        // HSL形式の文字列から値を抽出
        const hslMatch = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!hslMatch) {
            return '200, 200, 200'; // デフォルト値
        }
        
        // HSL値を取得
        let h = parseInt(hslMatch[1]) / 360;
        let s = parseInt(hslMatch[2]) / 100;
        let l = parseInt(hslMatch[3]) / 100;
        
        let r, g, b;
        
        if (s === 0) {
            // 彩度が0の場合はグレースケール
            r = g = b = l;
        } else {
            // HSLからRGBへの変換
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        // 0-255の範囲に変換
        r = Math.round(r * 255);
        g = Math.round(g * 255);
        b = Math.round(b * 255);
        
        return `${r}, ${g}, ${b}`;
    }
    
    // アニメーション開始（environmentインスタンス作成後に呼び出し）
    render();
    
    // 初期状態でステータスパネルを更新
    updateStatusPanel(0, lifeforms.length);
    
    // ウィンドウサイズ変更時の処理
    window.addEventListener('resize', () => {
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

    // グローバル設定
    let showResources = false; // デフォルトではリソースを表示しない
    let enableRecycling = false; // 死亡した生命体からの再生成を無効化（デフォルトで無効）
    
    // キーボード入力のイベントリスナーを追加
    document.addEventListener('keydown', (event) => {
        if (event.key === 'r' || event.key === 'R') {
            // リソース表示の切り替え
            showResources = !showResources;
            console.log(`リソース表示: ${showResources ? 'ON' : 'OFF'}`);
            
            // ステータスパネルの更新
            const resourceStatus = document.getElementById('resource-status');
            resourceStatus.textContent = showResources ? 'ON' : 'OFF';
            resourceStatus.className = showResources ? 'status-on' : 'status-off';
        }
        else if (event.key === 'c' || event.key === 'C') {
            // リサイクル機能の切り替え
            enableRecycling = !enableRecycling;
            console.log(`リサイクル機能: ${enableRecycling ? 'ON' : 'OFF'}`);
            
            // ステータスパネルの更新
            const recyclingStatus = document.getElementById('recycling-status');
            recyclingStatus.textContent = enableRecycling ? 'ON' : 'OFF';
            recyclingStatus.className = enableRecycling ? 'status-on' : 'status-off';
        }
    });
    
    // ステータスパネルを更新する関数
    function updateStatusPanel(currentTime, lifeformCount) {
        document.getElementById('stats-time').textContent = Math.floor(currentTime / 60);
        document.getElementById('stats-lifeforms').textContent = lifeformCount;
        
        // 初期状態の設定
        const recyclingStatus = document.getElementById('recycling-status');
        recyclingStatus.textContent = enableRecycling ? 'ON' : 'OFF';
        recyclingStatus.className = enableRecycling ? 'status-on' : 'status-off';
        
        const resourceStatus = document.getElementById('resource-status');
        resourceStatus.textContent = showResources ? 'ON' : 'OFF';
        resourceStatus.className = showResources ? 'status-on' : 'status-off';
    }

class EpigeneticState {
    constructor() {
        this.methylationPatterns = new Map();
        this.histoneModifications = new Map();
        this.environmentalStress = 0;
    }
    
    updateMethylation(gene, stress) {
        // 環境ストレスに基づいて遺伝子の発現を調整
        const currentPattern = this.methylationPatterns.get(gene) || 1.0;
        const newPattern = Math.max(0, Math.min(1, currentPattern + stress * 0.1));
        this.methylationPatterns.set(gene, newPattern);
    }
    
    getGeneExpression(gene) {
        // メチル化パターンに基づいて遺伝子発現レベルを返す
        return this.methylationPatterns.get(gene) || 1.0;
    }
} 

class Species {
    constructor(prototype) {
        this.prototype = prototype;
        this.members = new Set();
        this.geneticSignature = this.calculateGeneticSignature(prototype);
        this.age = 0;
        this.lastDivergenceTime = 0;
    }
    
    calculateGeneticDistance(lifeform) {
        let distance = 0;
        const weights = {
            photosynthesis: 0.3,
            predatory: 0.3,
            size: 0.2,
            metabolicPathways: 0.2
        };
        
        // 各特性の差異を重み付けして計算
        for (const [trait, weight] of Object.entries(weights)) {
            const diff = Math.abs(this.prototype.dna[trait] - lifeform.dna[trait]);
            distance += diff * weight;
        }
        
        return distance;
    }
    
    checkSpeciation(lifeform) {
        const geneticDistance = this.calculateGeneticDistance(lifeform);
        const speciationThreshold = 0.3;
        
        // 遺伝的距離が閾値を超えた場合、新種として分岐
        if (geneticDistance > speciationThreshold) {
            return new Species(lifeform);
        }
        return null;
    }
} 

class LifeformManager {
    constructor() {
        this.species = new Set();
        this.speciesHistory = [];
        this.divergenceEvents = [];
    }
    
    updateSpecies(lifeforms) {
        // 既存の種を更新
        for (const species of this.species) {
            species.members.clear();
        }
        
        // 各生命体を適切な種に分類
        for (const lifeform of lifeforms) {
            let foundSpecies = false;
            
            for (const species of this.species) {
                if (species.calculateGeneticDistance(lifeform) < 0.3) {
                    species.members.add(lifeform);
                    foundSpecies = true;
                    break;
                }
            }
            
            // 新種の形成
            if (!foundSpecies) {
                const newSpecies = new Species(lifeform);
                this.species.add(newSpecies);
                this.divergenceEvents.push({
                    time: time,
                    parentSpecies: null,
                    newSpecies: newSpecies
                });
            }
        }
        
        // 種の絶滅をチェック
        for (const species of this.species) {
            if (species.members.size === 0) {
                this.species.delete(species);
                this.speciesHistory.push({
                    species: species,
                    extinctionTime: time
                });
            }
        }
    }
} 

class DecisionSystem {
    constructor() {
        this.memories = [];
        this.behaviorWeights = {
            exploration: 0.5,
            socialInteraction: 0.5,
            resourceGathering: 0.5,
            defense: 0.5
        };
        this.learningRate = 0.1;
    }

    makeDecision(currentState, environment) {
        // 過去の経験と現在の状態に基づいて意思決定
        const decision = {
            action: null,
            confidence: 0
        };

        // 状態評価
        const stateEvaluation = this.evaluateState(currentState);
        
        // 行動選択（各行動の期待値を計算）
        const actions = this.getPossibleActions(currentState);
        for (const action of actions) {
            const expectedValue = this.calculateExpectedValue(action, stateEvaluation);
            if (expectedValue > decision.confidence) {
                decision.action = action;
                decision.confidence = expectedValue;
            }
        }

        return decision;
    }

    learn(action, outcome) {
        // 結果に基づいて重みを更新
        const reward = this.calculateReward(outcome);
        this.updateWeights(action, reward);
        this.memories.push({action, outcome, reward});
        
        // 古い記憶を削除
        if (this.memories.length > 100) {
            this.memories.shift();
        }
    }
} 

class HomeostasisSystem {
    constructor() {
        this.parameters = {
            temperature: 0.5,
            pH: 0.5,
            osmolicBalance: 0.5,
            energyBalance: 0.5
        };
        this.optimalRanges = {
            temperature: {min: 0.4, max: 0.6},
            pH: {min: 0.45, max: 0.55},
            osmolicBalance: {min: 0.4, max: 0.6},
            energyBalance: {min: 0.3, max: 0.7}
        };
    }

    regulate() {
        let stress = 0;
        for (const [param, value] of Object.entries(this.parameters)) {
            const range = this.optimalRanges[param];
            if (value < range.min || value > range.max) {
                // ストレス応答を生成
                stress += Math.abs(value - (range.max + range.min) / 2);
                // 修正アクションを生成
                this.generateCorrectiveAction(param, value, range);
            }
        }
        return stress;
    }
} 

class EvolutionaryLearning {
    constructor() {
        this.adaptations = new Map();
        this.fitnessHistory = [];
        this.generationCount = 0;
    }

    adapt(environment, stress) {
        // 環境要因に基づいて適応を生成
        for (const [factor, value] of Object.entries(environment)) {
            const currentAdaptation = this.adaptations.get(factor) || 0;
            const adaptationChange = this.calculateAdaptationChange(value, stress);
            this.adaptations.set(factor, currentAdaptation + adaptationChange);
        }
    }

    calculateFitness() {
        let fitness = 0;
        for (const [factor, adaptation] of this.adaptations) {
            fitness += this.evaluateAdaptation(factor, adaptation);
        }
        this.fitnessHistory.push({
            generation: this.generationCount,
            fitness: fitness
        });
        return fitness;
    }
} 
});