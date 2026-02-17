import {
  IsString,
  IsNumber,
  IsObject,
  IsOptional,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RtpWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  merchantTxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trxid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rrn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  artifactPayload?: string;

  @ApiProperty()
  @IsNumber()
  paidAmount: number;

  @ApiProperty()
  @IsString()
  currency: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payer?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fulfillmentTimestamp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  rawNetworkPayload?: Record<string, any>;
}
