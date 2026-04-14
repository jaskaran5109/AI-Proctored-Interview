require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const { app } = require("./app");
const { connectDatabase } = require("./config/db");
const { seedAdmin } = require("./utils/seed");
const { logger } = require("./utils/logger");
const { registerSocketServer } = require("./utils/socket");

const port = Number(process.env.PORT || 8000);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  },
});

registerSocketServer(io);

async function start() {
  await connectDatabase();
  await seedAdmin();
  server.listen(port, () => {
    logger.info(`Node backend listening on ${port}`);
  });
}

start().catch((error) => {
  logger.error("Failed to start server", { error: error.message, stack: error.stack });
  process.exit(1);
});
