// = Create a machine registry. We can make it a local storage so it works with
//   mininet. TODO: Make it work with Xiru's remote registry as well.

//   Creation/addition:
//     = Create machine registry - with a name - filename reflects the machine name
//       (machine name and app name are the same)
//     = Only one cloud node for now. Fail if multiple cloud nodes are added to the
//       registry. This could be a problem with the UUID4 generation.
//     = Add as many fog and device nodes. If the fog/device is already there, don't add.
//   Updates:
//     = Update the IP address of the node. If the node is not the cloud, it should
//       have a parent. The parent should be active (any node that is not updated for the
//       last K seconds is considered inactive. If the parent is inactive, select another
//       parent.
//   Query:
//     = find the fog:
//       Used by the device to find the fog
//     = find the cloud:
//       Used by the fog to find the cloud
//     = find the cloud for the device:
//       Used by the device that is connected to a given fog to find the cloud

// TODO: There could be an issue with multiple nodes writing to the local storage at the
// same time

var Random = require('random-js')
var rgen = new Random();

var localStorage;

module.exports = new function () {

    this.init = function (registry, app) {

        if (app === undefined) {
            console.log("ERROR! App is undefined.. Exiting.");
            process.exit(1);
        }

        // put the 'app' as a hidden directory in user's home
        appdir = os.homedir + '/.' + app

        // Open local storage
        if (typeof localStorage === "undefined" || localStorage === null) {
            var LocalStorage = require('node-localstorage').LocalStorage;
            localStorage = new LocalStorage(appdir);
        }

        // We need to connect the registry...
    }

    // insert cloud.. 
    //
    this.setCloud = function (deviceId) {
        // get existing clouds 
        clouds = localStorage.getItem('cloud');
        if (clouds !== null) {
            if (clouds !== deviceId) {
                console.log("ERROR! Another cloud is already set...");
                process.exit(1);
            }
        } else 
            localStorage.setItem('cloud', deviceId);
        
        // Also store the record for the current node
        node = localStorage.getItem(deviceId);
        if (node !== null) 
            node.type = 'cloud';
        else
            node = {"id": deviceId, "type": "cloud"};
        localStorage.setItem(deviceId, node);
    }

    this.getCloud = function () {
        return localStorage.getItem('cloud');
    }


    // insert fog
    // WARNING: There could be a Race Condition here
    //
    this.setFog = function (deviceId) {
        // get existing fogs 
        fogs = localStorage.getItem('fogs');
        if (fogs !== null) {
            for (f in fogs) {
                if (f === deviceId) 
                    return;
            }
        }
        fogs.push(deviceId);
        localStorage.setItem('fogs', fogs);
        
        // Also store the record for the current node
        node = localStorage.getItem(deviceId);
        if (node !== null) 
            node.type = 'fog';
        else
            node = {"id": deviceId, "type": "fog"};
        localStorage.setItem(deviceId, node);
    }

    // insert device
    this.setDevice = function (deviceId) {
        fogs = localStorage.getItem('fogs');
        afog = rgen.integer(0, fogs.length-1);

        // Also store the record for the current node
        node = localStorage.getItem(deviceId);
        if (node === null)
            node = {"id": deviceId};
        
        node.type = "device";
        node.fog = afog;
        localStorage.setItem(deviceId, node);
    }

    // set address
    this.setAddress = function (deviceId, addr) {
        node = localStorage.getItem(deviceId);
        // if not found in local storage, then exit without any changes
        if (node === null)
            return;
        node.addr = addr;
        localStorage.setItem(deviceId, node);
    }

    this.getAddress = function (deviceId) {
        node = localStorage.getItem(deviceId);
        if (node === null)
            return undefined;
        return node.addr;
    }

    this.getFogAddress = function(deviceId) {
        node = localStorage.getItem(deviceId);
        if (node === null)
            return undefined;

        if (node.type === "fog")
            return node.addr;
        if (node.fog === undefined)
            return undefined;
        if (node.type === "device") {
            fnode = localStorage.getItem(node.fog);
            return fnode.addr;
        }
        return undefined;
    }

    this.getCloudAddress = function() {
        cloud = this.getCloud();
        cnode = localStorage.getItem(cloud);
        if (cnode === null)
            return undefined;
        
        return cnode.addr;
    }
}
