import type { Request } from "express";

export function managerLinkFor(req: Request, token: string): string {
  return `${req.protocol}://${req.get("host")}/manager/requests/${token}`;
}
