// Sample ecosystem.config
module.exports = {
  apps : [
      {
        name: "mongomigrate",
        script: "./dist/server.js",
        watch: false,
        env: {
          // "NODE_ENV": "",
          // "MONGO_URL": "",
          // "SQL_URL": "",
          // "MONGO_DB_NAME": ""
        }
      }
  ]
}
