# Node NFT トークンエコシステム

> **言語選択:** [English](README.md) | [中文](README.zh.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

BSCベースのNFTトークン配布プラットフォーム。シェア分割、二重報酬メカニズム、O(1)グローバルインデックス最適化をサポート。

## プロジェクト構造

```
node-nft/
├── contracts/          # スマートコントラクト（Hardhatプロジェクト）
│   ├── contracts/      # Solidityコントラクトソースコード
│   ├── scripts/        # デプロイスクリプト
│   ├── test/          # コントラクトテスト
│   └── hardhat.config.ts
│
├── frontend/          # フロントエンドアプリケーション（Next.js + wallet-sdk）
│   ├── app/           # Next.js App Router
│   ├── components/    # Reactコンポーネント
│   ├── lib/           # ユーティリティ関数、hooks、stores
│   └── package.json
│
├── backend/           # 管理バックエンドサービス（NestJS/Express）
│   ├── src/           # バックエンドソースコード
│   │   ├── modules/   # 機能モジュール（auth、invite-codes、usersなど）
│   │   └── config/    # 設定ファイル
│   └── package.json
│
└── docs/              # 設計ドキュメント（frontend/docs/ディレクトリ内）
```

## コア機能

- ✅ **O(1)グローバルインデックス** - オラクル配布で固定 ~30k Gas
- ✅ **二重報酬メカニズム** - TKN生成 + USDT報酬
- ✅ **NFTステータス管理** - Live/Dissolved二重ステータス
- ✅ **オンチェーンシェアマーケット** - P2P転送 + オーダーブック取引
- ✅ **段階的アンロック** - 1年後から開始、25ヶ月で完了

## クイックスタート

### コントラクト開発

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### フロントエンド開発

```bash
cd frontend
npm install
npm run dev
```

### バックエンド開発（管理）

```bash
cd backend
npm install
npm run dev
```

## ドキュメント

詳細な設計ドキュメントについては、`../docs/node-nft/`ディレクトリを参照してください：
- [設計ドキュメント](../docs/node-nft/design-story.md)
- [シナリオウォークスルー](../docs/node-nft/scenario-walkthrough.md)
- [要件仕様](../docs/node-nft/requirements.md)
- [コントラクト仕様](../docs/node-nft/contract-spec.md)
- [技術FAQ](../docs/node-nft/technical-faq.md)

## ライセンス

MIT

