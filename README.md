# Tangence Audit Tool - UI/UX Website Audit Platform

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.19-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An enterprise-grade UI/UX website audit tool that automatically audits websites across a 10-category UI/UX checklist and 13 responsive viewports.

---

## 🌟 Key Features

- **5 Flexible Input Methods**:
  1. Paste Multiple URLs (multiline input)
  2. Upload CSV File
  3. Upload TXT File
  4. Import Sitemap XML (`sitemap.xml`)
  5. Automatic Website Crawler (discovers internal links up to configured depth)
- **Playwright / Puppeteer Browser Capture**:
  - Desktop (1920x1080), Tablet (768x1024), Mobile (375x812), and Full-Page screenshots
  - DOM structure, computed CSS, console JS error tracking, network request waterfall
- **Multidisciplinary AI Audit Engine**:
  - Emulates 8 specialist personas: *Senior Product Designer, UX Researcher, UI Designer, Accessibility Specialist, CRO Consultant, Frontend Engineer, SEO Consultant, Performance Engineer*.
- **Visual Screenshot Callout Annotations**:
  - Overlays numbered callout pin badges (`#1`, `#2`, `#3`) and highlight boxes on page screenshots mapping directly to flagged issues.
- **Real-Time Live Progress Tracker**:
  - Real-time progress bar and live event terminal feed.
- **Client-Ready Multi-Format Exports**:
  - Download reports in **PDF, DOCX, HTML, Markdown, JSON, and CSV** formats.
- **Side-by-Side Audit Comparison**:
  - Compare two audit runs side-by-side to measure UI redesign improvements.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ or 20+
- npm or yarn

### 2. Installation
```bash
# Install dependencies
npm install

# Initialize Prisma Database
npx prisma db push
npx prisma generate
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated System Tests
```bash
npm test
```

---

## 🐳 Docker Deployment

```bash
docker-compose up -d --build
```
Access the application at `http://localhost:3000`.

---

## 📄 License
MIT License.
