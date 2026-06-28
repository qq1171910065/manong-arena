import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['electron-store', 'archiver', 'extract-zip'] })],
    build: {
      rollupOptions: {
        external: ['node:sqlite'],
      },
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
    define: {
      'process.env.MNTOOLS_MODULES': JSON.stringify('request,sse,notification,storage,shell,window,file,tray'),
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
    define: {
      'process.env.MNTOOLS_MODULES': JSON.stringify('request,sse,notification,storage,shell,window,file,tray'),
    },
  },
  renderer: {
    base: './',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [vue()],
  },
})
