import type { Env } from "../shared/types";
import { renderClientScript } from "./clientScript";
import { UI_I18N } from "./i18n";
import { renderTopBar } from "./layout";
import { renderAboutPage } from "./pages/aboutPage";
import { renderGuidePage } from "./pages/guidePage";
import { HOME_PAGE_STYLES } from "./styles";

export function renderHomePage(env: Env, initialPage: "guide" | "about"): string {
  const turnstileSiteKey = (env.TURNSTILE_SITE_KEY || "").trim();
  const turnstileConfigured = Boolean(turnstileSiteKey);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sual Quran Guide</title>
  <style>${HOME_PAGE_STYLES}
  </style>
</head>
<body>
  <main class="shell">
${renderTopBar()}
${renderGuidePage()}
${renderAboutPage()}
  </main>

  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
  <script>
${renderClientScript({
  turnstileSiteKey,
  turnstileEnabled: turnstileConfigured,
  initialPage,
  i18n: UI_I18N,
})}
  </script>
</body>
</html>`;
}
