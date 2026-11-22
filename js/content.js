import { round, score } from './score.js';

/**
 * Path to directory containing `_list.json` and all levels
 */
const dir = './data';

/**
 * Players left off the leaderboard. Their verifications, first victories,
 * records and levels still show on the list as normal.
 */
const hiddenFromLeaderboard = ['AnOrangeGamer'];

export async function fetchList() {
    const listResult = await fetch(`${dir}/_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${dir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        {
                            ...level,
                            path,
                            records: level.records.sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load list.`);
        return null;
    }
}

export async function fetchEditors() {
    try {
        const editorsResults = await fetch(`${dir}/_editors.json`);
        const editors = await editorsResults.json();
        return editors;
    } catch {
        return null;
    }
}

export async function fetchLeaderboard() {
    const list = await fetchList();

    const scoreMap = {};
    const errs = [];
    list.forEach(([level, err], rank) => {
        if (err) {
            errs.push(err);
            return;
        }

        // Verification
        if (!level.verifier) return;
        const verifier = Object.keys(scoreMap).find(
            (u) => u.toLowerCase() === level.verifier.toLowerCase(),
        ) || level.verifier;
        scoreMap[verifier] ??= {
            verified: [],
            completed: [],
            progressed: [],
        };
        const { verified } = scoreMap[verifier];
        verified.push({
            rank: rank + 1,
            level: level.name,
            score: score(rank + 1, 100, 100),
            link: level.verification || level.link,
        });

        // First victor counts as a completion (unless they also verified it)
        const fv = (level.firstVictor || '').trim();
        if (fv && fv.toLowerCase() !== (level.verifier || '').toLowerCase()) {
            const victor = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === fv.toLowerCase(),
            ) || fv;
            scoreMap[victor] ??= {
                verified: [],
                completed: [],
                progressed: [],
            };
            // Hopefully this removes duplicate first victor/main records points allocations for now, temporary fix before Vista actually makes it an either one gives you the points but not both, until I add first victor to main records for all of them, so that its not confusing
            /*
            scoreMap[victor].completed.push({
                rank: rank + 1,
                level: level.name,
                score: score(rank + 1, 100, 100),
                link: level.link,
            });
            */
        }

        // Records
        level.records.forEach((record) => {
            const user = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === record.user.toLowerCase(),
            ) || record.user;
            scoreMap[user] ??= {
                verified: [],
                completed: [],
                progressed: [],
            };
            const { completed, progressed } = scoreMap[user];
            if (record.percent === 100) {
                completed.push({
                    rank: rank + 1,
                    level: level.name,
                    score: score(rank + 1, 100, 100),
                    link: record.link,
                });
                return;
            }

            progressed.push({
                rank: rank + 1,
                level: level.name,
                percent: record.percent,
                score: score(rank + 1, record.percent, 100),
                link: record.link,
            });
        });
    });

    // Wrap in extra Object containing the user and total score
    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed } = scores;
        const total = [verified, completed, progressed]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);

        return {
            user,
            total: round(total), // 2 decimal places
            ...scores,
        };
    });

    // Sort by total score
    const hidden = hiddenFromLeaderboard.map((u) => u.toLowerCase());
    const shown = res.filter((e) => !hidden.includes(e.user.toLowerCase()));

    return [shown.sort((a, b) => b.total - a.total), errs];
}
