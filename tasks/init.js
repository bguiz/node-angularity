'use strict';

var gulp        = require('gulp'),
    gutil       = require('gulp-util'),
    wordwrap    = require('wordwrap'),
    runSequence = require('run-sequence'),
    path        = require('path'),
    fs          = require('fs'),
    template    = require('lodash.template'),
    merge       = require('lodash.merge');

var defaults = require('../lib/config/defaults'),
    platform = require('../lib/config/platform'),
    yargs    = require('../lib/util/yargs'),
    hr       = require('../lib/util/hr'),
    streams  = require('../lib/config/streams');

var TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'angularity');
var IDE_LIST      = ['webstorm'];  // each of these needs to be a gulp-task in its own right
var MASTER_LIST   = ['angularity', 'npm', 'bower'];

var cliArgs;

var config = defaults.getInstance('init')
  .file(platform.userHomeDirectory(), '.angularity')
  .defaults({
    name       : 'my-project',
    version    : '0.0.0',
    description: '',
    tag        : [ ],
    port       : 'random',
    master     : 'angularity.json',
    npm        : true,
    bower      : true,
    karma      : true,
    jshint     : true,
    gitignore  : true,
    ide        : 'none'
  });

var check = yargs.createCheck()
  .withGate(function (argv) {
    return !argv.help;
  })
  .withTest({
    name: function(value) {
      if (typeof value !== 'string') {
        return 'name must be a string';
      } else if (value.length === 0) {
        return 'name must not be zero length';
      }
    },
    version: function(value) {
      if (typeof value !== 'string') {
        return 'version must be a valid string';
      } else if (!/\d+\.\d+\.\d+[-\w\d]*/.test(value)) {
        return 'version must be 3-term semver string';
      }
    },
    description: function (value) {
      if (typeof value !== 'string') {
        return 'description must be a string';
      }
    },
    tag: function(value) {
      [ ].concat(value).forEach(function (value) {
        if (typeof value !== 'string') {
          return 'tag must be a valid string';
        } else if (value.length === 0) {
          return 'name must not be zero length';
        }
      });
    },
    port: function (value) {
      switch (typeof value) {
        case 'number':
          if (isNaN(parseInt(value))) {
            return 'port must be integer';
          }
          break;
        case 'string':
          if (value === 'random') break;
        default:
          return 'port must be an integer or the keyword "random"';
      }
    },
    npm : function (value) {
      if (typeof value !== 'boolean') {
        return 'bower must be a boolean';
      }
    },
    karma : function (value) {
      if (typeof value !== 'boolean') {
        return 'karma must be a boolean';
      }
    },
    jshint : function (value) {
      if (typeof value !== 'boolean') {
        return 'jshint must be a boolean';
      }
    },
    gitignore : function (value) {
      if (typeof value !== 'boolean') {
        return 'gitignore must be a boolean';
      }
    },
    ide : function (value) {
      [ ].concat(value).forEach(function (value) {
        if (typeof value !== 'string') {
          return 'ide must be a string';
        } else if ((['none'].concat(IDE_LIST).indexOf(value) >= 0)) {
          return 'value must be "none" or one or more values in ' + IDE_LIST.join('|');
        }
      });
    },
    master: function (value) {
      if (typeof value !== 'string') {
        return 'ide must be a string';
      } else if ((['none'].concat(MASTER_LIST).indexOf(value) >= 0)) {
        return 'value must be "none" or any one value in ' + MASTER_LIST.join('|');
      }
    }
  })
  .commit();

yargs.getInstance('init')
  .usage(wordwrap(2, 80)([
    'The "init" task initialises a blank project and optionally an IDE environment. The given options initialise ' +
    'project defaults. Where omitted the global default will be in effect for the project.',
    '',
    'The following steps are taken. Where a step is gated by a flag it is stated as "--flag". Defaults may be ' +
    'globally defined or reset using the --defaults option.',
    '',
    '* project directory     exists, else create    --subdir',
    '* /' + padded(20)(streams.APP            ) + ' exists, else create',
    '* /' + padded(20)(streams.APP + '/*.html') + ' exists, else create',
    '* /' + padded(20)(streams.APP + '/*.scss') + ' exists, else create',
    '* angularity.json       exists, else create',
    '* package.json          exists, else create    --npm',
    '* bower.json            exists, else create    --bower',
    '* karma.conf.js         exists, else create    --karma',
    '* .jshintrc             exists, else create    --jshint',
    '* .gitignore            exists, else create    --gitignore',
    '* initialise and launch an IDE                 --ide',
    '',
    'Notes:',
    '',
    '* No properties are set in existing files, delete existing files in order to change properties.',
    '* Both the npm and bower packages are initially set private which you will need to clear in order to publish.',
    '* Any given IDE is initialised per its task defaults. Use the task separately to review these options.'
  ].join('\n')))
  .example('$0 init -n todo -i webstorm', 'Create "todo" and initialise webstorm')
  .example('$0 init --defaults -n pending', 'Change the name default to "pending')
  .example('$0 init --defaults reset', 'Reset defaults')
  .options('help', {
    describe: 'This help message',
    alias   : [ 'h', '?' ],
    boolean : true
  })
  .options('defaults', {
    describe: 'Set defaults',
    alias   : 'z',
    string  : true
  })
  .options('subdir', {
    describe: 'Create a sub-directory per name',
    alias   : 's',
    boolean : true,
    default : config.get('subdir')
  })
  .options('name', {
    describe: 'The project name',
    alias   : 'n',
    string  : true,
    default : config.get('name')
  })
  .options('version', {
    describe: 'The project version',
    alias   : 'v',
    string  : true,
    default : config.get('version')
  })
  .options('description', {
    describe: 'The project description',
    alias   : 'd',
    string  : true,
    default : config.get('description')
  })
  .options('tag', {
    describe: 'A project tag',
    alias   : 't',
    string  : true,
    default : config.get('tag')
  })
  .options('port', {
    describe: 'A port for the development web server',
    alias   : 'p',
    default : config.get('port')
  })
  .options('master', {
    describe: 'Project properties master',
    alias   : 'm',
    string  : true,
    default : config.get('master')
  })
  .options('npm', {
    describe: 'Create package.json',
    boolean : true,
    default : config.get('npm')
  })
  .options('bower', {
    describe: 'Create bower.json',
    boolean : true,
    default : config.get('bower')
  })
  .options('karma', {
    describe: 'Create karma.conf.js',
    boolean : true,
    default : config.get('karma')
  })
  .options('jshint', {
    describe: 'Create .jshintrc',
    boolean : true,
    default : config.get('jshint')
  })
  .options('gitignore', {
    describe: 'Create .gitignore',
    boolean : true,
    default : config.get('gitignore')
  })
  .options('ide', {
    describe: 'Initialise IDE ' + IDE_LIST.join('|'),
    boolean : true,
    default : config.get('ide')
  })
  .strict()
  .check(yargs.subCommandCheck)
  .check(check)
  .wrap(80);

