var nano = require('nanomsg'),

sursock = nano.socket('respondent');
sursock.connect('tcp://127.0.0.1:7777');

sursock.on('data', function(){ 
    sursock.send('b is online');
    console.log("Was here ...")
}
)
