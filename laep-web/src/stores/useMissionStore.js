import { create } from 'zustand';
import { soundEngine } from '../lib/soundEffects';

export const LAYER_IDS = {
  OPTICAL:     'optical',
  TERRAIN:     'terrain',
  SLOPE:       'slope',
  ROUGHNESS:   'roughness',
  ILLUMINATION:'illumination',
  CPR:         'cpr',
  DOP:         'dop',
  ICE:         'ice',
  HAZARD:      'hazard',
  ROUTE:       'route',
  BOUNDS:      'bounds',
};

export const INITIAL_LAYERS_VISIBLE = {
  [LAYER_IDS.OPTICAL]:     true,
  [LAYER_IDS.TERRAIN]:     false,
  [LAYER_IDS.SLOPE]:       false,
  [LAYER_IDS.ROUGHNESS]:   false,
  [LAYER_IDS.ILLUMINATION]:false,
  [LAYER_IDS.CPR]:         false,
  [LAYER_IDS.DOP]:         false,
  [LAYER_IDS.ICE]:         true,
  [LAYER_IDS.HAZARD]:      false,
  [LAYER_IDS.ROUTE]:       true,
  [LAYER_IDS.BOUNDS]:      true,
  craters:                 true,
  ch2:                     false,
};

export const INITIAL_MISSION_LOGS = [
  { time: 'T+00:00', event: 'Lunar South Polar Orbit Initialized (100 km Altitude)', type: 'info' },
  { time: 'T+00:12', event: 'Landing Zone Acquired: Faustini Crater North Rim', type: 'success' },
  { time: 'T+01:45', event: 'DFSAR Ground Track Synchronized with MCMF Grid', type: 'info' },
  { time: 'T+03:20', event: 'Solar Elevation Adjusted: 2.8° Above Polar Horizon', type: 'info' },
  { time: 'T+04:55', event: 'Cold Trap Shadow Persistence Confirmed (96% Area)', type: 'success' },
  { time: 'T+06:10', event: 'Subsurface CPR Anomaly Flagged (Peak CPR = 1.47)', type: 'warning' },
  { time: 'T+08:30', event: 'Kinematic A* Route Locked: 4.72 km Path Calculated', type: 'success' },
];

export const useMissionStore = create((set, get) => ({
  // ── Scientific & Crater Target State ──
  selectedCrater: null,
  solarElevation: 2.8, // degrees
  activeLayer: LAYER_IDS.ICE,
  layersVisible: INITIAL_LAYERS_VISIBLE,
  isResearchMode: false,
  isComparisonMode: false,
  comparisonSplit: 50, // percentage (0 to 100)

  // ── Authentication & Role-Based Clearance ──
  userRole: 'explorer', // 'explorer' | 'scientist'
  setUserRole: (role) => set({ userRole: role }),
  clearanceModalOpen: false,
  setClearanceModalOpen: (open) => set({ clearanceModalOpen: open }),

  // ── AI Assistant Sidebar ──
  aiAssistantOpen: false,
  setAiAssistantOpen: (open) => set({ aiAssistantOpen: open }),
  toggleAiAssistant: () => set((s) => ({ aiAssistantOpen: !s.aiAssistantOpen })),

  // ── Terrain & Visualization Controls ──
  terrainExaggeration: 2.0, // 1.0x to 5.0x
  deepZoomLevel: 'orbit',   // 'orbit' | 'approach' | 'surface' | 'submeter'
  measurementActive: false,

  // ── UI Navigation & Audio ──
  commandPaletteOpen: false,
  audioMuted: soundEngine.isMuted,

  // ── Real A* Route Telemetry from Backend ──
  activeRouteTelemetry: null,

  // ── 3D Rover Simulation State ──
  simulation: {
    isPlaying: false,
    speed: 1, // 1x, 2x, 5x
    progress: 0.0,
    speedMps: 0.18, // m/s
    heading: 142.5, // degrees azimuth
    pitch: 3.8, // degrees
    roll: -1.2, // degrees
    slope: 4.2, // degrees
    slipRisk: 12,
    logs: INITIAL_MISSION_LOGS,
  },

  // ── Actions ──
  selectCrater: (crater) => {
    soundEngine.playTargetAcquired();
    set({ selectedCrater: crater });
  },

  setSolarElevation: (angle) => {
    set({ solarElevation: angle });
  },

  setActiveLayer: (layerId) => {
    soundEngine.playTelemetryClick();
    set({ activeLayer: layerId });
  },

  toggleLayerVisibility: (layerId) => {
    soundEngine.playTelemetryClick();
    set((state) => ({
      layersVisible: {
        ...state.layersVisible,
        [layerId]: !state.layersVisible[layerId],
      },
      // If toggled on, also set as active channel
      activeLayer: !state.layersVisible[layerId] ? layerId : state.activeLayer,
    }));
  },

  setLayersVisible: (layersVisible) => {
    set({ layersVisible });
  },

  setActiveRouteTelemetry: (telemetry) => {
    set({ activeRouteTelemetry: telemetry });
  },

  setSimulation: (patch) => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        ...(typeof patch === 'function' ? patch(state.simulation) : patch),
      },
    }));
  },

  toggleResearchMode: () => {
    soundEngine.playTelemetryClick();
    set((state) => ({ isResearchMode: !state.isResearchMode }));
  },

  toggleComparisonMode: () => {
    soundEngine.playTelemetryClick();
    set((state) => ({ isComparisonMode: !state.isComparisonMode }));
  },

  setComparisonSplit: (split) => {
    set({ comparisonSplit: split });
  },

  setTerrainExaggeration: (val) => {
    set({ terrainExaggeration: val });
  },

  setDeepZoomLevel: (level) => {
    soundEngine.playTelemetryClick();
    set({ deepZoomLevel: level });
  },

  toggleMeasurement: () => {
    soundEngine.playTelemetryClick();
    set((state) => ({ measurementActive: !state.measurementActive }));
  },

  setCommandPaletteOpen: (open) => {
    if (open) soundEngine.playTelemetryClick();
    set({ commandPaletteOpen: open });
  },

  toggleAudio: () => {
    const nextMuted = soundEngine.toggleMuted();
    set({ audioMuted: nextMuted });
  },

  // ── Simulation Actions ──
  setSimulationPlaying: (isPlaying) => {
    soundEngine.playTelemetryClick();
    set((state) => ({
      simulation: { ...state.simulation, isPlaying }
    }));
  },

  setSimulationSpeed: (speed) => {
    soundEngine.playTelemetryClick();
    set((state) => ({
      simulation: { ...state.simulation, speed }
    }));
  },

  setSimulationProgress: (progress) => {
    set((state) => ({
      simulation: { ...state.simulation, progress }
    }));
  },

  updateRoverTelemetry: (updates) => {
    set((state) => ({
      simulation: { ...state.simulation, ...updates }
    }));
  },

  addMissionLog: (event, type = 'info') => {
    const timeStr = `T+00:${Math.floor(Math.random() * 50 + 10)}`;
    set((state) => ({
      simulation: {
        ...state.simulation,
        logs: [{ time: timeStr, event, type }, ...state.simulation.logs].slice(0, 25)
      }
    }));
  },
}));
