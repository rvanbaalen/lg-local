import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Use relative URL to connect through Vite's proxy in dev
    // or directly to the server in production
    const newSocket = io('', {
      path: '/socket.io'
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setSocket(newSocket);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setSocket(null);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  return socket;
}