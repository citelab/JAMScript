---
layout: page
title: JView
subtitle: JView Documentation
---

## JView

### Controllers
Controllers are widgets that are capable of sending commands to the backend and control. They are part of the output side of JView. These widgets have different configurations possible to bring a variety of control over a JAMScript program from an arbitrary web browser. All widgets are made in ReactJS and can be customizable inside the Config.json file.

There are currently 3 types of widgets: a slider, a button and a terminal. The slider and button have several modes to personalize the way the data is sent to the backend. Finally, the terminal is a simple abstraction of an actual machine's own terminal capable of sending commands to and receiving responses from it.

#### Widgets

All widgets are associated to the ControllerStore which governs the values and state of each widget. There must be a MobX store associated with the widgets in order for them to function. This store is automatically generated through the StoreGenerator.js with the appropriate Config.json file. They emit to the backend through a websocket.

##### Slider

The slider is a simple HTML5 input element that can be controlled by clicking on its dial and sliding it left or right. Users can customize the slider's range by inputting a **min** value and a **max** value. In addition, its **step** can be changed to specify a specific increment whenever the dial is moved. The slider's initial **value** can also be customized to give the slider a specific value when it is first rendered. 

The slider widget possesses two modes. Its first mode will emit its new value whenever it is moved. The second mode will emit the current value every **interval** of time specified in milliseconds. Moving the slider in the second mode will not stream to the backend until the next interval of time.

##### Button

##### Terminal

