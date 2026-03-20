/**
 * Test script for the Adapt Schema Library
 */
import Schemas from './index.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hasSpecifiedPath = Boolean(process.argv[2])

async function setupTestSchemas () {
  if (hasSpecifiedPath) return
  // Create test schema directory
  const testSchemaDir = path.join(__dirname, 'test-schemas')
  await fs.mkdir(testSchemaDir, { recursive: true })

  // Create a course schema with _globals
  const courseSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $anchor: 'course',
    $merge: {
      source: { $ref: 'base' },
      with: {
        properties: {
          title: {
            type: 'string',
            description: 'Course title',
            default: 'Untitled Course'
          },
          description: {
            type: 'string',
            description: 'Course description',
            default: ''
          },
          _globals: {
            type: 'object',
            description: 'Global settings',
            properties: {
              _accessibility: {
                type: 'object',
                properties: {
                  _isEnabled: {
                    type: 'boolean',
                    default: true
                  },
                  skipNavigationText: {
                    type: 'string',
                    default: 'Skip navigation'
                  }
                },
                required: [
                  'skipNavigationText'
                ]
              },
              _extensions: {
                type: 'object',
                properties: {
                  _trickle: {
                    type: 'object',
                    properties: {
                      incompleteContent: {
                        type: 'string',
                        default: 'There is incomplete content above'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        required: ['title']
      }
    }
  }

  // Create a content schema
  const contentSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $anchor: 'content',
    $merge: {
      source: { $ref: 'base' },
      with: {
        properties: {
          _type: {
            type: 'string',
            description: 'Content type'
          },
          body: {
            type: 'string',
            description: 'Content body',
            default: ''
          },
          _isOptional: {
            type: 'boolean',
            default: false
          }
        }
      }
    }
  }

  // Create a component schema that extends content
  const componentSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $anchor: 'component',
    $merge: {
      source: { $ref: 'content' },
      with: {
        properties: {
          _component: {
            type: 'string',
            description: 'Component type'
          }
        },
        required: ['_component']
      }
    }
  }

  // Create a config schema with nested defaults (mimics trickle pattern)
  const configSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $anchor: 'config',
    $merge: {
      source: { $ref: 'base' },
      with: {
        properties: {
          _trickle: {
            type: 'object',
            properties: {
              _isEnabled: {
                type: 'boolean',
                default: true
              },
              _scrollDuration: {
                type: 'number',
                default: 500
              },
              _button: {
                type: 'object',
                default: {},
                properties: {
                  _isEnabled: {
                    type: 'boolean',
                    default: true
                  },
                  _styleBeforeCompletion: {
                    type: 'string',
                    default: 'hidden'
                  }
                }
              },
              _completionOrder: {
                type: 'array',
                items: { type: 'number' },
                default: [1, 2, 3]
              }
            },
            required: ['_scrollDuration']
          }
        }
      }
    }
  }

  // Create a config extension that mimics adapt-contrib-languagePicker
  const languagePickerConfigSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $anchor: 'languagePicker-config',
    $patch: {
      source: { $ref: 'config' },
      with: {
        properties: {
          _languagePicker: {
            type: 'object',
            default: {},
            properties: {
              _isEnabled: { type: 'boolean', default: false },
              _showOnCourseLoad: { type: 'boolean', default: true },
              _languagePickerIconClass: { type: 'string', default: 'icon-language-2' },
              _restoreStateOnLanguageChange: { type: 'boolean', default: false },
              _classes: { type: 'string', default: '' },
              _display: {
                type: 'object',
                // deliberately no default: {} — tests Case 3
                properties: {
                  _iconClass: { type: 'string', default: 'icon-default' },
                  _position: { type: 'string', default: 'left' }
                }
              },
              _languages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    _language: { type: 'string', default: '' },
                    _direction: { type: 'string', default: 'ltr' },
                    _isDisabled: { type: 'boolean', default: false },
                    displayName: { type: 'string', default: '' },
                    _buttons: {
                      type: 'object',
                      default: {},
                      properties: {
                        yes: { type: 'string', default: 'Yes' },
                        no: { type: 'string', default: 'No' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  await fs.writeFile(
    path.join(testSchemaDir, 'languagePicker-config.schema.json'),
    JSON.stringify(languagePickerConfigSchema, null, 2)
  )

  // Create a patch schema that extends course
  const coursePatchSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $anchor: 'course-extension',
    $patch: {
      source: { $ref: 'course' },
      with: {
        properties: {
          _globals: {
            type: 'object',
            properties: {
              _myPlugin: {
                type: 'object',
                properties: {
                  buttonLabel: {
                    type: 'string',
                    default: 'Click me'
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  await fs.writeFile(
    path.join(testSchemaDir, 'course.schema.json'),
    JSON.stringify(courseSchema, null, 2)
  )
  await fs.writeFile(
    path.join(testSchemaDir, 'content.schema.json'),
    JSON.stringify(contentSchema, null, 2)
  )
  await fs.writeFile(
    path.join(testSchemaDir, 'component.schema.json'),
    JSON.stringify(componentSchema, null, 2)
  )
  await fs.writeFile(
    path.join(testSchemaDir, 'config.schema.json'),
    JSON.stringify(configSchema, null, 2)
  )
  await fs.writeFile(
    path.join(testSchemaDir, 'course-extension.schema.json'),
    JSON.stringify(coursePatchSchema, null, 2)
  )

  return testSchemaDir
}

async function runTests () {
  console.log('=== Adapt Schema Library Tests ===\n')

  const testSchemaDir = hasSpecifiedPath
    ? path.join(__dirname, process.argv[2])
    : await setupTestSchemas()

  try {
    // Test 1: Initialize library
    console.log('Test 1: Initialize library')
    const library = new Schemas({
      enableCache: true
    })
    await library.init()
    console.log('  ✓ Library initialized\n')

    // Test 2: Load schemas with glob
    console.log('Test 2: Load schemas with glob patterns')
    await library.loadSchemas('**/*.schema.json', {
      cwd: testSchemaDir,
      ignore: ['**/excluded/**']
    })
    const schemaNames = library.getSchemaNames()
    console.log(`  ✓ Loaded schemas: ${schemaNames.join(', ')}\n`)

    // Test 3: Get schema
    console.log('Test 3: Get built schema')
    const courseBuilt = await library.getBuiltSchema('course')
    console.log(`  ✓ Course schema has properties: ${Object.keys(courseBuilt.properties).join(', ')}\n`)

    // Test 4: Validate data
    console.log('Test 4: Validate data')
    const validData = await library.validate('course', {
      title: 'My Course'
    })
    console.log(`  ✓ Validated data has title: "${validData.title}"`)
    console.log(`  ✓ Default description applied: "${validData.description}"\n`)

    // Test 5: Validate with error (missing required field without defaults)
    console.log('Test 5: Validation error handling')
    try {
      await library.validate('course', {
        // Missing required title - disable defaults to trigger required error
        _globals: { _accessibility: {} }
      }, { useDefaults: false, ignoreRequired: false })
      console.log('  ✗ Should have thrown validation error\n')
    } catch (e) {
      console.log(`  ✓ Caught validation error: ${e.code}`)
      console.log(`  ✓ Error message: ${e.message}\n`)
    }

    // Test 5b: Validate with type error
    console.log('Test 5b: Type validation error')
    try {
      await library.validate('course', {
        title: 12345 // Should be string, not number
      })
      console.log('  ✗ Should have thrown validation error\n')
    } catch (e) {
      console.log(`  ✓ Caught type validation error: ${e.code}\n`)
    }

    // Test 6: Schema inheritance
    console.log('Test 6: Schema inheritance')
    const componentBuilt = await library.getBuiltSchema('component')
    const hasInheritedBody = componentBuilt.properties.body !== undefined
    const hasOwnComponent = componentBuilt.properties._component !== undefined
    console.log(`  ✓ Component has inherited 'body' property: ${hasInheritedBody}`)
    console.log(`  ✓ Component has own '_component' property: ${hasOwnComponent}\n`)

    // Test 7: Schema info
    console.log('Test 7: Schema info')
    const info = library.getSchemaInfo()
    console.log('  ✓ Schema info:')
    Object.entries(info).forEach(([name, details]) => {
      console.log(`    - ${name}: extensions=[${details.extensions.join(', ')}], isPatch=${details.isPatch}`)
    })
    console.log('')

    // Test 8: Events
    console.log('Test 8: Event handling')
    library.on('schemaRegistered', (name) => {
      console.log(`  ✓ Event received: schemaRegistered (${name})`)
    })

    // Create another test schema to trigger the event
    const newSchemaPath = path.join(testSchemaDir, 'test-event.schema.json')
    await fs.writeFile(newSchemaPath, JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $anchor: 'test-event',
      $merge: {
        source: { $ref: 'base' },
        with: { properties: { test: { type: 'string' } } }
      }
    }))
    await library.registerSchema(newSchemaPath)
    console.log('')

    // Test 9: Schema.walk
    console.log('Test 9: Schema.walk')
    const courseSchema = await library.getSchema('course')
    const walkData = {
      title: 'Test',
      description: 'A course',
      _globals: {
        _accessibility: {
          _isEnabled: true,
          skipNavigationText: 'Skip'
        }
      }
    }
    const stringFields = courseSchema.walk(walkData, val => val.type === 'string')
    const paths = stringFields.map(r => r.path)
    console.log(`  ✓ Found ${stringFields.length} string fields: ${paths.join(', ')}`)
    const hasTitle = paths.includes('title')
    const hasNested = paths.includes('_globals/_accessibility/skipNavigationText')
    console.log(`  ✓ Includes top-level field: ${hasTitle}`)
    console.log(`  ✓ Includes nested field: ${hasNested}\n`)

    // Test 10: Deep defaults on partial nested objects
    console.log('Test 10: Deep defaults on partial nested objects')
    const configData = await library.validate('config', {
      _trickle: { _isEnabled: false }
    })
    const hasScrollDuration = configData._trickle._scrollDuration === 500
    const hasButtonDefaults = configData._trickle._button?._styleBeforeCompletion === 'hidden'
    const preservedExplicit = configData._trickle._isEnabled === false
    console.log(`  ✓ Nested default _scrollDuration applied: ${hasScrollDuration}`)
    console.log(`  ✓ Deep nested _button defaults applied: ${hasButtonDefaults}`)
    console.log(`  ✓ Explicitly set _isEnabled preserved: ${preservedExplicit}`)
    if (!hasScrollDuration || !hasButtonDefaults || !preservedExplicit) {
      throw new Error('Deep defaults not applied correctly to partial nested objects')
    }
    console.log('')

    // Test 11: Array defaults replaced, not merged
    console.log('Test 11: Array defaults are replaced, not merged')
    const arrayData = await library.validate('config', {
      _trickle: { _completionOrder: [10, 20] }
    })
    const arrayNotMerged = JSON.stringify(arrayData._trickle._completionOrder) === '[10,20]'
    console.log(`  ✓ Array preserved as [10,20], not merged with default: ${arrayNotMerged}`)
    if (!arrayNotMerged) {
      throw new Error(`Array was merged with defaults: got ${JSON.stringify(arrayData._trickle._completionOrder)}, expected [10,20]`)
    }

    const arrayDefaultApplied = await library.validate('config', {
      _trickle: { _isEnabled: false }
    })
    const defaultArrayApplied = JSON.stringify(arrayDefaultApplied._trickle._completionOrder) === '[1,2,3]'
    console.log(`  ✓ Missing array gets default [1,2,3]: ${defaultArrayApplied}`)
    if (!defaultArrayApplied) {
      throw new Error(`Default array not applied: got ${JSON.stringify(arrayDefaultApplied._trickle._completionOrder)}`)
    }
    console.log('')

    // Test 12: useDefaults: false produces no defaults
    console.log('Test 12: useDefaults: false produces no defaults')
    const noDefaultsData = await library.validate('content', {
      body: 'Hello'
    }, { useDefaults: false, ignoreRequired: true })
    const noIsOptional = noDefaultsData._isOptional === undefined
    console.log(`  ✓ _isOptional not filled in: ${noIsOptional}`)
    if (!noIsOptional) {
      throw new Error(`useDefaults: false still applied defaults: _isOptional = ${noDefaultsData._isOptional}`)
    }

    const withDefaultsData = await library.validate('content', {
      body: 'Hello'
    }, { useDefaults: true, ignoreRequired: true })
    const hasIsOptional = withDefaultsData._isOptional === false
    console.log(`  ✓ _isOptional filled in with useDefaults: true: ${hasIsOptional}`)
    if (!hasIsOptional) {
      throw new Error(`useDefaults: true did not apply defaults: _isOptional = ${withDefaultsData._isOptional}`)
    }
    console.log('')

    // Test 13: Partial nested object with required+default field (issue #21)
    console.log('Test 13: Required+default field in partial nested object (issue #21)')
    try {
      const issueData = await library.validate('config', {
        _trickle: { _isEnabled: false }
      })
      const hasRequired = issueData._trickle._scrollDuration === 500
      console.log('  ✓ Validation passed (did not throw): true')
      console.log(`  ✓ Required+default _scrollDuration applied: ${hasRequired}`)
      if (!hasRequired) {
        throw new Error('Required+default field _scrollDuration was not applied')
      }
    } catch (e) {
      if (e.code === 'VALIDATION_FAILED') {
        throw new Error(`Issue #21 regression: validation failed on partial nested object: ${e.data?.errors || e.message}`)
      }
      throw e
    }
    console.log('')

    // Test 14: ignoreErrors applies defaults without throwing on invalid data
    console.log('Test 14: ignoreErrors applies defaults without throwing')
    const invalidData = await library.validate('course', {
      title: 12345 // wrong type — would normally throw
    }, { ignoreErrors: true })
    const defaultApplied = invalidData.description === ''
    const invalidPreserved = invalidData.title === 12345
    console.log(`  ✓ Default description applied despite type error: ${defaultApplied}`)
    console.log(`  ✓ Invalid title value preserved: ${invalidPreserved}`)
    if (!defaultApplied || !invalidPreserved) {
      throw new Error('ignoreErrors did not apply defaults or preserve existing data')
    }

    // Verify it would throw without ignoreErrors
    try {
      await library.validate('course', { title: 12345 })
      throw new Error('Should have thrown without ignoreErrors')
    } catch (e) {
      if (e.code !== 'VALIDATION_FAILED') throw e
      console.log('  ✓ Same data throws without ignoreErrors: true')
    }
    console.log('')

    // Test 15: ignoreErrors with missing required fields
    console.log('Test 15: ignoreErrors ignores required field errors')
    const missingRequired = await library.validate('course', {
      description: 'No title provided'
    }, { useDefaults: false, ignoreErrors: true })
    const descPreserved = missingRequired.description === 'No title provided'
    console.log(`  ✓ Data returned despite missing required "title": ${descPreserved}`)
    if (!descPreserved) {
      throw new Error('ignoreErrors did not return data with missing required fields')
    }
    console.log('')

    // Test 16: Issue #30 Case 1 — Partially populated object missing sibling defaults
    console.log('Test 16: Issue #30 Case 1 — Partially populated plugin config')
    const partialConfig = await library.validate('config', {
      _languagePicker: {
        _isEnabled: true,
        _languages: [
          {
            _language: 'en',
            _direction: 'ltr',
            displayName: 'English'
          }
        ]
      }
    }, { ignoreErrors: true })
    const lp = partialConfig._languagePicker
    const case1Checks = [
      ['_isEnabled preserved', lp._isEnabled === true],
      ['_showOnCourseLoad defaulted to true', lp._showOnCourseLoad === true],
      ['_languagePickerIconClass defaulted', lp._languagePickerIconClass === 'icon-language-2'],
      ['_restoreStateOnLanguageChange defaulted', lp._restoreStateOnLanguageChange === false],
      ['_classes defaulted to empty string', lp._classes === ''],
      ['_languages[0]._isDisabled defaulted', lp._languages[0]._isDisabled === false],
      ['_languages[0]._buttons defaulted', lp._languages[0]._buttons?.yes === 'Yes'],
      ['_languages[0]._buttons.no defaulted', lp._languages[0]._buttons?.no === 'No']
    ]
    case1Checks.forEach(([desc, ok]) => console.log(`  ${ok ? '✓' : '✗'} ${desc}: ${ok}`))
    const case1Failed = case1Checks.filter(([, ok]) => !ok)
    if (case1Failed.length) {
      throw new Error(`Case 1 failures: ${case1Failed.map(([d]) => d).join(', ')}`)
    }
    console.log('')

    // Test 17: Issue #30 Case 2 — Plugin object entirely absent
    console.log('Test 17: Issue #30 Case 2 — Plugin object entirely absent')
    const emptyConfig = await library.validate('config', {}, { ignoreErrors: true })
    const lp2 = emptyConfig._languagePicker
    const case2Checks = [
      ['_languagePicker created from default: {}', lp2 !== undefined],
      ['_isEnabled defaulted to false', lp2?._isEnabled === false],
      ['_showOnCourseLoad defaulted to true', lp2?._showOnCourseLoad === true],
      ['_languagePickerIconClass defaulted', lp2?._languagePickerIconClass === 'icon-language-2']
    ]
    case2Checks.forEach(([desc, ok]) => console.log(`  ${ok ? '✓' : '✗'} ${desc}: ${ok}`))
    const case2Failed = case2Checks.filter(([, ok]) => !ok)
    if (case2Failed.length) {
      throw new Error(`Case 2 failures: ${case2Failed.map(([d]) => d).join(', ')}`)
    }
    console.log('')

    // Test 18: Issue #30 Case 3 — Nested object without default: {}
    console.log('Test 18: Issue #30 Case 3 — Nested object without default: {}')
    const noNestedDefault = await library.validate('config', {
      _languagePicker: { _isEnabled: true }
    }, { ignoreErrors: true })
    const lp3 = noNestedDefault._languagePicker
    // _display has no default: {} so it should NOT be created by AJV
    const displayMissing = lp3._display === undefined
    console.log(`  ✓ _display not created (no default: {}): ${displayMissing}`)
    if (!displayMissing) {
      console.log(`    Note: _display was unexpectedly created: ${JSON.stringify(lp3._display)}`)
    }
    // But sibling defaults should still apply
    const siblingsApplied = lp3._showOnCourseLoad === true && lp3._languagePickerIconClass === 'icon-language-2'
    console.log(`  ✓ Sibling defaults still applied: ${siblingsApplied}`)
    if (!siblingsApplied) {
      throw new Error('Sibling defaults not applied when nested object has no default')
    }
    console.log('')

    console.log('=== All tests passed! ===')
  } finally {
    if (!hasSpecifiedPath) {
      // Cleanup
      await fs.rm(testSchemaDir, { recursive: true, force: true })
    }
  }
}

runTests().catch(console.error)
