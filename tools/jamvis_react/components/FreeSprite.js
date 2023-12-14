import PixiFreeSprite from '@/app/PixiFreeSprite.js'
import { useApp } from '@pixi/react'
import { useContext } from 'react'

const FreeSprite = (props) => {
  const app = useApp()
  return <PixiFreeSprite app={app} {...props} />
}

export default FreeSprite
