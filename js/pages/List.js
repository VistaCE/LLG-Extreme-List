import { store } from "../main.js";
import { embed, getYoutubeIdFromUrl } from "../util.js";
import { score } from "../score.js";
import { fetchEditors, fetchList } from "../content.js";

import Spinner from "../components/Spinner.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

const roleIconMap = {
    owner: "crown",
    admin: "user-gear",
    helper: "user-shield",
    dev: "code",
    trial: "user-lock",
};

// Label colours used on the HLLL spreadsheet
const labelMap = {
    green: {
        name: "Green",
        text: "Likely to be moved up / deemed harder than its current placement.",
    },
    yellow: {
        name: "Yellow",
        text: "Lacks opinion / true difficulty is unclear (confusing tech, unconventional gameplay).",
    },
    red: {
        name: "Red",
        text: "Likely to be moved down / deemed easier than its current placement.",
    },
    purple: {
        name: "Pink",
        text: "???",
    },
    cyan: {
        name: "Cyan",
        text: "Newly placed level.",
    },
};

export default {
    components: { Spinner, LevelAuthors },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-list">
            <div class="list-container">
                <table class="list" v-if="list">
                    <tr v-for="([level, err], i) in list">
                        <td class="rank">
                            <p class="type-label-lg" :class="{ 'legacy-rank': i + 1 > 150 }" :title="i + 1 > 150 ? 'Legacy (past #150, gives no points)' : null">#{{ i + 1 }}</p>
                        </td>
                        <td class="level" :class="{ 'active': selected == i, 'error': !level }">
                            <button @click="selected = i">
                                <span v-if="level?.label" class="label-dot" :class="'label-' + level.label" :title="labelMap[level.label]?.name + ' label'"></span>
                                <span class="type-label-lg">{{ level?.name || \`Error (\${err}.json)\` }}</span>
                            </button>
                        </td>
                    </tr>
                </table>
            </div>
            <div class="level-container">
                <div class="level" v-if="level">
                    <div class="level-title">
                        <h1>{{ level.name }}</h1>
                        <span v-if="level.label" class="label-badge" :class="'label-' + level.label" :title="labelMap[level.label]?.text">
                            {{ labelMap[level.label]?.name }} label
                        </span>
                    </div>
                    <LevelAuthors :creators="level.creators" :verifier="level.verifier" :first-victor="level.firstVictor"></LevelAuthors>
                    <iframe v-if="youtubeId" class="video" id="videoframe" :src="video" frameborder="0" allowfullscreen></iframe>
                    <div v-else-if="level.verification" class="video video-placeholder">
                        <p>This video is not on YouTube.</p>
                        <a :href="level.verification" target="_blank" class="video-link not-youtube type-label-lg">{{ videoLabel }}</a>
                    </div>
                    <div v-else class="video video-placeholder">
                        <p>No video available for this level yet.</p>
                    </div>
                    <ul class="stats">
                        <li>
                            <div class="type-title-sm">Level Difficulty</div>
                            <p>{{ level.difficulty || 'Unrated' }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">Points</div>
                            <p v-if="selected + 1 <= 150">{{ score(selected + 1, 100, 100) }}</p>
                            <p v-else>0 (Legacy)</p>
                        </li>
                        <li>
                            <div class="type-title-sm">Link</div>
                            <p>
                                <a v-if="level.link" :href="level.link" target="_blank" class="level-link">Play on LLG</a>
                                <span v-else>None</span>
                            </p>
                        </li>
                    </ul>
                    <h2>Records ({{ level.records?.length || 0 }})</h2>
                    <p v-if="!level.records || level.records.length === 0">No other completions on the LLG leaderboard yet.</p>
                    <table v-else class="records">
                        <tr v-for="record in level.records" class="record">
                            <td class="user">
                                <p class="type-label-lg">{{ record.user }}</p>
                            </td>
                            <td class="date">
                                <p>{{ record.completedAt }}</p>
                            </td>
                            <td class="proof">
                                <a :href="record.link" target="_blank" class="level-link">Link</a>
                            </td>
                        </tr>
                    </table>
                </div>
                <div v-else class="level" style="height: 100%; justify-content: center; align-items: center;">
                    <p>(ノಠ益ಠ)ノ彡┻━┻</p>
                </div>
            </div>
            <div class="meta-container">
                <div class="meta">
                    <div class="errors" v-show="errors.length > 0">
                        <p class="error" v-for="error of errors">{{ error }}</p>
                    </div>
                    <div class="og">
                        <p class="type-label-md">Website layout made by <a href="https://tsl.pages.dev/" target="_blank">TheShittyList</a></p>
                    </div>
                    <h3>List Mods</h3>
                    <ol class="editors" v-if="editors && editors.length > 0">
                        <li v-for="editor in editors">
                            <img :src="\`./assets/\${roleIconMap[editor.role]}\${store.dark ? '-dark' : ''}.svg\`" :alt="editor.role">
                            <a v-if="editor.link" class="type-label-lg link" target="_blank" :href="editor.link">{{ editor.name }}</a>
                            <p v-else>{{ editor.name }}</p>
                        </li>
                    </ol>
                    <p v-else>No one yet</p>
                    <h3>HLLL Rules</h3>
                    <p>
                        The requirements for a level to get into this list is to be <strong>AT LEAST 3 STARS</strong> in quality and rated as an <strong>EXTREME</strong> in difficulty.
                    </p>
                    <p>
                        The "Verifiers" of OLD extremes that did not have the clear check, are the <strong>FIRST VICTORS</strong> of those certain levels <strong>UNLESS</strong> there is video proof of someone beating that level first.
                    </p>
                    <p>
                        LLG Link: <a class="link" href="https://www.doodleslauncher.com/llg" target="_blank">https://www.doodleslauncher.com/llg</a>
                    </p>
                    <h3>Label Meanings</h3>
                    <p>
                        Labels are used for recently placed levels or levels where the opinion of its difficulty is unclear. It will take time for placements to be changed.
                    </p>
                    <ul class="labels">
                        <li v-for="(info, key) in labelMap">
                            <span class="label-dot" :class="'label-' + key"></span>
                            <p><strong :class="'label-text-' + key">{{ info.name.toUpperCase() }}</strong> — {{ info.text }}</p>
                        </li>
                    </ul>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        list: [],
        editors: [],
        loading: true,
        selected: 0,
        errors: [],
        roleIconMap,
        labelMap,
        store,
    }),
    computed: {
        level() {
            return this.list?.[this.selected]?.[0];
        },
        youtubeId() {
            if (!this.level?.verification || !this.level.videoOnYoutube) {
                return "";
            }
            return getYoutubeIdFromUrl(this.level.verification);
        },
        video() {
            return embed(this.level.verification);
        },
        videoLabel() {
            return this.level?.videoPartial ? "Video (partial)" : "Video";
        },
    },
    async mounted() {
        this.list = await fetchList();
        this.editors = await fetchEditors();

        // Error handling
        if (!this.list) {
            this.errors = [
                "Failed to load list. Retry in a few minutes or notify list staff.",
            ];
        } else {
            this.errors.push(
                ...this.list
                    .filter(([_, err]) => err)
                    .map(([_, err]) => {
                        return `Failed to load level. (${err}.json)`;
                    })
            );
            if (!this.editors) {
                this.errors.push("Failed to load list mods.");
            }
        }

        // Hide loading spinner
        this.loading = false;
    },
    methods: {
        embed,
        score,
    },
};
