import { BadRequestException, Injectable } from '@nestjs/common';
import { BakongKHQR, IndividualInfo, khqrData } from 'bakong-khqr';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { toNumber } from '../common/money';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';

/** How long a generated QR stays scannable before it must be regenerated. */
const EXPIRY_MS = 5 * 60 * 1000;

export interface KhqrPayload {
  /** The EMVCo/KHQR string the customer's banking app scans. */
  qr: string;
  /** MD5 of `qr` — Bakong's identifier for looking the transaction up later. */
  md5: string;
  /** The order total. Embedded in the code only when `dynamic` is true. */
  amount: number;
  currency: 'USD';
  merchantName: string;
  /** Whether the amount is baked into the code (else the customer types it). */
  dynamic: boolean;
  /** Epoch ms after which the QR is rejected — null for a static code. */
  expiresAt: number | null;
}

/** A reusable shop-wide KHQR: no amount, no expiry, safe to print. */
export interface StaticKhqrPayload {
  qr: string;
  md5: string;
  merchantName: string;
  merchantCity: string;
}

/**
 * Builds a dynamic KHQR (Bakong) for an order: the amount is embedded, so the
 * customer scans and confirms without typing anything. Generation is offline —
 * it needs no Bakong API access. Confirming that the money actually arrived is
 * still the cashier's job (they tap Confirm), because verifying a transfer
 * requires a registered merchant account and a Bakong developer token.
 */
@Injectable()
export class KhqrService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * The shop's reusable KHQR — no amount and no expiry, so it can be printed
   * and left on the counter. The customer types the amount themselves.
   */
  async staticQr(): Promise<StaticKhqrPayload> {
    const settings = await this.settingsService.find();
    const accountId = settings.bakongAccountId;
    if (!accountId) {
      throw new BadRequestException(
        'QR payment is not set up yet — add your Bakong account in Settings.',
      );
    }

    const merchantName = (settings.bakongMerchantName || settings.appName)
      .trim()
      .slice(0, 25);
    const merchantCity = (settings.bakongMerchantCity || 'Phnom Penh')
      .trim()
      .slice(0, 15);

    // Omitting amount + expiry is what makes this a static (reusable) KHQR.
    const info = new IndividualInfo(accountId, merchantName, merchantCity, {
      currency: khqrData.currency.usd,
    });

    const result = new BakongKHQR().generateIndividual(info);
    if (result.status.code !== 0 || !result.data) {
      throw new BadRequestException(
        `Could not build the KHQR code: ${result.status.message ?? 'unknown error'}`,
      );
    }

    return {
      qr: result.data.qr,
      md5: result.data.md5,
      merchantName,
      merchantCity,
    };
  }

  async forOrder(orderId: number): Promise<KhqrPayload> {
    const settings = await this.settingsService.find();
    const accountId = settings.bakongAccountId;
    if (!accountId) {
      throw new BadRequestException(
        'QR payment is not set up yet — add your Bakong account in Settings.',
      );
    }

    const order = await this.ordersService.findOne(orderId);
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay for a cancelled order');
    }
    if (order.paymentStatus !== PaymentStatus.UNPAID) {
      throw new BadRequestException('Order has already been paid');
    }

    const amount = toNumber(order.total);
    if (amount <= 0) {
      throw new BadRequestException('Order total must be greater than zero');
    }

    // KHQR caps merchant name at 25 chars and city at 15; fall back to the
    // shop name and a sensible default city when they aren't set.
    const merchantName = (settings.bakongMerchantName || settings.appName)
      .trim()
      .slice(0, 25);
    const merchantCity = (settings.bakongMerchantCity || 'Phnom Penh')
      .trim()
      .slice(0, 15);

    // Admins choose the style in Settings. A static code omits the amount and
    // the expiry, so the same code works for every order and never lapses.
    const dynamic = settings.khqrDynamic;
    const expiresAt = dynamic ? Date.now() + EXPIRY_MS : null;

    const info = new IndividualInfo(accountId, merchantName, merchantCity, {
      currency: khqrData.currency.usd,
      ...(dynamic
        ? {
            amount,
            // Ties the transfer to the order in the customer's bank statement.
            billNumber: order.orderNumber,
            expirationTimestamp: expiresAt,
          }
        : {}),
    });

    const result = new BakongKHQR().generateIndividual(info);
    if (result.status.code !== 0 || !result.data) {
      throw new BadRequestException(
        `Could not build the KHQR code: ${result.status.message ?? 'unknown error'}`,
      );
    }

    return {
      qr: result.data.qr,
      md5: result.data.md5,
      amount,
      currency: 'USD',
      merchantName,
      dynamic,
      expiresAt,
    };
  }
}
