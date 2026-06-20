import { Router, type IRouter } from "express";
import healthRouter from "./health";
import explainRouter from "./explain";

const router: IRouter = Router();

router.use(healthRouter);
router.use(explainRouter);

export default router;
