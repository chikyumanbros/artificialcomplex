document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    // 幅と高さの比率を1:1に近づける（正方形のグリッドになるように）
    const width = 30;
    const height =20;
    
    // ASCII文字のセット
    const asciiChars = '▓▒░+*·';
    
    // シミュレーションパラメータ
    const initialEntityCount = 20;
    
    class Entity {
        constructor(x, y) {
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
            
            // 基本状態
            this.isActive = true;
            this.isWandering = true;  // ワンダリング状態
            this.isConnecting = false;  // コネクト状態
            this.isReversing = false;  // 反転移動状態
            this.connectTarget = null;  // コネクト対象
            this.isTargeted = false;   // コネクトされている状態
            this.reverseDirection = null; // 反転移動の方向
            
            // センシング結果を保存
            this.sensorData = Array(8).fill(false);
            
            // 位置の整数部分を保持
            this.gridPosition = {
                x: Math.floor(this.position.x),
                y: Math.floor(this.position.y)
            };

            this.reverseStartPosition = null; // 反転開始位置を保持
            this.reverseTimeout = null; // 追加: 反転状態のタイムアウト
        }
        
        // 更新メソッド
        update() {
            if (!this.isActive) return;
            
            // 状態の排他的な更新
            if (this.isConnecting) {
                this.updateConnecting();
            } else if (this.isReversing) {
                this.updateReversing();
            } else if (this.isWandering) {
                this.updateWandering();
            }
            
            // 境界処理
            this.enforceBoundaries();
        }
        
        // 移動先が有効かチェック
        isValidMove(newX, newY, entities) {
            const gridX = Math.floor(newX);
            const gridY = Math.floor(newY);
            
            // 自分の現在のグリッド位置と同じなら移動可能
            if (gridX === this.gridPosition.x && gridY === this.gridPosition.y) {
                return true;
            }
            
            // 境界チェック
            if (gridX < 0 || gridX >= width || gridY < 0 || gridY >= height) {
                return false;
            }
            
            // 他のエンティティとの衝突チェック
            return !entities.some(entity => 
                entity !== this && 
                entity.isActive && 
                Math.floor(entity.position.x) === gridX && 
                Math.floor(entity.position.y) === gridY
            );
        }

        // 位置の更新（衝突チェック付き）
        updatePosition(newX, newY, entities) {
            if (this.isValidMove(newX, newY, entities)) {
                this.position.x = newX;
                this.position.y = newY;
                this.gridPosition.x = Math.floor(newX);
                this.gridPosition.y = Math.floor(newY);
                return true;
            }
            return false;
        }
        
        // ワンダリング更新
        updateWandering() {
            // ランダムウォーク
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.1;
            this.velocity.x += Math.cos(angle) * speed;
            this.velocity.y += Math.sin(angle) * speed;
            
            // 速度の減衰
            const friction = 0.95;
            this.velocity.x *= friction;
            this.velocity.y *= friction;
            
            // 移動試行
            const newX = this.position.x + this.velocity.x;
            const newY = this.position.y + this.velocity.y;
            
            if (!this.updatePosition(newX, newY, entities)) {
                // 移動できない場合は速度をリセット
                this.velocity.x = 0;
                this.velocity.y = 0;
            }
        }
        
        // コネクト更新
        updateConnecting() {
            if (!this.connectTarget || !this.connectTarget.isActive || this.connectTarget.isConnecting) {
                this.resetToWandering();
                return;
            }
            
            const dx = this.connectTarget.position.x - this.position.x;
            const dy = this.connectTarget.position.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 1.5) {
                this.resetToWandering();
                return;
            }
            
            if (distance > 0.5) {
                const speed = 0.05;
                const newX = this.position.x + (dx / distance) * speed;
                const newY = this.position.y + (dy / distance) * speed;
                
                if (!this.updatePosition(newX, newY, entities)) {
                    // 移動できない場合は速度をリセット
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                }
            } else {
                this.velocity.x = 0;
                this.velocity.y = 0;
            }
        }
        
        // ワンダリング状態にリセット
        resetToWandering() {
            // 追加: タイムアウトをクリア
            if (this.reverseTimeout) {
                clearTimeout(this.reverseTimeout);
                this.reverseTimeout = null;
            }
            
            // コネクト関連の状態をリセット
            if (this.connectTarget) {
                this.connectTarget.isTargeted = false;
                this.connectTarget.isWandering = true;  // ターゲットのワンダリングを再開
                this.connectTarget = null;
            }
            
            // 反転関連の状態をリセット
            this.reverseDirection = null;
            this.reverseStartPosition = null;
            
            // 速度をリセット
            this.velocity.x = 0;
            this.velocity.y = 0;
            
            // 基本状態をリセット
            this.isWandering = true;
            this.isConnecting = false;
            this.isReversing = false;
            this.isTargeted = false;
        }
        
        // 反転移動の更新
        updateReversing() {
            if (!this.reverseDirection || !this.reverseStartPosition) {
                this.resetToWandering();
                return;
            }

            const speed = 0.1;
            const newX = this.position.x - this.reverseDirection.x * speed;
            const newY = this.position.y - this.reverseDirection.y * speed;
            
            // 開始位置からの距離を計算
            const dx = this.position.x - this.reverseStartPosition.x;
            const dy = this.position.y - this.reverseStartPosition.y;
            const distanceFromStart = Math.sqrt(dx * dx + dy * dy);

            // 一定距離（2マス）以上離れたら反転移動を終了
            if (distanceFromStart > 2) {
                this.resetToWandering();
                return;
            }
            
            if (!this.updatePosition(newX, newY, entities)) {
                // 移動できない場合は反転移動を終了
                this.resetToWandering();
                return;
            }
        }
        
        // 境界処理
        enforceBoundaries() {
            const margin = 5;
            
            // 境界を超えないように位置を制限
            this.position.x = Math.max(margin, Math.min(width - margin, this.position.x));
            this.position.y = Math.max(margin, Math.min(height - margin, this.position.y));
            
            // グリッド位置も更新
            this.gridPosition.x = Math.floor(this.position.x);
            this.gridPosition.y = Math.floor(this.position.y);
        }
        
        // センシング機能
        sense(entities) {
            // すでにコネクト中またはターゲットになっている場合はセンシングしない
            if (this.isConnecting || this.isTargeted) {
                return;
            }

            // 8方向のセンシング（上、右上、右、右下、下、左下、左、左上）
            const directions = [
                {x: 0, y: -1}, {x: 1, y: -1}, {x: 1, y: 0}, {x: 1, y: 1},
                {x: 0, y: 1}, {x: -1, y: 1}, {x: -1, y: 0}, {x: -1, y: -1}
            ];

            // センサーデータをリセット
            this.sensorData.fill(false);
            
            // 全方向のセンシング
            for (let i = 0; i < directions.length; i++) {
                const dir = directions[i];
                const checkX = Math.floor(this.position.x + dir.x);
                const checkY = Math.floor(this.position.y + dir.y);
                
                // 各方向の検知（自分以外のアクティブなエンティティを検知）
                const detectedEntity = entities.find(entity => 
                    entity !== this && 
                    entity.isActive && 
                    Math.floor(entity.position.x) === checkX && 
                    Math.floor(entity.position.y) === checkY
                );
                
                if (detectedEntity) {
                    this.sensorData[i] = true;
                    
                    // エンティティを検知した場合、ランダムにコネクトか反転移動を選択
                    if (Math.random() < 0.5) {
                        // コネクト中やターゲットのエンティティがいれば、それらの状態をリセット
                        if (detectedEntity.isConnecting) {
                            detectedEntity.resetToWandering();
                        }
                        if (detectedEntity.isTargeted && detectedEntity.connectTarget) {
                            detectedEntity.connectTarget.resetToWandering();
                        }
                        this.startConnect(detectedEntity);
                        break; // コネクトを開始したら他の方向のチェックを中止
                    } else {
                        this.startReverse(dir);
                        break; // 反転を開始したら他の方向のチェックを中止
                    }
                }
            }
        }
        
        // コネクト開始
        startConnect(target) {
            // 既存の状態をクリア
            this.isWandering = false;
            this.isReversing = false;
            this.reverseDirection = null;
            this.reverseStartPosition = null;
            
            // コネクト状態を設定
            this.isConnecting = true;
            this.connectTarget = target;
            this.velocity.x = 0;
            this.velocity.y = 0;
            
            // コネクト対象に状態を設定
            target.isTargeted = true;
            target.isWandering = false;  // ターゲットもワンダリングを停止
        }
        
        // 反転移動開始
        startReverse(direction) {
            // 既存の状態をクリア
            this.isWandering = false;
            this.isConnecting = false;
            this.connectTarget = null;
            
            // 反転状態を設定
            this.isReversing = true;
            this.reverseDirection = direction;
            this.velocity.x = 0;
            this.velocity.y = 0;
            // 反転開始位置を記録
            this.reverseStartPosition = {
                x: this.position.x,
                y: this.position.y
            };
            
            // 追加: 反転状態のタイムアウト設定（3秒後に強制リセット）
            this.reverseTimeout = setTimeout(() => {
                if (this.isReversing) {
                    this.resetToWandering();
                }
            }, 3000);
        }
        
        // 状態に応じた色を取得
        getDisplayColor() {
            if (this.isConnecting) {
                return '#8B4513';  // コネクトしている側は茶色
            } else if (this.isTargeted) {
                return '#556B2F';  // コネクトされている側は暗い緑
            } else if (this.isReversing) {
                return '#4682B4';  // 反転移動中は鋼青色
            }
            return '#D3D3D3';  // 通常状態は薄いグレー
        }
    }
    
    // エンティティの初期化
    const entities = Array(initialEntityCount).fill().map(() => new Entity());
    
    // フレームの描画
    function render() {
        // エンティティの更新
        for (const entity of entities) {
            if (entity.isActive) {
                entity.sense(entities);
                entity.update();
            }
        }
        
        // 描画バッファの準備
        let output = '';
        const displayBuffer = Array(width * height).fill(null).map(() => ({
            char: ' ',
            color: 'white'
        }));
        
        // エンティティの描画
        for (const entity of entities) {
            if (!entity.isActive) continue;
            
            const x = Math.floor(entity.position.x);
            const y = Math.floor(entity.position.y);
            
            if (x >= 0 && x < width && y >= 0 && y < height) {
                const index = y * width + x;
                displayBuffer[index] = {
                    char: '☻',
                    color: entity.getDisplayColor()
                };
            }
        }
        
        // バッファから文字列を生成
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
    }
    
    // シミュレーション開始（5FPS）
    const FPS = 5;
    const FRAME_INTERVAL = 1000 / FPS;
    setInterval(render, FRAME_INTERVAL);
    
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
}); 