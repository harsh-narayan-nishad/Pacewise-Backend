/**
 * Shared look for Pacewise e-mails. It follows the web app's light theme: warm off-white canvas, near-black ink,
 * muted grey secondary text, hairline borders, light-weight display type with tight tracking, pill buttons.
 * E-mail clients ignore web fonts and CSS variables, so values are inlined and the font stack falls back to the
 * system UI font (Inter / SF / Segoe), which is also what the app falls back to.
 */
export const COLORS = {
  canvas: "#FBFBFA", raised: "#F2F2F0", ink: "#16171A", muted: "#606269", faint: "#94969D", line: "#E4E4E0", white: "#FFFFFF",
  strong: "#1F7A4D", strongBg: "#E6F3EC", medium: "#9A6700", mediumBg: "#FBF1DC", weak: "#B3362B", weakBg: "#FBE8E6",
} as const;

export const FONT = "'PP Neue Montreal','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
export const MONO = "'JetBrains Mono','SF Mono',Menlo,Consolas,monospace";

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** Wraps content in the standard frame: wordmark on top, quiet footer below. `preheader` is the grey preview line in inboxes. */
export function layout(opts: { preheader: string; body: string; footer?: string; width?: number }): string {
  const w = opts.width ?? 520;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Pacewise</title></head>
<body style="margin:0;padding:0;background:${COLORS.canvas};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLORS.canvas}">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.canvas}"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${w}px;font-family:${FONT};color:${COLORS.ink}">
<tr><td style="padding:0 4px 28px;font-size:20px;font-weight:500;letter-spacing:-0.02em;color:${COLORS.ink}">Pacewise</td></tr>
<tr><td>${opts.body}</td></tr>
<tr><td style="padding:28px 4px 0;font-size:12px;line-height:18px;color:${COLORS.faint}">${opts.footer ?? "Pacewise &middot; Read at the speed of thought."}</td></tr>
</table></td></tr></table></body></html>`;
}

/** A pill button (the app's primary button: dark fill, light text). */
export function button(label: string, href: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${COLORS.ink};color:${COLORS.canvas};text-decoration:none;font-family:${FONT};font-size:15px;font-weight:500;padding:13px 26px;border-radius:999px">${esc(label)}</a>`;
}
