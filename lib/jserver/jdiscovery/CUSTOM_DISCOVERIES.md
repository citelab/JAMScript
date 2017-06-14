# On Custom Discoveries

## Attributes
- can be anything you want, as long as it is JSON.stringfiable
    - e.g.
        - 'online'
        - [0, 2, 4]
        - 1000
        - 100.0
        - { key: 'value' }
- can also be a function which returns attribute (again, anything JSON.stringifiable)
    - this function will be called prior to announcing the attribute, each time it is to be announced, in order to get the attribute to announce
    - it is useful for attributes that could change
    - e.g.
        - You could use bind
        ```
        {
            example: function() {
                // do stuff
            }.bind(null)
        }
        ```
        - Or a closure:
        ```
        {
            example: function() {
                return getTheAttribute(params);
            }
        }
        ```
- the value of an attribute should not be null, or it will be ignored

## Reserved Attributes
- status: reserved for 'online'/'offline' status announcements (all protocols)
- lastCheckIn: reserved for a timestamp indicating when the node last checked into local storage (local storage)
- createdAt: reserved for a timestamp indicating when the node was first written to local storage
- updatedAt: reserved for a timestamp indicating when the node last updated an attribute in local storage

## Usage
var reggie = new Registrar(app, machType, id, port);

// maybe you want to discover all devices that are thermostats
reggie.on('thermo', function(deviceId, temp) {
    // do something
});

// and you want to know the throughput capacity of fog nodes
reggie.on('foggyfogfogins', function(fogId, throughput) {
    // do something
});

// to make this happen, you need to tell reggie that you want to discover these things
var attrs = {
    device: { thermostat: 'thermo' },
    fog: { throughput: 'foggyfogfogins' }
};

reggie.discoverAttributes(attrs);
