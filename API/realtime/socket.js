const { Server } = require('socket.io');
const { isValidToken } = require('../middleware/crewAuth');
const { verifyOrderToken } = require('../models/orderModel');
const { seatExists } = require('../models/seatModel');

let io = null;

// REST handlers do every write and are the source of truth; sockets only push
// the result out afterwards. Crew devices (valid crew token at connect time)
// join the "crew" room and see everything. A passenger can only join the room
// for their own seat, and only by proving they hold that order's edit token —
// seat numbers are guessable, and order payloads include health conditions.
function initSocket(httpServer) {
  io = new Server(httpServer);

  io.on('connection', (socket) => {
    if (isValidToken(socket.handshake.auth && socket.handshake.auth.token)) {
      socket.join('crew');
    }

    socket.on('join:seat', (payload, ack) => {
      const { seatId, token } = payload || {};
      const respond = typeof ack === 'function' ? ack : () => {};
      if (typeof seatId !== 'string' || !seatExists(seatId) || !verifyOrderToken(seatId, token)) {
        return respond({ ok: false });
      }
      socket.join(`seat:${seatId}`);
      respond({ ok: true });
    });
  });

  return io;
}

// No-ops when the server was started without sockets (e.g. scripts requiring the app).
function emitOrderUpserted(order) {
  if (!io) return;
  io.to('crew').to(`seat:${order.seatId}`).emit('order:upserted', order);
}

function emitOrderDeleted(order) {
  if (!io) return;
  io.to('crew').to(`seat:${order.seatId}`).emit('order:deleted', { id: order.id, seatId: order.seatId });
}

// Availability / stock / meal changes: every open portal should refetch its menu.
function emitMenuChanged() {
  if (!io) return;
  io.emit('menu:changed');
}

module.exports = { initSocket, emitOrderUpserted, emitOrderDeleted, emitMenuChanged };
