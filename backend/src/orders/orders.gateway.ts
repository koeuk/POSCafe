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
import { corsOrigin } from '../common/cors';
import { DEFAULT_CASHIER_PAGES } from '../common/decorators/requires-page.decorator';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { Order } from './entities/order.entity';

/** What we stash on `socket.data` once a connection is authenticated. */
interface SocketData {
  user: {
    id: number;
    username: string;
    role: Role;
    allowedPages: string[] | null;
  };
}

/**
 * Pushes live order updates to connected clients (the Orders queue). The
 * frontend just listens for these events instead of polling:
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
  // Same origin policy as the REST app rather than reflecting every origin.
  cors: { origin: corsOrigin, credentials: true },
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(OrdersGateway.name);

  // Pages whose holders may watch the live order feed. Mirrors the
  // @RequiresPage on the equivalent REST read in orders.controller.ts — the
  // socket streams the same order payloads, so it must gate the same way.
  private static readonly ORDER_FEED_PAGES = [
    'orders',
    'order-history',
    'payments',
  ];

  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('Missing auth token');
      }
      // Verify with the same secret used to sign API tokens.
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      // Re-load the user like JwtStrategy does. A token stays valid until it
      // expires, so without this a deactivated or deleted account keeps
      // streaming every order for the rest of the token's lifetime.
      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new Error('User is no longer active');
      }
      if (!OrdersGateway.mayWatchOrders(user)) {
        throw new Error('Not permitted to watch the order feed');
      }

      // Stash the user on the socket for later use (e.g. per-user rooms).
      (client.data as SocketData).user = {
        id: user.id,
        username: user.username,
        role: user.role,
        allowedPages: user.allowedPages,
      };
      this.logger.log(`Client connected: ${client.id} (${user.username})`);
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
    this.emit('order.created', order);
  }

  /** Broadcast a status change (pending → preparing → ready → ...). */
  emitOrderUpdated(order: Order) {
    this.emit('order.updated', order);
  }

  /**
   * Broadcasts are a side effect of an already-committed write, so they must
   * never throw back into the caller and fail an otherwise successful request.
   * `server` is also undefined until Socket.IO finishes initialising.
   */
  private emit(event: string, order: Order) {
    if (!this.server) {
      this.logger.warn(`Dropped "${event}": socket server not ready yet`);
      return;
    }
    try {
      this.server.emit(event, order);
    } catch (err) {
      this.logger.error(
        `Failed to broadcast "${event}" for order #${order.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /** Admins always pass; cashiers need one of the order-feed pages. */
  private static mayWatchOrders(user: User): boolean {
    if (user.role === Role.ADMIN) {
      return true;
    }
    const allowed = user.allowedPages ?? DEFAULT_CASHIER_PAGES;
    return OrdersGateway.ORDER_FEED_PAGES.some((page) =>
      allowed.includes(page),
    );
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
