import { TransformFnParams } from 'class-transformer';

// Para usar con @Transform() en DTOs. Si el valor no es string se deja igual
// y que lo rechace el validador correspondiente.

export const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : (value as unknown);

export const emailNormalizado = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown);

/** Acepta "20-12345678-6" o "20 12345678 6" y deja solo los dígitos. */
export const cuitNormalizado = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.replace(/[\s-]/g, '') : (value as unknown);

/** Strings vacíos (tras recortar) pasan a null. Para campos opcionales. */
export const recortarONull = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') {
    return value as unknown;
  }
  const recortado = value.trim();
  return recortado === '' ? null : recortado;
};

/** Query string "true"/"false" → boolean. Otro valor queda igual y lo rechaza @IsBoolean. */
export const booleanoDeQuery = ({ value }: TransformFnParams): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value as unknown;
};
