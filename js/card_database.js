// カード名(キー)と、その詳細データ(値)をマッピングするオブジェクト
// 【重要】ここにクロススターズの全カードのデータを手入力する必要があります
const CARD_DATABASE = {
    // --- リーダーカードの例 ---
    "《うるか》": {
        cardId: "BP01-001",
        type: "Leader",
        color: "赤",

        hp_base: 100,
        atk_base: 30,

        hp_awakened: 130,
        atk_awakened: 40,
        effect_awakened: "【覚醒時】カードを1枚引く。"

    },
    "《うるか》": {
        cardId: "BP01-002",
        type: "Leader",
        color: "赤",

        hp_base: 100,
        atk_base: 30,

        hp_awakened: 130,
        atk_awakened: 40,
        effect_awakened: "【覚醒時】カードを1枚引く。"

    },

    // --- タクティクスカードの例 ---
    "《PPチケット》": {
        cardId: "CS01-T01",
        type: "Tactics",
        cost: 0,
        effect: "PPを1回復する"
    },
    "《デッド・オア・アライブ》": {
        cardId: "CS01-T02",
        type: "Tactics",
        cost: 0
    },

    // --- メインデッキのカード例 ---
    "《ブライアントショット》": {
        cardId: "CS01-001",
        type: "Attack",
        cost: 1
    },
    "《序章》": {
        cardId: "CS01-002",
        type: "Memoria",
        cost: 0
    }
    
    // ... 他のすべてのカードをここに追加 ...
};

// 1つのユニークなカードオブジェクトを作成するためのヘルパー関数
function createCardInstance(cardData, uniqueIdPrefix) {
    // 元のカードデータ(CARD_DATABASE)をコピーして、
    // 固有の状態(uniqueId, isAwakenedなど)を追加する
    return {
        ...cardData, // cardId, name, type, cost などをコピー
        
        // --- 状態管理 ---
        uniqueId: `${uniqueIdPrefix}_${Math.random().toString(36).substr(2, 9)}`, // "l_abc123" のような固有ID
        name: cardData.name, // CARD_DATABASEのキーを名前に設定
        
        isAwakened: false,
        isFaceDown: false,
        isTapped: false,
        
        currentHP: cardData.hp || null, // リーダー用のHP
        damageCounters: 0,
        attachedCards: []
    };
}