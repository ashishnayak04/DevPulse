import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) {
      if (socket) {
        socket.disconnect();
      }
      return;
    }

    const newSocket = io('/', {
      auth: {
        token: accessToken
      }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [accessToken]);

  return { socket, isConnected };
};
