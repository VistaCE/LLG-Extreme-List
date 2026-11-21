/**
 * Numbers of decimal digits to round to
 */
const scale = 2;

/**
 * Calculate the score awarded when having a certain percentage on a list level
 * @param {Number} rank Position on the list
 * @param {Number} percent Percentage of completion
 * @param {Number} minPercent Minimum percentage required
 * @returns {Number}
 */
export function score(rank, percent, minPercent) {
    // If ranked outside top 150, give 0 points
    if (rank > 150) {
        return 0;
    }

    // Depreciation factor changed to 0.96 from 0.95 by vista, so points taper off slower
    // #1 = 500, #150 = 1.14. Rounded to 2 decimal places.
    return round(500 * Math.pow(0.96, rank - 1));
}

// Rounds to 2 decimal places (see `scale` above)
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
