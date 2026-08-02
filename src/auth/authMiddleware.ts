import type { NextFunction, Request, Response } from "express";

declare module "express-session" {
  interface SessionData {
    hrbpId?: string;
    oauthState?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.hrbpId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
