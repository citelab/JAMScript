
export default function InfoCard({ image, title, content, x, y}) {
  return (
    <div style={{left: x + "px", top: y + "px"}} className="card w-96 glass absolute ">
      <figure><img src={image} alt="car!"/></figure>
      <div className="card-body">
        <h2 className="card-title">{title}</h2>
        {content.map((line, index) => <p key={index}>{line}</p>)}
      </div>
    </div>
  )
}
