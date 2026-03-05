import React, { createContext, useMemo, useContext } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const useSocket = () => {
  const socket = useContext(SocketContext);
  return socket;
};

export const SocketProvider = (props) => {
  // const socket = useMemo(() => io("localhost:8000"), []);
  const socketUrl = process.env.REACT_APP_SOCKET_URL || "https://webrtc-m8ch.onrender.com";
  const socket = useMemo(() => io(socketUrl, {
    transports: ["websocket"],
  }), [socketUrl]);

  return (
    <SocketContext.Provider value={socket}>
      {props.children}
    </SocketContext.Provider>
  );
};