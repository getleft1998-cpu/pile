import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, locale: "en-US" });
  const p = await ctx.newPage();
  const responses: string[] = [];
  p.on("response", r => responses.push(r.url() + " | " + (r.headers()["content-type"] ?? "")));
  await p.goto("https://flormar.tn", { waitUntil: "domcontentloaded", timeout: 25000 });
  await p.waitForTimeout(5000);
  const title = await p.title();
  const h1 = await p.$eval("h1", (e: Element) => e.textContent).catch(() => "no h1");
  const navLinks = await p.evaluate(() => {
    const links = document.querySelectorAll("nav a, .main-menu a, header a, [class*='menu'] a, [class*='nav'] a");
    return [...links].slice(0, 30).map((el) => ({ text: el.textContent?.trim(), href: (el as HTMLAnchorElement).href }));
  });
  console.log("Title:", title);
  console.log("H1:", h1);
  console.log("Total responses:", responses.length);
  const jsonResponses = responses.filter(r => r.includes("json") || r.includes("/api/") || r.includes("converty"));
  console.log("JSON/API/converty responses:", jsonResponses.length);
  jsonResponses.slice(0, 30).forEach(r => console.log(" ", r));
  console.log("Nav links:", navLinks.length);
  navLinks.forEach(l => console.log(" ", JSON.stringify(l.text), "->", l.href));

  // Also dump all response URLs
  console.log("\nAll response URLs:");
  responses.slice(0, 50).forEach(r => console.log(" ", r.split("|")[0].trim()));
  await b.close();
}

main().catch(console.error);
