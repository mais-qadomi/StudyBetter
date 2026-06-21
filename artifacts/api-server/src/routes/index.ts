import { Router, type IRouter } from "express";
import healthRouter from "./health";
import explainRouter from "./explain";
import sessionsRouter from "./sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(explainRouter);
router.use(sessionsRouter);

export default router;
