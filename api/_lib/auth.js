import jwt from 'jsonwebtoken';
import { getDb } from './db.js';
import { ObjectId } from 'mongodb';

export async function verifyAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return null;
    }
    const db = await getDb();
    const session = await db.collection('sessions').findOne({
        userId: new ObjectId(decoded.userId),
        sessionId: decoded.sessionId
    });
    if (!session) return null;
    // Update last active (optional)
    await db.collection('sessions').updateOne(
        { _id: session._id },
        { $set: { lastActiveAt: new Date() } }
    );
    return { userId: decoded.userId, role: decoded.role, sessionId: decoded.sessionId };
}

export async function requireAdmin(req, res, next) {
    const user = await verifyAuth(req);
    if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }
    return user;
}
