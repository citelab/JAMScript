//==============================================================================
// Registers a node on the local network using mDNS
//==============================================================================

var mdns = require('./mdns/lib/mdns'),
    constants = require('../jamserver/constants'),
    logger = require('../jamserver/jerrlog'),
    Registry = require('./registry');

function MDNSRegistry(app, machType, id, port) {
    Registry.call(this, app, machType, id, port);
    this.ads = {};
    this.browsers = {
        device: {},
        fog: {},
        cloud: {}
    };
    this.started = false;
    this.attrs = {};
    this.attrsToDiscover = {
        device: {},
        fog: {},
        cloud: {}
    }
}

/* MDNSRegistry inherits from Registry */
MDNSRegistry.prototype = Object.create(Registry.prototype);
MDNSRegistry.prototype.constructor = MDNSRegistry;

MDNSRegistry.prototype.registerAndDiscover = function(options) {
    this.started = true;

    // start any ads and browsers created before this function was called
    this.addAttributes(this.attrs);
    this.discoverAttributes(this.attrsToDiscover);

    // add any new attributes or desired discoveries
    if (options) {
        if (options.attrsToAdd) {
            this.addAttributes(options.attrsToAdd);
        }
        if (options.attrsToDiscover) {
            this.discoverAttributes(options.attrsToDiscover);
        }
    }
}

//------------------------------------------------------------------------------
// Advertisement creation
//------------------------------------------------------------------------------

/**
 * Creates advertisements for the provided attributes
 */
MDNSRegistry.prototype._createAdvertisements = function(attrs) {
    for (var attr in attrs) {
        // stop advertisement of existing attr (we'll just replace it)
        if (this.ads[attr]) {
            this.ads[attr].stop();
            delete this.ads[attr];
        }
        var adName = this.app + '-' + this.machType[0] + '-' + attr;
        var txtRecord;
        if (attrs[attr] instanceof Function) {
            txtRecord = {
                msg: JSON.stringify({
                    payload: attrs[attr]()
                })
            };
        } else {
            txtRecord = {
                msg: JSON.stringify({
                    payload: attrs[attr]
                })
            };
        }
        this._createAdvertisementWithRetries(this, attr, adName, txtRecord, constants.mdns.retries);
    }
}

/**
 * Helper
 */
MDNSRegistry.prototype._createAdvertisementWithRetries = function(self, attr, adName, txtRecord, retries) {
    var ad = mdns.createAdvertisement(mdns.tcp(adName), self.port, {name: this.id, txtRecord: txtRecord}, function(err, service) {
        if (err) {
            self._handleError(self, err, ad, attr, adName, txtRecord, retries);
        } else {
            self.ads[attr] = ad;
        }
    });
    ad.start();
}

/**
 * helper function for handling advertisement errors
 */
MDNSRegistry.prototype._handleError = function(self, err, ad, attr, adName, txtRecord, retries) {
    switch (err.errorCode) {
        // if the error is unknown, then the mdns daemon may currently be down,
        // so try again after some time
        case mdns.kDNSServiceErr_Unknown:
            logger.log.error('Unknown service error: ' + err);
            if (retries === 0) {
                logger.log.warning('Exhaused all advertisement retries.');
                // make sure the ad is stopped
                ad.stop();
                // emit the ad info, so the registrar can decide if it wants to retry later
                self.emit('ad-error', self, attr, addName, txtRecord);
            } else {
                setTimeout(self._createAdvertisementWithRetries, constants.mdns.retryInterval, self, attr, adName, txtRecord, retries - 1);
            }
            break;
        default:
            logger.log.error('Unhandled service error: ' + err);
            // make sure the ad is stopped
            ad.stop();
            self.emit('ad-error', self, attr, addName, txtRecord);
    }
}

//------------------------------------------------------------------------------
// Service browsing
//------------------------------------------------------------------------------

/**
 * Browses for services
 */
MDNSRegistry.prototype._browseForAttributes = function(dattrs) {
    for (var attr in dattrs.device) {
        if (!this.browsers.device[attr]) {
            if (attr === 'status') {
                this._browseForStatus(this, constants.globals.NodeType.DEVICE, dattrs.device.status);
            } else {
                this._browse(this, attr, constants.globals.NodeType.DEVICE, dattrs.device[attr]);
            }
        } else {
            this.browsers.device[attr].start();
        }
    }

    for (var attr in dattrs.fog) {
        if (!this.browsers.fog[attr]) {
            if (attr === 'status') {
                this._browseForStatus(this, constants.globals.NodeType.FOG, dattrs.fog.status);
            } else {
                this._browse(this, attr, constants.globals.NodeType.FOG, dattrs.fog[attr]);
            }
        } else {
            this.browsers.fog[attr].start();
        }
    }

    for (var attr in dattrs.cloud) {
        if (!this.browsers.cloud[attr]) {
            if (attr === 'status') {
                this._browseForStatus(this, constants.globals.NodeType.CLOUD, dattrs.cloud.status);
            } else {
                this._browse(this, attr, constants.globals.NodeType.CLOUD, dattrs.cloud[attr]);
            }
        } else {
            this.browsers.cloud[attr].start();
        }
    }
}

