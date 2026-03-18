import { Server } from "socket.io";
import { checkToken } from "./utils.js";
import { constants } from "./constants.js";

let io = null;

export function setIo(socketIo) {
  io = socketIo;
}

export function getIo() {
  return io;
}

/** Emit an event to a specific user's room */
export function emitToUser(user_id, event, payload) {
  if (!io) return;
  io.to(`user:${user_id}`).emit(event, payload);
}

/** Attach socket.io to an http.Server and configure auth + rooms */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // JWT auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
      const decoded = checkToken(token, constants.ACCESS_TOKEN_SECRET);
      socket.user_id = decoded.user_id;
      socket.org_id  = decoded.org_id;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    // Each user joins their own private room
    socket.join(`user:${socket.user_id}`);
    console.log(`🔌 Socket connected: user=${socket.user_id}`);

    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: user=${socket.user_id}`);
    });
  });

  return io;
}
