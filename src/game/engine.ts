/**
 * API สาธารณะของ rules-engine (ตาม docs/CONTRACT.md)
 * ฟังก์ชันที่ต้องใช้แผนที่ดึงจาก getMap(state.mapId); ตรรกะจริงอยู่ใน core.ts
 */
import type { ActivityType, GameState, PlanPreview, PlannedAction } from './types';
import { getMap } from '../data/maps';
import { activitiesAtWithMap, previewPlanWithMap, resolveNextSlotWithMap } from './core';

export {
  createGame,
  beginPlanning,
  submitPlan,
  payDebt,
  nextWeek,
  normalizeLoaded,
  priorityOrder,
  getPlayer,
  normalizeActions,
  resolveNextSlotWithMap,
  previewPlanWithMap,
  activitiesAtWithMap,
} from './core';
export { findPath, validatePath, findEdge, areAdjacent, neighbors, getNode } from './paths';
export { computeScores } from './scoring';
export { activityInfo, shiftCapacity } from './rules';
export { reasonText } from './reasons';

export function resolveNextSlot(state: GameState): GameState {
  if (state.phase !== 'reveal') return state;
  return resolveNextSlotWithMap(state, getMap(state.mapId));
}

export function previewPlan(state: GameState, playerId: string, actions: PlannedAction[]): PlanPreview {
  return previewPlanWithMap(state, getMap(state.mapId), playerId, actions);
}

export function activitiesAt(state: GameState, nodeId: string): ActivityType[] {
  return activitiesAtWithMap(state, getMap(state.mapId), nodeId);
}
