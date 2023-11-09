import { Stage, Sprite } from "@pixi/react";
import ViewportComponent from "@/components/Viewport.js";
import tailwindConfig from "@/tailwind.config";
import { useRef } from "react";

// Get the background color from tailwind config
const viewportBackground = parseInt(
  tailwindConfig.daisyui.themes[0].darkmode["base-100"].slice(1),
  16,
);

const MainViewport = ({ width, height, sendLevel, children }) => {
  const viewportRef = useRef(null);

  const onZoomEnd = () => {
    const newLevel = viewportRef.current.scale.x;
    sendLevel(newLevel);
  }
  return (
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
        onZoomEnd={onZoomEnd}
        depth={10}
      >
      {children}
      </ViewportComponent>
    </Stage>
  );
};

export default MainViewport;
