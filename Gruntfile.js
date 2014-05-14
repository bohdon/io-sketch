var path = require('path')

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    express: {
      all: {
        options: {
          server: 'app.js'
        }
      }
    },
    watch: {
      express: {
        files: [
          'Gruntfile.js',
          'app.js',
          'public/**/*.*',
          'views/**/*.*',
        ],
        options: {
          livereload: true
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-express');

  grunt.registerTask('default', ['express', 'watch']);

};