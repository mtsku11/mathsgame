import { describe, expect, it } from 'vitest';
import { capIds, capShades, caps, contrast } from '../../src/ui/art/caps';

describe('switch-cap colours', () => {
  it('offers a fixed palette', () => { expect(caps.map(spec => spec.id)).toEqual([...capIds]); });
  for (const spec of caps) {
    it(`${spec.id}: the numeral and picture ink meets WCAG AA on every shade the button shows`, () => {
      const shades = capShades(spec);
      for (const [name, shade] of Object.entries(shades)) expect(contrast(spec.ink, shade), `${spec.id} ${name}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
