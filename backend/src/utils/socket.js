let ioInstance = null;

function registerSocketServer(io) {
  ioInstance = io;
  io.on("connection", (socket) => {
    socket.on("session:join", (sessionId) => {
      socket.join(`session:${sessionId}`);
    });
  });
}

function emitToSession(sessionId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`session:${sessionId}`).emit(event, payload);
}

module.exports = { registerSocketServer, emitToSession };
