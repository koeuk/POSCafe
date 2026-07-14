/**
 * Renders a synchronous inline script that runs during HTML parsing (before
 * first paint) — used for no-flash theme/branding setup in the root layout.
 *
 * React 19 warns when a component renders a raw <script> tag (client renders
 * never execute them). Per the Next.js "preventing flash before hydration"
 * guide, we emit `type="text/javascript"` on the server (so it runs on the
 * initial HTML) and `type="text/plain"` on the client (inert, no warning);
 * `suppressHydrationWarning` covers the intentional type mismatch.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
