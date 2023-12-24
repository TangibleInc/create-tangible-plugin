#!/usr/bin/env node

import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

// https://github.com/jprichardson/node-fs-extra/
import fse from 'fs-extra'
// https://github.com/SBoudrias/Inquirer.js/
import inquirer from 'inquirer'
// https://github.com/nbubna/Case
import changeCase from 'case'
import chalk from 'picocolors'
import { Eta } from 'eta'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Project template specific configuration

const filesWithPlaceholders = [
  'docs/index.md',
  'includes/enqueue.php',
  'package.json',
  'readme.txt',
  'tangible-plugin.php',
  'tangible.config.js',
]

const questions = [
  {
    type: 'input',
    name: 'name',
    message:
      'Project name ' +
      chalk.gray('- Lowercase alphanumeric with optional dash "-"'),
    when: (data) => (data.name ? false : true),
    validate: async (value) => {
      if (!value) return false
      if (await fse.pathExists(path.join(process.cwd(), value))) {
        console.log()
        console.log(`Project folder "${value}" already exists`)
        return false
      }
      return true
    },
    filter: (value) => changeCase.kebab(value),
  },
  {
    type: 'input',
    name: 'title',
    message: 'Project title ' + chalk.gray('- Press enter for default'),
    default: (data) => changeCase.title(data.name),
  },
  {
    type: 'input',
    name: 'description',
    message: 'Project description',
  },
]

createProject().catch(console.error)

async function createProject() {
  const args = process.argv.slice(2)
  const defaultProjectName = args[0]

  // Ensure project folder doesn't exist yet

  if (
    defaultProjectName &&
    (await fse.pathExists(path.join(process.cwd(), defaultProjectName)))
  ) {
    console.log(`Project folder "${defaultProjectName}" already exists`)
    return
  }

  const project = await inquirer.prompt(questions, {
    name: defaultProjectName,
  })

  const projectName = project.name
  const projectPath = path.join(process.cwd(), projectName)

  // Create project folder and copy template

  console.log(
    `Creating project "${projectName}" ` +
      chalk.gray('- Press CTRL + C to quit at any time')
  )

  await fse.mkdir(projectPath)

  const templatePath = path.join(__dirname, 'template')

  await fse.copy(templatePath, projectPath)

  // Specific to each project template

  const templateContext = {
    project,
    ...changeCase,
  }

  // https://eta.js.org/docs/api
  const eta = new Eta({
    useWith: true,
    autoEscape: false,
    autoTrim: false
  })
  const etaOptions = {
    async: true,
  }

  await Promise.all(
    filesWithPlaceholders.map(async (file) => {
      const srcPath = path.join(templatePath, file)
      const targetPath = path.join(projectPath, file)

      // https://eta.js.org/docs/syntax/async

      let content = ''
      try {
        const fn = await eta.compile(await fse.readFile(srcPath, 'utf8'), {
          ...etaOptions,
          async include(target) {
            const dirPath = path.dirname(file)
            // Resolve relative file path
            const filePath = path.resolve(dirPath, target)

            let content = ''
            try {
              content = await fse.readFile(filePath, 'utf8')
            } catch (e) {
              console.log(
                'Error building template',
                path.relative(process.cwd(), file)
              )
              console.error(e.message)
            }

            return content
          },
        })
        content = await eta.renderAsync(fn, templateContext)
      } catch (e) {
        console.error(e)
        return
      }

      await fse.writeFile(targetPath, content)
    })
  )

  // Rename plugin entry file

  await fse.rename(
    path.join(projectPath, 'tangible-plugin.php'),
    path.join(projectPath, `${project.name}.php`)
  )

  const run = (command, options) =>
    new Promise((resolve, reject) => {
      try {
        execSync(command, {
          stdio: 'inherit',
          cwd: projectPath,
        })
        resolve()
      } catch (e) {
        reject(e)
      }
    })

  await run('npm install --audit=false --loglevel=error')

  try {
    await run('composer install')
  } catch (e) {
    console.log(
      'Please install Composer dependencies by running: composer install'
    )
  }

  console.log(`
Done.
Start by running:
cd ${projectName}
npm run dev
`)
}
