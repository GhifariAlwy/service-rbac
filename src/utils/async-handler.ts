import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 tidak menangkap rejection dari handler async, sehingga error yang
 * dilempar di dalamnya akan menggantung tanpa response. Wrapper ini meneruskannya
 * ke errorHandler agar bentuk response error tetap seragam.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}
