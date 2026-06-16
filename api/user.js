import { verifyAuth } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const userId = new ObjectId(user.userId);

    if (req.method === 'GET') {
        const userDoc = await db.collection('users').findOne({ _id: userId });
        if (!userDoc) return res.status(404).json({ error: 'User not found' });
        return res.json({
            username: userDoc.username,
            role: userDoc.role,
            subscription: userDoc.subscription
        });
    }

    if (req.method === 'PUT') {
        const { newUsername, currentPassword, newPassword } = req.body;
        const userDoc = await db.collection('users').findOne({ _id: userId });
        if (!bcrypt.compareSync(currentPassword, userDoc.passwordHash)) {
            return res.status(401).json({ error: 'Current password incorrect' });
        }
        const update = {};
        if (newUsername && newUsername !== userDoc.username) {
            const existing = await db.collection('users').findOne({ username: newUsername });
            if (existing) return res.status(409).json({ error: 'Username taken' });
            update.username = newUsername;
        }
        if (newPassword) {
            update.passwordHash = bcrypt.hashSync(newPassword, 10);
            await db.collection('sessions').deleteMany({ userId });
        }
        if (Object.keys(update).length) {
            await db.collection('users').updateOne({ _id: userId }, { $set: update });
        }
        return res.json({ message: 'Profile updated' });
    }

    if (req.method === 'DELETE') {
        const { password } = req.body;
        const userDoc = await db.collection('users').findOne({ _id: userId });
        if (!bcrypt.compareSync(password, userDoc.passwordHash)) {
            return res.status(401).json({ error: 'Incorrect password' });
        }
        await db.collection('users').deleteOne({ _id: userId });
        await db.collection('sessions').deleteMany({ userId });
        await db.collection('chatHistory').deleteMany({ userId });
        return res.json({ message: 'Account permanently deleted' });
    }

    res.status(405).json({ error: 'Method not allowed' });
}
