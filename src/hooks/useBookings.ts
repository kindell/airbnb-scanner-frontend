import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bookingApi, userApi } from '../services/api'

// Query keys for React Query
export const queryKeys = {
  bookings: ['bookings'],
  scanStatus: ['scan-status'],
  user: ['user']
}

// Hook for fetching bookings with dynamic refresh based on scanning status
export const useBookings = (isScanning?: boolean) => {
  return useQuery({
    queryKey: queryKeys.bookings,
    queryFn: bookingApi.getBookings,
    refetchInterval: isScanning ? 5000 : false, // Refetch every 5 seconds when scanning
    refetchOnWindowFocus: false, // Disable refetch on window focus
  })
}

// Hook for fetching user profile
export const useUser = () => {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: userApi.getProfile,
    refetchInterval: false, // Disable automatic refetch
    refetchOnWindowFocus: false, // Disable refetch on window focus
  })
}

// Hook for fetching scan status
export const useScanStatus = (userId: number | undefined) => {
  return useQuery({
    queryKey: [...queryKeys.scanStatus, userId],
    queryFn: () => bookingApi.getScanStatus(userId!),
    enabled: !!userId, // Enable when userId is available
    refetchInterval: 3000, // Poll every 3 seconds when scanning
    refetchOnWindowFocus: false,
  })
}

// Hook for rescanning a booking
export const useRescanBooking = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: bookingApi.rescanBooking,
    onSuccess: () => {
      // Invalidate bookings to refetch updated data
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
    },
  })
}

// Hook for starting a scan
export const useStartScan = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: bookingApi.startScan,
    onSuccess: () => {
      // Invalidate scan status and bookings
      queryClient.invalidateQueries({ queryKey: queryKeys.scanStatus })
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
    },
  })
}

// Hook for deleting all bookings
export const useDeleteAllBookings = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: bookingApi.deleteAllBookings,
    onSuccess: () => {
      // Clear bookings cache immediately to show empty list
      queryClient.setQueryData(queryKeys.bookings, [])
      // Also invalidate to ensure fresh data on next request
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
    },
  })
}

// Hook for stopping/canceling scanning
export const useStopScanning = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: bookingApi.stopScanning,
    onSuccess: () => {
      // Invalidate scan status and bookings
      queryClient.invalidateQueries({ queryKey: queryKeys.scanStatus })
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
    },
  })
}