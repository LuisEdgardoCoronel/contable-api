import { registerDecorator, ValidationOptions } from 'class-validator';
import { esFechaValida } from '../utils/fecha';

/** Fecha `YYYY-MM-DD` (sin hora) que exista en el calendario. */
export function IsFecha(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isFecha',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message: '$property debe ser una fecha válida con formato YYYY-MM-DD',
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && esFechaValida(value),
      },
    });
  };
}
