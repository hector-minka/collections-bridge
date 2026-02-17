import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIntentDto {
  @ApiProperty()
  @IsString()
  merchantTxId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  custom?: Record<string, any>;
}
