const path = require('path')
const fs = require('fs')
const glob = require('glob')
const { transformFileSync } = require('@babel/core')
const t = require('@babel/types')
const { uniq } = require('lodash')

function make(basePath, srcPath, webpackFile, resultPath) {
  function absPath(subPath) {
    return path.resolve(path.join(basePath, subPath))
  }

  const packageJson = require(path.join(basePath, 'package.json'))
  const alias = require(absPath(webpackFile)).resolve.alias
  const aliasList = Object.keys(alias)
  
  const fileList = glob.sync(absPath(srcPath))
  
  const presets = ['@babel/preset-typescript', '@babel/preset-react']
  
  const plugins = [
    '@babel/plugin-proposal-export-default-from',
    [
      '@babel/plugin-proposal-decorators',
      {
        legacy: true
      }
    ],
    [
      '@babel/plugin-proposal-class-properties',
      {
        loose: true
      }
    ],
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-syntax-dynamic-import'
  ]
  
  const fileExt = ['tsx', 'ts', 'jsx', 'js']
  
  function resolveFileName(baseFile, importSource) {
    if (importSource[0] !== '.') {
      if (packageJson.dependencies[importSource] || packageJson.devDependencies[importSource]) {
        return `node_modules/${importSource}`
      }
      let depName = importSource.split('/')[0]
      if (depName.startsWith('@')) {
        depName = `${depName}/${importSource.split('/')[1]}`
      }
      if (packageJson.dependencies[depName] || packageJson.devDependencies[depName]) {
        return `node_modules/${depName}`
      }
  
      let ai = 0
  
      while (ai !== aliasList.length) {
        const aliasName = aliasList[ai]
        if (importSource.startsWith(aliasName)) {
          const fixedPath = importSource.replace(new RegExp(`^${aliasName}`), alias[aliasName])
  
          let ei = 0
          while (ei !== fileExt.length) {
            const ext = fileExt[ei]
            const tmpFileName = `${fixedPath}.${ext}`
            if (fs.existsSync(tmpFileName)) {
              return path.relative(basePath, tmpFileName)
            }
            ei += 1
          }
  
          ei = 0
          while (ei !== fileExt.length) {
            const ext = fileExt[ei]
            const tmpFileName = `${fixedPath}/index.${ext}`
            if (fs.existsSync(tmpFileName)) {
              return path.relative(basePath, tmpFileName)
            }
            ei += 1
          }
        }
  
        ai += 1
      }
  
      console.error('找不到依赖', baseFile, importSource)
      return `${Math.random()}_${Math.random()}`
    }
  
    const dirname = path.dirname(baseFile)
  
    const maybeFile = path.resolve(path.join(dirname, importSource))
    if (fs.existsSync(maybeFile) && fs.statSync(maybeFile).isFile()) {
      return path.relative(basePath, maybeFile)
    }
  
    let i = 0
    while (i !== fileExt.length) {
      const ext = fileExt[i]
      const tmpFileName = path.resolve(path.join(dirname, `${importSource}.${ext}`))
      if (fs.existsSync(tmpFileName)) {
        return path.relative(basePath, tmpFileName)
      }
      i += 1
    }
    i = 0
    while (i !== fileExt.length) {
      const ext = fileExt[i]
      const tmpFileName = path.resolve(path.join(dirname, `${importSource}/index.${ext}`))
      if (fs.existsSync(tmpFileName)) {
        return path.relative(basePath, tmpFileName)
      }
      i += 1
    }
    console.error('找不到文件', baseFile, importSource)
    return `${Math.random()}_${Math.random()}`
  }
  
  function getName(item) {
    if (t.isTypeAlias(item.declaration)) {
      if (t.isIdentifier(item.declaration.id)) {
        return item.declaration.id.name
      }
    }
    if (t.isClassDeclaration(item.declaration)) {
      if (t.isIdentifier(item.declaration.id)) {
        return item.declaration.id.name
      }
    }
    if (t.isFunctionDeclaration(item.declaration)) {
      if (t.isIdentifier(item.declaration.id)) {
        return item.declaration.id.name
      }
    }
    if (t.isVariableDeclaration(item.declaration)) {
      if (item.declaration.declarations && t.isVariableDeclarator(item.declaration.declarations[0])) {
        if (t.isIdentifier(item.declaration.declarations[0].id)) {
          return item.declaration.declarations[0].id.name
        }
      }
    }
    console.error('不知道是啥 看下有没有 Identifier')
    console.error(item.declaration)
    if (item.declaration && t.isIdentifier(item.declaration.id)) {
      return item.declaration.id.name
    }
    return 'woyebuzhidaoshisha'
  }
  
  function getMapInfo(list, baseFile) {
    const ret = {
      import: [],
      export: []
    }
    function findRef(name) {
      const item = ret.import.find(importItem => importItem.name === name)
      if (item) {
        return `${item.source}|${item.orighName}`
      }
      return null
    }
    list.forEach(item => {
      if (t.isImportDeclaration(item)) {
        if (item.source.value.endsWith('.css')) {
          return
        }
        const sourcePath = resolveFileName(baseFile, item.source.value)
        item.specifiers.forEach(specify => {
          if (t.isImportDefaultSpecifier(specify)) {
            ret.import.push({
              source: sourcePath,
              name: specify.local.name,
              orighName: 'default'
            })
          }
          if (t.isImportSpecifier(specify)) {
            ret.import.push({
              source: sourcePath,
              name: specify.local.name,
              orighName: specify.imported.name
            })
          }
          if (t.isImportNamespaceSpecifier(specify)) {
            ret.import.push({
              source: sourcePath,
              name: specify.local.name,
              orighName: '*'
            })
          }
        })
      }
      // code
      if (t.isExportDefaultDeclaration(item)) {
        const exportItem = {
          name: 'default'
        }
        if (t.isIdentifier(item.declaration)) {
          const ref = findRef(item.declaration.name)
          if (ref) {
            exportItem.ref = ref
          }
        }
        ret.export.push(exportItem)
      }
      if (t.isExportNamedDeclaration(item)) {
        if (item.specifiers.length) {
          item.specifiers.forEach(specify => {
            if (t.isExportSpecifier(specify)) {
              const exportItem = {
                name: specify.exported.name
              }
              const ref = findRef(specify.local.name)
              if (ref) {
                exportItem.ref = ref
              }
              ret.export.push(exportItem)
            }
          })
        } else {
          let name = getName(item)
          ret.export.push({ name })
        }
      }
    })
    return ret
  }
  
  // process.exit()
  
  // infoMap
  // {
  //   'file path': $info
  // }
  
  const infoMap = {}
  
  function addInfoMap(_fileList) {
    _fileList.forEach(filePath => {
      const { ast } = transformFileSync(filePath, { ast: true, presets, plugins, babelrc: false })
      const info = getMapInfo(ast.program.body, filePath)
      const relative = path.relative(basePath, filePath)
      infoMap[relative] = info
    })
  }
  
  addInfoMap(fileList)
  
  // refMap
  // {
  //   'file path': {
  //     'export name': 'anothor file|ref Name' | null
  //   }
  // }
  
  const refMap = {}
  
  function addRefInfo() {
    Object.keys(infoMap).forEach(filePath => {
      const ret = {}
      const info = infoMap[filePath]
      info.export.forEach(it => {
        ret[it.name] = it.ref || null
      })
      refMap[filePath] = ret
    })
  }
  
  addRefInfo()
  
  // result
  // {
  //   'file path': ['affect file', '']
  // }
  const result = {}
  
  function getResult() {
    Object.keys(infoMap).forEach(it => {
      const whichFileWillAffectThis = []
      const importList = infoMap[it].import
      importList.forEach(importItem => {
        const { source, orighName } = importItem
        function resolveFilePath(_source, _orighName) {
          if (_orighName === '*') {
            Object.keys(refMap[_source]).forEach(keyName => resolveFilePath(_source, keyName))
            return
          }
          if (refMap[_source]) {
            if (refMap[_source][_orighName] === null) {
              whichFileWillAffectThis.push(_source)
              return
            }
            if (refMap[_source][_orighName] && refMap[_source][_orighName].length) {
              const pathInfo = refMap[_source][_orighName].split('|')
              resolveFilePath(pathInfo[0], pathInfo[1])
              return
            }
          }
          console.error(`没有 export 信息 [${_source}, ${_orighName}]`)
        }
        if (source.startsWith('node_modules')) {
          /**
           * @todo 处理依赖的问题
           */
          return
        }
        if (source.endsWith('.css')) {
          /**
           * @todo 处理样式的问题
           */
          return
        }
        resolveFilePath(source, orighName)
      })
      const whichFileWillAffectThisUniq = uniq(whichFileWillAffectThis)
      whichFileWillAffectThisUniq.forEach(fileChanged => {
        if (!Array.isArray(result[fileChanged])) {
          result[fileChanged] = []
        }
        result[fileChanged].push(it)
      })
    })
  }
  
  getResult()
  function getResultPath(fileName) {
    return path.resolve(path.join(resultPath, fileName))
  }
  fs.writeFileSync(getResultPath('./infoMap.json'), JSON.stringify(infoMap))
  fs.writeFileSync(getResultPath('./result.json'), JSON.stringify(result))
  fs.writeFileSync(getResultPath('./refMap.json'), JSON.stringify(refMap))
}

module.exports = make
