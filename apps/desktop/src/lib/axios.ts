import originalAxios from 'axios'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'

/**
 * Lain axios instance with centralized error handling via interceptors.
 * All Raindrop.io API calls go through this instance.
 * Error toasts and error reporting are handled here — application code
 * only needs to handle the success path.
 *
 * @example
 *   // Direct usage (rare — prefer RTK Query hooks)
 *   const { data } = await lainAxios.get('/user')
 *
 *   // Via RTK Query (primary usage)
 *   const { data: user } = useGetUserQuery()
 *   // Errors are automatically toasted by interceptor
 */
export const lainAxios = originalAxios.create({
  baseURL: 'https://api.raindrop.io/rest/v1',
  timeout: 10_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

const NETWORK_ERROR = 'NETWORK_ERROR' as const
const TIMEOUT_ERROR = 'TIMEOUT_ERROR' as const
const SERVER_ERROR = 'SERVER_ERROR' as const
const UNAUTHORIZED_ERROR = 'UNAUTHORIZED_ERROR' as const
const RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR' as const
const UNKNOWN_ERROR = 'UNKNOWN_ERROR' as const

type ProblemType =
  | typeof NETWORK_ERROR
  | typeof TIMEOUT_ERROR
  | typeof SERVER_ERROR
  | typeof UNAUTHORIZED_ERROR
  | typeof RATE_LIMIT_ERROR
  | typeof UNKNOWN_ERROR

/**
 * Classify an axios error into a problem type.
 * @param error - AxiosError instance
 * @returns Problem type string for switch-case handling
 * @example
 *   getProblemFromError(networkErr) // => 'NETWORK_ERROR'
 *   getProblemFromError(timeoutErr) // => 'TIMEOUT_ERROR'
 */
function getProblemFromError(error: AxiosError): ProblemType {
  if (error.message === 'Network Error') return NETWORK_ERROR
  if (error.code === 'ECONNABORTED') return TIMEOUT_ERROR

  const status = error.response?.status
  if (status === undefined) return UNKNOWN_ERROR
  if (status === 401) return UNAUTHORIZED_ERROR
  if (status === 429) return RATE_LIMIT_ERROR
  if (status >= 500 && status <= 599) return SERVER_ERROR
  return UNKNOWN_ERROR
}

// --- Request Interceptor ---
// Inject Bearer token from Electron main process on every request
lainAxios.interceptors.request.use(async (config) => {
  const token = await window.auth.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// --- Response Interceptor ---
// Centralized error handling with toast notifications
lainAxios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    switch (getProblemFromError(error)) {
      case NETWORK_ERROR:
        toast.error('Network error. Please check your connection.')
        break
      case TIMEOUT_ERROR:
        toast.error('Request timed out. Please try again.')
        break
      case SERVER_ERROR:
        toast.error('Server error. Please try again later.')
        break
      case UNAUTHORIZED_ERROR:
        // Token refresh is handled by RaindropAuth.getValidToken()
        // If we still get 401, the refresh token is also expired
        toast.error('Session expired. Please log in again.')
        break
      case RATE_LIMIT_ERROR:
        toast.error('Too many requests. Please wait a moment.')
        break
      case UNKNOWN_ERROR:
      default:
        toast.error('An unexpected error occurred.')
        break
    }
    return Promise.reject(error)
  },
)
