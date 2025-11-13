// js/admin.js
import { db } from "./firebase_config.js";
// Firestoreにデータを書き込むための機能(doc, setDoc)を読み込む
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.getElementById('btn-save').addEventListener('click', async () => {
    
    // 1. 入力値を取得する
    const cardId = document.getElementById('inp-id').value.trim();
    const name = document.getElementById('inp-name').value.trim();
    const type = document.getElementById('inp-type').value;
    const cost = document.getElementById('inp-cost').value;
    const hp = document.getElementById('inp-hp').value;
    const atk = document.getElementById('inp-atk').value;
    const text = document.getElementById('inp-text').value;

    // バリデーション (IDと名前がないと困る)
    if (!cardId || !name) {
        alert("カードIDと名前は必須です！");
        return;
    }

    // 2. 保存するデータの形を作る
    // (数値に変換すべきものは Number() で変換)
    const cardData = {
        cardId: cardId,
        name: name,
        type: type,
        cost: Number(cost),
        text: text,
        // 登録日時なども入れておくと便利
        createdAt: new Date()
    };

    // リーダーの場合のみ HP/ATK を追加
    if (type === "Leader") {
        cardData.hp = Number(hp);
        cardData.atk = Number(atk);
        // 覚醒前/後を分けるならここで構造化しますが、まずはシンプルに
    }

    try {
        // 3. Firestoreに保存する
        // "cards" というコレクションの中に、cardId をキーにして保存する
        await setDoc(doc(db, "cards", cardId), cardData);
        
        alert(`保存成功！\n${name} を登録しました。`);
        
        // 入力欄をクリア
        document.getElementById('inp-id').value = "";
        document.getElementById('inp-name').value = "";
        
    } catch (error) {
        console.error("保存エラー:", error);
        alert("保存に失敗しました。コンソールを確認してください。");
    }
});