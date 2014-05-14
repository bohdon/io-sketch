module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('./src/package.json'),
    sass: {
      dist: {
        files: {
          'src/css/style.css': 'sass/style.scss'
        }
      }
    },
    jshint: {
      all: {
        src: [
          'src/js/iosketch.js',
          'src/js/wacom.js',
          'src/js/sketchtest.js'
        ]
      }
    },
    nodewebkit: {
      options: {
          build_dir: './webkitbuilds',
          mac: true,
          win: true,
          linux32: false,
          linux64: false
      },
      src: [
        './src/**/*',
        './node_modules/**/*'
      ]
    },
  });

  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-node-webkit-builder');

};