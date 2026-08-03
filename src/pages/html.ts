/** Minimal HTML escaping for interpolating untrusted/data-sourced strings into templates. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface LayoutOptions {
  /** Right-aligned header content (e.g. the signed-in HRBP's email). Already-escaped HTML, or omitted for the anonymous chrome. */
  headerMeta?: string;
  /** Narrower reading column for single-task pages (the manager form, auth pages). Defaults to the standard content width. */
  narrow?: boolean;
  /** Vertically centers the page content - for short, single-message screens (landing, dev login, errors). */
  centered?: boolean;
}

/**
 * Shared page shell (the "letterhead"): a quiet header carrying only the
 * wordmark and, on authenticated pages, the signed-in HRBP's identity. Every
 * route file supplies its own <h1>/content as `body`; this never varies
 * per-page beyond the options above, so the chrome stays consistent across
 * a session (dashboard -> ideas page) and drops away appropriately on the
 * public, unauthenticated manager form.
 */
export function layout(title: string, body: string, options: LayoutOptions = {}): string {
  const mainClasses = ["site-main", options.narrow && "site-main--narrow", options.centered && "site-main--centered"]
    .filter(Boolean)
    .join(" ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Idea Garden</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2314171c'/%3E%3Ccircle cx='16' cy='16' r='6' fill='%23ececdf'/%3E%3C/svg%3E" />
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
<div class="shell">
  <header class="site-header">
    <div class="site-header__inner">
      <a class="wordmark" href="/">Idea Garden</a>
      ${options.headerMeta ? `<div class="header-meta">${options.headerMeta}</div>` : ""}
    </div>
  </header>
  <main class="${mainClasses}">
${body}
  </main>
</div>
</body>
</html>`;
}

/** A page's opening block: a small teal eyebrow, the h1, and an optional one-line subtitle - used at the top of every substantive page so the reader always knows what they're looking at before the detail underneath. */
export function pageHeader(eyebrow: string, title: string, subtitle?: string): string {
  return `<div class="page-header">
    <p class="eyebrow">${escapeHtml(eyebrow)}</p>
    <h1 class="page-title">${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ""}
  </div>`;
}
