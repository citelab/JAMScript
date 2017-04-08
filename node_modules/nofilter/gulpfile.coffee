gulp = require 'gulp'
codo = require 'gulp-codo'
coffee = require 'gulp-coffee'
coffeelint = require 'gulp-coffeelint'
coveralls = require 'gulp-coveralls'
del = require 'del'
gls = require 'gulp-live-server'
gutil = require 'gulp-util'
istanbul = require 'gulp-istanbul'
mocha = require 'gulp-mocha'
open = require 'open'
sourcemaps  = require 'gulp-sourcemaps'

require('gulp-release-tasks')(gulp)

gulp.task 'coffee', ->
  cof = gulp.src './src/*.coffee'
  .pipe sourcemaps.init()
  .pipe coffee()
    .on 'error', (er) ->
      gutil.log er.stack
      cof.end()
  .pipe sourcemaps.write()
  .pipe gulp.dest('./lib')

gulp.task 'lint', ->
  gulp.src './src/*.coffee'
  .pipe coffeelint()
  .pipe coffeelint.reporter()

gulp.task 'doc', ->
  gulp.src './src/*.coffee',
    read: false
  .pipe codo
    name: 'NoFilter'
    title: 'NoFilter Documentation'
    readme: 'README.md'
    dir: './doc/'
    extra: 'LICENSE.md'
    undocumented: true

gulp.task 'test', ['coffee'], ->
  gulp.src './test/*.coffee'
    .pipe mocha()

gulp.task 'pre-coverage', ['coffee'], ->
  gulp.src([ 'lib/*.js' ])
  .pipe istanbul()
  .pipe istanbul.hookRequire()

gulp.task 'coverage', [ 'pre-coverage' ], ->
  t = gulp.src ['test/*.coffee']
  .pipe mocha()
    .on 'error', (er) ->
      gutil.log er.stack
      t.end()
  .pipe istanbul.writeReports()

gulp.task 'watch', ['coverage'], ->
  gulp.watch ['src/*.coffee', 'test/*'], ['coverage']

gulp.task 'serve', ['watch'], ->
  server = gls.static 'coverage/lcov-report'
  server.start()
  open 'http://localhost:3000/'
  gulp.watch ['coverage/lcov-report/**/*.html'], (file) ->
    server.notify.apply server, [file]

gulp.task 'clean', () ->
  del [
    'coverage/'
    'doc/'
    'lib/'
    '**/.DS_Store'
  ]

gulp.task 'prepublish', ['clean'], (cb) ->
  gulp.start 'coffee', cb

gulp.task 'coveralls', ['coverage'], ->
  gulp.src 'coverage/lcov.info'
  .pipe coveralls()

gulp.task 'ci', ['coveralls']

gulp.task 'default', ['test']
