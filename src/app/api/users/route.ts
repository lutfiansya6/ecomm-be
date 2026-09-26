// GET /api/users — list all registered users with summary stats (admin only)
import { db } from '@/lib/store';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';

export async function GET(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser || authUser.role !== 'admin') {
    return errorResponse('Unauthorized: Admin access required', 403);
  }

  const allUsers = db.users.findAll();
  const allOrders = db.orders.findAll();

  // Enrich user data with order counts and total spend, omit password
  const usersWithStats = allUsers.map((u) => {
    const userOrders = allOrders.filter((o) => o.userId === u.id);
    const totalSpent = userOrders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + o.total, 0);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar || null,
      createdAt: u.createdAt,
      orderCount: userOrders.length,
      totalSpent,
      lastOrderDate: userOrders.length > 0 ? userOrders[userOrders.length - 1].createdAt : null,
    };
  });

  return successResponse({
    users: usersWithStats,
    total: usersWithStats.length,
  });
}
