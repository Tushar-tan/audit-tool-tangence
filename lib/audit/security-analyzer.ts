import { PageMetricsData, AuditIssueData } from '../types/audit';

export function analyzeSecurity(metrics: PageMetricsData): { score: number; issues: AuditIssueData[] } {
  const issues: AuditIssueData[] = [];
  let score = 100;
  const pageUrl = metrics.url;

  // 1. SSL certificate is valid
  if (!metrics.sslValid) {
    score -= 40;
    issues.push({
      issueId: 'SEC-001',
      pageUrl,
      category: 'security',
      severity: 'critical',
      status: 'FAIL',
      title: 'Invalid or Expired SSL/TLS Certificate',
      problem: 'The SSL/TLS certificate for this domain is invalid, untrusted, or expired.',
      expectedBehavior: 'All websites must have a valid, trusted SSL/TLS certificate without browser security warnings.',
      actualBehavior: 'SSL certificate validation failed during connection.',
      recommendation: 'Renew or replace the SSL certificate through your hosting provider or Let\'s Encrypt.',
      elementSelector: 'ssl certificate',
      elementInfo: 'SSL/TLS Certificate'
    });
  }

  // 2. HTTPS enforced
  if (!metrics.httpsEnforced) {
    score -= 30;
    issues.push({
      issueId: 'SEC-002',
      pageUrl,
      category: 'security',
      severity: 'high',
      status: 'FAIL',
      title: 'HTTPS Is Not Strictly Enforced',
      problem: 'Unencrypted HTTP connections are permitted or plain HTTP traffic is not redirected to HTTPS.',
      expectedBehavior: 'HTTPS should be strictly enforced with HSTS and automatic HTTP-to-HTTPS redirects.',
      actualBehavior: 'Site allows plain HTTP access without forced HTTPS enforcement.',
      recommendation: 'Enable HTTP Strict Transport Security (HSTS) and configure forced HTTPS redirection on your web server.',
      elementSelector: 'server security',
      elementInfo: 'HTTPS Enforcement'
    });
  }

  // 3. Google Analytics installed
  if (!metrics.googleAnalyticsInstalled) {
    score -= 15;
    issues.push({
      issueId: 'SEC-003',
      pageUrl,
      category: 'security',
      severity: 'low',
      status: 'FAIL',
      title: 'Google Analytics / GTM Tracking Not Detected',
      problem: 'No Google Analytics (GA4 / gtag.js) or Google Tag Manager script was detected on the page.',
      expectedBehavior: 'Standard marketing sites should have Google Analytics (GA4) or GTM tag installed to measure traffic and conversions.',
      actualBehavior: 'Google Analytics / GTM scripts not detected in DOM or window scope.',
      recommendation: 'Install Google Analytics (GA4) via gtag.js or Google Tag Manager (GTM) in the <head> of all pages.',
      elementSelector: 'head script[src*="google"]',
      elementInfo: 'Web Analytics Tag'
    });
  }

  return {
    score: Math.max(0, score),
    issues
  };
}
