// /api/symbols.js
export default async function handler(req, res) {
    try {
        const response = await fetch('https://ws.binaryws.com/websockets/v3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "active_symbols": "brief" })
        });

        const data = await response.json();
        if (data.error) {
            console.error("Deriv API Error:", data.error);
            return res.status(500).json({ error: 'Failed to fetch symbols from Deriv API' });
        }

        // Filter and format the symbols you need (synthetic indices)
        const volatilityIndices = data.active_symbols.filter(symbol =>
            symbol.symbol.startsWith('R_') && symbol.market === 'synthetic'
        ).map(symbol => ({
            display_name: symbol.display_name,
            symbol: symbol.symbol
        }));

        res.status(200).json({ symbols: volatilityIndices });
    } catch (error) {
        console.error("Error in /api/symbols:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
}