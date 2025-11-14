// ==========================================
// 1. Firebase設定とインポート
// ==========================================
import { db } from './firebase_config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 2. グローバル変数 (データベースとゲーム状態)
// ==========================================

let GLOBAL_CARD_DB = {}; 
let isDatabaseLoaded = false;

let GameState = {
    round: 0,
    turn: 0,
    activePlayerId: "player1",
    currentPhase: "INIT",
    isFirstTurnOfGame: true,
    
    wins: { player1: 0, player2: 0 },

    player1: {
        deck: [], hand: [], leaders: [], playArea: [],
        trashFaceUp: [], trashFaceDown: [],
        tacticsDeck: [], tacticsArea: null,
        ppTicket: false, hasPlayedTacticsThisTurn: false,
        pp: { max: 0, current: 0 }
    },

    player2: {
        deck: [], hand: [], leaders: [], playArea: [],
        trashFaceUp: [], trashFaceDown: [],
        tacticsDeck: [], tacticsArea: null,
        ppTicket: false, hasPlayedTacticsThisTurn: false,
        pp: { max: 0, current: 0 }
    }
};

// ==========================================
// 3. 起動時と初期化の処理
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🔥 Firebaseからカードデータを取得中...");
    await fetchCardDatabase();
    
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) startBtn.addEventListener('click', initializeGame);
    
    const turnEndBtn = document.getElementById('turn-end-btn');
    if (turnEndBtn) turnEndBtn.addEventListener('click', executeTurnEnd);
});

async function fetchCardDatabase() {
    try {
        const querySnapshot = await getDocs(collection(db, "cards"));
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.name) GLOBAL_CARD_DB[data.name] = data;
        });
        isDatabaseLoaded = true;
        console.log(`✅ カードデータの読み込み完了: ${Object.keys(GLOBAL_CARD_DB).length}枚`);
    } catch (error) {
        console.error("❌ カードデータの取得に失敗:", error);
        alert("データベース読込エラー。コンソールを確認してください。");
    }
}

function initializeGame() {
    if (!isDatabaseLoaded) {
        alert("カードデータを読み込み中です...");
        return;
    }

    console.log("🎮 ゲーム準備を開始します...");

    const deckInputP1 = document.getElementById('deck-input-p1').value;
    const deckInputP2 = document.getElementById('deck-input-p2').value;

    const decksP1 = parseDecklist(deckInputP1, "p1");
    const decksP2 = parseDecklist(deckInputP2, "p2");

    if (!decksP1 || !decksP2) return;

    // GameStateのリセットと配置
    GameState.player1.leaders = decksP1.leaders;
    GameState.player1.tacticsDeck = decksP1.tactics;
    GameState.player1.deck = shuffle(decksP1.mainDeck);

    GameState.player2.leaders = decksP2.leaders;
    GameState.player2.tacticsDeck = decksP2.tactics;
    GameState.player2.deck = shuffle(decksP2.mainDeck);
    
    GameState.round = 1;
    setPP(3); // 初期PP
    
    GameState.activePlayerId = "player1";
    GameState.isFirstTurnOfGame = true;
    
    if (GameState.player1.tacticsDeck.length > 0) GameState.player1.tacticsArea = GameState.player1.tacticsDeck.pop();
    if (GameState.player2.tacticsDeck.length > 0) GameState.player2.tacticsArea = GameState.player2.tacticsDeck.pop();
    
    GameState.player2.ppTicket = true;

    drawCards("player1", 4);
    drawCards("player2", 4);

    executeStartPhase("player1");
    
    console.log("🎨 ゲームボードを描画します");
    renderBoard();

    document.getElementById('setup-area').style.display = 'none';
    document.getElementById('game-board-area').style.display = 'block';
}

// ==========================================
// 4. ロジック補助関数
// ==========================================

