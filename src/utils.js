/**
 * utils.js
 */

const Immutable = require('immutable');
const { Iterable } = Immutable;

module.exports = {
    valToKeyPath,
    newKeyPath,
    listToKeyPath
};

function valToKeyPath(val) {
    return Array.isArray(val) ? val :
        Iterable.isIterable(val) ? val.toArray() :
        [val];
}

function newKeyPath(head, tail) {
    return head.concat(listToKeyPath(tail));
}

function listToKeyPath(list) {
    return Array.isArray(list) ? list : Immutable.Iterable(list).toArray();
}
