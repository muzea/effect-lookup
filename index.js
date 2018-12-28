#!/usr/bin/env node

const program = require('commander');
const package = require('./package.json');
const make = require('./make')

function option2object(list) {
  const ret = {}
  list.forEach(element => {
    ret[element.short.replace('-', '')] = 1
  });
  return ret;
}

program
  .version(package.version)

program
  .command('make')
  .option('-c, --webpack-config', 'spec webpack config to get alias [default webpack.config.js]')
  .option('-r, --result-dir', 'result file store path [default node_modules/.effect-lookup]')
  .action(function (...rest) {
    const basePath = process.cwd();
    const options = rest[rest.length - 1]
    console.log(options['result-dir'])
  })

program
  .command('find')
  .option('-r, --result-dir', 'result file store path [default node_modules/.effect-lookup]')
  .option('-f, --file', 'spec which file changed')
  .option('-g --git', 'auto get file list from git status')
  .option('-m --merge-result', 'merge print')
  .action(function (cmd) {
    console.log(cmd)
  })

program.parse(process.argv);




