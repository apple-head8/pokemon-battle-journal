# Pokémon Battle Journal

ポケモンチャンピオンズの対戦記録とパーティー管理を行うローカルアプリです。

## 起動

Node.js 20.12以上を用意し、Windowsでは `battle-log/start.cmd` をダブルクリックします。
初回はReact画面の依存パッケージをインストールしてビルドします。

手動で起動する場合:

```sh
cd battle-log
npm ci
npm run build
npm start
```

- 対戦記録: http://127.0.0.1:4318/
- パーティー管理: http://127.0.0.1:4318/parties

## 機能

- 構築別の勝率、選出、対戦メモ、初手の仕事を記録
- Reactによるパーティー管理、個別の持ち物・性格・SP・技入力
- パーティー複製、並び替え、没/復帰
- ライト/ダークモード
- JSONバックアップ・復元、CSV出力

保存APIはNode.js、パーティー画面はReact＋Vite、対戦記録画面はHTML/CSS/JavaScriptです。
対戦データは `battle-log/data/` に保存され、Gitには含まれません。

テスト: `cd battle-log` → `npm test`
詳しくは [利用・開発メモ](battle-log/README.md) を参照してください。
