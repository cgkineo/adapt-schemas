import _ from 'lodash'
import { EventEmitter } from 'events'
import fs from 'fs/promises'
import SchemaError from './SchemaError.js'
import xss from 'xss'

const BASE_SCHEMA_NAME = 'base'

/**
 * Represents an individual JSON schema with validation and build capabilities
 */
class Schema extends EventEmitter {
  /**
   * @param {Object} options
   * @param {boolean} options.enableCache Enable caching for this schema
   * @param {string} options.filePath Path to the schema file
   * @param {Ajv} options.validator Reference to the AJV validator
   * @param {Object} options.xssWhitelist XSS whitelist configuration
   * @param {SchemaLibrary} options.schemaLibrary Reference to the parent library
   */
  constructor ({ enableCache, filePath, validator, xssWhitelist, schemaLibrary }) {
    super()

    /**
     * The raw built JSON schema
     * @type {Object}
     */
    this.built = undefined

    /**
     * The compiled schema validation function
     * @type {function}
     */
    this.compiled = undefined

    /**
     * Whether caching is enabled for this schema
     * @type {boolean}
     */
    this.enableCache = enableCache

    /**
     * List of extensions for this schema
     * @type {string[]}
     */
    this.extensions = []

    /**
     * File path to the schema
     * @type {string}
     */
    this.filePath = filePath

    /**
     * Whether the schema is currently building
     * @type {boolean}
     */
    this.isBuilding = false

    /**
     * The last build time (in milliseconds)
     * @type {number}
     */
    this.lastBuildTime = undefined

    /**
     * The raw schema data for this schema (with no inheritance/extensions)
     * @type {Object}
     */
    this.raw = undefined

    /**
     * The schema name (from $anchor)
     * @type {string}
     */
    this.name = undefined

    /**
     * Reference to the Ajv validator instance
     * @type {Ajv}
     */
    this.validator = validator

    /**
     * Reference to the local XSS sanitiser instance
     * @type {Object}
     */
    this.xss = new xss.FilterXSS({ whiteList: xssWhitelist })

    /**
     * Reference to the parent schema library
     * @type {SchemaLibrary}
     */
    this.schemaLibrary = schemaLibrary

    /**
     * Callbacks waiting for build completion
     * @type {function[]}
     */
    this._buildCallbacks = []
  }

  /**
   * Determines whether the current schema build is valid using last modification timestamp
   * @returns {Promise<boolean>}
   */
  async isBuildValid () {
    if (!this.built) return false

    let schema = this
    while (schema) {
      const { mtimeMs } = await fs.stat(schema.filePath)
      if (mtimeMs > this.lastBuildTime) return false
      schema = await schema.getParent()
    }
    return true
  }

  /**
   * Returns the parent schema if $merge is defined (or the base schema if a root schema)
   * @returns {Promise<Schema|undefined>}
   */
  async getParent () {
    if (this.name === BASE_SCHEMA_NAME) return undefined

    const parentRef = this.raw?.$merge?.source?.$ref ?? BASE_SCHEMA_NAME
    return await this.schemaLibrary.getSchema(parentRef)
  }

  /**
   * Loads the schema file
   * @returns {Promise<Schema>} This instance
   */
  async load () {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8')
      this.raw = JSON.parse(content)
      this.name = this.raw.$anchor
    } catch (e) {
      throw new SchemaError('SCHEMA_LOAD_FAILED', `Failed to load schema: ${this.filePath}`, {
        schemaName: this.filePath,
        error: e.message
      })
    }

    if (this.validator.validateSchema(this.raw)?.errors) {
      const errors = this.validator.errors
        .map(e => e.instancePath ? `${e.instancePath} ${e.message}` : e.message)

      if (errors.length) {
        throw new SchemaError('INVALID_SCHEMA', `Invalid schema: ${this.name}`, {
          schemaName: this.name,
          errors: errors.join(', ')
        })
      }
    }

