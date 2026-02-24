import { IsOptional, IsString, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Permissive DTO for anchor-proofs-added webhook. Extra or different fields are accepted;
 * the bridge does not fail on unknown or new properties.
 */
export class AnchorProofsAddedEventDto {
  @ApiPropertyOptional({ description: 'Hash of data content' })
  @IsOptional()
  @IsString()
  hash?: string;

  @ApiPropertyOptional({
    description: 'Event data (handle, signal, anchor, proofs, or any other fields)',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Meta (e.g. ledger proofs)' })
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;

  [key: string]: unknown;
}
