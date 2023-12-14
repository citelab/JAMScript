"use client";

// HOOKS
import { useEffect, useRef, useState } from "react";
import useWebSocket from "@/hooks/useWebSocket.js";
import useWindowDimensions from "@/hooks/windowDimensions.js";

// COMPONENTS
import Navbar from "@/components/Navbar.js";
import MainViewport from "@/components/MainViewport.js";
// import InfoCard from "@/components/InfoCard.js";
import { Sprite } from "@pixi/react";
import { useCallback } from "react";

let didMount = false;

const openWebSocket = (url) => {
  const webSocket = new WebSocket(url);
  return webSocket;
};

const StartPage = () => {
  const [level, setLevel] = useState(1);
  const { width, height } = useWindowDimensions();
  const [outlines, setOutlines] = useState([]);
  const [numNodes, setNumNodes] = useState(0);
  const webSocket = useRef(null);

  useEffect(() => {
    if (!didMount) {
      didMount = true;
      return;
    }
    webSocket.current = openWebSocket("ws://localhost:8080");

    webSocket.current.addEventListener("open", () => {
      webSocket.current.send(
        JSON.stringify({
          type: "viewInfo",
          content: { startX: 0, startY: 0, endX: width, endY: height },
        }),
      );
    });

    webSocket.current.addEventListener("message", (message) => {
      const info = JSON.parse(message.data);
      switch (info.type) {
        case "outlines":
          setNumNodes(info.content.length);
          setOutlines(info.content);
          break;
      }
    });
  }, []);
  
  const nodes = useCallback((outlines) => {
    return outlines.map((outline) => {
      return (
        <Sprite
          key={outline.id}
          image={outline.image}
          x={outline.x}
          y={outline.y}
          width={outline.width}
          height={outline.height}
        />
      );
    });
  }, [outlines]);

  const sendLevel = (zoomLevel) => {
    setLevel(zoomLevel);
  };

  const sendPosition = (left, top, right, bottom) => {
    // console.log("Sending position")
    // console.log(
    //   left, top, right, bottom
    // )
    const message = {
      type: "viewInfo",
      content: {
        startX: left,
        startY: top,
        endX: right,
        endY: bottom,
      },
    };

    webSocket.current.send(JSON.stringify(message));
  };

  return (
    <>
      <Navbar level={level} numNodes={numNodes} />
      <MainViewport
        width={width}
        height={height}
        onZoomEnd={sendLevel}
        onMove={sendPosition}
      >
        {nodes(outlines)}
      </MainViewport>
    </>
  );
};

export default StartPage;
