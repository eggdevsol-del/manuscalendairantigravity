/**
 * useFavourites.ts
 * Client-side hook for artist favouriting.
 * SSOT: TanStack Query cache is the single authority for favourite state.
 */
import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

export function useFavourites() {
  const utils = trpc.useUtils();
  const { data: favouriteIds = [], isLoading } = trpc.favourites.list.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });

  const toggle = trpc.favourites.toggle.useMutation({
    onMutate: async ({ artistId }) => {
      // Optimistic update
      await utils.favourites.list.cancel();
      const prev = utils.favourites.list.getData() || [];
      const next = prev.includes(artistId)
        ? prev.filter((id: string) => id !== artistId)
        : [...prev, artistId];
      utils.favourites.list.setData(undefined, next);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.favourites.list.setData(undefined, context.prev);
    },
    onSettled: () => {
      utils.favourites.list.invalidate();
    },
  });

  const isFavourited = useCallback(
    (artistId: string) => favouriteIds.includes(artistId),
    [favouriteIds]
  );

  const toggleFavourite = useCallback(
    (artistId: string) => toggle.mutate({ artistId }),
    [toggle]
  );

  return { favouriteIds, isLoading, isFavourited, toggleFavourite };
}
