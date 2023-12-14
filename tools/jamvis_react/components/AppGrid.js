import { Graphics } from "@pixi/react";
import { useEffect, useRef, useState } from "react";
import AppCell from "@/components/AppCell.js";

export default function AppGrid(props) {
  const appCell = useRef();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cells = [];

  for (let i = 0; i < props.width; i += props.cellWidth) {
    for (let j = 0; j < props.height; j += props.cellHeight) {
      const key = `${i}-${j}`;
      cells.push(key);
    }
  }
  return (
    <>
      {/* Template for the grid cells */}
      <AppCell
        ref={appCell}
        lineWidth={2}
        color={0x000000}
        width={props.cellWidth}
        height={props.cellHeight}
      />

      {mounted && (
        cells.map((key) => {
          const [x, y] = key.split("-").map((n) => parseInt(n));
          return (
            <Graphics
              key={key}
              x={x}
              y={y}
              geometry={appCell.current}
            />
          );
        })
      )}
    </>
  );
}
