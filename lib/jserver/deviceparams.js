var Random = require('random-js')

var localStorage;

module.exports = new function () {

    this.init = function (fname) {

        // We at least get ./j.conf as default.

        // Open local storage
        if (typeof localStorage === "undefined" || localStorage === null) {

            var LocalStorage = require('node-localstorage').LocalStorage;
            localStorage = new LocalStorage(fname);
        }

        if (localStorage.getItem('deviceId') === null) {
            var random = new Random(Random.engines.mt19937().autoSeed());
            localStorage.setItem('deviceId', random.uuid4());
        }
    }

    this.getItem = function (key) {
        return localStorage.getItem(key);
    }

    this.setItem = function (key, value) {
        localStorage.setItem(key, value);
    }
}