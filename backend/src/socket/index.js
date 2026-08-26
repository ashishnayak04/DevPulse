const { Server } = require('socket.io');
const config = require('../config/env');
const logger = require('../lib/logger');
const { socketAuth } = require('../middleware/authenticate');

const SCOPE = 'Socket';

function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: config.frontendUrl,
      credentials: true,
    },
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    logger.info(SCOPE, `User ${socket.userId} connected`);
    socket.join(`user:${socket.userId}`);

    socket.on('disconnect', () => {
      logger.info(SCOPE, `User ${socket.userId} disconnected`);
    });
  });

  return io;
}

module.exports = { createSocketServer };
