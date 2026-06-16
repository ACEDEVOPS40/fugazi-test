import { requireAdmin } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';

export default async function handler(req, res) {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const db = await getDb();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const users = await db.collection('users').find({ isDeleted: { $ne: true } }).toArray();
    const activeUsers = users.filter(u => u.subscription?.expiresAt && new Date(u.subscription.expiresAt) > now).length;
    const totalSubs = users.length;
    const todayRevenue = users.filter(u => new Date(u.createdAt) >= todayStart).length * 15;
    const monthlyRecurringRevenue = activeUsers * 15;
    const ytdRevenue = users.filter(u => new Date(u.createdAt) >= thisYearStart).length * 15;
    const yearlyTarget = 100000;
    const percentage = Math.min(100, (ytdRevenue / yearlyTarget) * 100);
    res.json({ activeUsers, totalSubs, todayRevenue, monthlyRecurringRevenue, ytdRevenue, percentage });
}
