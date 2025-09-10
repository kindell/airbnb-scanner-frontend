import React from 'react'
import { Home, Chrome, Mail, Lock } from 'lucide-react'

const Setup: React.FC = () => {
  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3000/auth/google'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Home className="h-12 w-12 text-blue-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Airbnb Scanner Setup
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Anslut ditt Google-konto för att komma igång
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div className="text-center">
              <Mail className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Google-autentisering krävs
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Vi behöver tillgång till ditt Gmail-konto för att scanna dina Airbnb-bokningar
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Lock className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Säker och privat
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Vi läser endast Airbnb-relaterade e-postmeddelanden</li>
                      <li>Ingen data sparas permanent</li>
                      <li>Du kan återkalla åtkomsten när som helst</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={handleGoogleLogin}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Chrome className="h-5 w-5 mr-2" />
                Logga in med Google
              </button>
            </div>

            <div className="text-center text-xs text-gray-500">
              Genom att fortsätta godkänner du att vi får tillgång till ditt Gmail-konto
              för att läsa Airbnb-relaterade e-postmeddelanden.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Setup