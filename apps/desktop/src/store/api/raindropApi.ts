import { api } from './emptyApi'
export const addTagTypes = [
  'auth',
  'user',
  'collections',
  'raindrops',
  'tags',
  'filters',
  'import',
  'export',
  'backups',
] as const
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getOauthAuthorize: build.query<
        GetOauthAuthorizeApiResponse,
        GetOauthAuthorizeApiArg
      >({
        query: (queryArg) => ({
          url: `/oauth/authorize`,
          params: {
            client_id: queryArg.clientId,
            redirect_uri: queryArg.redirectUri,
            response_type: queryArg.responseType,
            scope: queryArg.scope,
            state: queryArg.state,
          },
        }),
        providesTags: ['auth'],
      }),
      postOauthAccessToken: build.mutation<
        PostOauthAccessTokenApiResponse,
        PostOauthAccessTokenApiArg
      >({
        query: (queryArg) => ({
          url: `/oauth/access_token`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['auth'],
      }),
      getUser: build.query<GetUserApiResponse, GetUserApiArg>({
        query: () => ({ url: `/user` }),
        providesTags: ['user'],
      }),
      putUser: build.mutation<PutUserApiResponse, PutUserApiArg>({
        query: (queryArg) => ({
          url: `/user`,
          method: 'PUT',
          body: queryArg.userUpdate,
        }),
        invalidatesTags: ['user'],
      }),
      getUserByName: build.query<GetUserByNameApiResponse, GetUserByNameApiArg>(
        {
          query: (queryArg) => ({ url: `/user/${queryArg.name}` }),
          providesTags: ['user'],
        },
      ),
      getCollections: build.query<
        GetCollectionsApiResponse,
        GetCollectionsApiArg
      >({
        query: () => ({ url: `/collections` }),
        providesTags: ['collections'],
      }),
      putCollections: build.mutation<
        PutCollectionsApiResponse,
        PutCollectionsApiArg
      >({
        query: (queryArg) => ({
          url: `/collections`,
          method: 'PUT',
          body: queryArg.body,
        }),
        invalidatesTags: ['collections'],
      }),
      deleteCollections: build.mutation<
        DeleteCollectionsApiResponse,
        DeleteCollectionsApiArg
      >({
        query: (queryArg) => ({
          url: `/collections`,
          method: 'DELETE',
          body: queryArg.collectionsRemoveRequest,
        }),
        invalidatesTags: ['collections'],
      }),
      getCollectionsChildrens: build.query<
        GetCollectionsChildrensApiResponse,
        GetCollectionsChildrensApiArg
      >({
        query: () => ({ url: `/collections/childrens` }),
        providesTags: ['collections'],
      }),
      putCollectionsMerge: build.mutation<
        PutCollectionsMergeApiResponse,
        PutCollectionsMergeApiArg
      >({
        query: (queryArg) => ({
          url: `/collections/merge`,
          method: 'PUT',
          body: queryArg.collectionsMergeRequest,
        }),
        invalidatesTags: ['collections'],
      }),
      putCollectionsClean: build.mutation<
        PutCollectionsCleanApiResponse,
        PutCollectionsCleanApiArg
      >({
        query: () => ({ url: `/collections/clean`, method: 'PUT' }),
        invalidatesTags: ['collections'],
      }),
      postCollection: build.mutation<
        PostCollectionApiResponse,
        PostCollectionApiArg
      >({
        query: (queryArg) => ({
          url: `/collection`,
          method: 'POST',
          body: queryArg.collectionCreate,
        }),
        invalidatesTags: ['collections'],
      }),
      getCollectionById: build.query<
        GetCollectionByIdApiResponse,
        GetCollectionByIdApiArg
      >({
        query: (queryArg) => ({ url: `/collection/${queryArg.id}` }),
        providesTags: ['collections'],
      }),
      putCollectionById: build.mutation<
        PutCollectionByIdApiResponse,
        PutCollectionByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/collection/${queryArg.id}`,
          method: 'PUT',
          body: queryArg.collectionUpdate,
        }),
        invalidatesTags: ['collections'],
      }),
      deleteCollectionById: build.mutation<
        DeleteCollectionByIdApiResponse,
        DeleteCollectionByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/collection/${queryArg.id}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['collections'],
      }),
      putCollectionByIdCover: build.mutation<
        PutCollectionByIdCoverApiResponse,
        PutCollectionByIdCoverApiArg
      >({
        query: (queryArg) => ({
          url: `/collection/${queryArg.id}/cover`,
          method: 'PUT',
          body: queryArg.body,
        }),
        invalidatesTags: ['collections'],
      }),
      deleteCollection99: build.mutation<
        DeleteCollection99ApiResponse,
        DeleteCollection99ApiArg
      >({
        query: () => ({ url: `/collection/-99`, method: 'DELETE' }),
        invalidatesTags: ['collections'],
      }),
      postRaindrop: build.mutation<PostRaindropApiResponse, PostRaindropApiArg>(
        {
          query: (queryArg) => ({
            url: `/raindrop`,
            method: 'POST',
            body: queryArg.raindropCreate,
          }),
          invalidatesTags: ['raindrops'],
        },
      ),
      getRaindropById: build.query<
        GetRaindropByIdApiResponse,
        GetRaindropByIdApiArg
      >({
        query: (queryArg) => ({ url: `/raindrop/${queryArg.id}` }),
        providesTags: ['raindrops'],
      }),
      putRaindropById: build.mutation<
        PutRaindropByIdApiResponse,
        PutRaindropByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/raindrop/${queryArg.id}`,
          method: 'PUT',
          body: queryArg.raindropUpdate,
        }),
        invalidatesTags: ['raindrops'],
      }),
      deleteRaindropById: build.mutation<
        DeleteRaindropByIdApiResponse,
        DeleteRaindropByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/raindrop/${queryArg.id}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['raindrops'],
      }),
      putRaindropByIdCover: build.mutation<
        PutRaindropByIdCoverApiResponse,
        PutRaindropByIdCoverApiArg
      >({
        query: (queryArg) => ({
          url: `/raindrop/${queryArg.id}/cover`,
          method: 'PUT',
          body: queryArg.body,
        }),
        invalidatesTags: ['raindrops'],
      }),
      putRaindropFile: build.mutation<
        PutRaindropFileApiResponse,
        PutRaindropFileApiArg
      >({
        query: (queryArg) => ({
          url: `/raindrop/file`,
          method: 'PUT',
          body: queryArg.body,
        }),
        invalidatesTags: ['raindrops'],
      }),
      getRaindropByIdCache: build.query<
        GetRaindropByIdCacheApiResponse,
        GetRaindropByIdCacheApiArg
      >({
        query: (queryArg) => ({ url: `/raindrop/${queryArg.id}/cache` }),
        providesTags: ['raindrops'],
      }),
      postRaindropSuggest: build.mutation<
        PostRaindropSuggestApiResponse,
        PostRaindropSuggestApiArg
      >({
        query: (queryArg) => ({
          url: `/raindrop/suggest`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['raindrops'],
      }),
      getRaindropByIdSuggest: build.query<
        GetRaindropByIdSuggestApiResponse,
        GetRaindropByIdSuggestApiArg
      >({
        query: (queryArg) => ({ url: `/raindrop/${queryArg.id}/suggest` }),
        providesTags: ['raindrops'],
      }),
      postRaindrops: build.mutation<
        PostRaindropsApiResponse,
        PostRaindropsApiArg
      >({
        query: (queryArg) => ({
          url: `/raindrops`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['raindrops'],
      }),
      getRaindropsByCollectionId: build.query<
        GetRaindropsByCollectionIdApiResponse,
        GetRaindropsByCollectionIdApiArg
      >({
        query: (queryArg) => ({
          url: `/raindrops/${queryArg.collectionId}`,
          params: {
            sort: queryArg.sort,
            perpage: queryArg.perpage,
            page: queryArg.page,
            search: queryArg.search,
            nested: queryArg.nested,
          },
        }),
        providesTags: ['raindrops'],
      }),
      putRaindropsByCollectionId: build.mutation<
        PutRaindropsByCollectionIdApiResponse,
        PutRaindropsByCollectionIdApiArg
      >({
        query: (queryArg) => ({
          url: `/raindrops/${queryArg.collectionId}`,
          method: 'PUT',
          body: queryArg.raindropsBatchUpdateRequest,
          params: {
            nested: queryArg.nested,
          },
        }),
        invalidatesTags: ['raindrops'],
      }),
      deleteRaindropsByCollectionId: build.mutation<
        DeleteRaindropsByCollectionIdApiResponse,
        DeleteRaindropsByCollectionIdApiArg
      >({
        query: (queryArg) => ({
          url: `/raindrops/${queryArg.collectionId}`,
          method: 'DELETE',
          body: queryArg.body,
          params: {
            search: queryArg.search,
            nested: queryArg.nested,
          },
        }),
        invalidatesTags: ['raindrops'],
      }),
      getTags: build.query<GetTagsApiResponse, GetTagsApiArg>({
        query: () => ({ url: `/tags` }),
        providesTags: ['tags'],
      }),
      getTagsByCollectionId: build.query<
        GetTagsByCollectionIdApiResponse,
        GetTagsByCollectionIdApiArg
      >({
        query: (queryArg) => ({ url: `/tags/${queryArg.collectionId}` }),
        providesTags: ['tags'],
      }),
      putTagsByCollectionId: build.mutation<
        PutTagsByCollectionIdApiResponse,
        PutTagsByCollectionIdApiArg
      >({
        query: (queryArg) => ({
          url: `/tags/${queryArg.collectionId}`,
          method: 'PUT',
          body: queryArg.tagsMergeRequest,
        }),
        invalidatesTags: ['tags'],
      }),
      deleteTagsByCollectionId: build.mutation<
        DeleteTagsByCollectionIdApiResponse,
        DeleteTagsByCollectionIdApiArg
      >({
        query: (queryArg) => ({
          url: `/tags/${queryArg.collectionId}`,
          method: 'DELETE',
          body: queryArg.tagsRemoveRequest,
        }),
        invalidatesTags: ['tags'],
      }),
      getFiltersByCollectionId: build.query<
        GetFiltersByCollectionIdApiResponse,
        GetFiltersByCollectionIdApiArg
      >({
        query: (queryArg) => ({
          url: `/filters/${queryArg.collectionId}`,
          params: {
            tagsSort: queryArg.tagsSort,
            search: queryArg.search,
          },
        }),
        providesTags: ['filters'],
      }),
      getImportUrlParse: build.query<
        GetImportUrlParseApiResponse,
        GetImportUrlParseApiArg
      >({
        query: (queryArg) => ({
          url: `/import/url/parse`,
          params: {
            url: queryArg.url,
          },
        }),
        providesTags: ['import'],
      }),
      getRaindropsByCollectionIdExportAndFormat: build.query<
        GetRaindropsByCollectionIdExportAndFormatApiResponse,
        GetRaindropsByCollectionIdExportAndFormatApiArg
      >({
        query: (queryArg) => ({
          url: `/raindrops/${queryArg.collectionId}/export.${queryArg.format}`,
          params: {
            sort: queryArg.sort,
            search: queryArg.search,
          },
        }),
        providesTags: ['export'],
      }),
      getBackups: build.query<GetBackupsApiResponse, GetBackupsApiArg>({
        query: () => ({ url: `/backups` }),
        providesTags: ['backups'],
      }),
      getBackup: build.query<GetBackupApiResponse, GetBackupApiArg>({
        query: () => ({ url: `/backup` }),
        providesTags: ['backups'],
      }),
    }),
    overrideExisting: false,
  })
