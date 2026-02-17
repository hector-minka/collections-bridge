import { IsString, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// This matches the actual format from the Ledger webhook
class AnchorDataInnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  handle?: string;

  /** Can be string (handle) or object with handle + custom (e.g. { handle, custom: { merchantCode } }) */
  @ApiPropertyOptional({ description: 'Target handle or object with handle and custom' })
  @IsOptional()
  target?: string | Record<string, any>;

  @ApiPropertyOptional({ enum: ['qr-code', 'dynamic-key'] })
  @IsOptional()
  @IsString()
  schema?: 'qr-code' | 'dynamic-key';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  custom?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Symbol handle or object with handle' })
  @IsOptional()
  symbol?: string | { handle?: string };

  @ApiPropertyOptional()
  @IsOptional()
  amount?: number;

  // Allow additional fields
  [key: string]: any;
}

class AnchorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AnchorDataInnerDto)
  data?: AnchorDataInnerDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  luid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  // Allow additional fields
  [key: string]: any;
}

class EventDataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  handle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AnchorDto)
  anchor?: AnchorDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signal?: string; // 'anchor-created'

  // Allow additional fields
  [key: string]: any;
}

export class AnchorCreatedEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => EventDataDto)
  data?: EventDataDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  // Allow additional fields from ledger that we don't validate
  [key: string]: any;
}
