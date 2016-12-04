var Random = require('random-js')

var localStorage;

module.exports = new function () {

    this.init = function (fname) {

        // assume './j.conf' if fname is not specified
        if (fname === undefined) 
            fname = './j.conf';

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
        console.log(localStorage);
        return localStorage.getItem(key);
    }

    this.setItem = function (key, value) {
        localStorage.setItem(key, value);
    }
}