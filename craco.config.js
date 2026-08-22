module.exports = {
  jest: {
    configure: (jestConfig) => {
      // Jest 26's resolver predates Node's package.json "exports" field, so it can't
      // follow antd's dependencies' exports-only subpaths (e.g. `@rc-component/
      // pagination/locale/en_US` or `@rc-component/picker/generate/dayjs`, which only
      // exist as literal files under lib/ or es/, not at the top-level path Jest
      // looks for) — this affects every @rc-component/* subpackage antd pulls in, not
      // just one. This is a test-runner-only workaround — Phase 4's move to
      // Vite/Vitest resolves exports maps natively and will make it unnecessary.
      jestConfig.moduleNameMapper = {
        ...jestConfig.moduleNameMapper,
        '^@rc-component/([^/]+)/(?!lib/|es/|assets/)(.*)$': '@rc-component/$1/lib/$2',
      };
      // @ant-design/icons' CJS build deep-imports @ant-design/colors' ESM-only
      // "es/generate" submodule directly (a packaging inconsistency, not something
      // this app controls) — Jest's default transformIgnorePatterns skips all of
      // node_modules, so that raw `import` syntax fails to parse unless we carve out
      // an exception for it here.
      jestConfig.transformIgnorePatterns = [
        'node_modules/(?!(@ant-design/colors|@ant-design/fast-color)/)',
        '^.+\\.module\\.(css|sass|scss)$',
      ];
      return jestConfig;
    },
  },
};
