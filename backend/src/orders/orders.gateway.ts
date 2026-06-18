import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Order } from './entities/order.entity';

/**
 * Pushes live order updates to connected clients (the kitchen / barista
 * display). The frontend just listens for these events instead of polling:
 *   socket.on('order.created', ...)  // a new order came in
 *   socket.on('order.updated', ...)  // its status changed
 *
 * Clients must authenticate on connect by supplying their JWT, either as
 *   io(url, { auth: { token } })            // handshake auth (preferred)
 * or an `Authorization: Bearer <token>` header. Unauthenticated sockets are
 * rejected immediately. CORS mirrors main.ts so the Next.js frontend can
 * connect.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class OrdersGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(OrdersGateway.name);

  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('Missing auth token');
      }
      // Verify with the same secret used to sign API tokens.
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      // Stash the user on the socket for later use (e.g. per-user rooms).
      client.data.user = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
      };
      this.logger.log(`Client connected: ${client.id} (${payload.username})`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unauthorized';
      this.logger.warn(`Rejected socket ${client.id}: ${reason}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Broadcast a newly-created order to every connected screen. */
  emitOrderCreated(order: Order) {
    this.server.emit('order.created', order);
  }

  /** Broadcast a status change (pending → preparing → ready → ...). */
  emitOrderUpdated(order: Order) {
    this.server.emit('order.updated', order);
  }

  /** Pull the JWT from the handshake auth payload or the Authorization header. */
  private extractToken(client: Socket): string | undefined {
    const fromAuth = client.handshake.auth?.token as string | undefined;
    if (fromAuth) {
      return fromAuth.replace(/^Bearer\s+/i, '');
    }
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return undefined;
  }
}
