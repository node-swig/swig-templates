var fs = require('fs')
var exec = require('child_process').exec
var expect = require('expect.js')
var _ = require('lodash')
var path = require('path')
var rimraf = require('rimraf')
var swig = require('../../lib/swig')
var bin = path.resolve(__dirname, '../../bin/swig.js')
var casedir = path.resolve(__dirname, '../cases')
var bindir = path.resolve(__dirname, '../bin')

var n = new swig.Swig()
var oDefaults = n.options
var tmp

function resetOptions () {
  swig.setDefaults(oDefaults)
  swig.invalidateCache()
}

function fixPath (p) {
  p = path.resolve(p)
  return /[A-Z]:\\/.test(p) ? '"' + p + '"' : p
}

bin = fixPath(bin)
tmp = fixPath(path.resolve(__dirname, '../tmp'))

function isTest (f) {
  return /\.test\.html$/.test(f)
}

function isExpectation (f) {
  return /\.expectation\.html$/.test(f)
}

function runBin (command, fn) {
  exec('node ' + bin + ' ' + command, fn)
}

var casefiles = fs.readdirSync(casedir)
var tests = _.filter(casefiles, isTest)
var expectations = _.filter(casefiles, isExpectation)
var cases = _.groupBy(tests.concat(expectations), function (f) {
  return f.split('.')[0]
})
var keys = _.keys(cases)

describe('bin/swig -v', function () {
  it('shows the version number', function (done) {
    runBin('-v', function (err, stdout, stderr) {
      if (err) throw err
      expect(/^\d+\.\d+\.\d+/.test(stdout)).to.equal(true)
      done()
    })
  })
})

describe('bin/swig render', function () {
  var locals = fixPath(path.resolve(bindir, 'bin.locals.json'))
  var key = keys[_.random(keys.length - 1)]
  var testcase = cases[key]
  var test = fixPath(path.resolve(casedir, _.find(testcase, isTest)))
  var expectation = fs.readFileSync(
    path.resolve(casedir, _.find(testcase, isExpectation)),
    'utf8'
  )

  it(key, function (done) {
    runBin('render ' + test + ' -j ' + locals, function (err, stdout, stderr) {
      if (err) throw err
      expect(stdout.replace(/\n$/, '')).to.equal(expectation)
      done()
    })
  })
})

describe('bin/swig compile + run', function () {
  var locals = fixPath(path.resolve(bindir, 'bin.locals.json'))
  var key = keys[_.random(keys.length - 1)]
  var testcase = cases[key]
  var test = _.find(testcase, isTest)
  var p = fixPath(path.resolve(casedir, test))
  var expectation = fs.readFileSync(
    path.resolve(casedir, _.find(testcase, isExpectation)),
    'utf8'
  )
  rimraf.sync(tmp)
  it(key, function (done) {
    runBin('compile ' + p + ' -j ' + locals + ' -o ' + tmp, function (
      err,
      stdout,
      stderr
    ) {
      if (err) throw err
      var testP = fixPath(path.resolve(__dirname, '../tmp', test))
      var binLocals = fixPath(path.resolve(bindir, 'bin.locals.js'))
      runBin('run ' + testP + ' -c ' + binLocals, function (err, stdout, stdrr) {
        if (err) throw err
        expect(stdout.replace(/\n$/, '')).to.equal(expectation)
        rimraf.sync(tmp)
        done()
      })
    })
  })
})

describe('bin/swig compile -m', function () {
  it('minifies output', function (done) {
    var p = fixPath(casedir + '/extends_1.test.html')
    runBin('compile ' + p + ' -m', function (err, stdout, stderr) {
      if (err) throw err
      expect(stdout).to.equal(
        'var tpl=function(n,e,i,r,t){var s=(n.extensions,"");return s+="Hi,\\n\\n",s+="This is the body.",s+="\\n\\nSincerely,\\nMe\\n"};\n'
      )
      done()
    })
  })
})

