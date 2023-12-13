"use client";
import { Stage } from "@pixi/react";
import tailwindConfig from "@/tailwind.config";
import { useRef } from "react";
import ViewportComponent from "@/components/Viewport.js";

// Get the background color from tailwind config
const viewportBackground = parseInt(
  tailwindConfig.daisyui.themes[0].darkmode["base-100"].slice(1),
  16,
);

const MainViewport = ({ width, height, onZoomEnd, onMove, children }) => {
  const viewportRef = useRef(null);

  const zoomEnd = () => {
    const newLevel = viewportRef.current.scale.x;
    onZoomEnd(newLevel);
  };


  const logPosition = () => {
    onMove(viewportRef.current.corner); 
  }

  return (
    <Stage
      width={width}
      height={height - 0.5}
      options={{
        backgroundAlpha: 1,
        backgroundColor: viewportBackground,
      }}
    >
      <ViewportComponent
        ref={viewportRef}
        worldWidth={10000}
        worldHeight={10000}
        onZoomEnd={zoomEnd}
        onMove={logPosition}
        depth={10}
      >
        {children}
      </ViewportComponent>
    </Stage>
  );
};

export default MainViewport;
