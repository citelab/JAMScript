
## jamlib.js
- initializes the machRegistry
- sets an update interval on the machRegistry so that it updates the IP address of the node every 60 seconds and reinits the jcond every 60 seconds
    - what is jcond for?
- initializes jnode with the type of the machine registry (device, fog, cloud)
    - this simply sets the machType global variable in jnode which is simply conditioned on in jnode in order to decide what to do

## jreg.js
- now that we have a node in jamlib.js, we need to register it with the network. this is where jreg comes in
- for now, we will simply pass the node object to jreg and make all updates on the object in jreg
- afterwards, discuss with Mahes how to work in dynamic node responses to actions!!! i.e. how the node should respond dynamically to receiving things from the broker

## TODOS
- handle responding to messages
- add API to Node to be able to add new subscriptions and actions
- implement responses to the other events that node-mqtt might emit
- update jnode to work with the new system
- implement circular log files
