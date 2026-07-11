# Jujutsu (jj) チートシート

[Jujutsu](https://github.com/jj-vcs/jj) のレベル別チートシート Web アプリです。
GitHub Flow における pull / push / ブランチ運用を jj でどう扱うかを中心に、
初学者・中級者(Git 経験者)・Git 熟練者の 3 レベルで整理しています。

- コンテンツ(データ)とデザイン(テンプレート)を分離し、`npm run build` で `docs/` を生成
- レベル切替タブ / 全レベル横断のインクリメンタル検索(`/` でフォーカス)
- コードブロックのワンクリックコピー、ダーク / ライトテーマ
- jj v0.42 系(2026 年 6 月)のコマンド体系に準拠

## アーキテクチャ:データとデザインの分離

コンテンツ(何を書くか)とデザイン(どう見せるか)を分け、
Node.js の小さなビルドスクリプトで公開物 `docs/` を生成します。
Gatsby などのフレームワークは静的チートシート 1 枚には過剰なため、
**依存最小(`js-yaml` のみ)** の方式を採用しています。

```
data/            ← コンテンツ(データ)。文言を編集するのはここだけ
  site.yaml        サイト設定・ヘッダ・タブ・フッター
  beginner.yaml    レベル1(初学者)のカード群
  intermediate.yaml レベル2(中級者)のカード群
  advanced.yaml    レベル3(熟練者)のカード群
  print.yaml       1枚もの印刷用チートシート(要点の抜粋)
src/             ← デザイン資産(原本)
  style.css
  script.js
build.js         ← data + テンプレートから docs/ を生成するビルドスクリプト
docs/            ← 生成物(GitHub Pages が公開する。手で編集しない)
  index.html
  print.html      1枚もの印刷用チートシート(A4 横・PDF 出力用)
  levels/{beginner,intermediate,advanced}.html
  style.css / script.js   （src/ からコピーされる）
```

データのスキーマは `card`(通常カード)/ `steps`(手順)/ `compare`(対応表)/
`level-head`(レベル見出し)といった現行のパターンを表現できるようになっており、
`<b>` や `<code>` などのインライン HTML はデータ中に文字列としてそのまま持たせます。

> **重要:** `docs/` は **生成物** です。文言や見た目を変えるときは
> `data/`(コンテンツ)または `src/`・`build.js`(デザイン)を編集し、
> `npm run build` で `docs/` を再生成してください。`docs/` を直接編集しないこと。

## 開発フロー

```sh
# 1. 依存をインストール(初回のみ)
npm install

# 2. コンテンツを編集(例: data/beginner.yaml のカードを追加・修正)

# 3. docs/ を再生成
npm run build

# 4. ローカルで確認(fetch を使うため file:// ではなく HTTP で配信する)
python3 -m http.server --directory docs 8000
#   → http://localhost:8000/ を開く
```

生成された `docs/` の変更もコミットに含めてください
(GitHub Pages のワークフローが `docs/` をそのまま公開するため)。

## PDF(1枚もの印刷用チートシート)

全 54 カードを 1 枚に収めるのは不可能なため、`data/print.yaml` に
**要点を凝縮した抜粋**を持たせ、`build.js` が **A4 横・4段組**の
`docs/print.html` を生成します(スタイルは印刷で確実に 1 ページに収まるよう
`print.html` 内に自己完結。`@page { size: A4 landscape }` を使用)。

- サイト本体のヘッダの **🖨 PDF** リンクから `print.html` を開けます。
- `print.html` の **「🖨 PDFとして保存」** ボタン(`window.print()`)→
  ブラウザの印刷ダイアログで「PDF に保存」を選ぶと出力できます
  (puppeteer などの重い依存は使いません)。
- 中身を増減したいときは `data/print.yaml` を編集して `npm run build`。

**1 ページに収まることの検証**(Chrome があれば):

```sh
npm run build
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=out.pdf "file://$(pwd)/docs/print.html"
# out.pdf が 1 ページであることを確認(PDF の /Count が 1)
```

## ローカルで見る

```sh
python3 -m http.server --directory docs 8000
```

でローカルサーバを立て、`http://localhost:8000/` を開きます
(レベル別コンテンツを `fetch` で読み込むため、`docs/index.html` を
`file://` で直接開くと表示されません)。

## GitHub Pages で公開する

このリポジトリは `jj` (colocated)で管理されています。

```sh
# 1. GitHub に空のリポジトリを作成したら、リモートを登録
jj git remote add origin git@github.com:YOUR_NAME/jujutsu-cheat-sheet.git

# 2. main bookmark を push(古い jj では --allow-new が必要)
jj git push -b main

# 3. GitHub リポジトリの Settings → Pages →
#    Source: Deploy from a branch / Branch: main / フォルダ: /docs
```

数分後に `https://YOUR_NAME.github.io/jujutsu-cheat-sheet/` で公開されます。

## 日々の更新(このリポジトリ自体が `jj` の練習台)

```sh
# 編集したら
jj commit -m "docs: ○○を追記"
jj bookmark move main --to @-
jj git push
```

## 参考リンク

- [公式ドキュメント](https://docs.jj-vcs.dev/latest/)
- [GitHub との連携ガイド](https://docs.jj-vcs.dev/latest/github/)
- [Git コマンド対応表](https://docs.jj-vcs.dev/latest/git-command-table/)

## ライセンス

[MIT License](./LICENSE)