function parseDecklist(text, idPrefix) {
    const leaders = [];
    const tactics = [];
    const mainDeck = [];
    const lines = text.split('\n');

    try {
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === "") continue;

            let cardName = "";
            const bracketMatch = trimmed.match(/《(.+?)》/);
            if (bracketMatch) {
                cardName = bracketMatch[1];
            } else {
                cardName = trimmed.replace(/^(L:|T:|\d+)\s*/, "").trim();
            }

            if (!cardName) continue;
            
            const dbData = GLOBAL_CARD_DB[cardName];
            if (!dbData) throw new Error(`データベース未登録: 《${cardName}》`);

            let quantity = 1;
            const quantityMatch = trimmed.match(/^(\d+)/);
            if (quantityMatch) quantity = parseInt(quantityMatch[1], 10);

            for (let i = 0; i < quantity; i++) {
                const uniqueId = `${idPrefix}_${Math.random().toString(36).substr(2, 6)}`;
                const newCard = createCardInstance(dbData, uniqueId);
                
                if (dbData.type === "Leader") leaders.push(newCard);
                else if (dbData.type === "Tactics") tactics.push(newCard);
                else mainDeck.push(newCard);
            }
        }
        if (leaders.length !== 4) throw new Error(`リーダーは4枚必要です`);
        return { leaders, tactics, mainDeck };

    } catch (error) {
        alert(`❌ デッキ読み込みエラー:\n${error.message}`);
        return null;
    }
}

function createCardInstance(dbData, uniqueId) {
    return {
        ...dbData,
        uniqueId: uniqueId,
        isAwakened: false,
        isFaceDown: false,
        isTapped: false,
        currentHP: dbData.hp ? Number(dbData.hp) : 0,
        damageCounters: 0,
        attachedCards: []
    };
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function drawCards(playerId, amount) {
    console.log(`🎴 ${playerId} が ${amount}枚ドロー`);
    const playerState = GameState[playerId];
    for (let i = 0; i < amount; i++) {
        if (playerState.deck.length > 0) {
            playerState.hand.push(playerState.deck.pop());
        }
    }
}

function setPP(value) {
    GameState.player1.pp.max = value;
    GameState.player1.pp.current = value;
    GameState.player2.pp.max = value;
    GameState.player2.pp.current = value;
}

function executeStartPhase(playerId) {
    console.log(`--- 🔄 ${playerId} のターン開始 ---`);
    GameState.turn++;
    GameState.currentPhase = "START";
    const playerState = GameState[playerId];

    playerState.pp.current = playerState.pp.max;
    drawCards(playerId, 1);
    playerState.hasPlayedTacticsThisTurn = false;

    if (GameState.isFirstTurnOfGame && GameState.turn > 1) {
        GameState.isFirstTurnOfGame = false;
    }
    
    GameState.currentPhase = "MAIN"; 
}

// ==========================================
// 5. 画面描画 (レンダリング)
// ==========================================

function renderBoard() {
    console.log("🎨 画面を更新中...");

    // ★修正点: ここでPPの表示を更新します
    const p1PPEl = document.getElementById('p1-pp');
    if (p1PPEl) {
        p1PPEl.innerText = `PP: ${GameState.player1.pp.current} / ${GameState.player1.pp.max}`;
        p1PPEl.style.color = GameState.player1.pp.current === 0 ? "red" : "black";
    }

    const p2PPEl = document.getElementById('p2-pp');
    if (p2PPEl) {
        p2PPEl.innerText = `PP: ${GameState.player2.pp.current} / ${GameState.player2.pp.max}`;
        p2PPEl.style.color = GameState.player2.pp.current === 0 ? "red" : "black";
    }

    const areas = [
        { pid: 'player1', zone: 'hand', htmlId: 'p1-hand' },
        { pid: 'player1', zone: 'leaders', htmlId: 'p1-leaders' },
        { pid: 'player1', zone: 'playArea', htmlId: 'p1-play-area' },
        { pid: 'player2', zone: 'hand', htmlId: 'p2-hand' },
        { pid: 'player2', zone: 'leaders', htmlId: 'p2-leaders' },
        { pid: 'player2', zone: 'playArea', htmlId: 'p2-play-area' }
    ];

    areas.forEach(area => {
        const container = document.getElementById(area.htmlId);
        if (!container) return;
        container.innerHTML = "";

        const cards = GameState[area.pid][area.zone];
        
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = "card";
            cardEl.setAttribute("data-type", card.type);
            if (card.isTapped) cardEl.classList.add("tapped");
            if (card.isAwakened) cardEl.classList.add("awakened");
            if (card.isFaceDown) cardEl.classList.add("facedown");

            if (!card.isFaceDown) {
                let statsHtml = "";
                if (card.type === "Leader") {
                    statsHtml = `<div class="card-stats">AP:${card.atk}<br>HP:${card.currentHP}</div>`;
                } else if (card.type === "Attack") {
                     statsHtml = card.atk ? `<div class="card-stats">ATK:${card.atk}</div>` : "";
                }
                cardEl.innerHTML = `<div class="card-cost">${card.cost}</div><div class="card-name">${card.name}</div>${statsHtml}`;
            }

            cardEl.onclick = () => onCardClick(card, area.pid, area.zone);
            container.appendChild(cardEl);
        });
    });

    renderTactics("player1", "p1-tactics-area");
    renderTactics("player2", "p2-tactics-area");
}

