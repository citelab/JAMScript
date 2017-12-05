---
layout: page
title: JView
subtitle: JView Documentation
---

## JView

### Controllers
Controllers are widgets that are capable of sending commands to the backend and control. They are part of the output side of JView. These widgets have different configurations possible to bring a variety of control over a JAMScript program from an arbitrary web browser. All widgets are made in ReactJS and can be customizable inside the Config.json file.

There are currently 4 types of widgets: a slider, a button, a multistate button and a terminal. The slider and button have several modes to personalize the way the data is sent to the backend. The multistate button is similar to a button, but can emit different values depending on the state it is currently in. Finally, the terminal is a simple abstraction of an actual machine's own terminal capable of sending commands to and receiving responses from it.

#### Widgets

All widgets are associated to the ControllerStore which governs the values and state of each widget. There must be a MobX store associated with the widgets in order for them to function. This store is automatically generated through the StoreGenerator.js with the appropriate Config.json file. They emit to the backend through a websocket.

##### Slider

The slider is a simple HTML5 input element that can be controlled by clicking on its dial and sliding it left or right. Users can customize the slider's range by inputting a **min** value and a **max** value. In addition, its **step** can be changed to specify a specific increment whenever the dial is moved. The slider's initial **value** can also be customized to give the slider a specific value when it is first rendered. 

The slider widget possesses two modes. Its first mode will emit its new value whenever it is moved. The second mode will emit the current value every **interval** of time specified in milliseconds. Moving the slider in the second mode will not stream to the backend until the next interval of time.

###### Examples

```shell
// Full example can be found in sample 9.
...
{
	"controlList": [
		{
			"id": "1",
			"type": "slider",
			"dispLabel": "The slider's name",
			"max": "maxValueName", // This is a string that refers to the variable in the store
			"min": "minValueName", // This is a string that refers to the variable in the store
			"step": "stepValueName", // This is a string that refers to the variable in the store
			"value": "presentValueName", // This is a string that refers to the variable in the store
			"valueName": "presentValueName", // This is a string that refers to the variable in the store
			"trigger": "emitValue", // Callback. This specific one will emit to the backend
			"mode": 0, // 0: triggers on change 1: triggers every interval
			"interval": 500 // Interval in milliseconds. Won't do anything if mode = 0
		}
	]
}
...
```

```shell
// Example of what the slider emits to the backend
{
	id: "1",
	value: 50 // The value is the value at the new position of the slider.
}
```

##### Button

The button emits to the backend a boolean value and alternates between the values of **true** and **false**.

Like the slider, the button also has two modes. Similarly, the first mode will emit a boolean whenever it is pressed, while the second mode will emit its current state every **interval** of time specified in milliseconds. Only pressing the button will change its value.

```shell
// Example of what the button emits to the backend
{
	id: "1",
	value: true // The value alternates between true and false.
}
```

##### Multistate Button



```shell
// Example of what the multistate button emits to the backend
{
	id: "1",
	value: 100 // The value can be anything specified in the Config.json file.
}
```

##### Terminal

The terminal uses a ReactJS component to simulate the real terminal, found [here](https://github.com/nitin42/terminal-in-react). On pressing the return key, the widget will emit the command along with the terminal's ID.

```shell
// Example of what the terminal emits to the backend
{
	id: "1",
	value: "./a.out" // The value is any string passed into the terminal.
}
```

