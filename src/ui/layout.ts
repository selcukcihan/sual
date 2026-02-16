export function renderTopBar(): string {
  return `
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
    </section>`;
}
