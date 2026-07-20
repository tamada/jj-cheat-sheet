#!/usr/bin/env node
/*
 * build.js — データ(data/<locale>/*.yaml)+ デザイン(このファイルのテンプレート & src/)
 * から公開物 docs/ を生成する、依存最小のビルドスクリプト。
 *
 *   data/<locale>/site.yaml            サイト全体の設定・ヘッダ・タブ・フッター
 *   data/<locale>/{beginner,...}.yaml  レベル別コンテンツ(card / steps / compare / level-head)
 *   src/style.css, src/script.js       デザイン資産(原本)。各ロケールの docs/ へコピーされる。
 *
 * ロケール(言語)は data/ 直下のディレクトリを自動検出する。デフォルト
 * ロケール(DEFAULT_LOCALE、現状 "ja")は docs/ 直下に、それ以外のロケールは
 * docs/<locale>/ 以下に生成する。新しい言語を追加するには data/<locale>/ を
 * 作って `npm run build` するだけでよい(README 参照)。
 *
 * 生成物(ロケールごとに、上記の出力先へ):
 *   index.html
 *   levels/{beginner,intermediate,advanced}.html
 *   print.html            1枚もの印刷用チートシート(A4 横・PDF 出力用)
 *   style.css, script.js
 *
 * コンテンツ中の <b> / <code> / <span class="p"> などのインライン HTML は
 * データ内に文字列としてそのまま保持し、ここでは一切エスケープしない
 * (=データが「中身」、テンプレートが「見た目」)。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const SRC = path.join(ROOT, 'src');
const DOCS = path.join(ROOT, 'docs');

// data/ 配下でデフォルト扱いにするロケール。docs/ 直下に出力される。
const DEFAULT_LOCALE = 'ja';

function readYaml(locale, file) {
  return yaml.load(fs.readFileSync(path.join(DATA, locale, file), 'utf8'));
}

// data/ 直下のディレクトリ一覧 = 利用可能なロケール。
// デフォルトロケールを先頭に、それ以外はアルファベット順。
function detectLocales() {
  const names = fs
    .readdirSync(DATA, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  return names.sort((a, b) => {
    if (a === DEFAULT_LOCALE) return -1;
    if (b === DEFAULT_LOCALE) return 1;
    return a.localeCompare(b);
  });
}

// ロケールごとの出力先ディレクトリ。デフォルトロケールは docs/ 直下、
// それ以外は docs/<locale>/。
function outDir(locale) {
  return locale === DEFAULT_LOCALE ? DOCS : path.join(DOCS, locale);
}

// fromLocale で生成中のページから、toLocale の同名ファイルへの相対リンク。
function localeHref(fromLocale, toLocale, filename) {
  const rel = path.relative(outDir(fromLocale), path.join(outDir(toLocale), filename));
  return rel.split(path.sep).join('/');
}

// 言語切替 UI(🌐 + <select>)。ロケールが1つしかなくても常に表示する。
// 選択すると該当ロケールの同名ページへ遷移する(script.js に依存しない
// よう、onchange はインラインで自己完結させる)。
function renderLangSwitch(langLabel, options) {
  const opts = options
    .map(
      (o) =>
        `      <option value="${o.code}" data-href="${o.href}"${o.current ? ' selected' : ''}>${o.label}</option>`
    )
    .join('\n');
  return [
    `    <div class="lang-switch">`,
    `      <label class="lang-icon" for="langSelect" aria-label="${langLabel}">🌐</label>`,
    `      <select id="langSelect" aria-label="${langLabel}" onchange="location.href=this.selectedOptions[0].dataset.href">`,
    opts,
    `      </select>`,
    `    </div>`,
  ].join('\n');
}

// ---------- レベルフラグメントのテンプレート ----------

function renderSecHead(section) {
  const note = section.note ? `<span class="sec-note">${section.note}</span>` : '';
  return `<div class="sec-h"><h2>${section.heading}</h2>${note}</div>`;
}

function renderCmd(code) {
  return `    <div class="cmd"><pre><code>${code}</code></pre></div>`;
}

function renderNote(text, variant) {
  const cls = variant ? `note ${variant}` : 'note';
  return `    <p class="${cls}">${text}</p>`;
}

function renderDetails(d) {
  return [
    `    <details><summary>${d.summary}</summary>`,
    `      <div class="d-body">${d.body}</div>`,
    `    </details>`,
  ].join('\n');
}

// 通常カード: h3 + 順序付きの content 要素(p / cmd / note / tip / warn / details)
function renderCardContent(item) {
  if ('p' in item) return `    <p>${item.p}</p>`;
  if ('cmd' in item) return renderCmd(item.cmd);
  if ('note' in item) return renderNote(item.note);
  if ('tip' in item) return renderNote(item.tip, 'tip');
  if ('warn' in item) return renderNote(item.warn, 'warn');
  if ('details' in item) return renderDetails(item.details);
  throw new Error('未知の content 要素: ' + JSON.stringify(item));
}

function renderStep(step) {
  const parts = [`      <li>`, `        <h4>${step.h4}</h4>`];
  if (step.cmd) parts.push(`        <div class="cmd"><pre><code>${step.cmd}</code></pre></div>`);
  if (step.sub) parts.push(`        <p class="step-sub">${step.sub}</p>`);
  if (step.details) {
    parts.push(`        <details><summary>${step.details.summary}</summary>`);
    parts.push(`          <div class="d-body">${step.details.body}</div>`);
    parts.push(`        </details>`);
  }
  parts.push(`      </li>`);
  return parts.join('\n');
}

function renderStepsCard(card) {
  return [
    `  <article class="card" data-tags="${card.tags}">`,
    `    <ol class="steps">`,
    card.steps.map(renderStep).join('\n'),
    `    </ol>`,
    `  </article>`,
  ].join('\n');
}

function renderCompareCard(card) {
  const th = card.columns.map((c) => `<th>${c}</th>`).join('');
  const rows = card.rows
    .map(
      (r) =>
        `    <tr data-tags="${r.tags}"><td>${r.want}</td><td class="git">${r.git}</td><td>${r.jj}</td></tr>`
    )
    .join('\n');
  return [
    `<div class="grid wide"><article class="card" data-tags="${card.tags}">`,
    `<div class="tbl-scroll">`,
    `<table class="compare">`,
    `  <thead><tr>${th}</tr></thead>`,
    `  <tbody>`,
    rows,
    `  </tbody>`,
    `</table>`,
    `</div>`,
    `</article></div>`,
  ].join('\n');
}

function renderNormalCard(card) {
  const parts = [`  <article class="card" data-tags="${card.tags}">`];
  if (card.title) parts.push(`    <h3>${card.title}</h3>`);
  (card.content || []).forEach((item) => parts.push(renderCardContent(item)));
  parts.push(`  </article>`);
  return parts.join('\n');
}

function renderCard(card) {
  if (card.type === 'steps') return renderStepsCard(card);
  if (card.type === 'compare') return renderCompareCard(card);
  return renderNormalCard(card);
}

function renderSection(section) {
  // compare カードは grid ラッパを自前で持つので特別扱い
  if (section.cards.length === 1 && section.cards[0].type === 'compare') {
    return [renderSecHead(section), renderCompareCard(section.cards[0])].join('\n');
  }
  const gridCls = section.wide ? 'grid wide' : 'grid';
  return [
    renderSecHead(section),
    `<div class="${gridCls}">`,
    section.cards.map(renderCard).join('\n'),
    `</div>`,
  ].join('\n');
}

function renderLevel(level, meta) {
  const head = [
    `<div class="level-head">`,
    `  <div class="lh-emoji">${level.emoji}</div>`,
    `  <div>`,
    `    <h2>${level.head.title}</h2>`,
    `    <p>${level.head.body}</p>`,
    `  </div>`,
    `</div>`,
  ].join('\n');
  const sections = level.sections.map(renderSection).join('\n\n');
  return [
    `<!-- ================= LEVEL ${level.level}: ${level.label} ================= -->`,
    `<section class="level" data-level="${level.level}">`,
    ``,
    head,
    ``,
    sections,
    ``,
    `</section>`,
    ``,
  ].join('\n');
}

// ---------- index.html のテンプレート ----------

function renderIndex(site, langOptions) {
  const tabs = site.tabs
    .map((t) =>
      [
        `  <button class="tab" role="tab" data-level="${t.level}" aria-selected="${t.selected}">`,
        `    <div class="t-emoji">${t.emoji}</div>`,
        `    <div class="t-name">${t.name}</div>`,
        `    <div class="t-desc">${t.desc}</div>`,
        `  </button>`,
      ].join('\n')
    )
    .join('\n');

  const links = site.footer.links
    .map((l) => `    <a href="${l.href}" target="_blank" rel="noopener">${l.text}</a>`)
    .join('\n');

  const langSwitch = renderLangSwitch(site.langSwitchLabel, langOptions);
  const i18n = JSON.stringify(site.ui || {});

  return `<!DOCTYPE html>
<html lang="${site.lang}" data-theme="${site.defaultTheme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${site.title}</title>
<meta name="description" content="${site.description}">
<link rel="stylesheet" href="style.css">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-86MV0QB34Z"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-86MV0QB34Z');
</script>
</head>
<body>

<header class="top">
  <div class="top-inner">
    <div class="logo"><span class="mark">jj</span><span class="lt">${site.brand}</span></div>
    <div class="searchbox">
      <span class="icon">⌕</span>
      <input id="search" type="search" placeholder="${site.searchPlaceholder}" autocomplete="off">
      <kbd>/</kbd>
    </div>
    <a class="pdf-link" href="print.html" title="${site.pdfLinkTitle}">${site.pdfLinkText}</a>
${langSwitch}
    <button id="themeBtn" title="${site.themeToggleTitle}">🌙</button>
    <a class="github-link" href="${site.repository}" target="_blank" rel="noopener" aria-label="${site.githubLinkLabel}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
      </svg>
    </a>
  </div>
</header>

<div class="hero">
  <h1>${site.hero.title}</h1>
  <p class="sub">${site.hero.sub}</p>
</div>

<div class="tabs" role="tablist">
${tabs}
</div>

<p id="searchInfo"></p>

<main>
</main>

<footer>
  <div class="links">
${links}
  </div>
  <p>${site.footer.note}</p>
</footer>

<script>window.I18N = ${i18n};</script>
<script src="script.js" defer></script>
</body>
</html>
`;
}

// ---------- print.html(1枚もの印刷用チートシート)のテンプレート ----------
//
// A4 横・多段組の古典的チートシート。画面ではプレビューを兼ね、
// 「PDFとして保存」ボタン(window.print())→ ブラウザの PDF 保存で出力する。
// スタイルは印刷で確実に1ページへ収めるため、この HTML 内に自己完結で持つ
// (docs/style.css には依存しない)。

function renderPrintItem(item) {
  if (typeof item === 'string') {
    return `      <li class="pnote">${item}</li>`;
  }
  if ('git' in item) {
    return `      <li class="pmap"><code class="git">${item.git}</code><span class="arr">→</span><code>${item.jj}</code></li>`;
  }
  const desc = item.desc ? `<span class="pd">${item.desc}</span>` : '';
  return `      <li><code>${item.cmd}</code>${desc}</li>`;
}

function renderPrintGroup(group) {
  return [
    `  <section class="pgroup">`,
    `    <h2>${group.heading}</h2>`,
    `    <ul>`,
    group.items.map(renderPrintItem).join('\n'),
    `    </ul>`,
    `  </section>`,
  ].join('\n');
}

function renderPrint(print, lang, langLabel, langOptions) {
  const groups = print.groups.map(renderPrintGroup).join('\n');
  const langSwitch = renderLangSwitch(langLabel, langOptions);
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${print.title} — ${print.titleSuffix}</title>
<meta name="description" content="${print.subtitle}">
<style>
/* ===== 画面(プレビュー) ===== */
:root{
  --ink:#1a2030; --dim:#5a6377; --faint:#8b93a7;
  --accent:#4f5fd6; --accent2:#0d9488;
  --line:#d7dbe6; --code-bg:#f2f4fa; --code-ink:#233; --paper:#ffffff;
}
*{box-sizing:border-box;margin:0;padding:0}
body{
  background:#e9ecf3;color:var(--ink);
  font-family:"Hiragino Sans","Noto Sans JP",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  line-height:1.35;padding:24px;
}
code{font-family:"SF Mono","JetBrains Mono",Menlo,Consolas,monospace}

