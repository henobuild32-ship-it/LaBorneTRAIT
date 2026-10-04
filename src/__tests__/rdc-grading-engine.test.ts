import { describe, expect, it } from 'vitest';
import {
  computeSubjectDetail,
  detectCycle,
  evaluateAdministrativeDecision,
  getRdcMention,
} from '@/lib/rdc-grading-engine';

describe('moteur de notation RDC : détection du cycle', () => {
  it('détecte la maternelle', () => {
    expect(detectCycle({ name: 'Grande Section' })).toBe('MATERNELLE');
    expect(detectCycle({ name: 'Maternelle A' })).toBe('MATERNELLE');
    expect(detectCycle({ cycle: 'maternelle' })).toBe('MATERNELLE');
  });

  it('détecte les humanités', () => {
    expect(detectCycle({ name: '3ème Humanite A' })).toBe('HUMANITES');
    expect(detectCycle({ name: '6ème Scientifique' })).toBe('HUMANITES');
    expect(detectCycle({ level: 'humanites' })).toBe('HUMANITES');
  });

  it('détecte l’éducation de base par défaut', () => {
    expect(detectCycle({ name: '5ème Année' })).toBe('EDUCATION_DE_BASE');
    expect(detectCycle({ name: '1ère Prim' })).toBe('EDUCATION_DE_BASE');
    expect(detectCycle(null)).toBe('EDUCATION_DE_BASE');
    expect(detectCycle(undefined)).toBe('EDUCATION_DE_BASE');
  });
});

describe('moteur de notation RDC : mentions', () => {
  it('applique les seuils officiels', () => {
    expect(getRdcMention(80)).toBe('Très Grande Distinction (TGD)');
    expect(getRdcMention(79.9)).toBe('Grande Distinction (GD)');
    expect(getRdcMention(70)).toBe('Grande Distinction (GD)');
    expect(getRdcMention(60)).toBe('Distinction (D)');
    expect(getRdcMention(50)).toBe('Satisfaction (S)');
    expect(getRdcMention(49.9)).toBe('Ajourné / Insuffisant');
    expect(getRdcMention(0)).toBe('Ajourné / Insuffisant');
  });
});

describe('moteur de notation RDC : calcul d’une matière', () => {
  it('utilise les maxima par défaut TJ 40 % / Examen 60 %', () => {
    const detail = computeSubjectDetail({ courseId: 'c1', courseName: 'Mathématiques' });
    expect(detail.maxTJ_S1).toBe(40);
    expect(detail.maxExam1).toBe(60);
    expect(detail.maxTJ1).toBe(20);
    expect(detail.maxTJ2).toBe(20);
    expect(detail.maxS1).toBe(100);
    expect(detail.maxAnnual).toBe(200);
    expect(detail.percentageAnnual).toBe(0);
    expect(detail.isPassed).toBe(false);
  });

  it('additionne correctement les notes du semestre 1', () => {
    const detail = computeSubjectDetail({
      courseId: 'c1',
      courseName: 'Mathématiques',
      tj1: 18,
      tj2: 17,
      exam1: 45,
    });
    expect(detail.totalTJ1).toBe(35);
    expect(detail.totalS1).toBe(80);
    expect(detail.percentageS1).toBe(80);
    // S2 vide : total annuel 80 / 200
    expect(detail.percentageAnnual).toBe(40);
    expect(detail.isPassed).toBe(false);
  });

  it('valide l’année complète au-dessus de 50 %', () => {
    const detail = computeSubjectDetail({
      courseId: 'c1',
      courseName: 'Français',
      tj1: 20,
      tj2: 20,
      exam1: 60,
      tj3: 20,
      tj4: 20,
      exam2: 60,
    });
    expect(detail.totalAnnual).toBe(200);
    expect(detail.percentageAnnual).toBe(100);
    expect(detail.isPassed).toBe(true);
    expect(getRdcMention(detail.percentageAnnual)).toBe('Très Grande Distinction (TGD)');
  });

  it('respecte une règle de coefficient et de maxima personnalisés', () => {
    const detail = computeSubjectDetail(
      { courseId: 'c2', courseName: 'Physique', tj1: 4, tj2: 4, exam1: 6 },
      { courseId: 'c2', courseName: 'Physique', maximumPoints: 20, dailyWorkMaximum: 8, examMaximum: 12, coefficient: 3 }
    );
    expect(detail.maxTJ_S1).toBe(8);
    expect(detail.maxTJ1).toBe(4);
    expect(detail.maxTJ2).toBe(4);
    expect(detail.maxExam1).toBe(12);
    expect(detail.coefficient).toBe(3);
    expect(detail.totalS1).toBe(14);
    expect(detail.percentageS1).toBe(70);
  });

  it('gère les notes manquantes sans planter', () => {
    const detail = computeSubjectDetail({ courseId: 'c3', courseName: 'Histoire', tj1: 15 });
    expect(detail.tj2).toBeNull();
    expect(detail.exam1).toBeNull();
    expect(detail.totalS1).toBe(15);
    expect(detail.percentageS1).toBe(15);
    // 15 / 200 points annuels = 7,5 %
    expect(detail.percentageAnnual).toBe(7.5);
    expect(detail.isPassed).toBe(false);
  });
});

