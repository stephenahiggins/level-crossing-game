module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    es2021: true,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/strict-boolean-expressions": "off",
    "@typescript-eslint/no-misused-promises": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/semi": ["error", "always"],
    "@typescript-eslint/quotes": "off",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    // Prevent using raw game status & feedback literals; enforce centralized constants
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value='idle']",
        message: 'Use GAME_STATUS.IDLE instead of raw "idle" literal.',
      },
      {
        selector: "Literal[value='playing']",
        message: 'Use GAME_STATUS.PLAYING instead of raw "playing" literal.',
      },
      {
        selector: "Literal[value='feedback']",
        message: 'Use GAME_STATUS.FEEDBACK instead of raw "feedback" literal.',
      },
      {
        selector: "Literal[value='gameover']",
        message: 'Use GAME_STATUS.GAME_OVER instead of raw "gameover" literal.',
      },
      {
        selector: "Literal[value='correct']",
        message: 'Use FEEDBACK_STATE.CORRECT instead of raw "correct" literal.',
      },
      {
        selector: "Literal[value='try-again']",
        message: 'Use FEEDBACK_STATE.TRY_AGAIN instead of raw "try-again" literal.',
      },
      {
        selector: "Literal[value='failed']",
        message: 'Use FEEDBACK_STATE.FAILED instead of raw "failed" literal.',
      },
    ],
  },
};
