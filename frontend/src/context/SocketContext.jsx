import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

// Connect directly to the Flask server (not through Vite proxy)
const SOCKET_URL = 'http://localhost:5000'

export function SocketProvider({ children }) {
  const { user }          = useAuth()
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!user) {
      setSocket(prev => {
        prev?.disconnect()
        return null
      })
      return
    }

    const s = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })

    setSocket(s)

    return () => {
      s.disconnect()
      setSocket(null)
    }
  }, [user?.id]) // reconnect only when user identity changes

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