describe('moteur de notation RDC : décision administrative', () => {
  const base = { courseId: 'c1', courseName: 'Mathématiques' };

  /** Matière à 45 % : échec (<50) mais sans note éliminatoire (>=35). */
  const weakSubject = () =>
    computeSubjectDetail({ ...base, courseName: 'Anglais', tj1: 20, tj2: 20, exam1: 50 });

  it('PASSE quand tout est au-dessus de 50 %', () => {
    const subjects = [computeSubjectDetail({ ...base, tj1: 20, tj2: 20, exam1: 60, tj3: 20, tj4: 20, exam2: 60 })];
    const result = evaluateAdministrativeDecision(90, subjects);
    expect(result.decision).toBe('PASSED');
    expect(result.decisionLabel).toBe('PASSE');
    expect(result.failedCount).toBe(0);
  });

  it('PASSE (DÉLIBÉRÉ) avec une matière sous 50 % mais aucune note éliminatoire', () => {
    const good = computeSubjectDetail({ ...base, tj1: 20, tj2: 20, exam1: 60, tj3: 20, tj4: 20, exam2: 60 });
    const weak = weakSubject();
    expect(weak.percentageAnnual).toBe(45);
    const result = evaluateAdministrativeDecision(55, [good, weak]);
    expect(result.failedCount).toBe(1);
    expect(result.decision).toBe('PASSED');
    expect(result.decisionLabel).toBe('PASSE (DÉLIBÉRÉ)');
  });

  it('REPÊCHAGE entre le seuil de repêchage et la moyenne', () => {
    const result = evaluateAdministrativeDecision(46, [weakSubject()]);
    expect(result.decision).toBe('RETAKE_REQUIRED');
    expect(result.decisionLabel).toBe('REPÊCHAGE (AJOURNÉ)');
  });

  it('DOUBLE en dessous du seuil de repêchage', () => {
    const weak = computeSubjectDetail({ ...base, tj1: 10, tj2: 10, exam1: 30, tj3: 10, tj4: 10, exam2: 0 });
    const result = evaluateAdministrativeDecision(30, [weak]);
    expect(result.decision).toBe('FAILED');
    expect(result.decisionLabel).toBe('DOUBLE');
  });

  it('DOUBLE malgré la moyenne globale si une note est éliminatoire', () => {
    const good = computeSubjectDetail({ ...base, tj1: 20, tj2: 20, exam1: 60, tj3: 20, tj4: 20, exam2: 60 });
    const eliminated = computeSubjectDetail({ courseId: 'c2', courseName: 'Physique', tj1: 5, tj2: 5, exam1: 30, tj3: 5, tj4: 5, exam2: 0 });
    const result = evaluateAdministrativeDecision(55, [good, eliminated]);
    expect(result.decision).toBe('FAILED');
    expect(result.decisionLabel).toBe('DOUBLE');
  });

  it('respecte une configuration personnalisée (seuils modifiables)', () => {
    const weak = weakSubject();
    const strict = evaluateAdministrativeDecision(46, [weak], { passPercentage: 60, retakeMinPercentage: 40 });
    expect(strict.decision).toBe('RETAKE_REQUIRED');
    const strictAgain = evaluateAdministrativeDecision(46, [weak], { passPercentage: 60, retakeMinPercentage: 50 });
    expect(strictAgain.decision).toBe('FAILED');
  });
});
