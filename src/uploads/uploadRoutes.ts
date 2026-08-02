import { Router, type NextFunction, type Request, type Response } from "express";
import multer, { MulterError } from "multer";
import { requireAuth } from "../auth/authMiddleware.js";
import type { TeamMappingStore } from "../teams/teamMappingStore.js";
import { ingestUpload, type IngestDeps } from "./ingestUpload.js";
import type { SourceType } from "./rawFileStore.js";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB - generous for a survey export, not unbounded
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

function respond(res: Response, result: Awaited<ReturnType<typeof ingestUpload>>): void {
  if (result.status === "rejected") res.status(400).json(result);
  else if (result.status === "needs-confirmation") res.status(422).json(result);
  else res.status(200).json(result);
}

/** Runs after requireAuth, before multer - an unauthorized request never gets its body buffered. */
function requireTeamAuthorization(teamMappingStore: TeamMappingStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const hrbpId = req.session.hrbpId!;
    const teamId = String(req.params.teamId);
    if (!teamMappingStore.isAuthorized(hrbpId, teamId)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}

/** Wraps multer so a file-too-large (or other Multer) error becomes a clean 4xx, not a generic 500. */
function handleFileUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      res.status(400).json({ error: "upload rejected", reason: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ error: "upload rejected", reason: "the file could not be read" });
      return;
    }
    next();
  });
}

/**
 * Three separate upload paths (annual survey / pulse survey / exit data),
 * per the content spec's "dedicated upload path per source type, not one
 * generic uploader" - each just fixes which SourceType it ingests as.
 */
export function buildUploadRoutes(ingestDeps: IngestDeps, teamMappingStore: TeamMappingStore): Router {
  const router = Router();

  const handleUpload = (sourceType: SourceType) => [
    requireAuth,
    requireTeamAuthorization(teamMappingStore),
    handleFileUpload,
    async (req: Request, res: Response) => {
      const teamId = String(req.params.teamId);

      if (!req.file) {
        res.status(400).json({ error: "a file is required" });
        return;
      }

      const result = await ingestUpload(ingestDeps, teamId, sourceType, req.file.buffer);
      respond(res, result);
    },
  ] as const;

  router.post("/:teamId/uploads/annual-survey", ...handleUpload("annual-survey"));
  router.post("/:teamId/uploads/pulse-survey", ...handleUpload("pulse-survey"));
  router.post("/:teamId/uploads/exit-data", ...handleUpload("exit-data"));

  return router;
}
