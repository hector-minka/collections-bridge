import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('collections')
@Index(['merchantTxId'])
@Index(['anchorHandle'])
@Index(['intentHandle'])
export class CollectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Index()
  merchantTxId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  anchorHandle: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  intentHandle: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  schema: string; // 'qr-code' | 'dynamic-key'

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status: string; // 'PENDING' | 'COMPLETED' | 'CANCELLED'

  @Column({ type: 'jsonb', nullable: true })
  anchorData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  intentData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  fulfillmentEvidence: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  fulfilledAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
