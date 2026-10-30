import { QueryFailedError } from 'typeorm';

const PG_UNIQUE_VIOLATION = '23505';

/**
 * true si el error es una violación de índice único de Postgres. Si se pasa
 * `constraint`, además tiene que ser ese índice en particular.
 */
export function esViolacionUnica(error: unknown, constraint?: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as {
    code?: string;
    constraint?: string;
  };
  return (
    driverError.code === PG_UNIQUE_VIOLATION &&
    (constraint === undefined || driverError.constraint === constraint)
  );
}
