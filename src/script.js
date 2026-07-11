(function(){
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const store={
    get(k){try{return localStorage.getItem(k)}catch(e){return null}},
    set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  };

  /* ----- i18n: build.js が window.I18N として埋め込む実行時 UI 文字列。
     未設定(=読み込まれていない)場合は従来どおりの日本語にフォールバックする。 */
  const I18N=Object.assign({
    copyTitle:'コピー',copyIcon:'⧉',copyDone:'✓',
    loadError:'レベル別コンテンツの読み込みに失敗しました',
    searchResultsTemplate:'「{q}」の検索結果: {n} 件(全レベル横断)',
    searchNoResultsTemplate:'「{q}」に一致する項目がありません'
  },window.I18N||{});
  function fmt(tpl,vars){return tpl.replace(/\{(\w+)\}/g,(_,k)=>vars[k])}

  const LEVEL_FILES=['levels/beginner.html','levels/intermediate.html','levels/advanced.html'];

  /* ----- theme (doesn't depend on level fragments) ----- */
  const root=document.documentElement, themeBtn=$('#themeBtn');
  function applyTheme(t){root.dataset.theme=t;themeBtn.textContent=t==='dark'?'🌙':'☀️'}
  applyTheme(store.get('jj-theme')||'dark');
  themeBtn.addEventListener('click',()=>{const t=root.dataset.theme==='dark'?'light':'dark';applyTheme(t);store.set('jj-theme',t)});

  /* ----- load level fragments into <main>, then wire up the rest ----- */
  Promise.all(LEVEL_FILES.map(f=>fetch(f).then(r=>r.text())))
    .then(htmls=>{
      $('main').innerHTML=htmls.join('\n');
      initLevels();
    })
    .catch(err=>{
      console.error(I18N.loadError, err);
    });

  function initLevels(){
    /* ----- level tabs ----- */
    function setLevel(l){
      $$('.tab').forEach(b=>b.setAttribute('aria-selected',b.dataset.level===l));
      $$('section.level').forEach(s=>s.classList.toggle('active',s.dataset.level===l));
      store.set('jj-level',l);
    }
    $$('.tab').forEach(b=>b.addEventListener('click',()=>{clearSearch();setLevel(b.dataset.level)}));
    setLevel(store.get('jj-level')||'1');

    /* ----- copy buttons ----- */
    $$('.cmd').forEach(c=>{
      const b=document.createElement('button');
      b.className='copy';b.textContent=I18N.copyIcon;b.title=I18N.copyTitle;
      b.addEventListener('click',()=>{
        const raw=[...c.querySelectorAll('code')].map(x=>x.textContent).join('\n');
        const txt=raw.split('\n').filter(l=>!/^\s*#/.test(l)).join('\n').trim();
        (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{
          b.textContent=I18N.copyDone;b.classList.add('ok');
          setTimeout(()=>{b.textContent=I18N.copyIcon;b.classList.remove('ok')},1200);
        }).catch(()=>{});
      });
      c.appendChild(b);
    });

    /* ----- search ----- */
    const input=$('#search'), info=$('#searchInfo');
    const items=$$('.card, ol.steps>li, table.compare tbody tr');
    function clearSearch(){
      if(!input.value)return;
      input.value='';runSearch('');
    }
    function runSearch(qRaw){
      const q=qRaw.trim().toLowerCase();
      if(!q){
        items.forEach(el=>el.classList.remove('hidden'));
        $$('section.level').forEach(s=>s.classList.toggle('active',s.dataset.level===(store.get('jj-level')||'1')));
        $$('.sec-h,.level-head,.grid,ol.steps,.tbl-scroll').forEach(el=>el.classList.remove('hidden'));
        info.style.display='none';
        return;
      }
      let hits=0;
      $$('section.level').forEach(s=>s.classList.add('active'));
      items.forEach(el=>{
        const hay=(el.textContent+' '+(el.dataset.tags||'')).toLowerCase();
        const hit=hay.includes(q);
        el.classList.toggle('hidden',!hit);
        if(hit)hits++;
      });
      // hide empty containers & their headers
      $$('.grid,ol.steps').forEach(g=>{
        const any=[...g.children].some(c=>!c.classList.contains('hidden'));
        g.classList.toggle('hidden',!any);
      });
      $$('.tbl-scroll').forEach(t=>{
        const any=[...t.querySelectorAll('tbody tr')].some(r=>!r.classList.contains('hidden'));
        t.classList.toggle('hidden',!any);
      });
      $$('.sec-h').forEach(h=>{
        let sib=h.nextElementSibling,any=false;
        while(sib&&!sib.classList.contains('sec-h')&&!sib.classList.contains('level-head')){
          if(!sib.classList.contains('hidden')&&(sib.matches('.grid,ol.steps,.tbl-scroll,.card')||sib.querySelector&&sib.querySelector('.card:not(.hidden),li:not(.hidden),tr:not(.hidden)')))any=true;
          sib=sib.nextElementSibling;
        }
        h.classList.toggle('hidden',!any);
      });
      $$('.level-head').forEach(el=>el.classList.add('hidden'));
      info.style.display='block';
      info.textContent=hits
        ?fmt(I18N.searchResultsTemplate,{q:qRaw,n:hits})
        :fmt(I18N.searchNoResultsTemplate,{q:qRaw});
    }
    input.addEventListener('input',()=>runSearch(input.value));
    document.addEventListener('keydown',e=>{
      if(e.key==='/'&&document.activeElement!==input){e.preventDefault();input.focus()}
      if(e.key==='Escape'&&document.activeElement===input){clearSearch();input.blur()}
    });
  }
})();
