export default function handler(req, res) {
    const affiliateLink = 'https://deriv.partners/rx?sidc=34C99D4A-04E1-4CB7-B637-C2F6C863F04C&utm_campaign=dynamicworks&utm_medium=affiliate&utm_source=CU332146';
    // Optional: add logging, referer check, rate limiting, etc.
    res.setHeader('Cache-Control', 'no-cache');
    res.redirect(302, affiliateLink);
}
/*<a href="" target="_blank" rel="noopener noreferrer" class="deriv-affiliate-btn">
    Join Deriv – Start Trading
</a> */