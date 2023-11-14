"use client";
import { useEffect, useRef, useState } from "react";
import useWindowDimensions from "@/hooks/windowDimensions.js";
import Navbar from "@/components/Navbar.js";
import MainViewport from "@/components/MainViewport.js";
import { Sprite } from "@pixi/react";

const StartPage = () => {
  const websocket = useRef(null);
  const [level, setLevel] = useState(1);
  const { width, height } = useWindowDimensions();
  const [template, setTemplate] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const openWebSocket = async () => {
      const response = await fetch("api/websocket");
      const serverInfo = await response.json();
      const webSocket = new WebSocket(
        `ws://${serverInfo.url}:${serverInfo.port}`,
      );

      webSocket.addEventListener("open", () => {
        // request template from server
        webSocket.send(JSON.stringify({ type: "template" }));
      });

      webSocket.addEventListener("message", (message) => {
        const parsedMessage = JSON.parse(message.data);
        switch (parsedMessage.type) {
          case "template":
            setTemplate(parsedMessage.content)
            break;
          case "data":
            setData(parsedMessage.content)
            break;
        }
      });
    };
    openWebSocket();
  }, []);

  const sendLevel = (new_level) => {
    setLevel(new_level);
  };

  return (
    <>
      <Navbar level={level} />
      <MainViewport width={width} height={height} sendLevel={sendLevel}>
        { template && template.map((node, index) => {
          return <Sprite
            width={node.width}
            height={node.height}
            image={node.image}
            x={data ? data[index].x : node.startX}
            y={data ? data[index].y : node.startY}
            key={index}
          />
        })}
      </MainViewport>
    </>
  );
};


// {template && template.map((node, index) => {
//   return (
//     <Sprite
//       image={node.image}
//       width={node.width}
//       height={node.height}
//       x={node.startX}
//       y={node.startY}
//       key={index}
//     />
//   );
// })}
export default StartPage;
