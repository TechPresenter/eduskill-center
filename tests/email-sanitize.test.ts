import { describe, expect, it } from "vitest";
import { MAX_EMAIL_HTML_LENGTH, htmlToText, isValidAddress, parseAddressList, sanitizeEmailHtml, wrapEmailLayout } from "@/lib/email/sanitize";

/** Admin → Send Email: everything an administrator composes is sanitised on the server. */

describe("sanitizeEmailHtml — removes active content", () => {
  it("drops <script> and <style> together with their contents", () => {
    const out = sanitizeEmailHtml('<p>Hi</p><script>alert("x")</script><style>p{color:red}</style>');
    expect(out).toBe("<p>Hi</p>");
  });

  it("drops iframes, forms, inputs, objects, embeds, meta and link tags", () => {
    const out = sanitizeEmailHtml(
      '<iframe src="https://evil.example"></iframe><form action="https://evil.example"><input name="pw"><button>Go</button></form>' +
        '<object data="x.swf"></object><embed src="y"><meta http-equiv="refresh" content="0;url=https://evil.example"><link rel="stylesheet" href="https://evil.example/s.css"><p>ok</p>'
    );
    for (const tag of ["<iframe", "<form", "<input", "<button", "<object", "<embed", "<meta", "<link"]) expect(out).not.toContain(tag);
    expect(out).not.toContain("evil.example");
    expect(out).toContain("<p>ok</p>");
  });

  it("drops SVG (and the script inside it)", () => {
    const out = sanitizeEmailHtml("<svg onload=\"alert(1)\"><script>alert(1)</script></svg><p>after</p>");
    expect(out).not.toMatch(/svg|script|alert/i);
    expect(out).toContain("<p>after</p>");
  });

  it("strips every on* event handler", () => {
    const out = sanitizeEmailHtml('<p onclick="steal()" onmouseover="x">T</p><img src="https://cdn.example.com/a.png" alt="A" onerror="alert(1)"><table onload="x"><tr><td onfocus="y">c</td></tr></table>');
    expect(out).not.toMatch(/\son[a-z]+=/i);
    expect(out).not.toMatch(/steal|alert/);
    expect(out).toContain('<img src="https://cdn.example.com/a.png" alt="A" />');
  });

  it("removes javascript: links however they are spelled", () => {
    const out = sanitizeEmailHtml(
      '<a href="javascript:alert(1)">a</a><a href="JaVaScRiPt:alert(1)">b</a><a href="&#106;avascript:alert(1)">c</a><a href=" javascript:alert(1)">d</a><a href="java&#x09;script:alert(1)">e</a>'
    );
    expect(out).not.toMatch(/javascript|alert|href/i);
    expect(out).toContain(">a</a>");
  });

  it("removes data: and protocol-relative links, and data: images", () => {
    const out = sanitizeEmailHtml('<a href="data:text/html;base64,PHNjcmlwdD4=">d</a><img src="data:image/png;base64,AAAA" alt="pixel"><a href="//evil.example/x">p</a><a href="vbscript:msgbox(1)">v</a>');
    expect(out).not.toContain("data:");
    expect(out).not.toContain("evil.example");
    expect(out).not.toContain("vbscript");
    expect(out).not.toContain("src=");
    expect(out).toContain('alt="pixel"');
  });

  it("keeps http(s) images and http(s)/mailto links", () => {
    const out = sanitizeEmailHtml('<img src="http://cdn.example.com/a.png" width="120" height="40" alt="Logo"><a href="mailto:info@eduskillindia.com">Mail us</a><a href="https://eduskillindia.com/courses">Courses</a>');
    expect(out).toContain('src="http://cdn.example.com/a.png"');
    expect(out).toContain('width="120"');
    expect(out).toContain('href="mailto:info@eduskillindia.com"');
    expect(out).toContain('href="https://eduskillindia.com/courses"');
  });
});

