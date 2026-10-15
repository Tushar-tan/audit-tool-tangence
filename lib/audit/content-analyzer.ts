import { PageMetricsData, AuditIssueData } from '../types/audit';

export function analyzeContent(metrics: PageMetricsData): { score: number; issues: AuditIssueData[] } {
  const issues: AuditIssueData[] = [];
  let score = 100;
  const pageUrl = metrics.url;

  // 1. No spelling/grammar errors
  if (metrics.spellingGrammarErrors.length > 0) {
    score -= Math.min(20, metrics.spellingGrammarErrors.length * 8);
    const firstErr = metrics.spellingGrammarErrors[0];
    issues.push({
      issueId: 'CNT-001',
      pageUrl,
      category: 'content',
      severity: 'medium',
      status: 'FAIL',
      title: `Spelling / Grammar Error(s) Found in Copy (${metrics.spellingGrammarErrors.length} Detected)`,
      problem: `Found spelling or grammar mistake in page copy: "${firstErr.wordOrPhrase}" (${firstErr.context}).`,
      expectedBehavior: 'All published copy must be grammatically accurate and free of spelling errors.',
      actualBehavior: `Spelling/grammar error detected: ${firstErr.context}.`,
      recommendation: firstErr.suggestion || 'Review and correct spelling and grammar in page copy.',
      elementSelector: 'body, p, section',
      elementText: firstErr.wordOrPhrase,
      elementInfo: 'Page Content Copy'
    });
  }

  // 2. No duplicate content
  if (metrics.duplicateContentBlocks.length > 0) {
    score -= Math.min(20, metrics.duplicateContentBlocks.length * 10);
    const firstDup = metrics.duplicateContentBlocks[0];
    issues.push({
      issueId: 'CNT-002',
      pageUrl,
      category: 'content',
      severity: 'medium',
      status: 'FAIL',
      title: `Duplicate Content Blocks Detected (${metrics.duplicateContentBlocks.length} Duplicated)`,
      problem: `Identified verbatim repeated content block appearing ${firstDup.count} times: "${firstDup.text}".`,
      expectedBehavior: 'Each section should feature distinct, original copy without redundant duplication.',
      actualBehavior: `Content block repeated ${firstDup.count} times across the page.`,
      recommendation: 'Remove repeated content blocks or tailor text to the specific section context.',
      elementSelector: 'p, section, article',
      elementText: firstDup.text,
      elementInfo: 'Duplicate Content Block'
    });
  }

  // 3. No placeholder text
  if (metrics.placeholderTextDetected && metrics.placeholderPhrases.length > 0) {
    score -= Math.min(25, metrics.placeholderPhrases.length * 10);
    issues.push({
      issueId: 'CNT-003',
      pageUrl,
      category: 'content',
      severity: 'high',
      status: 'FAIL',
      title: `Draft / Placeholder Text Found in Content ("${metrics.placeholderPhrases.join('", "')}")`,
      problem: `Page copy contains unfinished draft placeholders: ${metrics.placeholderPhrases.map((p) => `"${p}"`).join(', ')}.`,
      expectedBehavior: 'Production pages must have complete, finalized marketing and informational copy.',
      actualBehavior: `Draft keywords detected in rendered body text.`,
      recommendation: 'Replace placeholder draft phrasing with finalized product copy and descriptions.',
      elementSelector: 'p, div, section',
      elementInfo: 'Placeholder Copy Block'
    });
  }

  // 4. No Lorem Ipsum
  if (metrics.loremIpsumDetected) {
    score -= 30;
    issues.push({
      issueId: 'CNT-004',
      pageUrl,
      category: 'content',
      severity: 'critical',
      status: 'FAIL',
      title: 'Unreleased "Lorem Ipsum" Dummy Text Found in Content',
      problem: 'The page contains Latin "Lorem Ipsum" draft placeholder text in production copy.',
      expectedBehavior: 'All published pages must contain authentic, finalized product and marketing copy.',
      actualBehavior: 'Matched "Lorem Ipsum" dummy text strings in body content.',
      recommendation: 'Replace Latin placeholder text with finalized authentic copy.',
      elementSelector: 'p, section, article',
      elementInfo: 'Lorem Ipsum Text'
    });
  }

  // 5. Links within content work
  if (!metrics.inContentLinksWork && metrics.brokenInContentLinks.length > 0) {
    score -= Math.min(20, metrics.brokenInContentLinks.length * 8);
    const firstBroken = metrics.brokenInContentLinks[0];
    issues.push({
      issueId: 'CNT-005',
      pageUrl,
      category: 'content',
      severity: 'high',
      status: 'FAIL',
      title: `Broken / Empty Link Within Body Content: "${firstBroken.text}"`,
      problem: `In-content link with text '${firstBroken.text}' has missing or placeholder destination ('${firstBroken.href}').`,
      expectedBehavior: 'All links embedded in body paragraphs and articles must point to valid target URLs.',
      actualBehavior: `Link has href="${firstBroken.href}" resulting in a dead click.`,
      recommendation: 'Assign a valid destination URL to the in-content link.',
      elementSelector: firstBroken.selector,
      elementText: firstBroken.text,
      elementInfo: 'In-Content Anchor Link'
    });
  }

  return {
    score: Math.max(0, score),
    issues
  };
}
