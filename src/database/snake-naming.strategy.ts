import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

function snakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/** Propiedades en camelCase → columnas en snake_case (fechaVencimiento → fecha_vencimiento). */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    return snakeCase(
      [...embeddedPrefixes, customName ?? propertyName].join('_'),
    );
  }

  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
  ): string {
    return snakeCase(
      `${firstTableName}_${firstPropertyName.replace(/\./g, '_')}_${secondTableName}`,
    );
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snakeCase(`${tableName}_${columnName ?? propertyName}`);
  }
}
