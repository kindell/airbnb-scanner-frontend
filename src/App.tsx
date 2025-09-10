import React, { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import Setup from './components/Setup'
import { useUser } from './hooks/useBookings'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchInterval: false, // Disable automatic refetch
      refetchOnWindowFocus: false, // Disable refetch on window focus
      refetchOnReconnect: false, // Disable refetch on reconnect
    },
  },
})

// Auth wrapper component that handles authentication logic
const AuthWrapper: React.FC = () => {
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Check authentication once on mount
    const checkAuth = async () => {
      try {
        // First check if we have a token in URL params (from OAuth callback)
        const urlParams = new URLSearchParams(window.location.search)
        const urlToken = urlParams.get('token')
        
        let token = localStorage.getItem('auth_token')
        
        // If we have a token from URL, save it and clean up URL
        if (urlToken) {
          token = urlToken
          localStorage.setItem('auth_token', token)
          // Remove token from URL for security
          const url = new URL(window.location.href)
          url.searchParams.delete('token')
          window.history.replaceState({}, document.title, url.pathname + url.search)
        }

        if (!token) {
          setUser(null)
          setAuthChecked(true)
          return
        }

        const response = await fetch('/api/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (response.ok) {
          const userData = await response.json()
          setUser(userData)
        } else if (response.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('auth_token')
          setUser(null)
        }
      } catch (error) {
        // User not authenticated or error occurred
        localStorage.removeItem('auth_token')
        setUser(null)
      } finally {
        setAuthChecked(true)
      }
    }

    checkAuth()

    // Listen for URL changes (like when returning from OAuth)
    const handlePopState = () => {
      checkAuth()
    }
    window.addEventListener('popstate', handlePopState)

    // Also check auth when page becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAuth()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Show loading while checking authentication
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/setup" 
          element={!user ? <Setup /> : <Navigate to="/dashboard" replace />} 
        />
        <Route 
          path="/dashboard" 
          element={user ? <Dashboard /> : <Navigate to="/setup" replace />} 
        />
        <Route 
          path="/" 
          element={<Navigate to={user ? "/dashboard" : "/setup"} replace />} 
        />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <AuthWrapper />
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App
