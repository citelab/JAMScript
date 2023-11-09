'use client'
import { PixiComponent, useApp } from '@pixi/react'
import { Viewport } from 'pixi-viewport';
import { EventSystem } from 'pixi.js';
import { forwardRef } from 'react';

const PixiViewportComponent = PixiComponent('Viewport', {
  create: (props) => {
    
    // comes from github issue: https://github.com/davidfig/pixi-viewport/issues/438
    const events = new EventSystem(props.app.renderer);
    events.domElement = props.app.renderer.view 
    const { worldWidth, worldHeight } = props;
    const { ticker } = props.app;

    const viewport = new Viewport({
      worldWidth: worldWidth, 
      worldHeight: worldHeight,
      ticker: ticker,
      events: events
    });
    viewport
        .drag()
        .wheel()
        
    viewport.on('zoomed-end', props.onZoomEnd)
    viewport.clampZoom({ maxScale: props.depth, minScale: 1})
    return viewport;
  },
  willUnmount: (instance) => {
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
