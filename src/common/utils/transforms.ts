import { TransformFnParams } from 'class-transformer';

// Para usar con @Transform() en DTOs. Si el valor no es string se deja igual
// y que lo rechace el validador correspondiente.

export const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : (value as unknown);

export const emailNormalizado = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown);
