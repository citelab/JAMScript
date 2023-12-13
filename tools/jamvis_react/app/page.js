"use client";

// HOOKS
import { useEffect, useRef, useState } from "react";
import useWebSocket from "@/hooks/useWebSocket.js";
import useWindowDimensions from "@/hooks/windowDimensions.js";

// COMPONENTS
import Navbar from "@/components/Navbar.js";
import MainViewport from "@/components/MainViewport.js";
import InfoCard from "@/components/InfoCard.js";
import { Sprite, useApp } from "@pixi/react";
// import FreeSprite from "@/components/FreeSprite";
import { createContext, useContext } from "react";
import PixiFreeSprite from "@/app/PixiFreeSprite.js";

const StateContext = createContext(null);

let didMount = false;

const openWebSocket = (url) => {
  const webSocket = new WebSocket(url);
  return webSocket;
};

const StartPage = () => {
  const [level, setLevel] = useState(1);
  const { width, height } = useWindowDimensions();
  const [outlines, setOutlines] = useState([]);
  const state = useRef([]);
  const webSocket = useRef(null);

  useEffect(() => {
    if (!didMount) {
      didMount = true;
      return;
    }
    webSocket.current = openWebSocket('ws://localhost:8080');

    webSocket.current.addEventListener("message", () => {

    })
  }, []);


  // useEffect(() => {
  //     const parsedMessage = JSON.parse(lastMessage.data);
  //     switch (parsedMessage.type) {
  //       case "outlines":
  //         setOutlines(parsedMessage.content);
  //         break;
  //       case "states":
  //         state.current = parsedMessage.content;
  //         break;
  //     }
  // }, []);

  const sendLevel = (zoomLevel) => {
    setLevel(zoomLevel);
  };

  const sendPosition = ({ x, y }) => {
    // console.log("Width:", width, "Height:", height);
    // console.log("X:", x, "Y:", y)
    const message = {
      type: "viewInfo",
      content: {
        x: x,
        y: y,
        width: width,
        height: height,
      },
    };

    webSocket.send(JSON.stringify(message));
  };

  return (
    <>
      <Navbar level={level} />
      <MainViewport
        width={width}
        height={height}
        onZoomEnd={sendLevel}
        onMove={sendPosition}
      >
        <StateContext.Provider value={state}>
          {outlines && outlines.map((outline, index) => {
            return (
              <FreeSprite
                key={index}
                x={state[index] ? state[index].x : outline.x}
                y={state[index] ? state[index].y : outline.y}
                width={50}
                height={50}
                image={outline.image}
                state={state}
              />
            );
          })}
        </StateContext.Provider>
      </MainViewport>
    </>
  );
};

const FreeSprite = (props) => {
  const data = useContext(StateContext);
  return <PixiFreeSprite app={useApp()} {...props} />;
};
export default StartPage;
