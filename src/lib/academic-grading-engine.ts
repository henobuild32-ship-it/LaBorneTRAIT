/** Central, configuration-driven academic calculation primitives. */
export type GradeStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'MISSING' | 'EXEMPTED' | 'CANCELLED';
export type AverageMethod = 'WEIGHTED_SUBJECT_AVERAGE' | 'POINTS_RATIO' | 'CUSTOM';

export interface GradeInput {
  value: number | null | undefined;
  maximum: number;
  status?: GradeStatus;
  allowDecimals?: boolean;
}

export interface GradeValidation { valid: boolean; reason?: string }

export interface SubjectResult {
  obtained: number;
  maximum: number;
  percentage: number | null;
  coefficient: number;
  included: boolean;
}

export const AcademicGradingEngine = {
  round(value: number, decimals = 2): number {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  },

  formatAcademicNumber(value: number | null | undefined, decimals = 2): string {
    if (value == null || !Number.isFinite(value)) return '-';
    return this.round(value, decimals).toFixed(decimals);
  },

  validateGrade(input: GradeInput): GradeValidation {
    const { value, maximum, status = 'PRESENT', allowDecimals = true } = input;
    if (!Number.isFinite(maximum) || maximum <= 0) return { valid: false, reason: 'maximum must be greater than zero' };
    if (status !== 'PRESENT') return { valid: value == null, reason: value == null ? undefined : 'non-present grades cannot have a numeric value' };
    if (value == null) return { valid: true };
    if (!Number.isFinite(value)) return { valid: false, reason: 'grade must be finite' };
    if (value < 0 || value > maximum) return { valid: false, reason: 'grade must be between zero and maximum' };
    if (!allowDecimals && !Number.isInteger(value)) return { valid: false, reason: 'decimal grades are not allowed' };
    return { valid: true };
  },

  normalizeGrade(value: number, maximum: number, scale = 100): number {
    const validation = this.validateGrade({ value, maximum });
    if (!validation.valid || !Number.isFinite(scale) || scale < 0) throw new RangeError(validation.reason || 'invalid grade');
    return this.round((value / maximum) * scale);
  },

  calculatePercentage(obtained: number, maximum: number): number {
    if (!Number.isFinite(obtained) || !Number.isFinite(maximum) || maximum <= 0) return 0;
    return this.round((obtained / maximum) * 100);
  },

  calculateTotalPoints(values: Array<number | null | undefined>): number {
    return this.round(values.reduce<number>((sum, value) => sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0), 0));
  },

  calculateMaxPoints(values: Array<number | null | undefined>): number {
    return this.round(values.reduce<number>((sum, value) => sum + (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0), 0));
  },

  calculateAverage(values: number[]): number | null {
    const valid = values.filter(Number.isFinite);
    return valid.length ? this.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  },

  calculateWeightedAverage(values: Array<{ value: number; coefficient: number }>): number | null {
    const valid = values.filter(v => Number.isFinite(v.value) && Number.isFinite(v.coefficient) && v.coefficient > 0);
    const denominator = valid.reduce((sum, v) => sum + v.coefficient, 0);
    return denominator > 0 ? this.round(valid.reduce((sum, v) => sum + v.value * v.coefficient, 0) / denominator) : null;
  },

  calculateSubjectResult(grades: Array<GradeInput & { included?: boolean }>, coefficient = 1): SubjectResult {
    const included = grades.filter(g => g.included !== false && g.status !== 'CANCELLED' && g.status !== 'EXEMPTED');
    const present = included.filter(g => g.status === 'PRESENT' && g.value != null);
    const obtained = this.calculateTotalPoints(present.map(g => g.value));
    const maximum = this.calculateMaxPoints(present.map(g => g.maximum));
    return { obtained, maximum, percentage: maximum > 0 ? this.calculatePercentage(obtained, maximum) : null, coefficient: coefficient > 0 ? coefficient : 0, included: present.length > 0 };
  },

  calculatePeriodResult(subjects: SubjectResult[], method: AverageMethod = 'POINTS_RATIO') {
    const valid = subjects.filter(s => s.included);
    const obtained = this.calculateTotalPoints(valid.map(s => s.obtained));
    const maximum = this.calculateMaxPoints(valid.map(s => s.maximum));
    const percentage = maximum > 0 ? this.calculatePercentage(obtained, maximum) : null;
    const weighted = this.calculateWeightedAverage(valid.filter(s => s.percentage != null).map(s => ({ value: s.percentage as number, coefficient: s.coefficient })));
    return { obtained, maximum, percentage: method === 'WEIGHTED_SUBJECT_AVERAGE' ? weighted : percentage, weightedPercentage: weighted };
  },

  calculateAnnualResult(periods: Array<{ obtained: number; maximum: number }>) {
    const obtained = this.calculateTotalPoints(periods.map(p => p.obtained));
    const maximum = this.calculateMaxPoints(periods.map(p => p.maximum));
    return { obtained, maximum, percentage: maximum > 0 ? this.calculatePercentage(obtained, maximum) : null };
  },

  calculateRanking(scores: Array<{ id: string; score: number }>) {
    const sorted = [...scores].filter(s => Number.isFinite(s.score)).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return sorted.map((item, index) => ({ ...item, rank: index === 0 || item.score !== sorted[index - 1].score ? index + 1 : (sorted[index - 1] as typeof item & { rank: number }).rank }));
  },
};

export default AcademicGradingEngine;
