import { PageMetricsData, AuditIssueData } from '../types/audit';

export function analyzeForms(metrics: PageMetricsData): { score: number; issues: AuditIssueData[] } {
  const issues: AuditIssueData[] = [];
  let score = 100;
  const pageUrl = metrics.url;

  metrics.forms.forEach((form, idx) => {
    // 1. Forms submit successfully
    if (!form.submitsSuccessfully) {
      score -= 20;
      issues.push({
        issueId: `FRM-001-${idx}`,
        pageUrl,
        category: 'forms',
        severity: 'critical',
        status: 'FAIL',
        title: `Form Missing Submit Mechanism: "${form.location}"`,
        problem: `Form in '${form.location}' lacks a functional submit button (button[type="submit"]) or action handler.`,
        expectedBehavior: 'All forms must provide an accessible, working submit button and submission handler.',
        actualBehavior: 'No submit button or action defined for form.',
        recommendation: 'Add a <button type="submit"> to the form container.',
        elementSelector: form.selector,
        elementInfo: `Form (${form.location}) Submit Button`
      });
    }

    // 2. Required fields work
    if (!form.requiredFieldsWork) {
      score -= 15;
      issues.push({
        issueId: `FRM-002-${idx}`,
        pageUrl,
        category: 'forms',
        severity: 'high',
        status: 'FAIL',
        title: `Required Form Fields Not Enforced: "${form.location}"`,
        problem: `Required form fields in '${form.location}' lack HTML5 required attributes or clear visual indication.`,
        expectedBehavior: 'Mandatory fields must be indicated with * and enforced via HTML5 required attribute or JavaScript validation.',
        actualBehavior: 'Required fields allow empty form progression without constraint.',
        recommendation: 'Add the "required" attribute and aria-required="true" to mandatory inputs.',
        elementSelector: form.selector,
        elementInfo: `Form (${form.location}) Required Fields`
      });
    }

    // 3. Validation messages work
    if (!form.validationMessagesWork) {
      score -= 10;
      issues.push({
        issueId: `FRM-003-${idx}`,
        pageUrl,
        category: 'forms',
        severity: 'medium',
        status: 'FAIL',
        title: `Form Lacks Inline Validation Feedback: "${form.location}"`,
        problem: `Form in '${form.location}' does not display accessible error/validation messages when invalid data is entered.`,
        expectedBehavior: 'Forms should display clear inline error messages explaining what needs to be corrected.',
        actualBehavior: 'No visible validation message containers or field-level feedback.',
        recommendation: 'Implement inline error message banners or field-level validation feedback.',
        elementSelector: form.selector,
        elementInfo: `Form (${form.location}) Validation Feedback`
      });
    }

    // 4. Form works on mobile
    if (!form.formWorksOnMobile) {
      score -= 15;
      issues.push({
        issueId: `FRM-004-${idx}`,
        pageUrl,
        category: 'forms',
        severity: 'high',
        status: 'FAIL',
        viewport: '390px × 844px',
        title: `Form Layout Breaks on Mobile Screens: "${form.location}"`,
        problem: `Form in '${form.location}' overflows or fails to stack cleanly on mobile viewports.`,
        expectedBehavior: 'Form fields should stack vertically with 100% width on mobile screens.',
        actualBehavior: 'Form inputs extend past mobile viewport boundaries.',
        recommendation: 'Set input width to 100% and use responsive single-column layout on mobile.',
        elementSelector: form.selector,
        elementInfo: `Form (${form.location}) Mobile Layout`
      });
    }

    // 5. Phone/email fields validate correctly
    if (!form.phoneEmailValidateCorrectly && form.invalidTypeFields && form.invalidTypeFields.length > 0) {
      score -= 10;
      form.invalidTypeFields.forEach((field, itIdx) => {
        issues.push({
          issueId: `FRM-005-${idx}-${itIdx}`,
          pageUrl,
          category: 'forms',
          severity: 'medium',
          status: 'FAIL',
          title: `Incorrect Input Type / Validation for "${field.name}"`,
          problem: `Field '${field.name}' uses type="${field.currentType}" instead of semantic type="${field.suggestedType}".`,
          expectedBehavior: `Input should use type="${field.suggestedType}" to invoke mobile keypad and browser validation.`,
          actualBehavior: `Using type="${field.currentType}" prevents appropriate mobile keyboard and validation.`,
          recommendation: `Change input attribute to type="${field.suggestedType}".`,
          elementSelector: field.selector,
          elementText: field.name,
          elementInfo: `Form (${form.location}) Field Type`
        });
      });
    }
  });

  return {
    score: Math.max(0, score),
    issues
  };
}
