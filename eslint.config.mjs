import tseslint from 'typescript-eslint'

// No colour literals outside src/renderer/themes/. See docs/THEMING.md.
const colourPattern = '/#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(/'
const namedColours =
  '/^(white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|brown|cyan|magenta)$/'
const message = 'Colour literals belong in src/renderer/themes/. Use a CSS custom property.'

export default tseslint.config(
  { ignores: ['out/**', 'node_modules/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/renderer/themes/**'],
    languageOptions: { parser: tseslint.parser },
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=${colourPattern}]`, message },
        { selector: `TemplateElement[value.raw=${colourPattern}]`, message },
        { selector: `Literal[value=${namedColours}]`, message }
      ]
    }
  }
)
