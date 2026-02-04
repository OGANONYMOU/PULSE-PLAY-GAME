export interface ApiResponse<T = any> {
  success: boolean;
  status: number;
  message: string;
  data?: T;
  error?: string;
}

export const successResponse = <T>(
  data: T,
  message: string = 'Success',
  status: number = 200
): ApiResponse<T> => ({
  success: true,
  status,
  message,
  data
});

export const errorResponse = (
  message: string = 'Error',
  status: number = 500,
  error?: string
): ApiResponse => ({
  success: false,
  status,
  message,
  error: error || message
});
