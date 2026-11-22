# contable-api

API REST para estudios contables argentinos. Permite al contador administrar su cartera de clientes y los vencimientos impositivos de cada uno (IVA, Ganancias, Ingresos Brutos, Autónomos, Bienes Personales, Monotributo), y darle a cada cliente un acceso de solo lectura para consultar sus propios vencimientos.

Está pensada como backend para un sistema multi-estudio: cada contador ve únicamente su información, y la separación entre estudios se aplica en cada consulta a la base.

## Funcionalidades principales

- **Clientes**: alta, edición, baja lógica y reactivación. Validación de CUIT con dígito verificador, condición frente al IVA, búsqueda por razón social o CUIT y listado paginado.
- **Vencimientos**: alta por cliente, impuesto y período; marcado como presentado (con fecha de presentación) y notas. El estado `vencido` se calcula automáticamente. Filtros por estado, cliente, impuesto y rango de fechas, y un endpoint de próximos vencimientos (próximos 30 días).
- **Acceso para clientes**: el contador crea un usuario para cada cliente (email y contraseña inicial). Ese usuario puede loguearse y consultar sus vencimientos, sin poder modificar nada.
- **Roles**: `admin` (el contador, dueño del estudio) y `cliente` (usuario vinculado a un cliente del estudio).
- **Estadísticas**: un endpoint con el resumen del estudio para un dashboard (clientes activos e inactivos, vencimientos por estado, próximos 30 días, y agrupados por mes y por impuesto).
- **Impuestos**: catálogo fijo cargado por seed, con su periodicidad (mensual o anual).
- **Documentación interactiva** con Swagger en `/docs`.

## Stack tecnológico

| Área | Tecnología |
|---|---|
| Runtime | Node.js 26 |
| Framework | NestJS 12 |
| Lenguaje | TypeScript 6 (modo `strict`) |
| Base de datos | PostgreSQL 16 (Docker en local) |
| ORM | TypeORM, con migraciones |
| Autenticación | JWT (HS256) + Passport, contraseñas con bcryptjs |
| Validación | class-validator / class-transformer, variables de entorno validadas al arrancar con @nestjs/config |
| Documentación | Swagger (@nestjs/swagger) |
| Tests | Jest + Supertest |

## Modelo de acceso

| | Admin (contador) | Cliente |
|---|---|---|
| Clientes | Solo los de su estudio (`cliente.adminId = admin.id`) | Sin acceso (403) |
| Estadísticas | Las de su estudio | Sin acceso (403) |
| Vencimientos (lectura) | Los de sus clientes | Solo los propios |
| Vencimientos (crear, editar, borrar) | Sí, sobre sus clientes | No (403) |
| Impuestos | Lectura | Lectura |

Reglas:

- En esta versión, **un admin equivale a un estudio**.
- `POST /auth/register` siempre crea un admin. Si el body trae un campo `rol`, se ignora.
- Los usuarios cliente los crea el admin desde `POST /clientes/:id/acceso`.
- Si un cliente se da de baja, su usuario deja de poder loguearse, y los tokens que ya tenía dejan de funcionar.

**Aislamiento entre estudios.** Cada consulta filtra en SQL por el estudio del usuario (o por el cliente, si el rol es `cliente`). Un recurso de otro estudio responde **404**, igual que uno inexistente, en lugar de 403: así la API no revela que el recurso existe. Los IDs son UUID, para que no se puedan enumerar.

## Decisiones de diseño destacadas

