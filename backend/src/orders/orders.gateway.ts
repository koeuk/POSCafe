import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Order } from './entities/order.entity';

/**
 * Pushes live order updates to connected clients (the kitchen / barista
 * display). The frontend just listens for these events instead of polling:
 *   socket.on('order.created', ...)  // a new order came in
 *   socket.on('order.updated', ...)  // its status changed
 *
 * CORS mirrors main.ts so the Next.js frontend can connect.
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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
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
}
