/**
 * Reading styles for email HTML shown INSIDE the admin page (the editor surface, the signature
 * preview). They mirror the email layout's body text (src/lib/email/sanitize.ts → wrapEmailLayout):
 * Inter/Segoe UI, #172033, 1.6 line height. Inline styles in the content still win over these.
 * Server-safe: plain strings, no React.
 */
export const EMAIL_PROSE = [
  "font-[Inter,Segoe_UI,Arial,sans-serif] leading-[1.6] break-words text-[#172033]",
  "[&_a]:text-[#12357a] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-muted",
  "[&_h1]:my-3 [&_h1]:text-[26px] [&_h1]:leading-tight [&_h1]:font-bold [&_h2]:my-3 [&_h2]:text-[21px] [&_h2]:leading-snug [&_h2]:font-bold [&_h3]:my-2 [&_h3]:text-[18px] [&_h3]:font-semibold",
  "[&_hr]:my-4 [&_hr]:border-line [&_img]:inline-block [&_img]:max-w-full [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_table]:my-3 [&_td]:min-w-12 [&_td]:align-top [&_th]:min-w-12 [&_th]:text-left",
].join(" ");
