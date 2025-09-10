import React from 'react'
import { 
  Home, 
  Calendar, 
  Mail, 
  Search, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  X,
  Trash2,
  LogOut
} from 'lucide-react'
import { useBookings, useUser, useRescanBooking, useDeleteAllBookings, useScanStatus } from '../hooks/useBookings'
import ScanControlWS from './ScanControlWS'

// Helper functions
const getBookingStatus = (booking: any) => {
  if (booking.status === 'cancelled') {
    return { emoji: '❌', text: 'Avbokad', color: 'text-red-600 bg-red-50' }
  }
  
  const now = new Date()
  const checkIn = booking.checkInDate ? new Date(booking.checkInDate) : new Date()
  const checkOut = booking.checkOutDate ? new Date(booking.checkOutDate) : new Date()
  
  if (now < checkIn) return { emoji: '📅', text: 'Framtida', color: 'text-blue-600 bg-blue-50' }
  if (now >= checkIn && now <= checkOut) return { emoji: '🏠', text: 'Pågående', color: 'text-green-600 bg-green-50' }
  return { emoji: '✅', text: 'Avslutad', color: 'text-gray-600 bg-gray-50' }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'Okänt datum'
  try {
    return new Date(dateStr).toLocaleDateString('sv-SE')
  } catch (e) {
    return dateStr
  }
}

const Dashboard: React.FC = () => {
  const { data: user } = useUser()
  const { data: scanStatus } = useScanStatus(user?.id)
  const { data: bookings = [], isLoading, error } = useBookings(scanStatus?.isActive)
  const rescanMutation = useRescanBooking()
  const deleteAllMutation = useDeleteAllBookings()

  const handleLogout = () => {
    // Clear the auth token from localStorage
    localStorage.removeItem('auth_token')
    // Redirect to setup/login page
    window.location.href = '/setup'
  }

  const handleRescanBooking = async (bookingCode: string) => {
    if (confirm(`Scanna om booking ${bookingCode}?`)) {
      try {
        await rescanMutation.mutateAsync(bookingCode)
        alert('Rescan completed successfully!')
      } catch (error) {
        alert('Rescan failed: ' + (error as any).message)
      }
    }
  }

  const handleDeleteAllBookings = async () => {
    if (confirm(`⚠️ Är du säker på att du vill ta bort ALLA bokningar (${totalBookings} st)? Detta kan inte ångras!`)) {
      try {
        const result = await deleteAllMutation.mutateAsync()
        alert(`✅ ${result.deletedCount} bokningar har tagits bort!`)
      } catch (error) {
        alert('❌ Fel vid borttagning: ' + (error as any).message)
      }
    }
  }

  // Calculate stats
  const totalBookings = bookings.length
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length
  const upcomingBookings = bookings.filter(b => {
    if (!b.checkInDate) return false
    const now = new Date()
    const checkIn = new Date(b.checkInDate)
    return now < checkIn
  }).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-900 mb-2">Fel vid laddning</h2>
          <p className="text-red-700">Kunde inte ladda dashboard data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Home className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Airbnb Scanner Dashboard</h1>
            </div>
            {user && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="font-medium text-gray-900">{user.displayName || 'User'}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  title="Logga ut"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Home className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{totalBookings}</div>
                <div className="text-sm text-gray-500">Totalt Bokningar</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <X className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{cancelledBookings}</div>
                <div className="text-sm text-gray-500">Avbokade</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{upcomingBookings}</div>
                <div className="text-sm text-gray-500">Framtida</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scan Control */}
        {user && (
          <div className="mb-8">
            <ScanControlWS userId={user.id} />
          </div>
        )}

        {/* Bookings Section */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Bokningar
            </h2>
          </div>

          {bookings.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Inga bokningar hittades</h3>
              <p className="text-gray-500">Starta en scanning för att importera dina Airbnb-bokningar.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {bookings.map((booking) => {
                const status = getBookingStatus(booking)
                const totalAmount = booking.hostEarningsSek || 0
                const currency = 'SEK'
                const nights = booking.nights || 0

                return (
                  <div key={booking.id} className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {booking.bookingCode || 'N/A'}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.emoji} {status.text}
                          </span>
                        </div>
                        <p className="text-gray-600">{booking.guestName || 'Unknown Guest'}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">
                          {totalAmount.toLocaleString()} {currency}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatDate(booking.checkInDate?.toString() || '')} - {formatDate(booking.checkOutDate?.toString() || '')} ({nights} nätter)
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Status: {booking.status || 'Unknown'}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`https://mail.google.com/mail/u/0/#search/${booking.bookingCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Visa emails
                      </a>
                      
                      <a
                        href={`https://mail.google.com/mail/u/0/#search/subject:(${booking.bookingCode} OR booking OR reservation) from:(noreply@airbnb.com OR automated@airbnb.com)`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Sök relaterade
                      </a>

                      <button
                        onClick={() => handleRescanBooking(booking.bookingCode)}
                        disabled={rescanMutation.isPending}
                        className="inline-flex items-center px-3 py-1.5 border border-yellow-300 text-sm font-medium rounded-md text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {rescanMutation.isPending ? (
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-2" />
                        )}
                        Scanna om
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
          {/* Delete All Bookings Button */}
          {bookings.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-center">
                <button
                  onClick={handleDeleteAllBookings}
                  disabled={deleteAllMutation.isPending}
                  className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteAllMutation.isPending ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Ta bort alla bokningar ({totalBookings} st)
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default Dashboard