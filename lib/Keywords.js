import bytes from 'bytes'
import ms from 'ms'

/**
 * Custom JSON schema keywords for AJV
 */
class Keywords {
  /**
   * Returns all custom keywords
   * @returns {Object[]} Array of AJV keyword definitions
   */
  static all () {
    const keywords = {
      /**
       * Parses byte string values (e.g., "1MB" -> 1048576)
       */
      isBytes: function () {
        return (value, { parentData, parentDataProperty }) => {
          if (value === false) return false
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
          if (value === false) return false
          try {
            parentData[parentDataProperty] = new Date(value)
            return true
          } catch (e) {
            return false
          }
        }
      },

      /**
       * Parses time duration strings into milliseconds (e.g., "7d" -> 604800000)
       */
      isTimeMs: function () {
        return (value, { parentData, parentDataProperty }) => {
          if (value === false) return false
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
      isObjectId: function (value) {
        return () => value
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
