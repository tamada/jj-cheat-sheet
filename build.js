#!/usr/bin/env node
/*
 * build.js — データ(data/*.yaml)+ デザイン(このファイルのテンプレート & src/)
 * から公開物 docs/ を生成する、依存最小のビルドスクリプト。
 *
 *   data/site.yaml            サイト全体の設定・ヘッダ・タブ・フッター
 *   data/{beginner,...}.yaml  レベル別コンテンツ(card / steps / compare / level-head)
 *   src/style.css, src/script.js  デザイン資産(原本)。docs/ へコピーされる。
 *
 * 生成物:
 *   docs/index.html
 *   docs/levels/{beginner,intermediate,advanced}.html
 *   docs/style.css, docs/script.js
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

function readYaml(file) {
  return yaml.load(fs.readFileSync(path.join(DATA, file), 'utf8'));
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

function renderIndex(site) {
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

  return `<!DOCTYPE html>
<html lang="${site.lang}" data-theme="${site.defaultTheme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${site.title}</title>
<meta name="description" content="${site.description}">
<link rel="stylesheet" href="style.css">
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
    <button id="themeBtn" title="テーマ切替">🌙</button>
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

<script src="script.js" defer></script>
</body>
</html>
`;
}

// ---------- 実行 ----------

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const site = readYaml('site.yaml');

  mkdirp(DOCS);
  mkdirp(path.join(DOCS, 'levels'));

  // index.html
  fs.writeFileSync(path.join(DOCS, 'index.html'), renderIndex(site));

  // levels/*.html
  site.tabs.forEach((tab) => {
    const level = readYaml(`${tab.file}.yaml`);
    const html = renderLevel(level, tab);
    fs.writeFileSync(path.join(DOCS, 'levels', `${tab.file}.html`), html);
  });

  // design assets: src -> docs
  ['style.css', 'script.js'].forEach((f) => {
    fs.copyFileSync(path.join(SRC, f), path.join(DOCS, f));
  });

  console.log('built: docs/index.html, docs/levels/*.html, docs/style.css, docs/script.js');
}

main();