export { injectedRtkApi as raindropApi }
export type GetOauthAuthorizeApiResponse = unknown
export type GetOauthAuthorizeApiArg = {
  clientId: string
  redirectUri: string
  responseType: 'code'
  scope?: string
  state?: string
}
export type PostOauthAccessTokenApiResponse =
  /** status 200 Token */ TokenResponse
export type PostOauthAccessTokenApiArg = {
  body: TokenExchangeRequest | TokenRefreshRequest
}
export type GetUserApiResponse = /** status 200 User */ UserResponse
export type GetUserApiArg = void
export type PutUserApiResponse = /** status 200 Updated */ UserResponse
export type PutUserApiArg = {
  userUpdate: UserUpdate
}
export type GetUserByNameApiResponse =
  /** status 200 Public user */ UserPublicResponse
export type GetUserByNameApiArg = {
  name: string
}
export type GetCollectionsApiResponse =
  /** status 200 List */ CollectionsResponse
export type GetCollectionsApiArg = void
export type PutCollectionsApiResponse = /** status 200 OK */ GenericResult
export type PutCollectionsApiArg = {
  body: CollectionsReorderRequest | CollectionsExpandCollapseRequest
}
export type DeleteCollectionsApiResponse =
  /** status 200 Deleted */ GenericResult
