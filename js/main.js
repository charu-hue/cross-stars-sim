// ==========================================
// 1. Firebase設定とインポート
// ==========================================
import { db } from './firebase_config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 2. グローバル変数 (データベースとゲーム状態)
// ==========================================

// Firebaseからダウンロードしたカードデータをここに保存します
// キー: カード名 (例: "うるか"), 値: カードデータオブジェクト
let GLOBAL_CARD_DB = {}; 
let isDatabaseLoaded = false; // 読み込み完了フラグ

// ゲーム全体の進行状況と、全プレイヤーの状態を管理するオブジェクト
let GameState = {
    round: 0,
    turn: 0,
    activePlayerId: "player1", // 現在のターンプレイヤー ("player1" or "player2")
    currentPhase: "INIT",      // INIT, START, MAIN, END
    isFirstTurnOfGame: true,   // ゲーム開始最初のターンか (タクティクス制限用)
    
    wins: {
        player1: 0,
        player2: 0
    },

    // --- Player 1 の状態 ---
    player1: {
        deck: [],           // メインデッキ (山札)
        hand: [],           // 手札
        leaders: [],        // リーダーカード (4枚)
        playArea: [],       // プレイエリア (場)
        trashFaceUp: [],    // トラッシュ (表向き)
        trashFaceDown: [],  // トラッシュ (裏向き)
        tacticsDeck: [],    // タクティクスデッキ (待機中)
        tacticsArea: null,  // タクティクスエリア (セットされた1枚)
        ppTicket: false,    // 後攻ボーナス (PPチケット)
        hasPlayedTacticsThisTurn: false, // ターン1制限フラグ
        
        pp: { max: 0, current: 0 } // プレイポイント
    },

    // --- Player 2 の状態 ---
    player2: {
        deck: [], hand: [], leaders: [], playArea: [],
        trashFaceUp: [], trashFaceDown: [],
        tacticsDeck: [], tacticsArea: null,
        ppTicket: false,
        hasPlayedTacticsThisTurn: false,
        pp: { max: 0, current: 0 }
    }
};

// ==========================================
// 3. 起動時と初期化の処理
// ==========================================

// 画面が読み込まれたら実行される処理
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. ページを開いたらすぐにFirebaseからカードデータを取得する
    console.log("🔥 Firebaseからカードデータを取得中...");
    await fetchCardDatabase();
    
    // 2. 「ゲーム準備」ボタンにイベントを登録
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.addEventListener('click', initializeGame);
    }

    // (将来的に) 「ターン終了」ボタンのイベントなどもここに記述
    // document.getElementById('turn-end-btn').addEventListener('click', executeTurnEnd);
});

/**
 * Firestoreから全てのカードデータを取得し、GLOBAL_CARD_DB に保存する関数
 */
async function fetchCardDatabase() {
    try {
        // "cards" コレクションの全データを取得
        const querySnapshot = await getDocs(collection(db, "cards"));
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // 検索しやすいように「カード名」をキーにして保存
            // (例: GLOBAL_CARD_DB["うるか"] = { type: "Leader", ... })
            if (data.name) {
                GLOBAL_CARD_DB[data.name] = data;
            }
        });

        isDatabaseLoaded = true;
        console.log(`✅ カードデータの読み込み完了: ${Object.keys(GLOBAL_CARD_DB).length}枚のカードを取得しました`);

    } catch (error) {
        console.error("❌ カードデータの取得に失敗しました:", error);
        alert("データベースの読み込みに失敗しました。インターネット接続やFirebase設定を確認してください。");
    }
}

/**
 * 「ゲーム準備」ボタンが押されたときに実行されるメイン関数
 */
