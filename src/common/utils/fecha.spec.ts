import {
  esFechaValida,
  finDeMes,
  hoyArgentina,
  inicioDeMes,
  mesesEntre,
  sumarDias,
  sumarMeses,
} from './fecha';

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

  describe('meses', () => {
    it('inicioDeMes y finDeMes, con años bisiestos', () => {
      expect(inicioDeMes('2026-11-05')).toBe('2026-11-01');
      expect(finDeMes('2026-11-05')).toBe('2026-11-30');
      expect(finDeMes('2028-02-10')).toBe('2028-02-29');
      expect(finDeMes('2026-02-10')).toBe('2026-02-28');
      expect(finDeMes('2026-12-31')).toBe('2026-12-31');
    });

    it('sumarMeses devuelve el primer día del mes y cruza años', () => {
      expect(sumarMeses('2026-11-30', -5)).toBe('2026-06-01');
      expect(sumarMeses('2026-11-05', 2)).toBe('2027-01-01');
      expect(sumarMeses('2026-01-31', -1)).toBe('2025-12-01');
    });

    it('mesesEntre incluye ambos extremos, aunque no sean días 1', () => {
      expect(mesesEntre('2026-11-15', '2027-02-03')).toEqual([
        '2026-11',
        '2026-12',
        '2027-01',
        '2027-02',
      ]);
      expect(mesesEntre('2026-11-15', '2026-11-20')).toEqual(['2026-11']);
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
