import _ from 'lodash'
import Ajv from 'ajv/dist/2020.js'
import { EventEmitter } from 'events'
import { fileURLToPath } from 'url'
import Keywords from './Keywords.js'
import path from 'path'
import safeRegex from 'safe-regex'
import Schema from './Schema.js'
import SchemaError from './SchemaError.js'
import XSSDefaults from './XSSDefaults.js'
import { globSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE_SCHEMA_PATH = '../schema/base.schema.json'

/**
 * Standalone JSON Schema library for the Adapt framework
 */
class Schemas extends EventEmitter {
  /**
   * Creates a new Schemas instance
   * @param {Object} options Configuration options
   * @param {Boolean} options.enableCache Enable schema caching (default: true)
   * @param {Object} options.xssWhitelist Custom XSS whitelist tags/attributes
   * @param {Boolean} options.xssWhitelistOverride Replace default whitelist instead of extending
   * @param {Object} options.formatOverrides Custom string format RegExp patterns
   */
  constructor (options = {}) {
    super()

    this.options = _.defaults(options, {
      enableCache: true,
      xssWhitelist: {},
      xssWhitelistOverride: false,
      formatOverrides: {}
    })

    /**
     * Reference to all registered schemas
     * @type {Object<string, Schema>}
     */
    this.schemas = {}

    /**
     * Maps base schema name to the names of schemas that extend it (via $patch).
     * @type {Object<string, string[]>}
     */
    this.schemaExtensions = {}

    /**
     * Tags and attributes to be whitelisted by the XSS filter
     * @type {Object}
     */
    this.xssWhitelist = Object.assign(
      {},
      this.options.xssWhitelistOverride ? {} : XSSDefaults,
      this.options.xssWhitelist
    )

    const ajvOptions = {
      addUsedSchema: false,
      allErrors: true,
      allowUnionTypes: true,
      loadSchema: (uri) => (this.getSchema(uri, { compile: false })).built,
      removeAdditional: 'all',
      strict: false,
      verbose: true,
      keywords: Keywords.all()
    }

    /**
     * Ajv instance
     * @type {Ajv}
     */
    this.validator = new Ajv({ ...ajvOptions })

    /**
     * Ajv instance with useDefaults enabled (applies schema defaults during validation)
     * @type {Ajv}
     */
    this.validatorWithDefaults = new Ajv({ ...ajvOptions, useDefaults: true })

    this.addStringFormats({
      'date-time': /[A-Za-z0-9:+()]+/,
      time: /^(\d{2}):(\d{2}):(\d{2})\+(\d{2}):(\d{2})$/,
      uri: /^(.+):\/\/(www\.)?[-a-zA-Z0-9@:%_+.~#?&//=]{1,256}/
    })

    if (this.options.formatOverrides) {
      this.addStringFormats(this.options.formatOverrides)
    }

    this._initialized = false
  }

  /**
   * Initializes the schema library by loading the base schema
   * @returns {Schemas}
   */
  init () {
    if (this._initialized) return this

    this.resetSchemaRegistry()
    this._initialized = true
    this.emit('initialized')
    return this
  }

  /**
   * Empties the schema registry (with the exception of the base schema)
   */
  resetSchemaRegistry () {
    // Remove previously registered schemas from AJV instances
    for (const name of Object.keys(this.schemas)) {
      for (const v of [this.validator, this.validatorWithDefaults]) {
        if (v.getSchema(name)) v.removeSchema(name)
      }
    }
    this.schemas = {
      base: this.createSchema(path.resolve(__dirname, BASE_SCHEMA_PATH), { enableCache: true })
    }
    this.schemaExtensions = {}
    this.emit('reset')
  }

  /**
   * Adds string formats to the Ajv validator
   * @param {Object<string, RegExp>} formats
   */
  addStringFormats (formats) {
    Object.entries(formats).forEach(([name, re]) => {
      const isUnsafe = !safeRegex(re)
      if (isUnsafe) {
        this.emit('warning', `Unsafe RegExp for format '${name}' (${re}), using default`)
      }
      const format = isUnsafe ? /.*/ : re
      this.validatorWithDefaults.addFormat(name, format)
      this.validator.addFormat(name, format)
    })
  }

  /**
   * Adds a new keyword to be used in JSON schemas
   * @param {Object} definition AJV keyword definition
   * @param {Object} options Configuration options
   * @param {Boolean} options.override Whether an existing keyword should be overridden
   */
  addKeyword (definition, options = {}) {
    try {
      for (const v of [this.validatorWithDefaults, this.validator]) {
        if (v.getKeyword(definition.keyword)) {
          if (options.override !== true) {
            throw new SchemaError('KEYWORD_EXISTS', 'Keyword already exists')
          }
          v.removeKeyword(definition.keyword)
        }
        v.addKeyword(definition)
      }
    } catch (e) {
      this.emit('warning', `Failed to define keyword '${definition.keyword}', ${e}`)
    }
  }

  /**
   * Loads schemas from directories matching glob patterns
   * @param {string|string[]} patterns Glob pattern(s) for schema directories
   * @param {Object} options Glob options
   * @param {string[]} options.ignore Patterns to exclude
   * @param {string} options.cwd Base directory for glob patterns
   */
  loadSchemas (patterns, options = {}) {
    if (!this._initialized) {
      this.init()
    }

    const globOptions = {
      cwd: options.cwd || process.cwd(),
      exclude: options.ignore || []
    }

    const patternList = Array.isArray(patterns) ? patterns : [patterns]
    const allFiles = []

    for (const pattern of patternList) {
      const files = globSync(pattern, globOptions)
      allFiles.push(...files.map(f => path.resolve(globOptions.cwd, f)))
    }

    // Deduplicate files
    const uniqueFiles = [...new Set(allFiles)]

    const results = uniqueFiles.map(f => {
      try {
        this.registerSchema(f)
      } catch (err) {
        return { status: 'rejected', reason: err }
      }
      return { status: 'fulfilled' }
    })

    results
      .filter(r => r.status === 'rejected')
      .forEach(r => this.emit('warning', r.reason))

    this.emit('schemasLoaded', Object.keys(this.schemas))
  }

  /**
   * Registers a single JSON schema for use
   * @param {string} filePath Path to the schema file
   * @param {Object} options Extra options
   * @param {boolean} options.replace Replace existing schema with same name
   * @returns {Schema}
   */
  registerSchema (filePath, options = {}) {
    if (!_.isString(filePath)) {
      throw new SchemaError('INVALID_PARAMS', 'filePath must be a string', { params: ['filePath'] })
    }

    const schema = this.createSchema(filePath, options)

    if (this.schemas[schema.name]) {
      if (options.replace) {
        this.deregisterSchema(schema.name)
      } else {
        throw new SchemaError('SCHEMA_EXISTS', `Schema '${schema.name}' already exists`, {
          schemaName: schema.name,
          filePath
        })
      }
    }

    this.schemas[schema.name] = schema

    // AJV's sync compile() can only resolve $refs against schemas in its internal store to allow `$ref: "schemaName`"
    // Note we only add simple schemas (no $merge/$patch)
    if (!schema.raw.$merge && !schema.raw.$patch) {
      for (const v of [this.validator, this.validatorWithDefaults]) {
        if (v.getSchema(schema.name)) v.removeSchema(schema.name)
        v.addSchema(schema.raw, schema.name)
      }
    }

    if (schema.raw.$patch) {
      this.extendSchema(schema.raw.$patch?.source?.$ref, schema.name)
    }

    this.emit('schemaRegistered', schema.name, filePath)
    return schema
  }

  /**
   * Deregisters a single JSON schema
   * @param {string} name Schema name to deregister
   */
  deregisterSchema (name) {
    delete this.schemas[name]
    for (const v of [this.validator, this.validatorWithDefaults]) {
      if (v.getSchema(name)) v.removeSchema(name)
    }
    delete this.schemaExtensions[name]
    for (const [base, extensions] of Object.entries(this.schemaExtensions)) {
      if (!extensions.includes(name)) continue
      this.schemaExtensions[base] = extensions.filter(s => s !== name)
      this.schemas[base]?.invalidateBuild()
    }
    this.emit('schemaDeregistered', name)
  }

  /**
   * Creates a new Schema instance
   * @param {string} filePath Path to the schema file
   * @param {Object} options Options passed to Schema constructor
   * @returns {Schema}
   */
  createSchema (filePath, options = {}) {
    const schema = new Schema({
      enableCache: options.enableCache ?? this.options.enableCache,
      filePath,
      validatorWithDefaults: this.validatorWithDefaults,
      validator: this.validator,
      xssWhitelist: this.xssWhitelist,
      schemaLibrary: this,
      ...options
    })

    return schema.load()
  }

  /**
   * Extends an existing schema with extra properties
   * @param {string} baseSchemaName The name of the schema to extend
   * @param {string} extSchemaName The name of the schema to extend with
   */
  extendSchema (baseSchemaName, extSchemaName) {
    if (!this.schemaExtensions[baseSchemaName]) {
      this.schemaExtensions[baseSchemaName] = []
    }
    if (!this.schemaExtensions[baseSchemaName].includes(extSchemaName)) {
      this.schemaExtensions[baseSchemaName].push(extSchemaName)
      this.schemas[baseSchemaName]?.invalidateBuild()
    }
    this.emit('schemaExtended', baseSchemaName, extSchemaName)
  }

  /**
   * Retrieves the specified schema
   * @param {string} schemaName The name of the schema to return
   * @param {Object} options
   * @param {boolean} options.useCache Use cached build if available
   * @param {boolean} options.compile Compile the schema (default: true)
   * @param {boolean} options.applyExtensions Apply extension schemas (default: true)
   * @param {function} options.extensionFilter Filter function for extensions
   * @returns {Schema}
   */
  getSchema (schemaName, options = {}) {
    const schema = this.schemas[schemaName]
    if (!schema) {
      throw new SchemaError('MISSING_SCHEMA', `Schema '${schemaName}' not found`, { schemaName })
    }
    return schema.build(options)
  }

  /**
   * Validates data against a named schema
   * @param {string} schemaName The schema name
   * @param {Object} data The data to validate
   * @param {Object} options Validation options
   * @returns {Object} The validated data with defaults applied
   */
  validate (schemaName, data, options = {}) {
    const schema = this.getSchema(schemaName)
    return schema.validate(data, options)
  }

  /**
   * Returns the built schema object
   * @param {string} schemaName The schema name
   * @param {Object} options Build options
   * @returns {Object} The built schema object
   */
  getBuiltSchema (schemaName, options = {}) {
    const schema = this.getSchema(schemaName)
    return schema.built
  }

  /**
   * Returns list of all registered schema names
   * @returns {string[]}
   */
  getSchemaNames () {
    return Object.keys(this.schemas)
  }

  /**
   * Returns information about all registered schemas
   * @returns {Object}
   */
  getSchemaInfo () {
    return Object.entries(this.schemas).reduce((info, [name, schema]) => {
      info[name] = {
        filePath: schema.filePath,
        extensions: this.schemaExtensions[name] ?? [],
        hasParent: !!schema.raw?.$merge?.source?.$ref,
        isPatch: !!schema.raw?.$patch
      }
      return info
    }, {})
  }
}

export default Schemas
