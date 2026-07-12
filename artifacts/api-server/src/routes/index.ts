import { Router, type IRouter } from "express";
import healthRouter from "./health";
import explainRouter from "./explain";
import sessionsRouter from "./sessions";
import projectsRouter from "./projects";
import bookmarksRouter from "./bookmarks";
import filesRouter from "./files";

const router: IRouter = Router();

router.use(healthRouter);
router.use(explainRouter);
router.use(sessionsRouter);
router.use(projectsRouter);
router.use(bookmarksRouter);
router.use(filesRouter);

export default router;