- **Guards globales.** `JwtAuthGuard` y `RolesGuard` están registrados globalmente, en ese orden. Toda ruta exige JWT salvo las marcadas con `@Public()` (registro y login); las que llevan `@Roles(...)` devuelven 403 si el rol no corresponde. Una ruta nueva nace protegida por defecto.
- **Token revalidado contra la base.** En cada request, la estrategia JWT vuelve a buscar al usuario: si ya no existe o su cliente está dado de baja, responde 401. La baja corta el acceso de inmediato, sin esperar a que venza el token.
- **Login sin filtrar información.** Email inexistente, contraseña incorrecta y cliente inactivo responden igual (401). Si el email no existe se compara igualmente contra un hash, para no revelar por tiempo de respuesta qué emails están registrados.
- **Estado `vencido` calculado, no guardado.** Solo se persisten `pendiente` y `presentado`. Un vencimiento pendiente con fecha anterior a hoy se expone como `vencido` en el campo `estadoActual`. El filtro `?estado=vencido` se resuelve en SQL (`estado = 'pendiente' AND fecha_vencimiento < :hoy`), así que la paginación y el total son correctos.
- **Estadísticas consistentes con el listado.** `GET /estadisticas` cuenta todo en SQL (`COUNT(*) FILTER (...)` y `GROUP BY`) con el mismo filtro de acceso y las mismas condiciones de estado que `GET /vencimientos`, así que sus números coinciden siempre con los `total` del listado.
- **Rate limit en el login.** `POST /auth/login` admite 5 intentos por minuto por IP (configurable con la variable opcional `LOGIN_RATE_LIMIT`); después responde 429. Los contadores se guardan en memoria, así que el límite es por instancia de la app.
- **"Hoy" en hora de Argentina.** La fecha de hoy se calcula siempre en la zona `America/Argentina/Buenos_Aires`, sin depender de la zona horaria del servidor. Las fechas de vencimiento son columnas `date` (`YYYY-MM-DD`, sin hora).
- **Validación de CUIT.** Se verifican los 11 dígitos y el dígito verificador (módulo 11). Se aceptan guiones y espacios, que se quitan antes de guardar. El CUIT es único por estudio: dos estudios pueden tener al mismo cliente.
- **Período según el impuesto.** `periodo` debe ser `YYYY-MM` para impuestos mensuales y `YYYY` para anuales. Un índice único evita vencimientos duplicados para el mismo cliente, impuesto y período.
- **Paginación uniforme.** Todos los listados aceptan `page` y `limit` (por defecto 1 y 20, máximo 100) y responden `{ data, total, page, limit }`.
- **Validación estricta de entrada.** `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`: un campo desconocido en el body da 400.
- **Configuración validada.** La app no arranca si falta una variable de entorno o si `JWT_SECRET` tiene menos de 32 caracteres.
- **Migraciones, nunca `synchronize`.** El esquema se maneja solo con migraciones de TypeORM.

## Cómo correrlo en local

### Requisitos

- Node.js 26 o superior (hay un archivo `.node-version`)
- Docker con Docker Compose

### Pasos

1. Clonar el repositorio e instalar dependencias:

   ```bash
   git clone https://github.com/LuisEdgardoCoronel/contable-api.git
   cd contable-api
   npm install
   ```

2. Crear el archivo de entorno a partir del ejemplo:

   ```bash
   cp .env.example .env
   ```

