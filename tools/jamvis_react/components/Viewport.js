'use client'
import { PixiComponent, useApp } from '@pixi/react'
import { Viewport } from 'pixi-viewport';
import { EventSystem, TilingSprite, Texture } from 'pixi.js';
import { forwardRef } from 'react';

const PixiViewportComponent = PixiComponent('Viewport', {
  create: (props) => {
    
    // comes from github issue: https://github.com/davidfig/pixi-viewport/issues/438
    const events = new EventSystem(props.app.renderer);
    events.domElement = props.app.renderer.view 
    const { screenWidth, screenHeight, worldWidth, worldHeight } = props;
    const { ticker } = props.app;

    const viewport = new Viewport({
      // screenWidth: screenWidth,
      // screenHeight: screenHeight,
      worldWidth: worldWidth, 
      worldHeight: worldHeight,
      ticker: ticker,
      events: events
    });
    viewport
        .drag()
        .wheel()
        
    // add background using native PIXI TilingSprite
    const backgroundTexture = Texture.from(props.background)
    const background = new TilingSprite(backgroundTexture, worldWidth, worldHeight);
    viewport.addChild(background);

    viewport.on('moved', () => {
      // make background move with viewport
      background.x = viewport.left;
      background.y = viewport.top;

      // offset tiles so they move with the viewport
      background.tilePosition.x = -viewport.left;
      background.tilePosition.y = -viewport.top;

      // scale background to match viewport
      background.width = innerWidth / viewport.scale.x
      background.height = innerHeight / viewport.scale.y
    })
    viewport.on('zoomed-end', props.onZoomEnd)
    return viewport;
  },
  willUnmount: (instance, parent) => {
      // workaround because the ticker is already destroyed by this point by the stage
      instance.options.noTicker = true;
      instance.destroy({children: true, texture: true, baseTexture: true})

  }
});

const ViewportComponent = forwardRef(
    (props, ref) => {
        const app = useApp();
        return <PixiViewportComponent ref={ref} app={app} {...props} />;
    }
);

export default ViewportComponent;
