const   RegistrarTail = require('./jregistrar-tail.js');

[,, app, type, id, port, config] = process.argv;
this.registrarTail = new RegistrarTail(app, type, id, port, JSON.parse(config));

this.registrarTail.on('appNotifLess', (event, id, protocol) => {
    process.send({ appNotifLess: {event: event, id: id, protocol: protocol }});
});
this.registrarTail.on('appNotifMore', (event, id, data, protocol) => {
    process.send({ appNotifMore: {event: event, id: id, data: data, protocol: protocol }});
});
this.registrarTail.on('discoveryTable', (dt) => {
    process.send({ discoveryTable: dt });
});

process.on('message', (m) => {
    // XXX
    console.log('Received call to: ');
    console.log(m);
    for(f in m)
        if(m.hasOwnProperty(f))
            this.registrarTail[f](m[f]);
});
