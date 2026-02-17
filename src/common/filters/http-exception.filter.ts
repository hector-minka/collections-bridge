import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { LedgerError, LedgerErrorReason } from '@minka/ledger-sdk';

/**
 * Global exception filter to ensure errors are returned in the format expected by Minka Ledger
 * Format: { reason: string, detail: string, custom?: object }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: {
      reason: string;
      detail: string;
      custom?: Record<string, unknown>;
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Check if the response is already a LedgerError instance
      if (exceptionResponse instanceof LedgerError) {
        errorResponse = {
          reason: exceptionResponse.reason,
          detail: exceptionResponse.detail,
          custom: exceptionResponse.custom,
        };
      }
      // If the exception already has the correct format (reason, detail), use it
      else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'reason' in exceptionResponse &&
        'detail' in exceptionResponse
      ) {
        errorResponse = exceptionResponse as {
          reason: string;
          detail: string;
          custom?: Record<string, unknown>;
        };
      } else if (typeof exceptionResponse === 'string') {
        // If it's a string, convert to LedgerError format using SDK
        const ledgerError = new LedgerError(
          this.getLedgerErrorReason(status),
          exceptionResponse,
        );
        errorResponse = {
          reason: ledgerError.reason,
          detail: ledgerError.detail,
          custom: ledgerError.custom,
        };
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        // If it's an object but not in the expected format, try to extract message
        const message =
          'message' in exceptionResponse
            ? (exceptionResponse as any).message
            : exception.message || 'An error occurred';
        const detail = Array.isArray(message) ? message.join(', ') : String(message);
        const ledgerError = new LedgerError(
          this.getLedgerErrorReason(status),
          detail,
        );
        errorResponse = {
          reason: ledgerError.reason,
          detail: ledgerError.detail,
          custom: ledgerError.custom,
        };
      } else {
        const ledgerError = new LedgerError(
          this.getLedgerErrorReason(status),
          exception.message || 'An error occurred',
        );
        errorResponse = {
          reason: ledgerError.reason,
          detail: ledgerError.detail,
          custom: ledgerError.custom,
        };
      }
    } else {
      // Non-HTTP exception (unexpected error)
      const error = exception as Error;
      this.logger.error('Unexpected error occurred', {
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
      });

      // Use LedgerError for unexpected errors
      const ledgerError = new LedgerError(
        LedgerErrorReason.ApiUnexpectedError,
        error.message || 'An unexpected error occurred',
        {
          trace: error.stack || '',
        },
      );
      errorResponse = {
        reason: ledgerError.reason,
        detail: ledgerError.detail,
        custom: ledgerError.custom,
      };
    }

    // Log the error for debugging with full details
    this.logger.error('=== EXCEPTION CAUGHT BY FILTER ===');
    this.logger.error(`Status: ${status}`);
    this.logger.error(`Reason: ${errorResponse.reason}`);
    this.logger.error(`Detail: ${errorResponse.detail}`);
    this.logger.error(`URL: ${request.url}`);
    this.logger.error(`Method: ${request.method}`);
    this.logger.error(`IP: ${request.ip || request.socket.remoteAddress}`);
    this.logger.error(`Headers: ${JSON.stringify(request.headers, null, 2)}`);
    this.logger.error(`Body: ${JSON.stringify(request.body, null, 2)}`);
    this.logger.error(`Body Type: ${typeof request.body}`);
    this.logger.error(`Query: ${JSON.stringify(request.query, null, 2)}`);
    this.logger.error(`Params: ${JSON.stringify(request.params, null, 2)}`);
    if (errorResponse.custom) {
      this.logger.error(`Custom: ${JSON.stringify(errorResponse.custom, null, 2)}`);
    }
    
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      this.logger.error(`Exception Response: ${JSON.stringify(exceptionResponse, null, 2)}`);
    }
    
    if (exception instanceof Error) {
      this.logger.error(`Error Message: ${exception.message}`);
      this.logger.error(`Error Name: ${exception.name}`);
      if (exception.stack) {
        this.logger.error(`Error Stack: ${exception.stack}`);
      }
    } else {
      this.logger.error(`Exception Type: ${typeof exception}`);
      this.logger.error(`Exception: ${JSON.stringify(exception, null, 2)}`);
    }
    
    this.logger.error('=== END EXCEPTION DETAILS ===');

    // Ensure response headers are set correctly BEFORE sending
    if (!response.headersSent) {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
    }

    // Return error in Minka Ledger format: { reason, detail, custom? }
    try {
      response.status(status).json(errorResponse);
    } catch (jsonError) {
      this.logger.error('Error sending JSON response', {
        error: jsonError instanceof Error ? jsonError.message : String(jsonError),
        status,
        errorResponse,
      });
      // Fallback: send as plain text if JSON fails
      if (!response.headersSent) {
        response.status(status).send(JSON.stringify(errorResponse));
      }
    }
  }

  /**
   * Map HTTP status codes to LedgerErrorReason from SDK
   * Uses LedgerErrorReason enum from @minka/ledger-sdk to ensure consistency
   */
  private getLedgerErrorReason(status: number): LedgerErrorReason {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return LedgerErrorReason.ApiBodyMalformed;
      case HttpStatus.UNAUTHORIZED:
        return LedgerErrorReason.AuthUnauthorized;
      case HttpStatus.FORBIDDEN:
        return LedgerErrorReason.AuthForbidden;
      case HttpStatus.NOT_FOUND:
        return LedgerErrorReason.RecordNotFound;
      case HttpStatus.CONFLICT:
        return LedgerErrorReason.RecordDuplicated;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return LedgerErrorReason.RecordInvalid;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return LedgerErrorReason.ApiUnexpectedError;
      default:
        return LedgerErrorReason.ApiUnexpectedError;
    }
  }
}