    return this
  }

  /**
   * Builds and compiles the schema from the $merge and $patch schemas
   * @param {Object} options
   * @param {boolean} options.useCache Use cached build if available
   * @param {boolean} options.compile Compile the schema (default: true)
   * @param {boolean} options.applyExtensions Apply extension schemas (default: true)
   * @param {function} options.extensionFilter Filter function for extensions
   * @returns {Promise<Schema>}
   */
  async build (options = {}) {
    if (options.useCache !== false && this.enableCache && await this.isBuildValid()) {
      return this
    }

    if (this.isBuilding) {
      return new Promise(resolve => this._buildCallbacks.push(() => resolve(this)))
    }

    this.isBuilding = true

    const { applyExtensions, extensionFilter } = options

    let built = _.cloneDeep(this.raw)
    let parent = await this.getParent()

    while (parent) {
      const parentBuilt = _.cloneDeep((await parent.build({ ...options, compile: false })).built)
      built = this.patch(parentBuilt, built, { strict: false })
      parent = await parent.getParent()
    }

    if (this.extensions.length) {
      await Promise.all(this.extensions.map(async s => {
        const applyPatch = typeof extensionFilter === 'function' ? extensionFilter(s) : applyExtensions !== false
        if (applyPatch) {
          const extSchema = await this.schemaLibrary.getSchema(s)
          this.patch(built, extSchema.raw, { extendAnnotations: false })
        }
      }))
    }

    this.built = built

    if (options.compile !== false) {
      this.compiled = await this.validator.compileAsync(built)
    }

    this.isBuilding = false
    this.lastBuildTime = Date.now()

    // Notify waiting callbacks
    this._buildCallbacks.forEach(cb => cb())
    this._buildCallbacks = []

    this.emit('built', this)
    return this
  }

  /**
   * Applies a patch schema to another schema
   * @param {Object} baseSchema The base schema to apply the patch
   * @param {Object} patchSchema The patch schema to apply to the base
   * @param {Object} options
   * @param {boolean} options.extendAnnotations Extend $anchor, title, description
   * @param {boolean} options.overwriteProperties Overwrite existing properties
   * @param {boolean} options.strict Require $patch or $merge
   * @returns {Object} The base schema
   */
  patch (baseSchema, patchSchema, options = {}) {
    const opts = _.defaults(options, {
      extendAnnotations: patchSchema.$anchor !== BASE_SCHEMA_NAME,
      overwriteProperties: true,
      strict: true
    })

    const patchData = patchSchema.$patch?.with ?? patchSchema.$merge?.with ?? (!opts.strict && patchSchema)

    if (!patchData) {
      throw new SchemaError('INVALID_SCHEMA', `Invalid patch schema: ${patchSchema.$anchor}`, {
        schemaName: patchSchema.$anchor
      })
    }

    if (opts.extendAnnotations) {
      ['$anchor', 'title', 'description'].forEach(p => {
        if (patchSchema[p]) baseSchema[p] = patchSchema[p]
      })
    }

    if (patchData.properties) {
      const mergeFunc = opts.overwriteProperties ? _.merge : _.defaultsDeep
      mergeFunc(baseSchema.properties, patchData.properties)
    }

    ['allOf', 'anyOf', 'oneOf'].forEach(p => {
      if (patchData[p]?.length) {
        baseSchema[p] = (baseSchema[p] ?? []).concat(_.cloneDeep(patchData[p]))
      }
    })

    if (patchData.required) {
      baseSchema.required = _.uniq([...(baseSchema.required ?? []), ...patchData.required])
    }

    return baseSchema
  }

  /**
   * Validates data against the schema
   * @param {Object} dataToValidate The data to be validated
   * @param {Object} options
   * @param {boolean} options.useDefaults Apply schema defaults (default: true)
   * @param {boolean} options.ignoreRequired Ignore required field errors
   * @returns {Object} The validated data
   */
  validate (dataToValidate, options = {}) {
    const opts = _.defaults(options, { useDefaults: true, ignoreRequired: false })
    const data = _.defaults(_.cloneDeep(dataToValidate), opts.useDefaults ? this.getObjectDefaults() : {})

    if (!this.compiled) {
      this.emit('warning', `No compiled function for ${this.name}, compiling now`)
      this.validator.compile(this.built)
    }

    this.compiled(data)

    const errors = this.compiled.errors && this.compiled.errors
      .filter(e => e.keyword === 'required' ? !opts.ignoreRequired : true)
      .map(e => e.instancePath ? `${e.instancePath} ${e.message}` : e.message)
      .reduce((s, e) => `${s}${e}, `, '')

    if (errors?.length) {
      throw new SchemaError('VALIDATION_FAILED', `Validation failed for schema: ${this.name}`, {
        schemaName: this.name,
        errors,
        data
      })
    }

    return data
  }

  /**
   * Sanitises data by removing attributes according to the context
   * @param {Object} dataToSanitise The data to be sanitised
   * @param {Object} options
   * @param {boolean} options.isInternal Filter internal attributes
   * @param {boolean} options.isReadOnly Filter read-only attributes
   * @param {boolean} options.sanitiseHtml Apply XSS sanitization
   * @param {boolean} options.strict Throw on protected attribute modification
   * @param {Object} schema Schema to use (defaults to built schema)
   * @returns {Object} The sanitised data
   */
  sanitise (dataToSanitise, options = {}, schema) {
    const opts = _.defaults(options, {
      isInternal: false,
      isReadOnly: false,
      sanitiseHtml: true,
      strict: true
    })

    schema = schema ?? this.built
    const sanitised = {}

    for (const prop in schema.properties) {
      const schemaData = schema.properties[prop]
      const value = dataToSanitise[prop]
      const ignore = (opts.isInternal && schemaData.isInternal) || (opts.isReadOnly && schemaData.isReadOnly)

      if (value === undefined || (ignore && !opts.strict)) {
        continue
      }

      if (ignore && opts.strict) {
        throw new SchemaError('MODIFY_PROTECTED_ATTR', `Cannot modify protected attribute: ${prop}`, {
          attribute: prop,
          value
        })
      }

      sanitised[prop] = schemaData.type === 'object' && schemaData.properties
        ? this.sanitise(value, opts, schemaData)
        : schemaData.type === 'string' && opts.sanitiseHtml
          ? this.xss.process(value)
          : value
    }

    return sanitised
  }

  /**
   * Adds an extension schema
   * @param {string} extSchemaName Extension schema name
   */
  addExtension (extSchemaName) {
    if (!this.extensions.includes(extSchemaName)) {
      this.extensions.push(extSchemaName)
    }
  }

  /**
   * Returns all schema defaults as a correctly structured object
   * @param {Object} schema Schema to extract defaults from
   * @returns {Object} The defaults object
   */
  getObjectDefaults (schema) {
    schema = schema ?? this.built
    const props = schema.properties ?? schema.$merge?.with?.properties ?? schema.$patch?.with?.properties

    return _.mapValues(props, s => {
      return s.type === 'object' && s.properties
        ? this.getObjectDefaults(s)
        : s.default
    })
  }

  /**
   * Walks the built schema alongside data, returning fields matching a predicate.
   * @param {Object} data - The data object to walk
   * @param {Function} predicate - `(schemaField) => boolean`
   * @param {Object} [schema] - Internal: schema properties to walk (defaults to built.properties)
   * @param {string} [parentPath=''] - Internal: the slash-delimited path accumulated so far
   * @returns {Array<Object>} Array of `{ path, key, data, value }` matches
   */
  walk (data, predicate, schema, parentPath = '') {
    schema = schema ?? this.built.properties
    const matches = []
    for (const [key, val] of Object.entries(schema)) {
      if (data[key] === undefined) continue
      const currentPath = parentPath ? `${parentPath}/${key}` : key
      if (val.properties) {
        matches.push(...this.walk(data[key], predicate, val.properties, currentPath))
      } else if (val?.items?.properties) {
        data[key].forEach((item, i) => {
          matches.push(...this.walk(item, predicate, val.items.properties, `${currentPath}/${i}`))
        })
      } else if (predicate(val)) {
        matches.push({ path: currentPath, key, data, value: data[key] })
      }
    }
    return matches
  }
}

export default Schema
