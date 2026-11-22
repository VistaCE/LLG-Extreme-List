import { fetchList } from '../content.js';
import { getThumbnailFromId, getYoutubeIdFromUrl } from '../util.js';

import Spinner from '../components/Spinner.js';
import Btn from '../components/Btn.js';

/** Number of levels in one roulette run */
const ROUNDS = 25;

/** Levels past this rank are Legacy (only rolled if the Legacy box is ticked) */
const LEGACY_AFTER = 150;

/**
 * How strongly each pick sticks to that round's target difficulty.
 * A level's chance is e^(-STEEPNESS * distance from the target), so levels
 * further from the target are exponentially less likely.
 */
const STEEPNESS = 14;

/**
 * How slowly the difficulty ramps up. 1 = steady climb; higher numbers keep
 * the early rounds easy for longer and save the jump for the end.
 */
const RAMP = 1.6;

/** Round 1 is always one of the easiest levels: the easiest 5% of the pool */
const FIRST_ROUND_EASIEST = 0.05;

/** A pick is never further than this from the round's target difficulty */
const MAX_DISTANCE = 0.2;

/** Bumped when the save format changes so old (percentage) saves are ignored */
const SAVE_VERSION = 2;

/**
 * Pick ROUNDS levels, easiest first. Round 1 always comes from the easiest
 * levels in the pool, and each round after aims a bit harder until the last
 * round aims at the hardest level. A level is never picked twice in one run.
 */
function rollLevels(pool) {
    // pool is sorted hardest -> easiest
    const n = pool.length;
    // 0 = easiest level in the pool, 1 = hardest
    const difficulty = new Map(
        pool.map((lvl, idx) => [lvl, n === 1 ? 0 : 1 - idx / (n - 1)]),
    );
    const remaining = [...pool];
    const picked = [];

    for (let round = 0; round < Math.min(ROUNDS, n); round++) {
        const target = ROUNDS === 1 ? 0 : Math.pow(round / (ROUNDS - 1), RAMP);
        const dist = (lvl) => Math.abs(difficulty.get(lvl) - target);

        let candidates =
            round === 0
                ? remaining.filter((lvl) => difficulty.get(lvl) <= FIRST_ROUND_EASIEST)
                : remaining.filter((lvl) => dist(lvl) <= MAX_DISTANCE);
        if (candidates.length === 0) {
            // Small pool: fall back to the closest few levels to the target
            candidates = [...remaining].sort((a, b) => dist(a) - dist(b)).slice(0, 5);
        }

        const weights = candidates.map((lvl) => Math.exp(-STEEPNESS * dist(lvl)));
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        let choice = candidates[candidates.length - 1];
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) {
                choice = candidates[i];
                break;
            }
        }
        remaining.splice(remaining.indexOf(choice), 1);
        picked.push(choice);
    }

    return picked;
}

