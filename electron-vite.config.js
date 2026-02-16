const { defineConfig } = require('electron-vite');

module.exports = defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: 'main.js',
        external: ['electron']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: 'preload.js'
      }
    }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: 'index.html'
      }
    }
  }
});