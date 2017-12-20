var crypto = require('crypto');
var fs = require('fs');

jdata{
    struct message{
        char* text;
        char* nodeID;
        int index;
    }message as logger;

    struct sender{
        char* text;
        char* nodeID;
        int index;
    }sender as broadcaster;
}

console.log("jsys tags: ", jsys.tags);
var tags = jsys.tags.trim().split("_");
console.log("The tags are: ", tags);

if( JAMManager.isDevice )
    fs.mkdir("results", () => false);


var ENCRYPTION_KEY = "xoTo22ImoDKqA0p6pDCcODUuVxXRbtNB"; // Must be 256 bytes (32 characters)
var IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
    var iv = crypto.randomBytes(IV_LENGTH);
    var cipher = crypto.createCipheriv('aes-256-cbc', new Buffer(ENCRYPTION_KEY), iv);
    var encrypted = cipher.update(text);

    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    var textParts = text.split(':');
    var iv = new Buffer(textParts.shift(), 'hex');
    var encryptedText = new Buffer(textParts.join(':'), 'hex');
    var decipher = crypto.createDecipheriv('aes-256-cbc', new Buffer(ENCRYPTION_KEY), iv);
    var decrypted = decipher.update(encryptedText);

    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
}


function process(){
    //set transformers for encrypting and decrypting
    message.setTransformer(input => {
        input.text = encrypt(input.text);
        return input;
    });
    sender.setTransformer(input => {
        input.text = decrypt(input.text);
        return input;
    });
}

function register(){
    if( tags.indexOf(JAMManager.getLevelCode()) >= 0 )
        process();
}

console.log("Running on the ", JAMManager.getLevelCode());

message.subscribe(function(key, entry){
    //console.log("logger encrypted message is: ", entry.log);
    if( JAMManager.isCloud )
        sender.broadcast(entry.log);
});
sender.addHook(function(data){
    if( JAMManager.isDevice ){
        console.log(JAMManager.getLevelCode() + " broadcaster decrypted message is: ", data.message);
        console.log("------------------in hook----------------");
        receiveMessage(data.message.text, data.message.nodeID, data.message.index);
    }
});


register();