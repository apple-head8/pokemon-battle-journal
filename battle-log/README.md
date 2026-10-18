# ロトムログ — 開発ガイド

アプリの概要と利用手順は [ルートのREADME](../README.md) を参照してください。Web版の静的ビルドとPC用ローカル版を共通の画面コードから生成します。[公開とセキュリティ](WEB-RELEASE.md)も参照してください。

## 環境構築

Node.js 24とnpmを推奨します。このフォルダで次を実行してください。

```sh
npm ci
npm run build
npm start
```

[http://127.0.0.1:4318/](http://127.0.0.1:4318/) で起動します。Windowsでは `start.cmd` からも起動できます。

`start.cmd` はバックグラウンドでサーバーを起動します。コードを変更しながら作業する場合は、ターミナルで `npm start` を使うと再起動しやすくなります。

## 技術構成

| 対象 | 実装 |
| --- | --- |
| パーティー管理 | React / JavaScript・JSX |
| 対戦記録・履歴 | HTML / CSS / JavaScript |
| ビルド | Vite |
| Web版の保存 | 指定JSONへの直接保存、IndexedDBへの退避、JSONダウンロード |
| ローカル版の保存API | Node.js標準のHTTPサーバー |
| ローカル版の永続化 | ローカルJSONファイル |
| テスト | Node.js標準テストランナー |

```text
battle-log/
├── src/
│   ├── parties.jsx       # パーティー管理画面
│   └── natures.mjs       # 性格補正とSP入力の処理
├── public/
│   ├── index.html        # 対戦記録画面
│   ├── app.js
│   ├── history.html      # 対戦履歴・集計画面
│   ├── history.js
│   ├── parties.html      # React画面のホスト
│   ├── shared.js         # テーマと表示補助
│   └── build/            # ビルド生成物（Git管理対象外）
├── data/                 # 保存データ（Git管理対象外）
├── server.js
├── server.test.js
├── natures.test.js
└── vite.config.mjs
```

## 変更と確認

React画面や `natures.mjs` を変更したら、`npm run build` を実行してください。`public/build/parties.js` が生成されます。HTML・CSS・ブラウザ用JavaScriptの変更は、ページの再読み込みで反映されます。

`server.js` の変更にはサーバーの再起動が必要です。保存APIの変更時は、実際の対戦データを使わずテスト用ディレクトリで確認してください。

```sh
npm run build
npm run build:web
npm test
```

テストでは、一時ディレクトリを使った保存・再起動・編集・インポート・削除、入力検証、過去の型の保持、性格補正とSP制限などを確認します。通常の `data/battles.json` は使用しません。

画面変更時は、記録・履歴・パーティー管理間の移動、履歴からの編集、ライト／ダークモード、狭い画面での入力も確認してください。

## 保存形式と互換性

保存ファイルは `data/battles.json` です。JSONのトップレベルは次の構造です。

```json
{
  "version": 1,
  "records": [],
  "parties": []
}
```

- `records`：対戦日、構築名、勝敗、双方の選出、相手の6匹、ターンメモ、振り返りなど。
- `parties`：6匹の型、表示順、没にした状態など。
- `partySnapshot`：対戦記録内に保持する、保存時点のパーティー情報。現在のパーティーを変更しても過去の型を保持します。
- `turns`：ターン順の文字列配列。空欄もターン番号を維持するために保持します。
- `notes`・`leadWork`：旧形式の互換用フィールド。旧記録の情報が失われないよう扱います。

対戦画面のJSON読み込みは追加方式です。保存設定から別ファイルを開く操作は記録の切り替えで、統合ではありません。追加時は、既存IDの上書きは行いません。構築名は集計に使うため、型を比較する場合は複製して別名にします。名前表記の自動正規化やポケモンDBとの照合は行っていません。

勝率は「勝ち数 ÷ 絞り込み後の全記録数」で、引き分けも分母に含みます。積む機会の集計は「作れた」「作れなかった」の回答だけを対象とします。

## データの扱いと公開範囲

`.gitignore` で `data/`、`node_modules/`、`public/build/` を除外しています。サンプルやスクリーンショットを追加する場合は、公開用の架空データを使ってください。

サーバーは `127.0.0.1:4318` に接続を限定し、Host・Originも確認しています。利用者ごとの認証やデータ分離はありません。このローカル用APIをそのままインターネットへ公開する設計ではありません。

Web版は `npm run build:web` で `web-dist/` に生成します。`npm run preview:web` で4319番の静的プレビューを起動できます。`public/validation.js` は共通の入力検証、`journal-core.js` はWeb版の状態更新、`web-storage.js` はIndexedDBのトランザクションとJSON出力です。Web版ビルド時はローカルAPIアダプターと外部フォントを除き、保存先に関する文言を変更します。UIを編集した際は両ビルドを確認してください。

JSONをダウンロード・読み込みする方式です。利用者の既存ファイルへの直接上書き、AI向けMarkdown出力、AIへの自動送信は未実装です。

ブラウザには入力途中の対戦メモとテーマ設定が残ります。確定した対戦記録の保存先はJSONファイルです。画面のフォントにはGoogle Fontsを利用しています。
