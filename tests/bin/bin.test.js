var fs = require('fs'),
  exec = require('child_process').exec,
  expect = require('expect.js'),
  _ = require('lodash'),
  path = require('path'),
  rimraf = require('rimraf'),
  swig = require('../../lib/swig'),
  bin = __dirname + '/../../bin/swig.js',
  casedir = __dirname + '/../cases/',
  bindir = __dirname + '/../bin/';

var n = new swig.Swig(),
  oDefaults = n.options,
  tmp;

function resetOptions() {
  swig.setDefaults(oDefaults);
  swig.invalidateCache();
}

function fixPath(p) {
  p = path.normalize(p);
  return (/[A-Z]\:\\/).test(p) ? '"' + p + '"' : p;
}

bin = fixPath(bin);
tmp = fixPath(__dirname + '/../tmp');

function isTest(f) {
  return (/\.test\.html$/).test(f);
}

function isExpectation(f) {
  return (/\.expectation\.html$/).test(f);
}

function runBin(command, fn) {
  exec('node ' + bin + ' ' + command, fn);
}

var casefiles = fs.readdirSync(casedir),
  tests = _.filter(casefiles, isTest),
  expectations = _.filter(casefiles, isExpectation),
  cases = _.groupBy(tests.concat(expectations), function (f) {
    return f.split('.')[0];
  }),
  keys = _.keys(cases);

describe('bin/swig -v', function () {
  it('shows the version number', function (done) {
    runBin('-v', function (err, stdout, stderr) {
      expect((/^\d+\.\d+\.\d+/).test(stdout)).to.equal(true);
      done();
    });
  });
});

describe('bin/swig render', function () {
  var locals = fixPath(bindir + '/bin.locals.json'),
    key = keys[_.random(keys.length - 1)],
    testcase = cases[key],
    test = fixPath(casedir + _.find(testcase, isTest)),
    expectation = fs.readFileSync(path.normalize(casedir + _.find(testcase, isExpectation)), 'utf8');

  it(key, function (done) {
    runBin('render ' + test + ' -j ' + locals, function (err, stdout, stderr) {
      expect(stdout.replace(/\n$/, '')).to.equal(expectation);
      done();
    });
  });
});

describe('bin/swig compile + run', function () {
  var locals = fixPath(bindir + '/bin.locals.json'),
    key = keys[_.random(keys.length - 1)],
    testcase = cases[key],
    test = _.find(testcase, isTest),
    p = fixPath(casedir + test),
    expectation = fs.readFileSync(path.normalize(casedir + _.find(testcase, isExpectation)), 'utf8');
  rimraf.sync(tmp);
  it(key, function (done) {
    runBin('compile ' + p + ' -j ' + locals + ' -o ' + tmp, function (err, stdout, stderr) {
      var testP = fixPath(__dirname + '/../tmp/' + test),
        binLocals = fixPath(bindir + '/bin.locals.js');
      runBin('run ' + testP + ' -c ' + binLocals, function (err, stdout, stdrr) {
        expect(stdout.replace(/\n$/, '')).to.equal(expectation);
        rimraf.sync(tmp);
        done();
      });
    });
  });
});

describe('bin/swig compile -m', function () {
  it('minifies output', function (done) {
    var p = fixPath(casedir + '/extends_1.test.html');
    runBin('compile ' + p + ' -m', function (err, stdout, stderr) {
      expect(stdout).to.equal('var tpl=function(n,e,i,r,t){var s=(n.extensions,"");return s+="Hi,\\n\\n",s+="This is the body.",s+="\\n\\nSincerely,\\nMe\\n"};\n');
      done();
    });
  });
});

describe('bin/swig compile --method-name="foo"', function () {
  it('sets the method name to "foo"', function (done) {
    var p = fixPath(casedir + '/extends_1.test.html');
    runBin('compile ' + p + ' --method-name="foo"', function (err, stdout, stderr) {
      // Older versions of node compile the template differently than newer version, so either would be a passing test
      var olderOutput = 'var foo = function (_swig,_ctx,_filters,_utils,_fn) {\n  var _ext = _swig.extensions,\n    _output = "";\n_output += "Hi,\\n\\n";\n_output += "This is the body.";\n_output += "\\n\\nSincerely,\\nMe\\n";\n\n  return _output;\n\n};\n',
        newerOutput = 'var foo = function (_swig,_ctx,_filters,_utils,_fn\n/**/) {\n  var _ext = _swig.extensions,\n    _output = "";\n_output += "Hi,\\n\\n";\n_output += "This is the body.";\n_output += "\\n\\nSincerely,\\nMe\\n";\n\n  return _output;\n\n};\n';
      function wasCompiled(check) {
        return check === olderOutput || check === newerOutput;
      }
      expect(wasCompiled(stdout)).to.equal(true);
      done();
    });
  });
});

describe('bin/swig compile & run from swig', function () {
  it('can be run', function (done) {
    var expectation = fs.readFileSync(casedir + '/extends_1.expectation.html', 'utf8'),
      p = fixPath(casedir + '/extends_1.test.html'),
      foo = null;
    runBin('compile ' + p + ' --wrap-start="foo = "', function (err, stdout, stderr) {
      eval(stdout);
      expect(swig.run(foo)).to.equal(expectation);
      done();
    });
  });
});

describe('bin/swig render with custom extensions', function () {
  var locals = fixPath(bindir + '/bin.locals.json');

  it('works with custom filters', function (done) {
    var filters = fixPath(bindir + '/bin.filters.js'),
      p = fixPath(bindir + '/custom_filter.bin.html');

    runBin('render ' + p + ' --filters ' + filters + ' -j ' + locals, function (err, stdout, stderr) {
      expect(stdout).to.equal('I want Nachos please!\n\n');
      done();
    });
  });

  it('works with custom tags', function (done) {
    var tags = fixPath(bindir + '/bin.tags.js'),
      p = fixPath(bindir + '/custom_tag.bin.html');

    runBin('render ' + p + ' --tags ' + tags + ' -j ' + locals, function (err, stdout, stderr) {
      expect(stdout).to.equal('flour tortilla!\n\n');
      done();
    });
  });
});

describe('bin/swig custom options', function () {
  var options = fixPath(__dirname + '/options.js'),
    locals = fixPath(bindir + '/bin.locals.json');

  beforeEach(resetOptions);
  afterEach(resetOptions);

  it('change varControls', function (done) {
    var template = fixPath(bindir + '/custom_varControls.bin.html');

    runBin('render ' + template + ' --options ' + options + ' -j ' + locals, function (err, stdout, stderr) {
      expect(stdout).to.equal('hello world\n\n');
      done();
    });
  });

  it('change tagControls', function (done) {
    var template = fixPath(bindir + '/custom_tagControls.bin.html');

    runBin('render ' + template + ' --options ' + options + ' -j ' + locals, function (err, stdout, stderr) {
      expect(stdout).to.equal('hello world\n\n');
      done();
    });
  });
});

describe('bin/swig output options', function () {
  it('change output to dir that already exists', function (done) {
    var p = fixPath(casedir + '/extends_1.test.html');
    rimraf.sync(tmp);
    fs.mkdirSync(tmp);
    runBin('compile ' + p + ' -o ' + tmp, function (err, stdout, stderr) {
      expect(err).to.be(null);
      done();
    });
  });
});