.toolbar{
  max-width:1122px;margin:0 auto 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;
}
.toolbar .back{color:var(--accent);text-decoration:none;font-weight:700;font-size:.9rem}
.toolbar .back:hover{text-decoration:underline}
.toolbar .spacer{flex:1}
.toolbar .hint{color:var(--dim);font-size:.8rem}
.toolbar button{
  border:1px solid var(--accent);background:var(--accent);color:#fff;
  border-radius:9px;padding:9px 16px;cursor:pointer;font-size:.9rem;font-weight:700;
}
.toolbar button:hover{background:#3f4fc0}
.toolbar .lang-switch{
  display:flex;align-items:center;gap:4px;border:1px solid var(--line);
  background:var(--paper);border-radius:9px;padding:5px 10px;
}
.toolbar .lang-switch select{
  border:none;background:transparent;color:var(--ink);font-size:.85rem;outline:none;cursor:pointer;
}

/* A4 横 = 297mm × 210mm。画面ではその比率の「紙」を見せる。 */
.sheet{
  width:297mm;min-height:210mm;margin:0 auto;background:var(--paper);
  padding:8mm 9mm;box-shadow:0 6px 30px rgba(20,30,80,.18);
  /* 本文を多段に流し込む。段数は自動で埋まる。 */
}
.sheet-head{
  display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
  border-bottom:2px solid var(--accent);padding-bottom:4px;margin-bottom:6px;
}
.sheet-head .mark{
  font-weight:900;color:#fff;background:linear-gradient(135deg,var(--accent),var(--accent2));
  border-radius:6px;padding:2px 8px;font-size:12pt;letter-spacing:-.5px;
}
.sheet-head h1{font-size:14pt;font-weight:900;letter-spacing:-.01em}
.sheet-head .sub{color:var(--dim);font-size:8pt;flex:1;min-width:120px}
.sheet-head .meta{color:var(--faint);font-size:7pt;text-align:right;line-height:1.3}

.cols{column-count:4;column-gap:6mm;column-fill:balance}

.pgroup{
  break-inside:avoid;-webkit-column-break-inside:avoid;
  margin-bottom:3.5mm;
}
.pgroup h2{
  font-size:8.5pt;font-weight:800;color:var(--accent);
  border-bottom:1px solid var(--line);padding-bottom:1px;margin-bottom:2px;
}
.pgroup ul{list-style:none}
.pgroup li{
  font-size:7pt;line-height:1.28;padding:.6px 0;
  border-bottom:1px dotted #eceef4;
}
.pgroup li:last-child{border-bottom:none}
.pgroup li.pnote{color:var(--dim)}
.pgroup code{
  background:var(--code-bg);color:var(--code-ink);
  padding:.5px 3px;border-radius:3px;font-size:6.7pt;white-space:normal;
}
.pgroup li.pnote code{background:none;padding:0}
.pgroup .pd{display:block;color:var(--dim);font-size:6.6pt;padding-left:2px}
.pgroup li.pmap{display:flex;align-items:center;gap:3px;flex-wrap:wrap}
.pgroup li.pmap .git code,.pgroup li.pmap code.git{color:var(--faint)}
.pgroup li.pmap .arr{color:var(--accent2);font-weight:700}
.pgroup b{color:var(--ink)}

.foot{margin-top:3mm;border-top:1px solid var(--line);padding-top:2px;color:var(--faint);font-size:6.5pt;text-align:center}

/* ===== 印刷(PDF) ===== */
@page{ size:A4 landscape; margin:0; }
@media print{
  body{background:#fff;padding:0}
  .toolbar{display:none}
  .sheet{
    width:auto;min-height:auto;margin:0;box-shadow:none;
    padding:6mm 7mm;
  }
  .cols{column-gap:5mm}
}
</style>
</head>
<body>

<div class="toolbar">
  <a class="back" href="index.html">${print.backLabel}</a>
  <span class="spacer"></span>
  <span class="hint">${print.printHint}</span>
${langSwitch}
  <button type="button" onclick="window.print()">${print.printButton}</button>
</div>

<div class="sheet">
  <div class="sheet-head">
    <span class="mark">jj</span>
    <h1>${print.title}</h1>
    <span class="sub">${print.subtitle}</span>
    <span class="meta">${print.updated}<br>${print.source}</span>
  </div>
  <div class="cols">
${groups}
  </div>
  <div class="foot">${print.subtitle} · ${print.updated}</div>
</div>

</body>
</html>
`;
}

// ---------- 実行 ----------

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ロケール code -> { label, lang } のメタ情報(言語切替 UI 用に全ロケール分必要)。
function readLocaleMeta(locales) {
  return locales.map((code) => {
    const site = readYaml(code, 'site.yaml');
    return { code, label: site.localeLabel || code, lang: site.lang || code };
  });
}

function buildLocale(locale, localeMeta) {
  const site = readYaml(locale, 'site.yaml');
  const dir = outDir(locale);
  mkdirp(dir);
  mkdirp(path.join(dir, 'levels'));

  const langOptionsFor = (filename) =>
    localeMeta.map((m) => ({
      code: m.code,
      label: m.label,
      href: localeHref(locale, m.code, filename),
      current: m.code === locale,
    }));

  // index.html
  fs.writeFileSync(path.join(dir, 'index.html'), renderIndex(site, langOptionsFor('index.html')));

  // print.html(1枚もの印刷用チートシート)
  const print = readYaml(locale, 'print.yaml');
  fs.writeFileSync(
    path.join(dir, 'print.html'),
    renderPrint(print, site.lang, site.langSwitchLabel, langOptionsFor('print.html'))
  );

  // levels/*.html
  site.tabs.forEach((tab) => {
    const level = readYaml(locale, `${tab.file}.yaml`);
    const html = renderLevel(level, tab);
    fs.writeFileSync(path.join(dir, 'levels', `${tab.file}.html`), html);
  });

  // design assets: src -> 各ロケールの出力先(現状はロケール間で共通の1ファイル)
  ['style.css', 'script.js'].forEach((f) => {
    fs.copyFileSync(path.join(SRC, f), path.join(dir, f));
  });
}

function main() {
  mkdirp(DOCS);
  const locales = detectLocales();
  const localeMeta = readLocaleMeta(locales);

  locales.forEach((locale) => buildLocale(locale, localeMeta));

  const outPaths = locales.map((l) => (l === DEFAULT_LOCALE ? 'docs/' : `docs/${l}/`)).join(', ');
  console.log(`built ${locales.length} locale(s) [${locales.join(', ')}] -> ${outPaths}`);
}

main();