export type DeleteCollectionsApiArg = {
  collectionsRemoveRequest: CollectionsRemoveRequest
}
export type GetCollectionsChildrensApiResponse =
  /** status 200 List */ CollectionsResponse
export type GetCollectionsChildrensApiArg = void
export type PutCollectionsMergeApiResponse =
  /** status 200 Merged */ GenericResult
export type PutCollectionsMergeApiArg = {
  collectionsMergeRequest: CollectionsMergeRequest
}
export type PutCollectionsCleanApiResponse =
  /** status 200 Removed */ CollectionsCleanResponse
export type PutCollectionsCleanApiArg = void
export type PostCollectionApiResponse =
  /** status 200 Created */ CollectionItemResponse
export type PostCollectionApiArg = {
  collectionCreate: CollectionCreate
}
export type GetCollectionByIdApiResponse =
  /** status 200 Item */ CollectionItemResponse
export type GetCollectionByIdApiArg = {
  id: number
}
export type PutCollectionByIdApiResponse =
  /** status 200 Updated */ CollectionItemResponse
export type PutCollectionByIdApiArg = {
  id: number
  collectionUpdate: CollectionUpdate
}
export type DeleteCollectionByIdApiResponse =
  /** status 200 Deleted */ GenericResult
export type DeleteCollectionByIdApiArg = {
  id: number
}
export type PutCollectionByIdCoverApiResponse =
  /** status 200 Updated */ CollectionItemResponse
