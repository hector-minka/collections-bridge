import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { CollectionEntity } from '../collections/entities/collection.entity';
import { CreateCollectionsTable1736698762000 } from './1736698762000-CreateCollectionsTable';

config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5434', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'collections_bridge',
  entities: [CollectionEntity],
  migrations: [CreateCollectionsTable1736698762000],
  synchronize: false,
  logging: true,
});

dataSource
  .initialize()
  .then(async () => {
    console.log('Data Source has been initialized!');
    const migrations = await dataSource.runMigrations();
    console.log(`Executed ${migrations.length} migration(s)`);
    await dataSource.destroy();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during migration:', error);
    process.exit(1);
  });
