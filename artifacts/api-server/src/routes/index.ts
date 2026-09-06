import { Router, type IRouter } from "express";
import healthRouter from "./health";
import prosthesisRouter from "./prosthesis";

const router: IRouter = Router();

router.use(healthRouter);
router.use(prosthesisRouter);

export default router;
