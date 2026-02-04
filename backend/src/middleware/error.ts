import { Request, Response, NextFunction } from 'express';
import { ApiError, ValidationError } from '../utils/errors';
import { errorResponse } from '../utils/response';

export const errorHandler = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('[Error]', error);

  if (error instanceof ApiError) {
    res.status(error.statusCode).json(
      errorResponse(error.message, error.statusCode)
    );
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json(
      errorResponse('Invalid JSON in request body', 400)
    );
    return;
  }

  res.status(500).json(
    errorResponse('Internal server error', 500, error.message)
  );
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
