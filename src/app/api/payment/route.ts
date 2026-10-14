// POST /api/payment — Mock payment processing
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse, generateTxId } from '@/lib/utils';
import type { PaymentResult } from '@/types';

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return errorResponse('Unauthorized', 401);

  try {
    const { orderId, method, cardNumber, cardExpiry, cardCvv, cardName, forceSuccess } = await request.json();

    if (!orderId || !method) {
      return errorResponse('orderId dan method wajib diisi', 400);
    }

    const order = db.orders.findById(orderId);
    if (!order) return errorResponse('Order tidak ditemukan', 404);
    if (order.userId !== authUser.userId && authUser.role !== 'admin') {
      return errorResponse('Forbidden', 403);
    }

    // Simulate payment processing delay (handled on client side)
    // Validate credit card format (dummy validation)
    if (method === 'credit_card') {
      if (!cardNumber || !cardExpiry || !cardCvv || !cardName) {
        return errorResponse('Lengkapi data kartu kredit', 400);
      }
      const cleanCard = cardNumber.replace(/\s/g, '');
      if (cleanCard.length < 13 || cleanCard.length > 19) {
        return errorResponse('Nomor kartu tidak valid', 400);
      }
      // Simulate: card ending in 0000 always fails
      if (cleanCard.endsWith('0000')) {
        const result: PaymentResult = {
          success: false,
          transactionId: generateTxId(),
          message: 'Kartu ditolak oleh bank. Coba kartu lain.',
          method,
          amount: order.total,
        };
        db.orders.update(orderId, { paymentStatus: 'failed', updatedAt: new Date().toISOString() });
        return successResponse(result, 200);
      }
    }

    // QRIS & forceSuccess always succeed for seamless testing
    const isSuccess = forceSuccess || method === 'gopay' || method === 'qris' ? true : Math.random() > 0.1;
    const txId = generateTxId();

    if (isSuccess) {
      db.orders.update(orderId, {
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        updatedAt: new Date().toISOString(),
      });

      const methodName = method === 'gopay' || method === 'qris' ? 'QRIS / GoPay' : method === 'credit_card' ? 'Kartu Kredit' : 'COD';

      const result: PaymentResult = {
        success: true,
        transactionId: txId,
        message: method === 'cod'
          ? 'Order dikonfirmasi! Bayar saat barang tiba.'
          : `Pembayaran berhasil via ${methodName}`,
        method,
        amount: order.total,
      };
      return successResponse(result);
    } else {
      db.orders.update(orderId, { paymentStatus: 'failed', updatedAt: new Date().toISOString() });
      const result: PaymentResult = {
        success: false,
        transactionId: txId,
        message: 'Pembayaran gagal. Silakan coba lagi.',
        method,
        amount: order.total,
      };
      return successResponse(result);
    }
  } catch {
    return errorResponse('Terjadi kesalahan pada proses pembayaran', 500);
  }
}
