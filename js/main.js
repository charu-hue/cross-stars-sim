/* --- 1. ゲーム状態を管理するグローバルオブジェクト --- */

let GameState = {
  round: 0,
  turn: 0,
  activePlayerId: "player1", // "player1" または "player2"
  currentPhase: "INIT",      // INIT, START, MAIN, END
  isFirstTurnOfGame: true,
  
  wins: {
    player1: 0,
    player2: 0
  },

  // --- 各プレイヤーの状態 ---
  player1: {
    deck: [], hand: [], leaders: [], playArea: [],
    trashFaceUp: [], trashFaceDown: [],
    tacticsDeck: [], tacticsArea: null,
    ppTicket: false,
    hasPlayedTacticsThisTurn: false,
    pp: { max: 0, current: 0 }
  },

  player2: {
    deck: [], hand: [], leaders: [], playArea: [],
    trashFaceUp: [], trashFaceDown: [],
    tacticsDeck: [], tacticsArea: null,
    ppTicket: false,
    hasPlayedTacticsThisTurn: false,
    pp: { max: 0, current: 0 }
  }
};


/* --- 2. HTMLとJSを連携させる「イベントリスナー」 --- */

// ページの読み込みが完了したら実行
document.addEventListener('DOMContentLoaded', () => {
    // 「ゲーム準備」ボタンが押されたら initializeGame 関数を実行
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.addEventListener('click', initializeGame);
    }

    // (今後実装) 「ターン終了」ボタンが押されたら executeTurnEnd 関数を実行
    // const turnEndBtn = document.getElementById('turn-end-btn');
    // if (turnEndBtn) {
    //     turnEndBtn.addEventListener('click', executeTurnEnd);
    // }
});


/* --- 3. メインのロジック関数 --- */

/**
 * 「ゲーム準備」ボタンが押されたときに実行されるメイン関数
 */
// ... (GameState や イベントリスナー は変更なし) ...

/* --- 3. メインのロジック関数 --- */

function initializeGame() {
    // ... (変更なし) ...

    // 2. テキストをカードオブジェクトに変換
    const decksP1 = parseDecklist(deckInputP1, "p1"); // "p1" プレフィックスを渡す
    const decksP2 = parseDecklist(deckInputP2, "p2"); // "p2" プレフィックスを渡す
    
    // 3. (バリデーション)
    if (!decksP1) {
        alert("Player 1 のデッキリストが不正です。枚数（L:4, T:5, M:50）やカード名を確認してください。");
        return;
    }
    if (!decksP2) {
        alert("Player 2 のデッキリストが不正です。枚数（L:4, T:5, M:50）やカード名を確認してください。");
        return;
    }

    // ... (以降の処理は変更なし) ...
}


/* --- 4. 補助関数 (parseDecklist を更新) --- */

/**
 * デッキリストのテキストを解析し、オブジェクトの配列に変換
 * @param {string} text - ユーザーが入力したデッキリストのテキスト
 * @param {string} idPrefix - "p1" や "p2" など (uniqueId生成用)
 * @returns {object | null} - {mainDeck: [], leaders: [], tactics: []}
 */
