# TODOS

- test MQTT and mDNS
- write local storage

## MDNS
- probably need an mdns server up and running on each node. If a node is able to use MQTT, then it won't need this server, but it should still have it up to listen for other nodes that weren't able to use MQTT for some reason.
- so, I think the following is all that needs doing:
    - for each node, create an mDNS advertisement no matter what (when a node is up, it should be advertising itself over mDNS)
    - there should also be some way (perhaps a function, or event) to start a browser for the node.
    - The browser will be started if MQTT fails.
    - Once the browser is started, on each emission of 'serviceUp' and 'serviceDown', we need to update the local state of the application (like store the fact that a new fog is up, just like with MQTT).
        - ACTUALLY, KEEP THIS SIMPLE UNTIL YOU TALK TO MAHES. In the MQTT implementation, you haven't used these data structures yet. So, on 'serviceUp' and 'serviceDown', just pick out the information of interest and emit an event with it. You won't even need any built-in behaviors since you will just receive everything from everyone (all service advertisements are multi-casted out!), and your status as seen by another node will be 'online' when they get the 'serviceUp' event and 'offline' on 'serviceDown'.
        I.E. DON'T OVERTHINK THIS! IT SHOULD BE VERY SIMPLE!
    - A node may have multiple browsers, each searching for different service types.
    - As an example, a device might advertise itself with service type mdns.tcp('device') and browse for mdns.tcp('fog').
    - We may want to take advantage of DNS text records for publishing information, although we should not rely on these and try to avoid them. All the info we need (port and IP address) is already in the `service` object that we get on a `serviceUp` event. However, the DNS TXT record could be VERY useful for publishing the ID of the node advertising the service. That way, fogs, for example, can all advertise with service name 'fog' and still be distinguished by the ID in their TXT record.

## MQTT
- figure out when mqtt calls 'reconnect', 'close', and 'offline'
- implement circular log files

## Questions for Mahes
- I've added support for listening for custom subscriptions, but where will we add these/listen for them? Is this even my concern?
    - No it is not your concern!
- What should the registration module be storing? So far, I've had devices store the fogs that it discovers, etc., but I never actually use this information anywhere, since I just emit events back to the application.
    - get rid of this