export default {
    components: { Spinner, Btn },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-roulette">
            <div class="sidebar">
                <p class="type-label-md" style="color: #aaa">
                    Based on the Extreme Demon Roulette by <a href="https://matcool.github.io/extreme-demon-roulette/" target="_blank">matcool</a>.
                </p>
                <p class="type-label-md">
                    Beat {{ rounds }} levels in a row. You have to beat each level fully to move on.
                    It always starts with an easy level and gets harder as you go.
                </p>
                <form class="options">
                    <div class="check">
                        <input type="checkbox" id="main" value="Main List" v-model="useMainList">
                        <label for="main">Main List (#1–#75)</label>
                    </div>
                    <div class="check">
                        <input type="checkbox" id="extended" value="Extended List" v-model="useExtendedList">
                        <label for="extended">Extended List (#76–#150)</label>
                    </div>
                    <div class="check">
                        <input type="checkbox" id="legacy" value="Legacy" v-model="useLegacy">
                        <label for="legacy">Legacy Levels (#151+)</label>
                    </div>
                    <Btn @click.native.prevent="onStart">{{ levels.length === 0 ? 'Start' : 'Restart'}}</Btn>
                </form>
                <p class="type-label-md" style="color: #aaa">
                    The roulette saves automatically.
                </p>
                <form class="save">
                    <p>Manual Load/Save</p>
                    <div class="btns">
                        <Btn @click.native.prevent="onImport">Import</Btn>
                        <Btn :disabled="!isActive" @click.native.prevent="onExport">Export</Btn>
                    </div>
                </form>
            </div>
            <section class="levels-container">
                <div class="levels">
                    <template v-if="levels.length > 0">
                        <p class="progress type-label-lg">Level {{ Math.min(beaten + 1, levels.length) }} of {{ levels.length }}</p>
                        <!-- Beaten Levels -->
                        <div class="level" v-for="(level, i) in levels.slice(0, beaten)">
                            <a :href="level.video || level.link" target="_blank" class="video">
                                <img v-if="thumb(level)" :src="thumb(level)" alt="">
                                <div v-else class="no-thumb">No video</div>
                            </a>
                            <div class="meta">
                                <p>#{{ level.rank }}<span v-if="level.rank > 150"> (Legacy)</span> · Round {{ i + 1 }}</p>
                                <h2>{{ level.name }}</h2>
                                <p style="color: #00b54b; font-weight: 700">Beaten</p>
                            </div>
                        </div>
                        <!-- Current Level -->
                        <div class="level" v-if="!hasCompleted && !givenUp">
                            <a :href="currentLevel.video || currentLevel.link" target="_blank" class="video">
                                <img v-if="thumb(currentLevel)" :src="thumb(currentLevel)" alt="">
                                <div v-else class="no-thumb">No video</div>
                            </a>
                            <div class="meta">
                                <p>#{{ currentLevel.rank }}<span v-if="currentLevel.rank > 150"> (Legacy)</span> · Round {{ beaten + 1 }}</p>
                                <h2>{{ currentLevel.name }}</h2>
                                <a v-if="currentLevel.link" :href="currentLevel.link" target="_blank" class="level-link">Play on LLG</a>
                            </div>
                            <form class="actions">
                                <Btn @click.native.prevent="onBeat">Beat it!</Btn>
                                <Btn @click.native.prevent="onGiveUp" style="background-color: #e91e63;">Give Up</Btn>
                            </form>
                        </div>
                        <!-- Results -->
                        <div v-if="givenUp || hasCompleted" class="results">
                            <h1>{{ hasCompleted ? 'You beat the roulette!' : 'Results' }}</h1>
                            <p>Levels beaten: {{ beaten }} / {{ levels.length }}</p>
                            <p v-if="beaten > 0">Hardest level beaten: #{{ hardestBeaten.rank }} {{ hardestBeaten.name }}</p>
                            <Btn v-if="givenUp && !showRemaining" @click.native.prevent="showRemaining = true">Show remaining levels</Btn>
                        </div>
                        <!-- Remaining Levels -->
                        <template v-if="givenUp && showRemaining">
                            <div class="level" v-for="(level, i) in levels.slice(beaten)">
                                <a :href="level.video || level.link" target="_blank" class="video">
                                    <img v-if="thumb(level)" :src="thumb(level)" alt="">
                                    <div v-else class="no-thumb">No video</div>
                                </a>
                                <div class="meta">
                                    <p>#{{ level.rank }}<span v-if="level.rank > 150"> (Legacy)</span> · Round {{ beaten + i + 1 }}</p>
                                    <h2>{{ level.name }}</h2>
                                    <p style="color: #d50000; font-weight: 700">{{ i === 0 ? 'Gave up here' : 'Not reached' }}</p>
                                </div>
                            </div>
                        </template>
                    </template>
                </div>
            </section>
            <div class="toasts-container">
                <div class="toasts">
                    <div v-for="toast in toasts" class="toast">
                        <p>{{ toast }}</p>
                    </div>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        loading: false,
        levels: [],
        beaten: 0, // number of levels beaten so far
        givenUp: false,
        showRemaining: false,
        useMainList: true,
        useExtendedList: true,
        useLegacy: false,
        toasts: [],
        fileInput: undefined,
        rounds: ROUNDS,
    }),
    mounted() {
        // Create File Input
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.multiple = false;
        this.fileInput.accept = '.json';
        this.fileInput.addEventListener('change', this.onImportUpload);

        // Load progress from local storage
        let roulette = null;
        try {
            roulette = JSON.parse(localStorage.getItem('roulette'));
        } catch {
            roulette = null;
        }

        if (!this.isValidSave(roulette)) {
            return;
        }

        this.levels = roulette.levels;
        this.beaten = roulette.beaten;
    },
    computed: {
        currentLevel() {
            return this.levels[this.beaten];
        },
        hasCompleted() {
            return this.levels.length > 0 && this.beaten >= this.levels.length;
        },
        hardestBeaten() {
            return this.levels
                .slice(0, this.beaten)
                .reduce((a, b) => (b.rank < a.rank ? b : a));
        },
        isActive() {
            return (
                this.levels.length > 0 &&
                !this.givenUp &&
                !this.hasCompleted
            );
        },
    },
    methods: {
        getThumbnailFromId,
        getYoutubeIdFromUrl,
        thumb(level) {
            const id = level.video ? getYoutubeIdFromUrl(level.video) : '';
            return id ? getThumbnailFromId(id) : '';
        },
        isValidSave(save) {
            return (
                save &&
                save.version === SAVE_VERSION &&
                Array.isArray(save.levels) &&
                Number.isInteger(save.beaten)
            );
        },
        async onStart() {
            if (this.isActive && this.beaten > 0) {
                this.showToast('Give up before starting a new roulette.');
                return;
            }

            if (!this.useMainList && !this.useExtendedList && !this.useLegacy) {
                this.showToast('Pick at least one list.');
                return;
            }

            this.loading = true;

            const fullList = await fetchList();

            if (!fullList || fullList.filter(([_, err]) => err).length > 0) {
                this.loading = false;
                this.showToast(
                    'List is currently broken. Wait until it\'s fixed to start a roulette.',
                );
                return;
            }

            const fullListMapped = fullList
                .map(([lvl, _], i) => ({
                    rank: i + 1,
                    id: lvl.id,
                    name: lvl.name,
                    video: lvl.videoOnYoutube ? lvl.verification : '',
                    link: lvl.link || '',
                }));

            // Pool stays sorted hardest -> easiest
            const pool = [];
            if (this.useMainList) pool.push(...fullListMapped.slice(0, 75));
            if (this.useExtendedList) pool.push(...fullListMapped.slice(75, LEGACY_AFTER));
            if (this.useLegacy) pool.push(...fullListMapped.slice(LEGACY_AFTER));

            this.levels = rollLevels(pool);
            this.beaten = 0;
            this.showRemaining = false;
            this.givenUp = false;
            this.save();

            this.loading = false;
        },
        save() {
            localStorage.setItem(
                'roulette',
                JSON.stringify({
                    version: SAVE_VERSION,
                    levels: this.levels,
                    beaten: this.beaten,
                }),
            );
        },
        onBeat() {
            this.beaten++;
            if (this.hasCompleted) {
                localStorage.removeItem('roulette');
                return;
            }
            this.save();
        },
        onGiveUp() {
            this.givenUp = true;
            localStorage.removeItem('roulette');
        },
        onImport() {
            if (
                this.isActive &&
                !window.confirm('This will overwrite the currently running roulette. Continue?')
            ) {
                return;
            }

            this.fileInput.showPicker();
        },
        async onImportUpload() {
            if (this.fileInput.files.length === 0) return;

            const file = this.fileInput.files[0];

            try {
                const roulette = JSON.parse(await file.text());

                if (!this.isValidSave(roulette)) {
                    this.showToast('Invalid file.');
                    return;
                }

                this.levels = roulette.levels;
                this.beaten = roulette.beaten;
                this.save();
                this.givenUp = false;
                this.showRemaining = false;
            } catch {
                this.showToast('Invalid file.');
            } finally {
                this.fileInput.value = '';
            }
        },
        onExport() {
            const file = new Blob(
                [JSON.stringify({
                    version: SAVE_VERSION,
                    levels: this.levels,
                    beaten: this.beaten,
                })],
                { type: 'application/json' },
            );
            const a = document.createElement('a');
            a.href = URL.createObjectURL(file);
            a.download = 'hlll_roulette.json';
            a.click();
            URL.revokeObjectURL(a.href);
        },
        showToast(msg) {
            this.toasts.push(msg);
            setTimeout(() => {
                this.toasts.shift();
            }, 3000);
        },
    },
};
