"use client";
import { useEffect, useRef, useState, createElement } from "react";
import { Sprite } from "@pixi/react";
import useWindowDimensions from "@/helpers/windowDimensions.js";
import Navbar from "@/components/Navbar.js";
import MainViewport from "@/components/MainViewport.js";
import { deserialize } from 'react-serialize'

const StartPage = () => {
  const websocket = useRef(null);
  const [level, setLevel] = useState(1);
  const { height, width } = useWindowDimensions();
  const [template, setTemplate] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const openWebSocket = async () => {
      const newSocket = await connectWebSocket();
      websocket.current = newSocket;
    };

    openWebSocket();
  }, []);

  // Listen for websocket messages
  useEffect(() => {
    if (websocket.current) {
      websocket.current.addEventListener("message", (message) => {
        const parsedMessage = JSON.parse(message.data)
        switch(parsedMessage.type) {
          case ("template"):
            setTemplate(parsedMessage.content);
            break;
          case ("data"):
            setData(parsedMessage.content);
            break;
        }
        
      });
    }
  }, [websocket.current]);

  const sendLevel = (new_level) => {
    websocket.current.send(JSON.stringify({ level: new_level }));
    setLevel(new_level);
  };

  return (
    <>
      <Navbar level={level} />
      <MainViewport width={width} height={height} sendLevel={sendLevel}>
        <Template type={template?.type} props={{...template?.props, ...data}}/>
      </MainViewport>
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

const Template = ({type, props}) => {
  if (type && props) {
    const element = createElement(type, props)
    return (element)
  }
  return null
}

export default StartPage;
