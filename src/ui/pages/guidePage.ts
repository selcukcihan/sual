export function renderGuidePage(): string {
  return `
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
            <button id="share-btn" type="button" class="share-btn" style="display:none"></button>
            <div id="loading-indicator" class="loading-indicator" style="display:none">
              <span class="spinner" aria-hidden="true"></span>
              <span id="loading-text">Analyzing...</span>
            </div>
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
    </section>`;
}
