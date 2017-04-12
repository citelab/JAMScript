# README

## Events

### Built-in Events
-  `fog-online`: emitted when a fog comes online
    - arguments:
        - ID of the fog
- `fog-offline`: emitted when a fog goes offline
    - arguments:
        - ID of the fog
- `cloud-online`: emitted when a cloud comes online
    - arguments:
        - ID of the cloud
- `cloud-offline`: emitted when a cloud goes offline
    - arguments
        - ID of the cloud
- `reconnect`: emitted when a device reconnects to the broker
- `registration-error`: emitted when something goes wrong during MQTT registration; if this happens then the node should give up on MQTT and fall back to mDNS or local storage
    - arguments:
        - none
- `address-changed`: emitted when the IP address of the node changes
    - arguments:
        - old address
        - new address

### Custom Events
- custom events are triggered when a message for a custom subscription is received
- such events are always passed back to the listener with the tag that the custom subscription was registered with and the following arguments
    - topic
    - message
