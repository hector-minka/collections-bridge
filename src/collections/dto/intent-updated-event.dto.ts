import { IsObject, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for Ledger intent-updated event payload (what RTP sends to this webhook).
 * Structure: { data: { signal, intent: { data: { handle, claims, ... }, meta }, parent }, hash, meta }
 */
export class IntentUpdatedEventDto {
  @ApiPropertyOptional({
    description:
      'Event payload: data.signal (e.g. "intent-updated"), data.intent (intent record with data.handle, data.claims)',
  })
  @IsOptional()
  @IsObject()
  data?: {
    handle?: string;
    signal?: string;
    intent?: {
      data?: {
        handle?: string;
        claims?: Array<{
          action?: string;
          amount?: number;
          symbol?: { handle?: string };
          source?: Record<string, unknown>;
          target?: Record<string, unknown>;
          [key: string]: unknown;
        }>;
        custom?: Record<string, unknown>;
        config?: Record<string, unknown>;
        access?: unknown[];
        [key: string]: unknown;
      };
      meta?: { moment?: string; status?: string; [key: string]: unknown };
      hash?: string;
      luid?: string;
      [key: string]: unknown;
    };
    parent?: Record<string, unknown>;
    [key: string]: unknown;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
