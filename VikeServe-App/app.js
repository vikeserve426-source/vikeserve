import { app } from 'nitron'

app.init({
  name: "VikeServe",
  packageId: "com.vikeserve.app",
  version: "1.0.0",
  entry: "index.html",
  orientation: "portrait",
  statusBar: true,
  permissions: ["INTERNET"]
})
