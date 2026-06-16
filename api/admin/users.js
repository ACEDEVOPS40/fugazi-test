import { requireAdmin } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { isValidUsername, isValidPassword } from '../_lib/validate.js';

export default async function handler(req, res) {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const db = await getDb();
    const usersCol = db.collection('users');

    // GET: list all users (admin only)
    if (req.method === 'GET') {
        const users = await usersCol.find({}, { projection: { passwordHash: 0 } }).toArray();
        return res.json(users);
    }

    // POST: create new user (admin only)
    if (req.method === 'POST') {
        const { username, password, role = 'regular' } = req.body;
        if (!isValidUsername(username) || !isValidPassword(password)) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }
        const existing = await usersCol.findOne({ username });
        if (existing) return res.status(409).json({ error: 'Username exists' });
        const passwordHash = bcrypt.hashSync(password, 10);
        const now = new Date();
        const expiry = new Date(now);
        expiry.setDate(expiry.getDate() + 30);
        const newUser = {
            username,
            passwordHash,
            role,
            subscription: { plan: 'free', expiresAt: expiry },
            createdAt: now,
            isDeleted: false
        };
        const result = await usersCol.insertOne(newUser);
        return res.status(201).json({ message: 'User created', userId: result.insertedId });
    }

    // DELETE: remove a user (admin only) – expects userId in query string
    if (req.method === 'DELETE') {
        const { userId } = req.query;
        if (!userId || userId === admin.userId) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        const result = await usersCol.deleteOne({ _id: new ObjectId(userId) });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'User not found' });
        await db.collection('sessions').deleteMany({ userId: new ObjectId(userId) });
        await db.collection('chatHistory').deleteMany({ userId: new ObjectId(userId) });
        return res.json({ message: 'User deleted' });
    }

    res.status(405).json({ error: 'Method not allowed' });
}
