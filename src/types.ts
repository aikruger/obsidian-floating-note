export interface NoteGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SavedDashboardTab {
    notePath: string;
    isActive?: boolean;
}

export interface SavedDashboardGroup {
    id: string;
    tabs: SavedDashboardTab[];
}

export interface SavedFloatingDashboard {
    id: string;
    name: string;
    width: number;
    height: number;
    x?: number;
    y?: number;
    position?: 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'custom';
    opacity: number;
    alwaysOnTop: boolean;
    openOnStartup: boolean;
    groups: SavedDashboardGroup[];
}

export interface FloatingNoteSettings {
    defaultWidth: number;
    defaultHeight: number;
    rememberPosition: boolean;
    defaultPosition: 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    notePositions: Record<string, NoteGeometry>;
    alwaysOnTop: boolean;
    defaultOpacity: number;
    savedDashboards: SavedFloatingDashboard[];
}

export const DEFAULT_SETTINGS: FloatingNoteSettings = {
    defaultWidth: 400,
    defaultHeight: 600,
    rememberPosition: true,
    defaultPosition: 'top-right',
    notePositions: {},
    alwaysOnTop: true,
    defaultOpacity: 1.0,
    savedDashboards: [],
};