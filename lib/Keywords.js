import bytes from 'bytes'
import ms from 'ms'
import path from 'path'

/**
 * Custom JSON schema keywords for AJV
 */
class Keywords {
  /**
   * Returns all custom keywords
   * @param {Object} directoryReplacements Replacements for isDirectory (e.g. { '$ROOT': '/app' })
   * @returns {Object[]} Array of AJV keyword definitions
   */
  static all(directoryReplacements = {}) {
    const keywords = {
      /**
       * Parses byte string values (e.g., "1MB" -> 1048576)
       */
      isBytes: function () {
        return (value, { parentData, parentDataProperty }) => {
          try {
            parentData[parentDataProperty] = bytes.parse(value)
            return true
          } catch (e) {
            return false
          }
        }
      },

      /**
       * Parses date string values into Date objects
       */
      isDate: function () {
        return (value, { parentData, parentDataProperty }) => {
          try {
            parentData[parentDataProperty] = new Date(value)
            return true
          } catch (e) {
            return false
          }
        }
      },

      /**
       * Resolves directory path tokens ($ROOT, $DATA, $TEMP, etc.)
       */
      isDirectory: function () {
        const doReplace = value => {
          const replacements = Object.entries(directoryReplacements)
          return replacements.reduce((m, [k, v]) => {
            return m.startsWith(k) ? path.resolve(v, m.replace(k, '').slice(1)) : m
          }, value)
        }
        return (value, { parentData, parentDataProperty }) => {
          try {
            parentData[parentDataProperty] = doReplace(value)
          } catch (e) {
            // Keep original value on error
          }
          return true
        }
      },

      /**
       * Parses time duration strings into milliseconds (e.g., "7d" -> 604800000)
       */
      isTimeMs: function () {
        return (value, { parentData, parentDataProperty }) => {
          try {
            parentData[parentDataProperty] = ms(value)
            return true
          } catch (e) {
            return false
          }
        }
      },

      /**
       * Marker for ObjectId fields (no transformation, just marks the field)
       */
      isObjectId: function () {
        return () => true
      }
    }

    return Object.entries(keywords).map(([keyword, compile]) => {
      return {
        keyword,
        type: 'string',
        modifying: true,
        schemaType: 'boolean',
        compile
      }
    })
  }
}

export default Keywords
