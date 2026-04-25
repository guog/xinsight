const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // 允许中文 subject
    "subject-case": [0],
    // 允许较长的 header（中文占字节更多）
    "header-max-length": [2, "always", 120],
  },
}

export default config
