'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@/lib/types';

type SocketInstance = Socket<ServerToClientEvents, ClientToServerEvents>;

const SocketContext = createContext<SocketInstance | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<SocketInstance | null>(null);

  useEffect(() => {
    console.log('🔌 Initializing Socket.IO connection...');
    console.log('Current URL:', window.location.origin);
    
    // Capture ref parameter from URL
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    
    if (ref) {
      console.log('📊 Ref parameter detected:', ref);
    }
    
    const socketInstance: SocketInstance = io({
      path: '/api/socket',
      addTrailingSlash: false,
      transports: ['polling', 'websocket'],
      timeout: 10000,
      reconnection: true,
      query: {
        ...(ref && { ref }), // Include ref in socket handshake if present
      },
    });

    socketInstance.on('connect', () => {
      console.log('✅ Connected to Socket.IO server, socket ID:', socketInstance.id);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from Socket.IO server, reason:', reason);
    });

    setSocket(socketInstance);

    return () => {
      console.log('Cleaning up socket connection...');
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