function parseDecklist(text, idPrefix) {
    console.log(`[${idPrefix}] デッキリストを解析中...`);
    
    const leaders = [];
    const tactics = [];
    const mainDeck = [];

    const lines = text.split('\n'); // テキストを1行ずつに分割

    try {
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === "") continue; // 空行は無視

            if (trimmedLine.startsWith("L:")) {
                // --- リーダーカード ---
                const cardName = trimmedLine.substring(2).trim();
                const cardData = CARD_DATABASE[cardName];
                if (!cardData) throw new Error(`リーダーカードが見つかりません: ${cardName}`);
                
                leaders.push(createCardInstance(cardData, `l_${idPrefix}`));

            } else if (trimmedLine.startsWith("T:")) {
                // --- タクティクスカード ---
                const cardName = trimmedLine.substring(2).trim();
                const cardData = CARD_DATABASE[cardName];
                if (!cardData) throw new Error(`タクティクスカードが見つかりません: ${cardName}`);
                
                tactics.push(createCardInstance(cardData, `t_${idPrefix}`));

            } else {
                // --- メインデッキカード ---
                // (枚数) (カード名) の形式かを正規表現でチェック
                const match = trimmedLine.match(/^(\d+)\s+(.+)$/);
                if (!match) throw new Error(`メインデッキの書式が不正です: ${trimmedLine}`);
                
                const quantity = parseInt(match[1], 10);
                const cardName = match[2].trim();
                const cardData = CARD_DATABASE[cardName];
                if (!cardData) throw new Error(`メインデッキカードが見つかりません: ${cardName}`);
                
                // 枚数分ループして、それぞれ固有のカードとして追加
                for (let i = 0; i < quantity; i++) {
                    mainDeck.push(createCardInstance(cardData, `m_${idPrefix}`));
                }
            }
        }

        // --- 枚数バリデーション ---
        if (leaders.length !== 4) throw new Error(`リーダーの枚数が4枚ではありません (現在: ${leaders.length}枚)`);
        if (tactics.length !== 5) throw new Error(`タクティクスの枚数が5枚ではありません (現在: ${tactics.length}枚)`);
        if (mainDeck.length !== 50) throw new Error(`メインデッキの枚数が50枚ではありません (現在: ${mainDeck.length}枚)`);

        console.log(`[${idPrefix}] デッキ解析成功`);
        return { leaders, tactics, mainDeck };

    } catch (error) {
        console.error(`[${idPrefix}] デッキ解析エラー:`, error.message);
        return null; // エラーが発生したら null を返す
    }
}

// ... (shuffle, drawCards, setPP, executeStartPhase, renderBoard は変更なし) ...

/**
 * 配列をシャッフルする (フィッシャー・イェーツのシャッフル)
 * @param {Array<object>} array - カードオブジェクトの配列
 * @returns {Array<object>} - シャッフルされた配列
 */
function shuffle(array) {
    console.log("デッキをシャッフル中...");
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * 指定したプレイヤーが指定した枚数ドローする
 * @param {string} playerId - "player1" または "player2"
 * @param {number} amount - ドローする枚数
 */
function drawCards(playerId, amount) {
    console.log(`${playerId}が${amount}枚ドロー`);
    const playerState = GameState[playerId];
    for (let i = 0; i < amount; i++) {
        if (playerState.deck.length > 0) {
            const card = playerState.deck.pop(); // デッキの上から1枚取る
            playerState.hand.push(card);         // 手札に加える
        } else {
            console.warn(`${playerId}のデッキが0枚です！`);
            // (将来的にデッキ切れ処理)
            break;
        }
    }
}

/**
 * 両プレイヤーのPPを設定する
 * @param {number} value - 設定するPPの最大値
 */
function setPP(value) {
    GameState.player1.pp.max = value;
    GameState.player1.pp.current = value;
    GameState.player2.pp.max = value;
    GameState.player2.pp.current = value;
}

/**
 * 開始フェイズの処理を実行する
 * @param {string} playerId - "player1" または "player2"
 */
function executeStartPhase(playerId) {
    console.log(`--- ${playerId}のターン (Round ${GameState.round} / Turn ${GameState.turn + 1}) ---`);
    GameState.turn++;
    GameState.currentPhase = "START";
    const playerState = GameState[playerId];

    // PP回復
    playerState.pp.current = playerState.pp.max;
    
    // 1ドロー
    drawCards(playerId, 1);
    
    // タクティクスプレイ状況をリセット
    playerState.hasPlayedTacticsThisTurn = false;

    // ゲーム開始フラグを折る
    if (GameState.isFirstTurnOfGame) {
        GameState.isFirstTurnOfGame = false;
    }
    
    GameState.currentPhase = "MAIN"; // メインフェイズへ移行
    console.log(`${playerId}のメインフェイズ開始`);
}

/**
 * GameStateの最新情報に基づき、HTMLの画面を描画（更新）する
 */
function renderBoard() {
    console.log("画面を描画中...");
    // (例: P1の手札を描画)
    const p1Hand = document.getElementById('p1-hand');
    // GameState.player1.hand の内容を元に、p1Hand の中身 (innerText) を更新する
    // (例: `p1Hand.innerText = `手札: ${GameState.player1.hand.length}枚`;`)
    
    // (例: P1のリーダーを描画)
    // GameState.player1.leaders を元に...
    
    // (デバッグ用にGameState全体をコンソールに出力)
    console.log(GameState);
}