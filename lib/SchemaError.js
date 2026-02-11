/**
 * Schema-specific error class
 */
class SchemaError extends Error {
  constructor (code, message, data = {}) {
    super(message)
    this.code = code
    this.data = data
    this.name = 'SchemaError'
  }
}

export default SchemaError
