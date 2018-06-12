var mdns = require('./mdns/lib/mdns'),
    constants = require('../jamserver/constants'),
    Registry = require('./registry');

var sequence = [
    mdns.rst.DNSServiceResolve(),
    'DNSServiceGetAddrInfo' in mdns.dns_sd ?
	mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({families:[0]}),
    mdns.rst.makeAddressesUnique()
];

function MDNSRegistry(app, type, id, port) {

    Registry.call(this, app, type, id, port);
    this.protocol = constants.globals.Protocol.MDNS;

    this.ads = {};
    this.attrsToAdvertise = {};

    this.browsers = {
        device: {},
        fog: {},
        cloud: {}
    };
    this.attrsToBrowse = {
        device: {},
        fog: {},
        cloud: {}
    }

    this.started = false;
}

/* MDNSRegistry inherits from Registry */
MDNSRegistry.prototype = Object.create(Registry.prototype);
MDNSRegistry.prototype.constructor = MDNSRegistry;


/**
 * REGISTRY INTERFACE METHODS
 */

/**
 * Start mDNS registry
 */
MDNSRegistry.prototype.registerAndDiscover = function() {

    if(this.started)
        return;
    this.started = true;
}
/**
 * Sets attributes by starting ads or modifying them.
 * attrs - an object of attributes
 * seqval - the ID to publish with the attributes for deduplication purposes
 *          on the receiving node
 */
MDNSRegistry.prototype.setAttributes = function(attrs, seqval) {
    console.log('mDNS-reg: called setAttributes');
    if (this.started) {
        this._createAdvertisements(attrs, seqval);
    } else {
        let self = this;
        setTimeout(self.setAttributes.bind(self), 
            constants.mdns.retryInterval,
            attrs, seqval);
    }
}
/**
 * Removes attributes by stopping the advertisements
 */
MDNSRegistry.prototype.removeAttributes = function(attrs, seqval) {
    for (var attr in attrs) {
        if (attrs.hasOwnProperty(attr)) {
            if (this.attrsToAdvertise[attr] && this.ads[attr]) {
                this.ads[attr].stop();
                delete this.attrsToAdvertise[attr];
                delete this.ads[attr];
            }
        }
    }
}
/**
 * Discovers attributes by starting browsers
 */
MDNSRegistry.prototype.discoverAttributes = function(dattrs) {
    if (this.started) {
        ['device', 'fog', 'cloud'].map(
            (x) => {
                for (var attr in dattrs[x]) {
                    if(dattrs[x].hasOwnProperty(attr)) {
                        if (!this.browsers[x][attr]) {
                            this.attrsToBrowse[x][attr] = dattrs[x][attr];
                            this._createBrowser(attr,
                                constants.globals.NodeType[x.toUpperCase()]);
                        }
                    }
                }
            }
        );
    } else {
        let self = this;
        setTimeout(self.discoverAttributes.bind(self), 
            constants.mdns.retryInterval,
            dattrs);
    }
}
/**
 * Stops making discoveries by stopping browsers
 */
MDNSRegistry.prototype.stopDiscoveringAttributes = function(dattrs) {
    ['device', 'fog', 'cloud'].map(
        x => {
            if (dattrs[x]) {
                for(var attr in dattrs[x]) {
                    if (dattrs[x].hasOwnProperty(attr)) {
                        if (this.attrsToBrowse[x][attr] && this.browsers[x][attr]) {
                            this.browsers[x][attr].stop();
                            delete this.attrsToBrowse[x][attr];
                            delete this.browsers[x][attr];
                        }
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
        if(this.ads.hasOwnProperty(attr)) {
            this.ads[attr].stop();
        }
    }
    // stop browsers
    ['device', 'fog', 'cloud'].map(
            (x) => {
                for (var attr in this.browsers[x])
                    if(this.browsers[x].hasOwnProperty(attr))
                        this.browsers[x][attr].stop();
            }
    );
}

/**
 * _PRIVATE HELPERS
 */

/**
 * Creates advertisements for the provided attributes
 */
MDNSRegistry.prototype._createAdvertisements = function(attrs, seqval) {
    console.log('mDNS-reg: _createAdvs called, this:', JSON.stringify(this));
    for (var attr in attrs) {
        if (attrs.hasOwnProperty(attr)) {
            // Update data structures
            this.attrsToAdvertise[attr] = attrs[attr];
            if (this.ads[attr]) {
                this.ads[attr].stop();
                delete this.ads[attr];
            }
            // Create adv formatted info
            let name = this.app + '-' + this.type + '-' + attr;
            let txtRecord = {
                data: JSON.stringify(attrs[attr]),
                seqval: seqval
            };
            this.ads[attr] = mdns.createAdvertisement(
                mdns.tcp(name), 
                this.port, 
                {name: this.id, txtRecord: txtRecord});
            console.log('Starting adv', JSON.stringify(txtRecord));
            this.ads[attr].start();
        }
    }
}
/**
 * Prep a browser to browse for an attibute
 */
MDNSRegistry.prototype._createBrowser = function(attr, type) {

    let browser = mdns.createBrowser(
                    mdns.tcp(this.app + '-' + type + '-' + attr),
					{resolverSequence: sequence});
    this.browsers[type][attr] = browser;

    var self = this;
    browser.on('serviceUp', function(service) {
        // DEBUG
        console.log("Service discovered: ", JSON.stringify(service));

        // ignore our own services
        if (service.name == self.id) {
            return;
        }
        // emit a discovery event!
        self.emit('discovery', attr,
            (attr == 'status')
                ? self.attrsToBrowse[type][attr].online
                : self.attrsToBrowse[type][attr].onAdd,
            service.name,
            JSON.parse(service.txtRecord.data),
            service.txtRecord.seqval);
    });
    browser.on('serviceDown', function(service) {
        // DEBUG
        console.log("Service lost: ", JSON.stringify(service));

        if(attr == 'status') {
            self.emit('discovery', attr,
                self.attrsToBrowse[type][attr].offline,
                service.name, 'offline', undefined);
        } else {
            // Since we don't have seqvals for attr-removed
            // messages with mdns, use -1 as a special signal
            // to jregistar
            self.emit('attr-removed', attr,
                self.attrsToBrowse[type][attr].onRemove,
                service.name, -1);
        }
    });
    browser.on('error', function(err) {
        browser.stop();
        self.emit('error', undefined);
    });

    browser.start();
}

/* exports */
module.exports = MDNSRegistry;
