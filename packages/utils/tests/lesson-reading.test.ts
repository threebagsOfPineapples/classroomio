import { describe, expect, it } from 'vitest';
import { getLessonDocumentIdentity, getPdfReadingResource } from '../src/functions/lesson-document';
import { getReadingRequirements, isReadingComplete } from '../src/functions/lesson-reading';

describe('PDF reading resource identities', () => {
  it('keeps uploaded document identities compatible and uses the asset for external PDFs', () => {
    expect(getLessonDocumentIdentity({ key: 'documents/onboarding.pdf', assetId: 'asset-1' })).toBe(
      'documents/onboarding.pdf'
    );
    expect(getLessonDocumentIdentity({ key: ' company intro.pdf ' })).toBe(' company intro.pdf ');
    expect(getPdfReadingResource({ type: 'application/pdf', name: '公司介绍', key: '', assetId: 'asset-1' })).toBe(
      'pdf:asset:asset-1'
    );
    expect(getPdfReadingResource({ type: 'pdf', name: '公司介绍', key: '   ' })).toBeNull();
    expect(getPdfReadingResource({ type: 'docx', name: '岗位手册', key: '', assetId: 'asset-2' })).toBeNull();
  });

  it('requires both sufficient time and the external PDF page-end resource', () => {
    const requirements = getReadingRequirements({
      completionPolicy: 'manual',
      documents: [{ type: 'application/pdf', name: '公司介绍.pdf', key: '', assetId: 'asset-1' }],
      lessonLanguages: [{ locale: 'zh', content: '<p>公司介绍</p>' }]
    });

    expect(requirements.supported).toBe(true);
    expect(requirements.resources).toEqual(['note', 'pdf:asset:asset-1']);
    expect(isReadingComplete(requirements, requirements.requiredSeconds, ['note'])).toBe(false);
    expect(isReadingComplete(requirements, requirements.requiredSeconds - 1, requirements.resources)).toBe(false);
    expect(isReadingComplete(requirements, requirements.requiredSeconds, requirements.resources)).toBe(true);
  });

  it('continues rejecting PDF documents without a persistent identity', () => {
    const requirements = getReadingRequirements({
      completionPolicy: 'manual',
      documents: [{ type: 'pdf', name: '公司介绍.pdf', key: '' }],
      lessonLanguages: [{ locale: 'zh', content: '公司介绍' }]
    });

    expect(requirements.supported).toBe(false);
  });
});
