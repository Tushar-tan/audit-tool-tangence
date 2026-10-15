# System Architecture & Technical Specifications

## 1. Overview
The **Tangence Audit Tool** is a production-ready web application designed for multi-page automated website auditing across 10 core checklist categories and 13 responsive viewports.

---

## 2. Technical Stack Selection & Tradeoffs

| Component | Selected Technology | Architectural Justification |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 14+ (App Router) | Unified SSR/SSG rendering, fast client hydration, and server action/API route synergy. |
| **Styling System** | Tailwind CSS + CSS Variables | High-performance CSS output, sleek glassmorphism themes, zero runtime CSS-in-JS overhead. |
| **Data Layer / ORM** | Prisma ORM | Type-safe schema migrations, zero-config SQLite local development fallback, and instant PostgreSQL deployment readiness. |
| **Browser Automation** | Puppeteer | Headless Chrome browser runner enabling full JS rendering, network payload capture, A11y tree evaluation, and screenshot compositing. |
| **AI Audit Engine** | Hybrid Persona LLM + Expert Heuristic Engine | Dual-mode architecture: calls Gemini / OpenAI APIs when keys are present, while maintaining full offline functionality via a deterministic expert rule engine. |
| **Visual Annotator** | SVG/Canvas Compositing | Maps DOM bounding boxes (`getBoundingClientRect`) directly onto screenshots, rendering numbered pin badges (#1, #2) and finding legends. |
| **Report Exporters** | Puppeteer PDF / `docx` / HTML | Generates client-ready reports in PDF, DOCX, HTML, Markdown, JSON, and CSV formats. |

---

## 3. Core Data Schemas

```
Project (1) ───< Audit (N) ───< PageAudit (N) ───< AuditIssue (N)
                    │
                    └───< CrawlLog (N)
```

1. **`Audit`**: Stores domain, input method, config, aggregate scores, status, and crawl stats.
2. **`PageAudit`**: Stores URL, load time, desktop/tablet/mobile screenshots, DOM metrics JSON, and category scores JSON.
3. **`AuditIssue`**: Stores category, severity, priority, effort, specialist persona role, title, explanation, evidence, impacts, suggested solution, DOM selector, and bounding box coordinates (`x, y, width, height`).
4. **`CrawlLog`**: Real-time event log for live progress tracking UI.

---

## 4. Multi-Domain Audit Evaluator & Specialist Personas

The AI engine emulates 8 distinct specialist personas:
1. **Senior Product Designer**: Visual hierarchy, clutter reduction, layout structure.
2. **UX Researcher**: Navigation flow, Hick-Hyman decision load, form friction.
3. **UI Designer**: Color contrast, button consistency, typography hierarchy.
4. **Accessibility Specialist**: WCAG 2.1 AA compliance, ALT text, ARIA roles, form labels.
5. **CRO Consultant**: Above-the-fold value proposition, CTA prominence, social proof.
6. **Frontend Engineer**: Render-blocking assets, DOM complexity, JS console errors.
7. **SEO Consultant**: Title/meta description length, H1 structure, OpenGraph, canonicals.
8. **Performance Engineer**: Core Web Vitals (LCP, FCP, TTFB), asset compression, image optimization.

---

## 5. Security & Enterprise Scalability
- **Rate Limiting & URL Validation**: Sanitizes and normalizes all input URLs to prevent SSRF (Server-Side Request Forgery).
- **Robots.txt & Exclusion Patterns**: Respects site crawling rules and skips restricted user paths.
- **Asynchronous Background Processing**: Offloads heavy browser crawling and screenshot rendering from main HTTP request loops.
