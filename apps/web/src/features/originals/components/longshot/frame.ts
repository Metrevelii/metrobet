import {
  CRASH_BETTING_MS,
  crashElapsedFor,
  crashMultiplierAt,
  type CrashRound,
} from '@metrobet/contracts';

import { clamp01 } from './math';

/** Everything the scene needs for one frame, derived from round state and server time only. */
export type SceneFrame = {
  phase: 'betting' | 'running' | 'crashed';
  /** 0 → 1 across the betting countdown. */
  bettingProgress: number;
  bettingRemainingMs: number;
  /** Time since launch while running; total flight time once crashed. */
  flightMs: number;
  multiplier: number;
  /** Time since the crash; 0 before it. */
  sinceCrashMs: number;
};

/**
 * The scene is state-driven (ported from Skyforge's scene-kit): the same round and time always
 * draw the same picture, so joining mid-round or reconnecting needs no special handling.
 */
export function sceneFrame(round: CrashRound, serverNow: number): SceneFrame {
  const frame: SceneFrame = {
    phase: 'betting',
    bettingProgress: 0,
    bettingRemainingMs: 0,
    flightMs: 0,
    multiplier: 1,
    sinceCrashMs: 0,
  };
  if (round.phase === 'betting') {
    const opened = round.bettingEndsAt - CRASH_BETTING_MS;
    frame.bettingProgress = clamp01((serverNow - opened) / CRASH_BETTING_MS);
    frame.bettingRemainingMs = Math.max(0, round.bettingEndsAt - serverNow);
  } else if (round.phase === 'flying') {
    frame.phase = 'running';
    frame.flightMs = Math.max(0, serverNow - (round.startedAt ?? serverNow));
    frame.multiplier = crashMultiplierAt(frame.flightMs);
  } else {
    const crashPoint = round.crashPoint ?? 1;
    frame.phase = 'crashed';
    frame.multiplier = crashPoint;
    frame.flightMs = crashElapsedFor(crashPoint);
    frame.sinceCrashMs = Math.max(0, serverNow - ((round.startedAt ?? serverNow) + frame.flightMs));
  }
  return frame;
}