function initializeGame() {
    // データベースの読み込みが終わっていない場合は待ってもらう
    if (!isDatabaseLoaded) {
        alert("カードデータを読み込み中です。少々お待ちください...");
        return;
    }

    console.log("🎮 ゲーム準備を開始します...");

    // 1. ユーザー入力の取得
    const deckInputP1 = document.getElementById('deck-input-p1').value;
    const deckInputP2 = document.getElementById('deck-input-p2').value;

    // 2. テキストを解析してカードオブジェクトに変換
    const decksP1 = parseDecklist(deckInputP1, "p1");
    const decksP2 = parseDecklist(deckInputP2, "p2");

    // 解析に失敗（カードが見つからない等）したら中断
    if (!decksP1 || !decksP2) return;

    // 3. GameStateのリセットと配置
    // Player 1
    GameState.player1.leaders = decksP1.leaders;
    GameState.player1.tacticsDeck = decksP1.tactics;
    GameState.player1.deck = shuffle(decksP1.mainDeck); // シャッフル

    // Player 2
    GameState.player2.leaders = decksP2.leaders;
    GameState.player2.tacticsDeck = decksP2.tactics;
    GameState.player2.deck = shuffle(decksP2.mainDeck); // シャッフル
    
    // 4. 初期設定 (ラウンド1, 3PP)
    GameState.round = 1;
    setPP(3); // 両プレイヤーの最大PPと現在PPを3に設定
    
    // 5. 先攻・後攻の決定 (仮にP1先攻固定)
    GameState.activePlayerId = "player1";
    GameState.isFirstTurnOfGame = true;
    
    // 6. タクティクスエリアへのセット (仮処理: デッキの一番上をセット)
    // ※本来はUIでユーザーに選ばせるのが理想
    if (GameState.player1.tacticsDeck.length > 0) {
        GameState.player1.tacticsArea = GameState.player1.tacticsDeck.pop();
    }
    if (GameState.player2.tacticsDeck.length > 0) {
        GameState.player2.tacticsArea = GameState.player2.tacticsDeck.pop();
    }
    
    // 7. 後攻プレイヤー(P2)にPPチケットを付与
    GameState.player2.ppTicket = true;

    // 8. 初期手札ドロー (4枚)
    drawCards("player1", 4);
    drawCards("player2", 4);

    // 9. 最初のターンの開始フェイズ処理を実行
    executeStartPhase("player1");
    
    // 10. 画面描画と表示切り替え
    console.log("🎨 ゲームボードを描画します");
    renderBoard(); // GameStateの内容を画面に反映

    document.getElementById('setup-area').style.display = 'none'; // 入力画面を隠す
    document.getElementById('game-board-area').style.display = 'block'; // ゲーム画面を出す
}

// ==========================================
// 4. ロジック補助関数 (デッキ解析・操作など)
// ==========================================

/**
 * デッキリストのテキストを解析し、カードオブジェクトの配列を作成する
 * 書式例: "L: 《うるか》" や "4 《ブライアントショット》"
 */
function parseDecklist(text, idPrefix) {
    const leaders = [];
    const tactics = [];
    const mainDeck = [];
    const lines = text.split('\n');

    try {
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === "") continue; // 空行はスキップ

            // カード名を抽出するロジック (改良版)
            let cardName = "";

            // パターンA: 《 》で囲まれている場合 (例: "4 《神速フリック》")
            const bracketMatch = trimmed.match(/《(.+?)》/);
            if (bracketMatch) {
                cardName = bracketMatch[1];
            } else {
                // パターンB: 《 》がない場合 (例: "L: Mondo", "10 神速フリック")
                // 行頭の "L:", "T:", "数字" などを削除して、残りを名前とする
                cardName = trimmed.replace(/^(L:|T:|\d+)\s*/, "").trim();
            }

            // もし名前が空っぽになってしまったらスキップ
            if (!cardName) {
                console.warn(`⚠️ カード名が読み取れませんでした: "${trimmed}"`);
                continue;
            }
            const dbData = GLOBAL_CARD_DB[cardName]; // データベースから検索

            // データベースに登録されていないカードがあった場合
            if (!dbData) {
                throw new Error(`データベースに未登録のカードです: 《${cardName}》\n管理者画面から登録してください。`);
            }

            // 枚数の確認 (行の先頭にある数字を取得。なければ1枚とする)
            let quantity = 1;
            const quantityMatch = trimmed.match(/^(\d+)/);
            if (quantityMatch) {
                quantity = parseInt(quantityMatch[1], 10);
            }

            // 指定枚数分、カードインスタンスを作成してリストに追加
            for (let i = 0; i < quantity; i++) {
                // ユニークIDを生成 (例: p1_xyz123)
                const uniqueId = `${idPrefix}_${Math.random().toString(36).substr(2, 6)}`;
                const newCard = createCardInstance(dbData, uniqueId);
                
                // タイプ別に振り分け
                if (dbData.type === "Leader") {
                    leaders.push(newCard);
                } else if (dbData.type === "Tactics") {
                    tactics.push(newCard);
                } else {
                    mainDeck.push(newCard);
                }
            }
        }

        // 枚数チェック (厳密にやりたい場合はコメントアウトを外す)
        if (leaders.length !== 4) throw new Error(`リーダーは4枚必要です (現在: ${leaders.length}枚)`);
        // if (mainDeck.length !== 50) throw new Error(`メインデッキは50枚必要です`);

        return { leaders, tactics, mainDeck };

    } catch (error) {
        alert(`❌ デッキ読み込みエラー:\n${error.message}`);
        return null; // 失敗したらnullを返す
    }
}

/**
 * データベースのデータから、ゲーム内で使う「カードの実体」を作成する
 */