3. Generar un `JWT_SECRET` (mínimo 32 caracteres) y pegarlo en `.env`. Por ejemplo, con Node:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
   ```

   El resto de los valores de `.env.example` ya coinciden con el `docker-compose.yml`:

   ```env
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5433
   DB_USER=contable
   DB_PASSWORD=contable
   DB_NAME=contable
   JWT_SECRET=<el valor generado>
   JWT_EXPIRES_IN=1d
   LOGIN_RATE_LIMIT=5
   ```

4. Levantar PostgreSQL 16 con Docker. Se expone en el puerto **5433** del host (para no chocar con un Postgres local en el 5432) y usa un volumen persistente:

   ```bash
   docker compose up -d
   ```

5. Correr las migraciones y cargar el seed de impuestos:

   ```bash
   npm run migration:run
   npm run seed
   ```

   El seed es idempotente: se puede correr más de una vez sin duplicar datos.

6. (Opcional) Cargar un estudio de demo:

   ```bash
   npm run seed:demo
   ```

   Crea 5 clientes (uno dado de baja) y unos 70 vencimientos con fechas relativas a hoy, para que siempre haya presentados, vencidos, pendientes y próximos. Credenciales:

   | Rol | Email | Contraseña |
   |---|---|---|
   | Admin | `demo@example.com` | `demo1234` |
   | Cliente (Panadería La Espiga SRL) | `cliente.demo@example.com` | `demo1234` |

   Es idempotente: si se vuelve a correr, reemplaza los datos del estudio de demo y los actualiza a la fecha de hoy. No toca otros estudios y se niega a correr con `NODE_ENV=production`.

7. Arrancar la app en modo desarrollo:

   ```bash
   npm run start:dev
   ```

8. Abrir la documentación en [http://localhost:3000/docs](http://localhost:3000/docs). Para probar los endpoints protegidos: obtener un token con `POST /auth/login` (con las credenciales de demo o con un admin creado con `POST /auth/register`) y cargarlo con el botón **Authorize**.

### Otros scripts

| Script | Uso |
|---|---|
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Corre la versión compilada |
| `npm run migration:generate -- src/database/migrations/<Nombre>` | Genera una migración a partir de los cambios en las entidades |
| `npm run migration:revert` | Revierte la última migración |
| `npm run seed:demo` | Carga o restablece el estudio de demo |
| `npm run limpiar:e2e` | Borra los datos que dejan los e2e (ver [Limpiar datos de e2e](#limpiar-datos-de-e2e)) |
| `npm run lint` | ESLint (con `--fix`) |
| `npm run format` | Prettier |

## Endpoints

Todas las rutas requieren `Authorization: Bearer <token>` salvo las marcadas como públicas.

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/auth/register` | Público | Registra un admin (estudio). Ignora `rol` en el body |
| POST | `/auth/login` | Público | Login. Devuelve `{ accessToken }`. Máximo 5 intentos por minuto por IP (después, 429) |
| GET | `/auth/me` | Autenticado | Perfil del usuario; si es cliente, incluye su `cliente` |
| GET | `/clientes` | Admin | Lista paginada. Filtros: `activo`, `search` (razón social o CUIT) |
| GET | `/clientes/:id` | Admin | Detalle de un cliente |
| POST | `/clientes` | Admin | Crea un cliente |
| PUT | `/clientes/:id` | Admin | Reemplaza los datos; permite reactivar con `activo: true` |
| DELETE | `/clientes/:id` | Admin | Baja lógica (204). Su usuario deja de poder loguearse |
| POST | `/clientes/:id/acceso` | Admin | Crea el usuario cliente vinculado. 409 si ya tiene acceso o está dado de baja |
| GET | `/vencimientos` | Autenticado | Admin: los de sus clientes; cliente: los suyos. Paginado. Filtros: `estado` (`pendiente`, `presentado`, `vencido`), `clienteId`, `impuestoId`, `desde`, `hasta` |
| GET | `/vencimientos/proximos` | Autenticado | No presentados que vencen entre hoy y hoy + 30 días, de clientes activos, ordenados por fecha |
| GET | `/vencimientos/:id` | Autenticado | Detalle de un vencimiento visible para el usuario |
| POST | `/vencimientos` | Admin | Crea un vencimiento `pendiente` para un cliente propio y activo |
| PATCH | `/vencimientos/:id` | Admin | Actualiza `estado`, `fechaPresentacion` y `notas` |
| DELETE | `/vencimientos/:id` | Admin | Elimina un vencimiento (204) |
| GET | `/impuestos` | Autenticado | Catálogo de impuestos |
| GET | `/estadisticas` | Admin | Resumen para el dashboard. Query opcional `desde`/`hasta` (`YYYY-MM-DD`, por defecto los últimos 6 meses) para los agrupamientos por mes y por impuesto |

Códigos de error habituales: `400` validación, `401` sin token o token inválido, `403` rol insuficiente, `404` recurso inexistente o de otro estudio, `409` duplicado o conflicto de estado, `429` demasiados intentos de login.

