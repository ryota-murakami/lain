import { createApi } from '@reduxjs/toolkit/query/react'

import { axiosBaseQuery } from '@/lib/axiosBaseQuery'

/**
 * Empty API base for RTK Query codegen.
 * The codegen tool injects endpoints into this base API.
 * Uses axiosBaseQuery for centralized error handling via axios interceptors.
 *
 * @example
 *   // This file is consumed by rtk-codegen.config.ts
 *   // Generated output: src/store/api/raindropApi.ts
 */
export const api = createApi({
  reducerPath: 'raindropApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Raindrop', 'Collection', 'Tag', 'User', 'Filter', 'Backup'],
  endpoints: () => ({}),
})
