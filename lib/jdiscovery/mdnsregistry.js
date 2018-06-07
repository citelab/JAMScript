var mdns = require('./mdns/lib/mdns'),
    constants = require('../jamserver/constants'),
    Registry = require('./registry');

var sequence = [
    mdns.rst.DNSServiceResolve(),
    'DNSServiceGetAddrInfo' in mdns.dns_sd ?
	mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({families:[0]}),
    mdns.rst.makeAddressesUnique()
];

function MDNSRegistry(app, machType, id, port) {

    Registry.call(this, app, machType, id, port);
    this.protocol = constants.globals.Protocol.MDNS;

    this.ads = {};
    this.attrs = {};

    this.browsers = {
        device: {},
        fog: {},
        cloud: {}
    };
    this.attrsToDiscover = {
        device: {},
        fog: {},
        cloud: {}
    }

    this.started = false;
}

/* MDNSRegistry inherits from Registry */
MDNSRegistry.prototype = Object.create(Registry.prototype);
MDNSRegistry.prototype.constructor = MDNSRegistry;

MDNSRegistry.prototype.registerAndDiscover = function() {

    this.started = true;

    // start any ads and browsers created before this function was called
    for (var attr in this.attrs) {
        if(this.attrs.hasOwnProperty(attr)) {
            const clone = {};
            clone[attr] = this.attrs[attr].data;
            this._createAdvertisements(clone, this.attrs[attr].seqval);
        }
    }
    this.discoverAttributes(this.attrsToDiscover);
}

/* TO HANDLE INTERNALLY TODO
        this.mdnsRegistry.on('ad-error', function(attr, adName, txtRecord) {
            // an ad failed - try again after some time
            setTimeout(self.mdnsRegistry._createAdvertisementWithRetries, constants.mdns.longRetryInterval,
                        self.mdnsRegistry, attr, adName, txtRecord, 0);
        });

        this.mdnsRegistry.on('browser-error', function(attr, type, events) {
            // a browser failed - try again after some time
            if (attr === 'status') {
                setTimeout(self.mdnsRegistry._browseForStatus, constants.mdns.longRetryInterval, self.mdnsRegistry, type, events);
            } else {
                setTimeout(self.mdnsRegistry._browse, constants.mdns.longRetryInterval, self.mdnsRegistry, attr, type, events);
            }
        });
*/

//------------------------------------------------------------------------------
// Advertisement creation
//------------------------------------------------------------------------------

/**
 * Creates advertisements for the provided attributes
 */
MDNSRegistry.prototype._createAdvertisements = function(attrs, dedupeId) {
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
                    payload: attrs[attr](),
                    id: dedupeId
                })
            };
        } else {
            txtRecord = {
                msg: JSON.stringify({
                    payload: attrs[attr],
                    id: dedupeId
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
                self.emit('ad-error', attr, addName, txtRecord);
            } else {
                setTimeout(self._createAdvertisementWithRetries, constants.mdns.retryInterval, self, attr, adName, txtRecord, retries - 1);
            }
            break;
        default:
            logger.log.error('Unhandled service error: ' + err);
            // make sure the ad is stopped
            ad.stop();
            self.emit('ad-error', attr, addName, txtRecord);
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
MDNSRegistry.prototype._browse = function(self, attr, machType, events) {
    var browser = mdns.createBrowser(mdns.tcp(self.app + '-' + machType[0] + '-' + attr),
					{resolverSequence: sequence});

    self.browsers[machType][attr] = browser;

    browser.on('serviceUp', function(service) {
        // ignore our own services
        if (service.name == self.id) {
            return;
        }

        // emit a discovery event!
        const parsedMsg = JSON.parse(service.txtRecord.msg);
        self.emit('discovery', attr, events.onAdd, service.name, parsedMsg.payload, parsedMsg.id);
    });

    browser.on('serviceDown', function(service) {
        self.emit('attr-removed', attr, events.onRemove, service.name);
    });

    browser.on('error', function(err) {
        browser.stop();
        self.emit('browser-error', attr, machType, events);
    });

    browser.start();
}

/**
 * Prep a browser to browse for the status attribute
 */
MDNSRegistry.prototype._browseForStatus = function(self, machType, events) {
    var browser = mdns.createBrowser(mdns.tcp(self.app + '-' + machType[0] + '-status'),
					{resolverSequence: sequence});

    self.browsers[machType].status = browser;

    browser.on('serviceUp', function(service) {
        // ignore our own services
        if (service.name == self.id) {
            return;
        }

        // emit a discovery event!
        const parsedMsg = JSON.parse(service.txtRecord.msg);
        self.emit('discovery', 'status', events.online, service.name, parsedMsg.payload, parsedMsg.id);
    });

    browser.on('serviceDown', function(service) {
        // pass a dedupeId of zero for node down events
        self.emit('discovery', 'status', events.offline, service.name, 'offline', 0);
    });

    browser.on('error', function(err) {
        browser.stop();
        self.emit('browser-error', 'status', machType, events);
    });

    browser.start();
}

//==============================================================================
// Add and discover attributes
//==============================================================================

/**
 * Adds attributes by starting ads.
 * attrs - an object of attributes
 * seqval - the ID to publish with the attributes for deduplication purposes
 *          on the receiving node
 */
MDNSRegistry.prototype.setAttributes = function(attrs, seqval) {
    if (this.started) {
        this._createAdvertisements(attrs, seqval);
    } else {
        for (var attr in attrs)
            if(attrs.hasOwnProperty(attr))
                this.attrs[attr] = { data: attrs[attr], seqval: seqval };
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
        ['device', 'fog', 'cloud'].map(
                x => {
                    for (var attr in dattrs[x])
                        if(dattrs[x].hasOwnProperty(attr))
                            this.attrsToDiscover[x][attr] = dattrs[x][attr];
                }
        );
    }
}

/**
 * Stops making discoveries by stopping browsers
 */
MDNSRegistry.prototype.stopDiscoveringAttributes = function(dattrs) {
    ['device', 'fog', 'cloud'].map(
            x => {
                if (dattrs[x]) {
                    for (var i = 0; i < dattrs[x].length; i++) {
                        if (this.started) {
                            // stop the browser
                            if (this.browsers[x][dattrs[x][i]]) {
                                this.browsers[x][dattrs[x][i]].stop();
                            }
                        } else {
                            delete this.attrsToDiscover[x][dattrs[x][i]];
                        }
                    }
                }
            }
    );
}

/**
 * mDNS cleanup
 * Stop all advertising and browsing
 */
MDNSRegistry.prototype.quit = function() {
    // stop ads
    for (var attr in this.ads) {
        this.ads[attr].stop();
    }

    // stop browsers
    ['device', 'fog', 'cloud'].map(
            x => {
                for (var attr in this.browsers.device)
                    if(this.browsers[x].hasOwnProperty(attr))
                        this.browsers[x][attr].stop();
            }
    );
}

/* exports */
module.exports = MDNSRegistry;