function createCardInstance(dbData, uniqueId) {
    return {
        ...dbData, // データベースの情報 (name, type, cost, hp, atk, textなど) をコピー
        uniqueId: uniqueId, // 識別用ID
        
        // ゲーム中の状態フラグ
        isAwakened: false,      // 覚醒しているか
        isFaceDown: false,      // 裏向きか
        isTapped: false,        // 行動済み(横向き)か
        currentHP: dbData.hp ? Number(dbData.hp) : 0, // 現在のHP (リーダー用)
        damageCounters: 0,      // ダメージカウンター
        attachedCards: []       // 装備カード
    };
}

/**
 * 配列をランダムにシャッフルする (フィッシャー・イェーツ法)
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * 指定したプレイヤーがデッキからカードを引く
 */
function drawCards(playerId, amount) {
    console.log(`🎴 ${playerId} が ${amount}枚ドロー`);
    const playerState = GameState[playerId];
    
    for (let i = 0; i < amount; i++) {
        if (playerState.deck.length > 0) {
            const card = playerState.deck.pop(); // デッキの一番上を取る
            playerState.hand.push(card);         // 手札に加える
        } else {
            console.warn(`${playerId} のデッキがありません！`);
        }
    }
}

/**
 * 両プレイヤーのPPを設定する
 */
function setPP(value) {
    GameState.player1.pp.max = value;
    GameState.player1.pp.current = value;
    GameState.player2.pp.max = value;
    GameState.player2.pp.current = value;
}

/**
 * ターン開始時の処理 (PP回復、1ドロー)
 */
function executeStartPhase(playerId) {
    console.log(`--- 🔄 ${playerId} のターン開始 (Round ${GameState.round} / Turn ${GameState.turn + 1}) ---`);
    
    GameState.turn++;
    GameState.currentPhase = "START";
    const playerState = GameState[playerId];

    // 1. PP回復
    playerState.pp.current = playerState.pp.max;
    
    // 2. ドロー (先攻1ターン目も引くルール)
    drawCards(playerId, 1);
    
    // 3. タクティクス使用制限のリセット
    playerState.hasPlayedTacticsThisTurn = false;

    // 4. 「ゲーム最初のターン」フラグを折る
    if (GameState.isFirstTurnOfGame && GameState.turn > 1) {
        // ※正確なロジック: P2のターンが終わるまでが「1巡目」ですが、
        // ここでは簡易的に「誰かが行動したら」フラグを管理します。
        // 実装が進んだら調整しましょう。
        GameState.isFirstTurnOfGame = false;
    }
    
    // メインフェイズへ移行
    GameState.currentPhase = "MAIN"; 
    console.log(`⚔️ ${playerId} のメインフェイズ`);
}

// js/main.js の renderBoard 関数を置き換え

/**
 * GameStateの内容を元に、画面上のカードを描画し直す
 */
function renderBoard() {
    console.log("🎨 画面を更新中...");

    // 描画したいエリアのIDリスト
    const areas = [
        { pid: 'player1', zone: 'hand', htmlId: 'p1-hand' },
        { pid: 'player1', zone: 'leaders', htmlId: 'p1-leaders' },
        { pid: 'player1', zone: 'playArea', htmlId: 'p1-play-area' },
        
        { pid: 'player2', zone: 'hand', htmlId: 'p2-hand' },
        { pid: 'player2', zone: 'leaders', htmlId: 'p2-leaders' },
        { pid: 'player2', zone: 'playArea', htmlId: 'p2-play-area' }
    ];

    // 各エリアをクリアして、カードを再配置
    areas.forEach(area => {
        const container = document.getElementById(area.htmlId);
        if (!container) return;

        container.innerHTML = ""; // 一旦空にする

        // GameStateからカードリストを取得
        const cards = GameState[area.pid][area.zone];
        
        cards.forEach(card => {
            // カードのHTML要素を作成
            const cardEl = document.createElement('div');
            cardEl.className = "card";
            
            // タイプ別に色を変えるための属性
            cardEl.setAttribute("data-type", card.type);
            
            // 状態によるクラス付与
            if (card.isTapped) cardEl.classList.add("tapped");
            if (card.isAwakened) cardEl.classList.add("awakened");
            if (card.isFaceDown) cardEl.classList.add("facedown");

            // カードの中身 (HTML)
            // 裏向きでなければ情報を表示
            if (!card.isFaceDown) {
                let statsHtml = "";
                if (card.type === "Leader") {
                    statsHtml = `<div class="card-stats">AP:${card.atk}<br>HP:${card.currentHP}</div>`;
                } else if (card.type === "Attack") {
                     // DBにATKがあれば表示(例)
                     statsHtml = card.atk ? `<div class="card-stats">ATK:${card.atk}</div>` : "";
                }

                cardEl.innerHTML = `
                    <div class="card-cost">${card.cost}</div>
                    <div class="card-name">${card.name}</div>
                    ${statsHtml}
                `;
            }

            // クリックしたときのイベント（後で実装）
            cardEl.onclick = () => onCardClick(card, area.pid, area.zone);

            container.appendChild(cardEl);
        });
    });
    
    // タクティクスエリアの描画 (単体なので別処理)
    renderTactics("player1", "p1-tactics-area");
    renderTactics("player2", "p2-tactics-area");
}

