import { verifyAuth } from './_lib/auth.js';
import { getDb } from './_lib/db.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const userId = new ObjectId(user.userId);
    const chatCol = db.collection('chatHistory');

    if (req.method === 'POST') {
        const { message, sender } = req.body;
        if (!message || !sender) return res.status(400).json({ error: 'Missing fields' });
        await chatCol.updateOne(
            { userId },
            { $push: { messages: { sender, text: message, timestamp: new Date() } } },
            { upsert: true }
        );
        return res.json({ success: true });
    }

    if (req.method === 'GET') {
        const doc = await chatCol.findOne({ userId });
        return res.json({ messages: doc?.messages || [] });
    }

    if (req.method === 'DELETE') {
        await chatCol.deleteOne({ userId });
        return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
}
