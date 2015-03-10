'use strict';

var path         = require('path'),
    fs           = require('fs'),
    Q            = require('q'),
    ncp          = require('ncp'),
    defaults     = require('lodash.defaults'),
    flatten      = require('lodash.flatten'),
    childProcess = require('child_process');

/**
 * Create an instance based with the given parameter defaults.
 * Since this method is not exposed to the user we can rely on <code>base</code> to be correctly formed with array
 * properties.
 * @param {object} [base] Optional default set of parameters to merge
 * @returns {{create: create, reset: reset, withDirectories: withDirectories forProgram: forProgram,
 *          addSource: addSource, withSourceFilter: withSourceFilter, addExpectation: addExpectation,
 *          addInvocation: addInvocation, run: run}} A new instance
 */
function factory(base) {

  // initialise parameters
  var params;
  reset();

  // compose instance
  var self = {
    create           : create,
    reset            : reset,
    seal             : seal,
    withDirectories  : withDirectories,
    forProgram       : forProgram,
    addSource        : addSource,
    withSourceFilter : withSourceFilter,
    addExpectation   : addExpectation,
    addInvocation    : addInvocation,
    run              : run
  };
  return self;

  /**
   * Create a new instance with a separate set of properties
   * @returns {Object}
   */
  function create() {
    return factory(params);
  }

  /**
   * Reset the instance parameters but leave its defaults unchanged
   * @returns {object} The same instance with mutated properties
   */
  function reset() {
    params = defaults({}, base || {
      directories : {},
      sources     : [],
      filter      : /.*/,
      program     : null,
      expectations: [],
      invocations : []
    });
    return self;
  }

  /**
   * Get a copy of the instance that cannot be mutated
   * @returns {{create: create}}
   */
  function seal() {
    return {
      create: create
    }
  }

  /**
   * Set the directories that will be used
   * @param {string} source The directory that contains sources
   * @param {string} temp The directory that will be used as the temp directory
   * @returns {object} The same instance with mutated properties
   */
  function withDirectories(source, temp) {
    params.directories.source = source;
    params.directories.temp   = temp;
    return self;
  }

  /**
   * Set the program that will be run
   * @param {string} program The program name
   * @returns {object} The same instance with mutated properties
   */
  function forProgram(program) {
    params.program = program;
    return self;
  }

  /**
   * Add the given source directory
   * @param {string} source The simple name of a directory in the <code>expected</code> folder
   * @returns {object} The same instance with mutated properties
   */
  function addSource(source) {
    params.sources.push(source);
    return self;
  }

  /**
   * Set the filter to control which source files are copied to the working directory
   * @param {RegExp} regexp A test or a function that tests a given directory path
   * @returns {object} The same instance with mutated properties
   */
  function withSourceFilter(regexp) {
    params.filter = regexp;
    return self;
  }

  /**
   * Add the given expectation
   * @param {function} expectation A function with jasmine expectations
   * @returns {object} The same instance with mutated properties
   */
  function addExpectation(expectation) {
    params.expectations.push(expectation);
    return self;
  }

  /**
   * Add the given parameter set as a test case
   * @param {...string} parameters Any number of arguments for the command line
   * @returns {object} The same instance with mutated properties
   */
  function addInvocation() {
    var args = flatten(Array.prototype.slice.call(arguments));
    params.invocations.push(args);
    return self;
  }

  /**
   * Execute the parameters encoded in the current instance as a test
   * @returns {promise} A promise that resolves when all tests complete
   */
  function run() {
    var promises    = [];
    var resolveSrc  = ensureDirectory(params.directories.source);
    var resolveDest = ensureDirectory(params.directories.temp);
    var sources     = (params.sources.length == 0) ? [null] : params.sources;
    sources.forEach(function eachSource(source) {
      params.invocations.forEach(function eachInvocation(cliArgs) {
        var signature     = escapeFilenameString(source, cliArgs);
        var destDirectory = resolveDest(signature);
        var deferred      = Q.defer();
        copySources(resolveSrc(source), destDirectory, function(error) {
          if (error) {
            deferred.reject(error)
          } else {
            var command = [params.program].concat(cliArgs).join(' ');
            childProcess.exec(command, {cwd: destDirectory}, function(error, stdout, stderr) {
              var message = error ? error.message : stderr;
              if (message) {
                deferred.reject(message);
              } else {
                deferred.resolve(destDirectory);
              }
            });
          }
        });
        promises.push(deferred.promise);
      })
    });
    return (promises.length == 1) ? promises[0] : Q.all(promises);
  }
}

/**
 * Flatten the given parameters as a single string suitable for file names
 * @param {...string|Array} Any number of strings or arrays thereof
 * @returns {string} A dot delimited string
 */
function escapeFilenameString() {
  return flatten(Array.prototype.slice.call(arguments))
    .filter(Boolean)
    .join('.')
    .replace(/["']/g, '')                                                                     // omit quotes
    .replace(/[^ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-]+/g, '.');  // change illegal chars
}

function copySources(src, dest, callback) {
  if (src) {
    ncp(src, dest, {filter: params.filter}, callback)
  } else {
    ensureDirectory(dest);
    callback();
  }
}

/**
 * Ensure that that given directory exists relative to the project directory
 * @param {...string} elements Any number of path elements relative to the project directory
 * @returns {function} A resolver that encapsulates the given directory
 */
function ensureDirectory() {

  // get a method that will path.resolve() against a base directory
  function getResolver(base) {
    return function() {
      var args = flatten(Array.prototype.slice.call(arguments));
      if (args.every(Boolean)) {
        return path.resolve.apply(path, [base].concat(args));
      } else {
        return null;
      }
    }
  }

  // find the project directory based on the package json
  var projectDir = __dirname;
  while (!fs.existsSync(path.join(projectDir, 'package.json'))) {
    projectDir = path.resolve(projectDir, '..');
  }

  // resolve the given directory path and make the directory if it does not exist
  var args     = Array.prototype.slice.call(arguments);
  var resolved = getResolver(projectDir)(args);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved);
  }

  // return the resolver
  return getResolver(resolved);
}

module.exports = {
  create: function() {
    return factory();
  }
};