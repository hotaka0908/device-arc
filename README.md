# Wiz Necklace — AIネックレス ハードウェア要件サイト

首から下げるAIデバイス（AIネックレス）の **ハードウェア要件** を、図つきでわかりやすくまとめた静的サイトです。

🔗 **公開URL: https://device-arc.vercel.app**

## 内容

- **部品配置** — マイク（上端＋下端）・カメラ（中央）・LED（前面上部）の正面図 / 側面図（SVG）
- **配置の根拠** — なぜマイクを「上＋下」に置くか（自分＝エンドファイア／相手＝ブロードサイド）
- **他社比較** — DJI Mic / AnkerWork / PLAUD のマイク構成比較（近接クリップ型 vs ウェアラブルAIアレイ）
- **システム構成** — ESP32-S3 → BLE(IMA-ADPCM) → スマホ(Flutter) → OpenAI Realtime
- **要件一覧** — 寸法・MCU・マイク・カメラ・電源などの仕様表
- **未決事項** — 2ストリームの行き先（A案/B案）・骨伝導センサー採用・稼働時間目標

## 仕様サマリ

| 項目 | 値 |
|---|---|
| 寸法 | 40 × 30 × 10 mm（縦長・胸装着） |
| MCU | ESP32-S3（BLE 5.0 / 2M PHY） |
| マイク | デジタルMEMS ×2（上端＋下端・間隔 ≈ 40mm） |
| カメラ | ×1（中央・前方 +15〜30° 上向き） |
| スピーカー | なし（スマホ再生にフォールバック） |
| 電源 | LiPo 300–500mAh |

## 開発

ビルド不要の静的サイト（`index.html` + `styles.css`）。

```bash
# ローカル確認
open index.html

# Vercel デプロイ
vercel deploy --prod
```

## 関連リポジトリ

- アプリ（Flutter / iOS・Android）: `necklace2`（"Wiz"）
- ファームウェア（ESP32-S3）: `ai_voice_necklace`

---

© 2026 Universal Pine