gulp.task('init', function (done) {
  console.log(hr('-', 80, 'init'));
  cliArgs = cliArgs || yargs.resolveArgv();

  // set defaults
  if (cliArgs.defaults) {
    ((cliArgs.defaults === 'reset') ? config.revert() : config.set(cliArgs))
      .changeList()
      .forEach(function (key) {
        gutil.log('default ' + key + ': ' + JSON.stringify(config.get(key)));
      });
    gutil.log('wrote file ' + config.commit());
  }

  // else run the selected items
  else {
    var ideList = []
      .concat(cliArgs.ide)   // yargs will supply multiple arguments if multiple flags are used
      .filter(function (ide) {
        return (IDE_LIST.indexOf(ide) >= 0);
      });
    var taskList = [
        cliArgs.subdir && 'init:subdir',
        'init:composition',
        'init:angularity',
        cliArgs.npm && 'init:npm',
        cliArgs.bower && 'init:bower',
        cliArgs.bower && 'init:bower',
        cliArgs.karma && 'init:karma',
        cliArgs.jshint && 'init:jshint',
        cliArgs.gitignore && 'init:gitignore'
      ]
      .concat(ideList)
      .filter(Boolean)
      .concat(done);
    runSequence.apply(runSequence, taskList);
  }
});

gulp.task('init:subdir', function () {
  mkdirIfNotExisting(cliArgs.name);
  process.chdir(path.resolve(cliArgs.name));  // !! changing cwd !!
});

gulp.task('init:composition', function () {
  mkdirIfNotExisting(streams.APP);
  ['html', 'js', 'scss']
    .forEach(function eachExt(ext) {
      if (!anyFileOfType(ext, streams.APP)) {
        writeTemplate('index.' + ext, streams.APP);
      }
    });
});

gulp.task('init:angularity', function () {
  writeTemplate('angularity.json');
});

gulp.task('init:npm', function () {
  writeTemplate('package.json');
});

gulp.task('init:bower', function () {
  writeTemplate('bower.json');
});

gulp.task('init:karma', function () {
  writeTemplate('karma.conf.js');
});

gulp.task('init:jshint', function () {
  writeTemplate('.jshintrc');
});

gulp.task('init:gitignore', function () {
  writeTemplate('.gitignore');
});

function padded(length) {
  return function(text) {
    return (text + (new Array(length)).join(' ')).slice(0, length);
  }
}

function mkdirIfNotExisting(projectRelativePath) {
  var absolute = path.resolve(projectRelativePath);
  var exists   = fs.existsSync(absolute);
  var isValid  = exists && fs.statSync(absolute).isDirectory();
  if (!isValid) {
    if (exists) {
      fs.unlinkSync(absolute);
    }
    fs.mkdirSync(absolute);
    gutil.log('created directory ' + projectRelativePath);
  }
}

function anyFileOfType(ext, subdir) {
  return fs.readdirSync(path.resolve(subdir || '.'))
    .some(function testJS(filename) {
      return (path.extname(filename) === ('.' + ext));
    });
}

function writeTemplate(filename, subdir) {
  var srcAbsolute  = path.join(TEMPLATE_PATH, filename);
  var destRelative = path.join(subdir || '.', filename);
  var destAbsolute = path.resolve(destRelative);
  if (fs.existsSync(srcAbsolute) && !fs.existsSync(destAbsolute)) {

    // augment or adjust yargs parameters
    var port = (cliArgs.port === 'random') ? Math.floor(Math.random() * (65536 - 49152) + 49152) : port;
    var tags = []
      .concat(cliArgs.tag)   // yargs will convert multiple --tag flags to an array
      .filter(Boolean);
    var partial = fs.readFileSync(srcAbsolute).toString();
    var params  = merge(cliArgs, {
      port : port,
      tags : JSON.stringify(tags)  // must stringify lists
    });

    // complete the template and write to file
    var merged  = template(partial, params);
    fs.writeFileSync(destAbsolute, merged);
    gutil.log('created file ' + destRelative);
  }
}