import PixiFreeSprite from '@/app/PixiFreeSprite.js'
import { useContext } from 'react'

const FreeSprite = (props) => {
  const data = useContext(StateContext)
  console.log(data)
  return <PixiFreeSprite {...props} />
}

export default FreeSprite
