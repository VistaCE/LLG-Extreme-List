/**
 * Numbers of decimal digits to round to
 */
const scale = 3;

/**
 * Calculate the score awarded when having a certain percentage on a list level
 * @param {Number} rank Position on the list
 * @param {Number} percent Percentage of completion
 * @param {Number} minPercent Minimum percentage required
 * @returns {Number}
 */
export function score(rank, percent, minPercent) {
    if (rank > 75 && percent < 100) {
        return 0;
    }

    // Older formula
    /*
    let score = (100 / Math.sqrt((rank - 1) / 50 + 0.444444) - 50) *
        ((percent - (minPercent - 1)) / (100 - (minPercent - 1)));
    */
    // Old formula
    /*
    let score = (-24.9975*Math.pow(rank-1, 0.4) + 200) *
        ((percent - (minPercent - 1)) / (100 - (minPercent - 1)));

    score = Math.max(0, score);

    if (percent != 100) {
        return round(score - score / 3);
    }
    */
    // Previous formula (added by XDtoMe)
    /*
    let score = (500*Math.pow(0.95, rank-1))
    */

    // Only the top 150 levels give points
    if (rank > 150) {
        return 0;
    }

    // Current formula: same shape as XDtoMe's, but 0.96 instead of 0.95 so
    // points taper off slower. #1 = 500, #150 = ~1.14 (always at least 1).
    let score = 500 * Math.pow(0.96, rank - 1);

    return Math.max(round(score), 1);
}

export function round(num) {
    if (!('' + num).includes('e')) {
        return +(Math.round(num + 'e+' + scale) + 'e-' + scale);
    } else {
        var arr = ('' + num).split('e');
        var sig = '';
        if (+arr[1] + scale > 0) {
            sig = '+';
        }
        return +(
            Math.round(+arr[0] + 'e' + sig + (+arr[1] + scale)) +
            'e-' +
            scale
        );
    }
}
