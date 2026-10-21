import { Injectable } from '@nestjs/common';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
}

export interface CursorPaginationMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  meta: CursorPaginationMeta;
}

@Injectable()
export class PaginationService {

  getSkipTake(options: PaginationOptions): { skip: number; take: number } {
    const page = options.page > 0 ? options.page : 1;
    const limit = options.limit > 0 ? options.limit : 10;
    const skip = (page - 1) * limit;

    return { skip, take: limit };
  }

  paginate<T>(
    data: T[],
    totalItems: number,
    options: PaginationOptions,
  ): PaginatedResult<T> {
    const page = options.page > 0 ? options.page : 1;
    const limit = options.limit > 0 ? options.limit : 10;
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  paginateCursor<T>(
    data: T[],
    options: CursorPaginationOptions,
    cursorExtractor: (item: T) => string,
  ): CursorPaginatedResult<T> {
    const limit = options.limit && options.limit > 0 ? options.limit : 10;

    const hasNextPage = data.length > limit;

    const resultData = hasNextPage ? data.slice(0, limit) : data;
    const nextCursor =
      hasNextPage && resultData.length > 0
        ? cursorExtractor(resultData[resultData.length - 1])
        : null;

    return {
      data: resultData,
      meta: {
        hasNextPage,
        nextCursor,
      },
    };
  }
}