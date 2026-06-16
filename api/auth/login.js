import { getDb } from '../_lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    try {
        const db = await getDb();
        const user = await db.collection('users').findOne({ username, isDeleted: { $ne: true } });
        if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Delete old sessions
        await db.collection('sessions').deleteMany({ userId: user._id });
        const sessionId = uuidv4();
        await db.collection('sessions').insertOne({
            userId: user._id,
            sessionId,
            createdAt: new Date(),
            lastActiveAt: new Date(),
            userAgent: req.headers['user-agent'] || 'unknown'
        });
        const token = jwt.sign(
            { userId: user._id.toString(), role: user.role, sessionId },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({ token, role: user.role, username: user.username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
