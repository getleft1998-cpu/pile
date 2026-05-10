import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const ctx = await b.newContext({
    ignoreHTTPSErrors: true,
    locale: "en-US",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const p = await ctx.newPage();

  const allResponses: Array<{url: string; status: number; ct: string}> = [];
  p.on("response", r => {
    allResponses.push({ url: r.url(), status: r.status(), ct: r.headers()["content-type"] ?? "" });
  });

  p.on("requestfailed", r => {
    console.log("FAILED:", r.url(), r.failure()?.errorText);
  });

  try {
    console.log("Navigating...");
    await p.goto("https://flormar.tn", { waitUntil: "networkidle", timeout: 30_000 });
    console.log("Navigation done");
  } catch (e) {
    console.log("Navigation error:", String(e).slice(0, 200));
  }

  await p.waitForTimeout(3000);

  const title = await p.title();
  const bodyText = await p.$eval("body", (el: Element) => el.innerText?.slice(0, 200)).catch(() => "N/A");

  console.log("Title:", title);
  console.log("Body text:", bodyText);
  console.log("Total responses:", allResponses.length);
  allResponses.slice(0, 30).forEach(r => console.log(`  [${r.status}] ${r.url.slice(0, 100)}`));

  await b.close();
}

main().catch(console.error);