### Ejemplo: `GET /estadisticas`

Los conteos de `vencimientos` son totales (sin rango de fechas, incluidos clientes dados de baja); `proximos30Dias` excluye los clientes dados de baja, igual que `/vencimientos/proximos`. `porMes` incluye los meses sin vencimientos, en cero, y `porImpuesto` solo los impuestos con vencimientos en el rango, ordenados por nombre.

```json
{
  "hoy": "2026-11-05",
  "rango": { "desde": "2026-06-01", "hasta": "2026-11-30" },
  "clientes": { "activos": 4, "inactivos": 1 },
  "vencimientos": { "pendientes": 18, "vencidos": 6, "presentados": 43, "proximos30Dias": 8 },
  "porMes": [
    { "mes": "2026-06", "pendientes": 0, "vencidos": 0, "presentados": 9 },
    { "mes": "2026-10", "pendientes": 0, "vencidos": 4, "presentados": 5 },
    { "mes": "2026-11", "pendientes": 9, "vencidos": 0, "presentados": 0 }
  ],
  "porImpuesto": [
    {
      "impuesto": { "id": "cba9ef92-011e-48cd-b743-33725cac7177", "codigo": "IVA", "nombre": "IVA" },
      "pendientes": 3, "vencidos": 1, "presentados": 14
    }
  ]
}
```

(Respuesta recortada: con el rango por defecto `porMes` trae los 6 meses.)

## Tests

```bash
# Unitarios (src/**/*.spec.ts)
npm test

# Cobertura de los unitarios
npm run test:cov

# End-to-end (test/*.e2e-spec.ts)
npm run test:e2e
```

Los unitarios cubren el cálculo de la fecha de hoy en Argentina (incluido el cambio de día respecto de UTC), la aritmética de fechas y la validación de CUIT.

Los e2e levantan la app completa y corren contra la base configurada en `.env`, así que requieren Postgres levantado, las migraciones aplicadas y el seed cargado. Usan emails aleatorios y borran lo que crean al terminar.

Cubren especialmente el **aislamiento de datos**, el riesgo principal del sistema:

- Un admin no puede ver, editar, borrar ni dar acceso a clientes de otro estudio (404).
- Un admin no puede ver, editar ni borrar vencimientos de otro estudio (404).
- Un usuario cliente solo ve sus propios vencimientos, también en `/vencimientos/proximos`.
- Un usuario cliente no puede crear, editar ni borrar vencimientos, ni usar `/clientes` (403).
- La baja de un cliente bloquea su login y también invalida el token que ya tenía.
- `register` ignora un `rol` enviado en el body y crea un admin.
- Las estadísticas de un admin no cuentan datos de otro estudio, y un usuario cliente no puede pedirlas (403).

También cubren validaciones (CUIT, fechas, período según el impuesto, campos desconocidos), duplicados (409), el cálculo y filtrado del estado `vencido` con paginación, las reglas de `fechaPresentacion`, que las estadísticas coincidan con los totales del listado y el 429 del login.

El rate limit del login está desactivado en los e2e (todos los requests salen de la misma IP), salvo en el test que lo verifica.

### Limpiar datos de e2e

```bash
npm run limpiar:e2e
```

Borra, en una sola transacción, los usuarios admin cuyo email empieza con `e2e-` y termina en `@example.com` (los que crean, por ejemplo, los e2e de `contable-dashboard`), junto con sus clientes, los usuarios cliente vinculados y los vencimientos de esos clientes, y muestra cuántos registros de cada tipo borró. Nunca toca `demo@example.com` ni `cliente.demo@example.com`, y se niega a correr con `NODE_ENV=production`.

## Panel web

El frontend de esta API es [contable-dashboard](https://github.com/LuisEdgardoCoronel/contable-dashboard), el panel web para el contador y sus clientes.


## Licencia

[MIT](LICENSE)
