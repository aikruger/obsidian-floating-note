export interface NoteGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SavedConfiguration {
    id: string;           // Unique slug, e.g. "daily-notes-sidebar"
    name: string;         // Human-readable display name
    notePath: string;     // Vault-relative path to the note, e.g. "Daily/2026-07-22.md"
    position: 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'custom';
    customX?: number;     // Used when position === 'custom'
    customY?: number;
    width: number;
    height: number;
    opacity: number;
    alwaysOnTop: boolean;
    openOnStartup: boolean;
}

export interface FloatingNoteSettings {
    defaultWidth: number;
    defaultHeight: number;
    rememberPosition: boolean;
    defaultPosition: 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    notePositions: Record<string, NoteGeometry>;
    alwaysOnTop: boolean;
    defaultOpacity: number;
    savedConfigurations: SavedConfiguration[];
}

export const DEFAULT_SETTINGS: FloatingNoteSettings = {
    defaultWidth: 400,
    defaultHeight: 600,
    rememberPosition: true,
    defaultPosition: 'top-right',
    notePositions: {},
    alwaysOnTop: true,
    defaultOpacity: 1.0,
    savedConfigurations: [],
};