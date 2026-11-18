import type { BaseQueryFn } from '@reduxjs/toolkit/query'
import { isAxiosError, type AxiosRequestConfig, type Method } from 'axios'

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
  return async ({ url, method = 'GET', data, body, params }, { signal }) => {
    try {
      const result = await lainAxios({
        url,
        method,
        data: data ?? body,
        params,
        signal,
      } satisfies AxiosRequestConfig)
      // Raindrop may reject a mutation in a successful HTTP response.
      if (result.data?.result === false) {
        return {
          error: {
            status: result.status,
            message:
              result.data.errorMessage ?? 'The service rejected the request.',
          },
        }
      }
      return { data: result.data }
    } catch (error) {
      // Error toast already displayed by interceptor
      // Propagate to RTK Query for isError state
      return {
        error: {
          status: isAxiosError(error)
            ? (error.response?.status ?? 'NETWORK_ERROR')
            : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Request failed',
        },
      }
    }
  }
}