/**
 * Prep a browser to browse for any attibute except for status
 */
MDNSRegistry.prototype._browse = function(self, attr, machType, event) {
    var browser = mdns.createBrowser(mdns.tcp(self.app + '-' + machType[0] + '-' + attr));

    self.browsers[machType][attr] = browser;

    browser.on('serviceUp', function(service) {
        // ignore our own services
        if (service.name == self.id) {
            return;
        }

        // emit a discovery event!
        self.emit('discovery', attr, event, service.name, JSON.parse(service.txtRecord.msg).payload);
    });

    browser.on('error', function(err) {
        browser.stop();
        self.emit('browser-error', self, attr, machType, event);
    });

    browser.start();
}

/**
 * Prep a browser to browse for the status attribute
 */
MDNSRegistry.prototype._browseForStatus = function(self, machType, events) {
    var browser = mdns.createBrowser(mdns.tcp(self.app + '-' + machType[0] + '-status'));

    self.browsers[machType].status = browser;

    browser.on('serviceUp', function(service) {
        // ignore our own services
        if (service.name == self.id) {
            return;
        }

        // emit a node online event!
        self.emit('discovery', 'status', events.online, service.name, JSON.parse(service.txtRecord.msg).payload);
    });

    browser.on('serviceDown', function(service) {
        self.emit('discovery', 'status', events.offline, service.name, 'offline');
    });

    browser.on('error', function(err) {
        browser.stop();
        self.emit('browser-error', self, 'status', machType, events);
    });

    browser.start();
}

//==============================================================================
// Add and discover attributes
//==============================================================================

/**
 * Just an alias for _createAdertisements, i.e. adds attributes by starting ads
 */
MDNSRegistry.prototype.addAttributes = function(attrs) {
    if (this.started) {
        this._createAdvertisements(attrs);
    } else {
        for (var attr in attrs) {
            this.attrs[attr] = attrs[attr];
        }
    }
}

/**
 * Removes attributes by stopping the advertisements
 */
MDNSRegistry.prototype.removeAttributes = function(attrs) {
    if (this.started) {
        for (var i = 0; i < attrs.length; i++) {
            // stop and remove the advertisement
            if (this.ads[attrs[i]]) {
                this.ads[attrs[i]].stop();
                // we delete the ad object because even if we start advertising with the
                // same service name in the future, the value we advertise may be different
                delete this.ads[attrs[i]];
            }
        }
    } else {
        for (var i = 0; i < attrs.length; i++) {
            delete this.attrs[attrs[i]];
        }
    }
}

/**
 * Alias for _browseForAttributes, i.e. discovers attributes by starting browsers
 */
MDNSRegistry.prototype.discoverAttributes = function(dattrs) {
    if (this.started) {
        this._browseForAttributes(dattrs);
    } else {
        for (var attr in dattrs.device) {
            this.attrsToDiscover.device[attr] = dattrs.device[attr];
        }
        for (var attr in dattrs.fog) {
            this.attrsToDiscover.fog[attr] = dattrs.fog[attr];
        }
        for (var attr in dattrs.cloud) {
            this.attrsToDiscover.cloud[attr] = dattrs.cloud[attr];
        }
    }
}

/**
 * Stops making discoveries by stopping browsers
 */
MDNSRegistry.prototype.stopDiscoveringAttributes = function(dattrs) {
    if (dattrs.device) {
        for (var i = 0; i < dattrs.device.length; i++) {
            if (this.started) {
                // stop the browser
                if (this.browsers.device[dattrs.device[i]]) {
                    this.browsers.device[dattrs.device[i]].stop();
                }
            } else {
                delete this.attrsToDiscover.device[dattrs.device[i]];
            }
        }
    }

    if (dattrs.fog) {
        for (var i = 0; i < dattrs.fog.length; i++) {
            if (this.started) {
                if (this.browsers.fog[dattrs.fog[i]]) {
                    this.browsers.fog[dattrs.fog[i]].stop();
                }
            } else {
                delete this.attrsToDiscover.fog[dattrs.fog[i]];
            }
        }
    }

    if (dattrs.cloud) {
        for (var i = 0; i < dattrs.cloud.length; i++) {
            if (this.started) {
                if (this.browsers.cloud[dattrs.cloud[i]]) {
                    this.browsers.cloud[dattrs.cloud[i]].stop();
                }
            } else {
                delete this.attrsToDiscover.cloud[dattrs.cloud[i]];
            }
        }
    }
}

/**
 * mDNS cleanup
 * stops all advertising and browsing
 */
/*
MDNSRegistry.prototype.quit = function() {
    // stop ads
    for (var attr in this.ads) {
        this.ads[attr].stop();
    }

    // stop browsers
    for (var attr in this.browsers.device) {
        this.browsers.device[attr].stop();
    }

    for (var attr in this.browsers.fog) {
        this.browsers.fog[attr].stop();
    }

    for (var attr in this.browsers.cloud) {
        this.browsers.cloud[attr].stop();
    }
}
*/

/* exports */
module.exports = MDNSRegistry;
