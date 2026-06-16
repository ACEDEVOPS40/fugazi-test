// scripts/seed.js
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env file');
    process.exit(1);
}

const client = new MongoClient(uri);

const defaultUsers = [
    { username: 'liberty', password: 'bazuu@9045#', role: 'admin' },
    { username: 'owner', password: 'Ecall@2026#', role: 'admin' },
    { username: 'cris', password: 'ace_dev_19', role: 'tech' }
];

async function seed() {
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        const db = client.db('quantum');
        const usersCol = db.collection('users');

        for (const user of defaultUsers) {
            const existing = await usersCol.findOne({ username: user.username });
            if (!existing) {
                const passwordHash = bcrypt.hashSync(user.password, 10);
                await usersCol.insertOne({
                    username: user.username,
                    passwordHash,
                    role: user.role,
                    subscription: { plan: 'free', expiresAt: null },
                    createdAt: new Date(),
                    isDeleted: false
                });
                console.log(`✅ Created user: ${user.username}`);
            } else {
                console.log(`⏩ User already exists: ${user.username}`);
            }
        }
    } catch (err) {
        console.error('❌ Seed error:', err);
    } finally {
        await client.close();
        console.log('🔌 Connection closed');
    }
}

seed();