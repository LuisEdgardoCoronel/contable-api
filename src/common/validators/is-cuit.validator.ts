import { registerDecorator, ValidationOptions } from 'class-validator';

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/**
 * Valida un CUIT/CUIL de 11 dígitos (sin guiones) con su dígito verificador
 * (módulo 11). Si el cálculo da 10, el número no es válido: AFIP/ARCA nunca
 * asigna esos CUIT (cambia el prefijo a 23/33).
 */
export function esCuitValido(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) {
    return false;
  }
  const suma = PESOS.reduce((acc, peso, i) => acc + peso * Number(cuit[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto;
  return verificador !== 10 && verificador === Number(cuit[10]);
}

/** CUIT de 11 dígitos con dígito verificador correcto. */
export function IsCuit(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isCuit',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message: '$property debe ser un CUIT válido de 11 dígitos',
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && esCuitValido(value),
      },
    });
  };
}
