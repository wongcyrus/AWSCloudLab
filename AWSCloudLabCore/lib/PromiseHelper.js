"use strict";

class PromiseHelper {

    all(data, func) {
        return new Promise((resolveAll, rejectAll)=> {
            return Promise.all(data.map(func)).then(results => {
                console.log(results);
                resolveAll(results);
            }).catch(err => {
                rejectAll(err);
            });
        });
    }
}
module.exports = PromiseHelper;
