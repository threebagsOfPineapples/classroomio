export function genQuizPin(): number {
  const minm = 100000;
  const maxm = 999999;
  return Math.floor(Math.random() * (maxm - minm + 1)) + minm;
}

export function generateSitename(orgName: string): string {
  const normalizedName = orgName.trim();
  if (!normalizedName) return '';

  const slug = normalizedName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
  if (slug.length >= 5) return slug;

  const hash = Array.from(normalizedName).reduce(
    (value, character) => (Math.imul(value, 31) + character.codePointAt(0)!) >>> 0,
    0
  );
  return `org-${hash.toString(36).padStart(7, '0')}`;
}
