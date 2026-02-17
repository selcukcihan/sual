import { HOME_CSP, HTML_HEADERS, SECURITY_HEADERS } from "./shared/constants";
import { handleAsk } from "./handlers/ask";
import { ensureAnonIdentity } from "./identity";
import { json } from "./shared/http";
import type { Env } from "./shared/types";
import { renderHomePage } from "./ui/homePage";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/robots.txt") {
      return new Response(buildRobotsTxt(url.origin), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=3600",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/sitemap.xml") {
      return new Response(buildSitemapXml(url.origin), {
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=3600",
        },
      });
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/about")) {
      const initialPage = url.pathname === "/about" ? "about" : "guide";
      const identity = await ensureAnonIdentity(request, env);
      return new Response(renderHomePage(env, initialPage, request.url), {
        headers: {
          ...HTML_HEADERS,
          ...SECURITY_HEADERS,
          "content-security-policy": HOME_CSP,
          ...(identity.setCookie ? { "set-cookie": identity.setCookie } : {}),
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/api/ask") {
      return handleAsk(request, env);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, date: "2026-02-16" });
    }

    return json({ error: "Not found" }, 404);
  },
};

function buildRobotsTxt(origin: string): string {
  return ["User-agent: *", "Allow: /", `Sitemap: ${origin}/sitemap.xml`].join("\n");
}

function buildSitemapXml(origin: string): string {
  const now = new Date().toISOString();
  const urls = [
    { loc: `${origin}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${origin}/about`, changefreq: "monthly", priority: "0.6" },
  ];

  const items = urls
    .map(
      (item) => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
