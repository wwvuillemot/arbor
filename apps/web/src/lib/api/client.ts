import Axios, { AxiosRequestConfig, AxiosError } from "axios";

/**
 * Custom Axios instance for API calls
 * This is used by Orval-generated client code
 */
export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api",
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Custom instance function used by Orval
 */
export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const source = Axios.CancelToken.source();

  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-expect-error - Adding cancel method to promise for query cancellation
  promise.cancel = () => {
    source.cancel("Query was cancelled");
  };

  return promise;
};

/**
 * Error handler for API calls
 */
export const handleApiError = (error: AxiosError): string => {
  if (error.response) {
    // Server responded with error status
    const message = (error.response.data as { message?: string })?.message;
    return message || `Error: ${error.response.status}`;
  } else if (error.request) {
    // Request made but no response
    return "No response from server. Please check your connection.";
  } else {
    // Error setting up request
    return error.message || "An unexpected error occurred";
  }
};

/**
 * Type for API error responses
 */
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}
