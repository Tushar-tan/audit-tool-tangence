import { CategoryScores } from '../types/audit';

export function calculateLetterGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function calculatePageScores(
  headerNavScore: number,
  visualDesignScore: number,
  responsiveScore: number,
  contentScore: number,
  buttonsCtasScore: number,
  formsScore: number,
  linksScore: number,
  imagesMediaScore: number,
  seoOnPageScore: number,
  technicalSeoScore: number,
  securityScore: number
): CategoryScores {
  // Equal-weighted average of the 11 explicit checklist categories (~9.09% each)
  const overall = Math.round(
    (headerNavScore +
      visualDesignScore +
      responsiveScore +
      contentScore +
      buttonsCtasScore +
      formsScore +
      linksScore +
      imagesMediaScore +
      seoOnPageScore +
      technicalSeoScore +
      securityScore) /
      11
  );

  const overallGrade = calculateLetterGrade(overall);

  return {
    overall,
    overallGrade,
    headerNav: headerNavScore,
    visualDesign: visualDesignScore,
    responsive: responsiveScore,
    content: contentScore,
    buttonsCtas: buttonsCtasScore,
    forms: formsScore,
    links: linksScore,
    imagesMedia: imagesMediaScore,
    seoOnPage: seoOnPageScore,
    technicalSeo: technicalSeoScore,
    security: securityScore,

    // Legacy aliases for backward compatibility
    typographyContent: contentScore,
    errorStates: technicalSeoScore,
    seoUx: seoOnPageScore
  };
}

export function aggregateSiteScores(pageScoresList: CategoryScores[]): CategoryScores {
  if (pageScoresList.length === 0) {
    return {
      overall: 0,
      overallGrade: 'F',
      headerNav: 0,
      visualDesign: 0,
      responsive: 0,
      content: 0,
      buttonsCtas: 0,
      forms: 0,
      links: 0,
      imagesMedia: 0,
      seoOnPage: 0,
      technicalSeo: 0,
      security: 0,
      typographyContent: 0,
      errorStates: 0,
      seoUx: 0
    };
  }

  const sum = pageScoresList.reduce(
    (acc, curr) => ({
      overall: acc.overall + curr.overall,
      headerNav: acc.headerNav + curr.headerNav,
      visualDesign: acc.visualDesign + curr.visualDesign,
      responsive: acc.responsive + curr.responsive,
      content: acc.content + (curr.content ?? curr.typographyContent ?? 0),
      buttonsCtas: acc.buttonsCtas + curr.buttonsCtas,
      forms: acc.forms + curr.forms,
      links: acc.links + curr.links,
      imagesMedia: acc.imagesMedia + curr.imagesMedia,
      seoOnPage: acc.seoOnPage + (curr.seoOnPage ?? curr.seoUx ?? 0),
      technicalSeo: acc.technicalSeo + (curr.technicalSeo ?? curr.errorStates ?? 0),
      security: acc.security + (curr.security ?? 0)
    }),
    {
      overall: 0,
      headerNav: 0,
      visualDesign: 0,
      responsive: 0,
      content: 0,
      buttonsCtas: 0,
      forms: 0,
      links: 0,
      imagesMedia: 0,
      seoOnPage: 0,
      technicalSeo: 0,
      security: 0
    }
  );

  const count = pageScoresList.length;
  const overallAvg = Math.round(sum.overall / count);
  const contentAvg = Math.round(sum.content / count);
  const technicalSeoAvg = Math.round(sum.technicalSeo / count);
  const seoOnPageAvg = Math.round(sum.seoOnPage / count);

  return {
    overall: overallAvg,
    overallGrade: calculateLetterGrade(overallAvg),
    headerNav: Math.round(sum.headerNav / count),
    visualDesign: Math.round(sum.visualDesign / count),
    responsive: Math.round(sum.responsive / count),
    content: contentAvg,
    buttonsCtas: Math.round(sum.buttonsCtas / count),
    forms: Math.round(sum.forms / count),
    links: Math.round(sum.links / count),
    imagesMedia: Math.round(sum.imagesMedia / count),
    seoOnPage: seoOnPageAvg,
    technicalSeo: technicalSeoAvg,
    security: Math.round(sum.security / count),

    // Legacy aliases
    typographyContent: contentAvg,
    errorStates: technicalSeoAvg,
    seoUx: seoOnPageAvg
  };
}
