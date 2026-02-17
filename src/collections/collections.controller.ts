import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CollectionsService } from './services/collections.service';
import { AnchorCreatedEventDto } from './dto/anchor-created-event.dto';
import { IntentUpdatedEventDto } from './dto/intent-updated-event.dto';
import { CollectionResponseDto } from './dto/collection-response.dto';

@ApiTags('collections')
@Controller({ path: 'collections', version: '1' })
export class CollectionsController {
  private readonly logger = new Logger(CollectionsController.name);

  constructor(private readonly collectionsService: CollectionsService) {}

  @Post('webhooks/anchor-created')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept anchor_created webhook from Ledger',
    description:
      'Returns 200 immediately so the Ledger stops retrying. ' +
      'Intent creation and anchor linking run asynchronously in the background.',
  })
  @ApiResponse({
    status: 200,
    description: 'Event accepted (processing is async)',
    schema: { example: { received: true, signal: 'anchor-created' } },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid event data (e.g. missing anchor)',
  })
  async handleAnchorCreated(
    @Body() event: AnchorCreatedEventDto,
    @Req() request: Request,
  ): Promise<{ received: boolean; signal: string }> {
    const eventHandle = event?.data?.handle;
    const anchorHandle = event?.data?.anchor?.data?.handle;

    if (!event?.data?.anchor) {
      this.logger.warn('anchor-created webhook rejected: missing event.data.anchor');
      throw new BadRequestException('Invalid event: missing data.anchor');
    }

    this.logger.log(
      `anchor-created webhook accepted (evt=${eventHandle}, anchor=${anchorHandle}), processing async`,
    );

    // Process in background so we return 200 immediately and Ledger does not retry
    this.collectionsService.handleAnchorCreated(event).catch((err) => {
      this.logger.error('anchor-created async processing failed:', err?.message);
      this.logger.error('Stack:', err?.stack);
      this.logger.error(
        'Request was:',
        JSON.stringify({ url: request.url, bodyKeys: request.body ? Object.keys(request.body) : [] }),
      );
    });

    return { received: true, signal: 'anchor-created' };
  }

  @Post('webhooks/rtp-fulfillment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive RTP / intent-updated webhook',
    description:
      'Accepts Ledger intent-updated events. Returns success immediately; processing (logging, proof, DB) runs asynchronously to avoid blocking under high traffic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Event accepted (processing is async)',
  })
  async handleRtpWebhook(
    @Body() event: IntentUpdatedEventDto,
    @Req() request: Request,
  ): Promise<{ success: boolean }> {
    // Capture payload for async processing (do not hold the request)
    const body = request.body;
    const meta = {
      method: request.method,
      url: request.url,
      path: request.path,
      ip: request.ip || request.socket?.remoteAddress,
      headers: { ...request.headers },
      query: request.query,
    };

    // Process in background: log + future work (proof, DB). Do not await.
    setImmediate(() => {
      this.collectionsService
        .processIntentUpdatedEventAsync(body, meta)
        .catch((err) =>
          this.logger.error(
            `RTP webhook async processing error: ${err?.message}`,
            err?.stack,
          ),
        );
    });

    return { success: true };
  }

  @Get('merchant-txid/:merchantTxId')
  @ApiOperation({
    summary: 'Get collection by merchant transaction ID',
    description: 'Retrieves a collection using the merchant transaction identifier',
  })
  @ApiParam({
    name: 'merchantTxId',
    description: 'Merchant transaction ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Collection found',
    type: CollectionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Collection not found',
  })
  async getByMerchantTxId(
    @Param('merchantTxId') merchantTxId: string,
    @Req() request: Request,
  ): Promise<CollectionResponseDto> {
    this.logger.log('=== INCOMING REQUEST: Get collection by merchantTxId ===');
    this.logger.log(`Method: ${request.method}`);
    this.logger.log(`URL: ${request.url}`);
    this.logger.log(`Params: ${JSON.stringify({ merchantTxId }, null, 2)}`);
    this.logger.log(`Headers: ${JSON.stringify(request.headers, null, 2)}`);
    this.logger.log('=== END REQUEST DATA ===');

    return this.collectionsService.getCollectionByMerchantTxId(merchantTxId);
  }

  @Get('anchor/:anchorHandle')
  @ApiOperation({
    summary: 'Get collection by anchor handle',
    description: 'Retrieves a collection using the anchor handle',
  })
  @ApiParam({
    name: 'anchorHandle',
    description: 'Anchor handle',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Collection found',
    type: CollectionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Collection not found',
  })
  async getByAnchorHandle(
    @Param('anchorHandle') anchorHandle: string,
    @Req() request: Request,
  ): Promise<CollectionResponseDto> {
    this.logger.log('=== INCOMING REQUEST: Get collection by anchorHandle ===');
    this.logger.log(`Method: ${request.method}`);
    this.logger.log(`URL: ${request.url}`);
    this.logger.log(`Params: ${JSON.stringify({ anchorHandle }, null, 2)}`);
    this.logger.log(`Headers: ${JSON.stringify(request.headers, null, 2)}`);
    this.logger.log('=== END REQUEST DATA ===');

    return this.collectionsService.getCollectionByAnchorHandle(anchorHandle);
  }

  @Get('intent/:intentHandle')
  @ApiOperation({
    summary: 'Get collection by intent handle',
    description: 'Retrieves a collection using the intent handle',
  })
  @ApiParam({
    name: 'intentHandle',
    description: 'Intent handle',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Collection found',
    type: CollectionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Collection not found',
  })
  async getByIntentHandle(
    @Param('intentHandle') intentHandle: string,
    @Req() request: Request,
  ): Promise<CollectionResponseDto> {
    this.logger.log('=== INCOMING REQUEST: Get collection by intentHandle ===');
    this.logger.log(`Method: ${request.method}`);
    this.logger.log(`URL: ${request.url}`);
    this.logger.log(`Params: ${JSON.stringify({ intentHandle }, null, 2)}`);
    this.logger.log(`Headers: ${JSON.stringify(request.headers, null, 2)}`);
    this.logger.log('=== END REQUEST DATA ===');

    return this.collectionsService.getCollectionByIntentHandle(intentHandle);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all collections',
    description: 'Retrieves all collections with optional filters',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (PENDING, COMPLETED, CANCELLED)',
    type: String,
  })
  @ApiQuery({
    name: 'merchantTxId',
    required: false,
    description: 'Filter by merchant transaction ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'List of collections',
    type: [CollectionResponseDto],
  })
  async getCollections(
    @Req() request: Request,
    @Query('status') status?: string,
    @Query('merchantTxId') merchantTxId?: string,
  ): Promise<CollectionResponseDto[]> {
    this.logger.log('=== INCOMING REQUEST: List collections ===');
    this.logger.log(`Method: ${request.method}`);
    this.logger.log(`URL: ${request.url}`);
    this.logger.log(`Query Params: ${JSON.stringify({ status, merchantTxId }, null, 2)}`);
    this.logger.log(`Headers: ${JSON.stringify(request.headers, null, 2)}`);
    this.logger.log('=== END REQUEST DATA ===');

    return this.collectionsService.getCollections({ status, merchantTxId });
  }
}
