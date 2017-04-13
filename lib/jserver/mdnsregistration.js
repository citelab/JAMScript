//==============================================================================
// Registers a node on the local network using mDNS
//==============================================================================

var mdns = require('mdns'),
    constants = require('./constants'),
    logger = require('./jerrlog'),
    registrar = require('./registrar');

/* create an mDNS advertisement on the local network */

function MDNSRegistrar(app, machType, port, id) {
    this.app = app;
    this.machType = machType;
    this.port = port;
    this.id = id;
    this.ip = this._getIPv4Address();
}

/* MDNSRegistrar inherits from Registrar */
MDNSRegistrar.prototype = new registrar.Registrar();

//------------------------------------------------------------------------------
// Advertisement creation
//------------------------------------------------------------------------------

/**
 * Public interface for creating an advertisement. Creates the advertisement and
 * starts a timer to check the IP address every so often so that we can update the
 * advertisement if need be
 */
MDNSRegistrar.prototype.createAdvertisement = function() {
    this._createAdvertisement(constants.mdns.retries);
    var self = this;
    // I'm not sure if this is strictly needed. It may be that the IP address
    // announced in the advertisement is updated immediately, in which case we would't need
    // to do this, but we'd still need to make sure that other nodes are made aware of the
    // ip change
    setInterval(function() {
        var oldIp = self.ip;
        self.ip = self._getIPv4Address();
        if (oldIp !== self.ip) {
            // tear down the existing advertisement
            self.ad.stop();
            // put up a new one
            self._createAdvertisement(constants.mdns.retries);
        }
    }, constants.mdns.ipCheckInterval);
}

/**
 * Attempts to create an mDNS advertisement up to `retries` times
 */
MDNSRegistrar.prototype._createAdvertisement = function(retries) {
    // advertise a service named `app-machType`, e.g. `myApplication-DEVICE`
    this.ad = mdns.createAdvertisement(mdns.tcp(this.app + '-' + this.machType), this.port, {name: this.id}, function(err, service) {
        if (err) {
            retries--;
            this._handleError(err, retries);
        }
    });
    this.ad.start();
}

/**
 * helper function for handling advertisement errors
 */
MDNSRegistrar.prototype._handleError = function(err, retries) {
    switch (err.errorCode) {
        // if the error is unknown, then the mdns daemon may currently be down,
        // so try again in 10 seconds
        case mdns.kDNSServiceErr_Unknown:
            logger.log.error('Unknown service error: ' + err);
            if (retries === 0) {
                logger.log.warning('Exhaused all advertisement retries.');
                this.emit('mdns-ad-error', err);
            } else {
                setTimeout(this._createAdvertisement, constants.mdns.retryInterval, retries);
            }
            break;
        default:
            logger.log.error('Unhandled service error: ' + err + '. Abandoning mDNS.');
            this.emit('mdns-ad-error', err);
    }
}

//------------------------------------------------------------------------------
// Service browsing
//------------------------------------------------------------------------------

/**
 * Browses for services
 */
MDNSRegistrar.prototype.browse = function() {
    // the serice a node browses for depends on the type of the node
    /* create the browser */
    var browser;
    var self = this;
    if (this.machType === constants.globals.NodeType.DEVICE) {
        // devices browse for fogs
        browser = mdns.createBrowser(mdns.tcp(this.app + '-' + constants.globals.NodeType.FOG));
        browser.on('serviceUp', function(service) {
            /* emit the id, port, and IP address of the fog to the rest of the application */
            // possible that _getIp returns null
            var fogIp = self._getIp(service.addresses);
            if (fogIp === null) {
                // ignore the fog
                // TODO might want to modify this behavior
                return;
            }
            var retVal = {
                port: service.port, // int
                ip: fogIp, // string
                id: service.name // string
            };
            self.emit('fog-up', retVal);
        });
        browser.on('serviceDown', function(service) {
            self.emit('fog-down', service.name);
        });
    } else if (this.machType === constants.globals.NodeType.FOG) {
        // fogs browse for clouds
        browser = mdns.createBrowser(mdns.tcp(this.app + '-' + constants.globals.NodeType.CLOUD));
        browser.on('serviceUp', function(service) {
            /* emit the id, port, and IP address of the cloud to the rest of the application */
            // possible that _getIp returns null
            var cloudIp = self._getIp(service.addresses);
            if (cloudIp === null) {
                // ignore this cloud...
                // TODO might want to modify this behavior
                return;
            }
            var retVal = {
                port: service.port, // int
                ip: cloudIp, // string
                id: service.name // string
            };
            self.emit('cloud-up', retVal);
        });
        browser.on('serviceDown', function(service) {
            self.emit('cloud-down', service.name);
        });
    }
    // NOTE: clouds don't browse for anyone
    /* start the browser */
    browser.start();
}

/**
 * Parses and returns an IPv4 address from an array of addresses
 */
MDNSRegistrar.prototype._getIp = function(addresses) {
    for (var i = 0; i < addresses.length; i++) {
        var parts = addresses[i].split('.');
        if (parts.length === 4) {
            var valid = true;
            for (var j = 0; j < 4; j++) {
                var num = parseInt(parts[j]);
                if (isNaN(num) || (num < 0 || num > 255)) {
                    break;
                }
            }
            if (valid) {
                return addresses[i];
            }
        }
    }
    return null;
}

/**
 * A public helper to quit advertising
 */
MDNSRegistrar.prototype.stopAdvertising = function() {
    this.ad.stop();
}

/* exports */
module.exports.MDNSRegistrar = MDNSRegistrar;
