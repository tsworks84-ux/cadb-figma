export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>;
  statusCode: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
