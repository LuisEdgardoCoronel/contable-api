import { esCuitValido } from './is-cuit.validator';

describe('esCuitValido', () => {
  it.each(['20123456786', '30712345671', '27123456780'])(
    'acepta %s',
    (cuit) => {
      expect(esCuitValido(cuit)).toBe(true);
    },
  );

  it.each([
    ['dígito verificador incorrecto', '20123456785'],
    ['menos de 11 dígitos', '2012345678'],
    ['más de 11 dígitos', '201234567861'],
    ['con guiones', '20-12345678-6'],
    ['con letras', '2012345678A'],
    ['vacío', ''],
  ])('rechaza %s', (_caso, cuit) => {
    expect(esCuitValido(cuit)).toBe(false);
  });

  it('rechaza los CUIT cuyo verificador calculado da 10', () => {
    // 20-00000001-?: suma = 10 + 2 = 12 → 12 % 11 = 1 → 11 - 1 = 10.
    for (let d = 0; d <= 9; d++) {
      expect(esCuitValido(`2000000001${d}`)).toBe(false);
    }
  });
});
