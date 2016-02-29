var swig = require('../lib/swig');
var expect = require('expect.js');

describe('Comments', function () {
  it('are ignored and removed from output', function () {
    expect(swig.render('{# some content #}')).to.equal('');
    expect(swig.render('{# \n can have newlines \r\n in whatever type #}')).to.equal('');
    expect(swig.render('{#\n{% extends "layout.twig" %}\n#}')).to.equal('');
  });
});
