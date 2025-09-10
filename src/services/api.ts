import axios from 'axios'

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api', // Use proxy instead of absolute URL
  timeout: 10000,
})

// Add request interceptor to include JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Types for our API responses
export interface Booking {
  id: number
  userId: number
  bookingCode: string
  guestName?: string
  checkInDate?: Date
  checkOutDate?: Date
  nights?: number
  status?: string
  hostEarningsSek?: number
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: number
  email: string
  displayName?: string
  googleId?: string
}

export interface ApiResponse<T> {
  data: T
  message?: string
  error?: string
}

// API functions
export const bookingApi = {
  // Get all bookings for current user
  getBookings: async (): Promise<Booking[]> => {
    const response = await api.get<ApiResponse<Booking[]>>('/bookings')
    return response.data.data
  },

  // Rescan a specific booking
  rescanBooking: async (bookingCode: string): Promise<{ processed: number }> => {
    const response = await api.post<ApiResponse<{ processed: number }>>('/rescan-booking', {
      bookingCode
    })
    return response.data.data
  },

  // Start full scan
  startScan: async (options: {
    years?: number[]
    quickScan?: boolean
  }): Promise<{ message: string }> => {
    const response = await api.post<ApiResponse<{ message: string }>>('/scan-year', {
      years: options.quickScan ? [new Date().getFullYear()] : (options.years || []),
      quickScan: options.quickScan || false
    })
    return response.data.data
  },

  // Get scan status (requires userId, we'll get it from user context)
  getScanStatus: async (userId: number): Promise<{
    isActive: boolean
    progress?: number
    message?: string
    year?: number
  }> => {
    const response = await api.get<ApiResponse<{
      isActive: boolean
      progress?: number
      message?: string
      year?: number
    }>>(`/scanning-status/${userId}`)
    return response.data.data
  },

  // Delete all bookings
  deleteAllBookings: async (): Promise<{ success: boolean, deletedCount: number, message: string }> => {
    const response = await api.delete<ApiResponse<{ success: boolean, deletedCount: number, message: string }>>('/bookings/all')
    return response.data.data
  },

  // Stop/cancel scanning
  stopScanning: async (): Promise<{ message: string, cancelled: number }> => {
    const response = await api.post<ApiResponse<{ message: string, cancelled: number }>>('/stop-scanning')
    return response.data.data
  }
}

export const userApi = {
  // Get current user profile
  getProfile: async (): Promise<User> => {
    const response = await api.get<ApiResponse<User>>('/profile')
    return response.data.data
  }
}

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid token and redirect to setup/login if unauthorized
      localStorage.removeItem('auth_token')
      window.location.href = '/setup'
    }
    return Promise.reject(error)
  }
)

export default api