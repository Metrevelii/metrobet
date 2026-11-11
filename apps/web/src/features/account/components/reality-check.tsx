import { getRealityCheck } from '../data';
import { RealityCheckReminder } from './reality-check-reminder';

/** Mounts the reality check reminder when the signed-in player turned it on. Request-time. */
export async function RealityCheck() {
  const minutes = (await getRealityCheck())?.minutes;
  return minutes ? <RealityCheckReminder minutes={minutes} /> : null;
}
