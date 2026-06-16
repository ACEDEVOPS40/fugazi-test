import { verifyAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ valid: false });
    res.json({ valid: true, user });
}