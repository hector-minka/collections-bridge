import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './services/collections.service';
import { LedgerService } from './services/ledger.service';
import { CollectionEntity } from './entities/collection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CollectionEntity])],
  controllers: [CollectionsController],
  providers: [CollectionsService, LedgerService],
  exports: [CollectionsService, LedgerService],
})
export class CollectionsModule {}
