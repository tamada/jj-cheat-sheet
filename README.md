# Jujutsu (jj) チートシート

[Jujutsu](https://github.com/jj-vcs/jj) のレベル別チートシート Web アプリです。
GitHub Flow における pull / push / ブランチ運用を jj でどう扱うかを中心に、
初学者・中級者(Git 経験者)・Git 熟練者の 3 レベルで整理しています。

- 依存なしの単一 `index.html`(ビルド不要)
- レベル切替タブ / 全レベル横断のインクリメンタル検索(`/` でフォーカス)
- コードブロックのワンクリックコピー、ダーク / ライトテーマ
- jj v0.42 系(2026 年 6 月)のコマンド体系に準拠

## ローカルで見る

`index.html` をブラウザで開くだけです。

## GitHub Pages で公開する

このリポジトリは jj(colocated)で管理されています。

```sh
# 1. GitHub に空のリポジトリを作成したら、リモートを登録
jj git remote add origin git@github.com:YOUR_NAME/jujutsu-cheat-sheet.git

# 2. main bookmark を push(古い jj では --allow-new が必要)
jj git push -b main

# 3. GitHub リポジトリの Settings → Pages →
#    Source: Deploy from a branch / Branch: main / フォルダ: /(root)
```

数分後に `https://YOUR_NAME.github.io/jujutsu-cheat-sheet/` で公開されます。

## 日々の更新(このリポジトリ自体が jj の練習台)

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
