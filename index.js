#!/usr/bin/env node

const path = require('path')
const { execSync } = require('child_process')

// https://github.com/jprichardson/node-fs-extra/
const fse = require('fs-extra')
// https://github.com/SBoudrias/Inquirer.js/
const inquirer = require('inquirer')
// https://github.com/nbubna/Case
const changeCase = require('case')
const chalk = require('picocolors')
const eta = require('eta')

// Project template specific configuration

const filesWithPlaceholders = [
  'docs/index.md',
  'includes/enqueue.php',
  'package.json',
  'readme.txt',
  'tangible-plugin.php',
  'tangible.config.js'
]

const questions = [
  {
    type: 'input',
    name: 'name',
    message: 'Project name '+chalk.gray('- Lowercase alphanumeric with optional dash "-"'),
    when: (data) => data.name ? false : true,
    validate: async (value) => {
      if (!value) return false
      if (await fse.pathExists(
        path.join(process.cwd(), value)
      )) {
        console.log(`Project folder "${value}" already exists`)
        return false
      }
      return true
    },
    filter: value => changeCase.kebab(value)
  },
  {
    type: 'input',
    name: 'title',
    message: 'Project title '+chalk.gray('- Press enter for default'),
    default: data => changeCase.title(data.name)
  },
  {
    type: 'input',
    name: 'description',
    message: 'Project description'
  },
]

createProject()
  .catch(console.error)

async function createProject() {

  const args = process.argv.slice(2)
  const defaultProjectName = args[0]

  // Ensure project folder doesn't exist yet

  if (defaultProjectName && await fse.pathExists(
    path.join(process.cwd(), defaultProjectName)
  )) {
    console.log(`Project folder "${defaultProjectName}" already exists`)
    return
  }

  const project = await inquirer.prompt(questions, {
    name: defaultProjectName
  })

  const projectName = project.name
  const projectPath = path.join(process.cwd(), projectName)

  // Create project folder and copy template

  console.log(`Creating project "${projectName}" `+
    chalk.gray('- Press CTRL + C to quit at any time')
  )

  await fse.mkdir(projectPath)

  const templatePath = path.join(__dirname, 'template')

  await fse.copy(templatePath, projectPath)

  // Specific to each project template

  const templateContext = {
    project,
    ...changeCase
  }
  const etaOptions = {
    async: true,
    useWith: true,
    autoTrim: false
  }

  await Promise.all(filesWithPlaceholders.map(async file => {

    const srcPath    = path.join(templatePath, file)
    const targetPath = path.join(projectPath, file)

    // https://eta.js.org/docs/syntax/async

    let content = ''
    try {
      content = await eta.render(
        await fse.readFile(srcPath, 'utf8'),
        templateContext,
        etaOptions
      )
    } catch (e) {
      console.error(e)
      return
    }

    await fse.writeFile(targetPath, content)
  }))

  // Rename plugin entry file

  await fse.rename(
    path.join(projectPath, 'tangible-plugin.php'),
    path.join(projectPath, `${project.name}.php`),
  )

  const run = (command, options) => new Promise((resolve, reject) => {
    try {
      execSync(command, {
        stdio: 'inherit',
        cwd: projectPath
      })
      resolve()
    } catch (e) {
      reject(e)
    }
  })

  await run('npm install --audit=false --loglevel=error')

  console.log(`\nDone.\n\nStart by running:\n\ncd ${projectName}\nnpm run dev\n`)
}
