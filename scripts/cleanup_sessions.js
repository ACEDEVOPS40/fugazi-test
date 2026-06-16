// scripts/cleanup_sessions.js
require('dotenv').config({ path: '../.env' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function cleanup() {
    await client.connect();
    const db = client.db('quantum');
    const sessions = db.collection('sessions');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30); // delete sessions older than 30 days
    const result = await sessions.deleteMany({ createdAt: { $lt: cutoff } });
    console.log(`Deleted ${result.deletedCount} old sessions`);
    await client.close();
}

cleanup().catch(console.error);