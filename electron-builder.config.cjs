const { join } = require('node:path')
const rcedit = require('rcedit')

/** @type {import('electron-builder').Configuration} */
module.exports = {
  extends: './electron-builder.yml',
  afterPack: async (context) => {
    if (context.electronPlatformName !== 'win32') return

    const root = __dirname
    const iconPath = join(root, 'build', 'icon.ico')
    const exeName = context.packager.config.win?.executableName ?? context.packager.appInfo.productFilename
    const exePath = join(context.appOutDir, `${exeName}.exe`)
    const { productName, version } = context.packager.appInfo

    await rcedit(exePath, {
      icon: iconPath,
      'file-version': version,
      'product-version': version,
      'version-string': {
        FileDescription: productName,
        ProductName: productName,
        InternalName: exeName,
        OriginalFilename: `${exeName}.exe`,
      },
    })
  },
}
