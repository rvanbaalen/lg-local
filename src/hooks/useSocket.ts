import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    
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