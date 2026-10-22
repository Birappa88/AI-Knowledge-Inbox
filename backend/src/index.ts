import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { errorHandler, requestId } from "./middleware/errorHandler.js";
import { router } from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(requestId);
app.use((req, _res, next) => {
  logger.info({ requestId: req.id, method: req.method, path: req.path }, "request");
  next();
});
app.use(router);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(
    { port: config.port, mockAi: config.mockAi, db: config.databasePath },
    "knowledge inbox api listening",
  );
});
