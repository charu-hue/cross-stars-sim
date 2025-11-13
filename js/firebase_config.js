// js/firebase_config.js

// Firebaseの機能をWebから読み込む (v10系)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ★ここに、Firebaseコンソールで取得したあなたの設定値を貼り付けてください★
const firebaseConfig = {
  apiKey: "AIzaSyBi7KnEWlTsDfsYOTXLkQBisQuTwEo2K7g",
  authDomain: "cross-stars-sim.firebaseapp.com",
  projectId: "cross-stars-sim",
  storageBucket: "cross-stars-sim.firebasestorage.app",
  messagingSenderId: "351719886348",
  appId: "1:351719886348:web:d5f6db33c7dfe8925d2829",
  measurementId: "G-KHGRP7XSKW"
};


// Firebaseを初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // データベースを使う準備

// 他のファイルで 'db' を使えるようにする
export { db };