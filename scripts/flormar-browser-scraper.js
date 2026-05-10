/**
 * Flormar.tn Browser Scraper — paste into browser console on https://flormar.tn
 * Navigates each category, extracts products from DOM, sends to import endpoint.
 */
(async () => {
  const ENDPOINT = "https://pile-theta.vercel.app/api/admin/import-catalog?token=flormar2024";

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function slugify(t) {
    return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  }
  function parsePrice(s) {
    if (!s) return null;
    const m = String(s).replace(/\s/g,"").match(/[\d.,]+/);
    return m ? parseFloat(m[0].replace(",",".")) : null;
  }
  function upgradeLg(u) {
    return u ? u.replace(/_(sm|md|xs|thumb)\.(webp|jpg|png|jpeg)$/i,"_lg.$2") : u;
  }

  // Wait for a selector to appear (or timeout)
  async function waitFor(sel, timeout=6000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const el = document.querySelector(sel);
      if (el) return el;
      await sleep(300);
    }
    return null;
  }

  // Wait for URL to contain a string
  async function waitForUrl(str, timeout=8000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (location.href.includes(str)) return true;
      await sleep(300);
    }
    return false;
  }

  // Click a link and wait for navigation
  async function clickAndWait(el, urlHint="", waitMs=3000) {
    el.click();
    if (urlHint) await waitForUrl(urlHint);
    await sleep(waitMs);
  }

  // Collect converty CDN images from visible <img> tags in a container
  function getImages(container) {
    const imgs = [...(container || document).querySelectorAll("img")];
    return [...new Set(
      imgs.map(i => i.src || i.getAttribute("data-src") || "")
         .filter(s => s && s.includes("converty") && !/logo|placeholder|pixel/i.test(s))
         .map(upgradeLg)
    )].slice(0, 5);
  }

  // Scrape shades/variants from current product page
  function getVariants() {
    const swatchSel = [
      "[class*='swatch']","[class*='shade']","[class*='variant']",
      "[class*='option']","[data-shade]","[data-variant]","[data-option]",
      "li[class*='color']","li[class*='size']",
    ].join(",");
    const els = [...document.querySelectorAll(swatchSel)];
    const variants = els.map(el => {
      const name = el.getAttribute("title") || el.getAttribute("aria-label") ||
                   el.getAttribute("data-name") || el.getAttribute("data-shade") ||
                   el.textContent?.trim();
      if (!name || name.length > 100 || name.length < 1) return null;
      const hex = el.style?.backgroundColor || el.getAttribute("data-color") || el.getAttribute("data-hex") || null;
      const swatchImg = el.querySelector("img")?.src ? upgradeLg(el.querySelector("img").src) : null;
      const sku = el.getAttribute("data-sku") || el.getAttribute("data-id") || el.getAttribute("data-value") || null;
      return { shade_name: name, color_hex: hex, swatch_image_url: swatchImg, sku };
    }).filter(Boolean);
    return variants.length ? variants : [{ shade_name: "Standard", color_hex: null, swatch_image_url: null, sku: null }];
  }

  // Get product links visible in current page
  function getProductLinks() {
    return [...new Set(
      [...document.querySelectorAll("a[href]")]
        .map(a => a.href)
        .filter(h => h && (h.includes("/product/") || h.includes("/products/") || /flormar\.tn\/[a-z0-9-]{3,}\/[a-z0-9-]{3,}/.test(h)))
    )];
  }

  // Get category links from nav
  function getCategoryLinks() {
    const seen = new Set();
    return [...document.querySelectorAll("nav a, header a, [class*='menu'] a, [class*='nav'] a, [class*='category'] a")]
      .map(a => ({ text: a.textContent?.trim(), href: a.href }))
      .filter(({ text, href }) => {
        if (!text || !href || text.length < 2 || text.length > 60) return false;
        if (/cart|account|wishlist|contact|about|blog|search|login|sign/i.test(href)) return false;
        if (href === location.origin || href === location.origin + "/") return false;
        const key = href.split("?")[0];
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  // ── Main ──────────────────────────────────────────────────────────────────────

  console.log("🌸 Flormar scraper starting...");
  console.log("Current URL:", location.href);

  // Hook XHR + fetch to also capture API responses
  const apiData = [];
  const _fetch = window.fetch;
  window.fetch = async (...a) => {
    const r = await _fetch(...a);
    const ct = r.headers.get("content-type") ?? "";
    if (ct.includes("json")) r.clone().json().then(d => apiData.push(d)).catch(() => {});
    return r;
  };
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u, ...rest) { this._u = u; return _open.call(this,m,u,...rest); };
  XMLHttpRequest.prototype.send = (function(orig) {
    return function(...a) {
      this.addEventListener("load", () => { try { apiData.push(JSON.parse(this.responseText)); } catch {} });
      return orig.call(this, ...a);
    };
  })(XMLHttpRequest.prototype.send);

  await sleep(2000);

  // Find category links
  let cats = getCategoryLinks();
  console.log(`Found ${cats.length} category links:`, cats.map(c => c.text).join(", "));

  if (cats.length === 0) {
    console.warn("No categories found in nav. Trying to find product links on current page...");
    const links = getProductLinks();
    console.log(`Found ${links.length} product links directly`);
    cats = [{ text: "All", href: location.href }];
  }

  const allProducts = new Map();
  const slugsSeen = new Set();

  const addProduct = p => {
    if (!p || slugsSeen.has(p.slug)) return;
    slugsSeen.add(p.slug);
    allProducts.set(p.slug, p);
  };

  // Try to extract from API data already captured
  function extractFromApi(catSlug) {
    const found = [];
    const tryItem = (item, cs) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return;
      const name = item.name || item.title || item.product_name;
      if (!name || typeof name !== "string" || name.length < 2) return;
      const slug = item.slug || item.handle || slugify(name);
      const imgSet = new Set();
      JSON.stringify(item).replace(/"(https:\/\/[^"]*converty[^"]*\.(?:webp|jpg|png))[^"]*"/g, (_, u) => imgSet.add(upgradeLg(u)));
      found.push({
        name, slug,
        category_slug: cs,
        description: (item.description || item.short_description || "").replace(/<[^>]+>/g,"").trim().slice(0,500) || null,
        price: parsePrice(item.price ?? item.regular_price ?? item.original_price),
        sale_price: parsePrice(item.sale_price ?? item.promo_price),
        source_url: `https://flormar.tn/product/${slug}`,
        images: [...imgSet].slice(0,5),
        variants: (() => {
          const vs = item.variants || item.options || item.shades || item.colors || [];
          const parsed = vs.map(v => {
            if (!v || typeof v !== "object") return null;
            const sn = v.name || v.shade_name || v.title || v.value;
            if (!sn) return null;
            return { shade_name: sn, color_hex: v.color || v.hex || null, swatch_image_url: null, sku: v.sku || null };
          }).filter(Boolean);
          return parsed.length ? parsed : [{ shade_name: "Standard", color_hex: null, swatch_image_url: null, sku: null }];
        })(),
      });
    };
    const walk = (node, cs) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach(i => { tryItem(i, cs); walk(i, cs); }); return; }
      ["data","products","items","results"].forEach(k => { if (Array.isArray(node[k])) node[k].forEach(i => tryItem(i, cs)); });
      Object.values(node).forEach(v => { if (v && typeof v === "object") walk(v, cs); });
    };
    apiData.forEach(d => walk(d, catSlug));
    return found;
  }

  // Navigate each category
  const homePage = location.href;
  for (const cat of cats) {
    const catSlug = cat.href.split("/").filter(Boolean).pop() || slugify(cat.text);
    console.log(`\n→ Navigating to: ${cat.text} (${cat.href})`);

    // Click the link
    const linkEl = [...document.querySelectorAll("a[href]")].find(a => a.href === cat.href);
    if (linkEl) {
      apiData.length = 0;
      linkEl.click();
      await sleep(4000);
    } else {
      // Direct navigation
      history.pushState({}, "", cat.href);
      window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
      await sleep(4000);
    }

    // Check API captures first
    const fromApi = extractFromApi(catSlug);
    if (fromApi.length > 0) {
      console.log(`  ✓ ${fromApi.length} products from API`);
      fromApi.forEach(addProduct);
      continue;
    }

    // DOM scraping fallback
    const productLinks = getProductLinks();
    console.log(`  ${productLinks.length} product links in DOM`);

    for (const link of productLinks.slice(0, 60)) {
      const pSlug = link.split("/").filter(Boolean).pop() ?? "";
      if (slugsSeen.has(pSlug) || slugsSeen.has(slugify(pSlug))) continue;

      apiData.length = 0;
      history.pushState({}, "", link);
      window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
      await sleep(3000);
      await waitFor("h1", 5000);

      // Check API
      const apiProds = extractFromApi(catSlug);
      if (apiProds.length > 0) { apiProds.forEach(addProduct); continue; }

      // DOM
      const h1 = document.querySelector("h1")?.textContent?.trim();
      if (!h1 || h1.length < 2) continue;
      const priceEls = [...document.querySelectorAll("[class*='price']")].map(e => e.textContent?.trim()).filter(Boolean);
      const images = getImages(document);
      const variants = getVariants();
      const desc = document.querySelector(".product-description, [class*='description']")?.textContent?.trim()?.slice(0,500) || null;

      addProduct({
        name: h1, slug: slugify(h1), category_slug: catSlug, description: desc,
        price: parsePrice(priceEls[priceEls.length - 1]),
        sale_price: priceEls.length > 1 ? parsePrice(priceEls[0]) : null,
        source_url: link, images, variants,
      });
      console.log(`  ✓ ${h1}`);
    }
  }

  const products = [...allProducts.values()];
  console.log(`\nTotal: ${products.length} products, ${products.reduce((s,p)=>s+p.variants.length,0)} variants`);

  if (products.length === 0) {
    console.error("❌ Still 0 products.");
    console.log("Debug info:");
    console.log("  Nav links found:", getCategoryLinks().map(c=>c.text));
    console.log("  Product links on page:", getProductLinks().slice(0,5));
    console.log("  API responses captured:", apiData.length);
    console.log("  H1:", document.querySelector("h1")?.textContent);
    window.fetch = _fetch;
    return;
  }

  // Get unique categories
  const catSet = new Map();
  products.forEach(p => { if (p.category_slug && !catSet.has(p.category_slug)) catSet.set(p.category_slug, { name: p.category_slug, slug: p.category_slug }); });

  // Send in batches
  console.log(`\nSending to ${ENDPOINT}...`);
  const BATCH = 15;
  let total = 0;
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    try {
      const res = await _fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": "flormar2024" },
        body: JSON.stringify({ products: batch, categories: [...catSet.values()], overwrite: true }),
      });
      const result = await res.json();
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ${result.productsInserted} products, ${result.variantsInserted} variants, ${result.imagesInserted} images`);
      if (result.errors?.length) console.warn("  errors:", result.errors);
      total += result.productsInserted ?? 0;
    } catch(e) { console.error("Batch failed:", e); }
    await sleep(1000);
  }

  window.fetch = _fetch;
  console.log(`\n✅ DONE — ${total} products imported`);
})();
