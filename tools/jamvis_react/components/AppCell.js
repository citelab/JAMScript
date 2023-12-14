import { Graphics } from "@pixi/react";
import { useCallback, forwardRef} from "react";

const AppCell = forwardRef((props, ref) => {

  const draw = useCallback((g) => {
    g.clear();
    g.lineStyle(props.lineWidth, props.color);
    g.drawRect(
      props.x,
      props.y,
      props.width,
      props.height
    );
  })
  return <Graphics ref={ref} draw={draw} />
})

export default AppCell;
