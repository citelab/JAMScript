"use client";
import "tailwindcss/tailwind.css";
import { useEffect, useRef, useState } from "react";
import { Stage, TilingSprite } from "@pixi/react";
import ViewportComponent from "@/components/Viewport.js";
import useWindowDimensions from "@/helpers/windowDimensions.js";
import Navbar from "@/components/Navbar.js";
import { Fog } from "@/components/Nodes.js";
import tailwindConfig from "@/tailwind.config";

// Get the background color from tailwind config
const viewportBackground = parseInt((tailwindConfig.daisyui.themes[0].darkmode["primary"]).slice(1), 16)

const StartPage = () => {
  const websocket = useRef(null);
  const fogs = useRef([])
  

  // Create websocket only on component mount
  useEffect(() => {
    const openWebSocket = async () => {
      const newSocket = await connectWebSocket();
      websocket.current = newSocket;
    };

    openWebSocket();
  }, []);

  useEffect(() => {
    if (websocket.current) {
      websocket.current.addEventListener('message', (message) => {
        if (message.data) {
          fogs.current = JSON.parse(message.data)
        }
      })
    }
  }, [websocket.current])
  const [level, setLevel] = useState(1);
  const viewportRef = useRef(null);
  const { height, width } = useWindowDimensions();

  const sendLevel = () => {
    const level = Math.round(viewportRef.current.transform.scale.x);
    setLevel(level);
    websocket.current.send(JSON.stringify({ level: level }));
  };

  return (
    <>
      <Navbar numFogs={fogs.current.length} />
      <Stage
        width={width}
        height={height - 0.5}
        options={{
          backgroundAlpha: 1,
          antialias: true,
          backgroundColor: viewportBackground,
        }}
      >
        <ViewportComponent
          ref={viewportRef}
          worldWidth={width * 4}
          worldHeight={height * 4}
          onZoomEnd={sendLevel}
          background='/image/services.png'
        >
          {fogs.current.map((fog) => (
            <Fog key={fog.id} x={fog.payload.loc.x} y={fog.payload.loc.y} scale={1 / (level + 1)} />
          ))}
        </ViewportComponent>
      </Stage>
    </>
  );
};


const connectWebSocket = async () => {
  const response = await fetch("api/websocket");
  const websocketServer = await response.json();
  const websocket = new WebSocket(
    `ws://${websocketServer.url}:${websocketServer.port}`,
  );
  return websocket;
};

export default StartPage;
