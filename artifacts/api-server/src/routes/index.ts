import { Router } from "express";
import stlRouter from "./stl.js";

const router = Router();

// Diğer rotaların yanı sıra stl router'ı ekliyoruz
router.use("/stl", stlRouter);

export default router;