// タクティクスエリア専用の描画関数
function renderTactics(pid, htmlId) {
    const container = document.getElementById(htmlId);
    if (!container) return;
    container.innerHTML = "";
    
    const card = GameState[pid].tacticsArea;
    if (card) {
        const cardEl = document.createElement('div');
        cardEl.className = "card";
        cardEl.setAttribute("data-type", "Tactics");
        // タクティクスエリアのカードは基本的に裏向きスタートだが、GameStateに従う
        if (card.isFaceDown) cardEl.classList.add("facedown");
        
        if (!card.isFaceDown) {
             cardEl.innerHTML = `<div class="card-cost">${card.cost}</div><div class="card-name">${card.name}</div>`;
        }
        container.appendChild(cardEl);
    }
}

/* ==========================================
   カード操作ロジック (更新版)
   ========================================== */

/**
 * カードがクリックされたときの処理 (司令塔)
 */
function onCardClick(card, pid, zone) {
    console.log(`Click: ${card.name} (${zone})`);

    // 1. 自分のターンかチェック (デバッグ用に一旦コメントアウトしてもOK)
    // if (GameState.activePlayerId !== pid) {
    //    alert("相手のターンです。操作できません。");
    //    return;
    // }

    // 2. ゾーンによって処理を分岐
    if (zone === 'hand') {
        // 手札のカード → プレイする
        playCardFromHand(card, pid);

    } else if (zone === 'leaders') {
        // リーダー → ダメージ/覚醒/ダウン操作メニューを開く
        handleLeaderClick(card, pid);

    } else if (zone === 'playArea') {
        // プレイエリア → (例: まだ何もしない、またはトラッシュ送りの確認など)
        console.log("プレイエリアのカードがクリックされました");

    } else if (zone === 'tacticsArea') {
        // タクティクス → (例: 発動確認)
        if (confirm(`タクティクス「${card.name}」を発動(表向きに)しますか？`)) {
            card.isFaceDown = false;
            renderBoard();
        }
    }
}

/**
 * リーダーカード操作メニュー (ダメージ計算、覚醒、ダウン)
 */
function handleLeaderClick(card, pid) {
    // 現在の状態を表示しつつ、操作を入力させる
    const message = 
        `【${card.name}】\n` +
        `現在 HP: ${card.currentHP} / ATK: ${card.atk}\n` +
        `状態: ${card.isAwakened ? "✨覚醒中" : "通常"} / ${card.isTapped ? "💤ダウン" : "元気"}\n\n` +
        `▼ 操作を入力してください:\n` +
        `[数字] : ダメージを与える (例: 30)\n` +
        `[負の数] : 回復する (例: -20)\n` +
        `[A] : 覚醒 ON/OFF 切り替え\n` +
        `[D] : ダウン状態 ON/OFF 切り替え`;

    const input = prompt(message);

    // キャンセルボタンが押されたら終了
    if (input === null) return;

    const upperInput = input.toUpperCase().trim();

    // --- A: 覚醒切り替え ---
    if (upperInput === 'A') {
        card.isAwakened = !card.isAwakened;
        // ※もしデータベースに覚醒後のHP/ATKがあればここで数値を書き換える処理も追加可能
        alert(`${card.name} の覚醒状態を ${card.isAwakened ? "ON" : "OFF"} にしました。`);

    // --- D: ダウン切り替え ---
    } else if (upperInput === 'D') {
        card.isTapped = !card.isTapped;
        alert(`${card.name} のダウン状態を切り替えました。`);

    // --- 数字: ダメージ/回復 ---
    } else {
        const value = parseInt(input, 10);
        if (isNaN(value)) {
            alert("無効な入力です。");
            return;
        }

        // ダメージ処理 (HPを減らす)
        card.currentHP -= value;

        let logMsg = "";
        if (value > 0) logMsg = `${value} のダメージを受けました！`;
        else logMsg = `${Math.abs(value)} 回復しました！`;

        // ダウン判定 (HPが0以下になったら自動ダウン)
        if (card.currentHP <= 0 && !card.isTapped) {
            card.currentHP = 0; // HPは0で止める
            card.isTapped = true; // ダウンさせる
            logMsg += `\nそして、${card.name} はダウンしました！`;
            
            // ※ここでアタッカーの覚醒処理を自動化したい場合、
            // 「誰が攻撃したか」の情報が必要になるため、今回は手動(A入力)に任せます。
        }

        alert(logMsg);
    }

    // 画面を更新して見た目を反映
    renderBoard();
}