const CracoLessPlugin = require("craco-less");
const darkTheme = require("@ant-design/dark-theme").default;

module.exports = {
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: darkTheme,
            javascriptEnabled: true,
          },
        },
      },
    },
  ],
};
