import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, Calendar, Zap, Activity, CheckCircle2, AlertCircle, StopCircle } from 'lucide-react'
import { useStartScan, useScanStatus, useStopScanning } from '../hooks/useBookings'

interface ScanControlProps {
  userId: number
}

const ScanControl: React.FC<ScanControlProps> = ({ userId }) => {
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()])
  const [streamStatus, setStreamStatus] = useState<string>('')
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const [streamProgress, setStreamProgress] = useState<any>(null)
  const [reconnectAttempted, setReconnectAttempted] = useState<boolean>(false)
  const startScanMutation = useStartScan()
  const stopScanMutation = useStopScanning()
  const { data: scanStatus, isLoading: statusLoading } = useScanStatus(userId)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i)

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close()
        setEventSource(null)
      }
    }
  }, [eventSource])

  // Auto-reconnect to streaming endpoint when active scan is detected after page reload
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
    
    // Only attempt reconnect if there's an active scan, no existing EventSource connection, and we haven't tried yet
    if (scanStatus?.isActive && !eventSource && !startScanMutation.isPending && !reconnectAttempted) {
      console.log('🔄 Detected active scan after page reload, scheduling reconnect...')
      setReconnectAttempted(true) // Mark that we've attempted reconnect
      
      // Delay the reconnection attempt to avoid rapid loops
      timeoutId = setTimeout(() => {
        console.log('🔄 Reconnecting to active scan stream...')
        // Use the actual year being scanned, not the current year
        const scanYear = scanStatus.year || new Date().getFullYear()
        console.log(`🔄 Reconnecting to year ${scanYear} (from scanStatus.year: ${scanStatus.year})`)
        console.log('🔄 About to call connectToStreamingEndpoint...')
        connectToStreamingEndpoint([scanYear], true) // isReconnect = true
      }, 500) // Reduced from 2000ms to 500ms
    }
    
    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [scanStatus?.isActive, eventSource, startScanMutation.isPending, reconnectAttempted])

  const connectToStreamingEndpoint = (years: number[], isReconnect: boolean = false) => {
    console.log(`🔌 connectToStreamingEndpoint called with years:`, years, 'isReconnect:', isReconnect)
    
    const token = localStorage.getItem('auth_token')
    if (!token) {
      console.log('❌ No auth token found')
      setStreamStatus('No auth token found')
      return
    }

    // Close existing connection if any
    if (eventSource) {
      console.log('🔌 Closing existing EventSource connection')
      eventSource.close()
    }

    // Connect to the first year (we'll extend this for multiple years later)
    const year = years[0] || new Date().getFullYear()
    // Only include action=start when explicitly starting a new scan, not when reconnecting
    const streamUrl = isReconnect 
      ? `/api/process-emails/stream/${year}?token=${encodeURIComponent(token)}`
      : `/api/process-emails/stream/${year}?action=start&token=${encodeURIComponent(token)}`
    
    console.log(`🔌 Creating EventSource connection to: ${streamUrl.substring(0, 50)}...`)
    setStreamStatus('Ansluter till streaming endpoint...')
    
    const newEventSource = new EventSource(streamUrl)
    
    newEventSource.onopen = () => {
      console.log('📡 Connected to streaming endpoint')
      setStreamStatus('Ansluten - processing emails')
    }
    
    newEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('📨 Stream event:', data)
        setStreamStatus(data.message || 'Processing...')
        
        // Extract progress information if available
        if (data.progress) {
          setStreamProgress(data.progress)
        }
      } catch (e) {
        console.log('📨 Stream message:', event.data)
        setStreamStatus(event.data)
      }
    }
    
    newEventSource.onerror = (error) => {
      console.error('❌ Stream error:', error)
      setStreamStatus('Stream connection error')
      newEventSource.close()
      setEventSource(null)
      
      // Don't attempt immediate reconnection on error to prevent loops
      console.log('❌ Stream connection failed')
    }
    
    setEventSource(newEventSource)
  }

  const handleStartScan = async (quickScan: boolean = false) => {
    try {
      // Reset state when manually starting a new scan
      setStreamProgress(null)
      setReconnectAttempted(false)
      
      await startScanMutation.mutateAsync({
        years: quickScan ? [] : selectedYears,
        quickScan
      })
      
      // After successfully starting the scan, connect to streaming endpoint
      const yearsToProcess = quickScan ? [new Date().getFullYear()] : selectedYears
      connectToStreamingEndpoint(yearsToProcess)
    } catch (error) {
      alert('Failed to start scan: ' + (error as any).message)
    }
  }

  const handleStopScan = async () => {
    if (!scanStatus?.isActive) return
    
    if (confirm('Är du säker på att du vill avbryta scanning?')) {
      try {
        // Close EventSource connection
        if (eventSource) {
          eventSource.close()
          setEventSource(null)
          setStreamStatus('')
        }
        
        // Cancel scanning sessions
        await stopScanMutation.mutateAsync()
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

  const statusInfo = getScanStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Play className="h-5 w-5 mr-2" />
          Scanna Bokningar
        </h3>
        <div className={`flex items-center space-x-2 ${statusInfo.color}`}>
          <StatusIcon className="h-4 w-4 animate-pulse" />
          <span className="text-sm font-medium">{statusInfo.text}</span>
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
      {scanStatus?.isActive && (
        <div className="mt-4 p-4 bg-blue-50 rounded-md">
          <div className="flex items-center">
            <Activity className="h-5 w-5 text-blue-600 animate-spin mr-2" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">Scanning pågår</p>
              <p className="text-sm text-blue-700">{scanStatus.message}</p>
              {streamStatus && (
                <p className="text-xs text-blue-600 mt-1">Stream: {streamStatus}</p>
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
          {streamProgress && (
            <div className="mt-2">
              <div className="bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.round((streamProgress.current / streamProgress.total) * 100)}%` 
                  }}
                />
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {streamProgress.current}/{streamProgress.total} ({Math.round((streamProgress.current / streamProgress.total) * 100)}%)
              </p>
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
    </div>
  )
}

export default ScanControl