export type PutCollectionByIdCoverApiArg = {
  id: number
  body: {
    cover: Blob
  }
}
export type DeleteCollection99ApiResponse =
  /** status 200 Emptied */ GenericResult
export type DeleteCollection99ApiArg = void
export type PostRaindropApiResponse =
  /** status 200 Created */ RaindropItemResponse
export type PostRaindropApiArg = {
  raindropCreate: RaindropCreate
}
export type GetRaindropByIdApiResponse =
  /** status 200 Item */ RaindropItemResponse
export type GetRaindropByIdApiArg = {
  id: number
}
export type PutRaindropByIdApiResponse =
  /** status 200 Updated */ RaindropItemResponse
export type PutRaindropByIdApiArg = {
  id: number
  raindropUpdate: RaindropUpdate
}
export type DeleteRaindropByIdApiResponse =
  /** status 200 Deleted */ GenericResult
export type DeleteRaindropByIdApiArg = {
  id: number
}
export type PutRaindropByIdCoverApiResponse =
  /** status 200 Updated */ RaindropItemResponse
export type PutRaindropByIdCoverApiArg = {
  id: number
  body: {
    cover: Blob
  }
}
export type PutRaindropFileApiResponse =
  /** status 200 Uploaded */ RaindropItemResponse
export type PutRaindropFileApiArg = {
  body: {
    file: Blob
    collectionId?: number
  }
}
export type GetRaindropByIdCacheApiResponse = unknown
export type GetRaindropByIdCacheApiArg = {
  id: number
}
export type PostRaindropSuggestApiResponse =
  /** status 200 Suggestions */ SuggestResponseNew
export type PostRaindropSuggestApiArg = {
  body: {
    link: string
  }
}
export type GetRaindropByIdSuggestApiResponse =
  /** status 200 Suggestions */ SuggestResponseNew
export type GetRaindropByIdSuggestApiArg = {
  id: number
}
export type PostRaindropsApiResponse =
  /** status 200 Created */ RaindropsBatchWriteResponse
export type PostRaindropsApiArg = {
  body: {
    items: RaindropCreate[]
  }
}
export type GetRaindropsByCollectionIdApiResponse =
  /** status 200 List */ RaindropsListResponse
export type GetRaindropsByCollectionIdApiArg = {
  collectionId: number
  sort?:
    | '-created'
    | 'created'
    | 'score'
    | '-sort'
    | 'title'
    | '-title'
    | 'domain'
    | '-domain'
  perpage?: number
  page?: number
  search?: string
  nested?: boolean
}
export type PutRaindropsByCollectionIdApiResponse =
  /** status 200 Updated */ GenericResult
export type PutRaindropsByCollectionIdApiArg = {
  collectionId: number
  nested?: boolean
  raindropsBatchUpdateRequest: RaindropsBatchUpdateRequest
}
export type DeleteRaindropsByCollectionIdApiResponse =
  /** status 200 Deleted */ RaindropsBatchDeleteResponse
export type DeleteRaindropsByCollectionIdApiArg = {
  collectionId: number
  search?: string
  nested?: boolean
  body: {
    ids?: number[]
  }
}
export type GetTagsApiResponse = /** status 200 Tags */ TagsListResponse
export type GetTagsApiArg = void
export type GetTagsByCollectionIdApiResponse =
  /** status 200 Tags */ TagsListResponse
