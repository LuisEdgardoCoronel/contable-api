import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1793218221580 implements MigrationInterface {
  name = 'Init1793218221580';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."usuario_rol" AS ENUM('admin', 'cliente')`,
    );
    await queryRunner.query(
      `CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying NOT NULL, "password" character varying NOT NULL, "rol" "public"."usuario_rol" NOT NULL, "nombre" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_usuarios_email" UNIQUE ("email"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cliente_condicion_iva" AS ENUM('responsable_inscripto', 'monotributista', 'exento', 'consumidor_final', 'no_alcanzado')`,
    );
    await queryRunner.query(
      `CREATE TABLE "clientes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "razon_social" character varying NOT NULL, "cuit" character varying(11) NOT NULL, "email" character varying NOT NULL, "telefono" character varying, "condicion_iva" "public"."cliente_condicion_iva" NOT NULL, "activo" boolean NOT NULL DEFAULT true, "admin_id" uuid NOT NULL, "usuario_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_clientes_admin_cuit" UNIQUE ("admin_id", "cuit"), CONSTRAINT "REL_edcf87e2f9017c3bd010d54b2d" UNIQUE ("usuario_id"), CONSTRAINT "PK_d76bf3571d906e4e86470482c08" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."impuesto_periodicidad" AS ENUM('mensual', 'anual')`,
    );
    await queryRunner.query(
      `CREATE TABLE "impuestos" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "codigo" character varying NOT NULL, "nombre" character varying NOT NULL, "periodicidad" "public"."impuesto_periodicidad" NOT NULL, CONSTRAINT "uq_impuestos_codigo" UNIQUE ("codigo"), CONSTRAINT "PK_41e908001f733b37a9423d1804c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vencimiento_estado" AS ENUM('pendiente', 'presentado')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vencimientos" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "cliente_id" uuid NOT NULL, "impuesto_id" uuid NOT NULL, "fecha_vencimiento" date NOT NULL, "periodo" character varying(7) NOT NULL, "estado" "public"."vencimiento_estado" NOT NULL DEFAULT 'pendiente', "fecha_presentacion" date, "notas" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_vencimientos_cliente_impuesto_periodo" UNIQUE ("cliente_id", "impuesto_id", "periodo"), CONSTRAINT "PK_473832cecdecc56ba38f4f37e61" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ADD CONSTRAINT "FK_f3c1adbec1033e5e45630d32df9" FOREIGN KEY ("admin_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ADD CONSTRAINT "FK_edcf87e2f9017c3bd010d54b2d1" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vencimientos" ADD CONSTRAINT "FK_f9c456d4320389ae55147231758" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vencimientos" ADD CONSTRAINT "FK_0d028e5d35859c8162345e65b2a" FOREIGN KEY ("impuesto_id") REFERENCES "impuestos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vencimientos" DROP CONSTRAINT "FK_0d028e5d35859c8162345e65b2a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vencimientos" DROP CONSTRAINT "FK_f9c456d4320389ae55147231758"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" DROP CONSTRAINT "FK_edcf87e2f9017c3bd010d54b2d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" DROP CONSTRAINT "FK_f3c1adbec1033e5e45630d32df9"`,
    );
    await queryRunner.query(`DROP TABLE "vencimientos"`);
    await queryRunner.query(`DROP TYPE "public"."vencimiento_estado"`);
    await queryRunner.query(`DROP TABLE "impuestos"`);
    await queryRunner.query(`DROP TYPE "public"."impuesto_periodicidad"`);
    await queryRunner.query(`DROP TABLE "clientes"`);
    await queryRunner.query(`DROP TYPE "public"."cliente_condicion_iva"`);
    await queryRunner.query(`DROP TABLE "usuarios"`);
    await queryRunner.query(`DROP TYPE "public"."usuario_rol"`);
  }
}
