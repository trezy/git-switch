#!/usr/bin/env node

/*
  `git-switch` is a simple CLI for switching between multiple git profiles
  Copyright (C) 2016 Charles E Peebles, III

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict'

let _ = require('lodash')
let ncp = require('copy-paste')
let fs = require('fs')
let gitconfig = require('gitconfig')
let keygen = require('ssh-keygen2')
let path = require('path')
let prompt = require('prompt')
let winston = require('winston')

let homePath = path.resolve(process.env['HOME'])
let appConfigPath = path.resolve(homePath, '.git-switch')
let sshPath = path.resolve(homePath, '.ssh')

let nodeBin = process.argv.shift()
let script = process.argv.shift()

prompt.delimiter = ''
prompt.message = ''





new class GitSwitch {

  /******************************************************************************\
    Private Methods
  \******************************************************************************/

  _convertAlias (aliasToConvert) {
    let flags = Object.keys(this.args)
    let ret

    flags.forEach((flag) => {
      if (this.args[flag].alias) {
        let aliases = this.args[flag].alias

        aliases.forEach((alias) => {
          if (aliasToConvert === alias) {
            ret = flag
          }
        })
      }
    })

    return ret
  }





  _createConfig (config) {
    let configPath = path.resolve(appConfigPath, config.configName)
    let configJSONPath = path.resolve(appConfigPath, config.configName, 'config.json')
    let privateKeyPath = path.resolve(configPath, 'privatekey')
    let publicKeyPath = path.resolve(configPath, 'publickey')
    let sshPrivateKeyPath = path.resolve(sshPath, 'id_rsa')
    let sshPublicKeyPath = path.resolve(sshPath, 'id_rsa.pub')

    // Check to see if the config already exists. If not, create a directory
    // for it.
    try {
      fs.readdirSync(configPath)
      winston.info(`${config.configName} config already exists.`)
      return

    } catch (error) {
      fs.mkdirSync(configPath)
    }

    gitconfig.set({
      'user.email': config.email,
      'user.name': config.name
    }, {
      location: 'global'
    }, (error) => {
      if (error) {
        winston.error('Couldn\'t set global git config')
      }
    })

    // Save the config
    delete config.configName
    delete config.useCurrentSSH
    fs.writeFile(configJSONPath, JSON.stringify(config, null, 2), 'utf8')

    if (config.useCurrentSSH) {
      // Move the current keypair to the config folder and create symlinks to
      // avoid causing havoc
      fs.rename(sshPrivateKeyPath, privateKeyPath, () => {
        fs.symlinkSync(privateKeyPath, sshPrivateKeyPath)
      })

      fs.rename(sshPublicKeyPath, publicKeyPath, () => {
        fs.symlinkSync(publicKeyPath, sshPublicKeyPath)
      })

    } else {

      // Create the SSH keypair
      keygen({
        comment: config.configName,
        keep: true,
        location: path.resolve(configPath, config.configName)
      }, (error, keypair) => {
        if (error) {
          winston.error('Failed to create keypair')
        } else {

          // Rename the keypair to match our naming scheme
          fs.rename(path.resolve(configPath, config.configName), privateKeyPath)
          fs.rename(path.resolve(configPath, config.configName + '.pub'), publicKeyPath)
        }
      })
    }
  }





  _ensureConfigDirectory () {

    // Check to see if the config directory already exists. If not, create it.
    try {
      fs.readdirSync(appConfigPath)

    } catch (error) {
      fs.mkdirSync(appConfigPath)
    }
  }





  _deleteConfig (configToDelete) {
    let configPath = path.resolve(appConfigPath, configToDelete)

    // Cycle through and delete each file in the config, then delete the
    // directory itself
    fs.readdirSync(configPath).forEach((filename) => {
      fs.unlinkSync(path.resolve(configPath, filename))
    })

    fs.rmdirSync(configPath)

    winston.info(`Deleted ${configToDelete}`)
  }





  _run () {
    this.commands.forEach((command) => {
      if (process.argv[0] === command) {
        this.command = process.argv.shift()
      }
    })

    if (!this.command) {
      if (this.configs.length) {
        this.command = 'switch'
      } else {
        this.command = 'add'
      }
    }

    this[this.command || 'switch']()
  }





  _switchConfig (configToUse, reset) {
    let name = configToUse
    let configPath = path.resolve(appConfigPath, name)
    let configJSONPath = path.resolve(appConfigPath, name, 'config.json')
    let configJSON = JSON.parse(fs.readFileSync(configJSONPath, 'utf8'))
    let privateKeyPath = path.resolve(configPath, 'privatekey')
    let publicKeyPath = path.resolve(configPath, 'publickey')
    let sshPrivateKeyPath = path.resolve(sshPath, 'id_rsa')
    let sshPublicKeyPath = path.resolve(sshPath, 'id_rsa.pub')

    if (!this.currentProfile || this.currentProfile !== configToUse || reset) {
      // Record the currently selected profile
      this.currentProfile = configToUse

      // Delete previous keypair links
      fs.unlinkSync(sshPrivateKeyPath)
      fs.unlinkSync(sshPublicKeyPath)

      // Create new keypair links
      fs.symlinkSync(privateKeyPath, sshPrivateKeyPath)
      fs.symlinkSync(publicKeyPath, sshPublicKeyPath)

      // Update global git name and email with config name and email
      gitconfig.set({
        'user.email': configJSON.email,
        'user.name': configJSON.name
      }, {
        location: 'global'
      }, (error) => {
        if (error) {
          winston.error('Couldn\'t set global git config')
          return false

        } else {
          return true
        }
      })
    }
  }





  /******************************************************************************\
    Public Methods
  \******************************************************************************/

  add () {
    // Create a JSON config file
    let config = gitconfig.get.sync('user', {location: 'global'})

    prompt.start()

    prompt.get([{
      conform: (value) => {
        return this.configs.indexOf(value) !== -1 ? false : true
      },
      description: 'What would you like to name this config?',
      message: 'A config name is required and must not yet exist',
      name: 'configName',
      required: true
    }, {
      default: config.name,
      description: 'What\'s your name?',
      name: 'name'
    }, {
      default: config.email,
      description: 'What email would you like to use?',
      name: 'email'
    }, {
      default: 'y',
      description: 'Would you like to use the current SSH keypair? (y/n)',
      message: 'Must be a yes or a no',
      name: 'useCurrentSSH',
      pattern: /y|yes|yup|n|no|nope/,
      type: 'string'
    }], (error, results) => {
      this._createConfig(results)
    })
  }





  constructor () {
    this.args = {}

    // Define all of the potential commands contained by the CLI
    this.commands = ['add', 'key', 'list', 'remove', 'reset', 'switch']

    // Always ensure that the config directory exists
    this._ensureConfigDirectory()

    // Run the command
    this._run()
  }





  key () {
    if (this.currentProfile) {
      ncp.copy(fs.readFileSync(path.resolve(appConfigPath, this.currentProfile, 'publickey'), 'utf8'), () => {
        winston.info(`Copied the currently public key for ${this.currentProfile} to your clipboard!`)
      })
    } else {
      winston.info('You must select a profile before you can copy its key')
    }
  }





  list () {
    winston.info('Available configs:', this.configs.join(', '))
  }





  remove () {
    let configToDelete

    if (process.argv.length) {
      configToDelete = process.argv.shift()
      winston.info(`Removing ${configToDelete} config`)
      this._deleteConfig(configToDelete)

    } else {
      prompt.start()

      prompt.get([{
        conform: (value) => {
          return this.configs.indexOf(value) !== -1 ? true : false
        },
        description: `Which config do you want to remove? (${configs.join(', ')})`,
        name: 'configToDelete',
        required: true
      }], (error, results) => {
        if (error) {
          winston.error(error)

        } else {
          this._deleteConfig(results.configToDelete)
        }
      })
    }
  }





  reset () {
    if (this.currentProfile) {
      winston.info(`Resetting git profile for ${this.currentProfile}`)
      this._switchConfig(this.currentProfile, true)
    } else {
      winston.error('Can\'t reset if no profile is set')
    }
  }





  switch () {
    let configToUse

    if (process.argv.length) {
      configToUse = process.argv.shift()

      if (this.configs.indexOf(configToUse) === -1) {
        winston.error(`${configToUse} config doesn't exist`)

      } else {
        winston.info(`Switching to ${configToUse} config`)
        this._switchConfig(configToUse)
      }

    } else {
      prompt.start()

      prompt.get([{
        conform: (value) => {
          return this.configs.indexOf(value) !== -1 ? true : false
        },
        description: `Which config do you want to use? (${this.configs.join(', ')})`,
        name: 'configToUse',
        required: true
      }], (error, results) => {
        if (error) {
          winston.error(error)

        } else {
          if (this._switchConfig(results.configToUse)) {
            winston.info(`Now using ${results.configToUse}`)
          }
        }
      })
    }
  }





  /******************************************************************************\
    Getters
  \******************************************************************************/

  get configs () {
    return _.without(fs.readdirSync(appConfigPath), 'current')
  }





  get currentProfile () {
    if (!this._currentProfile) {
      try {
        this._currentProfile = fs.readFileSync(path.resolve(appConfigPath, 'current'), 'utf8')
      } catch (error) {
        this._currentProfile = undefined
      }
    }

    return this._currentProfile
  }





  /******************************************************************************\
    Setters
  \******************************************************************************/

  set currentProfile (value) {
    this._currentProfile = value
    fs.writeFileSync(path.resolve(appConfigPath, 'current'), value, 'utf8')
  }
}