export type GetTagsByCollectionIdApiArg = {
  collectionId: number
}
export type PutTagsByCollectionIdApiResponse =
  /** status 200 Merged */ GenericResult
export type PutTagsByCollectionIdApiArg = {
  collectionId: number
  tagsMergeRequest: TagsMergeRequest
}
export type DeleteTagsByCollectionIdApiResponse =
  /** status 200 Removed */ GenericResult
export type DeleteTagsByCollectionIdApiArg = {
  collectionId: number
  tagsRemoveRequest: TagsRemoveRequest
}
export type GetFiltersByCollectionIdApiResponse =
  /** status 200 Filters */ FiltersResponse
export type GetFiltersByCollectionIdApiArg = {
  collectionId: string
  tagsSort?: '-count' | '_id'
  search?: string
}
export type GetImportUrlParseApiResponse = /** status 200 Parsed */ {
  [key: string]: any
}
export type GetImportUrlParseApiArg = {
  url: string
}
export type GetRaindropsByCollectionIdExportAndFormatApiResponse = unknown
export type GetRaindropsByCollectionIdExportAndFormatApiArg = {
  collectionId: number
  format: 'csv' | 'html' | 'zip'
  sort?:
    | '-created'
    | 'created'
    | 'score'
    | '-sort'
    | 'title'
    | '-title'
    | 'domain'
    | '-domain'
  search?: string
}
export type GetBackupsApiResponse = /** status 200 List */ BackupsListResponse
export type GetBackupsApiArg = void
export type GetBackupApiResponse =
  /** status 200 Queued */ BackupGenerateResponse
