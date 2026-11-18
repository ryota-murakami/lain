import {
  raindropApi,
  type GetRaindropsByCollectionIdApiArg,
  type GetRaindropsByCollectionIdApiResponse,
} from './raindropApi'

/** System counts and the server's bookmark change marker used by live synchronization. */
export interface UserStats {
  result: boolean
  items: { _id: number; count: number }[]
  meta: { changedBookmarksDate?: string }
}

/** Account queries omitted by the generated schema, plus coherent multi-page bookmark caching. */
const accountApi = raindropApi.injectEndpoints({
  endpoints: (build) => ({
    getUserStats: build.query<UserStats, void>({
      query: () => ({ url: '/user/stats' }),
      providesTags: ['collections'],
    }),
    getBookmarkPages: build.infiniteQuery<
      GetRaindropsByCollectionIdApiResponse,
      Omit<GetRaindropsByCollectionIdApiArg, 'page' | 'perpage'>,
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (lastPage, pages, lastPageParam) => {
          const loaded = pages.reduce(
            (count, page) => count + (page.items?.length ?? 0),
            0,
          )
          return (lastPage.items?.length ?? 0) === 50 &&
            loaded < (lastPage.count ?? Infinity)
            ? lastPageParam + 1
            : undefined
        },
      },
      query: ({ queryArg, pageParam }) => ({
        url: `/raindrops/${queryArg.collectionId}`,
        params: {
          ...queryArg,
          collectionId: undefined,
          page: pageParam,
          perpage: 50,
        },
      }),
      providesTags: ['raindrops'],
    }),
  }),
})

export const { useGetUserStatsQuery, useGetBookmarkPagesInfiniteQuery } =
  accountApi
