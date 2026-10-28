import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  savedDayIn,
  takeLocalSavedDays,
} from "../design/calendarDays";

const todayKey = () => new Date().toLocaleDateString("en-CA");

/** Days the artist saved for clients from "Fill this day", kept on the server so every device sees them.
 *  Days saved on this device before that move up to the server the first time this runs. */
export function useSavedDays() {
  const today = todayKey();
  const utils = trpc.useUtils();
  const list = trpc.savedDays.list.useQuery({ today });
  const refresh = () => utils.savedDays.list.invalidate();
  const save = trpc.savedDays.save.useMutation({ onSuccess: refresh });
  const forget = trpc.savedDays.forget.useMutation({ onSuccess: refresh });
  useEffect(() => {
    const local = takeLocalSavedDays();
    const byDay = new Map<string, string[]>();
    for (const [key, day] of Object.entries(local))
      if (typeof day === "string" && day >= today)
        byDay.set(day, [...(byDay.get(day) ?? []), key]);
    for (const [day, keys] of byDay)
      for (let i = 0; i < keys.length; i += 4)
        save.mutate({ keys: keys.slice(i, i + 4), day });
    // Runs once per mount; the mutation is stable enough for a one-off move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    days: list.data,
    get: (keys: string[]) => savedDayIn(list.data, keys),
    save: (keys: string[], day: string) =>
      keys.length ? save.mutateAsync({ keys, day }) : Promise.resolve(),
    forget: (keys: string[]) =>
      keys.length ? forget.mutateAsync({ keys }) : Promise.resolve(),
  };
}
