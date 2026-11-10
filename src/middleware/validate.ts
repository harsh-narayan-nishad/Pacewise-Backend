import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";

/** Validates+parses `req.body`/`req.query`/`req.params` against a zod
 *  schema before the handler runs, replacing the raw value with the
 *  parsed (typed, defaulted, coerced) one. A failure throws ZodError,
 *  caught centrally by errorHandler.ts — every route gets the same 422
 *  shape for free instead of hand-rolling validation per handler. */
export function validate(schemas: { body?: ZodType; query?: ZodType; params?: ZodType }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    next();
  };
}
