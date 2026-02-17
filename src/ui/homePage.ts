import type { Env } from "../shared/types";
import { renderClientScript } from "./clientScript";
import { UI_I18N } from "./i18n";
import { renderTopBar } from "./layout";
import { renderAboutPage } from "./pages/aboutPage";
import { renderGuidePage } from "./pages/guidePage";
import { HOME_PAGE_STYLES } from "./styles";

export function renderHomePage(env: Env, initialPage: "guide" | "about", requestUrl: string): string {
  const turnstileSiteKey = (env.TURNSTILE_SITE_KEY || "").trim();
  const isProduction = (env.APP_ENV || "").toLowerCase() === "production";
  const allowInsecureLocalBypass = !isProduction && isTruthy(env.ALLOW_INSECURE_LOCAL_BYPASS);
  const turnstileEnabled = Boolean(turnstileSiteKey) && !allowInsecureLocalBypass;
  const title = initialPage === "about" ? "Sual Quran Guide - About" : "Sual Quran Guide";
  const description =
    "Quran-grounded ethical guidance with verse citations, practical steps, and transparent evidence.";
  const currentUrl = new URL(initialPage === "about" ? "/about" : "/", requestUrl).toString();
  const faviconSvg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%231d4ed8'/><text x='32' y='42' text-anchor='middle' font-family='Arial,sans-serif' font-size='36' fill='white'>S</text></svg>";
  const faviconDataUri = `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="index,follow" />
  <meta name="theme-color" content="#1d4ed8" />
  <link rel="canonical" href="${currentUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${currentUrl}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <link rel="icon" href="${faviconDataUri}" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="${faviconDataUri}" />
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
  turnstileEnabled,
  initialPage,
  i18n: UI_I18N,
})}
  </script>
</body>
</html>`;
}

function isTruthy(value: string | undefined): boolean {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
