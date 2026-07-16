import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import explainRouter from "./explain";
import sessionsRouter from "./sessions";
import projectsRouter from "./projects";
import bookmarksRouter from "./bookmarks";
import filesRouter from "./files";
import shareRouter from "./share";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(explainRouter);
router.use(sessionsRouter);
router.use(projectsRouter);
router.use(bookmarksRouter);
router.use(filesRouter);
router.use(shareRouter);

export default router;