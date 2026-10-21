import {
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

export function handleServiceError(
  error: unknown,
  logger: Logger,
  contextMessage: string,
): never {
  if (error instanceof HttpException) {
    throw error;
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`${contextMessage}: ${errorMessage}`, errorStack);
  throw new InternalServerErrorException('Something went wrong');
}
