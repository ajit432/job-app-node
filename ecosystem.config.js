module.exports = {
  apps: [{
    name: "employee-management-app",
    script: "./app.js",
    instances: "max",
    exec_mode: "cluster",
    watch: true,
    error_file: "./logs/error.log",
    out_file: "./logs/out.log",
    combine_logs: true
  }]
};
