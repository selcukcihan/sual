import { HOME_CSP, HTML_HEADERS, SECURITY_HEADERS } from "./shared/constants";
import { handleAsk } from "./handlers/ask";
import { ensureAnonIdentity } from "./identity";
import { json } from "./shared/http";
import type { Env } from "./shared/types";
import { renderHomePage } from "./ui/homePage";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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
