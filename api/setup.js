import { getDb } from '../_lib/db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    const { secret } = req.query;
    if (secret !== process.env.SETUP_SECRET) {
        return res.status(401).json({ error: 'Invalid secret' });
    }
    const db = await getDb();
    const defaultUsers = [
        { username: 'admin', password: 'Nice@2023', role: 'admin' },
        { username: 'owner', password: 'Nice@2020', role: 'admin' },
        { username: 'cris', password: 'logoarts', role: 'tech' }
    ];
    let created = 0;
    for (const u of defaultUsers) {
        const existing = await db.collection('users').findOne({ username: u.username });
        if (!existing) {
            const passwordHash = bcrypt.hashSync(u.password, 10);
            await db.collection('users').insertOne({
                username: u.username,
                passwordHash,
                role: u.role,
                subscription: { plan: 'free', expiresAt: null },
                createdAt: new Date(),
                isDeleted: false
            });
            created++;
        }
    }
    res.json({ message: `Seeded ${created} users` });
}
