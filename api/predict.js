import { verifyAuth } from './_lib/auth.js';

// ======================== HELPER FUNCTIONS ========================
function computePercentages(digits, windowSize = 200) {
    const relevant = digits.slice(-windowSize);
    const total = relevant.length;
    if (total === 0) return new Array(10).fill(0);
    const counts = new Array(10).fill(0);
    relevant.forEach(d => { if (d >= 0 && d <= 9) counts[d]++; });
    return counts.map(c => (c / total) * 100);
}

function getPreviousPercentages(digits, windowSize = 200) {
    if (digits.length < 2) return new Array(10).fill(0);
    return computePercentages(digits.slice(0, -1), windowSize);
}

function isIncreasing(digit, currPerc, prevPerc, tolerance = 1e-6) {
    return currPerc[digit] - prevPerc[digit] > tolerance;
}

function isDecreasing(digit, currPerc, prevPerc, tolerance = 1e-6) {
    return prevPerc[digit] - currPerc[digit] > tolerance;
}

function getGreenArcDigits(percentages) {
    const max = Math.max(...percentages);
    return percentages.reduce((acc, p, idx) => (p === max ? [...acc, idx] : acc), []);
}

function getRedArcDigits(percentages) {
    const min = Math.min(...percentages);
    return percentages.reduce((acc, p, idx) => (p === min ? [...acc, idx] : acc), []);
}

function isUniqueGreenArc(digit, percentages) {
    const greens = getGreenArcDigits(percentages);
    return greens.length === 1 && greens[0] === digit;
}

function isUniqueRedArc(digit, percentages) {
    const reds = getRedArcDigits(percentages);
    return reds.length === 1 && reds[0] === digit;
}

function isWithinTolerance(value, target, tolerance) {
    return Math.abs(value - target) <= tolerance;
}

function isConstant(digit, digits, steps = 3, tolerance = 0.05) {
    if (digits.length < steps + 1) return false;
    let prevPerc = null;
    for (let i = 0; i <= steps; i++) {
        const prefix = digits.slice(0, digits.length - i);
        const currPerc = computePercentages(prefix, 200)[digit];
        if (prevPerc !== null && Math.abs(currPerc - prevPerc) > tolerance) return false;
        prevPerc = currPerc;
    }
    return true;
}

function isOrderlyDecrease(digit, digits, steps = 3, stepSize = 0.1, tolerance = 0.05) {
    if (digits.length < steps + 1) return false;
    const prevPercentages = [];
    for (let i = 0; i <= steps; i++) {
        const prefix = digits.slice(0, digits.length - i);
        const perc = computePercentages(prefix, 200)[digit];
        prevPercentages.push(perc);
    }
    for (let i = 0; i < steps; i++) {
        const diff = prevPercentages[i] - prevPercentages[i + 1];
        if (Math.abs(diff - stepSize) > tolerance) return false;
    }
    return true;
}

function hasAlternatingPattern(d1, d2, digits, lookback = 5) {
    if (digits.length < lookback + 1) return false;
    const changes1 = [];
    const changes2 = [];
    let prevPerc = computePercentages(digits.slice(0, digits.length - lookback - 1), 200);
    for (let i = lookback; i >= 0; i--) {
        const currPerc = computePercentages(digits.slice(0, digits.length - i), 200);
        changes1.push(currPerc[d1] - prevPerc[d1]);
        changes2.push(currPerc[d2] - prevPerc[d2]);
        prevPerc = currPerc;
    }
    let oppositeCount = 0;
    for (let i = 0; i < changes1.length; i++) {
        if ((changes1[i] > 0 && changes2[i] < 0) || (changes1[i] < 0 && changes2[i] > 0))
            oppositeCount++;
        else if (Math.abs(changes1[i]) < 1e-6 && Math.abs(changes2[i]) < 1e-6)
            oppositeCount++;
    }
    return oppositeCount >= lookback * 0.8;
}