function renderTactics(pid, htmlId) {
    const container = document.getElementById(htmlId);
    if (!container) return;
    container.innerHTML = "";
    const card = GameState[pid].tacticsArea;
    if (card) {
        const cardEl = document.createElement('div');
        cardEl.className = "card";
        cardEl.setAttribute("data-type", "Tactics");
        if (card.isFaceDown) cardEl.classList.add("facedown");
        else cardEl.innerHTML = `<div class="card-cost">${card.cost}</div><div class="card-name">${card.name}</div>`;
        
        cardEl.onclick = () => onCardClick(card, pid, 'tacticsArea');
        container.appendChild(cardEl);
    }
}

// ==========================================
// 6. カード操作ロジック
// ==========================================

function onCardClick(card, pid, zone) {
    console.log(`Click: ${card.name} (${zone})`);

    // 手札 → プレイ
    if (zone === 'hand') {
        playCardFromHand(card, pid);
    } 
    // リーダー → メニュー
    else if (zone === 'leaders') {
        handleLeaderClick(card, pid);
    } 
    // タクティクス → 発動
    else if (zone === 'tacticsArea') {
        if (confirm(`タクティクス「${card.name}」を表向きにしますか？`)) {
            card.isFaceDown = false;
            renderBoard();
        }
    }
}

/**
 * ★以前欠落していた関数: 手札からカードをプレイする
 */
function playCardFromHand(card, pid) {
    const playerState = GameState[pid];
    const cost = Number(card.cost);

    if (card.type === "Leader") {
        alert("リーダーは手札から出せません");
        return;
    }
    if (playerState.pp.current < cost) {
        alert(`PPが足りません (必要:${cost}, 現在:${playerState.pp.current})`);
        return;
    }

    if (confirm(`「${card.name}」をプレイしますか？ (コスト:${cost})`)) {
        // コスト消費
        playerState.pp.current -= cost;
        // 手札から移動
        const index = playerState.hand.findIndex(c => c.uniqueId === card.uniqueId);
        if (index !== -1) {
            playerState.hand.splice(index, 1);
            playerState.playArea.push(card);
        }
        renderBoard();
    }
}

/**
 * リーダー操作メニュー
 */
function handleLeaderClick(card, pid) {
    const message = 
        `【${card.name}】\n` +
        `HP: ${card.currentHP} / AP: ${card.atk}\n` +
        `状態: ${card.isAwakened ? "覚醒" : "通常"} / ${card.isTapped ? "ダウン" : "元気"}\n\n` +
        `操作:\n[数値]:ダメージ/回復\n[A]:覚醒切替\n[D]:ダウン切替`;

    const input = prompt(message);
    if (input === null) return;

    const upper = input.toUpperCase().trim();

    if (upper === 'A') {
        card.isAwakened = !card.isAwakened;
    } else if (upper === 'D') {
        card.isTapped = !card.isTapped;
    } else {
        const val = parseInt(input, 10);
        if (!isNaN(val)) {
            card.currentHP -= val;
            if (card.currentHP <= 0 && !card.isTapped) {
                card.currentHP = 0;
                card.isTapped = true;
            }
        }
    }
    renderBoard();
}

/**
 * ターン終了処理
 */
function executeTurnEnd() {
    const pid = GameState.activePlayerId;
    const playerState = GameState[pid];

    if (!confirm(`${pid} のターンを終了しますか？`)) return;

    // 1. プレイエリアのカードをトラッシュへ
    while (playerState.playArea.length > 0) {
        const card = playerState.playArea.shift();
        if (card.type === "Tactics") {
            card.isFaceDown = false;
            playerState.trashFaceUp.push(card);
        } else {
            card.isFaceDown = true;
            playerState.trashFaceDown.push(card);
        }
    }

    // 2. 余剰PPドロー
    const drawCount = playerState.pp.current;
    if (drawCount > 0) {
        alert(`残りPP(${drawCount})分のドローを行います`);
        drawCards(pid, drawCount);
    }

    // 3. 交代
    const nextPlayerId = (pid === "player1") ? "player2" : "player1";
    GameState.activePlayerId = nextPlayerId;

    executeStartPhase(nextPlayerId);
    
    alert(`交代: 次は ${nextPlayerId} のターンです`);
    renderBoard();
}