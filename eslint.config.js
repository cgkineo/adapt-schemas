import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat()

export default [
  ...compat.extends('standard'),
  {
    ignores: ['node_modules/']
  }
]
