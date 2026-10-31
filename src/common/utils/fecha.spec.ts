import { esFechaValida, hoyArgentina, sumarDias } from './fecha';

describe('fecha', () => {
  describe('hoyArgentina', () => {
    it('usa la fecha de Argentina aunque en UTC ya sea el día siguiente', () => {
      // 02:00 UTC del 15/03 = 23:00 del 14/03 en Argentina (UTC-3).
      expect(hoyArgentina(new Date('2026-03-15T02:00:00Z'))).toBe('2026-03-14');
    });

    it('cambia de día a las 00:00 de Argentina (03:00 UTC)', () => {
      expect(hoyArgentina(new Date('2026-03-15T03:00:00Z'))).toBe('2026-03-15');
    });
  });

  describe('sumarDias', () => {
    it('cruza meses y años', () => {
      expect(sumarDias('2026-12-15', 30)).toBe('2027-01-14');
      expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
      expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    });
  });

  describe('esFechaValida', () => {
    it.each(['2026-01-31', '2028-02-29'])('acepta %s', (f) => {
      expect(esFechaValida(f)).toBe(true);
    });

    it.each([
      '2026-02-30',
      '2026-13-01',
      '2027-02-29',
      '2026-1-5',
      '2026-01-01T00:00:00Z',
      '',
    ])('rechaza %s', (f) => {
      expect(esFechaValida(f)).toBe(false);
    });
  });
});
