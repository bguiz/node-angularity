'use strict';

function setUpTaskRelease(options) {
  var taskDefinition = {
    name: 'release',
    description: ('The "release" task performs a single build and exports the build files along with bower ' +
      'components to a release directory.'),
    prerequisiteTasks: ['help', 'build'],
    checks: [],
    options: [],
    onInit: function onInitReleaseTask() {
      var gulp        = options.gulp || require('gulp'),
          inject      = require('gulp-inject'),
          plumber     = require('gulp-plumber'),
          rimraf      = require('gulp-rimraf'),
          semiflat    = require('gulp-semiflat'),
          wordwrap    = require('wordwrap'),
          runSequence = require('run-sequence');

      var injectAdjacent   = require('../lib/inject/adjacent-files'),
          injectTransform  = require('../lib/inject/relative-transform'),
          bowerFiles       = require('../lib/inject/bower-files'),
          taskYargs        = require('../lib/util/task-yargs'),
          hr               = require('../lib/util/hr'),
          streams          = require('../lib/config/streams');

      taskYargs.register('release', {
        description: (wordwrap(2, 80)('The "release" task performs a single build and exports the build ' +
        'files along with bower components to a release directory.')),
        prerequisiteTasks: ['help', 'build'],
        checks: [],
        options: []
      });

      gulp.task('release', ['build'], function (done) {
        console.log(hr('-', 80, 'release'));
        runSequence(
          'release:clean',
          'release:adjacent',
          'release:inject',
          done
        );
      });

      // clean the html build directory
      gulp.task('release:clean', function () {
        return gulp.src([streams.RELEASE_BUNDLE, streams.RELEASE_VENDOR], {read: false})
          .pipe(rimraf());
      });

      gulp.task('release:adjacent', function () {
        return gulp.src([streams.BUILD + '/*.js*', streams.BUILD + '/*.css*', streams.BUILD + '/assets/**'])
          .pipe(semiflat(streams.BUILD))
          .pipe(gulp.dest(streams.RELEASE_BUNDLE));
      });

      // inject dependencies into html and output to build directory
      gulp.task('release:inject', function() {
        function bower() {
          return bowerFiles()
            .src('*', { base: true, manifest: true })
            .pipe(gulp.dest(streams.RELEASE_VENDOR));
        }
        return gulp.src([streams.APP + '/*.html'])
          .pipe(plumber())
          .pipe(gulp.dest(streams.RELEASE_BUNDLE))  // put html in final directory first to get correct inject paths
          .pipe(injectAdjacent('js|css', {
            name     : 'inject',
            transform: injectTransform
          }))
          .pipe(inject(bower(), {
            name     : 'bower',
            transform: injectTransform
          }))
          .pipe(gulp.dest(streams.RELEASE_BUNDLE));
      });

      // version the release app directory
      /* TODO resolve visioning and CDN release
      gulp.task('release:versionapp', function () {
        return gulp.src(streams.RELEASE_APP + '/**')
          .pipe(versionDirectory('$', true));
      });
      */
    },
    onRun: function onRunReleaseTask() {
      var gulp        = options.gulp || require('gulp');
      gulp.run(taskDefinition.name);
    }
  };
  options.taskYargsRun.taskYargs.register(taskDefinition);
}

module.exports = setUpTaskRelease;
