import type { NextFunction, Request, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ZodSchema } from 'zod';

export type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validasi input berbasis Zod (CLAUDE.md §7: "Validasi input pakai Zod di setiap endpoint").
 *
 * Hasil parse yang sudah bertipe menimpa nilai mentah, sehingga controller selalu bekerja
 * dengan data tervalidasi, bukan input mentah dari user. ZodError diteruskan ke
 * errorHandler agar bentuk response-nya seragam di semua service.
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      next(result.error);
      return;
    }

    if (target === 'body') {
      req.body = result.data;
    } else if (target === 'params') {
      req.params = result.data as ParamsDictionary;
    } else {
      // req.query bersifat getter-only pada Express 5; defineProperty aman di v4 maupun v5.
      Object.defineProperty(req, 'query', {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  };
}
