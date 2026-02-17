import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CollectionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  merchantTxId: string;

  @ApiPropertyOptional()
  anchorHandle?: string;

  @ApiPropertyOptional()
  intentHandle?: string;

  @ApiPropertyOptional()
  schema?: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  anchorData?: Record<string, any>;

  @ApiPropertyOptional()
  intentData?: Record<string, any>;

  @ApiPropertyOptional()
  fulfillmentEvidence?: Record<string, any>;

  @ApiPropertyOptional()
  fulfilledAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
