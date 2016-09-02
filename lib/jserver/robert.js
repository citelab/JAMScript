var nano = require('nanomsg'),

sursock = nano.socket('surveyor');
sursock.bind('tcp://127.0.0.1:7777');
sursock.setEncoding('utf8');

setTimeout(()=> sursock.send('sup'), 2000)

sursock.on('data', console.log);