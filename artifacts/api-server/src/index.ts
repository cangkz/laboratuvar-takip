import dotenv from "dotenv";
dotenv.config();

const { default: app } = await import("./app");
const { logger } = await import("./lib/logger");

const rawPort = process.env.PORT || "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  logger.error(`Geçersiz port: ${rawPort}`);
  process.exit(1);
}

app.listen(port, () => {
  logger.info(`API sunucusu http://localhost:${port} adresinde dinliyor`);
});