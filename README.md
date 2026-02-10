# adapt-schemas

A standalone JSON Schema library for the Adapt framework stack. Load schemas from plugin folders via glob patterns, validate JSON data, and extract defaults including `_globals` from course schemas.

## Installation

```bash
npm install adapt-schemas
```

## Quick Start

```javascript
import Schemas from 'adapt-schemas'

// Create and initialize the library
const library = new Schemas()
await library.init()

// Load schemas from plugin directories
await library.loadSchemas('**/schema/*.schema.json', {
  cwd: './plugins',
  ignore: ['**/node_modules/**']
})

// Validate data against a schema
const validatedData = await library.validate('course', {
  title: 'My Course'
})

// Get _globals defaults from the course schema
const globals = await library.getGlobalsDefaults('course')
```

## API Reference

### Schemas

#### Constructor Options

```javascript
const library = new Schemas({
  enableCache: true,              // Enable schema build caching (default: true)
  xssWhitelist: {},               // Custom XSS whitelist tags/attributes
  xssWhitelistOverride: false,    // Replace defaults instead of extending
  formatOverrides: {}             // Custom string format RegExp patterns
})
```

#### Methods

##### `init()`
Initializes the library and loads the base schema.

```javascript
await library.init()
```

##### `loadSchemas(patterns, options)`
Loads schemas from directories matching glob patterns.

```javascript
await library.loadSchemas('**/schema/*.schema.json', {
  cwd: './plugins',           // Base directory for patterns
  ignore: ['**/excluded/**']  // Patterns to exclude
})

// Multiple patterns
await library.loadSchemas([
  'core/**/schema/*.schema.json',
  'plugins/**/schema/*.schema.json'
], { ignore: ['**/node_modules/**'] })
```

##### `registerSchema(filePath, options)`
Registers a single schema file.

```javascript
await library.registerSchema('/path/to/schema.json', {
  replace: false  // Replace existing schema with same name
})
```

##### `getSchema(schemaName, options)`
Retrieves and builds a schema by name.

```javascript
const schema = await library.getSchema('course', {
  useCache: true,        // Use cached build if available
  compile: true,         // Compile the schema
  applyExtensions: true  // Apply $patch extensions
})
```

##### `getBuiltSchema(schemaName)`
Returns the built schema object.

```javascript
const schemaObj = await library.getBuiltSchema('course')
console.log(schemaObj.properties)
```

##### `validate(schemaName, data, options)`
Validates data against a named schema.

```javascript
const validated = await library.validate('course', inputData, {
  useDefaults: true,     // Apply schema defaults (default: true)
  ignoreRequired: false  // Ignore required field errors
})
```

##### `getSchemaDefaults(schemaName)`
Returns all defaults as a structured object.

```javascript
const defaults = await library.getSchemaDefaults('course')
// { title: 'Untitled', _globals: { ... } }
```

##### `getGlobalsDefaults(schemaName)`
Extracts `_globals` defaults from a schema.

```javascript
const globals = await library.getGlobalsDefaults('course')
// { _accessibility: { _isEnabled: true, ... }, _extensions: { ... } }
```

##### `getSchemaNames()`
Returns list of all registered schema names.

```javascript
const names = library.getSchemaNames()
// ['base', 'course', 'content', 'component', ...]
```

##### `getSchemaInfo()`
Returns information about all registered schemas.

```javascript
const info = library.getSchemaInfo()
// { course: { filePath: '...', extensions: [...], isPatch: false } }
```

##### `extendSchema(baseSchemaName, extSchemaName)`
Manually extends a schema with another.

```javascript
library.extendSchema('course', 'my-course-extension')
```

##### `addKeyword(definition, options)`
Adds a custom AJV keyword.

```javascript
library.addKeyword({
  keyword: 'isPositive',
  type: 'number',
  validate: (schema, data) => data > 0
})

// Override an existing keyword
library.addKeyword({
  keyword: 'isPositive',
  type: 'number',
  validate: (schema, data) => data >= 0
}, { override: true })
```

##### `deregisterSchema(name)`
Removes a schema from the registry.

```javascript
library.deregisterSchema('my-schema')
```

##### `addStringFormats(formats)`
Adds custom string format validators.

```javascript
library.addStringFormats({
  'phone': /^\+?[\d\s-]+$/
})
```

### Events

The library extends EventEmitter and emits the following events:

```javascript
library.on('initialized', () => { })
library.on('reset', () => { })
library.on('schemasLoaded', (schemaNames) => { })
library.on('schemaRegistered', (name, filePath) => { })
library.on('schemaDeregistered', (name) => { })
library.on('schemaExtended', (baseName, extName) => { })
library.on('warning', (message) => { })
```

## Schema Format

### Basic Schema with Inheritance

Schemas use `$merge` to inherit from a parent schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$anchor": "content",
  "$merge": {
    "source": { "$ref": "base" },
    "with": {
      "properties": {
        "title": {
          "type": "string",
          "default": ""
        },
        "body": {
          "type": "string",
          "default": ""
        }
      },
      "required": ["title"]
    }
  }
}
```

### Patch Schema (Extensions)

Use `$patch` to extend an existing schema without creating a new one:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$anchor": "course-trickle-extension",
  "$patch": {
    "source": { "$ref": "course" },
    "with": {
      "properties": {
        "_globals": {
          "type": "object",
          "properties": {
            "_trickle": {
              "type": "object",
              "properties": {
                "incompleteContent": {
                  "type": "string",
                  "default": "There is incomplete content above"
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Custom Keywords

The library includes these custom AJV keywords:

| Keyword | Description | Example |
|---------|-------------|---------|
| `isBytes` | Parses byte strings | `"1MB"` → `1048576` |
| `isDate` | Parses date strings | `"2024-01-01"` → `Date` |
| `isTimeMs` | Parses duration strings | `"7d"` → `604800000` |
| `isObjectId` | Marks ObjectId fields | No transformation |

## Error Handling

The library throws `SchemaError` with the following codes:

| Code | Description |
|------|-------------|
| `INVALID_PARAMS` | Invalid method parameters |
| `SCHEMA_EXISTS` | Schema with same name already registered |
| `SCHEMA_LOAD_FAILED` | Failed to read/parse schema file |
| `INVALID_SCHEMA` | Schema fails JSON Schema validation |
| `MISSING_SCHEMA` | Requested schema not found |
| `VALIDATION_FAILED` | Data fails schema validation |
| `KEYWORD_EXISTS` | Keyword already defined |
| `MODIFY_PROTECTED_ATTR` | Attempt to modify internal/read-only field |

```javascript
import { SchemaError } from 'adapt-schemas'

try {
  await library.validate('course', data)
} catch (e) {
  if (e instanceof SchemaError) {
    console.log(e.code)    // 'VALIDATION_FAILED'
    console.log(e.data)    // { schemaName, errors, data }
  }
}
```

## License

MIT
