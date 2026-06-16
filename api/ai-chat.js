// api/ai-chat.js – Always responds, never crashes
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    // Fallback rule‑based responses (used if DeepSeek unavailable)
    const getFallbackReply = (msg) => {
        const lower = msg.toLowerCase();
        if (lower.includes('hello') || lower.includes('hi')) return "Hello! I'm ACE-RADICAL. How can I assist with your trading today?";
        if (lower.includes('predict')) return "Click 'Analyze Digits' on the Dashboard – the quantum model will predict the next digit.";
        if (lower.includes('volatility')) return "Volatility affects probability distribution. Adjust wave frequency or Fermi temperature in Settings.";
        if (lower.includes('strategy')) return "Common strategies: trend following, mean reversion, breakout. For binary options, use 'Matches' when trend is strong.";
        if (lower.includes('binary options')) return "Binary options pay a fixed amount if the condition is met at expiry. Trade with caution.";
        return "I'm not sure. Try asking about predictions, volatility, strategies, or binary options.";
    };

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        console.warn('DEEPSEEK_API_KEY not set – using fallback');
        return res.status(200).json({ reply: getFallbackReply(message) });
    }

    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant for Quantum Digits, a trading analytics platform. Answer questions about digits, volatility, strategies, and binary options concisely and accurately.',
                    },
                    { role: 'user', content: message },
                ],
                temperature: 0.7,
                max_tokens: 300,
            }),
        });

        if (!response.ok) {
            console.error('DeepSeek API error:', response.status);
            return res.status(200).json({ reply: getFallbackReply(message) });
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content;
        if (!reply) {
            return res.status(200).json({ reply: getFallbackReply(message) });
        }

        return res.status(200).json({ reply });
    } catch (err) {
        console.error('AI chat error:', err);
        return res.status(200).json({ reply: getFallbackReply(message) });
    }
}