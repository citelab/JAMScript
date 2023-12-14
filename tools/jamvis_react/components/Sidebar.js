
const Sidebar = (props) => {

  return (
    <div className="drawer" >
      <input  type="checkbox" className="drawer-toggle" checked={props.show} onChange={() => {props.show ? true : undefined }}/>
      <div className="drawer-side w-80" >
      <ul className="menu pt-20 p-4 w-80 min-h-full bg-base-200 text-base-content">
          <div className="stat">
            <div className="stat-title">Nodes</div>
            <div className="stat-value">{props.numNodes}</div>
          </div>
      </ul>
      </div>
    </div>
  )
}

export default Sidebar
