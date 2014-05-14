module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    sass: {
      dist: {
        files: {
          'css/style.css': 'sass/style.scss'
        }
      }
    },
    jshint: {
      all: {
        src: [
          'js/iosketch.js',
          'js/wacom.js',
          'js/sketchtest.js'
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-jshint');

};