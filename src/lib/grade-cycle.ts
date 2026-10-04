export function isSecondaryClass(classInfo: { cycle?: string; level?: string } | null | undefined): boolean {
  if (!classInfo) return false;
  const cycle = (classInfo.cycle || '').toLowerCase();
  const level = (classInfo.level || '').toLowerCase();

  return cycle === 'eb'
    || cycle === 'humanites'
    || cycle === 'secondaire'
    || level.includes('humanit')
    || level.includes('eb')
    || level.includes('7e')
    || level.includes('8e');
}
