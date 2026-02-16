import type { Env } from "../shared/types";

export function renderHomePage(env: Env, initialPage: "guide" | "about"): string {
  const turnstileSiteKey = JSON.stringify((env.TURNSTILE_SITE_KEY || "").trim());
  const turnstileConfigured = Boolean((env.TURNSTILE_SITE_KEY || "").trim());
  const initialPageJson = JSON.stringify(initialPage);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sual Quran Guide</title>
  <style>
    :root {
      --bg: #f4f7fb;
      --panel: #ffffff;
      --panel-2: #f8fafc;
      --line: #d9e2ee;
      --text: #1b2735;
      --muted: #627386;
      --accent: #2563eb;
      --chip: #e8f0ff;
      --warn-bg: #fff6df;
      --warn-line: #e6c979;
      --warn-text: #6f4f00;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      color: var(--text);
      background: var(--bg);
      line-height: 1.45;
    }
    .shell {
      max-width: 1140px;
      margin: 0 auto;
      padding: 1rem 1rem 2rem;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }
    .topbar-right {
      display: flex;
      gap: 0.7rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .nav-link {
      color: #36577a;
      text-decoration: none;
      border: 1px solid transparent;
      padding: 0.35rem 0.55rem;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
    }
    .nav-link.active {
      border-color: #bfd0ea;
      background: #eef4ff;
      color: #1f4a96;
    }
    .lang-control {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.82rem;
      color: var(--muted);
    }
    .lang-control select {
      height: 34px;
      padding: 0 0.55rem;
      min-width: 110px;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
      gap: 0.9rem;
      align-items: start;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 1rem;
      margin-bottom: 0.8rem;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    h1 { margin: 0; font-size: 1.25rem; font-weight: 700; }
    .subtitle { margin: 0.35rem 0 0; color: var(--muted); font-size: 0.94rem; }
    .input-row { display: grid; grid-template-columns: 1fr; gap: 0.55rem; margin-bottom: 0.55rem; }
    @media (max-width: 960px) {
      .layout { grid-template-columns: 1fr; }
      .topbar { flex-direction: column; }
    }
    select, textarea, button {
      font: inherit;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: var(--panel-2);
      color: var(--text);
    }
    select, button { height: 40px; padding: 0 0.7rem; }
    textarea {
      width: 100%;
      min-height: 105px;
      padding: 0.7rem;
      resize: vertical;
    }
    button {
      background: var(--accent);
      color: #ffffff;
      border: 0;
      font-weight: 700;
      cursor: pointer;
      margin-top: 0.55rem;
      display: block;
      width: 100%;
      min-height: 40px;
    }
    button:disabled { opacity: 0.7; cursor: wait; }
    .status { margin-top: 0.5rem; color: var(--muted); font-size: 0.85rem; }
    .turnstile-wrap { margin-top: 0.55rem; }
    .section-title {
      margin: 0 0 0.45rem;
      color: #4a5f77;
      font-size: 0.83rem;
      letter-spacing: 0.05em;
      font-weight: 700;
    }
    .answer { margin: 0; font-size: 1rem; }
    .placeholder { margin: 0; color: var(--muted); }
    .chips { display: flex; flex-wrap: wrap; gap: 0.36rem; margin-top: 0.5rem; }
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      border: 1px solid #bfd0ea;
      background: var(--chip);
      color: #1f4a96;
      text-decoration: none;
      font-size: 0.82rem;
    }
    .cards { display: grid; gap: 0.5rem; }
    .card {
      border: 1px solid var(--line);
      background: var(--panel-2);
      border-radius: 10px;
      padding: 0.6rem;
    }
    .card h3 { margin: 0 0 0.3rem; font-size: 0.95rem; }
    .card p { margin: 0; color: #4e6074; font-size: 0.9rem; }
    ol { margin: 0; padding-left: 1.1rem; }
    li { margin: 0.22rem 0; }
    .disclaimer {
      margin-top: 0.7rem;
      padding: 0.5rem 0.6rem;
      border-left: 3px solid var(--warn-line);
      background: var(--warn-bg);
      color: var(--warn-text);
      border-radius: 8px;
      font-size: 0.86rem;
    }
    .evidence-list { display: grid; gap: 0.45rem; }
    .ayah-item { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--panel-2); }
    .ayah-summary {
      list-style: none;
      cursor: pointer;
      padding: 0.5rem 0.6rem;
      display: flex;
      justify-content: space-between;
      gap: 0.4rem;
    }
    .ayah-summary::-webkit-details-marker { display: none; }
    .ayah-ref { font-size: 0.82rem; color: #2a5db2; font-weight: 700; }
    .ayah-preview { margin: 0.17rem 0 0; color: var(--muted); font-size: 0.84rem; }
    .ayah-body { border-top: 1px solid var(--line); padding: 0.55rem 0.6rem; }
    .ayah-text { margin: 0 0 0.48rem; color: #34495e; font-size: 0.9rem; }
    .expand-hint { color: var(--muted); font-size: 0.78rem; }
    .debug {
      margin-top: 0.7rem;
      font-size: 0.76rem;
      color: #4f6376;
      background: #f2f6fb;
      border: 1px dashed #b9cbe2;
      border-radius: 8px;
      padding: 0.5rem;
      max-height: 110px;
      overflow: auto;
    }
    .about-copy p {
      margin: 0 0 0.7rem;
      color: #4e6074;
      max-width: 72ch;
    }
    [hidden] { display: none !important; }
  </style>
</head>
<body>
  <main class="shell">
    <section class="panel topbar">
      <div>
        <h1 id="title">Sual Quran Guide</h1>
        <p class="subtitle" id="subtitle">Describe a real situation. You will get concise guidance with cited ayah references.</p>
      </div>
      <div class="topbar-right">
        <a id="nav-guide" class="nav-link" href="/">Guide</a>
        <a id="nav-about" class="nav-link" href="/about">About</a>
        <label class="lang-control">
          <span id="lang-label">Language</span>
          <select id="lang-global">
            <option value="en">English</option>
            <option value="tr">Türkçe</option>
          </select>
        </label>
      </div>
    </section>

    <section id="page-guide">
      <div class="layout">
        <div>
          <section class="panel">
            <p class="section-title" id="label-situation">Situation</p>
            <form id="ask-form">
              <div class="input-row">
                <textarea id="q" placeholder=""></textarea>
              </div>
              <div class="turnstile-wrap" id="turnstile-wrap"></div>
              <button id="submit" type="submit">Get Guidance</button>
            </form>
            <div class="status" id="status"></div>
          </section>

          <section class="panel">
            <p class="section-title" id="label-guidance">GUIDANCE</p>
            <p class="placeholder" id="placeholder">Response will appear here.</p>
            <p class="answer" id="answer" style="display:none"></p>
            <div class="chips" id="top-citations"></div>
          </section>

          <section class="panel">
            <p class="section-title" id="label-actions">PRACTICAL STEPS</p>
            <ol id="actions"></ol>
            <div id="disclaimer" class="disclaimer" style="display:none"></div>
            <pre id="debug" class="debug" style="display:none"></pre>
          </section>
        </div>

        <div>
          <section class="panel">
            <p class="section-title" id="label-principles">PRINCIPLES</p>
            <div id="principles" class="cards"></div>
          </section>

          <section class="panel">
            <p class="section-title" id="label-evidence">EVIDENCE</p>
            <div id="evidence" class="evidence-list"></div>
          </section>
        </div>
      </div>
    </section>

    <section id="page-about" hidden>
      <section class="panel">
        <p class="section-title" id="about-title">ABOUT</p>
        <div class="about-copy">
          <p id="about-p1"></p>
          <p id="about-source"></p>
          <p id="about-tanzil"></p>
          <p id="about-p2"></p>
          <p id="about-p3"></p>
          <p id="about-p4"></p>
          <p id="about-p5"></p>
          <p id="about-p6"></p>
          <p id="about-p7"></p>
        </div>
      </section>
    </section>
  </main>

  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
  <script>
    const TURNSTILE_SITE_KEY = ${turnstileSiteKey};
    const TURNSTILE_ENABLED = ${turnstileConfigured ? "true" : "false"};
    const INITIAL_PAGE = ${initialPageJson};
    const LANG_KEY = 'sual.lang';
    let turnstileWidgetId = null;
    const form = document.getElementById('ask-form');
    const submit = document.getElementById('submit');
    const q = document.getElementById('q');
    const lang = document.getElementById('lang-global');
    const statusEl = document.getElementById('status');
    const placeholder = document.getElementById('placeholder');
    const answer = document.getElementById('answer');
    const topCitations = document.getElementById('top-citations');
    const principles = document.getElementById('principles');
    const evidence = document.getElementById('evidence');
    const actions = document.getElementById('actions');
    const disclaimer = document.getElementById('disclaimer');
    const debug = document.getElementById('debug');
    const title = document.getElementById('title');
    const subtitle = document.getElementById('subtitle');
    const labelSituation = document.getElementById('label-situation');
    const labelGuidance = document.getElementById('label-guidance');
    const labelPrinciples = document.getElementById('label-principles');
    const labelEvidence = document.getElementById('label-evidence');
    const labelActions = document.getElementById('label-actions');
    const labelLang = document.getElementById('lang-label');
    const navGuide = document.getElementById('nav-guide');
    const navAbout = document.getElementById('nav-about');
    const pageGuide = document.getElementById('page-guide');
    const pageAbout = document.getElementById('page-about');
    const aboutTitle = document.getElementById('about-title');
    const aboutSource = document.getElementById('about-source');
    const aboutTanzil = document.getElementById('about-tanzil');
    const aboutP1 = document.getElementById('about-p1');
    const aboutP2 = document.getElementById('about-p2');
    const aboutP3 = document.getElementById('about-p3');
    const aboutP4 = document.getElementById('about-p4');
    const aboutP5 = document.getElementById('about-p5');
    const aboutP6 = document.getElementById('about-p6');
    const aboutP7 = document.getElementById('about-p7');
    const turnstileWrap = document.getElementById('turnstile-wrap');
    const QURAN_SOURCE_URL = 'https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/quran_en.json';
    const TANZIL_URL = 'https://tanzil.net';

    const I18N = {
      en: {
        title: 'Sual Quran Guide',
        subtitle: 'Describe a real situation. You will get concise guidance with cited ayah references.',
        navGuide: 'Guide',
        navAbout: 'About',
        langLabel: 'Language',
        situation: 'Situation',
        guidance: 'GUIDANCE',
        principles: 'PRINCIPLES',
        actions: 'PRACTICAL STEPS',
        evidence: 'EVIDENCE',
        about: 'ABOUT',
        aboutP1: 'Sual is an ethical reflection assistant that uses Quran verse translations to help you think through real-life situations.',
        aboutSourceLabel: 'Primary translation file used in this app',
        sourceLinkText: 'Open source file',
        tanzilLabel: 'Verse references are linked to Tanzil for reading and verification',
        tanzilLinkText: 'Open Tanzil',
        aboutP2: 'Data source: Quran translations are imported into a local database (Cloudflare D1/SQLite). The app stores verse text and references like Surah:Ayah.',
        aboutP3: 'When you ask a question, the app searches that local verse database for relevant ayat using keyword and full-text matching.',
        aboutP4: 'Then it reorders the matches so the most relevant verses appear first. Those references are shown in the UI and link out to Tanzil for transparency.',
        aboutP5: 'If an OpenAI API key is configured, an LLM is used to turn those retrieved verses into a short, practical guidance response.',
        aboutP6: 'Important: the model is instructed to use only the retrieved verses as evidence. Citations are validated so unsupported references are rejected.',
        aboutP7: 'If no LLM key is configured or the model response is invalid, the app falls back to a simpler rule-based response. This is guidance support, not a fatwa.',
        evidenceEmpty: 'No verses to display yet.',
        placeholder: 'Response will appear here.',
        ask: 'Get Guidance',
        ready: 'Ready',
        analyzing: 'Analyzing...',
        empty: 'Please enter a question.',
        captchaMissing: 'Please complete the security check.',
        done: 'Done',
        qPlaceholder: 'Example: I am angry with my sibling. I want to respond without making things worse.',
        open: 'Open',
        tanzil: 'Open on Tanzil'
      },
      tr: {
        title: 'Sual Kuran Rehberi',
        subtitle: 'Gerçek bir durum yazın. Ayet atıflarıyla kısa ve uygulanabilir rehberlik alın.',
        navGuide: 'Rehber',
        navAbout: 'Hakkında',
        langLabel: 'Dil',
        situation: 'Durum',
        guidance: 'REHBERLİK',
        principles: 'İLKELER',
        actions: 'PRATİK ADIMLAR',
        evidence: 'DELİLLER',
        about: 'HAKKINDA',
        aboutP1: "Sual, gerçek hayat durumlarını düşünmenize yardımcı olmak için Kur'an ayet çevirilerini kullanan bir etik düşünme yardımcısıdır.",
        aboutSourceLabel: 'Bu uygulamada kullanılan birincil çeviri dosyası',
        sourceLinkText: 'Kaynak dosyayı aç',
        tanzilLabel: 'Ayet referansları okuma ve doğrulama için Tanzil ile bağlantılıdır',
        tanzilLinkText: "Tanzil'i Aç",
        aboutP2: "Veri kaynağı: Kur'an çevirileri yerel bir veritabanına (Cloudflare D1/SQLite) aktarılır. Uygulama ayet metnini ve sure:ayet bilgisini saklar.",
        aboutP3: 'Soru gönderdiğinizde uygulama bu yerel veritabanında anahtar kelime ve tam metin aramasıyla ilgili ayetleri bulur.',
        aboutP4: 'Sonra sonuçları ilgililik düzeyine göre yeniden sıralar. Şeffaflık için bu referanslar arayüzde gösterilir ve Tanzil bağlantısı verilir.',
        aboutP5: 'OpenAI anahtarı varsa, LLM bu ayetlerden kısa ve uygulanabilir bir rehberlik metni üretmek için kullanılır.',
        aboutP6: 'Önemli nokta: modele sadece getirilen ayetleri delil olarak kullanması söylenir. Desteksiz referanslar doğrulama sırasında reddedilir.',
        aboutP7: 'LLM anahtarı yoksa veya model çıktısı geçersizse, uygulama daha basit kural tabanlı yanıta döner. Bu bir rehberlik desteğidir, fetva değildir.',
        evidenceEmpty: 'Henüz gösterilecek ayet yok.',
        placeholder: 'Yanıt burada görünecek.',
        ask: 'Rehberlik Al',
        ready: 'Hazır',
        analyzing: 'Analiz ediliyor...',
        empty: 'Lütfen bir soru girin.',
        captchaMissing: 'Lütfen güvenlik doğrulamasını tamamlayın.',
        done: 'Tamamlandı',
        qPlaceholder: 'Örnek: Kardeşime öfkeliyim. Durumu daha da kötüleştirmeden nasıl cevap verebilirim?',
        open: 'Aç',
        tanzil: "Tanzil'de Aç"
      }
    };

    function normalizeLang(value) {
      return value === 'tr' ? 'tr' : 'en';
    }

    function locale() {
      return normalizeLang((lang.value || '').toLowerCase());
    }

    function t() {
      return I18N[locale()];
    }

    function applyLocale() {
      const v = t();
      document.documentElement.lang = locale();
      title.textContent = v.title;
      subtitle.textContent = v.subtitle;
      navGuide.textContent = v.navGuide;
      navAbout.textContent = v.navAbout;
      labelLang.textContent = v.langLabel;
      labelSituation.textContent = v.situation;
      labelGuidance.textContent = v.guidance;
      labelPrinciples.textContent = v.principles;
      labelEvidence.textContent = v.evidence;
      labelActions.textContent = v.actions;
      aboutTitle.textContent = v.about;
      aboutSource.innerHTML = v.aboutSourceLabel + ': ' +
        '<a class="chip" href="' + QURAN_SOURCE_URL + '" target="_blank" rel="noopener noreferrer">' + v.sourceLinkText + '</a>';
      aboutTanzil.innerHTML = v.tanzilLabel + ': ' +
        '<a class="chip" href="' + TANZIL_URL + '" target="_blank" rel="noopener noreferrer">' + v.tanzilLinkText + '</a>';
      aboutP1.textContent = v.aboutP1;
      aboutP2.textContent = v.aboutP2;
      aboutP3.textContent = v.aboutP3;
      aboutP4.textContent = v.aboutP4;
      aboutP5.textContent = v.aboutP5;
      aboutP6.textContent = v.aboutP6;
      aboutP7.textContent = v.aboutP7;
      placeholder.textContent = v.placeholder;
      submit.textContent = v.ask;
      q.placeholder = v.qPlaceholder;
      statusEl.textContent = v.ready;
    }

    function saveLangPreference(value) {
      try {
        localStorage.setItem(LANG_KEY, value);
      } catch {}
    }

    function readLangPreference() {
      try {
        const raw = localStorage.getItem(LANG_KEY);
        if (raw === 'en' || raw === 'tr') return raw;
      } catch {}
      return null;
    }

    function setLanguage(value, persist) {
      const next = normalizeLang((value || '').toLowerCase());
      if (lang.value !== next) {
        lang.value = next;
      }
      if (persist) {
        saveLangPreference(next);
      }
      applyLocale();
    }

    function setPage(page, pushHistory) {
      const isAbout = page === 'about';
      pageGuide.hidden = isAbout;
      pageAbout.hidden = !isAbout;
      navGuide.classList.toggle('active', !isAbout);
      navAbout.classList.toggle('active', isAbout);
      if (pushHistory) {
        history.pushState({}, '', isAbout ? '/about' : '/');
      }
    }

    function tanzilUrl(ref) {
      return 'https://tanzil.net/#' + ref;
    }

    function setupTurnstile() {
      if (!TURNSTILE_ENABLED) {
        turnstileWrap.innerHTML = '';
        return;
      }
      if (!TURNSTILE_SITE_KEY) {
        turnstileWrap.innerHTML = '';
        return;
      }
      if (!window.turnstile || typeof window.turnstile.render !== 'function') {
        setTimeout(setupTurnstile, 120);
        return;
      }
      if (turnstileWidgetId !== null) {
        return;
      }
      turnstileWidgetId = window.turnstile.render('#turnstile-wrap', {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light'
      });
    }

    function citationChip(ref) {
      return '<a class="chip" href="' + tanzilUrl(ref) + '" target="_blank" rel="noopener noreferrer">' + ref + '</a>';
    }

    function escapeHtml(text) {
      return String(text || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function renderResult(data) {
      placeholder.style.display = 'none';
      answer.style.display = 'block';
      answer.textContent = data.answer || '';

      const refs = Array.isArray(data.citations) ? data.citations.slice(0, 10) : [];
      topCitations.innerHTML = refs.map(citationChip).join('');

      const principleRows = Array.isArray(data.principles) ? data.principles : [];
      principles.innerHTML = principleRows.map((p) => {
        const chips = (Array.isArray(p.citations) ? p.citations : []).map(citationChip).join('');
        return '<div class="card">' +
          '<h3>' + escapeHtml(p.name || 'Principle') + '</h3>' +
          '<p>' + escapeHtml(p.explanation || '') + '</p>' +
          '<div class="chips">' + chips + '</div>' +
          '</div>';
      }).join('');

      const actionRows = Array.isArray(data.actions) ? data.actions : [];
      actions.innerHTML = actionRows.map((a) => '<li>' + escapeHtml(a) + '</li>').join('');

      disclaimer.style.display = data.disclaimer ? 'block' : 'none';
      disclaimer.textContent = data.disclaimer || '';

      const evidenceRows = Array.isArray(data.retrieved) ? data.retrieved.slice(0, 8) : [];
      evidence.innerHTML = evidenceRows.map((row) => {
        const ref = row.surah + ':' + row.ayah;
        const full = escapeHtml(row.text_en || '');
        const preview = full.length > 125 ? full.slice(0, 122) + '...' : full;
        return '<details class="ayah-item">' +
          '<summary class="ayah-summary">' +
          '<div><div class="ayah-ref">' + ref + '</div><p class="ayah-preview">' + preview + '</p></div>' +
          '<span class="expand-hint">' + t().open + '</span>' +
          '</summary>' +
          '<div class="ayah-body">' +
          '<p class="ayah-text">' + full + '</p>' +
          '<a class="chip" href="' + tanzilUrl(ref) + '" target="_blank" rel="noopener noreferrer">' + t().tanzil + '</a>' +
          '</div>' +
          '</details>';
      }).join('');
      if (evidenceRows.length === 0) {
        evidence.innerHTML = '<p class="placeholder">' + t().evidenceEmpty + '</p>';
      }

      if (data.meta && (data.meta.llm_used === false || data.meta.llm_error)) {
        debug.style.display = 'block';
        debug.textContent = 'meta: ' + JSON.stringify(data.meta, null, 2);
      } else {
        debug.style.display = 'none';
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = q.value.trim();
      if (!question) {
        statusEl.textContent = t().empty;
        return;
      }

      submit.disabled = true;
      statusEl.textContent = t().analyzing;

      try {
        let turnstileToken = '';
        if (TURNSTILE_ENABLED) {
          if (!window.turnstile || turnstileWidgetId === null) {
            statusEl.textContent = t().captchaMissing;
            submit.disabled = false;
            return;
          }
          turnstileToken = window.turnstile.getResponse(turnstileWidgetId) || '';
          if (!turnstileToken) {
            statusEl.textContent = t().captchaMissing;
            submit.disabled = false;
            return;
          }
        }

        const resp = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question, lang: locale(), turnstileToken })
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data && data.error ? data.error : ('HTTP ' + resp.status));
        }
        renderResult(data);
        statusEl.textContent = t().done;
      } catch (err) {
        statusEl.textContent = 'Request failed: ' + (err && err.message ? err.message : String(err));
      } finally {
        if (TURNSTILE_ENABLED && window.turnstile && turnstileWidgetId !== null) {
          window.turnstile.reset(turnstileWidgetId);
        }
        submit.disabled = false;
      }
    });

    navGuide.addEventListener('click', (e) => {
      e.preventDefault();
      setPage('guide', true);
    });
    navAbout.addEventListener('click', (e) => {
      e.preventDefault();
      setPage('about', true);
    });
    window.addEventListener('popstate', () => {
      setPage(location.pathname === '/about' ? 'about' : 'guide', false);
    });

    const storedLang = readLangPreference();
    setLanguage(storedLang || 'tr', false);
    lang.addEventListener('change', () => setLanguage(lang.value, true));
    lang.addEventListener('input', () => setLanguage(lang.value, true));

    setPage(INITIAL_PAGE === 'about' ? 'about' : 'guide', false);
    setupTurnstile();
  </script>
</body>
</html>`;
}