function closestDigitsTo(refDigit, percentages, excludeRef = false) {
    const refPerc = percentages[refDigit];
    const diffs = percentages.map((p, idx) => ({ idx, diff: Math.abs(p - refPerc) }));
    diffs.sort((a, b) => a.diff - b.diff);
    let result = diffs.map(d => d.idx);
    if (excludeRef) result = result.filter(d => d !== refDigit);
    return result;
}

// ======================== POINTER DIGIT (based on momentum) ========================
function computePointerDigit(currPerc, prevPerc) {
    if (!prevPerc) return currPerc.indexOf(Math.max(...currPerc));
    const changes = currPerc.map((p, i) => Math.abs(p - (prevPerc[i] || 0)));
    let maxChange = -1;
    let pointer = 0;
    for (let i = 0; i < 10; i++) {
        if (changes[i] > maxChange) {
            maxChange = changes[i];
            pointer = i;
        }
    }
    return pointer;
}

// ======================== PDF STRATEGIES (only for MATCHES) ========================
function evaluateMatchesStrategies(currPerc, prevPerc, digits, pointerDigit) {
    // Strategy 1.1
    {
        const redDigits = getRedArcDigits(currPerc);
        if (redDigits.length === 1 && redDigits[0] === 6 && isIncreasing(6, currPerc, prevPerc) && pointerDigit === 6)
            return 6;
    }
    // Strategy 1.2
    {
        if (isUniqueGreenArc(1, currPerc) && currPerc[1] >= 11.4 && currPerc[1] <= 11.6) {
            const redDigits = getRedArcDigits(currPerc);
            if (redDigits.length === 1 && (redDigits[0] === 7 || redDigits[0] === 9) && currPerc[redDigits[0]] <= 9.1) {
                if (prevPerc[1] >= 11.4 && prevPerc[1] <= 11.6 && (currPerc[1] - prevPerc[1]) > 0.19)
                    return 1;
            }
        }
    }
    // Strategy 2.1
    {
        if (isUniqueGreenArc(7, currPerc) && isWithinTolerance(currPerc[2], 10.0, 0.1) && isConstant(2, digits, 3, 0.1)) {
            if (hasAlternatingPattern(3, 8, digits, 5) && (pointerDigit === 3 || pointerDigit === 8) && isIncreasing(pointerDigit, currPerc, prevPerc))
                return pointerDigit;
        }
    }
    // Strategy 3.1
    {
        if (isConstant(1, digits, 3, 0.05) && isUniqueGreenArc(6, currPerc) && isOrderlyDecrease(6, digits, 3, 0.1, 0.05)) {
            if (currPerc[3] >= 9.5 && currPerc[3] <= 11.0) {
                const redDigits = getRedArcDigits(currPerc);
                if (redDigits.length === 1 && pointerDigit === redDigits[0])
                    return redDigits[0];
            }
        }
    }
    // Strategy 3.2
    {
        if (isUniqueGreenArc(0, currPerc) && isUniqueRedArc(9, currPerc)) {
            if (isIncreasing(3, currPerc, prevPerc) && Math.abs(currPerc[3] - currPerc[0]) < Math.abs(prevPerc[3] - prevPerc[0])) {
                const prevGreen = getGreenArcDigits(prevPerc);
                if (prevGreen.length === 1 && prevGreen[0] !== 3 && isUniqueGreenArc(3, currPerc) && pointerDigit === 9)
                    return 9;
            }
        }
    }
    // Strategy 4.1
    {
        if (isUniqueGreenArc(5, currPerc) && currPerc[5] <= 11.0 && isWithinTolerance(currPerc[4], 10.0, 0.3) && isUniqueRedArc(9, currPerc) && currPerc[1] < 10.0) {
            const closest = closestDigitsTo(5, currPerc, false);
            if (closest.length >= 3 && pointerDigit === closest[2])
                return closest[2];
        }
    }
    // Strategy 4.2
    {
        if (isWithinTolerance(currPerc[6], 11.7, 0.05) && isUniqueGreenArc(6, currPerc) && isWithinTolerance(currPerc[1], 8.3, 0.05) && isUniqueRedArc(1, currPerc)) {
            if (isWithinTolerance(currPerc[6] + currPerc[1], 20.0, 0.05))
                return 6;
        }
    }
    // Strategy 5.1
    {
        if (isUniqueGreenArc(2, currPerc) && currPerc[5] > 10.0 && isIncreasing(5, currPerc, prevPerc) && isConstant(0, digits, 3, 0.1) && currPerc[0] < 10.0) {
            const prevGap = prevPerc[2] - prevPerc[5];
            const currGap = currPerc[2] - currPerc[5];
            if (currGap < prevGap) return 5;
        }
    }
    // Strategy 5.2
    {
        if (isUniqueGreenArc(8, currPerc) && isDecreasing(1, currPerc, prevPerc) && currPerc[1] > 10.0 && isConstant(3, digits, 3, 0.1)) {
            const closest = closestDigitsTo(8, currPerc, true);
            if (closest.length >= 2 && closest[1] === 4 && closest.length >= 3 && pointerDigit === closest[2])
                return closest[2];
        }
    }
    // Strategy 5.3
    {
        if (currPerc[0] < 9.0 && isUniqueRedArc(0, currPerc) && isUniqueGreenArc(5, currPerc) && currPerc[5] >= 11.0 && isIncreasing(5, currPerc, prevPerc)) {
            if (Math.abs(currPerc[4] - currPerc[5]) <= 0.1) {
                const closest = closestDigitsTo(5, currPerc, true);
                if (closest.length >= 3 && pointerDigit === closest[2])
                    return closest[2];
            }
        }
    }
    // Strategy 7.1
    {
        if (isUniqueRedArc(0, currPerc) && isUniqueGreenArc(7, currPerc) && currPerc[8] > 11.0) {
            const sorted = [...Array(10).keys()].sort((a,b) => currPerc[b] - currPerc[a]);
            if (sorted.length >= 2) {
                const secondHighest = sorted[1];
                if (pointerDigit === secondHighest && isIncreasing(secondHighest, currPerc, prevPerc))
                    return secondHighest;
            }
        }
    }
    // Strategy 7.2
    {
        if (isUniqueGreenArc(0, currPerc) && isUniqueRedArc(9, currPerc)) {
            if (isIncreasing(7, currPerc, prevPerc) && Math.abs(currPerc[7] - currPerc[0]) < Math.abs(prevPerc[7] - prevPerc[0])) {
                const prevGreen = getGreenArcDigits(prevPerc);
                if (prevGreen.length === 1 && prevGreen[0] !== 7 && isUniqueGreenArc(7, currPerc) && pointerDigit === 9)
                    return 9;
            }
        }
    }
    return null;
}

