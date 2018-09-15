var os = require('os'),
    https = require('https');


// ===========================
// Cloud Registry service
// ===========================

// constants..
const defaultCloudServer = 'mc224-jamscript.rhcloud.com';

// Some global parameters .. defined here.
var default_port = 443,
    device,
    addr,
    type;

// Create message
function createMsg(id, type, port, gps_coordinates) {    
    return {
        "id":id,
        "type":type,
        "gps":gps_coordinates,
        "port":port
    };
}

function register(device) {
    
    var options = {
        host: defaultCloudServer,
        path: '/registration',
        port: default_port,
        method: 'POST',
    };
  
    var request = https.request(options, function(res) {
        console.log(res.statusCode);
        
        res.on('data', function(d) {
            var result = String(d);
            console.log(result);
            if (result.indexOf("Success:") === 0) {
                device.id = result.slice("Success:".length, result.length);
            } else if (result.indexOf("IP_list:") === 0) {
                device.parent_address = JSON.parse(result.slice("Success:".length, result.length));
	            console.log(device.parent_address);
            }
        });
    });

    request.write(JSON.stringify(device), "Content-Type: application/json");
    request.end();

    request.on('error', function(e) {
        console.error(e);
    });
}

function heartBeat(device) {
    
    var options = {
        host: defaultCloudServer,
        path: '/heart_beat',
        port: default_port,
        method: 'POST',
    };
  
    var request = https.request(options, function(res) {
        console.log(res.statusCode);
        
        res.on('data', function(d) {
            var result = String(d);
            console.log(result);
            if (result.indexOf("Success:") === 0) {
                device.id = result.slice("Success:".length, result.length);
            }
        });
    });
  
    request.write( JSON.stringify(device) , "Content-Type: application/json");
    request.end();

    request.on('error', function(e) {
        console.error(e);
    });
    setTimeout(function() {
        heartBeat(device);
    }, 30000);
}

function updateIPAddress(device) {
    var interfaces = os.networkInterfaces();
    var addresses = {};
    
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.ipv4 = address.address;
            } else if(address.family === 'IPv6' && !address.internal) {
                addresses.ipv6 = address.address;
            }
        }
    }

    addresses.type = type;
    device.address = [addresses];
    device.parent_address = [];
    
    console.log(device.address);
    setTimeout(function() {
        updateIPAddress(device);
    }, 3600);
}

function getIPAddress(device) {
  
    var options = {
        host: defaultCloudServer,
        path: '/get_ip',
        port: default_port,
        method: 'POST',
    };

    var request = https.request(options, function(res) {
        console.log(res.statusCode);
        
        res.on('data', function(d) {
            var result = String(d);
            console.log(result);
            if (result.indexOf("Success:") === 0) {
                device.id = result.slice("Success:".length, result.length);
            } else if(result.indexOf("IP_list:") === 0) {
                device.parent_address = JSON.parse(result.slice("Success:".length, result.length));
            }
        });
    });

    request.write( JSON.stringify(device) , "Content-Type: application/json");
    request.end();

    request.on('error', function(e) {
        console.error(e);
    });
}

process.argv.forEach(function (val, index, array) {
    console.log("HEY");
    console.log(index + ': ' + val);
    if (index == 2)
	    addr = val;
    else if(index == 3)
        type = val;
});

if(addr === undefined || type === undefined) {
    addr = "default_jam_node";
	type = "CLOUD_SERVER";
}

device = createMsg(addr, type, default_port, undefined);
updateIPAddress(device);
register(device);
setTimeout(function() {
    heartBeat(device);
}, 5000);
