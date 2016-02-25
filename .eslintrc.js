module.exports = {
    "extends": "eslint:recommended",
    "env": {
        "node": true,
        "commonjs": true,
        "mocha": true,
        "es6": true
    },
    "rules": {
        "no-unused-vars": [2, {"vars": "local", "args": "none"}]
    }
};
