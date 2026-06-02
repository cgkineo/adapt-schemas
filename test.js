/**
 * Test script for the Adapt Schema Library
 */
import Schemas, { XSSDefaults } from './index.js'
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

  // Schema used for XSS sanitization tests — string fields at top level
  // and nested inside an object so sanitise() recursion is exercised.
  const xssTestSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $anchor: 'xss-test',
    $merge: {
      source: { $ref: 'base' },
      with: {
        properties: {
          body: { type: 'string', default: '' },
          title: { type: 'string', default: '' },
          count: { type: 'number', default: 0 },
          meta: {
            type: 'object',
            properties: {
              description: { type: 'string', default: '' },
              author: { type: 'string', default: '' }
            }
          }
        }
      }
    }
  }

  await fs.writeFile(
    path.join(testSchemaDir, 'xss-test.schema.json'),
    JSON.stringify(xssTestSchema, null, 2)
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

    // Test 19: XSS sanitization — dangerous content is stripped or escaped
    console.log('Test 19: XSS sanitization — dangerous payloads')
    const xssSchema = await library.getSchema('xss-test')
    const sanitiseBody = input => xssSchema.sanitise({ body: input }, { sanitiseHtml: true, strict: false }).body

    const dangerousCases = [
      {
        desc: '<script> tag escaped',
        input: '<script>alert(1)</script>',
        check: out => !/<script/i.test(out) && !out.includes('alert(1)</script>')
      },
      {
        desc: 'onerror handler stripped from <img>',
        input: '<img src=x onerror="alert(1)">',
        check: out => !/onerror/i.test(out)
      },
      {
        desc: 'onclick handler stripped from allowed <a>',
        input: '<a href="https://example.com" onclick="evil()">link</a>',
        check: out => !/onclick/i.test(out) && out.includes('example.com')
      },
      {
        desc: 'javascript: URL stripped from <a href>',
        input: '<a href="javascript:alert(1)">click</a>',
        check: out => !/javascript:/i.test(out)
      },
      {
        desc: '<iframe> (not whitelisted) escaped',
        input: '<iframe src="https://evil.com"></iframe>',
        check: out => !/<iframe/i.test(out)
      },
      {
        desc: '<svg onload> (not whitelisted) escaped',
        input: '<svg onload="alert(1)"></svg>',
        check: out => !/<svg/i.test(out)
      },
      {
        desc: '<object> (not whitelisted) escaped',
        input: '<object data="evil.swf"></object>',
        check: out => !/<object/i.test(out)
      },
      {
        desc: 'style attribute (not whitelisted) stripped from <div>',
        input: '<div style="background:url(javascript:alert(1))">x</div>',
        check: out => !/style=/i.test(out) && !/javascript:/i.test(out)
      },
      {
        desc: 'data: URI in href stripped',
        input: '<a href="data:text/html,<script>alert(1)</script>">x</a>',
        check: out => !/data:text\/html/i.test(out) && !/<script/i.test(out)
      }
    ]

    const dangerousResults = dangerousCases.map(({ desc, input, check }) => {
      const out = sanitiseBody(input)
      const ok = check(out)
      return { desc, input, out, ok }
    })
    dangerousResults.forEach(({ desc, input, out, ok }) => {
      console.log(`  ${ok ? '✓' : '✗'} ${desc}`)
      if (!ok) console.log(`    input:  ${JSON.stringify(input)}\n    output: ${JSON.stringify(out)}`)
    })
    const dangerousFailed = dangerousResults.filter(r => !r.ok)
    if (dangerousFailed.length) {
      throw new Error(`Dangerous-payload failures: ${dangerousFailed.map(r => r.desc).join(', ')}`)
    }
    console.log('')

    // Test 20: XSS sanitization — safe content passes through
    console.log('Test 20: XSS sanitization — safe content preserved')
    const safeCases = [
      { desc: 'plain text unchanged', input: 'Hello, world.', check: out => out === 'Hello, world.' },
      { desc: 'empty string unchanged', input: '', check: out => out === '' },
      { desc: '<b> preserved', input: '<b>bold</b>', check: out => /<b>bold<\/b>/.test(out) },
      { desc: '<strong> preserved', input: '<strong>x</strong>', check: out => /<strong>x<\/strong>/.test(out) },
      { desc: '<em> preserved', input: '<em>x</em>', check: out => /<em>x<\/em>/.test(out) },
      {
        desc: '<a href=https://> preserved with href',
        input: '<a href="https://example.com">link</a>',
        check: out => /<a[^>]+href="https:\/\/example\.com"[^>]*>link<\/a>/.test(out)
      },
      {
        desc: '<a href=http://> (http) preserved',
        input: '<a href="http://example.com">link</a>',
        check: out => /href="http:\/\/example\.com"/.test(out)
      },
      {
        desc: 'nested allowed tags preserved',
        input: '<p><strong>bold</strong> and <em>italic</em></p>',
        check: out => /<strong>bold<\/strong>/.test(out) && /<em>italic<\/em>/.test(out)
      },
      {
        desc: 'text with ampersand entities preserved',
        input: 'Fish &amp; chips',
        check: out => out.includes('&amp;') || out.includes('&')
      }
    ]

    const safeResults = safeCases.map(({ desc, input, check }) => {
      const out = sanitiseBody(input)
      return { desc, input, out, ok: check(out) }
    })
    safeResults.forEach(({ desc, input, out, ok }) => {
      console.log(`  ${ok ? '✓' : '✗'} ${desc}`)
      if (!ok) console.log(`    input:  ${JSON.stringify(input)}\n    output: ${JSON.stringify(out)}`)
    })
    const safeFailed = safeResults.filter(r => !r.ok)
    if (safeFailed.length) {
      throw new Error(`Safe-content failures: ${safeFailed.map(r => r.desc).join(', ')}`)
    }
    console.log('')

    // Test 21: XSS sanitization — nested objects and non-string fields
    console.log('Test 21: XSS sanitization — recursion + type handling')
    const nestedInput = {
      body: '<script>alert("top")</script><b>safe</b>',
      title: '<img src=x onerror=alert(1)>',
      count: 42,
      meta: {
        description: '<iframe src="evil"></iframe>clean',
        author: '<a href="javascript:bad()">me</a>'
      }
    }
    const nestedOut = xssSchema.sanitise(nestedInput, { sanitiseHtml: true, strict: false })
    const nestedChecks = [
      ['top-level string sanitized (script removed)', !/<script/i.test(nestedOut.body)],
      ['top-level string sanitized (b preserved)', /<b>safe<\/b>/.test(nestedOut.body)],
      ['top-level string sanitized (onerror removed)', !/onerror/i.test(nestedOut.title)],
      ['number field passed through untouched', nestedOut.count === 42],
      ['nested string sanitized (iframe escaped)', !/<iframe/i.test(nestedOut.meta.description)],
      ['nested string sanitized (javascript: stripped)', !/javascript:/i.test(nestedOut.meta.author)]
    ]
    nestedChecks.forEach(([desc, ok]) => console.log(`  ${ok ? '✓' : '✗'} ${desc}: ${ok}`))
    const nestedFailed = nestedChecks.filter(([, ok]) => !ok)
    if (nestedFailed.length) {
      throw new Error(`Nested sanitization failures: ${nestedFailed.map(([d]) => d).join(', ')}`)
    }
    console.log('')

    // Test 22: xssWhitelistOverride replaces defaults at construction
    console.log('Test 22: xssWhitelistOverride replaces defaults at construction')
    const restrictiveLibrary = new Schemas({
      enableCache: false,
      xssWhitelistOverride: true,
      xssWhitelist: { strong: [] } // only <strong> allowed, no attributes
    })
    restrictiveLibrary.init()
    await restrictiveLibrary.loadSchemas('xss-test.schema.json', { cwd: testSchemaDir })
    const restrictiveSchema = await restrictiveLibrary.getSchema('xss-test')
    const restrictiveSanitise = input =>
      restrictiveSchema.sanitise({ body: input }, { sanitiseHtml: true, strict: false }).body

    const overrideChecks = [
      ['<strong> (in custom list) preserved', /<strong>x<\/strong>/.test(restrictiveSanitise('<strong>x</strong>'))],
      ['<b> (in defaults, not custom) escaped', !/<b>x<\/b>/.test(restrictiveSanitise('<b>x</b>'))],
      ['<a> (in defaults, not custom) escaped', !/<a /i.test(restrictiveSanitise('<a href="https://example.com">x</a>'))],
      ['<script> still escaped', !/<script/i.test(restrictiveSanitise('<script>alert(1)</script>'))]
    ]
    overrideChecks.forEach(([desc, ok]) => console.log(`  ${ok ? '✓' : '✗'} ${desc}: ${ok}`))
    const overrideFailed = overrideChecks.filter(([, ok]) => !ok)
    if (overrideFailed.length) {
      throw new Error(`xssWhitelistOverride failures: ${overrideFailed.map(([d]) => d).join(', ')}`)
    }
    console.log('')

    // Test 23: Exhaustive round-trip of XSSDefaults — every allowed tag and
    // every allowed attribute on that tag survives; a disallowed attribute
    // (onclick, not in any default list) is stripped from every tag.
    console.log('Test 23: Exhaustive XSSDefaults coverage')
    const voidTags = new Set(['area', 'br', 'col', 'hr', 'img', 'wbr'])
    const urlAttrs = new Set(['href', 'src', 'cite', 'poster'])
    const numericAttrs = new Set([
      'colspan', 'coords', 'height', 'rowspan', 'size', 'span', 'tabindex', 'width'
    ])
    const booleanAttrs = new Set([
      'autoplay', 'controls', 'loop', 'muted', 'open', 'playsinline', 'preload'
    ])

    const safeAttrValue = attr => {
      if (urlAttrs.has(attr)) return 'https://example.com/x'
      if (numericAttrs.has(attr)) return '1'
      if (booleanAttrs.has(attr)) return attr
      if (attr === 'datetime') return '2024-01-01T00:00:00Z'
      if (attr === 'dir') return 'ltr'
      if (attr === 'align' || attr === 'valign') return 'left'
      if (attr === 'shape') return 'rect'
      if (attr === 'lang') return 'en'
      if (attr === 'role') return 'button'
      if (attr === 'color') return 'red'
      return 'test'
    }

    const openTag = (tag, attrs) => {
      const attrStr = attrs ? ` ${attrs}` : ''
      return voidTags.has(tag) ? `<${tag}${attrStr}>` : `<${tag}${attrStr}>x</${tag}>`
    }

    const exhaustiveLibrary = new Schemas({ enableCache: false })
    exhaustiveLibrary.init()
    await exhaustiveLibrary.loadSchemas('xss-test.schema.json', { cwd: testSchemaDir })
    const exhaustiveSchema = await exhaustiveLibrary.getSchema('xss-test')
    const san = input => exhaustiveSchema.sanitise({ body: input }, { sanitiseHtml: true, strict: false }).body

    const tagFailures = []
    const attrFailures = []
    const disallowedFailures = []
    let tagCount = 0
    let attrCount = 0

    Object.entries(XSSDefaults).forEach(([tag, attrs]) => {
      tagCount++

      const tagOut = san(openTag(tag))
      if (!tagOut.includes(`<${tag}`)) {
        tagFailures.push({ tag, output: tagOut })
      }

      const badInput = openTag(tag, 'onclick="evil()"')
      const badOut = san(badInput)
      if (/onclick/i.test(badOut)) {
        disallowedFailures.push({ tag, output: badOut })
      }

      attrs.forEach(attr => {
        attrCount++
        const val = safeAttrValue(attr)
        const out = san(openTag(tag, `${attr}="${val}"`))
        if (!out.toLowerCase().includes(`${attr.toLowerCase()}=`)) {
          attrFailures.push({ tag, attr, val, output: out })
        }
      })
    })

    console.log(`  ${tagFailures.length === 0 ? '✓' : '✗'} ${tagCount} tags preserved (${tagFailures.length} failures)`)
    tagFailures.forEach(({ tag, output }) => console.log(`    - <${tag}> → ${JSON.stringify(output)}`))
    console.log(`  ${attrFailures.length === 0 ? '✓' : '✗'} ${attrCount} (tag, attr) pairs preserved (${attrFailures.length} failures)`)
    attrFailures.forEach(({ tag, attr, val, output }) =>
      console.log(`    - <${tag} ${attr}="${val}"> → ${JSON.stringify(output)}`)
    )
    console.log(`  ${disallowedFailures.length === 0 ? '✓' : '✗'} ${tagCount} onclick-strip checks (${disallowedFailures.length} failures)`)
    disallowedFailures.forEach(({ tag, output }) => console.log(`    - <${tag} onclick> → ${JSON.stringify(output)}`))

    const totalExhaustiveFailures = tagFailures.length + attrFailures.length + disallowedFailures.length
    if (totalExhaustiveFailures > 0) {
      throw new Error(`XSSDefaults exhaustive check: ${totalExhaustiveFailures} total failures`)
    }
    console.log('')

    // Test 24: deregisterSchema cleans up extension references (issue #37)
    console.log('Test 24: deregisterSchema cleans up extension references (issue #37)')
    const extPatchPath = path.join(testSchemaDir, 'patch-ext.schema.json')
    await fs.writeFile(extPatchPath, JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $anchor: 'patch-ext',
      type: 'object',
      $patch: { source: { $ref: 'config' }, with: { properties: { _patchAdded: { type: 'string', default: 'added' } } } }
    }, null, 2))
    library.registerSchema(extPatchPath)
    const beforeDeregister = library.schemaExtensions.config?.includes('patch-ext')
    console.log(`  ✓ Extension registered against base: ${beforeDeregister}`)
    const builtWithExt = (await library.getSchema('config')).built
    const hasPatchedProperty = '_patchAdded' in (builtWithExt.properties ?? {})
    console.log(`  ✓ Patched property visible in cached build: ${hasPatchedProperty}`)
    library.deregisterSchema('patch-ext')
    const afterDeregister = !library.schemaExtensions.config?.includes('patch-ext')
    console.log(`  ✓ Extension removed from base after deregister: ${afterDeregister}`)
    const cacheInvalidated = library.schemas.config?.built === undefined
    console.log(`  ✓ Base cached build invalidated on deregister: ${cacheInvalidated}`)
    let buildSucceeded = true
    let postRebuildHasPatch = true
    try {
      const rebuilt = (await library.getSchema('config')).built
      postRebuildHasPatch = '_patchAdded' in (rebuilt.properties ?? {})
    } catch (e) {
      buildSucceeded = false
    }
    console.log(`  ✓ Cached rebuild of base after deregister succeeds: ${buildSucceeded}`)
    console.log(`  ✓ Patched property gone from rebuilt schema: ${!postRebuildHasPatch}`)
    if (!beforeDeregister || !hasPatchedProperty || !afterDeregister || !cacheInvalidated || !buildSucceeded || postRebuildHasPatch) {
      throw new Error('deregisterSchema did not clean up extension references and cached builds correctly')
    }
    console.log('')

    // Test 25: useCache:false isolates filtered builds from the registry instance
    console.log('Test 25: useCache:false isolates filtered builds from the registry instance')
    const includeLP = s => s === 'languagePicker-config'
    const excludeLP = () => false
    const registrySchema = library.schemas.config
    const withLPSchema = await library.getSchema('config', { useCache: false, extensionFilter: includeLP })
    const withoutLPSchema = await library.getSchema('config', { useCache: false, extensionFilter: excludeLP })
    const withLPHas = '_languagePicker' in (withLPSchema.built.properties ?? {})
    const withoutLPHas = '_languagePicker' in (withoutLPSchema.built.properties ?? {})
    console.log(`  ✓ Filter-include build has _languagePicker: ${withLPHas}`)
    console.log(`  ✓ Filter-exclude build lacks _languagePicker: ${!withoutLPHas}`)
    // earlier build's properties must not be mutated by the later build (the original race)
    const withLPStillHas = '_languagePicker' in (withLPSchema.built.properties ?? {})
    console.log(`  ✓ Earlier filter-include build is unaffected by later call: ${withLPStillHas}`)
    // each filtered call must return a fresh instance, not the registry one
    const isolatedFromRegistry = withLPSchema !== registrySchema && withoutLPSchema !== registrySchema && withLPSchema !== withoutLPSchema
    console.log(`  ✓ Filtered builds return isolated Schema instances: ${isolatedFromRegistry}`)
    if (!withLPHas || withoutLPHas || !withLPStillHas || !isolatedFromRegistry) {
      throw new Error('useCache:false did not isolate filtered builds from the registry')
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