export type GetBackupApiArg = void
export type TokenResponse = {
  access_token: string
  token_type: string
  refresh_token?: string
  expires_in?: number
}
export type TokenExchangeRequest = {
  grant_type: 'authorization_code'
  code: string
  client_id: string
  client_secret: string
  redirect_uri: string
}
export type TokenRefreshRequest = {
  grant_type: 'refresh_token'
  refresh_token: string
  client_id: string
  client_secret: string
}
export type User = {
  _id?: number
  email?: string
  email_MD5?: string
  fullName?: string
  pro?: boolean
  registered?: string
  config?: {
    [key: string]: any
  }
  /** Collection groups visible in sidebar. Each group contains a title and an ordered list of root collection IDs. */
  groups?: {
    /** Name of the group (e.g. "Home", "Work") */
    title?: string
    /** Whether the group is collapsed in the sidebar */
    hidden?: boolean
    /** Ascending order position of the group */
    sort?: number
    /** Ordered list of root collection IDs belonging to this group */
    collections?: number[]
  }[]
}
export type UserResponse = {
  result?: boolean
  user?: User
}
export type UserUpdate = {
  [key: string]: any
}
export type UserPublicResponse = {
  result?: boolean
  user?: User
}
export type Collection = {
  _id?: number
  access?: {
    [key: string]: any
  }
  color?: string
  count?: number
  cover?: string[]
  created?: string
  expanded?: boolean
  lastUpdate?: string
  parent?: {
    $id?: number
  }
  public?: boolean
  sort?: number
  title?: string
  user?: {
    $id?: number
  }
  view?: string
}
export type CollectionsResponse = {
  result?: boolean
  items?: Collection[]
}
export type GenericResult = {
  result: boolean
}
export type CollectionsReorderRequest = {
  sort: 'title' | '-title' | '-count'
}
export type CollectionsExpandCollapseRequest = {
  expanded: boolean
}
export type CollectionsRemoveRequest = {
  ids: number[]
}
export type CollectionsMergeRequest = {
  to: number
  ids: number[]
}
export type CollectionsCleanResponse = {
  result?: boolean
  count?: number
}
export type CollectionItemResponse = {
  result?: boolean
  item?: Collection
}
export type CollectionCreate = {
  view?: string
  title: string
  sort?: number
  public?: boolean
  parent?: {
    $id?: number
  }
  cover?: string[]
}
export type CollectionUpdate = {
  expanded?: boolean
  view?: string
  title?: string
  sort?: number
  color?: string
  public?: boolean
  parent?: {
    $id?: number
  }
  cover?: string[]
}
export type Raindrop = {
  _id?: number
  collection?: {
    $id?: number
  }
  link?: string
  title?: string
  excerpt?: string
  note?: string
  cover?: string
  tags?: string[]
  created?: string
  lastUpdate?: string
  type?: 'link' | 'article' | 'image' | 'video' | 'document' | 'audio'
  highlights?: {
    _id?: string
    text?: string
    note?: string
    color?: string
  }[]
  file?: {
    name?: string
    size?: number
    type?: string
  }
}
export type RaindropItemResponse = {
  result?: boolean
  item?: Raindrop
}
export type RaindropCreate = {
  link: string
  title?: string
  excerpt?: string
  note?: string
  collection?: {
    $id?: number
  }
  collectionId?: number
  tags?: string[]
  pleaseParse?: object
  created?: string
  lastUpdate?: string
  order?: number
  important?: boolean
  media?: object[]
  cover?: string
  type?: 'link' | 'article' | 'image' | 'video' | 'document' | 'audio'
  highlights?: object[]
  reminder?: object
}
export type RaindropUpdate = {
  created?: string
  lastUpdate?: string
  pleaseParse?: object
  order?: number
  important?: boolean
  tags?: string[]
  media?: object[]
  cover?: string
  collection?: {
    $id?: number
  }
  type?: 'link' | 'article' | 'image' | 'video' | 'document' | 'audio'
  excerpt?: string
  note?: string
  title?: string
  link?: string
  highlights?: object[]
  reminder?: object
}
export type SuggestResponseNew = {
  result?: boolean
  item?: {
    collections?: {
      $id?: number
    }[]
    tags?: string[]
  }
}
export type RaindropsBatchWriteResponse = {
  result?: boolean
  items?: Raindrop[]
}
export type RaindropsListResponse = {
  result?: boolean
  items?: Raindrop[]
  count?: number
  page?: number
}
export type RaindropsBatchUpdateRequest = {
  ids?: number[]
  important?: boolean
  tags?: string[]
  media?: object[]
  cover?: string
  collection?: {
    $id?: number
  }
}
export type RaindropsBatchDeleteResponse = {
  result?: boolean
  modified?: number
}
export type TagsListResponse = {
  result?: boolean
  items?: {
    _id?: string
    count?: number
  }[]
}
export type TagsMergeRequest = {
  replace: string
  tags: string[]
}
export type TagsRemoveRequest = {
  tags: string[]
}
export type FiltersResponse = {
  result?: boolean
  broken?: {
    count?: number
  }
  duplicates?: {
    count?: number
  }
  important?: {
    count?: number
  }
  notag?: {
    count?: number
  }
  tags?: {
    _id?: string
    count?: number
  }[]
  types?: {
    _id?: string
    count?: number
  }[]
}
export type Backup = {
  _id?: string
  created?: string
  status?: string
  size?: number
  url?: string
}
export type BackupsListResponse = {
  result?: boolean
  items?: Backup[]
}
export type BackupGenerateResponse = {
  result?: boolean
  message?: string
}
export const {
  useGetOauthAuthorizeQuery,
  usePostOauthAccessTokenMutation,
  useGetUserQuery,
  usePutUserMutation,
  useGetUserByNameQuery,
  useGetCollectionsQuery,
  usePutCollectionsMutation,
  useDeleteCollectionsMutation,
  useGetCollectionsChildrensQuery,
  usePutCollectionsMergeMutation,
  usePutCollectionsCleanMutation,
  usePostCollectionMutation,
  useGetCollectionByIdQuery,
  usePutCollectionByIdMutation,
  useDeleteCollectionByIdMutation,
  usePutCollectionByIdCoverMutation,
  useDeleteCollection99Mutation,
  usePostRaindropMutation,
  useGetRaindropByIdQuery,
  usePutRaindropByIdMutation,
  useDeleteRaindropByIdMutation,
  usePutRaindropByIdCoverMutation,
  usePutRaindropFileMutation,
  useGetRaindropByIdCacheQuery,
  usePostRaindropSuggestMutation,
  useGetRaindropByIdSuggestQuery,
  usePostRaindropsMutation,
  useGetRaindropsByCollectionIdQuery,
  usePutRaindropsByCollectionIdMutation,
  useDeleteRaindropsByCollectionIdMutation,
  useGetTagsQuery,
  useGetTagsByCollectionIdQuery,
  usePutTagsByCollectionIdMutation,
  useDeleteTagsByCollectionIdMutation,
  useGetFiltersByCollectionIdQuery,
  useGetImportUrlParseQuery,
  useGetRaindropsByCollectionIdExportAndFormatQuery,
  useGetBackupsQuery,
  useGetBackupQuery,
} = injectedRtkApi
