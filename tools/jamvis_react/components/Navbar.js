import React, { useState } from "react";
import { ReactSVG } from "react-svg";
import Sidebar from "./Sidebar.js";

const Navbar = (props) => {
  const [showSidebar, setShowSidebar] = useState(false);

  const onHover = () => {
    setShowSidebar(showSidebar ? false : true);
  };
  return (
    <>
      <Sidebar show={showSidebar} numFogs={props.numFogs} />
      <div className="navbar rounded-lg h-20 bg-base-200 absolute">
        <div className="navbar-start">
          <div className="btn btn-ghost " onClick={onHover}>
            <ReactSVG src="/image/Menu.svg" />
          </div>
        </div>
        <div className="navbar-center">
          <a
            className="btn btn-wide btn-outline btn-primary font-sans text-3xl"
            href="https://citelab.github.io/JAMScript/"
          >
            jamvis
          </a>
        </div>
        <div className="navbar-end">
        </div>
      </div>
    </>
  );
};

export default Navbar;
