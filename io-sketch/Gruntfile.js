module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
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
    exec: {
      clear_build: {
        command: 'rm -rf webkitbuilds/releases'
      },
      open_build: {
        command: 'open -n webkitbuilds/releases/<%= pkg.name %>/mac/<%= pkg.name %>.app'
      },
      test: {
        command: 'open -n node-webkit.app'
      }
    },
    nodewebkit: {
      options: {
        build_dir: './webkitbuilds',
      },
      mac: {
        options: {
          mac: true,
          win: false
        },
        src: [
          './package.json',
          './src/**/*',
          './node_modules/**/*'
        ]
      },
      win: {
        options: {
          mac: false,
          win: true
        },
        src: [
          './package.json',
          './src/**/*',
          './node_modules/**/*'
        ]
      }
    },
  });

  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-node-webkit-builder');
  grunt.loadNpmTasks('grunt-exec');

  grunt.registerTask('build', ['sass', 'exec:clear_build', 'nodewebkit:mac', 'exec:open_build']);
  grunt.registerTask('default', ['sass', 'exec:test']);

};