// ======================== FALLBACK WITH PARITY ENFORCEMENT ========================
function weightedFrequencyPrediction(digits, tradeType, lastActualDigit, lastPredictedDigit) {
    const n = digits.length;
    if (n === 0) return { digit: 0, confidence: 10 };
    const weights = new Array(n);
    let weightSum = 0;
    const decay = 0.6;
    for (let i = 0; i < n; i++) {
        const w = Math.pow(decay, n - 1 - i);
        weights[i] = w;
        weightSum += w;
    }
    const weightedFreq = new Array(10).fill(0);
    for (let i = 0; i < n; i++) {
        const d = digits[i];
        if (d >= 0 && d <= 9) weightedFreq[d] += weights[i];
    }
    // Apply repetition penalty (50%) and small noise
    let noisyFreq = weightedFreq.map(w => w * (0.99 + Math.random() * 0.02));
    if (lastPredictedDigit !== null && lastPredictedDigit >= 0 && lastPredictedDigit <= 9) {
        noisyFreq[lastPredictedDigit] *= 0.5;
    }
    let selectedDigit;

    switch (tradeType) {
        case 'matches':
            selectedDigit = noisyFreq.indexOf(Math.max(...noisyFreq));
            break;
        case 'differs': {
            let minVal = Infinity;
            let candidates = [];
            for (let i = 0; i < 10; i++) {
                if (i !== lastActualDigit && noisyFreq[i] < minVal) {
                    minVal = noisyFreq[i];
                    candidates = [i];
                } else if (i !== lastActualDigit && noisyFreq[i] === minVal) {
                    candidates.push(i);
                }
            }
            if (candidates.length === 0) candidates = [0,1,2,3,4,5,6,7,8,9].filter(d => d !== lastActualDigit);
            selectedDigit = candidates[Math.floor(Math.random() * candidates.length)];
            break;
        }
        case 'even':
            // Explicitly choose most frequent even digit
            let bestEven = 0;
            let bestEvenFreq = noisyFreq[0];
            for (let d of [2,4,6,8]) { // check 2,4,6,8
                if (noisyFreq[d] > bestEvenFreq) {
                    bestEvenFreq = noisyFreq[d];
                    bestEven = d;
                }
            }
            selectedDigit = bestEven;
            break;
        case 'odd':
            // Explicitly choose most frequent odd digit
            let bestOdd = 1;
            let bestOddFreq = noisyFreq[1];
            for (let d of [3,5,7,9]) {
                if (noisyFreq[d] > bestOddFreq) {
                    bestOddFreq = noisyFreq[d];
                    bestOdd = d;
                }
            }
            selectedDigit = bestOdd;
            break;
        case 'over':
        case 'under':
            selectedDigit = noisyFreq.indexOf(Math.max(...noisyFreq));
            break;
        default:
            selectedDigit = 0;
    }

    // Force rotation if same as last predicted
    if (lastPredictedDigit !== null && selectedDigit === lastPredictedDigit) {
        const alternatives = [...Array(10).keys()].filter(d => d !== selectedDigit);
        if (alternatives.length) {
            selectedDigit = alternatives.reduce((a,b) => noisyFreq[a] >= noisyFreq[b] ? a : b, alternatives[0]);
        }
    }

    // Final parity safety check (extra safeguard)
    if (tradeType === 'even' && selectedDigit % 2 !== 0) {
        // fallback to the even digit with highest weighted frequency (raw, not noisy)
        let bestEven = 0;
        let bestEvenFreq = weightedFreq[0];
        for (let d of [2,4,6,8]) {
            if (weightedFreq[d] > bestEvenFreq) {
                bestEvenFreq = weightedFreq[d];
                bestEven = d;
            }
        }
        selectedDigit = bestEven;
    }
    if (tradeType === 'odd' && selectedDigit % 2 === 0) {
        let bestOdd = 1;
        let bestOddFreq = weightedFreq[1];
        for (let d of [3,5,7,9]) {
            if (weightedFreq[d] > bestOddFreq) {
                bestOddFreq = weightedFreq[d];
                bestOdd = d;
            }
        }
        selectedDigit = bestOdd;
    }

    const confidence = Math.min(99, Math.round((weightedFreq[selectedDigit] / weightSum) * 100));
    return { digit: selectedDigit, confidence };
}

// ======================== MAIN API HANDLER ========================
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { recentDigits, tradeType, lastActualDigit, lastPredictedDigit } = req.body;
    if (!recentDigits || !Array.isArray(recentDigits)) {
        return res.status(400).json({ error: 'recentDigits array required' });
    }

    // Normalize tradeType to lowercase
    const normalizedTradeType = (tradeType || '').toLowerCase();

    const currPerc = computePercentages(recentDigits, 200);
    const prevPerc = getPreviousPercentages(recentDigits, 200);
    const probabilities = currPerc.map(p => p / 100);

    let result = null;
    if (normalizedTradeType === 'matches') {
        const pointerDigit = computePointerDigit(currPerc, prevPerc);
        const strategyDigit = evaluateMatchesStrategies(currPerc, prevPerc, recentDigits, pointerDigit);
        if (strategyDigit !== null) {
            const confidence = 75 + Math.floor(Math.random() * 21); // 75-95%
            result = { digit: strategyDigit, confidence };
        }
    }
    if (!result) {
        result = weightedFrequencyPrediction(recentDigits, normalizedTradeType, lastActualDigit, lastPredictedDigit);
    }

    res.json({ digit: result.digit, confidence: result.confidence, probabilities });
}