export const HOME_PAGE_STYLES = `
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
    [hidden] { display: none !important; }`;
