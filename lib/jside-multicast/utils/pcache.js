const PConstants = require('../utils/constants').PCache;
 
class PCache {
    constructor() {
        if (PCache.this)
            return PCache.this;
        PCache.this = this;
        this.predCache = new Map();
    }

    put(fname, params, rflag, res) {
        let eresults = {params: params, results: res, timestamp: Date.now()};
        let pentry = this.predCache.get(fname);
        if (pentry === undefined) 
            predCache.put(fname, {fn_name: fname, rflag: rflag, eresults: [ eresults ] });
        else {
            pentry.eresults.push(results);
            if (pentry.eresults.length > PConstants.CacheSize)
                pentry.eresults.shift();
        }
    }

    get(fname, params) {
        let pentry = this.predCache.get(fname)
        if (pentry === undefined) 
            return undefined;
        else {
            let eres = pentry.eresult[pentry.eresult.length - 1];
            let dist = __distance(params, eres.params)
            if dist < 1 && (Date.now() - pentry.timestamp) < PConstants.maxAge
                return {res: eres.results, prob: (1 - dist)}
        }
    }
}

module.exports = PCache;