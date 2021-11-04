module.exports = {
  presets: ['@babel/preset-react'],
  plugins: [
    [
      'babel-plugin-styled-components',
      {
        ssr: true,
        displayName: true,
      },
    ],
  ],
};
