// Opaque surface colors for browser chrome; no changes to the in-app palette.
export const HUB_EDGE_COLOR = "#f6f8f7";
const STORY_COLORS = { sky: "#e0f2fe", sage: "#b7d3b0", rose: "#f4c6d2" } as const;

function characterSurface(hex: string): string {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#dce4e9";
    // Blend toward white, matching the light character-tinted workspace.
    const channels = [1, 3, 5].map(i => Math.round(255 * 0.78 + parseInt(hex.slice(i, i + 2), 16) * 0.22));
    return "#" + channels.map(c => c.toString(16).padStart(2, "0")).join("");
}

export function browserChromeColor(mode: string, storyTheme: keyof typeof STORY_COLORS, characterHex: string, hasCharacter: boolean): string {
    switch (mode) {
        case "hub": return HUB_EDGE_COLOR;
        case "charta": return "#f7f8f5";
        case "lime": return "#fafaf9";
        case "novel": return "#fdf6e3";
        case "sliding": return STORY_COLORS[storyTheme] ?? STORY_COLORS.sky;
        case "infinite": return hasCharacter ? characterSurface(characterHex) : "#dce4e9";
        case "chat": return hasCharacter ? characterSurface(characterHex) : "#f3f7f4";
        default: return HUB_EDGE_COLOR;
    }
}
