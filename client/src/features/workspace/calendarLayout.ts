import { instant } from "./bookingPresentation";
/** Overlapping events share equal-width lanes across their connected group. */
export function calendarLanes<
  T extends { id: number; startTime: string; endTime: string },
>(events: T[]) {
  const sorted = [...events].sort(
    (a, b) => instant(a.startTime).getTime() - instant(b.startTime).getTime()
  );
  const result = new Map<number, { lane: number; count: number }>();
  let cluster: T[] = [];
  let until = -Infinity;
  const flush = () => {
    const ends: number[] = [];
    for (const event of cluster) {
      const start = instant(event.startTime).getTime();
      let lane = ends.findIndex(end => end <= start);
      if (lane < 0) lane = ends.length;
      ends[lane] = instant(event.endTime).getTime();
      result.set(event.id, { lane, count: 0 });
    }
    for (const event of cluster) result.get(event.id)!.count = ends.length;
  };
  for (const event of sorted) {
    const start = instant(event.startTime).getTime();
    if (start >= until && cluster.length) {
      flush();
      cluster = [];
      until = -Infinity;
    }
    cluster.push(event);
    until = Math.max(until, instant(event.endTime).getTime());
  }
  flush();
  return result;
}
