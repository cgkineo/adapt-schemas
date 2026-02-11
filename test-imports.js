// Test different import patterns
console.log('Testing import patterns...\n')

// Pattern 1: Import from index (main export)
import { SchemaError as SE1 } from './index.js'
console.log('1. From index.js:', SE1.name)

// Pattern 2: Import from SchemaError directly  
import { SchemaError as SE2 } from './lib/SchemaError.js'
console.log('2. From SchemaError.js:', SE2.name)

// Pattern 3: Import from Schemas
import { SchemaError as SE3 } from './lib/Schemas.js'
console.log('3. From Schemas.js:', SE3.name)

// Verify they're all the same class
console.log('\nAll same class?', SE1 === SE2 && SE2 === SE3)
