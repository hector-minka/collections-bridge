import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCollectionsTable1736698762000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'collections',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'merchantTxId',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'anchorHandle',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'intentHandle',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'schema',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'PENDING'",
          },
          {
            name: 'anchorData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'intentData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'fulfillmentEvidence',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'fulfilledAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'collections',
      new TableIndex({
        name: 'IDX_collections_merchantTxId',
        columnNames: ['merchantTxId'],
      }),
    );

    await queryRunner.createIndex(
      'collections',
      new TableIndex({
        name: 'IDX_collections_anchorHandle',
        columnNames: ['anchorHandle'],
      }),
    );

    await queryRunner.createIndex(
      'collections',
      new TableIndex({
        name: 'IDX_collections_intentHandle',
        columnNames: ['intentHandle'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('collections');
  }
}
