/**
 * utils.js
 */

const Immutable = require('immutable');
const { Iterable } = Immutable;

module.exports = {
    valToPath,
    newPath,
    listToKeyPath
};

function valToPath(val) {
    return Array.isArray(val) ? val :
        Iterable.isIterable(val) ? val.toArray() :
        [val];
}

function newPath(head, tail) {
    return head.concat(listToKeyPath(tail));
}

function listToKeyPath(list) {
    return Array.isArray(list) ? list : Immutable.Iterable(list).toArray();
}
