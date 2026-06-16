import { MongoClient } from 'mongodb';

let client = null;
let db = null;

export async function getDb() {
    if (db) return db;
    if (!client) {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
    }
    db = client.db('quantum');
    return db;
}

export async function closeDb() {
    if (client) await client.close();
    client = null;
    db = null;
}
