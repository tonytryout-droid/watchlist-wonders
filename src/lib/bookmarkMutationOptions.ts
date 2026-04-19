import type { QueryClient } from "@tanstack/react-query";
import type { Bookmark } from "@/types/database";

/**
 * Generates the standard onMutate / onError / onSettled options for mutations
 * that optimistically update the ["bookmarks"] query cache.
 *
 * Usage:
 *   useMutation({
 *     mutationFn: ...,
 *     ...bookmarkListMutateOptions(queryClient, (old, id) =>
 *       old.map(b => b.id === id ? { ...b, status: "done" } : b)
 *     ),
 *     onSuccess: () => toast({ title: "Done!" }),
 *   });
 */
export function bookmarkListMutateOptions<TVariables>(
  queryClient: QueryClient,
  optimisticUpdate: (old: Bookmark[], variables: TVariables) => Bookmark[],
) {
  return {
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        optimisticUpdate(old, variables),
      );
      return { prev };
    },
    onError: (_: unknown, __: TVariables, ctx?: { prev: Bookmark[] | undefined }) =>
      queryClient.setQueryData(["bookmarks"], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  };
}
