#!/usr/bin/env node

'use strict'

let fs = require('fs')
let gitconfig = require('gitconfig')
let keygen = require('ssh-keygen2')
let path = require('path')
let winston = require('winston')

let homePath = path.resolve(process.env['HOME'])
let appConfigPath = path.resolve(homePath, '.git-switch')
let sshPath = path.resolve(homePath, '.ssh')

let nodeBin = process.argv.shift()
let script = process.argv.shift()





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





  _createConfig () {
    let configJSON = {}
    let name = this.args.name.value
    let useGlobal = this.args['use-global'].value

    let configPath = path.resolve(appConfigPath, name)
    let configJSONPath = path.resolve(appConfigPath, name, 'config.json')
    let privateKeyPath = path.resolve(configPath, 'privatekey')
    let publicKeyPath = path.resolve(configPath, 'publickey')
    let sshPrivateKeyPath = path.resolve(sshPath, 'id_rsa')
    let sshPublicKeyPath = path.resolve(sshPath, 'id_rsa.pub')

    // Check to see if the config already exists. If not, create a directory
    // for it.
    try {
      fs.readdirSync(configPath)
      winston.info(`${name} config already exists.`)
      return

    } catch (error) {
      fs.mkdirSync(configPath)
    }

    if (useGlobal) {
      // Move the current keypair to the config folder
      fs.rename(sshPrivateKeyPath, privateKeyPath)
      fs.rename(sshPublicKeyPath, publicKeyPath)

      // Create a symlink to the keypair so we don't create a ton of havoc
      fs.symlinkSync(privateKeyPath, sshPrivateKeyPath)
      fs.symlinkSync(publicKeyPath, sshPublicKeyPath)

      // Create a JSON config file
      gitconfig.get('user', {location: 'global'}, (error, config) => {
        if (error) {
          winston.error('Couldn\'t read git config', error)

        } else {
          if (config.email) {
            configJSON.email = config.email
          }

          if (config.name) {
            configJSON.name = config.name
          }

          fs.writeFile(configJSONPath, JSON.stringify(configJSON, null, 2), 'utf8')
        }
      })

    } else {

      // Create the SSH keypair
      keygen({
        comment: name,
        keep: true,
        location: privateKeyPath
      }, (error, keypair) => {
        if (error) {
          console.log('Failed to create keypair')
        } else {

          // Rename the keypair to match our naming scheme
          fs.rename(path.resolve(configPath, name), privateKeyPath)
          fs.rename(path.resolve(configPath, name + '.pub'), publicKeyPath)
        }
      })

      // Create a JSON config file
      if (this.args['git-email'].value) {
        configJSON.email = this.args['git-email'].value
      }

      if (this.args['git-name'].value) {
        configJSON.name = this.args['git-name'].value
      }

      fs.writeFile(configJSONPath, JSON.stringify(configJSON, null, 2), 'utf8')
    }
  }





  _checkConfigDirectory () {

    // Check to see if the config directory already exists. If not, create it.
    try {
      fs.readdirSync(appConfigPath)

    } catch (error) {
      fs.mkdirSync(appConfigPath)
    }
  }





  _deleteConfig () {
    let configPath = path.resolve(appConfigPath, this.args.name.value)

    // If the config exists, cycle through and delete each file in the config,
    // then delete the directory itself
    try {
      fs.readdirSync(configPath).forEach((filename) => {
        fs.unlinkSync(path.resolve(configPath, filename))
      })

      fs.rmdirSync(configPath)
    } catch (error) {
      winston.error(`No config named ${this.args.name.value} was found`)
    }
  }





  _handleUnrecognized (flag) {
    winston.error(`${flag} is not a recognized argument.`)
  }





  _parseArgs () {
    // Cycle through the rest of the args passed to the CLI
    for (let i = 0; i < process.argv.length; i++) {

      // Check if the arg is a flag and shift it off the array if so
      if (process.argv[i].indexOf('-') === 0) {
        let flag = process.argv.shift()

        // Check if it's a full flag or an alias
        if (flag.indexOf('--') === 0) {

          // Full flag, easy sauce
          flag = flag.substring(2)

        } else {
          let tmpFlag = flag.substring(1)

          // It's an alias so we'll cycle through all of the recognized args,
          // then cycle through their alias array (if they have one) looking
          // for matches
          flag = this._convertAlias(tmpFlag)

          if (flag === undefined) {
            this._handleUnrecognized(tmpFlag)
            return
          }
        }

        if (this.args[flag] !== undefined) {

          // If the next arg is not a flag then it's the value to be set for
          // the flag. Otherwise this must be a boolean.
          if (process.argv.length && process.argv[i].indexOf('-') === -1) {
            this.args[flag].value = foo

          } else {
            this.args[flag].value = !this.args[flag].value
          }

        } else {
          this._handleUnrecognized(flag)
          return
        }

      }
    }
  }





  _parseCommand () {
    this.commands.forEach((command) => {
      if (process.argv[0] === command) {
        this.command = process.argv.shift()
      }
    })

    if (!this.command) {
      this.command = this.commands['switch']
    }
  }





  _run () {
    this[this.command]()
  }





  _switchConfig () {
    let name = this.args.name.value
    let configPath = path.resolve(appConfigPath, name)
    let configJSONPath = path.resolve(appConfigPath, name, 'config.json')
    let configJSON = JSON.parse(fs.readFileSync(configJSONPath, 'utf8'))
    let privateKeyPath = path.resolve(configPath, 'privatekey')
    let publicKeyPath = path.resolve(configPath, 'publickey')
    let sshPrivateKeyPath = path.resolve(sshPath, 'id_rsa')
    let sshPublicKeyPath = path.resolve(sshPath, 'id_rsa.pub')

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
        console.error('Couldn\'t set global git config')
      }
    })
  }





  /******************************************************************************\
    Public Methods
  \******************************************************************************/

  add () {
    winston.info(`Adding ${this.args.name.value} config`)

    this._createConfig()
  }





  constructor () {

    // Define all of the potential arguments that can be passed to the CLI
    this.args = {
      'name': {
        value: 'default'
      }
    }

    // Define all of the potential commands contained by the CLI
    this.commands = ['add', 'remove', 'switch', 'update']

    // Always ensure that the config directory exists
    this._checkConfigDirectory()

    // Parse the command passed to figure out what command the user wants to run
    this._parseCommand()

    // Parse the arguments passed to configure the CLI before running the
    // command
    this._parseArgs()

    // Run the command
    this._run()
  }





  remove () {
    winston.info(`Removing ${this.args.name.value} config`)

    this._deleteConfig()
  }





  switch () {
    winston.info(`Switching to ${this.args.name.value} config`)

    this._switchConfig()
  }
}
