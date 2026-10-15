import * as cheerio from 'cheerio';

export async function parseSitemap(sitemapUrl: string): Promise<string[]> {
  const discoveredUrls: Set<string> = new Set();
  const visitedSitemaps: Set<string> = new Set();

  async function fetchAndParse(url: string) {
    if (visitedSitemaps.has(url)) return;
    visitedSitemaps.add(url);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AuditToolBot/1.0)'
        }
      });

      if (!res.ok) return;
      const xmlText = await res.text();
      const $ = cheerio.load(xmlText, { xmlMode: true });

      // Check if it's a sitemap index (<sitemap><loc>...</loc></sitemap>)
      const childSitemaps: string[] = [];
      $('sitemap > loc').each((_, el) => {
        const childUrl = $(el).text().trim();
        if (childUrl) childSitemaps.push(childUrl);
      });

      if (childSitemaps.length > 0) {
        for (const childUrl of childSitemaps.slice(0, 10)) {
          await fetchAndParse(childUrl);
        }
        return;
      }

      // Parse regular urlset (<url><loc>...</loc></url>)
      $('url > loc').each((_, el) => {
        const pageUrl = $(el).text().trim();
        if (pageUrl && isValidHttpUrl(pageUrl)) {
          discoveredUrls.add(pageUrl);
        }
      });
    } catch (err) {
      console.error(`Failed to parse sitemap ${url}:`, err);
    }
  }

  await fetchAndParse(sitemapUrl);
  return Array.from(discoveredUrls);
}

function isValidHttpUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
