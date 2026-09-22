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
  isResearchMode: false,
  isComparisonMode: false,
  comparisonSplit: 50, // percentage (0 to 100)

  // ── Terrain & Visualization Controls ──
  terrainExaggeration: 2.0, // 1.0x to 5.0x
  deepZoomLevel: 'orbit',   // 'orbit' | 'approach' | 'surface' | 'submeter'
  measurementActive: false,

  // ── UI Navigation & Audio ──
  commandPaletteOpen: false,
  audioMuted: soundEngine.isMuted,

  // ── 3D Rover Simulation State ──
  simulation: {
    isPlaying: false,
    speed: 1, // 1x, 2x, 4x, 16x
    currentTime: 240, // seconds
    totalDuration: 872, // seconds (~14.5 min)
    battery: 86.4, // %
    speedMps: 0.18, // m/s
    heading: 142.5, // degrees azimuth
    pitch: 3.8, // degrees
    roll: -1.2, // degrees
    slope: 4.2, // degrees
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

  setSimulationTime: (currentTime) => {
    set((state) => ({
      simulation: { ...state.simulation, currentTime }
    }));
  },

  updateRoverTelemetry: (updates) => {
    set((state) => ({
      simulation: { ...state.simulation, ...updates }
    }));
  },

  addMissionLog: (event, type = 'info') => {
    const timeStr = `T+${Math.floor(get().simulation.currentTime / 60).toString().padStart(2, '0')}:${(get().simulation.currentTime % 60).toString().padStart(2, '0')}`;
    set((state) => ({
      simulation: {
        ...state.simulation,
        logs: [{ time: timeStr, event, type }, ...state.simulation.logs].slice(0, 25)
      }
    }));
  },
}));
