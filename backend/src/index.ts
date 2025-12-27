import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { authService } from './services/auth.service';
import authRoutes from './routes/auth.routes';
import { registerSocketHandlers } from './socket/handlers';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './types';

const app = express();
const httpServer = createServer(app);

// Socket.IO server with TypeScript types
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  cors: {
    origin: config.cors.origin,
    credentials: true,
  },
});

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests, please try again later',
});

app.use('/api/auth', authLimiter);

// ==========================================
// ROUTES
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);

// ==========================================
// SOCKET.IO AUTHENTICATION
// ==========================================

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = await authService.verifyAccessToken(token);

    // Attach user data to socket
    socket.data.userId = payload.userId;
    socket.data.username = payload.username;

    next();
  } catch (error) {
    logger.error('Socket authentication failed', { error });
    next(new Error('Authentication failed'));
  }
});

// ==========================================
// SOCKET.IO HANDLERS
// ==========================================

registerSocketHandlers(io);

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ==========================================
// START SERVER
// ==========================================

httpServer.listen(config.port, () => {
  logger.info(`🎯 Dart Party Server started on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`CORS origin: ${config.cors.origin}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing server');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
