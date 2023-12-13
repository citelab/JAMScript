'use client'
import { useEffect, useRef } from 'react';

export default function useWebSocket(url) {
  const webSocket = useRef(null);

  useEffect(() => {
    webSocket.current = new WebSocket(url);

    webSocket.current.addEventListener("message", (message) => {
      console.log("Message received:", message)
    })
    // return () => {
    //   if (webSocket) {
    //     webSocket.close();
    //   }
    // };
  }, [])

  return webSocket.current
}

