export default {
  plugins: {
    '@csstools/postcss-global-data': {
      files: ['src/shared/styles/media.css']
    },
    'postcss-custom-media': {},
    'postcss-nesting': {},
    autoprefixer: {}
  }
}
