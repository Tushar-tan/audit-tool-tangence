import { analyzeHeaderNav } from './header-nav-analyzer';
import { analyzeVisualDesign } from './visual-design-analyzer';
import { analyzeResponsive } from './responsive-analyzer';
import { analyzeContent } from './content-analyzer';
import { analyzeButtonsCtas } from './buttons-ctas-analyzer';
import { analyzeForms } from './forms-analyzer';
import { analyzeLinks } from './links-analyzer';
import { analyzeImagesMedia } from './images-media-analyzer';
import { analyzeSeoOnPage } from './seo-on-page-analyzer';
import { analyzeTechnicalSeo } from './technical-seo-analyzer';
import { analyzeSecurity } from './security-analyzer';
import { calculatePageScores } from './scoring-engine';
import { PageMetricsData, AuditIssueData, CategoryScores, AuditConfig } from '../types/audit';

export interface ComprehensiveAuditResult {
  scores: CategoryScores;
  issues: AuditIssueData[];
}

export async function runMultidisciplinaryAudit(
  url: string,
  metrics: PageMetricsData,
  config?: AuditConfig
): Promise<ComprehensiveAuditResult> {
  const headerNav = analyzeHeaderNav(metrics);
  const visualDesign = analyzeVisualDesign(metrics);
  const responsive = analyzeResponsive(metrics);
  const content = analyzeContent(metrics);
  const buttonsCtas = analyzeButtonsCtas(metrics);
  const forms = analyzeForms(metrics);
  const links = analyzeLinks(metrics);
  const imagesMedia = analyzeImagesMedia(metrics);
  const seoOnPage = analyzeSeoOnPage(metrics);
  const technicalSeo = analyzeTechnicalSeo(metrics);
  const security = analyzeSecurity(metrics);

  const scores = calculatePageScores(
    headerNav.score,
    visualDesign.score,
    responsive.score,
    content.score,
    buttonsCtas.score,
    forms.score,
    links.score,
    imagesMedia.score,
    seoOnPage.score,
    technicalSeo.score,
    security.score
  );

  const rawIssues: AuditIssueData[] = [
    ...headerNav.issues,
    ...visualDesign.issues,
    ...responsive.issues,
    ...content.issues,
    ...buttonsCtas.issues,
    ...forms.issues,
    ...links.issues,
    ...imagesMedia.issues,
    ...seoOnPage.issues,
    ...technicalSeo.issues,
    ...security.issues
  ];

  // Group duplicate issues if multiple similar issues exist
  const groupedIssues = groupDuplicateIssues(rawIssues, url);

  // If AI API Key provided and enableAiAnalysis is true, optionally refine recommendations
  if (config?.enableAiAnalysis && (config.apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)) {
    try {
      const apiKey = config.apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
      if (apiKey) {
        const enriched = await callLlmEnhancer(url, metrics, groupedIssues, apiKey);
        if (enriched && enriched.length > 0) {
          return { scores, issues: enriched };
        }
      }
    } catch (err) {
      console.warn('LLM API call fallback to Deterministic Checklist Engine:', err);
    }
  }

  return {
    scores,
    issues: groupedIssues
  };
}

function groupDuplicateIssues(issues: AuditIssueData[], pageUrl: string): AuditIssueData[] {
  const groupedMap = new Map<string, AuditIssueData>();
  const finalIssues: AuditIssueData[] = [];

  for (const issue of issues) {
    const key = `${issue.category}-${issue.title}`;

    if (groupedMap.has(key)) {
      const existing = groupedMap.get(key)!;
      existing.isGrouped = true;
      existing.affectedCount = (existing.affectedCount || 1) + 1;
      if (!existing.affectedUrls) existing.affectedUrls = [pageUrl];
      if (!existing.affectedUrls.includes(pageUrl)) {
        existing.affectedUrls.push(pageUrl);
      }
    } else {
      issue.affectedCount = 1;
      issue.affectedUrls = [pageUrl];
      groupedMap.set(key, issue);
      finalIssues.push(issue);
    }
  }

  return finalIssues;
}

async function callLlmEnhancer(
  url: string,
  metrics: PageMetricsData,
  issues: AuditIssueData[],
  apiKey: string
): Promise<AuditIssueData[] | null> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const prompt = `You are a UI/UX expert auditor reviewing detected issues on ${url}.
Strictly follow the 11-category checklist rules (Header & Navigation, Visual Design / UI, Responsive Design, Content, Buttons & CTAs, Forms, Links, Images & Media, SEO – On Page, Technical SEO, Security).
Do NOT add extra out-of-scope performance rules.
Issues detected: ${JSON.stringify(issues.slice(0, 10))}
Return a JSON array of refined AuditIssueData items with concrete recommendations.`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!res.ok) return null;
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  try {
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as AuditIssueData[];
    }
  } catch {
    return null;
  }
  return null;
}
