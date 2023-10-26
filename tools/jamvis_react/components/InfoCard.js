import { useState } from "react";

const InfoCard = () => {
  const [visible, setVisible] = useState(false);
  const onHover = () => {
    const visibility = visible ? false : true;
    setVisible(visibility)
  }
  return (
    <>
    <div 
      className={"card w-96 absolute"}
      onMouseEnter={onHover} onMouseLeave={onHover}
    >
      <div className={"card-body " + (visible ? "absolute" : "invisible")}>
        <h2 className="card-title">Shoes!</h2>
        <p>{visible}</p>
      </div>
    </div>
    </>
  )
}

export default InfoCard
