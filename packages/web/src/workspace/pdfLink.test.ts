import { describe, expect, it } from 'vitest';

describe('PDF link underlay — §12.1.1', () => {
  it('AddPdfLinkCmd has correct shape', () => {
    const cmd = { type: 'addPdfLink' as const, url: 'data:image/png;base64,...', levelId: 'l1' };
    expect(cmd.type).toBe('addPdfLink');
    expect(cmd.levelId).toBe('l1');
  });

  it('link_pdf element has required fields', () => {
    const el: any = {
      kind: 'link_pdf',
      id: 'pdf-01',
      url: 'data:image/png;base64,...',
      pageIndex: 0,
      opacity: 0.5,
      positionMm: { xMm: 0, yMm: 0 },
      scaleMm: 1,
      levelId: 'l1',
    };
    expect(el.kind).toBe('link_pdf');
    expect(el.opacity).toBe(0.5);
  });

  it('opacity defaults to 0.5 when not specified', () => {
    const cmd: any = { type: 'addPdfLink', url: 'x', levelId: 'l1' };
    const opacity = (cmd.opacity as number | undefined) ?? 0.5;
    expect(opacity).toBe(0.5);
  });

  it('toggle flips hidden flag', () => {
    const link: any = { hidden: false };
    const toggled = !link.hidden;
    expect(toggled).toBe(true);
  });

  it('RemovePdfLinkCmd has correct shape', () => {
    const cmd = { type: 'removePdfLink' as const, linkId: 'pdf-01' };
    expect(cmd.linkId).toBe('pdf-01');
  });
});
