export default {
    props: {
        creators: {
            type: Array,
            required: true,
        },
        verifier: {
            type: String,
            required: true,
        },
        firstVictor: {
            type: String,
            default: '',
        },
    },
    template: `
        <div class="level-authors">
            <div class="type-title-sm">{{ creators.length > 1 ? 'Creators' : 'Creator' }}</div>
            <p class="type-body">
                <template v-for="(creator, index) in creators" :key="\`creator-\${creator}\`">
                    <span>{{ creator }}</span
                    ><span v-if="index < creators.length - 1">, </span>
                </template>
                <span v-if="creators.length === 0">Unknown</span>
            </p>
            <div class="type-title-sm">Verifier</div>
            <p class="type-body">
                <span>{{ verifier || 'Unknown' }}</span>
            </p>
            <div class="type-title-sm">First Victor</div>
            <p class="type-body">
                <span>{{ firstVictor || 'None yet' }}</span>
            </p>
        </div>
    `,
};
