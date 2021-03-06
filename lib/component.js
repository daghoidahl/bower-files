'use strict';

module.exports = Component;

var assert     = require('assert');
var path       = require('path');
var util       = require('util');
var arrify     = require('arrify');
var globby     = require('globby');
var isAbsolute = require('is-absolute');
var isSymlink  = require('is-symlink-sync');
var assign     = require('object-assign');
var readJson   = require('read-json-sync');

function Component(options) {
  if (!(this instanceof Component)) { return new Component(options); }

  options = normalizeOptions(options);

  this.json = readJson(path.resolve(options.dir, options.json));
  this.name = options.isRoot // TODO deprecate 'self' name
    ? 'self'
    : this.json.name || path.basename(options.dir);
  options.overrides = assign({}, this.json.overrides, options.overrides);
  assign(this.json, options.overrides[this.name]);

  this.files = Component.mainFiles(options.dir, this.json.main);

  this.dependencies = getDependencies(this.json.dependencies, options);
  if (options.isRoot) {
    this.devDependencies = getDependencies(this.json.devDependencies, options);
  }

  Object.defineProperties(this, {
    dir: {
      get: util.deprecate(function () {
        return options.dependencyDir;
      }, 'component.dir: access to dir is deprecated')
    },
    path: {
      get: util.deprecate(function () {
        return options.dir;
      }, 'component.path: access to path is deprecated')
    }
  });
}

Component.mainFiles = function mainFiles(dir, mainDef) {
  return globby.sync(arrify(mainDef), {cwd: dir}).map(function (file) {
    return path.resolve(dir, file);
  });
};

Component.prototype = {
  getDependencies: function (options) {
    options = assign({
      self: false,
      dev: false,
      main: true
    }, options);

    var components = [];
    if (options.dev) {
      components = components.concat(this.devDependencies || []);
    }
    if (options.main) {
      components = components.concat(this.dependencies || []);
    }

    var dependencies = components
      .reduce(function (deps, dep) {
        return deps.concat(dep.getDependencies({self: true}));
      }, [])
      .concat(options.self ? this : []);
    var depNames = dependencies.map(function (dep) { return dep.name; });
    return dependencies.filter(function (dep, i) {
      return depNames.indexOf(dep.name) === i;
    });
  }
};

function getDependencies(dependencies, options) {
  dependencies = dependencies || {};
  return Object.keys(dependencies).map(function (key) {
    return new Component(assign({}, options, {
      dir: path.resolve(options.dependencyDir, key),
      isRoot: false
    }));
  });
}

function normalizeOptions(options) {
  options = assign({
    dir: null,
    dependencyDir: null,
    json: 'bower.json',
    componentJson: '.bower.json',
    overrides: {},
    isRoot: false
  }, options);

  assert(
    isAbsolute(options.dir || ''),
    'options.dir must be absolute'
  );

  assert(
    isAbsolute(options.dependencyDir || ''),
    'options.dependencyDir must be absolute'
  );

  options.json = (options.isRoot || isSymlink(options.dir))
    ? options.json
    : options.componentJson;

  return options;
}