describe('bin/swig compile --method-name="foo"', function () {
  it('sets the method name to "foo"', function (done) {
    var p = fixPath(casedir + '/extends_1.test.html')
    runBin('compile ' + p + ' --method-name="foo"', function (
      err,
      stdout,
      stderr
    ) {
      if (err) throw err
      // Older versions of node compile the template differently than newer version, so either would be a passing test
      var newerOutput =
        'var foo = function (_swig,_ctx,_filters,_utils,_fn\n/**/) {\n  var _ext = _swig.extensions,\n    _output = "";\n_output += "Hi,\\n\\n";\n_output += "This is the body.";\n_output += "\\n\\nSincerely,\\nMe\\n";\n\n  return _output;\n\n};\n'
      var scrubbed8Output =
        'var foo = function (_swig,_ctx,_filters,_utils,_fn /*``*/) { var _ext = _swig.extensions, _output = ""; _output += "Hi,\\n\\n"; _output += "This is the body."; _output += "\\n\\nSincerely,\\nMe\\n"; return _output; };'
      var scrubbed10Output =
        'var foo = function (_swig,_ctx,_filters,_utils,_fn ) { var _ext = _swig.extensions, _output = ""; _output += "Hi,\\n\\n"; _output += "This is the body."; _output += "\\n\\nSincerely,\\nMe\\n"; return _output; };'
      var scrub = function (str) {
        return str
          .split('\n')
          .map(function (part) {
            return part.trim()
          })
          .filter(function (part) {
            return !!part
          })
          .join(' ')
      }
      function wasCompiled (check) {
        var scrubbed = scrub(check)
        return (
          check === newerOutput ||
          scrubbed === scrubbed8Output ||
          scrubbed === scrubbed10Output
        )
      }
      expect(wasCompiled(stdout)).to.equal(true)
      done()
    })
  })
})

describe('bin/swig compile & run from swig', function () {
  it('can be run', function (done) {
    var expectation = fs.readFileSync(
      casedir + '/extends_1.expectation.html',
      'utf8'
    )
    var p = fixPath(casedir + '/extends_1.test.html')
    var foo = null
    runBin('compile ' + p + ' --wrap-start="foo = "', function (
      err,
      stdout,
      stderr
    ) {
      if (err) throw err
      eval(stdout) // eslint-disable-line
      expect(swig.run(foo)).to.equal(expectation)
      done()
    })
  })
})

describe('bin/swig render with custom extensions', function () {
  var locals = fixPath(bindir + '/bin.locals.json')

  it('works with custom filters', function (done) {
    var filters = fixPath(bindir + '/bin.filters.js')
    var p = fixPath(bindir + '/custom_filter.bin.html')

    runBin('render ' + p + ' --filters ' + filters + ' -j ' + locals, function (
      err,
      stdout,
      stderr
    ) {
      if (err) throw err
      expect(stdout).to.equal('I want Nachos please!\n\n')
      done()
    })
  })

  it('works with custom tags', function (done) {
    var tags = fixPath(bindir + '/bin.tags.js')
    var p = fixPath(bindir + '/custom_tag.bin.html')

    runBin('render ' + p + ' --tags ' + tags + ' -j ' + locals, function (
      err,
      stdout,
      stderr
    ) {
      if (err) throw err
      expect(stdout).to.equal('flour tortilla!\n\n')
      done()
    })
  })
})

describe('bin/swig custom options', function () {
  var options = fixPath(path.join(__dirname, '/options.js'))
  var locals = fixPath(bindir + '/bin.locals.json')

  beforeEach(resetOptions)
  afterEach(resetOptions)

  it('change varControls', function (done) {
    var template = fixPath(bindir + '/custom_varControls.bin.html')

    runBin(
      'render ' + template + ' --options ' + options + ' -j ' + locals,
      function (err, stdout, stderr) {
        if (err) throw err
        expect(stdout).to.equal('hello world\n\n')
        done()
      }
    )
  })

  it('change tagControls', function (done) {
    var template = fixPath(bindir + '/custom_tagControls.bin.html')

    runBin(
      'render ' + template + ' --options ' + options + ' -j ' + locals,
      function (err, stdout, stderr) {
        if (err) throw err
        expect(stdout).to.equal('hello world\n\n')
        done()
      }
    )
  })
})

describe('bin/swig output options', function () {
  it('change output to dir that already exists', function (done) {
    var p = fixPath(path.resolve(casedir, 'extends_1.test.html'))
    rimraf.sync(tmp)
    fs.mkdirSync(tmp)
    runBin('compile ' + p + ' -o ' + tmp, function (err, stdout, stderr) {
      expect(err).to.be(null)
      done()
    })
  })
})
