# Jujutsu (jj) チートシート

[Jujutsu](https://github.com/jj-vcs/jj) のレベル別チートシート Web アプリです。
GitHub Flow における pull / push / ブランチ運用を jj でどう扱うかを中心に、
初学者・中級者(Git 経験者)・Git 熟練者の 3 レベルで整理しています。

- コンテンツ(データ)とデザイン(テンプレート)を分離し、`npm run build` で `docs/` を生成
- レベル切替タブ / 全レベル横断のインクリメンタル検索(`/` でフォーカス)
- コードブロックのワンクリックコピー、ダーク / ライトテーマ
- 言語切替の仕組み(現状は日本語のみだが、`data/<locale>/` を追加するだけで多言語化できる構造)
- jj v0.42 系(2026 年 6 月)のコマンド体系に準拠

## アーキテクチャ:データとデザインの分離

コンテンツ(何を書くか)とデザイン(どう見せるか)を分け、
Node.js の小さなビルドスクリプトで公開物 `docs/` を生成します。
Gatsby などのフレームワークは静的チートシート 1 枚には過剰なため、
**依存最小(`js-yaml` のみ)** の方式を採用しています。

```
data/            ← コンテンツ(データ)。ロケール(言語)ごとのディレクトリに分かれる
  ja/              日本語ロケール。文言を編集するのはここ
    site.yaml        サイト設定・ヘッダ・タブ・フッター・UI文言
    beginner.yaml    レベル1(初学者)のカード群
    intermediate.yaml レベル2(中級者)のカード群
    advanced.yaml    レベル3(熟練者)のカード群
    print.yaml       1枚もの印刷用チートシート(要点の抜粋)
  en/ …            将来ここに追加すれば新しい言語が増える(下記参照)
src/             ← デザイン資産(原本)
  style.css
  script.js
build.js         ← data/<locale> + テンプレートから docs/ を生成するビルドスクリプト
docs/            ← 生成物(GitHub Pages が公開する。手で編集しない)
  index.html       デフォルトロケール(ja)の出力
  print.html
  levels/{beginner,intermediate,advanced}.html
  style.css / script.js   （src/ からコピーされる)
  <locale>/        デフォルト以外のロケールはサブディレクトリに出力(例: en/index.html)
```

データのスキーマは `card`(通常カード)/ `steps`(手順)/ `compare`(対応表)/
`level-head`(レベル見出し)といった現行のパターンを表現できるようになっており、
`<b>` や `<code>` などのインライン HTML はデータ中に文字列としてそのまま持たせます。

> **重要:** `docs/` は **生成物** です。文言や見た目を変えるときは
> `data/`(コンテンツ)または `src/`・`build.js`(デザイン)を編集し、
> `npm run build` で `docs/` を再生成してください。`docs/` を直接編集しないこと。

## 言語切替の仕組み

サイトは複数言語に対応できる構造になっていますが、**現状は日本語(`ja`)のみ**
中身が入っています。仕組みは次のとおりです。

- `build.js` が `data/` 直下のディレクトリを **ロケールとして自動検出**します
  (ディレクトリ名がそのままロケールコードになる。例: `ja`)。
- デフォルトロケール(`build.js` の `DEFAULT_LOCALE`、現状 `"ja"`)は
  `docs/` 直下に、それ以外のロケールは `docs/<locale>/` 以下に出力されます。
  (例:`en` を追加すると `docs/en/index.html` などが生成される)
- 生成される `index.html` / `print.html` の `<html lang="...">` は、その
  ロケールの `site.yaml` の `lang` フィールドに従います。
- ヘッダ(と印刷ページのツールバー)に **🌐 言語切替のセレクト**が常に表示されます。
  選択肢は検出されたロケール一覧から `site.yaml` の `localeLabel` を使って
  ビルド時に埋め込まれ、選択すると対応ロケールの同名ページへ遷移します。
  ロケールが1つしかない間も、この UI 自体は表示されたままです。
- 検索結果表示・コピー完了表示など **script.js が実行時に組み立てる文言**は、
  `site.yaml` の `ui:` セクションから `window.I18N` として各ページに埋め込まれ、
  `script.js` はそれを読んで表示します(未設定時は日本語にフォールバック)。

### 新しい言語を追加するには

1. `data/ja/` をコピーして `data/<新しいロケールコード>/`(例: `data/en/`)を作る。
2. コピーした各 `.yaml` の中身を新しい言語に翻訳する
   (`site.yaml` の `locale` をディレクトリ名と同じ値に、`lang` を BCP 47 の
   言語タグに、`localeLabel` を言語セレクトに表示したい名前に変更する)。
3. `npm run build` を実行する。
   - デフォルトロケール以外なら `docs/<ロケールコード>/` 以下に一式生成される。
   - すべてのロケールのヘッダに、追加した言語への切替リンクが自動で増える。

コードの変更は不要です(`build.js` / `script.js` / `style.css` はロケール数に
依存しません)。

## 開発フロー

```sh
# 1. 依存をインストール(初回のみ)
npm install

# 2. コンテンツを編集(例: data/ja/beginner.yaml のカードを追加・修正)

# 3. docs/ を再生成
npm run build

# 4. ローカルで確認(fetch を使うため file:// ではなく HTTP で配信する)
python3 -m http.server --directory docs 8000
#   → http://localhost:8000/ を開く
```

生成された `docs/` の変更もコミットに含めてください
(GitHub Pages のワークフローが `docs/` をそのまま公開するため)。

## PDF(1枚もの印刷用チートシート)

全 54 カードを 1 枚に収めるのは不可能なため、`data/ja/print.yaml` に
**要点を凝縮した抜粋**を持たせ、`build.js` が **A4 横・4段組**の
`docs/print.html` を生成します(スタイルは印刷で確実に 1 ページに収まるよう
`print.html` 内に自己完結。`@page { size: A4 landscape }` を使用)。

- サイト本体のヘッダの **🖨 PDF** リンクから `print.html` を開けます。
- `print.html` の **「🖨 PDFとして保存」** ボタン(`window.print()`)→
  ブラウザの印刷ダイアログで「PDF に保存」を選ぶと出力できます
  (puppeteer などの重い依存は使いません)。
- 中身を増減したいときは `data/ja/print.yaml` を編集して `npm run build`。

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
