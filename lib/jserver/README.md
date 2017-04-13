# README

## Events

### MQTT

#### Built-in Events
-  `fog-online`: emitted when a fog comes online
    - arguments:
        - [string] ID of the fog [string]
- `fog-offline`: emitted when a fog goes offline
    - arguments:
        - [string] ID of the fog
- `cloud-online`: emitted when a cloud comes online
    - arguments:
        - [string] ID of the cloud
- `cloud-offline`: emitted when a cloud goes offline
    - arguments
        - [string] ID of the cloud
- `reconnect`: emitted when a device reconnects to the broker
- `mqtt-reg-error`: emitted when something goes wrong during MQTT registration; if this happens then the node should give up on MQTT and fall back to mDNS or local storage
    - arguments:
        - [error] the error
- `address-changed`: emitted when the IP address of the node changes
    - arguments:
        - [string] old address
        - [string] new address

#### Custom Events
- custom events are triggered when a message for a custom subscription is received
- such events are always passed back to the listener with the tag that the custom subscription was registered with and the following arguments
    - [string] topic
    - [string] message

### mDNS

#### Built-in Events
- `mdns-ad-error`: emitted if the node cannot make an mDNS advertisement
    - arguments:
        - [error] the error
- `fog-up`: emitted when a fog goes up
    - arguments:
        - object: {
            ip: [string] ip address of fog,
            port: [int] port of fog,
            id: [string] id of fog
        }
- `fog-down`: emitted when a fog goes down
    - arguments:
        - [string] id of the fog
- `cloud-up`: emitted when a cloud goes up
    - arguments:
        - object: {
            ip: [string] ip address of cloud,
            port: [int] port of cloud,
            id: [string] id of cloud
        }
- `cloud-down`: emitted when a cloud goes down
    - arguments:
        - [string] id of the cloud
