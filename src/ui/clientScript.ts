import type { UiI18nMap } from "./i18n/types";

export type ClientScriptParams = {
  turnstileSiteKey: string;
  turnstileEnabled: boolean;
  initialPage: "guide" | "about";
  i18n: UiI18nMap;
};

export function renderClientScript(params: ClientScriptParams): string {
  const turnstileSiteKeyJson = JSON.stringify(params.turnstileSiteKey);
  const turnstileEnabledJson = params.turnstileEnabled ? "true" : "false";
  const initialPageJson = JSON.stringify(params.initialPage);
  const i18nJson = JSON.stringify(params.i18n);

  return `
    const TURNSTILE_SITE_KEY = ${turnstileSiteKeyJson};
    const TURNSTILE_ENABLED = ${turnstileEnabledJson};
    const INITIAL_PAGE = ${initialPageJson};
    const I18N = ${i18nJson};
    const LANG_KEY = 'sual.lang';
    let turnstileWidgetId = null;
    let turnstileScriptPromise = null;
    let currentQueryId = '';
    const form = document.getElementById('ask-form');
    const submit = document.getElementById('submit');
    const shareBtn = document.getElementById('share-btn');
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
    const aboutRepo = document.getElementById('about-repo');
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
    const GITHUB_REPO_URL = 'https://github.com/selcukcihan/sual';

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
      aboutRepo.innerHTML = v.aboutRepoLabel + ': ' +
        '<a class="chip" href="' + GITHUB_REPO_URL + '" target="_blank" rel="noopener noreferrer">' + v.aboutRepoLinkText + '</a>';
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
      shareBtn.textContent = v.share;
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
      if (!isAbout) {
        void setupTurnstile();
      }
      if (pushHistory) {
        history.pushState({}, '', isAbout ? '/about' : '/');
      }
    }

    function tanzilUrl(ref) {
      return 'https://tanzil.net/#' + ref;
    }

    function permalinkForQuery(id) {
      return location.origin + '/q/' + id;
    }

    function setCurrentQueryId(value) {
      currentQueryId = typeof value === 'string' ? value : '';
      shareBtn.style.display = currentQueryId ? 'inline-flex' : 'none';
    }

    function loadTurnstileScript() {
      if (!TURNSTILE_ENABLED || !TURNSTILE_SITE_KEY) {
        return Promise.resolve(false);
      }
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        return Promise.resolve(true);
      }
      if (turnstileScriptPromise) {
        return turnstileScriptPromise;
      }
      turnstileScriptPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });
      return turnstileScriptPromise;
    }

    async function setupTurnstile() {
      if (!TURNSTILE_ENABLED) {
        turnstileWrap.innerHTML = '';
        return;
      }
      if (!TURNSTILE_SITE_KEY) {
        turnstileWrap.innerHTML = '';
        return;
      }
      const loaded = await loadTurnstileScript();
      if (!loaded || !window.turnstile || typeof window.turnstile.render !== 'function') {
        return;
      }
      if (turnstileWidgetId !== null) {
        return;
      }
      turnstileWidgetId = window.turnstile.render('#turnstile-wrap', {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
        action: 'ask_guidance'
      });
    }

    function readTurnstileToken() {
      if (!window.turnstile) return '';
      try {
        if (turnstileWidgetId !== null && turnstileWidgetId !== undefined) {
          return window.turnstile.getResponse(turnstileWidgetId) || '';
        }
      } catch {}
      return '';
    }

    function resetTurnstileWidget() {
      if (!window.turnstile) return;
      try {
        if (turnstileWidgetId !== null && turnstileWidgetId !== undefined) {
          window.turnstile.reset(turnstileWidgetId);
        }
      } catch {}
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
      setCurrentQueryId(typeof data.query_id === 'string' ? data.query_id : '');

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
        setCurrentQueryId('');
        let turnstileToken = '';
        if (TURNSTILE_ENABLED) {
          await setupTurnstile();
          if (!window.turnstile || turnstileWidgetId === null) {
            statusEl.textContent = t().captchaMissing;
            submit.disabled = false;
            return;
          }
          turnstileToken = readTurnstileToken();
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
        if (TURNSTILE_ENABLED && resp.status === 400 && data && typeof data.error === 'string' && data.error.toLowerCase().includes('turnstile')) {
          resetTurnstileWidget();
        }
        if (TURNSTILE_ENABLED && resp.status === 403 && data && typeof data.error === 'string' && data.error.toLowerCase().includes('turnstile')) {
          resetTurnstileWidget();
        }
        if (!resp.ok) {
          throw new Error(data && data.error ? data.error : ('HTTP ' + resp.status));
        }
        renderResult(data);
        statusEl.textContent = t().done;
      } catch (err) {
        statusEl.textContent = 'Request failed: ' + (err && err.message ? err.message : String(err));
      } finally {
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

    shareBtn.addEventListener('click', async () => {
      if (!currentQueryId) return;
      const link = permalinkForQuery(currentQueryId);
      try {
        await navigator.clipboard.writeText(link);
        statusEl.textContent = t().linkCopied;
      } catch {
        statusEl.textContent = link;
      }
    });

    async function loadSharedQueryIfPresent() {
      const match = location.pathname.match(/^\\/q\\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
      if (!match) return;

      const queryId = match[1];
      statusEl.textContent = t().analyzing;
      try {
        const resp = await fetch('/api/query/' + queryId);
        const data = await resp.json();
        if (!resp.ok || !data || typeof data !== 'object' || !data.payload) {
          throw new Error('invalid shared query response');
        }

        if (data.lang === 'en' || data.lang === 'tr') {
          setLanguage(data.lang, false);
        }
        if (typeof data.question === 'string') {
          q.value = data.question;
        }
        renderResult(data.payload);
        setCurrentQueryId(queryId);
        statusEl.textContent = t().done;
      } catch {
        statusEl.textContent = t().sharedLoadFailed;
      }
    }

    setPage(INITIAL_PAGE === 'about' ? 'about' : 'guide', false);
    loadSharedQueryIfPresent();
  `;
}