describe("sanitizeEmailHtml — keeps email formatting", () => {
  it("keeps whitelisted inline styles and drops the rest", () => {
    const out = sanitizeEmailHtml(
      '<p style="color:#ff0000;text-align:center;font-size:18px;position:fixed;background-image:url(https://e.example/x.png)">S</p>' +
        '<div style="color:expression(alert(1));background:url(javascript:alert(1));margin:0 auto;padding:12px 22px;border:1px solid #e5e7eb;z-index:999">D</div>'
    );
    expect(out).toContain('<p style="color:#ff0000;text-align:center;font-size:18px">S</p>');
    expect(out).toContain('<div style="margin:0 auto;padding:12px 22px;border:1px solid #e5e7eb">D</div>');
    expect(out).not.toMatch(/position|background-image|url\(|expression|z-index|javascript/i);
  });

  it("keeps the CTA button pattern used by the starter templates", () => {
    const button = '<a href="https://eduskillindia.com" style="display:inline-block;background:#ea580c;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Read more</a>';
    const out = sanitizeEmailHtml(button);
    for (const rule of ["display:inline-block", "background:#ea580c", "color:#ffffff", "padding:12px 22px", "border-radius:8px", "text-decoration:none", "font-weight:600"]) {
      expect(out).toContain(rule);
    }
  });

  it("keeps tables with their layout attributes", () => {
    const out = sanitizeEmailHtml(
      '<table border="1" cellpadding="4" cellspacing="0" width="100%" style="border-collapse:collapse"><caption>Fees</caption><thead><tr><th scope="col">Class</th></tr></thead><tbody><tr><td colspan="2" valign="top">1–4</td></tr></tbody></table>'
    );
    expect(out).toContain('<table border="1" cellpadding="4" cellspacing="0" width="100%" style="border-collapse:collapse">');
    expect(out).toContain("<caption>Fees</caption>");
    expect(out).toContain('<th scope="col">Class</th>');
    expect(out).toContain('<td colspan="2" valign="top">1–4</td>');
  });

  it("keeps headings, lists, dividers and text formatting", () => {
    const html = "<h1>A</h1><h2>B</h2><h3>C</h3><ul><li>one</li></ul><ol><li>two</li></ol><hr /><p><strong>b</strong><em>i</em><u>u</u><s>s</s></p><blockquote>q</blockquote>";
    expect(sanitizeEmailHtml(html)).toBe(html);
  });

  it("forces links to open in a new tab without a referrer", () => {
    const out = sanitizeEmailHtml('<a href="https://eduskillindia.com" target="_self" rel="opener">site</a>');
    expect(out).toBe('<a href="https://eduskillindia.com" target="_blank" rel="noopener noreferrer">site</a>');
  });

  it("caps the input length", () => {
    const huge = `<p>${"x".repeat(MAX_EMAIL_HTML_LENGTH + 5_000)}</p>`;
    expect(sanitizeEmailHtml(huge).length).toBeLessThanOrEqual(MAX_EMAIL_HTML_LENGTH + 10);
  });
});

describe("htmlToText", () => {
  it("turns blocks, line breaks, lists and dividers into readable text", () => {
    const text = htmlToText("<h2>Title</h2><p>Hello<br>World</p><ul><li>One</li><li>Two</li></ul><hr><p>End</p>");
    expect(text).toBe("Title\nHello\nWorld\n• One\n• Two\n\n————————\nEnd");
  });

  it("writes links as label (url), or just the url when they are the same", () => {
    expect(htmlToText('<p><a href="https://x.com/a" target="_blank">Visit</a></p>')).toBe("Visit (https://x.com/a)");
    expect(htmlToText('<p><a href="https://x.com/b">https://x.com/b</a></p>')).toBe("https://x.com/b");
  });

  it("decodes entities and collapses runs of blank lines", () => {
    // &nbsp; may come back as a literal non-breaking space — still whitespace, never an entity.
    expect(htmlToText("<p>Fish &amp; Chips &lt;3 &quot;q&quot; &#39;s&nbsp;x</p>").replace(/ /g, " ")).toBe("Fish & Chips <3 \"q\" 's x");
    expect(htmlToText("<p>a</p><p></p><p></p><p></p><p>b</p>")).toBe("a\n\nb");
  });

  it("never carries markup or script text into the plain-text part", () => {
    const text = htmlToText(sanitizeEmailHtml('<p>Hi</p><script>alert(1)</script><img src="https://x/y.png" alt="z">'));
    expect(text).toBe("Hi");
  });
});

describe("wrapEmailLayout", () => {
  it("wraps the body and signature, and escapes the preheader", () => {
    const html = wrapEmailLayout("<p>Body</p>", { signatureHtml: "<p>Best regards</p>", preheader: '<script>"x"</script>' });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain("<p>Best regards</p>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(wrapEmailLayout("<p>Body</p>")).not.toContain("border-top:1px solid #e5e7eb");
  });
});

describe("parseAddressList", () => {
  it("splits on commas, semicolons and whitespace, lower-cases and de-duplicates", () => {
    expect(parseAddressList("A@x.com, b@y.org; c@z.in  a@X.com\nd@w.io")).toEqual(["a@x.com", "b@y.org", "c@z.in", "d@w.io"]);
    expect(parseAddressList(["a@x.com", "b@y.org, c@z.in", "A@X.COM"])).toEqual(["a@x.com", "b@y.org", "c@z.in"]);
  });

  it("returns an empty list for nothing", () => {
    expect(parseAddressList(null)).toEqual([]);
    expect(parseAddressList(undefined)).toEqual([]);
    expect(parseAddressList("")).toEqual([]);
    expect(parseAddressList(" ,; ")).toEqual([]);
  });

  it("never lets a line break smuggle a header into one address", () => {
    const list = parseAddressList("a@x.com\r\nBcc: evil@x.com");
    expect(list.every((a) => !/[\r\n]/.test(a))).toBe(true);
    // The fragment that would have been a header name is not an address, so sending is refused.
    expect(list.filter((a) => !isValidAddress(a))).toEqual(["bcc:"]);
  });
});

describe("isValidAddress", () => {
  it("accepts ordinary addresses", () => {
    for (const ok of ["info@eduskillindia.com", "first.last+tag@sub.example.co.in", "o'brien@example.ie", "a_b-c%d@x-y.org"]) {
      expect(isValidAddress(ok)).toBe(true);
    }
  });

  it("rejects junk, header-injection characters and over-long addresses", () => {
    const bad = [
      "",
      "plainaddress",
      "@example.com",
      "a@b",
      "a@b.c",
      "a b@x.com",
      "a@x.com\r\nBcc: evil@x.com",
      "a@x.com\nX-Header: 1",
      "a@x.com\r",
      "a@x.com\0",
      "<a@x.com>",
      "Name <a@x.com>",
      "a@x.com,b@y.com",
      "a@x.com;b@y.com",
      '"a"@x.com',
      `${"a".repeat(250)}@x.com`,
    ];
    for (const b of bad) expect(isValidAddress(b), JSON.stringify(b)).toBe(false);
  });
});
