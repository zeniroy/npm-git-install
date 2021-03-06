var chdir, cp, cwd, discover, exec, fs, mktmp, reinstall, reinstall_all, resolve, save, temp,
  slice = [].slice;

cp = require('child_process');

temp = require('temp');

fs = require('fs');

resolve = require('path').resolve;

cwd = process.cwd, chdir = process.chdir;

exec = function(cmd, options) {
  return new Promise(function(resolve, reject) {
    var args, child, ref;
    ref = cmd.split(' '), cmd = ref[0], args = 2 <= ref.length ? slice.call(ref, 1) : [];
    child = cp.spawn(cmd, args, options);
    return child.on('close', function(code) {
      if (code === 0) {
        return resolve(code);
      } else {
        return reject(code);
      }
    });
  });
};

mktmp = function(prefix) {
  return new Promise(function(resolve, reject) {
    return temp.mkdir(prefix, function(error, path) {
      if (error) {
        return reject(error);
      }
      return resolve(path);
    });
  });
};

reinstall = function(options, pkg) {
  var curried, silent, verbose;
  if (options == null) {
    options = {};
  }
  silent = options.silent, verbose = options.verbose;
  curried = function(arg) {
    var revision, stdio, tmp, url;
    url = arg.url, revision = arg.revision;
    temp.track();
    tmp = null;
    stdio = ['pipe', silent ? 'pipe' : process.stdout, process.stderr];
    return mktmp('npm-git-').then(function(path) {
      var cmd;
      tmp = path;
      cmd = "git clone " + url + " " + tmp;
      if (verbose) {
        console.log("Cloning '" + url + "' into " + tmp);
      }
      return exec(cmd, {
        stdio: stdio
      });
    }).then(function() {
      var cmd;
      cmd = "git checkout " + revision;
      if (verbose) {
        console.log("Checking out " + revision);
      }
      return exec(cmd, {
        cwd: tmp,
        stdio: stdio
      });
    }).then(function() {
      var cmd, isWin;
      isWin = /^win/.test(process.platform);
      if (isWin) {
        cmd = "npm.cmd install";
      } else {
        cmd = "npm install";
      }
      if (verbose) {
        console.log("executing `" + cmd + "` in `" + tmp + "`");
      }
      return exec(cmd, {
        cwd: tmp,
        stdio: stdio
      });
    }).then(function() {
      var cmd, name, sha;
      cmd = "git show --format=format:%h --no-patch";
      if (verbose) {
        console.log("executing `" + cmd + "` in `" + tmp + "`");
      }
      sha = cp.execSync(cmd, {
        cwd: tmp
      }).toString("utf-8").trim();
      if (verbose) {
        console.log("reading package name from " + tmp + "/package.json");
      }
      name = require(tmp + "/package.json").name;
      return {
        name: name,
        url: url,
        sha: sha
      };
    }).then(function(metadata) {
      var cmd, isWin;
      isWin = /^win/.test(process.platform);
      if (isWin) {
        cmd = "npm.cmd install " + tmp;
      } else {
        cmd = "npm install " + tmp;
      }
      if (verbose) {
        console.log("executing " + cmd);
      }
      exec(cmd, {
        stdio: stdio
      });
      return metadata;
    });
  };
  if (pkg) {
    return curried(pkg);
  } else {
    return curried;
  }
};

discover = function(package_json) {
  var gitDependencies, name, results, url;
  if (package_json == null) {
    package_json = '../package.json';
  }
  package_json = resolve(package_json);
  delete require.cache[package_json];
  gitDependencies = require(package_json).gitDependencies;
  results = [];
  for (name in gitDependencies) {
    url = gitDependencies[name];
    results.push(url);
  }
  return results;
};

save = function(file, report) {
  var fn, i, len, name, pkg, ref, sha, url;
  if (file == null) {
    file = '../package.json';
  }
  file = resolve(file);
  delete require.cache[file];
  pkg = require(file);
  if (pkg.gitDependencies == null) {
    pkg.gitDependencies = {};
  }
  fn = function(name, url, sha) {
    return pkg.gitDependencies[name] = url + "#" + sha;
  };
  for (i = 0, len = report.length; i < len; i++) {
    ref = report[i], name = ref.name, url = ref.url, sha = ref.sha;
    fn(name, url, sha);
  }
  return fs.writeFileSync(file, JSON.stringify(pkg, null, 2));
};


/*

As seen on http://pouchdb.com/2015/05/18/we-have-a-problem-with-promises.html
 */

reinstall_all = function(options, packages) {
  var curried;
  if (options == null) {
    options = {};
  }
  curried = function(packages) {
    var factories, factory, i, len, sequence;
    factories = packages.map(function(url) {
      var ref, revision, whole;
      ref = url.match(/^(.+?)(?:\#(.+))?$/), whole = ref[0], url = ref[1], revision = ref[2];
      if (revision == null) {
        revision = 'master';
      }
      return function(memo) {
        return Promise.resolve(reinstall(options, {
          url: url,
          revision: revision
        })).then(function(metadata) {
          return memo.concat(metadata);
        });
      };
    });
    sequence = Promise.resolve([]);
    for (i = 0, len = factories.length; i < len; i++) {
      factory = factories[i];
      sequence = sequence.then(factory);
    }
    return sequence;
  };
  if (packages) {
    return curried(packages);
  } else {
    return curried;
  }
};

module.exports = {
  discover: discover,
  reinstall: reinstall,
  reinstall_all: reinstall_all,
  save: save
};

//# sourceMappingURL=index.js.map
