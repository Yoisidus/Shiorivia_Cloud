// Match the surfaces touching the viewport, never the chat's accent color.
export const HUB_EDGE_COLOR = "#f6f8f7";
type ViaeView = "directory" | "create" | "conversation";
type EdgeColors = { top: string; bottom: string };

export function browserChromeEdges(mode: string, viaeView: ViaeView = "directory"): EdgeColors {
    switch (mode) {
        case "infinite":
        case "sliding":
        case "chat":
            return { top: "#ffffff", bottom: "#ffffff" };
        case "novel":
            return { top: "#fdf6e3", bottom: "#fdf6e3" };
        case "charta":
            return { top: "#f7f8f5", bottom: "#f7f8f5" };
        case "lime":
            return { top: "#ffffff", bottom: viaeView === "directory" ? "#152841" : viaeView === "create" ? "#fcfcfb" : "#ffffff" };
        default:
            return { top: HUB_EDGE_COLOR, bottom: HUB_EDGE_COLOR };
    }
}

// Modern WebKit samples the canvas/edge elements; theme-color is a single
// color hint for browsers that support it. Native chrome remains OS-controlled.
export function applyBrowserChromeEdges(document: Document, colors: EdgeColors): void {
    document.documentElement.style.setProperty("--app-edge-color", colors.top);
    document.documentElement.style.setProperty("--app-bottom-edge-color", colors.bottom);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors.top);
}
