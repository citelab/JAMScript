# JView

JView is a generic visualization library that utilizes React.js, Mobx.js, Node.js and Socket.io to generate dynamic and synchronized front end view of JData. The main advantage of using this technology stack is that it utilizes the concept of one-way data flow (so-called one-way binding) and component hierarchy of React framework so that the view is synchronized with any JData flow and the user can dynamically change the view structure by reorganizing the components with standard APIs.
The overview of the stack works as follows: 
Node.js, which in this case a JNode service, is the main controller that sets up socket.io and hosts view assets after Webpack-ing React component. It provides a main entry point to the Jview service.
socket.io is hosted by Node.js when the Node service starts to run. It is a wrap up of Websocket APIs of the TCP socket. It will act as a messaging hub for JData in-flow and JView out-flow.
Mobx.js is the data layer of all non-stateless React components. It tells when and what the react components should render.
React.js is the main JView layer that communicates with the client. It includes two important libraries, JView Components and ECharts Adaptor. JView Components include all the default  React components written in ES6 that can be reused anytime, including basic Form and Text input to Calendar Selector. The style sheets are included for all the components as well using LESS, so the colour scheme and layout can be changed dynamically based on client preference and demand as well. ECharts Adaptor is a wrap up library of ECharts 2.0, an open source library built by Baidu.inc, to match with JView APIs.

## To Test:
```
// Generate from Config.json
npm test 
// Open the directory Generated
cd app
// install all dependencies
npm install
// Starts node server
node index.js 

------------------
// to run other Samples/Demos
npm run sample-1
npm run sample-2
npm run sample-3
npm run sample-4
npm run sample-5
npm run sample-6

//then checkout ./app folder
// or host files
node app/index.js

// run socket data-mocker, for sample 3, 4, 5, 6
node app/Data-Mocker.js

------------------
// to read beautified code, run this after compilation and generation of the app folder
npm run beautify
```