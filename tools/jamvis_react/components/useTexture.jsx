import * as PIXI from 'pixi.js';
import { useEffect, useRef } from 'react';

export default async function useTexture({ image }) {
  const texture = useState(null)

  useEffect(() => {
    
    const loadTexture = async () => {
      const texture = await PIXI.Texture.from(image)
      return texture
    }

    loadTexture()

  }, [image]);

  return texture.current;
}
