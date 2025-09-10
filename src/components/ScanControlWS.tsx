import React, { useState, useCallback } from 'react'
import { Play, Pause, Calendar, Zap, Activity, CheckCircle2, AlertCircle, StopCircle } from 'lucide-react'
import { useStartScan, useScanStatus, useStopScanning, queryKeys } from '../hooks/useBookings'
import useWebSocket from '../hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'

interface ScanControlProps {
  userId: number
}

const ScanControlWS: React.FC<ScanControlProps> = ({ userId }) => {
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()])
  const [progressData, setProgressData] = useState<any>(null)
  const [wsStatus, setWsStatus] = useState<string>('')
  
  const queryClient = useQueryClient()
  const startScanMutation = useStartScan()
  const stopScanMutation = useStopScanning()
  const { data: scanStatus, isLoading: statusLoading } = useScanStatus(userId)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i)

  // WebSocket connection with real-time progress updates
  const ws = useWebSocket({
    enabled: true,
    onProgress: useCallback((data: any) => {
      console.log('📊 WebSocket progress update:', data)
      setProgressData(data)
      
      if (data.message) {
        setWsStatus(data.message)
      }
    }, []),
    
    onScanStatus: useCallback((data: any) => {
      console.log('📡 WebSocket scan status:', data)
      // Hide progress UI when scan is completed
      if (data.status === 'completed') {
        setTimeout(() => {
          setProgressData(null)
          setWsStatus('Scanning slutfört')
        }, 3000) // Clear after 3 seconds
      }
    }, []),
    
    onBookingCreated: useCallback((data: any) => {
      console.log('📝 WebSocket booking created:', data)
      // Invalidate bookings cache to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
    }, [queryClient]),
    
    onBookingUpdated: useCallback((data: any) => {
      console.log('📝 WebSocket booking updated:', data)
      // Invalidate bookings cache to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
    }, [queryClient]),
    
    onConnected: useCallback(() => {
      console.log('✅ WebSocket connected')
      setWsStatus('WebSocket ansluten')
    }, []),
    
    onDisconnected: useCallback(() => {
      console.log('🔌 WebSocket disconnected')
      setWsStatus('WebSocket frånkopplad')
    }, []),
    
    onReconnecting: useCallback((data: any) => {
      console.log('🔄 WebSocket reconnecting...', data)
      setWsStatus(`Återansluter... (${data.attempt}/${data.maxAttempts})`)
    }, []),
    
    onReconnected: useCallback((data: any) => {
      console.log('✅ WebSocket reconnected')
      setWsStatus('WebSocket återansluten')
    }, []),
    
    onError: useCallback((error: any) => {
      console.error('❌ WebSocket error:', error)
      setWsStatus(`WebSocket fel: ${error.message || 'Okänt fel'}`)
    }, [])
  })

  const handleStartScan = async (quickScan: boolean = false) => {
    try {
      // Reset progress when starting new scan
      setProgressData(null)
      setWsStatus('Startar scanning...')
      
      await startScanMutation.mutateAsync({
        years: quickScan ? [] : selectedYears,
        quickScan
      })
      
      setWsStatus('Scan startad - väntar på uppdateringar...')
    } catch (error) {
      alert('Failed to start scan: ' + (error as any).message)
      setWsStatus('Fel vid start av scan')
    }
  }

  const handleStopScan = async () => {
    if (!scanStatus?.isActive) return
    
    if (confirm('Är du säker på att du vill avbryta scanning?')) {
      try {
        await stopScanMutation.mutateAsync()
        setProgressData(null)
        setWsStatus('Scanning avbruten')
        alert('Scanning avbruten!')
      } catch (error) {
        alert('Failed to stop scan: ' + (error as any).message)
      }
    }
  }

  const toggleYear = (year: number) => {
    setSelectedYears(prev =>
      prev.includes(year)
        ? prev.filter(y => y !== year)
        : [...prev, year]
    )
  }

  const getScanStatusInfo = () => {
    if (statusLoading) return { icon: Activity, text: 'Laddar status...', color: 'text-gray-500' }
    if (!scanStatus?.isActive) return { icon: CheckCircle2, text: 'Redo att scanna', color: 'text-green-600' }
    return { icon: Activity, text: scanStatus.message || 'Scanner...', color: 'text-blue-600' }
  }

  const getWebSocketStatusInfo = () => {
    if (!ws.isConnected && !ws.isReconnecting) {
      return { color: 'text-red-500', text: ws.error || 'Inte ansluten' }
    } else if (ws.isReconnecting) {
      return { color: 'text-yellow-500', text: 'Återansluter...' }
    } else {
      return { color: 'text-green-500', text: 'Ansluten' }
    }
  }

  const statusInfo = getScanStatusInfo()
  const wsStatusInfo = getWebSocketStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Play className="h-5 w-5 mr-2" />
          Scanna Bokningar (WebSocket)
        </h3>
        <div className="flex flex-col items-end">
          <div className={`flex items-center space-x-2 ${statusInfo.color}`}>
            <StatusIcon className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-medium">{statusInfo.text}</span>
          </div>
          <div className={`flex items-center space-x-2 text-xs mt-1 ${wsStatusInfo.color}`}>
            <div className={`h-2 w-2 rounded-full ${ws.isConnected ? 'bg-green-500' : ws.isReconnecting ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
            <span>WebSocket: {wsStatusInfo.text}</span>
          </div>
        </div>
      </div>

      {/* Quick Scan Button */}
      <div className="mb-6">
        <button
          onClick={() => handleStartScan(true)}
          disabled={startScanMutation.isPending || scanStatus?.isActive}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="h-5 w-5 mr-2" />
          {startScanMutation.isPending ? 'Startar...' : 'Snabbscanning (senaste året)'}
        </button>
        <p className="mt-2 text-sm text-gray-500">Scannar automatiskt det senaste året för nya bokningar</p>
      </div>

      {/* Year Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Eller välj specifika år att scanna:
        </label>
        <div className="grid grid-cols-5 gap-2">
          {years.map(year => (
            <button
              key={year}
              onClick={() => toggleYear(year)}
              className={`px-3 py-2 text-sm font-medium rounded-md border ${
                selectedYears.includes(year)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Scan Button */}
      <button
        onClick={() => handleStartScan(false)}
        disabled={startScanMutation.isPending || scanStatus?.isActive || selectedYears.length === 0}
        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Calendar className="h-5 w-5 mr-2" />
        Scanna valda år ({selectedYears.length} år)
      </button>

      {/* Scan Progress */}
      {(scanStatus?.isActive || progressData) && (
        <div className="mt-4 p-4 bg-blue-50 rounded-md">
          <div className="flex items-center">
            <Activity className="h-5 w-5 text-blue-600 animate-spin mr-2" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">Scanning pågår</p>
              <p className="text-sm text-blue-700">{scanStatus?.message || 'Bearbetar...'}</p>
              {wsStatus && (
                <p className="text-xs text-blue-600 mt-1">WebSocket: {wsStatus}</p>
              )}
            </div>
            <button
              onClick={handleStopScan}
              disabled={stopScanMutation.isPending}
              className="ml-3 inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stopScanMutation.isPending ? (
                <Activity className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <StopCircle className="h-4 w-4 mr-1" />
              )}
              Avbryt
            </button>
          </div>
          
          {/* WebSocket Progress Bar */}
          {progressData && progressData.progress && (
            <div className="mt-2">
              <div className="bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.round((progressData.progress.current / progressData.progress.total) * 100)}%` 
                  }}
                />
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {progressData.progress.current}/{progressData.progress.total} ({Math.round((progressData.progress.current / progressData.progress.total) * 100)}%)
              </p>
              {progressData.progress.processed !== undefined && (
                <p className="text-xs text-blue-600">
                  Bearbetade: {progressData.progress.processed}, Hoppade över: {progressData.progress.skipped || 0}, Fel: {progressData.progress.errors || 0}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {startScanMutation.isError && (
        <div className="mt-4 p-4 bg-red-50 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-sm text-red-900">
              Fel vid start av scanning: {(startScanMutation.error as any)?.message}
            </p>
          </div>
        </div>
      )}

      {/* WebSocket Debug Info (Development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
          <div>WebSocket State: {ws.connectionState}</div>
          <div>Connected: {ws.isConnected ? 'Yes' : 'No'}</div>
          <div>Reconnecting: {ws.isReconnecting ? 'Yes' : 'No'}</div>
          {ws.error && <div>Error: {ws.error}</div>}
        </div>
      )}
    </div>
  )
}

export default ScanControlWS