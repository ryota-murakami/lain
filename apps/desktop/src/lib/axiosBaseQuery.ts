import type { BaseQueryFn } from '@reduxjs/toolkit/query'
import type { AxiosRequestConfig, Method } from 'axios'

import { lainAxios } from './axios'

/**
 * Custom baseQuery for RTK Query that uses the Lain axios instance.
 * Error handling (toasts, reporting) is managed by axios interceptors,
 * so this adapter only needs to propagate errors for RTK Query state.
 *
 * @example
 *   // In RTK Query API definition
 *   export const raindropApi = createApi({
 *     baseQuery: axiosBaseQuery(),
 *     endpoints: (build) => ({ ... })
 *   })
 *
 * @returns BaseQueryFn compatible with RTK Query
 */
export function axiosBaseQuery(): BaseQueryFn<
  {
    url: string
    method?: Method
    data?: unknown
    body?: unknown
    params?: unknown
  },
  unknown,
  unknown
> {
  return async ({ url, method = 'GET', data, body, params }) => {
    try {
      const result = await lainAxios({
        url,
        method,
        data: data ?? body,
        params,
      } satisfies AxiosRequestConfig)
      return { data: result.data }
    } catch (error) {
      // Error toast already displayed by interceptor
      // Propagate to RTK Query for isError state
      return { error }
    }
  }
}
